import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../shared/color.js');

const rgb = (r, g, b, a = 1) => ({ r, g, b, a });
const DARK_BG = C.parseColor('#161b27');
const SURFACE = C.parseColor('#161b27');
const SURFACE2 = C.parseColor('#1d2434');

test('parseColor: hex, rgb(), rgba(), espaços e transparent', () => {
  assert.deepEqual(C.parseColor('#fff'), rgb(255, 255, 255, 1));
  assert.deepEqual(C.parseColor('#1d2434'), rgb(29, 36, 52, 1));
  assert.deepEqual(C.parseColor('rgb(1, 2, 3)'), rgb(1, 2, 3, 1));
  assert.deepEqual(C.parseColor('rgba(1,2,3,0.5)'), rgb(1, 2, 3, 0.5));
  assert.deepEqual(C.parseColor('rgb(1 2 3 / 50%)'), rgb(1, 2, 3, 0.5));
  assert.equal(C.parseColor('transparent').a, 0);
  assert.equal(C.parseColor('banana'), null);
  assert.equal(C.parseColor(''), null);
});

test('contraste: preto/branco = 21; igual = 1', () => {
  assert.ok(Math.abs(C.contrast(rgb(0, 0, 0), rgb(255, 255, 255)) - 21) < 0.01);
  assert.ok(Math.abs(C.contrast(rgb(9, 9, 9), rgb(9, 9, 9)) - 1) < 1e-9);
});

test('fixBackground: branco e cinza claro viram a superfície; pastel escurece mantendo a matiz', () => {
  assert.deepEqual(C.fixBackground(rgb(255, 255, 255), SURFACE, SURFACE2), { r: 29, g: 36, b: 52 });
  assert.deepEqual(C.fixBackground(rgb(225, 225, 225), SURFACE, SURFACE2), { r: 29, g: 36, b: 52 });
  const green = C.fixBackground(rgb(200, 255, 200), SURFACE, SURFACE2); // pastel verde
  assert.ok(green && C.luminance(green) < 0.2, 'escureceu');
  assert.ok(green.g > green.r && green.g > green.b, 'continua esverdeado');
  assert.equal(C.fixBackground(rgb(20, 20, 30), SURFACE, SURFACE2), null, 'já escuro');
  assert.equal(C.fixBackground(rgb(255, 255, 255, 0.2), SURFACE, SURFACE2), null, 'quase transparente');
});

test('fixText: preto vira cor de texto do tema', () => {
  assert.deepEqual(C.fixText(rgb(0, 0, 0), DARK_BG), { text: true });
  assert.deepEqual(C.fixText(rgb(25, 25, 25), DARK_BG), { text: true });
});

test('fixText: azul-marinho e azul puro clareiam mantendo a matiz e chegam a 4.5:1', () => {
  for (const c of [rgb(59, 89, 152), rgb(0, 0, 255), rgb(0, 0, 170)]) {
    const fix = C.fixText(c, DARK_BG);
    assert.ok(fix && fix.rgb, JSON.stringify(c));
    assert.ok(C.contrast(fix.rgb, DARK_BG) >= 4.5, `contraste ${C.contrast(fix.rgb, DARK_BG)}`);
    assert.ok(fix.rgb.b > fix.rgb.r && fix.rgb.b > fix.rgb.g - 1, 'continua azulado');
  }
});

test('fixText: cinza médio é clareado (mantém hierarquia), não vira branco', () => {
  const fix = C.fixText(rgb(90, 90, 90), DARK_BG);
  assert.ok(fix && fix.rgb);
  assert.ok(fix.rgb.r < 200 && fix.rgb.r > 90);
  assert.ok(C.contrast(fix.rgb, DARK_BG) >= 4.5);
});

test('fixText: texto que já tem contraste (ou é quase transparente) não é mexido', () => {
  assert.equal(C.fixText(rgb(230, 234, 243), DARK_BG), null);
  assert.equal(C.fixText(rgb(255, 93, 93), DARK_BG), null, 'vermelho de rating já ok');
  assert.equal(C.fixText(rgb(0, 0, 0, 0.1), DARK_BG), null);
});

function icon(w, h, paint) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(paint(x, y), (y * w + x) * 4);
  return d;
}
const T = [0, 0, 0, 0];

test('classifyIcon: quadrado branco opaco com desenho colorido → light', () => {
  const d = icon(16, 16, (x, y) => (x > 4 && x < 11 && y > 4 && y < 11 ? [220, 40, 40, 255] : [255, 255, 255, 255]));
  assert.equal(C.classifyIcon(d, 16, 16), 'light');
});

test('classifyIcon: desenho preto sobre transparente → dark', () => {
  const d = icon(16, 16, (x, y) => (x > 3 && x < 12 && y > 3 && y < 12 ? [0, 0, 0, 255] : T));
  assert.equal(C.classifyIcon(d, 16, 16), 'dark');
});

test('classifyIcon: ícone colorido transparente → none; vazio → none', () => {
  const colorful = icon(16, 16, (x, y) => (x > 3 && x < 12 && y > 3 && y < 12 ? [230, 120, 30, 255] : T));
  assert.equal(C.classifyIcon(colorful, 16, 16), 'none');
  assert.equal(C.classifyIcon(icon(16, 16, () => T), 16, 16), 'none');
  assert.equal(C.classifyIcon(new Uint8ClampedArray(0), 0, 0), 'none');
});

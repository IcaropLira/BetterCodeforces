import test from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion, releaseChangelog } from '../scripts/release.mjs';
import { notesFor } from '../scripts/changelog-notes.mjs';

test('nextVersion: patch, minor, major e versão explícita', () => {
  assert.equal(nextVersion('0.3.1', 'patch'), '0.3.2');
  assert.equal(nextVersion('0.3.1', 'minor'), '0.4.0');
  assert.equal(nextVersion('0.3.1', 'major'), '1.0.0');
  assert.equal(nextVersion('0.3.1', '2.5.0'), '2.5.0');
  assert.equal(nextVersion('0.3.1', 'banana'), null);
  assert.equal(nextVersion('0.3.1', undefined), null);
});

const LOG = '# Changelog\n\n## Unreleased\n- Fix A\n- Fix B\n\n## 0.3.0\n- Old\n';

test('releaseChangelog: itens de Unreleased viram a nova versão e Unreleased fica vazio', () => {
  const out = releaseChangelog(LOG, '0.3.1');
  assert.equal(out, '# Changelog\n\n## Unreleased\n\n## 0.3.1\n- Fix A\n- Fix B\n\n## 0.3.0\n- Old\n');
  assert.equal(notesFor(out, '0.3.1'), '- Fix A\n- Fix B');
});

test('releaseChangelog: sem seção ou seção vazia → null', () => {
  assert.equal(releaseChangelog('# Changelog\n\n## 0.3.0\n- Old\n', '0.3.1'), null);
  assert.equal(releaseChangelog('# Changelog\n\n## Unreleased\n\n## 0.3.0\n- Old\n', '0.3.1'), null);
});

test('releaseChangelog: Unreleased no fim do arquivo', () => {
  assert.equal(releaseChangelog('# C\n\n## Unreleased\n- X\n', '1.0.0'), '# C\n\n## Unreleased\n\n## 1.0.0\n- X\n');
});

test('notesFor: última seção, versão inexistente e escape do ponto', () => {
  assert.equal(notesFor(LOG, '0.3.0'), '- Old');
  assert.equal(notesFor(LOG, '9.9.9'), null);
  assert.equal(notesFor('## 0x3y0\n- no\n', '0.3.0'), null, '"." não é curinga');
});

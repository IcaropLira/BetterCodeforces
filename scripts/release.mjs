#!/usr/bin/env node
// Lança uma versão nova com um comando:
//
//   npm run release -- patch          # 0.3.1 → 0.3.2
//   npm run release -- minor          # 0.3.1 → 0.4.0
//   npm run release -- 1.0.0          # versão explícita
//   npm run release -- patch --push   # além disso, envia o commit e a tag (dispara o workflow Release)
//   npm run release -- patch --no-git # só atualiza os arquivos (sem commit/tag)
//
// O que faz: confere que a árvore git está limpa, move "## Unreleased" do
// CHANGELOG para a nova versão, atualiza package.json / package-lock.json /
// manifest.base.json, roda `npm run check`, cria o commit e a tag vX.Y.Z.
// O resto (zips, GitHub Release, Chrome Web Store, Firefox AMO) é feito pelo
// workflow .github/workflows/release.yml quando a tag chega ao GitHub.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const bumpArg = args.find((a) => !a.startsWith('--'));
const read = (f) => readFileSync(join(root, f), 'utf8');
const write = (f, s) => writeFileSync(join(root, f), s);
const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const out = (cmd, a) => execFileSync(cmd, a, { cwd: root, encoding: 'utf8' }).trim();

export function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump || '')) return bump;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m || !['major', 'minor', 'patch'].includes(bump)) return null;
  const [maj, min, pat] = m.slice(1).map(Number);
  if (bump === 'major') return `${maj + 1}.0.0`;
  if (bump === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

/** Move o conteúdo de "## Unreleased" para "## <version>". Devolve null se não houver nada a lançar. */
export function releaseChangelog(text, version) {
  const m = /^## Unreleased[ \t]*\r?\n/m.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const next = text.slice(start).search(/^## /m);
  const body = next === -1 ? text.slice(start) : text.slice(start, start + next);
  if (!body.trim()) return null;
  return `${text.slice(0, m.index)}## Unreleased\n\n## ${version}\n${text.slice(start)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(read('package.json'));
  const version = nextVersion(pkg.version, bumpArg);
  if (!version) fail('uso: npm run release -- <patch|minor|major|x.y.z> [--push] [--no-git]');
  if (version === pkg.version) fail(`a versão já é ${version}`);

  const useGit = !flags.has('--no-git');
  if (useGit && out('git', ['status', '--porcelain'])) fail('há alterações não commitadas — faça commit (ou stash) antes de lançar.');
  if (useGit && out('git', ['tag', '--list', `v${version}`])) fail(`a tag v${version} já existe.`);

  const changelog = releaseChangelog(read('CHANGELOG.md'), version);
  if (!changelog) fail('CHANGELOG.md não tem itens em "## Unreleased". Descreva o que mudou antes de lançar.');

  // troca só a string de versão: preserva a formatação dos arquivos (diffs pequenos)
  const bumpFile = (f) => {
    const text = read(f);
    if (!/"version":\s*"[^"]*"/.test(text)) fail(`${f} não tem "version"`);
    write(f, text.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));
  };
  bumpFile('package.json');
  bumpFile('manifest.base.json');
  write('CHANGELOG.md', changelog);
  try {
    const lock = JSON.parse(read('package-lock.json'));
    lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  } catch {
    /* sem package-lock: tudo bem */
  }
  console.log(`✔ versão ${version} em package.json, manifest.base.json, package-lock.json e CHANGELOG.md`);

  sh('npm run check');
  if (!useGit) {
    console.log(`✔ pronto (sem git). Pacotes em dist/hiraku-codeforces-${version}-{chrome,firefox}.zip`);
  } else {
    sh('git add package.json package-lock.json manifest.base.json CHANGELOG.md');
    sh(`git commit -m "chore(release): v${version}"`);
    sh(`git tag -a v${version} -m "v${version}"`);
    if (flags.has('--push')) {
      sh('git push origin HEAD --follow-tags');
      console.log(`✔ v${version} enviada — acompanhe em Actions → Release.`);
    } else {
      console.log(`✔ commit e tag v${version} criados. Para publicar: git push origin HEAD --follow-tags`);
    }
  }
}

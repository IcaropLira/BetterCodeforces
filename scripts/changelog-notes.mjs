#!/usr/bin/env node
// Imprime as notas de uma versão a partir do CHANGELOG.md (usado pelo workflow Release).
//   node scripts/changelog-notes.mjs 0.3.1
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function notesFor(text, version) {
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^## ${esc}[ \\t]*\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text);
  return m ? m[1].trim() : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = (process.argv[2] || '').replace(/^v/, '');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const notes = notesFor(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version);
  if (!notes) {
    console.error(`sem seção "## ${version}" no CHANGELOG.md`);
    process.exit(1);
  }
  console.log(notes);
}

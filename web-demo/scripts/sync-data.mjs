// Copies the canonical shared-data/ into the web build as a generated mirror.
// shared-data/ is the SINGLE source of truth; src/shared-data.generated/ is
// build output (gitignored) and must never be hand-edited.
import { cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', '..', 'shared-data');
const dest = resolve(here, '..', 'src', 'shared-data.generated');

if (!existsSync(src)) {
  console.error(`[sync-data] canonical source not found: ${src}`);
  process.exit(1);
}
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-data] ${src} -> ${dest}`);

// Builds the whole site into _site/: the homepage plus every game under /games/<slug>/.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '_site');
const GAMES = {
  adventure_rainbows: 'adventure_rainbows',
};

rmSync(out, { recursive: true, force: true });
cpSync(resolve(root, 'site'), out, { recursive: true });

for (const [slug, dir] of Object.entries(GAMES)) {
  const cwd = resolve(root, dir);
  const run = (cmd) => execSync(cmd, { cwd, stdio: 'inherit' });
  if (!existsSync(resolve(cwd, 'node_modules'))) run('npm ci');
  // Relative base so each game works no matter what path or domain the site is hosted on.
  run(`npx vite build --base ./ --emptyOutDir --outDir "${resolve(out, 'games', slug)}"`);
}

console.log(`\nSite built in ${out}`);

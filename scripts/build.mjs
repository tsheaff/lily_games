// Builds the whole site into _site/: the homepage plus every game under /games/<slug>/.
// Games with a package.json are built with Vite; anything else is copied as plain static files.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '_site');
const games = readdirSync(resolve(root, 'games'), { withFileTypes: true }).filter((d) => d.isDirectory());

rmSync(out, { recursive: true, force: true });
cpSync(resolve(root, 'site'), out, { recursive: true });

for (const { name: slug } of games) {
  const cwd = resolve(root, 'games', slug);
  const dest = resolve(out, 'games', slug);
  if (!existsSync(resolve(cwd, 'package.json'))) {
    cpSync(cwd, dest, { recursive: true, filter: (src) => !src.endsWith('.sh') });
    continue;
  }
  const run = (cmd) => execSync(cmd, { cwd, stdio: 'inherit' });
  if (!existsSync(resolve(cwd, 'node_modules'))) run('npm ci');
  // Relative base so each game works no matter what path or domain the site is hosted on.
  run(`npx vite build --base ./ --emptyOutDir --outDir "${dest}"`);
}

console.log(`\nSite built in ${out}`);

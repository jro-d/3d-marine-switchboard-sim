import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const outDir = path.resolve(process.argv[2] || '_site');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html missing — run `npm run build` first.');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(distDir, outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`Built GitHub Pages artifact in ${outDir} from ${distDir}`);

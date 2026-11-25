import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDefaultRoot() {
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    return distDir;
  }
  return __dirname;
}

export function createApp(rootDir = resolveDefaultRoot()) {
  const app = express();

  app.use(
    express.static(rootDir, {
      dotfiles: 'ignore',
      index: 'index.html',
    })
  );

  app.get('/', (_req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  const app = createApp();

  app.listen(port, host, () => {
    console.log(`Marine HV Simulator serving at http://${host}:${port}`);
  });
}

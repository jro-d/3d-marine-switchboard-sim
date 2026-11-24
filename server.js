import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(rootDir = __dirname) {
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

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';
  const app = createApp();
  app.listen(port, host, () => {
    console.log(`Marine HV Simulator dev server listening on http://${host}:${port}`);
  });
}

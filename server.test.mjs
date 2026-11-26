import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createApp } from './server.js';

function startTestServer(rootDir) {
  const app = createApp(rootDir);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

test('serves built index.html and bundled Vite assets with 200 OK', async () => {
  const distDir = path.resolve('dist');
  assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'Run npm run build before running server tests');

  const { server, port } = await startTestServer(distDir);
  try {
    const base = `http://127.0.0.1:${port}`;

    const indexRes = await fetch(`${base}/`);
    assert.equal(indexRes.status, 200);
    assert.match(indexRes.headers.get('content-type') || '', /text\/html/);
    const html = await indexRes.text();
    assert.match(html, /Marine HV 6\.6 kV Switchroom/);

    const assetRefs = [
      ...html.matchAll(/(?:href|src)="(\.\/assets\/[^"]+|\/assets\/[^"]+)"/g),
    ].map((m) => m[1].replace(/^\./, ''));

    assert.ok(assetRefs.length >= 2, `Expected built CSS and JS assets in index.html, got: ${assetRefs.join(', ')}`);

    for (const assetPath of assetRefs) {
      const urlPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
      const res = await fetch(`${base}${urlPath}`);
      assert.equal(res.status, 200, `Expected 200 for ${urlPath}`);
    }

    for (const glbName of ['engineer.glb', 'watertight-door.glb', 'rescue-hook.glb', 'co2-extinguisher.glb', 'workbench-tools.glb']) {
      const glbRes = await fetch(`${base}/models/${glbName}`);
      assert.equal(glbRes.status, 200, `Expected 200 for /models/${glbName}`);
    }

    const missingRes = await fetch(`${base}/does-not-exist-check.txt`);
    assert.equal(missingRes.status, 404);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

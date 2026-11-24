import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './server.js';

function startTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer(createApp());
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

test('serves index.html and design-system stylesheets with 200 OK', async () => {
  const { server, port } = await startTestServer();
  try {
    const base = `http://127.0.0.1:${port}`;

    const indexRes = await fetch(`${base}/`);
    assert.equal(indexRes.status, 200);
    assert.match(indexRes.headers.get('content-type') || '', /text\/html/);
    const html = await indexRes.text();
    assert.match(html, /Marine HV 6\.6 kV Switchboard/);

    for (const cssPath of [
      '/design-system/fonts.css',
      '/design-system/tokens.css',
      '/design-system/components.css',
    ]) {
      const res = await fetch(`${base}${cssPath}`);
      assert.equal(res.status, 200, `Expected 200 for ${cssPath}`);
      assert.match(res.headers.get('content-type') || '', /text\/css/);
    }

    const missingRes = await fetch(`${base}/does-not-exist-check.txt`);
    assert.equal(missingRes.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

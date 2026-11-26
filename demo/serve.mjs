#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { buildBundle } = require('../lib/cdp.js');

const PORT = Number(
  process.env.PORT || (process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 4319)
);
const DEMO_HTML = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/bundle.js') {
    try {
      const { code, hash } = buildBundle();
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Bundle-Hash': hash,
      });
      res.end(code);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Bundle compile error: ${err.message}`);
    }
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = fs.readFileSync(DEMO_HTML, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Obsidian Prism for T3 Code interactive preview running at http://127.0.0.1:${PORT}`);
});

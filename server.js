import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const files = new Set(['index.html', 'style.css', 'app.js', 'data.js', 'engine.js', 'planner.js', 'storage.js']);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
export function createServer() {
  return http.createServer(async (req, res) => {
    const name = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!['GET', 'HEAD'].includes(req.method) || !files.has(name)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    try {
      const body = await readFile(new URL(name, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${types[name.split('.').pop()]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end('Unable to read application file'); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('PORT must be an integer between 0 and 65535.');
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.on('error', error => {
      console.error(`Unable to start mission control: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Mission control: http://127.0.0.1:${server.address().port}`);
      console.log('Open this address in your browser. Keep this terminal running; press Ctrl+C to stop.');
    });
  }
}
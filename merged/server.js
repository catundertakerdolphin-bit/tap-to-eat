#!/usr/bin/env node
/* TAP TO EAT — локальный дев-сервер.
   - Раздаёт статику из этой папки (merged/).
   - POST /save-config  → пишет config.json в проект + бэкап в config-backups/
     (бэкапы = точки отката; чистить можно вручную).
   Запуск:  node server.js   →  http://localhost:4321
   Порт можно переопределить:  PORT=5000 node server.js
*/
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 4321;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

function saveConfig(body, res){
  try {
    JSON.parse(body); // валидация — не пишем мусор
    const backups = path.join(ROOT, 'config-backups');
    fs.mkdirSync(backups, { recursive:true });
    const target = path.join(ROOT, 'config.json');
    if (fs.existsSync(target)) {
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      fs.copyFileSync(target, path.join(backups, 'config-' + ts + '.json'));
    }
    fs.writeFileSync(target, body);
    console.log('[save-config] записан config.json (' + body.length + ' байт), бэкап создан');
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end('{"ok":true}');
  } catch (e) {
    console.error('[save-config] ошибка:', e.message);
    res.writeHead(400, {'Content-Type':'application/json'});
    res.end('{"ok":false,"error":"' + e.message.replace(/"/g,'') + '"}');
  }
}

http.createServer((req, res) => {
  // CORS (на случай открытия с другого origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/save-config') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => saveConfig(body, res));
    return;
  }

  // статика
  const rel = (req.url === '/' ? '/index.html' : req.url).split('?')[0];
  const fp = path.normalize(path.join(ROOT, decodeURIComponent(rel)));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('404'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate'});
    res.end(data);
  });
}).listen(PORT, () => console.log('TAP TO EAT → http://localhost:' + PORT + '  (Ctrl+C чтобы остановить)'));

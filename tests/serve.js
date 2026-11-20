// Local static server for the deployed folder (public/), sending the production headers from its staticwebapp.config.json.
// Usage: node tests/serve.js public 8765
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || 'public'), port = +(process.argv[3] || 8765);
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'staticwebapp.config.json')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
// Second layer, as on Azure: the config's 404 routes.
const blocked = cfg.routes.filter((r) => r.statusCode === 404).map((r) => new RegExp('^' + r.route.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.statusCode = 400; return res.end(); }
  if (p === '/') p = '/index.html';
  const f = path.resolve(root, '.' + p);
  // upgrade-insecure-requests is dropped because this server is plain http on localhost.
  Object.entries(cfg.globalHeaders).forEach(([k, v]) => res.setHeader(k, k === 'Content-Security-Policy' ? v.replace('; upgrade-insecure-requests', '') : v));
  if ((f !== root && !f.startsWith(root + path.sep)) || blocked.some((r) => r.test(p)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
  res.end(fs.readFileSync(f));
}).listen(port, () => console.log('serving', root, 'on', port));

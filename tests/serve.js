// Local static server for the deployed folder (public/), sending the production headers from its staticwebapp.config.json.
// Usage: node tests/serve.js public 8765
// Test-only: never deployed. Paths are resolved with realpath (symlinks followed) and must stay inside the served root;
// each file is opened once and read through that handle (no exists/stat-then-read race).
const http = require('http'), fs = require('fs'), path = require('path');
const root = fs.realpathSync(path.resolve(process.argv[2] || 'public')), port = +(process.argv[3] || 8765);
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'staticwebapp.config.json'), 'utf8'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
// Second layer, as on Azure: the config's 404 routes.
const blocked = cfg.routes.filter((r) => r.statusCode === 404).map((r) => new RegExp('^' + r.route.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));

function notFound(res) { res.statusCode = 404; res.end('not found'); }

// The real path of a request inside root, or null. Rejects NUL bytes, missing files and anything (incl. symlinks) outside root.
function safePath(urlPath) {
  if (urlPath.indexOf('\0') !== -1) return null;
  let real;
  try { real = fs.realpathSync(path.resolve(root, '.' + urlPath)); } catch (e) { return null; }
  return real.startsWith(root + path.sep) ? real : null;
}

// Open once, check it's a regular file through the same handle, read, close.
function readFileOnce(real) {
  let fd;
  try {
    fd = fs.openSync(real, 'r');
    if (!fs.fstatSync(fd).isFile()) return null;
    return fs.readFileSync(fd);
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.statusCode = 400; return res.end(); }
  if (p === '/') p = '/index.html';
  // upgrade-insecure-requests is dropped because this server is plain http on localhost.
  Object.entries(cfg.globalHeaders).forEach(([k, v]) => res.setHeader(k, k === 'Content-Security-Policy' ? v.replace('; upgrade-insecure-requests', '') : v));
  if (blocked.some((r) => r.test(p))) return notFound(res);
  const real = safePath(p);
  if (!real) return notFound(res);
  const body = readFileOnce(real);
  if (!body) return notFound(res);
  res.setHeader('Content-Type', types[path.extname(real)] || 'application/octet-stream');
  res.end(body);
}).listen(port, () => console.log('serving', root, 'on', port));

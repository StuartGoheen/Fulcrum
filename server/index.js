const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const path         = require('path');
const cookieParser = require('cookie-parser');
const compression  = require('compression');

const { initialize } = require('./db');

const characterRoutes = require('./routes/characters');
const campaignRoutes  = require('./routes/campaign');
const equipmentRoutes = require('./routes/equipment');
const inventoryRoutes = require('./routes/inventory');
const backstoryRoutes     = require('./routes/backstory');
const itemRequestRoutes   = require('./routes/item-requests');
const journalRoutes       = require('./routes/journal');
const decisionRoutes      = require('./routes/decisions');
const narrativeChallengeRoutes = require('./routes/narrative-challenges');
const npcProfileRoutes        = require('./routes/npc-profiles');
const galaxyPinRoutes         = require('./routes/galaxy-pins');
const fs = require('fs');
const socketHandlers  = require('./sockets/handlers');
const { loginRoute, logoutRoute, gate, roleFromCookie, COOKIE_SECRET } = require('./auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
app.set('io', io);

const PORT = process.env.PORT || 5000;
const ROOT = path.join(__dirname, '..');

app.use(compression());
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

if (process.env.NODE_ENV !== 'production') {
  app.use(function(req, res, next) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
}

app.post('/api/auth/login',  loginRoute);
app.post('/api/auth/logout', logoutRoute);

app.get('/login',  (req, res) => {
  const role = roleFromCookie(req);
  if (role) return res.redirect('/');
  res.sendFile(path.join(ROOT, 'public', 'login.html'));
});
app.get('/login/', (req, res) => res.redirect('/login'));

app.use(gate);

app.use(express.static(path.join(ROOT, 'public')));
app.use('/js',     express.static(path.join(ROOT, 'js')));
app.use('/data',   express.static(path.join(ROOT, 'data')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/attached_assets', express.static(path.join(ROOT, 'attached_assets')));

app.get('/api/auth/role', (req, res) => {
  res.json({ role: req.userRole || null });
});

app.use('/api', characterRoutes);
app.use('/api', campaignRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', backstoryRoutes);
app.use('/api', itemRequestRoutes);
app.use('/api', journalRoutes);
app.use('/api/campaign', decisionRoutes);
app.use('/api', narrativeChallengeRoutes);
app.use('/api', npcProfileRoutes);
app.use('/api', galaxyPinRoutes);

app.get('/gm',    (req, res) => res.redirect('/gm/'));
app.get('/gm/',   (req, res) => res.sendFile(path.join(ROOT, 'public', 'gm', 'index.html')));

app.get('/player',  (req, res) => res.redirect('/player/'));
app.get('/player/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'player', 'index.html')));

app.get('/create',  (req, res) => res.redirect('/create/'));
app.get('/create/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'create', 'index.html')));

app.get('/market',  (req, res) => res.redirect('/market/'));
app.get('/market/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'market', 'index.html')));

const ALLOWED_MAPS = ['burning-deck', 'switch-lair', 'landing-field', 'vanishing-place', 'banshee', 'jungle-trek'];

app.post('/api/maps/save', (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  const { mapKey, hitboxes } = req.body;
  if (!mapKey || !ALLOWED_MAPS.includes(mapKey)) return res.status(400).json({ error: 'Invalid map key.' });
  if (!Array.isArray(hitboxes) || hitboxes.length === 0) return res.status(400).json({ error: 'No hitbox data.' });

  const filePath = path.join(ROOT, 'public', 'maps', mapKey + '.html');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Map file not found.' });

  let html;
  try { html = fs.readFileSync(filePath, 'utf8'); } catch (e) { return res.status(500).json({ error: 'Failed to read map file.' }); }

  const svgOpen  = html.indexOf('<svg');
  const svgClose = html.indexOf('</svg>');
  if (svgOpen === -1 || svgClose === -1) return res.status(500).json({ error: 'Could not locate SVG block in map.' });

  const svgTagEnd = html.indexOf('>', svgOpen);
  const svgHeader = html.substring(svgOpen, svgTagEnd + 1);

  let newSVGContent = '\n';
  hitboxes.forEach(hb => {
    const nameEsc = (hb.room || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const descEsc = (hb.desc || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const x = Math.round(hb.x || 0);
    const y = Math.round(hb.y || 0);
    const w = Math.round(hb.w || 50);
    const h = Math.round(hb.h || 50);
    const rx = hb.rx || '3';
    newSVGContent += `    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="hitbox"\n      data-room="${nameEsc}"\n      data-desc="${descEsc}"/>\n\n`;
  });

  const before = html.substring(0, svgTagEnd + 1);
  const after  = html.substring(svgClose);
  const newHTML = before + '\n' + newSVGContent + '  ' + after;

  try { fs.writeFileSync(filePath, newHTML, 'utf8'); } catch (e) { return res.status(500).json({ error: 'Failed to write map file.' }); }

  res.json({ ok: true, count: hitboxes.length });
});

socketHandlers(io);

initialize().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] The Edge of the Empire — listening on port ${PORT}`);
    console.log(`[server] Local:   http://localhost:${PORT}`);
    console.log(`[server] Network: http://<your-local-ip>:${PORT}`);
  });
}).catch(err => {
  console.error('[db] Failed to initialize database:', err);
  process.exit(1);
});

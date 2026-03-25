const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const path         = require('path');
const cookieParser = require('cookie-parser');

require('./db');

const characterRoutes = require('./routes/characters');
const campaignRoutes  = require('./routes/campaign');
const equipmentRoutes = require('./routes/equipment');
const inventoryRoutes = require('./routes/inventory');
const backstoryRoutes     = require('./routes/backstory');
const itemRequestRoutes   = require('./routes/item-requests');
const socketHandlers  = require('./sockets/handlers');
const { loginRoute, logoutRoute, gate, roleFromCookie, COOKIE_SECRET } = require('./auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const PORT = process.env.PORT || 5000;
const ROOT = path.join(__dirname, '..');

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

app.get('/api/auth/role', (req, res) => {
  res.json({ role: req.userRole || null });
});

app.use('/api', characterRoutes);
app.use('/api', campaignRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', backstoryRoutes);
app.use('/api', itemRequestRoutes);

app.get('/gm',    (req, res) => res.redirect('/gm/'));
app.get('/gm/',   (req, res) => res.sendFile(path.join(ROOT, 'public', 'gm', 'index.html')));

app.get('/player',  (req, res) => res.redirect('/player/'));
app.get('/player/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'player', 'index.html')));

app.get('/create',  (req, res) => res.redirect('/create/'));
app.get('/create/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'create', 'index.html')));

app.get('/market',  (req, res) => res.redirect('/market/'));
app.get('/market/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'market', 'index.html')));

socketHandlers(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] The Edge of the Empire — listening on port ${PORT}`);
  console.log(`[server] Local:   http://localhost:${PORT}`);
  console.log(`[server] Network: http://<your-local-ip>:${PORT}`);
});

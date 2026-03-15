const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

require('./db');

const characterRoutes = require('./routes/characters');
const campaignRoutes  = require('./routes/campaign');
const equipmentRoutes = require('./routes/equipment');
const socketHandlers  = require('./sockets/handlers');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const PORT = process.env.PORT || 5000;
const ROOT = path.join(__dirname, '..');

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use('/js',     express.static(path.join(ROOT, 'js')));
app.use('/data',   express.static(path.join(ROOT, 'data')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));


app.use('/api', characterRoutes);
app.use('/api', campaignRoutes);
app.use('/api', equipmentRoutes);

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

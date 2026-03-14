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

const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

app.use('/api', characterRoutes);
app.use('/api', campaignRoutes);
app.use('/api', equipmentRoutes);

app.get('/gm', (req, res) => res.redirect('/gm/'));
app.get('/gm/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'gm', 'index.html')));

socketHandlers(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] The Edge of the Empire — listening on port ${PORT}`);
  console.log(`[server] Local:   http://localhost:${PORT}`);
  console.log(`[server] Network: http://<your-local-ip>:${PORT}`);
});

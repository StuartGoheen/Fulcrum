const db = require('../db');

function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] Connected: ${socket.id}`);

    socket.on('session:join', ({ role, characterId, sessionToken }) => {
      if (!role) {
        socket.emit('error', { message: 'role is required.' });
        return;
      }

      socket.data.role        = role;
      socket.data.characterId = characterId || null;
      socket.data.sessionToken = sessionToken || null;

      if (role === 'player' && characterId) {
        db.prepare(`
          UPDATE characters SET session_id = ? WHERE id = ?
        `).run(socket.id, characterId);

        const character = db.prepare('SELECT name FROM characters WHERE id = ?').get(characterId);
        const name = character ? character.name : 'Unknown';

        socket.data.characterName = name;
        socket.join('players');

        console.log(`[socket] Player joined: ${name} (${socket.id})`);
        io.emit('player:connected', { characterId, name });
      }

      if (role === 'gm') {
        socket.join('gm');
        console.log(`[socket] GM joined: ${socket.id}`);
      }

      const rows = db.prepare('SELECT key, value FROM campaign_state').all();
      const state = rows.reduce((acc, row) => {
        try { acc[row.key] = JSON.parse(row.value); }
        catch { acc[row.key] = row.value; }
        return acc;
      }, {});

      socket.emit('state:sync', { state });
    });

    socket.on('state:request', () => {
      const rows = db.prepare('SELECT key, value FROM campaign_state').all();
      const state = rows.reduce((acc, row) => {
        try { acc[row.key] = JSON.parse(row.value); }
        catch { acc[row.key] = row.value; }
        return acc;
      }, {});

      socket.emit('state:sync', { state });
    });

    socket.on('state:update', ({ key, value }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can push state updates.' });
        return;
      }

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      db.prepare(`
        INSERT INTO campaign_state (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, serialized);

      const rows = db.prepare('SELECT key, value FROM campaign_state').all();
      const state = rows.reduce((acc, row) => {
        try { acc[row.key] = JSON.parse(row.value); }
        catch { acc[row.key] = row.value; }
        return acc;
      }, {});

      io.emit('state:sync', { state });
      console.log(`[socket] State updated by GM: ${key}`);
    });

    socket.on('disconnect', () => {
      const { role, characterId, characterName } = socket.data;
      console.log(`[socket] Disconnected: ${socket.id} (${role || 'unknown'})`);

      if (role === 'player' && characterId) {
        db.prepare(`
          UPDATE characters SET session_id = NULL, connected_at = NULL WHERE id = ?
        `).run(characterId);

        io.emit('player:disconnected', { characterId, name: characterName || 'Unknown' });
      }
    });
  });
}

module.exports = registerHandlers;

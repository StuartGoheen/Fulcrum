const db = require('../db');

function getDestinyPool() {
  const row = db.prepare("SELECT value FROM campaign_state WHERE key = 'destiny_pool'").get();
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.every(s => s === 'hope' || s === 'toll')) {
        return parsed;
      }
    } catch (_) {}
  }
  return [];
}

function saveDestinyPool(pool) {
  const serialized = JSON.stringify(pool);
  db.prepare(`
    INSERT INTO campaign_state (key, value, updated_at)
    VALUES ('destiny_pool', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(serialized);
}

function getCharDestinyTokens(charId) {
  const row = db.prepare('SELECT character_data FROM characters WHERE id = ?').get(charId);
  let destiny = 'Light & Dark';
  if (row && row.character_data) {
    try {
      const parsed = JSON.parse(row.character_data);
      if (parsed.destiny) destiny = parsed.destiny;
    } catch (_) {}
  }
  if (destiny === 'Two Light') return ['hope', 'hope'];
  if (destiny === 'Two Dark') return ['toll', 'toll'];
  return ['hope', 'toll'];
}

function recalcPool(io) {
  const sockets = Array.from(io.sockets.sockets.values());
  const uniqueCharacters = new Set();
  sockets.forEach(s => {
    if (s.data.role === 'player' && s.data.characterId) {
      uniqueCharacters.add(s.data.characterId);
    }
  });

  const pool = [];
  for (const charId of uniqueCharacters) {
    const tokens = getCharDestinyTokens(charId);
    pool.push(...tokens);
  }

  saveDestinyPool(pool);
  return pool;
}

function rebuildPool(io) {
  const sockets = Array.from(io.sockets.sockets.values());
  const uniqueCharacters = new Set();
  sockets.forEach(s => {
    if (s.data.role === 'player' && s.data.characterId) {
      uniqueCharacters.add(s.data.characterId);
    }
  });

  const pool = [];
  for (const charId of uniqueCharacters) {
    const tokens = getCharDestinyTokens(charId);
    pool.push(...tokens);
  }

  saveDestinyPool(pool);
  return pool;
}

function broadcastDestiny(io) {
  const pool = getDestinyPool();
  io.emit('destiny:sync', { pool });
}

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

        const pool = recalcPool(io);
        io.emit('destiny:sync', { pool });
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

      const pool = getDestinyPool();
      socket.emit('destiny:sync', { pool });
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

    socket.on('destiny:flip', ({ index }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can flip destiny tokens.' });
        return;
      }

      const pool = getDestinyPool();
      if (index < 0 || index >= pool.length) return;

      pool[index] = pool[index] === 'hope' ? 'toll' : 'hope';
      saveDestinyPool(pool);
      io.emit('destiny:sync', { pool });
      console.log(`[socket] GM flipped token ${index} to ${pool[index]}`);
    });

    socket.on('destiny:reset', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can reset the destiny pool.' });
        return;
      }

      const pool = rebuildPool(io);
      io.emit('destiny:sync', { pool });
      console.log(`[socket] GM reset destiny pool (${pool.length} tokens)`);
    });

    socket.on('advancement:update', ({ characterId, advancement }) => {
      if (socket.data.role !== 'player' || !characterId) return;
      if (socket.data.characterId !== characterId) return;
      socket.broadcast.emit('advancement:sync', { characterId, advancement });
    });

    socket.on('disconnect', () => {
      const { role, characterId, characterName } = socket.data;
      console.log(`[socket] Disconnected: ${socket.id} (${role || 'unknown'})`);

      if (role === 'player' && characterId) {
        db.prepare(`
          UPDATE characters SET session_id = NULL, connected_at = NULL WHERE id = ?
        `).run(characterId);

        io.emit('player:disconnected', { characterId, name: characterName || 'Unknown' });

        setTimeout(() => {
          const pool = recalcPool(io);
          io.emit('destiny:sync', { pool });
        }, 100);
      }
    });
  });
}

module.exports = registerHandlers;

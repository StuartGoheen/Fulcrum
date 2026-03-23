const db = require('../db');
const fs = require('fs');
const path = require('path');

let _shipCombatState = null;

function getShipCombatState() {
  return _shipCombatState;
}

function startShipCombat(shipData, stationsData, weaponsData, hardwareData, chassisData) {
  _shipCombatState = {
    active: true,
    ship: JSON.parse(JSON.stringify(shipData)),
    stations: stationsData,
    weapons: weaponsData,
    hardware: hardwareData,
    chassis: chassisData,
    seats: {}
  };
  return _shipCombatState;
}

function endShipCombat() {
  _shipCombatState = null;
}

function getDestinyPool() {
  const row = db.prepare("SELECT value FROM campaign_state WHERE key = 'destiny_pool'").get();
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
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
  if (destiny === 'Two Light') return [{ side: 'hope', tapped: false }, { side: 'hope', tapped: false }];
  if (destiny === 'Two Dark') return [{ side: 'toll', tapped: false }, { side: 'toll', tapped: false }];
  return [{ side: 'hope', tapped: false }, { side: 'toll', tapped: false }];
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

        const pool = rebuildPool(io);
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
      if (!Number.isInteger(index)) return;

      const pool = getDestinyPool();
      if (index < 0 || index >= pool.length) return;

      pool[index].side = pool[index].side === 'hope' ? 'toll' : 'hope';
      saveDestinyPool(pool);
      io.emit('destiny:sync', { pool });
      console.log(`[socket] GM flipped token ${index} to ${pool[index].side}`);
    });

    socket.on('destiny:tap', ({ index }) => {
      if (!Number.isInteger(index)) return;
      const role = socket.data.role;
      if (role !== 'player' && role !== 'gm') {
        socket.emit('error', { message: 'You must be in a session to tap tokens.' });
        return;
      }
      const pool = getDestinyPool();
      if (index < 0 || index >= pool.length) return;
      if (pool[index].tapped) return;
      pool[index].tapped = true;
      saveDestinyPool(pool);
      io.emit('destiny:sync', { pool });
      console.log(`[socket] Token ${index} tapped by ${role} (${socket.data.characterName || socket.id})`);
    });

    socket.on('destiny:untap-one', ({ index }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can untap destiny tokens.' });
        return;
      }
      if (!Number.isInteger(index)) return;
      const pool = getDestinyPool();
      if (index < 0 || index >= pool.length) return;
      if (!pool[index].tapped) return;
      pool[index].tapped = false;
      saveDestinyPool(pool);
      io.emit('destiny:sync', { pool });
      console.log(`[socket] GM untapped token ${index}`);
    });

    socket.on('destiny:untap', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can untap destiny tokens.' });
        return;
      }

      const pool = getDestinyPool();
      pool.forEach(t => { t.tapped = false; });
      saveDestinyPool(pool);
      io.emit('destiny:sync', { pool });
      console.log(`[socket] GM untapped all destiny tokens`);
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

    socket.on('shipcombat:enter', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can start ship combat.' });
        return;
      }
      try {
        const dataDir = path.join(__dirname, '..', '..', 'data');
        const shipData = JSON.parse(fs.readFileSync(path.join(dataDir, 'default-ship.json'), 'utf8'));
        const stationsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'starship-stations.json'), 'utf8'));
        const weaponsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'starship-weapons.json'), 'utf8'));
        const hardwareData = JSON.parse(fs.readFileSync(path.join(dataDir, 'starship-hardware.json'), 'utf8'));
        const chassisData = JSON.parse(fs.readFileSync(path.join(dataDir, 'chassis.json'), 'utf8'));
        const state = startShipCombat(shipData, stationsData, weaponsData, hardwareData, chassisData);
        io.emit('shipcombat:sync', {
          active: true,
          ship: state.ship,
          stations: state.stations,
          weapons: state.weapons,
          hardware: state.hardware,
          chassis: state.chassis,
          seats: state.seats
        });
        console.log('[socket] GM started ship combat');
      } catch (err) {
        console.error('[socket] Failed to start ship combat:', err);
        socket.emit('error', { message: 'Failed to load ship combat data.' });
      }
    });

    socket.on('shipcombat:exit', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can end ship combat.' });
        return;
      }
      endShipCombat();
      io.emit('shipcombat:sync', { active: false });
      console.log('[socket] GM ended ship combat');
    });

    socket.on('shipcombat:claim_seat', (payload) => {
      const state = getShipCombatState();
      if (!state) {
        socket.emit('error', { message: 'No ship combat active.' });
        return;
      }
      if (!payload || typeof payload.stationId !== 'string') {
        socket.emit('error', { message: 'Invalid station.' });
        return;
      }
      if (!socket.data.characterId) {
        socket.emit('error', { message: 'No character selected.' });
        return;
      }
      const stationId = payload.stationId;
      const validStations = (state.stations || []).map(s => s.id);
      if (validStations.indexOf(stationId) === -1) {
        socket.emit('error', { message: 'Unknown station: ' + stationId });
        return;
      }
      const existing = state.seats[stationId];
      if (existing && existing.characterId !== socket.data.characterId) {
        socket.emit('error', { message: 'Station already claimed by ' + existing.characterName + '.' });
        return;
      }
      for (var sid in state.seats) {
        if (state.seats[sid] && state.seats[sid].characterId === socket.data.characterId) {
          delete state.seats[sid];
        }
      }
      state.seats[stationId] = {
        characterId: socket.data.characterId,
        characterName: socket.data.characterName || 'Unknown'
      };
      io.emit('shipcombat:seats_update', { seats: state.seats });
      console.log('[socket] ' + (socket.data.characterName || socket.data.characterId) + ' claimed ' + stationId);
    });

    socket.on('shipcombat:release_seat', () => {
      const state = getShipCombatState();
      if (!state) return;
      if (!socket.data.characterId) return;
      for (var sid in state.seats) {
        if (state.seats[sid] && state.seats[sid].characterId === socket.data.characterId) {
          delete state.seats[sid];
        }
      }
      io.emit('shipcombat:seats_update', { seats: state.seats });
      console.log('[socket] ' + (socket.data.characterName || socket.data.characterId) + ' released seat');
    });

    socket.on('shipcombat:request', () => {
      const state = getShipCombatState();
      if (state) {
        socket.emit('shipcombat:sync', {
          active: true,
          ship: state.ship,
          stations: state.stations,
          weapons: state.weapons,
          hardware: state.hardware,
          chassis: state.chassis,
          seats: state.seats
        });
      } else {
        socket.emit('shipcombat:sync', { active: false });
      }
    });

    socket.on('disconnect', () => {
      const { role, characterId, characterName } = socket.data;
      console.log(`[socket] Disconnected: ${socket.id} (${role || 'unknown'})`);

      if (role === 'player' && characterId) {
        db.prepare(`
          UPDATE characters SET session_id = NULL, connected_at = NULL WHERE id = ?
        `).run(characterId);

        io.emit('player:disconnected', { characterId, name: characterName || 'Unknown' });

        const pool = rebuildPool(io);
        io.emit('destiny:sync', { pool });

        const scState = getShipCombatState();
        if (scState) {
          let seatChanged = false;
          for (var sid in scState.seats) {
            if (scState.seats[sid] && scState.seats[sid].characterId === characterId) {
              delete scState.seats[sid];
              seatChanged = true;
            }
          }
          if (seatChanged) {
            io.emit('shipcombat:seats_update', { seats: scState.seats });
          }
        }
      }
    });
  });
}

module.exports = registerHandlers;

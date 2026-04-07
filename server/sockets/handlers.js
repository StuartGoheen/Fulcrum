const { pool } = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let _shipCombatState = null;
let _combatState = null;
let _tutorialState = null;
let _activePoll = null;

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

async function getDestinyPool() {
  const result = await pool.query("SELECT value FROM campaign_state WHERE key = 'destiny_pool'");
  if (result.rows.length > 0) {
    try {
      const parsed = JSON.parse(result.rows[0].value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return [];
}

async function saveDestinyPool(destinyPool) {
  const serialized = JSON.stringify(destinyPool);
  await pool.query(`
    INSERT INTO campaign_state (key, value, updated_at)
    VALUES ('destiny_pool', $1, NOW())
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [serialized]);
}

async function isDestinyLocked() {
  const result = await pool.query("SELECT value FROM campaign_state WHERE key = 'destiny_locked'");
  if (result.rows.length > 0) {
    try { return JSON.parse(result.rows[0].value) === true; } catch (_) {}
  }
  return false;
}

async function setDestinyLocked(locked) {
  await pool.query(`
    INSERT INTO campaign_state (key, value, updated_at)
    VALUES ('destiny_locked', $1, NOW())
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [JSON.stringify(locked)]);
}

async function getCharDestinyTokens(charId) {
  const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [charId]);
  let destiny = 'Light & Dark';
  if (result.rows.length > 0 && result.rows[0].character_data) {
    try {
      const parsed = JSON.parse(result.rows[0].character_data);
      if (parsed.destiny) destiny = parsed.destiny;
    } catch (_) {}
  }
  if (destiny === 'Two Light') return [{ side: 'hope', tapped: false }, { side: 'hope', tapped: false }];
  if (destiny === 'Two Dark') return [{ side: 'toll', tapped: false }, { side: 'toll', tapped: false }];
  return [{ side: 'hope', tapped: false }, { side: 'toll', tapped: false }];
}

async function rebuildPool(io) {
  const sockets = Array.from(io.sockets.sockets.values());
  const uniqueCharacters = new Set();
  sockets.forEach(s => {
    if (s.data.role === 'player' && s.data.characterId) {
      uniqueCharacters.add(s.data.characterId);
    }
  });

  const destinyPool = [];
  for (const charId of uniqueCharacters) {
    const tokens = await getCharDestinyTokens(charId);
    destinyPool.push(...tokens);
  }

  await saveDestinyPool(destinyPool);
  return destinyPool;
}

function _getPlayerCombatState() {
  if (!_combatState || !_combatState.active) return { active: false };
  return {
    active: true,
    encounterName: _combatState.encounterName,
    highestTier: _combatState.highestTier,
    round: _combatState.round,
    currentTurnIndex: _combatState.currentTurnIndex,
    turnOrder: _combatState.turnOrder,
    combatants: (_combatState.combatants || []).map(function (n) {
      return {
        id: n.id, name: n.name, type: 'npc', threat: n.threat, tier: n.tier,
        vitalityCurrent: n.vitalityCurrent, vitalityMax: n.vitalityMax,
        conditions: n.conditions, initiative: n.initiative,
        disposition: n.disposition || 'enemy'
      };
    }),
    pcSlots: (_combatState.pcSlots || []).map(function (p) {
      return {
        id: p.id, name: p.name, type: 'pc', initiative: p.initiative,
        conditions: p.conditions, activeEffects: p.activeEffects, surprised: p.surprised, mastery: p.mastery
      };
    })
  };
}

function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] Connected: ${socket.id}`);

    socket.on('session:join', async ({ role, characterId, sessionToken }) => {
      if (!role) {
        socket.emit('error', { message: 'role is required.' });
        return;
      }

      socket.data.role        = role;
      socket.data.characterId = characterId || null;
      socket.data.sessionToken = sessionToken || null;

      try {
        if (role === 'player' && characterId) {
          await pool.query('UPDATE characters SET session_id = $1 WHERE id = $2', [socket.id, characterId]);

          const result = await pool.query('SELECT name FROM characters WHERE id = $1', [characterId]);
          const name = result.rows.length > 0 ? result.rows[0].name : 'Unknown';

          const playerToken = crypto.randomBytes(24).toString('hex');
          socket.data.playerToken = playerToken;

          await pool.query(
            `INSERT INTO sessions (id, character_id, role, player_token) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET character_id = $2, role = $3, player_token = $4, connected_at = NOW()`,
            [socket.id, characterId, role, playerToken]
          );

          socket.data.characterName = name;
          socket.join('players');

          console.log(`[socket] Player joined: ${name} (${socket.id})`);
          io.emit('player:connected', { characterId, name });

          const locked = await isDestinyLocked();
          if (!locked) {
            const destinyPool = await rebuildPool(io);
            io.emit('destiny:sync', { pool: destinyPool, locked: false });
          }
        }

        if (role === 'gm') {
          socket.join('gm');
          console.log(`[socket] GM joined: ${socket.id}`);
        }

        socket.emit('session:joined', {
          role,
          characterId: characterId || null,
          playerToken: (role === 'player' && characterId) ? socket.data.playerToken : undefined
        });

        const stateResult = await pool.query('SELECT key, value FROM campaign_state');
        const state = stateResult.rows.reduce((acc, row) => {
          try { acc[row.key] = JSON.parse(row.value); }
          catch { acc[row.key] = row.value; }
          return acc;
        }, {});

        socket.emit('state:sync', { state });

        const destinyPool = await getDestinyPool();
        const destinyLocked = await isDestinyLocked();
        socket.emit('destiny:sync', { pool: destinyPool, locked: destinyLocked });

        if (role === 'player' && _tutorialState && _tutorialState.active) {
          const phase = _tutorialState.playerPhases[_tutorialState.currentPhase];
          socket.emit('tutorial:start', {
            title: _tutorialState.title,
            subtitle: _tutorialState.subtitle,
            assessDescription: _tutorialState.assessDescription,
            phaseLabels: _tutorialState.phaseLabels,
            phase: phase,
            phaseIndex: _tutorialState.currentPhase,
            totalPhases: _tutorialState.playerPhases.length
          });
        }
      } catch (err) {
        console.error('[socket] session:join error:', err);
      }
    });

    socket.on('state:request', async () => {
      try {
        const result = await pool.query('SELECT key, value FROM campaign_state');
        const state = result.rows.reduce((acc, row) => {
          try { acc[row.key] = JSON.parse(row.value); }
          catch { acc[row.key] = row.value; }
          return acc;
        }, {});
        socket.emit('state:sync', { state });
      } catch (err) {
        console.error('[socket] state:request error:', err);
      }
    });

    socket.on('state:update', async ({ key, value }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can push state updates.' });
        return;
      }

      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);

        await pool.query(`
          INSERT INTO campaign_state (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, serialized]);

        const result = await pool.query('SELECT key, value FROM campaign_state');
        const state = result.rows.reduce((acc, row) => {
          try { acc[row.key] = JSON.parse(row.value); }
          catch { acc[row.key] = row.value; }
          return acc;
        }, {});

        io.emit('state:sync', { state });
        console.log(`[socket] State updated by GM: ${key}`);
      } catch (err) {
        console.error('[socket] state:update error:', err);
      }
    });

    socket.on('destiny:request-pool', async () => {
      try {
        const destinyPool = await getDestinyPool();
        const destinyLocked = await isDestinyLocked();
        socket.emit('destiny:sync', { pool: destinyPool, locked: destinyLocked });
      } catch (err) {
        console.error('[socket] destiny:request-pool error:', err);
      }
    });

    socket.on('destiny:flip', async ({ index }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can flip destiny tokens.' });
        return;
      }
      if (!Number.isInteger(index)) return;

      try {
        const destinyPool = await getDestinyPool();
        if (index < 0 || index >= destinyPool.length) return;

        destinyPool[index].side = destinyPool[index].side === 'hope' ? 'toll' : 'hope';
        await saveDestinyPool(destinyPool);
        const flipLocked = await isDestinyLocked();
        io.emit('destiny:sync', { pool: destinyPool, locked: flipLocked });
        console.log(`[socket] GM flipped token ${index} to ${destinyPool[index].side}`);
      } catch (err) {
        console.error('[socket] destiny:flip error:', err);
      }
    });

    socket.on('destiny:tap', async ({ index }) => {
      if (!Number.isInteger(index)) return;
      const role = socket.data.role;
      if (role !== 'player' && role !== 'gm') {
        socket.emit('error', { message: 'You must be in a session to tap tokens.' });
        return;
      }
      try {
        const destinyPool = await getDestinyPool();
        if (index < 0 || index >= destinyPool.length) return;
        if (destinyPool[index].tapped) return;
        destinyPool[index].tapped = true;
        await saveDestinyPool(destinyPool);
        const tapLocked = await isDestinyLocked();
        io.emit('destiny:sync', { pool: destinyPool, locked: tapLocked });
        console.log(`[socket] Token ${index} tapped by ${role} (${socket.data.characterName || socket.id})`);
      } catch (err) {
        console.error('[socket] destiny:tap error:', err);
      }
    });

    socket.on('destiny:untap-one', async ({ index }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can untap destiny tokens.' });
        return;
      }
      if (!Number.isInteger(index)) return;
      try {
        const destinyPool = await getDestinyPool();
        if (index < 0 || index >= destinyPool.length) return;
        if (!destinyPool[index].tapped) return;
        destinyPool[index].tapped = false;
        await saveDestinyPool(destinyPool);
        const untapOneLocked = await isDestinyLocked();
        io.emit('destiny:sync', { pool: destinyPool, locked: untapOneLocked });
        console.log(`[socket] GM untapped token ${index}`);
      } catch (err) {
        console.error('[socket] destiny:untap-one error:', err);
      }
    });

    socket.on('destiny:untap', async () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can untap destiny tokens.' });
        return;
      }

      try {
        const destinyPool = await getDestinyPool();
        destinyPool.forEach(t => { t.tapped = false; });
        await saveDestinyPool(destinyPool);
        const untapLocked = await isDestinyLocked();
        io.emit('destiny:sync', { pool: destinyPool, locked: untapLocked });
        console.log(`[socket] GM untapped all destiny tokens`);
      } catch (err) {
        console.error('[socket] destiny:untap error:', err);
      }
    });

    socket.on('destiny:reset', async () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can reset the destiny pool.' });
        return;
      }

      try {
        await setDestinyLocked(false);
        const destinyPool = await rebuildPool(io);
        io.emit('destiny:sync', { pool: destinyPool, locked: false });
        console.log(`[socket] GM reset destiny pool (${destinyPool.length} tokens), pool unlocked`);
      } catch (err) {
        console.error('[socket] destiny:reset error:', err);
      }
    });

    socket.on('destiny:lock', async () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can lock the destiny pool.' });
        return;
      }
      try {
        await setDestinyLocked(true);
        const destinyPool = await getDestinyPool();
        io.emit('destiny:sync', { pool: destinyPool, locked: true });
        console.log(`[socket] GM locked destiny pool (${destinyPool.length} tokens)`);
      } catch (err) {
        console.error('[socket] destiny:lock error:', err);
      }
    });

    socket.on('destiny:unlock', async () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can unlock the destiny pool.' });
        return;
      }
      try {
        await setDestinyLocked(false);
        const destinyPool = await rebuildPool(io);
        io.emit('destiny:sync', { pool: destinyPool, locked: false });
        console.log(`[socket] GM unlocked destiny pool, rebuilt (${destinyPool.length} tokens)`);
      } catch (err) {
        console.error('[socket] destiny:unlock error:', err);
      }
    });

    socket.on('advancement:update', ({ characterId, advancement }) => {
      if (socket.data.role !== 'player' || !characterId) return;
      if (socket.data.characterId !== characterId) return;
      socket.broadcast.emit('advancement:sync', { characterId, advancement });
    });

    socket.on('marks:reveal', ({ adventureId, markId }) => {
      if (socket.data.role !== 'gm') return;
      if (!adventureId || !markId) return;
      io.emit('marks:revealed', { adventureId, markId });
    });

    socket.on('marks:hide', ({ adventureId, markId }) => {
      if (socket.data.role !== 'gm') return;
      if (!adventureId || !markId) return;
      io.emit('marks:hidden', { adventureId, markId });
    });

    socket.on('holonet:broadcast', ({ stories }) => {
      if (socket.data.role !== 'gm') return;
      if (!stories || !Array.isArray(stories) || stories.length === 0) return;
      io.to('players').emit('holonet:incoming', { stories, broadcastAt: new Date().toISOString() });
      socket.emit('holonet:sent', { count: stories.length });
    });

    socket.on('inventory:added', ({ charId, itemId, itemType }) => {
      if (socket.data.role !== 'gm') return;
      if (!charId || !itemId || !itemType) return;
      io.emit('inventory:added', { charId: String(charId), itemId, itemType });
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
        const modificationsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'starship-modifications.json'), 'utf8'));
        const state = startShipCombat(shipData, stationsData, weaponsData, hardwareData, chassisData);
        state.modifications = modificationsData;
        io.emit('shipcombat:sync', {
          active: true,
          ship: state.ship,
          stations: state.stations,
          weapons: state.weapons,
          hardware: state.hardware,
          modifications: state.modifications,
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

    socket.on('shipcombat:system_status', (payload) => {
      const state = getShipCombatState();
      if (!state) return;
      if (!payload || typeof payload.systemKey !== 'string' || typeof payload.status !== 'string') return;
      let incomingStatus = payload.status;
      if (incomingStatus === 'offline') incomingStatus = 'disabled';
      const validStatuses = ['operational', 'impaired', 'debilitated', 'disabled'];
      if (validStatuses.indexOf(incomingStatus) === -1) return;
      payload.status = incomingStatus;
      const isGM = socket.data.role === 'gm';
      const isSeated = socket.data.characterId && Object.values(state.seats || {}).some(s => s && s.characterId === socket.data.characterId);
      if (!isGM && !isSeated) {
        socket.emit('error', { message: 'Must be seated at a station or be the GM to update system status.' });
        return;
      }
      if (state.ship && state.ship.systems && state.ship.systems[payload.systemKey]) {
        state.ship.systems[payload.systemKey].status = payload.status;
        io.emit('shipcombat:sync', {
          active: true,
          ship: state.ship,
          stations: state.stations,
          weapons: state.weapons,
          hardware: state.hardware,
          modifications: state.modifications || [],
          chassis: state.chassis,
          seats: state.seats
        });
        console.log('[socket] System status updated: ' + payload.systemKey + ' → ' + payload.status);
      }
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
          modifications: state.modifications || [],
          chassis: state.chassis,
          seats: state.seats
        });
      } else {
        socket.emit('shipcombat:sync', { active: false });
      }
    });

    socket.on('combat:start', ({ encounterName, highestTier }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can start combat.' });
        return;
      }
      _combatState = {
        active: true,
        encounterName: encounterName || 'Combat',
        highestTier: highestTier || 0,
        responses: {},
        startedAt: Date.now(),
        combatants: [],
        pcSlots: [],
        turnOrder: [],
        round: 1,
        currentTurnIndex: 0,
        tokenPositions: {},
        joinBattleSent: true
      };
      io.to('players').emit('combat:join-battle-prompt', {
        encounterName: _combatState.encounterName,
        highestTier: _combatState.highestTier
      });
      console.log(`[socket] GM started combat: ${encounterName} (highest tier ${highestTier})`);
    });

    socket.on('combat:end-turn', () => {
      if (!_combatState || !_combatState.active) return;
      const order = _combatState.turnOrder || [];
      if (order.length === 0) return;
      const idx = (_combatState.currentTurnIndex || 0);
      const currentEntry = order[idx];
      if (socket.data.role === 'gm') {
        // GM can advance any turn
      } else {
        if (!currentEntry || currentEntry.type !== 'pc') return;
        const charId = socket.data.characterId;
        if (!charId || String(currentEntry.id) !== String(charId)) return;
      }
      _combatState.currentTurnIndex = (idx + 1) % order.length;
      if (_combatState.currentTurnIndex === 0) {
        _combatState.round = (_combatState.round || 1) + 1;
      }
      io.to('players').emit('combat:state-update', _getPlayerCombatState());
      io.to('gm').emit('combat:turn-advanced', {
        currentTurnIndex: _combatState.currentTurnIndex,
        round: _combatState.round
      });
    });

    socket.on('combat:sync-state', (data) => {
      if (socket.data.role !== 'gm') return;
      if (!_combatState || !_combatState.active) return;
      if (!data || typeof data !== 'object') return;
      if (data.combatants !== undefined && Array.isArray(data.combatants)) _combatState.combatants = data.combatants;
      if (data.pcSlots !== undefined && Array.isArray(data.pcSlots)) _combatState.pcSlots = data.pcSlots;
      if (data.turnOrder !== undefined && Array.isArray(data.turnOrder)) _combatState.turnOrder = data.turnOrder;
      if (data.round !== undefined) _combatState.round = data.round;
      if (data.currentTurnIndex !== undefined) _combatState.currentTurnIndex = data.currentTurnIndex;
      if (data.tokenPositions !== undefined) _combatState.tokenPositions = data.tokenPositions;
      if (data.encounterName !== undefined) _combatState.encounterName = data.encounterName;
      if (data.highestTier !== undefined) _combatState.highestTier = data.highestTier;
      if (data.joinBattleSent !== undefined) _combatState.joinBattleSent = data.joinBattleSent;
      if (data.tacticalMap !== undefined) _combatState.tacticalMap = data.tacticalMap;
      io.to('players').emit('combat:state-update', _getPlayerCombatState());
    });

    socket.on('combat:request-state', () => {
      if (!_combatState || !_combatState.active) {
        socket.emit('combat:state', { active: false });
        return;
      }
      if (socket.data.role === 'gm') {
        socket.emit('combat:state', _combatState);
      } else {
        const charId = socket.data.characterId;
        const alreadyJoined = charId && _combatState.responses[charId];
        socket.emit('combat:state', Object.assign({}, _getPlayerCombatState(), { alreadyJoined: !!alreadyJoined }));
      }
    });

    socket.on('combat:join-battle', async ({ controlResult, powerResult }) => {
      if (socket.data.role !== 'player' || !socket.data.characterId) return;
      if (!_combatState || !_combatState.active) return;

      const control = parseInt(controlResult, 10) || 0;
      const power = parseInt(powerResult, 10) || 0;
      const surprised = control >= 1 && control <= 3;
      const mastery = control >= 8;

      const charIdStr = String(socket.data.characterId);
      const charName = socket.data.characterName || 'Unknown';

      _combatState.responses[socket.data.characterId] = {
        characterId: socket.data.characterId,
        name: charName,
        controlResult: control,
        powerResult: power,
        surprised,
        mastery,
        initiative: power
      };

      if (!_combatState.pcSlots) _combatState.pcSlots = [];
      let existingPc = _combatState.pcSlots.find(p => String(p.id) === charIdStr);
      if (!existingPc) {
        existingPc = { id: charIdStr, name: charName, type: 'pc', conditions: [], activeEffects: [] };
        _combatState.pcSlots.push(existingPc);
      }
      existingPc.initiative = power;
      existingPc.surprised = surprised;
      existingPc.mastery = mastery;

      if (!_combatState.turnOrder) _combatState.turnOrder = [];
      const alreadyInOrder = _combatState.turnOrder.find(t => t.id === charIdStr && t.type === 'pc');
      if (!alreadyInOrder) {
        _combatState.turnOrder.push({ id: charIdStr, type: 'pc', name: charName, initiative: power });
        _combatState.turnOrder.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
      }

      io.to('gm').emit('combat:join-battle-result', {
        characterId: socket.data.characterId,
        name: charName,
        controlResult: control,
        powerResult: power,
        surprised,
        mastery,
        initiative: power
      });

      io.to('players').emit('combat:state-update', _getPlayerCombatState());

      if (surprised) {
        try {
          const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [socket.data.characterId]);
          if (result.rows.length > 0) {
            let charData = {};
            try { charData = JSON.parse(result.rows[0].character_data) || {}; } catch (_) {}
            if (!charData.activeEffects) charData.activeEffects = [];
            const entry = {
              uid: 'gm_surprise_surprised_' + Date.now(),
              effectId: 'surprised',
              target: 'fixed',
              duration: 'lingering',
              hazardValue: 0,
              source: 'gm_surprise'
            };
            charData.activeEffects.push(entry);
            socket.emit('condition:applied', entry);
            await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(charData), socket.data.characterId]);
          }
        } catch (err) {
          console.error('[socket] surprise condition auto-apply error:', err);
        }
      }

      const playerCount = Array.from(io.sockets.sockets.values())
        .filter(s => s.data.role === 'player' && s.data.characterId).length;
      const responseCount = Object.keys(_combatState.responses).length;

      if (responseCount >= playerCount) {
        io.to('gm').emit('combat:all-joined', { responses: _combatState.responses });
      }

      console.log(`[socket] ${socket.data.characterName} joined battle: control=${control} power=${power} surprised=${surprised} mastery=${mastery}`);
    });

    socket.on('combat:end', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can end combat.' });
        return;
      }
      _combatState = null;
      io.to('players').emit('combat:ended');
      console.log('[socket] GM ended combat');
    });

    socket.on('combat:request', () => {
      if (_combatState && _combatState.active) {
        const charId = socket.data.characterId;
        const alreadyJoined = charId && _combatState.responses[charId];
        if (alreadyJoined) {
          socket.emit('combat:state', Object.assign({}, _getPlayerCombatState(), { alreadyJoined: true }));
        } else {
          socket.emit('combat:join-battle-prompt', {
            encounterName: _combatState.encounterName,
            highestTier: _combatState.highestTier
          });
        }
      }
    });

    socket.on('condition:apply', async ({ characterId, conditionId, target, duration, value }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can push conditions.' });
        return;
      }
      if (!characterId || !conditionId) return;

      try {
        const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [characterId]);
        if (result.rows.length === 0) return;

        let charData = {};
        try { charData = JSON.parse(result.rows[0].character_data) || {}; } catch (_) {}

        if (!charData.activeEffects) charData.activeEffects = [];
        const entry = {
          uid: 'gm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          effectId: conditionId,
          target: target || 'universal',
          duration: duration || 'tactical',
          hazardValue: value || 0,
          source: 'gm'
        };
        charData.activeEffects.push(entry);

        await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(charData), characterId]);

        const charIdStr = String(characterId);
        const targetSockets = Array.from(io.sockets.sockets.values())
          .filter(s => String(s.data.characterId) === charIdStr);
        targetSockets.forEach(s => {
          s.emit('condition:applied', entry);
        });

        if (_combatState && _combatState.active && _combatState.pcSlots) {
          const pc = _combatState.pcSlots.find(p => String(p.id) === charIdStr);
          if (pc) {
            if (!pc.conditions) pc.conditions = [];
            if (pc.conditions.indexOf(conditionId) === -1) pc.conditions.push(conditionId);
            if (!pc.activeEffects) pc.activeEffects = [];
            pc.activeEffects.push(entry);
          }
        }

        socket.emit('condition:apply-ack', { characterId: charIdStr, entry });
        io.to('players').emit('combat:state-update', _getPlayerCombatState());
        console.log(`[socket] GM applied ${conditionId} to ${characterId}`);
      } catch (err) {
        console.error('[socket] condition:apply error:', err);
      }
    });

    socket.on('condition:remove', async ({ characterId, conditionId, uid }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can remove conditions.' });
        return;
      }
      if (!characterId) return;

      try {
        const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [characterId]);
        if (result.rows.length === 0) return;

        let charData = {};
        try { charData = JSON.parse(result.rows[0].character_data) || {}; } catch (_) {}

        if (charData.activeEffects) {
          if (uid) {
            charData.activeEffects = charData.activeEffects.filter(e => e.uid !== uid);
          } else if (conditionId) {
            const idx = charData.activeEffects.findIndex(e => e.effectId === conditionId);
            if (idx !== -1) charData.activeEffects.splice(idx, 1);
          }
          await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(charData), characterId]);
        }

        const charIdStr = String(characterId);
        const targetSockets = Array.from(io.sockets.sockets.values())
          .filter(s => String(s.data.characterId) === charIdStr);
        targetSockets.forEach(s => {
          s.emit('condition:removed', { conditionId, uid });
        });

        if (_combatState && _combatState.active && _combatState.pcSlots) {
          const pc = _combatState.pcSlots.find(p => String(p.id) === charIdStr);
          if (pc) {
            if (pc.activeEffects) {
              if (uid) {
                pc.activeEffects = pc.activeEffects.filter(e => e.uid !== uid);
              } else if (conditionId) {
                const idx = pc.activeEffects.findIndex(e => e.effectId === conditionId);
                if (idx !== -1) pc.activeEffects.splice(idx, 1);
              }
              pc.conditions = pc.activeEffects.map(e => e.effectId);
            }
          }
        }

        socket.emit('condition:remove-ack', { characterId: charIdStr, conditionId, uid });
        io.to('players').emit('combat:state-update', _getPlayerCombatState());
        console.log(`[socket] GM removed ${conditionId || uid} from ${characterId}`);
      } catch (err) {
        console.error('[socket] condition:remove error:', err);
      }
    });

    socket.on('condition:sync', async ({ effects }) => {
      if (socket.data.role !== 'player' || !socket.data.characterId) return;
      const charId = socket.data.characterId;
      const rawEffects = Array.isArray(effects) ? effects : [];

      const ALLOWED_DURATIONS = ['immediate', 'tactical', 'lingering', 'ongoing'];
      const ALLOWED_TARGETS = /^(fixed|universal|arena:(physique|reflex|grit|wits|presence|power|evasion|resist|defense))$/;
      const safeEffects = rawEffects.map(e => {
        if (!e || typeof e !== 'object') return null;
        const effectId = typeof e.effectId === 'string' ? e.effectId.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) : '';
        if (!effectId) return null;
        const uid = typeof e.uid === 'string' ? e.uid.replace(/[^a-z0-9_]/gi, '').slice(0, 60) : '';
        const target = (typeof e.target === 'string' && ALLOWED_TARGETS.test(e.target)) ? e.target : 'universal';
        const duration = (typeof e.duration === 'string' && ALLOWED_DURATIONS.includes(e.duration)) ? e.duration : 'tactical';
        const hazardValue = typeof e.hazardValue === 'number' ? Math.max(0, Math.min(e.hazardValue, 99)) : 0;
        const source = typeof e.source === 'string' ? e.source.slice(0, 20) : '';
        return { effectId, uid, target, duration, hazardValue, source };
      }).filter(Boolean);

      if (_combatState && _combatState.active && _combatState.pcSlots) {
        const charIdStr = String(charId);
        const pc = _combatState.pcSlots.find(p => String(p.id) === charIdStr);
        if (pc) {
          pc.conditions = safeEffects.map(e => e.effectId);
          pc.activeEffects = safeEffects;
        }
      }

      io.to('gm').emit('condition:player-sync', {
        characterId: charId,
        name: socket.data.characterName || 'Unknown',
        effects: safeEffects
      });

      try {
        const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [charId]);
        if (result.rows.length > 0) {
          let charData = {};
          if (result.rows[0].character_data) {
            try { charData = JSON.parse(result.rows[0].character_data) || {}; } catch (_) {}
          }
          charData.activeEffects = Array.isArray(safeEffects) ? safeEffects : [];
          await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(charData), charId]);
        }
      } catch (err) {
        console.error('[socket] condition:sync DB persist error:', err);
      }
    });

    socket.on('tutorial:start', (payload) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can start tutorials.' });
        return;
      }
      try {
        const allowedFiles = ['scene1-assess.json'];
        const requestedFile = payload.file || 'scene1-assess.json';
        if (!allowedFiles.includes(requestedFile)) {
          socket.emit('error', { message: 'Invalid tutorial file.' });
          return;
        }
        const tutorialFile = path.join(__dirname, '../../data/tutorials', requestedFile);
        const raw = fs.readFileSync(tutorialFile, 'utf8');
        const data = JSON.parse(raw);

        const playerPhases = data.phases.map(phase => ({
          id: phase.id,
          label: phase.label,
          description: phase.description,
          disciplines: phase.disciplines.map(d => ({
            name: d.label || d.name || d.id,
            questions: (d.entries || d.questions || [])
              .filter(e => e.type === 'normal' || !e.type)
              .map(e => e.question || e.text || e)
              .filter(Boolean)
          }))
        }));

        _tutorialState = {
          active: true,
          currentPhase: 0,
          title: data.title,
          subtitle: data.subtitle,
          assessDescription: data.assessDescription || '',
          phaseLabels: data.phaseLabels || {},
          playerPhases: playerPhases
        };

        io.to('players').emit('tutorial:start', {
          title: _tutorialState.title,
          subtitle: _tutorialState.subtitle,
          assessDescription: _tutorialState.assessDescription,
          phaseLabels: _tutorialState.phaseLabels,
          phase: playerPhases[0],
          phaseIndex: 0,
          totalPhases: playerPhases.length
        });

        socket.emit('tutorial:gm-ack', {
          currentPhase: 0,
          totalPhases: playerPhases.length,
          phaseLabel: playerPhases[0].label
        });

        console.log(`[socket] GM started tutorial: ${data.title}`);
      } catch (err) {
        console.error('[socket] tutorial:start error:', err);
        socket.emit('error', { message: 'Failed to load tutorial data.' });
      }
    });

    socket.on('tutorial:advance', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can advance tutorials.' });
        return;
      }
      if (!_tutorialState || !_tutorialState.active) {
        socket.emit('error', { message: 'No active tutorial.' });
        return;
      }

      const nextIdx = _tutorialState.currentPhase + 1;
      if (nextIdx >= _tutorialState.playerPhases.length) {
        socket.emit('error', { message: 'Already on the last phase.' });
        return;
      }

      _tutorialState.currentPhase = nextIdx;
      const phase = _tutorialState.playerPhases[nextIdx];

      io.to('players').emit('tutorial:phase', {
        phase: phase,
        phaseIndex: nextIdx,
        totalPhases: _tutorialState.playerPhases.length
      });

      socket.emit('tutorial:gm-ack', {
        currentPhase: nextIdx,
        totalPhases: _tutorialState.playerPhases.length,
        phaseLabel: phase.label
      });

      console.log(`[socket] GM advanced tutorial to phase ${nextIdx + 1}: ${phase.label}`);
    });

    socket.on('tutorial:end', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can end tutorials.' });
        return;
      }
      _tutorialState = null;
      io.to('players').emit('tutorial:end');
      socket.emit('tutorial:gm-ack', { ended: true });
      console.log('[socket] GM ended tutorial');
    });

    socket.on('decision:poll', (payload) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can start a decision poll.' });
        return;
      }
      const { sceneId, adventureId, decisionKey, choices } = payload || {};
      if (!choices || !Array.isArray(choices) || choices.length === 0) {
        socket.emit('error', { message: 'Choices array is required.' });
        return;
      }
      _activePoll = {
        sceneId: sceneId || null,
        adventureId: adventureId || '',
        decisionKey: decisionKey || '',
        choices: choices,
        votes: {},
        startedAt: Date.now()
      };
      io.to('players').emit('decision:poll', {
        sceneId: _activePoll.sceneId,
        decisionKey: _activePoll.decisionKey,
        choices: _activePoll.choices
      });
      socket.emit('decision:poll-ack', { active: true, choices: _activePoll.choices });
      console.log('[socket] GM started decision poll: ' + (decisionKey || 'custom'));
    });

    socket.on('decision:vote', (payload) => {
      if (socket.data.role !== 'player' || !socket.data.characterId) return;
      if (!_activePoll) {
        socket.emit('error', { message: 'No active decision poll.' });
        return;
      }
      const { choiceIndex } = payload || {};
      if (typeof choiceIndex !== 'number' || choiceIndex < 0 || choiceIndex >= _activePoll.choices.length) return;
      _activePoll.votes[socket.data.characterId] = {
        characterId: socket.data.characterId,
        name: socket.data.characterName || 'Unknown',
        choiceIndex: choiceIndex
      };
      io.to('gm').emit('decision:vote-received', {
        characterId: socket.data.characterId,
        name: socket.data.characterName || 'Unknown',
        choiceIndex: choiceIndex,
        choiceText: _activePoll.choices[choiceIndex],
        totalVotes: Object.keys(_activePoll.votes).length
      });
      console.log('[socket] ' + (socket.data.characterName || socket.data.characterId) + ' voted: ' + _activePoll.choices[choiceIndex]);
    });

    socket.on('decision:resolve', async (payload) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can resolve a decision.' });
        return;
      }
      const { choice, outcome, campaign_impact } = payload || {};
      if (!choice) {
        socket.emit('error', { message: 'Choice is required to resolve.' });
        return;
      }
      var adventureId = (_activePoll && _activePoll.adventureId) || (payload.adventure_id || '');
      var sceneId = (_activePoll && _activePoll.sceneId) || (payload.scene_id || null);
      var decisionKey = (_activePoll && _activePoll.decisionKey) || (payload.decision_key || 'custom');
      var wasVoted = _activePoll ? Object.keys(_activePoll.votes).length > 0 : false;

      try {
        const result = await pool.query(
          `INSERT INTO campaign_decisions (scene_id, adventure_id, decision_key, choice, outcome, campaign_impact, voted)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [sceneId, adventureId, decisionKey, choice, outcome || null, campaign_impact || null, wasVoted]
        );
        io.emit('decision:resolved', {
          decision: result.rows[0],
          poll: _activePoll ? { votes: _activePoll.votes, choices: _activePoll.choices } : null
        });
        _activePoll = null;
        console.log('[socket] Decision resolved: ' + choice);
      } catch (err) {
        console.error('[socket] decision:resolve error:', err);
        socket.emit('error', { message: 'Failed to save decision.' });
      }
    });

    socket.on('decision:cancel-poll', () => {
      if (socket.data.role !== 'gm') return;
      _activePoll = null;
      io.to('players').emit('decision:poll-cancelled');
      console.log('[socket] GM cancelled decision poll');
    });

    socket.on('disconnect', async () => {
      const { role, characterId, characterName } = socket.data;
      console.log(`[socket] Disconnected: ${socket.id} (${role || 'unknown'})`);

      if (role === 'player' && characterId) {
        try {
          await pool.query('UPDATE characters SET session_id = NULL, connected_at = NULL WHERE id = $1', [characterId]);
          await pool.query('DELETE FROM sessions WHERE id = $1', [socket.id]);
        } catch (err) {
          console.error('[socket] disconnect cleanup error:', err);
        }

        io.emit('player:disconnected', { characterId, name: characterName || 'Unknown' });

        try {
          const locked = await isDestinyLocked();
          if (!locked) {
            const destinyPool = await rebuildPool(io);
            io.emit('destiny:sync', { pool: destinyPool, locked: false });
          }
        } catch (err) {
          console.error('[socket] destiny rebuild error:', err);
        }

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

const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

let _shipCombatState = null;
let _combatState = null;

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
        conditions: n.conditions, initiative: n.initiative
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

          socket.data.characterName = name;
          socket.join('players');

          console.log(`[socket] Player joined: ${name} (${socket.id})`);
          io.emit('player:connected', { characterId, name });

          const destinyPool = await rebuildPool(io);
          io.emit('destiny:sync', { pool: destinyPool });
        }

        if (role === 'gm') {
          socket.join('gm');
          console.log(`[socket] GM joined: ${socket.id}`);
        }

        socket.emit('session:joined', { role, characterId: characterId || null });

        const stateResult = await pool.query('SELECT key, value FROM campaign_state');
        const state = stateResult.rows.reduce((acc, row) => {
          try { acc[row.key] = JSON.parse(row.value); }
          catch { acc[row.key] = row.value; }
          return acc;
        }, {});

        socket.emit('state:sync', { state });

        const destinyPool = await getDestinyPool();
        socket.emit('destiny:sync', { pool: destinyPool });
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
        io.emit('destiny:sync', { pool: destinyPool });
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
        io.emit('destiny:sync', { pool: destinyPool });
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
        io.emit('destiny:sync', { pool: destinyPool });
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
        io.emit('destiny:sync', { pool: destinyPool });
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
        const destinyPool = await rebuildPool(io);
        io.emit('destiny:sync', { pool: destinyPool });
        console.log(`[socket] GM reset destiny pool (${destinyPool.length} tokens)`);
      } catch (err) {
        console.error('[socket] destiny:reset error:', err);
      }
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
        const surpriseEffects = [
          { effectId: 'surprised', target: 'fixed', source: 'gm_surprise' },
          { effectId: 'disoriented', target: 'fixed', source: 'gm_surprise' },
          { effectId: 'exposed', target: 'universal', source: 'gm_surprise' }
        ];
        try {
          const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [socket.data.characterId]);
          if (result.rows.length > 0) {
            let charData = {};
            try { charData = JSON.parse(result.rows[0].character_data) || {}; } catch (_) {}
            if (!charData.activeEffects) charData.activeEffects = [];
            for (const eff of surpriseEffects) {
              const entry = {
                uid: 'gm_surprise_' + eff.effectId + '_' + Date.now(),
                effectId: eff.effectId,
                target: eff.target,
                duration: 'immediate',
                hazardValue: 0,
                source: eff.source
              };
              charData.activeEffects.push(entry);
              socket.emit('condition:applied', entry);
            }
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

    socket.on('disconnect', async () => {
      const { role, characterId, characterName } = socket.data;
      console.log(`[socket] Disconnected: ${socket.id} (${role || 'unknown'})`);

      if (role === 'player' && characterId) {
        try {
          await pool.query('UPDATE characters SET session_id = NULL, connected_at = NULL WHERE id = $1', [characterId]);
          await pool.query('DELETE FROM sessions WHERE character_id = $1', [characterId]);
        } catch (err) {
          console.error('[socket] disconnect cleanup error:', err);
        }

        io.emit('player:disconnected', { characterId, name: characterName || 'Unknown' });

        try {
          const destinyPool = await rebuildPool(io);
          io.emit('destiny:sync', { pool: destinyPool });
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

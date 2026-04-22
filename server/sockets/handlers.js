const { pool } = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let _shipCombatState = null;
let _combatState = null;
let _broadcastedMapKey = null;
let _broadcastedMapPins = [];
let _combatHeartbeatTimer = null;
let _tutorialState = null;
let _activePoll = null;
let _groupChallengeState = null;

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

// Strip GM-only fields from campaign_state before broadcasting to players.
// Mirrors client-side TournamentTracker.filterForPlayers but enforced server-side.
function _filterStateForPlayers(state, characterId) {
  if (!state || typeof state !== 'object') return state;
  const myPcSeatId = characterId ? ('pc_' + characterId) : null;
  const out = {};
  for (const k of Object.keys(state)) {
    const v = state[k];
    if (k === 'adv3_tournament' && v && typeof v === 'object') {
      // Allowlist approach: only emit fields safe for player view.
      const seating = {};
      const src = v.seating || {};
      let mySeat = null;
      for (const t of Object.keys(src)) {
        seating[t] = (src[t] || []).map((s, idx) => {
          if (!s) return s;
          const isMine = !!(myPcSeatId && s.id === myPcSeatId);
          if (isMine) {
            mySeat = { table: Number(t), seat: idx, chips: s.chips, status: s.status, name: s.name };
          }
          const out = {
            kind: s.kind,
            name: s.name,
            chips: s.chips,
            status: s.status,
            seatNum: s.seatNum
          };
          if (isMine) out.mine = true;
          return out;
        });
      }
      const myRole = (characterId && v.roster && v.roster[characterId]) || null;
      // Day 2 final-table seating (4 tables x 6 seats). Mirrors the Day 1
      // shape so the player strip can render either day with the same code.
      const day2 = {};
      if (v.day2 && typeof v.day2 === 'object') {
        const d2Seating = {};
        const d2Src = v.day2.seating || {};
        let myDay2Seat = null;
        const winnerSeatId = v.day2.winnerSeatId || null;
        for (const t of Object.keys(d2Src)) {
          d2Seating[t] = (d2Src[t] || []).map((s, idx) => {
            if (!s) return s;
            const isMine = !!(myPcSeatId && s.id === myPcSeatId);
            const isWinner = !!(winnerSeatId && s.id === winnerSeatId);
            if (isMine) {
              myDay2Seat = { table: Number(t), seat: idx, chips: s.chips, status: s.status, name: s.name };
            }
            const seatOut = {
              kind: s.kind,
              name: s.name,
              chips: s.chips,
              status: s.status,
              seatNum: s.seatNum
            };
            if (isMine) seatOut.mine = true;
            if (isWinner) seatOut.winner = true;
            return seatOut;
          });
        }
        day2.seating = d2Seating;
        day2.winnerSeatId = winnerSeatId;
        day2.mySeat = myDay2Seat;
      }
      out[k] = {
        seating,
        fieldRemaining: v.fieldRemaining,
        leader: v.leader,
        active: v.active === false ? false : true,
        myRole: myRole,
        mySeat: mySeat,
        day2: day2
      };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function _getPlayerCombatState() {
  if (!_combatState || !_combatState.active) return { active: false };
  var mapKey = null;
  if (_combatState.tacticalMap && _combatState.tacticalMap.mapKey) {
    mapKey = _combatState.tacticalMap.mapKey;
  }
  return {
    active: true,
    encounterName: _combatState.encounterName,
    highestTier: _combatState.highestTier,
    round: _combatState.round,
    currentTurnIndex: _combatState.currentTurnIndex,
    turnOrder: _combatState.turnOrder,
    tokenPositions: _combatState.tokenPositions || {},
    objectives: _combatState.objectives || {},
    mapKey: mapKey,
    broadcastedMapKey: _broadcastedMapKey || null,
    broadcastedMapPins: _broadcastedMapKey ? _broadcastedMapPins : [],
    combatants: (_combatState.combatants || []).map(function (n) {
      return {
        id: n.id, name: n.name, type: 'npc',
        initiative: n.initiative,
        disposition: n.disposition || 'enemy',
        role: n.role || '',
        species: n.species || ''
      };
    }),
    pcSlots: (_combatState.pcSlots || []).map(function (p) {
      return {
        id: p.id, name: p.name, type: 'pc', initiative: p.initiative,
        conditions: p.conditions, activeEffects: p.activeEffects, surprised: p.surprised, mastery: p.mastery
      };
    }),
    lastEscalation: _combatState.lastEscalation || null
  };
}

async function _refreshBroadcastedPins() {
  if (!_broadcastedMapKey) return;
  try {
    const pins = await pool.query(
      "SELECT id, map_key, x, y, label, pin_type, visibility, owner, player_name, color FROM map_pins WHERE map_key = $1 AND visibility = 'public'",
      [_broadcastedMapKey]
    );
    _broadcastedMapPins = pins.rows || [];
  } catch (err) {
    console.error('[socket] _refreshBroadcastedPins error:', err);
  }
}

function _startCombatHeartbeat(io) {
  _stopCombatHeartbeat();
  _combatHeartbeatTimer = setInterval(() => {
    if (!_combatState || !_combatState.active) {
      _stopCombatHeartbeat();
      return;
    }
    io.to('players').emit('combat:state-update', _getPlayerCombatState());
    io.to('gm').emit('combat:heartbeat', {
      tokenPositions: _combatState.tokenPositions || {},
      round: _combatState.round,
      currentTurnIndex: _combatState.currentTurnIndex
    });
  }, 10000);
}

function _stopCombatHeartbeat() {
  if (_combatHeartbeatTimer) {
    clearInterval(_combatHeartbeatTimer);
    _combatHeartbeatTimer = null;
  }
}

function _formatCombatLogBody(summary) {
  const t = summary.totals || {};
  const lines = [];
  lines.push('Encounter: ' + (summary.encounterName || 'Combat'));
  lines.push('Rounds: ' + (t.rounds || 0) +
    ' | Escalations: ' + (t.escalations || 0) +
    ' | Conditions: ' + (t.conditions || 0) +
    ' | KOs: ' + (t.kos || 0));
  lines.push('');
  if (summary.koList && summary.koList.length) {
    lines.push('Knocked Out:');
    summary.koList.forEach(function (n) { lines.push('  • ' + n); });
    lines.push('');
  }
  if (summary.standing && summary.standing.length) {
    lines.push('Still Standing:');
    summary.standing.forEach(function (n) { lines.push('  • ' + n); });
    lines.push('');
  }
  lines.push('———');
  const log = Array.isArray(summary.log) ? summary.log : [];
  lines.push('Full Log (' + log.length + ' events):');
  if (!log.length) {
    lines.push('  (no events recorded)');
  } else {
    log.forEach(function (e) {
      lines.push('[R' + (e.round || 1) + '] ' + (e.text || ''));
    });
  }
  return lines.join('\n');
}

const TOURNAMENT_RECAP_TITLE = 'Sabacc Tournament — Day 1 Recap';
const TOURNAMENT_DAY2_RECAP_TITLE = 'Sabacc Tournament — Day 2 Recap';
const TOURNAMENT_NAMED_NPCS = [
  { id: 'arandis', name: 'Arandis' },
  { id: 'fioro', name: 'Lady Fioro' },
  { id: 'draver', name: 'Silas Draver' },
  { id: 'creeska', name: 'Creeska' },
  { id: 'moro', name: 'Koroma Moro' }
];
const TOURNAMENT_BUY_IN = 10000;
const TOURNAMENT_BUY_BACK = 2000;

const TOURNAMENT_RECAP_NOTES_MARKER = '\n\n——— GM Notes ———\n';

function _stripGmNotes(body) {
  if (!body || typeof body !== 'string') return { auto: body || '', notes: '' };
  const idx = body.indexOf(TOURNAMENT_RECAP_NOTES_MARKER);
  if (idx === -1) return { auto: body, notes: '' };
  return {
    auto: body.slice(0, idx),
    notes: body.slice(idx + TOURNAMENT_RECAP_NOTES_MARKER.length)
  };
}

function _composeRecapBody(autoBody, gmNotes) {
  const notes = (gmNotes == null ? '' : String(gmNotes)).trim();
  if (!notes) return autoBody;
  return autoBody + TOURNAMENT_RECAP_NOTES_MARKER + notes;
}

function _formatTournamentRecapBody(state) {
  const seating = (state && state.seating) || {};
  let alive = 0, eliminated = 0;
  let pcAlive = 0, pcEliminated = 0, pcBoughtBack = 0;
  const namedStatus = {};
  TOURNAMENT_NAMED_NPCS.forEach(n => { namedStatus[n.id] = { name: n.name, status: 'Not seated' }; });

  Object.keys(seating).forEach(t => {
    (seating[t] || []).forEach(seat => {
      if (!seat || seat.kind === 'empty') return;
      if (seat.status === 'Eliminated') eliminated++; else alive++;
      if (seat.kind === 'pc') {
        if (seat.status === 'Eliminated') pcEliminated++; else pcAlive++;
        if (seat.status === 'Bought Back In') pcBoughtBack++;
      }
      if (seat.kind === 'npc' && seat.id && namedStatus[seat.id]) {
        namedStatus[seat.id].status = seat.status || 'Healthy';
        namedStatus[seat.id].name = seat.name || namedStatus[seat.id].name;
      }
    });
  });

  const competitorPcs = Object.values((state && state.roster) || {}).filter(p => p === 'competitor').length;
  const buyInTotal = competitorPcs * TOURNAMENT_BUY_IN;
  const buyBackTotal = pcBoughtBack * TOURNAMENT_BUY_BACK;
  const creditDelta = -(buyInTotal + buyBackTotal);

  const cheatCatch = (state && state.day1 && state.day1.cheatCatch) || 'none';
  const cheatLine = cheatCatch === 'marker'
    ? "Marker spotted cleanly — Creeska expelled, no fallout."
    : cheatCatch === 'accusation'
      ? "Public accusation without evidence — Mandelbrot took the heat."
      : "Cheat-catch unresolved (no marker spotted, no accusation made).";
  const rapport = (state && state.mandelbrotRapportTier) || 0;

  const lines = [];
  lines.push('Day 1 of the Cloud City Sabacc Tournament has closed.');
  lines.push('');
  lines.push('Field Status:');
  lines.push('  Surviving: ' + alive + ' / ' + (alive + eliminated));
  lines.push('  Eliminated: ' + eliminated);
  lines.push('  Crew PCs still in: ' + pcAlive + (pcEliminated ? ' (eliminated: ' + pcEliminated + ')' : ''));
  lines.push('');
  lines.push('Named NPCs:');
  TOURNAMENT_NAMED_NPCS.forEach(n => {
    lines.push('  • ' + namedStatus[n.id].name + ' — ' + namedStatus[n.id].status);
  });
  lines.push('');
  lines.push('Cheat-Catch (Creeska): ' + cheatCatch.toUpperCase());
  lines.push('  ' + cheatLine);
  lines.push('');
  lines.push('Mandelbrot Rapport: Tier ' + rapport);
  lines.push('');
  lines.push('Crew Credit Delta: ' + creditDelta.toLocaleString() + ' cr');
  lines.push('  Buy-ins: −' + buyInTotal.toLocaleString() + ' cr (' + competitorPcs + ' seat' + (competitorPcs === 1 ? '' : 's') + ')');
  if (buyBackTotal > 0) {
    lines.push('  Buy-backs: −' + buyBackTotal.toLocaleString() + ' cr (' + pcBoughtBack + ')');
  }
  lines.push('  Crew balance at close: ' + ((state && state.crewCredits) || 0).toLocaleString() + ' cr');
  return lines.join('\n');
}

function _formatTournamentDay2RecapBody(state) {
  const day2 = (state && state.day2) || {};
  const seating = day2.seating || {};
  let pcAlive = 0, pcEliminated = 0, npcAlive = 0, npcEliminated = 0;
  const standings = [];
  let winnerSeat = null;
  Object.keys(seating).forEach(t => {
    (seating[t] || []).forEach((seat, sIdx) => {
      if (!seat || seat.kind === 'empty') return;
      if (seat.kind === 'pc') {
        if (seat.status === 'Eliminated') pcEliminated++; else pcAlive++;
      } else if (seat.kind === 'npc') {
        if (seat.status === 'Eliminated') npcEliminated++; else npcAlive++;
      }
      if (seat.kind === 'pc' || seat.kind === 'npc') {
        standings.push({
          name: seat.name || '—',
          kind: seat.kind,
          chips: seat.chips || 0,
          status: seat.status || 'Healthy',
          loc: 'FT' + t + 'S' + (sIdx + 1)
        });
        if (day2.winnerSeatId && seat.id === day2.winnerSeatId) {
          winnerSeat = { name: seat.name, loc: 'FT' + t + 'S' + (sIdx + 1), kind: seat.kind };
        }
      }
    });
  });
  // Sort: champion first (handled separately), then by chips desc, eliminated last
  standings.sort((a, b) => {
    const aDead = a.status === 'Eliminated' ? 1 : 0;
    const bDead = b.status === 'Eliminated' ? 1 : 0;
    if (aDead !== bDead) return aDead - bDead;
    return (b.chips || 0) - (a.chips || 0);
  });

  const switchCommit = day2.switchCommit || 'pending';
  const crewPayout = day2.crewPayout || 0;
  const payoutPaid = !!day2.payoutPaid;
  const payoutPaidAmount = day2.payoutPaidAmount || 0;
  const crewBalance = (state && state.crewCredits) || 0;

  const lines = [];
  lines.push('Day 2 of the Cloud City Sabacc Tournament has closed.');
  lines.push('The final tables seated ' + (pcAlive + pcEliminated + npcAlive + npcEliminated) + ' players for the championship pot.');
  lines.push('');
  if (winnerSeat) {
    lines.push('Champion: ' + winnerSeat.name + ' (' + winnerSeat.loc + ')');
  } else {
    lines.push('Champion: undeclared (no winner marked)');
  }
  lines.push('');
  lines.push('Field Status:');
  lines.push('  Crew PCs still in: ' + pcAlive + (pcEliminated ? ' (eliminated: ' + pcEliminated + ')' : ''));
  lines.push('  Named NPCs still in: ' + npcAlive + (npcEliminated ? ' (eliminated: ' + npcEliminated + ')' : ''));
  lines.push('');
  lines.push('Final Standings (chip-leader order):');
  if (!standings.length) {
    lines.push('  (no named seats recorded)');
  } else {
    standings.forEach((s, i) => {
      const tag = s.kind === 'pc' ? '[PC]' : '[NPC]';
      const star = (winnerSeat && s.name === winnerSeat.name && s.loc === winnerSeat.loc) ? ' ★ CHAMPION' : '';
      lines.push('  ' + (i + 1) + '. ' + tag + ' ' + s.name + ' — ' + (s.chips || 0).toLocaleString() + ' chips — ' + s.status + ' (' + s.loc + ')' + star);
    });
  }
  lines.push('');
  lines.push('Switch (Dirty Money) Day 2 Commit: ' + switchCommit.toUpperCase());
  lines.push('');
  if (payoutPaid && payoutPaidAmount === crewPayout) {
    lines.push('Crew Payout from championship pot: +' + payoutPaidAmount.toLocaleString() + ' cr (applied to crew credits)');
  } else if (payoutPaid && payoutPaidAmount !== crewPayout) {
    const unpaid = crewPayout - payoutPaidAmount;
    lines.push('Crew Payout from championship pot: ' + crewPayout.toLocaleString() + ' cr entered');
    lines.push('  Applied to crew credits: +' + payoutPaidAmount.toLocaleString() + ' cr');
    if (unpaid > 0) {
      lines.push('  ⚠ Unpaid balance: ' + unpaid.toLocaleString() + ' cr (NOT applied)');
    } else {
      lines.push('  ⚠ Overpaid by: ' + Math.abs(unpaid).toLocaleString() + ' cr');
    }
  } else if (crewPayout > 0) {
    lines.push('Crew Payout from championship pot: ' + crewPayout.toLocaleString() + ' cr entered');
    lines.push('  ⚠ NOT applied to crew credits — GM closed Day 2 without paying out the pot.');
  } else {
    lines.push('Crew Payout from championship pot: 0 cr (none entered)');
  }
  lines.push('Crew balance at close: ' + crewBalance.toLocaleString() + ' cr');
  if (Array.isArray(day2.log) && day2.log.length) {
    lines.push('');
    lines.push('Day 2 Log:');
    // Log is stored newest-first; emit oldest-first for narrative reading.
    day2.log.slice().reverse().forEach(e => {
      const when = (e.ts || '').slice(11, 16);
      lines.push('  [' + when + '] ' + (e.text || ''));
    });
  }
  return lines.join('\n');
}

async function _saveTournamentDay2RecapToJournal(state, sceneId) {
  if (!sceneId) return null;
  const body = _formatTournamentDay2RecapBody(state || {});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id FROM journal_entries WHERE source_scene_id = $1 AND title = $2 LIMIT 1',
      [sceneId, TOURNAMENT_DAY2_RECAP_TITLE]
    );
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return { entryId: existing.rows[0].id, created: false };
    }
    let entryResult;
    try {
      entryResult = await client.query(
        `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [TOURNAMENT_DAY2_RECAP_TITLE, body, 'Campaign Log', sceneId]
      );
    } catch (insertErr) {
      // Race: another writer beat us. Fall back to existing row.
      const dup = await client.query(
        'SELECT id FROM journal_entries WHERE source_scene_id = $1 AND title = $2 LIMIT 1',
        [sceneId, TOURNAMENT_DAY2_RECAP_TITLE]
      );
      await client.query('COMMIT');
      return { entryId: dup.rows[0] ? dup.rows[0].id : null, created: false };
    }
    const entryId = entryResult.rows[0].id;
    const tagPairs = [
      { name: 'Tournament', category: 'custom' },
      { name: 'Cloud City', category: 'location' },
      { name: 'Day 2 Recap', category: 'custom' }
    ];
    for (const tp of tagPairs) {
      const tagResult = await client.query(
        `INSERT INTO journal_tags (name, category, is_custom)
         VALUES ($1, $2, $3)
         ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tp.name, tp.category, tp.category === 'custom']
      );
      await client.query(
        'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [entryId, tagResult.rows[0].id]
      );
    }
    await client.query('COMMIT');
    return { entryId, created: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function _saveTournamentRecapToJournal(state, sceneId, options) {
  if (!sceneId) return null;
  const opts = options || {};
  const regenerate = !!opts.regenerate;
  const stateNotes = state && state.day1 && typeof state.day1.recapNotes === 'string'
    ? state.day1.recapNotes
    : null;
  const autoBody = _formatTournamentRecapBody(state || {});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id, body FROM journal_entries WHERE source_scene_id = $1 AND title = $2 LIMIT 1',
      [sceneId, TOURNAMENT_RECAP_TITLE]
    );
    if (existing.rows.length > 0) {
      if (!regenerate) {
        await client.query('COMMIT');
        return { entryId: existing.rows[0].id, created: false, updated: false };
      }
      // Preserve GM notes: prefer current state notes, fall back to whatever was
      // previously appended to the existing entry body.
      const prior = _stripGmNotes(existing.rows[0].body || '');
      const notes = stateNotes != null ? stateNotes : prior.notes;
      const newBody = _composeRecapBody(autoBody, notes);
      await client.query(
        'UPDATE journal_entries SET body = $1, updated_at = NOW() WHERE id = $2',
        [newBody, existing.rows[0].id]
      );
      await client.query('COMMIT');
      return { entryId: existing.rows[0].id, created: false, updated: true };
    }
    const initialBody = _composeRecapBody(autoBody, stateNotes);
    const entryResult = await client.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_scene_id) WHERE source_scene_id IS NOT NULL AND title = 'Sabacc Tournament — Day 1 Recap' DO NOTHING
       RETURNING id`,
      [TOURNAMENT_RECAP_TITLE, initialBody, 'Campaign Log', sceneId]
    );
    if (entryResult.rows.length === 0) {
      const dup = await client.query(
        'SELECT id FROM journal_entries WHERE source_scene_id = $1 AND title = $2 LIMIT 1',
        [sceneId, TOURNAMENT_RECAP_TITLE]
      );
      await client.query('COMMIT');
      return { entryId: dup.rows[0] ? dup.rows[0].id : null, created: false, updated: false };
    }
    const entryId = entryResult.rows[0].id;
    const tagPairs = [
      { name: 'Tournament', category: 'custom' },
      { name: 'Cloud City', category: 'location' },
      { name: 'Day 1 Recap', category: 'custom' }
    ];
    for (const tp of tagPairs) {
      const tagResult = await client.query(
        `INSERT INTO journal_tags (name, category, is_custom)
         VALUES ($1, $2, $3)
         ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tp.name, tp.category, tp.category === 'custom']
      );
      await client.query(
        'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [entryId, tagResult.rows[0].id]
      );
    }
    await client.query('COMMIT');
    return { entryId, created: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function _saveCombatLogToJournal(summary, sceneId) {
  if (!summary) return null;
  const encounterName = summary.encounterName || 'Combat';
  const title = 'Combat Log: ' + encounterName;
  const body = _formatCombatLogBody(summary);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const entryResult = await client.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [title, body, 'Combat Log', sceneId || null]
    );
    const entryId = entryResult.rows[0].id;

    const tagPairs = [{ name: 'Combat', category: 'custom' }];
    if (encounterName) tagPairs.push({ name: encounterName, category: 'custom' });

    if (sceneId) {
      try {
        const adventuresDir = path.join(__dirname, '..', '..', 'data', 'adventures');
        const files = fs.readdirSync(adventuresDir).filter(f => /^adv\d+\.json$/.test(f));
        for (const f of files) {
          let adv;
          try { adv = JSON.parse(fs.readFileSync(path.join(adventuresDir, f), 'utf8')); }
          catch (e) { continue; }
          for (const part of (adv.parts || [])) {
            for (const s of (part.scenes || [])) {
              if (s.id === sceneId && s.title) {
                tagPairs.push({ name: s.title, category: 'location' });
              }
            }
          }
        }
      } catch (e) {}
    }

    for (const tp of tagPairs) {
      const tagResult = await client.query(
        `INSERT INTO journal_tags (name, category, is_custom)
         VALUES ($1, $2, $3)
         ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tp.name, tp.category, tp.category === 'custom']
      );
      await client.query(
        'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [entryId, tagResult.rows[0].id]
      );
    }

    await client.query('COMMIT');
    return entryId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

        const stateOut = role === 'gm' ? state : _filterStateForPlayers(state, characterId);
        socket.emit('state:sync', { state: stateOut });

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

        if (role === 'player') {
          const crewRoster = [];
          const sockets = io.of('/').sockets;
          sockets.forEach(function (s) {
            if (s.data.role === 'player' && s.data.characterId) {
              crewRoster.push({ characterId: String(s.data.characterId), name: s.data.characterName || 'Unknown' });
            }
          });
          socket.emit('crew:roster', crewRoster);
        }

        if (role === 'player' && _groupChallengeState && _groupChallengeState.active) {
          const gcCharId = String(characterId || '');
          const gcBeat = _groupChallengeState.currentBeat;
          const gcSubmitted = !!_groupChallengeState.beatSubmissions[gcCharId + ':' + gcBeat];
          const gcModState = _gcBuildModifierState(_groupChallengeState);
          socket.emit('groupChallenge:sync', {
            active: true,
            name: _groupChallengeState.challengeData.name,
            description: _groupChallengeState.challengeData.description,
            tier: _groupChallengeState.challengeData.tier,
            power: _groupChallengeState.challengeData.power,
            vpThreshold: _groupChallengeState.vpThreshold,
            vpScoring: _groupChallengeState.challengeData.vpScoring,
            eligibleDisciplines: _gcGetActiveDisciplines(_groupChallengeState),
            modifiers: _groupChallengeState.challengeData.modifiers || null,
            modifierState: gcModState,
            currentBeat: _groupChallengeState.currentBeat,
            totalVP: _groupChallengeState.totalVP,
            rollLog: _groupChallengeState.rollLog,
            revealedThresholds: _groupChallengeState.revealedThresholds,
            hasSubmittedThisBeat: gcSubmitted
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
        const out = socket.data.role === 'gm' ? state : _filterStateForPlayers(state, socket.data.characterId);
        socket.emit('state:sync', { state: out });
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

        io.to('gm').emit('state:sync', { state });
        const playerSockets = await io.in('players').fetchSockets();
        for (const ps of playerSockets) {
          ps.emit('state:sync', { state: _filterStateForPlayers(state, ps.data && ps.data.characterId) });
        }
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
        const destinyPool = await getDestinyPool();
        io.emit('destiny:sync', { pool: destinyPool, locked: false });
        console.log(`[socket] GM unlocked destiny pool (${destinyPool.length} tokens preserved)`);
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

    socket.on('combat:start', ({ encounterName, highestTier, sceneId }) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can start combat.' });
        return;
      }
      _combatState = {
        active: true,
        encounterName: encounterName || 'Combat',
        highestTier: highestTier || 0,
        sceneId: sceneId || null,
        responses: {},
        startedAt: Date.now(),
        combatants: [],
        pcSlots: [],
        turnOrder: [],
        round: 1,
        currentTurnIndex: 0,
        tokenPositions: {},
        joinBattleSent: true,
        combatLog: [],
        combatLogCollapsed: false
      };
      _broadcastedMapKey = null;
      _broadcastedMapPins = [];
      _startCombatHeartbeat(io);
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
      if (data.objectives !== undefined) _combatState.objectives = data.objectives;
      if (data.encounterName !== undefined) _combatState.encounterName = data.encounterName;
      if (data.highestTier !== undefined) _combatState.highestTier = data.highestTier;
      if (data.joinBattleSent !== undefined) _combatState.joinBattleSent = data.joinBattleSent;
      if (data.tacticalMap !== undefined) _combatState.tacticalMap = data.tacticalMap;
      if (data.combatLog !== undefined && Array.isArray(data.combatLog)) _combatState.combatLog = data.combatLog;
      if (data.combatLogCollapsed !== undefined) _combatState.combatLogCollapsed = !!data.combatLogCollapsed;
      if (data.lastEscalation !== undefined) {
        var le = data.lastEscalation;
        if (le === null) {
          _combatState.lastEscalation = null;
        } else if (le && typeof le === 'object' && Array.isArray(le.entries)) {
          _combatState.lastEscalation = { round: le.round, entries: le.entries };
        }
      }
      io.to('players').emit('combat:state-update', _getPlayerCombatState());
    });

    socket.on('combat:player-token-move', (data) => {
      if (!_combatState || !_combatState.active) return;
      if (!data || !data.tokenId || !data.position) return;
      const charId = String(socket.data.characterId || '');
      if (!charId || data.tokenId !== charId) return;
      const pcSlot = (_combatState.pcSlots || []).find(p => p.id === charId);
      if (!pcSlot) return;
      const pos = data.position;
      if (typeof pos !== 'object' || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
      if (!isFinite(pos.x) || !isFinite(pos.y)) return;
      const sanitized = { x: Math.round(pos.x), y: Math.round(pos.y) };
      if (sanitized.x < 0 || sanitized.y < 0) return;
      if (!_combatState.tokenPositions) _combatState.tokenPositions = {};
      _combatState.tokenPositions[data.tokenId] = sanitized;
      const playerState = _getPlayerCombatState();
      io.to('players').emit('combat:state-update', playerState);
      io.to('gm').emit('combat:player-token-moved', {
        tokenId: data.tokenId,
        position: sanitized,
        allTokenPositions: _combatState.tokenPositions
      });
    });

    socket.on('combat:request-state', () => {
      if (!_combatState || !_combatState.active) {
        socket.emit('combat:state', { active: false });
        return;
      }
      if (socket.data.role === 'gm') {
        socket.emit('combat:state', Object.assign({}, _combatState, {
          broadcastedMapKey: _broadcastedMapKey || null,
          broadcastedMapPins: _broadcastedMapKey ? _broadcastedMapPins : []
        }));
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

    socket.on('combat:end', async (payload) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can end combat.' });
        return;
      }
      const summary = payload && payload.summary ? payload.summary : null;
      const payloadSceneId = payload && payload.sceneId ? String(payload.sceneId) : null;
      const stateSceneId = (_combatState && _combatState.sceneId) ? String(_combatState.sceneId) : null;
      const sceneId = payloadSceneId || stateSceneId;
      if (summary && summary.totals) {
        const t = summary.totals;
        console.log(`[socket] GM ended combat: ${summary.encounterName} — rounds=${t.rounds} escalations=${t.escalations} conditions=${t.conditions} kos=${t.kos} logEntries=${(summary.log || []).length}`);
      } else {
        console.log('[socket] GM ended combat');
      }
      _combatState = null;
      _broadcastedMapKey = null;
      _broadcastedMapPins = [];
      _stopCombatHeartbeat();
      io.to('players').emit('combat:ended');

      if (summary) {
        try {
          const entryId = await _saveCombatLogToJournal(summary, sceneId);
          if (entryId) {
            io.emit('journal:updated', { entryId });
            console.log(`[socket] Combat log saved to journal entry #${entryId}`);
          }
        } catch (err) {
          console.error('[socket] combat:end journal save error:', err);
        }
      }
    });

    socket.on('tournament:save-day2-recap', async ({ sceneId } = {}) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can save the tournament recap.' });
        return;
      }
      if (!sceneId) return;
      try {
        const stateRow = await pool.query("SELECT value FROM campaign_state WHERE key = 'adv3_tournament'");
        let state = null;
        if (stateRow.rows.length > 0) {
          try { state = JSON.parse(stateRow.rows[0].value); } catch (_) { state = null; }
        }
        if (!state) {
          console.warn('[socket] tournament:save-day2-recap: no adv3_tournament state found');
          return;
        }
        const result = await _saveTournamentDay2RecapToJournal(state, String(sceneId));
        if (result && result.created) {
          io.emit('journal:updated', { entryId: result.entryId });
          console.log(`[socket] Tournament Day 2 recap saved to journal entry #${result.entryId}`);
        } else if (result) {
          console.log(`[socket] Tournament Day 2 recap already exists (entry #${result.entryId}); skipping duplicate.`);
        }
      } catch (err) {
        console.error('[socket] tournament:save-day2-recap error:', err);
      }
    });

    socket.on('tournament:save-day1-recap', async ({ sceneId } = {}) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can save the tournament recap.' });
        return;
      }
      if (!sceneId) return;
      try {
        const stateRow = await pool.query("SELECT value FROM campaign_state WHERE key = 'adv3_tournament'");
        let state = null;
        if (stateRow.rows.length > 0) {
          try { state = JSON.parse(stateRow.rows[0].value); } catch (_) { state = null; }
        }
        if (!state) {
          console.warn('[socket] tournament:save-day1-recap: no adv3_tournament state found');
          return;
        }
        const result = await _saveTournamentRecapToJournal(state, String(sceneId));
        if (result && result.created) {
          io.emit('journal:updated', { entryId: result.entryId });
          console.log(`[socket] Tournament Day 1 recap saved to journal entry #${result.entryId}`);
        } else if (result) {
          console.log(`[socket] Tournament Day 1 recap already exists (entry #${result.entryId}); skipping duplicate.`);
        }
      } catch (err) {
        console.error('[socket] tournament:save-day1-recap error:', err);
      }
    });

    socket.on('tournament:regenerate-day1-recap', async ({ sceneId, gmNotes } = {}) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can regenerate the tournament recap.' });
        return;
      }
      if (!sceneId) return;
      try {
        const stateRow = await pool.query("SELECT value FROM campaign_state WHERE key = 'adv3_tournament'");
        let state = null;
        if (stateRow.rows.length > 0) {
          try { state = JSON.parse(stateRow.rows[0].value); } catch (_) { state = null; }
        }
        if (!state) {
          console.warn('[socket] tournament:regenerate-day1-recap: no adv3_tournament state found');
          socket.emit('error', { message: 'Tournament state not found; cannot regenerate recap.' });
          return;
        }
        // If the GM's freshest notes were sent in the event, trust them over the
        // possibly-stale DB state (persists notes back to campaign_state too).
        if (typeof gmNotes === 'string') {
          state.day1 = state.day1 || {};
          if (state.day1.recapNotes !== gmNotes) {
            state.day1.recapNotes = gmNotes;
            try {
              await pool.query(
                "UPDATE campaign_state SET value = $1, updated_at = NOW() WHERE key = 'adv3_tournament'",
                [JSON.stringify(state)]
              );
            } catch (e) {
              console.warn('[socket] tournament:regenerate-day1-recap: failed to persist notes:', e && e.message);
            }
          }
        }
        const result = await _saveTournamentRecapToJournal(state, String(sceneId), { regenerate: true });
        if (result && result.entryId) {
          io.emit('journal:updated', { entryId: result.entryId });
          if (result.updated) {
            console.log(`[socket] Tournament Day 1 recap regenerated (entry #${result.entryId}).`);
          } else if (result.created) {
            console.log(`[socket] Tournament Day 1 recap created on regenerate (entry #${result.entryId}).`);
          }
          socket.emit('tournament:recap-regenerated', { entryId: result.entryId, updated: !!result.updated, created: !!result.created });
        }
      } catch (err) {
        console.error('[socket] tournament:regenerate-day1-recap error:', err);
        socket.emit('error', { message: 'Failed to regenerate tournament recap.' });
      }
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
      const { choice, outcome, campaign_impact, decision_point_id, option_key, impact_value, gm_notes, auto_notes, impacts } = payload || {};
      if (!choice) {
        socket.emit('error', { message: 'Choice is required to resolve.' });
        return;
      }
      var adventureId = (_activePoll && _activePoll.adventureId) || (payload.adventure_id || '');
      var sceneId = (_activePoll && _activePoll.sceneId) || (payload.scene_id || null);
      var decisionKey = (_activePoll && _activePoll.decisionKey) || (payload.decision_key || 'custom');
      var wasVoted = _activePoll ? Object.keys(_activePoll.votes).length > 0 : false;

      var voteData = null;
      if (_activePoll && wasVoted) {
        var voteTally = {};
        for (var vid in _activePoll.votes) {
          var v = _activePoll.votes[vid];
          var choiceText = _activePoll.choices[v.choiceIndex] || 'Unknown';
          voteTally[choiceText] = (voteTally[choiceText] || 0) + 1;
        }
        voteData = {
          choices: _activePoll.choices,
          votes: Object.values(_activePoll.votes).map(function (v) {
            return { characterId: v.characterId, name: v.name, choiceText: _activePoll.choices[v.choiceIndex] || 'Unknown' };
          }),
          tally: voteTally,
          totalVotes: Object.keys(_activePoll.votes).length
        };
      }

      try {
        const impactsArr = Array.isArray(impacts) ? impacts.filter(i => i && i.key && i.value != null) : [];
        const legacyKey = campaign_impact || null;
        const legacyVal = impact_value || null;
        const result = await pool.query(
          `INSERT INTO campaign_decisions
           (scene_id, adventure_id, decision_key, choice, outcome, campaign_impact, voted,
            decision_point_id, option_key, impact_value, gm_notes, auto_notes, vote_data, impacts)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
          [sceneId, adventureId, decisionKey, choice, outcome || null, legacyKey, wasVoted,
           decision_point_id || null, option_key || null, legacyVal,
           gm_notes || null, auto_notes || null,
           voteData ? JSON.stringify(voteData) : null,
           impactsArr.length ? JSON.stringify(impactsArr) : null]
        );
        try {
          if (sceneId) {
            const { regenerateSceneJournalEntry } = require('../routes/journal');
            await regenerateSceneJournalEntry(sceneId);
          }
        } catch (e) { console.error('[decision:resolve] regen journal failed:', e.message); }
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

    function _gcCountCrewSize() {
      const sockets = Array.from(io.sockets.sockets.values());
      const charIds = new Set();
      sockets.forEach(function (s) {
        if (s.data.role === 'player' && s.data.characterId) charIds.add(String(s.data.characterId));
      });
      return Math.max(charIds.size, 1);
    }

    function _gcCalcVpThreshold(challengeData, crewSize) {
      if (typeof challengeData.vpThreshold === 'number') return challengeData.vpThreshold;
      const vpBase = Number(challengeData.vpBase) || 3;
      const mods = challengeData.modifiers || {};
      let vpAdjust = 0;
      if (mods.escalating && typeof mods.escalating.vpAdjust === 'number') vpAdjust += mods.escalating.vpAdjust;
      if (mods.failurePenalty && typeof mods.failurePenalty.vpAdjust === 'number') vpAdjust += mods.failurePenalty.vpAdjust;
      return Math.max(1, (vpBase + vpAdjust) * crewSize);
    }

    function _gcResolveThresholds(challengeData, vpThreshold) {
      const raw = challengeData.thresholds || [];
      return raw.map(function (t) {
        if (typeof t.at === 'number') {
          return { vp: Math.max(1, Math.round(t.at * vpThreshold)), intel: t.intel, checkpoint: !!t.checkpoint };
        }
        return { vp: t.vp || 0, intel: t.intel, checkpoint: !!t.checkpoint };
      });
    }

    function _gcEffectivePower(state) {
      let power = Number(state.challengeData.power) || 0;
      const mods = state.challengeData.modifiers || {};
      if (mods.escalating && mods.escalating.field === 'power') {
        power += (mods.escalating.increment || 1) * (state.currentBeat - 1);
      }
      if (mods.adaptation && typeof state.adaptationBoost === 'number') {
        power += state.adaptationBoost;
      }
      return power;
    }

    function _gcEffectiveTier(state) {
      let tier = Number(state.challengeData.tier) || 1;
      const mods = state.challengeData.modifiers || {};
      if (mods.escalating && mods.escalating.field === 'tier') {
        tier += (mods.escalating.increment || 1) * (state.currentBeat - 1);
      }
      return tier;
    }

    function _gcGetReachableTiers(power, scoring) {
      const maxResult = 12 - power;
      const tiers = ['failure'];
      if (maxResult >= 0) { tiers.push('fleeting', 'fleetingCost'); }
      if (maxResult >= 4) { tiers.push('masterful', 'masterfulCost'); }
      if (maxResult >= 8) { tiers.push('legendary', 'legendaryCost'); }
      if (typeof scoring.unleashedI === 'number') tiers.push('unleashedI');
      if (typeof scoring.unleashedII === 'number') tiers.push('unleashedII');
      if (typeof scoring.unleashedIII === 'number') tiers.push('unleashedIII');
      return tiers;
    }

    function _gcCheckpointFloor(state) {
      let floor = 0;
      (state.resolvedThresholds || []).forEach(function (t) {
        if (t.checkpoint && state.totalVP >= t.vp) {
          floor = Math.max(floor, t.vp);
        }
      });
      return floor;
    }

    function _gcCheckDisciplineLimit(state, charId, discipline) {
      const mods = state.challengeData.modifiers || {};
      const dl = mods.disciplineLimit;
      if (!dl) return null;

      if (dl.type === 'exclusive') {
        const eligible = (state.challengeData.eligibleDisciplines || []).map(function (d) { return d.discipline; });
        if (eligible.indexOf(discipline) === -1) {
          return 'Only the listed eligible disciplines may be used in this challenge.';
        }
      }

      if (dl.type === 'once_per_challenge') {
        const used = (state.disciplineUsage || []).find(function (u) { return u.discipline === discipline; });
        if (used) return discipline + ' has already been used in this challenge (once per challenge).';
      }

      if (dl.type === 'cooldown') {
        const cooldownBeats = dl.beats || 2;
        const lastUse = (state.disciplineUsage || []).filter(function (u) {
          return u.charId === charId && u.discipline === discipline;
        }).sort(function (a, b) { return b.beat - a.beat; })[0];
        if (lastUse && (state.currentBeat - lastUse.beat) <= cooldownBeats) {
          return discipline + ' is on cooldown for ' + (cooldownBeats - (state.currentBeat - lastUse.beat) + 1) + ' more beat(s).';
        }
      }

      if (dl.type === 'diverse') {
        const lastRoll = (state.disciplineUsage || []).filter(function (u) {
          return u.charId === charId;
        }).sort(function (a, b) { return b.beat - a.beat; })[0];
        if (lastRoll && lastRoll.discipline === discipline && lastRoll.beat === state.currentBeat - 1) {
          return 'You must use a different discipline than last beat (diverse).';
        }
      }

      return null;
    }

    function _gcGetCurrentPhase(state) {
      const benchmarks = state.challengeData.benchmarks || [];
      if (!benchmarks.length || !state.vpThreshold) return null;
      let active = null;
      for (let i = 0; i < benchmarks.length; i++) {
        const bm = benchmarks[i];
        const vpNeeded = Math.ceil(state.vpThreshold * (bm.vpPercent / 100));
        if (state.totalVP >= vpNeeded) {
          active = { index: i, name: bm.name, narrativeText: bm.narrativeText, vpPercent: bm.vpPercent, vpNeeded: vpNeeded };
        }
      }
      return active;
    }

    function _gcGetActiveDisciplines(state) {
      const phase = _gcGetCurrentPhase(state);
      if (!phase) return state.challengeData.eligibleDisciplines || [];
      const bm = state.challengeData.benchmarks[phase.index];
      return bm.eligibleDisciplines || state.challengeData.eligibleDisciplines || [];
    }

    function _gcBuildModifierState(state) {
      const mods = state.challengeData.modifiers || {};
      return {
        effectivePower: _gcEffectivePower(state),
        effectiveTier: _gcEffectiveTier(state),
        timed: mods.timed || null,
        failurePenalty: mods.failurePenalty || null,
        disciplineLimit: mods.disciplineLimit || null,
        escalating: mods.escalating || null,
        pressure: !!mods.pressure,
        momentum: !!mods.momentum,
        fatigue: !!mods.fatigue,
        adaptation: mods.adaptation || null,
        allHands: !!mods.allHands,
        solo: !!mods.solo,
        usedDisciplines: (state.disciplineUsage || []).map(function (u) { return { discipline: u.discipline, charId: u.charId, beat: u.beat }; }),
        charModifiers: state.charModifiers || {},
        adaptationBoost: state.adaptationBoost || 0,
        pendingBuffs: state.pendingBuffs || {},
        currentPhase: _gcGetCurrentPhase(state)
      };
    }

    socket.on('groupChallenge:announce', (payload) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can announce group challenges.' });
        return;
      }
      const { challengeData, adventureId, sceneId } = payload || {};
      if (!challengeData || !challengeData.name) {
        socket.emit('error', { message: 'Invalid challenge data.' });
        return;
      }
      const crewSize = _gcCountCrewSize();
      const vpThreshold = _gcCalcVpThreshold(challengeData, crewSize);
      const resolvedThresholds = _gcResolveThresholds(challengeData, vpThreshold);
      _groupChallengeState = {
        active: true,
        challengeData: challengeData,
        adventureId: adventureId || '',
        sceneId: sceneId || '',
        currentBeat: 1,
        totalVP: 0,
        rollLog: [],
        revealedThresholds: [],
        resolvedThresholds: resolvedThresholds,
        vpThreshold: vpThreshold,
        crewSize: crewSize,
        beatSubmissions: {},
        disciplineUsage: [],
        charModifiers: {},
        adaptationBoost: 0,
        contributedCharIds: [],
        pendingBuffs: {}
      };
      const modState = _gcBuildModifierState(_groupChallengeState);
      io.to('players').emit('groupChallenge:announce', {
        name: challengeData.name,
        description: challengeData.description,
        tier: challengeData.tier,
        power: challengeData.power,
        vpThreshold: vpThreshold,
        vpScoring: challengeData.vpScoring,
        eligibleDisciplines: _gcGetActiveDisciplines(_groupChallengeState),
        modifiers: challengeData.modifiers || null,
        modifierState: modState,
        currentBeat: 1,
        totalVP: 0,
        rollLog: [],
        revealedThresholds: []
      });
      socket.emit('groupChallenge:gm-ack', {
        active: true, currentBeat: 1, totalVP: 0,
        vpThreshold: vpThreshold,
        crewSize: crewSize,
        modifiers: challengeData.modifiers || null,
        modifierState: modState,
        resolvedThresholds: resolvedThresholds
      });
      console.log('[socket] GM announced group challenge: ' + challengeData.name + ' (crew:' + crewSize + ' vpT:' + vpThreshold + ')');
    });

    socket.on('groupChallenge:submit', (payload) => {
      if (socket.data.role !== 'player' || !socket.data.characterId) return;
      if (!_groupChallengeState || !_groupChallengeState.active) {
        socket.emit('groupChallenge:submitError', { message: 'No active group challenge.' });
        return;
      }
      const gcs = _groupChallengeState;
      const charId = String(socket.data.characterId);
      const beat = gcs.currentBeat;
      const mods = gcs.challengeData.modifiers || {};

      if (mods.solo) {
        const beatSubs = Object.keys(gcs.beatSubmissions).filter(function (k) { return k.endsWith(':' + beat); });
        if (beatSubs.length > 0 && !gcs.beatSubmissions[charId + ':' + beat]) {
          socket.emit('groupChallenge:submitError', { message: 'Only one character can contribute per beat (solo).' });
          return;
        }
      }

      if (gcs.beatSubmissions[charId + ':' + beat]) {
        socket.emit('groupChallenge:submitError', { message: 'Already submitted for this beat.' });
        return;
      }
      const { discipline, tier, mastery, targetCharId } = payload || {};
      if (!discipline || !tier) {
        socket.emit('groupChallenge:submitError', { message: 'Discipline and tier are required.' });
        return;
      }
      const ALL_DISCIPLINES = [
        'athletics', 'brawl', 'endure', 'melee', 'heavy_weapons',
        'evasion', 'piloting', 'ranged', 'skulduggery', 'stealth',
        'beast_handling', 'intimidate', 'resolve', 'survival', 'control_spark',
        'investigation', 'medicine', 'tactics', 'tech', 'sense_spark',
        'charm', 'deception', 'insight', 'persuasion', 'alter_spark'
      ];
      if (ALL_DISCIPLINES.indexOf(discipline) === -1) {
        socket.emit('groupChallenge:submitError', { message: 'Unknown discipline.' });
        return;
      }

      const dlError = _gcCheckDisciplineLimit(gcs, charId, discipline);
      if (dlError) {
        socket.emit('groupChallenge:submitError', { message: dlError });
        return;
      }

      const activeDisciplines = _gcGetActiveDisciplines(gcs);
      const eligibleEntry = activeDisciplines.find(function (d) { return d.discipline === discipline; });
      if (!eligibleEntry) {
        socket.emit('groupChallenge:submitError', { message: 'That discipline is not available in the current phase.' });
        return;
      }
      const isSecondary = eligibleEntry.role === 'secondary';

      const supportDef = isSecondary && eligibleEntry && eligibleEntry.support ? eligibleEntry.support : null;
      const VALID_SUPPORT_TYPES = ['optimized', 'empowered'];
      if (isSecondary) {
        if (!supportDef || !supportDef.type || !supportDef.targetDiscipline || VALID_SUPPORT_TYPES.indexOf(supportDef.type) === -1) {
          socket.emit('groupChallenge:submitError', { message: 'This secondary discipline has no valid support definition in the challenge data.' });
          return;
        }
        if (!targetCharId || String(targetCharId) === charId) {
          socket.emit('groupChallenge:submitError', { message: 'Secondary approach requires a valid ally target (not yourself).' });
          return;
        }
        const targetIdStr = String(targetCharId);
        const validTarget = Array.from(io.of('/').sockets.values()).some(function (s) {
          return s.data.role === 'player' && String(s.data.characterId) === targetIdStr;
        });
        if (!validTarget) {
          socket.emit('groupChallenge:submitError', { message: 'Target ally is not connected.' });
          return;
        }
        if (!gcs.pendingBuffs) gcs.pendingBuffs = {};
        if (gcs.pendingBuffs[targetIdStr]) {
          socket.emit('groupChallenge:submitError', { message: 'That ally already has a pending buff. Wait until they use it.' });
          return;
        }
      }

      const scoring = gcs.challengeData.vpScoring || {};
      let effectivePower = _gcEffectivePower(gcs);
      const charMods = (gcs.charModifiers || {})[charId] || {};
      if (charMods.controlStepDown) effectivePower += charMods.controlStepDown;
      if (charMods.powerStepUp) effectivePower = Math.max(0, effectivePower - charMods.powerStepUp);
      if (!isSecondary && gcs.pendingBuffs && gcs.pendingBuffs[charId] && gcs.pendingBuffs[charId].targetDiscipline === discipline && gcs.pendingBuffs[charId].type === 'empowered') {
        effectivePower = Math.max(0, effectivePower - 1);
      }
      const reachableTiers = _gcGetReachableTiers(effectivePower, scoring);
      if (reachableTiers.indexOf(tier) === -1 || typeof scoring[tier] !== 'number') {
        socket.emit('groupChallenge:submitError', { message: 'Invalid or unreachable result tier for this challenge.' });
        return;
      }

      const isFailure = tier === 'failure';
      const isCost = tier.indexOf('Cost') !== -1;
      const isCleanSuccess = !isFailure && !isCost;

      let vpEarned = 0;
      let consumedBuff = null;

      if (isSecondary) {
        vpEarned = 0;
        if (!isFailure) {
          gcs.pendingBuffs[String(targetCharId)] = {
            type: supportDef.type,
            targetDiscipline: supportDef.targetDiscipline,
            fromCharId: charId,
            fromCharName: socket.data.characterName || 'Unknown',
            beat: beat
          };
        }
      } else {
        vpEarned = scoring[tier];
        const isMastery = !!mastery;
        if (isMastery && scoring.masteryBonus) {
          vpEarned += scoring.masteryBonus;
        }

        if (gcs.pendingBuffs && gcs.pendingBuffs[charId] && gcs.pendingBuffs[charId].targetDiscipline === discipline) {
          consumedBuff = gcs.pendingBuffs[charId];
          delete gcs.pendingBuffs[charId];
        }

        if (isFailure && mods.failurePenalty) {
          const penalty = mods.failurePenalty.value || 1;
          const floor = _gcCheckpointFloor(gcs);
          gcs.totalVP = Math.max(floor, gcs.totalVP - penalty);
          vpEarned = -penalty;
        } else {
          gcs.totalVP += vpEarned;
        }
      }

      gcs.beatSubmissions[charId + ':' + beat] = true;
      gcs.disciplineUsage.push({ charId: charId, discipline: discipline, beat: beat });

      if (gcs.contributedCharIds.indexOf(charId) === -1) {
        gcs.contributedCharIds.push(charId);
      }

      if (mods.adaptation && !isFailure && !isSecondary) {
        gcs.adaptationBoost = (gcs.adaptationBoost || 0) + (mods.adaptation.increment || 1);
      }

      if (!gcs.charModifiers) gcs.charModifiers = {};
      if (!gcs.charModifiers[charId]) gcs.charModifiers[charId] = {};

      if (mods.pressure && isFailure) {
        gcs.charModifiers[charId].controlStepDown = (gcs.charModifiers[charId].controlStepDown || 0) + 1;
      }
      if (mods.fatigue && isCost) {
        gcs.charModifiers[charId].controlStepDown = (gcs.charModifiers[charId].controlStepDown || 0) + 1;
      }
      if (mods.momentum && isCleanSuccess) {
        gcs.charModifiers[charId].powerStepUp = (gcs.charModifiers[charId].powerStepUp || 0) + 1;
      }

      if (isCleanSuccess && mods.pressure && gcs.charModifiers[charId].controlStepDown) {
        gcs.charModifiers[charId].controlStepDown = Math.max(0, gcs.charModifiers[charId].controlStepDown - 1);
        if (!gcs.charModifiers[charId].controlStepDown) delete gcs.charModifiers[charId].controlStepDown;
      }
      if (isFailure && mods.momentum && gcs.charModifiers[charId].powerStepUp) {
        delete gcs.charModifiers[charId].powerStepUp;
      }

      const entry = {
        characterId: charId,
        characterName: socket.data.characterName || 'Unknown',
        discipline: discipline,
        tier: tier,
        vp: vpEarned,
        mastery: !isSecondary && !!mastery,
        beat: beat,
        role: isSecondary ? 'secondary' : 'primary',
        buffType: isSecondary && !isFailure && supportDef ? supportDef.type : null,
        buffTargetDiscipline: isSecondary && !isFailure && supportDef ? supportDef.targetDiscipline : null,
        buffTargetCharId: isSecondary && !isFailure ? String(targetCharId) : null,
        consumedBuff: consumedBuff ? consumedBuff.type : null,
        consumedBuffFrom: consumedBuff ? consumedBuff.fromCharName : null,
        consumedBuffDiscipline: consumedBuff ? consumedBuff.targetDiscipline : null
      };
      gcs.rollLog.push(entry);

      const newReveals = [];
      (gcs.resolvedThresholds || []).forEach(function (t) {
        if (gcs.totalVP >= t.vp) {
          const alreadyRevealed = gcs.revealedThresholds.find(function (r) { return r.vp === t.vp; });
          if (!alreadyRevealed) {
            gcs.revealedThresholds.push(t);
            newReveals.push(t);
          }
        }
      });

      const prevPhase = gcs._lastPhaseIndex != null ? gcs._lastPhaseIndex : -1;
      const newPhase = _gcGetCurrentPhase(gcs);
      const newPhaseIndex = newPhase ? newPhase.index : -1;
      let phaseChanged = null;
      if (newPhaseIndex !== prevPhase) {
        gcs._lastPhaseIndex = newPhaseIndex;
        if (newPhase) {
          phaseChanged = { name: newPhase.name, narrativeText: newPhase.narrativeText };
          const oldBuffKeys = Object.keys(gcs.pendingBuffs || {});
          if (oldBuffKeys.length > 0) {
            const newActive = _gcGetActiveDisciplines(gcs);
            const newDiscIds = newActive.map(function (d) { return d.discipline; });
            oldBuffKeys.forEach(function (k) {
              const buff = gcs.pendingBuffs[k];
              if (buff && newDiscIds.indexOf(buff.targetDiscipline) === -1) {
                delete gcs.pendingBuffs[k];
              }
            });
          }
        }
      }

      const modState = _gcBuildModifierState(gcs);
      io.emit('groupChallenge:update', {
        totalVP: gcs.totalVP,
        vpThreshold: gcs.vpThreshold,
        currentBeat: gcs.currentBeat,
        entry: entry,
        newReveals: newReveals,
        revealedThresholds: gcs.revealedThresholds,
        modifierState: modState,
        eligibleDisciplines: _gcGetActiveDisciplines(gcs),
        phaseChanged: phaseChanged
      });
      var roleLabel = isSecondary ? 'SECONDARY' : 'PRIMARY';
      var buffLabel = isSecondary && !isFailure && supportDef ? ' [' + supportDef.type + ' on ' + supportDef.targetDiscipline + ' \u2192 ' + String(targetCharId) + ']' : '';
      var consumedLabel = consumedBuff ? ' [consumed ' + consumedBuff.type + '(' + consumedBuff.targetDiscipline + ') from ' + consumedBuff.fromCharName + ']' : '';
      console.log('[socket] ' + (socket.data.characterName || charId) + ' group challenge (' + roleLabel + '): ' + discipline + ' ' + tier + ' (' + vpEarned + ' VP)' + buffLabel + consumedLabel);
    });

    socket.on('groupChallenge:advanceBeat', () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can advance beats.' });
        return;
      }
      if (!_groupChallengeState || !_groupChallengeState.active) {
        socket.emit('error', { message: 'No active group challenge.' });
        return;
      }
      const gcs = _groupChallengeState;
      const mods = gcs.challengeData.modifiers || {};

      if (mods.timed && gcs.currentBeat >= mods.timed.beats) {
        if (gcs.totalVP < gcs.vpThreshold) {
          io.emit('groupChallenge:timedOut', { beat: gcs.currentBeat, maxBeats: mods.timed.beats });
          gcs.active = false;
          const completionData = {
            name: gcs.challengeData.name,
            success: false,
            totalVP: gcs.totalVP,
            vpThreshold: gcs.vpThreshold,
            totalBeats: gcs.currentBeat,
            rollLog: gcs.rollLog,
            revealedThresholds: gcs.revealedThresholds,
            failureConsequence: gcs.challengeData.failureConsequence || 'Time expired.'
          };
          io.emit('groupChallenge:completed', completionData);
          _groupChallengeState = null;
          console.log('[socket] Group challenge TIMED OUT: ' + completionData.name);
          return;
        }
      }

      gcs.currentBeat++;

      const modState = _gcBuildModifierState(gcs);
      io.emit('groupChallenge:beatAdvanced', {
        currentBeat: gcs.currentBeat,
        totalVP: gcs.totalVP,
        vpThreshold: gcs.vpThreshold,
        modifierState: modState
      });
      console.log('[socket] GM advanced group challenge to beat ' + gcs.currentBeat);
    });

    socket.on('groupChallenge:complete', async () => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can complete group challenges.' });
        return;
      }
      if (!_groupChallengeState || !_groupChallengeState.active) {
        socket.emit('error', { message: 'No active group challenge.' });
        return;
      }
      const gcState = _groupChallengeState;
      const mods = gcState.challengeData.modifiers || {};

      let success = gcState.totalVP >= gcState.vpThreshold;
      if (success && mods.allHands) {
        if (gcState.contributedCharIds.length < gcState.crewSize) {
          success = false;
        }
      }

      try {
        const rollSummary = gcState.rollLog.map(function (r) {
          return 'Beat ' + r.beat + ': ' + r.characterName + ' \u2014 ' + r.discipline + ' (' + r.tier + ') \u2192 ' + r.vp + ' VP' + (r.mastery ? ' +mastery' : '');
        }).join('\n');
        const body = 'Group Challenge: ' + gcState.challengeData.name + '\n' +
          (gcState.challengeData.description ? gcState.challengeData.description + '\n\n' : '') +
          'Tier ' + (gcState.challengeData.tier || '?') + ' / Power ' + (gcState.challengeData.power || '?') + '\n' +
          'Result: ' + (success ? 'SUCCESS' : 'FAILURE') + ' (' + gcState.totalVP + '/' + gcState.vpThreshold + ' VP)\n' +
          'Beats: ' + gcState.currentBeat + '\n\n' +
          'Roll Log:\n' + rollSummary + '\n\n' +
          'Intel Revealed:\n' + gcState.revealedThresholds.map(function (t) {
            return '\u2022 [' + t.vp + ' VP] ' + t.intel;
          }).join('\n') +
          (!success && gcState.challengeData.failureConsequence ? '\n\nFailure: ' + gcState.challengeData.failureConsequence : '');
        await pool.query(
          'INSERT INTO journal_entries (title, body, author_character_name, source_scene_id) VALUES ($1, $2, $3, $4)',
          [
            'Group Challenge: ' + gcState.challengeData.name + ' \u2014 ' + (success ? 'Success' : 'Failure'),
            body,
            'System',
            gcState.sceneId || null
          ]
        );
      } catch (err) {
        console.error('[socket] groupChallenge journal entry error:', err);
      }
      const completionData = {
        name: gcState.challengeData.name,
        success: success,
        totalVP: gcState.totalVP,
        vpThreshold: gcState.vpThreshold,
        totalBeats: gcState.currentBeat,
        rollLog: gcState.rollLog,
        revealedThresholds: gcState.revealedThresholds,
        failureConsequence: !success ? gcState.challengeData.failureConsequence : null
      };
      io.emit('groupChallenge:completed', completionData);
      _groupChallengeState = null;
      console.log('[socket] Group challenge completed: ' + completionData.name + ' \u2014 ' + (success ? 'SUCCESS' : 'FAILURE'));
    });

    socket.on('groupChallenge:request', () => {
      if (!_groupChallengeState || !_groupChallengeState.active) {
        if (socket.data.role === 'gm') {
          socket.emit('groupChallenge:gm-ack', { active: false, currentBeat: 1, totalVP: 0 });
        } else {
          socket.emit('groupChallenge:sync', { active: false });
        }
        return;
      }
      const gcs = _groupChallengeState;
      const modState = _gcBuildModifierState(gcs);
      if (socket.data.role === 'gm') {
        socket.emit('groupChallenge:gm-ack', {
          active: true,
          currentBeat: gcs.currentBeat,
          totalVP: gcs.totalVP,
          vpThreshold: gcs.vpThreshold,
          crewSize: gcs.crewSize,
          rollLog: gcs.rollLog,
          revealedThresholds: gcs.revealedThresholds,
          modifiers: gcs.challengeData.modifiers || null,
          modifierState: modState,
          resolvedThresholds: gcs.resolvedThresholds
        });
        return;
      }
      const gcCharId = String(socket.data.characterId || '');
      const gcBeat = gcs.currentBeat;
      const gcSubmitted = !!gcs.beatSubmissions[gcCharId + ':' + gcBeat];
      socket.emit('groupChallenge:sync', {
        active: true,
        name: gcs.challengeData.name,
        description: gcs.challengeData.description,
        tier: gcs.challengeData.tier,
        power: gcs.challengeData.power,
        vpThreshold: gcs.vpThreshold,
        vpScoring: gcs.challengeData.vpScoring,
        eligibleDisciplines: _gcGetActiveDisciplines(gcs),
        modifiers: gcs.challengeData.modifiers || null,
        modifierState: modState,
        currentBeat: gcs.currentBeat,
        totalVP: gcs.totalVP,
        rollLog: gcs.rollLog,
        revealedThresholds: gcs.revealedThresholds,
        hasSubmittedThisBeat: gcSubmitted
      });
    });

    socket.on('map:broadcast', async (payload) => {
      if (socket.data.role !== 'gm') {
        socket.emit('error', { message: 'Only the GM can broadcast maps.' });
        return;
      }
      const { mapKey } = payload || {};
      if (!mapKey) return;
      try {
        const pins = await pool.query(
          "SELECT id, map_key, x, y, label, pin_type, visibility, owner, player_name, color FROM map_pins WHERE map_key = $1 AND visibility = 'public'",
          [mapKey]
        );
        _broadcastedMapKey = mapKey;
        _broadcastedMapPins = pins.rows || [];
        io.to('players').emit('map:broadcast', { mapKey, pins: pins.rows });
        socket.emit('map:broadcast-ack', { mapKey });
        console.log('[socket] GM broadcast map: ' + mapKey);

        try {
          const mapTitle = mapKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const entryResult = await client.query(
              `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [
                'Tactical Map: ' + mapTitle,
                'The GM shared tactical map "' + mapTitle + '" with the party.\n\n[map:' + mapKey + ']',
                'System',
                'map-' + mapKey
              ]
            );
            const entryId = entryResult.rows[0].id;
            const tagResult = await client.query(
              `INSERT INTO journal_tags (name, category) VALUES ($1, $2) ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
              ['tactical-map', 'location']
            );
            await client.query(
              'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [entryId, tagResult.rows[0].id]
            );
            const mapTagResult = await client.query(
              `INSERT INTO journal_tags (name, category) VALUES ($1, $2) ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
              [mapKey, 'location']
            );
            await client.query(
              'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [entryId, mapTagResult.rows[0].id]
            );
            await client.query('COMMIT');
            io.emit('journal:updated', { entryId });
          } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
          } finally {
            client.release();
          }
        } catch (journalErr) {
          console.error('[socket] map:broadcast journal entry error:', journalErr);
        }
      } catch (err) {
        console.error('[socket] map:broadcast error:', err);
      }
    });

    socket.on('map:dismiss', () => {
      if (socket.data.role !== 'gm') return;
      _broadcastedMapKey = null;
      _broadcastedMapPins = [];
      io.to('players').emit('map:dismiss');
      console.log('[socket] GM dismissed tactical map');
    });

    socket.on('map:pin-add', async (payload) => {
      const { mapKey, x, y, label, pin_type, visibility, color, player_desc, gm_notes } = payload || {};
      if (!mapKey || x == null || y == null) return;
      const isGm = socket.data.role === 'gm';
      const pinVisibility = isGm ? (visibility || 'public') : 'private';
      const pinOwner = isGm ? 'gm' : 'player';
      const pName = isGm ? '' : (socket.data.characterName || '');
      const pinPlayerDesc = player_desc || '';
      const pinGmNotes = isGm ? (gm_notes || '') : '';
      try {
        const result = await pool.query(
          'INSERT INTO map_pins (map_key, x, y, label, pin_type, visibility, owner, player_name, color, player_desc, gm_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
          [mapKey, x, y, label || '', pin_type || 'note', pinVisibility, pinOwner, pName, color || '#ef4444', pinPlayerDesc, pinGmNotes]
        );
        const pin = result.rows[0];
        socket.emit('map:pin-added', { pin });
        if (isGm && pin.visibility === 'public') {
          const pinForPlayers = Object.assign({}, pin, { gm_notes: '' });
          io.to('players').emit('map:pin-added', { pin: pinForPlayers });
        }
        if (!isGm) {
          io.to('gm').emit('map:pin-added', { pin });
        }
        console.log('[socket] ' + (isGm ? 'GM' : pName) + ' added pin: ' + (label || 'unnamed') + ' on ' + mapKey);
        if (_broadcastedMapKey && mapKey === _broadcastedMapKey) _refreshBroadcastedPins();
      } catch (err) {
        console.error('[socket] map:pin-add error:', err);
      }
    });

    socket.on('map:pin-update', async (payload) => {
      const { id, label, pin_type, visibility, color, x, y, player_desc, gm_notes } = payload || {};
      if (!id) return;
      try {
        const oldResult = await pool.query('SELECT visibility, owner, player_name FROM map_pins WHERE id = $1', [id]);
        if (!oldResult.rows.length) return;
        const oldPin = oldResult.rows[0];
        const oldVisibility = oldPin.visibility;
        const isGm = socket.data.role === 'gm';
        const isOwner = oldPin.owner === 'player' && oldPin.player_name === (socket.data.characterName || '');
        if (!isGm && !isOwner) return;
        if (!isGm && visibility !== undefined) return;

        const updates = [];
        const vals = [];
        let idx = 1;
        if (label !== undefined) { updates.push('label = $' + idx); vals.push(label); idx++; }
        if (pin_type !== undefined) { updates.push('pin_type = $' + idx); vals.push(pin_type); idx++; }
        if (visibility !== undefined) { updates.push('visibility = $' + idx); vals.push(visibility); idx++; }
        if (color !== undefined) { updates.push('color = $' + idx); vals.push(color); idx++; }
        if (x !== undefined) { updates.push('x = $' + idx); vals.push(x); idx++; }
        if (y !== undefined) { updates.push('y = $' + idx); vals.push(y); idx++; }
        if (player_desc !== undefined) { updates.push('player_desc = $' + idx); vals.push(player_desc); idx++; }
        if (gm_notes !== undefined && isGm) { updates.push('gm_notes = $' + idx); vals.push(gm_notes); idx++; }
        if (updates.length === 0) return;
        vals.push(id);
        const result = await pool.query(
          'UPDATE map_pins SET ' + updates.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
          vals
        );
        if (result.rows.length) {
          const pin = result.rows[0];
          socket.emit('map:pin-updated', { pin });
          if (isGm) {
            const pinForPlayers = Object.assign({}, pin, { gm_notes: '' });
            if (oldVisibility === 'public' && pin.visibility === 'private') {
              io.to('players').emit('map:pin-removed', { id: pin.id, mapKey: pin.map_key });
            } else if (oldVisibility === 'private' && pin.visibility === 'public') {
              io.to('players').emit('map:pin-added', { pin: pinForPlayers });
            } else if (pin.visibility === 'public') {
              io.to('players').emit('map:pin-updated', { pin: pinForPlayers });
            }
          } else {
            io.to('gm').emit('map:pin-updated', { pin });
          }
          if (_broadcastedMapKey && pin.map_key === _broadcastedMapKey) _refreshBroadcastedPins();
        }
      } catch (err) {
        console.error('[socket] map:pin-update error:', err);
      }
    });

    socket.on('map:pin-remove', async (payload) => {
      const { id, mapKey } = payload || {};
      if (!id) return;
      try {
        const check = await pool.query('SELECT owner, player_name FROM map_pins WHERE id = $1', [id]);
        if (!check.rows.length) return;
        const pin = check.rows[0];
        const isGm = socket.data.role === 'gm';
        const isOwner = pin.owner === 'player' && pin.player_name === (socket.data.characterName || '');
        if (!isGm && !isOwner) return;

        await pool.query('DELETE FROM map_pins WHERE id = $1', [id]);
        socket.emit('map:pin-removed', { id, mapKey });
        io.to('players').emit('map:pin-removed', { id, mapKey });
        if (!isGm) {
          io.to('gm').emit('map:pin-removed', { id, mapKey });
        }
        console.log('[socket] ' + (isGm ? 'GM' : (socket.data.characterName || 'Player')) + ' removed pin ' + id);
        if (_broadcastedMapKey && mapKey === _broadcastedMapKey) _refreshBroadcastedPins();
      } catch (err) {
        console.error('[socket] map:pin-remove error:', err);
      }
    });

    socket.on('map:pins-request', async (payload) => {
      const { mapKey } = payload || {};
      if (!mapKey) return;
      try {
        let query, params;
        if (socket.data.role === 'gm') {
          query = 'SELECT * FROM map_pins WHERE map_key = $1 ORDER BY created_at ASC';
          params = [mapKey];
        } else {
          const playerName = socket.data.characterName || '';
          query = "SELECT * FROM map_pins WHERE map_key = $1 AND (visibility = 'public' OR (owner = 'player' AND player_name = $2)) ORDER BY created_at ASC";
          params = [mapKey, playerName];
        }
        const result = await pool.query(query, params);
        const isGm = socket.data.role === 'gm';
        const pins = isGm ? result.rows : result.rows.map(p => Object.assign({}, p, { gm_notes: '' }));
        socket.emit('map:pins-sync', { mapKey, pins });
      } catch (err) {
        console.error('[socket] map:pins-request error:', err);
      }
    });

    socket.on('npc:request-sync', async () => {
      try {
        const profileResult = await pool.query(
          'SELECT * FROM npc_profiles WHERE revealed = true ORDER BY sort_order, name'
        );
        const timelineResult = await pool.query(
          'SELECT * FROM npc_timeline WHERE revealed = true ORDER BY created_at ASC'
        );
        const timelineByNpc = {};
        for (const t of timelineResult.rows) {
          if (!timelineByNpc[t.npc_key]) timelineByNpc[t.npc_key] = [];
          timelineByNpc[t.npc_key].push({
            id: t.id, adventure_ref: t.adventure_ref, scene_ref: t.scene_ref,
            event_text: t.event_text, created_at: t.created_at
          });
        }
        const profiles = profileResult.rows.map(r => {
          let traits = [], connections = [];
          try { traits = JSON.parse(r.traits); } catch (_) {}
          try { connections = JSON.parse(r.connections); } catch (_) {}
          return {
            npc_key: r.npc_key, name: r.name, species: r.species, role: r.role,
            portrait_url: r.portrait_url, status: r.status, player_bio: r.player_bio,
            traits, connections, timeline: timelineByNpc[r.npc_key] || []
          };
        });
        socket.emit('npc:sync', { profiles });
      } catch (err) {
        console.error('[socket] npc:request-sync error:', err);
      }
    });

    socket.on('npc:push-update', async ({ npc_key }) => {
      if (socket.data.role !== 'gm') return;
      if (!npc_key) return;
      try {
        const result = await pool.query('SELECT * FROM npc_profiles WHERE npc_key = $1 AND revealed = true', [npc_key]);
        if (!result.rows.length) return;
        const r = result.rows[0];
        let traits = [], connections = [];
        try { traits = JSON.parse(r.traits); } catch (_) {}
        try { connections = JSON.parse(r.connections); } catch (_) {}
        const timelineResult = await pool.query(
          'SELECT * FROM npc_timeline WHERE npc_key = $1 AND revealed = true ORDER BY created_at ASC', [npc_key]
        );
        const timeline = timelineResult.rows.map(t => ({
          id: t.id, adventure_ref: t.adventure_ref, scene_ref: t.scene_ref,
          event_text: t.event_text, created_at: t.created_at
        }));
        io.to('players').emit('npc:updated', {
          profile: {
            npc_key: r.npc_key, name: r.name, species: r.species, role: r.role,
            portrait_url: r.portrait_url, status: r.status, player_bio: r.player_bio,
            traits, connections, timeline
          }
        });
        console.log('[socket] GM pushed NPC update: ' + npc_key);
      } catch (err) {
        console.error('[socket] npc:push-update error:', err);
      }
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

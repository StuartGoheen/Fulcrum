#!/usr/bin/env node
// Regression test: verifies the player-facing campaign-state payload contains
// no GM-only fields after passing through `_filterStateForPlayers` in
// `server/sockets/handlers.js`. Covers:
//
//   PART A — direct unit checks of `_filterStateForPlayers`:
//     - allowlist behavior on adv3_tournament (Day 1 + Day 2 seats, top-level)
//     - non-tournament keys pass through unchanged
//     - input state is not mutated
//     - works with and without a characterId; null/undefined/empty inputs
//
//   PART B — integration checks against the REAL socket handlers registered
//   by `registerHandlers(io)`. We stub the `pg` Pool with just enough query
//   coverage to drive each event handler, capture every emit on every stub
//   socket / room, then assert that the `state:sync` emitted to the players
//   room (or to a per-player socket) is sentinel-free, while the GM-room
//   payload still carries GM-only fields. This is what catches the most
//   important regression: a future refactor that removes/forgets the
//   `_filterStateForPlayers` call at one of these emit sites.
//
//   Broadcast surfaces exercised through real handlers:
//     - 'session:join'                           (player + gm)
//     - 'state:request'                          (player + gm)
//     - 'state:update'                           (gm; broadcasts to players)
//     - 'tournament:regenerate-day1-recap'       (gm; broadcasts to players)
//
// `_filterStateForPlayers` is allowlist-based: anything inside `adv3_tournament`
// not in the hard-coded allowlist is dropped. Rather than enumerate every
// possible GM-only key name (which a future refactor could add to without
// updating this list), we plant a unique SENTINEL string into every GM-only
// field and assert the sentinel never appears anywhere in the player-facing
// JSON tree. This catches both:
//   1. A future refactor that switches the allowlist to a denylist and
//      forgets to add a new GM-only key, AND
//   2. A future refactor that starts spreading raw seat objects (...seat)
//      instead of cherry-picking the safe fields.
//
// To extend coverage when a new state:sync emit site is added in handlers.js:
//   1. Add a new entry to BROADCAST_SURFACES below that drives the new event
//      and points at the per-room/per-socket emits to inspect.
//   2. If the new emit is for a player audience, the test will fail unless
//      the handler routes through `_filterStateForPlayers`.

const assert = require('assert');

// ──────────────────────────────────────────────────────────────────────────
// 0) Patch the pg Pool BEFORE requiring handlers.js so the handlers'
//    `const { pool } = require('../db')` reference points at our stub.
//    We do NOT replace the `pool` object (handlers captured that reference
//    on require); we replace its methods in place.
// ──────────────────────────────────────────────────────────────────────────
const SENTINEL = 'GM_ONLY_LEAK_SENTINEL_dca81f';
const MY_CHAR_ID = '42';
const MY_PC_SEAT_ID = 'pc_' + MY_CHAR_ID;
const WINNER_SEAT_ID = 'pc_' + MY_CHAR_ID;

// State the stub Pool will return for `SELECT key, value FROM campaign_state`.
// Set per-handler invocation so we can vary what the handler "sees".
let CURRENT_STATE = null;

function buildState() {
  return {
    // 1. adv3_tournament — the ONLY key `_filterStateForPlayers` rewrites.
    //    All GM-only fields planted inside here MUST be stripped from the
    //    player view.
    adv3_tournament: {
      // ─── Player-visible top-level fields (must survive sanitization) ───
      seating: {
        // Day 1 Table 1 — mixed PCs / NPCs / empty seat.
        '1': [
          {
            id: MY_PC_SEAT_ID, kind: 'pc', name: 'Reyla', chips: 8000,
            status: 'Healthy', seatNum: 1,
            // GM-only per-seat fields (must be stripped):
            hand: ['+5', '-3', SENTINEL + '_d1ReylaHandCard'],
            gmNote: SENTINEL + '_d1ReylaNote',
            secret: SENTINEL + '_d1ReylaSecret',
            hp: 12,
            hiddenAlias: SENTINEL + '_d1ReylaAlias'
          },
          {
            id: 'npc_creeska', kind: 'npc', name: 'Creeska', chips: 12000,
            status: 'Healthy', seatNum: 2,
            hand: [SENTINEL + '_d1CreeskaHand'],
            gmNote: SENTINEL + '_d1CreeskaNote',
            isMarker: true,
            markerSpotted: false,
            hp: 14,
            secretMotive: SENTINEL + '_d1CreeskaMotive'
          },
          { kind: 'empty', name: '', chips: 0, status: 'Open', seatNum: 3 }
        ],
        // Day 1 Table 2 — single eliminated PC.
        '2': [
          {
            id: 'pc_99', kind: 'pc', name: 'Pike', chips: 0,
            status: 'Eliminated', seatNum: 1,
            gmNote: SENTINEL + '_d1PikeNote',
            hand: [SENTINEL + '_d1PikeHand']
          }
        ]
      },
      fieldRemaining: 18,
      leader: { name: 'Creeska', chips: 12000 },
      active: true,

      // ─── Top-level GM-only fields (must be stripped wholesale) ───
      // The filter only emits {seating, fieldRemaining, leader, active,
      // myRole, mySeat, day2}, so anything else here is GM-only.
      roster: { '42': 'competitor', '99': 'competitor', '101': 'observer' },
      crewCredits: 50000,
      mandelbrotRapportTier: SENTINEL + '_rapportTier',
      gmNotes: SENTINEL + '_topLevelGmNotes',
      day1: {
        cheatCatch: SENTINEL + '_cheatCatch',
        lastRecapRegen: { gmName: SENTINEL + '_regenGm', at: SENTINEL + '_regenAt' },
        gmNotes: SENTINEL + '_day1GmNotes',
        recapBody: SENTINEL + '_day1RecapBody',
        log: [{ ts: '2026-01-01T00:00:00Z', text: SENTINEL + '_d1log' }]
      },
      npcStats: {
        arandis: { hp: 50, secret: SENTINEL + '_arandisSecret' },
        fioro: { hp: 45, hidden: SENTINEL + '_fioroHidden' }
      },

      // ─── day2 ─── Allowlist for day2 is {seating, winnerSeatId, mySeat}.
      day2: {
        seating: {
          '1': [
            {
              id: MY_PC_SEAT_ID, kind: 'pc', name: 'Reyla', chips: 30000,
              status: 'Healthy', seatNum: 1,
              gmNote: SENTINEL + '_d2ReylaNote',
              hand: [SENTINEL + '_d2ReylaHand'],
              secret: SENTINEL + '_d2ReylaSecret'
            },
            {
              id: 'npc_arandis', kind: 'npc', name: 'Arandis', chips: 25000,
              status: 'Healthy', seatNum: 2,
              gmNote: SENTINEL + '_d2ArandisNote',
              isInfiltrator: true,
              secretIdentity: SENTINEL + '_d2ArandisIdentity'
            }
          ]
        },
        winnerSeatId: WINNER_SEAT_ID,

        // GM-only day2 internals (must be stripped):
        switchCommit: SENTINEL + '_switchCommit',
        payoutPaid: true,
        payoutPaidAmount: 100000,
        crewPayout: 100000,
        log: [{ ts: '2026-01-01T00:00:00Z', text: SENTINEL + '_d2logEntry' }],
        cheatSheet: SENTINEL + '_d2CheatSheet',
        gmNotes: SENTINEL + '_d2GmNotes'
      }
    },

    // 2. Non-tournament keys pass through unchanged. These are NOT GM-only
    //    and must remain intact in the player view.
    destiny_locked: false,
    scene_active: { id: 5, title: 'Cloud City' },
    crew_credits: 50000
  };
}

// Convert the in-memory CURRENT_STATE back into the row shape the handlers
// expect from `SELECT key, value FROM campaign_state`.
function stateAsRows(state) {
  return Object.keys(state).map(function (k) {
    const v = state[k];
    return { key: k, value: typeof v === 'string' ? v : JSON.stringify(v) };
  });
}

// Stub `pool.query`. Pattern-matches the queries the four target handlers
// actually issue. Anything unrecognized resolves to an empty result so the
// handler can keep running (most other queries are side-effects we don't
// care about for this test).
function stubPoolQuery(text, params) {
  text = String(text || '').trim();

  // Campaign-state full read — the source of truth for state:sync.
  if (/^SELECT\s+key,\s*value\s+FROM\s+campaign_state\s*$/i.test(text)) {
    return Promise.resolve({ rows: stateAsRows(CURRENT_STATE || {}) });
  }
  // Tournament-only fetch (used by tournament:regenerate-day1-recap before
  // the broadcast read above).
  if (/^SELECT\s+value\s+FROM\s+campaign_state\s+WHERE\s+key\s*=\s*'adv3_tournament'/i.test(text)) {
    const t = (CURRENT_STATE || {}).adv3_tournament;
    return Promise.resolve({ rows: t ? [{ value: JSON.stringify(t) }] : [] });
  }
  // Destiny-locked check inside session:join — return TRUE so the handler
  // skips rebuildPool() and the destiny broadcast it triggers.
  if (/^SELECT\s+value\s+FROM\s+campaign_state\s+WHERE\s+key\s*=\s*'destiny_locked'/i.test(text)) {
    return Promise.resolve({ rows: [{ value: 'true' }] });
  }
  // Destiny pool fetch inside session:join (after the lock check).
  if (/^SELECT\s+value\s+FROM\s+campaign_state\s+WHERE\s+key\s*=\s*'destiny_pool'/i.test(text)) {
    return Promise.resolve({ rows: [{ value: '[]' }] });
  }
  // Player join: name lookup, session row, character session_id update.
  if (/^SELECT\s+name\s+FROM\s+characters\s+WHERE\s+id/i.test(text)) {
    return Promise.resolve({ rows: [{ name: 'Reyla' }] });
  }
  if (/^UPDATE\s+characters\s+SET\s+session_id/i.test(text)) {
    return Promise.resolve({ rowCount: 1 });
  }
  if (/^INSERT\s+INTO\s+sessions/i.test(text)) {
    return Promise.resolve({ rowCount: 1 });
  }
  // state:update writes the new key/value back.
  if (/^\s*INSERT\s+INTO\s+campaign_state/i.test(text)) {
    return Promise.resolve({ rowCount: 1 });
  }
  // tournament:regenerate persists the updated tournament state.
  if (/^UPDATE\s+campaign_state\s+SET\s+value/i.test(text)) {
    return Promise.resolve({ rowCount: 1 });
  }
  // _saveTournamentRecapToJournal: existing journal row lookup. Return a
  // dummy id so the handler short-circuits and skips the INSERT path.
  if (/^SELECT\s+id\s+FROM\s+journal_entries\s+WHERE\s+source_scene_id/i.test(text)) {
    return Promise.resolve({ rows: [{ id: 999 }] });
  }
  // Anything else: empty result.
  return Promise.resolve({ rows: [], rowCount: 0 });
}

// pool.connect is used by _saveTournamentRecapToJournal. Return a no-op
// client so that helper completes without touching a real DB.
function stubPoolConnect() {
  const client = {
    query: function (text) {
      // BEGIN/COMMIT/ROLLBACK + the same SELECT id pattern above.
      if (/^SELECT\s+id\s+FROM\s+journal_entries/i.test(String(text || ''))) {
        return Promise.resolve({ rows: [{ id: 999 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
    release: function () {}
  };
  return Promise.resolve(client);
}

// Apply the stub. handlers.js does `const { pool } = require('../db')` and
// then calls `pool.query(...)` / `pool.connect()` via that captured
// reference, so replacing the methods in place is sufficient.
const db = require('../server/db');
db.pool.query = stubPoolQuery;
db.pool.connect = stubPoolConnect;

const handlers = require('../server/sockets/handlers');
const _filterStateForPlayers = handlers._filterStateForPlayers;

assert.strictEqual(typeof _filterStateForPlayers, 'function',
  'expected _filterStateForPlayers to be exported from server/sockets/handlers.js');

// Walk every node of `node` and return the breadcrumb path of the first
// occurrence of SENTINEL anywhere in keys or string values, or null if clean.
function findSentinel(node, breadcrumb) {
  breadcrumb = breadcrumb || '$';
  if (typeof node === 'string') {
    return node.indexOf(SENTINEL) !== -1 ? { path: breadcrumb, value: node } : null;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findSentinel(node[i], breadcrumb + '[' + i + ']');
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (key.indexOf(SENTINEL) !== -1) {
        return { path: breadcrumb + '.' + key, value: '<key>' };
      }
      const hit = findSentinel(node[key], breadcrumb + '.' + key);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// PART A — Direct unit checks of `_filterStateForPlayers`.
// ══════════════════════════════════════════════════════════════════════════

// 1) With a characterId: sentinel-free + benign fields preserved.
{
  const state = buildState();
  const player = _filterStateForPlayers(state, MY_CHAR_ID);

  const leak = findSentinel(player);
  assert.strictEqual(leak, null,
    '_filterStateForPlayers leaked a GM-only field at ' + (leak && leak.path) +
    ' (value: ' + (leak && JSON.stringify(leak.value)) + ')');

  const tour = player.adv3_tournament;
  assert(tour && typeof tour === 'object', 'adv3_tournament must remain in player view');
  assert.deepStrictEqual(Object.keys(tour).sort(),
    ['active', 'day2', 'fieldRemaining', 'leader', 'myRole', 'mySeat', 'seating'],
    'adv3_tournament player view must expose exactly the allowlisted keys');
  assert.strictEqual(tour.fieldRemaining, 18, 'fieldRemaining must survive');
  assert.deepStrictEqual(tour.leader, { name: 'Creeska', chips: 12000 },
    'leader must survive');
  assert.strictEqual(tour.active, true, 'active must survive');
  assert.strictEqual(tour.myRole, 'competitor', 'myRole must be looked up from roster');
  assert(tour.mySeat && tour.mySeat.name === 'Reyla',
    'mySeat must be populated for the requesting character');
  assert.strictEqual(tour.mySeat.table, 1, 'mySeat.table must be the numeric table id');
  assert.strictEqual(tour.mySeat.seat, 0, 'mySeat.seat must be the seat index');

  // Day 1 seats: every seat object must have ONLY the allowlisted keys
  // (plus optional `mine`). No `id`, `hand`, `gmNote`, `hp`, etc.
  const allowedSeatKeys = new Set(['kind', 'name', 'chips', 'status', 'seatNum', 'mine']);
  for (const tableId of Object.keys(tour.seating)) {
    tour.seating[tableId].forEach(function (seat, idx) {
      if (!seat) return;
      Object.keys(seat).forEach(function (k) {
        assert(allowedSeatKeys.has(k),
          'Day 1 seat at table ' + tableId + ' index ' + idx +
          ' leaked GM-only key "' + k + '" (value: ' + JSON.stringify(seat[k]) + ')');
      });
    });
  }
  assert.strictEqual(tour.seating['1'][0].mine, true,
    'requesting player\'s own seat must be marked mine=true');
  assert.strictEqual(tour.seating['1'][1].mine, undefined,
    'other players\' seats must not carry a mine flag');

  // Day 2 must follow the same shape.
  const d2 = tour.day2;
  assert(d2 && typeof d2 === 'object', 'day2 must remain in player view');
  assert.deepStrictEqual(Object.keys(d2).sort(), ['mySeat', 'seating', 'winnerSeatId'],
    'day2 player view must expose exactly the allowlisted keys');
  assert.strictEqual(d2.winnerSeatId, WINNER_SEAT_ID, 'winnerSeatId must survive');
  assert(d2.mySeat && d2.mySeat.name === 'Reyla',
    'day2.mySeat must be populated for the requesting character');
  const allowedD2SeatKeys = new Set(['kind', 'name', 'chips', 'status', 'seatNum', 'mine', 'winner']);
  for (const tableId of Object.keys(d2.seating)) {
    d2.seating[tableId].forEach(function (seat, idx) {
      if (!seat) return;
      Object.keys(seat).forEach(function (k) {
        assert(allowedD2SeatKeys.has(k),
          'Day 2 seat at table ' + tableId + ' index ' + idx +
          ' leaked GM-only key "' + k + '" (value: ' + JSON.stringify(seat[k]) + ')');
      });
    });
  }
  assert.strictEqual(d2.seating['1'][0].winner, true,
    'day2 winner seat must be marked winner=true');
  assert.strictEqual(d2.seating['1'][1].winner, undefined,
    'non-winner day2 seats must not carry a winner flag');

  // Non-tournament keys must pass through unchanged.
  assert.strictEqual(player.destiny_locked, false,
    'non-tournament state.destiny_locked must pass through');
  assert.deepStrictEqual(player.scene_active, { id: 5, title: 'Cloud City' },
    'non-tournament state.scene_active must pass through');
  assert.strictEqual(player.crew_credits, 50000,
    'non-tournament state.crew_credits must pass through');

  // Mutation safety: the filter must NOT mutate the input state.
  assert(state.adv3_tournament.day1, 'input state.adv3_tournament.day1 must still exist');
  assert.strictEqual(state.adv3_tournament.roster['42'], 'competitor',
    'input state.adv3_tournament.roster must be untouched');
  assert.strictEqual(state.adv3_tournament.seating['1'][0].gmNote,
    SENTINEL + '_d1ReylaNote',
    'input state seats must retain their GM-only fields (filter must be non-mutating)');
}

// 2) Without a characterId: still no leaks, no mySeat / mine flags.
{
  const state = buildState();
  const anon = _filterStateForPlayers(state, null);

  const leak = findSentinel(anon);
  assert.strictEqual(leak, null,
    '_filterStateForPlayers (no characterId) leaked at ' + (leak && leak.path));

  const tour = anon.adv3_tournament;
  assert.strictEqual(tour.myRole, null, 'myRole must be null without a characterId');
  assert.strictEqual(tour.mySeat, null, 'mySeat must be null without a characterId');
  assert.strictEqual(tour.day2.mySeat, null, 'day2.mySeat must be null without a characterId');
  for (const tableId of Object.keys(tour.seating)) {
    tour.seating[tableId].forEach(function (seat) {
      if (!seat) return;
      assert.strictEqual(seat.mine, undefined,
        'no seat may be flagged mine=true when characterId is missing');
    });
  }
}

// 3) Edge cases.
{
  assert.strictEqual(_filterStateForPlayers(null, MY_CHAR_ID), null,
    'null state must pass through');
  assert.strictEqual(_filterStateForPlayers(undefined, MY_CHAR_ID), undefined,
    'undefined state must pass through');
  assert.deepStrictEqual(_filterStateForPlayers({}, MY_CHAR_ID), {},
    'empty state must produce empty player view');
}

// ══════════════════════════════════════════════════════════════════════════
// PART B — Integration checks against the REAL socket handlers.
// We spin up a stub `io`, call `registerHandlers(io)`, capture the
// connection callback + per-socket `on(event, cb)` registrations, then
// drive each event handler directly. Every emit on every socket and every
// `io.to(room).emit` is captured for inspection.
// ══════════════════════════════════════════════════════════════════════════

function makeStubIo() {
  const ioState = {
    connectionHandler: null,    // callback registered via io.on('connection', cb)
    socketsById: new Map(),     // socket.id -> stub socket
    roomEmits: [],              // [{room, event, payload}] from io.to(room).emit
    globalEmits: []             // [{event, payload}] from io.emit
  };
  const io = {
    on: function (event, cb) {
      if (event === 'connection') ioState.connectionHandler = cb;
    },
    to: function (room) {
      return {
        emit: function (event, payload) {
          ioState.roomEmits.push({ room: room, event: event, payload: payload });
        }
      };
    },
    in: function (room) {
      return {
        fetchSockets: function () {
          const out = [];
          for (const s of ioState.socketsById.values()) {
            if (s._rooms && s._rooms.has(room)) out.push(s);
          }
          return Promise.resolve(out);
        }
      };
    },
    emit: function (event, payload) {
      ioState.globalEmits.push({ event: event, payload: payload });
    },
    sockets: { sockets: ioState.socketsById }
  };
  io.of = function () { return { sockets: ioState.socketsById }; };
  return { io: io, ioState: ioState };
}

function makeStubSocket(id, role, characterId) {
  const handlers = new Map();
  return {
    id: id,
    data: { role: role, characterId: characterId, characterName: null },
    _rooms: new Set(),
    _handlers: handlers,
    emitted: [],
    on: function (event, cb) { handlers.set(event, cb); },
    emit: function (event, payload) { this.emitted.push({ event: event, payload: payload }); },
    join: function (room) { this._rooms.add(room); }
  };
}

// Register the real handlers against our stub io. Captures the connection
// callback so we can wire up new sockets on demand.
const { io, ioState } = makeStubIo();
handlers(io);
assert.strictEqual(typeof ioState.connectionHandler, 'function',
  'registerHandlers must call io.on("connection", cb) so we can capture it');

// Plug a stub socket into the io and run the connection handler so its
// `socket.on(...)` registrations are captured on the socket.
function connectStubSocket(socket) {
  ioState.socketsById.set(socket.id, socket);
  ioState.connectionHandler(socket);
}

// Helper: look up a registered handler by event name on a socket.
function getHandler(socket, event) {
  const cb = socket._handlers.get(event);
  assert.strictEqual(typeof cb, 'function',
    'expected socket to have registered a handler for "' + event + '"');
  return cb;
}

// Find the most-recent emit of `event` on `socket` (or null).
function lastEmit(socket, event) {
  for (let i = socket.emitted.length - 1; i >= 0; i--) {
    if (socket.emitted[i].event === event) return socket.emitted[i];
  }
  return null;
}

// Find all room emits matching {room, event}.
function roomEmitsMatching(room, event) {
  return ioState.roomEmits.filter(function (e) { return e.room === room && e.event === event; });
}

// Generic per-surface assertions.
function assertPlayerPayloadClean(playerPayload, label) {
  assert(playerPayload && typeof playerPayload === 'object' && playerPayload.state,
    label + ': player payload must wrap state in `{ state: ... }`');
  const leak = findSentinel(playerPayload);
  assert.strictEqual(leak, null,
    label + ' leaked a GM-only field to the player at ' +
    (leak && leak.path) + ' (value: ' + (leak && JSON.stringify(leak.value)) + ')');
}

function assertGmPayloadCarriesSentinel(gmPayload, label) {
  assert(gmPayload && typeof gmPayload === 'object' && gmPayload.state,
    label + ': GM payload must wrap state in `{ state: ... }`');
  assert(JSON.stringify(gmPayload).indexOf(SENTINEL) !== -1,
    label + ' GM payload must still contain GM-only fields (sentinel) — ' +
    'we should not over-strip the GM view');
}

// Reset emit-capture buckets between surface tests so assertions only see
// the current surface's emissions.
function resetCaptured() {
  ioState.roomEmits.length = 0;
  ioState.globalEmits.length = 0;
  for (const s of ioState.socketsById.values()) s.emitted.length = 0;
}

// Track surfaces we've actually exercised so the closing log is accurate.
const exercised = [];

// Wrap the awaited handler invocations so this file stays valid CommonJS
// (Node 20+ auto-detects top-level await as ESM, which breaks `require`).
(async function runIntegrationChecks() {

// ──────────────────────────────────────────────────────────────────────────
// Surface 1: 'state:request' on a player socket emits a per-socket
//            'state:sync' that must be filtered.
// ──────────────────────────────────────────────────────────────────────────
{
  const playerSocket = makeStubSocket('sock_player', 'player', MY_CHAR_ID);
  const gmSocket     = makeStubSocket('sock_gm',     'gm',     null);
  connectStubSocket(playerSocket);
  connectStubSocket(gmSocket);
  // Both sockets must end up in their respective rooms for surface 3 to work,
  // but state:request is per-socket and doesn't depend on rooms.
  playerSocket._rooms.add('players');
  gmSocket._rooms.add('gm');

  CURRENT_STATE = buildState();
  resetCaptured();
  await getHandler(playerSocket, 'state:request')();
  await getHandler(gmSocket, 'state:request')();

  const playerSync = lastEmit(playerSocket, 'state:sync');
  const gmSync     = lastEmit(gmSocket,     'state:sync');
  assert(playerSync, 'state:request must emit state:sync to the player socket');
  assert(gmSync,     'state:request must emit state:sync to the GM socket');
  assertPlayerPayloadClean(playerSync.payload, 'state:request → player');
  assertGmPayloadCarriesSentinel(gmSync.payload, 'state:request → gm');
  exercised.push('state:request');
}

// ──────────────────────────────────────────────────────────────────────────
// Surface 2: 'state:update' on a GM socket persists then broadcasts —
//            io.to('gm').emit('state:sync', { state }) + per-player-socket
//            emit with `_filterStateForPlayers`.
// ──────────────────────────────────────────────────────────────────────────
{
  const gmSocket     = makeStubSocket('sock_gm2',     'gm',     null);
  const playerSocket = makeStubSocket('sock_player2', 'player', MY_CHAR_ID);
  connectStubSocket(gmSocket);
  connectStubSocket(playerSocket);
  gmSocket._rooms.add('gm');
  playerSocket._rooms.add('players');

  CURRENT_STATE = buildState();
  resetCaptured();
  await getHandler(gmSocket, 'state:update')({
    key: 'adv3_tournament',
    value: CURRENT_STATE.adv3_tournament
  });

  const gmRoomSyncs = roomEmitsMatching('gm', 'state:sync');
  assert.strictEqual(gmRoomSyncs.length, 1,
    'state:update must broadcast exactly once to the gm room');
  assertGmPayloadCarriesSentinel(gmRoomSyncs[0].payload, 'state:update → gm room');

  // Per-player socket emits — find the state:sync emitted to OUR player.
  const playerSync = lastEmit(playerSocket, 'state:sync');
  assert(playerSync, 'state:update must emit state:sync to the player socket directly');
  assertPlayerPayloadClean(playerSync.payload, 'state:update → player socket');

  // No `state:sync` should have been emitted to the players ROOM directly
  // (the handler iterates per-socket so each gets a per-character filter).
  const playerRoomSyncs = roomEmitsMatching('players', 'state:sync');
  assert.strictEqual(playerRoomSyncs.length, 0,
    'state:update must NOT broadcast unfiltered state to the players room — ' +
    'it must iterate fetchSockets() and filter per-character');
  exercised.push('state:update');
}

// ──────────────────────────────────────────────────────────────────────────
// Surface 3: 'session:join' on a player socket triggers a per-socket
//            'state:sync' emit, branched on role.
// ──────────────────────────────────────────────────────────────────────────
{
  const playerSocket = makeStubSocket('sock_join_p', 'player', null);
  const gmSocket     = makeStubSocket('sock_join_g', 'gm',     null);
  connectStubSocket(playerSocket);
  connectStubSocket(gmSocket);

  CURRENT_STATE = buildState();
  resetCaptured();
  // Player join: characterId arrives on the event payload, not pre-set.
  await getHandler(playerSocket, 'session:join')({
    role: 'player',
    characterId: MY_CHAR_ID,
    sessionToken: null
  });
  await getHandler(gmSocket, 'session:join')({
    role: 'gm',
    characterId: null,
    sessionToken: null
  });

  const playerSync = lastEmit(playerSocket, 'state:sync');
  const gmSync     = lastEmit(gmSocket,     'state:sync');
  assert(playerSync, 'session:join must emit state:sync to the joining player socket');
  assert(gmSync,     'session:join must emit state:sync to the joining GM socket');
  assertPlayerPayloadClean(playerSync.payload, 'session:join → player');
  assertGmPayloadCarriesSentinel(gmSync.payload, 'session:join → gm');

  // Sanity: the player socket must have joined the players room and have
  // its character id set on socket.data — proving the real handler ran.
  assert(playerSocket._rooms.has('players'),
    'session:join must add the player socket to the players room');
  assert(gmSocket._rooms.has('gm'),
    'session:join must add the GM socket to the gm room');
  exercised.push('session:join');
}

// ──────────────────────────────────────────────────────────────────────────
// Surface 4: 'tournament:regenerate-day1-recap' on a GM socket persists
//            the updated state and broadcasts it. Player-socket emits must
//            be filtered.
// ──────────────────────────────────────────────────────────────────────────
{
  const gmSocket     = makeStubSocket('sock_regen_g', 'gm',     null);
  const playerSocket = makeStubSocket('sock_regen_p', 'player', MY_CHAR_ID);
  connectStubSocket(gmSocket);
  connectStubSocket(playerSocket);
  gmSocket._rooms.add('gm');
  playerSocket._rooms.add('players');

  CURRENT_STATE = buildState();
  resetCaptured();
  await getHandler(gmSocket, 'tournament:regenerate-day1-recap')({
    sceneId: 'adv3-p2-s5',
    gmNotes: 'fresh notes from the GM',
    gmName: 'TestGM'
  });

  const gmRoomSyncs = roomEmitsMatching('gm', 'state:sync');
  assert.strictEqual(gmRoomSyncs.length, 1,
    'tournament:regenerate-day1-recap must broadcast exactly once to the gm room');
  assertGmPayloadCarriesSentinel(gmRoomSyncs[0].payload,
    'tournament:regenerate-day1-recap → gm room');

  const playerSync = lastEmit(playerSocket, 'state:sync');
  assert(playerSync,
    'tournament:regenerate-day1-recap must emit state:sync to the player socket directly');
  assertPlayerPayloadClean(playerSync.payload,
    'tournament:regenerate-day1-recap → player socket');

  const playerRoomSyncs = roomEmitsMatching('players', 'state:sync');
  assert.strictEqual(playerRoomSyncs.length, 0,
    'tournament:regenerate-day1-recap must NOT broadcast unfiltered state to the players room');
  exercised.push('tournament:regenerate-day1-recap');
}

console.log('OK — player-facing campaign-state payloads contain no GM-only fields');
console.log('     direct check:    _filterStateForPlayers (with characterId, without, edge cases)');
console.log('     handler-driven broadcast surfaces exercised:');
exercised.forEach(function (e) { console.log('       - ' + e); });

// Best-effort: shut down the lazily-created pg Pool so the script exits
// promptly. The pool is created on require but never connects to the DB
// during this test, so .end() is a no-op + resolves immediately.
try {
  if (db && db.pool && typeof db.pool.end === 'function') {
    db.pool.end().catch(function () {});
  }
} catch (_) { /* ignore */ }

})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});

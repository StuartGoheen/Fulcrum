#!/usr/bin/env node
// Regression test: verifies the player-facing conversation payload contains
// no `gmNote` / `gmNotes` fields anywhere in the JSON tree, for both:
//   - the REST endpoint  GET /api/conversations/active
//   - the live socket broadcasts:
//       conversation:start
//       conversation:queued
//       conversation:passed
//       conversation:delivered
//       conversation:beat-advanced
//       conversation:ended
//
// Both paths funnel through `_sanitizeViewForPlayer` /
// `_emitConversationEvent` in `server/routes/conversations.js`. We exercise
// those helpers directly with a synthetic instance built from the real
// `data/conversations/varth-debrief.json` fixture, which still contains
// real GM notes at every layer (top-level gmNotes, per-question gmNote on
// roots, per-question gmNote on followUps, and per-interjection gmNote on
// mayaInterjections).
//
// To add a NEW GM-only conversation field whose key name is something other
// than `gmNote` / `gmNotes`:
//   1. Add it to GM_ONLY_KEYS in `server/routes/conversations.js` (or extend
//      the targeted strip block there), AND
//   2. Append the key name to GM_ONLY_KEYS below so this regression check
//      catches a future leak of that new field.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const conversationRoutes = require('../server/routes/conversations');

const GM_ONLY_KEYS = ['gmNote', 'gmNotes'];

const FIXTURE = path.join(__dirname, '..', 'data', 'conversations', 'varth-debrief.json');
const def = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

// Sanity: confirm the fixture still has real GM data so the test isn't
// silently passing against an empty input. If somebody strips all GM notes
// from this file the fixture is no longer useful.
assert(def.gmNotes,
  'fixture varth-debrief.json must contain a top-level gmNotes string');
assert(Array.isArray(def.roots) && def.roots.some(function (r) { return r && r.gmNote; }),
  'fixture varth-debrief.json must contain per-root gmNote');
assert(def.followUps && Object.keys(def.followUps).some(function (k) {
  return def.followUps[k] && def.followUps[k].gmNote;
}), 'fixture varth-debrief.json must contain per-followUp gmNote');
assert(Array.isArray(def.mayaInterjections) && def.mayaInterjections.some(function (mi) { return mi && mi.gmNote; }),
  'fixture varth-debrief.json must contain per-interjection gmNote');

const sanitize = conversationRoutes._sanitizeViewForPlayer;
const emit     = conversationRoutes._emitConversationEvent;

assert.strictEqual(typeof sanitize, 'function',
  'expected _sanitizeViewForPlayer to be exported from server/routes/conversations.js');
assert.strictEqual(typeof emit, 'function',
  'expected _emitConversationEvent to be exported from server/routes/conversations.js');

// Walk every node of `node` and return the first GM-only key found, with its
// breadcrumb path for debugging.
function findLeak(node, breadcrumb) {
  breadcrumb = breadcrumb || '$';
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findLeak(node[i], breadcrumb + '[' + i + ']');
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    for (const k of GM_ONLY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(node, k)) {
        return { path: breadcrumb + '.' + k, value: node[k] };
      }
    }
    for (const key of Object.keys(node)) {
      const hit = findLeak(node[key], breadcrumb + '.' + key);
      if (hit) return hit;
    }
  }
  return null;
}

// Build a synthetic active instance view that mirrors what `buildPlayerView`
// would produce — but with planted GM-only fields in every shape the player
// payload can carry:
//   - state.log entries (qa + maya, both naturally carry gmNote)
//   - state.queue entries (defensive: current code does not plant gmNote
//     here, but the player payload must still strip one if a future refactor
//     starts attaching it)
//   - the full definition (real gmNotes, root gmNote, followUps gmNote,
//     interjection gmNote already in the fixture)
const firstRoot = def.roots[0];
const firstFollowUpKey = Object.keys(def.followUps || {})[0];
const firstFollowUp = firstFollowUpKey ? def.followUps[firstFollowUpKey] : null;
const firstInterjection = (def.mayaInterjections || [])[0] || null;

const view = {
  id: 7,
  slug: 'varth-debrief',
  status: 'active',
  comfort: 5,
  beat: 1,
  participants: [
    { characterId: '101', characterName: 'Reyla' },
    { characterId: '102', characterName: 'Pike' },
  ],
  state: {
    explored: [firstRoot.id],
    unlocked: [],
    mayaTriggered: firstInterjection ? [0] : [],
    queue: [
      // Pending question — defensively planted with a gmNote that must be
      // stripped from the player payload.
      {
        characterId: '101',
        characterName: 'Reyla',
        action: 'ask',
        questionId: firstRoot.id,
        questionText: firstRoot.text,
        beat: 1,
        status: 'pending',
        submittedAt: 'now',
        gmNote: 'GM ONLY: pretend Reyla is bluffing',
      },
      // Pass entry — carries no GM note normally; included to assert
      // sanitization preserves benign queue items intact.
      {
        characterId: '102',
        characterName: 'Pike',
        action: 'pass',
        beat: 1,
        status: 'delivered',
        submittedAt: 'now',
      },
    ],
    actedThisBeat: ['101', '102'],
    questionsAsked: 1,
    log: [
      // qa entry mirrors what /active/deliver writes (real gmNote from def).
      {
        type: 'qa',
        characterId: '101',
        characterName: 'Reyla',
        questionId: firstRoot.id,
        questionText: firstRoot.text,
        response: firstRoot.response,
        gmNote: firstRoot.gmNote,
        beat: 1,
        comfortBefore: 5,
        comfortAfter: 5,
        at: 'now',
      },
      // maya entry mirrors what /active/deliver writes for an interjection.
      firstInterjection ? {
        type: 'maya',
        text: firstInterjection.text,
        gmNote: firstInterjection.gmNote || 'gm-only',
        beat: 1,
        at: 'now',
      } : null,
      // pass entry — never carries a gmNote, included for completeness.
      { type: 'pass', characterId: '102', characterName: 'Pike', beat: 1, at: 'now' },
    ].filter(Boolean),
  },
  definition: def,
};

// 1) REST: GET /api/conversations/active for a player session funnels
//    through `_maybeSanitize -> _sanitizeViewForPlayer`. Wrap the sanitized
//    view in `{ active: ... }` to mirror the actual response envelope.
const restPlayer = sanitize(view);
{
  const restEnvelope = { active: restPlayer };
  const leak = findLeak(restEnvelope);
  assert.strictEqual(leak, null,
    'REST /api/conversations/active leaked a GM field at ' + (leak && leak.path));
}
// Spot-check that benign data survives sanitization — we only want the GM
// keys gone, not the entire payload.
assert.strictEqual(restPlayer.state.queue.length, view.state.queue.length,
  'sanitizer must preserve every state.queue entry (just strip GM keys)');
assert.strictEqual(restPlayer.state.log.length, view.state.log.length,
  'sanitizer must preserve every state.log entry (just strip GM keys)');
assert(restPlayer.definition && Array.isArray(restPlayer.definition.roots) && restPlayer.definition.roots.length > 0,
  'sanitizer must preserve definition.roots');
assert(restPlayer.definition.followUps && Object.keys(restPlayer.definition.followUps).length > 0,
  'sanitizer must preserve definition.followUps');
// Players must still see the question text + response, just not the gmNote.
assert.strictEqual(restPlayer.definition.roots[0].text, firstRoot.text,
  'sanitizer must preserve question text on roots');
if (firstFollowUp) {
  assert.strictEqual(restPlayer.definition.followUps[firstFollowUpKey].text, firstFollowUp.text,
    'sanitizer must preserve question text on followUps');
}

// 2) Socket broadcasts: stub the io object and exercise every event the
//    player UI listens to. Each event must broadcast exactly once to the
//    'players' room and that payload must be sanitized; the GM-room payload
//    must still carry the GM-only fields (otherwise we've over-stripped).
const EVENTS = [
  'conversation:start',
  'conversation:queued',
  'conversation:passed',
  'conversation:delivered',
  'conversation:beat-advanced',
  'conversation:ended',
];

function makeStubIo() {
  const captured = { gm: [], players: [], unknown: [] };
  return {
    captured: captured,
    to: function (room) {
      return {
        emit: function (event, payload) {
          if (room === 'gm' || room === 'players') {
            captured[room].push({ event: event, payload: payload });
          } else {
            captured.unknown.push({ room: room, event: event, payload: payload });
          }
        },
      };
    },
  };
}

EVENTS.forEach(function (event) {
  const io = makeStubIo();
  const extra = (event === 'conversation:ended') ? { reason: 'gm-ended' }
              : (event === 'conversation:delivered') ? { delivered: { questionId: firstRoot.id, characterId: '101', comfortBefore: 5, comfortAfter: 5 } }
              : undefined;
  emit(io, event, view, extra);

  assert.strictEqual(io.captured.players.length, 1,
    event + ' must broadcast exactly once to the players room');
  assert.strictEqual(io.captured.gm.length, 1,
    event + ' must broadcast exactly once to the gm room');
  assert.strictEqual(io.captured.unknown.length, 0,
    event + ' must not emit to any room other than gm/players');

  const playerPayload = io.captured.players[0].payload;
  const leak = findLeak(playerPayload);
  assert.strictEqual(leak, null,
    'socket ' + event + ' leaked a GM field to the players room at ' + (leak && leak.path));

  // The `extra` payload (e.g. delivered/reason) must still ride along.
  if (extra) {
    Object.keys(extra).forEach(function (k) {
      assert.deepStrictEqual(playerPayload[k], extra[k],
        'socket ' + event + ' must preserve extra payload field "' + k + '"');
    });
  }

  // GM-room payload must STILL contain GM-only data (otherwise we've broken
  // GM tooling). Walk it and confirm at least one gmNote/gmNotes survives.
  const gmPayload = io.captured.gm[0].payload;
  const gmHasNotes = JSON.stringify(gmPayload).indexOf('"gmNote"') !== -1
                  || JSON.stringify(gmPayload).indexOf('"gmNotes"') !== -1;
  assert(gmHasNotes,
    'socket ' + event + ' GM-room payload must still contain gmNote/gmNotes (we should not over-strip the GM view)');
});

console.log('OK — player-facing conversation payloads contain no gmNote/gmNotes');
console.log('     events checked: ' + EVENTS.join(', '));
console.log('     REST endpoint:  GET /api/conversations/active');

// Best-effort: shut down the lazily-created pg Pool so the script exits
// promptly. The pool is created on require but never connects to the DB
// during this test, so .end() is a no-op + resolves immediately.
try {
  const db = require('../server/db');
  if (db && db.pool && typeof db.pool.end === 'function') {
    db.pool.end().catch(function () {});
  }
} catch (_) { /* ignore */ }

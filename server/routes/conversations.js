const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const CONVERSATIONS_DIR = path.join(__dirname, '..', '..', 'data', 'conversations');

function gmOnly(req, res, next) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'Forbidden' });
  next();
}

function loadDefinition(slug) {
  const file = path.join(CONVERSATIONS_DIR, slug + '.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function findQuestion(def, id) {
  const root = (def.roots || []).find(r => r.id === id);
  if (root) return root;
  return (def.followUps || {})[id] || null;
}

function defaultState() {
  return {
    explored: [],
    unlocked: [],
    mayaTriggered: [],
    queue: [],          // [{characterId, characterName, action:'ask'|'pass', questionId?, status:'pending'|'delivered'}]
    log: [],            // [{type, characterId?, characterName?, questionId?, beat, ...}]
    actedThisBeat: [],  // characterIds who have submitted ask or pass this beat
    questionsAsked: 0
  };
}

async function getActiveInstance() {
  const r = await pool.query(
    `SELECT * FROM conversation_instances WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

function buildPlayerView(inst, def) {
  return {
    id: inst.id,
    slug: inst.conversation_slug,
    status: inst.status,
    comfort: inst.comfort,
    beat: inst.beat_index,
    participants: inst.participants || [],
    state: inst.state || defaultState(),
    definition: def
  };
}

// Strip GM-only narrative fields from a definition or built view for player
// consumption. Mirrors the Task #245 marks shaping pattern: dev mode (no
// req.userRole) and GM callers receive the unmodified payload, players get
// gmNote / gmNotes (and Maya interjection triggers) stripped from the entire
// view tree.
//
// The sanitizer deep-walks the cloned view and removes every `gmNote` and
// `gmNotes` key it finds — so it covers definition.gmNotes, every question's
// gmNote on roots + followUps, every maya interjection gmNote, the
// insightCheck gmNote, every entry in state.log, every entry in state.queue,
// and any future field with the same name. Adding a new GM-only field with
// a different key name requires:
//   1. Adding it to GM_ONLY_KEYS (or to the targeted strip below), AND
//   2. Updating scripts/test-conversation-no-gm-leak.js so the regression
//      check catches a future leak of that new field.
const GM_ONLY_KEYS = ['gmNote', 'gmNotes'];

function _stripGmKeysDeep(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) _stripGmKeysDeep(node[i]);
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of GM_ONLY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(node, k)) delete node[k];
    }
    for (const key of Object.keys(node)) _stripGmKeysDeep(node[key]);
  }
}

function _sanitizeViewForPlayer(view) {
  if (!view) return view;
  // Deep-clone so we never mutate the cached definition object held by
  // loadDefinition() readers (definitions are JSON.parse'd fresh each call,
  // but state can be a row reference — clone for safety either way).
  const clone = JSON.parse(JSON.stringify(view));
  _stripGmKeysDeep(clone);
  // Maya interjection trigger metadata is GM-only — it reveals the firing
  // condition for each interjection. Strip per-interjection (the key isn't
  // a generic GM marker so it's handled separately).
  if (clone.definition && Array.isArray(clone.definition.mayaInterjections)) {
    clone.definition.mayaInterjections.forEach(function (mi) {
      if (mi && typeof mi === 'object') delete mi.trigger;
    });
  }
  return clone;
}

function _maybeSanitize(req, view) {
  return (req && req.userRole === 'player') ? _sanitizeViewForPlayer(view) : view;
}

// Broadcast a conversation event to BOTH the GM room and the players room
// using the appropriate payload shape for each. The GM room sees the full
// `view`; the players room sees the sanitized version. Sockets join the
// 'gm' / 'players' rooms during auth (server/sockets/handlers.js).
// `extra` is merged into the emitted payload alongside `active`.
function _emitConversationEvent(io, event, view, extra) {
  if (!io) return;
  const fullPayload = Object.assign({ active: view }, extra || {});
  const playerPayload = Object.assign({ active: _sanitizeViewForPlayer(view) }, extra || {});
  io.to('gm').emit(event, fullPayload);
  io.to('players').emit(event, playerPayload);
}

router.get('/conversations/library', (req, res) => {
  try {
    if (!fs.existsSync(CONVERSATIONS_DIR)) return res.json({ conversations: [] });
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      const slug = f.replace(/\.json$/, '');
      try {
        const d = JSON.parse(fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf8'));
        return { slug, title: d.title || slug, subtitle: d.subtitle || '', npc: d.npc || null };
      } catch (_) { return { slug, title: slug, subtitle: '', npc: null }; }
    });
    res.json({ conversations: list });
  } catch (err) {
    console.error('[GET /conversations/library]', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

router.get('/conversations/:slug/definition', (req, res) => {
  const def = loadDefinition(req.params.slug);
  if (!def) return res.status(404).json({ error: 'Conversation not found' });
  // Players get a sanitized definition (no top-level gmNotes, no per-question
  // gmNote, no maya gmNote/trigger). GM and dev mode get the raw file.
  if (req.userRole === 'player') {
    const wrapped = _sanitizeViewForPlayer({ definition: def });
    return res.json(wrapped.definition);
  }
  res.json(def);
});

router.get('/conversations/active', async (req, res) => {
  try {
    const inst = await getActiveInstance();
    if (!inst) return res.json({ active: null });
    const def = loadDefinition(inst.conversation_slug);
    res.json({ active: _maybeSanitize(req, buildPlayerView(inst, def)) });
  } catch (err) {
    console.error('[GET /conversations/active]', err);
    res.status(500).json({ error: 'Failed to load active conversation' });
  }
});

router.post('/conversations/instances', gmOnly, async (req, res) => {
  const { slug, participants } = req.body;
  if (!slug) return res.status(400).json({ error: 'slug required' });
  const def = loadDefinition(slug);
  if (!def) return res.status(404).json({ error: 'Conversation definition not found' });

  try {
    // End any existing active conversation
    await pool.query(
      `UPDATE conversation_instances SET status = 'ended', ended_at = NOW() WHERE status = 'active'`
    );

    let parts = Array.isArray(participants) ? participants : [];
    // Auto-fill from connected sockets if empty
    if (!parts.length) {
      const io = req.app.get('io');
      if (io) {
        const seen = new Map();
        Array.from(io.sockets.sockets.values()).forEach(s => {
          if (s.data.role === 'player' && s.data.characterId) {
            const id = String(s.data.characterId);
            if (!seen.has(id)) seen.set(id, { characterId: id, characterName: s.data.characterName || 'Unknown' });
          }
        });
        parts = Array.from(seen.values());
      }
    }

    const startingComfort = (def.comfort && def.comfort.starting) || 5;
    const result = await pool.query(
      `INSERT INTO conversation_instances (conversation_slug, status, comfort, beat_index, participants, state)
       VALUES ($1, 'active', $2, 1, $3, $4)
       RETURNING *`,
      [slug, startingComfort, JSON.stringify(parts), JSON.stringify(defaultState())]
    );
    const inst = result.rows[0];

    const io = req.app.get('io');
    _emitConversationEvent(io, 'conversation:start', buildPlayerView(inst, def));

    res.json({ active: buildPlayerView(inst, def) });
  } catch (err) {
    console.error('[POST /conversations/instances]', err);
    res.status(500).json({ error: 'Failed to launch conversation' });
  }
});

function getCharFromBody(req) {
  const characterId = req.body && req.body.characterId ? String(req.body.characterId) : null;
  const characterName = (req.body && req.body.characterName) || 'Unknown';
  return { characterId, characterName };
}

async function checkBeatAdvance(inst, def, io) {
  // Beat advances when every participant has acted (passed or had question delivered)
  const state = inst.state || defaultState();
  const parts = inst.participants || [];
  if (!parts.length) return inst;

  const allActed = parts.every(p => (state.actedThisBeat || []).includes(String(p.characterId)));
  if (!allActed) return inst;

  // Are there any pending (asked but not delivered) questions?
  const pending = (state.queue || []).some(q => q.status === 'pending' && q.beat === inst.beat_index);
  if (pending) return inst;

  // Did everyone pass this beat?
  const beatActions = (state.queue || []).filter(q => q.beat === inst.beat_index);
  const allPassed = parts.every(p => {
    const a = beatActions.find(q => String(q.characterId) === String(p.characterId));
    return a && a.action === 'pass';
  });

  if (allPassed) {
    return await endConversation(inst.id, def, io, 'all-passed');
  }

  // Advance to next beat
  state.actedThisBeat = [];
  const newBeat = inst.beat_index + 1;
  const r = await pool.query(
    `UPDATE conversation_instances SET beat_index = $1, state = $2 WHERE id = $3 RETURNING *`,
    [newBeat, JSON.stringify(state), inst.id]
  );
  const updated = r.rows[0];
  _emitConversationEvent(io, 'conversation:beat-advanced', buildPlayerView(updated, def));
  return updated;
}

async function endConversation(instId, def, io, reason) {
  const r = await pool.query(
    `UPDATE conversation_instances SET status = 'ended', ended_at = NOW() WHERE id = $1 RETURNING *`,
    [instId]
  );
  const updated = r.rows[0];
  _emitConversationEvent(io, 'conversation:ended', buildPlayerView(updated, def), { reason });
  return updated;
}

router.post('/conversations/active/ask', async (req, res) => {
  const { questionId } = req.body || {};
  const { characterId, characterName } = getCharFromBody(req);
  if (!questionId || !characterId) return res.status(400).json({ error: 'questionId and characterId required' });

  try {
    const inst = await getActiveInstance();
    if (!inst) return res.status(404).json({ error: 'No active conversation' });
    const def = loadDefinition(inst.conversation_slug);
    if (!def) return res.status(404).json({ error: 'Definition missing' });

    const state = inst.state || defaultState();
    const acted = state.actedThisBeat || [];
    if (acted.includes(String(characterId))) {
      return res.status(409).json({ error: 'Already acted this beat' });
    }
    const q = findQuestion(def, questionId);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    if (state.explored.includes(questionId)) return res.status(409).json({ error: 'Question already asked' });
    if (q.minComfort && inst.comfort < q.minComfort) return res.status(409).json({ error: 'Locked at this comfort' });

    state.queue = state.queue || [];
    state.queue.push({
      characterId: String(characterId),
      characterName,
      action: 'ask',
      questionId,
      questionText: q.text,
      beat: inst.beat_index,
      status: 'pending',
      submittedAt: new Date().toISOString()
    });
    state.actedThisBeat = acted.concat(String(characterId));

    const r = await pool.query(
      `UPDATE conversation_instances SET state = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(state), inst.id]
    );
    const updated = r.rows[0];
    const io = req.app.get('io');
    _emitConversationEvent(io, 'conversation:queued', buildPlayerView(updated, def));

    // No auto-advance here (questions still pending)
    res.json({ active: _maybeSanitize(req, buildPlayerView(updated, def)) });
  } catch (err) {
    console.error('[POST /conversations/active/ask]', err);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

router.post('/conversations/active/pass', async (req, res) => {
  const { characterId, characterName } = getCharFromBody(req);
  if (!characterId) return res.status(400).json({ error: 'characterId required' });

  try {
    const inst = await getActiveInstance();
    if (!inst) return res.status(404).json({ error: 'No active conversation' });
    const def = loadDefinition(inst.conversation_slug);
    const state = inst.state || defaultState();
    const acted = state.actedThisBeat || [];
    if (acted.includes(String(characterId))) {
      return res.status(409).json({ error: 'Already acted this beat' });
    }
    state.queue = state.queue || [];
    state.queue.push({
      characterId: String(characterId),
      characterName,
      action: 'pass',
      beat: inst.beat_index,
      status: 'delivered',
      submittedAt: new Date().toISOString()
    });
    state.actedThisBeat = acted.concat(String(characterId));
    state.log = state.log || [];
    state.log.push({ type: 'pass', characterId: String(characterId), characterName, beat: inst.beat_index, at: new Date().toISOString() });

    const r = await pool.query(
      `UPDATE conversation_instances SET state = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(state), inst.id]
    );
    let updated = r.rows[0];
    const io = req.app.get('io');
    _emitConversationEvent(io, 'conversation:passed', buildPlayerView(updated, def));

    updated = await checkBeatAdvance(updated, def, io);
    res.json({ active: _maybeSanitize(req, buildPlayerView(updated, def)) });
  } catch (err) {
    console.error('[POST /conversations/active/pass]', err);
    res.status(500).json({ error: 'Failed to pass' });
  }
});

router.post('/conversations/active/deliver', gmOnly, async (req, res) => {
  const { questionId, characterId } = req.body || {};
  if (!questionId || !characterId) return res.status(400).json({ error: 'questionId and characterId required' });

  try {
    const inst = await getActiveInstance();
    if (!inst) return res.status(404).json({ error: 'No active conversation' });
    const def = loadDefinition(inst.conversation_slug);
    const state = inst.state || defaultState();

    const item = (state.queue || []).find(q =>
      q.questionId === questionId && String(q.characterId) === String(characterId) && q.status === 'pending'
    );
    if (!item) return res.status(404).json({ error: 'Pending question not found' });

    const q = findQuestion(def, questionId);
    if (!q) return res.status(404).json({ error: 'Question not found in definition' });

    item.status = 'delivered';
    item.deliveredAt = new Date().toISOString();
    state.explored = (state.explored || []).concat(questionId);
    state.questionsAsked = (state.questionsAsked || 0) + 1;

    let oldComfort = inst.comfort;
    let newComfort = oldComfort;
    if (q.comfortCost && q.comfortCost < 0) {
      newComfort = Math.max(0, oldComfort + q.comfortCost);
    }

    if (q.unlocks && q.unlocks.length) {
      const unlockSet = new Set(state.unlocked || []);
      q.unlocks.forEach(uid => unlockSet.add(uid));
      state.unlocked = Array.from(unlockSet);
    }

    state.log = state.log || [];
    state.log.push({
      type: 'qa',
      characterId: String(characterId),
      characterName: item.characterName,
      questionId,
      questionText: q.text,
      response: q.response,
      gmNote: q.gmNote || null,
      beat: item.beat,
      comfortBefore: oldComfort,
      comfortAfter: newComfort,
      at: new Date().toISOString()
    });

    // Maya interjections
    const mayaTrig = new Set(state.mayaTriggered || []);
    (def.mayaInterjections || []).forEach((mi, idx) => {
      if (mayaTrig.has(idx)) return;
      let fire = false;
      if (mi.trigger.includes('After any 3 questions') && state.questionsAsked === 3) fire = true;
      if (mi.trigger.includes('empire-transition') && state.explored.includes('empire-transition')) fire = true;
      if (mi.trigger.includes('comfort drops to 2') && newComfort === 2) fire = true;
      if (fire) {
        mayaTrig.add(idx);
        state.log.push({ type: 'maya', text: mi.text, gmNote: mi.gmNote || null, beat: item.beat, at: new Date().toISOString() });
      }
    });
    state.mayaTriggered = Array.from(mayaTrig);

    const r = await pool.query(
      `UPDATE conversation_instances SET state = $1, comfort = $2 WHERE id = $3 RETURNING *`,
      [JSON.stringify(state), newComfort, inst.id]
    );
    let updated = r.rows[0];
    const io = req.app.get('io');
    _emitConversationEvent(io, 'conversation:delivered', buildPlayerView(updated, def), {
      delivered: { questionId, characterId: String(characterId), comfortBefore: oldComfort, comfortAfter: newComfort }
    });

    // End on comfort threshold
    const exitThreshold = (def.comfort && def.comfort.exitThreshold) || 1;
    if (newComfort <= exitThreshold) {
      updated = await endConversation(updated.id, def, io, 'comfort-exit');
      return res.json({ active: buildPlayerView(updated, def) });
    }

    updated = await checkBeatAdvance(updated, def, io);
    res.json({ active: buildPlayerView(updated, def) });
  } catch (err) {
    console.error('[POST /conversations/active/deliver]', err);
    res.status(500).json({ error: 'Failed to deliver response' });
  }
});

router.post('/conversations/active/end', gmOnly, async (req, res) => {
  try {
    const inst = await getActiveInstance();
    if (!inst) return res.status(404).json({ error: 'No active conversation' });
    const def = loadDefinition(inst.conversation_slug);
    const io = req.app.get('io');
    const updated = await endConversation(inst.id, def, io, 'gm-ended');
    res.json({ active: buildPlayerView(updated, def) });
  } catch (err) {
    console.error('[POST /conversations/active/end]', err);
    res.status(500).json({ error: 'Failed to end conversation' });
  }
});

router.post('/conversations/active/clip', async (req, res) => {
  const { questionId, scope, notes } = req.body || {};
  const { characterId, characterName } = getCharFromBody(req);
  if (!questionId || !characterId) return res.status(400).json({ error: 'questionId and characterId required' });
  if (!['private', 'crew'].includes(scope)) return res.status(400).json({ error: 'scope must be private or crew' });

  try {
    const inst = await getActiveInstance();
    let logEntry = null;
    let conversationSlug = null;
    let definition = null;

    if (inst) {
      conversationSlug = inst.conversation_slug;
      definition = loadDefinition(conversationSlug);
      const state = inst.state || {};
      logEntry = (state.log || []).find(l => l.type === 'qa' && l.questionId === questionId);
    }
    if (!logEntry) {
      // Allow clipping from a prior (ended) conversation by looking up the most recent
      const r = await pool.query(
        `SELECT * FROM conversation_instances ORDER BY created_at DESC LIMIT 5`
      );
      for (const row of r.rows) {
        const st = row.state || {};
        const found = (st.log || []).find(l => l.type === 'qa' && l.questionId === questionId);
        if (found) {
          logEntry = found;
          conversationSlug = row.conversation_slug;
          definition = loadDefinition(conversationSlug);
          break;
        }
      }
    }
    if (!logEntry) return res.status(404).json({ error: 'Question not found in conversation log' });

    const npcName = (definition && definition.npc && definition.npc.name) || 'NPC';
    const sceneTitle = (definition && (definition.title || definition.subtitle)) || 'Conversation';

    const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    const bodyLines = [];
    bodyLines.push(`Scene: ${sceneTitle}`);
    bodyLines.push(`Asked by: ${logEntry.characterName || characterName}`);
    bodyLines.push('');
    bodyLines.push(`Q: "${logEntry.questionText}"`);
    bodyLines.push('');
    bodyLines.push(`${npcName}: ${stripHtml(logEntry.response)}`);
    if (notes && String(notes).trim()) {
      bodyLines.push('');
      bodyLines.push('--- Note ---');
      bodyLines.push(String(notes).trim());
    }
    const body = bodyLines.join('\n');

    const visibility = scope === 'private' ? characterName : 'crew';
    const author = scope === 'private' ? characterName : (logEntry.characterName || characterName);
    const title = `${npcName} — "${logEntry.questionText}"`.slice(0, 200);
    const sceneTag = 'conversation:' + (conversationSlug || 'unknown');

    const r = await pool.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id, visibility)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, body, author_character_name, source_scene_id, visibility, created_at`,
      [title, body, author, sceneTag, visibility]
    );

    const io = req.app.get('io');
    if (io) io.emit('journal:updated', { entryId: r.rows[0].id });

    res.json({ entry: r.rows[0] });
  } catch (err) {
    console.error('[POST /conversations/active/clip]', err);
    res.status(500).json({ error: 'Failed to clip to journal' });
  }
});

// Expose internals for the regression test in
// scripts/test-conversation-no-gm-leak.js. Attaching to the router preserves
// the existing `app.use('/api', conversationRoutes)` shape in server/index.js.
router._sanitizeViewForPlayer = _sanitizeViewForPlayer;
router._emitConversationEvent = _emitConversationEvent;
router._GM_ONLY_KEYS = GM_ONLY_KEYS;

module.exports = router;

// Linked Destiny — Mission Reviews API (Task #240).
//
// Flow:
//   1) Player clicks "End Mission" → client POSTs /characters/:id/end-mission/request
//      with the would-be advancement payload it was about to PATCH locally. Server
//      freezes the destiny-tagged marks from THIS adventure (using the relational
//      `adventure_marks` table as truth, not the proposed payload), resolves the
//      linker via the source's per-Act linkedPartners map, and stores a row in
//      `pending_mission_reviews` with `status='pending'`. Source's `missionPhase`
//      stays at 'mission' until the GM approves — the GM is the gate.
//   2) GM panel polls/listens, sees the queue, calls approve/reject.
//   3) Approve: source's frozen advancement payload is applied (this includes the
//      missionPhase='advancement' flip and locked marks), and the linker — if any —
//      receives +1 banked Mark per source mark whose destinies include the LINKER's
//      personalDestiny.id. NO Edge refill anywhere. NO chain hops: Bob's Liberation
//      tick does NOT propagate to Helrun if Bob's linker is Kos (Discovery).
//
// Socket events (room/per-character):
//   missionReview:queued    → 'gm' room
//   missionReview:approved  → source player socket
//   missionReview:rejected  → source player socket (carries optional gm_note)
//   linkedShare:received    → linker player socket (carries {sourceName, count})

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../db');
const { roleFromCookie } = require('../auth');

const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');

let _advCache = null;
let _advMtimes = {};
function _loadAdventures() {
  const files = fs.readdirSync(ADVENTURES_DIR)
    .filter(function (f) { return /^adv\d+\.json$/.test(f); })
    .sort();
  let needsReload = !_advCache;
  if (!needsReload) {
    for (const f of files) {
      try {
        const m = fs.statSync(path.join(ADVENTURES_DIR, f)).mtimeMs;
        if (!_advMtimes[f] || m > _advMtimes[f]) { needsReload = true; break; }
      } catch (e) { needsReload = true; break; }
    }
  }
  if (needsReload) {
    const advs = [];
    const newMtimes = {};
    for (const f of files) {
      try {
        const fp = path.join(ADVENTURES_DIR, f);
        const txt = fs.readFileSync(fp, 'utf8').trim();
        if (!txt) continue;
        advs.push(JSON.parse(txt));
        newMtimes[f] = fs.statSync(fp).mtimeMs;
      } catch (e) {
        console.error('[mission-reviews] adventure parse error:', f, e.message);
      }
    }
    _advCache = advs;
    _advMtimes = newMtimes;
  }
  return _advCache;
}

function _findAdventure(adventureId) {
  const advs = _loadAdventures();
  return advs.find(function (a) { return a.id === adventureId; }) || null;
}

// All marks on an adventure (we walk parts → scenes → marks plus any top-level marks).
function _collectAdventureMarks(adv) {
  if (!adv) return [];
  const out = [];
  if (Array.isArray(adv.marks)) adv.marks.forEach(function (m) { out.push(m); });
  if (Array.isArray(adv.parts)) {
    adv.parts.forEach(function (p) {
      if (Array.isArray(p.marks)) p.marks.forEach(function (m) { out.push(m); });
      if (Array.isArray(p.scenes)) {
        p.scenes.forEach(function (s) {
          if (Array.isArray(s.marks)) s.marks.forEach(function (m) { out.push(m); });
        });
      }
    });
  }
  return out;
}

// Effective destinies for a mark+chosen-path combo.
function _effectiveDestinies(mark, pathId) {
  if (!mark) return [];
  if (pathId && Array.isArray(mark.paths)) {
    const chosen = mark.paths.find(function (p) { return p.id === pathId; });
    if (chosen && Array.isArray(chosen.destinies)) return chosen.destinies.slice();
  }
  return Array.isArray(mark.destinies) ? mark.destinies.slice() : [];
}

async function _getCurrentAdventureId() {
  const r = await pool.query("SELECT adventure_id FROM campaign_progress WHERE id = 1");
  if (r.rows.length === 0) return null;
  return r.rows[0].adventure_id || null;
}

function _requireGm(req, res, next) {
  if (roleFromCookie(req) !== 'gm') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// Player-callable: must be the source character themselves OR the GM (for testing).
function _requirePlayerOrGm(req, res, next) {
  const role = roleFromCookie(req);
  if (role === 'gm' || role === 'player') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// Verify that the caller may act on behalf of `:id`. GM is always allowed.
// Players must present a valid `player_token` (query, body, or header) bound to
// `characterId` in the `sessions` table. Returns null if OK, or an
// {status, error} object to reject with.
async function _verifyCharOwnership(req, characterId) {
  const role = roleFromCookie(req);
  if (role === 'gm') return null;
  if (role !== 'player') return { status: 403, error: 'Forbidden' };
  const token = (req.query && req.query.player_token) ||
    (req.body && req.body.player_token) ||
    (req.headers && req.headers['x-player-token']);
  if (!token) return { status: 403, error: 'player_token required' };
  try {
    const r = await pool.query(
      'SELECT character_id FROM sessions WHERE player_token = $1 AND character_id = $2',
      [token, characterId]
    );
    if (!r.rows.length) return { status: 403, error: 'Invalid player_token for this character' };
  } catch (e) {
    return { status: 500, error: 'Ownership check failed' };
  }
  return null;
}

function _emitToCharacter(io, characterId, event, payload) {
  if (!io || !characterId) return;
  for (const s of io.sockets.sockets.values()) {
    if (s.data && s.data.characterId === characterId) {
      s.emit(event, payload);
    }
  }
}

async function _loadCharacter(charId) {
  const r = await pool.query('SELECT id, name, character_data FROM characters WHERE id = $1', [charId]);
  if (r.rows.length === 0 || !r.rows[0].character_data) return null;
  let data = {};
  try { data = JSON.parse(r.rows[0].character_data); } catch (e) {}
  return { id: r.rows[0].id, name: r.rows[0].name, data };
}

// POST /api/characters/:id/end-mission/request
//
// Body: { advancement: {...full would-be advancement payload...} }
//
// We compute the frozen marks from the relational `adventure_marks` table for the
// CURRENT adventure (the campaign_progress row), so the snapshot is independent of
// whatever the client claims. We then resolve the linker via the source character's
// linkedPartners[Act].
router.post('/characters/:id/end-mission/request', _requirePlayerOrGm, async (req, res) => {
  const sourceCharId = parseInt(req.params.id, 10);
  if (!Number.isFinite(sourceCharId) || sourceCharId <= 0) {
    return res.status(400).json({ error: 'Invalid character id.' });
  }
  const ownership = await _verifyCharOwnership(req, sourceCharId);
  if (ownership) return res.status(ownership.status).json({ error: ownership.error });
  const proposedAdv = req.body && req.body.advancement;
  if (!proposedAdv || typeof proposedAdv !== 'object') {
    return res.status(400).json({ error: 'Missing advancement payload.' });
  }

  try {
    // Refuse if there's already a pending review for this character.
    const existing = await pool.query(
      "SELECT id FROM pending_mission_reviews WHERE source_char_id = $1 AND status = 'pending'",
      [sourceCharId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A mission review is already pending for this character.' });
    }

    const source = await _loadCharacter(sourceCharId);
    if (!source) return res.status(404).json({ error: 'Source character not found.' });

    const adventureId = await _getCurrentAdventureId();
    if (!adventureId) return res.status(500).json({ error: 'No current adventure set.' });
    const adv = _findAdventure(adventureId);
    if (!adv) return res.status(500).json({ error: 'Current adventure not loadable: ' + adventureId });
    const act = parseInt(adv.act, 10);
    if (!Number.isFinite(act) || act < 1 || act > 3) {
      return res.status(500).json({ error: 'Adventure has no valid act number.' });
    }

    // Resolve linker via source's linkedPartners[act]. May be null (no linker → share_count 0).
    const linkedPartners = (source.data.advancement && source.data.advancement.linkedPartners) || {};
    const linkerCharId = parseInt(linkedPartners[String(act)], 10);
    let linker = null;
    let linkerDestinyId = null;
    if (Number.isFinite(linkerCharId) && linkerCharId > 0 && linkerCharId !== sourceCharId) {
      linker = await _loadCharacter(linkerCharId);
      if (linker && linker.data.personalDestiny && linker.data.personalDestiny.id) {
        linkerDestinyId = linker.data.personalDestiny.id;
      }
    }

    // Pull source's CURRENT ticked marks for THIS adventure from the relational table.
    // (This is the source-of-truth that adventure-marks PUTs maintain.)
    const marksRows = await pool.query(
      'SELECT mark_id, path_id, bucket FROM adventure_marks WHERE character_id = $1 AND adventure_id = $2',
      [sourceCharId, adventureId]
    );
    const allAdvMarks = _collectAdventureMarks(adv);
    const markIndex = {};
    allAdvMarks.forEach(function (m) { if (m && m.id) markIndex[m.id] = m; });

    // Frozen snapshot — only the destiny-tagged marks matter for the share rule. We also
    // skip 'edge' bucket (those have no destiny tags). Hidden marks count if ticked.
    const frozenMarks = [];
    let shareCount = 0;
    marksRows.rows.forEach(function (row) {
      if (row.bucket !== 'adventure') return;
      const m = markIndex[row.mark_id];
      if (!m) return;
      const destinies = _effectiveDestinies(m, row.path_id);
      if (!destinies.length) return;
      frozenMarks.push({
        mark_id: row.mark_id,
        path_id: row.path_id || null,
        label: m.label || row.mark_id,
        destinies: destinies
      });
      if (linkerDestinyId && destinies.indexOf(linkerDestinyId) !== -1) {
        shareCount += 1;
      }
    });

    const insert = await pool.query(
      `INSERT INTO pending_mission_reviews
         (source_char_id, adventure_id, act_number, frozen_marks,
          linker_char_id, linker_destiny_id, share_count, mission_end_advancement, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, 'pending')
       RETURNING id, created_at`,
      [
        sourceCharId,
        adventureId,
        act,
        JSON.stringify(frozenMarks),
        linker ? linker.id : null,
        linkerDestinyId,
        shareCount,
        JSON.stringify(proposedAdv)
      ]
    );
    const reviewId = insert.rows[0].id;

    console.info(
      '[mission-reviews] queued review=' + reviewId +
      ' source=' + sourceCharId + '(' + source.name + ')' +
      ' adv=' + adventureId + ' act=' + act +
      ' linker=' + (linker ? linker.id + '(' + linker.name + ')/' + linkerDestinyId : 'none') +
      ' frozen=' + frozenMarks.length +
      ' shareCount=' + shareCount
    );

    const io = req.app.get('io');
    if (io) io.to('gm').emit('missionReview:queued', { reviewId: reviewId });

    return res.json({
      ok: true,
      reviewId: reviewId,
      adventureId: adventureId,
      act: act,
      frozenCount: frozenMarks.length,
      linkerName: linker ? linker.name : null,
      shareCount: shareCount
    });
  } catch (err) {
    console.error('[POST /end-mission/request]', err);
    return res.status(500).json({ error: 'Failed to queue mission review.' });
  }
});

// GET /api/mission-reviews?status=pending  — GM only.
router.get('/mission-reviews', _requireGm, async (req, res) => {
  try {
    const status = (req.query.status || 'pending').toString();
    const rows = await pool.query(
      `SELECT pmr.id, pmr.source_char_id, pmr.adventure_id, pmr.act_number,
              pmr.frozen_marks, pmr.linker_char_id, pmr.linker_destiny_id,
              pmr.share_count, pmr.status, pmr.gm_note, pmr.created_at, pmr.resolved_at,
              src.name AS source_name,
              lnk.name AS linker_name,
              (lnk.character_data::jsonb)->'personalDestiny'->>'name' AS linker_destiny_name
         FROM pending_mission_reviews pmr
         LEFT JOIN characters src ON src.id = pmr.source_char_id
         LEFT JOIN characters lnk ON lnk.id = pmr.linker_char_id
        WHERE pmr.status = $1
        ORDER BY pmr.created_at ASC`,
      [status]
    );
    const adventures = _loadAdventures();
    const advNameById = {};
    adventures.forEach(function (a) { advNameById[a.id] = a.title || a.name || a.id; });
    const out = rows.rows.map(function (r) {
      return {
        id: r.id,
        sourceCharId: r.source_char_id,
        sourceName: r.source_name || '#' + r.source_char_id,
        adventureId: r.adventure_id,
        adventureName: advNameById[r.adventure_id] || r.adventure_id,
        act: r.act_number,
        frozenMarks: r.frozen_marks || [],
        linkerCharId: r.linker_char_id,
        linkerName: r.linker_name || null,
        linkerDestinyId: r.linker_destiny_id,
        linkerDestinyName: r.linker_destiny_name || null,
        shareCount: r.share_count,
        status: r.status,
        gmNote: r.gm_note,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at
      };
    });
    res.json({ ok: true, reviews: out });
  } catch (err) {
    console.error('[GET /mission-reviews]', err);
    res.status(500).json({ error: 'Failed to load mission reviews.' });
  }
});

// PUT /api/mission-reviews/:reviewId/approve — GM only.
router.put('/mission-reviews/:reviewId/approve', _requireGm, async (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (!Number.isFinite(reviewId)) return res.status(400).json({ error: 'Invalid review id.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      "SELECT * FROM pending_mission_reviews WHERE id = $1 FOR UPDATE",
      [reviewId]
    );
    if (r.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Review not found.' }); }
    const review = r.rows[0];
    if (review.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Review already resolved.' }); }

    // Apply the source's would-be advancement payload. We force missionPhase='advancement'
    // here so the GM gate is the only thing that flips it — we don't trust the client.
    const sourceQ = await client.query('SELECT id, name, character_data FROM characters WHERE id = $1 FOR UPDATE', [review.source_char_id]);
    if (sourceQ.rows.length === 0 || !sourceQ.rows[0].character_data) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Source character missing.' });
    }
    let srcData = {};
    try { srcData = JSON.parse(sourceQ.rows[0].character_data); } catch (e) {}
    const proposed = review.mission_end_advancement || {};
    const newAdv = Object.assign({}, srcData.advancement || {}, proposed);
    newAdv.missionPhase = 'advancement';
    // Preserve the per-Act linkedPartners map — the proposed payload may not include it.
    if (!newAdv.linkedPartners && srcData.advancement && srcData.advancement.linkedPartners) {
      newAdv.linkedPartners = srcData.advancement.linkedPartners;
    }
    srcData.advancement = newAdv;
    await client.query('UPDATE characters SET character_data = $1 WHERE id = $2',
      [JSON.stringify(srcData), review.source_char_id]);

    // Credit linker if present.
    let linkerName = null;
    if (review.linker_char_id && review.share_count > 0) {
      const linkerQ = await client.query('SELECT id, name, character_data FROM characters WHERE id = $1 FOR UPDATE', [review.linker_char_id]);
      if (linkerQ.rows.length > 0 && linkerQ.rows[0].character_data) {
        let lData = {};
        try { lData = JSON.parse(linkerQ.rows[0].character_data); } catch (e) {}
        linkerName = linkerQ.rows[0].name;
        if (!lData.advancement) lData.advancement = {};
        if (!lData.advancement.marks) lData.advancement.marks = { earnedChecks: {}, totalBanked: 0, paths: {} };
        const prev = parseInt(lData.advancement.marks.totalBanked, 10) || 0;
        lData.advancement.marks.totalBanked = prev + review.share_count;
        await client.query('UPDATE characters SET character_data = $1 WHERE id = $2',
          [JSON.stringify(lData), review.linker_char_id]);
      }
    }

    await client.query(
      "UPDATE pending_mission_reviews SET status = 'approved', resolved_at = NOW() WHERE id = $1",
      [reviewId]
    );
    await client.query('COMMIT');

    console.info(
      '[mission-reviews] APPROVED review=' + reviewId +
      ' source=' + review.source_char_id + '(' + sourceQ.rows[0].name + ')' +
      ' linker=' + (review.linker_char_id ? review.linker_char_id + '(' + (linkerName || '?') + ')/' + review.linker_destiny_id : 'none') +
      ' shareCount=' + review.share_count
    );

    const io = req.app.get('io');
    _emitToCharacter(io, review.source_char_id, 'missionReview:approved', { reviewId: reviewId });
    if (review.linker_char_id && review.share_count > 0) {
      _emitToCharacter(io, review.linker_char_id, 'linkedShare:received', {
        reviewId: reviewId,
        linkerCharId: review.linker_char_id,
        sourceCharId: review.source_char_id,
        sourceName: sourceQ.rows[0].name,
        shareCount: review.share_count,
        count: review.share_count,
        destinyId: review.linker_destiny_id
      });
    }
    if (io) io.to('gm').emit('missionReview:resolved', { reviewId: reviewId, status: 'approved' });
    // Trigger advancement panel refresh on the GM party monitor.
    if (io) io.emit('advancement:sync', { characterId: review.source_char_id, advancement: newAdv });

    return res.json({ ok: true, status: 'approved' });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('[PUT /mission-reviews/approve]', err);
    return res.status(500).json({ error: 'Failed to approve review.' });
  } finally {
    client.release();
  }
});

// PUT /api/mission-reviews/:reviewId/reject — GM only.
router.put('/mission-reviews/:reviewId/reject', _requireGm, async (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (!Number.isFinite(reviewId)) return res.status(400).json({ error: 'Invalid review id.' });
  const note = (req.body && typeof req.body.gm_note === 'string') ? req.body.gm_note.slice(0, 500) : '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the row and require status='pending' so a concurrent approve cannot be
    // overwritten by a stale reject.
    const r = await client.query(
      "SELECT id, source_char_id, status FROM pending_mission_reviews WHERE id = $1 FOR UPDATE",
      [reviewId]
    );
    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Review not found.' });
    }
    if (r.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Review already resolved.' });
    }

    const upd = await client.query(
      "UPDATE pending_mission_reviews SET status = 'rejected', gm_note = $1, resolved_at = NOW() WHERE id = $2 AND status = 'pending'",
      [note || null, reviewId]
    );
    if (upd.rowCount !== 1) {
      // Lost the race despite the FOR UPDATE — extremely unlikely, but bail safely.
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Review state changed concurrently.' });
    }
    await client.query('COMMIT');

    console.info('[mission-reviews] REJECTED review=' + reviewId + ' source=' + r.rows[0].source_char_id + ' note="' + (note || '').replace(/"/g, "'") + '"');

    const io = req.app.get('io');
    _emitToCharacter(io, r.rows[0].source_char_id, 'missionReview:rejected', {
      reviewId: reviewId,
      gmNote: note || ''
    });
    if (io) io.to('gm').emit('missionReview:resolved', { reviewId: reviewId, status: 'rejected' });

    return res.json({ ok: true, status: 'rejected' });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('[PUT /mission-reviews/reject]', err);
    return res.status(500).json({ error: 'Failed to reject review.' });
  } finally {
    client.release();
  }
});

// Player-callable: GET pending review for the authenticated character (used by the
// Field Report overlay to survive page reloads).
router.get('/characters/:id/pending-mission-review', _requirePlayerOrGm, async (req, res) => {
  const charId = parseInt(req.params.id, 10);
  if (!Number.isFinite(charId)) return res.status(400).json({ error: 'Invalid character id.' });
  const ownership = await _verifyCharOwnership(req, charId);
  if (ownership) return res.status(ownership.status).json({ error: ownership.error });
  try {
    const r = await pool.query(
      "SELECT id, status, gm_note, created_at FROM pending_mission_reviews WHERE source_char_id = $1 AND status = 'pending'",
      [charId]
    );
    if (r.rows.length === 0) return res.json({ ok: true, pending: null });
    return res.json({
      ok: true,
      pending: { reviewId: r.rows[0].id, status: r.rows[0].status, createdAt: r.rows[0].created_at }
    });
  } catch (err) {
    console.error('[GET /pending-mission-review]', err);
    return res.status(500).json({ error: 'Failed to load pending review.' });
  }
});

module.exports = router;

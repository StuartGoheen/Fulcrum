const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const VALID_PARENTS = ['journal', 'dramatis'];
const MAX_BODY_LEN = 4000;

// Resolve the authoritative character name for the requesting player.
// GM is trusted by role and may pass an explicit `as_character` to act as one.
// Players MUST supply player_token + character_id; we validate against sessions.
async function resolveActor(req, opts) {
  opts = opts || {};
  const isGm = req.userRole === 'gm';
  if (isGm) {
    const asChar = String((opts.source && opts.source.as_character) || '').trim();
    return { isGm: true, characterName: asChar || null };
  }
  const src = opts.source || {};
  const playerToken = String(src.player_token || '').trim();
  const characterId = parseInt(src.character_id, 10);
  if (!playerToken || !Number.isFinite(characterId)) {
    return { isGm: false, characterName: null, error: 'player_token and character_id required' };
  }
  const r = await pool.query(
    `SELECT c.name FROM sessions s
     JOIN characters c ON c.id = s.character_id
     WHERE s.player_token = $1 AND s.character_id = $2`,
    [playerToken, characterId]
  );
  if (!r.rows.length) {
    return { isGm: false, characterName: null, error: 'invalid player_token for this character' };
  }
  return { isGm: false, characterName: r.rows[0].name };
}

// Returns null if visible, otherwise an HTTP-style {status, error}.
async function checkJournalVisibility(parentId, actor) {
  const idNum = parseInt(parentId, 10);
  if (!Number.isFinite(idNum)) return { status: 400, error: 'invalid parent_id' };
  const r = await pool.query(
    `SELECT visibility, author_character_name FROM journal_entries WHERE id = $1`,
    [idNum]
  );
  if (!r.rows.length) return { status: 404, error: 'parent not found' };
  const entry = r.rows[0];
  if (entry.visibility === 'crew') return null;
  if (actor.isGm) return null;
  if (!actor.characterName || actor.characterName !== entry.author_character_name) {
    return { status: 403, error: 'forbidden' };
  }
  return null;
}

// GET /api/comments?parent_type=&parent_id=&player_token=&character_id=
router.get('/comments', async (req, res) => {
  const parentType = String(req.query.parent_type || '').trim();
  const parentId   = String(req.query.parent_id   || '').trim();
  if (!VALID_PARENTS.includes(parentType)) return res.status(400).json({ error: 'invalid parent_type' });
  if (!parentId) return res.status(400).json({ error: 'parent_id required' });

  try {
    // For dramatis (shared knowledge) we still resolve actor so we can return self/other,
    // but we do not require it (any authed user may read).
    const actor = await resolveActor(req, { source: req.query });

    if (parentType === 'journal') {
      // Journal reads must be authenticated as the author for private entries
      if (!actor.isGm && actor.error) {
        // For private entries this is required; for crew entries it is fine.
        // Do the visibility check first to decide.
      }
      const vis = await checkJournalVisibility(parentId, actor);
      if (vis) return res.status(vis.status).json({ error: vis.error });
    }

    const r = await pool.query(
      `SELECT id, parent_type, parent_id, author_character_name, body, created_at, updated_at
       FROM entry_comments
       WHERE parent_type = $1 AND parent_id = $2
       ORDER BY created_at ASC`,
      [parentType, parentId]
    );
    res.json({ comments: r.rows });
  } catch (e) {
    console.error('[GET /comments]', e);
    res.status(500).json({ error: 'failed to load comments' });
  }
});

// POST /api/comments { parent_type, parent_id, player_token, character_id, body }
router.post('/comments', async (req, res) => {
  const body = (req.body || {});
  const parentType = String(body.parent_type || '').trim();
  const parentId   = String(body.parent_id   || '').trim();
  const text       = String(body.body        || '').trim();
  if (!VALID_PARENTS.includes(parentType)) return res.status(400).json({ error: 'invalid parent_type' });
  if (!parentId) return res.status(400).json({ error: 'parent_id required' });
  if (!text)     return res.status(400).json({ error: 'comment body required' });
  if (text.length > MAX_BODY_LEN) return res.status(400).json({ error: 'comment too long' });

  try {
    const actor = await resolveActor(req, { source: body });
    if (!actor.isGm && actor.error) return res.status(403).json({ error: actor.error });
    if (!actor.characterName) return res.status(400).json({ error: 'GM must specify as_character to comment' });

    if (parentType === 'journal') {
      const vis = await checkJournalVisibility(parentId, actor);
      if (vis) return res.status(vis.status).json({ error: vis.error });
    }

    const r = await pool.query(
      `INSERT INTO entry_comments (parent_type, parent_id, author_character_name, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, parent_type, parent_id, author_character_name, body, created_at, updated_at`,
      [parentType, parentId, actor.characterName, text]
    );

    // Notify clients to re-fetch (re-fetch path enforces visibility per viewer).
    // Do NOT broadcast comment body globally — private entries would leak.
    const io = req.app.get('io');
    if (io) io.emit('comment:added', { parentType, parentId, commentId: r.rows[0].id });

    res.json({ comment: r.rows[0] });
  } catch (e) {
    console.error('[POST /comments]', e);
    res.status(500).json({ error: 'failed to add comment' });
  }
});

// DELETE /api/comments/:id?player_token=&character_id=
router.delete('/comments/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const actor = await resolveActor(req, { source: req.query });
    const r = await pool.query(`SELECT author_character_name, parent_type, parent_id FROM entry_comments WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'comment not found' });
    const c = r.rows[0];
    if (!actor.isGm) {
      if (actor.error) return res.status(403).json({ error: actor.error });
      if (actor.characterName !== c.author_character_name) {
        return res.status(403).json({ error: 'only the author can delete this comment' });
      }
    }
    await pool.query(`DELETE FROM entry_comments WHERE id = $1`, [id]);
    const io = req.app.get('io');
    if (io) io.emit('comment:deleted', { parentType: c.parent_type, parentId: c.parent_id, commentId: id });
    res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /comments/:id]', e);
    res.status(500).json({ error: 'failed to delete comment' });
  }
});

// PUT /api/comments/:id { body, player_token, character_id }
router.put('/comments/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = (req.body || {});
  const text = String(body.body || '').trim();
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  if (!text) return res.status(400).json({ error: 'body required' });
  if (text.length > MAX_BODY_LEN) return res.status(400).json({ error: 'comment too long' });
  try {
    const actor = await resolveActor(req, { source: body });
    const r = await pool.query(`SELECT author_character_name, parent_type, parent_id FROM entry_comments WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'comment not found' });
    const existing = r.rows[0];
    if (!actor.isGm) {
      if (actor.error) return res.status(403).json({ error: actor.error });
      if (actor.characterName !== existing.author_character_name) {
        return res.status(403).json({ error: 'only the author can edit this comment' });
      }
    }
    const u = await pool.query(
      `UPDATE entry_comments SET body = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, parent_type, parent_id, author_character_name, body, created_at, updated_at`,
      [text, id]
    );
    const io = req.app.get('io');
    if (io) io.emit('comment:updated', { parentType: existing.parent_type, parentId: existing.parent_id, commentId: id });
    res.json({ comment: u.rows[0] });
  } catch (e) {
    console.error('[PUT /comments/:id]', e);
    res.status(500).json({ error: 'failed to update comment' });
  }
});

module.exports = router;

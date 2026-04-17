const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const VALID_PARENTS = ['journal', 'dramatis'];
const MAX_BODY_LEN = 4000;

// GET /api/comments?parent_type=journal&parent_id=42&viewer=Bob
//   - For journal: only returns comments if viewer can see the parent entry
//     (crew entry → all comments visible; private entry → only the author can fetch)
//   - For dramatis: all comments visible to all (shared knowledge among the crew)
router.get('/comments', async (req, res) => {
  const parentType = String(req.query.parent_type || '').trim();
  const parentId   = String(req.query.parent_id   || '').trim();
  const viewer     = String(req.query.viewer      || '').trim();
  if (!VALID_PARENTS.includes(parentType)) return res.status(400).json({ error: 'invalid parent_type' });
  if (!parentId) return res.status(400).json({ error: 'parent_id required' });

  try {
    if (parentType === 'journal') {
      const idNum = parseInt(parentId, 10);
      if (!Number.isFinite(idNum)) return res.status(400).json({ error: 'invalid parent_id' });
      const entryR = await pool.query(
        `SELECT visibility, author_character_name FROM journal_entries WHERE id = $1`,
        [idNum]
      );
      if (!entryR.rows.length) return res.status(404).json({ error: 'parent not found' });
      const entry = entryR.rows[0];
      if (entry.visibility !== 'crew') {
        // private entry: viewer must be the author of the entry
        if (!viewer || viewer !== entry.author_character_name) {
          return res.json({ comments: [] });
        }
      }
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

// POST /api/comments { parent_type, parent_id, author_character_name, body }
router.post('/comments', async (req, res) => {
  const parentType = String((req.body && req.body.parent_type) || '').trim();
  const parentId   = String((req.body && req.body.parent_id)   || '').trim();
  const author     = String((req.body && req.body.author_character_name) || '').trim();
  const body       = String((req.body && req.body.body)        || '').trim();
  if (!VALID_PARENTS.includes(parentType)) return res.status(400).json({ error: 'invalid parent_type' });
  if (!parentId) return res.status(400).json({ error: 'parent_id required' });
  if (!author)   return res.status(400).json({ error: 'author required' });
  if (!body)     return res.status(400).json({ error: 'comment body required' });
  if (body.length > MAX_BODY_LEN) return res.status(400).json({ error: 'comment too long' });

  try {
    if (parentType === 'journal') {
      const idNum = parseInt(parentId, 10);
      if (!Number.isFinite(idNum)) return res.status(400).json({ error: 'invalid parent_id' });
      const entryR = await pool.query(
        `SELECT visibility, author_character_name FROM journal_entries WHERE id = $1`,
        [idNum]
      );
      if (!entryR.rows.length) return res.status(404).json({ error: 'parent not found' });
      const entry = entryR.rows[0];
      if (entry.visibility !== 'crew' && author !== entry.author_character_name) {
        return res.status(403).json({ error: 'cannot comment on a private entry you do not own' });
      }
    }
    const r = await pool.query(
      `INSERT INTO entry_comments (parent_type, parent_id, author_character_name, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, parent_type, parent_id, author_character_name, body, created_at, updated_at`,
      [parentType, parentId, author, body]
    );
    const io = req.app.get('io');
    if (io) io.emit('comment:added', { parentType, parentId, comment: r.rows[0] });
    res.json({ comment: r.rows[0] });
  } catch (e) {
    console.error('[POST /comments]', e);
    res.status(500).json({ error: 'failed to add comment' });
  }
});

// DELETE /api/comments/:id?author=Bob
//   author must match (or GM, but GM control is enforced via the broader admin layer)
router.delete('/comments/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const author = String(req.query.author || '').trim();
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const r = await pool.query(`SELECT author_character_name, parent_type, parent_id FROM entry_comments WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'comment not found' });
    const c = r.rows[0];
    // GM cookie bypass: gate.js sets req.userRole = 'gm' for GMs
    const isGm = req.userRole === 'gm';
    if (!isGm && (!author || author !== c.author_character_name)) {
      return res.status(403).json({ error: 'only the author can delete this comment' });
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

// PUT /api/comments/:id { body, author }
router.put('/comments/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body   = String((req.body && req.body.body)   || '').trim();
  const author = String((req.body && req.body.author) || '').trim();
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  if (!body) return res.status(400).json({ error: 'body required' });
  if (body.length > MAX_BODY_LEN) return res.status(400).json({ error: 'comment too long' });
  try {
    const r = await pool.query(`SELECT author_character_name FROM entry_comments WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'comment not found' });
    const isGm = req.userRole === 'gm';
    if (!isGm && (!author || author !== r.rows[0].author_character_name)) {
      return res.status(403).json({ error: 'only the author can edit this comment' });
    }
    const u = await pool.query(
      `UPDATE entry_comments SET body = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, parent_type, parent_id, author_character_name, body, created_at, updated_at`,
      [body, id]
    );
    const io = req.app.get('io');
    if (io) io.emit('comment:updated', { comment: u.rows[0] });
    res.json({ comment: u.rows[0] });
  } catch (e) {
    console.error('[PUT /comments/:id]', e);
    res.status(500).json({ error: 'failed to update comment' });
  }
});

module.exports = router;

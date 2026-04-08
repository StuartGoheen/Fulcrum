const express = require('express');
const router = express.Router();
const { pool } = require('../db');

function requireGM(req, res, next) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required' });
  next();
}

router.get('/galaxy-pins', requireGM, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM galaxy_pins ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('[galaxy-pins] GET error:', err);
    res.status(500).json({ error: 'Failed to load pins' });
  }
});

router.post('/galaxy-pins', requireGM, async (req, res) => {
  try {
    const { title, note, x, y, pin_type } = req.body;
    if (!title || x == null || y == null) {
      return res.status(400).json({ error: 'title, x, y required' });
    }
    const result = await pool.query(
      'INSERT INTO galaxy_pins (title, note, x, y, pin_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, note || '', x, y, pin_type || 'custom']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[galaxy-pins] POST error:', err);
    res.status(500).json({ error: 'Failed to create pin' });
  }
});

router.put('/galaxy-pins/:id', requireGM, async (req, res) => {
  try {
    const { title, note, pin_type } = req.body;
    const result = await pool.query(
      'UPDATE galaxy_pins SET title = COALESCE($1, title), note = COALESCE($2, note), pin_type = COALESCE($3, pin_type), updated_at = NOW() WHERE id = $4 RETURNING *',
      [title, note, pin_type, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pin not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[galaxy-pins] PUT error:', err);
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

router.delete('/galaxy-pins/:id', requireGM, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM galaxy_pins WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pin not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[galaxy-pins] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete pin' });
  }
});

module.exports = router;

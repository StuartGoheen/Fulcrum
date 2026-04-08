const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const GRID_CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'grid-config.json');
const GRID_DEFAULTS = { left: 0.214, top: 0.020, right: 0.689, bottom: 0.780 };

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
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ error: 'title must be a string under 200 chars' });
    }
    const nx = Number(x), ny = Number(y);
    if (isNaN(nx) || isNaN(ny) || nx < 0 || nx > 1 || ny < 0 || ny > 1) {
      return res.status(400).json({ error: 'x and y must be numbers between 0 and 1' });
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

router.get('/grid-config', requireGM, (req, res) => {
  try {
    if (fs.existsSync(GRID_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(GRID_CONFIG_PATH, 'utf-8'));
      return res.json(data);
    }
    res.json(GRID_DEFAULTS);
  } catch (err) {
    console.error('[grid-config] GET error:', err);
    res.json(GRID_DEFAULTS);
  }
});

router.put('/grid-config', requireGM, (req, res) => {
  try {
    const { left, top, right, bottom } = req.body;
    if (typeof left !== 'number' || typeof top !== 'number' ||
        typeof right !== 'number' || typeof bottom !== 'number') {
      return res.status(400).json({ error: 'All bounds must be numbers' });
    }
    if (left >= right || top >= bottom) {
      return res.status(400).json({ error: 'Invalid bounds' });
    }
    const config = { left, top, right, bottom };
    fs.writeFileSync(GRID_CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ saved: true, config });
  } catch (err) {
    console.error('[grid-config] PUT error:', err);
    res.status(500).json({ error: 'Failed to save grid config' });
  }
});

module.exports = router;

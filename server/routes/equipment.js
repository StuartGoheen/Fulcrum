const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

const VALID_STATUSES = new Set(['stowed', 'carried', 'equipped']);
const VALID_TYPES    = new Set(['weapon', 'armor', 'gear']);

router.get('/equipment/:charId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT item_id, item_type, status FROM equipment_status WHERE character_id = $1',
      [req.params.charId]
    );
    const result = {};
    rows.forEach(r => { result[r.item_id] = { status: r.status, itemType: r.item_type }; });
    res.json(result);
  } catch (err) {
    console.error('[GET /equipment]', err);
    res.status(500).json({ error: 'Failed to load equipment.' });
  }
});

router.post('/equipment/:charId/:itemId', async (req, res) => {
  const { charId, itemId } = req.params;
  const { status, itemType } = req.body;

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!VALID_TYPES.has(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType' });
  }

  try {
    await pool.query(`
      INSERT INTO equipment_status (character_id, item_id, item_type, status, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT(character_id, item_id) DO UPDATE SET
        status     = EXCLUDED.status,
        item_type  = EXCLUDED.item_type,
        updated_at = NOW()
    `, [charId, itemId, itemType, status]);

    res.json({ ok: true, charId, itemId, status, itemType });
  } catch (err) {
    console.error('[POST /equipment]', err);
    res.status(500).json({ error: 'Failed to update equipment.' });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_STATUSES = new Set(['stowed', 'carried', 'equipped']);
const VALID_TYPES    = new Set(['weapon', 'armor', 'gear']);

router.get('/equipment/:charId', (req, res) => {
  const rows = db.prepare(
    'SELECT item_id, item_type, status FROM equipment_status WHERE character_id = ?'
  ).all(req.params.charId);

  const result = {};
  rows.forEach(r => { result[r.item_id] = { status: r.status, itemType: r.item_type }; });
  res.json(result);
});

router.post('/equipment/:charId/:itemId', (req, res) => {
  const { charId, itemId } = req.params;
  const { status, itemType } = req.body;

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!VALID_TYPES.has(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType' });
  }

  db.prepare(`
    INSERT INTO equipment_status (character_id, item_id, item_type, status, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(character_id, item_id) DO UPDATE SET
      status     = excluded.status,
      item_type  = excluded.item_type,
      updated_at = CURRENT_TIMESTAMP
  `).run(charId, itemId, itemType, status);

  res.json({ ok: true, charId, itemId, status, itemType });
});

module.exports = router;

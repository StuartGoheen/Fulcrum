const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.post('/item-requests', (req, res) => {
  const { characterName, itemName, description, referenceUrl } = req.body;
  if (!characterName || !itemName) {
    return res.status(400).json({ error: 'characterName and itemName are required.' });
  }
  const stmt = db.prepare(
    `INSERT INTO item_requests (character_name, item_name, description, reference_url)
     VALUES (?, ?, ?, ?)`
  );
  const result = stmt.run(characterName, itemName, description || null, referenceUrl || null);
  res.json({ id: result.lastInsertRowid, status: 'pending' });
});

router.get('/item-requests', (req, res) => {
  const status = req.query.status;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM item_requests WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM item_requests ORDER BY created_at DESC').all();
  }
  res.json({ requests: rows });
});

router.put('/item-requests/:id', (req, res) => {
  const { status, gmNotes } = req.body;
  const valid = ['pending', 'approved', 'denied', 'converted'];
  if (status && !valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: ' + valid.join(', ') });
  }

  const existing = db.prepare('SELECT * FROM item_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Request not found.' });

  const newStatus = status || existing.status;
  const newNotes = gmNotes !== undefined ? gmNotes : existing.gm_notes;

  db.prepare(
    `UPDATE item_requests SET status = ?, gm_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(newStatus, newNotes, req.params.id);

  const updated = db.prepare('SELECT * FROM item_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/item-requests/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM item_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Request not found.' });
  db.prepare('DELETE FROM item_requests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

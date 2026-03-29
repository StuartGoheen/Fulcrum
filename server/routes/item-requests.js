const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

router.post('/item-requests', async (req, res) => {
  const { characterName, itemName, description, referenceUrl } = req.body;
  if (!characterName || !itemName) {
    return res.status(400).json({ error: 'characterName and itemName are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO item_requests (character_name, item_name, description, reference_url)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [characterName, itemName, description || null, referenceUrl || null]
    );
    res.json({ id: result.rows[0].id, status: 'pending' });
  } catch (err) {
    console.error('[POST /item-requests]', err);
    res.status(500).json({ error: 'Failed to create request.' });
  }
});

router.get('/item-requests', async (req, res) => {
  try {
    const status = req.query.status;
    let result;
    if (status) {
      result = await pool.query('SELECT * FROM item_requests WHERE status = $1 ORDER BY created_at DESC', [status]);
    } else {
      result = await pool.query('SELECT * FROM item_requests ORDER BY created_at DESC');
    }
    res.json({ requests: result.rows });
  } catch (err) {
    console.error('[GET /item-requests]', err);
    res.status(500).json({ error: 'Failed to load requests.' });
  }
});

router.put('/item-requests/:id', async (req, res) => {
  const { status, gmNotes } = req.body;
  const valid = ['pending', 'approved', 'denied', 'converted'];
  if (status && !valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: ' + valid.join(', ') });
  }

  try {
    const existing = await pool.query('SELECT * FROM item_requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found.' });

    const ex = existing.rows[0];
    const newStatus = status || ex.status;
    const newNotes = gmNotes !== undefined ? gmNotes : ex.gm_notes;

    await pool.query(
      `UPDATE item_requests SET status = $1, gm_notes = $2, updated_at = NOW() WHERE id = $3`,
      [newStatus, newNotes, req.params.id]
    );

    const updated = await pool.query('SELECT * FROM item_requests WHERE id = $1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('[PUT /item-requests]', err);
    res.status(500).json({ error: 'Failed to update request.' });
  }
});

router.delete('/item-requests/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM item_requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found.' });
    await pool.query('DELETE FROM item_requests WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /item-requests]', err);
    res.status(500).json({ error: 'Failed to delete request.' });
  }
});

module.exports = router;

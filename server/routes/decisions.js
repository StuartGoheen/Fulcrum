const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

router.get('/decisions', async (req, res) => {
  try {
    const { adventure_id, scene_id } = req.query;
    let query = 'SELECT * FROM campaign_decisions';
    const params = [];
    const conditions = [];
    if (adventure_id) {
      params.push(adventure_id);
      conditions.push('adventure_id = $' + params.length);
    }
    if (scene_id) {
      params.push(scene_id);
      conditions.push('scene_id = $' + params.length);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at ASC';
    const result = await pool.query(query, params);
    res.json({ decisions: result.rows });
  } catch (err) {
    console.error('[GET /decisions]', err);
    res.status(500).json({ error: 'Failed to load decisions.' });
  }
});

router.post('/decisions', async (req, res) => {
  const { scene_id, adventure_id, decision_key, choice, outcome, campaign_impact, voted } = req.body;
  if (!adventure_id || !decision_key || !choice) {
    return res.status(400).json({ error: 'adventure_id, decision_key, and choice are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO campaign_decisions (scene_id, adventure_id, decision_key, choice, outcome, campaign_impact, voted)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [scene_id || null, adventure_id, decision_key, choice, outcome || null, campaign_impact || null, voted || false]
    );
    res.json({ decision: result.rows[0] });
  } catch (err) {
    console.error('[POST /decisions]', err);
    res.status(500).json({ error: 'Failed to record decision.' });
  }
});

router.put('/decisions/:id', async (req, res) => {
  const { id } = req.params;
  const { choice, outcome, campaign_impact } = req.body;
  try {
    const result = await pool.query(
      `UPDATE campaign_decisions SET choice = COALESCE($1, choice), outcome = COALESCE($2, outcome), campaign_impact = COALESCE($3, campaign_impact) WHERE id = $4 RETURNING *`,
      [choice || null, outcome || null, campaign_impact || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Decision not found.' });
    res.json({ decision: result.rows[0] });
  } catch (err) {
    console.error('[PUT /decisions]', err);
    res.status(500).json({ error: 'Failed to update decision.' });
  }
});

router.delete('/decisions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM campaign_decisions WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Decision not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /decisions]', err);
    res.status(500).json({ error: 'Failed to delete decision.' });
  }
});

module.exports = router;

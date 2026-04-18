const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { resolveDecisionState, loadRegistry } = require('../utils/decision-resolver');

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

router.get('/decisions/state', async (req, res) => {
  try {
    const state = await resolveDecisionState();
    const registry = loadRegistry();
    res.json({ state, registry });
  } catch (err) {
    console.error('[GET /decisions/state]', err);
    res.status(500).json({ error: 'Failed to resolve decision state.' });
  }
});

router.post('/decisions', async (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  const {
    scene_id, adventure_id, decision_key, choice, outcome,
    campaign_impact, voted, decision_point_id, option_key,
    impact_value, gm_notes, auto_notes, vote_data, impacts
  } = req.body;
  if (!adventure_id || !decision_key || !choice) {
    return res.status(400).json({ error: 'adventure_id, decision_key, and choice are required.' });
  }
  try {
    const impactsArr = Array.isArray(impacts) ? impacts.filter(i => i && i.key && i.value != null) : [];
    const legacyKey = campaign_impact || (impactsArr[0] && impactsArr[0].key) || null;
    const legacyVal = impact_value || (impactsArr[0] && impactsArr[0].value) || null;
    const result = await pool.query(
      `INSERT INTO campaign_decisions
       (scene_id, adventure_id, decision_key, choice, outcome, campaign_impact, voted,
        decision_point_id, option_key, impact_value, gm_notes, auto_notes, vote_data, impacts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        scene_id || null, adventure_id, decision_key, choice,
        outcome || null, legacyKey, voted || false,
        decision_point_id || null, option_key || null, legacyVal,
        gm_notes || null, auto_notes || null,
        vote_data ? JSON.stringify(vote_data) : null,
        impactsArr.length ? JSON.stringify(impactsArr) : null
      ]
    );
    if (scene_id) {
      try {
        const { regenerateSceneJournalEntry } = require('./journal');
        await regenerateSceneJournalEntry(scene_id);
      } catch (e) { console.error('[POST /decisions] regen journal failed:', e.message); }
    }
    res.json({ decision: result.rows[0] });
  } catch (err) {
    console.error('[POST /decisions]', err);
    res.status(500).json({ error: 'Failed to record decision.' });
  }
});

router.put('/decisions/:id', async (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  const { id } = req.params;
  const { choice, outcome, campaign_impact, gm_notes, auto_notes, impact_value, option_key, impacts } = req.body;
  try {
    const impactsArr = Array.isArray(impacts) ? impacts.filter(i => i && i.key && i.value != null) : null;
    const result = await pool.query(
      `UPDATE campaign_decisions SET
        choice = COALESCE($1, choice),
        outcome = COALESCE($2, outcome),
        campaign_impact = COALESCE($3, campaign_impact),
        gm_notes = COALESCE($4, gm_notes),
        auto_notes = COALESCE($5, auto_notes),
        impact_value = COALESCE($6, impact_value),
        option_key = COALESCE($7, option_key),
        impacts = COALESCE($8::jsonb, impacts)
       WHERE id = $9 RETURNING *`,
      [choice || null, outcome || null, campaign_impact || null,
       gm_notes || null, auto_notes || null, impact_value || null,
       option_key || null,
       impactsArr ? JSON.stringify(impactsArr) : null,
       id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Decision not found.' });
    res.json({ decision: result.rows[0] });
  } catch (err) {
    console.error('[PUT /decisions]', err);
    res.status(500).json({ error: 'Failed to update decision.' });
  }
});

router.delete('/decisions/:id', async (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
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

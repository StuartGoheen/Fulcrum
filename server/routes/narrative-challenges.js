const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const CHALLENGES_DIR = path.join(__dirname, '..', '..', 'data', 'narrative-challenges');

function gmOnly(req, res, next) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'Forbidden' });
  next();
}

let challengesCache = null;
let challengesCacheMtime = 0;

function loadChallenges() {
  try {
    const stat = fs.statSync(CHALLENGES_DIR);
    const mtime = stat.mtimeMs;
    if (challengesCache && mtime <= challengesCacheMtime) return challengesCache;
  } catch (e) {}

  const files = fs.readdirSync(CHALLENGES_DIR).filter(f => f.endsWith('.json'));
  const challenges = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(CHALLENGES_DIR, f), 'utf8').trim();
      if (content) challenges.push(JSON.parse(content));
    } catch (e) {
      console.error('[narrative-challenges] Failed to parse', f, e.message);
    }
  }
  challengesCache = challenges;
  challengesCacheMtime = Date.now();
  return challenges;
}

const SPECTRUM_ORDER = ['Two Dark', 'Light & Dark', 'Two Light'];

function computeShiftValue(gmScore) {
  const s = parseInt(gmScore, 10);
  if (s === 1) return -1;
  if (s === 5) return 1;
  return 0;
}

function applySpectrumShift(currentSpectrum, shiftValue) {
  if (shiftValue === 0) return currentSpectrum;
  const idx = SPECTRUM_ORDER.indexOf(currentSpectrum);
  if (idx === -1) return currentSpectrum;
  const newIdx = Math.max(0, Math.min(SPECTRUM_ORDER.length - 1, idx + shiftValue));
  return SPECTRUM_ORDER[newIdx];
}

router.get('/narrative-challenges', (req, res) => {
  try {
    const challenges = loadChallenges();
    const list = challenges.map(c => ({
      id: c.id,
      name: c.name,
      destiny: c.destiny,
      category: c.category,
      description: c.description,
      hopePole: c.hopePole,
      tollPole: c.tollPole,
      roundCount: (c.rounds || []).length
    }));
    res.json({ challenges: list });
  } catch (err) {
    console.error('[GET /narrative-challenges]', err);
    res.status(500).json({ error: 'Failed to load challenges' });
  }
});

router.get('/narrative-challenges/:id', (req, res) => {
  try {
    const challenges = loadChallenges();
    const challenge = challenges.find(c => c.id === req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    res.json(challenge);
  } catch (err) {
    console.error('[GET /narrative-challenges/:id]', err);
    res.status(500).json({ error: 'Failed to load challenge' });
  }
});

router.get('/narrative-challenges/by-destiny/:destinyId', (req, res) => {
  try {
    const challenges = loadChallenges();
    const matching = challenges.filter(c => c.destiny === req.params.destinyId);
    res.json({ challenges: matching });
  } catch (err) {
    console.error('[GET /narrative-challenges/by-destiny/:destinyId]', err);
    res.status(500).json({ error: 'Failed to load challenges' });
  }
});

router.post('/narrative-challenges/instances', gmOnly, async (req, res) => {
  const { challenge_id, character_id, adventure_id, scene_id } = req.body;
  if (!challenge_id || !character_id) {
    return res.status(400).json({ error: 'challenge_id and character_id are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO narrative_challenge_instances
       (challenge_id, character_id, adventure_id, scene_id, choices, status)
       VALUES ($1, $2, $3, $4, '[]', 'active')
       RETURNING *`,
      [challenge_id, character_id, adventure_id || null, scene_id || null]
    );
    res.json({ instance: result.rows[0] });
  } catch (err) {
    console.error('[POST /narrative-challenges/instances]', err);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

router.get('/narrative-challenges/instances/active', async (req, res) => {
  const { adventure_id, scene_id } = req.query;
  try {
    let query = `SELECT nci.*, c.name as character_name, c.character_data
                 FROM narrative_challenge_instances nci
                 JOIN characters c ON c.id = nci.character_id
                 WHERE nci.status IN ('active', 'scored')`;
    const params = [];
    if (adventure_id) {
      params.push(adventure_id);
      query += ` AND nci.adventure_id = $${params.length}`;
    }
    if (scene_id) {
      params.push(scene_id);
      query += ` AND nci.scene_id = $${params.length}`;
    }
    query += ' ORDER BY nci.created_at ASC';
    const result = await pool.query(query, params);
    res.json({ instances: result.rows });
  } catch (err) {
    console.error('[GET /narrative-challenges/instances/active]', err);
    res.status(500).json({ error: 'Failed to load instances' });
  }
});

router.put('/narrative-challenges/instances/:id/choice', gmOnly, async (req, res) => {
  const { id } = req.params;
  const { round_id, choice_id } = req.body;
  if (!round_id || !choice_id) {
    return res.status(400).json({ error: 'round_id and choice_id are required' });
  }
  try {
    const existing = await pool.query(
      'SELECT choices FROM narrative_challenge_instances WHERE id = $1 AND status = $2',
      [id, 'active']
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Active instance not found' });
    }
    let choices = [];
    try { choices = JSON.parse(existing.rows[0].choices || '[]'); } catch (_) {}
    choices = choices.filter(c => c.round_id !== round_id);
    choices.push({ round_id, choice_id, recorded_at: new Date().toISOString() });

    await pool.query(
      'UPDATE narrative_challenge_instances SET choices = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(choices), id]
    );
    res.json({ success: true, choices });
  } catch (err) {
    console.error('[PUT /narrative-challenges/instances/:id/choice]', err);
    res.status(500).json({ error: 'Failed to record choice' });
  }
});

router.put('/narrative-challenges/instances/:id/score', gmOnly, async (req, res) => {
  const { id } = req.params;
  const { gm_score } = req.body;
  const score = parseInt(gm_score, 10);
  if (isNaN(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: 'gm_score must be 1-5' });
  }
  try {
    const shiftValue = computeShiftValue(score);

    const updated = await pool.query(
      `UPDATE narrative_challenge_instances
       SET gm_score = $1, shift_value = $2, status = 'scored', updated_at = NOW()
       WHERE id = $3 AND status = 'active'
       RETURNING *`,
      [score, shiftValue, id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Active instance not found' });
    }
    res.json({ instance: updated.rows[0], shiftValue });
  } catch (err) {
    console.error('[PUT /narrative-challenges/instances/:id/score]', err);
    res.status(500).json({ error: 'Failed to score instance' });
  }
});

router.post('/narrative-challenges/resolve', gmOnly, async (req, res) => {
  const { instance_ids } = req.body;
  if (!Array.isArray(instance_ids) || instance_ids.length === 0) {
    return res.status(400).json({ error: 'instance_ids array is required' });
  }

  try {
    const placeholders = instance_ids.map((_, i) => '$' + (i + 1)).join(',');
    const instResult = await pool.query(
      `SELECT nci.*, c.name as character_name, c.character_data
       FROM narrative_challenge_instances nci
       JOIN characters c ON c.id = nci.character_id
       WHERE nci.id IN (${placeholders}) AND nci.status = 'scored'`,
      instance_ids
    );

    if (instResult.rows.length === 0) {
      return res.status(400).json({ error: 'No scored instances found' });
    }

    const results = [];
    let partySum = 0;

    for (const inst of instResult.rows) {
      const shiftValue = inst.shift_value || 0;
      partySum += shiftValue;

      let charData = {};
      try { charData = JSON.parse(inst.character_data || '{}'); } catch (_) {}

      const oldSpectrum = charData.destiny || 'Light & Dark';
      const newSpectrum = applySpectrumShift(oldSpectrum, shiftValue);

      if (newSpectrum !== oldSpectrum) {
        charData.destiny = newSpectrum;
        await pool.query(
          'UPDATE characters SET character_data = $1 WHERE id = $2',
          [JSON.stringify(charData), inst.character_id]
        );
      }

      await pool.query(
        `UPDATE narrative_challenge_instances
         SET status = 'resolved', updated_at = NOW()
         WHERE id = $1`,
        [inst.id]
      );

      results.push({
        instanceId: inst.id,
        characterId: inst.character_id,
        characterName: inst.character_name,
        gmScore: inst.gm_score,
        shiftValue,
        oldSpectrum,
        newSpectrum,
        shifted: oldSpectrum !== newSpectrum
      });
    }

    let tokenOutcome;
    if (partySum === 0) {
      tokenOutcome = 'equilibrium';
    } else if (partySum > 0) {
      tokenOutcome = 'hope';
    } else {
      tokenOutcome = 'toll';
    }

    res.json({
      results,
      partySum,
      tokenOutcome,
      message: tokenOutcome === 'equilibrium'
        ? "Revan's Balance — ALL tokens untapped"
        : tokenOutcome === 'hope'
          ? 'Hope dominant — all Hope tokens untapped'
          : 'Toll dominant — all Toll tokens untapped'
    });
  } catch (err) {
    console.error('[POST /narrative-challenges/resolve]', err);
    res.status(500).json({ error: 'Failed to resolve challenge' });
  }
});

router.post('/narrative-challenges/apply-tokens', gmOnly, async (req, res) => {
  const { token_outcome } = req.body;
  if (!['hope', 'toll', 'equilibrium'].includes(token_outcome)) {
    return res.status(400).json({ error: 'token_outcome must be hope, toll, or equilibrium' });
  }

  try {
    const poolResult = await pool.query(
      "SELECT value FROM campaign_state WHERE key = 'destiny_pool'"
    );
    let destinyPool = [];
    if (poolResult.rows.length > 0) {
      try { destinyPool = JSON.parse(poolResult.rows[0].value); } catch (_) {}
    }

    let untapped = 0;
    for (const token of destinyPool) {
      if (!token.tapped) continue;
      if (token_outcome === 'equilibrium') {
        token.tapped = false;
        untapped++;
      } else if (token_outcome === 'hope' && token.side === 'hope') {
        token.tapped = false;
        untapped++;
      } else if (token_outcome === 'toll' && token.side === 'toll') {
        token.tapped = false;
        untapped++;
      }
    }

    await pool.query(
      `INSERT INTO campaign_state (key, value, updated_at)
       VALUES ('destiny_pool', $1, NOW())
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(destinyPool)]
    );

    res.json({ success: true, untapped, pool: destinyPool });
  } catch (err) {
    console.error('[POST /narrative-challenges/apply-tokens]', err);
    res.status(500).json({ error: 'Failed to apply token changes' });
  }
});

router.post('/narrative-challenges/journal', gmOnly, async (req, res) => {
  const { instance_ids, token_outcome, party_sum } = req.body;
  if (!Array.isArray(instance_ids) || instance_ids.length === 0) {
    return res.status(400).json({ error: 'instance_ids array is required' });
  }

  try {
    const placeholders = instance_ids.map((_, i) => '$' + (i + 1)).join(',');
    const instResult = await pool.query(
      `SELECT nci.*, c.name as character_name
       FROM narrative_challenge_instances nci
       JOIN characters c ON c.id = nci.character_id
       WHERE nci.id IN (${placeholders})`,
      instance_ids
    );

    const challenges = loadChallenges();
    const entries = [];

    for (const inst of instResult.rows) {
      const challenge = challenges.find(c => c.id === inst.challenge_id);
      if (!challenge) continue;

      let choices = [];
      try { choices = JSON.parse(inst.choices || '[]'); } catch (_) {}

      const bodyLines = [];
      bodyLines.push(`Challenge: ${challenge.name} (${challenge.destiny})`);
      bodyLines.push(`Destiny Scenario: ${challenge.description}`);
      bodyLines.push('');

      for (const choice of choices) {
        const round = (challenge.rounds || []).find(r => r.id === choice.round_id);
        if (!round) continue;
        const chosen = (round.choices || []).find(c => c.id === choice.choice_id);
        if (!chosen) continue;
        bodyLines.push(`Round: ${round.prompt.substring(0, 80)}...`);
        bodyLines.push(`Choice: ${chosen.label} [${chosen.alignment}]`);
        bodyLines.push('');
      }

      bodyLines.push('---');
      const scoreLabel = inst.gm_score === 5 ? 'Light' : inst.gm_score === 1 ? 'Dark' : 'Neutral';
      bodyLines.push(`GM Score: ${inst.gm_score}/5 (${scoreLabel})`);
      if (inst.shift_value > 0) bodyLines.push('Destiny Shift: Toward the Light');
      else if (inst.shift_value < 0) bodyLines.push('Destiny Shift: Toward the Dark');
      else bodyLines.push('Destiny Shift: Held steady');

      if (token_outcome) {
        bodyLines.push('');
        if (token_outcome === 'equilibrium') {
          bodyLines.push("Party Outcome: Revan's Balance — ALL tokens untapped");
        } else if (token_outcome === 'hope') {
          bodyLines.push('Party Outcome: Hope Dominant — Hope tokens untapped');
        } else {
          bodyLines.push('Party Outcome: Toll Dominant — Toll tokens untapped');
        }
        bodyLines.push(`Party Sum: ${party_sum || 0}`);
      }

      const title = `${challenge.name} — ${inst.character_name}`;
      const body = bodyLines.join('\n');
      const sceneTag = inst.scene_id ? inst.scene_id : (inst.adventure_id ? 'challenge:' + inst.adventure_id : 'challenge:' + inst.challenge_id);

      const entryResult = await pool.query(
        `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [title, body, inst.character_name, sceneTag]
      );
      entries.push({ id: entryResult.rows[0].id, title, characterName: inst.character_name });
    }

    res.json({ success: true, entries });
  } catch (err) {
    console.error('[POST /narrative-challenges/journal]', err);
    res.status(500).json({ error: 'Failed to create journal entries' });
  }
});

module.exports = router;

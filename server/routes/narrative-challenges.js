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

function autoCalcScore(challengeData, choicesJson) {
  if (!challengeData || !challengeData.rounds) return 3;
  let choices = [];
  try { choices = typeof choicesJson === 'string' ? JSON.parse(choicesJson || '[]') : (choicesJson || []); } catch (_) {}
  if (!choices.length) return 3;

  const alignScores = { light: 5, neutral: 3, dark: 1 };
  let total = 0;
  let count = 0;
  choices.forEach(c => {
    const round = challengeData.rounds.find(r => r.id === c.round_id);
    if (!round) return;
    const choice = (round.choices || []).find(ch => ch.id === c.choice_id);
    if (!choice) return;
    total += alignScores[choice.alignment] || 3;
    count++;
  });
  if (count === 0) return 3;
  return Math.round(total / count);
}

function applySpectrumShift(currentSpectrum, shiftValue) {
  if (shiftValue === 0) return currentSpectrum;
  const idx = SPECTRUM_ORDER.indexOf(currentSpectrum);
  if (idx === -1) return currentSpectrum;
  const newIdx = Math.max(0, Math.min(SPECTRUM_ORDER.length - 1, idx + shiftValue));
  return SPECTRUM_ORDER[newIdx];
}

async function autoResolveInstance(instanceId, challengeData, choices, io) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const score = autoCalcScore(challengeData, choices);
    const shiftValue = computeShiftValue(score);

    const lockResult = await client.query(
      `UPDATE narrative_challenge_instances
       SET gm_score = $1, shift_value = $2, status = 'resolved', updated_at = NOW()
       WHERE id = $3 AND status = 'active'
       RETURNING *`,
      [score, shiftValue, instanceId]
    );
    if (!lockResult.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }

    const instResult = await client.query(
      `SELECT c.name as character_name, c.character_data, c.id as character_id
       FROM characters c WHERE c.id = $1`,
      [lockResult.rows[0].character_id]
    );
    if (!instResult.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const inst = { ...lockResult.rows[0], ...instResult.rows[0] };

    let charData = {};
    try { charData = JSON.parse(inst.character_data || '{}'); } catch (_) {}
    const oldSpectrum = charData.destiny || 'Light & Dark';
    const newSpectrum = applySpectrumShift(oldSpectrum, shiftValue);

    if (newSpectrum !== oldSpectrum) {
      charData.destiny = newSpectrum;
      await client.query(
        'UPDATE characters SET character_data = $1 WHERE id = $2',
        [JSON.stringify(charData), inst.character_id]
      );
    }

    let tokenOutcome;
    if (shiftValue === 0) tokenOutcome = 'equilibrium';
    else if (shiftValue > 0) tokenOutcome = 'hope';
    else tokenOutcome = 'toll';

    const allCharResult = await client.query('SELECT id, character_data FROM characters');
    const destinyPool = [];
    for (const row of allCharResult.rows) {
      let cd = {};
      try { cd = JSON.parse(row.character_data || '{}'); } catch (_) {}
      const spectrum = cd.destiny || 'Light & Dark';
      if (spectrum === 'Two Light') {
        destinyPool.push({ side: 'hope', tapped: true }, { side: 'hope', tapped: true });
      } else if (spectrum === 'Two Dark') {
        destinyPool.push({ side: 'toll', tapped: true }, { side: 'toll', tapped: true });
      } else {
        destinyPool.push({ side: 'hope', tapped: true }, { side: 'toll', tapped: true });
      }
    }

    let untappedCount = 0;
    for (const token of destinyPool) {
      if (tokenOutcome === 'equilibrium') { token.tapped = false; untappedCount++; }
      else if (tokenOutcome === 'hope' && token.side === 'hope') { token.tapped = false; untappedCount++; }
      else if (tokenOutcome === 'toll' && token.side === 'toll') { token.tapped = false; untappedCount++; }
    }

    await client.query(
      `INSERT INTO campaign_state (key, value, updated_at)
       VALUES ('destiny_pool', $1, NOW())
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(destinyPool)]
    );

    const challenges = loadChallenges();
    const challenge = challenges.find(c => c.id === inst.challenge_id) || challengeData;

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
    const scoreLabel = score === 5 ? 'Light' : score === 1 ? 'Dark' : 'Neutral';
    bodyLines.push(`Score: ${score}/5 (${scoreLabel})`);
    if (oldSpectrum !== newSpectrum) {
      bodyLines.push(`Destiny Shift: ${oldSpectrum} → ${newSpectrum}`);
    } else {
      bodyLines.push('Destiny Shift: Held steady');
    }
    bodyLines.push('');
    if (tokenOutcome === 'equilibrium') bodyLines.push("Party Outcome: Revan's Balance — ALL tokens untapped");
    else if (tokenOutcome === 'hope') bodyLines.push('Party Outcome: Hope Dominant — Hope tokens untapped');
    else bodyLines.push('Party Outcome: Toll Dominant — Toll tokens untapped');

    const title = `${challenge.name} — ${inst.character_name}`;
    const body = bodyLines.join('\n');
    const sceneTag = inst.scene_id || (inst.adventure_id ? 'challenge:' + inst.adventure_id : 'challenge:' + inst.challenge_id);

    const entryResult = await client.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [title, body, inst.character_name, sceneTag]
    );

    await client.query('COMMIT');

    const result = {
      instanceId: inst.id,
      characterId: inst.character_id,
      characterName: inst.character_name,
      gmScore: score,
      shiftValue,
      oldSpectrum,
      newSpectrum,
      shifted: oldSpectrum !== newSpectrum,
      tokenOutcome,
      partySum: shiftValue,
      tokensUntapped: untappedCount,
      journalEntry: { id: entryResult.rows[0].id, title, characterName: inst.character_name }
    };

    if (io) {
      io.emit('destiny:sync', { pool: destinyPool, locked: false });

      const sockets = Array.from(io.sockets.sockets.values());
      sockets.forEach(s => {
        if (s.data.role === 'player' && String(s.data.characterId) === String(inst.character_id)) {
          s.emit('challenge:resolved', {
            tokenOutcome,
            partySum: shiftValue,
            characterResult: result
          });
        }
      });

      io.to('gm').emit('challenge:auto-resolved', result);
    }

    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[autoResolveInstance]', err);
    return null;
  } finally {
    client.release();
  }
}

router.get('/narrative-challenges', gmOnly, (req, res) => {
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

router.get('/narrative-challenges/by-destiny/:destinyId', gmOnly, (req, res) => {
  try {
    const challenges = loadChallenges();
    const matching = challenges.filter(c => c.destiny === req.params.destinyId);
    res.json({ challenges: matching });
  } catch (err) {
    console.error('[GET /narrative-challenges/by-destiny/:destinyId]', err);
    res.status(500).json({ error: 'Failed to load challenges' });
  }
});

router.get('/narrative-challenges/:id', gmOnly, (req, res) => {
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

function seededShuffle(arr, seed) {
  var a = arr.slice();
  var s = seed;
  for (var i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    var j = s % (i + 1);
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function shuffleChoicesForPlayer(challenge, seed) {
  if (!challenge || !challenge.rounds || seed == null) return challenge;
  var copy = JSON.parse(JSON.stringify(challenge));
  copy.rounds.forEach(function (round, ri) {
    round.choices = seededShuffle(round.choices, seed + ri);
    round.choices.forEach(function (ch) { delete ch.alignment; });
  });
  return copy;
}

router.post('/narrative-challenges/instances', gmOnly, async (req, res) => {
  const { challenge_id, character_id, adventure_id, scene_id } = req.body;
  if (!challenge_id || !character_id) {
    return res.status(400).json({ error: 'challenge_id and character_id are required' });
  }
  try {
    const shuffle_seed = Math.floor(Math.random() * 2147483646) + 1;
    const result = await pool.query(
      `INSERT INTO narrative_challenge_instances
       (challenge_id, character_id, adventure_id, scene_id, choices, status, shuffle_seed)
       VALUES ($1, $2, $3, $4, '[]', 'active', $5)
       RETURNING *`,
      [challenge_id, character_id, adventure_id || null, scene_id || null, shuffle_seed]
    );
    const inst = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      const challenges = loadChallenges();
      const challenge = challenges.find(c => c.id === challenge_id);
      const charResult = await pool.query('SELECT name FROM characters WHERE id = $1', [character_id]);
      const charName = charResult.rows.length ? charResult.rows[0].name : 'Unknown';

      const sockets = Array.from(io.sockets.sockets.values());
      const playerSocket = sockets.find(s => s.data.role === 'player' && String(s.data.characterId) === String(character_id));
      if (playerSocket && challenge) {
        const playerChallenge = shuffleChoicesForPlayer(challenge, shuffle_seed);
        playerSocket.emit('challenge:start', {
          instance: inst,
          challenge: playerChallenge,
          characterName: charName
        });
      }
    }

    res.json({ instance: inst });
  } catch (err) {
    console.error('[POST /narrative-challenges/instances]', err);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

router.get('/narrative-challenges/instances/active', gmOnly, async (req, res) => {
  try {
    await pool.query(
      `UPDATE narrative_challenge_instances
       SET status = 'abandoned', updated_at = NOW()
       WHERE status = 'active' AND updated_at < NOW() - INTERVAL '24 hours'`
    );

    const result = await pool.query(
      `SELECT nci.*, c.name as character_name, c.character_data
       FROM narrative_challenge_instances nci
       JOIN characters c ON c.id = nci.character_id
       WHERE nci.status IN ('active', 'scored')
       ORDER BY nci.created_at ASC`
    );
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const placeholders = instance_ids.map((_, i) => '$' + (i + 1)).join(',');
    const instResult = await client.query(
      `SELECT nci.*, c.name as character_name, c.character_data
       FROM narrative_challenge_instances nci
       JOIN characters c ON c.id = nci.character_id
       WHERE nci.id IN (${placeholders}) AND nci.status = 'scored'`,
      instance_ids
    );

    if (instResult.rows.length === 0) {
      await client.query('ROLLBACK');
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
        await client.query(
          'UPDATE characters SET character_data = $1 WHERE id = $2',
          [JSON.stringify(charData), inst.character_id]
        );
      }

      await client.query(
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

    const allCharResult = await client.query(
      'SELECT id, character_data FROM characters'
    );
    const destinyPool = [];
    for (const row of allCharResult.rows) {
      let cd = {};
      try { cd = JSON.parse(row.character_data || '{}'); } catch (_) {}
      const spectrum = cd.destiny || 'Light & Dark';
      if (spectrum === 'Two Light') {
        destinyPool.push({ side: 'hope', tapped: true }, { side: 'hope', tapped: true });
      } else if (spectrum === 'Two Dark') {
        destinyPool.push({ side: 'toll', tapped: true }, { side: 'toll', tapped: true });
      } else {
        destinyPool.push({ side: 'hope', tapped: true }, { side: 'toll', tapped: true });
      }
    }

    let untappedCount = 0;
    for (const token of destinyPool) {
      if (tokenOutcome === 'equilibrium') {
        token.tapped = false;
        untappedCount++;
      } else if (tokenOutcome === 'hope' && token.side === 'hope') {
        token.tapped = false;
        untappedCount++;
      } else if (tokenOutcome === 'toll' && token.side === 'toll') {
        token.tapped = false;
        untappedCount++;
      }
    }

    await client.query(
      `INSERT INTO campaign_state (key, value, updated_at)
       VALUES ('destiny_pool', $1, NOW())
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(destinyPool)]
    );

    const challenges = loadChallenges();
    const journalEntries = [];
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
      const r = results.find(x => x.instanceId === inst.id);
      if (r && r.shifted) {
        bodyLines.push(`Destiny Shift: ${r.oldSpectrum} → ${r.newSpectrum}`);
      } else {
        bodyLines.push('Destiny Shift: Held steady');
      }

      bodyLines.push('');
      if (tokenOutcome === 'equilibrium') {
        bodyLines.push("Party Outcome: Revan's Balance — ALL tokens untapped");
      } else if (tokenOutcome === 'hope') {
        bodyLines.push('Party Outcome: Hope Dominant — Hope tokens untapped');
      } else {
        bodyLines.push('Party Outcome: Toll Dominant — Toll tokens untapped');
      }
      bodyLines.push(`Party Sum: ${partySum}`);

      const title = `${challenge.name} — ${inst.character_name}`;
      const body = bodyLines.join('\n');
      const sceneTag = inst.scene_id || (inst.adventure_id ? 'challenge:' + inst.adventure_id : 'challenge:' + inst.challenge_id);

      const entryResult = await client.query(
        `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [title, body, inst.character_name, sceneTag]
      );
      journalEntries.push({ id: entryResult.rows[0].id, title, characterName: inst.character_name });
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('destiny:sync', { pool: destinyPool, locked: false });

      const affectedCharIds = results.map(r => String(r.characterId));
      const sockets = Array.from(io.sockets.sockets.values());
      sockets.forEach(s => {
        if (s.data.role === 'player' && affectedCharIds.includes(String(s.data.characterId))) {
          const myResult = results.find(r => String(r.characterId) === String(s.data.characterId));
          s.emit('challenge:resolved', {
            tokenOutcome,
            partySum,
            characterResult: myResult || null
          });
        }
      });
    }

    res.json({
      results,
      partySum,
      tokenOutcome,
      message: tokenOutcome === 'equilibrium'
        ? "Revan's Balance — ALL tokens untapped"
        : tokenOutcome === 'hope'
          ? 'Hope dominant — all Hope tokens untapped'
          : 'Toll dominant — all Toll tokens untapped',
      tokensUntapped: untappedCount,
      tokensApplied: true,
      journalEntries
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[POST /narrative-challenges/resolve]', err);
    res.status(500).json({ error: 'Failed to resolve challenge' });
  } finally {
    client.release();
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

router.get('/narrative-challenges/player/active', async (req, res) => {
  if (req.userRole !== 'player' && req.userRole !== 'gm') {
    return res.status(403).json({ error: 'Authentication required' });
  }
  const characterId = parseInt(req.query.character_id, 10);
  if (!characterId) {
    return res.status(400).json({ error: 'character_id query param required' });
  }
  const playerToken = req.query.player_token;
  try {
    if (req.userRole === 'player') {
      if (!playerToken) {
        return res.status(403).json({ error: 'player_token required' });
      }
      const tokenCheck = await pool.query(
        'SELECT character_id FROM sessions WHERE player_token = $1 AND character_id = $2',
        [playerToken, characterId]
      );
      if (!tokenCheck.rows.length) {
        return res.status(403).json({ error: 'Invalid player_token for this character' });
      }
    }
    const result = await pool.query(
      `SELECT nci.*, c.name as character_name
       FROM narrative_challenge_instances nci
       JOIN characters c ON c.id = nci.character_id
       WHERE nci.character_id = $1 AND nci.status = 'active'
       ORDER BY nci.created_at DESC
       LIMIT 1`,
      [characterId]
    );
    if (result.rows.length === 0) {
      return res.json({ instance: null });
    }
    const inst = result.rows[0];
    const challenges = loadChallenges();
    const challenge = challenges.find(c => c.id === inst.challenge_id);
    if (!challenge) {
      return res.json({ instance: inst, challenge: null });
    }
    const playerChallenge = shuffleChoicesForPlayer(challenge, inst.shuffle_seed);
    res.json({ instance: inst, challenge: playerChallenge });
  } catch (err) {
    console.error('[GET /narrative-challenges/player/active]', err);
    res.status(500).json({ error: 'Failed to load active challenge' });
  }
});

router.put('/narrative-challenges/player/choice', async (req, res) => {
  if (req.userRole !== 'player' && req.userRole !== 'gm') {
    return res.status(403).json({ error: 'Authentication required' });
  }
  const characterId = parseInt(req.body.character_id, 10);
  if (!characterId) {
    return res.status(400).json({ error: 'character_id is required' });
  }
  const { instance_id, round_id, choice_id, player_token } = req.body;
  if (!instance_id || !round_id || !choice_id) {
    return res.status(400).json({ error: 'instance_id, round_id, and choice_id are required' });
  }
  try {
    if (req.userRole === 'player') {
      if (!player_token) {
        return res.status(403).json({ error: 'player_token required' });
      }
      const tokenCheck = await pool.query(
        'SELECT character_id FROM sessions WHERE player_token = $1 AND character_id = $2',
        [player_token, characterId]
      );
      if (!tokenCheck.rows.length) {
        return res.status(403).json({ error: 'Invalid player_token for this character' });
      }
    }
    const existing = await pool.query(
      `SELECT nci.*, c.name as character_name
       FROM narrative_challenge_instances nci
       JOIN characters c ON c.id = nci.character_id
       WHERE nci.id = $1 AND nci.character_id = $2 AND nci.status = $3`,
      [instance_id, characterId, 'active']
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Active instance not found for your character' });
    }

    const challenges = loadChallenges();
    const challenge = challenges.find(c => c.id === existing.rows[0].challenge_id);
    if (challenge) {
      const rounds = challenge.rounds || [];
      const round = rounds.find(r => r.id === round_id);
      if (!round) {
        return res.status(400).json({ error: 'Invalid round_id' });
      }
      const validChoice = (round.choices || []).find(c => c.id === choice_id);
      if (!validChoice) {
        return res.status(400).json({ error: 'Invalid choice_id' });
      }
    }

    let choices = [];
    try { choices = JSON.parse(existing.rows[0].choices || '[]'); } catch (_) {}
    choices = choices.filter(c => c.round_id !== round_id);
    choices.push({ round_id, choice_id, recorded_at: new Date().toISOString() });

    await pool.query(
      'UPDATE narrative_challenge_instances SET choices = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(choices), instance_id]
    );

    const totalRounds = challenge ? (challenge.rounds || []).length : 0;
    const isComplete = totalRounds > 0 && choices.length >= totalRounds;

    const io = req.app.get('io');
    if (io) {
      io.to('gm').emit('challenge:player-choice', {
        instanceId: instance_id,
        characterId: characterId,
        characterName: existing.rows[0].character_name || 'Unknown',
        roundId: round_id,
        choiceId: choice_id,
        totalChoices: choices.length,
        totalRounds: totalRounds
      });
    }

    if (isComplete && challenge) {
      const resolution = await autoResolveInstance(instance_id, challenge, choices, io);
      if (resolution) {
        return res.json({ success: true, choices, resolved: true, resolution });
      }
    }

    res.json({ success: true, choices });
  } catch (err) {
    console.error('[PUT /narrative-challenges/player/choice]', err);
    res.status(500).json({ error: 'Failed to record choice' });
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

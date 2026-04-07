const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');

const VALID_STATUSES = ['allied', 'neutral', 'hostile', 'unknown', 'deceased'];

function requireGM(req, res, next) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required' });
  next();
}

function parseJsonField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch (_) { return []; }
}

function formatProfile(row) {
  return {
    id: row.id,
    npc_key: row.npc_key,
    name: row.name,
    species: row.species,
    role: row.role,
    portrait_url: row.portrait_url,
    status: row.status,
    player_bio: row.player_bio,
    gm_notes: row.gm_notes,
    traits: parseJsonField(row.traits),
    connections: parseJsonField(row.connections),
    revealed: row.revealed,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function formatPlayerProfile(row) {
  const p = formatProfile(row);
  delete p.gm_notes;
  return p;
}

router.get('/npc-profiles', requireGM, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM npc_profiles ORDER BY sort_order, name');
    const profiles = result.rows.map(formatProfile);
    res.json({ profiles });
  } catch (err) {
    console.error('[GET /npc-profiles]', err);
    res.status(500).json({ error: 'Failed to load NPC profiles' });
  }
});

router.get('/npc-profiles/revealed', async (req, res) => {
  try {
    const profileResult = await pool.query(
      'SELECT * FROM npc_profiles WHERE revealed = true ORDER BY sort_order, name'
    );
    const profiles = profileResult.rows.map(formatPlayerProfile);

    const timelineResult = await pool.query(
      'SELECT * FROM npc_timeline WHERE revealed = true ORDER BY created_at ASC'
    );

    const timelineByNpc = {};
    for (const t of timelineResult.rows) {
      if (!timelineByNpc[t.npc_key]) timelineByNpc[t.npc_key] = [];
      timelineByNpc[t.npc_key].push({
        id: t.id,
        adventure_ref: t.adventure_ref,
        scene_ref: t.scene_ref,
        event_text: t.event_text,
        created_at: t.created_at
      });
    }

    for (const p of profiles) {
      p.timeline = timelineByNpc[p.npc_key] || [];
    }

    res.json({ profiles });
  } catch (err) {
    console.error('[GET /npc-profiles/revealed]', err);
    res.status(500).json({ error: 'Failed to load revealed profiles' });
  }
});

router.get('/npc-profiles/:npcKey', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM npc_profiles WHERE npc_key = $1', [req.params.npcKey]);
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const profile = formatProfile(result.rows[0]);

    const timelineResult = await pool.query(
      'SELECT * FROM npc_timeline WHERE npc_key = $1 ORDER BY created_at ASC',
      [req.params.npcKey]
    );
    profile.timeline = timelineResult.rows.map(t => ({
      id: t.id,
      adventure_ref: t.adventure_ref,
      scene_ref: t.scene_ref,
      event_text: t.event_text,
      revealed: t.revealed,
      created_at: t.created_at
    }));

    res.json({ profile });
  } catch (err) {
    console.error('[GET /npc-profiles/:npcKey]', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.post('/npc-profiles', requireGM, async (req, res) => {
  const { npc_key, name, species, role, portrait_url, status, player_bio, gm_notes, traits, connections } = req.body;
  if (!npc_key || !name) return res.status(400).json({ error: 'npc_key and name are required' });

  try {
    const maxSort = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM npc_profiles');
    const nextSort = maxSort.rows[0].next;

    const result = await pool.query(
      `INSERT INTO npc_profiles (npc_key, name, species, role, portrait_url, status, player_bio, gm_notes, traits, connections, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        npc_key, name,
        species || 'Unknown',
        role || '',
        portrait_url || null,
        VALID_STATUSES.includes(status) ? status : 'unknown',
        player_bio || '',
        gm_notes || '',
        JSON.stringify(traits || []),
        JSON.stringify(connections || []),
        nextSort
      ]
    );

    res.json({ profile: formatProfile(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'NPC key already exists' });
    console.error('[POST /npc-profiles]', err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

router.put('/npc-profiles/:npcKey', requireGM, async (req, res) => {
  const { npcKey } = req.params;
  const fields = req.body;

  try {
    const existing = await pool.query('SELECT * FROM npc_profiles WHERE npc_key = $1', [npcKey]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const updates = [];
    const vals = [];
    let idx = 1;

    const allowedFields = ['name', 'species', 'role', 'portrait_url', 'player_bio', 'gm_notes', 'sort_order'];
    for (const f of allowedFields) {
      if (fields[f] !== undefined) {
        updates.push(f + ' = $' + idx);
        vals.push(fields[f]);
        idx++;
      }
    }
    if (fields.status !== undefined && VALID_STATUSES.includes(fields.status)) {
      updates.push('status = $' + idx);
      vals.push(fields.status);
      idx++;
    }
    if (fields.revealed !== undefined) {
      updates.push('revealed = $' + idx);
      vals.push(!!fields.revealed);
      idx++;
    }
    if (fields.traits !== undefined) {
      updates.push('traits = $' + idx);
      vals.push(JSON.stringify(fields.traits));
      idx++;
    }
    if (fields.connections !== undefined) {
      updates.push('connections = $' + idx);
      vals.push(JSON.stringify(fields.connections));
      idx++;
    }

    if (updates.length === 0) return res.json({ profile: formatProfile(existing.rows[0]) });

    updates.push('updated_at = NOW()');
    vals.push(npcKey);

    const result = await pool.query(
      'UPDATE npc_profiles SET ' + updates.join(', ') + ' WHERE npc_key = $' + idx + ' RETURNING *',
      vals
    );

    res.json({ profile: formatProfile(result.rows[0]) });
  } catch (err) {
    console.error('[PUT /npc-profiles/:npcKey]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/npc-profiles/:npcKey/reveal', requireGM, async (req, res) => {
  const { npcKey } = req.params;
  const { revealed } = req.body;

  try {
    const result = await pool.query(
      'UPDATE npc_profiles SET revealed = $1, updated_at = NOW() WHERE npc_key = $2 RETURNING *',
      [revealed !== false, npcKey]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const io = req.app.get('io');
    if (io) {
      const profile = formatPlayerProfile(result.rows[0]);
      if (profile.revealed) {
        const timelineResult = await pool.query(
          'SELECT * FROM npc_timeline WHERE npc_key = $1 AND revealed = true ORDER BY created_at ASC',
          [npcKey]
        );
        profile.timeline = timelineResult.rows.map(t => ({
          id: t.id, adventure_ref: t.adventure_ref, scene_ref: t.scene_ref,
          event_text: t.event_text, created_at: t.created_at
        }));
        io.to('players').emit('npc:revealed', { profile });
      } else {
        io.to('players').emit('npc:hidden', { npc_key: npcKey });
      }
    }

    res.json({ profile: formatProfile(result.rows[0]) });
  } catch (err) {
    console.error('[POST /npc-profiles/:npcKey/reveal]', err);
    res.status(500).json({ error: 'Failed to toggle reveal' });
  }
});

router.post('/npc-profiles/:npcKey/status', requireGM, async (req, res) => {
  const { npcKey } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const result = await pool.query(
      'UPDATE npc_profiles SET status = $1, updated_at = NOW() WHERE npc_key = $2 RETURNING *',
      [status, npcKey]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const io = req.app.get('io');
    if (io) {
      io.to('players').emit('npc:status', { npc_key: npcKey, status });
    }

    res.json({ profile: formatProfile(result.rows[0]) });
  } catch (err) {
    console.error('[POST /npc-profiles/:npcKey/status]', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/npc-profiles/:npcKey/timeline', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM npc_timeline WHERE npc_key = $1 ORDER BY created_at ASC',
      [req.params.npcKey]
    );
    res.json({ timeline: result.rows });
  } catch (err) {
    console.error('[GET /npc-profiles/:npcKey/timeline]', err);
    res.status(500).json({ error: 'Failed to load timeline' });
  }
});

router.post('/npc-profiles/:npcKey/timeline', requireGM, async (req, res) => {
  const { npcKey } = req.params;
  const { adventure_ref, scene_ref, event_text, revealed } = req.body;
  if (!event_text) return res.status(400).json({ error: 'event_text is required' });

  try {
    const result = await pool.query(
      `INSERT INTO npc_timeline (npc_key, adventure_ref, scene_ref, event_text, revealed)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [npcKey, adventure_ref || '', scene_ref || '', event_text, revealed !== false]
    );

    if (revealed !== false) {
      const io = req.app.get('io');
      if (io) {
        io.to('players').emit('npc:timeline', {
          npc_key: npcKey,
          entry: {
            id: result.rows[0].id,
            adventure_ref: result.rows[0].adventure_ref,
            scene_ref: result.rows[0].scene_ref,
            event_text: result.rows[0].event_text,
            created_at: result.rows[0].created_at
          }
        });
      }
    }

    res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('[POST /npc-profiles/:npcKey/timeline]', err);
    res.status(500).json({ error: 'Failed to add timeline entry' });
  }
});

router.put('/npc-timeline/:id/reveal', requireGM, async (req, res) => {
  const { id } = req.params;
  const { revealed } = req.body;

  try {
    const result = await pool.query(
      'UPDATE npc_timeline SET revealed = $1 WHERE id = $2 RETURNING *',
      [revealed !== false, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Timeline entry not found' });

    const entry = result.rows[0];
    const io = req.app.get('io');
    if (io && entry.revealed) {
      io.to('players').emit('npc:timeline', {
        npc_key: entry.npc_key,
        entry: {
          id: entry.id, adventure_ref: entry.adventure_ref, scene_ref: entry.scene_ref,
          event_text: entry.event_text, created_at: entry.created_at
        }
      });
    }

    res.json({ entry });
  } catch (err) {
    console.error('[PUT /npc-timeline/:id/reveal]', err);
    res.status(500).json({ error: 'Failed to toggle timeline reveal' });
  }
});

router.delete('/npc-timeline/:id', requireGM, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM npc_timeline WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Timeline entry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /npc-timeline/:id]', err);
    res.status(500).json({ error: 'Failed to delete timeline entry' });
  }
});

router.delete('/npc-profiles/:npcKey', requireGM, async (req, res) => {
  const { npcKey } = req.params;
  try {
    await pool.query('DELETE FROM npc_timeline WHERE npc_key = $1', [npcKey]);
    const result = await pool.query('DELETE FROM npc_profiles WHERE npc_key = $1 RETURNING npc_key', [npcKey]);
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const io = req.app.get('io');
    if (io) io.to('players').emit('npc:hidden', { npc_key: npcKey });

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /npc-profiles/:npcKey]', err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

router.post('/npc-profiles/push-all', requireGM, async (req, res) => {
  try {
    const profileResult = await pool.query(
      'SELECT * FROM npc_profiles WHERE revealed = true ORDER BY sort_order, name'
    );
    const profiles = profileResult.rows.map(formatPlayerProfile);

    const timelineResult = await pool.query(
      'SELECT * FROM npc_timeline WHERE revealed = true ORDER BY created_at ASC'
    );
    const timelineByNpc = {};
    for (const t of timelineResult.rows) {
      if (!timelineByNpc[t.npc_key]) timelineByNpc[t.npc_key] = [];
      timelineByNpc[t.npc_key].push({
        id: t.id, adventure_ref: t.adventure_ref, scene_ref: t.scene_ref,
        event_text: t.event_text, created_at: t.created_at
      });
    }
    for (const p of profiles) {
      p.timeline = timelineByNpc[p.npc_key] || [];
    }

    const io = req.app.get('io');
    if (io) io.to('players').emit('npc:sync', { profiles });

    res.json({ pushed: profiles.length });
  } catch (err) {
    console.error('[POST /npc-profiles/push-all]', err);
    res.status(500).json({ error: 'Failed to push profiles' });
  }
});

router.get('/npc-profiles/scene-npcs/:sceneId', async (req, res) => {
  try {
    const files = fs.readdirSync(ADVENTURES_DIR).filter(f => /^adv\d+\.json$/.test(f)).sort();
    for (const f of files) {
      const content = fs.readFileSync(path.join(ADVENTURES_DIR, f), 'utf8').trim();
      if (!content) continue;
      const adv = JSON.parse(content);
      for (const part of (adv.parts || [])) {
        for (const scene of (part.scenes || [])) {
          if (scene.id === req.params.sceneId && scene.npcs) {
            const npcs = scene.npcs.map(n => ({
              name: n.name,
              type: n.type || '',
              count: n.count || 1
            }));
            return res.json({ npcs, adventure: adv.title, scene: scene.title });
          }
        }
      }
    }
    res.json({ npcs: [] });
  } catch (err) {
    console.error('[GET /npc-profiles/scene-npcs/:sceneId]', err);
    res.status(500).json({ error: 'Failed to load scene NPCs' });
  }
});

module.exports = router;

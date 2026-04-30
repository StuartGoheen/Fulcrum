const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');

const VALID_STATUSES = ['allied', 'neutral', 'hostile', 'unknown', 'deceased'];

function requireGM(req, res, next) {
  if (req.userRole && req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required' });
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

// Connection lines are stored as free-text strings like
//   "Admiral Varth — Quarry (Draco was sent to collect him)"
// or
//   "The Klosari — Adopted people."
// On the player side we must NOT leak relationships to NPCs the GM has not
// yet revealed: seeing "Admiral Varth — Quarry" on Draco's card before Varth
// is revealed gives the table free intel.
//
// Strategy: parse the leading subject before the em/en/hyphen dash. If it
// matches a known NPC's name (case-insensitive, partial-token match), only
// keep the line when that NPC is in the revealed set. Lines whose subject
// is not an NPC at all (objects, places, ships, factions, dead units) are
// always kept — they are world flavor, not roster intel.
function _filterPlayerConnections(connections, revealedNameSet, allNpcNameSet) {
  if (!Array.isArray(connections) || connections.length === 0) return [];
  return connections.filter((line) => {
    if (typeof line !== 'string') return true;
    // Split on common dash separators; take the leading subject token.
    const head = line.split(/[\u2014\u2013-]/)[0].trim().toLowerCase();
    if (!head) return true;
    // Check whether the head matches ANY known NPC name (revealed or not).
    let matchedAnyNpc = false;
    let matchedRevealedNpc = false;
    for (const nm of allNpcNameSet) {
      if (head === nm || head.indexOf(nm) === 0 || nm.indexOf(head) === 0) {
        matchedAnyNpc = true;
        if (revealedNameSet.has(nm)) { matchedRevealedNpc = true; break; }
      }
    }
    // Not an NPC reference at all → keep (world/object/place/faction).
    if (!matchedAnyNpc) return true;
    // It IS an NPC reference → only keep if that NPC is revealed.
    return matchedRevealedNpc;
  });
}

// Build the full lookup set of every NPC's name and key (lowercased) so
// connection filtering can recognise which leading tokens are roster names
// vs world flavor. Includes hidden NPCs (we only need the alphabet of
// known names — visibility is enforced via the revealed set).
async function _loadNpcNameAlphabet() {
  const all = await pool.query('SELECT npc_key, name FROM npc_profiles');
  const set = new Set();
  for (const r of all.rows) {
    if (r.name) set.add(String(r.name).toLowerCase());
    if (r.npc_key) set.add(String(r.npc_key).toLowerCase());
  }
  return set;
}

// Apply the player-side connection filter to a list of revealed profile
// objects in-place (mutating each profile.connections). Used by the GET
// route and by the reveal/hide broadcast helper.
function _filterRevealedProfilesConnections(profiles, allNpcNameSet) {
  const revealedNameSet = new Set();
  for (const p of profiles) {
    if (p && p.name) revealedNameSet.add(String(p.name).toLowerCase());
    if (p && p.npc_key) revealedNameSet.add(String(p.npc_key).toLowerCase());
  }
  for (const p of profiles) {
    p.connections = _filterPlayerConnections(p.connections, revealedNameSet, allNpcNameSet);
  }
  return profiles;
}

// Re-broadcast the entire revealed roster to the players room. Use this
// when ANY profile's revealed flag changes — newly-revealed NPCs may add
// connections to already-revealed cards (and hidden ones may strip them).
async function _rebroadcastRevealedRoster(io) {
  if (!io) return;
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

    const allNpcNameSet = await _loadNpcNameAlphabet();
    _filterRevealedProfilesConnections(profiles, allNpcNameSet);
    io.to('players').emit('npc:sync', { profiles });
  } catch (err) {
    console.error('[npc-profiles] _rebroadcastRevealedRoster failed:', err);
  }
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

    const allNpcNameSet = await _loadNpcNameAlphabet();
    _filterRevealedProfilesConnections(profiles, allNpcNameSet);

    res.json({ profiles });
  } catch (err) {
    console.error('[GET /npc-profiles/revealed]', err);
    res.status(500).json({ error: 'Failed to load revealed profiles' });
  }
});

router.get('/npc-profiles/:npcKey', requireGM, async (req, res) => {
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
      // Connections on already-revealed cards may now reference (or stop
      // referencing) this NPC — re-emit the full filtered roster so every
      // open dossier picks up the new visibility state.
      _rebroadcastRevealedRoster(io).catch(() => {});
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

router.get('/npc-profiles/:npcKey/timeline', requireGM, async (req, res) => {
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

  // Safe-by-default: server treats missing `revealed` as false so a future
  // plot beat is never auto-broadcast to players. The GM must explicitly
  // pass revealed:true (or use the per-entry reveal toggle) to publish.
  const isRevealed = revealed === true;

  try {
    const result = await pool.query(
      `INSERT INTO npc_timeline (npc_key, adventure_ref, scene_ref, event_text, revealed)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [npcKey, adventure_ref || '', scene_ref || '', event_text, isRevealed]
    );

    if (isRevealed) {
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

    const allNpcNameSet = await _loadNpcNameAlphabet();
    _filterRevealedProfilesConnections(profiles, allNpcNameSet);

    const io = req.app.get('io');
    if (io) io.to('players').emit('npc:sync', { profiles });

    res.json({ pushed: profiles.length });
  } catch (err) {
    console.error('[POST /npc-profiles/push-all]', err);
    res.status(500).json({ error: 'Failed to push profiles' });
  }
});

router.get('/npc-profiles/scene-npcs/:sceneId', requireGM, async (req, res) => {
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
module.exports.rebroadcastRevealedRoster = _rebroadcastRevealedRoster;
module.exports.filterRevealedProfilesConnections = _filterRevealedProfilesConnections;
module.exports.loadNpcNameAlphabet = _loadNpcNameAlphabet;

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');

function loadAdventuresData() {
  const files = fs.readdirSync(ADVENTURES_DIR).filter(f => /^adv\d+\.json$/.test(f)).sort();
  const adventures = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(ADVENTURES_DIR, f), 'utf8').trim();
      if (content) adventures.push(JSON.parse(content));
    } catch (e) {}
  }
  return { adventures };
}

function findSceneWithContext(data, sceneId) {
  for (const adv of data.adventures) {
    for (const part of (adv.parts || [])) {
      for (const s of (part.scenes || [])) {
        if (s.id === sceneId) {
          return { scene: s, adventure: adv, part };
        }
      }
    }
  }
  return null;
}

async function extractTagsFromScene(sceneId) {
  const data = loadAdventuresData();
  const found = findSceneWithContext(data, sceneId);

  if (!found) return [];

  const { scene } = found;
  const sceneTitle = scene.title || '';

  const tags = [];

  if (scene.npcs && scene.npcs.length) {
    for (const npc of scene.npcs) {
      if (npc.name) {
        tags.push({ name: npc.name, category: 'npc' });
      }
    }
  }

  if (scene.loreTags && scene.loreTags.length) {
    for (const tag of scene.loreTags) {
      tags.push({ name: tag, category: 'lore' });
    }
  }

  if (sceneTitle) {
    tags.push({ name: sceneTitle, category: 'location' });
  }

  if (scene.rewards && scene.rewards.items && scene.rewards.items.length) {
    for (const item of scene.rewards.items) {
      if (typeof item === 'string' && item.trim()) {
        tags.push({ name: item.trim(), category: 'item' });
      } else if (item && item.name) {
        tags.push({ name: item.name, category: 'item' });
      }
    }
  }

  const client = await pool.connect();
  try {
    for (const tag of tags) {
      await client.query(
        `INSERT INTO journal_tags (name, category, source_scene_id, is_custom)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (name, category) DO NOTHING`,
        [tag.name, tag.category, sceneId]
      );
    }
  } finally {
    client.release();
  }

  return tags;
}

router.get('/journal/tags', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, category, source_scene_id, is_custom FROM journal_tags ORDER BY category, name'
    );
    res.json({ tags: result.rows });
  } catch (err) {
    console.error('[GET /journal/tags]', err);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

const VALID_TAG_CATEGORIES = ['npc', 'location', 'lore', 'item', 'custom'];
function sanitizeCategory(cat) {
  return VALID_TAG_CATEGORIES.includes(cat) ? cat : 'custom';
}

router.post('/journal/tags', async (req, res) => {
  const { name, category } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tag name is required' });
  }
  const safeCat = sanitizeCategory(category);
  try {
    const result = await pool.query(
      `INSERT INTO journal_tags (name, category, is_custom)
       VALUES ($1, $2, true)
       ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, category, source_scene_id, is_custom`,
      [name.trim(), safeCat]
    );
    res.json({ tag: result.rows[0] });
  } catch (err) {
    console.error('[POST /journal/tags]', err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.get('/journal/entries', async (req, res) => {
  const { tag, scene_id } = req.query;
  try {
    let query, params;
    if (scene_id) {
      query = `
        SELECT e.id, e.title, e.body, e.author_character_name, e.source_scene_id, e.created_at, e.updated_at,
          COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category))
            FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
        FROM journal_entries e
        LEFT JOIN journal_entry_tags et ON et.entry_id = e.id
        LEFT JOIN journal_tags t ON t.id = et.tag_id
        WHERE e.source_scene_id = $1
        GROUP BY e.id
        ORDER BY e.created_at ASC`;
      params = [scene_id];
    } else if (tag) {
      query = `
        SELECT e.id, e.title, e.body, e.author_character_name, e.source_scene_id, e.created_at, e.updated_at,
          COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category))
            FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
        FROM journal_entries e
        LEFT JOIN journal_entry_tags et ON et.entry_id = e.id
        LEFT JOIN journal_tags t ON t.id = et.tag_id
        WHERE e.id IN (
          SELECT et2.entry_id FROM journal_entry_tags et2
          JOIN journal_tags t2 ON t2.id = et2.tag_id
          WHERE t2.name = $1
        )
        GROUP BY e.id
        ORDER BY e.created_at DESC`;
      params = [tag];
    } else {
      query = `
        SELECT e.id, e.title, e.body, e.author_character_name, e.source_scene_id, e.created_at, e.updated_at,
          COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category))
            FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
        FROM journal_entries e
        LEFT JOIN journal_entry_tags et ON et.entry_id = e.id
        LEFT JOIN journal_tags t ON t.id = et.tag_id
        GROUP BY e.id
        ORDER BY e.created_at DESC`;
      params = [];
    }
    const result = await pool.query(query, params);
    res.json({ entries: result.rows });
  } catch (err) {
    console.error('[GET /journal/entries]', err);
    res.status(500).json({ error: 'Failed to load entries' });
  }
});

router.post('/journal/entries', async (req, res) => {
  const { title, body, author_character_name, tag_ids, source_scene_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!author_character_name || !author_character_name.trim()) {
    return res.status(400).json({ error: 'Author name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const entryResult = await client.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, body, author_character_name, source_scene_id, created_at, updated_at`,
      [title.trim(), body || '', author_character_name.trim(), source_scene_id || null]
    );
    const entry = entryResult.rows[0];

    if (tag_ids && tag_ids.length) {
      for (const tagId of tag_ids) {
        await client.query(
          'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [entry.id, tagId]
        );
      }
    }

    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT e.id, e.title, e.body, e.author_character_name, e.source_scene_id, e.created_at, e.updated_at,
        COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category))
          FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM journal_entries e
      LEFT JOIN journal_entry_tags et ON et.entry_id = e.id
      LEFT JOIN journal_tags t ON t.id = et.tag_id
      WHERE e.id = $1
      GROUP BY e.id`, [entry.id]);

    res.json({ entry: fullResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /journal/entries]', err);
    res.status(500).json({ error: 'Failed to create entry' });
  } finally {
    client.release();
  }
});

router.put('/journal/entries/:id', async (req, res) => {
  const { id } = req.params;
  const { title, body, tag_ids } = req.body;

  if (title !== undefined && (!title || !title.trim())) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }
  if (tag_ids !== undefined && !Array.isArray(tag_ids)) {
    return res.status(400).json({ error: 'tag_ids must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM journal_entries WHERE id = $1', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Entry not found' });
    }

    const updates = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { updates.push('title = $' + idx); vals.push(title.trim()); idx++; }
    if (body !== undefined) { updates.push('body = $' + idx); vals.push(body); idx++; }
    updates.push('updated_at = NOW()');
    vals.push(id);

    await client.query(
      'UPDATE journal_entries SET ' + updates.join(', ') + ' WHERE id = $' + idx,
      vals
    );

    if (tag_ids !== undefined) {
      await client.query('DELETE FROM journal_entry_tags WHERE entry_id = $1', [id]);
      for (const tagId of (tag_ids || [])) {
        await client.query(
          'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, tagId]
        );
      }
    }

    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT e.id, e.title, e.body, e.author_character_name, e.source_scene_id, e.created_at, e.updated_at,
        COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'category', t.category))
          FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM journal_entries e
      LEFT JOIN journal_entry_tags et ON et.entry_id = e.id
      LEFT JOIN journal_tags t ON t.id = et.tag_id
      WHERE e.id = $1
      GROUP BY e.id`, [id]);

    res.json({ entry: fullResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /journal/entries/:id]', err);
    res.status(500).json({ error: 'Failed to update entry' });
  } finally {
    client.release();
  }
});

router.delete('/journal/entries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM journal_entries WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /journal/entries/:id]', err);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

router.post('/journal/extract-tags/:sceneId', async (req, res) => {
  try {
    const tags = await extractTagsFromScene(req.params.sceneId);
    res.json({ success: true, extracted: tags.length });
  } catch (err) {
    console.error('[POST /journal/extract-tags]', err);
    res.status(500).json({ error: 'Failed to extract tags' });
  }
});

async function createSceneJournalEntry(sceneId) {
  const data = loadAdventuresData();
  const found = findSceneWithContext(data, sceneId);
  if (!found) return null;

  const { scene, adventure, part } = found;
  const entryTitle = scene.title || sceneId;

  const existing = await pool.query(
    'SELECT id FROM journal_entries WHERE source_scene_id = $1 AND author_character_name = $2',
    [sceneId, 'Campaign Log']
  );
  if (existing.rows.length > 0) return null;

  const bodyLines = [];
  bodyLines.push(`${adventure.title} — Part ${part.number}: ${part.title}`);
  if (scene.subtitle) {
    bodyLines.push(scene.subtitle);
  }
  if (scene.challengeType) {
    const typeLabels = {
      social: 'Social', combat: 'Combat', exploration: 'Exploration',
      infiltration: 'Infiltration', survival: 'Survival',
      technical: 'Technical', force: 'Force'
    };
    bodyLines.push(`Scene Type: ${typeLabels[scene.challengeType] || scene.challengeType}`);
  }
  bodyLines.push('');

  if (scene.npcs && scene.npcs.length) {
    bodyLines.push('NPCs Present:');
    const npcGroups = {};
    for (const npc of scene.npcs) {
      if (!npc.name) continue;
      const key = npc.name + '|' + (npc.type || '');
      if (!npcGroups[key]) {
        npcGroups[key] = { name: npc.name, type: npc.type || '', count: 0 };
      }
      npcGroups[key].count += (npc.count || 1);
    }
    for (const g of Object.values(npcGroups)) {
      const label = g.count > 1 ? `${g.count}x ${g.name}` : g.name;
      bodyLines.push(g.type ? `  • ${label} — ${g.type}` : `  • ${label}`);
    }
    bodyLines.push('');
  }

  if (scene.loreTags && scene.loreTags.length) {
    bodyLines.push('Lore References:');
    for (const tag of scene.loreTags) {
      bodyLines.push(`  • ${tag}`);
    }
    bodyLines.push('');
  }

  bodyLines.push('———');
  bodyLines.push('Crew notes — add your observations below.');

  const body = bodyLines.join('\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryResult = await client.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [entryTitle, body, 'Campaign Log', sceneId]
    );
    const entryId = entryResult.rows[0].id;

    const tagPairs = [];
    if (scene.npcs && scene.npcs.length) {
      for (const npc of scene.npcs) {
        if (npc.name) tagPairs.push({ name: npc.name, category: 'npc' });
      }
    }
    if (scene.loreTags && scene.loreTags.length) {
      for (const tag of scene.loreTags) {
        tagPairs.push({ name: tag, category: 'lore' });
      }
    }
    if (scene.title) {
      tagPairs.push({ name: scene.title, category: 'location' });
    }
    for (const tp of tagPairs) {
      const tagResult = await client.query(
        'SELECT id FROM journal_tags WHERE name = $1 AND category = $2',
        [tp.name, tp.category]
      );
      if (tagResult.rows.length > 0) {
        await client.query(
          'INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [entryId, tagResult.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    return entryId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;
module.exports.extractTagsFromScene = extractTagsFromScene;
module.exports.createSceneJournalEntry = createSceneJournalEntry;

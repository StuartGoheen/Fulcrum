const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');

const ADVENTURES_PATH = path.join(__dirname, '..', '..', 'data', 'adventures.json');

let adventuresCache = null;
function loadAdventures() {
  if (!adventuresCache) {
    adventuresCache = JSON.parse(fs.readFileSync(ADVENTURES_PATH, 'utf8'));
  }
  return adventuresCache;
}

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/campaign/state', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM campaign_state').all();
  const state = rows.reduce((acc, row) => {
    try { acc[row.key] = JSON.parse(row.value); }
    catch { acc[row.key] = row.value; }
    return acc;
  }, {});
  res.json({ state });
});

router.get('/campaign/adventures', (req, res) => {
  try {
    const data = loadAdventures();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load adventures', detail: err.message });
  }
});

router.get('/campaign/adventures/:adventureId', (req, res) => {
  try {
    const data = loadAdventures();
    const adv = data.adventures.find(a => a.id === req.params.adventureId);
    if (!adv) return res.status(404).json({ error: 'Adventure not found' });
    res.json(adv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load adventure', detail: err.message });
  }
});

router.get('/campaign/progress', (req, res) => {
  const progress = db.prepare('SELECT * FROM campaign_progress WHERE id = 1').get();
  const completions = db.prepare('SELECT scene_id, completed, completed_at, gm_notes FROM scene_completion').all();
  const completionMap = {};
  completions.forEach(c => { completionMap[c.scene_id] = c; });
  res.json({ progress: progress || { adventure_id: 'adv1', part_id: 'adv1-p1', scene_id: 'adv1-p1-s1' }, completions: completionMap });
});

router.put('/campaign/progress', (req, res) => {
  const { adventure_id, part_id, scene_id } = req.body;
  if (!adventure_id || !part_id || !scene_id) {
    return res.status(400).json({ error: 'adventure_id, part_id, and scene_id are required' });
  }
  try {
    const data = loadAdventures();
    const adv = data.adventures.find(a => a.id === adventure_id);
    if (!adv) return res.status(400).json({ error: 'Invalid adventure_id' });
    const part = (adv.parts || []).find(p => p.id === part_id);
    if (!part) return res.status(400).json({ error: 'Invalid part_id' });
    const scene = (part.scenes || []).find(s => s.id === scene_id);
    if (!scene) return res.status(400).json({ error: 'Invalid scene_id' });
  } catch (err) {
    return res.status(500).json({ error: 'Validation failed', detail: err.message });
  }
  db.prepare(`
    INSERT INTO campaign_progress (id, adventure_id, part_id, scene_id, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      adventure_id = excluded.adventure_id,
      part_id = excluded.part_id,
      scene_id = excluded.scene_id,
      updated_at = excluded.updated_at
  `).run(adventure_id, part_id, scene_id);
  res.json({ success: true });
});

router.put('/campaign/scene/:sceneId/complete', (req, res) => {
  const { sceneId } = req.params;
  const { completed, gm_notes } = req.body;
  const isComplete = completed ? 1 : 0;
  db.prepare(`
    INSERT INTO scene_completion (scene_id, completed, completed_at, gm_notes)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(scene_id) DO UPDATE SET
      completed = excluded.completed,
      completed_at = CASE WHEN excluded.completed = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
      gm_notes = COALESCE(excluded.gm_notes, scene_completion.gm_notes)
  `).run(sceneId, isComplete, gm_notes || null);
  res.json({ success: true });
});

router.get('/campaign/lore-tags', (req, res) => {
  try {
    const data = loadAdventures();
    const tagMap = {};
    data.adventures.forEach(adv => {
      (adv.parts || []).forEach(part => {
        (part.scenes || []).forEach(scene => {
          (scene.loreTags || []).forEach(tag => {
            if (!tagMap[tag]) tagMap[tag] = [];
            tagMap[tag].push({
              sceneId: scene.id,
              sceneTitle: scene.title,
              adventureId: adv.id,
              adventureTitle: adv.title,
              adventureNumber: adv.number,
              partTitle: part.title,
              partNumber: part.number,
              sceneNumber: scene.number
            });
          });
        });
      });
    });
    res.json({ tags: tagMap });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build lore tags', detail: err.message });
  }
});

router.get('/campaign/lore-tags/:tag', (req, res) => {
  try {
    const data = loadAdventures();
    const tag = decodeURIComponent(req.params.tag);
    const scenes = [];
    data.adventures.forEach(adv => {
      (adv.parts || []).forEach(part => {
        (part.scenes || []).forEach(scene => {
          if ((scene.loreTags || []).includes(tag)) {
            scenes.push({
              sceneId: scene.id,
              sceneTitle: scene.title,
              adventureId: adv.id,
              adventureTitle: adv.title,
              adventureNumber: adv.number,
              partTitle: part.title,
              partNumber: part.number,
              sceneNumber: scene.number
            });
          }
        });
      });
    });
    res.json({ tag, scenes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query lore tag', detail: err.message });
  }
});

router.get('/campaign/party', (req, res) => {
  const characters = db.prepare(`
    SELECT id, name, session_id, character_data
    FROM characters
    WHERE character_data IS NOT NULL
  `).all();
  const party = characters.map(c => {
    let data = {};
    try { data = JSON.parse(c.character_data); } catch {}
    return {
      id: c.id,
      name: c.name,
      connected: !!c.session_id,
      vitality: data.computed?.vitality || data.vitality || null,
      species: data.species || null,
      archetype: data.archetype || null
    };
  });
  res.json({ party });
});

module.exports = router;

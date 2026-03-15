const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/characters', (req, res) => {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.slot_index,
      c.character_data,
      CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_connected
    FROM characters c
    LEFT JOIN sessions s ON s.character_id = c.id
    WHERE c.character_data IS NOT NULL
    ORDER BY c.slot_index ASC
  `).all();

  const characters = rows.map((c) => {
    let data = null;
    try { data = JSON.parse(c.character_data); } catch (_) {}
    return {
      id:           c.id,
      name:         c.name,
      species:      data ? (data.species || null) : null,
      archetype:    data ? (data.archetype || null) : null,
      is_connected: c.is_connected,
    };
  });

  res.json({ characters });
});

router.post('/session/join', (req, res) => {
  const { role, characterId } = req.body;

  if (!role || !['player', 'gm'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be "player" or "gm".' });
  }

  if (role === 'player') {
    if (!characterId) {
      return res.status(400).json({ error: 'characterId is required for player role.' });
    }

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found.' });
    }

    const token = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    db.prepare(`
      INSERT INTO sessions (id, character_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(token, characterId, role);

    db.prepare(`
      UPDATE characters SET session_id = ?, connected_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(token, characterId);

    return res.json({ token, role, characterId, characterName: character.name });
  }

  const token = `gm_session_${Date.now()}`;

  db.prepare(`
    INSERT INTO sessions (id, character_id, role)
    VALUES (?, NULL, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(token, role);

  return res.json({ token, role });
});

router.post('/characters/save', (req, res) => {
  const { name, character_data } = req.body;
  if (!name || !character_data) {
    return res.status(400).json({ error: 'name and character_data are required.' });
  }
  const dataStr = typeof character_data === 'string' ? character_data : JSON.stringify(character_data);

  // Check for name collision with a different slot
  const existing = db.prepare('SELECT id, name FROM characters WHERE name = ?').get(name);
  if (existing) {
    // Update the existing slot that already has this name
    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(dataStr, existing.id);
    return res.json({ ok: true, id: existing.id, action: 'updated' });
  }

  // Find the first slot with no character_data
  const emptySlot = db.prepare('SELECT id FROM characters WHERE character_data IS NULL ORDER BY slot_index ASC LIMIT 1').get();
  if (emptySlot) {
    db.prepare('UPDATE characters SET name = ?, character_data = ? WHERE id = ?').run(name, dataStr, emptySlot.id);
    return res.json({ ok: true, id: emptySlot.id, action: 'created' });
  }

  // No empty slots — insert a new one
  const maxSlot = db.prepare('SELECT MAX(slot_index) as m FROM characters').get().m || 0;
  const info = db.prepare('INSERT INTO characters (name, slot_index, character_data) VALUES (?, ?, ?)').run(name, maxSlot + 1, dataStr);
  return res.json({ ok: true, id: info.lastInsertRowid, action: 'inserted' });
});

router.get('/characters/:id', (req, res) => {
  const character = db.prepare('SELECT id, name, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  if (!character.character_data) {
    return res.status(404).json({ error: 'Character has no data.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    return res.json(data);
  } catch (_) {
    return res.status(500).json({ error: 'Corrupt character data.' });
  }
});

router.post('/admin/release-all', (req, res) => {
  db.prepare('DELETE FROM sessions').run();
  db.prepare('UPDATE characters SET session_id = NULL, connected_at = NULL').run();
  res.json({ ok: true, message: 'All character sessions released.' });
});

module.exports = router;

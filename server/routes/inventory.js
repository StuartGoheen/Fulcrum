const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.post('/inventory/:charId/use', (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }

  const row = db.prepare('SELECT character_data FROM characters WHERE id = ?').get(charId);
  if (!row || !row.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }

  const data = JSON.parse(row.character_data);
  if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: false };

  if (itemType === 'gear') {
    data.inventoryRemovals.gear.push(itemId);
  } else {
    return res.status(400).json({ error: 'Only gear can be used/consumed.' });
  }

  db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
    .run(JSON.stringify(data), charId);

  res.json({ ok: true, action: 'used', charId, itemId, itemType });
});

router.post('/inventory/:charId/drop', (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }

  const row = db.prepare('SELECT character_data FROM characters WHERE id = ?').get(charId);
  if (!row || !row.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }

  const data = JSON.parse(row.character_data);
  if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: false };

  if (itemType === 'gear') {
    data.inventoryRemovals.gear.push(itemId);
  } else if (itemType === 'weapon') {
    if (!data.inventoryRemovals.weapons) data.inventoryRemovals.weapons = [];
    data.inventoryRemovals.weapons.push(itemId);
  } else if (itemType === 'armor') {
    data.inventoryRemovals.armor = true;
  } else {
    return res.status(400).json({ error: 'Invalid itemType. Must be gear, weapon, or armor.' });
  }

  db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
    .run(JSON.stringify(data), charId);

  res.json({ ok: true, action: 'dropped', charId, itemId, itemType });
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const fs      = require('fs');
const path    = require('path');

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
  if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: [] };

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
  if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: [] };
  if (data.inventoryRemovals.armor === true) {
    data.inventoryRemovals.armor = (data.armorIds || (data.armorId ? [data.armorId] : [])).slice();
  } else if (!Array.isArray(data.inventoryRemovals.armor)) {
    data.inventoryRemovals.armor = [];
  }

  if (itemType === 'gear') {
    data.inventoryRemovals.gear.push(itemId);
  } else if (itemType === 'weapon') {
    if (!data.inventoryRemovals.weapons) data.inventoryRemovals.weapons = [];
    data.inventoryRemovals.weapons.push(itemId);
  } else if (itemType === 'armor') {
    data.inventoryRemovals.armor.push(itemId);
  } else {
    return res.status(400).json({ error: 'Invalid itemType. Must be gear, weapon, or armor.' });
  }

  db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
    .run(JSON.stringify(data), charId);

  res.json({ ok: true, action: 'dropped', charId, itemId, itemType });
});

router.post('/inventory/:charId/sell', (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType, pct } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }
  if (!['gear', 'weapon', 'armor'].includes(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType.' });
  }

  const sellPct = Math.max(5, Math.min(100, Math.round(Number(pct) || 50)));

  const row = db.prepare('SELECT character_data FROM characters WHERE id = ?').get(charId);
  if (!row || !row.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }

  const data = JSON.parse(row.character_data);

  let ownedIds;
  if (itemType === 'weapon') ownedIds = data.weaponIds || [];
  else if (itemType === 'armor') ownedIds = data.armorIds || (data.armorId ? [data.armorId] : []);
  else ownedIds = data.gearIds || [];

  if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: [] };
  if (data.inventoryRemovals.armor === true) {
    data.inventoryRemovals.armor = (data.armorIds || (data.armorId ? [data.armorId] : [])).slice();
  } else if (!Array.isArray(data.inventoryRemovals.armor)) {
    data.inventoryRemovals.armor = [];
  }
  if (!Array.isArray(data.inventoryRemovals.weapons)) data.inventoryRemovals.weapons = [];
  if (!Array.isArray(data.inventoryRemovals.gear)) data.inventoryRemovals.gear = [];

  const removedIds = itemType === 'weapon' ? data.inventoryRemovals.weapons
                   : itemType === 'armor'  ? data.inventoryRemovals.armor
                   : data.inventoryRemovals.gear;

  if (!ownedIds.includes(itemId)) {
    return res.status(400).json({ error: 'Character does not own this item.' });
  }
  if (removedIds.includes(itemId)) {
    return res.status(400).json({ error: 'Item has already been removed.' });
  }

  let catalog;
  try {
    if (itemType === 'weapon') catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/weapons.json'), 'utf8'));
    else if (itemType === 'armor') catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/armor.json'), 'utf8'));
    else catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/gear.json'), 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load item catalog.' });
  }

  const catalogItem = catalog.find(i => i.id === itemId);
  const baseCost = catalogItem ? (catalogItem.cost || 0) : 0;
  const sellPrice = Math.max(0, Math.round(baseCost * sellPct / 100));

  if (itemType === 'gear') {
    data.inventoryRemovals.gear.push(itemId);
  } else if (itemType === 'weapon') {
    data.inventoryRemovals.weapons.push(itemId);
  } else {
    data.inventoryRemovals.armor.push(itemId);
  }

  data.credits = (data.credits || 0) + sellPrice;

  db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
    .run(JSON.stringify(data), charId);

  db.prepare('DELETE FROM equipment_status WHERE character_id = ? AND item_id = ?')
    .run(String(charId), itemId);

  res.json({ ok: true, action: 'sold', charId, itemId, itemType, credits: data.credits, sellPrice });
});

router.post('/inventory/:charId/add', (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }
  if (!['gear', 'weapon', 'armor'].includes(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType. Must be gear, weapon, or armor.' });
  }

  let catalog;
  try {
    if (itemType === 'weapon') catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/weapons.json'), 'utf8'));
    else if (itemType === 'armor') catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/armor.json'), 'utf8'));
    else catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/gear.json'), 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load item catalog.' });
  }
  const catalogItem = catalog.find(i => i.id === itemId);
  if (!catalogItem) {
    return res.status(400).json({ error: 'Item not found in catalog.' });
  }

  const row = db.prepare('SELECT character_data FROM characters WHERE id = ?').get(charId);
  if (!row || !row.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }

  const data = JSON.parse(row.character_data);

  if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: [] };

  if (itemType === 'weapon') {
    if (!data.weaponIds) data.weaponIds = [];
    if (!Array.isArray(data.inventoryRemovals.weapons)) data.inventoryRemovals.weapons = [];
    const remIdx = data.inventoryRemovals.weapons.indexOf(itemId);
    if (remIdx !== -1) {
      data.inventoryRemovals.weapons.splice(remIdx, 1);
    } else {
      data.weaponIds.push(itemId);
    }
  } else if (itemType === 'armor') {
    if (!data.armorIds) data.armorIds = [];
    if (data.armorId && !data.armorIds.length) {
      data.armorIds = [data.armorId];
      delete data.armorId;
    }
    if (!Array.isArray(data.inventoryRemovals.armor)) data.inventoryRemovals.armor = [];
    const remIdx = data.inventoryRemovals.armor.indexOf(itemId);
    if (remIdx !== -1) {
      data.inventoryRemovals.armor.splice(remIdx, 1);
    } else {
      data.armorIds.push(itemId);
    }
  } else {
    if (!data.gearIds) data.gearIds = [];
    if (!Array.isArray(data.inventoryRemovals.gear)) data.inventoryRemovals.gear = [];
    const remIdx = data.inventoryRemovals.gear.indexOf(itemId);
    if (remIdx !== -1) {
      data.inventoryRemovals.gear.splice(remIdx, 1);
    } else {
      data.gearIds.push(itemId);
    }
  }

  db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
    .run(JSON.stringify(data), charId);

  res.json({ ok: true, action: 'added', charId, itemId, itemType });
});

module.exports = router;

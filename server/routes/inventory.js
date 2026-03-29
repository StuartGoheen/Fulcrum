const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const fs      = require('fs');
const path    = require('path');

router.post('/inventory/:charId/use', async (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }

  try {
    const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [charId]);
    if (result.rows.length === 0 || !result.rows[0].character_data) {
      return res.status(404).json({ error: 'Character not found.' });
    }

    const data = JSON.parse(result.rows[0].character_data);
    if (!data.inventoryRemovals) data.inventoryRemovals = { gear: [], weapons: [], armor: [] };

    if (itemType === 'gear') {
      data.inventoryRemovals.gear.push(itemId);
    } else {
      return res.status(400).json({ error: 'Only gear can be used/consumed.' });
    }

    await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(data), charId]);
    res.json({ ok: true, action: 'used', charId, itemId, itemType });
  } catch (err) {
    console.error('[POST /inventory/use]', err);
    res.status(500).json({ error: 'Failed to use item.' });
  }
});

router.post('/inventory/:charId/drop', async (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }

  try {
    const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [charId]);
    if (result.rows.length === 0 || !result.rows[0].character_data) {
      return res.status(404).json({ error: 'Character not found.' });
    }

    const data = JSON.parse(result.rows[0].character_data);
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

    await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(data), charId]);
    res.json({ ok: true, action: 'dropped', charId, itemId, itemType });
  } catch (err) {
    console.error('[POST /inventory/drop]', err);
    res.status(500).json({ error: 'Failed to drop item.' });
  }
});

router.post('/inventory/:charId/sell', async (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType, pct } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }
  if (!['gear', 'weapon', 'armor'].includes(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType.' });
  }

  const sellPct = Math.max(5, Math.min(100, Math.round(Number(pct) || 50)));

  try {
    const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [charId]);
    if (result.rows.length === 0 || !result.rows[0].character_data) {
      return res.status(404).json({ error: 'Character not found.' });
    }

    const data = JSON.parse(result.rows[0].character_data);

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

    await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(data), charId]);
    await pool.query('DELETE FROM equipment_status WHERE character_id = $1 AND item_id = $2', [String(charId), itemId]);

    res.json({ ok: true, action: 'sold', charId, itemId, itemType, credits: data.credits, sellPrice });
  } catch (err) {
    console.error('[POST /inventory/sell]', err);
    res.status(500).json({ error: 'Failed to sell item.' });
  }
});

router.post('/inventory/:charId/add', async (req, res) => {
  const { charId } = req.params;
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ error: 'itemId and itemType are required.' });
  }
  if (!['gear', 'weapon', 'armor'].includes(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType. Must be gear, weapon, or armor.' });
  }

  try {
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

    const result = await pool.query('SELECT character_data FROM characters WHERE id = $1', [charId]);
    if (result.rows.length === 0 || !result.rows[0].character_data) {
      return res.status(404).json({ error: 'Character not found.' });
    }

    const data = JSON.parse(result.rows[0].character_data);

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

    await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [JSON.stringify(data), charId]);

    await pool.query(
      `INSERT INTO equipment_status (character_id, item_id, item_type, status, updated_at)
       VALUES ($1, $2, $3, 'carried', NOW())
       ON CONFLICT(character_id, item_id) DO UPDATE SET status = 'carried', updated_at = NOW()`,
      [charId, itemId, itemType]
    );

    res.json({ ok: true, action: 'added', charId, itemId, itemType });
  } catch (err) {
    console.error('[POST /inventory/add]', err);
    res.status(500).json({ error: 'Failed to add item.' });
  }
});

module.exports = router;

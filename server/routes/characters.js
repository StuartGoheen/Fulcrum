const express = require('express');
const router  = express.Router();
const path    = require('path');
const fsx     = require('fs');
const db      = require('../db');

const KITS_DATA = JSON.parse(fsx.readFileSync(path.join(__dirname, '..', '..', 'data', 'kits.json'), 'utf8'));

const SPECIES_ARENAS = {
  'Human':   { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
  "Twi'lek": { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
  'Wookiee': { physique: 'D8', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
  'Duros':   { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
  'Zabrak':  { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
};

const ARENA_META = [
  { id: 'physique', label: 'PHYSIQUE', subtitle: 'Strength, Structure, Endurance', disciplines: [
    { id: 'athletics', label: 'Athletics' },
    { id: 'brawl', label: 'Brawl' },
    { id: 'endure', label: 'Endure' },
    { id: 'melee', label: 'Melee' },
    { id: 'heavy_weapons', label: 'Heavy Weapons' },
  ]},
  { id: 'reflex', label: 'REFLEX', subtitle: 'Speed, Agility, Hand-Eye Coordination', disciplines: [
    { id: 'evasion', label: 'Evasion' },
    { id: 'piloting', label: 'Piloting' },
    { id: 'ranged', label: 'Ranged' },
    { id: 'skulduggery', label: 'Skulduggery' },
    { id: 'stealth', label: 'Stealth' },
  ]},
  { id: 'grit', label: 'GRIT', subtitle: 'Instinct, Stamina, Spiritual Willpower', disciplines: [
    { id: 'beast_handling', label: 'Beast Handling' },
    { id: 'intimidate', label: 'Intimidate' },
    { id: 'resolve', label: 'Resolve' },
    { id: 'survival', label: 'Survival' },
    { id: 'control_spark', label: 'Control (The Spark)' },
  ]},
  { id: 'wits', label: 'WITS', subtitle: 'Logic, Awareness, Technical Knowledge', disciplines: [
    { id: 'investigation', label: 'Investigation' },
    { id: 'medicine', label: 'Medicine' },
    { id: 'tactics', label: 'Tactics' },
    { id: 'tech', label: 'Tech' },
    { id: 'sense_spark', label: 'Sense (The Spark)' },
  ]},
  { id: 'presence', label: 'PRESENCE', subtitle: 'Charisma, Authority, Projection of Will', disciplines: [
    { id: 'charm', label: 'Charm' },
    { id: 'deception', label: 'Deception' },
    { id: 'insight', label: 'Insight' },
    { id: 'persuasion', label: 'Persuasion' },
    { id: 'alter_spark', label: 'Alter (The Spark)' },
  ]},
];

const DIE_STEPS = ['D4', 'D6', 'D8', 'D10', 'D12'];

const BACKGROUND_FAVORED = {
  'deep-fringe': 'survival', 'shadowed-levels': 'stealth', 'salvage-yards': 'tech',
  'coreward-spires': 'persuasion', 'agrarian-plain': 'resolve', 'war-front': 'evasion',
  'ancient-ruin': 'investigation', 'trading-post': 'insight', 'detention-block': 'endure',
  'shipboard-born': 'piloting', 'labor-camp': 'athletics', 'enclave': 'charm',
  'disbanded-regular': 'tactics', 'separatist-holdout': 'ranged', 'imperial-defector': 'deception',
  'blockade-runner': 'piloting', 'pacification-survivor': 'survival', 'field-medic': 'medicine',
  'syndicate-enforcer': 'intimidate', 'post-war-tracker': 'investigation', 'purge-survivor': 'stealth',
  'wreck': 'endure', 'ascent': 'persuasion', 'betrayal': 'insight',
};

const BACKGROUND_TITLE_TO_ID = {
  'The Deep Fringe': 'deep-fringe', 'The Shadowed Levels': 'shadowed-levels',
  'The Salvage Yards': 'salvage-yards', 'The Coreward Spires': 'coreward-spires',
  'The Agrarian Plain': 'agrarian-plain', 'The War Front': 'war-front',
  'The Ancient Ruin': 'ancient-ruin', 'The Trading Post': 'trading-post',
  'The Detention Block': 'detention-block', 'The Shipboard Born': 'shipboard-born',
  'The Labor Camp': 'labor-camp', 'The Enclave': 'enclave',
  'The Disbanded Regular': 'disbanded-regular', 'The Separatist Holdout': 'separatist-holdout',
  'The Imperial Defector': 'imperial-defector', 'The Blockade Runner': 'blockade-runner',
  'The Pacification Survivor': 'pacification-survivor', 'The Field Medic': 'field-medic',
  'The Syndicate Enforcer': 'syndicate-enforcer', 'The Post-War Tracker': 'post-war-tracker',
  'The Purge Survivor': 'purge-survivor', 'The Wreck': 'wreck',
  'The Ascent': 'ascent', 'The Betrayal': 'betrayal',
};

function resolveBackgroundFavored(flat) {
  const cs = flat.creationState || {};
  const p1Id = cs.phase1 || BACKGROUND_TITLE_TO_ID[flat.phase1] || flat.phase1;
  const p2Id = cs.phase2 || BACKGROUND_TITLE_TO_ID[flat.phase2] || flat.phase2;
  const favored = [BACKGROUND_FAVORED[p1Id], BACKGROUND_FAVORED[p2Id]].filter(Boolean);
  const speciesFav = cs.favoredDiscipline || flat.favoredDiscipline;
  if (speciesFav && speciesFav !== 'any') favored.unshift(speciesFav);
  return favored;
}

const ENGINE_DATA = {
  id: 'edge',
  name: 'The Edge',
  poolName: 'Edge Points',
  coreUtility: {
    name: 'Tier Boost',
    cost: '1 Edge Point',
    rule: 'Spend 1 Edge Point after a roll to instantly increase your final Power result by +1 Effect Tier (e.g., from a Fleeting success to a Masterful success). You may only use this on favored Disciplines granted by your Background and Vocations.',
  },
};

function resolveKits(raw) {
  let kitChoices = {};
  if (Array.isArray(raw)) {
    raw.forEach(k => { if (k && k.id && k.tier) kitChoices[k.id] = k.tier; });
  } else if (raw && typeof raw === 'object') {
    kitChoices = raw;
  }
  const kits = [];
  Object.keys(kitChoices).forEach(kitId => {
    const tier = kitChoices[kitId];
    if (!tier) return;
    const kitDef = KITS_DATA.find(k => k.id === kitId);
    if (!kitDef) return;
    const kit = JSON.parse(JSON.stringify(kitDef));
    kit.tier = tier;
    kits.push(kit);
  });
  return kits;
}

function expandCharacterData(flat) {
  const alreadyExpanded = flat.arenas && Array.isArray(flat.arenas);

  if (alreadyExpanded) {
    const kits = resolveKits(flat.kits);
    const engineArenas = kits.map(k => k.governingArena).filter(Boolean);
    flat.kits = kits;
    flat.engine = kits.length > 0 ? Object.assign({}, ENGINE_DATA, { governingArenas: engineArenas }) : null;
    if (!flat.backgroundFavored) {
      flat.backgroundFavored = resolveBackgroundFavored(flat);
    }
    return flat;
  }

  const speciesBase = SPECIES_ARENAS[flat.species] || SPECIES_ARENAS['Human'];
  const arenaAdj = flat.arenaAdj || {};
  const discValues = flat.discValues || {};

  const arenas = ARENA_META.map(arena => {
    const baseIdx = DIE_STEPS.indexOf(speciesBase[arena.id] || 'D6');
    const adj = arenaAdj[arena.id] || 0;
    const finalIdx = Math.max(0, Math.min(DIE_STEPS.length - 1, baseIdx + adj));
    const arenaDie = DIE_STEPS[finalIdx];

    const disciplines = arena.disciplines.map(disc => ({
      id: disc.id,
      label: disc.label,
      die: discValues[disc.id] || 'D6',
    }));

    return {
      id: arena.id,
      label: arena.label,
      subtitle: arena.subtitle,
      die: arenaDie,
      disciplines,
    };
  });

  const kits = resolveKits(flat.kits);

  const engineArenas = kits.map(k => k.governingArena).filter(Boolean);

  const weaponIds = Array.isArray(flat.weaponIds) ? flat.weaponIds.slice() : [];
  const gearIds = Array.isArray(flat.gearIds) ? flat.gearIds.slice() : [];
  let armorId = flat.armorId || null;
  const startingGear = Array.isArray(flat.startingGear) ? flat.startingGear : [];
  const acquisitionMap = flat.acquisitionMap || {};
  startingGear.forEach(item => {
    if (!item || !item.id) return;
    if (item.acquisition) acquisitionMap[item.id] = item.acquisition;
    if (item.source === 'weapon') { if (weaponIds.indexOf(item.id) === -1) weaponIds.push(item.id); }
    else if (item.source === 'armor') { if (!armorId) armorId = item.id; }
    else if (item.source === 'gear') { if (gearIds.indexOf(item.id) === -1) gearIds.push(item.id); }
  });

  const UNARMED_IDS = ['wpn_fists_01', 'wpn_cathar_claws_01'];
  const speciesLower = (flat.species || '').toLowerCase();
  const correctUnarmedId = speciesLower === 'cathar' ? 'wpn_cathar_claws_01' : 'wpn_fists_01';
  const wrongUnarmedId = speciesLower === 'cathar' ? 'wpn_fists_01' : 'wpn_cathar_claws_01';
  const wrongIdx = weaponIds.indexOf(wrongUnarmedId);
  if (wrongIdx !== -1) {
    weaponIds[wrongIdx] = correctUnarmedId;
  } else if (!weaponIds.some(id => UNARMED_IDS.includes(id))) {
    weaponIds.push(correctUnarmedId);
  }

  return {
    name: flat.name || null,
    species: flat.species,
    archetype: flat.archetype || flat.title || null,
    narrative: flat.backstory || '',
    gender: flat.gender || null,
    destiny: flat.destiny || null,
    phase1: flat.phase1 || null,
    phase2: flat.phase2 || null,
    phase3: flat.phase3 || null,
    backgroundFavored: resolveBackgroundFavored(flat),
    vitalityModifier: 0,
    weaponIds,
    armorId,
    gearIds,
    acquisitionMap,
    engine: kits.length > 0 ? Object.assign({}, ENGINE_DATA, { governingArenas: engineArenas }) : null,
    kits,
    talents: [],
    arenas,
    personalDestiny: flat.personalDestiny || null,
  };
}

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
  const { name, character_data, editId } = req.body;
  if (!name || !character_data) {
    return res.status(400).json({ error: 'name and character_data are required.' });
  }
  const dataStr = typeof character_data === 'string' ? character_data : JSON.stringify(character_data);

  if (editId) {
    const editRow = db.prepare('SELECT id FROM characters WHERE id = ?').get(editId);
    if (editRow) {
      const inSession = db.prepare('SELECT id FROM sessions WHERE character_id = ?').get(editId);
      if (inSession) {
        return res.status(409).json({ error: 'Character is currently in session. Disconnect first.' });
      }
      db.prepare('UPDATE characters SET name = ?, character_data = ? WHERE id = ?').run(name, dataStr, editId);
      return res.json({ ok: true, id: editId, action: 'updated' });
    }
  }

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
    data.name = data.name || character.name;
    if (req.query.raw === '1') {
      return res.json({ name: character.name, character_data: data });
    }
    const expanded = expandCharacterData(data);
    expanded.id = character.id;
    return res.json(expanded);
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

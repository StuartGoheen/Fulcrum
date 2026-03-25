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
    name: 'Reroll',
    cost: '1 Edge Point',
    rule: 'Spend 1 Edge after a roll to reroll either your Control die or your Power die. Favored Disciplines only.',
  },
};

function applyVocationUnlocks(kits, unlocks) {
  if (!kits || !unlocks) return;
  kits.forEach(kit => {
    const kitId = kit.id || '';
    const extra = unlocks[kitId] || 0;
    if (extra > 0) {
      kit.tier = (kit.tier || 1) + extra;
    }
  });
}

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

function applyInventoryRemovals(result, removals) {
  if (!removals) return;
  if (Array.isArray(removals.gear)) {
    const toRemove = removals.gear.slice();
    for (let r = 0; r < toRemove.length; r++) {
      const idx = result.gearIds.indexOf(toRemove[r]);
      if (idx !== -1) result.gearIds.splice(idx, 1);
    }
  }
  if (Array.isArray(removals.weapons)) {
    const UNARMED = ['wpn_fists_01', 'wpn_cathar_claws_01'];
    const toRemove = removals.weapons.slice();
    for (let r = 0; r < toRemove.length; r++) {
      if (UNARMED.includes(toRemove[r])) continue;
      const idx = result.weaponIds.indexOf(toRemove[r]);
      if (idx !== -1) result.weaponIds.splice(idx, 1);
    }
  }
  if (Array.isArray(removals.armor)) {
    removals.armor.forEach(armId => {
      const idx = result.armorIds.indexOf(armId);
      if (idx !== -1) result.armorIds.splice(idx, 1);
    });
  } else if (removals.armor === true) {
    result.armorIds = [];
  }
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
    if (!flat.weaponIds) flat.weaponIds = [];
    const UNARMED = ['wpn_fists_01', 'wpn_cathar_claws_01'];
    const spLower = (flat.species || '').toLowerCase();
    const correctId = spLower === 'cathar' ? 'wpn_cathar_claws_01' : 'wpn_fists_01';
    const wrongId   = spLower === 'cathar' ? 'wpn_fists_01' : 'wpn_cathar_claws_01';
    flat.weaponIds = flat.weaponIds.filter(id => !UNARMED.includes(id));
    flat.weaponIds.push(correctId);
    if (!Array.isArray(flat.armorIds)) {
      flat.armorIds = flat.armorId ? [flat.armorId] : [];
      delete flat.armorId;
    }
    if (!flat.advancement) flat.advancement = {};
    if (!flat.advancement.marks) flat.advancement.marks = { earnedChecks: {}, totalBanked: 0 };
    if (!flat.advancement.disciplineTrack) flat.advancement.disciplineTrack = { level: 2, filled: 0, eliteTokens: 0, focusBurns: 0, unspentAdvances: 0 };
    else if (flat.advancement.disciplineTrack.unspentAdvances === undefined) flat.advancement.disciplineTrack.unspentAdvances = 0;
    if (!flat.advancement.arenaTrack) flat.advancement.arenaTrack = { level: 2, filled: 0, unspentAdvances: 0 };
    else if (flat.advancement.arenaTrack.unspentAdvances === undefined) flat.advancement.arenaTrack.unspentAdvances = 0;
    if (!flat.advancement.vocationTrack) flat.advancement.vocationTrack = { level: 2, filled: 0, unspentAdvances: 0 };
    else if (flat.advancement.vocationTrack.unspentAdvances === undefined) flat.advancement.vocationTrack.unspentAdvances = 0;
    if (!flat.advancement.vocationUnlocks) flat.advancement.vocationUnlocks = {};
    applyVocationUnlocks(flat.kits, flat.advancement.vocationUnlocks);
    if (flat.credits === undefined) flat.credits = 0;
    flat.debt = _migrateDebt(flat.debt);
    applyInventoryRemovals(flat, flat.inventoryRemovals);
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
  const armorIds = Array.isArray(flat.armorIds) ? flat.armorIds.slice()
                 : (flat.armorId ? [flat.armorId] : []);
  const startingGear = Array.isArray(flat.startingGear) ? flat.startingGear : [];
  const acquisitionMap = flat.acquisitionMap || {};
  startingGear.forEach(item => {
    if (!item || !item.id) return;
    if (item.acquisition) acquisitionMap[item.id] = item.acquisition;
    if (item.source === 'weapon') { if (weaponIds.indexOf(item.id) === -1) weaponIds.push(item.id); }
    else if (item.source === 'armor') { if (armorIds.indexOf(item.id) === -1) armorIds.push(item.id); }
    else if (item.source === 'gear') { gearIds.push(item.id); }
  });

  const UNARMED_IDS = ['wpn_fists_01', 'wpn_cathar_claws_01'];
  const speciesLower = (flat.species || '').toLowerCase();
  const correctUnarmedId = speciesLower === 'cathar' ? 'wpn_cathar_claws_01' : 'wpn_fists_01';
  const filteredWeaponIds = weaponIds.filter(id => !UNARMED_IDS.includes(id));
  filteredWeaponIds.push(correctUnarmedId);
  weaponIds.length = 0;
  filteredWeaponIds.forEach(id => weaponIds.push(id));

  const advancement = flat.advancement || {};
  if (!advancement.marks) advancement.marks = { earnedChecks: {}, totalBanked: 0 };
  if (!advancement.disciplineTrack) advancement.disciplineTrack = { level: 2, filled: 0, eliteTokens: 0, focusBurns: 0, unspentAdvances: 0 };
  else if (advancement.disciplineTrack.unspentAdvances === undefined) advancement.disciplineTrack.unspentAdvances = 0;
  if (!advancement.arenaTrack) advancement.arenaTrack = { level: 2, filled: 0, unspentAdvances: 0 };
  else if (advancement.arenaTrack.unspentAdvances === undefined) advancement.arenaTrack.unspentAdvances = 0;
  if (!advancement.vocationTrack) advancement.vocationTrack = { level: 2, filled: 0, unspentAdvances: 0 };
  else if (advancement.vocationTrack.unspentAdvances === undefined) advancement.vocationTrack.unspentAdvances = 0;
  if (!advancement.vocationUnlocks) advancement.vocationUnlocks = {};
  applyVocationUnlocks(kits, advancement.vocationUnlocks);

  const result = {
    name: flat.name || null,
    species: flat.species,
    archetype: flat.archetype || flat.title || null,
    narrative: flat.backstory || '',
    portrait: flat.portrait || null,
    gender: flat.gender || null,
    destiny: flat.destiny || null,
    phase1: flat.phase1 || null,
    phase2: flat.phase2 || null,
    phase3: flat.phase3 || null,
    backgroundFavored: resolveBackgroundFavored(flat),
    vitalityModifier: 0,
    weaponIds,
    armorIds,
    gearIds,
    acquisitionMap,
    engine: kits.length > 0 ? Object.assign({}, ENGINE_DATA, { governingArenas: engineArenas }) : null,
    kits,
    talents: [],
    arenas,
    personalDestiny: flat.personalDestiny || null,
    debt: _migrateDebt(flat.debt),
    credits: flat.credits || 0,
    advancement,
  };

  applyInventoryRemovals(result, flat.inventoryRemovals);

  return result;
}

const DEBT_CREDITOR_RATES = {
  hutt_cartel: 0.10, black_sun: 0.15, imperial_surplus: 0.20,
  czerka_arms: 0.25, local_fixer: 0.30
};

function _migrateDebt(debt) {
  if (!debt) return null;
  if (debt.balance !== undefined) return debt;
  const amt = debt.amount || 0;
  if (amt <= 0) return null;
  return {
    creditorId: debt.creditorId || 'hutt_cartel',
    principal: amt,
    balance: amt,
    rate: DEBT_CREDITOR_RATES[debt.creditorId] || 0.10,
    cyclesElapsed: 0,
    history: []
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
    const debt = data ? _migrateDebt(data.debt) : null;
    return {
      id:           c.id,
      name:         c.name,
      species:      data ? (data.species || null) : null,
      archetype:    data ? (data.archetype || null) : null,
      credits:      data ? (data.credits || 0) : 0,
      debt:         debt ? { creditorId: debt.creditorId, balance: debt.balance, rate: debt.rate, principal: debt.principal, cyclesElapsed: debt.cyclesElapsed || 0 } : null,
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

router.patch('/characters/:id/advancement', (req, res) => {
  const character = db.prepare('SELECT id, character_data, session_id FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  if (!character.session_id) {
    return res.status(403).json({ error: 'Character is not in an active session.' });
  }
  try {
    const adv = req.body;
    if (!adv || typeof adv !== 'object') {
      return res.status(400).json({ error: 'Invalid advancement payload.' });
    }
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || lo));
    const validPhases = ['mission', 'advancement'];
    const sanitized = {
      marks: {
        earnedChecks: (adv.marks && typeof adv.marks.earnedChecks === 'object') ? adv.marks.earnedChecks : {},
        totalBanked: clamp(adv.marks && adv.marks.totalBanked, 0, 9999)
      },
      missionPhase: (adv.missionPhase && validPhases.includes(adv.missionPhase)) ? adv.missionPhase : 'mission',
      disciplineTrack: {
        level: clamp(adv.disciplineTrack && adv.disciplineTrack.level, 1, 50),
        filled: clamp(adv.disciplineTrack && adv.disciplineTrack.filled, 0, 5),
        eliteTokens: clamp(adv.disciplineTrack && adv.disciplineTrack.eliteTokens, 0, 999),
        focusBurns: clamp(adv.disciplineTrack && adv.disciplineTrack.focusBurns, 0, 999),
        unspentAdvances: clamp(adv.disciplineTrack && adv.disciplineTrack.unspentAdvances, 0, 999),
        invested: clamp(adv.disciplineTrack && adv.disciplineTrack.invested, 0, 9999),
        lockedInvested: clamp(adv.disciplineTrack && adv.disciplineTrack.lockedInvested, 0, 9999)
      },
      arenaTrack: {
        level: clamp(adv.arenaTrack && adv.arenaTrack.level, 1, 50),
        filled: clamp(adv.arenaTrack && adv.arenaTrack.filled, 0, 3),
        unspentAdvances: clamp(adv.arenaTrack && adv.arenaTrack.unspentAdvances, 0, 999),
        invested: clamp(adv.arenaTrack && adv.arenaTrack.invested, 0, 9999),
        lockedInvested: clamp(adv.arenaTrack && adv.arenaTrack.lockedInvested, 0, 9999)
      },
      vocationTrack: {
        level: clamp(adv.vocationTrack && adv.vocationTrack.level, 1, 50),
        filled: clamp(adv.vocationTrack && adv.vocationTrack.filled, 0, 5),
        unspentAdvances: clamp(adv.vocationTrack && adv.vocationTrack.unspentAdvances, 0, 999),
        invested: clamp(adv.vocationTrack && adv.vocationTrack.invested, 0, 9999),
        lockedInvested: clamp(adv.vocationTrack && adv.vocationTrack.lockedInvested, 0, 9999)
      },
      vocationUnlocks: (adv.vocationUnlocks && typeof adv.vocationUnlocks === 'object') ? adv.vocationUnlocks : {}
    };
    const data = JSON.parse(character.character_data);
    data.advancement = sanitized;
    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true });
  } catch (_) {
    return res.status(500).json({ error: 'Failed to update advancement.' });
  }
});

router.patch('/characters/:id/dice', (req, res) => {
  const character = db.prepare('SELECT id, character_data, session_id FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  if (!character.session_id) {
    return res.status(403).json({ error: 'Character is not in an active session.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    const { type, id, newDie } = req.body;
    if (!type) return res.status(400).json({ error: 'Missing type.' });

    if (type === 'discipline' || type === 'arena') {
      if (!id || !newDie || !DIE_STEPS.includes(newDie)) {
        return res.status(400).json({ error: 'Invalid id or die.' });
      }
      const targetIdx = DIE_STEPS.indexOf(newDie);
      if (targetIdx < 1) return res.status(400).json({ error: 'Cannot set to D4 via upgrade.' });

      if (type === 'discipline') {
        const alreadyExpanded = data.arenas && Array.isArray(data.arenas);
        if (alreadyExpanded) {
          let found = false;
          let currentDie = null;
          data.arenas.forEach(a => {
            if (!a.disciplines) return;
            a.disciplines.forEach(d => {
              if (d.id === id) { currentDie = d.die || 'D6'; found = true; }
            });
          });
          if (!found) return res.status(400).json({ error: 'Discipline not found.' });
          const curIdx = DIE_STEPS.indexOf(currentDie);
          if (targetIdx !== curIdx + 1) return res.status(400).json({ error: 'Die must step up by exactly 1.' });
          data.arenas.forEach(a => {
            if (!a.disciplines) return;
            a.disciplines.forEach(d => { if (d.id === id) d.die = newDie; });
          });
        } else {
          if (!data.discValues) data.discValues = {};
          const currentDie = data.discValues[id] || 'D6';
          const curIdx = DIE_STEPS.indexOf(currentDie);
          if (targetIdx !== curIdx + 1) return res.status(400).json({ error: 'Die must step up by exactly 1.' });
          data.discValues[id] = newDie;
        }
      } else {
        const alreadyExpanded = data.arenas && Array.isArray(data.arenas);
        if (alreadyExpanded) {
          const arena = data.arenas.find(a => a.id === id);
          if (!arena) return res.status(400).json({ error: 'Arena not found.' });
          const curIdx = DIE_STEPS.indexOf(arena.die || 'D6');
          if (targetIdx !== curIdx + 1 && !(newDie === 'D10' && (arena.die || 'D6') === 'D12')) {
            return res.status(400).json({ error: 'Die must step up by exactly 1 (or degrade D12→D10 for Apex).' });
          }
          arena.die = newDie;
        } else {
          const species = data.species || 'Human';
          const speciesBase = SPECIES_ARENAS[species] || SPECIES_ARENAS['Human'];
          const baseIdx = DIE_STEPS.indexOf(speciesBase[id] || 'D6');
          const currentAdj = (data.arenaAdj && data.arenaAdj[id]) || 0;
          const curIdx = baseIdx + currentAdj;
          if (targetIdx !== curIdx + 1 && !(DIE_STEPS[curIdx] === 'D12' && newDie === 'D10')) {
            return res.status(400).json({ error: 'Die must step up by exactly 1 (or degrade D12→D10 for Apex).' });
          }
          if (!data.arenaAdj) data.arenaAdj = {};
          data.arenaAdj[id] = targetIdx - baseIdx;
        }
      }
    } else {
      return res.status(400).json({ error: 'Unknown type. Use discipline or arena.' });
    }

    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /dice]', err);
    return res.status(500).json({ error: 'Failed to update dice.' });
  }
});

router.post('/characters/:id/kits', (req, res) => {
  const character = db.prepare('SELECT id, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  try {
    const { kitId } = req.body;
    if (!kitId) return res.status(400).json({ error: 'kitId is required.' });
    const kitDef = KITS_DATA.find(k => k.id === kitId);
    if (!kitDef) return res.status(400).json({ error: 'Unknown vocation.' });

    const data = JSON.parse(character.character_data);
    let kitsObj = data.kits || {};
    if (Array.isArray(kitsObj)) {
      const tmp = {};
      kitsObj.forEach(k => { if (k && k.id) tmp[k.id] = k.tier || 1; });
      kitsObj = tmp;
    }
    if (kitsObj[kitId]) return res.status(400).json({ error: 'Character already has this vocation.' });

    kitsObj[kitId] = 1;
    data.kits = kitsObj;
    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);

    const expanded = expandCharacterData(data);
    return res.json({ ok: true, kits: expanded.kits });
  } catch (err) {
    console.error('[POST /kits]', err);
    return res.status(500).json({ error: 'Failed to add vocation.' });
  }
});

router.patch('/characters/:id/credits', (req, res) => {
  const character = db.prepare('SELECT id, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    const { action, amount } = req.body;
    const amt = parseInt(amount) || 0;
    if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive.' });

    if (action === 'add') {
      data.credits = (data.credits || 0) + amt;
    } else if (action === 'subtract') {
      data.credits = Math.max(0, (data.credits || 0) - amt);
    } else if (action === 'set') {
      data.credits = Math.max(0, amt);
    } else {
      return res.status(400).json({ error: 'Action must be add, subtract, or set.' });
    }

    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true, credits: data.credits });
  } catch (err) {
    console.error('[PATCH /credits]', err);
    return res.status(500).json({ error: 'Failed to update credits.' });
  }
});

router.patch('/characters/:id/debt/pay', (req, res) => {
  const character = db.prepare('SELECT id, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    data.debt = _migrateDebt(data.debt);
    if (!data.debt || !data.debt.balance || data.debt.balance <= 0) {
      return res.status(400).json({ error: 'No outstanding debt.' });
    }
    const amt = parseInt(req.body.amount) || 0;
    if (amt <= 0) return res.status(400).json({ error: 'Payment must be positive.' });
    const available = data.credits || 0;
    if (amt > available) return res.status(400).json({ error: 'Insufficient credits.' });

    const payment = Math.min(amt, data.debt.balance);
    data.credits = available - payment;
    data.debt.balance = Math.round(data.debt.balance - payment);
    if (!data.debt.history) data.debt.history = [];
    data.debt.history.push({ type: 'payment', amount: payment, balanceAfter: data.debt.balance, timestamp: Date.now() });

    if (data.debt.balance <= 0) {
      data.debt.balance = 0;
    }

    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true, credits: data.credits, debt: data.debt });
  } catch (err) {
    console.error('[PATCH /debt/pay]', err);
    return res.status(500).json({ error: 'Failed to process payment.' });
  }
});

router.patch('/characters/:id/debt/accrue', (req, res) => {
  const character = db.prepare('SELECT id, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    data.debt = _migrateDebt(data.debt);
    if (!data.debt || !data.debt.balance || data.debt.balance <= 0) {
      return res.status(400).json({ error: 'No outstanding debt to accrue interest on.' });
    }
    const rate = data.debt.rate || 0;
    const interest = Math.round(data.debt.balance * rate);
    data.debt.balance = data.debt.balance + interest;
    data.debt.cyclesElapsed = (data.debt.cyclesElapsed || 0) + 1;
    if (!data.debt.history) data.debt.history = [];
    data.debt.history.push({ type: 'interest', amount: interest, rate: rate, balanceAfter: data.debt.balance, cycle: data.debt.cyclesElapsed, timestamp: Date.now() });

    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true, debt: data.debt });
  } catch (err) {
    console.error('[PATCH /debt/accrue]', err);
    return res.status(500).json({ error: 'Failed to accrue interest.' });
  }
});

const DEBT_CREDITORS = {
  hutt_cartel: { rate: 0.10 },
  black_sun: { rate: 0.15 },
  imperial_surplus: { rate: 0.20 },
  czerka_arms: { rate: 0.25 },
  local_fixer: { rate: 0.30 },
};
const DEBT_MIN = 1000;
const DEBT_MAX = 10000;

router.post('/characters/:id/debt/take', (req, res) => {
  const character = db.prepare('SELECT id, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    data.debt = _migrateDebt(data.debt);
    if (data.debt && data.debt.balance && data.debt.balance > 0) {
      return res.status(400).json({ error: 'Character already has outstanding debt.' });
    }
    const { creditorId, amount } = req.body;
    const creditor = DEBT_CREDITORS[creditorId];
    if (!creditor) return res.status(400).json({ error: 'Invalid creditor.' });
    const amt = parseInt(amount) || 0;
    if (amt < DEBT_MIN || amt > DEBT_MAX || amt % 500 !== 0) {
      return res.status(400).json({ error: 'Loan must be between ' + DEBT_MIN + ' and ' + DEBT_MAX + ' credits in 500 cr increments.' });
    }

    data.debt = {
      creditorId,
      principal: amt,
      balance: amt,
      rate: creditor.rate,
      cyclesElapsed: 0,
      history: [{ type: 'loan', amount: amt, balanceAfter: amt, timestamp: Date.now() }],
    };
    data.credits = (data.credits || 0) + amt;

    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true, credits: data.credits, debt: data.debt });
  } catch (err) {
    console.error('[POST /debt/take]', err);
    return res.status(500).json({ error: 'Failed to create loan.' });
  }
});

router.post('/characters/:id/purchase', (req, res) => {
  const character = db.prepare('SELECT id, character_data FROM characters WHERE id = ?').get(req.params.id);
  if (!character || !character.character_data) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  try {
    const data = JSON.parse(character.character_data);
    const { items, totalCost } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required.' });
    }
    const cost = parseInt(totalCost) || 0;
    if (cost < 0) return res.status(400).json({ error: 'Invalid cost.' });
    const available = data.credits || 0;
    if (cost > available) {
      return res.status(400).json({ error: 'Insufficient credits.', available, cost });
    }

    data.credits = available - cost;

    if (!data.acquisitionMap) data.acquisitionMap = {};
    if (!Array.isArray(data.armorIds)) {
      data.armorIds = data.armorId ? [data.armorId] : [];
      delete data.armorId;
    }
    items.forEach(item => {
      if (!item.id || !item.type) return;
      if (item.type === 'weapon') {
        if (!data.weaponIds) data.weaponIds = [];
        if (data.weaponIds.indexOf(item.id) === -1) data.weaponIds.push(item.id);
      } else if (item.type === 'armor') {
        if (data.armorIds.indexOf(item.id) === -1) data.armorIds.push(item.id);
      } else if (item.type === 'gear') {
        if (!data.gearIds) data.gearIds = [];
        data.gearIds.push(item.id);
      }
      if (item.acquisition) data.acquisitionMap[item.id] = item.acquisition;
      db.prepare(`
        INSERT INTO equipment_status (character_id, item_id, item_type, status, updated_at)
        VALUES (?, ?, ?, 'stowed', CURRENT_TIMESTAMP)
        ON CONFLICT(character_id, item_id) DO NOTHING
      `).run(character.id, item.id, item.type);
    });

    db.prepare('UPDATE characters SET character_data = ? WHERE id = ?').run(JSON.stringify(data), character.id);
    return res.json({ ok: true, credits: data.credits, itemCount: items.length });
  } catch (err) {
    console.error('[POST /purchase]', err);
    return res.status(500).json({ error: 'Failed to process purchase.' });
  }
});

router.get('/characters/:id/adventure-marks/:adventureId', (req, res) => {
  const { id, adventureId } = req.params;
  try {
    const rows = db.prepare(
      'SELECT mark_id, bucket, claimed_at FROM adventure_marks WHERE character_id = ? AND adventure_id = ?'
    ).all(id, adventureId);
    return res.json({ ok: true, marks: rows });
  } catch (err) {
    console.error('[GET /adventure-marks]', err);
    return res.status(500).json({ error: 'Failed to load adventure marks.' });
  }
});

router.get('/characters/:id/adventure-marks-all', (req, res) => {
  const { id } = req.params;
  try {
    const rows = db.prepare(
      'SELECT adventure_id, mark_id, bucket, claimed_at FROM adventure_marks WHERE character_id = ? ORDER BY adventure_id, claimed_at'
    ).all(id);
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.adventure_id]) grouped[row.adventure_id] = [];
      grouped[row.adventure_id].push({ mark_id: row.mark_id, bucket: row.bucket, claimed_at: row.claimed_at });
    }
    return res.json({ ok: true, adventures: grouped });
  } catch (err) {
    console.error('[GET /adventure-marks-all]', err);
    return res.status(500).json({ error: 'Failed to load adventure marks.' });
  }
});

router.put('/characters/:id/adventure-marks/:adventureId', (req, res) => {
  const { id, adventureId } = req.params;
  const { marks } = req.body;
  if (!Array.isArray(marks)) {
    return res.status(400).json({ error: 'marks must be an array of { mark_id, bucket }.' });
  }
  try {
    const del = db.prepare('DELETE FROM adventure_marks WHERE character_id = ? AND adventure_id = ?');
    const ins = db.prepare(
      'INSERT INTO adventure_marks (character_id, adventure_id, mark_id, bucket) VALUES (?, ?, ?, ?)'
    );
    const txn = db.transaction(() => {
      del.run(id, adventureId);
      for (const m of marks) {
        if (m.mark_id && m.bucket) {
          ins.run(id, adventureId, m.mark_id, m.bucket);
        }
      }
    });
    txn();
    const rows = db.prepare(
      'SELECT mark_id, bucket, claimed_at FROM adventure_marks WHERE character_id = ? AND adventure_id = ?'
    ).all(id, adventureId);
    return res.json({ ok: true, marks: rows });
  } catch (err) {
    console.error('[PUT /adventure-marks]', err);
    return res.status(500).json({ error: 'Failed to save adventure marks.' });
  }
});

router.post('/admin/release-all', (req, res) => {
  db.prepare('DELETE FROM sessions').run();
  db.prepare('UPDATE characters SET session_id = NULL, connected_at = NULL').run();
  res.json({ ok: true, message: 'All character sessions released.' });
});

module.exports = router;

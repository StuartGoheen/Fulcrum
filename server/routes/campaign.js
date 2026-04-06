const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../db');
const { resolveDecisionState, applyAdventureConditionals } = require('../utils/decision-resolver');

const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');
const LOCATIONS_PATH = path.join(__dirname, '..', '..', 'data', 'locations.json');

let adventuresCache = null;
let adventuresCacheMtimes = {};
function loadAdventures() {
  const files = fs.readdirSync(ADVENTURES_DIR).filter(f => /^adv\d+\.json$/.test(f)).sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0], 10);
    const nb = parseInt(b.match(/\d+/)[0], 10);
    return na - nb;
  });
  let needsReload = !adventuresCache;
  if (!needsReload) {
    for (const f of files) {
      const fp = path.join(ADVENTURES_DIR, f);
      try {
        const mtime = fs.statSync(fp).mtimeMs;
        if (!adventuresCacheMtimes[f] || mtime > adventuresCacheMtimes[f]) {
          needsReload = true;
          break;
        }
      } catch (e) {
        needsReload = true;
        break;
      }
    }
  }
  if (needsReload) {
    const adventures = [];
    const newMtimes = {};
    for (const f of files) {
      const fp = path.join(ADVENTURES_DIR, f);
      try {
        const content = fs.readFileSync(fp, 'utf8').trim();
        if (!content) { console.warn('[loadAdventures] Skipping empty file:', f); continue; }
        adventures.push(JSON.parse(content));
        newMtimes[f] = fs.statSync(fp).mtimeMs;
      } catch (parseErr) {
        console.error('[loadAdventures] Failed to parse', f, parseErr.message);
      }
    }
    adventuresCache = { adventures };
    adventuresCacheMtimes = newMtimes;
  }
  return adventuresCache;
}

let locationsCache = null;
let locationsCacheMtime = 0;
function loadLocations() {
  try {
    const stat = fs.statSync(LOCATIONS_PATH);
    const mtime = stat.mtimeMs;
    if (!locationsCache || mtime > locationsCacheMtime) {
      locationsCache = JSON.parse(fs.readFileSync(LOCATIONS_PATH, 'utf8'));
      locationsCacheMtime = mtime;
    }
  } catch (e) {
    if (!locationsCache) {
      locationsCache = JSON.parse(fs.readFileSync(LOCATIONS_PATH, 'utf8'));
    }
  }
  return locationsCache;
}

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/campaign/state', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM campaign_state');
    const state = result.rows.reduce((acc, row) => {
      try { acc[row.key] = JSON.parse(row.value); }
      catch { acc[row.key] = row.value; }
      return acc;
    }, {});
    res.json({ state });
  } catch (err) {
    console.error('[GET /campaign/state]', err);
    res.status(500).json({ error: 'Failed to load campaign state.' });
  }
});

router.get('/campaign/adventures', async (req, res) => {
  try {
    const data = loadAdventures();
    const decisionState = await resolveDecisionState();
    const adapted = {
      adventures: data.adventures.map(adv => applyAdventureConditionals(adv, decisionState))
    };
    adapted._decisionState = decisionState;
    res.json(adapted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load adventures', detail: err.message });
  }
});

router.get('/campaign/adventures/:adventureId', async (req, res) => {
  try {
    const data = loadAdventures();
    const adv = data.adventures.find(a => a.id === req.params.adventureId);
    if (!adv) return res.status(404).json({ error: 'Adventure not found' });
    const decisionState = await resolveDecisionState();
    const adapted = applyAdventureConditionals(adv, decisionState);
    adapted._decisionState = decisionState;
    res.json(adapted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load adventure', detail: err.message });
  }
});

router.get('/campaign/locations', (req, res) => {
  try {
    const data = loadLocations();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load locations', detail: err.message });
  }
});

router.get('/campaign/locations/:locationId', (req, res) => {
  try {
    const data = loadLocations();
    const loc = data.locations.find(l => l.id === req.params.locationId);
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    res.json(loc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load location', detail: err.message });
  }
});

router.get('/campaign/progress', async (req, res) => {
  try {
    const progressResult = await pool.query('SELECT * FROM campaign_progress WHERE id = 1');
    const completionsResult = await pool.query('SELECT scene_id, completed, completed_at, gm_notes FROM scene_completion');
    const completionMap = {};
    completionsResult.rows.forEach(c => { completionMap[c.scene_id] = c; });
    const progress = progressResult.rows.length > 0 ? progressResult.rows[0] : { adventure_id: 'adv1', part_id: 'adv1-p1', scene_id: 'adv1-p1-s1' };
    res.json({ progress, completions: completionMap });
  } catch (err) {
    console.error('[GET /campaign/progress]', err);
    res.status(500).json({ error: 'Failed to load progress.' });
  }
});

router.put('/campaign/progress', async (req, res) => {
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

  try {
    await pool.query(`
      INSERT INTO campaign_progress (id, adventure_id, part_id, scene_id, updated_at)
      VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT(id) DO UPDATE SET
        adventure_id = EXCLUDED.adventure_id,
        part_id = EXCLUDED.part_id,
        scene_id = EXCLUDED.scene_id,
        updated_at = NOW()
    `, [adventure_id, part_id, scene_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/progress]', err);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
});

router.put('/campaign/scene/:sceneId/complete', async (req, res) => {
  const { sceneId } = req.params;
  const { completed, gm_notes } = req.body;
  const isComplete = completed ? 1 : 0;
  try {
    await pool.query(`
      INSERT INTO scene_completion (scene_id, completed, completed_at, gm_notes)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT(scene_id) DO UPDATE SET
        completed = EXCLUDED.completed,
        completed_at = CASE WHEN EXCLUDED.completed = 1 THEN NOW() ELSE NULL END,
        gm_notes = COALESCE(EXCLUDED.gm_notes, scene_completion.gm_notes)
    `, [sceneId, isComplete, gm_notes || null]);

    if (isComplete) {
      try {
        const { extractTagsFromScene, createSceneJournalEntry } = require('./journal');
        await extractTagsFromScene(sceneId);
        await createSceneJournalEntry(sceneId);
      } catch (tagErr) {
        console.error('[scene/complete] Tag extraction / journal entry failed (non-fatal):', tagErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/scene/complete]', err);
    res.status(500).json({ error: 'Failed to update scene.' });
  }
});

function findSceneById(data, sceneId) {
  for (const adv of data.adventures) {
    for (const part of (adv.parts || [])) {
      for (const scene of (part.scenes || [])) {
        if (scene.id === sceneId) return scene;
      }
    }
  }
  return null;
}

function writeAdventures(data) {
  for (const adv of data.adventures) {
    const filename = 'adv' + adv.number + '.json';
    const fp = path.join(ADVENTURES_DIR, filename);
    fs.writeFileSync(fp, JSON.stringify(adv, null, 2), 'utf8');
    adventuresCacheMtimes[filename] = Date.now();
  }
  adventuresCache = data;
}

router.put('/campaign/scene/:sceneId/npc/:npcIndex', (req, res) => {
  const { sceneId, npcIndex } = req.params;
  const idx = parseInt(npcIndex, 10);
  const updatedNpc = req.body;
  if (!updatedNpc || typeof updatedNpc !== 'object') {
    return res.status(400).json({ error: 'NPC data required' });
  }
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.npcs || idx < 0 || idx >= scene.npcs.length) {
      return res.status(404).json({ error: 'NPC index out of range' });
    }
    scene.npcs[idx] = updatedNpc;
    writeAdventures(data);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/scene/npc]', err);
    res.status(500).json({ error: 'Failed to update NPC', detail: err.message });
  }
});

router.post('/campaign/scene/:sceneId/npc', (req, res) => {
  const { sceneId } = req.params;
  const newNpc = req.body;
  if (!newNpc || typeof newNpc !== 'object') {
    return res.status(400).json({ error: 'NPC data required' });
  }
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.npcs) scene.npcs = [];
    scene.npcs.push(newNpc);
    writeAdventures(data);
    res.json({ success: true, index: scene.npcs.length - 1 });
  } catch (err) {
    console.error('[POST /campaign/scene/npc]', err);
    res.status(500).json({ error: 'Failed to add NPC', detail: err.message });
  }
});

router.delete('/campaign/scene/:sceneId/npc/:npcIndex', (req, res) => {
  const { sceneId, npcIndex } = req.params;
  const idx = parseInt(npcIndex, 10);
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.npcs || idx < 0 || idx >= scene.npcs.length) {
      return res.status(404).json({ error: 'NPC index out of range' });
    }
    scene.npcs.splice(idx, 1);
    writeAdventures(data);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /campaign/scene/npc]', err);
    res.status(500).json({ error: 'Failed to remove NPC', detail: err.message });
  }
});

router.put('/campaign/scene/:sceneId/positions', (req, res) => {
  const { sceneId } = req.params;
  const positions = req.body;
  if (!positions || typeof positions !== 'object') {
    return res.status(400).json({ error: 'Positions data required' });
  }
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.tacticalMap) scene.tacticalMap = {};
    scene.tacticalMap.gmStartingPositions = positions;
    writeAdventures(data);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/scene/positions]', err);
    res.status(500).json({ error: 'Failed to update positions', detail: err.message });
  }
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

const ARENA_META = [
  { id: 'physique', disciplines: ['athletics','brawl','endure','melee','heavy_weapons'] },
  { id: 'reflex', disciplines: ['evasion','piloting','ranged','skulduggery','stealth'] },
  { id: 'grit', disciplines: ['beast_handling','intimidate','resolve','survival','control_spark'] },
  { id: 'wits', disciplines: ['investigation','medicine','tactics','tech','sense_spark'] },
  { id: 'presence', disciplines: ['charm','deception','insight','persuasion','alter_spark'] },
];

const CHALLENGE_CLUSTERS = {
  social:        ['charm','deception','insight','persuasion','intimidate'],
  combat:        ['ranged','brawl','melee','evasion','heavy_weapons','tactics'],
  infiltration:  ['stealth','skulduggery','deception','tech','evasion'],
  survival:      ['survival','athletics','endure','medicine','beast_handling'],
  technical:     ['tech','piloting','investigation','medicine','skulduggery'],
  force:         ['control_spark','sense_spark','alter_spark','resolve','insight'],
};

const DIE_ORDER = ['D4','D6','D8','D10','D12'];

function dieRank(d) {
  const idx = DIE_ORDER.indexOf((d || '').toUpperCase());
  return idx === -1 ? 0 : idx;
}

const WEAPONS_PATH = path.join(__dirname, '..', '..', 'data', 'weapons.json');
const ARMOR_PATH = path.join(__dirname, '..', '..', 'data', 'armor.json');
const GEAR_PATH = path.join(__dirname, '..', '..', 'data', 'gear.json');
const DESTINIES_PATH = path.join(__dirname, '..', '..', 'data', 'destinies.json');
const PHASES_PATH = path.join(__dirname, '..', '..', 'data', 'phases.json');
const SPECIES_PATH = path.join(__dirname, '..', '..', 'data', 'species.json');

let equipmentCache = null;
function loadEquipment() {
  if (!equipmentCache) {
    const weapons = JSON.parse(fs.readFileSync(WEAPONS_PATH, 'utf8'));
    const armor = JSON.parse(fs.readFileSync(ARMOR_PATH, 'utf8'));
    const gear = JSON.parse(fs.readFileSync(GEAR_PATH, 'utf8'));
    equipmentCache = {};
    const index = (arr) => { (Array.isArray(arr) ? arr : []).forEach(item => { if (item.id) equipmentCache[item.id] = item; }); };
    index(weapons.weapons || weapons);
    index(armor.armor || armor);
    index(gear.gear || gear);
  }
  return equipmentCache;
}

let destiniesCache = null;
function loadDestinies() {
  if (!destiniesCache) {
    const raw = JSON.parse(fs.readFileSync(DESTINIES_PATH, 'utf8'));
    destiniesCache = raw.destinies || raw;
  }
  return destiniesCache;
}

let phasesCache = null;
function loadPhases() {
  if (!phasesCache) {
    phasesCache = JSON.parse(fs.readFileSync(PHASES_PATH, 'utf8'));
  }
  return phasesCache;
}

let speciesCache = null;
function loadSpecies() {
  if (!speciesCache) {
    const raw = JSON.parse(fs.readFileSync(SPECIES_PATH, 'utf8'));
    speciesCache = Array.isArray(raw) ? raw : (raw.species || []);
  }
  return speciesCache;
}

const BACKGROUND_FAVORED = {
  'deep-fringe': 'survival', 'shadowed-levels': 'stealth', 'salvage-yards': 'tech',
  'coreward-spires': 'persuasion', 'agrarian-plain': 'resolve', 'war-front': 'evasion',
  'ancient-ruin': 'investigation', 'trading-post': 'insight', 'detention-block': 'endure',
  'shipboard-born': 'piloting', 'labor-camp': 'athletics', 'enclave': 'charm',
  'disbanded-regular': 'tactics', 'separatist-holdout': 'ranged', 'imperial-defector': 'deception',
  'blockade-runner': 'piloting', 'pacification-survivor': 'survival', 'field-medic': 'medicine',
  'syndicate-enforcer': 'intimidate', 'post-war-tracker': 'investigation', 'purge-survivor': 'stealth',
  'wreck': 'endure', 'ascent': 'persuasion', 'betrayal': 'insight',
  'shadow-stalked': 'stealth', 'hutt-marked': 'survival',
};

function extractCharacterProfile(data) {
  let destiny = null;
  const rawDest = data.destiny;
  if (rawDest) {
    const destId = typeof rawDest === 'string' ? rawDest : (rawDest.id || null);
    if (destId) {
      const destDefs = loadDestinies();
      const destDef = (Array.isArray(destDefs) ? destDefs : []).find(d => d.id === destId);
      if (destDef) {
        destiny = {
          id: destDef.id,
          name: destDef.name || destId,
          coreQuestion: destDef.coreQuestion || null,
          hopeRecovery: destDef.hopeRecovery ? { title: destDef.hopeRecovery.title || null, description: destDef.hopeRecovery.description || null } : null,
          tollRecovery: destDef.tollRecovery ? { title: destDef.tollRecovery.title || null, description: destDef.tollRecovery.description || null } : null,
        };
      } else {
        destiny = { id: destId, name: destId, coreQuestion: null, hopeRecovery: null, tollRecovery: null };
      }
    }
  }

  const backgroundPhases = [];
  ['phase1','phase2','phase3'].forEach(key => {
    const val = data[key];
    if (val) {
      let phaseId = null;
      let phaseTitle = null;
      if (typeof val === 'string') {
        phaseId = val.toLowerCase().replace(/\s+/g, '-').replace(/^the-/, '');
        phaseTitle = val;
      } else if (val.id || val.title || val.name) {
        phaseId = val.id || null;
        phaseTitle = val.title || val.name || null;
      }
      const favored = phaseId ? (BACKGROUND_FAVORED[phaseId] || null) : null;
      backgroundPhases.push({ phase: key, id: phaseId, title: phaseTitle, favoredDiscipline: favored });
    }
  });

  const vocations = [];
  const kitFavoredDiscs = [];
  if (data.kits && typeof data.kits === 'object' && !Array.isArray(data.kits)) {
    Object.entries(data.kits).forEach(([kitId, tier]) => {
      vocations.push({ kitId, name: null, tier: tier || 0 });
    });
  } else if (data.kits && Array.isArray(data.kits)) {
    data.kits.forEach(k => {
      vocations.push({ kitId: k.id || null, name: k.name || null, tier: k.tier || k.currentTier || 0 });
      if (k.favoredDiscipline) kitFavoredDiscs.push(k.favoredDiscipline);
    });
  }

  try {
    if (!extractCharacterProfile._kitsCache) {
      const kitsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'kits.json'), 'utf8'));
      extractCharacterProfile._kitsCache = kitsData.kits || kitsData;
    }
    const kitsArr = extractCharacterProfile._kitsCache;
    vocations.forEach(v => {
      const kitDef = (Array.isArray(kitsArr) ? kitsArr : []).find(k => k.id === v.kitId);
      if (kitDef) {
        if (!v.name) v.name = kitDef.name || v.kitId;
        if (kitDef.favoredDiscipline) kitFavoredDiscs.push(kitDef.favoredDiscipline);
      }
    });
  } catch (e) {}

  let backgroundFavored = data.backgroundFavored || [];
  if (!backgroundFavored.length) {
    backgroundPhases.forEach(bp => {
      if (bp.id) {
        const fav = BACKGROUND_FAVORED[bp.id];
        if (fav && !backgroundFavored.includes(fav)) backgroundFavored.push(fav);
      }
    });
  }

  const SPECIES_ARENAS = {
    'Human':   { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    "Twi'lek": { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Wookiee': { physique: 'D8', reflex: 'D4', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Duros':   { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Zabrak':  { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Kel Dor': { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D8', presence: 'D6' },
    'Togruta': { physique: 'D4', reflex: 'D8', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Rodian':  { physique: 'D6', reflex: 'D8', grit: 'D6', wits: 'D6', presence: 'D4' },
    'Sullustan': { physique: 'D4', reflex: 'D6', grit: 'D6', wits: 'D8', presence: 'D6' },
    'Cathar':  { physique: 'D6', reflex: 'D6', grit: 'D8', wits: 'D4', presence: 'D6' },
  };
  const ARENA_DISC_MAP = [
    { id: 'physique', discs: ['athletics','brawl','endure','melee','heavy_weapons'] },
    { id: 'reflex', discs: ['evasion','piloting','ranged','skulduggery','stealth'] },
    { id: 'grit', discs: ['beast_handling','intimidate','resolve','survival','control_spark'] },
    { id: 'wits', discs: ['investigation','medicine','tactics','tech','sense_spark'] },
    { id: 'presence', discs: ['charm','deception','insight','persuasion','alter_spark'] },
  ];
  const DIE_STEPS = ['D4', 'D6', 'D8', 'D10', 'D12'];

  const rawSpeciesStr = typeof data.species === 'string' ? data.species : (data.species && data.species.id ? data.species.id : 'Human');
  const speciesBase = SPECIES_ARENAS[rawSpeciesStr] || SPECIES_ARENAS['Human'];
  const arenaAdj = data.arenaAdj || {};
  const discValuesMap = data.discValues || {};

  const disciplines = {};
  const arenas = {};
  ARENA_DISC_MAP.forEach(arena => {
    const baseIdx = DIE_STEPS.indexOf(speciesBase[arena.id] || 'D6');
    const adj = arenaAdj[arena.id] || 0;
    const finalIdx = Math.max(0, Math.min(DIE_STEPS.length - 1, baseIdx + adj));
    arenas[arena.id] = DIE_STEPS[finalIdx];

    arena.discs.forEach(discId => {
      const discDie = discValuesMap[discId] || 'D6';
      const isFavored = backgroundFavored.includes(discId) || kitFavoredDiscs.includes(discId);
      const isTrained = dieRank(discDie) > dieRank('D4');
      disciplines[discId] = {
        training: isTrained ? 'trained' : 'untrained',
        favored: isFavored,
        die: discDie,
      };
    });
  });

  const equipDb = loadEquipment();
  const gear = [];
  const gearSeen = {};
  const startingGear = Array.isArray(data.startingGear) ? data.startingGear : [];
  const removals = data.inventoryRemovals || {};
  const removedIds = [].concat(removals.gear || [], removals.weapons || [], Array.isArray(removals.armor) ? removals.armor : []);

  startingGear.forEach(sg => {
    if (!sg || !sg.id) return;
    if (removedIds.includes(sg.id)) return;
    gearSeen[sg.id] = true;
    const item = equipDb[sg.id];
    if (item) {
      gear.push({
        id: item.id,
        name: item.name || sg.name || 'Unknown',
        type: item.type || sg.source || 'gear',
        tags: item.tags || [],
        traits: (item.traits || []).map(t => (typeof t === 'string' ? t : t.name || '')),
        availability: item.availability || sg.legalStatus || null,
      });
    } else {
      gear.push({
        id: sg.id,
        name: sg.name || 'Unknown',
        type: sg.source || 'gear',
        tags: [],
        traits: [],
        availability: sg.legalStatus || null,
      });
    }
  });
  const purchasedIds = [].concat(data.weaponIds || [], data.armorIds || [], data.gearIds || []);
  purchasedIds.forEach(itemId => {
    if (gearSeen[itemId] || removedIds.includes(itemId)) return;
    gearSeen[itemId] = true;
    const item = equipDb[itemId];
    if (item) {
      gear.push({
        id: item.id,
        name: item.name || 'Unknown',
        type: item.type || 'gear',
        tags: item.tags || [],
        traits: (item.traits || []).map(t => (typeof t === 'string' ? t : t.name || '')),
        availability: item.availability || null,
      });
    }
  });

  const conditions = [];
  if (data.conditions && Array.isArray(data.conditions)) {
    data.conditions.forEach(c => {
      if (typeof c === 'string') conditions.push(c);
      else if (c.name) conditions.push(c.name);
    });
  }

  const vocationAbilities = [];
  vocations.forEach(v => {
    if (!extractCharacterProfile._kitsCache) return;
    const kitDef = (Array.isArray(extractCharacterProfile._kitsCache) ? extractCharacterProfile._kitsCache : []).find(k => k.id === v.kitId);
    const abilitiesList = kitDef ? (kitDef.abilities || kitDef.tiers || []) : [];
    if (Array.isArray(abilitiesList)) {
      abilitiesList.forEach(t => {
        if (t.tier <= v.tier) {
          vocationAbilities.push({ vocation: v.name || v.kitId, tier: t.tier, name: t.name || t.id, type: t.type || null });
        }
      });
    }
  });

  const knacks = [];
  const phase3Entry = backgroundPhases.find(bp => bp.phase === 'phase3');
  if (phase3Entry && phase3Entry.id) {
    try {
      const phasesData = loadPhases();
      const phase3List = phasesData.phase3 || [];
      const phase3Def = phase3List.find(p => p.id === phase3Entry.id);
      if (phase3Def && phase3Def._meta) {
        knacks.push({
          phaseId: phase3Def.id,
          knackName: phase3Def._meta.knackName || null,
          knackType: phase3Def._meta.knackType || null,
          knack: phase3Def._meta.knack || null,
        });
      }
    } catch (e) {}
  }

  let species = null;
  const rawSpecies = typeof data.species === 'string' ? data.species : (data.species && data.species.id ? data.species.id : null);
  if (rawSpecies) {
    const speciesIdNorm = rawSpecies.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/keldor/,'keldor');
    try {
      const speciesList = loadSpecies();
      const specDef = speciesList.find(s => s.id === speciesIdNorm || s.name && s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === speciesIdNorm);
      if (specDef) {
        const bioTruth = specDef.biologicalTruth;
        const spTrait = specDef.speciesTrait;
        species = {
          id: specDef.id,
          name: specDef.name || rawSpecies,
          biologicalTruth: bioTruth ? (typeof bioTruth === 'string' ? bioTruth : bioTruth.desc || bioTruth.name || null) : null,
          biologicalTruthName: bioTruth && typeof bioTruth === 'object' ? bioTruth.name || null : null,
          speciesTrait: spTrait ? (typeof spTrait === 'string' ? spTrait : spTrait.desc || spTrait.name || null) : null,
          speciesTraitName: spTrait && typeof spTrait === 'object' ? spTrait.name || null : null,
        };
      } else {
        species = { id: speciesIdNorm, name: rawSpecies, biologicalTruth: null, speciesTrait: null };
      }
    } catch (e) {}
  }

  const backgroundEnvironments = [];
  const backgroundThemes = [];
  backgroundPhases.forEach(bp => {
    if (!bp.id) return;
    try {
      const phasesData = loadPhases();
      const phaseKey = bp.phase;
      const phaseList = phasesData[phaseKey] || [];
      const phaseDef = phaseList.find(p => p.id === bp.id);
      if (phaseDef && phaseDef._meta) {
        if (phaseDef._meta.environment) {
          backgroundEnvironments.push(phaseDef._meta.environment);
        }
        if (phaseDef._meta.themes && Array.isArray(phaseDef._meta.themes)) {
          phaseDef._meta.themes.forEach(t => {
            if (!backgroundThemes.includes(t)) backgroundThemes.push(t);
          });
        }
      }
    } catch (e) {}
  });

  return { destiny, backgroundPhases, backgroundFavored, backgroundEnvironments, backgroundThemes, vocations, vocationAbilities, disciplines, arenas, gear, conditions, knacks, species };
}

router.get('/campaign/party', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, session_id, character_data
      FROM characters
      WHERE character_data IS NOT NULL AND session_id IS NOT NULL
    `);
    const party = result.rows.map(c => {
      let data = {};
      try { data = JSON.parse(c.character_data); } catch {}
      const adv = data.advancement || {};
      const earnedChecks = (adv.marks && adv.marks.earnedChecks) || {};
      const TRIGGER_VALUES = { destiny_milestone: 2 };
      let earnedMarks = 0;
      Object.entries(earnedChecks).forEach(([k, v]) => { if (v) earnedMarks += (TRIGGER_VALUES[k] || 1); });
      const totalMarks = (adv.marks && adv.marks.totalBanked || 0) + earnedMarks;

      const profile = extractCharacterProfile(data);

      return {
        id: c.id,
        name: c.name,
        connected: !!c.session_id,
        vitality: data.computed?.vitality || data.vitality || null,
        species: data.species || null,
        archetype: data.archetype || null,
        marks: totalMarks,
        destiny: profile.destiny,
        backgroundPhases: profile.backgroundPhases,
        backgroundFavored: profile.backgroundFavored,
        vocations: profile.vocations,
        vocationAbilities: profile.vocationAbilities,
        disciplines: profile.disciplines,
        arenas: profile.arenas,
        gear: profile.gear,
        conditions: profile.conditions,
      };
    });
    res.json({ party });
  } catch (err) {
    console.error('[GET /campaign/party]', err);
    res.status(500).json({ error: 'Failed to load party.' });
  }
});

router.get('/campaign/scene-intel/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const data = loadAdventures();
    let scene = null;
    data.adventures.forEach(adv => {
      (adv.parts || []).forEach(part => {
        (part.scenes || []).forEach(s => {
          if (s.id === sceneId) scene = s;
        });
      });
    });

    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const hasTags = scene.challengeType || (scene.destinyTags && scene.destinyTags.length) ||
      (scene.vocationTags && scene.vocationTags.length) || (scene.disciplineTags && scene.disciplineTags.length) ||
      (scene.gearFlags && scene.gearFlags.length) || (scene.knackTags && scene.knackTags.length) ||
      (scene.speciesTags && scene.speciesTags.length) || (scene.backgroundTags && scene.backgroundTags.length) ||
      (scene.themeTags && scene.themeTags.length);

    if (!hasTags) return res.json({ sceneId, hasTags: false, intel: [] });

    const result = await pool.query(`
      SELECT id, name, session_id, character_data
      FROM characters WHERE character_data IS NOT NULL AND session_id IS NOT NULL
    `);

    const intel = result.rows.map(c => {
      let cData = {};
      try { cData = JSON.parse(c.character_data); } catch {}
      const profile = extractCharacterProfile(cData);
      const insights = [];

      if (scene.destinyTags && scene.destinyTags.length && profile.destiny) {
        const destinyId = profile.destiny.id || '';
        const destinyName = profile.destiny.name || destinyId;
        if (scene.destinyTags.includes(destinyId)) {
          insights.push({ type: 'destiny', icon: '✦', label: 'Destiny resonance: ' + destinyName.replace(/_/g, ' ') });
        }
      }

      if (scene.vocationTags && scene.vocationTags.length && profile.vocations.length) {
        profile.vocations.forEach(voc => {
          if (scene.vocationTags.includes(voc.kitId)) {
            insights.push({ type: 'vocation', icon: '⚔', label: (voc.name || voc.kitId) + ' (Tier ' + (voc.tier || 1) + ')' });
          }
        });
      }

      if (scene.disciplineTags && scene.disciplineTags.length) {
        const strong = [];
        scene.disciplineTags.forEach(discId => {
          const disc = profile.disciplines[discId];
          if (disc && (disc.training === 'trained' || disc.training === 'formative' || disc.favored)) {
            const arenaId = ARENA_META.find(a => a.disciplines.includes(discId))?.id;
            const arenaDie = arenaId && profile.arenas[arenaId] ? profile.arenas[arenaId] : null;
            strong.push({ id: discId, favored: disc.favored, die: arenaDie });
          }
        });
        if (strong.length) {
          strong.sort((a, b) => {
            if (a.favored !== b.favored) return b.favored ? 1 : -1;
            return dieRank(b.die) - dieRank(a.die);
          });
          const top = strong.slice(0, 3);
          const labels = top.map(s => {
            let lbl = s.id.replace(/_/g, ' ');
            if (s.favored) lbl += ' ★';
            if (s.die) lbl += ' (' + s.die + ')';
            return lbl;
          });
          insights.push({ type: 'discipline', icon: '◈', label: 'Key skills: ' + labels.join(', ') });
        }
      }

      if (scene.gearFlags && scene.gearFlags.length && profile.gear.length) {
        const relevant = [];
        const missing = [];
        scene.gearFlags.forEach(flag => {
          const flagLower = flag.toLowerCase();
          const matchingGear = profile.gear.filter(g =>
            g.tags.some(t => t.toLowerCase() === flagLower) ||
            g.traits.some(t => t.toLowerCase() === flagLower) ||
            (g.availability && g.availability.toLowerCase() === flagLower)
          );
          if (matchingGear.length) {
            relevant.push({ flag, items: matchingGear.map(g => g.name) });
          } else {
            missing.push(flag);
          }
        });
        if (relevant.length) {
          const labels = relevant.map(r => r.flag + ': ' + r.items.join(', '));
          insights.push({ type: 'gear', icon: '🎒', label: 'Relevant gear: ' + labels.join('; ') });
        }
        if (missing.length) {
          insights.push({ type: 'gear_gap', icon: '⚠', label: 'Missing gear tags: ' + missing.join(', ') });
        }
      }

      if (scene.knackTags && scene.knackTags.length && profile.knacks && profile.knacks.length) {
        profile.knacks.forEach(knack => {
          if (scene.knackTags.includes(knack.knackType) || scene.knackTags.includes(knack.phaseId)) {
            insights.push({ type: 'knack', icon: '🔑', label: (knack.knackName || 'Knack') + ': ' + (knack.knack || knack.knackType) });
          }
        });
      }

      if (scene.speciesTags && scene.speciesTags.length && profile.species) {
        const spName = (profile.species.name || '').toLowerCase();
        if (scene.speciesTags.some(t => t.toLowerCase() === spName || t.toLowerCase() === (profile.species.id || ''))) {
          const parts = [profile.species.name];
          if (profile.species.biologicalTruthName) parts.push(profile.species.biologicalTruthName);
          if (profile.species.speciesTraitName) parts.push(profile.species.speciesTraitName);
          insights.push({ type: 'species', icon: '🧬', label: parts.join(' — ') });
        }
      }

      if (scene.backgroundTags && scene.backgroundTags.length && profile.backgroundPhases.length) {
        profile.backgroundPhases.forEach(bp => {
          if (bp.id && scene.backgroundTags.includes(bp.id)) {
            insights.push({ type: 'background', icon: '📜', label: (bp.title || bp.id) + (bp.favoredDiscipline ? ' (favored: ' + bp.favoredDiscipline + ')' : '') });
          }
        });
      }

      if (scene.themeTags && scene.themeTags.length && profile.backgroundThemes && profile.backgroundThemes.length) {
        const matchedThemes = scene.themeTags.filter(t => profile.backgroundThemes.includes(t));
        if (matchedThemes.length) {
          insights.push({ type: 'theme', icon: '🎭', label: 'Thematic resonance: ' + matchedThemes.join(', ') });
        }
      }

      if (scene.challengeType && profile.disciplines) {
        const cluster = CHALLENGE_CLUSTERS[scene.challengeType];
        if (cluster) {
          const strong = [];
          cluster.forEach(discId => {
            const disc = profile.disciplines[discId];
            if (disc && (disc.training === 'trained' || disc.favored)) {
              strong.push(discId);
            }
          });
          if (strong.length) {
            insights.push({ type: 'challenge', icon: '⚡', label: scene.challengeType + ' challenge — trained in: ' + strong.join(', ') });
          }
        }
      }

      return { characterId: c.id, name: c.name, insights };
    });

    res.json({ sceneId, hasTags: true, intel });
  } catch (err) {
    console.error('[GET /campaign/scene-intel]', err);
    res.status(500).json({ error: 'Failed to generate scene intel.' });
  }
});

const { GoogleGenerativeAI } = require('@google/generative-ai');

const BIBLE_PATH = path.join(__dirname, '..', '..', 'data', 'campaign-bible.md');

function extractBibleContext(adventureId) {
  let bibleText = '';
  try {
    bibleText = fs.readFileSync(BIBLE_PATH, 'utf8');
  } catch (e) {
    return { themes: '', synopsis: '', characters: '' };
  }

  const themesMatch = bibleText.match(/## Core Themes\n([\s\S]*?)(?=\n---|\n## )/);
  const themes = themesMatch ? themesMatch[1].trim().substring(0, 800) : '';

  const advNum = adventureId.replace(/\D/g, '');
  const synopsisRegex = new RegExp('### Adventure ' + advNum + ':[^\n]*\n([\\s\\S]*?)(?=\\n---\\n|\\n### Adventure \\d)');
  const synopsisMatch = bibleText.match(synopsisRegex);
  const synopsis = synopsisMatch ? synopsisMatch[1].trim().substring(0, 2000) : '';

  const characterNames = ['Maya', 'Admiral Gilder Varth', 'Jedi Master Denia', 'Varga the Hutt', 'Inquisitor Valin Draco', 'Soren Vex'];
  const charSnippets = [];
  for (const name of characterNames) {
    const charRegex = new RegExp('### ' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\n([\\s\\S]*?)(?=\n### |\\n---\\n|\\n## )');
    const match = bibleText.match(charRegex);
    if (match) {
      const lines = match[1].split('\n').slice(0, 4).join('\n');
      charSnippets.push(name + ': ' + lines.trim());
    }
  }
  const characters = charSnippets.join('\n\n').substring(0, 1500);

  return { themes, synopsis, characters };
}

async function assembleMissionContext(adventureId) {
  const data = loadAdventures();
  const decisionState = await resolveDecisionState();
  const rawAdv = data.adventures.find(a => a.id === adventureId);
  if (!rawAdv) return null;
  const adv = applyAdventureConditionals(rawAdv, decisionState);

  const allSceneIds = [];
  for (const part of (adv.parts || [])) {
    for (const scene of (part.scenes || [])) {
      allSceneIds.push(scene.id);
    }
  }

  const completionsResult = await pool.query(
    'SELECT scene_id, completed, gm_notes FROM scene_completion WHERE scene_id = ANY($1)',
    [allSceneIds]
  );
  const completionMap = {};
  completionsResult.rows.forEach(c => { completionMap[c.scene_id] = c; });

  const decisionsResult = await pool.query(
    'SELECT decision_key, choice, outcome, campaign_impact FROM campaign_decisions WHERE adventure_id = $1 ORDER BY created_at ASC',
    [adventureId]
  );

  const journalResult = await pool.query(
    'SELECT title, body, author_character_name, source_scene_id FROM journal_entries WHERE source_scene_id = ANY($1) ORDER BY created_at ASC',
    [allSceneIds]
  );

  const crewResult = await pool.query(
    'SELECT name, character_data FROM characters ORDER BY slot_index ASC'
  );
  const crewRoster = crewResult.rows.map(c => {
    let species = '', vocation = '';
    if (c.character_data) {
      try {
        const d = JSON.parse(c.character_data);
        species = typeof d.species === 'string' ? d.species : '';
        vocation = typeof d.vocation === 'string' ? d.vocation : (typeof d.title === 'string' ? d.title : '');
      } catch (e) {}
    }
    return { name: c.name, species, vocation };
  });

  const sceneSummaries = [];
  for (const part of (adv.parts || [])) {
    for (const scene of (part.scenes || [])) {
      const comp = completionMap[scene.id];
      const isComplete = comp && comp.completed;
      const completionNotes = comp ? (comp.gm_notes || '') : '';
      const authoredNotes = scene.gmNotes || '';
      const combinedNotes = [authoredNotes, completionNotes].filter(Boolean).join(' | ');
      sceneSummaries.push({
        id: scene.id,
        title: scene.title,
        subtitle: scene.subtitle || '',
        challengeType: scene.challengeType || '',
        completed: !!isComplete,
        gmNotes: combinedNotes,
        npcs: (scene.npcs || []).map(n => n.name).filter(Boolean),
        decisions: (scene.decisions || []).map(d => d.choice + ' -> ' + d.consequence)
      });
    }
  }

  const bible = extractBibleContext(adventureId);

  return {
    adventure: {
      id: adv.id,
      title: adv.title,
      number: adv.number,
      act: adv.act,
      summary: adv.summary || ''
    },
    scenes: sceneSummaries,
    decisions: decisionsResult.rows,
    journalEntries: journalResult.rows,
    crewRoster,
    bible
  };
}

function buildMissionSummaryPrompt(ctx) {
  const crewList = ctx.crewRoster.map(c => {
    let label = c.name;
    if (c.species) label += ` (${c.species})`;
    if (c.vocation) label += ` — ${c.vocation}`;
    return label;
  }).join('\n  ');

  const sceneNarrative = ctx.scenes.map(s => {
    let line = `- "${s.title}"`;
    if (s.subtitle) line += ` — ${s.subtitle}`;
    if (s.challengeType) line += ` [${s.challengeType}]`;
    if (!s.completed) line += ' (not completed)';
    if (s.npcs.length) line += `\n    NPCs: ${s.npcs.join(', ')}`;
    if (s.gmNotes) line += `\n    GM Notes: ${s.gmNotes}`;
    return line;
  }).join('\n');

  const decisionsText = ctx.decisions.length
    ? ctx.decisions.map(d => {
        let line = `- ${d.decision_key}: chose "${d.choice}"`;
        if (d.outcome) line += ` — outcome: ${d.outcome}`;
        if (d.campaign_impact) line += ` [impact: ${d.campaign_impact}]`;
        return line;
      }).join('\n')
    : 'No recorded decisions for this adventure.';

  const journalText = ctx.journalEntries.length
    ? ctx.journalEntries.slice(0, 20).map(e => {
        let line = `- "${e.title}" by ${e.author_character_name}`;
        if (e.body) line += `\n    ${e.body.substring(0, 300)}`;
        return line;
      }).join('\n')
    : 'No journal entries recorded.';

  const bible = ctx.bible || {};
  let bibleSection = '';
  if (bible.synopsis) {
    bibleSection += `\nADVENTURE NARRATIVE CONTEXT (from campaign bible — use this to inform tone, stakes, and character motivations):\n${bible.synopsis}\n`;
  }
  if (bible.themes) {
    bibleSection += `\nCAMPAIGN THEMES:\n${bible.themes}\n`;
  }
  if (bible.characters) {
    bibleSection += `\nMAJOR NPC PROFILES:\n${bible.characters}\n`;
  }

  return `You are a military intelligence analyst in the Star Wars galaxy, 16 BBY. You are writing an After Action Report — a classified field debrief — for a crew of mercenaries operating in the Outer Rim.

SETTING: The Galactic Empire is two years old. The Clone Wars are recent memory. This crew operates on the fringe, doing grey-market work that gradually pulls them into something bigger and more dangerous.

TONE: Write in a clipped, professional, third-person past tense voice — like a Rebel Alliance intelligence officer reconstructing events from field reports. No flowery prose. No omniscient narrator. The analyst knows what the crew did and what choices they made, but interprets events through the lens of someone piecing together the story after the fact. Use specific names and details from the data provided. Reference crew members by name. Reference key NPCs and their fates where relevant.
${bibleSection}
ADVENTURE: Episode ${ctx.adventure.number} — "${ctx.adventure.title}" (Act ${ctx.adventure.act})${ctx.adventure.summary ? '\nADVENTURE BRIEF: ' + ctx.adventure.summary : ''}

CREW ROSTER:
  ${crewList || 'Unknown crew complement'}

SCENE PROGRESSION:
${sceneNarrative}

KEY DECISIONS MADE:
${decisionsText}

FIELD JOURNAL EXCERPTS:
${journalText}

INSTRUCTIONS:
Write 2-4 paragraphs summarizing this adventure as a post-mission After Action Report. Include:
1. What the crew set out to do and what they encountered
2. Significant choices they made and their consequences — if decisions involve character fates (deaths, rescues, betrayals), state those outcomes explicitly
3. Notable NPCs they interacted with and what happened to them
4. The outcome and any unresolved threads that carry forward

If scenes are marked "not completed", treat the adventure as still in progress and note that the report is preliminary.

Return your response as JSON with a single field:
{ "summary": "the full After Action Report text here" }`;
}

router.post('/campaign/adventures/:adventureId/summary', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured.' });
  }

  const { adventureId } = req.params;
  let ctx;
  try {
    ctx = await assembleMissionContext(adventureId);
  } catch (assemblyErr) {
    console.error('[mission-summary] Context assembly failed:', assemblyErr.message);
    return res.status(500).json({ error: 'Failed to assemble mission context.' });
  }
  if (!ctx) {
    return res.status(404).json({ error: 'Adventure not found.' });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  });

  const prompt = buildMissionSummaryPrompt(ctx);
  const timeoutMs = 30000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
  );

  async function attemptGenerate(retries) {
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);

    const text = result.response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (__) {}
      }
      if (!parsed) {
        const summaryMatch = text.match(/"summary"\s*:\s*"([\s\S]+?)(?:"|$)/);
        if (summaryMatch) {
          parsed = { summary: summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
        }
      }
      if (!parsed) {
        if (retries < 1) return { ok: false, retry: true };
        return { ok: false, status: 500, body: { error: 'The report came back garbled. Try again.' } };
      }
    }

    return { ok: true, body: { summary: parsed.summary || '' } };
  }

  try {
    let result = await attemptGenerate(0);
    if (result.ok) return res.json(result.body);
    if (result.retry) {
      console.warn('[mission-summary] Truncated — retrying...');
      await new Promise(r => setTimeout(r, 1000));
      try {
        const retry = await attemptGenerate(1);
        if (retry.ok) return res.json(retry.body);
        return res.status(retry.status).json(retry.body);
      } catch (retryErr) {
        return res.status(500).json({ error: 'Generation failed. Try again.' });
      }
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[mission-summary] Rate-limited — retrying after 3s...');
      await new Promise(r => setTimeout(r, 3000));
      try {
        const retry = await attemptGenerate(1);
        if (retry.ok) return res.json(retry.body);
        return res.status(retry.status).json(retry.body);
      } catch (retryErr) {
        return res.status(429).json({ error: 'rate_limit' });
      }
    }
    if (msg === 'TIMEOUT') {
      return res.status(504).json({ error: 'timeout' });
    }
    console.error('[mission-summary] Gemini error:', msg);
    return res.status(500).json({ error: 'Generation failed. Try again.' });
  }
});

module.exports = router;

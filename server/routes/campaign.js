const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');

const ADVENTURES_PATH = path.join(__dirname, '..', '..', 'data', 'adventures.json');

let adventuresCache = null;
let adventuresCacheMtime = 0;
function loadAdventures() {
  try {
    const stat = fs.statSync(ADVENTURES_PATH);
    const mtime = stat.mtimeMs;
    if (!adventuresCache || mtime > adventuresCacheMtime) {
      adventuresCache = JSON.parse(fs.readFileSync(ADVENTURES_PATH, 'utf8'));
      adventuresCacheMtime = mtime;
    }
  } catch (e) {
    if (!adventuresCache) {
      adventuresCache = JSON.parse(fs.readFileSync(ADVENTURES_PATH, 'utf8'));
    }
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

  const backgroundFavored = data.backgroundFavored || [];

  const disciplines = {};
  const arenas = {};
  if (data.arenas && Array.isArray(data.arenas)) {
    data.arenas.forEach(arena => {
      arenas[arena.id] = arena.die || null;
      if (arena.disciplines && Array.isArray(arena.disciplines)) {
        arena.disciplines.forEach(disc => {
          const isFavored = backgroundFavored.includes(disc.id) || kitFavoredDiscs.includes(disc.id);
          const discDie = disc.die || null;
          const isTrained = dieRank(discDie) > dieRank('D4');
          disciplines[disc.id] = {
            training: isTrained ? 'trained' : 'untrained',
            favored: isFavored,
            die: discDie,
          };
        });
      }
    });
  }

  const equipDb = loadEquipment();
  const gear = [];
  const allIds = [].concat(data.weaponIds || [], data.armorIds || [], data.gearIds || []);
  allIds.forEach(itemId => {
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

  return { destiny, backgroundPhases, backgroundFavored, vocations, vocationAbilities, disciplines, arenas, gear, conditions };
}

router.get('/campaign/party', (req, res) => {
  const characters = db.prepare(`
    SELECT id, name, session_id, character_data
    FROM characters
    WHERE character_data IS NOT NULL
  `).all();
  const party = characters.map(c => {
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
});

router.get('/campaign/scene-intel/:sceneId', (req, res) => {
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
      (scene.gearFlags && scene.gearFlags.length);

    if (!hasTags) return res.json({ sceneId, hasTags: false, intel: [] });

    const characters = db.prepare(`
      SELECT id, name, session_id, character_data
      FROM characters WHERE character_data IS NOT NULL
    `).all();

    const intel = characters.map(c => {
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
          insights.push({ type: 'gear', icon: '⚠', label: 'No ' + missing.join('/') + ' gear' });
        }
      }

      const restrictedGear = profile.gear.filter(g =>
        g.tags.some(t => /restricted|illegal/i.test(t)) || (g.availability && /restricted|illegal/i.test(g.availability))
      );
      if (restrictedGear.length) {
        insights.push({ type: 'gear', icon: '⚠', label: 'Carries restricted/illegal: ' + restrictedGear.map(g => g.name).join(', ') });
      }

      if (scene.challengeType && CHALLENGE_CLUSTERS[scene.challengeType]) {
        const cluster = CHALLENGE_CLUSTERS[scene.challengeType];
        let score = 0;
        let best = null;
        let bestRank = -1;
        cluster.forEach(discId => {
          const disc = profile.disciplines[discId];
          if (disc && (disc.training === 'trained' || disc.training === 'formative' || disc.favored)) {
            const arenaId = ARENA_META.find(a => a.disciplines.includes(discId))?.id;
            const arenaDie = arenaId && profile.arenas[arenaId] ? profile.arenas[arenaId] : null;
            const rank = dieRank(arenaDie) + (disc.favored ? 2 : 0);
            score += rank + 1;
            if (rank > bestRank) { bestRank = rank; best = discId; }
          }
        });
        if (score > 0) {
          const rating = score >= 8 ? 'strong' : score >= 4 ? 'capable' : 'limited';
          insights.push({
            type: 'challenge',
            icon: '◉',
            rating,
            label: scene.challengeType + ' readiness: ' + rating + (best ? ' (best: ' + best.replace(/_/g, ' ') + ')' : ''),
          });
        }
      }

      if (profile.backgroundPhases.length) {
        const connected = profile.backgroundPhases.filter(p => {
          if (!p.id) return false;
          if (scene.destinyTags && scene.destinyTags.some(t => p.id.includes(t))) return true;
          if (scene.challengeType && p.id.includes(scene.challengeType)) return true;
          return false;
        });
        if (connected.length) {
          insights.push({ type: 'background', icon: '⧫', label: 'Background tie: ' + connected.map(p => p.title || p.id).join(', ') });
        }
      }

      return {
        id: c.id,
        name: c.name,
        connected: !!c.session_id,
        insights,
      };
    });

    res.json({ sceneId, hasTags: true, challengeType: scene.challengeType || null, intel });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate scene intel', detail: err.message });
  }
});

module.exports = router;

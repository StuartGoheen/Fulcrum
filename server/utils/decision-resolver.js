const { pool } = require('../db');
const path = require('path');
const fs = require('fs');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'decision-registry.json');

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    console.error('[decision-resolver] Failed to load registry:', err.message);
    return {};
  }
}

function getImpactDefaults() {
  const registry = loadRegistry();
  const defaults = {};
  for (const [key, entry] of Object.entries(registry)) {
    defaults[key] = entry.default || 'unresolved';
  }
  return defaults;
}

async function resolveDecisionState() {
  const state = getImpactDefaults();
  try {
    const result = await pool.query(
      'SELECT campaign_impact, impact_value, impacts FROM campaign_decisions ORDER BY created_at ASC'
    );
    for (const row of result.rows) {
      let impacts = [];
      if (Array.isArray(row.impacts) && row.impacts.length) {
        impacts = row.impacts;
      } else if (row.campaign_impact && row.impact_value) {
        impacts = [{ key: row.campaign_impact, value: row.impact_value }];
      }
      for (const imp of impacts) {
        if (!imp || !imp.key || imp.value == null) continue;
        state[imp.key] = imp.value;
      }
    }
  } catch (err) {
    console.error('[decision-resolver] Failed to load decision state:', err.message);
  }
  return state;
}

function applyConditionals(obj, decisionState) {
  if (!obj || !Array.isArray(obj.conditionals) || obj.conditionals.length === 0) {
    return { modified: false, adaptations: [] };
  }
  const adaptations = [];
  for (const cond of obj.conditionals) {
    const currentVal = decisionState[cond.impact];
    if (currentVal === undefined) continue;
    if (currentVal !== cond.is) continue;
    if (cond.replace && typeof cond.replace === 'object') {
      for (const [field, value] of Object.entries(cond.replace)) {
        obj[field] = value;
        adaptations.push({ impact: cond.impact, is: cond.is, action: 'replace', field });
      }
    }
    if (cond.append && typeof cond.append === 'object') {
      for (const [field, value] of Object.entries(cond.append)) {
        const existing = obj[field] || '';
        obj[field] = existing ? existing + '\n\n' + value : value;
        adaptations.push({ impact: cond.impact, is: cond.is, action: 'append', field });
      }
    }
    if (cond.hide === true) {
      obj._hidden = true;
      adaptations.push({ impact: cond.impact, is: cond.is, action: 'hide' });
    }
  }
  return { modified: adaptations.length > 0, adaptations };
}

function applyAdventureConditionals(adventure, decisionState) {
  const adapted = JSON.parse(JSON.stringify(adventure));
  const allAdaptations = [];

  if (adapted.conditionals) {
    const { adaptations } = applyConditionals(adapted, decisionState);
    if (adaptations.length) {
      allAdaptations.push({ target: adapted.id, type: 'adventure', adaptations });
    }
  }

  const filteredParts = [];
  for (const part of (adapted.parts || [])) {
    if (part.conditionals) {
      const { adaptations } = applyConditionals(part, decisionState);
      if (adaptations.length) {
        allAdaptations.push({ target: part.id, type: 'part', adaptations });
      }
    }
    if (part._hidden) continue;

    const filteredScenes = [];
    for (const scene of (part.scenes || [])) {
      if (scene.conditionals) {
        const { adaptations } = applyConditionals(scene, decisionState);
        if (adaptations.length) {
          allAdaptations.push({ target: scene.id, type: 'scene', adaptations });
        }
      }
      if (scene._hidden) continue;

      if (scene.npcs) {
        const npcAdaptations = [];
        scene.npcs = scene.npcs.filter(npc => {
          if (npc.conditionals) {
            const { adaptations } = applyConditionals(npc, decisionState);
            if (adaptations.length) {
              npcAdaptations.push({ npc: npc.name, adaptations });
            }
          }
          return !npc._hidden;
        });
        for (const na of npcAdaptations) {
          for (const a of na.adaptations) {
            allAdaptations.push({ target: scene.id, type: 'scene', adaptations: [Object.assign({}, a, { npc: na.npc })] });
          }
        }
      }

      filteredScenes.push(scene);
    }
    part.scenes = filteredScenes;
    filteredParts.push(part);
  }
  adapted.parts = filteredParts;

  if (allAdaptations.length > 0) {
    adapted._adaptations = allAdaptations;
  }

  return adapted;
}

module.exports = { resolveDecisionState, applyConditionals, applyAdventureConditionals, getImpactDefaults, loadRegistry };

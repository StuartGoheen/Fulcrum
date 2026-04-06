const { pool } = require('../db');

const IMPACT_DEFAULTS = {
  'maya-fate': 'alive',
  'denia-fate': 'rescued',
  'varth-relationship': 'trusted',
  'malpaz-uprising': 'unknown',
  'soren-alliance': 'unknown',
  'kessra-grudge': 'unknown'
};

async function resolveDecisionState() {
  const state = Object.assign({}, IMPACT_DEFAULTS);
  try {
    const result = await pool.query(
      'SELECT campaign_impact, choice FROM campaign_decisions WHERE campaign_impact IS NOT NULL ORDER BY created_at ASC'
    );
    for (const row of result.rows) {
      const impact = row.campaign_impact;
      if (!impact) continue;
      const choice = (row.choice || '').toLowerCase();
      if (impact === 'maya-fate') {
        if (choice.includes('dead') || choice.includes('died') || choice.includes('killed') || choice.includes('abandon')) {
          state['maya-fate'] = 'dead';
        } else if (choice.includes('alive') || choice.includes('saved') || choice.includes('rescued')) {
          state['maya-fate'] = 'alive';
        }
      } else if (impact === 'denia-fate') {
        if (choice.includes('abandon') || choice.includes('left') || choice.includes('left behind')) {
          state['denia-fate'] = 'abandoned';
        } else if (choice.includes('rescue') || choice.includes('saved') || choice.includes('took')) {
          state['denia-fate'] = 'rescued';
        }
      } else {
        state[impact] = row.choice;
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
        if (npcAdaptations.length) {
          allAdaptations.push({ target: scene.id, type: 'scene-npcs', adaptations: npcAdaptations });
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

module.exports = { resolveDecisionState, applyConditionals, applyAdventureConditionals, IMPACT_DEFAULTS };

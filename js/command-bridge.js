(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CONDITION_MAP = {
    'disoriented': 'condition_disoriented', 'rattled': 'condition_rattled',
    'optimized': 'condition_optimized', 'weakened': 'condition_weakened',
    'empowered': 'condition_empowered', 'shaken': 'condition_shaken',
    'exposed': 'condition_exposed', 'pinned': 'condition_pinned',
    'prone': 'condition_prone', 'hazard': 'condition_hazard',
    'guarded': 'condition_guarded', 'cover': 'condition_cover',
    'buffered': 'condition_buffered', 'blinded': 'condition_blinded',
    'shut down': 'condition_shut_down', 'restrained': 'condition_restrained',
    'suppressed': 'condition_suppressed', 'bleeding': 'condition_bleeding',
    'stunned': 'condition_stunned', 'incapacitated': 'condition_incapacitated',
    'marked': 'condition_marked', 'locked on': 'condition_locked_on',
    'slowed': 'condition_slowed', 'elusive': 'condition_elusive',
    'jammed': 'condition_jammed',
    'stimmed': 'stimmed', 'natural recovery': 'natural_recovery',
    'attack': 'action_attack', 'aim': 'action_aim', 'move': 'action_move',
    'reload': 'action_reload', 'take cover': 'action_take_cover',
    'overwatch': 'action_overwatch', 'draw / holster': 'action_draw_holster',
    'assess': 'action_assess', 'treat injury': 'action_treat_injury',
    'interact': 'action_interact', 'join battle': 'action_join_battle',
    'dodge': 'action_dodge', 'endure': 'action_endure', 'resist': 'action_resist',
    'coordinate': 'action_coordinate', 'command beast': 'action_command_beast',
    'centering focus': 'force_centering_focus', 'force sense': 'force_sense',
    'telekinesis': 'force_telekinesis',
  };

  function linkify(str) {
    var s = String(str);
    var out = '';
    var re = /\[([^\]]+)\]/g;
    var last = 0;
    var match;
    while ((match = re.exec(s)) !== null) {
      out += esc(s.slice(last, match.index));
      var inner = match[1];
      var normalized = inner.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
      var glossaryId = CONDITION_MAP[normalized];
      if (glossaryId) {
        out += '<span class="cb-condition-link" data-condition-id="' + esc(glossaryId) + '">[' + esc(inner) + ']</span>';
      } else {
        out += '[' + esc(inner) + ']';
      }
      last = match.index + match[0].length;
    }
    out += esc(s.slice(last));
    return out;
  }

  var socket = typeof io !== 'undefined' ? io() : null;

  var adventuresData = null;
  var progressData = { adventure_id: 'adv1', part_id: 'adv1-p1', scene_id: 'adv1-p1-s1' };
  var completionsData = {};
  var currentAdventure = null;
  var currentPart = null;
  var currentScene = null;
  var glossaryData = null;
  var maneuversData = null;
  var sceneIntelData = null;
  var partyCache = [];

  function getAdventure(id) { return adventuresData ? adventuresData.adventures.find(function (a) { return a.id === id; }) : null; }
  function getPart(adv, pid) { return (adv.parts || []).find(function (p) { return p.id === pid; }); }
  function getScene(part, sid) { return (part.scenes || []).find(function (s) { return s.id === sid; }); }

  function _getSceneAdaptations(sceneId) {
    if (!adventuresData) return [];
    var results = [];
    var adventures = adventuresData.adventures || [];
    for (var i = 0; i < adventures.length; i++) {
      var adap = adventures[i]._adaptations;
      if (!adap) continue;
      for (var j = 0; j < adap.length; j++) {
        if (adap[j].target === sceneId) {
          for (var k = 0; k < adap[j].adaptations.length; k++) {
            results.push(adap[j].adaptations[k]);
          }
        }
      }
    }
    return results;
  }

  function _getPartAdaptations(partId) {
    if (!adventuresData) return [];
    var results = [];
    var adventures = adventuresData.adventures || [];
    for (var i = 0; i < adventures.length; i++) {
      var adap = adventures[i]._adaptations;
      if (!adap) continue;
      for (var j = 0; j < adap.length; j++) {
        if (adap[j].target === partId) {
          for (var k = 0; k < adap[j].adaptations.length; k++) {
            results.push(adap[j].adaptations[k]);
          }
        }
      }
    }
    return results;
  }

  function getAllScenes() {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    return part ? (part.scenes || []) : [];
  }

  function currentSceneIndex() {
    var scenes = getAllScenes();
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].id === currentScene) return i;
    }
    return -1;
  }

  function initCampaign() {
    Promise.all([
      fetch('/api/campaign/adventures').then(function (r) { return r.json(); }),
      fetch('/api/campaign/progress').then(function (r) { return r.json(); })
    ]).then(function (results) {
      adventuresData = results[0];
      progressData = results[1].progress;
      completionsData = results[1].completions || {};
      currentAdventure = progressData.adventure_id;
      currentPart = progressData.part_id;
      currentScene = progressData.scene_id;
      renderAdvSelect();
      renderAdvNav();
      renderPartSelect();
      renderPartNav();
      renderScene();
      renderSceneCounter();
      loadPartyMonitor();
      loadSceneIntel(currentScene);
    }).catch(function (err) {
      var el = document.getElementById('scene-carousel');
      if (el) el.innerHTML = '<p style="color:#c8a44e;font-size:0.85rem;">Failed to load campaign data: ' + esc(err.message) + '</p>';
    });
  }

  function selectAdventure(advId) {
    var adv = getAdventure(advId);
    if (!adv || !(adv.parts || []).length) return;
    closeAllFloatingPanels();
    currentAdventure = advId;
    currentPart = adv.parts[0].id;
    var firstScene = (adv.parts[0].scenes || [])[0];
    currentScene = firstScene ? firstScene.id : null;
    renderAdvNav();
    renderAdvSelect();
    renderPartNav();
    renderPartSelect();
    renderScene();
    renderSceneCounter();
    if (currentScene) saveProgress();
  }

  function renderAdvSelect() {
    var el = document.getElementById('cb-header-adv');
    if (!el || !adventuresData) return;
    var adv = getAdventure(currentAdventure);
    el.textContent = adv ? adv.title : '';
  }

  function renderAdvNav() {
    var nav = document.getElementById('adv-nav');
    if (!nav || !adventuresData) return;
    nav.innerHTML = adventuresData.adventures.map(function (adv) {
      var isActive = adv.id === currentAdventure;
      return '<button class="cb-nav-btn' + (isActive ? ' active' : '') + '" data-adv="' + adv.id + '">' +
        '<span class="cb-nav-num">' + adv.number + '</span>' +
        '<span>' + esc(adv.title) + '</span>' +
      '</button>';
    }).join('');
    nav.querySelectorAll('.cb-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectAdventure(btn.dataset.adv);
      });
    });
  }

  function selectPart(partId) {
    var adv = getAdventure(currentAdventure);
    var part = getPart(adv, partId);
    if (!part) return;
    closeAllFloatingPanels();
    currentPart = partId;
    var firstScene = (part.scenes || [])[0];
    currentScene = firstScene ? firstScene.id : null;
    renderPartNav();
    renderPartSelect();
    renderScene();
    renderSceneCounter();
    if (currentScene) saveProgress();
  }

  function renderPartSelect() {
    var el = document.getElementById('cb-header-part');
    var adv = getAdventure(currentAdventure);
    if (!el || !adv) return;
    var part = getPart(adv, currentPart);
    el.textContent = part ? 'Part ' + part.number + ': ' + part.title : '';
  }

  function renderPartNav() {
    var adv = getAdventure(currentAdventure);
    var nav = document.getElementById('part-nav');
    if (!nav || !adv) return;
    nav.innerHTML = (adv.parts || []).map(function (part) {
      var isActive = part.id === currentPart;
      return '<button class="cb-nav-btn cb-part-btn' + (isActive ? ' active' : '') + '" data-part="' + part.id + '">' +
        'Part ' + part.number + ': ' + esc(part.title) +
      '</button>';
    }).join('');
    nav.querySelectorAll('.cb-part-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectPart(btn.dataset.part);
      });
    });
  }

  function renderSceneCounter() {
    var el = document.getElementById('scene-counter');
    if (!el) return;
    var scenes = getAllScenes();
    var idx = currentSceneIndex();
    if (scenes.length === 0) {
      el.textContent = '';
      return;
    }
    el.textContent = 'Scene ' + (idx + 1) + ' of ' + scenes.length;
  }

  function navigateScene(dir) {
    var scenes = getAllScenes();
    var idx = currentSceneIndex();
    var next = idx + dir;
    if (next < 0 || next >= scenes.length) return;
    currentScene = scenes[next].id;
    closeAllFloatingPanels();
    renderScene();
    renderSceneCounter();
    saveProgress();
  }

  var _lastRenderedScene = null;
  var _npcExpandState = {};
  var _sceneNpcOverrides = {};

  function ensureComputedAttacks(npc) {
    if (!npc.threatBuild) return;
    var tb = npc.threatBuild;
    if (tb.attacks && tb.attacks.length && !tb.computedAttacks) {
      if (window.NpcBuilder) {
        window.NpcBuilder.ensureThreatData().then(function () {
          window.NpcBuilder.buildNpcFromSaved(tb).then(function (built) {
            tb.computedAttacks = built.computedAttacks || [];
            renderScene();
          });
        });
      }
    }
  }

  function getSceneNpcs() {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    if (!scene) return [];
    if (_sceneNpcOverrides[currentScene]) return _sceneNpcOverrides[currentScene];
    var npcs = (scene.npcs || []).slice();
    npcs.forEach(ensureComputedAttacks);
    return npcs;
  }

  function setSceneNpcs(npcs) {
    _sceneNpcOverrides[currentScene] = npcs;
  }

  function stripTransientFields(npc) {
    var copy = JSON.parse(JSON.stringify(npc));
    if (copy.threatBuild) {
      delete copy.threatBuild.computedAttacks;
    }
    delete copy._templateName;
    return copy;
  }

  function persistSceneNpc(idx, npc) {
    if (!currentScene) return;
    fetch('/api/campaign/scene/' + encodeURIComponent(currentScene) + '/npc/' + idx, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stripTransientFields(npc))
    }).then(function (r) {
      if (!r.ok) console.error('Failed to persist NPC update', r.status);
    }).catch(function (err) { console.error('NPC persist error', err); });
  }

  function addSceneNpc(npc) {
    if (!currentScene) return;
    fetch('/api/campaign/scene/' + encodeURIComponent(currentScene) + '/npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stripTransientFields(npc))
    }).then(function (r) {
      if (!r.ok) console.error('Failed to persist NPC add', r.status);
    }).catch(function (err) { console.error('NPC add error', err); });
  }

  function deleteSceneNpc(idx) {
    if (!currentScene) return;
    fetch('/api/campaign/scene/' + encodeURIComponent(currentScene) + '/npc/' + idx, {
      method: 'DELETE'
    }).then(function (r) {
      if (!r.ok) console.error('Failed to persist NPC delete', r.status);
    }).catch(function (err) { console.error('NPC delete error', err); });
  }

  function getNpcTypeId(npc) {
    if (npc._templateName) return npc._templateName;
    return (npc.name || '').toLowerCase().trim();
  }

  function buildNpcLabels(npcs) {
    var counts = {};
    npcs.forEach(function (npc) {
      var key = getNpcTypeId(npc);
      counts[key] = (counts[key] || 0) + 1;
    });
    var indices = {};
    return npcs.map(function (npc) {
      var key = getNpcTypeId(npc);
      indices[key] = (indices[key] || 0) + 1;
      return {
        number: indices[key],
        total: counts[key]
      };
    });
  }

  function renderNpcCardBody(npc, expandKey) {
    var tb = npc.threatBuild;
    var h = '';

    if (npc.notes) {
      h += '<div class="cb-npc-meta-row">' + linkify(npc.notes) + '</div>';
    }
    if (npc.behavior) {
      h += '<div class="cb-npc-detail-section" style="border-color:#c8a44e;"><strong>Behavior:</strong> ' + linkify(npc.behavior) + '</div>';
    }
    if (npc.dialogue && npc.dialogue.length) {
      h += '<div class="cb-npc-detail-section" style="border-color:#c084fc;color:#c084fc;"><strong>Dialogue:</strong> ' + npc.dialogue.map(function(d){ return linkify(d); }).join(' ') + '</div>';
    }
    if (npc.intel) {
      h += '<div class="cb-npc-detail-section" style="border-color:#f59e0b;color:#f59e0b;"><strong>Intel:</strong> ' + linkify(npc.intel) + '</div>';
    }

    if (!tb) return h;
    var baseC = tb.computed || {};
    var c = baseC;
    var hasDamage = baseC.damageTiers;
    var isCombat = !!hasDamage;

    var arenaNames = ['physique', 'reflex', 'grit', 'wits', 'presence'];
    var arenaLabels = { physique: 'PHY', reflex: 'REF', grit: 'GRT', wits: 'WIT', presence: 'PRE' };
    var baseA = tb.arenas || {};
    h += '<div class="cb-npc-arena-bar">';
    var cbPowers = c.powers || {};
    arenaNames.forEach(function (an) {
      h += '<div class="cb-arena-cell">';
      h += '<span class="cb-arena-label">' + arenaLabels[an] + '</span>';
      h += '<span class="cb-arena-val">' + (baseA[an] || 1) + '</span>';
      if (cbPowers[an] != null) h += '<span style="font-size:0.45rem;color:#c8a44e;opacity:0.7;">Pwr ' + cbPowers[an] + '</span>';
      h += '</div>';
    });
    h += '</div>';

    var displayPower = c.power;
    if (displayPower == null && c.powers) {
      displayPower = 0;
      Object.keys(c.powers).forEach(function (k) { if (c.powers[k] > displayPower) displayPower = c.powers[k]; });
    }
    if (displayPower == null) {
      var tier = tb.tier || 0;
      var maxArena = 0;
      var a = tb.arenas || {};
      ['physique','reflex','grit','wits','presence'].forEach(function (k) { if ((a[k] || 0) > maxArena) maxArena = a[k]; });
      displayPower = maxArena > 0 ? (maxArena + tier) : 0;
    }

    h += '<div class="cb-npc-stat-bar">';
    h += '<div class="cb-npc-stat combat-key">Init <span class="val">' + (c.initiative != null ? c.initiative : '—') + '</span></div>';
    h += '<div class="cb-npc-stat combat-key">Def <span class="val">' + (c.defense != null ? c.defense : '—') + '</span></div>';
    h += '<div class="cb-npc-stat combat-key">Eva <span class="val">' + (c.evasion != null ? c.evasion : '—') + '</span></div>';
    h += '<div class="cb-npc-stat">Pwr <span class="val">' + displayPower + '</span></div>';
    h += '<div class="cb-npc-stat">Res <span class="val">' + (c.resist != null ? c.resist : '—') + '</span></div>';
    h += '<div class="cb-npc-stat">Vit <span class="val">' + (c.vitality != null ? c.vitality : '—') + '</span></div>';
    if (baseC.actions) h += '<div class="cb-npc-stat">' + baseC.actions + ' act/rnd</div>';
    h += '</div>';

    if (isCombat) {
      var dt = baseC.damageTiers;
      h += '<div class="cb-npc-dmg-bar">';
      h += '<span class="dmg-label">' + esc(dt.label) + '</span>';
      h += '<span class="dmg-label">F</span><span class="dmg-val">' + dt.fleeting + '</span>';
      h += '<span class="dmg-label">M</span><span class="dmg-val">' + dt.masterful + '</span>';
      h += '<span class="dmg-label">L</span><span class="dmg-val">' + dt.legendary + '</span>';
      h += '</div>';
    }

    if (tb.roleKit) {
      var rk = tb.roleKit;
      if (rk.roleName) {
        h += '<div class="cb-npc-role-header">' + esc(rk.roleName) + '</div>';
      }

      if (rk.passive) {
        var passiveDesc = rk.passive.description;
        if (rk.passive.statMod) passiveDesc += ' (included in stats)';
        h += '<div class="cb-npc-passive"><strong>' + esc(rk.passive.name) + '</strong>: ' + linkify(passiveDesc) + '</div>';
      }

      if (rk.action && !rk.action.isAttack) {
        h += '<div class="cb-npc-ability"><span class="cb-npc-ability-tag cb-tag-sig">Signature</span> <strong>' + esc(rk.action.name) + '</strong>';
        if (rk.action.defense && rk.action.defense !== 'none') h += ' <span class="cb-npc-meta">(Defense: ' + esc(rk.action.defense) + ')</span>';
        if (rk.action.npcEffects) {
          h += '<div class="cb-npc-effects">';
          h += '<span><strong>F:</strong> ' + linkify(rk.action.npcEffects.fleeting) + '</span>';
          h += '<span><strong>M:</strong> ' + linkify(rk.action.npcEffects.masterful) + '</span>';
          h += '<span><strong>L:</strong> ' + linkify(rk.action.npcEffects.legendary) + '</span>';
          h += '</div>';
        }
        h += '</div>';
      }

      if (rk.maneuver && rk.maneuver.name) {
        h += '<div class="cb-npc-ability"><span class="cb-npc-ability-tag cb-tag-maneuver">Maneuver</span> <strong>' + esc(rk.maneuver.name) + '</strong>';
        if (rk.maneuver.modifies) h += ' <span class="cb-npc-meta">(mod ' + esc(rk.maneuver.modifies) + ')</span>';
        h += ' — ' + linkify(rk.maneuver.description) + '</div>';
      }
    }

    var allAttacks = tb.computedAttacks || [];
    var roleDefense = (tb.roleKit && tb.roleKit.action) ? tb.roleKit.action.defense : '';
    var roleActionName = (tb.roleKit && tb.roleKit.action && tb.roleKit.action.isAttack) ? tb.roleKit.action.name : null;

    var gambits = [];
    if (tb.roleKit) {
      if (tb.roleKit.gambits && tb.roleKit.gambits.length) {
        gambits = gambits.concat(tb.roleKit.gambits);
      } else if (tb.roleKit.gambit) {
        gambits.push(tb.roleKit.gambit);
      }
    }
    if (tb.extraGambits && tb.extraGambits.length) {
      gambits = gambits.concat(tb.extraGambits);
    }

    if (allAttacks.length || gambits.length) {
      h += '<div class="cb-npc-attacks-section">';
      if (allAttacks.length) {
        h += '<div class="cb-npc-attacks-label">ATTACKS</div>';
        allAttacks.forEach(function (atk) {
          var isRole = !!atk.isRoleAction || (roleActionName && atk.name === roleActionName);
          h += '<div class="cb-npc-attack-card' + (isRole ? ' cb-npc-role-attack' : '') + '">';
          h += '<div class="cb-npc-attack-header">';
          if (isRole) h += '<span class="cb-npc-ability-tag cb-tag-action">Action</span> ';
          h += '<strong>' + esc(atk.name) + '</strong>';
          if (isRole && roleDefense && roleDefense !== 'none') h += ' <span class="cb-npc-meta">(Defense: ' + esc(roleDefense) + ')</span>';
          h += ' <span class="cb-power-badge">POWER ' + atk.attackPower + '</span>';
          h += ' <span class="cb-chassis-badge">' + esc(atk.chassisLabel) + '</span>';
          if (atk.arena) h += ' <span class="cb-npc-meta">' + esc(atk.arena) + '</span>';
          h += '</div>';
          h += '<div class="cb-npc-attack-dmg-row">';
          h += '<span class="cb-dmg-tier"><span class="cb-dmg-lbl">F</span> ' + atk.damage.fleeting + '</span>';
          h += '<span class="cb-dmg-tier"><span class="cb-dmg-lbl">M</span> ' + atk.damage.masterful + '</span>';
          h += '<span class="cb-dmg-tier"><span class="cb-dmg-lbl">L</span> ' + atk.damage.legendary + '</span>';
          if (atk.canStun && atk.stun) {
            h += '<span class="cb-stun-inline"><span class="cb-stun-lbl">STUN</span> ' + atk.stun.fleeting + ' / ' + atk.stun.masterful + ' / ' + atk.stun.legendary + '</span>';
          }
          h += '</div>';
          h += '</div>';
        });
      }
      if (gambits.length) {
        h += '<div class="cb-npc-gambits-row">';
        gambits.forEach(function (g) {
          h += '<div class="cb-npc-gambit-item"><span class="cb-npc-ability-tag cb-tag-gambit">Gambit</span> <strong>' + esc(g.name) + '</strong> <span class="cb-npc-meta">(' + esc(g.cost) + ')</span> — ' + linkify(g.description) + '</div>';
        });
        h += '</div>';
      }
      h += '</div>';
    }

    if (tb.roleKit && tb.roleKit.exploit) {
      var expl = tb.roleKit.exploit;
      h += '<div class="cb-npc-exploit">';
      h += '<span class="cb-npc-ability-tag cb-tag-exploit">Exploit</span> <strong>' + esc(expl.name) + '</strong>';
      if (expl.trigger) {
        h += '<div class="cb-exploit-trigger"><strong>TRIGGER:</strong> ' + linkify(expl.trigger) + '</div>';
      }
      h += '<div>' + linkify(expl.description) + '</div>';
      h += '</div>';
    }

    var loot = npc.loot || (tb && tb.loot) || [];
    if (loot.length) {
      h += '<div class="cb-npc-loot-section">';
      h += '<div class="cb-npc-loot-label">Loot</div>';
      loot.forEach(function (item, li) {
        h += '<div class="cb-npc-loot-row" data-npc-idx="' + expandKey + '" data-loot-idx="' + li + '">';
        h += '<span class="cb-npc-loot-name">' + esc(item.name) + (item.qty > 1 ? ' x' + item.qty : '') + '</span>';
        if (item.type) h += '<span class="cb-npc-loot-type">' + esc(item.type) + '</span>';
        h += '<button class="cb-npc-loot-assign-btn" data-loot-idx="' + li + '" title="Assign to PC">&#9654; Assign</button>';
        h += '</div>';
      });
      h += '</div>';
    }

    return h;
  }

  function renderNpcCard(npc, idx, label) {
    var tb = npc.threatBuild;
    var c = tb ? (tb.computed || {}) : {};
    var cls = tb ? (tb.classification || '') : '';
    var tier = tb ? tb.tier : null;
    var role = tb ? tb.role : '';
    var cardId = 'npc-card-' + idx;
    var expandKey = currentScene + ':' + idx + ':' + npc.name;
    var isExpanded = _npcExpandState[expandKey];

    var init = c.initiative;

    var displayName = npc.name || 'Unnamed';
    if (label && label.total > 1) {
      displayName += ' #' + label.number;
    }

    var h = '<div class="cb-npc-card' + (isExpanded ? ' expanded' : '') + '" id="' + cardId + '" data-npc-idx="' + idx + '">';

    h += '<div class="cb-npc-card-header" data-npc-toggle="' + esc(expandKey) + '">';
    h += '<span class="cb-npc-chevron">&#9654;</span>';
    h += '<span class="cb-npc-name">' + esc(displayName) + '</span>';
    if (tier != null) h += '<span class="cb-npc-tier-badge">T' + tier + '</span>';
    if (cls) h += '<span class="cb-npc-class-badge ' + esc(cls) + '">' + esc(cls) + '</span>';
    if (role) h += '<span style="font-size:0.6rem;color:#7a7068;text-transform:capitalize;">' + esc(role) + '</span>';
    h += '<span class="cb-npc-count-badge">x' + (npc.count || 1) + '</span>';
    if (init != null) h += '<span class="cb-npc-init-badge">Init <span>' + init + '</span></span>';
    h += '<span class="cb-npc-card-actions">';
    h += '<button class="cb-npc-edit-btn" data-npc-idx="' + idx + '" title="Edit in Threat Builder">&#9998;</button>';
    h += '<button class="cb-npc-remove-btn" data-npc-idx="' + idx + '" title="Remove NPC">&times;</button>';
    h += '</span>';
    h += '</div>';

    h += '<div class="cb-npc-card-body">';
    h += '<div class="cb-npc-meta-row"><span>' + esc(npc.type) + '</span></div>';
    h += renderNpcCardBody(npc, expandKey);
    h += '</div>';

    h += '</div>';
    return h;
  }

  function showLootToast(msg) {
    var t = document.createElement('div');
    t.className = 'cb-loot-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('visible'); }, 10);
    setTimeout(function () { t.classList.remove('visible'); setTimeout(function () { t.remove(); }, 300); }, 2500);
  }

  function assignLootToPC(npcIdx, lootIdx, charId, charName) {
    var npcs = getSceneNpcs();
    var npc = npcs[npcIdx];
    if (!npc) return;
    var lootSource = npc.loot || (npc.threatBuild && npc.threatBuild.loot) || [];
    var item = lootSource[lootIdx];
    if (!item) return;
    var itemType = (item.type || 'gear').toLowerCase();
    if (itemType === 'weapon') itemType = 'weapon';
    else if (itemType === 'armor') itemType = 'armor';
    else itemType = 'gear';
    fetch('/api/inventory/' + encodeURIComponent(charId) + '/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, itemType: itemType })
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed');
      return res.json();
    }).then(function () {
      showLootToast(esc(item.name) + ' assigned to ' + esc(charName));
      if (socket) socket.emit('inventory:added', { charId: String(charId), itemId: item.id, itemType: itemType });
      if (item.qty && item.qty > 1) {
        item.qty -= 1;
      } else {
        lootSource.splice(lootIdx, 1);
      }
      setSceneNpcs(npcs);
      renderScene();
    }).catch(function (err) {
      showLootToast('Failed to assign loot: ' + err.message);
    });
  }

  var _openPanels = {};
  var _panelZCounter = 121;

  function _panelTypeKey(panelId) {
    if (panelId.indexOf('lore-') === 0) return 'lore';
    if (panelId === 'assess-guide') return 'assess-guide';
    return panelId;
  }

  function _loadPanelGeometry(panelId) {
    try {
      var store = JSON.parse(localStorage.getItem('cb_panel_geo') || '{}');
      return store[_panelTypeKey(panelId)] || null;
    } catch (e) { return null; }
  }

  function _savePanelGeometry(panelId, geo) {
    try {
      var store = JSON.parse(localStorage.getItem('cb_panel_geo') || '{}');
      store[_panelTypeKey(panelId)] = geo;
      localStorage.setItem('cb_panel_geo', JSON.stringify(store));
    } catch (e) { /* ignore */ }
  }

  function _captureAndSaveGeo(panel, panelId) {
    var rect = { x: panel.offsetLeft, y: panel.offsetTop, w: panel.offsetWidth, h: panel.offsetHeight };
    if (rect.w < 50 || rect.h < 50) return;
    _savePanelGeometry(panelId, rect);
  }

  function _buildTtsSettingsHtml() {
    var prefs = window.TtsNarration ? window.TtsNarration.getPrefs() : { rate: 0.92, pitch: 0.85, autoContinue: true };
    var h = '';
    h += '<div class="cb-tts-settings">';
    h += '<button class="cb-tts-settings-toggle" data-tts-toggle="settings">&#9881; Voice Settings</button>';
    h += '<div class="cb-tts-settings-body" style="display:none;">';
    h += '<div class="cb-tts-row"><label>Voice</label><select class="cb-tts-voice-select" data-tts-control="voice"></select></div>';
    h += '<div class="cb-tts-row"><label>Speed <span data-tts-val="rate">' + prefs.rate.toFixed(2) + '</span></label><input type="range" min="0.6" max="1.4" step="0.05" value="' + prefs.rate + '" data-tts-control="rate"></div>';
    h += '<div class="cb-tts-row"><label>Pitch <span data-tts-val="pitch">' + prefs.pitch.toFixed(2) + '</span></label><input type="range" min="0.7" max="1.3" step="0.05" value="' + prefs.pitch + '" data-tts-control="pitch"></div>';
    h += '<div class="cb-tts-row"><label><input type="checkbox" data-tts-control="autoContinue"' + (prefs.autoContinue ? ' checked' : '') + '> Auto-continue Part 1 → Part 2</label></div>';
    h += '</div></div>';
    return h;
  }

  function _buildReadAloudHtml(scene) {
    var h = '';
    h += _buildTtsSettingsHtml();
    if (scene.readAloudPart1 && scene.readAloudPart2) {
      h += '<div class="cb-read-aloud" style="margin-bottom:0.75rem;" data-tts-section="part1">';
      h += '<div class="cb-section-label">Read-Aloud — Part 1 <button class="cb-tts-narrate-btn" data-tts-action="narrate-all" title="Narrate Part 1 then auto-continue to Part 2">&#9654; Narrate</button></div>';
      h += '<div class="cb-read-aloud-text">' + linkify(scene.readAloudPart1) + '</div>';
      if (scene.readAloudPart1PauseNote) {
        h += '<div class="cb-pause-note" style="margin-top:12px;padding:10px 14px;background:rgba(245,158,11,0.12);border-left:3px solid #f59e0b;border-radius:4px;color:#f59e0b;font-size:0.85rem;font-style:italic;">' + scene.readAloudPart1PauseNote + '</div>';
      }
      h += '</div>';
      h += '<div class="cb-read-aloud" style="margin-top:6px;" data-tts-section="part2">';
      h += '<div class="cb-section-label">Read-Aloud — Part 2 <button class="cb-tts-narrate-btn" data-tts-action="narrate-part2" title="Narrate Part 2">&#9654; Narrate</button></div>';
      h += '<div class="cb-read-aloud-text">' + linkify(scene.readAloudPart2) + '</div>';
      h += '</div>';
    } else if (scene.readAloud) {
      h += '<div class="cb-read-aloud" data-tts-section="single">';
      h += '<div class="cb-section-label">Player Read-Aloud <button class="cb-tts-narrate-btn" data-tts-action="narrate-single" title="Narrate">&#9654; Narrate</button></div>';
      h += '<div class="cb-read-aloud-text">' + linkify(scene.readAloud) + '</div>';
      h += '</div>';
    }
    return h;
  }

  function _buildGmNotesHtml(scene) {
    if (!scene.gmNotes) return '';
    return '<div class="cb-gm-notes"><div class="cb-section-label">GM Notes</div><div>' + linkify(scene.gmNotes) + '</div></div>';
  }

  function _buildNpcRosterHtml(scene) {
    var sceneNpcs = getSceneNpcs();
    var h = '<div class="cb-card" id="cb-npc-roster-card">';
    h += '<div class="cb-section-label" style="display:flex;align-items:center;justify-content:space-between;">';
    h += '<span>NPC Roster</span>';
    h += '<button class="cb-add-npc-btn" id="cb-add-npc-btn">+ NPC</button>';
    h += '</div>';
    h += '<div id="cb-add-npc-panel" class="cb-add-npc-panel" style="display:none;"></div>';
    if (sceneNpcs.length) {
      var labels = buildNpcLabels(sceneNpcs);
      h += '<div class="cb-npc-grid">';
      sceneNpcs.forEach(function (npc, idx) {
        h += renderNpcCard(npc, idx, labels[idx]);
      });
      h += '</div>';
    } else {
      h += '<p class="cb-muted" style="font-style:italic;font-size:0.75rem;">No NPCs in this scene. Click "+ NPC" to add one.</p>';
    }
    h += '</div>';
    return h;
  }

  function _buildEncountersHtml(scene) {
    if (!scene.encounters || !scene.encounters.length) return '';
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Encounters</div>';
    scene.encounters.forEach(function (enc) {
      var typeColor = enc.type === 'combat' ? '#ef4444' : enc.type === 'social' ? '#c084fc' : enc.type === 'infiltration' ? '#818cf8' : '#c8a44e';
      h += '<div style="margin-bottom:0.5rem;padding:0.4rem;border-left:3px solid ' + typeColor + ';background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;">';
      h += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;"><strong style="color:#d4c5a0;font-size:0.8rem;">' + esc(enc.name) + '</strong><span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + typeColor + ';color:#000;font-family:Audiowide,sans-serif;text-transform:uppercase;">' + esc(enc.type) + '</span></div>';
      h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;"><strong>Trigger:</strong> ' + linkify(enc.trigger) + '</div>';
      h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;">' + linkify(enc.description) + '</div>';
      if (enc.tactics) h += '<div style="font-size:0.7rem;color:#c8a44e;"><strong>Tactics:</strong> ' + linkify(enc.tactics) + '</div>';
      if (enc.composition) {
        h += '<div style="font-size:0.65rem;margin-top:0.2rem;padding:0.25rem;background:rgba(0,0,0,0.1);border-radius:3px;">';
        if (enc.composition.enemies) {
          enc.composition.enemies.forEach(function(e) {
            var threatColor = e.threat === 'rival' ? '#f59e0b' : e.threat === 'nemesis' ? '#ef4444' : '#7a7068';
            h += '<div><span style="color:' + threatColor + ';text-transform:uppercase;font-size:0.55rem;font-family:Audiowide,sans-serif;">' + esc(e.threat) + '</span> ' + esc(e.type) + ' x' + e.count + '</div>';
          });
        }
        if (enc.composition.terrain) h += '<div style="color:#7a7068;margin-top:0.1rem;"><strong>Terrain:</strong> ' + esc(enc.composition.terrain) + '</div>';
        if (enc.composition.positioning) h += '<div style="color:#7a7068;"><strong>Positioning:</strong> ' + esc(enc.composition.positioning) + '</div>';
        h += '</div>';
      }
      if (enc.type === 'combat' && window.CombatTracker) {
        h += '<button class="ct-start-encounter-btn" data-enc-idx="' + scene.encounters.indexOf(enc) + '">&#9876; Start Encounter</button>';
      }
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function _buildChallengesHtml(scene) {
    var dcList = (scene.disciplineChallenges && scene.disciplineChallenges.length) ? scene.disciplineChallenges : (scene.skillChecks || []);
    if (!dcList.length) return '';
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Discipline Challenges</div>';
    dcList.forEach(function (dc) {
      var hasNewFormat = dc.actionType || dc.arena || dc.control || dc.effect;
      h += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.15);border-left:3px solid ' + (dc.actionType === 'assess' ? '#818cf8' : '#c8a44e') + ';">';
      h += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;flex-wrap:wrap;">';
      if (dc.actionType) {
        var atColor = dc.actionType === 'assess' ? '#818cf8' : '#c8a44e';
        h += '<span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + atColor + ';color:#000;font-family:Audiowide,sans-serif;font-weight:bold;letter-spacing:0.05em;">' + esc(dc.actionType.toUpperCase()) + '</span>';
      }
      var discLabel = (dc.discipline || '').replace(/_/g, ' ');
      var arenaLabel = dc.arena ? ' (' + dc.arena.charAt(0).toUpperCase() + dc.arena.slice(1) + ')' : '';
      h += '<span style="font-size:0.75rem;color:#c8a44e;font-family:Audiowide,sans-serif;">' + esc(discLabel) + esc(arenaLabel) + '</span>';
      if (dc.isOptional) h += '<span style="font-size:0.55rem;padding:0.05rem 0.2rem;border-radius:3px;background:rgba(255,255,255,0.15);color:#7a7068;">OPTIONAL</span>';
      if (dc.isGated) h += '<span style="font-size:0.55rem;padding:0.05rem 0.2rem;border-radius:3px;background:rgba(239,68,68,0.2);color:#f97316;">GATED</span>';
      h += '</div>';
      if (dc.target || dc.resist != null || dc.risk != null) {
        h += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.15rem;font-size:0.65rem;">';
        if (dc.target) h += '<span style="color:#7a7068;">vs <strong style="color:#d4c5a0;">' + esc(dc.target) + '</strong></span>';
        if (dc.resist != null) h += '<span style="color:#f97316;">Resist ' + dc.resist + '</span>';
        if (dc.risk != null) h += '<span style="color:#eab308;">Risk ' + dc.risk + '</span>';
        h += '</div>';
      }
      if (dc.isGated) h += '<div style="font-size:0.6rem;color:#f97316;font-style:italic;margin-bottom:0.1rem;">&#128274; ' + esc(dc.isGated) + '</div>';
      h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;">' + linkify(dc.context) + '</div>';
      if (dc.narrativePacing) {
        h += '<div style="font-size:0.6rem;color:#a78bfa;font-style:italic;margin-bottom:0.15rem;">&#9654; ' + esc(dc.narrativePacing) + '</div>';
      }
      if (hasNewFormat && dc.control) {
        h += '<div style="margin-top:0.15rem;padding:0.2rem 0.3rem;border-radius:3px;background:rgba(0,0,0,0.15);">';
        h += '<div style="font-size:0.55rem;color:#7a7068;font-family:Audiowide,sans-serif;margin-bottom:0.1rem;letter-spacing:0.05em;">CONTROL</div>';
        if (dc.control.failure) h += '<div style="font-size:0.65rem;color:#ef4444;margin-bottom:0.05rem;">&#10007; <strong>Fail:</strong> ' + linkify(dc.control.failure) + '</div>';
        if (dc.control.success) h += '<div style="font-size:0.65rem;color:#22c55e;margin-bottom:0.05rem;">&#10003; <strong>Success:</strong> ' + linkify(dc.control.success) + '</div>';
        if (dc.control.mastery) h += '<div style="font-size:0.65rem;color:#fbbf24;margin-bottom:0.05rem;">&#9733; <strong>Mastery:</strong> ' + linkify(dc.control.mastery) + '</div>';
        h += '</div>';
      } else if (!hasNewFormat) {
        if (dc.success) h += '<div style="font-size:0.65rem;color:#22c55e;">&#10003; ' + linkify(dc.success) + '</div>';
        if (dc.failure) h += '<div style="font-size:0.65rem;color:#ef4444;">&#10007; ' + linkify(dc.failure) + '</div>';
      }
      if (hasNewFormat && dc.effect) {
        h += '<div style="margin-top:0.15rem;padding:0.2rem 0.3rem;border-radius:3px;background:rgba(0,0,0,0.1);">';
        h += '<div style="font-size:0.55rem;color:#7a7068;font-family:Audiowide,sans-serif;margin-bottom:0.1rem;letter-spacing:0.05em;">EFFECT TIERS</div>';
        var tierColors = { fleeting: '#6b7280', masterful: '#3b82f6', legendary: '#a855f7', unleashed: '#f59e0b' };
        ['fleeting', 'masterful', 'legendary', 'unleashed'].forEach(function (tier) {
          if (dc.effect[tier]) {
            var tColor = tierColors[tier] || '#6b7280';
            h += '<div style="font-size:0.65rem;margin-bottom:0.05rem;"><span style="color:' + tColor + ';font-weight:bold;">' + tier.charAt(0).toUpperCase() + tier.slice(1) + ':</span> <span style="color:#7a7068;">' + linkify(dc.effect[tier]) + '</span></div>';
          }
        });
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function _buildEnvironmentHtml(scene) {
    var h = '';
    if (scene.hazards) {
      h += '<div class="cb-card">';
      h += '<div class="cb-section-label">Hazards / Environment</div>';
      h += '<div>' + linkify(scene.hazards) + '</div>';
      h += '</div>';
    }
    if (scene.environmentMechanics && scene.environmentMechanics.length) {
      h += '<div class="cb-card">';
      h += '<div class="cb-section-label">Environment Mechanics</div>';
      scene.environmentMechanics.forEach(function (em) {
        h += '<div style="margin-bottom:0.4rem;padding:0.3rem 0.4rem;border-left:2px solid #818cf8;border-radius:0 4px 4px 0;background:rgba(0,0,0,0.1);">';
        h += '<div style="font-size:0.8rem;color:#d4c5a0;font-weight:bold;margin-bottom:0.1rem;">' + esc(em.name) + '</div>';
        h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.1rem;"><strong>Trigger:</strong> ' + linkify(em.trigger) + '</div>';
        h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.1rem;"><strong>Effect:</strong> ' + linkify(em.effect) + '</div>';
        h += '<div style="font-size:0.7rem;color:#c8a44e;"><strong>Mitigation:</strong> ' + linkify(em.mitigation) + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  function _buildRewardsHtml(scene) {
    if (!scene.rewards) return '';
    var r = scene.rewards;
    var hasRewardContent = r.credits || (r.items && r.items.length) || (r.intel && r.intel.length) || (r.connections && r.connections.length);
    if (!hasRewardContent) return '';
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Rewards</div>';
    if (r.credits) h += '<div style="font-size:0.7rem;color:#c8a44e;margin-bottom:0.15rem;">&#9670; Credits: ' + r.credits + '</div>';
    if (r.items && r.items.length) h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;">&#9670; Items: ' + r.items.map(function(i){ return esc(typeof i === 'object' ? (i.name || i.id || JSON.stringify(i)) + (i.qty && i.qty > 1 ? ' x' + i.qty : '') : i); }).join(', ') + '</div>';
    if (r.intel && r.intel.length) {
      h += '<div style="font-size:0.7rem;color:#f59e0b;margin-bottom:0.15rem;">&#9670; Intel:</div>';
      r.intel.forEach(function(i){ h += '<div style="font-size:0.65rem;color:#7a7068;padding-left:0.8rem;">• ' + linkify(i) + '</div>'; });
    }
    if (r.connections && r.connections.length) h += '<div style="font-size:0.7rem;color:#c084fc;margin-bottom:0.15rem;">&#9670; Connections: ' + r.connections.map(function(c){return esc(c);}).join(', ') + '</div>';
    h += '</div>';
    return h;
  }

  function _buildPacingHtml(scene) {
    if (!scene.pacing) return '';
    var p = scene.pacing;
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Pacing Guide' + (p.estimatedMinutes ? ' (~' + p.estimatedMinutes + ' min)' : '') + '</div>';
    if (p.openingBeat) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#c8a44e;font-family:Audiowide,sans-serif;font-size:0.6rem;">OPENING</span> ' + linkify(p.openingBeat) + '</div>';
    if (p.risingAction) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#eab308;font-family:Audiowide,sans-serif;font-size:0.6rem;">RISING</span> ' + linkify(p.risingAction) + '</div>';
    if (p.climax) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#ef4444;font-family:Audiowide,sans-serif;font-size:0.6rem;">CLIMAX</span> ' + linkify(p.climax) + '</div>';
    if (p.resolution) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#22c55e;font-family:Audiowide,sans-serif;font-size:0.6rem;">RESOLUTION</span> ' + linkify(p.resolution) + '</div>';
    h += '</div>';
    return h;
  }

  var _holonetFeeds = null;
  var _holonetHistory = null;
  var _holonetSelected = {};

  function _loadHolonetData(cb) {
    var loaded = 0;
    function check() { loaded++; if (loaded >= 2 && cb) cb(); }
    fetch('/api/campaign/holonet/feeds')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) _holonetFeeds = d.feeds; check(); })
      .catch(function () { check(); });
    fetch('/api/campaign/holonet/history')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) _holonetHistory = d.broadcasts; check(); })
      .catch(function () { check(); });
  }

  function _getAlreadySentIds() {
    if (!_holonetHistory) return {};
    var sent = {};
    _holonetHistory.forEach(function (b) {
      try {
        var ids = JSON.parse(b.story_ids);
        ids.forEach(function (id) { sent[id] = b.broadcast_at; });
      } catch (e) {}
    });
    return sent;
  }

  function _buildHoloNetHtml() {
    if (!_holonetFeeds) {
      _loadHolonetData(function () {
        var panel = document.getElementById('fp-holonet');
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) body.innerHTML = _buildHoloNetHtml();
          _bindHolonetHandlers(panel);
        }
      });
      return '<div class="hn-loading">Loading HoloNet feeds...</div>';
    }

    var sentIds = _getAlreadySentIds();
    var selectedCount = Object.keys(_holonetSelected).filter(function (k) { return _holonetSelected[k]; }).length;

    var h = '<div class="hn-panel">';
    h += '<div class="hn-header">';
    h += '<span class="hn-header-logo">&#128225; IMPERIAL HOLONET — BROADCAST TERMINAL</span>';
    h += '<div class="hn-header-actions">';
    h += '<button class="hn-broadcast-btn' + (selectedCount === 0 ? ' hn-btn--disabled' : '') + '" id="hn-send-broadcast"' + (selectedCount === 0 ? ' disabled' : '') + '>&#9889; BROADCAST (' + selectedCount + ')</button>';
    h += '<button class="hn-select-none-btn" id="hn-clear-selection">CLEAR</button>';
    h += '</div>';
    h += '</div>';

    _holonetFeeds.forEach(function (feed) {
      h += '<div class="hn-feed-group">';
      h += '<div class="hn-feed-label">' + esc(feed.label) + '</div>';

      feed.stories.forEach(function (story) {
        var isSent = !!sentIds[story.id];
        var isSelected = !!_holonetSelected[story.id];
        var typeClass = 'hn-type--' + (story.type || 'flavor');

        h += '<div class="hn-story-card' + (isSelected ? ' hn-story--selected' : '') + (isSent ? ' hn-story--sent' : '') + '" data-story-id="' + esc(story.id) + '">';
        h += '<div class="hn-story-select">';
        h += '<input type="checkbox" class="hn-story-check" data-story-id="' + esc(story.id) + '"' + (isSelected ? ' checked' : '') + ' />';
        h += '</div>';
        h += '<div class="hn-story-content">';
        h += '<div class="hn-story-headline">' + esc(story.headline) + '</div>';
        h += '<div class="hn-story-meta">';
        h += '<span class="hn-story-source">' + esc(story.source) + '</span>';
        h += '<span class="hn-story-type ' + typeClass + '">' + esc(story.type || 'flavor').toUpperCase() + '</span>';
        if (isSent) h += '<span class="hn-story-sent-badge">SENT</span>';
        h += '</div>';
        h += '<div class="hn-story-body">' + esc(story.body) + '</div>';
        if (story.tags && story.tags.length > 0) {
          h += '<div class="hn-story-tags">';
          story.tags.forEach(function (tag) {
            h += '<span class="hn-tag">' + esc(tag) + '</span>';
          });
          h += '</div>';
        }
        h += '</div>';
        h += '</div>';
      });

      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  function _bindHolonetHandlers(container) {
    if (!container) return;
    container.querySelectorAll('.hn-story-check').forEach(function (chk) {
      chk.addEventListener('change', function () {
        _holonetSelected[chk.dataset.storyId] = chk.checked;
        var panel = document.getElementById('fp-holonet');
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) { body.innerHTML = _buildHoloNetHtml(); _bindHolonetHandlers(panel); }
        }
      });
    });
    container.querySelectorAll('.hn-story-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.classList.contains('hn-story-check')) return;
        var chk = card.querySelector('.hn-story-check');
        if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
      });
    });
    var sendBtn = container.querySelector('#hn-send-broadcast');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var ids = Object.keys(_holonetSelected).filter(function (k) { return _holonetSelected[k]; });
        if (ids.length === 0) return;
        sendBtn.disabled = true;
        sendBtn.textContent = 'TRANSMITTING...';
        fetch('/api/campaign/holonet/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyIds: ids })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok && data.stories) {
              _holonetSelected = {};
              _loadHolonetData(function () {
                var panel = document.getElementById('fp-holonet');
                if (panel) {
                  var body = panel.querySelector('.cb-fpanel-body');
                  if (body) { body.innerHTML = _buildHoloNetHtml(); _bindHolonetHandlers(panel); }
                }
              });
            }
          })
          .catch(function (err) {
            console.error('[HoloNet] Broadcast failed:', err);
            sendBtn.disabled = false;
            sendBtn.textContent = '⚡ BROADCAST (retry)';
          });
      });
    }
    var clearBtn = container.querySelector('#hn-clear-selection');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        _holonetSelected = {};
        var panel = document.getElementById('fp-holonet');
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) { body.innerHTML = _buildHoloNetHtml(); _bindHolonetHandlers(panel); }
        }
      });
    }
  }

  function openFloatingPanel(panelId, title, contentHtml, opts) {
    opts = opts || {};
    var existing = document.getElementById('fp-' + panelId);
    if (existing) {
      existing.style.zIndex = ++_panelZCounter;
      return;
    }
    _openPanels[panelId] = true;
    var tile = document.querySelector('[data-panel-id="' + panelId + '"]');
    if (tile) tile.classList.add('cb-tile--active');

    var panel = document.createElement('div');
    panel.className = 'cb-floating-panel';
    panel.id = 'fp-' + panelId;
    panel.dataset.panelKey = panelId;
    panel.style.zIndex = ++_panelZCounter;

    var saved = _loadPanelGeometry(panelId);
    var w = saved ? saved.w : (opts.width || 480);
    var h = saved ? saved.h : (opts.height || 400);
    var posX, posY;
    if (saved) {
      posX = Math.max(0, Math.min(saved.x, window.innerWidth - 100));
      posY = Math.max(0, Math.min(saved.y, window.innerHeight - 60));
    } else {
      posX = Math.max(40, Math.round((window.innerWidth - w) / 2) + (Object.keys(_openPanels).length - 1) * 24);
      posY = Math.max(60, Math.round((window.innerHeight - h) / 2) + (Object.keys(_openPanels).length - 1) * 24);
    }
    panel.style.left = posX + 'px';
    panel.style.top = posY + 'px';
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';

    panel.innerHTML =
      '<div class="cb-fpanel-titlebar">' +
        '<span class="cb-fpanel-title">' + esc(title) + '</span>' +
        '<button class="cb-fpanel-close">&times;</button>' +
      '</div>' +
      '<div class="cb-fpanel-body">' + contentHtml + '</div>';

    document.body.appendChild(panel);

    panel.addEventListener('mousedown', function () {
      panel.style.zIndex = ++_panelZCounter;
    });

    panel.querySelector('.cb-fpanel-close').addEventListener('click', function () {
      closeFloatingPanel(panelId);
    });

    _initPanelDrag(panel);
    _initPanelResizeObserver(panel);
    _bindPanelContent(panel, panelId);
  }

  function closeFloatingPanel(panelId) {
    var panel = document.getElementById('fp-' + panelId);
    if (panel) {
      _captureAndSaveGeo(panel, panelId);
      panel.remove();
    }
    delete _openPanels[panelId];
    var tile = document.querySelector('[data-panel-id="' + panelId + '"]');
    if (tile) tile.classList.remove('cb-tile--active');
    if (panelId === 'readaloud' && window.TtsNarration) {
      window.TtsNarration.stop();
    }
  }

  function closeAllFloatingPanels() {
    Object.keys(_openPanels).forEach(function (id) {
      closeFloatingPanel(id);
    });
  }

  function _initPanelDrag(panel) {
    var titlebar = panel.querySelector('.cb-fpanel-titlebar');
    var panelId = panel.dataset.panelKey;
    var startX, startY, origLeft, origTop;
    function onStart(x, y) {
      startX = x;
      startY = y;
      origLeft = panel.offsetLeft;
      origTop = panel.offsetTop;
    }
    function onMove(x, y) {
      panel.style.left = Math.max(0, origLeft + x - startX) + 'px';
      panel.style.top = Math.max(0, origTop + y - startY) + 'px';
    }
    function onEnd() {
      if (panelId) _captureAndSaveGeo(panel, panelId);
    }
    titlebar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.cb-fpanel-close')) return;
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      document.addEventListener('mousemove', mmove);
      document.addEventListener('mouseup', mup);
    });
    function mmove(e) { onMove(e.clientX, e.clientY); }
    function mup() {
      document.removeEventListener('mousemove', mmove);
      document.removeEventListener('mouseup', mup);
      onEnd();
    }
    titlebar.addEventListener('touchstart', function (e) {
      if (e.target.closest('.cb-fpanel-close')) return;
      var t = e.touches[0];
      onStart(t.clientX, t.clientY);
      document.addEventListener('touchmove', tmove, { passive: false });
      document.addEventListener('touchend', tend);
    });
    function tmove(e) {
      e.preventDefault();
      var t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }
    function tend() {
      document.removeEventListener('touchmove', tmove);
      document.removeEventListener('touchend', tend);
      onEnd();
    }
  }

  function _initPanelResizeObserver(panel) {
    var panelId = panel.dataset.panelKey;
    if (!panelId) return;
    var initW = panel.offsetWidth;
    var initH = panel.offsetHeight;
    var settled = false;
    var debounceTimer = null;
    var ro = new ResizeObserver(function () {
      if (!settled) {
        var curW = panel.offsetWidth;
        var curH = panel.offsetHeight;
        if (curW === initW && curH === initH) return;
        if (Math.abs(curW - initW) < 3 && Math.abs(curH - initH) < 3) return;
        settled = true;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        _captureAndSaveGeo(panel, panelId);
      }, 300);
    });
    ro.observe(panel);
  }

  function _bindPanelContent(panel, panelId) {
    panel.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
    panel.querySelectorAll('.cb-lore-tag').forEach(function (el) {
      el.addEventListener('click', function () { openLoreModal(el.dataset.loreTag); });
    });
    panel.querySelectorAll('.cb-narrative-link').forEach(function (el) {
      el.addEventListener('click', function () { navigateToScene(el.dataset.navScene); });
    });

    if (panelId === 'readaloud') {
      _bindTtsEvents(panel);
    }
    if (panelId === 'npcs') {
      _bindNpcPanelEvents(panel);
    }
    if (panelId === 'encounters') {
      _bindEncounterPanelEvents(panel);
    }
    if (panelId === 'holonet') {
      _bindHolonetHandlers(panel);
    }
  }

  function _bindTtsEvents(panel) {
    if (!window.TtsNarration) return;
    var TTS = window.TtsNarration;

    if (!TTS.isSupported()) {
      panel.querySelectorAll('.cb-tts-narrate-btn').forEach(function (btn) {
        btn.disabled = true;
        btn.title = 'Text-to-speech not supported in this browser';
        btn.style.opacity = '0.4';
      });
      var settingsEl = panel.querySelector('.cb-tts-settings');
      if (settingsEl) settingsEl.style.display = 'none';
      return;
    }

    function _populateVoiceSelect(voices) {
      var sel = panel.querySelector('[data-tts-control="voice"]');
      if (!sel) return;
      var prefs = TTS.getPrefs();
      sel.innerHTML = '';
      voices.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = v.name + ' (' + v.lang + ')';
        if (prefs.voiceURI && v.voiceURI === prefs.voiceURI) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!prefs.voiceURI && sel.options.length) {
        var en = voices.filter(function (v) { return v.lang && v.lang.indexOf('en') === 0; });
        var deep = en.filter(function (v) {
          var n = v.name.toLowerCase();
          return n.indexOf('male') > -1 || n.indexOf('daniel') > -1 || n.indexOf('david') > -1;
        });
        var best = deep[0] || en[0] || voices[0];
        if (best) { sel.value = best.voiceURI; TTS.setPref('voiceURI', best.voiceURI); }
      }
    }

    TTS.loadVoices().then(_populateVoiceSelect);
    TTS.onVoicesLoaded(_populateVoiceSelect);

    var toggleBtn = panel.querySelector('[data-tts-toggle="settings"]');
    var settingsBody = panel.querySelector('.cb-tts-settings-body');
    if (toggleBtn && settingsBody) {
      toggleBtn.addEventListener('click', function () {
        var open = settingsBody.style.display !== 'none';
        settingsBody.style.display = open ? 'none' : 'block';
        toggleBtn.classList.toggle('active', !open);
      });
    }

    var voiceSel = panel.querySelector('[data-tts-control="voice"]');
    if (voiceSel) voiceSel.addEventListener('change', function () {
      TTS.setPref('voiceURI', this.value);
    });
    var rateSlider = panel.querySelector('[data-tts-control="rate"]');
    if (rateSlider) rateSlider.addEventListener('input', function () {
      var v = parseFloat(this.value);
      TTS.setPref('rate', v);
      var lbl = panel.querySelector('[data-tts-val="rate"]');
      if (lbl) lbl.textContent = v.toFixed(2);
    });
    var pitchSlider = panel.querySelector('[data-tts-control="pitch"]');
    if (pitchSlider) pitchSlider.addEventListener('input', function () {
      var v = parseFloat(this.value);
      TTS.setPref('pitch', v);
      var lbl = panel.querySelector('[data-tts-val="pitch"]');
      if (lbl) lbl.textContent = v.toFixed(2);
    });
    var autoCont = panel.querySelector('[data-tts-control="autoContinue"]');
    if (autoCont) autoCont.addEventListener('change', function () {
      TTS.setPref('autoContinue', this.checked);
    });

    function _getPart1Text() {
      var el = panel.querySelector('[data-tts-section="part1"] .cb-read-aloud-text');
      return el ? el.innerHTML : '';
    }
    function _getPart2Text() {
      var el = panel.querySelector('[data-tts-section="part2"] .cb-read-aloud-text');
      return el ? el.innerHTML : '';
    }
    function _getSingleText() {
      var el = panel.querySelector('[data-tts-section="single"] .cb-read-aloud-text');
      return el ? el.innerHTML : '';
    }

    function _updateButtons(state, partId) {
      var isSpeaking = state === 'speaking' || state === 'waiting';
      panel.querySelectorAll('.cb-tts-narrate-btn').forEach(function (btn) {
        var action = btn.dataset.ttsAction;
        if (isSpeaking) {
          btn.innerHTML = '&#9632; Stop';
          btn.classList.add('speaking');
        } else {
          btn.classList.remove('speaking');
          btn.innerHTML = '&#9654; Narrate';
        }
      });

      panel.querySelectorAll('[data-tts-section]').forEach(function (sec) {
        sec.classList.remove('cb-tts-active');
      });
      if (isSpeaking && partId) {
        var sectionKey = partId.replace(/^.*?(part1|part2|single)$/, '$1');
        var activeSec = panel.querySelector('[data-tts-section="' + sectionKey + '"]');
        if (activeSec) activeSec.classList.add('cb-tts-active');
      }
    }

    TTS.onStateChange(_updateButtons);

    panel.querySelectorAll('.cb-tts-narrate-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = btn.dataset.ttsAction;
        if (TTS.getState() === 'speaking' || TTS.getState() === 'waiting') {
          TTS.stop();
          return;
        }
        if (action === 'narrate-all') {
          TTS.speakParts(_getPart1Text(), _getPart2Text(), 'ra_');
        } else if (action === 'narrate-part2') {
          TTS.speak(_getPart2Text(), 'ra_part2');
        } else if (action === 'narrate-single') {
          TTS.speak(_getSingleText(), 'ra_single');
        }
      });
    });
  }

  function _bindNpcPanelEvents(panel) {
    panel.querySelectorAll('.cb-npc-card-header').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.cb-npc-edit-btn') || e.target.closest('.cb-npc-remove-btn')) return;
        var card = el.closest('.cb-npc-card');
        if (!card) return;
        var expandKey = el.dataset.npcToggle;
        card.classList.toggle('expanded');
        _npcExpandState[expandKey] = card.classList.contains('expanded');
      });
    });
    panel.querySelectorAll('.cb-npc-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.npcIdx, 10);
        var npcs = getSceneNpcs();
        var npc = npcs[idx];
        if (!npc || !npc.threatBuild) return;
        var buildData = JSON.parse(JSON.stringify(npc.threatBuild));
        buildData.name = npc.name || buildData.name || '';
        if (npc.loot) buildData.loot = JSON.parse(JSON.stringify(npc.loot));
        if (window.NpcBuilder) {
          window.NpcBuilder.openWithNpc(buildData, function (updated) {
            npc.name = updated.name || npc.name;
            npc.threatBuild = updated;
            npc.threatBuild.computed = updated.computed;
            if (updated.roleKit) npc.threatBuild.roleKit = updated.roleKit;
            if (updated.powerSource) npc.threatBuild.powerSource = updated.powerSource;
            npc.threatBuild.computedAttacks = updated.computedAttacks || [];
            if (updated.loot) npc.loot = updated.loot;
            setSceneNpcs(npcs);
            persistSceneNpc(idx, npc);
            _refreshNpcPanel();
          });
        }
      });
    });
    panel.querySelectorAll('.cb-npc-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.npcIdx, 10);
        var npcs = getSceneNpcs();
        if (idx < 0 || idx >= npcs.length) return;
        npcs.splice(idx, 1);
        setSceneNpcs(npcs);
        deleteSceneNpc(idx);
        _refreshNpcPanel();
        renderScene();
      });
    });
    panel.querySelectorAll('.cb-npc-loot-assign-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.dataset.menuOpen === 'true') return;
        btn.dataset.menuOpen = 'true';
        var lootIdx = parseInt(btn.dataset.lootIdx, 10);
        var card = btn.closest('.cb-npc-card');
        var npcIdx = card ? parseInt(card.dataset.npcIdx, 10) : -1;
        var online = partyCache.filter(function (pc) { return pc.id; });
        if (!online.length) {
          showLootToast('No players online.');
          btn.dataset.menuOpen = 'false';
          return;
        }
        var menu = document.createElement('div');
        menu.className = 'cb-loot-assign-menu';
        online.forEach(function (pc) {
          var opt = document.createElement('button');
          opt.className = 'cb-loot-assign-option';
          opt.textContent = pc.name || ('PC #' + pc.id);
          opt.addEventListener('click', function () {
            assignLootToPC(npcIdx, lootIdx, pc.id, pc.name || ('PC #' + pc.id));
            menu.remove();
            btn.dataset.menuOpen = 'false';
          });
          menu.appendChild(opt);
        });
        btn.parentNode.style.position = 'relative';
        btn.parentNode.appendChild(menu);
        setTimeout(function () {
          document.addEventListener('click', function closeMenu(ev) {
            if (!menu.contains(ev.target)) {
              menu.remove();
              btn.dataset.menuOpen = 'false';
              document.removeEventListener('click', closeMenu);
            }
          });
        }, 0);
      });
    });
    var addNpcBtn = panel.querySelector('#cb-add-npc-btn');
    if (addNpcBtn) {
      addNpcBtn.addEventListener('click', function () {
        var addPanel = panel.querySelector('#cb-add-npc-panel');
        if (!addPanel) return;
        if (addPanel.style.display !== 'none') {
          addPanel.style.display = 'none';
          return;
        }
        var saved = window.NpcBuilder ? window.NpcBuilder.getSavedNpcs() : [];
        if (!saved.length) {
          addPanel.style.display = 'block';
          addPanel.innerHTML = '<p class="cb-muted" style="font-size:0.7rem;">No saved NPCs in Threat Builder. Open the Threat Builder and save some first.</p>';
          return;
        }
        var ph = '<div class="cb-add-npc-list">';
        saved.forEach(function (npc, si) {
          var catBadge = (npc.threatCategory && npc.threatCategory !== 'character') ? esc(npc.threatCategory.charAt(0).toUpperCase() + npc.threatCategory.slice(1)) + ' ' : '';
          ph += '<button class="cb-add-npc-item" data-saved-idx="' + si + '">';
          ph += '<span class="cb-add-npc-item-name">' + esc(npc.name || 'Unnamed') + '</span>';
          ph += '<span class="cb-add-npc-item-meta">' + catBadge + 'T' + (npc.tier || 0) + ' ' + esc(npc.classification || '') + ' ' + esc(npc.role || '') + '</span>';
          ph += '</button>';
        });
        ph += '</div>';
        addPanel.innerHTML = ph;
        addPanel.style.display = 'block';
        addPanel.querySelectorAll('.cb-add-npc-item').forEach(function (item) {
          item.addEventListener('click', function () {
            var si = parseInt(item.dataset.savedIdx, 10);
            var savedNpc = saved[si];
            if (!savedNpc) return;
            window.NpcBuilder.buildNpcFromSaved(savedNpc).then(function (built) {
              var newNpc = {
                name: savedNpc.name || 'Unnamed',
                _templateName: (savedNpc.name || 'unnamed').toLowerCase().trim(),
                type: (savedNpc.threatCategory || 'character').charAt(0).toUpperCase() + (savedNpc.threatCategory || 'character').slice(1),
                count: 1,
                loot: savedNpc.loot ? JSON.parse(JSON.stringify(savedNpc.loot)) : [],
                threatBuild: {
                  role: savedNpc.role,
                  tier: savedNpc.tier,
                  classification: savedNpc.classification,
                  threatCategory: savedNpc.threatCategory,
                  powerSource: savedNpc.powerSource || built.powerSource || '',
                  arenas: JSON.parse(JSON.stringify(savedNpc.arenas)),
                  computed: built.computed,
                  traits: savedNpc.traits ? JSON.parse(JSON.stringify(savedNpc.traits)) : [],
                  tags: savedNpc.tags ? JSON.parse(JSON.stringify(savedNpc.tags)) : [],
                  roleKit: built.roleKit,
                  computedAttacks: built.computedAttacks || [],
                  weaponChassis: savedNpc.weaponChassis || 'medium',
                  loot: savedNpc.loot ? JSON.parse(JSON.stringify(savedNpc.loot)) : []
                }
              };
              var npcs = getSceneNpcs();
              npcs.push(newNpc);
              setSceneNpcs(npcs);
              addSceneNpc(newNpc);
              addPanel.style.display = 'none';
              _refreshNpcPanel();
              renderScene();
            });
          });
        });
      });
    }
  }

  function _refreshNpcPanel() {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    if (!scene) return;
    var panel = document.getElementById('fp-npcs');
    if (!panel) return;
    var body = panel.querySelector('.cb-fpanel-body');
    if (body) {
      body.innerHTML = _buildNpcRosterHtml(scene);
      _bindNpcPanelEvents(panel);
    }
  }

  function _bindEncounterPanelEvents(panel) {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    panel.querySelectorAll('.ct-start-encounter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var encIdx = parseInt(btn.dataset.encIdx, 10);
        if (isNaN(encIdx) || !scene || !scene.encounters || !scene.encounters[encIdx]) return;
        var enc = scene.encounters[encIdx];
        if (window.CombatTracker) {
          window._cbSocket = socket;
          window.CombatTracker.start(enc, scene, getSceneNpcs(), partyCache, socket);
          closeFloatingPanel('encounters');
          var ctPanel = document.getElementById('combat-tracker-panel');
          if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function renderScene() {
    if (window.CombatTracker && window.CombatTracker.isActive() && currentScene !== _lastRenderedScene) {
      window.CombatTracker.end();
    }
    _lastRenderedScene = currentScene;
    var container = document.getElementById('scene-carousel');
    if (!container) return;
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;

    if (!scene) {
      if (adv && part && !(part.scenes || []).length) {
        container.innerHTML = '<div class="cb-empty-scene"><h3>' + esc(adv.title) + ' — Part ' + part.number + ': ' + esc(part.title) + '</h3><p>Scene content for this part is coming soon.</p></div>';
      } else {
        container.innerHTML = '<div class="cb-empty-scene"><p>Select a scene to begin.</p></div>';
      }
      return;
    }

    var comp = completionsData[scene.id];
    var isDone = comp && comp.completed;
    var scenes = getAllScenes();
    var idx = currentSceneIndex();

    var hasReadAloud = !!(scene.readAloudPart1 || scene.readAloud);
    var hasGmNotes = !!scene.gmNotes;
    var sceneNpcs = getSceneNpcs();
    var hasNpcs = true;
    var hasEncounters = !!(scene.encounters && scene.encounters.length);
    var dcList = (scene.disciplineChallenges && scene.disciplineChallenges.length) ? scene.disciplineChallenges : (scene.skillChecks || []);
    var hasChallenges = dcList.length > 0;
    var hasEnvironment = !!(scene.hazards || (scene.environmentMechanics && scene.environmentMechanics.length));
    var hasRewards = !!(scene.rewards && (scene.rewards.credits || (scene.rewards.items && scene.rewards.items.length) || (scene.rewards.intel && scene.rewards.intel.length) || (scene.rewards.connections && scene.rewards.connections.length)));
    var hasPacing = !!scene.pacing;
    var hasDecisions = !!(scene.decisions && scene.decisions.length);
    var hasLoreTags = !!(scene.loreTags && scene.loreTags.length);
    var hasNarrativeLinks = !!(scene.narrativeLinks && scene.narrativeLinks.length);

    var html = '<div class="cb-dashboard">';

    html += '<div class="cb-dash-header">';
    html += '<h2>Scene ' + scene.number + ': ' + esc(scene.title) + '</h2>';
    if (scene.subtitle) html += '<div class="cb-scene-subtitle">' + esc(scene.subtitle) + '</div>';
    var sceneAdaptations = _getSceneAdaptations(scene.id);
    var partAdaptations = part ? _getPartAdaptations(part.id) : [];
    var allBadgeAdaptations = sceneAdaptations.concat(partAdaptations);
    if (allBadgeAdaptations.length) {
      html += '<div class="cb-adaptation-badges">';
      for (var ai = 0; ai < allBadgeAdaptations.length; ai++) {
        var ad = allBadgeAdaptations[ai];
        html += '<span class="cb-adaptation-badge" title="' + esc(ad.impact + ' = ' + ad.is + ' (' + ad.action + (ad.field ? ': ' + ad.field : '') + ')') + '">&#9881; Adapted: ' + esc(ad.impact) + '</span>';
      }
      html += '</div>';
    }
    if (scene.id === 'adv1-p1-s1') {
      html += '<div class="assess-controls-row" id="assess-controls-row">';
      html += '<button class="assess-guide-btn" id="assess-guide-btn">&#9733; GM Reference</button>';
      html += '<button class="assess-guide-btn assess-tutorial-start" id="tutorial-start-btn">&#9656; Start Player Tutorial</button>';
      html += '<button class="assess-guide-btn assess-tutorial-advance hidden" id="tutorial-advance-btn">&#9656;&#9656; Next Phase</button>';
      html += '<button class="assess-guide-btn assess-tutorial-end hidden" id="tutorial-end-btn">&#9632; End Tutorial</button>';
      html += '<span class="assess-tutorial-status hidden" id="tutorial-status"></span>';
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="cb-tile-grid">';
    if (hasReadAloud) {
      var raMeta = (scene.readAloudPart1 && scene.readAloudPart2) ? '2 parts' : 'Ready';
      html += '<div class="cb-tile' + (_openPanels['readaloud'] ? ' cb-tile--active' : '') + '" data-panel-id="readaloud"><span class="cb-tile-icon">&#128220;</span><span class="cb-tile-label">Read Aloud</span><span class="cb-tile-meta">' + raMeta + '</span></div>';
    }
    if (hasGmNotes) {
      var noteLineCount = scene.gmNotes.split(/\n\s*\n/).filter(function(s){ return s.trim(); }).length;
      html += '<div class="cb-tile' + (_openPanels['gmnotes'] ? ' cb-tile--active' : '') + '" data-panel-id="gmnotes"><span class="cb-tile-icon">&#128221;</span><span class="cb-tile-label">GM Notes</span><span class="cb-tile-meta">' + noteLineCount + ' sections</span></div>';
    }
    if (hasNpcs) {
      html += '<div class="cb-tile' + (_openPanels['npcs'] ? ' cb-tile--active' : '') + '" data-panel-id="npcs"><span class="cb-tile-icon">&#9876;</span><span class="cb-tile-label">NPCs</span><span class="cb-tile-meta">' + sceneNpcs.length + ' in roster</span></div>';
    }
    if (hasEncounters) {
      html += '<div class="cb-tile' + (_openPanels['encounters'] ? ' cb-tile--active' : '') + '" data-panel-id="encounters"><span class="cb-tile-icon">&#9876;</span><span class="cb-tile-label">Encounters</span><span class="cb-tile-meta">' + scene.encounters.length + ' total</span></div>';
    }
    if (hasChallenges) {
      html += '<div class="cb-tile' + (_openPanels['challenges'] ? ' cb-tile--active' : '') + '" data-panel-id="challenges"><span class="cb-tile-icon">&#127922;</span><span class="cb-tile-label">Challenges</span><span class="cb-tile-meta">' + dcList.length + ' checks</span></div>';
    }
    if (hasEnvironment) {
      var envCount = (scene.environmentMechanics ? scene.environmentMechanics.length : 0) + (scene.hazards ? 1 : 0);
      html += '<div class="cb-tile' + (_openPanels['environment'] ? ' cb-tile--active' : '') + '" data-panel-id="environment"><span class="cb-tile-icon">&#127758;</span><span class="cb-tile-label">Environment</span><span class="cb-tile-meta">' + envCount + ' effects</span></div>';
    }
    if (hasRewards) {
      html += '<div class="cb-tile' + (_openPanels['rewards'] ? ' cb-tile--active' : '') + '" data-panel-id="rewards"><span class="cb-tile-icon">&#127942;</span><span class="cb-tile-label">Rewards</span><span class="cb-tile-meta">' + (scene.rewards.credits ? scene.rewards.credits + ' cr' : 'Loot') + '</span></div>';
    }
    if (hasPacing) {
      html += '<div class="cb-tile' + (_openPanels['pacing'] ? ' cb-tile--active' : '') + '" data-panel-id="pacing"><span class="cb-tile-icon">&#9200;</span><span class="cb-tile-label">Pacing</span><span class="cb-tile-meta">' + (scene.pacing.estimatedMinutes ? '~' + scene.pacing.estimatedMinutes + ' min' : 'Guide') + '</span></div>';
    }
    html += '<div class="cb-tile' + (_openPanels['holonet'] ? ' cb-tile--active' : '') + '" data-panel-id="holonet"><span class="cb-tile-icon">&#128225;</span><span class="cb-tile-label">HoloNet</span><span class="cb-tile-meta">Broadcast</span></div>';
    html += '</div>';

    if (hasDecisions) {
      html += '<div class="cb-dash-decisions">';
      html += '<div class="cb-dash-section-label">Decision Points</div>';
      scene.decisions.forEach(function (d) {
        html += '<div class="cb-dash-decision-chip" data-dec-choice="' + esc(d.choice) + '"><strong>' + esc(d.choice) + '</strong> <span>&rarr; ' + esc(d.consequence) + '</span></div>';
      });
      html += '</div>';
    }

    if (hasLoreTags) {
      html += '<div class="cb-dash-lore-row">';
      scene.loreTags.forEach(function (tag) {
        html += '<span class="cb-lore-tag" data-lore-tag="' + esc(tag) + '">' + esc(tag) + '</span>';
      });
      html += '</div>';
    }

    if (hasNarrativeLinks) {
      html += '<div class="cb-dash-narrative-row">';
      scene.narrativeLinks.forEach(function (link) {
        html += '<a class="cb-narrative-link" data-nav-scene="' + esc(link.targetScene) + '">&rarr; ' + esc(link.note) + '</a> ';
      });
      html += '</div>';
    }

    var allScenesComplete = scenes.length > 0 && scenes.every(function (s) { var c = completionsData[s.id]; return c && c.completed; });
    html += '<div class="cb-dash-footer">';
    html += '<button class="cb-complete-btn' + (isDone ? ' completed' : '') + '" data-scene="' + scene.id + '">' + (isDone ? '&#10003; Scene Complete' : '&#9675; Mark Scene Complete') + '</button>';
    html += '<button class="cb-mission-debrief-btn' + (allScenesComplete ? ' all-complete' : '') + '" id="cb-gen-summary" title="' + (allScenesComplete ? 'All scenes complete — generate Mission Chronicle' : 'Generate Mission Chronicle (adventure in progress)') + '">&#9881; Mission Debrief</button>';
    html += '<div class="cb-scene-nav-arrows">';
    html += '<button class="cb-arrow-btn" id="scene-prev"' + (idx <= 0 ? ' disabled' : '') + '>&larr; Prev</button>';
    html += '<button class="cb-arrow-btn" id="scene-next"' + (idx >= scenes.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.cb-tile').forEach(function (tile) {
      tile.addEventListener('click', function () {
        var panelId = tile.dataset.panelId;
        if (_openPanels[panelId]) {
          closeFloatingPanel(panelId);
          return;
        }
        var titleMap = { readaloud: 'Read Aloud', gmnotes: 'GM Notes', npcs: 'NPC Roster', encounters: 'Encounters', challenges: 'Discipline Challenges', environment: 'Environment', rewards: 'Rewards', pacing: 'Pacing Guide', holonet: 'HoloNet Broadcast Terminal' };
        var contentMap = {
          readaloud: function () { return _buildReadAloudHtml(scene); },
          gmnotes: function () { return _buildGmNotesHtml(scene); },
          npcs: function () { return _buildNpcRosterHtml(scene); },
          encounters: function () { return _buildEncountersHtml(scene); },
          challenges: function () { return _buildChallengesHtml(scene); },
          environment: function () { return _buildEnvironmentHtml(scene); },
          rewards: function () { return _buildRewardsHtml(scene); },
          pacing: function () { return _buildPacingHtml(scene); },
          holonet: function () { return _buildHoloNetHtml(); }
        };
        var sizeMap = { readaloud: { width: 560, height: 450 }, gmnotes: { width: 520, height: 400 }, npcs: { width: 520, height: 500 }, encounters: { width: 560, height: 480 }, challenges: { width: 540, height: 460 }, environment: { width: 480, height: 380 }, rewards: { width: 420, height: 300 }, pacing: { width: 440, height: 320 }, holonet: { width: 620, height: 560 } };
        var builder = contentMap[panelId];
        if (builder) {
          openFloatingPanel(panelId, titleMap[panelId] || panelId, builder(), sizeMap[panelId]);
        }
      });
    });

    container.querySelectorAll('.cb-dash-decision-chip').forEach(function (chip) {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', function () {
        openDecisionModal([chip.dataset.decChoice]);
      });
    });
    container.querySelectorAll('.cb-lore-tag').forEach(function (el) {
      el.addEventListener('click', function () { openLoreModal(el.dataset.loreTag); });
    });
    container.querySelectorAll('.cb-narrative-link').forEach(function (el) {
      el.addEventListener('click', function () { navigateToScene(el.dataset.navScene); });
    });
    container.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
    var assessBtn = document.getElementById('assess-guide-btn');
    if (assessBtn) {
      assessBtn.addEventListener('click', function () { openAssessGuide(); });
    }
    var tutStartBtn = document.getElementById('tutorial-start-btn');
    if (tutStartBtn) {
      tutStartBtn.addEventListener('click', function () { _startPlayerTutorial(); });
    }
    var tutAdvBtn = document.getElementById('tutorial-advance-btn');
    if (tutAdvBtn) {
      tutAdvBtn.addEventListener('click', function () { _advancePlayerTutorial(); });
    }
    var tutEndBtn = document.getElementById('tutorial-end-btn');
    if (tutEndBtn) {
      tutEndBtn.addEventListener('click', function () { _endPlayerTutorial(); });
    }
    var completeBtn = container.querySelector('.cb-complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function () { toggleSceneComplete(completeBtn.dataset.scene); });
    }
    var genSummaryBtn = document.getElementById('cb-gen-summary');
    if (genSummaryBtn) {
      genSummaryBtn.addEventListener('click', function () { openMissionSummaryModal(); });
    }
    var prevBtn = document.getElementById('scene-prev');
    var nextBtn = document.getElementById('scene-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { navigateScene(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { navigateScene(1); });
  }

  function toggleSceneComplete(sceneId) {
    var current = completionsData[sceneId];
    var newState = !(current && current.completed);
    fetch('/api/campaign/scene/' + sceneId + '/complete', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: newState })
    }).then(function (res) {
      if (!res.ok) throw new Error('Server error');
      if (!completionsData[sceneId]) completionsData[sceneId] = {};
      completionsData[sceneId].completed = newState ? 1 : 0;
      renderScene();
      if (newState) promptDecisionOnComplete(sceneId);
    }).catch(function (err) { console.error('Failed to update scene completion:', err); });
  }

  function saveProgress() {
    if (!currentAdventure || !currentPart || !currentScene) return;
    fetch('/api/campaign/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adventure_id: currentAdventure, part_id: currentPart, scene_id: currentScene })
    }).catch(function (err) { console.error('Failed to save progress:', err); });
    loadSceneIntel(currentScene);
  }

  function navigateToScene(sceneId) {
    if (!adventuresData) return;
    closeAllFloatingPanels();
    adventuresData.adventures.forEach(function (adv) {
      (adv.parts || []).forEach(function (part) {
        (part.scenes || []).forEach(function (scene) {
          if (scene.id === sceneId) {
            currentAdventure = adv.id;
            currentPart = part.id;
            currentScene = scene.id;
            renderAdvNav();
            renderAdvSelect();
            renderPartNav();
            renderPartSelect();
            renderScene();
            renderSceneCounter();
            saveProgress();
          }
        });
      });
    });
  }

  function openLoreModal(tag) {
    var panelId = 'lore-' + tag.replace(/[^a-zA-Z0-9]/g, '_');
    var loadingHtml = '<p style="color:#7a7068;">Loading...</p>';
    openFloatingPanel(panelId, 'Lore: ' + tag, loadingHtml, { width: 420, height: 320 });
    fetch('/api/campaign/lore-tags/' + encodeURIComponent(tag))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var panel = document.getElementById('fp-' + panelId);
        if (!panel) return;
        var body = panel.querySelector('.cb-fpanel-body');
        if (!body) return;
        if (!data.scenes || !data.scenes.length) {
          body.innerHTML = '<p style="color:#7a7068;">No scenes found with this tag.</p>';
          return;
        }
        body.innerHTML = data.scenes.map(function (s) {
          return '<div class="cb-lore-scene-link" data-nav-scene="' + esc(s.sceneId) + '">' +
            '<div style="font-weight:600;">Adventure ' + s.adventureNumber + ': ' + esc(s.adventureTitle) + '</div>' +
            '<div style="color:#7a7068;font-size:0.8rem;">Part ' + s.partNumber + ': ' + esc(s.partTitle) + ' — Scene ' + s.sceneNumber + ': ' + esc(s.sceneTitle) + '</div>' +
          '</div>';
        }).join('');
        body.querySelectorAll('.cb-lore-scene-link').forEach(function (el) {
          el.addEventListener('click', function () {
            closeFloatingPanel(panelId);
            navigateToScene(el.dataset.navScene);
          });
        });
      })
      .catch(function () {
        var panel = document.getElementById('fp-' + panelId);
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) body.innerHTML = '<p style="color:#c8a44e;">Failed to load lore data.</p>';
        }
      });
  }

  function loadPartyMonitor() {
    fetch('/api/campaign/party')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        partyCache = data.party || [];
        renderPartyList(partyCache);
      })
      .catch(function () {
        var el = document.getElementById('party-list');
        if (el) el.innerHTML = '<p class="cb-muted">Failed to load party data.</p>';
      });
  }

  function loadSceneIntel(sceneId) {
    if (!sceneId) { sceneIntelData = null; renderPartyList(partyCache); return; }
    fetch('/api/campaign/scene-intel/' + encodeURIComponent(sceneId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sceneIntelData = data;
        renderPartyList(partyCache);
      })
      .catch(function () {
        sceneIntelData = null;
        renderPartyList(partyCache);
      });
  }

  function renderPartyList(party) {
    var list = document.getElementById('party-list');
    if (!list) return;
    if (!party.length) {
      list.innerHTML = '<p class="cb-muted" style="font-style:italic;">No crew online.</p>';
      return;
    }

    var hasIntel = sceneIntelData && sceneIntelData.hasTags;
    var html = '';

    if (hasIntel) {
      var typeLabel = sceneIntelData.challengeType ? sceneIntelData.challengeType.toUpperCase() : 'TAGGED';
      html += '<div class="cb-scene-intel-bar"><span class="cb-intel-pulse"></span> Scene Intel Active — ' + esc(typeLabel) + '</div>';
    }

    html += party.map(function (pc) {
      var intelForChar = null;
      if (hasIntel && sceneIntelData.intel) {
        intelForChar = sceneIntelData.intel.find(function (i) { return i.id === pc.id; });
      }
      var insights = intelForChar ? intelForChar.insights || [] : [];

      var vocLabel = '';
      if (pc.vocations && pc.vocations.length) {
        vocLabel = pc.vocations.map(function (v) {
          return esc(v.name || v.kitId || '') + ' T' + (v.tier || 1);
        }).join(', ');
      }

      var cardHtml = '<div class="cb-player-card ' + (pc.connected ? 'connected' : 'disconnected') + '" data-char-id="' + esc(pc.id) + '">';
      cardHtml += '<div class="cb-player-top">';
      cardHtml += '<div>';
      cardHtml += '<div class="cb-player-name">' + esc(pc.name) + ' <span class="cb-player-expand-icon">&#9654;</span></div>';
      cardHtml += '<div class="cb-player-detail">' + esc(pc.species || '') + (pc.archetype ? ' — ' + esc(pc.archetype) : '') + '</div>';
      cardHtml += '</div>';
      cardHtml += (pc.vitality !== null ? '<div class="cb-player-vitality">' + pc.vitality + '</div>' : '');
      cardHtml += '</div>';

      cardHtml += '<div class="cb-player-status">';
      cardHtml += (pc.connected ? '<span style="color:#44AA66;">&#9679; Connected</span>' : '<span>&#9899; Offline</span>');
      cardHtml += (pc.marks != null ? ' <span style="color:#c8a44e;margin-left:0.5rem;">' + pc.marks + ' Marks</span>' : '');
      cardHtml += '</div>';

      if (insights.length) {
        insights.forEach(function (ins) {
          var ratingCls = '';
          var labelHtml = esc(ins.label);
          if (ins.rating) {
            ratingCls = ' rating-' + ins.rating;
            labelHtml = '<span class="rating-' + esc(ins.rating) + '">' + esc(ins.label) + '</span>';
          }
          var hasExpandable = ins.description || (ins.details && ins.details.length);
          cardHtml += '<div class="cb-intel-row type-' + esc(ins.type) + ratingCls + (hasExpandable ? ' cb-intel-expandable' : '') + '">';
          cardHtml += '<span class="cb-intel-icon">' + (ins.icon || '·') + '</span>';
          cardHtml += '<span>' + labelHtml + (hasExpandable ? ' <span class="cb-intel-expand-arrow">&#9660;</span>' : '') + '</span>';
          cardHtml += '</div>';
          if (hasExpandable) {
            cardHtml += '<div class="cb-intel-detail" style="display:none;padding:0.2rem 0.4rem 0.3rem 1.2rem;font-size:0.6rem;line-height:1.4;">';
            if (ins.details && ins.details.length) {
              ins.details.forEach(function(d) {
                cardHtml += '<div style="margin-bottom:0.2rem;"><strong style="color:#c8a44e;">' + esc(d.title) + ':</strong> <span style="color:#7a7068;">' + esc(d.text) + '</span></div>';
              });
            } else if (ins.description) {
              cardHtml += '<div style="color:#7a7068;">' + esc(ins.description) + '</div>';
            }
            cardHtml += '</div>';
          }
        });
      }

      cardHtml += '<div class="cb-player-body">';

      if (vocLabel) {
        cardHtml += '<div class="cb-player-vocations">' + vocLabel + '</div>';
      }

      if (pc.vocationAbilities && pc.vocationAbilities.length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:#7a7068;margin-bottom:0.15rem;">Abilities</div>';
        pc.vocationAbilities.forEach(function (a) {
          cardHtml += '<div style="font-size:0.6rem;color:#7a7068;padding:0.02rem 0;">';
          cardHtml += '<span style="color:#c8a44e;">T' + a.tier + '</span> ';
          cardHtml += esc(a.name);
          if (a.type) cardHtml += ' <span style="opacity:0.5;">(' + esc(a.type) + ')</span>';
          cardHtml += '</div>';
        });
        cardHtml += '</div>';
      }

      if (pc.conditions && pc.conditions.length) {
        cardHtml += '<div class="cb-player-conditions">';
        pc.conditions.forEach(function (c) {
          cardHtml += '<span class="cb-condition-pip">' + esc(c) + '</span>';
        });
        cardHtml += '</div>';
      }

      if (pc.destiny) {
        var destName = pc.destiny.name || pc.destiny.id || '';
        if (destName) {
          cardHtml += '<div style="font-size:0.65rem;color:#c084fc;margin-top:0.2rem;">Destiny: ' + esc(destName) + '</div>';
          if (pc.destiny.coreQuestion) {
            cardHtml += '<div style="font-size:0.55rem;color:#7a7068;opacity:0.7;padding-left:0.3rem;">' + esc(pc.destiny.coreQuestion) + '</div>';
          }
        }
      }

      if (pc.backgroundFavored && pc.backgroundFavored.length) {
        cardHtml += '<div style="font-size:0.6rem;color:#818cf8;margin-top:0.15rem;">Favored: ' + pc.backgroundFavored.map(function (f) { return esc(f.replace(/_/g, ' ')); }).join(', ') + '</div>';
      }

      var ARENA_GROUPS = [
        { id: 'physique', label: 'PHY', discs: ['athletics','brawl','endure','melee','heavy_weapons'] },
        { id: 'reflex', label: 'REF', discs: ['evasion','piloting','ranged','skulduggery','stealth'] },
        { id: 'grit', label: 'GRT', discs: ['beast_handling','intimidate','resolve','survival','control_spark'] },
        { id: 'wits', label: 'WIT', discs: ['investigation','medicine','tactics','tech','sense_spark'] },
        { id: 'presence', label: 'PRS', discs: ['charm','deception','insight','persuasion','alter_spark'] },
      ];

      if (pc.disciplines && Object.keys(pc.disciplines).length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:#7a7068;margin-bottom:0.15rem;">Disciplines</div>';
        ARENA_GROUPS.forEach(function (arena) {
          var arenaDie = pc.arenas && pc.arenas[arena.id] ? pc.arenas[arena.id] : '';
          cardHtml += '<div style="font-size:0.58rem;margin-top:0.15rem;">';
          cardHtml += '<span style="color:#c8a44e;font-family:Audiowide,sans-serif;">' + arena.label + '</span>';
          if (arenaDie) cardHtml += ' <span style="color:#7a7068;opacity:0.7;">' + esc(arenaDie) + '</span>';
          cardHtml += '</div>';
          arena.discs.forEach(function (discId) {
            var disc = pc.disciplines[discId];
            if (!disc) return;
            var trained = disc.training === 'trained' || disc.training === 'formative';
            var color = disc.favored ? '#c084fc' : trained ? '#d4c5a0' : '#7a7068';
            var opacity = trained || disc.favored ? '1' : '0.4';
            cardHtml += '<div style="font-size:0.55rem;color:' + color + ';opacity:' + opacity + ';padding:0.01rem 0 0.01rem 0.5rem;">';
            cardHtml += esc(discId.replace(/_/g, ' '));
            if (disc.die) cardHtml += ' ' + esc(disc.die);
            if (disc.favored) cardHtml += ' ★';
            cardHtml += '</div>';
          });
        });
        cardHtml += '</div>';
      }

      if (pc.gear && pc.gear.length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:#7a7068;margin-bottom:0.15rem;">Gear (' + pc.gear.length + ')</div>';
        pc.gear.forEach(function (g) {
          var tagStr = (g.tags || []).concat(g.traits || []).filter(Boolean).join(', ');
          var isRestricted = (g.tags || []).some(function(t){ return /restricted|illegal/i.test(t); }) || (g.availability && /restricted|illegal/i.test(g.availability));
          var color = isRestricted ? '#ef4444' : '#7a7068';
          cardHtml += '<div style="font-size:0.6rem;color:' + color + ';padding:0.05rem 0;">' + esc(g.name);
          if (g.availability) cardHtml += ' <span style="opacity:0.6;">[' + esc(g.availability) + ']</span>';
          if (tagStr) cardHtml += ' <span style="opacity:0.5;">(' + esc(tagStr) + ')</span>';
          cardHtml += '</div>';
        });
        cardHtml += '</div>';
      }

      cardHtml += '</div>';
      cardHtml += '</div>';
      return cardHtml;
    }).join('');

    list.innerHTML = html;

    list.querySelectorAll('.cb-player-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.cb-intel-expandable')) {
          e.stopPropagation();
          var row = e.target.closest('.cb-intel-expandable');
          var detail = row.nextElementSibling;
          if (detail && detail.classList.contains('cb-intel-detail')) {
            var isOpen = detail.style.display !== 'none';
            detail.style.display = isOpen ? 'none' : 'block';
            var arrow = row.querySelector('.cb-intel-expand-arrow');
            if (arrow) arrow.innerHTML = isOpen ? '&#9660;' : '&#9650;';
          }
          return;
        }
        card.classList.toggle('expanded');
      });
    });
  }

  var _destinyLocked = false;

  function renderGmDestinyPool(pool) {
    var container = document.getElementById('gm-destiny-tokens');
    var countEl = document.getElementById('gm-destiny-count');
    var lockBtn = document.getElementById('gm-destiny-lock');
    if (!container) return;
    if (!pool || pool.length === 0) {
      var emptyMsg = _destinyLocked ? 'Pool locked (empty)' : 'No crew connected';
      container.innerHTML = '<span class="cb-muted" style="font-style:italic;">' + emptyMsg + '</span>';
      if (countEl) countEl.innerHTML = _destinyLocked ? '<span class="destiny-locked-badge">LOCKED</span>' : '';
      if (lockBtn) {
        lockBtn.textContent = _destinyLocked ? 'Unlock Pool' : 'Lock Pool';
        if (_destinyLocked) { lockBtn.classList.add('locked'); } else { lockBtn.classList.remove('locked'); }
      }
      return;
    }
    container.innerHTML = pool.map(function (t, idx) {
      var side = t.side === 'toll' ? 'toll' : 'hope';
      var cls = 'gm-destiny-pip gm-destiny-pip--' + side;
      if (t.tapped) cls += ' gm-destiny-pip--tapped';
      var symbol = side === 'hope' ? '⬤' : '⬤';
      var tip = side === 'hope' ? 'Hope — click to flip' : 'Toll — click to flip';
      if (t.tapped) tip += ' (tapped, right-click to untap)';
      return '<span class="' + cls + '" data-index="' + idx + '" title="' + tip + '">' + symbol + '</span>';
    }).join('');
    container.querySelectorAll('.gm-destiny-pip').forEach(function (el) {
      el.addEventListener('click', function () {
        if (socket) socket.emit('destiny:flip', { index: parseInt(el.dataset.index, 10) });
      });
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (socket) socket.emit('destiny:untap-one', { index: parseInt(el.dataset.index, 10) });
      });
    });
    if (countEl) {
      var hopeCount = pool.filter(function (t) { return t.side === 'hope'; }).length;
      var tollCount = pool.filter(function (t) { return t.side === 'toll'; }).length;
      var tappedCount = pool.filter(function (t) { return t.tapped; }).length;
      var summary = '<span class="hope-count">' + hopeCount + 'H</span> / <span class="toll-count">' + tollCount + 'T</span>';
      if (tappedCount > 0) summary += ' <span style="color:#7a7068;">(' + tappedCount + ' tapped)</span>';
      if (_destinyLocked) summary += ' <span class="destiny-locked-badge">LOCKED</span>';
      countEl.innerHTML = summary;
    }
    if (lockBtn) {
      lockBtn.textContent = _destinyLocked ? 'Unlock Pool' : 'Lock Pool';
      if (_destinyLocked) { lockBtn.classList.add('locked'); } else { lockBtn.classList.remove('locked'); }
    }
  }

  function loadGlossary() {
    fetch('/data/glossary.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { glossaryData = data; })
      .catch(function () { console.error('Failed to load glossary'); });
    fetch('/data/maneuvers.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        maneuversData = [];
        Object.keys(data).forEach(function (k) {
          if (Array.isArray(data[k])) {
            data[k].forEach(function (a) { if (a.id) maneuversData.push(a); });
          }
        });
      })
      .catch(function () { console.error('Failed to load maneuvers'); });
  }

  function showGlossaryEntry(id) {
    if (_panelCollapseState.right) {
      expandPanel('right');
    }
    var panel = document.getElementById('glossary-content');
    if (!panel) return;

    var entry = glossaryData ? glossaryData.find(function (e) { return e.id === id; }) : null;

    if (entry) {
      var html = '';
      html += '<div class="cb-glossary-header">' + esc(entry.name) + '</div>';
      if (entry.type) html += '<div class="cb-glossary-type">' + esc(entry.type) + '</div>';

      if (entry.rule) {
        var pcNpc = splitPcNpc(entry.rule);
        if (pcNpc.pc || pcNpc.npc) {
          html += '<div class="cb-glossary-dual">';
          html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:#5588CC;">PC Effect</div><div>' + linkify(pcNpc.pc || entry.rule) + '</div></div>';
          html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:#c084fc;">NPC Effect</div><div>' + linkify(pcNpc.npc || '—') + '</div></div>';
          html += '</div>';
        } else {
          html += '<div class="cb-glossary-rule">' + linkify(entry.rule) + '</div>';
        }
      }

      if (entry.guide) {
        html += '<div class="cb-glossary-guide">' + esc(entry.guide) + '</div>';
      }

      panel.innerHTML = html;
      panel.querySelectorAll('.cb-condition-link').forEach(function (el) {
        el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
      });
      return;
    }

    var action = maneuversData ? maneuversData.find(function (a) { return a.id === id; }) : null;

    if (action) {
      var html = '';
      html += '<div class="cb-glossary-header">' + esc(action.name) + '</div>';
      html += '<div class="cb-glossary-type">' + esc(action.actionType || 'Action');
      if (action.discipline) html += ' — ' + esc(action.discipline.charAt(0).toUpperCase() + action.discipline.slice(1));
      if (action.arena) html += ' (' + esc(action.arena.charAt(0).toUpperCase() + action.arena.slice(1)) + ')';
      if (action.tags) html += ' ' + esc(action.tags.join(' '));
      html += '</div>';
      if (action.description) html += '<div class="cb-glossary-rule">' + linkify(action.description) + '</div>';
      if (action.risk) html += '<div class="cb-glossary-guide" style="border-left:2px solid #c084fc;padding-left:8px;margin-top:6px;"><strong>Risk:</strong> ' + linkify(action.risk) + '</div>';
      if (action.mastery) html += '<div class="cb-glossary-guide" style="border-left:2px solid #5588CC;padding-left:8px;margin-top:6px;"><strong>Mastery:</strong> ' + linkify(action.mastery) + '</div>';
      if (action.effect && Array.isArray(action.effect)) {
        html += '<div style="margin-top:8px;">';
        action.effect.forEach(function (e) {
          html += '<div style="margin-top:4px;"><span style="color:#c8a44e;">' + esc(e.label || ('Tier ' + e.tier)) + '</span>';
          if (e.range) html += ' <span class="cb-muted">(' + esc(e.range) + ')</span>';
          html += ' — ' + linkify(e.description) + '</div>';
        });
        html += '</div>';
      }
      panel.innerHTML = html;
      panel.querySelectorAll('.cb-condition-link').forEach(function (el) {
        el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
      });
      return;
    }

    panel.innerHTML = '<p class="cb-muted">Entry not found: ' + esc(id) + '</p>';
  }

  function splitPcNpc(ruleText) {
    if (!ruleText) return { pc: '', npc: '' };
    var pcMatch = ruleText.match(/PC:\s*(.*?)(?=\s*NPC:|$)/s);
    var npcMatch = ruleText.match(/NPC:\s*(.*?)(?=\s*PC:|$)/s);
    return { pc: pcMatch ? pcMatch[1].trim() : '', npc: npcMatch ? npcMatch[1].trim() : '' };
  }

  function initDragHandles() {
    var leftHandle = document.getElementById('drag-left');
    var rightHandle = document.getElementById('drag-right');
    var grid = document.getElementById('bridge-grid');
    if (!grid) return;

    function setupDrag(handle, side) {
      if (!handle) return;
      var dragging = false;

      handle.addEventListener('mousedown', startDrag);
      handle.addEventListener('touchstart', startDrag, { passive: false });

      function startDrag(e) {
        e.preventDefault();
        dragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
      }

      function onDrag(e) {
        if (!dragging) return;
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var gridRect = grid.getBoundingClientRect();

        if (side === 'left') {
          var leftW = Math.max(200, Math.min(450, clientX - gridRect.left));
          grid.style.gridTemplateColumns = leftW + 'px 6px 1fr 6px auto';
          var rightCol = grid.querySelector('.cb-col-right');
          if (rightCol) {
            var rightW = parseInt(rightCol.style.width) || 300;
            grid.style.gridTemplateColumns = leftW + 'px 6px 1fr 6px ' + rightW + 'px';
          }
        } else {
          var rightW = Math.max(240, Math.min(500, gridRect.right - clientX));
          grid.style.gridTemplateColumns = 'auto 6px 1fr 6px ' + rightW + 'px';
          var leftCol = grid.querySelector('.cb-col-left');
          if (leftCol) {
            var leftW = parseInt(getComputedStyle(leftCol).width) || 260;
            grid.style.gridTemplateColumns = leftW + 'px 6px 1fr 6px ' + rightW + 'px';
          }
        }
      }

      function stopDrag() {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
      }
    }

    setupDrag(leftHandle, 'left');
    setupDrag(rightHandle, 'right');
  }

  function openPicker(type) {
    var overlay = document.getElementById('cb-picker-overlay');
    var title = document.getElementById('cb-picker-title');
    var list = document.getElementById('cb-picker-list');
    if (!overlay || !title || !list) return;
    var html = '';
    if (type === 'adventure') {
      title.textContent = 'SELECT ADVENTURE';
      html = adventuresData.adventures.map(function (adv) {
        var active = adv.id === currentAdventure;
        return '<div class="cb-picker-item' + (active ? ' active' : '') + '" data-value="' + adv.id + '">' +
          '<span class="cb-picker-item-num">' + adv.number + '</span>' +
          '<span>' + esc(adv.title) + '</span></div>';
      }).join('');
    } else {
      title.textContent = 'SELECT PART';
      var adv = getAdventure(currentAdventure);
      if (adv) {
        html = (adv.parts || []).map(function (part) {
          var active = part.id === currentPart;
          return '<div class="cb-picker-item' + (active ? ' active' : '') + '" data-value="' + part.id + '">' +
            '<span class="cb-picker-item-num">' + part.number + '</span>' +
            '<span>' + esc(part.title) + '</span></div>';
        }).join('');
      }
    }
    list.innerHTML = html;
    list.querySelectorAll('.cb-picker-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var val = item.dataset.value;
        closePicker();
        if (type === 'adventure') selectAdventure(val);
        else selectPart(val);
      });
    });
    overlay.classList.add('active');
  }

  function closePicker() {
    var overlay = document.getElementById('cb-picker-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  var _cbHeaderAdv = document.getElementById('cb-header-adv');
  var _cbHeaderPart = document.getElementById('cb-header-part');
  if (_cbHeaderAdv) _cbHeaderAdv.addEventListener('click', function () { openPicker('adventure'); });
  if (_cbHeaderPart) _cbHeaderPart.addEventListener('click', function () { openPicker('part'); });

  var _cbPickerClose = document.getElementById('cb-picker-close');
  if (_cbPickerClose) _cbPickerClose.addEventListener('click', closePicker);
  var _cbPickerOverlay = document.getElementById('cb-picker-overlay');
  if (_cbPickerOverlay) _cbPickerOverlay.addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closePicker();
  });

  function initSockets() {
    if (!socket) return;
    socket.emit('session:join', { role: 'gm' });
    socket.emit('destiny:request');

    socket.on('destiny:sync', function (data) {
      if (typeof data.locked === 'boolean') _destinyLocked = data.locked;
      renderGmDestinyPool(data.pool || data);
    });

    socket.on('player:connected', function () { loadPartyMonitor(); });
    socket.on('player:disconnected', function () { loadPartyMonitor(); });
    socket.on('state:sync', function () { loadPartyMonitor(); });
    socket.on('advancement:sync', function () { loadPartyMonitor(); });

    socket.on('combat:state', function (data) {
      if (data && data.active && window.CombatTracker && !window.CombatTracker.isActive()) {
        window._cbSocket = socket;
        window.CombatTracker.restore(data);
        var ctPanel = document.getElementById('combat-tracker-panel');
        if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    socket.on('combat:turn-advanced', function (data) {
      if (window.CombatTracker && window.CombatTracker.applyTurnAdvance) {
        window.CombatTracker.applyTurnAdvance(data);
      }
    });
    socket.on('session:joined', function () {
      socket.emit('combat:request-state');
    });

    socket.on('tutorial:gm-ack', function (data) {
      _updateTutorialControls(data);
    });
  }

  var destinyUntapBtn = document.getElementById('gm-destiny-untap');
  var destinyResetBtn = document.getElementById('gm-destiny-reset');
  var destinyLockBtn = document.getElementById('gm-destiny-lock');
  if (destinyUntapBtn) destinyUntapBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:untap'); });
  if (destinyResetBtn) destinyResetBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:reset'); });
  if (destinyLockBtn) destinyLockBtn.addEventListener('click', function () {
    if (!socket) return;
    if (_destinyLocked) {
      socket.emit('destiny:unlock');
    } else {
      socket.emit('destiny:lock');
    }
  });

  var logoutBtn = document.getElementById('cb-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function () { window.location.href = '/login'; })
      .catch(function () { window.location.href = '/login'; });
  });


  function loadItemRequests() {
    fetch('/api/item-requests')
      .then(function (r) { return r.json(); })
      .then(function (data) { renderItemRequests(data.requests || []); })
      .catch(function () {
        var el = document.getElementById('item-requests-list');
        if (el) el.innerHTML = '<p class="cb-muted">Failed to load requests.</p>';
      });
  }

  function renderItemRequests(requests) {
    var list = document.getElementById('item-requests-list');
    var badge = document.getElementById('req-badge');
    if (!list) return;

    var pendingCount = requests.filter(function (r) { return r.status === 'pending'; }).length;
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }

    if (!requests.length) {
      list.innerHTML = '<p class="cb-muted" style="font-style:italic;">No item requests yet.</p>';
      return;
    }

    list.innerHTML = requests.map(function (req) {
      var date = new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var html = '<div class="cb-req-card status-' + esc(req.status) + '">';
      html += '<span class="cb-req-status-tag ' + esc(req.status) + '">' + esc(req.status) + '</span>';
      html += '<div class="cb-req-item-name">' + esc(req.item_name) + '</div>';
      html += '<div class="cb-req-char">' + esc(req.character_name) + ' &middot; ' + date + '</div>';
      if (req.description) html += '<div class="cb-req-desc">' + esc(req.description) + '</div>';
      if (req.reference_url) html += '<div><a class="cb-req-link" href="' + esc(req.reference_url) + '" target="_blank">' + esc(req.reference_url) + '</a></div>';
      if (req.gm_notes) html += '<div style="font-size:0.7rem;color:#c084fc;margin-top:0.2rem;">GM: ' + esc(req.gm_notes) + '</div>';
      if (req.status === 'pending') {
        html += '<div class="cb-req-actions">';
        html += '<button class="cb-req-action approve" data-req-id="' + req.id + '" data-req-action="approved">Approve</button>';
        html += '<button class="cb-req-action deny" data-req-id="' + req.id + '" data-req-action="denied">Deny</button>';
        html += '<button class="cb-req-action" data-req-id="' + req.id + '" data-req-action="converted">Converted</button>';
        html += '</div>';
      }
      html += '</div>';
      return html;
    }).join('');

    list.querySelectorAll('.cb-req-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var reqId = btn.dataset.reqId;
        var action = btn.dataset.reqAction;
        fetch('/api/item-requests/' + reqId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action })
        }).then(function (r) {
          if (!r.ok) throw new Error('Server error');
          loadItemRequests();
        }).catch(function (err) { console.error('Failed to update request:', err); });
      });
    });
  }

  var assessData = null;
  var assessActivePhase = 0;
  var assessActiveDisc = 0;

  function openAssessGuide() {
    if (assessData) {
      _renderAssessPanel();
      return;
    }
    fetch('/data/tutorials/scene1-assess.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        assessData = data;
        assessActivePhase = 0;
        assessActiveDisc = 0;
        _renderAssessPanel();
      })
      .catch(function (err) {
        console.error('Failed to load assess guide:', err);
      });
  }

  function _renderAssessPanel() {
    if (!assessData) return;
    var panelId = 'assess-guide';
    var contentHtml = _buildAssessHtml();
    var existing = document.getElementById('fp-' + panelId);
    if (existing) {
      var body = existing.querySelector('.cb-fpanel-body');
      if (body) body.innerHTML = contentHtml;
      _bindAssessEvents(existing);
      existing.style.zIndex = ++_panelZCounter;
      return;
    }
    openFloatingPanel(panelId, assessData.title || 'ASSESS GUIDE', contentHtml, { width: 720, height: 520 });
    var panel = document.getElementById('fp-' + panelId);
    if (panel) _bindAssessEvents(panel);
  }

  function _buildAssessHtml() {
    if (!assessData) return '';
    var html = '';
    html += '<div class="assess-phase-tabs">';
    html += assessData.phases.map(function (phase, pi) {
      return '<button class="assess-phase-tab' + (pi === assessActivePhase ? ' active' : '') + '" data-phase="' + pi + '">' +
        esc(phase.label) + '</button>';
    }).join('');
    html += '</div>';
    var phase = assessData.phases[assessActivePhase];
    if (!phase) return html;
    html += '<div class="assess-body">';
    html += '<nav class="assess-disc-nav">';
    html += phase.disciplines.map(function (disc, di) {
      return '<button class="assess-disc-btn' + (di === assessActiveDisc ? ' active' : '') + '" data-disc="' + di + '">' +
        esc(disc.label) + '<span class="assess-disc-arena">(' + esc(disc.arena) + ')</span></button>';
    }).join('');
    html += '</nav>';
    html += '<div class="assess-content">' + _buildAssessContentHtml() + '</div>';
    html += '</div>';
    return html;
  }

  function _buildAssessContentHtml() {
    if (!assessData) return '';
    var phase = assessData.phases[assessActivePhase];
    if (!phase) return '';
    var disc = phase.disciplines[assessActiveDisc];
    if (!disc) return '';
    var html = '';
    if (disc.focus) {
      html += '<div class="assess-disc-focus">' + esc(disc.focus) + '</div>';
    }
    disc.entries.forEach(function (entry) {
      var cls = 'assess-entry';
      if (entry.type === 'gambit') cls += ' type-gambit';
      if (entry.type === 'trained') cls += ' type-trained';
      html += '<div class="' + cls + '">';
      if (entry.type === 'gambit') {
        html += '<div class="assess-entry-badge assess-badge-gambit">D8 Gambit</div>';
        if (entry.label) html += '<div class="assess-entry-label">' + esc(entry.label) + '</div>';
      } else if (entry.type === 'trained') {
        html += '<div class="assess-entry-badge assess-badge-trained">Trained</div>';
        if (entry.label) html += '<div class="assess-entry-label">' + esc(entry.label) + '</div>';
      } else {
        if (entry.question) html += '<div class="assess-question">"' + esc(entry.question) + '"</div>';
      }
      if (entry.response) html += '<div class="assess-response">' + esc(entry.response) + '</div>';
      html += '</div>';
    });
    return html;
  }

  function _bindAssessEvents(panel) {
    panel.querySelectorAll('.assess-phase-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        assessActivePhase = parseInt(btn.dataset.phase, 10);
        assessActiveDisc = 0;
        _renderAssessPanel();
      });
    });
    panel.querySelectorAll('.assess-disc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        assessActiveDisc = parseInt(btn.dataset.disc, 10);
        var contentEl = panel.querySelector('.assess-content');
        if (contentEl) {
          contentEl.innerHTML = _buildAssessContentHtml();
          contentEl.scrollTop = 0;
        }
        panel.querySelectorAll('.assess-disc-btn').forEach(function (b) {
          b.classList.toggle('active', parseInt(b.dataset.disc, 10) === assessActiveDisc);
        });
      });
    });
  }

  var _tutorialActive = false;

  function _startPlayerTutorial() {
    if (!socket) return;
    socket.emit('tutorial:start', { file: 'scene1-assess.json' });
  }

  function _advancePlayerTutorial() {
    if (!socket) return;
    socket.emit('tutorial:advance');
  }

  function _endPlayerTutorial() {
    if (!socket) return;
    socket.emit('tutorial:end');
  }

  function _updateTutorialControls(data) {
    var startBtn = document.getElementById('tutorial-start-btn');
    var advBtn = document.getElementById('tutorial-advance-btn');
    var endBtn = document.getElementById('tutorial-end-btn');
    var status = document.getElementById('tutorial-status');

    if (data.ended) {
      _tutorialActive = false;
      if (startBtn) startBtn.classList.remove('hidden');
      if (advBtn) advBtn.classList.add('hidden');
      if (endBtn) endBtn.classList.add('hidden');
      if (status) { status.classList.add('hidden'); status.textContent = ''; }
      return;
    }

    _tutorialActive = true;
    if (startBtn) startBtn.classList.add('hidden');
    if (endBtn) endBtn.classList.remove('hidden');

    var isLastPhase = data.currentPhase >= data.totalPhases - 1;
    if (advBtn) {
      if (isLastPhase) advBtn.classList.add('hidden');
      else advBtn.classList.remove('hidden');
    }

    if (status) {
      status.classList.remove('hidden');
      status.textContent = 'Phase ' + (data.currentPhase + 1) + '/' + data.totalPhases + ': ' + (data.phaseLabel || '');
    }
  }


  var _panelCollapseState = { left: false, right: false };
  var COLLAPSE_STORAGE_KEY = 'cb_panel_collapse';

  function _loadCollapseState() {
    try {
      var saved = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || '{}');
      _panelCollapseState.left = !!saved.left;
      _panelCollapseState.right = !!saved.right;
    } catch (e) { /* ignore */ }
  }

  function _saveCollapseState() {
    try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(_panelCollapseState)); } catch (e) { /* ignore */ }
  }

  function collapsePanel(side) {
    var grid = document.getElementById('bridge-grid');
    var col = document.getElementById('cb-col-' + side);
    var handle = document.getElementById(side === 'left' ? 'drag-left' : 'drag-right');
    var tab = document.getElementById('cb-tab-' + side);
    if (!grid || !col) return;

    grid.style.gridTemplateColumns = '';
    col.classList.add('cb-collapsed');
    grid.classList.add('cb-' + side + '-collapsed');
    if (handle) handle.classList.add('cb-handle-hidden');
    if (tab) tab.classList.add('cb-tab-visible');

    _panelCollapseState[side] = true;
    _saveCollapseState();
  }

  function expandPanel(side) {
    var grid = document.getElementById('bridge-grid');
    var col = document.getElementById('cb-col-' + side);
    var handle = document.getElementById(side === 'left' ? 'drag-left' : 'drag-right');
    var tab = document.getElementById('cb-tab-' + side);
    if (!grid || !col) return;

    grid.style.gridTemplateColumns = '';
    col.classList.remove('cb-collapsed');
    grid.classList.remove('cb-' + side + '-collapsed');
    if (handle) handle.classList.remove('cb-handle-hidden');
    if (tab) tab.classList.remove('cb-tab-visible');

    _panelCollapseState[side] = false;
    _saveCollapseState();
  }

  function initCollapsiblePanels() {
    _loadCollapseState();

    var collapseLeft = document.getElementById('cb-collapse-left');
    var collapseRight = document.getElementById('cb-collapse-right');
    var tabLeft = document.getElementById('cb-tab-left');
    var tabRight = document.getElementById('cb-tab-right');

    if (collapseLeft) collapseLeft.addEventListener('click', function () { collapsePanel('left'); });
    if (collapseRight) collapseRight.addEventListener('click', function () { collapsePanel('right'); });
    if (tabLeft) tabLeft.addEventListener('click', function () { expandPanel('left'); });
    if (tabRight) tabRight.addEventListener('click', function () { expandPanel('right'); });

    if (_panelCollapseState.left) collapsePanel('left');
    if (_panelCollapseState.right) collapsePanel('right');
  }

  function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _tagCatClass(cat) {
    var safe = /^(npc|location|lore|item|custom)$/.test(cat) ? cat : 'custom';
    return 'journal-tag-chip--' + safe;
  }

  function _fmtDate(ds) {
    if (!ds) return '';
    var d = new Date(ds);
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  var _crewJournalEntries = [];
  var _crewJournalTags = [];
  var _crewAdventures = [];
  var _crewCompletions = {};
  var _crewNav = { level: 'acts', actNum: null, advId: null, sceneId: null };
  var _crewExpandedEntry = null;

  var _CREW_ACT_NAMES = {
    1: 'The Dawn of Defiance',
    2: 'The Shadow War',
    3: 'The Final Reckoning'
  };

  function _getCrewActAdvs(actNum) {
    return _crewAdventures.filter(function (a) { return a.act === actNum || a.act === 'Act ' + actNum; });
  }

  function _countCrewActScenes(actNum) {
    var advs = _getCrewActAdvs(actNum);
    var total = 0, done = 0;
    advs.forEach(function (adv) {
      (adv.parts || []).forEach(function (p) {
        (p.scenes || []).forEach(function (s) {
          total++;
          if (_crewCompletions[s.id] && _crewCompletions[s.id].completed) done++;
        });
      });
    });
    return { total: total, done: done };
  }

  function _findCrewScene(sceneId) {
    for (var i = 0; i < _crewAdventures.length; i++) {
      var adv = _crewAdventures[i];
      for (var j = 0; j < (adv.parts || []).length; j++) {
        var part = adv.parts[j];
        for (var k = 0; k < (part.scenes || []).length; k++) {
          if (part.scenes[k].id === sceneId) return part.scenes[k];
        }
      }
    }
    return null;
  }

  function _renderCrewBreadcrumbs() {
    var parts = [];
    parts.push('<span class="jnav-crumb" data-cj-nav-to="acts">Crew Journal</span>');
    if (_crewNav.level === 'tag-search' && _crewNav.searchTag) {
      parts.push('<span class="jnav-sep">\u203A</span>');
      parts.push('<span class="jnav-crumb is-current">Tag: ' + _escHtml(_crewNav.searchTag) + '</span>');
    } else {
      if (_crewNav.level !== 'acts' && _crewNav.actNum) {
        parts.push('<span class="jnav-sep">\u203A</span>');
        parts.push('<span class="jnav-crumb" data-cj-nav-to="episodes">Act ' + _crewNav.actNum + '</span>');
      }
      if ((_crewNav.level === 'scenes' || _crewNav.level === 'scene-detail') && _crewNav.advId) {
        var adv = _crewAdventures.find(function (a) { return a.id === _crewNav.advId; });
        if (adv) {
          parts.push('<span class="jnav-sep">\u203A</span>');
          parts.push('<span class="jnav-crumb" data-cj-nav-to="scenes">' + _escHtml(adv.title) + '</span>');
        }
      }
      if (_crewNav.level === 'scene-detail' && _crewNav.sceneId) {
        var scene = _findCrewScene(_crewNav.sceneId);
        if (scene) {
          parts.push('<span class="jnav-sep">\u203A</span>');
          parts.push('<span class="jnav-crumb is-current">' + _escHtml(scene.title) + '</span>');
        }
      }
    }
    return '<div class="jnav-breadcrumbs">' + parts.join('') + '</div>';
  }

  function loadCrewJournal() {
    Promise.all([
      fetch('/api/campaign/adventures').then(function (r) { return r.json(); }),
      fetch('/api/campaign/progress').then(function (r) { return r.json(); }),
      fetch('/api/journal/entries').then(function (r) { return r.json(); }),
      fetch('/api/journal/tags').then(function (r) { return r.json(); })
    ]).then(function (results) {
      _crewAdventures = results[0].adventures || [];
      _crewCompletions = results[1].completions || {};
      _crewJournalEntries = results[2].entries || [];
      _crewJournalTags = results[3].tags || [];
      renderCrewJournal();
    }).catch(function (err) {
      console.error('[CrewJournal] Load failed:', err);
    });
  }

  function _loadCrewSceneEntries() {
    if (_crewNav.level === 'scene-detail' && _crewNav.sceneId) {
      fetch('/api/journal/entries?scene_id=' + encodeURIComponent(_crewNav.sceneId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _crewJournalEntries = data.entries || [];
          renderCrewJournal();
        }).catch(function () { renderCrewJournal(); });
    } else if (_crewNav.level === 'scenes') {
      fetch('/api/journal/entries')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _crewJournalEntries = data.entries || [];
          renderCrewJournal();
        }).catch(function () { renderCrewJournal(); });
    } else {
      renderCrewJournal();
    }
  }

  function renderCrewJournal() {
    var wrap = document.getElementById('cb-crew-journal');
    if (!wrap) return;

    var html = '';
    html += _renderCrewBreadcrumbs();
    html += '<div class="jnav-content">';

    if (_crewNav.level === 'acts') {
      var actNums = [];
      _crewAdventures.forEach(function (a) {
        var n = typeof a.act === 'number' ? a.act : parseInt(String(a.act).replace(/\D/g, ''), 10) || 0;
        if (n && actNums.indexOf(n) === -1) actNums.push(n);
      });
      actNums.sort();
      if (!actNums.length) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No adventures loaded.</div>';
      }
      actNums.forEach(function (actNum) {
        var counts = _countCrewActScenes(actNum);
        var name = _CREW_ACT_NAMES[actNum] || '';
        html += '<div class="jnav-row" data-cj-act="' + actNum + '">';
        html += '<span class="jnav-row-icon">\u25B6</span>';
        html += '<div class="jnav-row-text">';
        html += '<span class="jnav-row-title">Act ' + actNum + (name ? ' \u2014 ' + _escHtml(name) : '') + '</span>';
        html += '<span class="jnav-row-sub">' + counts.done + ' / ' + counts.total + ' scenes completed</span>';
        html += '</div></div>';
      });
    } else if (_crewNav.level === 'episodes') {
      var advs = _getCrewActAdvs(_crewNav.actNum);
      if (!advs.length) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No episodes in this act yet.</div>';
      }
      advs.forEach(function (adv) {
        var total = 0, done = 0;
        (adv.parts || []).forEach(function (p) {
          (p.scenes || []).forEach(function (s) {
            total++;
            if (_crewCompletions[s.id] && _crewCompletions[s.id].completed) done++;
          });
        });
        html += '<div class="jnav-row" data-cj-adv="' + _escHtml(adv.id) + '">';
        html += '<span class="jnav-row-icon">\u25B6</span>';
        html += '<div class="jnav-row-text">';
        html += '<span class="jnav-row-title">Episode ' + adv.number + ': ' + _escHtml(adv.title) + '</span>';
        html += '<span class="jnav-row-sub">' + done + ' / ' + total + ' scenes completed</span>';
        html += '</div></div>';
      });
    } else if (_crewNav.level === 'scenes') {
      var adv = _crewAdventures.find(function (a) { return a.id === _crewNav.advId; });
      if (!adv) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">Adventure not found.</div>';
      } else {
        var advDebriefTag = 'adventure:' + _crewNav.advId;
        var advDebriefs = _crewJournalEntries.filter(function (e) {
          return e.source_scene_id === advDebriefTag && e.author_character_name === 'Mission Debrief';
        });
        if (advDebriefs.length > 0) {
          advDebriefs.forEach(function (debrief) {
            html += '<div class="journal-scene-log journal-mission-debrief" data-cj-scene-log>';
            html += '<div class="journal-scene-log-header journal-mission-debrief-header">';
            html += '<span class="journal-scene-log-chevron">\u25B6</span>';
            html += '<span class="journal-mission-debrief-label">Mission Chronicle</span>';
            html += '<span class="journal-scene-log-date">' + _fmtDate(debrief.created_at) + '</span>';
            html += '</div>';
            html += '<div class="journal-scene-log-body">';
            html += '<pre class="journal-mission-debrief-content">' + _escHtml(debrief.body || '') + '</pre>';
            html += '</div></div>';
          });
        }
        (adv.parts || []).forEach(function (part) {
          html += '<div class="jnav-part-label">Part ' + part.number + ': ' + _escHtml(part.title) + '</div>';
          (part.scenes || []).forEach(function (scene) {
            var comp = _crewCompletions[scene.id];
            var isDone = comp && comp.completed;
            var entryCount = 0;
            _crewJournalEntries.forEach(function (e) { if (e.source_scene_id === scene.id) entryCount++; });
            html += '<div class="jnav-row' + (isDone ? '' : ' is-locked') + '"' + (isDone ? ' data-cj-scene="' + _escHtml(scene.id) + '"' : '') + '>';
            html += '<span class="jnav-row-icon">' + (isDone ? '\u25B6' : '\u25CB') + '</span>';
            html += '<div class="jnav-row-text">';
            html += '<span class="jnav-row-title' + (isDone ? '' : ' is-dim') + '">Scene ' + scene.number + ': ' + _escHtml(scene.title) + '</span>';
            if (isDone && entryCount > 0) {
              html += '<span class="jnav-row-sub">' + entryCount + ' journal ' + (entryCount === 1 ? 'entry' : 'entries') + '</span>';
            } else if (!isDone) {
              html += '<span class="jnav-row-sub is-dim">Not yet completed</span>';
            }
            html += '</div></div>';
          });
        });
      }
    } else if (_crewNav.level === 'scene-detail') {
      var campaignLog = null;
      var playerEntries = [];
      _crewJournalEntries.forEach(function (e) {
        if (e.source_scene_id !== _crewNav.sceneId) return;
        if (e.author_character_name === 'Campaign Log') {
          campaignLog = e;
        } else if (e.author_character_name !== 'Mission Debrief') {
          playerEntries.push(e);
        }
      });

      if (campaignLog) {
        html += '<div class="journal-scene-log" data-cj-scene-log>';
        html += '<div class="journal-scene-log-header">';
        html += '<span class="journal-scene-log-chevron">\u25B6</span>';
        html += '<span class="journal-scene-log-title">Scene Summary</span>';
        html += '<span class="journal-scene-log-date">' + _fmtDate(campaignLog.created_at) + '</span>';
        html += '</div>';
        html += '<div class="journal-scene-log-body">';
        html += '<pre class="journal-scene-log-content">' + _escHtml(campaignLog.body || '') + '</pre>';
        html += '</div></div>';
      }

      if (playerEntries.length === 0) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No crew notes for this scene yet.</div>';
      } else if (playerEntries.length > 0) {
        playerEntries.forEach(function (entry) {
          var isExpanded = _crewExpandedEntry === entry.id;
          html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '" style="cursor:pointer;">';
          html += '<div class="journal-entry-card-header" data-cj-toggle="' + entry.id + '">';
          html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
          html += '<span class="journal-entry-title">' + _escHtml(entry.title) + '</span>';
          html += '<span class="journal-entry-date">' + _fmtDate(entry.created_at) + '</span>';
          html += '</div>';
          if (isExpanded) {
            html += '<div class="journal-entry-expanded">';
            html += '<div class="journal-entry-meta">';
            html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
            var tags = entry.tags || [];
            if (tags.length) {
              html += '<span class="journal-entry-tags">';
              tags.forEach(function (t) {
                html += '<span class="journal-tag-chip ' + _tagCatClass(t.category) + '" data-cj-tag-search="' + _escHtml(t.name) + '">' + _escHtml(t.name) + '</span>';
              });
              html += '</span>';
            }
            html += '</div>';
            html += '<div class="journal-entry-body">' + _escHtml(entry.body || '').replace(/\n/g, '<br>') + '</div>';
            html += '</div>';
          } else {
            html += '<div class="journal-entry-meta-inline">';
            html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
            html += '</div>';
          }
          html += '</div>';
        });
      }
    } else if (_crewNav.level === 'tag-search') {
      var tagName = _crewNav.searchTag;
      var tagMatches = _crewJournalEntries.filter(function (e) {
        return (e.tags || []).some(function (t) { return t.name === tagName; });
      });
      if (!tagMatches.length) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No entries tagged "' + _escHtml(tagName) + '"</div>';
      } else {
        tagMatches.forEach(function (entry) {
          var isCampaignLog = entry.author_character_name === 'Campaign Log';
          var isMissionDebrief = entry.author_character_name === 'Mission Debrief';
          var isExpanded = _crewExpandedEntry === entry.id;
          var sceneName = '';
          var scene = entry.source_scene_id ? _findCrewScene(entry.source_scene_id) : null;
          if (scene) sceneName = scene.title;
          if (isMissionDebrief) {
            html += '<div class="journal-scene-log journal-mission-debrief" data-cj-scene-log>';
            html += '<div class="journal-scene-log-header journal-mission-debrief-header">';
            html += '<span class="journal-scene-log-chevron">\u25B6</span>';
            html += '<span class="journal-mission-debrief-label">' + _escHtml(entry.title) + '</span>';
            html += '<span class="journal-scene-log-date">' + _fmtDate(entry.created_at) + '</span>';
            html += '</div>';
            html += '<div class="journal-scene-log-body">';
            html += '<pre class="journal-mission-debrief-content">' + _escHtml(entry.body || '') + '</pre>';
            html += '</div></div>';
          } else if (isCampaignLog) {
            html += '<div class="journal-scene-log" data-cj-scene-log>';
            html += '<div class="journal-scene-log-header">';
            html += '<span class="journal-scene-log-chevron">\u25B6</span>';
            html += '<span class="journal-scene-log-title">' + _escHtml(entry.title) + '</span>';
            html += '<span class="journal-scene-log-date">' + _fmtDate(entry.created_at) + '</span>';
            html += '</div>';
            html += '<div class="journal-scene-log-body">';
            html += '<pre class="journal-scene-log-content">' + _escHtml(entry.body || '') + '</pre>';
            html += '</div></div>';
          } else {
            html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '" style="cursor:pointer;">';
            html += '<div class="journal-entry-card-header" data-cj-toggle="' + entry.id + '">';
            html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
            html += '<span class="journal-entry-title">' + _escHtml(entry.title) + '</span>';
            html += '<span class="journal-entry-date">' + _fmtDate(entry.created_at) + '</span>';
            html += '</div>';
            if (isExpanded) {
              html += '<div class="journal-entry-expanded">';
              html += '<div class="journal-entry-meta">';
              html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
              if (sceneName) {
                html += '<span class="journal-entry-scene-ref">' + _escHtml(sceneName) + '</span>';
              }
              var eTags = entry.tags || [];
              if (eTags.length) {
                html += '<span class="journal-entry-tags">';
                eTags.forEach(function (t) {
                  html += '<span class="journal-tag-chip ' + _tagCatClass(t.category) + '" data-cj-tag-search="' + _escHtml(t.name) + '">' + _escHtml(t.name) + '</span>';
                });
                html += '</span>';
              }
              html += '</div>';
              html += '<div class="journal-entry-body">' + _escHtml(entry.body || '').replace(/\n/g, '<br>') + '</div>';
              html += '</div>';
            } else {
              html += '<div class="journal-entry-meta-inline">';
              html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
              if (sceneName) {
                html += '<span class="journal-entry-scene-ref">' + _escHtml(sceneName) + '</span>';
              }
              html += '</div>';
            }
            html += '</div>';
          }
        });
      }
    }

    html += '</div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-cj-nav-to]').forEach(function (el) {
      el.addEventListener('click', function () {
        var target = el.getAttribute('data-cj-nav-to');
        if (target === 'acts') {
          _crewNav = { level: 'acts', actNum: null, advId: null, sceneId: null, searchTag: null };
        } else if (target === 'episodes') {
          _crewNav.level = 'episodes';
          _crewNav.advId = null;
          _crewNav.sceneId = null;
          _crewNav.searchTag = null;
        } else if (target === 'scenes') {
          _crewNav.level = 'scenes';
          _crewNav.sceneId = null;
          _crewNav.searchTag = null;
        }
        _crewExpandedEntry = null;
        renderCrewJournal();
      });
    });

    wrap.querySelectorAll('[data-cj-tag-search]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        var tn = chip.getAttribute('data-cj-tag-search');
        _crewNav = { level: 'tag-search', actNum: null, advId: null, sceneId: null, searchTag: tn };
        _crewExpandedEntry = null;
        fetch('/api/journal/entries?tag=' + encodeURIComponent(tn))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            _crewJournalEntries = data.entries || [];
            renderCrewJournal();
          }).catch(function () { renderCrewJournal(); });
      });
    });

    wrap.querySelectorAll('[data-cj-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        _crewNav = { level: 'episodes', actNum: parseInt(el.getAttribute('data-cj-act'), 10), advId: null, sceneId: null };
        _crewExpandedEntry = null;
        renderCrewJournal();
      });
    });

    wrap.querySelectorAll('[data-cj-adv]').forEach(function (el) {
      el.addEventListener('click', function () {
        _crewNav.level = 'scenes';
        _crewNav.advId = el.getAttribute('data-cj-adv');
        _crewNav.sceneId = null;
        _crewExpandedEntry = null;
        _loadCrewSceneEntries();
      });
    });

    wrap.querySelectorAll('[data-cj-scene]').forEach(function (el) {
      el.addEventListener('click', function () {
        _crewNav.level = 'scene-detail';
        _crewNav.sceneId = el.getAttribute('data-cj-scene');
        _crewExpandedEntry = null;
        _loadCrewSceneEntries();
      });
    });

    wrap.querySelectorAll('[data-cj-scene-log]').forEach(function (log) {
      var header = log.querySelector('.journal-scene-log-header');
      if (header) {
        header.addEventListener('click', function () {
          log.classList.toggle('is-expanded');
        });
      }
    });

    wrap.querySelectorAll('[data-cj-toggle]').forEach(function (header) {
      header.addEventListener('click', function () {
        var id = parseInt(header.getAttribute('data-cj-toggle'), 10);
        _crewExpandedEntry = (_crewExpandedEntry === id) ? null : id;
        renderCrewJournal();
      });
    });
  }

  function _getCrewTagCat(name) {
    for (var i = 0; i < _crewJournalTags.length; i++) {
      if (_crewJournalTags[i].name === name) return _crewJournalTags[i].category;
    }
    return 'custom';
  }

  var _decisionCache = [];
  var _pollVotes = {};
  var _impactTags = [
    { value: 'maya-fate', label: 'Maya\u2019s Fate', color: '#c084fc' },
    { value: 'denia-fate', label: 'Denia\u2019s Fate', color: '#60a5fa' },
    { value: 'varth-relationship', label: 'Varth Relationship', color: '#f97316' },
    { value: 'malpaz-uprising', label: 'Malpaz Uprising', color: '#ef4444' },
    { value: 'soren-alliance', label: 'Soren Alliance', color: '#34d399' },
    { value: 'kessra-grudge', label: 'Kessra Grudge', color: '#fbbf24' }
  ];

  function _impactColor(tag) {
    for (var i = 0; i < _impactTags.length; i++) {
      if (_impactTags[i].value === tag) return _impactTags[i].color;
    }
    return '#9ca3af';
  }

  function loadDecisions() {
    fetch('/api/campaign/decisions')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _decisionCache = data.decisions || [];
        renderDecisionTimeline();
      })
      .catch(function (err) { console.error('Failed to load decisions:', err); });
  }

  function renderDecisionTimeline() {
    var container = document.getElementById('cb-decision-timeline');
    if (!container) return;
    if (_decisionCache.length === 0) {
      container.innerHTML = '<div class="cb-decision-empty">No decisions logged yet.</div>';
      return;
    }
    var groups = {};
    _decisionCache.forEach(function (d) {
      var key = d.adventure_id || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    var html = '';
    Object.keys(groups).forEach(function (advId) {
      var adv = getAdventure(advId);
      var advTitle = adv ? adv.title : advId;
      html += '<div class="cb-decision-group">';
      html += '<div class="cb-decision-group-header">' + esc(advTitle) + '</div>';
      groups[advId].forEach(function (d) {
        html += '<div class="cb-decision-entry" data-decision-id="' + d.id + '">';
        html += '<div class="cb-decision-choice">' + esc(d.choice) + '</div>';
        if (d.outcome) html += '<div class="cb-decision-outcome">' + esc(d.outcome) + '</div>';
        html += '<div class="cb-decision-meta">';
        if (d.campaign_impact) {
          html += '<span class="cb-decision-impact" style="border-color:' + _impactColor(d.campaign_impact) + ';color:' + _impactColor(d.campaign_impact) + '">' + esc(d.campaign_impact) + '</span>';
        }
        if (d.voted) html += '<span class="cb-decision-voted">&#9745; voted</span>';
        if (d.scene_id) html += '<span class="cb-decision-scene-ref">' + esc(d.scene_id) + '</span>';
        html += '<button class="cb-decision-delete" data-del-id="' + d.id + '" title="Delete">&times;</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.cb-decision-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.delId;
        if (!confirm('Delete this decision?')) return;
        fetch('/api/campaign/decisions/' + id, { method: 'DELETE' })
          .then(function () { loadDecisions(); })
          .catch(function (err) { console.error('Failed to delete decision:', err); });
      });
    });
  }

  function promptDecisionOnComplete(sceneId) {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, sceneId) : null;
    if (!scene || !scene.decisions || scene.decisions.length === 0) return;
    var alreadyLogged = _decisionCache.some(function (d) {
      return d.scene_id === sceneId && d.adventure_id === currentAdventure;
    });
    if (alreadyLogged) return;
    if (confirm('Scene "' + (scene.title || sceneId) + '" has ' + scene.decisions.length + ' decision point(s). Log decisions now?')) {
      openDecisionModal();
    }
  }

  function openDecisionModal(presetChoices) {
    var existing = document.getElementById('cb-decision-modal-overlay');
    if (existing) existing.remove();

    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    var sceneDecisions = (scene && scene.decisions) ? scene.decisions : [];
    var _selectedDecIdx = -1;

    var overlay = document.createElement('div');
    overlay.id = 'cb-decision-modal-overlay';
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="cb-decision-modal">';
    html += '<div class="cb-decision-modal-header"><span>Log Decision</span><button class="cb-decision-modal-close" id="cb-decision-modal-close">&times;</button></div>';
    html += '<div class="cb-decision-modal-body">';

    if (sceneDecisions.length > 0) {
      html += '<label>Scene Decision Points</label>';
      html += '<div class="cb-decision-scene-chips">';
      sceneDecisions.forEach(function (d, i) {
        html += '<div class="cb-decision-scene-chip" data-scene-dec-idx="' + i + '">' + esc(d.choice) + '</div>';
      });
      html += '</div>';
    }

    html += '<label>Choice</label>';
    html += '<input type="text" id="dec-choice" placeholder="What did the crew decide?" />';
    html += '<label>Outcome</label>';
    html += '<textarea id="dec-outcome" rows="2" placeholder="What happened as a result?"></textarea>';
    html += '<label>Campaign Impact</label>';
    html += '<select id="dec-impact">';
    html += '<option value="">None</option>';
    _impactTags.forEach(function (t) {
      html += '<option value="' + t.value + '">' + esc(t.label) + '</option>';
    });
    html += '</select>';

    html += '<button class="cb-decision-poll-btn" id="dec-poll-btn">&#9745; Send to Crew for Vote</button>';
    html += '<div id="dec-vote-tally"></div>';

    html += '<div class="cb-decision-modal-actions">';
    html += '<button id="dec-cancel">Cancel</button>';
    html += '<button id="dec-save" class="primary">Save Decision</button>';
    html += '</div>';

    html += '</div></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    var choiceInput = document.getElementById('dec-choice');
    var outcomeInput = document.getElementById('dec-outcome');
    var impactSelect = document.getElementById('dec-impact');

    overlay.querySelectorAll('.cb-decision-scene-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        overlay.querySelectorAll('.cb-decision-scene-chip').forEach(function (c) { c.classList.remove('selected'); });
        chip.classList.add('selected');
        var idx = parseInt(chip.dataset.sceneDecIdx, 10);
        _selectedDecIdx = idx;
        var sd = sceneDecisions[idx];
        if (sd) {
          choiceInput.value = sd.choice;
          outcomeInput.value = sd.consequence || '';
        }
      });
    });

    if (presetChoices && presetChoices.length > 0) {
      choiceInput.value = presetChoices[0];
    }

    document.getElementById('cb-decision-modal-close').addEventListener('click', function () { closeDecisionModal(); });
    document.getElementById('dec-cancel').addEventListener('click', function () { closeDecisionModal(); });

    document.getElementById('dec-poll-btn').addEventListener('click', function () {
      var choices = [];
      if (sceneDecisions.length > 0) {
        sceneDecisions.forEach(function (d) { choices.push(d.choice); });
      }
      if (choiceInput.value.trim() && choices.indexOf(choiceInput.value.trim()) === -1) {
        choices.push(choiceInput.value.trim());
      }
      if (choices.length === 0) return;
      _pollVotes = {};
      if (socket) {
        socket.emit('decision:poll', {
          sceneId: currentScene,
          adventureId: currentAdventure,
          decisionKey: currentScene ? (currentScene + ':' + (_selectedDecIdx >= 0 ? _selectedDecIdx : 'custom')) : 'custom',
          choices: choices
        });
      }
      var tallyEl = document.getElementById('dec-vote-tally');
      if (tallyEl) tallyEl.innerHTML = '<div class="cb-decision-vote-tally">Poll sent to crew. Waiting for votes\u2026</div>';
    });

    document.getElementById('dec-save').addEventListener('click', function () {
      var choice = choiceInput.value.trim();
      if (!choice) return;
      var impactVal = impactSelect.value || null;
      if (socket) {
        socket.emit('decision:resolve', {
          choice: choice,
          outcome: outcomeInput.value.trim() || null,
          campaign_impact: impactVal,
          adventure_id: currentAdventure,
          scene_id: currentScene,
          decision_key: currentScene ? (currentScene + ':' + (_selectedDecIdx >= 0 ? _selectedDecIdx : 'custom')) : 'custom'
        });
      } else {
        fetch('/api/campaign/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene_id: currentScene,
            adventure_id: currentAdventure,
            decision_key: currentScene ? (currentScene + ':' + (_selectedDecIdx >= 0 ? _selectedDecIdx : 'custom')) : 'custom',
            choice: choice,
            outcome: outcomeInput.value.trim() || null,
            campaign_impact: impactVal
          })
        }).then(function () { loadDecisions(); });
      }
      closeDecisionModal();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeDecisionModal();
    });
  }

  function closeDecisionModal() {
    var overlay = document.getElementById('cb-decision-modal-overlay');
    if (overlay) overlay.remove();
  }

  var _missionSummaryGenerating = false;

  var _msSelectedPartIds = [];

  function openMissionSummaryModal() {
    if (_missionSummaryGenerating) return;
    if (!currentAdventure) return;

    var existing = document.getElementById('cb-mission-summary-overlay');
    if (existing) existing.remove();

    var adv = getAdventure(currentAdventure);
    var advTitle = adv ? adv.title : currentAdventure;
    var parts = adv ? (adv.parts || []) : [];

    _msSelectedPartIds = [];

    var overlay = document.createElement('div');
    overlay.id = 'cb-mission-summary-overlay';
    overlay.className = 'cb-mission-summary-overlay';
    overlay.innerHTML =
      '<div class="cb-mission-summary-modal">' +
        '<div class="cb-mission-summary-header">' +
          '<span class="cb-mission-summary-title">MISSION CHRONICLE</span>' +
          '<span class="cb-mission-summary-subtitle">' + esc(advTitle) + '</span>' +
          '<button class="cb-mission-summary-close" id="ms-close">&times;</button>' +
        '</div>' +
        '<div class="cb-mission-summary-body" id="ms-body">' +
          '<div class="ms-scope-selector" id="ms-scope">' +
            '<div class="ms-scope-heading">Select scope for debrief</div>' +
            '<div class="ms-scope-hint">Parts with existing debriefs are excluded by default.</div>' +
            '<div class="ms-scope-parts" id="ms-scope-parts"></div>' +
          '</div>' +
          '<div class="cb-mission-summary-loading" id="ms-loading" style="display:none;">' +
            '<div class="cb-mission-summary-spinner"></div>' +
            '<span>Generating mission debrief\u2026</span>' +
          '</div>' +
        '</div>' +
        '<div class="cb-mission-summary-footer" id="ms-footer">' +
          '<button class="cb-header-btn accent" id="ms-generate-btn">Generate Debrief</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('ms-close').addEventListener('click', closeMissionSummaryModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeMissionSummaryModal();
    });

    fetch('/api/journal/entries')
      .then(function (r) { return r.json(); })
      .then(function (journal) {
        var entries = journal.entries || journal || [];
        var debriefedParts = {};
        entries.forEach(function (e) {
          if (e.author_character_name !== 'Mission Debrief') return;
          var sid = e.source_scene_id || '';
          if (sid.indexOf('parts:') === 0) {
            sid.replace('parts:', '').split(',').forEach(function (pid) {
              debriefedParts[pid.trim()] = true;
            });
          } else if (sid === 'adventure:' + currentAdventure) {
            parts.forEach(function (p) { debriefedParts[p.id] = true; });
          }
        });
        renderScopeSelector(parts, debriefedParts);
      })
      .catch(function () {
        renderScopeSelector(parts, {});
      });
  }

  function renderScopeSelector(parts, debriefedParts) {
    var container = document.getElementById('ms-scope-parts');
    if (!container) return;
    container.innerHTML = '';

    parts.forEach(function (part) {
      var scenes = part.scenes || [];
      var isDebriefed = !!debriefedParts[part.id];
      var partEl = document.createElement('label');
      partEl.className = 'ms-scope-part' + (isDebriefed ? ' ms-debriefed' : '');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = part.id;
      cb.checked = !isDebriefed;
      cb.className = 'ms-scope-cb';
      partEl.appendChild(cb);

      var info = document.createElement('div');
      info.className = 'ms-scope-part-info';
      var title = document.createElement('span');
      title.className = 'ms-scope-part-title';
      title.textContent = 'Part ' + part.number + ': ' + (part.title || part.id);
      info.appendChild(title);

      if (isDebriefed) {
        var badge = document.createElement('span');
        badge.className = 'ms-scope-badge';
        badge.textContent = 'DEBRIEFED';
        info.appendChild(badge);
      }

      var sceneList = document.createElement('div');
      sceneList.className = 'ms-scope-scenes';
      scenes.forEach(function (s) {
        var sEl = document.createElement('span');
        sEl.className = 'ms-scope-scene';
        sEl.textContent = 'S' + s.number + ': ' + s.title;
        sceneList.appendChild(sEl);
      });
      info.appendChild(sceneList);

      partEl.appendChild(info);
      container.appendChild(partEl);
    });

    var genBtn = document.getElementById('ms-generate-btn');
    if (genBtn) {
      genBtn.onclick = function () {
        var cbs = container.querySelectorAll('.ms-scope-cb:checked');
        _msSelectedPartIds = [];
        for (var i = 0; i < cbs.length; i++) _msSelectedPartIds.push(cbs[i].value);
        if (_msSelectedPartIds.length === 0) {
          showToast('Select at least one part to debrief');
          return;
        }
        generateMissionSummary();
      };
    }
  }

  function generateMissionSummary() {
    _missionSummaryGenerating = true;
    var bodyEl = document.getElementById('ms-body');
    var footerEl = document.getElementById('ms-footer');
    var loadingEl = document.getElementById('ms-loading');
    var scopeEl = document.getElementById('ms-scope');

    if (scopeEl) scopeEl.style.display = 'none';
    if (loadingEl) {
      loadingEl.innerHTML = '<div class="cb-mission-summary-spinner"></div><span>Generating mission debrief\u2026</span>';
      loadingEl.style.display = 'flex';
    }
    if (footerEl) footerEl.style.display = 'none';

    var existingTextarea = bodyEl ? bodyEl.querySelector('textarea') : null;
    if (existingTextarea) existingTextarea.remove();

    fetch('/api/campaign/adventures/' + encodeURIComponent(currentAdventure) + '/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partIds: _msSelectedPartIds })
    })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Generation failed'); });
      return r.json();
    })
    .then(function (data) {
      _missionSummaryGenerating = false;
      if (!document.getElementById('cb-mission-summary-overlay')) return;
      if (loadingEl) loadingEl.style.display = 'none';

      var textarea = document.createElement('textarea');
      textarea.className = 'cb-mission-summary-textarea';
      textarea.id = 'ms-textarea';
      textarea.value = data.summary || '';
      bodyEl.appendChild(textarea);

      if (footerEl) {
        footerEl.innerHTML =
          '<button class="cb-header-btn" id="ms-regenerate">Regenerate</button>' +
          '<button class="cb-header-btn accent" id="ms-save">Save to Journal</button>';
        footerEl.style.display = 'flex';
        document.getElementById('ms-regenerate').addEventListener('click', function () {
          generateMissionSummary();
        });
        document.getElementById('ms-save').addEventListener('click', function () {
          saveMissionDebrief();
        });
      }
    })
    .catch(function (err) {
      _missionSummaryGenerating = false;
      if (!document.getElementById('cb-mission-summary-overlay')) return;
      if (loadingEl) {
        loadingEl.innerHTML = '<span style="color:#ef4444;">' + esc(err.message || 'Generation failed') + '</span>';
        loadingEl.style.display = 'flex';
      }
      if (footerEl) {
        footerEl.innerHTML =
          '<button class="cb-header-btn" id="ms-regenerate">Retry</button>';
        footerEl.style.display = 'flex';
        document.getElementById('ms-regenerate').addEventListener('click', function () {
          generateMissionSummary();
        });
      }
    });
  }

  function saveMissionDebrief() {
    var textarea = document.getElementById('ms-textarea');
    if (!textarea || !textarea.value.trim()) return;

    var adv = getAdventure(currentAdventure);
    var advTitle = adv ? adv.title : currentAdventure;
    var partLabels = [];
    if (_msSelectedPartIds.length && adv) {
      _msSelectedPartIds.forEach(function (pid) {
        var p = getPart(adv, pid);
        if (p) partLabels.push('Part ' + p.number);
      });
    }
    var title = 'Mission Debrief: ' + advTitle + (partLabels.length ? ' \u2014 ' + partLabels.join(', ') : '');
    var sourceId = _msSelectedPartIds.length ? 'parts:' + _msSelectedPartIds.join(',') : 'adventure:' + currentAdventure;

    fetch('/api/journal/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        body: textarea.value.trim(),
        author_character_name: 'Mission Debrief',
        source_scene_id: sourceId
      })
    })
    .then(function (r) {
      if (!r.ok) throw new Error('Failed to save');
      return r.json();
    })
    .then(function () {
      closeMissionSummaryModal();
      loadCrewJournal();
      showToast('Mission debrief saved to Crew Journal');
    })
    .catch(function (err) {
      showToast('Failed to save debrief: ' + (err.message || 'Unknown error'));
    });
  }

  function closeMissionSummaryModal() {
    _missionSummaryGenerating = false;
    var overlay = document.getElementById('cb-mission-summary-overlay');
    if (overlay) overlay.remove();
  }

  function showToast(msg) {
    var toast = document.getElementById('npc-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3000);
  }

  function initDecisionTracker() {
    var logBtn = document.getElementById('cb-log-decision-btn');
    if (logBtn) {
      logBtn.addEventListener('click', function () { openDecisionModal(); });
    }
    loadDecisions();

    if (socket) {
      socket.on('decision:vote-received', function (data) {
        _pollVotes[data.characterId] = data;
        var tallyEl = document.getElementById('dec-vote-tally');
        if (tallyEl) {
          var lines = Object.values(_pollVotes).map(function (v) {
            return '<div class="cb-decision-vote-tally">' + esc(v.name) + ' \u2192 ' + esc(v.choiceText) + '</div>';
          });
          tallyEl.innerHTML = lines.join('');
        }
      });

      socket.on('decision:resolved', function () {
        loadDecisions();
      });
    }
  }

  var _challengeCache = [];
  var _activeInstances = [];

  function loadChallengeStatus() {
    var url = '/api/narrative-challenges/instances/active';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _activeInstances = data.instances || [];
        renderChallengeStatus();
      })
      .catch(function () { renderChallengeStatus(); });
  }

  function renderChallengeStatus() {
    var el = document.getElementById('cb-challenge-status');
    if (!el) return;
    if (_activeInstances.length === 0) {
      el.innerHTML = '<div class="cb-decision-empty">No active challenges.</div>';
      return;
    }
    var html = '';
    _activeInstances.forEach(function (inst) {
      var statusClass = inst.status === 'scored' ? 'nc-status--scored' : 'nc-status--active';
      html += '<div class="nc-instance-row ' + statusClass + '" data-inst-id="' + inst.id + '">';
      html += '<span class="nc-instance-char">' + esc(inst.character_name || 'Unknown') + '</span>';
      html += '<span class="nc-instance-challenge">' + esc(inst.challenge_id) + '</span>';
      html += '<span class="nc-instance-badge">' + esc(inst.status) + '</span>';
      html += '</div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.nc-instance-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var instId = parseInt(row.dataset.instId, 10);
        var inst = _activeInstances.find(function (i) { return i.id === instId; });
        if (inst) openChallengeRunner(inst);
      });
    });
  }

  function openChallengeLauncher() {
    var existing = document.getElementById('nc-launcher-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nc-launcher-overlay';
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="nc-launcher-modal">';
    html += '<div class="nc-launcher-header"><span>Launch Narrative Challenge</span><button class="nc-launcher-close" id="nc-launcher-close">&times;</button></div>';
    html += '<div class="nc-launcher-body">';
    html += '<div class="nc-launcher-loading">Loading challenges&hellip;</div>';
    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('nc-launcher-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    Promise.all([
      fetch('/api/narrative-challenges').then(function (r) { return r.json(); }),
      fetch('/api/characters').then(function (r) { return r.json(); })
    ]).then(function (results) {
      _challengeCache = results[0].challenges || [];
      var rawChars = results[1].characters || results[1] || [];
      var characters = rawChars.map(function (ch) {
        return { id: ch.id, name: ch.name, personalDestiny: ch.personalDestiny || null };
      });
      renderLauncherContent(overlay, characters);
    }).catch(function () {
      overlay.querySelector('.nc-launcher-loading').textContent = 'Failed to load data.';
    });
  }

  function renderLauncherContent(overlay, characters) {
    var body = overlay.querySelector('.nc-launcher-body');
    var html = '';

    html += '<label class="nc-label">Select Challenge</label>';
    html += '<div class="nc-challenge-grid">';
    _challengeCache.forEach(function (c) {
      html += '<div class="nc-challenge-card" data-challenge-id="' + esc(c.id) + '">';
      html += '<div class="nc-challenge-card-name">' + esc(c.name) + '</div>';
      html += '<div class="nc-challenge-card-destiny">' + esc(c.destiny) + '</div>';
      html += '<div class="nc-challenge-card-desc">' + esc((c.description || '').substring(0, 80)) + '</div>';
      html += '<div class="nc-challenge-card-meta">' + (c.roundCount || 0) + ' rounds</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<label class="nc-label" style="margin-top:0.75rem;">Assign Characters</label>';
    html += '<button class="cb-header-btn nc-auto-assign-btn" id="nc-auto-assign" style="font-size:0.55rem;padding:0.2rem 0.4rem;min-height:auto;margin-bottom:0.4rem;" disabled>Auto-Assign by Destiny</button>';
    html += '<div class="nc-char-list">';
    characters.forEach(function (ch) {
      var destinyLabel = ch.personalDestiny && ch.personalDestiny.id ? ' (' + ch.personalDestiny.id + ')' : '';
      html += '<label class="nc-char-check"><input type="checkbox" value="' + ch.id + '" data-char-name="' + esc(ch.name) + '" data-char-destiny="' + esc(ch.personalDestiny && ch.personalDestiny.id ? ch.personalDestiny.id : '') + '"> ' + esc(ch.name) + esc(destinyLabel) + '</label>';
    });
    html += '</div>';

    html += '<div style="margin-top:1rem;display:flex;gap:0.5rem;">';
    html += '<button class="cb-header-btn accent" id="nc-launch-go" disabled>Launch Challenge</button>';
    html += '<button class="cb-header-btn" id="nc-launch-cancel">Cancel</button>';
    html += '</div>';

    body.innerHTML = html;

    var selectedChallenge = null;
    var autoAssignBtn = document.getElementById('nc-auto-assign');
    body.querySelectorAll('.nc-challenge-card').forEach(function (card) {
      card.addEventListener('click', function () {
        body.querySelectorAll('.nc-challenge-card').forEach(function (c) { c.classList.remove('nc-selected'); });
        card.classList.add('nc-selected');
        selectedChallenge = card.dataset.challengeId;
        if (autoAssignBtn) autoAssignBtn.disabled = false;
        checkReady();
      });
    });
    if (autoAssignBtn) {
      autoAssignBtn.addEventListener('click', function () {
        if (!selectedChallenge) return;
        var challenge = _challengeCache.find(function (c) { return c.id === selectedChallenge; });
        if (!challenge) return;
        var destinyId = challenge.destiny;
        body.querySelectorAll('.nc-char-check input').forEach(function (cb) {
          cb.checked = (cb.dataset.charDestiny === destinyId);
        });
        checkReady();
      });
    }

    function checkReady() {
      var checked = body.querySelectorAll('.nc-char-check input:checked');
      var btn = document.getElementById('nc-launch-go');
      if (btn) btn.disabled = !(selectedChallenge && checked.length > 0);

      body.querySelectorAll('.nc-challenge-card').forEach(function (c) { c.classList.remove('nc-destiny-match'); });
      if (!selectedChallenge && checked.length > 0) {
        var destinyIds = [];
        checked.forEach(function (cb) {
          if (cb.dataset.charDestiny) destinyIds.push(cb.dataset.charDestiny);
        });
        var uniqueDestinies = destinyIds.filter(function (d, i, a) { return a.indexOf(d) === i; });
        uniqueDestinies.forEach(function (did) {
          _challengeCache.forEach(function (c) {
            if (c.destiny === did) {
              var card = body.querySelector('.nc-challenge-card[data-challenge-id="' + c.id + '"]');
              if (card) card.classList.add('nc-destiny-match');
            }
          });
        });
        if (uniqueDestinies.length === 1) {
          var matching = _challengeCache.filter(function (c) { return c.destiny === uniqueDestinies[0]; });
          if (matching.length === 1) {
            var card = body.querySelector('.nc-challenge-card[data-challenge-id="' + matching[0].id + '"]');
            if (card) card.click();
          }
        }
      }
    }
    body.querySelectorAll('.nc-char-check input').forEach(function (cb) {
      cb.addEventListener('change', checkReady);
    });

    document.getElementById('nc-launch-cancel').addEventListener('click', function () { overlay.remove(); });
    document.getElementById('nc-launch-go').addEventListener('click', function () {
      var checked = body.querySelectorAll('.nc-char-check input:checked');
      var charIds = [];
      checked.forEach(function (cb) { charIds.push(parseInt(cb.value, 10)); });
      launchChallengeInstances(selectedChallenge, charIds, overlay);
    });
  }

  function launchChallengeInstances(challengeId, charIds, overlay) {
    var promises = charIds.map(function (cid) {
      return fetch('/api/narrative-challenges/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          character_id: cid,
          adventure_id: currentAdventure || null,
          scene_id: currentScene || null
        })
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Server error ' + r.status);
          return data;
        });
      });
    });

    Promise.all(promises).then(function () {
      overlay.remove();
      loadChallengeStatus();
      showToast('Challenge launched for ' + charIds.length + ' character(s)');
    }).catch(function (err) {
      console.error('Failed to launch challenges:', err);
      showToast('Failed to launch: ' + (err.message || 'Unknown error'));
    });
  }

  function openChallengeRunner(inst) {
    var existing = document.getElementById('nc-runner-overlay');
    if (existing) existing.remove();

    fetch('/api/narrative-challenges/' + encodeURIComponent(inst.challenge_id))
      .then(function (r) { return r.json(); })
      .then(function (challenge) {
        renderChallengeRunner(inst, challenge);
      })
      .catch(function () { showToast('Failed to load challenge data'); });
  }

  function _calcAutoScore(challenge, choices) {
    if (!challenge || !challenge.rounds || !choices || !choices.length) return null;
    var alignScores = { light: 5, neutral: 3, dark: 1 };
    var total = 0;
    var count = 0;
    choices.forEach(function (c) {
      var round = challenge.rounds.find(function (r) { return r.id === c.round_id; });
      if (!round) return;
      var choice = (round.choices || []).find(function (ch) { return ch.id === c.choice_id; });
      if (!choice) return;
      total += alignScores[choice.alignment] || 3;
      count++;
    });
    if (count === 0) return null;
    return Math.round(total / count);
  }

  function renderChallengeRunner(inst, challenge) {
    var choices = [];
    try { choices = JSON.parse(inst.choices || '[]'); } catch (_) {}

    var overlay = document.createElement('div');
    overlay.id = 'nc-runner-overlay';
    overlay.dataset.instanceId = String(inst.id);
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="nc-runner-modal">';
    html += '<div class="nc-runner-header">';
    html += '<span>' + esc(challenge.name) + ' — ' + esc(inst.character_name || 'Unknown') + '</span>';
    html += '<button class="nc-runner-close" id="nc-runner-close">&times;</button>';
    html += '</div>';
    html += '<div class="nc-runner-body">';

    html += '<div class="nc-runner-intro">';
    html += '<div class="nc-runner-desc">' + esc(challenge.description || '') + '</div>';
    html += '<div class="nc-runner-poles">';
    html += '<span class="nc-pole nc-pole--hope">' + esc(challenge.hopePole || '') + '</span>';
    html += '<span class="nc-pole-sep">&harr;</span>';
    html += '<span class="nc-pole nc-pole--toll">' + esc(challenge.tollPole || '') + '</span>';
    html += '</div></div>';

    var allRounds = challenge.rounds || [];
    var traversedRoundIds = choices.map(function (c) { return c.round_id; });

    var hasBranching = allRounds.some(function (r) {
      return (r.choices || []).some(function (c) { return !!c.nextRound; });
    });

    var visibleRounds;
    if (hasBranching) {
      if (choices.length > 0) {
        var lastChoice = choices[choices.length - 1];
        var lastRound = allRounds.find(function (r) { return r.id === lastChoice.round_id; });
        var lastChosen = lastRound ? (lastRound.choices || []).find(function (c) { return c.id === lastChoice.choice_id; }) : null;
        var nextRoundId = lastChosen && lastChosen.nextRound ? lastChosen.nextRound : null;

        visibleRounds = allRounds.filter(function (r) {
          return traversedRoundIds.indexOf(r.id) !== -1;
        });
        if (nextRoundId) {
          var nextRound = allRounds.find(function (r) { return r.id === nextRoundId; });
          if (nextRound && traversedRoundIds.indexOf(nextRound.id) === -1) {
            visibleRounds.push(nextRound);
          }
        }
      } else {
        visibleRounds = allRounds.length > 0 ? [allRounds[0]] : [];
      }
    } else {
      visibleRounds = allRounds;
    }

    visibleRounds.forEach(function (round, ri) {
      var existingChoice = choices.find(function (c) { return c.round_id === round.id; });
      html += '<div class="nc-round" data-round-id="' + esc(round.id) + '">';
      html += '<div class="nc-round-header">Round ' + (ri + 1) + '</div>';
      html += '<div class="nc-round-prompt">' + esc(round.prompt) + '</div>';
      if (round.narrativeContext) {
        html += '<div class="nc-round-context">' + esc(round.narrativeContext) + '</div>';
      }
      html += '<div class="nc-round-choices">';
      (round.choices || []).forEach(function (ch) {
        var selected = existingChoice && existingChoice.choice_id === ch.id;
        var alignClass = 'nc-choice--' + (ch.alignment || 'neutral').toLowerCase();
        html += '<div class="nc-choice ' + alignClass + (selected ? ' nc-choice--selected' : '') + '" data-round-id="' + esc(round.id) + '" data-choice-id="' + esc(ch.id) + '">';
        html += '<div class="nc-choice-label">' + esc(ch.label) + '</div>';
        html += '<span class="nc-choice-align">' + esc(ch.alignment || '') + '</span>';
        if (selected && ch.outcome) {
          html += '<div class="nc-choice-outcome" style="font-size:0.55rem;color:#94a3b8;margin-top:0.3rem;font-style:italic;">' + esc(ch.outcome.substring(0, 120)) + '...</div>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    });

    if (inst.status === 'active') {
      var autoScore = _calcAutoScore(challenge, choices);
      html += '<div class="nc-scoring-section">';
      html += '<label class="nc-label">Score (1–5)</label>';
      if (autoScore !== null) {
        html += '<div class="nc-auto-score-info" style="font-size:0.6rem;color:#94a3b8;margin-bottom:0.4rem;">Auto-calculated from choices: <strong style="color:#c8a44e;">' + autoScore + '/5</strong></div>';
      }
      html += '<div class="nc-score-row">';
      for (var s = 1; s <= 5; s++) {
        var scoreLabel = s === 1 ? 'Dark' : s === 5 ? 'Light' : '';
        var autoSelected = autoScore === s ? ' nc-score--selected' : '';
        html += '<button class="nc-score-btn' + autoSelected + '" data-score="' + s + '">' + s + (scoreLabel ? '<br><small>' + scoreLabel + '</small>' : '') + '</button>';
      }
      html += '</div>';
      html += '<button class="cb-header-btn accent nc-submit-score" id="nc-submit-score"' + (autoScore === null ? ' disabled' : '') + '>Submit Score</button>';
      html += '</div>';
    } else if (inst.status === 'scored') {
      html += '<div class="nc-scored-banner">Scored: ' + inst.gm_score + '/5 (shift ' + (inst.shift_value > 0 ? '+' : '') + inst.shift_value + ')</div>';
    }

    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('nc-runner-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.nc-choice').forEach(function (choiceEl) {
      choiceEl.addEventListener('click', function () {
        var roundId = choiceEl.dataset.roundId;
        var choiceId = choiceEl.dataset.choiceId;
        if (inst.status !== 'active') return;

        var roundContainer = choiceEl.closest('.nc-round');
        roundContainer.querySelectorAll('.nc-choice').forEach(function (c) { c.classList.remove('nc-choice--selected'); });
        choiceEl.classList.add('nc-choice--selected');

        fetch('/api/narrative-challenges/instances/' + inst.id + '/choice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round_id: roundId, choice_id: choiceId })
        }).then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); }).then(function (data) {
          choices = data.choices || choices;
        }).catch(function () { showToast('Failed to record choice'); });
      });
    });

    var selectedScore = _calcAutoScore(challenge, choices);
    overlay.querySelectorAll('.nc-score-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        overlay.querySelectorAll('.nc-score-btn').forEach(function (b) { b.classList.remove('nc-score--selected'); });
        btn.classList.add('nc-score--selected');
        selectedScore = parseInt(btn.dataset.score, 10);
        var submitBtn = document.getElementById('nc-submit-score');
        if (submitBtn) submitBtn.disabled = false;
      });
    });

    var submitBtn = document.getElementById('nc-submit-score');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (!selectedScore) return;
        fetch('/api/narrative-challenges/instances/' + inst.id + '/score', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gm_score: selectedScore })
        }).then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); }).then(function () {
          overlay.remove();
          loadChallengeStatus();
          showToast('Challenge scored: ' + selectedScore + '/5');
        }).catch(function () { showToast('Failed to submit score'); });
      });
    }
  }

  function resolveAllChallenges() {
    var scoredIds = _activeInstances.filter(function (i) { return i.status === 'scored'; }).map(function (i) { return i.id; });
    if (scoredIds.length === 0) return;

    fetch('/api/narrative-challenges/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_ids: scoredIds })
    }).then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); }).then(function (data) {
      showResolveResultModal(data);
    }).catch(function () { showToast('Failed to resolve challenges'); });
  }

  function showResolveResultModal(data) {
    var existing = document.getElementById('nc-resolve-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nc-resolve-overlay';
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="nc-resolve-modal">';
    html += '<div class="nc-resolve-header"><span>Challenge Resolution</span><button class="nc-resolve-close" id="nc-resolve-close">&times;</button></div>';
    html += '<div class="nc-resolve-body">';

    html += '<div class="nc-resolve-outcome nc-outcome--' + esc(data.tokenOutcome) + '">';
    html += '<div class="nc-outcome-label">' + esc(data.message) + '</div>';
    html += '<div class="nc-outcome-sum">Party Sum: ' + (data.partySum > 0 ? '+' : '') + data.partySum + '</div>';
    html += '</div>';

    html += '<div class="nc-resolve-results">';
    (data.results || []).forEach(function (r) {
      html += '<div class="nc-resolve-char">';
      html += '<span class="nc-resolve-name">' + esc(r.characterName) + '</span>';
      html += '<span class="nc-resolve-shift">';
      if (r.shifted) {
        html += esc(r.oldSpectrum) + ' &rarr; ' + esc(r.newSpectrum);
      } else {
        html += esc(r.oldSpectrum) + ' (held)';
      }
      html += '</span>';
      html += '<span class="nc-resolve-score">Score ' + r.gmScore + '/5</span>';
      html += '</div>';
    });
    html += '</div>';

    if (data.journalEntries && data.journalEntries.length > 0) {
      html += '<div class="nc-resolve-journal">';
      html += '<div class="nc-label" style="margin-bottom:0.3rem;">Journal Entries Created</div>';
      data.journalEntries.forEach(function (je) {
        html += '<div class="nc-resolve-journal-entry">' + esc(je.title) + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="nc-resolve-applied">';
    if (data.tokensUntapped !== undefined) html += '<div class="nc-resolve-applied-item">&#10003; ' + data.tokensUntapped + ' destiny token(s) untapped</div>';
    if (data.tokensApplied) html += '<div class="nc-resolve-applied-item">&#10003; Token refresh applied (' + data.tokenOutcome + ')</div>';
    if (data.journalEntries && data.journalEntries.length > 0) html += '<div class="nc-resolve-applied-item">&#10003; ' + data.journalEntries.length + ' journal entries logged</div>';
    html += '</div>';

    html += '<div class="nc-resolve-actions">';
    html += '<button class="cb-header-btn accent" id="nc-resolve-done">Done</button>';
    html += '</div>';

    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('nc-resolve-close').addEventListener('click', function () {
      overlay.remove();
      loadChallengeStatus();
      loadCrewJournal();
      if (socket) socket.emit('destiny:request-pool');
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.remove();
        loadChallengeStatus();
        loadCrewJournal();
        if (socket) socket.emit('destiny:request-pool');
      }
    });

    document.getElementById('nc-resolve-done').addEventListener('click', function () {
      overlay.remove();
      loadChallengeStatus();
      loadCrewJournal();
      if (socket) socket.emit('destiny:request-pool');
    });
  }

  function initNarrativeChallenges() {
    var launchBtn = document.getElementById('cb-launch-challenge-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', function () { openChallengeLauncher(); });
    }
    loadChallengeStatus();

    if (socket) {
      socket.on('challenge:player-choice', function (data) {
        _handlePlayerChoiceUpdate(data);
      });
      socket.on('challenge:auto-resolved', function (data) {
        showToast(
          (data.characterName || 'Unknown') + ' challenge auto-resolved — Score ' +
          data.gmScore + '/5' + (data.shifted ? ' (' + data.oldSpectrum + ' → ' + data.newSpectrum + ')' : ' (held)')
        );
        loadChallengeStatus();
      });
    }
  }

  function _handlePlayerChoiceUpdate(data) {
    var statusEl = document.getElementById('cb-challenge-status');
    if (!statusEl) return;

    var inst = _activeInstances.find(function (i) { return i.id === data.instanceId; });
    if (inst) {
      try {
        var choices = JSON.parse(inst.choices || '[]');
        choices = choices.filter(function (c) { return c.round_id !== data.roundId; });
        choices.push({ round_id: data.roundId, choice_id: data.choiceId });
        inst.choices = JSON.stringify(choices);
      } catch (_) {}
    }

    var existingBadge = statusEl.querySelector('.nc-instance-row[data-inst-id="' + data.instanceId + '"] .nc-live-badge');
    var row = statusEl.querySelector('.nc-instance-row[data-inst-id="' + data.instanceId + '"]');
    if (row) {
      var oldBadge = row.querySelector('.nc-live-badge');
      if (oldBadge) oldBadge.remove();
      var badge = document.createElement('span');
      badge.className = 'nc-live-badge';
      badge.textContent = data.totalChoices + '/' + data.totalRounds + ' chosen';
      badge.style.cssText = 'font-size:0.55rem;color:var(--color-success,#22c55e);margin-left:auto;padding:0.1rem 0.3rem;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);';
      row.appendChild(badge);
    }

    var runnerOverlay = document.getElementById('nc-runner-overlay');
    if (runnerOverlay && runnerOverlay.dataset.instanceId === String(data.instanceId)) {
      var roundEl = runnerOverlay.querySelector('.nc-round[data-round-id="' + data.roundId + '"]');
      if (roundEl) {
        var choiceEl = roundEl.querySelector('.nc-choice[data-choice-id="' + data.choiceId + '"]');
        if (choiceEl) {
          roundEl.querySelectorAll('.nc-choice').forEach(function (c) {
            c.classList.remove('nc-choice--player-selected');
          });
          choiceEl.classList.add('nc-choice--player-selected');
          var existingPlayerTag = choiceEl.querySelector('.nc-player-pick-tag');
          if (!existingPlayerTag) {
            var tag = document.createElement('span');
            tag.className = 'nc-player-pick-tag';
            tag.textContent = data.characterName + ' chose this';
            tag.style.cssText = 'font-size:0.5rem;color:var(--color-success);display:block;margin-top:0.2rem;';
            choiceEl.appendChild(tag);
          }
        }
      }
    }
  }

  var _dpProfiles = [];
  var _dpExpanded = null;

  function initDramatisPersonae() {
    var btn = document.getElementById('cb-dramatis-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      openDramatisPanel();
    });
  }

  function openDramatisPanel() {
    var panelId = 'dramatis';
    var existing = document.getElementById('fp-' + panelId);
    if (existing) {
      existing.style.zIndex = ++_panelZCounter;
      return;
    }
    openFloatingPanel(panelId, 'Dramatis Personae', '<div class="dp-loading" style="padding:1rem;color:var(--color-text-secondary);font-style:italic;">Loading NPC profiles\u2026</div>', { width: 620, height: 560 });
    _loadDpProfiles();
  }

  function _loadDpProfiles() {
    fetch('/api/npc-profiles')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _dpProfiles = data.profiles || [];
        _renderDpPanel();
      })
      .catch(function () {
        var body = document.querySelector('#fp-dramatis .cb-fpanel-body');
        if (body) body.innerHTML = '<div style="padding:1rem;color:var(--color-danger);">Failed to load profiles.</div>';
      });
  }

  function _renderDpPanel() {
    var body = document.querySelector('#fp-dramatis .cb-fpanel-body');
    if (!body) return;

    var html = '<div class="dp-toolbar">' +
      '<button class="dp-btn dp-btn--add" id="dp-add-npc">+ New NPC</button>' +
      '<button class="dp-btn dp-btn--push" id="dp-push-all">Push All to Players</button>' +
      '</div>' +
      '<div class="dp-roster" id="dp-roster">';

    if (_dpProfiles.length === 0) {
      html += '<div class="dp-empty">No NPC profiles yet. Click "+ New NPC" to create one.</div>';
    } else {
      _dpProfiles.forEach(function (p) {
        var statusColors = { allied: '#22c55e', neutral: '#eab308', hostile: '#ef4444', unknown: '#6b7280', deceased: '#9333ea' };
        var statusColor = statusColors[p.status] || '#6b7280';
        var isExpanded = _dpExpanded === p.npc_key;

        html += '<div class="dp-card' + (isExpanded ? ' dp-card--expanded' : '') + '" data-npc-key="' + esc(p.npc_key) + '">';
        html += '<div class="dp-card-header" data-dp-toggle="' + esc(p.npc_key) + '">';
        if (p.portrait_url) {
          html += '<img class="dp-portrait-thumb" src="' + esc(p.portrait_url) + '" alt="' + esc(p.name) + '" />';
        } else {
          html += '<div class="dp-portrait-placeholder">' + esc(p.name.charAt(0)) + '</div>';
        }
        html += '<div class="dp-card-info">';
        html += '<div class="dp-card-name">' + esc(p.name) + '</div>';
        html += '<div class="dp-card-sub">' + esc(p.species) + (p.role ? ' \u2014 ' + esc(p.role) : '') + '</div>';
        html += '</div>';
        html += '<span class="dp-status-badge" style="background:' + statusColor + ';">' + esc(p.status) + '</span>';
        html += '<span class="dp-reveal-indicator" style="color:' + (p.revealed ? '#22c55e' : '#6b7280') + ';">' + (p.revealed ? '\u25C9' : '\u25CB') + '</span>';
        html += '</div>';

        if (isExpanded) {
          html += '<div class="dp-card-detail">';
          html += '<div class="dp-detail-row"><label>Status</label>';
          html += '<select class="dp-select" data-dp-status="' + esc(p.npc_key) + '">';
          ['allied', 'neutral', 'hostile', 'unknown', 'deceased'].forEach(function (s) {
            html += '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
          });
          html += '</select></div>';

          html += '<div class="dp-detail-row"><label>Revealed to Players</label>';
          html += '<button class="dp-btn dp-btn--small" data-dp-reveal="' + esc(p.npc_key) + '">' + (p.revealed ? 'Hide from Players' : 'Reveal to Players') + '</button></div>';

          html += '<div class="dp-detail-row"><label>Player Bio</label>';
          html += '<textarea class="dp-textarea" data-dp-bio="' + esc(p.npc_key) + '" rows="4">' + esc(p.player_bio) + '</textarea></div>';

          html += '<div class="dp-detail-row"><label>GM Notes</label>';
          html += '<textarea class="dp-textarea dp-textarea--gm" data-dp-gmnotes="' + esc(p.npc_key) + '" rows="3">' + esc(p.gm_notes) + '</textarea></div>';

          html += '<div class="dp-detail-row"><label>Traits</label>';
          html += '<input class="dp-input" data-dp-traits="' + esc(p.npc_key) + '" value="' + esc((p.traits || []).join(', ')) + '" placeholder="Brave, Cunning, etc." /></div>';

          html += '<div class="dp-detail-row"><label>Connections</label>';
          html += '<textarea class="dp-textarea" data-dp-connections="' + esc(p.npc_key) + '" rows="2" placeholder="One per line">' + esc((p.connections || []).join('\n')) + '</textarea></div>';

          html += '<div class="dp-detail-row"><label>Portrait URL</label>';
          html += '<input class="dp-input" data-dp-portrait="' + esc(p.npc_key) + '" value="' + esc(p.portrait_url || '') + '" placeholder="/attached_assets/..." /></div>';

          html += '<div class="dp-detail-actions">';
          html += '<button class="dp-btn dp-btn--save" data-dp-save="' + esc(p.npc_key) + '">Save Changes</button>';
          html += '<button class="dp-btn dp-btn--push-one" data-dp-push="' + esc(p.npc_key) + '">Push to Players</button>';
          html += '<button class="dp-btn dp-btn--delete" data-dp-delete="' + esc(p.npc_key) + '">Delete</button>';
          html += '</div>';

          html += '</div>';
        }
        html += '</div>';
      });
    }

    html += '</div>';
    body.innerHTML = html;
    _bindDpEvents(body);
  }

  function _bindDpEvents(body) {
    body.querySelectorAll('[data-dp-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.dataset.dpToggle;
        _dpExpanded = (_dpExpanded === key) ? null : key;
        _renderDpPanel();
      });
    });

    var addBtn = body.querySelector('#dp-add-npc');
    if (addBtn) addBtn.addEventListener('click', function () {
      var name = prompt('NPC Name:');
      if (!name || !name.trim()) return;
      var key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      fetch('/api/npc-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc_key: key, name: name.trim() })
      })
      .then(function (r) { return r.json(); })
      .then(function () { _loadDpProfiles(); });
    });

    var pushAllBtn = body.querySelector('#dp-push-all');
    if (pushAllBtn) pushAllBtn.addEventListener('click', function () {
      fetch('/api/npc-profiles/push-all', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) { _showNpcToast('Pushed ' + (d.pushed || 0) + ' profiles to players'); });
    });

    body.querySelectorAll('[data-dp-status]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var key = sel.dataset.dpStatus;
        fetch('/api/npc-profiles/' + key + '/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: sel.value })
        }).then(function () { _loadDpProfiles(); });
      });
    });

    body.querySelectorAll('[data-dp-reveal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpReveal;
        var profile = _dpProfiles.find(function (p) { return p.npc_key === key; });
        if (!profile) return;
        fetch('/api/npc-profiles/' + key + '/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revealed: !profile.revealed })
        }).then(function () {
          _showNpcToast(profile.revealed ? 'Hidden: ' + profile.name : 'Revealed: ' + profile.name);
          _loadDpProfiles();
        });
      });
    });

    body.querySelectorAll('[data-dp-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpSave;
        var card = body.querySelector('.dp-card[data-npc-key="' + key + '"]');
        if (!card) return;

        var bioEl = card.querySelector('[data-dp-bio="' + key + '"]');
        var gmNotesEl = card.querySelector('[data-dp-gmnotes="' + key + '"]');
        var traitsEl = card.querySelector('[data-dp-traits="' + key + '"]');
        var connectionsEl = card.querySelector('[data-dp-connections="' + key + '"]');
        var portraitEl = card.querySelector('[data-dp-portrait="' + key + '"]');

        var updateData = {};
        if (bioEl) updateData.player_bio = bioEl.value;
        if (gmNotesEl) updateData.gm_notes = gmNotesEl.value;
        if (traitsEl) updateData.traits = traitsEl.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        if (connectionsEl) updateData.connections = connectionsEl.value.split('\n').map(function (c) { return c.trim(); }).filter(Boolean);
        if (portraitEl) updateData.portrait_url = portraitEl.value || null;

        fetch('/api/npc-profiles/' + key, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }).then(function () {
          _showNpcToast('Saved: ' + key);
          _loadDpProfiles();
        });
      });
    });

    body.querySelectorAll('[data-dp-push]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpPush;
        if (socket) socket.emit('npc:push-update', { npc_key: key });
        _showNpcToast('Pushed update: ' + key);
      });
    });

    body.querySelectorAll('[data-dp-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpDelete;
        if (!confirm('Delete NPC profile "' + key + '"? This cannot be undone.')) return;
        fetch('/api/npc-profiles/' + key, { method: 'DELETE' })
          .then(function () {
            _dpExpanded = null;
            _loadDpProfiles();
          });
      });
    });
  }

  function _showNpcToast(msg) {
    var toast = document.getElementById('npc-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(function () { toast.classList.remove('active'); }, 2500);
  }

  initDragHandles();
  initCollapsiblePanels();
  initSockets();
  initCampaign();
  loadGlossary();
  loadItemRequests();
  loadCrewJournal();
  initDecisionTracker();
  initNarrativeChallenges();
  initDramatisPersonae();
}());

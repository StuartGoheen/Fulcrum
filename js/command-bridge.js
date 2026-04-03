(function () {
  var THEMES = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader', 'theme-fett', 'theme-holo'];
  var THEME_KEY = 'eote-theme';

  function applyTheme(theme) {
    THEMES.forEach(function (t) { document.documentElement.classList.remove(t); });
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function cycleTheme() {
    var current = THEMES.find(function (t) { return document.documentElement.classList.contains(t); }) || THEMES[0];
    var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(next);
  }

  function initTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored && THEMES.indexOf(stored) !== -1 ? stored : THEMES[0]);
  }

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
      if (el) el.innerHTML = '<p style="color:var(--color-accent-primary);font-size:0.85rem;">Failed to load campaign data: ' + esc(err.message) + '</p>';
    });
  }

  function selectAdventure(advId) {
    var adv = getAdventure(advId);
    if (!adv || !(adv.parts || []).length) return;
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
    var sel = document.getElementById('adv-select');
    if (!sel || !adventuresData) return;
    sel.innerHTML = adventuresData.adventures.map(function (adv) {
      return '<option value="' + adv.id + '"' + (adv.id === currentAdventure ? ' selected' : '') + '>' +
        adv.number + '. ' + esc(adv.title) + '</option>';
    }).join('');
    sel.onchange = function () { selectAdventure(sel.value); };
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
    var sel = document.getElementById('part-select');
    var adv = getAdventure(currentAdventure);
    if (!sel || !adv) return;
    sel.innerHTML = (adv.parts || []).map(function (part) {
      return '<option value="' + part.id + '"' + (part.id === currentPart ? ' selected' : '') + '>' +
        'Part ' + part.number + ': ' + esc(part.title) + '</option>';
    }).join('');
    sel.onchange = function () { selectPart(sel.value); };
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
      h += '<div class="cb-npc-detail-section" style="border-color:var(--color-accent-primary);"><strong>Behavior:</strong> ' + linkify(npc.behavior) + '</div>';
    }
    if (npc.dialogue && npc.dialogue.length) {
      h += '<div class="cb-npc-detail-section" style="border-color:var(--color-accent-secondary,#c084fc);color:var(--color-accent-secondary,#c084fc);"><strong>Dialogue:</strong> ' + npc.dialogue.map(function(d){ return linkify(d); }).join(' ') + '</div>';
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
      if (cbPowers[an] != null) h += '<span style="font-size:0.45rem;color:var(--color-accent-primary);opacity:0.7;">Pwr ' + cbPowers[an] + '</span>';
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
    if (role) h += '<span style="font-size:0.6rem;color:var(--color-text-secondary);text-transform:capitalize;">' + esc(role) + '</span>';
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

    var html = '';

    html += '<div class="cb-scene-header">';
    html += '<h2>Scene ' + scene.number + ': ' + esc(scene.title) + '</h2>';
    if (scene.subtitle) html += '<div class="cb-scene-subtitle">' + esc(scene.subtitle) + '</div>';
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

    if (scene.readAloud) {
      html += '<div class="cb-read-aloud cb-collapsible collapsed">';
      html += '<div class="cb-section-label cb-collapse-toggle"><span class="cb-collapse-chevron">&#9654;</span> Player Read-Aloud</div>';
      html += '<div class="cb-collapse-body"><div class="cb-read-aloud-text">' + linkify(scene.readAloud) + '</div></div>';
      html += '</div>';
    }

    if (scene.gmNotes) {
      html += '<div class="cb-gm-notes cb-collapsible collapsed">';
      html += '<div class="cb-section-label cb-collapse-toggle"><span class="cb-collapse-chevron">&#9654;</span> GM Notes</div>';
      html += '<div class="cb-collapse-body"><div>' + linkify(scene.gmNotes) + '</div></div>';
      html += '</div>';
    }

    var sceneNpcs = getSceneNpcs();
    html += '<div class="cb-card" id="cb-npc-roster-card">';
    html += '<div class="cb-section-label" style="display:flex;align-items:center;justify-content:space-between;">';
    html += '<span>NPC Roster</span>';
    html += '<button class="cb-add-npc-btn" id="cb-add-npc-btn">+ NPC</button>';
    html += '</div>';
    html += '<div id="cb-add-npc-panel" class="cb-add-npc-panel" style="display:none;"></div>';
    if (sceneNpcs.length) {
      var labels = buildNpcLabels(sceneNpcs);
      html += '<div class="cb-npc-grid">';
      sceneNpcs.forEach(function (npc, idx) {
        html += renderNpcCard(npc, idx, labels[idx]);
      });
      html += '</div>';
    } else {
      html += '<p class="cb-muted" style="font-style:italic;font-size:0.75rem;">No NPCs in this scene. Click "+ NPC" to add one.</p>';
    }
    html += '</div>';

    if (scene.hazards) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Hazards / Environment</div>';
      html += '<div>' + linkify(scene.hazards) + '</div>';
      html += '</div>';
    }

    if (scene.encounters && scene.encounters.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Encounters</div>';
      scene.encounters.forEach(function (enc) {
        var typeColor = enc.type === 'combat' ? 'var(--color-danger,#ef4444)' : enc.type === 'social' ? 'var(--color-accent-secondary,#c084fc)' : enc.type === 'infiltration' ? '#818cf8' : 'var(--color-accent-primary)';
        html += '<div style="margin-bottom:0.5rem;padding:0.4rem;border-left:3px solid ' + typeColor + ';background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;"><strong style="color:var(--color-text-primary);font-size:0.8rem;">' + esc(enc.name) + '</strong><span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + typeColor + ';color:#000;font-family:Audiowide,sans-serif;text-transform:uppercase;">' + esc(enc.type) + '</span></div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;"><strong>Trigger:</strong> ' + linkify(enc.trigger) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">' + linkify(enc.description) + '</div>';
        if (enc.tactics) html += '<div style="font-size:0.7rem;color:var(--color-accent-primary);"><strong>Tactics:</strong> ' + linkify(enc.tactics) + '</div>';
        if (enc.composition) {
          html += '<div style="font-size:0.65rem;margin-top:0.2rem;padding:0.25rem;background:rgba(0,0,0,0.1);border-radius:3px;">';
          if (enc.composition.enemies) {
            enc.composition.enemies.forEach(function(e) {
              var threatColor = e.threat === 'rival' ? '#f59e0b' : e.threat === 'nemesis' ? '#ef4444' : 'var(--color-text-secondary)';
              html += '<div><span style="color:' + threatColor + ';text-transform:uppercase;font-size:0.55rem;font-family:Audiowide,sans-serif;">' + esc(e.threat) + '</span> ' + esc(e.type) + ' x' + e.count + '</div>';
            });
          }
          if (enc.composition.terrain) html += '<div style="color:var(--color-text-secondary);margin-top:0.1rem;"><strong>Terrain:</strong> ' + esc(enc.composition.terrain) + '</div>';
          if (enc.composition.positioning) html += '<div style="color:var(--color-text-secondary);"><strong>Positioning:</strong> ' + esc(enc.composition.positioning) + '</div>';
          html += '</div>';
        }
        if (enc.type === 'combat' && window.CombatTracker) {
          html += '<button class="ct-start-encounter-btn" data-enc-idx="' + scene.encounters.indexOf(enc) + '">&#9876; Start Encounter</button>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    var dcList = (scene.disciplineChallenges && scene.disciplineChallenges.length) ? scene.disciplineChallenges : (scene.skillChecks || []);
    if (dcList.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Discipline Challenges</div>';
      dcList.forEach(function (dc) {
        var hasNewFormat = dc.actionType || dc.arena || dc.control || dc.effect;

        html += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.15);border-left:3px solid ' + (dc.actionType === 'assess' ? 'var(--color-accent-deep,#818cf8)' : 'var(--color-accent-primary,#00e5ff)') + ';">';

        html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;flex-wrap:wrap;">';
        if (dc.actionType) {
          var atColor = dc.actionType === 'assess' ? 'var(--color-accent-deep,#818cf8)' : 'var(--color-accent-primary,#00e5ff)';
          html += '<span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + atColor + ';color:#000;font-family:Audiowide,sans-serif;font-weight:bold;letter-spacing:0.05em;">' + esc(dc.actionType.toUpperCase()) + '</span>';
        }
        var discLabel = (dc.discipline || '').replace(/_/g, ' ');
        var arenaLabel = dc.arena ? ' (' + dc.arena.charAt(0).toUpperCase() + dc.arena.slice(1) + ')' : '';
        html += '<span style="font-size:0.75rem;color:var(--color-accent-primary);font-family:Audiowide,sans-serif;">' + esc(discLabel) + esc(arenaLabel) + '</span>';

        if (dc.isOptional) html += '<span style="font-size:0.55rem;padding:0.05rem 0.2rem;border-radius:3px;background:rgba(255,255,255,0.15);color:var(--color-text-secondary);">OPTIONAL</span>';
        if (dc.isGated) html += '<span style="font-size:0.55rem;padding:0.05rem 0.2rem;border-radius:3px;background:rgba(239,68,68,0.2);color:var(--color-warn,#f97316);">GATED</span>';
        html += '</div>';

        if (dc.target || dc.resist != null || dc.risk != null) {
          html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.15rem;font-size:0.65rem;">';
          if (dc.target) html += '<span style="color:var(--color-text-secondary);">vs <strong style="color:var(--color-text-primary);">' + esc(dc.target) + '</strong></span>';
          if (dc.resist != null) html += '<span style="color:var(--color-warn,#f97316);">Resist ' + dc.resist + '</span>';
          if (dc.risk != null) html += '<span style="color:var(--color-warn,#eab308);">Risk ' + dc.risk + '</span>';
          html += '</div>';
        }

        if (dc.isGated) html += '<div style="font-size:0.6rem;color:var(--color-warn,#f97316);font-style:italic;margin-bottom:0.1rem;">&#128274; ' + esc(dc.isGated) + '</div>';

        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">' + linkify(dc.context) + '</div>';

        if (dc.narrativePacing) {
          html += '<div style="font-size:0.6rem;color:var(--color-force,#a78bfa);font-style:italic;margin-bottom:0.15rem;">&#9654; ' + esc(dc.narrativePacing) + '</div>';
        }

        if (hasNewFormat && dc.control) {
          html += '<div style="margin-top:0.15rem;padding:0.2rem 0.3rem;border-radius:3px;background:rgba(0,0,0,0.15);">';
          html += '<div style="font-size:0.55rem;color:var(--color-text-secondary);font-family:Audiowide,sans-serif;margin-bottom:0.1rem;letter-spacing:0.05em;">CONTROL</div>';
          if (dc.control.failure) html += '<div style="font-size:0.65rem;color:var(--color-fail,#ef4444);margin-bottom:0.05rem;">&#10007; <strong>Fail:</strong> ' + linkify(dc.control.failure) + '</div>';
          if (dc.control.success) html += '<div style="font-size:0.65rem;color:var(--color-success,#22c55e);margin-bottom:0.05rem;">&#10003; <strong>Success:</strong> ' + linkify(dc.control.success) + '</div>';
          if (dc.control.mastery) html += '<div style="font-size:0.65rem;color:var(--color-warn,#fbbf24);margin-bottom:0.05rem;">&#9733; <strong>Mastery:</strong> ' + linkify(dc.control.mastery) + '</div>';
          html += '</div>';
        } else if (!hasNewFormat) {
          if (dc.success) html += '<div style="font-size:0.65rem;color:var(--color-success,#22c55e);">&#10003; ' + linkify(dc.success) + '</div>';
          if (dc.failure) html += '<div style="font-size:0.65rem;color:var(--color-fail,#ef4444);">&#10007; ' + linkify(dc.failure) + '</div>';
        }

        if (hasNewFormat && dc.effect) {
          html += '<div style="margin-top:0.15rem;padding:0.2rem 0.3rem;border-radius:3px;background:rgba(0,0,0,0.1);">';
          html += '<div style="font-size:0.55rem;color:var(--color-text-secondary);font-family:Audiowide,sans-serif;margin-bottom:0.1rem;letter-spacing:0.05em;">EFFECT TIERS</div>';
          var tierColors = { fleeting: '#6b7280', masterful: '#3b82f6', legendary: '#a855f7', unleashed: '#f59e0b' };
          ['fleeting', 'masterful', 'legendary', 'unleashed'].forEach(function (tier) {
            if (dc.effect[tier]) {
              var tColor = tierColors[tier] || '#6b7280';
              html += '<div style="font-size:0.65rem;margin-bottom:0.05rem;"><span style="color:' + tColor + ';font-weight:bold;">' + tier.charAt(0).toUpperCase() + tier.slice(1) + ':</span> <span style="color:var(--color-text-secondary);">' + linkify(dc.effect[tier]) + '</span></div>';
            }
          });
          html += '</div>';
        }

        html += '</div>';
      });
      html += '</div>';
    }

    if (scene.environmentMechanics && scene.environmentMechanics.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Environment Mechanics</div>';
      scene.environmentMechanics.forEach(function (em) {
        html += '<div style="margin-bottom:0.4rem;padding:0.3rem 0.4rem;border-left:2px solid var(--color-accent-deep,#818cf8);border-radius:0 4px 4px 0;background:rgba(0,0,0,0.1);">';
        html += '<div style="font-size:0.8rem;color:var(--color-text-primary);font-weight:bold;margin-bottom:0.1rem;">' + esc(em.name) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.1rem;"><strong>Trigger:</strong> ' + linkify(em.trigger) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.1rem;"><strong>Effect:</strong> ' + linkify(em.effect) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-accent-primary);"><strong>Mitigation:</strong> ' + linkify(em.mitigation) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (scene.rewards) {
      var r = scene.rewards;
      var hasRewardContent = r.credits || (r.items && r.items.length) || (r.intel && r.intel.length) || (r.connections && r.connections.length);
      if (hasRewardContent) {
        html += '<div class="cb-card">';
        html += '<div class="cb-section-label">Rewards</div>';
        if (r.credits) html += '<div style="font-size:0.7rem;color:var(--color-accent-primary);margin-bottom:0.15rem;">&#9670; Credits: ' + r.credits + '</div>';
        if (r.items && r.items.length) html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">&#9670; Items: ' + r.items.map(function(i){return esc(i);}).join(', ') + '</div>';
        if (r.intel && r.intel.length) {
          html += '<div style="font-size:0.7rem;color:#f59e0b;margin-bottom:0.15rem;">&#9670; Intel:</div>';
          r.intel.forEach(function(i){ html += '<div style="font-size:0.65rem;color:var(--color-text-secondary);padding-left:0.8rem;">• ' + linkify(i) + '</div>'; });
        }
        if (r.connections && r.connections.length) html += '<div style="font-size:0.7rem;color:var(--color-accent-secondary,#c084fc);margin-bottom:0.15rem;">&#9670; Connections: ' + r.connections.map(function(c){return esc(c);}).join(', ') + '</div>';
        html += '</div>';
      }
    }

    if (scene.pacing) {
      var p = scene.pacing;
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Pacing Guide' + (p.estimatedMinutes ? ' (~' + p.estimatedMinutes + ' min)' : '') + '</div>';
      if (p.openingBeat) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:var(--color-accent-primary);font-family:Audiowide,sans-serif;font-size:0.6rem;">OPENING</span> ' + linkify(p.openingBeat) + '</div>';
      if (p.risingAction) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#eab308;font-family:Audiowide,sans-serif;font-size:0.6rem;">RISING</span> ' + linkify(p.risingAction) + '</div>';
      if (p.climax) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:var(--color-danger,#ef4444);font-family:Audiowide,sans-serif;font-size:0.6rem;">CLIMAX</span> ' + linkify(p.climax) + '</div>';
      if (p.resolution) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#22c55e;font-family:Audiowide,sans-serif;font-size:0.6rem;">RESOLUTION</span> ' + linkify(p.resolution) + '</div>';
      html += '</div>';
    }

    if (scene.decisions && scene.decisions.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Decision Points</div>';
      scene.decisions.forEach(function (d) {
        html += '<div class="cb-decision"><div class="cb-decision-choice">' + esc(d.choice) + '</div><div class="cb-decision-consequence">' + esc(d.consequence) + '</div></div>';
      });
      html += '</div>';
    }

    if (scene.loreTags && scene.loreTags.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Lore Tags</div>';
      html += '<div class="cb-lore-tags">';
      scene.loreTags.forEach(function (tag) {
        html += '<span class="cb-lore-tag" data-lore-tag="' + esc(tag) + '">' + esc(tag) + '</span>';
      });
      html += '</div></div>';
    }

    if (scene.narrativeLinks && scene.narrativeLinks.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Narrative Links</div>';
      scene.narrativeLinks.forEach(function (link) {
        html += '<a class="cb-narrative-link" data-nav-scene="' + esc(link.targetScene) + '">&rarr; ' + esc(link.note) + '</a>';
      });
      html += '</div>';
    }

    html += '<div class="cb-scene-footer">';
    html += '<button class="cb-complete-btn' + (isDone ? ' completed' : '') + '" data-scene="' + scene.id + '">' + (isDone ? '&#10003; Scene Complete' : '&#9675; Mark Scene Complete') + '</button>';
    html += '<div class="cb-scene-nav-arrows">';
    html += '<button class="cb-arrow-btn" id="scene-prev"' + (idx <= 0 ? ' disabled' : '') + '>&larr; Prev</button>';
    html += '<button class="cb-arrow-btn" id="scene-next"' + (idx >= scenes.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.cb-lore-tag').forEach(function (el) {
      el.addEventListener('click', function () { openLoreModal(el.dataset.loreTag); });
    });
    container.querySelectorAll('.cb-narrative-link').forEach(function (el) {
      el.addEventListener('click', function () { navigateToScene(el.dataset.navScene); });
    });
    container.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
    container.querySelectorAll('.cb-collapse-toggle').forEach(function (el) {
      el.addEventListener('click', function () {
        var section = el.closest('.cb-collapsible');
        if (section) section.classList.toggle('collapsed');
      });
    });
    container.querySelectorAll('.cb-npc-card-header').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.cb-npc-edit-btn') || e.target.closest('.cb-npc-remove-btn')) return;
        var card = el.closest('.cb-npc-card');
        if (!card) return;
        var expandKey = el.dataset.npcToggle;
        card.classList.toggle('expanded');
        _npcExpandState[expandKey] = card.classList.contains('expanded');
      });
    });
    container.querySelectorAll('.cb-npc-edit-btn').forEach(function (btn) {
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
            if (updated.roleKit) {
              npc.threatBuild.roleKit = updated.roleKit;
            }
            if (updated.powerSource) {
              npc.threatBuild.powerSource = updated.powerSource;
            }
            npc.threatBuild.computedAttacks = updated.computedAttacks || [];
            if (updated.loot) npc.loot = updated.loot;
            setSceneNpcs(npcs);
            persistSceneNpc(idx, npc);
            renderScene();
          });
        }
      });
    });
    container.querySelectorAll('.cb-npc-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.npcIdx, 10);
        var npcs = getSceneNpcs();
        if (idx < 0 || idx >= npcs.length) return;
        npcs.splice(idx, 1);
        setSceneNpcs(npcs);
        deleteSceneNpc(idx);
        renderScene();
      });
    });
    var addNpcBtn = document.getElementById('cb-add-npc-btn');
    if (addNpcBtn) {
      addNpcBtn.addEventListener('click', function () {
        var panel = document.getElementById('cb-add-npc-panel');
        if (!panel) return;
        if (panel.style.display !== 'none') {
          panel.style.display = 'none';
          return;
        }
        var saved = window.NpcBuilder ? window.NpcBuilder.getSavedNpcs() : [];
        if (!saved.length) {
          panel.style.display = 'block';
          panel.innerHTML = '<p class="cb-muted" style="font-size:0.7rem;">No saved NPCs in Threat Builder. Open the Threat Builder and save some first.</p>';
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
        panel.innerHTML = ph;
        panel.style.display = 'block';
        panel.querySelectorAll('.cb-add-npc-item').forEach(function (item) {
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
              panel.style.display = 'none';
              renderScene();
            });
          });
        });
      });
    }
    container.querySelectorAll('.cb-npc-loot-assign-btn').forEach(function (btn) {
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
    container.querySelectorAll('.ct-start-encounter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var encIdx = parseInt(btn.dataset.encIdx, 10);
        if (isNaN(encIdx) || !scene.encounters || !scene.encounters[encIdx]) return;
        var enc = scene.encounters[encIdx];
        if (window.CombatTracker) {
          window._cbSocket = socket;
          window.CombatTracker.start(enc, scene, getSceneNpcs(), partyCache, socket);
          var ctPanel = document.getElementById('combat-tracker-panel');
          if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
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
    var overlay = document.getElementById('lore-modal-overlay');
    var title = document.getElementById('lore-modal-title');
    var body = document.getElementById('lore-modal-body');
    title.textContent = 'Lore: ' + tag;
    body.innerHTML = '<p style="color:var(--color-text-secondary);">Loading...</p>';
    overlay.classList.add('active');
    fetch('/api/campaign/lore-tags/' + encodeURIComponent(tag))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.scenes || !data.scenes.length) {
          body.innerHTML = '<p style="color:var(--color-text-secondary);">No scenes found with this tag.</p>';
          return;
        }
        body.innerHTML = data.scenes.map(function (s) {
          return '<div class="cb-lore-scene-link" data-nav-scene="' + esc(s.sceneId) + '">' +
            '<div style="font-weight:600;">Adventure ' + s.adventureNumber + ': ' + esc(s.adventureTitle) + '</div>' +
            '<div style="color:var(--color-text-secondary);font-size:0.8rem;">Part ' + s.partNumber + ': ' + esc(s.partTitle) + ' — Scene ' + s.sceneNumber + ': ' + esc(s.sceneTitle) + '</div>' +
          '</div>';
        }).join('');
        body.querySelectorAll('.cb-lore-scene-link').forEach(function (el) {
          el.addEventListener('click', function () {
            overlay.classList.remove('active');
            navigateToScene(el.dataset.navScene);
          });
        });
      })
      .catch(function () { body.innerHTML = '<p style="color:var(--color-accent-primary);">Failed to load lore data.</p>'; });
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
      cardHtml += (pc.marks != null ? ' <span style="color:var(--color-accent-primary);margin-left:0.5rem;">' + pc.marks + ' Marks</span>' : '');
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
                cardHtml += '<div style="margin-bottom:0.2rem;"><strong style="color:var(--color-accent-primary);">' + esc(d.title) + ':</strong> <span style="color:var(--color-text-secondary);">' + esc(d.text) + '</span></div>';
              });
            } else if (ins.description) {
              cardHtml += '<div style="color:var(--color-text-secondary);">' + esc(ins.description) + '</div>';
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
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">Abilities</div>';
        pc.vocationAbilities.forEach(function (a) {
          cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);padding:0.02rem 0;">';
          cardHtml += '<span style="color:var(--color-accent-primary);">T' + a.tier + '</span> ';
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
          cardHtml += '<div style="font-size:0.65rem;color:var(--color-accent-secondary,#c084fc);margin-top:0.2rem;">Destiny: ' + esc(destName) + '</div>';
          if (pc.destiny.coreQuestion) {
            cardHtml += '<div style="font-size:0.55rem;color:var(--color-text-secondary);opacity:0.7;padding-left:0.3rem;">' + esc(pc.destiny.coreQuestion) + '</div>';
          }
        }
      }

      if (pc.backgroundFavored && pc.backgroundFavored.length) {
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-accent-deep,#818cf8);margin-top:0.15rem;">Favored: ' + pc.backgroundFavored.map(function (f) { return esc(f.replace(/_/g, ' ')); }).join(', ') + '</div>';
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
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">Disciplines</div>';
        ARENA_GROUPS.forEach(function (arena) {
          var arenaDie = pc.arenas && pc.arenas[arena.id] ? pc.arenas[arena.id] : '';
          cardHtml += '<div style="font-size:0.58rem;margin-top:0.15rem;">';
          cardHtml += '<span style="color:var(--color-accent-primary);font-family:Audiowide,sans-serif;">' + arena.label + '</span>';
          if (arenaDie) cardHtml += ' <span style="color:var(--color-text-secondary);opacity:0.7;">' + esc(arenaDie) + '</span>';
          cardHtml += '</div>';
          arena.discs.forEach(function (discId) {
            var disc = pc.disciplines[discId];
            if (!disc) return;
            var trained = disc.training === 'trained' || disc.training === 'formative';
            var color = disc.favored ? 'var(--color-accent-secondary,#c084fc)' : trained ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
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
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">Gear (' + pc.gear.length + ')</div>';
        pc.gear.forEach(function (g) {
          var tagStr = (g.tags || []).concat(g.traits || []).filter(Boolean).join(', ');
          var isRestricted = (g.tags || []).some(function(t){ return /restricted|illegal/i.test(t); }) || (g.availability && /restricted|illegal/i.test(g.availability));
          var color = isRestricted ? 'var(--color-danger,#ef4444)' : 'var(--color-text-secondary)';
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

  function renderGmDestinyPool(pool) {
    var container = document.getElementById('gm-destiny-tokens');
    var countEl = document.getElementById('gm-destiny-count');
    if (!container) return;
    if (!pool || pool.length === 0) {
      container.innerHTML = '<span class="cb-muted" style="font-style:italic;">No crew connected</span>';
      if (countEl) countEl.textContent = '';
      return;
    }
    container.innerHTML = pool.map(function (t, idx) {
      var isDark = t.side === 'toll';
      var tappedCls = t.tapped ? ' is-tapped' : '';
      return '<div class="gm-destiny-token' + (isDark ? ' is-dark' : '') + tappedCls + '" data-index="' + idx + '" title="Click to flip">' +
        '<div class="force-token-inner">' +
          '<div class="force-token-face force-token-front"></div>' +
          '<div class="force-token-face force-token-back"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    container.querySelectorAll('.gm-destiny-token').forEach(function (el) {
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
      if (tappedCount > 0) summary += ' <span style="color:var(--color-text-secondary);">(' + tappedCount + ' tapped)</span>';
      countEl.innerHTML = summary;
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
          html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:var(--color-accent-secondary);">NPC Effect</div><div>' + linkify(pcNpc.npc || '—') + '</div></div>';
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
      if (action.risk) html += '<div class="cb-glossary-guide" style="border-left:2px solid var(--color-accent-secondary);padding-left:8px;margin-top:6px;"><strong>Risk:</strong> ' + linkify(action.risk) + '</div>';
      if (action.mastery) html += '<div class="cb-glossary-guide" style="border-left:2px solid #5588CC;padding-left:8px;margin-top:6px;"><strong>Mastery:</strong> ' + linkify(action.mastery) + '</div>';
      if (action.effect && Array.isArray(action.effect)) {
        html += '<div style="margin-top:8px;">';
        action.effect.forEach(function (e) {
          html += '<div style="margin-top:4px;"><span style="color:var(--color-accent);">' + esc(e.label || ('Tier ' + e.tier)) + '</span>';
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

  function renderStarshipStatus(active, seats) {
    var statusEl = document.getElementById('sc-status');
    var seatsEl = document.getElementById('sc-seats');
    var endBtn = document.getElementById('cb-end-starship');
    var seatsSection = document.getElementById('sc-seats-section');
    if (statusEl) {
      statusEl.textContent = active ? 'ACTIVE' : 'Inactive';
      statusEl.style.color = active ? '#22c55e' : 'var(--color-text-secondary)';
    }
    if (endBtn) endBtn.style.display = active ? '' : 'none';
    if (seatsSection) seatsSection.style.display = active ? '' : 'none';
    if (seatsEl && seats) {
      var keys = Object.keys(seats);
      if (!keys.length) {
        seatsEl.innerHTML = '<div class="cb-muted">No stations claimed.</div>';
      } else {
        seatsEl.innerHTML = keys.map(function (sid) {
          var s = seats[sid];
          var label = sid.replace('station_', '').replace(/^\w/, function (c) { return c.toUpperCase(); });
          return '<div style="padding:0.15rem 0;">' + esc(label) + ': <strong>' + esc(s.characterName || 'Unknown') + '</strong></div>';
        }).join('');
      }
    }
  }

  function initSockets() {
    if (!socket) return;
    socket.emit('session:join', { role: 'gm' });
    socket.emit('destiny:request');

    socket.on('destiny:sync', function (data) {
      renderGmDestinyPool(data.pool || data);
    });

    socket.on('player:connected', function () { loadPartyMonitor(); });
    socket.on('player:disconnected', function () { loadPartyMonitor(); });
    socket.on('state:sync', function () { loadPartyMonitor(); });
    socket.on('advancement:sync', function () { loadPartyMonitor(); });

    socket.emit('shipcombat:request');
    socket.on('shipcombat:sync', function (data) {
      window._scActive = !!data.active;
      renderStarshipStatus(data.active, data.seats);
    });
    socket.on('shipcombat:seats_update', function (data) {
      if (data.seats) renderStarshipStatus(window._scActive, data.seats);
    });

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
  if (destinyUntapBtn) destinyUntapBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:untap'); });
  if (destinyResetBtn) destinyResetBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:reset'); });

  var themeBtn = document.getElementById('cb-theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

  var logoutBtn = document.getElementById('cb-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function () { window.location.href = '/login'; })
      .catch(function () { window.location.href = '/login'; });
  });

  var scLaunchBtn = document.getElementById('cb-launch-starship');
  if (scLaunchBtn) {
    scLaunchBtn.addEventListener('click', function () {
      if (socket) socket.emit('shipcombat:enter');
    });
  }

  var scEndBtn = document.getElementById('cb-end-starship');
  if (scEndBtn) {
    scEndBtn.addEventListener('click', function () {
      if (socket) socket.emit('shipcombat:exit');
    });
  }

  document.getElementById('lore-modal-close').addEventListener('click', function () {
    document.getElementById('lore-modal-overlay').classList.remove('active');
  });
  document.getElementById('lore-modal-overlay').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
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
      if (req.gm_notes) html += '<div style="font-size:0.7rem;color:var(--color-accent-secondary);margin-top:0.2rem;">GM: ' + esc(req.gm_notes) + '</div>';
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

  function initMobileTabs() {
    var tabs = document.getElementById('cb-mobile-tabs');
    if (!tabs) return;
    var colLeft = document.querySelector('.cb-col-left');
    var colCenter = document.querySelector('.cb-col-center');
    var colRight = document.querySelector('.cb-col-right');
    var panelMap = { left: colLeft, center: colCenter, right: colRight };

    function isMobile() { return window.innerWidth <= 768; }

    function activatePanel(panel) {
      Object.keys(panelMap).forEach(function (k) {
        panelMap[k].classList.remove('cb-mobile-active');
      });
      if (panelMap[panel]) panelMap[panel].classList.add('cb-mobile-active');
      tabs.querySelectorAll('.cb-mobile-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.panel === panel);
      });
    }

    tabs.querySelectorAll('.cb-mobile-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        activatePanel(tab.dataset.panel);
      });
    });

    function checkMobile() {
      if (isMobile()) {
        var activeTab = tabs.querySelector('.cb-mobile-tab.active');
        activatePanel(activeTab ? activeTab.dataset.panel : 'center');
      } else {
        Object.keys(panelMap).forEach(function (k) {
          panelMap[k].classList.remove('cb-mobile-active');
        });
      }
    }

    window.addEventListener('resize', checkMobile);
    checkMobile();
  }

  var assessData = null;
  var assessActivePhase = 0;
  var assessActiveDisc = 0;

  function openAssessGuide() {
    var overlay = document.getElementById('assess-overlay');
    if (!overlay) return;
    if (assessData) {
      renderAssessOverlay();
      overlay.classList.add('active');
      return;
    }
    fetch('/data/tutorials/scene1-assess.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        assessData = data;
        assessActivePhase = 0;
        assessActiveDisc = 0;
        renderAssessOverlay();
        overlay.classList.add('active');
      })
      .catch(function (err) {
        console.error('Failed to load assess guide:', err);
      });
  }

  function closeAssessGuide() {
    var overlay = document.getElementById('assess-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function renderAssessOverlay() {
    if (!assessData) return;
    var titleEl = document.getElementById('assess-title');
    if (titleEl) titleEl.textContent = assessData.title || 'ASSESS GUIDE';

    var tabsEl = document.getElementById('assess-phase-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = assessData.phases.map(function (phase, pi) {
        return '<button class="assess-phase-tab' + (pi === assessActivePhase ? ' active' : '') + '" data-phase="' + pi + '">' +
          esc(phase.label) + '</button>';
      }).join('');
      tabsEl.querySelectorAll('.assess-phase-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          assessActivePhase = parseInt(btn.dataset.phase, 10);
          assessActiveDisc = 0;
          renderAssessOverlay();
        });
      });
    }

    var phase = assessData.phases[assessActivePhase];
    if (!phase) return;

    var navEl = document.getElementById('assess-disc-nav');
    if (navEl) {
      navEl.innerHTML = phase.disciplines.map(function (disc, di) {
        return '<button class="assess-disc-btn' + (di === assessActiveDisc ? ' active' : '') + '" data-disc="' + di + '">' +
          esc(disc.label) + '<span class="assess-disc-arena">(' + esc(disc.arena) + ')</span></button>';
      }).join('');
      navEl.querySelectorAll('.assess-disc-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          assessActiveDisc = parseInt(btn.dataset.disc, 10);
          renderAssessContent();
          navEl.querySelectorAll('.assess-disc-btn').forEach(function (b) {
            b.classList.toggle('active', parseInt(b.dataset.disc, 10) === assessActiveDisc);
          });
        });
      });
    }

    renderAssessContent();
  }

  function renderAssessContent() {
    var contentEl = document.getElementById('assess-content');
    if (!contentEl || !assessData) return;
    var phase = assessData.phases[assessActivePhase];
    if (!phase) return;
    var disc = phase.disciplines[assessActiveDisc];
    if (!disc) return;

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

    contentEl.innerHTML = html;
    contentEl.scrollTop = 0;
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

  (function initAssessOverlay() {
    var closeBtn = document.getElementById('assess-close');
    if (closeBtn) closeBtn.addEventListener('click', closeAssessGuide);
    var overlay = document.getElementById('assess-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeAssessGuide();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        closeAssessGuide();
      }
    });
  }());

  initTheme();
  initDragHandles();
  initMobileTabs();
  initSockets();
  initCampaign();
  loadGlossary();
  loadItemRequests();
}());

(function () {
  'use strict';

  var EFFECT_DEFS = [];
  if (window.EffectManager && window.EffectManager.EFFECT_DEFS) {
    EFFECT_DEFS = window.EffectManager.EFFECT_DEFS;
  }

  var NPC_CONDITIONS = [
    'disoriented', 'rattled', 'stunned', 'exposed', 'shaken',
    'weakened', 'empowered', 'optimized',
    'prone', 'restrained', 'slowed', 'pinned', 'suppressed',
    'blinded', 'bleeding', 'hazard', 'incapacitated',
    'marked', 'guarded', 'cover', 'stimmed'
  ];

  var combatState = null;
  var _socket = null;
  var _socketHandlers = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getEffectDef(id) {
    if (EFFECT_DEFS.length === 0 && window.EffectManager && window.EffectManager.EFFECT_DEFS) {
      EFFECT_DEFS = window.EffectManager.EFFECT_DEFS;
    }
    for (var i = 0; i < EFFECT_DEFS.length; i++) {
      if (EFFECT_DEFS[i].id === id) return EFFECT_DEFS[i];
    }
    return null;
  }

  function condColor(id) {
    var colors = {
      disoriented: '#818cf8', rattled: '#f97316', stunned: '#a855f7',
      exposed: '#ef4444', shaken: '#f59e0b', weakened: '#92400e',
      empowered: '#22c55e', optimized: '#3b82f6', prone: '#6b7280',
      restrained: '#78716c', slowed: '#6b7280', pinned: '#78716c',
      suppressed: '#0ea5e9', blinded: '#1f2937', bleeding: '#dc2626',
      hazard: '#dc2626', incapacitated: '#1f2937', marked: '#d946ef',
      guarded: '#14b8a6', cover: '#3b82f6', stimmed: '#10b981'
    };
    return colors[id] || '#6b7280';
  }

  function getSocket() {
    if (!_socket) {
      var cb = document.querySelector('script[src*="command-bridge"]');
      if (typeof io !== 'undefined') {
        _socket = window._cbSocket || null;
      }
    }
    return _socket;
  }

  function startEncounter(encounter, scene, npcs, partyData, socket) {
    if (socket) _socket = socket;
    var highestTier = 0;
    var npcEntries = [];
    var npcIdCounter = 0;

    if (encounter.composition && encounter.composition.enemies) {
      encounter.composition.enemies.forEach(function (enemy) {
        var npcData = null;
        var enemyBase = enemy.type.replace(/ \(.*\)/, '');
        npcs.forEach(function (n) {
          if (!n.threatBuild) return;
          if (n.type === enemy.type || n.type === enemyBase || n.name === enemy.type || n.name === enemyBase) {
            npcData = n;
          }
        });
        var tier = enemy.tier || 0;
        if (tier > highestTier) highestTier = tier;
        for (var i = 0; i < enemy.count; i++) {
          npcIdCounter++;
          var label = enemy.count > 1 ? enemy.type + ' #' + (i + 1) : enemy.type;
          var tb = npcData && npcData.threatBuild ? npcData.threatBuild : null;
          var comp = tb ? (tb.computed || {}) : {};
          npcEntries.push({
            id: 'npc_' + npcIdCounter,
            name: label,
            type: 'npc',
            threat: enemy.threat || enemy.classification || 'standard',
            tier: tier,
            role: enemy.role || '',
            initiative: comp.initiative || (1 + tier),
            power: comp.power || 0,
            defense: comp.defense || 0,
            evasion: comp.evasion || 0,
            resist: comp.resist || 0,
            vitalityMax: comp.vitality || 5,
            vitalityCurrent: comp.vitality || 5,
            actions: comp.actions || 1,
            conditions: [],
            conditionArenas: {},
            roleKit: tb ? tb.roleKit : null,
            arenas: tb ? (tb.arenas || {}) : {},
            damageTiers: comp.damageTiers || null,
            zone: null,
            npcData: npcData
          });
        }
      });
    }

    var startPositions = {};
    if (scene.tacticalMap && scene.tacticalMap.startingPositions) {
      scene.tacticalMap.startingPositions.forEach(function (sp) {
        startPositions[sp.who] = sp.zone;
      });
    }

    var spKeys = Object.keys(startPositions);
    var usedSPKeys = {};
    npcEntries.forEach(function (npc) {
      var bestKey = null;
      for (var k = 0; k < spKeys.length; k++) {
        var key = spKeys[k];
        if (key === 'PCs' || key === 'Patrons' || usedSPKeys[key]) continue;
        var keyLower = key.toLowerCase();
        var npcNameLower = npc.name.toLowerCase();
        if (keyLower === npcNameLower || npcNameLower.indexOf(keyLower) !== -1 || keyLower.indexOf(npcNameLower.replace(/ #\d+$/, '')) !== -1) {
          bestKey = key;
          break;
        }
      }
      if (!bestKey) {
        for (var k2 = 0; k2 < spKeys.length; k2++) {
          var key2 = spKeys[k2];
          if (key2 === 'PCs' || key2 === 'Patrons' || usedSPKeys[key2]) continue;
          var keyWords = key2.toLowerCase().split(/\s+/);
          var nameWords = npc.name.toLowerCase().replace(/ #\d+$/, '').split(/\s+/);
          var overlap = nameWords.some(function (w) { return w.length > 2 && keyWords.some(function (kw) { return kw.indexOf(w) !== -1 || w.indexOf(kw) !== -1; }); });
          if (overlap) { bestKey = key2; break; }
        }
      }
      if (bestKey) {
        npc.zone = startPositions[bestKey];
        usedSPKeys[bestKey] = true;
      }
    });

    var pcTokenZone = startPositions['PCs'] || null;

    var pcSlots = [];
    if (partyData && partyData.length) {
      partyData.forEach(function (pc) {
        pcSlots.push({
          id: pc.id || ('pc_' + pc.name.toLowerCase().replace(/\s+/g, '_')),
          name: pc.name,
          type: 'pc',
          initiative: 0,
          arenas: pc.arenas || {},
          disciplines: pc.disciplines || {},
          vitality: pc.vitality,
          conditions: pc.conditions || [],
          vocations: pc.vocations || [],
          species: pc.species || '',
          archetype: pc.archetype || '',
          connected: pc.connected
        });
      });
    }

    combatState = {
      encounter: encounter,
      scene: scene,
      round: 1,
      currentTurnIndex: 0,
      highestTier: highestTier,
      combatants: npcEntries,
      pcSlots: pcSlots,
      selectedId: null,
      collapsed: false,
      tacticalMap: scene.tacticalMap || null,
      turnOrder: [],
      tokenPositions: {},
      selectedToken: null,
      joinBattleSent: false,
      pcResponses: {}
    };

    rebuildTurnOrder();

    if (pcTokenZone) {
      combatState.tokenPositions['PCs'] = pcTokenZone;
    }
    npcEntries.forEach(function (npc) {
      if (npc.zone) combatState.tokenPositions[npc.id] = npc.zone;
    });

    var sock = getSocket();
    if (sock) {
      _cleanupSocketHandlers();

      function onJoinResult(data) {
        if (!combatState) return;
        combatState.pcResponses[data.characterId] = data;
        var pc = combatState.pcSlots.find(function (p) { return p.id === data.characterId; });
        if (pc) {
          pc.initiative = data.initiative;
          pc.surprised = data.surprised;
          pc.mastery = data.mastery;
          pc.controlResult = data.controlResult;
        }
        rebuildTurnOrder();
        renderCombatTracker();
      }

      function onAllJoined() {
        if (!combatState) return;
        rebuildTurnOrder();
        renderCombatTracker();
      }

      function onPlayerSync(data) {
        if (!combatState) return;
        var pc = combatState.pcSlots.find(function (p) { return p.id === data.characterId; });
        if (pc) {
          pc.conditions = (data.effects || []).map(function (e) { return e.effectId || e; });
          renderCombatTracker();
        }
      }

      sock.on('combat:join-battle-result', onJoinResult);
      sock.on('combat:all-joined', onAllJoined);
      sock.on('condition:player-sync', onPlayerSync);

      _socketHandlers = [
        { event: 'combat:join-battle-result', fn: onJoinResult },
        { event: 'combat:all-joined', fn: onAllJoined },
        { event: 'condition:player-sync', fn: onPlayerSync }
      ];
    }

    renderCombatTracker();

    triggerJoinBattle();
  }

  function _cleanupSocketHandlers() {
    var sock = getSocket();
    if (sock && _socketHandlers.length) {
      _socketHandlers.forEach(function (h) { sock.off(h.event, h.fn); });
    }
    _socketHandlers = [];
  }

  function endEncounter() {
    _cleanupSocketHandlers();
    var sock = getSocket();
    if (sock) {
      sock.emit('combat:end');
    }
    combatState = null;
    var container = document.getElementById('combat-tracker-panel');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }

  function triggerJoinBattle() {
    if (!combatState || combatState.joinBattleSent) return;
    var sock = getSocket();
    if (sock) {
      sock.emit('combat:start', {
        encounterName: combatState.encounter.name,
        highestTier: combatState.highestTier
      });
      combatState.joinBattleSent = true;
      renderCombatTracker();
    }
  }

  function designateNpcSurprised(npcId) {
    var npc = combatState ? combatState.combatants.find(function (n) { return n.id === npcId; }) : null;
    if (!npc) return;
    if (npc.conditions.indexOf('disoriented') === -1) npc.conditions.push('disoriented');
    if (npc.conditions.indexOf('exposed') === -1) npc.conditions.push('exposed');
    npc.surprised = true;
    renderCombatTracker();
  }

  function rebuildTurnOrder() {
    if (!combatState) return;
    var all = [];
    combatState.pcSlots.forEach(function (pc) {
      all.push({ id: pc.id, name: pc.name, type: 'pc', initiative: pc.initiative || 0 });
    });
    combatState.combatants.forEach(function (npc) {
      all.push({ id: npc.id, name: npc.name, type: 'npc', initiative: npc.initiative });
    });
    all.sort(function (a, b) { return b.initiative - a.initiative; });
    combatState.turnOrder = all;
  }

  function getTurnOrder() {
    if (!combatState || !combatState.turnOrder) return [];
    return combatState.turnOrder;
  }

  function getPresenceEffect(conditions) {
    var mod = 0;
    conditions.forEach(function (cid) {
      if (cid === 'disoriented') mod -= 1;
      if (cid === 'rattled') mod -= 1;
      if (cid === 'stunned') mod -= 2;
      if (cid === 'optimized') mod += 1;
    });
    return mod;
  }

  function getNpcArenaMods(npc) {
    var mods = {};
    var arenas = ['physique','reflex','grit','wits','presence'];
    arenas.forEach(function (a) { mods[a] = 0; });
    if (npc.conditionArenas && npc.conditionArenas.weakened && npc.conditions.indexOf('weakened') !== -1) {
      var wa = npc.conditionArenas.weakened;
      if (mods[wa] !== undefined) mods[wa] -= 1;
    }
    if (npc.conditionArenas && npc.conditionArenas.empowered && npc.conditions.indexOf('empowered') !== -1) {
      var ea = npc.conditionArenas.empowered;
      if (mods[ea] !== undefined) mods[ea] += 1;
    }
    return mods;
  }

  var DIE_STEPS = ['—','D4','D6','D8','D10','D12','D20'];
  function stepDie(dieStr, steps) {
    var idx = -1;
    for (var i = 0; i < DIE_STEPS.length; i++) {
      if (DIE_STEPS[i].toLowerCase() === (dieStr || '').toLowerCase()) { idx = i; break; }
    }
    if (idx < 0) return dieStr;
    var newIdx = Math.max(0, Math.min(DIE_STEPS.length - 1, idx + steps));
    return DIE_STEPS[newIdx];
  }

  function getPcEffectiveDie(dieStr, conditions) {
    var steps = 0;
    (conditions || []).forEach(function (cid) {
      if (cid === 'disoriented') steps -= 1;
      if (cid === 'stunned') steps -= 2;
      if (cid === 'optimized') steps += 1;
      if (cid === 'empowered') steps += 1;
      if (cid === 'weakened') steps -= 1;
    });
    if (steps === 0) return dieStr;
    return stepDie(dieStr, steps);
  }

  function renderCombatTracker() {
    var container = document.getElementById('combat-tracker-panel');
    if (!container || !combatState) return;
    container.style.display = 'block';

    var html = '';
    html += '<div class="ct-header">';
    html += '<div class="ct-title">' + esc(combatState.encounter.name) + '</div>';
    html += '<div class="ct-round">Round <span id="ct-round-num">' + combatState.round + '</span></div>';
    html += '<div class="ct-header-actions">';
    if (!combatState.joinBattleSent) {
      html += '<button class="ct-jb-trigger" id="ct-trigger-jb">Join Battle</button>';
    } else {
      var responded = Object.keys(combatState.pcResponses).length;
      var total = combatState.pcSlots.length;
      html += '<span class="ct-jb-status">' + responded + '/' + total + ' joined</span>';
    }
    html += '<button class="ct-end-btn" id="ct-end-encounter">End</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="ct-two-panel">';

    html += renderInitRail();

    html += renderDetailPanel();

    html += '</div>';

    if (combatState.tacticalMap) {
      html += renderTacticalMap();
    }

    container.innerHTML = html;
    attachCombatEvents(container);
  }

  function renderInitRail() {
    var turnOrder = getTurnOrder();
    var html = '<div class="ct-init-rail">';

    html += '<div class="ct-rail-header">';
    html += '<span>Initiative</span>';
    html += '<span class="ct-rail-round">R' + combatState.round + '</span>';
    html += '</div>';

    html += '<div class="ct-rail-list">';
    turnOrder.forEach(function (c, idx) {
      var isCurrent = idx === combatState.currentTurnIndex;
      var isSelected = combatState.selectedId === c.id;
      var isNpc = c.type === 'npc';
      var npc = isNpc ? combatState.combatants.find(function (n) { return n.id === c.id; }) : null;
      var pc = !isNpc ? combatState.pcSlots.find(function (p) { return p.id === c.id; }) : null;
      var isDown = npc && npc.vitalityCurrent <= 0;
      var isSurprised = (pc && pc.surprised) || (npc && npc.surprised);

      var cls = 'ct-rail-entry';
      if (isCurrent) cls += ' ct-rail-current';
      if (isSelected) cls += ' ct-rail-selected';
      if (isNpc) cls += ' ct-rail-npc';
      else cls += ' ct-rail-pc';
      if (isDown) cls += ' ct-rail-down';
      if (isSurprised) cls += ' ct-rail-surprised';

      html += '<div class="' + cls + '" data-select-id="' + esc(c.id) + '">';
      html += '<span class="ct-rail-init">' + (c.initiative || '—') + '</span>';
      html += '<span class="ct-rail-name">' + esc(c.name) + '</span>';
      if (isNpc && npc) {
        var pct = npc.vitalityMax > 0 ? Math.round((npc.vitalityCurrent / npc.vitalityMax) * 100) : 0;
        html += '<span class="ct-rail-hp" style="color:' + (pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444') + ';">' + npc.vitalityCurrent + '</span>';
      }
      if (isSurprised) html += '<span class="ct-rail-tag ct-tag-surprised">!</span>';
      if (pc && pc.mastery) html += '<span class="ct-rail-tag ct-tag-mastery">M</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="ct-rail-controls">';
    html += '<button class="ct-ctrl-btn" id="ct-prev-turn" title="Previous Turn">&larr;</button>';
    html += '<button class="ct-ctrl-btn ct-ctrl-primary" id="ct-next-turn" title="Next Turn">&rarr;</button>';
    html += '<button class="ct-ctrl-btn" id="ct-next-round" title="Next Round">&#8635;</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderDetailPanel() {
    var html = '<div class="ct-detail-panel">';

    var selectedId = combatState.selectedId;
    if (!selectedId && combatState.turnOrder.length > 0) {
      selectedId = combatState.turnOrder[combatState.currentTurnIndex] ? combatState.turnOrder[combatState.currentTurnIndex].id : null;
    }

    if (!selectedId) {
      html += '<div class="ct-detail-empty">Select a combatant from the initiative rail</div>';
      html += '</div>';
      return html;
    }

    var npc = combatState.combatants.find(function (n) { return n.id === selectedId; });
    var pc = combatState.pcSlots.find(function (p) { return p.id === selectedId; });

    if (npc) {
      html += renderNpcDetail(npc);
    } else if (pc) {
      html += renderPcDetail(pc);
    } else {
      html += '<div class="ct-detail-empty">Combatant not found</div>';
    }

    html += '</div>';
    return html;
  }

  function renderNpcDetail(npc) {
    var html = '';
    var threatColor = npc.threat === 'minion' ? '#6b7280' : npc.threat === 'boss' ? '#ef4444' : 'var(--color-accent-primary)';
    var presMod = getPresenceEffect(npc.conditions);
    var arenaMods = getNpcArenaMods(npc);

    html += '<div class="ct-detail-header">';
    html += '<div class="ct-detail-name">' + esc(npc.name) + '</div>';
    html += '<span class="ct-detail-threat" style="color:' + threatColor + ';">' + esc(npc.threat).toUpperCase() + '</span>';
    if (npc.tier != null) html += '<span class="ct-detail-tier">T' + npc.tier + '</span>';
    if (npc.role) html += '<span class="ct-detail-role">' + esc(npc.role) + '</span>';
    if (npc.surprised) html += '<span class="ct-rail-tag ct-tag-surprised" style="margin-left:0.3rem;">SURPRISED</span>';
    html += '</div>';

    function statCell(label, val) {
      return '<div class="ct-stat-cell"><span class="ct-stat-label">' + label + '</span><span class="ct-stat-val">' + val + '</span></div>';
    }
    function arenaCell(label, base, mod) {
      var eff = Math.max(0, base + mod);
      var cls = mod < 0 ? ' ct-pres-debuff' : mod > 0 ? ' ct-pres-buff' : '';
      var display = mod !== 0 ? eff + ' <small style="opacity:0.5;">(' + base + ')</small>' : '' + eff;
      return '<div class="ct-stat-cell"><span class="ct-stat-label">' + label + '</span><span class="ct-stat-val' + cls + '">' + display + '</span></div>';
    }
    html += '<div class="ct-detail-stats">';
    html += statCell('Init', npc.initiative);
    html += statCell('Def', npc.defense);
    html += statCell('Eva', npc.evasion);
    html += statCell('Pwr', npc.power);
    html += statCell('Res', npc.resist);
    html += statCell('Act', npc.actions || 1);
    html += '</div>';

    if (npc.arenas && Object.keys(npc.arenas).length) {
      var ARENA_LABELS = {physique:'PHY',reflex:'REF',grit:'GRT',wits:'WIT',presence:'PRS'};
      var arenaKeys = ['physique','reflex','grit','wits','presence'];
      var hasArenaMod = arenaKeys.some(function (a) { return arenaMods[a] !== 0; });
      if (hasArenaMod || arenaKeys.some(function (a) { return npc.arenas[a]; })) {
        html += '<div class="ct-detail-stats" style="margin-bottom:0.3rem;">';
        arenaKeys.forEach(function (a) {
          var base = npc.arenas[a] || 0;
          if (base || arenaMods[a]) {
            html += arenaCell(ARENA_LABELS[a], base, arenaMods[a]);
          }
        });
        html += '</div>';
      }
    }

    var presBase = npc.arenas.presence || 1;
    var presEff = Math.max(0, presBase + presMod);
    html += '<div class="ct-presence-row">';
    html += '<span class="ct-presence-label">Presence</span>';
    html += '<span class="ct-presence-val' + (presMod < 0 ? ' ct-pres-debuff' : presMod > 0 ? ' ct-pres-buff' : '') + '">' + presEff + '</span>';
    if (presMod !== 0) html += '<span class="ct-presence-mod">(' + (presMod > 0 ? '+' : '') + presMod + ')</span>';
    html += '<span class="ct-presence-hint">PCs roll against this</span>';
    html += '</div>';

    var hpPercent = npc.vitalityMax > 0 ? Math.max(0, Math.min(100, (npc.vitalityCurrent / npc.vitalityMax) * 100)) : 0;
    var hpColor = hpPercent > 60 ? '#22c55e' : hpPercent > 30 ? '#eab308' : '#ef4444';
    html += '<div class="ct-vitality-row">';
    html += '<button class="ct-vit-btn ct-vit-minus" data-npc-id="' + esc(npc.id) + '" data-delta="-1">&minus;</button>';
    html += '<div class="ct-vitality-bar-wrap">';
    html += '<div class="ct-vitality-bar" style="width:' + hpPercent + '%;background:' + hpColor + ';"></div>';
    html += '<span class="ct-vitality-text">' + npc.vitalityCurrent + ' / ' + npc.vitalityMax + '</span>';
    html += '</div>';
    html += '<button class="ct-vit-btn ct-vit-plus" data-npc-id="' + esc(npc.id) + '" data-delta="1">+</button>';
    html += '</div>';

    if (npc.damageTiers) {
      var dt = npc.damageTiers;
      html += '<div class="ct-dmg-bar">';
      html += '<span class="ct-dmg-label">' + esc(dt.label) + '</span>';
      html += '<span class="ct-dmg-tier">F<strong>' + dt.fleeting + '</strong></span>';
      html += '<span class="ct-dmg-tier">M<strong>' + dt.masterful + '</strong></span>';
      html += '<span class="ct-dmg-tier">L<strong>' + dt.legendary + '</strong></span>';
      html += '</div>';
    }

    html += '<div class="ct-conditions-section">';
    html += '<div class="ct-section-label">Conditions</div>';
    html += '<div class="ct-active-conditions">';
    npc.conditions.forEach(function (cid) {
      var def = getEffectDef(cid);
      var label = def ? def.label : cid;
      var color = condColor(cid);
      var desc = def ? def.description : '';
      html += '<span class="ct-condition-chip" style="background:' + color + '22;color:' + color + ';border-color:' + color + '44;" title="' + esc(desc) + '" data-npc-id="' + esc(npc.id) + '" data-cond="' + esc(cid) + '">' + esc(label) + ' &times;</span>';
    });
    html += '</div>';
    html += '<button class="ct-add-condition-btn" data-npc-id="' + esc(npc.id) + '">+ Condition</button>';
    html += '</div>';

    if (npc.roleKit) {
      html += renderRoleKit(npc.roleKit);
    }

    return html;
  }

  function renderPcDetail(pc) {
    var html = '';

    html += '<div class="ct-detail-header ct-detail-header-pc">';
    html += '<div class="ct-detail-name">' + esc(pc.name) + '</div>';
    html += '<span class="ct-detail-type-badge">PC</span>';
    if (pc.species) html += '<span class="ct-detail-species">' + esc(pc.species) + '</span>';
    if (pc.archetype) html += '<span class="ct-detail-archetype">' + esc(pc.archetype) + '</span>';
    html += '</div>';

    if (pc.surprised) {
      html += '<div class="ct-surprised-banner">SURPRISED &mdash; [Disoriented] + [Exposed] until end of first turn</div>';
    }
    if (pc.mastery) {
      html += '<div class="ct-mastery-banner">MASTERY &mdash; Designate one enemy as surprised';
      if (!pc.masteryUsed) {
        combatState.combatants.forEach(function (npc) {
          if (!npc.surprised) {
            html += ' <button class="ct-ctrl-btn" style="display:inline;padding:0.1rem 0.4rem;margin-left:0.3rem;font-size:0.55rem;" data-mastery-target="' + esc(npc.id) + '">' + esc(npc.name) + '</button>';
          }
        });
      } else {
        html += ' <span style="opacity:0.6;">(used)</span>';
      }
      html += '</div>';
    }

    if (pc.vitality != null) {
      html += '<div class="ct-pc-vitality">Vitality: <strong>' + pc.vitality + '</strong></div>';
    }

    var ARENA_GROUPS = [
      { id: 'physique', label: 'PHY', discs: ['athletics','brawl','endure','melee','heavy_weapons'] },
      { id: 'reflex', label: 'REF', discs: ['evasion','piloting','ranged','skulduggery','stealth'] },
      { id: 'grit', label: 'GRT', discs: ['beast_handling','intimidate','resolve','survival','control_spark'] },
      { id: 'wits', label: 'WIT', discs: ['investigation','medicine','tactics','tech','sense_spark'] },
      { id: 'presence', label: 'PRS', discs: ['charm','deception','insight','persuasion','alter_spark'] },
    ];

    if (pc.arenas && Object.keys(pc.arenas).length) {
      html += '<div class="ct-pc-arenas">';
      ARENA_GROUPS.forEach(function (ag) {
        var baseDie = pc.arenas[ag.id] || '';
        var effDie = getPcEffectiveDie(baseDie, pc.conditions);
        var dieChanged = effDie !== baseDie && baseDie;
        html += '<div class="ct-pc-arena-group">';
        html += '<div class="ct-pc-arena-header"><span class="ct-arena-lbl">' + ag.label + '</span>';
        if (baseDie) {
          if (dieChanged) {
            html += ' <span class="ct-arena-die" style="color:' + (effDie < baseDie ? '#ef4444' : '#22c55e') + ';">' + esc(effDie) + '</span>';
            html += ' <small style="opacity:0.4;text-decoration:line-through;">' + esc(baseDie) + '</small>';
          } else {
            html += ' <span class="ct-arena-die">' + esc(baseDie) + '</span>';
          }
        }
        html += '</div>';

        if (pc.disciplines) {
          ag.discs.forEach(function (dId) {
            var disc = pc.disciplines[dId];
            if (!disc || !disc.die) return;
            var dieNum = parseInt((disc.die || '').replace(/[^\d]/g, ''), 10);
            if (dieNum <= 6) return;
            var effDiscDie = getPcEffectiveDie(disc.die, pc.conditions);
            var discChanged = effDiscDie !== disc.die;
            var label = dId.replace(/_/g, ' ');
            html += '<div class="ct-pc-disc"><span>' + esc(label) + '</span> ';
            if (discChanged) {
              html += '<span class="ct-disc-die" style="color:' + (effDiscDie < disc.die ? '#ef4444' : '#22c55e') + ';">' + esc(effDiscDie) + '</span>';
            } else {
              html += '<span class="ct-disc-die">' + esc(disc.die) + '</span>';
            }
            if (disc.favored) html += ' <span class="ct-disc-fav">\u2605</span>';
            html += '</div>';
          });
        }

        html += '</div>';
      });
      html += '</div>';
    }

    if (pc.vocations && pc.vocations.length) {
      html += '<div class="ct-pc-vocations">';
      pc.vocations.forEach(function (v) {
        html += '<span class="ct-voc-badge">' + esc(v.name || v.kitId || '') + ' T' + (v.tier || 1) + '</span>';
      });
      html += '</div>';
    }

    html += '<div class="ct-conditions-section">';
    html += '<div class="ct-section-label">Conditions</div>';
    html += '<div class="ct-active-conditions">';
    if (pc.conditions && pc.conditions.length) {
      pc.conditions.forEach(function (cid) {
        var def = getEffectDef(cid);
        var label = def ? def.label : cid;
        var color = condColor(cid);
        html += '<span class="ct-condition-pip" style="color:' + color + ';">' + esc(label) + '</span>';
      });
    }
    html += '</div>';
    html += '<button class="ct-push-condition-btn" data-pc-id="' + esc(pc.id) + '">+ Push Condition</button>';
    html += '</div>';

    return html;
  }

  function renderRoleKit(rk) {
    var html = '<div class="ct-rolekit">';
    html += '<div class="ct-section-label">Role Kit</div>';

    if (rk.passive) {
      html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-passive">Passive</span> <strong>' + esc(rk.passive.name) + '</strong> &mdash; ' + esc(rk.passive.description) + '</div>';
    }
    if (rk.actions && rk.actions.length) {
      rk.actions.forEach(function (a) {
        html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-action">Action</span> <strong>' + esc(a.name) + '</strong>';
        if (a.attackPower != null) html += ' <span class="ct-rk-power">P' + a.attackPower + '</span>';
        if (a.arena) html += ' <span class="ct-rk-arena">(' + esc(a.arena) + ')</span>';
        html += ' &mdash; ' + esc(a.description) + '</div>';
      });
    }
    if (rk.maneuver) {
      html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-maneuver">Maneuver</span> <strong>' + esc(rk.maneuver.name) + '</strong> &mdash; ' + esc(rk.maneuver.description) + '</div>';
    }
    if (rk.gambit) {
      html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-gambit">Gambit</span> <strong>' + esc(rk.gambit.name) + '</strong> <span class="ct-rk-cost">(1 Pwr)</span> &mdash; ' + esc(rk.gambit.description) + '</div>';
    }
    if (rk.exploit) {
      html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-exploit">Exploit</span> <strong>' + esc(rk.exploit.name) + '</strong> &mdash; ' + esc(rk.exploit.description) + '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderTacticalMap() {
    if (!combatState || !combatState.tacticalMap) return '';
    var tm = combatState.tacticalMap;
    var cols = tm.gridColumns || 4;
    var rows = tm.gridRows || 3;
    var colLabels = tm.columnLabels || ['A', 'B', 'C', 'D'];
    var rowLabels = tm.rowLabels || ['1', '2', '3'];

    var COVER_LABELS = { 'none': 'No Cover', 'light': 'Light', 'hard': 'Hard', 'full': 'Full' };
    var LIGHTING_ICONS = { 'normal': '&#9728;', 'dim': '&#9789;', 'shadow': '&#9790;' };

    var zoneMap = {};
    tm.zones.forEach(function (z) { zoneMap[z.id] = z; });

    var html = '<div class="ct-tactical-map">';
    html += '<div class="ct-section-label">Tactical Map &mdash; ' + esc(tm.zoneSize || '15ft') + ' zones</div>';
    html += '<div class="ct-map-frame">';
    html += '<div class="ct-map-grid" style="grid-template-columns:repeat(' + cols + ',1fr);">';

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var zid = colLabels[c] + rowLabels[r];
        var zone = zoneMap[zid];
        if (!zone) {
          html += '<div class="ct-zone ct-zone-empty"></div>';
          continue;
        }
        var passable = zone.passable !== false;
        var lightIcon = LIGHTING_ICONS[zone.lighting] || '';
        var coverLabel = COVER_LABELS[zone.cover] || 'None';
        var selected = combatState.selectedToken ? ' ct-zone-targetable' : '';
        var coverClass = ' ct-zone-cover-' + (zone.cover || 'none');
        var lightClass = '';
        if (zone.lighting === 'dim') lightClass = ' ct-zone-dim';
        else if (zone.lighting === 'shadow') lightClass = ' ct-zone-shadow';

        html += '<div class="ct-zone' + (passable ? '' : ' ct-zone-impassable') + coverClass + lightClass + selected + '" data-zone-id="' + zid + '">';
        html += '<div class="ct-zone-header">';
        html += '<span class="ct-zone-id">' + zid + '</span>';
        html += '<span class="ct-zone-light" title="' + esc(zone.lighting || 'Normal') + '">' + lightIcon + '</span>';
        html += '</div>';
        html += '<div class="ct-zone-label">' + esc(zone.label) + '</div>';
        html += '<div class="ct-zone-cover">' + esc(coverLabel) + '</div>';

        var tokens = getTokensInZone(zid);
        if (tokens.length) {
          html += '<div class="ct-zone-tokens">';
          tokens.forEach(function (t) {
            var isSelected = combatState.selectedToken === t.id;
            var tokenClass = t.type === 'pc' ? 'ct-token-pc' : 'ct-token-npc';
            html += '<span class="ct-token ' + tokenClass + (isSelected ? ' ct-token-selected' : '') + '" data-token-id="' + esc(t.id) + '" title="' + esc(t.name) + '">' + esc(t.shortName) + '</span>';
          });
          html += '</div>';
        }

        html += '</div>';
      }
    }

    html += '</div>';
    html += '</div>';

    html += '<div class="ct-map-legend">';
    html += '<span class="ct-legend-item"><span class="ct-legend-swatch" style="border-color:rgba(234,179,8,0.6);background:rgba(234,179,8,0.15);"></span>Light Cover</span>';
    html += '<span class="ct-legend-item"><span class="ct-legend-swatch" style="border-color:rgba(59,130,246,0.7);background:rgba(59,130,246,0.2);"></span>Hard Cover</span>';
    html += '<span class="ct-legend-item"><span class="ct-legend-swatch" style="border-color:rgba(34,197,94,0.6);background:rgba(34,197,94,0.2);"></span>Full Cover</span>';
    html += '<span class="ct-legend-item"><span class="ct-legend-swatch" style="border-color:rgba(100,100,100,0.4);background:repeating-linear-gradient(45deg,rgba(100,100,100,0.2),rgba(100,100,100,0.2) 2px,transparent 2px,transparent 4px);"></span>Impassable</span>';
    html += '</div>';

    if (tm.gmTacticalNotes) {
      html += '<div class="ct-map-notes">';
      html += '<details><summary class="ct-rolekit-summary">GM Tactical Notes</summary>';
      html += '<div class="ct-rk-body" style="font-size:0.7rem;color:var(--color-text-secondary);white-space:pre-line;">' + esc(tm.gmTacticalNotes) + '</div>';
      html += '</details></div>';
    }

    html += '</div>';
    return html;
  }

  function getTokensInZone(zoneId) {
    if (!combatState) return [];
    var tokens = [];
    Object.keys(combatState.tokenPositions).forEach(function (tokId) {
      if (combatState.tokenPositions[tokId] === zoneId) {
        var shortName = tokId;
        var fullName = tokId;
        var type = 'pc';
        if (tokId === 'PCs') {
          shortName = 'PCs';
          fullName = 'Player Characters';
        } else {
          var npc = combatState.combatants.find(function (n) { return n.id === tokId; });
          if (npc) {
            shortName = npc.name.length > 8 ? npc.name.substring(0, 7) + '.' : npc.name;
            fullName = npc.name;
            type = 'npc';
          }
        }
        tokens.push({ id: tokId, shortName: shortName, name: fullName, type: type });
      }
    });
    return tokens;
  }

  function showConditionPalette(anchorEl, npcId) {
    var existing = document.querySelector('.ct-condition-palette');
    if (existing) existing.remove();

    var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
    if (!npc) return;

    var palette = document.createElement('div');
    palette.className = 'ct-condition-palette';

    var html = '<div class="ct-palette-title">Apply Condition</div>';
    NPC_CONDITIONS.forEach(function (condId) {
      var def = getEffectDef(condId);
      if (!def) return;
      var active = npc.conditions.indexOf(condId) !== -1;
      var color = condColor(condId);
      var needsArena = (condId === 'weakened' || condId === 'empowered');
      html += '<div class="ct-palette-item' + (active ? ' ct-palette-active' : '') + '" data-cond="' + esc(condId) + '" data-npc-id="' + esc(npcId) + '"' + (needsArena ? ' data-needs-arena="1"' : '') + ' title="' + esc(def.description) + '">';
      html += '<span class="ct-palette-dot" style="background:' + color + ';"></span>';
      html += '<span class="ct-palette-name">' + esc(def.label) + '</span>';
      html += '<span class="ct-palette-effect">' + esc(def.description.split('.')[0]) + '</span>';
      html += '</div>';
    });
    palette.innerHTML = html;

    anchorEl.parentElement.appendChild(palette);

    palette.querySelectorAll('.ct-palette-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var condId = item.dataset.cond;
        var targetNpcId = item.dataset.npcId;
        var targetNpc = combatState.combatants.find(function (n) { return n.id === targetNpcId; });
        if (!targetNpc) return;

        if (item.dataset.needsArena === '1') {
          showArenaPicker(item, targetNpc, condId);
          return;
        }

        var idx = targetNpc.conditions.indexOf(condId);
        if (idx === -1) {
          targetNpc.conditions.push(condId);
        } else {
          targetNpc.conditions.splice(idx, 1);
        }
        palette.remove();
        renderCombatTracker();
      });
    });

    setTimeout(function () {
      function closePalette(e) {
        if (!palette.contains(e.target)) {
          palette.remove();
          document.removeEventListener('click', closePalette);
        }
      }
      document.addEventListener('click', closePalette);
    }, 10);
  }

  function showArenaPicker(anchorItem, npc, condId) {
    var existing = document.querySelector('.ct-arena-picker');
    if (existing) existing.remove();

    var picker = document.createElement('div');
    picker.className = 'ct-arena-picker';
    var arenas = ['physique', 'reflex', 'grit', 'wits', 'presence'];
    var labels = { physique: 'Physique', reflex: 'Reflex', grit: 'Grit', wits: 'Wits', presence: 'Presence' };

    var def = getEffectDef(condId);
    picker.innerHTML = '<div class="ct-picker-title">Target Arena for ' + (def ? def.label : condId) + '</div>' +
      arenas.map(function (a) {
        return '<div class="ct-picker-option" data-arena="' + a + '">' + labels[a] + '</div>';
      }).join('');

    anchorItem.appendChild(picker);

    picker.querySelectorAll('.ct-picker-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        var arena = opt.dataset.arena;
        var idx = npc.conditions.indexOf(condId);
        if (idx === -1) {
          npc.conditions.push(condId);
        }
        if (!npc.conditionArenas) npc.conditionArenas = {};
        npc.conditionArenas[condId] = arena;
        picker.remove();
        var palette = document.querySelector('.ct-condition-palette');
        if (palette) palette.remove();
        renderCombatTracker();
      });
    });
  }

  function showPcConditionPalette(anchorEl, pcId) {
    var existing = document.querySelector('.ct-condition-palette');
    if (existing) existing.remove();

    var pc = combatState.pcSlots.find(function (p) { return p.id === pcId; });
    if (!pc) return;

    var palette = document.createElement('div');
    palette.className = 'ct-condition-palette';

    var pcConditions = ['disoriented', 'rattled', 'stunned', 'exposed', 'shaken',
      'weakened', 'empowered', 'optimized', 'prone', 'restrained', 'slowed',
      'blinded', 'bleeding', 'hazard', 'incapacitated', 'suppressed', 'marked'];

    var html = '<div class="ct-palette-title">Push Condition to PC</div>';
    pcConditions.forEach(function (condId) {
      var def = getEffectDef(condId);
      if (!def) return;
      var color = condColor(condId);
      html += '<div class="ct-palette-item" data-cond="' + esc(condId) + '" data-pc-id="' + esc(pcId) + '" title="' + esc(def.description) + '">';
      html += '<span class="ct-palette-dot" style="background:' + color + ';"></span>';
      html += '<span class="ct-palette-name">' + esc(def.label) + '</span>';
      html += '<span class="ct-palette-effect">' + esc(def.description.split('.')[0]) + '</span>';
      html += '</div>';
    });
    palette.innerHTML = html;

    anchorEl.parentElement.appendChild(palette);

    palette.querySelectorAll('.ct-palette-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var condId = item.dataset.cond;
        var targetPcId = item.dataset.pcId;
        var def = getEffectDef(condId);
        if (!def) return;

        if (def.targetMode === 'arena_only') {
          showPcArenaPicker(item, targetPcId, condId, palette);
          return;
        }

        var target = 'universal';
        if (def.targetMode === 'fixed_arenas' || def.targetMode === 'fixed') target = 'fixed';

        var sock = getSocket();
        if (sock) {
          sock.emit('condition:apply', {
            characterId: targetPcId,
            conditionId: condId,
            target: target,
            duration: def.defaultDuration || 'tactical'
          });
        }

        palette.remove();
      });
    });

    setTimeout(function () {
      function closePalette(e) {
        if (!palette.contains(e.target)) {
          palette.remove();
          document.removeEventListener('click', closePalette);
        }
      }
      document.addEventListener('click', closePalette);
    }, 10);
  }

  function showPcArenaPicker(anchorItem, pcId, condId, palette) {
    var existing = document.querySelector('.ct-arena-picker');
    if (existing) existing.remove();

    var picker = document.createElement('div');
    picker.className = 'ct-arena-picker';
    var arenas = ['physique', 'reflex', 'grit', 'wits', 'presence'];
    var labels = { physique: 'Physique', reflex: 'Reflex', grit: 'Grit', wits: 'Wits', presence: 'Presence' };

    var def = getEffectDef(condId);
    picker.innerHTML = '<div class="ct-picker-title">Arena for ' + (def ? def.label : condId) + '</div>' +
      arenas.map(function (a) {
        return '<div class="ct-picker-option" data-arena="' + a + '">' + labels[a] + '</div>';
      }).join('');

    anchorItem.appendChild(picker);

    picker.querySelectorAll('.ct-picker-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        var arena = opt.dataset.arena;
        var sock = getSocket();
        if (sock) {
          sock.emit('condition:apply', {
            characterId: pcId,
            conditionId: condId,
            target: 'arena:' + arena,
            duration: (def && def.defaultDuration) || 'tactical'
          });
        }
        picker.remove();
        if (palette) palette.remove();
      });
    });
  }

  function attachCombatEvents(container) {
    var endBtn = container.querySelector('#ct-end-encounter');
    if (endBtn) endBtn.addEventListener('click', endEncounter);

    var jbBtn = container.querySelector('#ct-trigger-jb');
    if (jbBtn) jbBtn.addEventListener('click', triggerJoinBattle);

    container.querySelectorAll('.ct-rail-entry').forEach(function (entry) {
      entry.addEventListener('click', function () {
        var id = entry.dataset.selectId;
        combatState.selectedId = combatState.selectedId === id ? null : id;
        renderCombatTracker();
      });
    });

    var nextTurnBtn = container.querySelector('#ct-next-turn');
    if (nextTurnBtn) nextTurnBtn.addEventListener('click', function () {
      var order = getTurnOrder();
      if (order.length === 0) return;
      combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % order.length;
      if (combatState.currentTurnIndex === 0) combatState.round++;
      combatState.selectedId = null;
      renderCombatTracker();
    });

    var prevTurnBtn = container.querySelector('#ct-prev-turn');
    if (prevTurnBtn) prevTurnBtn.addEventListener('click', function () {
      var order = getTurnOrder();
      if (order.length === 0) return;
      if (combatState.currentTurnIndex === 0) {
        if (combatState.round > 1) {
          combatState.round--;
          combatState.currentTurnIndex = order.length - 1;
        }
      } else {
        combatState.currentTurnIndex--;
      }
      combatState.selectedId = null;
      renderCombatTracker();
    });

    var nextRoundBtn = container.querySelector('#ct-next-round');
    if (nextRoundBtn) nextRoundBtn.addEventListener('click', function () {
      combatState.round++;
      combatState.currentTurnIndex = 0;
      combatState.selectedId = null;
      renderCombatTracker();
    });

    container.querySelectorAll('.ct-vit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var npcId = btn.dataset.npcId;
        var delta = parseInt(btn.dataset.delta, 10);
        var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
        if (npc) {
          npc.vitalityCurrent = Math.max(0, Math.min(npc.vitalityMax, npc.vitalityCurrent + delta));
          renderCombatTracker();
        }
      });
    });

    container.querySelectorAll('.ct-condition-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var npcId = chip.dataset.npcId;
        var condId = chip.dataset.cond;
        var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
        if (npc) {
          npc.conditions = npc.conditions.filter(function (c) { return c !== condId; });
          renderCombatTracker();
        }
      });
    });

    container.querySelectorAll('.ct-add-condition-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showConditionPalette(btn, btn.dataset.npcId);
      });
    });

    container.querySelectorAll('.ct-push-condition-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPcConditionPalette(btn, btn.dataset.pcId);
      });
    });

    container.querySelectorAll('[data-mastery-target]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var npcId = btn.dataset.masteryTarget;
        designateNpcSurprised(npcId);
        var pcId = btn.closest('.ct-detail-panel') ? combatState.selectedId : null;
        if (pcId) {
          var pc = combatState.pcSlots.find(function (p) { return p.id === pcId; });
          if (pc) pc.masteryUsed = true;
        }
        renderCombatTracker();
      });
    });

    container.querySelectorAll('.ct-token').forEach(function (tok) {
      tok.addEventListener('click', function (e) {
        e.stopPropagation();
        combatState.selectedToken = combatState.selectedToken === tok.dataset.tokenId ? null : tok.dataset.tokenId;
        renderCombatTracker();
      });
    });

    container.querySelectorAll('.ct-zone').forEach(function (zone) {
      zone.addEventListener('click', function () {
        if (combatState.selectedToken && zone.dataset.zoneId && !zone.classList.contains('ct-zone-impassable')) {
          combatState.tokenPositions[combatState.selectedToken] = zone.dataset.zoneId;
          combatState.selectedToken = null;
          renderCombatTracker();
        }
      });
    });
  }

  window.CombatTracker = {
    start: startEncounter,
    end: endEncounter,
    isActive: function () { return combatState !== null; }
  };
}());

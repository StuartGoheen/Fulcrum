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
    'marked', 'guarded', 'cover', 'stimmed',
    'darkside_resonance', 'beacon'
  ];

  var ALL_CONDITIONS = [
    'surprised', 'disoriented', 'rattled', 'stunned', 'exposed', 'shaken',
    'weakened', 'empowered', 'optimized', 'prone', 'restrained', 'slowed',
    'blinded', 'bleeding', 'hazard', 'incapacitated', 'suppressed', 'marked',
    'pinned', 'guarded', 'cover', 'stimmed',
    'darkside_resonance', 'beacon'
  ];

  var _conditionPanelState = {
    targetId: null,
    targetType: null,
    sourceLabel: null,
    selectedCondition: null
  };

  function npcCondIds(npc) {
    if (!npc || !npc.conditions) return [];
    return npc.conditions.map(function (c) { return typeof c === 'object' ? c.id : c; });
  }

  function npcHasCond(npc, condId) {
    return npcCondIds(npc).indexOf(condId) !== -1;
  }

  function npcAddCond(npc, condId, duration, arena) {
    if (!npc) return;
    if (!npc.conditions) npc.conditions = [];
    var def = getEffectDef(condId);
    var dur = duration || (def && def.defaultDuration) || 'tactical';
    var entry = { id: condId, duration: dur };
    if (arena) entry.arena = arena;
    var existing = npc.conditions.findIndex(function (c) {
      return (typeof c === 'object' ? c.id : c) === condId;
    });
    if (existing !== -1) {
      npc.conditions[existing] = entry;
    } else {
      npc.conditions.push(entry);
    }
  }

  function npcRemoveCond(npc, condId) {
    if (!npc) return;
    npc.conditions = npc.conditions.filter(function (c) {
      return (typeof c === 'object' ? c.id : c) !== condId;
    });
  }

  function migrateNpcConditions(npc) {
    if (!npc) return;
    if (!npc.conditions) npc.conditions = [];
    npc.conditions = npc.conditions.map(function (c) {
      if (typeof c === 'string') {
        var def = getEffectDef(c);
        var entry = { id: c, duration: (def && def.defaultDuration) || 'tactical' };
        if (npc.conditionArenas && npc.conditionArenas[c]) {
          entry.arena = npc.conditionArenas[c];
        }
        return entry;
      }
      return c;
    });
    if (npc.conditionArenas) {
      npc.conditions.forEach(function (c) {
        if (typeof c === 'object' && !c.arena && npc.conditionArenas[c.id]) {
          c.arena = npc.conditionArenas[c.id];
        }
      });
    }
  }

  var combatState = null;
  var _socket = null;
  var _socketHandlers = [];
  var _placementNpcId = null;

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
      guarded: '#14b8a6', cover: '#3b82f6', stimmed: '#10b981',
      darkside_resonance: '#7c3aed', beacon: '#f59e0b'
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

  function _fetchAndFillPcProfile(pc) {
    fetch('/api/campaign/party')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var party = data.party || [];
        var match = party.find(function (p) { return String(p.id) === String(pc.id); });
        if (match) {
          pc.name = match.name || pc.name;
          pc.species = match.species || '';
          pc.archetype = match.archetype || '';
          pc.vitality = match.vitality != null ? match.vitality : pc.vitality;
          pc.arenas = match.arenas || {};
          pc.disciplines = match.disciplines || {};
          pc.vocations = match.vocations || [];
          pc.vocationAbilities = match.vocationAbilities || [];
          pc.gear = match.gear || [];
          pc.destiny = match.destiny || null;
          pc.marks = match.marks != null ? match.marks : 0;
          pc.connected = match.connected;
          if (typeof renderCombatTracker === 'function') renderCombatTracker();
          syncStateToServer();
        }
      })
      .catch(function () {});
  }

  function _getPcDefaultZone() {
    if (!combatState) return null;
    var tp = combatState.tokenPositions;
    for (var key in tp) {
      if (key === 'PCs') return tp[key];
    }
    var slots = combatState.pcSlots || [];
    for (var i = 0; i < slots.length; i++) {
      if (tp[slots[i].id]) return tp[slots[i].id];
    }
    var tm = combatState.tacticalMap;
    if (tm && tm.gmStartingPositions && tm.gmStartingPositions['PCs']) {
      return tm.gmStartingPositions['PCs'];
    }
    if (tm && tm.startingPositions) {
      var sp = tm.startingPositions;
      for (var j = 0; j < sp.length; j++) {
        if (sp[j].name === 'PCs') return sp[j].zone;
      }
    }
    return null;
  }

  function startEncounter(encounter, scene, npcs, partyData, socket) {
    if (socket) _socket = socket;
    var highestTier = 0;
    var npcEntries = [];
    var npcIdCounter = 0;

    npcs.forEach(function (n) {
      if (!n.threatBuild) return;
      var tb = n.threatBuild;
      var comp = tb.computed || {};
      var tier = tb.tier || 0;
      if (tier > highestTier) highestTier = tier;
      var count = n.count || 1;
      var baseName = n.name || n.type || ('NPC');
      for (var ci = 0; ci < count; ci++) {
        npcIdCounter++;
        npcEntries.push({
          id: 'npc_' + npcIdCounter,
          name: baseName,
          type: 'npc',
          disposition: 'enemy',
          threat: tb.classification || 'standard',
          tier: tier,
          role: tb.role || '',
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
          roleKit: tb.roleKit || null,
          computedAttacks: tb.computedAttacks || [],
          arenas: tb.arenas || {},
          damageTiers: comp.damageTiers || null,
          zone: null,
          npcData: n
        });
      }
    });

    var nameCounts = {};
    npcEntries.forEach(function (e) {
      var base = e.name.replace(/ #\d+$/, '');
      nameCounts[base] = (nameCounts[base] || 0) + 1;
    });
    var nameIndices = {};
    npcEntries.forEach(function (e) {
      var base = e.name.replace(/ #\d+$/, '');
      if (nameCounts[base] > 1) {
        nameIndices[base] = (nameIndices[base] || 0) + 1;
        e.name = base + ' #' + nameIndices[base];
      }
    });

    var gmPositions = (scene.tacticalMap && scene.tacticalMap.gmStartingPositions) || {};
    var authoredPositions = {};
    if (scene.tacticalMap && scene.tacticalMap.startingPositions) {
      scene.tacticalMap.startingPositions.forEach(function (sp) {
        authoredPositions[sp.who] = sp.zone;
      });
    }

    npcEntries.forEach(function (npc, idx) {
      if (gmPositions['npc_' + idx] != null) {
        npc.zone = gmPositions['npc_' + idx];
      }
    });

    var spKeys = Object.keys(authoredPositions);
    var usedSPKeys = {};
    npcEntries.forEach(function (npc) {
      if (npc.zone) {
        for (var k = 0; k < spKeys.length; k++) {
          if (authoredPositions[spKeys[k]] === npc.zone) { usedSPKeys[spKeys[k]] = true; break; }
        }
      }
    });

    function npcMatchesKey(npcName, key) {
      var npcBase = npcName.replace(/ #\d+$/, '').toLowerCase();
      var npcNum = (npcName.match(/ #(\d+)$/) || [])[1] || null;
      var keyBase = key.replace(/ #\d+$/, '').toLowerCase();
      var keyNum = (key.match(/ #(\d+)$/) || [])[1] || null;
      if (npcNum && keyNum) {
        if (npcNum !== keyNum) return false;
        if (keyBase === npcBase || npcBase.indexOf(keyBase) !== -1 || keyBase.indexOf(npcBase) !== -1) return true;
        var kw = keyBase.split(/\s+/);
        var nw = npcBase.split(/\s+/);
        return nw.some(function (w) { return w.length > 2 && kw.some(function (k2) { return k2.indexOf(w) !== -1 || w.indexOf(k2) !== -1; }); });
      }
      if (keyBase === npcBase || npcBase.indexOf(keyBase) !== -1 || keyBase.indexOf(npcBase) !== -1) return true;
      var kwf = keyBase.split(/\s+/);
      var nwf = npcBase.split(/\s+/);
      return nwf.some(function (w) { return w.length > 2 && kwf.some(function (k2) { return k2.indexOf(w) !== -1 || w.indexOf(k2) !== -1; }); });
    }

    npcEntries.forEach(function (npc) {
      if (npc.zone) return;
      var npcNum = (npc.name.match(/ #(\d+)$/) || [])[1] || null;
      if (!npcNum) return;
      var bestKey = null;
      for (var k = 0; k < spKeys.length; k++) {
        var key = spKeys[k];
        if (key === 'PCs' || key === 'Patrons' || usedSPKeys[key]) continue;
        if (npcMatchesKey(npc.name, key)) { bestKey = key; break; }
      }
      if (bestKey) {
        npc.zone = authoredPositions[bestKey];
        usedSPKeys[bestKey] = true;
      }
    });
    npcEntries.forEach(function (npc) {
      if (npc.zone) return;
      var bestKey = null;
      for (var k = 0; k < spKeys.length; k++) {
        var key = spKeys[k];
        if (key === 'PCs' || key === 'Patrons' || usedSPKeys[key]) continue;
        if (npcMatchesKey(npc.name, key)) { bestKey = key; break; }
      }
      if (bestKey) {
        npc.zone = authoredPositions[bestKey];
        usedSPKeys[bestKey] = true;
      }
    });

    var pcTokenZone = gmPositions['PCs'] || authoredPositions['PCs'] || null;

    var pcSlots = [];
    if (partyData && partyData.length) {
      partyData.forEach(function (pc) {
        pcSlots.push({
          id: String(pc.id || ('pc_' + pc.name.toLowerCase().replace(/\s+/g, '_'))),
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

    if (pcSlots.length > 0 && pcTokenZone) {
      pcSlots.forEach(function (pc) {
        combatState.tokenPositions[pc.id] = pcTokenZone;
      });
    } else if (pcTokenZone) {
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
        combatState.pcResponses[String(data.characterId)] = data;
        var pc = combatState.pcSlots.find(function (p) { return p.id === String(data.characterId); });
        if (!pc) {
          pc = {
            id: String(data.characterId),
            name: data.name || 'Unknown',
            type: 'pc',
            initiative: 0,
            conditions: [],
            vocations: [],
            species: '',
            archetype: '',
            connected: true
          };
          combatState.pcSlots.push(pc);
          var defaultZone = _getPcDefaultZone();
          if (defaultZone) {
            combatState.tokenPositions[pc.id] = defaultZone;
          }
          _fetchAndFillPcProfile(pc);
        }
        pc.initiative = data.initiative;
        pc.surprised = data.surprised;
        pc.mastery = data.mastery;
        pc.controlResult = data.controlResult;
        rebuildTurnOrder();
        renderCombatTracker();
        syncStateToServer();
      }

      function onAllJoined() {
        if (!combatState) return;
        rebuildTurnOrder();
        renderCombatTracker();
      }

      function onPlayerSync(data) {
        if (!combatState) return;
        var pc = combatState.pcSlots.find(function (p) { return p.id === String(data.characterId); });
        if (pc) {
          var effs = data.effects || [];
          pc.conditions = effs.map(function (e) { return e.effectId || e; });
          pc.activeEffects = effs.filter(function (e) { return e.effectId; });
          renderCombatTracker();
        }
      }

      function onApplyAck(data) {
        if (!combatState || !data || !data.entry) return;
        var pc = combatState.pcSlots.find(function (p) { return p.id === String(data.characterId); });
        if (pc) {
          if (!pc.conditions) pc.conditions = [];
          var condId = data.entry.effectId;
          if (pc.conditions.indexOf(condId) === -1) {
            pc.conditions.push(condId);
          }
          if (!pc.activeEffects) pc.activeEffects = [];
          var existing = pc.activeEffects.findIndex(function (e) { return e.uid === data.entry.uid; });
          if (existing === -1) pc.activeEffects.push(data.entry);
          renderCombatTracker();
        }
      }

      sock.on('combat:join-battle-result', onJoinResult);
      sock.on('combat:all-joined', onAllJoined);
      sock.on('condition:player-sync', onPlayerSync);
      sock.on('condition:apply-ack', onApplyAck);

      _socketHandlers = [
        { event: 'combat:join-battle-result', fn: onJoinResult },
        { event: 'combat:all-joined', fn: onAllJoined },
        { event: 'condition:player-sync', fn: onPlayerSync },
        { event: 'condition:apply-ack', fn: onApplyAck }
      ];
    }

    combatState.combatants.forEach(function (npc) { migrateNpcConditions(npc); });
    setupRightColumnTabs();
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
    _placementNpcId = null;
    var sock = getSocket();
    if (sock) {
      sock.emit('combat:end');
    }
    combatState = null;
    _conditionPanelState = { targetId: null, targetType: null, sourceLabel: null, selectedCondition: null };
    if (_ctMapViewer) {
      try { _ctMapViewer.destroy && _ctMapViewer.destroy(); } catch (e) {}
      _ctMapViewer = null;
    }
    _ctMapContainer = null;
    _ctMapKey = null;
    teardownRightColumnTabs();
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
    if (!npcHasCond(npc, 'surprised')) npcAddCond(npc, 'surprised', 'lingering');
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

  var COMBO_COMPONENTS = {
    surprised: ['disoriented', 'exposed'],
    stunned: ['disoriented', 'rattled'],
    pinned: ['prone', 'restrained']
  };

  function expandCondIds(conditions) {
    var seen = {};
    var result = [];
    conditions.forEach(function (c) {
      var cid = typeof c === 'object' ? c.id : c;
      if (COMBO_COMPONENTS[cid]) {
        COMBO_COMPONENTS[cid].forEach(function (sub) {
          if (!seen[sub]) { seen[sub] = true; result.push(sub); }
        });
      }
      if (!seen[cid]) { seen[cid] = true; result.push(cid); }
    });
    return result;
  }

  function getTierEffect(conditions) {
    var ids = expandCondIds(conditions);
    var mod = 0;
    ids.forEach(function (cid) {
      if (cid === 'disoriented') mod -= 1;
      if (cid === 'rattled') mod -= 1;
      if (cid === 'blinded') mod -= 1;
      if (cid === 'optimized') mod += 1;
    });
    return mod;
  }

  function getNpcArenaMods(npc) {
    var mods = {};
    var arenas = ['physique','reflex','grit','wits','presence'];
    arenas.forEach(function (a) { mods[a] = 0; });
    var ids = npcCondIds(npc);
    npc.conditions.forEach(function (c) {
      if (typeof c !== 'object') return;
      if (c.id === 'weakened' && c.arena && mods[c.arena] !== undefined) {
        mods[c.arena] -= 1;
      }
      if (c.id === 'empowered' && c.arena && mods[c.arena] !== undefined) {
        mods[c.arena] += 1;
      }
    });
    if (npc.conditionArenas && npc.conditionArenas.weakened && ids.indexOf('weakened') !== -1) {
      var wa = npc.conditionArenas.weakened;
      var alreadyHandled = npc.conditions.some(function (c) { return typeof c === 'object' && c.id === 'weakened' && c.arena; });
      if (!alreadyHandled && mods[wa] !== undefined) mods[wa] -= 1;
    }
    if (npc.conditionArenas && npc.conditionArenas.empowered && ids.indexOf('empowered') !== -1) {
      var ea = npc.conditionArenas.empowered;
      var alreadyHandledE = npc.conditions.some(function (c) { return typeof c === 'object' && c.id === 'empowered' && c.arena; });
      if (!alreadyHandledE && mods[ea] !== undefined) mods[ea] += 1;
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
    var ids = expandCondIds((conditions || []).map(function (c) { return typeof c === 'object' ? c.id : c; }));
    var steps = 0;
    ids.forEach(function (cid) {
      if (cid === 'disoriented') steps -= 1;
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
    html += '<button class="ct-add-npc-btn" id="ct-add-npc" title="Add NPC">+ NPC</button>';
    html += '<button class="ct-end-btn" id="ct-end-encounter">End</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="ct-two-panel">';

    html += renderInitRail();

    html += renderDetailPanel();

    html += '</div>';

    var mapHtml = renderTacticalMap();
    if (mapHtml) {
      html += mapHtml;
      html += renderUnplacedTray();
    }

    container.innerHTML = html;
    attachCombatEvents(container);
    if (mapHtml) {
      _initCombatMapViewer();
      _updateCombatTokens();
      attachUnplacedTrayEvents(container);
    }
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
      var isSurprised = (pc && (pc.surprised || (pc.conditions && pc.conditions.indexOf('surprised') !== -1))) || (npc && npc.surprised);

      var cls = 'ct-rail-entry';
      if (isCurrent) cls += ' ct-rail-current';
      if (isSelected) cls += ' ct-rail-selected';
      if (isNpc) cls += ' ct-rail-npc';
      else cls += ' ct-rail-pc';
      if (isDown) cls += ' ct-rail-down';
      if (isSurprised) cls += ' ct-rail-surprised';

      html += '<div class="' + cls + '" data-select-id="' + esc(c.id) + '">';
      if (isCurrent) html += '<span class="ct-rail-turn-arrow">▶</span>';
      html += '<span class="ct-rail-init">' + (c.initiative || '—') + '</span>';
      if (isNpc && npc) {
        var disp = npc.disposition || 'enemy';
        var dispLabel = disp === 'ally' ? 'A' : disp === 'neutral' ? 'N' : 'E';
        html += '<span class="ct-rail-disp ct-rail-disp--' + esc(disp) + '" data-npc-id="' + esc(npc.id) + '" title="Click to cycle: Enemy / Neutral / Ally">' + dispLabel + '</span>';
      }
      html += '<span class="ct-rail-name">' + esc(c.name) + '</span>';
      if (isNpc && npc) {
        var pct = npc.vitalityMax > 0 ? Math.round((npc.vitalityCurrent / npc.vitalityMax) * 100) : 0;
        var hpLevel = pct > 60 ? 'high' : pct > 30 ? 'mid' : 'low';
        html += '<span class="ct-rail-hp ct-rail-hp--' + hpLevel + '">' + npc.vitalityCurrent + '</span>';
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
    var threatCls = npc.threat === 'minion' ? 'minion' : npc.threat === 'boss' ? 'boss' : npc.threat === 'elite' ? 'elite' : 'standard';
    var tierMod = getTierEffect(npc.conditions);
    var arenaMods = getNpcArenaMods(npc);

    html += '<div class="ct-detail-header">';
    html += '<div class="ct-detail-name">' + esc(npc.name) + '</div>';
    html += '<span class="ct-detail-threat ct-detail-threat--' + threatCls + '">' + esc(npc.threat).toUpperCase() + '</span>';
    if (npc.tier != null) html += '<span class="ct-detail-tier">T' + npc.tier + '</span>';
    if (npc.role) html += '<span class="ct-detail-role">' + esc(npc.role) + '</span>';
    if (npc.surprised) html += '<span class="ct-rail-tag ct-tag-surprised ct-tag-surprised--inline">SURPRISED</span>';
    html += '<div class="ct-npc-actions">';
    if (npc.npcData || npc.arenas) html += '<button class="ct-npc-edit-btn" data-npc-id="' + esc(npc.id) + '" title="Edit in Threat Builder">&#9998;</button>';
    html += '<button class="ct-npc-remove-btn" data-npc-id="' + esc(npc.id) + '" title="Remove from combat">&times;</button>';
    html += '</div>';
    html += '</div>';

    function statCell(label, val) {
      return '<div class="ct-stat-cell"><span class="ct-stat-label">' + label + '</span><span class="ct-stat-val">' + val + '</span></div>';
    }
    function arenaCell(label, base, mod) {
      var eff = Math.max(0, base + mod);
      var cls = mod < 0 ? ' ct-pres-debuff' : mod > 0 ? ' ct-pres-buff' : '';
      var display = mod !== 0 ? eff + ' <small class="ct-arena-base">(' + base + ')</small>' : '' + eff;
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
        html += '<div class="ct-detail-stats ct-detail-stats--arenas">';
        arenaKeys.forEach(function (a) {
          var base = npc.arenas[a] || 0;
          if (base || arenaMods[a]) {
            html += arenaCell(ARENA_LABELS[a], base, arenaMods[a]);
          }
        });
        html += '</div>';
      }
    }

    var tierBase = npc.tier || 0;
    var tierEff = Math.max(0, tierBase + tierMod);
    html += '<div class="ct-presence-row">';
    html += '<span class="ct-presence-label">Tier</span>';
    html += '<span class="ct-presence-val' + (tierMod < 0 ? ' ct-pres-debuff' : tierMod > 0 ? ' ct-pres-buff' : '') + '">' + tierEff + '</span>';
    if (tierMod !== 0) html += '<span class="ct-presence-mod">(' + (tierMod > 0 ? '+' : '') + tierMod + ')</span>';
    html += '<span class="ct-presence-hint">PCs roll against this</span>';
    html += '</div>';

    var hpPercent = npc.vitalityMax > 0 ? Math.max(0, Math.min(100, (npc.vitalityCurrent / npc.vitalityMax) * 100)) : 0;
    var hpBarLevel = hpPercent > 60 ? 'high' : hpPercent > 30 ? 'mid' : 'low';
    html += '<div class="ct-vitality-row">';
    html += '<button class="ct-vit-btn ct-vit-minus" data-npc-id="' + esc(npc.id) + '" data-delta="-1">&minus;</button>';
    html += '<div class="ct-vitality-bar-wrap">';
    html += '<div class="ct-vitality-bar ct-vitality-bar--' + hpBarLevel + '" style="width:' + hpPercent + '%;"></div>';
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
    npc.conditions.forEach(function (c) {
      var cid = typeof c === 'object' ? c.id : c;
      var dur = typeof c === 'object' ? c.duration : null;
      var arena = typeof c === 'object' ? c.arena : (npc.conditionArenas && npc.conditionArenas[cid]);
      var def = getEffectDef(cid);
      var label = def ? def.label : cid;
      var color = condColor(cid);
      var desc = def ? def.description : '';
      var isCombo = def && def.components && def.components.length > 0;
      var durMap = { immediate: '!', tactical: 'T', lingering: 'L', ongoing: '\u221E' };
      var meta = '';
      var parts = [];
      if (arena) parts.push(esc(arena));
      if (dur && durMap[dur]) parts.push(esc(durMap[dur]));
      if (parts.length) meta = ' <small class="ct-dur-tag">(' + parts.join('/') + ')</small>';
      var comboTag = isCombo ? '<small class="ct-combo-tag">\u2736</small> ' : '';
      html += '<span class="ct-condition-chip' + (isCombo ? ' ct-combo-chip' : '') + '" style="background:' + color + '22;color:' + color + ';border-color:' + color + '44;" title="' + esc(desc) + '" data-npc-id="' + esc(npc.id) + '" data-cond="' + esc(cid) + '">' + comboTag + esc(label) + meta + ' &times;</span>';
    });
    html += '</div>';
    html += '<button class="ct-add-condition-btn" data-npc-id="' + esc(npc.id) + '">+ Condition</button>';
    html += '<button class="ct-push-to-pc-btn" data-npc-id="' + esc(npc.id) + '" data-npc-name="' + esc(npc.name) + '">Push to PC</button>';
    html += '</div>';

    var attacks = npc.computedAttacks || (npc.threatBuild && npc.threatBuild.computedAttacks) || [];

    if (npc.roleKit) {
      html += renderRoleKit(npc.roleKit, npc.threatBuild || npc, attacks);
    } else if (attacks.length) {
      var atkHtml = '<div class="ct-attacks-section">';
      atkHtml += '<div class="ct-attacks-label">ATTACKS</div>';
      attacks.forEach(function (atk) {
        atkHtml += '<div class="ct-attack-card">';
        atkHtml += '<div class="ct-attack-header"><strong>' + esc(atk.name) + '</strong>';
        atkHtml += ' <span class="ct-rk-power">POWER ' + atk.attackPower + '</span>';
        atkHtml += ' <span class="ct-chassis-badge">' + esc(atk.chassisLabel) + '</span>';
        if (atk.arena) atkHtml += ' <span class="ct-rk-arena">' + esc(atk.arena) + '</span>';
        atkHtml += '</div>';
        atkHtml += '<div class="ct-attack-dmg-row">';
        atkHtml += '<span class="ct-dmg-tier"><span class="ct-dmg-lbl">F</span> ' + atk.damage.fleeting + '</span>';
        atkHtml += '<span class="ct-dmg-tier"><span class="ct-dmg-lbl">M</span> ' + atk.damage.masterful + '</span>';
        atkHtml += '<span class="ct-dmg-tier"><span class="ct-dmg-lbl">L</span> ' + atk.damage.legendary + '</span>';
        if (atk.canStun && atk.stun) {
          atkHtml += '<span class="ct-stun-inline"><span class="ct-stun-lbl">STUN</span> ' + atk.stun.fleeting + ' / ' + atk.stun.masterful + ' / ' + atk.stun.legendary + '</span>';
        }
        atkHtml += '</div>';
        atkHtml += '</div>';
      });
      atkHtml += '</div>';
      html += atkHtml;
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

    var isSurprised = pc.surprised || (pc.conditions && pc.conditions.indexOf('surprised') !== -1);
    if (isSurprised) {
      html += '<div class="ct-surprised-banner">SURPRISED &mdash; [Disoriented] + [Exposed] until end of first turn</div>';
    }
    if (pc.mastery) {
      if (!pc.masteryUsed) {
        var availTargets = combatState.combatants.filter(function (npc) { return !npc.surprised; });
        html += '<div class="ct-mastery-banner">MASTERY &mdash; Designate one enemy as surprised';
        availTargets.forEach(function (npc) {
          html += ' <button class="ct-ctrl-btn ct-mastery-btn" data-mastery-target="' + esc(npc.id) + '" data-mastery-pc="' + esc(pc.id) + '">' + esc(npc.name) + '</button>';
        });
        html += '</div>';
      } else {
        html += '<div class="ct-mastery-banner ct-mastery-banner--used">MASTERY &mdash; Surprised target designated &#10003;</div>';
      }
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
            var dieCls = effDie < baseDie ? 'ct-arena-die--debuff' : 'ct-arena-die--buff';
            html += ' <span class="ct-arena-die ' + dieCls + '">' + esc(effDie) + '</span>';
            html += ' <small class="ct-arena-base">' + esc(baseDie) + '</small>';
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
              var discDieCls = effDiscDie < disc.die ? 'ct-arena-die--debuff' : 'ct-arena-die--buff';
              html += '<span class="ct-disc-die ' + discDieCls + '">' + esc(effDiscDie) + '</span>';
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
    if (pc.activeEffects && pc.activeEffects.length) {
      pc.activeEffects.forEach(function (eff) {
        var cid = eff.effectId || eff;
        var def = getEffectDef(cid);
        var label = def ? def.label : cid;
        var color = condColor(cid);
        var scopeStr = '';
        if (eff.target) {
          var allowedScopes = { fixed: 'fixed', universal: 'all' };
          if (allowedScopes[eff.target]) {
            scopeStr = allowedScopes[eff.target];
          } else if (typeof eff.target === 'string' && eff.target.indexOf('arena:') === 0) {
            var arenaVal = eff.target.replace('arena:', '');
            var allowedArenas = ['physique','reflex','grit','wits','presence','power','evasion','resist','defense'];
            scopeStr = allowedArenas.indexOf(arenaVal) !== -1 ? arenaVal : '';
          }
        }
        var durMap = { immediate: '!', tactical: 'T', lingering: 'L', ongoing: '\u221E' };
        var durStr = durMap[eff.duration] || '';
        var meta = '';
        if (scopeStr || durStr) {
          var parts = [];
          if (scopeStr) parts.push(esc(scopeStr));
          if (durStr) parts.push(esc(durStr));
          meta = ' <small class="ct-dur-tag">(' + parts.join('/') + ')</small>';
        }
        html += '<span class="ct-condition-chip ct-pc-chip" style="background:' + color + '22;color:' + color + ';border-color:' + color + '44;">' + esc(label) + meta + '</span>';
      });
    } else if (pc.conditions && pc.conditions.length) {
      pc.conditions.forEach(function (cid) {
        var def = getEffectDef(cid);
        var label = def ? def.label : cid;
        var color = condColor(cid);
        html += '<span class="ct-condition-chip ct-pc-chip" style="background:' + color + '22;color:' + color + ';border-color:' + color + '44;">' + esc(label) + '</span>';
      });
    }
    html += '</div>';
    html += '<button class="ct-push-condition-btn" data-pc-id="' + esc(pc.id) + '">+ Push Condition</button>';
    html += '</div>';

    return html;
  }

  function renderRoleKit(rk, tb, computedAttacks) {
    var html = '<div class="ct-rolekit">';
    html += '<div class="ct-section-label">' + (rk.roleName ? esc(rk.roleName) : 'Role Kit') + '</div>';

    if (rk.passive) {
      var passiveDesc = rk.passive.description;
      if (rk.passive.statMod) passiveDesc += ' (included in stats)';
      html += '<div class="ct-rk-passive"><strong>' + esc(rk.passive.name) + '</strong>: ' + esc(passiveDesc) + '</div>';
    }

    if (rk.action && !rk.action.isAttack) {
      html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-action">Signature</span> <strong>' + esc(rk.action.name) + '</strong>';
      if (rk.action.defense && rk.action.defense !== 'none') html += ' <span class="ct-rk-cost">(Defense: ' + esc(rk.action.defense) + ')</span>';
      if (rk.action.npcEffects) {
        html += '<div class="ct-rk-effects-inline">';
        html += '<span><strong>F:</strong> ' + esc(rk.action.npcEffects.fleeting) + '</span>';
        html += '<span><strong>M:</strong> ' + esc(rk.action.npcEffects.masterful) + '</span>';
        html += '<span><strong>L:</strong> ' + esc(rk.action.npcEffects.legendary) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (rk.maneuver && rk.maneuver.name) {
      html += '<div class="ct-rk-entry"><span class="ct-rk-tag ct-rk-maneuver">Maneuver</span> <strong>' + esc(rk.maneuver.name) + '</strong>';
      if (rk.maneuver.modifies) html += ' <span class="ct-rk-cost">(mod ' + esc(rk.maneuver.modifies) + ')</span>';
      html += ' &mdash; ' + esc(rk.maneuver.description);
      html += '</div>';
    }

    var allAtks = computedAttacks || [];
    var roleDefense = rk.action ? rk.action.defense : '';
    var roleActionName = (rk.action && rk.action.isAttack) ? rk.action.name : null;

    var gambits = [];
    if (rk.gambits && rk.gambits.length) {
      gambits = gambits.concat(rk.gambits);
    } else if (rk.gambit) {
      gambits.push(rk.gambit);
    }
    if (tb && tb.extraGambits && tb.extraGambits.length) {
      gambits = gambits.concat(tb.extraGambits);
    }

    if (allAtks.length || gambits.length) {
      html += '<div class="ct-attacks-section">';
      if (allAtks.length) {
        html += '<div class="ct-attacks-label">ATTACKS</div>';
        allAtks.forEach(function (atk) {
          var isRole = !!atk.isRoleAction || (roleActionName && atk.name === roleActionName);
          html += '<div class="ct-attack-card' + (isRole ? ' ct-rk-attack-card' : '') + '">';
          html += '<div class="ct-attack-header">';
          if (isRole) html += '<span class="ct-rk-tag ct-rk-action">Action</span> ';
          html += '<strong>' + esc(atk.name) + '</strong>';
          if (isRole && roleDefense && roleDefense !== 'none') html += ' <span class="ct-rk-cost">(Def: ' + esc(roleDefense) + ')</span>';
          html += ' <span class="ct-rk-power">POWER ' + atk.attackPower + '</span>';
          html += ' <span class="ct-chassis-badge">' + esc(atk.chassisLabel) + '</span>';
          if (atk.arena) html += ' <span class="ct-rk-arena">' + esc(atk.arena) + '</span>';
          html += '</div>';
          html += '<div class="ct-attack-dmg-row">';
          html += '<span class="ct-dmg-tier"><span class="ct-dmg-lbl">F</span> ' + atk.damage.fleeting + '</span>';
          html += '<span class="ct-dmg-tier"><span class="ct-dmg-lbl">M</span> ' + atk.damage.masterful + '</span>';
          html += '<span class="ct-dmg-tier"><span class="ct-dmg-lbl">L</span> ' + atk.damage.legendary + '</span>';
          if (atk.canStun && atk.stun) {
            html += '<span class="ct-stun-inline"><span class="ct-stun-lbl">STUN</span> ' + atk.stun.fleeting + ' / ' + atk.stun.masterful + ' / ' + atk.stun.legendary + '</span>';
          }
          html += '</div>';
          html += '</div>';
        });
      }
      if (gambits.length) {
        html += '<div class="ct-gambits-row">';
        gambits.forEach(function (g) {
          html += '<div class="ct-gambit-item"><span class="ct-rk-tag ct-rk-gambit">Gambit</span> <strong>' + esc(g.name) + '</strong> <span class="ct-rk-cost">(' + esc(g.cost) + ')</span> &mdash; ' + esc(g.description) + '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    }

    if (rk.exploit) {
      html += '<div class="ct-rk-exploit-block"><span class="ct-rk-tag ct-rk-exploit">Exploit</span> <strong>' + esc(rk.exploit.name) + '</strong>';
      if (rk.exploit.trigger) {
        html += '<div class="ct-exploit-trigger"><strong>TRIGGER:</strong> ' + esc(rk.exploit.trigger) + '</div>';
      }
      html += '<div>' + esc(rk.exploit.description) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function _extractMapKey(scene, encounter) {
    var sources = [];
    if (scene) {
      if (scene.gmNotes) sources.push(scene.gmNotes);
      if (scene.text) sources.push(scene.text);
      if (scene.readAloud) sources.push(scene.readAloud);
      if (scene.readAloudPart1) sources.push(scene.readAloudPart1);
      if (scene.readAloudPart2) sources.push(scene.readAloudPart2);
    }
    if (encounter) {
      if (encounter.description) sources.push(encounter.description);
      if (encounter.gmNotes) sources.push(encounter.gmNotes);
      if (encounter.tactics) sources.push(encounter.tactics);
    }
    for (var i = 0; i < sources.length; i++) {
      var m = sources[i].match(/\[map:([a-zA-Z0-9_-]+)\]/);
      if (m) return m[1];
    }
    if (scene && scene.tacticalMap && scene.tacticalMap.mapKey) {
      return scene.tacticalMap.mapKey;
    }
    return null;
  }

  var _ctMapViewer = null;
  var _ctMapKey = null;
  var _ctMapContainer = null;

  function renderTacticalMap() {
    if (!combatState) return '';
    var mapKey = _extractMapKey(combatState.scene, combatState.encounter);
    if (!mapKey) return '';
    _ctMapKey = mapKey;
    return '<div id="ct-map-anchor"></div>';
  }

  function _initCombatMapViewer() {
    if (!_ctMapKey) return;
    var anchor = document.getElementById('ct-map-anchor');
    if (!anchor) return;

    if (_ctMapContainer && _ctMapViewer && _ctMapViewer.mapKey === _ctMapKey) {
      anchor.parentNode.replaceChild(_ctMapContainer, anchor);
      return;
    }

    if (_ctMapViewer) {
      try { _ctMapViewer.destroy && _ctMapViewer.destroy(); } catch (e) {}
      _ctMapViewer = null;
    }

    _ctMapContainer = document.createElement('div');
    _ctMapContainer.className = 'ct-tactical-map';
    _ctMapContainer.innerHTML =
      '<div class="ct-map-viewer-header">' +
        '<span class="ct-section-label ct-map-title">Tactical Map</span>' +
        '<div class="ct-map-viewer-controls">' +
          '<button class="ct-map-btn ct-map-btn--broadcast" id="ct-map-broadcast">Broadcast</button>' +
          '<button class="ct-map-btn ct-map-btn--dismiss" id="ct-map-dismiss">Dismiss</button>' +
        '</div>' +
      '</div>' +
      '<div class="ct-map-viewer-body" id="ct-map-viewer-body"></div>';

    anchor.parentNode.replaceChild(_ctMapContainer, anchor);

    var body = _ctMapContainer.querySelector('#ct-map-viewer-body');
    _ctMapViewer = new window.TacticalMapViewer({
      container: body,
      role: 'gm',
      socket: getSocket(),
      onZoneClick: function (zone, idx) {
        if (_placementNpcId && zone) {
          _placeNpcOnZone(zone.room || ('zone_' + idx));
          return true;
        }
        return false;
      }
    });
    _ctMapViewer.onMapLoaded = function () {
      _updateCombatTokens();
    };
    _ctMapViewer.onTokenMoved = function (tokenId, pos) {
      if (!combatState) return;
      combatState.tokenPositions[tokenId] = pos;
      persistTokenPosition(tokenId, pos);
      _updateCombatTokens();
      syncStateToServer();
    };
    _ctMapViewer.onTokenViewDetails = function (tokenId) {
      if (!combatState) return;
      combatState.selectedId = tokenId;
      renderCombatTracker();
    };
    _ctMapViewer.onTokenSetDisposition = function (tokenId, disp) {
      if (!combatState) return;
      var npc = combatState.combatants.find(function (n) { return n.id === tokenId; });
      if (npc) {
        npc.disposition = disp;
        _updateCombatTokens();
        renderCombatTracker();
      }
    };
    _ctMapViewer.onTokenToggleObjective = function (tokenId) {
      if (!combatState) return;
      if (!combatState.objectives) combatState.objectives = {};
      combatState.objectives[tokenId] = !combatState.objectives[tokenId];
      if (!combatState.objectives[tokenId]) delete combatState.objectives[tokenId];
      _updateCombatTokens();
      syncStateToServer();
    };
    _ctMapViewer.getZoneOccupants = function (zoneRoom) {
      return getTokensInZone(zoneRoom);
    };
    _ctMapViewer.loadMap(_ctMapKey);

    var sock = getSocket();
    _ctMapContainer.querySelector('#ct-map-broadcast').addEventListener('click', function () {
      if (sock) sock.emit('map:broadcast', { mapKey: _ctMapKey });
    });
    _ctMapContainer.querySelector('#ct-map-dismiss').addEventListener('click', function () {
      if (sock) sock.emit('map:dismiss');
    });

    if (sock) {
      sock.on('map:pins-sync', function (data) {
        if (_ctMapViewer && data.mapKey === _ctMapKey) _ctMapViewer.handlePinsSync(data.pins);
      });
      sock.on('map:pin-added', function (data) {
        if (_ctMapViewer && data.pin) _ctMapViewer.handlePinAdded(data.pin);
      });
      sock.on('map:pin-updated', function (data) {
        if (_ctMapViewer && data.pin) _ctMapViewer.handlePinUpdated(data.pin);
      });
      sock.on('map:pin-removed', function (data) {
        if (_ctMapViewer) _ctMapViewer.handlePinRemoved(data.id);
      });
    }
  }

  function _resolveTokenInfo(tokId) {
    var shortName = tokId;
    var fullName = tokId;
    var type = 'pc';
    var disposition = null;
    if (tokId === 'PCs') {
      shortName = 'PCs';
      fullName = 'Player Characters';
    } else {
      var pc = (combatState.pcSlots || []).find(function (p) { return p.id === tokId; });
      if (pc) {
        shortName = pc.name.length > 8 ? pc.name.substring(0, 7) + '.' : pc.name;
        fullName = pc.name;
        type = 'pc';
      } else {
        var npc = combatState.combatants.find(function (n) { return n.id === tokId; });
        if (npc) {
          var numMatch = npc.name.match(/ #(\d+)$/);
          var numSuffix = numMatch ? ' #' + numMatch[1] : '';
          var nameBase = numMatch ? npc.name.replace(/ #\d+$/, '') : npc.name;
          var maxBase = 8 - numSuffix.length;
          shortName = nameBase.length > maxBase ? nameBase.substring(0, maxBase - 1) + '.' + numSuffix : npc.name;
          fullName = npc.name;
          type = 'npc';
          disposition = npc.disposition || 'enemy';
        }
      }
    }
    return { id: tokId, shortName: shortName, name: fullName, type: type, disposition: disposition };
  }

  function getTokensInZone(zoneId) {
    if (!combatState) return [];
    var tokens = [];
    var zoneBounds = null;
    if (_ctMapViewer && _ctMapViewer.meta && _ctMapViewer.meta.zones) {
      _ctMapViewer.meta.zones.forEach(function (z, i) {
        var zRoom = z.room || ('zone_' + i);
        if (zRoom === zoneId) zoneBounds = z;
      });
    }
    Object.keys(combatState.tokenPositions).forEach(function (tokId) {
      var pos = combatState.tokenPositions[tokId];
      if (!pos) return;
      var match = false;
      if (typeof pos === 'string') {
        match = pos === zoneId;
      } else if (typeof pos === 'object' && zoneBounds) {
        match = pos.x >= zoneBounds.x && pos.x <= zoneBounds.x + zoneBounds.w &&
                pos.y >= zoneBounds.y && pos.y <= zoneBounds.y + zoneBounds.h;
      }
      if (match) {
        tokens.push(_resolveTokenInfo(tokId));
      }
    });
    return tokens;
  }

  function openConditionPanel(targetId, targetType, sourceLabel) {
    _conditionPanelState.targetId = targetId || null;
    _conditionPanelState.targetType = targetType || null;
    _conditionPanelState.sourceLabel = sourceLabel || null;
    _conditionPanelState.selectedCondition = null;
    activateRightColumnTab('conditions');
    renderConditionPanel();
  }

  function activateRightColumnTab(tab) {
    var colRight = document.querySelector('.cb-col-right');
    if (!colRight) return;
    var tabBtns = colRight.querySelectorAll('.ct-right-tab-btn');
    tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    var glossaryContent = document.getElementById('glossary-content');
    var condPanel = document.getElementById('ct-condition-panel');
    var glossaryTitle = colRight.querySelector('.cb-col-title');
    if (tab === 'conditions') {
      if (glossaryContent) glossaryContent.style.display = 'none';
      if (condPanel) condPanel.style.display = 'block';
      if (glossaryTitle) glossaryTitle.style.display = 'none';
    } else {
      if (glossaryContent) glossaryContent.style.display = '';
      if (condPanel) condPanel.style.display = 'none';
      if (glossaryTitle) glossaryTitle.style.display = '';
    }
  }

  function setupRightColumnTabs() {
    var colRight = document.querySelector('.cb-col-right');
    if (!colRight) return;
    var existing = colRight.querySelector('.ct-right-tab-bar');
    if (existing) return;

    var tabBar = document.createElement('div');
    tabBar.className = 'ct-right-tab-bar';
    tabBar.innerHTML = '<button class="ct-right-tab-btn active" data-tab="conditions">Conditions</button>' +
      '<button class="ct-right-tab-btn" data-tab="glossary">Glossary</button>';

    var glossaryTitle = null;
    colRight.querySelectorAll('.cb-col-title').forEach(function (el) {
      if (el.textContent.trim().indexOf('Glossary') === 0) glossaryTitle = el;
    });
    var toolboxGroups = colRight.querySelectorAll('.gm-toolbox-group');
    var lastToolboxGroup = toolboxGroups.length ? toolboxGroups[toolboxGroups.length - 1] : null;
    if (lastToolboxGroup && lastToolboxGroup.nextSibling) {
      colRight.insertBefore(tabBar, lastToolboxGroup.nextSibling);
    } else if (glossaryTitle) {
      colRight.insertBefore(tabBar, glossaryTitle);
    } else {
      colRight.prepend(tabBar);
    }

    var condPanel = document.createElement('div');
    condPanel.id = 'ct-condition-panel';
    condPanel.className = 'ct-condition-panel';
    if (glossaryTitle) {
      colRight.insertBefore(condPanel, glossaryTitle);
    } else {
      tabBar.after(condPanel);
    }

    tabBar.querySelectorAll('.ct-right-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateRightColumnTab(btn.dataset.tab);
      });
    });

    activateRightColumnTab('conditions');

    var mobileNav = document.getElementById('cb-mobile-tabs');
    if (mobileNav && !mobileNav.querySelector('[data-panel="conditions"]')) {
      var condTab = document.createElement('button');
      condTab.className = 'cb-mobile-tab';
      condTab.dataset.panel = 'conditions';
      condTab.innerHTML = '<span class="cb-mobile-tab-icon">&#9876;</span>Conditions';
      var glossaryTab = mobileNav.querySelector('[data-panel="right"]');
      if (glossaryTab) {
        mobileNav.insertBefore(condTab, glossaryTab);
      } else {
        mobileNav.appendChild(condTab);
      }
      condTab.addEventListener('click', function () {
        activateRightColumnTab('conditions');
        var colLeft = document.querySelector('.cb-col-left');
        var colCenter = document.querySelector('.cb-col-center');
        if (colLeft) colLeft.classList.remove('cb-mobile-active');
        if (colCenter) colCenter.classList.remove('cb-mobile-active');
        if (colRight) colRight.classList.add('cb-mobile-active');
        mobileNav.querySelectorAll('.cb-mobile-tab').forEach(function (t) {
          t.classList.toggle('active', t === condTab);
        });
      });
    }

    renderConditionPanel();
  }

  function teardownRightColumnTabs() {
    var colRight = document.querySelector('.cb-col-right');
    if (!colRight) return;
    var tabBar = colRight.querySelector('.ct-right-tab-bar');
    if (tabBar) tabBar.remove();
    var condPanel = document.getElementById('ct-condition-panel');
    if (condPanel) condPanel.remove();
    var glossaryContent = document.getElementById('glossary-content');
    if (glossaryContent) glossaryContent.style.display = '';
    var glossaryTitle = colRight.querySelector('.cb-col-title');
    if (glossaryTitle) glossaryTitle.style.display = '';

    var mobileNav = document.getElementById('cb-mobile-tabs');
    if (mobileNav) {
      var condTab = mobileNav.querySelector('[data-panel="conditions"]');
      if (condTab) condTab.remove();
    }
  }

  function renderConditionPanel() {
    var panel = document.getElementById('ct-condition-panel');
    if (!panel || !combatState) return;

    var html = '';
    var st = _conditionPanelState;

    html += '<div class="ct-cpanel-section">';
    html += '<div class="ct-cpanel-title">Apply Condition</div>';

    if (st.sourceLabel) {
      html += '<div class="ct-cpanel-source">From: <strong>' + esc(st.sourceLabel) + '</strong></div>';
    }

    html += '<div class="ct-cpanel-field">';
    html += '<label class="ct-cpanel-label">Target</label>';
    html += '<select class="ct-cpanel-select" id="ct-cpanel-target">';
    html += '<option value="">— Select Target —</option>';

    var pcGroup = combatState.pcSlots;
    var npcGroup = combatState.combatants;
    if (pcGroup.length) {
      html += '<optgroup label="PCs">';
      pcGroup.forEach(function (pc) {
        var sel = (st.targetType === 'pc' && st.targetId === pc.id) ? ' selected' : '';
        html += '<option value="pc:' + esc(pc.id) + '"' + sel + '>' + esc(pc.name) + '</option>';
      });
      html += '</optgroup>';
    }
    if (npcGroup.length) {
      html += '<optgroup label="NPCs">';
      npcGroup.forEach(function (npc) {
        var sel = (st.targetType === 'npc' && st.targetId === npc.id) ? ' selected' : '';
        html += '<option value="npc:' + esc(npc.id) + '"' + sel + '>' + esc(npc.name) + '</option>';
      });
      html += '</optgroup>';
    }
    html += '</select>';
    html += '</div>';

    var condList = (st.targetType === 'npc' ? NPC_CONDITIONS : ALL_CONDITIONS).slice();
    condList.sort(function (a, b) {
      var la = (getEffectDef(a) || {}).label || a;
      var lb = (getEffectDef(b) || {}).label || b;
      return la.localeCompare(lb);
    });

    html += '<div class="ct-cpanel-condlist">';
    condList.forEach(function (condId) {
      var def = getEffectDef(condId);
      if (!def) return;
      var color = condColor(condId);
      var selected = st.selectedCondition === condId;
      html += '<div class="ct-cpanel-cond-item' + (selected ? ' ct-cpanel-cond-selected' : '') + '" data-cond="' + esc(condId) + '">';
      html += '<span class="ct-palette-dot" style="background:' + color + ';"></span>';
      html += '<span class="ct-cpanel-cond-name">' + esc(def.label) + '</span>';
      html += '<span class="ct-cpanel-cond-desc">' + esc(def.description.split('.')[0]) + '</span>';
      html += '</div>';
    });
    html += '</div>';

    if (st.selectedCondition) {
      var selDef = getEffectDef(st.selectedCondition);
      var defaultDur = selDef ? selDef.defaultDuration : 'tactical';
      html += '<div class="ct-cpanel-field">';
      html += '<label class="ct-cpanel-label">Duration</label>';
      html += '<div class="ct-cpanel-dur-row">';
      var durs = [
        { val: 'immediate', label: 'Immediate \u2014 one-use, resolve now', badge: '!' },
        { val: 'tactical', label: 'Tactical \u2014 until applier\u2019s next turn start', badge: 'T' },
        { val: 'lingering', label: 'Lingering \u2014 until target\u2019s next turn end', badge: 'L' },
        { val: 'ongoing', label: 'Ongoing \u2014 until recovered or scene ends', badge: '\u221E' }
      ];
      durs.forEach(function (d) {
        var isDefault = d.val === defaultDur;
        html += '<button class="ct-cpanel-dur-btn' + (isDefault ? ' ct-cpanel-dur-active' : '') + '" data-dur="' + d.val + '" title="' + esc(d.label) + '">' + d.badge + '</button>';
      });
      html += '</div>';
      html += '</div>';

      var needsArena = (st.selectedCondition === 'weakened' || st.selectedCondition === 'empowered');
      if (needsArena) {
        html += '<div class="ct-cpanel-field">';
        html += '<label class="ct-cpanel-label">Target Arena</label>';
        html += '<div class="ct-cpanel-arena-row">';
        var arenas = ['physique', 'reflex', 'grit', 'wits', 'presence'];
        var arenaLabels = { physique: 'PHY', reflex: 'REF', grit: 'GRT', wits: 'WIT', presence: 'PRS' };
        arenas.forEach(function (a) {
          html += '<button class="ct-cpanel-arena-btn" data-arena="' + a + '">' + arenaLabels[a] + '</button>';
        });
        html += '</div>';
        html += '</div>';
      }

      html += '<button class="ct-cpanel-apply-btn" id="ct-cpanel-apply"' + (needsArena ? ' disabled' : '') + '>Apply Condition</button>';
    }

    html += '</div>';

    html += '<div class="ct-cpanel-section ct-cpanel-summary">';
    html += '<div class="ct-cpanel-title">Active Conditions</div>';

    var allCombatants = [];
    combatState.pcSlots.forEach(function (pc) {
      var conds = [];
      if (pc.activeEffects && pc.activeEffects.length) {
        pc.activeEffects.forEach(function (eff) {
          var cid = eff.effectId || eff;
          var dur = eff.duration || null;
          var target = eff.target || null;
          conds.push({ id: cid, duration: dur, target: target, uid: eff.uid });
        });
      } else if (pc.conditions && pc.conditions.length) {
        pc.conditions.forEach(function (cid) {
          conds.push({ id: cid });
        });
      }
      if (conds.length) {
        allCombatants.push({ name: pc.name, id: pc.id, type: 'pc', conditions: conds });
      }
    });
    combatState.combatants.forEach(function (npc) {
      if (npc.conditions && npc.conditions.length) {
        var conds = npc.conditions.map(function (c) {
          if (typeof c === 'object') return c;
          return { id: c };
        });
        allCombatants.push({ name: npc.name, id: npc.id, type: 'npc', conditions: conds });
      }
    });

    if (allCombatants.length === 0) {
      html += '<div class="ct-cpanel-empty">No active conditions</div>';
    } else {
      allCombatants.forEach(function (combatant) {
        html += '<div class="ct-cpanel-combatant">';
        html += '<div class="ct-cpanel-cname">' + esc(combatant.name) + ' <small>(' + combatant.type.toUpperCase() + ')</small></div>';
        html += '<div class="ct-cpanel-chips">';
        combatant.conditions.forEach(function (c) {
          var cid = typeof c === 'object' ? (c.id || c.effectId) : c;
          var def = getEffectDef(cid);
          var label = def ? def.label : cid;
          var color = condColor(cid);
          var durMap = { immediate: '!', tactical: 'T', lingering: 'L', ongoing: '\u221E' };
          var meta = '';
          if (c.duration && durMap[c.duration]) meta = ' (' + durMap[c.duration] + ')';
          var uidAttr = c.uid ? ' data-remove-uid="' + esc(c.uid) + '"' : '';
          html += '<span class="ct-cpanel-chip" style="background:' + color + '22;color:' + color + ';border-color:' + color + '44;" data-remove-type="' + esc(combatant.type) + '" data-remove-id="' + esc(combatant.id) + '" data-remove-cond="' + esc(cid) + '"' + uidAttr + '>' + esc(label) + meta + ' &times;</span>';
        });
        html += '</div>';
        html += '</div>';
      });
    }
    html += '</div>';

    panel.innerHTML = html;
    attachConditionPanelEvents(panel);
  }

  function attachConditionPanelEvents(panel) {
    var targetSelect = panel.querySelector('#ct-cpanel-target');
    if (targetSelect) {
      targetSelect.addEventListener('change', function () {
        var val = targetSelect.value;
        if (val) {
          var parts = val.split(':');
          _conditionPanelState.targetType = parts[0];
          _conditionPanelState.targetId = parts[1];
        } else {
          _conditionPanelState.targetType = null;
          _conditionPanelState.targetId = null;
        }
        _conditionPanelState.selectedCondition = null;
        renderConditionPanel();
      });
    }

    panel.querySelectorAll('.ct-cpanel-cond-item').forEach(function (item) {
      item.addEventListener('click', function () {
        _conditionPanelState.selectedCondition = item.dataset.cond;
        renderConditionPanel();
      });
    });

    var selectedArena = null;
    panel.querySelectorAll('.ct-cpanel-arena-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        panel.querySelectorAll('.ct-cpanel-arena-btn').forEach(function (b) { b.classList.remove('ct-cpanel-arena-active'); });
        btn.classList.add('ct-cpanel-arena-active');
        selectedArena = btn.dataset.arena;
        var applyBtn = panel.querySelector('#ct-cpanel-apply');
        if (applyBtn) applyBtn.disabled = false;
      });
    });

    var activeDur = null;
    panel.querySelectorAll('.ct-cpanel-dur-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        panel.querySelectorAll('.ct-cpanel-dur-btn').forEach(function (b) { b.classList.remove('ct-cpanel-dur-active'); });
        btn.classList.add('ct-cpanel-dur-active');
        activeDur = btn.dataset.dur;
      });
    });

    var applyBtn = panel.querySelector('#ct-cpanel-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var st = _conditionPanelState;
        if (!st.targetId || !st.selectedCondition) return;

        var condId = st.selectedCondition;
        var def = getEffectDef(condId);
        var activeBtn = panel.querySelector('.ct-cpanel-dur-btn.ct-cpanel-dur-active');
        var duration = activeBtn ? activeBtn.dataset.dur : (def ? def.defaultDuration : 'tactical');
        var arena = selectedArena || null;

        if (st.targetType === 'pc') {
          var target = 'universal';
          if (def && def.targetMode === 'fixed_arenas') target = 'fixed';
          if (def && def.targetMode === 'arena_only' && arena) target = 'arena:' + arena;
          var sock = getSocket();
          if (sock) {
            sock.emit('condition:apply', {
              characterId: st.targetId,
              conditionId: condId,
              target: target,
              duration: duration
            });
          }
        } else if (st.targetType === 'npc') {
          var npc = combatState.combatants.find(function (n) { return n.id === st.targetId; });
          if (npc) {
            npcAddCond(npc, condId, duration, arena);
            renderCombatTracker();
          }
        }

        _conditionPanelState.selectedCondition = null;
        renderConditionPanel();
      });
    }

    panel.querySelectorAll('.ct-cpanel-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var type = chip.dataset.removeType;
        var id = chip.dataset.removeId;
        var condId = chip.dataset.removeCond;
        var uid = chip.dataset.removeUid || null;
        if (type === 'npc') {
          var npc = combatState.combatants.find(function (n) { return n.id === id; });
          if (npc) {
            npcRemoveCond(npc, condId);
            if (condId === 'surprised') npc.surprised = false;
            renderCombatTracker();
          }
        } else if (type === 'pc') {
          var sock = getSocket();
          if (sock) {
            var removePayload = { characterId: id, conditionId: condId };
            if (uid) removePayload.uid = uid;
            sock.emit('condition:remove', removePayload);
          }
          var pc = combatState.pcSlots.find(function (p) { return p.id === id; });
          if (pc) {
            if (uid) {
              pc.activeEffects = (pc.activeEffects || []).filter(function (e) { return e.uid !== uid; });
              var stillHas = (pc.activeEffects || []).some(function (e) { return (e.effectId || e) === condId; });
              if (!stillHas) {
                pc.conditions = (pc.conditions || []).filter(function (c) { return c !== condId; });
              }
            } else {
              pc.conditions = (pc.conditions || []).filter(function (c) { return c !== condId; });
              pc.activeEffects = (pc.activeEffects || []).filter(function (e) { return (e.effectId || e) !== condId; });
            }
          }
        }
        renderConditionPanel();
      });
    });
  }

  function showConditionPalette(anchorEl, npcId) {
    openConditionPanel(npcId, 'npc');
  }

  function showArenaPicker() {}

  function showPcConditionPalette(anchorEl, pcId) {
    openConditionPanel(pcId, 'pc');
  }

  function showPcArenaPicker() {}

  function removeNpcFromCombat(npcId) {
    if (!combatState) return;
    combatState.combatants = combatState.combatants.filter(function (n) { return n.id !== npcId; });
    combatState.turnOrder = combatState.turnOrder.filter(function (t) { return t.id !== npcId; });
    if (combatState.currentTurnIndex >= combatState.turnOrder.length) {
      combatState.currentTurnIndex = Math.max(0, combatState.turnOrder.length - 1);
    }
    if (combatState.selectedId === npcId) combatState.selectedId = null;
    if (combatState.tokenPositions) delete combatState.tokenPositions[npcId];
    renderCombatTracker();
  }

  function addNpcToCombat(npcBuild) {
    if (!combatState) return;
    var nextId = 1;
    combatState.combatants.forEach(function (n) {
      var m = n.id.match(/^npc_(\d+)$/);
      if (m) nextId = Math.max(nextId, parseInt(m[1], 10) + 1);
    });
    var id = 'npc_' + nextId;
    var comp = npcBuild.computed || {};
    var maxPower = 0;
    if (comp.powers) {
      var pKeys = Object.keys(comp.powers);
      pKeys.forEach(function (k) { if (comp.powers[k] > maxPower) maxPower = comp.powers[k]; });
    }
    var rawName = npcBuild.name || 'Unknown NPC';
    var rawBase = rawName.replace(/ #\d+$/, '');
    var sameCount = 0;
    combatState.combatants.forEach(function (n) {
      if (n.name.replace(/ #\d+$/, '') === rawBase) sameCount++;
    });
    if (sameCount > 0) {
      var needsRenumber = [];
      combatState.combatants.forEach(function (n) {
        if (n.name.replace(/ #\d+$/, '') === rawBase) needsRenumber.push(n);
      });
      if (needsRenumber.length === 1 && needsRenumber[0].name === rawBase) {
        needsRenumber[0].name = rawBase + ' #1';
        var to = combatState.turnOrder.find(function (t) { return t.id === needsRenumber[0].id; });
        if (to) to.name = needsRenumber[0].name;
      }
      rawName = rawBase + ' #' + (sameCount + 1);
    }

    var entry = {
      id: id,
      name: rawName,
      type: 'npc',
      disposition: 'enemy',
      threat: npcBuild.classification || 'standard',
      tier: npcBuild.tier || 0,
      role: npcBuild.role || '',
      initiative: comp.initiative || (1 + (npcBuild.tier || 0)),
      power: comp.power || maxPower || 0,
      defense: comp.defense || 0,
      evasion: comp.evasion || 0,
      resist: comp.resist || 0,
      vitalityMax: comp.vitality || 5,
      vitalityCurrent: comp.vitality || 5,
      actions: comp.actions || 1,
      conditions: [],
      conditionArenas: {},
      roleKit: npcBuild.roleKit || null,
      computedAttacks: npcBuild.computedAttacks || [],
      arenas: npcBuild.arenas || {},
      damageTiers: comp.damageTiers || null,
      zone: null,
      npcData: npcBuild
    };
    combatState.combatants.push(entry);
    combatState.turnOrder.push({ id: id, type: 'npc', name: entry.name, initiative: entry.initiative });
    combatState.turnOrder.sort(function (a, b) { return (b.initiative || 0) - (a.initiative || 0); });
    combatState.selectedId = id;
    renderCombatTracker();
  }

  function showAddNpcPanel(anchorBtn) {
    var existing = document.querySelector('.ct-add-npc-panel');
    if (existing) { existing.remove(); return; }

    var saved = (window.NpcBuilder && window.NpcBuilder.getSavedNpcs) ? window.NpcBuilder.getSavedNpcs() : [];

    var panel = document.createElement('div');
    panel.className = 'ct-add-npc-panel';
    var html = '<div class="ct-add-npc-title">Add NPC to Combat</div>';
    if (saved.length === 0) {
      html += '<div class="ct-add-npc-empty">No saved NPCs. Build one in the Threat Builder first.</div>';
    } else {
      html += '<div class="ct-add-npc-list">';
      saved.forEach(function (npc, idx) {
        var cls = npc.classification || 'standard';
        var clsCssClass = cls === 'minion' ? 'minion' : cls === 'boss' ? 'boss' : cls === 'elite' ? 'elite' : 'standard';
        html += '<div class="ct-add-npc-item" data-saved-idx="' + idx + '">';
        html += '<span class="ct-add-npc-name">' + esc(npc.name || 'Unnamed') + '</span>';
        html += '<span class="ct-add-npc-meta ct-add-npc-meta--' + clsCssClass + '">' + esc(cls).toUpperCase() + ' T' + (npc.tier || 0) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    panel.innerHTML = html;

    anchorBtn.parentNode.appendChild(panel);

    panel.querySelectorAll('.ct-add-npc-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(item.dataset.savedIdx, 10);
        var npc = saved[idx];
        if (!npc) return;
        var build = JSON.parse(JSON.stringify(npc));
        if (window.NpcBuilder && window.NpcBuilder.calcStats) {
          var stats = window.NpcBuilder.calcStats(build);
          build.computed = stats;
        }
        addNpcToCombat(build);
        panel.remove();
      });
    });

    setTimeout(function () {
      function closePanel(e) {
        if (!panel.contains(e.target) && e.target !== anchorBtn) {
          panel.remove();
          document.removeEventListener('click', closePanel);
        }
      }
      document.addEventListener('click', closePanel);
    }, 10);
  }

  function editNpcInBuilder(npcId) {
    if (!combatState) return;
    var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
    if (!npc) return;

    var buildData = null;
    if (npc.npcData && npc.npcData.threatBuild) {
      buildData = JSON.parse(JSON.stringify(npc.npcData.threatBuild));
    } else if (npc.npcData && npc.npcData.arenas) {
      buildData = JSON.parse(JSON.stringify(npc.npcData));
    }
    if (!buildData) {
      buildData = {
        name: npc.name.replace(/ #\d+$/, ''),
        tier: npc.tier || 0,
        threatCategory: 'character',
        arenas: npc.arenas || { physique: 2, reflex: 2, grit: 2, wits: 2, presence: 2 },
        role: npc.role || '',
        classification: npc.threat || 'standard',
        traits: [], tags: [], loot: [], attacks: [],
        numPlayers: 4
      };
    }
    if (!buildData.name) buildData.name = npc.name.replace(/ #\d+$/, '');

    if (window.NpcBuilder && window.NpcBuilder.openWithNpc) {
      window.NpcBuilder.openWithNpc(buildData, function (updatedBuild) {
        if (!updatedBuild) return;
        var comp = updatedBuild.computed || {};
        npc.name = updatedBuild.name || npc.name;
        npc.tier = updatedBuild.tier != null ? updatedBuild.tier : npc.tier;
        npc.threat = updatedBuild.classification || npc.threat;
        npc.role = updatedBuild.role || npc.role;
        npc.initiative = comp.initiative || npc.initiative;
        npc.power = comp.power || npc.power;
        npc.defense = comp.defense || npc.defense;
        npc.evasion = comp.evasion || npc.evasion;
        npc.resist = comp.resist || npc.resist;
        npc.vitalityMax = comp.vitality || npc.vitalityMax;
        npc.vitalityCurrent = Math.min(npc.vitalityCurrent, npc.vitalityMax);
        npc.actions = comp.actions || npc.actions;
        npc.arenas = updatedBuild.arenas || npc.arenas;
        npc.roleKit = updatedBuild.roleKit || npc.roleKit;
        npc.computedAttacks = updatedBuild.computedAttacks || npc.computedAttacks || [];
        npc.damageTiers = comp.damageTiers || npc.damageTiers;
        npc.npcData = updatedBuild;

        var tEntry = combatState.turnOrder.find(function (t) { return t.id === npc.id; });
        if (tEntry) {
          tEntry.name = npc.name;
          tEntry.initiative = npc.initiative;
          combatState.turnOrder.sort(function (a, b) { return (b.initiative || 0) - (a.initiative || 0); });
        }
        renderCombatTracker();
      });
    }
  }

  function attachCombatEvents(container) {
    var endBtn = container.querySelector('#ct-end-encounter');
    if (endBtn) endBtn.addEventListener('click', endEncounter);

    var jbBtn = container.querySelector('#ct-trigger-jb');
    if (jbBtn) jbBtn.addEventListener('click', triggerJoinBattle);

    var addNpcBtn = container.querySelector('#ct-add-npc');
    if (addNpcBtn) addNpcBtn.addEventListener('click', function () { showAddNpcPanel(addNpcBtn); });

    container.querySelectorAll('.ct-npc-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var npcId = btn.dataset.npcId;
        var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
        var name = npc ? npc.name : 'this NPC';
        if (window.TacticalMapViewer && window.TacticalMapViewer._confirm) {
          window.TacticalMapViewer._confirm('Remove from Combat', 'Remove ' + name + ' from the encounter?', function () {
            removeNpcFromCombat(npcId);
          });
        } else {
          if (confirm('Remove ' + name + ' from combat?')) removeNpcFromCombat(npcId);
        }
      });
    });

    container.querySelectorAll('.ct-npc-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        editNpcInBuilder(btn.dataset.npcId);
      });
    });

    container.querySelectorAll('.ct-rail-disp').forEach(function (badge) {
      badge.addEventListener('click', function (e) {
        e.stopPropagation();
        var npcId = badge.dataset.npcId;
        var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
        if (!npc) return;
        var cycle = { enemy: 'neutral', neutral: 'ally', ally: 'enemy' };
        npc.disposition = cycle[npc.disposition || 'enemy'] || 'enemy';
        renderCombatTracker();
      });
    });

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
        if (!npcId) return;
        var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
        if (npc) {
          npcRemoveCond(npc, condId);
          if (condId === 'surprised') npc.surprised = false;
          renderCombatTracker();
        }
      });
    });

    container.querySelectorAll('.ct-add-condition-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConditionPanel(btn.dataset.npcId, 'npc');
      });
    });

    container.querySelectorAll('.ct-push-condition-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConditionPanel(btn.dataset.pcId, 'pc');
      });
    });

    container.querySelectorAll('.ct-push-to-pc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConditionPanel(null, 'pc', btn.dataset.npcName);
      });
    });

    container.querySelectorAll('[data-mastery-target]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var npcId = btn.dataset.masteryTarget;
        var pcId = btn.dataset.masteryPc;
        designateNpcSurprised(npcId);
        if (pcId) {
          var pc = combatState.pcSlots.find(function (p) { return p.id === pcId; });
          if (pc) pc.masteryUsed = true;
        }
        renderCombatTracker();
      });
    });

  }

  function renderUnplacedTray() {
    if (!combatState || !_ctMapKey) return '';
    var unplaced = combatState.combatants.filter(function (npc) {
      return !combatState.tokenPositions[npc.id];
    });
    if (unplaced.length === 0 && !_placementNpcId) return '';

    var html = '<div class="ct-unplaced-tray" id="ct-unplaced-tray">';
    if (_placementNpcId) {
      var placingNpc = combatState.combatants.find(function (n) { return n.id === _placementNpcId; });
      var placingName = placingNpc ? placingNpc.name : 'NPC';
      html += '<div class="ct-placement-hint">Click a zone on the map to place ' + esc(placingName) + ' — or click here to cancel</div>';
    } else {
      html += '<div class="ct-unplaced-label">Unplaced (' + unplaced.length + ')</div>';
      unplaced.forEach(function (npc) {
        var disp = npc.disposition || 'enemy';
        html += '<button class="ct-unplaced-npc" data-npc-id="' + esc(npc.id) + '">';
        html += '<span class="ct-unplaced-disp ct-unplaced-disp--' + esc(disp) + '"></span>';
        html += esc(npc.name);
        html += '</button>';
      });
    }
    html += '</div>';
    return html;
  }

  function attachUnplacedTrayEvents(container) {
    var tray = container.querySelector('#ct-unplaced-tray');
    if (!tray) return;

    if (_placementNpcId) {
      var hint = tray.querySelector('.ct-placement-hint');
      if (hint) {
        hint.addEventListener('click', function () {
          _cancelPlacement();
        });
      }
      return;
    }

    tray.querySelectorAll('.ct-unplaced-npc').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var npcId = btn.dataset.npcId;
        _startPlacement(npcId);
      });
    });
  }

  function _startPlacement(npcId) {
    _placementNpcId = npcId;
    if (_ctMapContainer) {
      var body = _ctMapContainer.querySelector('#ct-map-viewer-body');
      if (body) body.classList.add('tm-placement-mode');
    }
    _renderUnplacedTrayOnly();
  }

  function _cancelPlacement() {
    _placementNpcId = null;
    if (_ctMapContainer) {
      var body = _ctMapContainer.querySelector('#ct-map-viewer-body');
      if (body) body.classList.remove('tm-placement-mode');
    }
    _renderUnplacedTrayOnly();
  }

  function _placeNpcOnZone(zoneId) {
    if (!_placementNpcId || !combatState) return;
    var npcId = _placementNpcId;
    var pos = zoneId;
    if (_ctMapViewer && _ctMapViewer.meta && _ctMapViewer.meta.zones) {
      _ctMapViewer.meta.zones.forEach(function (z, i) {
        var zRoom = z.room || ('zone_' + i);
        if (zRoom === zoneId) {
          pos = { x: Math.round(z.x + z.w / 2), y: Math.round(z.y + z.h / 2) };
        }
      });
    }
    combatState.tokenPositions[npcId] = pos;
    var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
    if (npc) npc.zone = zoneId;
    persistTokenPosition(npcId, pos);
    _placementNpcId = null;
    if (_ctMapContainer) {
      var body = _ctMapContainer.querySelector('#ct-map-viewer-body');
      if (body) body.classList.remove('tm-placement-mode');
    }
    _renderUnplacedTrayOnly();
    _updateCombatTokens();
    syncStateToServer();
  }

  function _renderUnplacedTrayOnly() {
    var container = document.getElementById('combat-tracker-panel');
    if (!container) return;
    var oldTray = container.querySelector('#ct-unplaced-tray');
    var trayHtml = renderUnplacedTray();
    if (oldTray) {
      if (trayHtml) {
        var temp = document.createElement('div');
        temp.innerHTML = trayHtml;
        var newTray = temp.firstElementChild;
        oldTray.parentNode.replaceChild(newTray, oldTray);
        attachUnplacedTrayEvents(container);
      } else {
        oldTray.remove();
      }
    } else if (trayHtml && _ctMapContainer) {
      var temp2 = document.createElement('div');
      temp2.innerHTML = trayHtml;
      _ctMapContainer.after(temp2.firstElementChild);
      attachUnplacedTrayEvents(container);
    }
  }

  function _updateCombatTokens() {
    if (!_ctMapViewer || !combatState) return;
    var objectives = combatState.objectives || {};
    var tokenData = [];
    Object.keys(combatState.tokenPositions).forEach(function (tokId) {
      var pos = combatState.tokenPositions[tokId];
      if (!pos) return;
      var info = _resolveTokenInfo(tokId);
      if (typeof pos === 'object' && typeof pos.x === 'number' && typeof pos.y === 'number') {
        info.x = pos.x;
        info.y = pos.y;
      } else {
        info.zoneId = pos;
      }
      info.objective = !!objectives[tokId];
      tokenData.push(info);
    });
    _ctMapViewer.renderCombatTokens(tokenData, combatState.selectedId);
  }

  var _positionPersistTimer = null;
  function persistTokenPosition(tokenId, pos) {
    if (!combatState || !combatState.scene || !combatState.scene.id) return;
    var sceneId = combatState.scene.id;
    var tm = combatState.scene.tacticalMap || {};
    if (!tm.gmStartingPositions) tm.gmStartingPositions = {};

    if (tokenId === 'PCs') {
      tm.gmStartingPositions['PCs'] = pos;
    } else {
      var npcIdx = -1;
      combatState.combatants.forEach(function (n, i) {
        if (n.id === tokenId) npcIdx = i;
      });
      if (npcIdx >= 0) {
        tm.gmStartingPositions['npc_' + npcIdx] = pos;
      }
    }

    if (_positionPersistTimer) clearTimeout(_positionPersistTimer);
    _positionPersistTimer = setTimeout(function () {
      _positionPersistTimer = null;
      var payload = tm.gmStartingPositions;
      fetch('/api/campaign/scene/' + encodeURIComponent(sceneId) + '/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) console.error('Failed to persist token positions', r.status);
      }).catch(function (err) { console.error('Position persist error', err); });
    }, 500);
  }

  var _syncTimer = null;
  function syncStateToServer() {
    if (_syncTimer) return;
    _syncTimer = setTimeout(function () {
      _syncTimer = null;
      _doSyncStateToServer();
    }, 300);
  }
  function _doSyncStateToServer() {
    var sock = getSocket();
    if (!sock || !combatState) return;
    sock.emit('combat:sync-state', {
      combatants: combatState.combatants,
      pcSlots: combatState.pcSlots.map(function (p) {
        return { id: p.id, name: p.name, type: 'pc', initiative: p.initiative,
          conditions: p.conditions, surprised: p.surprised, mastery: p.mastery,
          controlResult: p.controlResult, vitality: p.vitality,
          arenas: p.arenas, disciplines: p.disciplines, vocations: p.vocations,
          species: p.species, archetype: p.archetype, connected: p.connected,
          activeEffects: p.activeEffects || [] };
      }),
      turnOrder: combatState.turnOrder,
      round: combatState.round,
      currentTurnIndex: combatState.currentTurnIndex,
      tokenPositions: combatState.tokenPositions,
      objectives: combatState.objectives || {},
      encounterName: combatState.encounter ? combatState.encounter.name : '',
      highestTier: combatState.highestTier,
      joinBattleSent: combatState.joinBattleSent,
      tacticalMap: combatState.tacticalMap || null
    });
  }

  var _origRenderCombatTracker = renderCombatTracker;
  renderCombatTracker = function () {
    _origRenderCombatTracker();
    syncStateToServer();
    renderConditionPanel();
  };

  function restoreFromState(serverState) {
    if (!serverState || !serverState.active) return;

    combatState = {
      encounter: { name: serverState.encounterName || 'Combat' },
      scene: {},
      round: serverState.round || 1,
      currentTurnIndex: serverState.currentTurnIndex || 0,
      highestTier: serverState.highestTier || 0,
      combatants: serverState.combatants || [],
      pcSlots: serverState.pcSlots || [],
      selectedId: null,
      collapsed: false,
      tacticalMap: serverState.tacticalMap || null,
      turnOrder: serverState.turnOrder || [],
      tokenPositions: serverState.tokenPositions || {},
      objectives: serverState.objectives || {},
      selectedToken: null,
      joinBattleSent: serverState.joinBattleSent !== false,
      pcResponses: serverState.responses || {}
    };

    var sock = getSocket();
    if (sock) {
      _cleanupSocketHandlers();

      function onJoinResult(data) {
        if (!combatState) return;
        combatState.pcResponses[String(data.characterId)] = data;
        var pc = combatState.pcSlots.find(function (p) { return p.id === String(data.characterId); });
        if (!pc) {
          pc = {
            id: String(data.characterId),
            name: data.name || 'Unknown',
            type: 'pc',
            initiative: 0,
            conditions: [],
            vocations: [],
            species: '',
            archetype: '',
            connected: true
          };
          combatState.pcSlots.push(pc);
          var defaultZone = _getPcDefaultZone();
          if (defaultZone) {
            combatState.tokenPositions[pc.id] = defaultZone;
          }
          _fetchAndFillPcProfile(pc);
        }
        pc.initiative = data.initiative;
        pc.surprised = data.surprised;
        pc.mastery = data.mastery;
        pc.controlResult = data.controlResult;
        rebuildTurnOrder();
        _origRenderCombatTracker();
        syncStateToServer();
      }

      function onAllJoined() {
        if (!combatState) return;
        rebuildTurnOrder();
        _origRenderCombatTracker();
        syncStateToServer();
      }

      function onPlayerSync(data) {
        if (!combatState) return;
        var pc = combatState.pcSlots.find(function (p) { return p.id === String(data.characterId); });
        if (pc) {
          var effs = data.effects || [];
          pc.conditions = effs.map(function (e) { return e.effectId || e; });
          pc.activeEffects = effs.filter(function (e) { return e.effectId; });
          _origRenderCombatTracker();
          syncStateToServer();
        }
      }

      function onApplyAck(data) {
        if (!combatState || !data || !data.entry) return;
        var pc = combatState.pcSlots.find(function (p) { return p.id === String(data.characterId); });
        if (pc) {
          if (!pc.conditions) pc.conditions = [];
          var condId = data.entry.effectId;
          if (pc.conditions.indexOf(condId) === -1) {
            pc.conditions.push(condId);
          }
          if (!pc.activeEffects) pc.activeEffects = [];
          var existing = pc.activeEffects.findIndex(function (e) { return e.uid === data.entry.uid; });
          if (existing === -1) pc.activeEffects.push(data.entry);
          _origRenderCombatTracker();
          syncStateToServer();
        }
      }

      sock.on('combat:join-battle-result', onJoinResult);
      sock.on('combat:all-joined', onAllJoined);
      sock.on('condition:player-sync', onPlayerSync);
      sock.on('condition:apply-ack', onApplyAck);

      _socketHandlers = [
        { event: 'combat:join-battle-result', fn: onJoinResult },
        { event: 'combat:all-joined', fn: onAllJoined },
        { event: 'condition:player-sync', fn: onPlayerSync },
        { event: 'condition:apply-ack', fn: onApplyAck }
      ];
    }

    combatState.combatants.forEach(function (npc) { migrateNpcConditions(npc); });
    setupRightColumnTabs();

    var container = document.getElementById('combat-tracker-panel');
    if (container) {
      container.style.display = 'block';
      _origRenderCombatTracker();
    }
    renderConditionPanel();
  }

  function applyTurnAdvance(data) {
    if (!combatState) return;
    if (data.currentTurnIndex !== undefined) combatState.currentTurnIndex = data.currentTurnIndex;
    if (data.round !== undefined) combatState.round = data.round;
    combatState.selectedId = null;
    renderCombatTracker();
  }

  window.CombatTracker = {
    start: startEncounter,
    end: endEncounter,
    restore: restoreFromState,
    applyTurnAdvance: applyTurnAdvance,
    getState: function () { return combatState; },
    isActive: function () { return combatState !== null; }
  };
}());

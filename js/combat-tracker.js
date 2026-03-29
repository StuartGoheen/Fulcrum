(function () {
  'use strict';

  var CONDITIONS = [
    { id: 'shaken', name: 'Shaken', color: '#f59e0b', effect: 'Outgoing results drop 1 tier. Affects own actions, not incoming attacks.' },
    { id: 'rattled', name: 'Rattled', color: '#f97316', effect: 'Step Down Control Die on social and Wits-based rolls.' },
    { id: 'disoriented', name: 'Disoriented', color: '#818cf8', effect: 'Step Down Control Die on the affected action.' },
    { id: 'exposed', name: 'Exposed', color: '#ef4444', effect: 'Attacks against this target resolve +1 Effect Tier.' },
    { id: 'bleeding', name: 'Bleeding', color: '#dc2626', effect: 'Lose 1 Vitality at start of each turn. Persists until treated.' },
    { id: 'slowed', name: 'Slowed', color: '#6b7280', effect: 'Max 1 zone movement per round. Shifts create Openings if Engaged.' },
    { id: 'stunned', name: 'Stunned', color: '#a855f7', effect: 'Step Down Control Die on all rolls. Compounds with Disoriented.' },
    { id: 'pinned', name: 'Pinned', color: '#78716c', effect: 'Prone and held. Cannot move. Exposed to all Melee attacks.' },
    { id: 'weakened', name: 'Weakened', color: '#92400e', effect: 'Step Down Power Die on all rolls.' },
    { id: 'broken', name: 'Broken', color: '#1f2937', effect: 'Cannot take offensive actions. May only Defend, Move, or Surrender.' }
  ];


  var COVER_LABELS = {
    'none': 'No Cover',
    'light': 'Light',
    'hard': 'Hard',
    'full': 'Full'
  };

  var LIGHTING_ICONS = {
    'normal': '&#9728;',
    'dim': '&#9789;',
    'shadow': '&#9790;'
  };

  var combatState = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function startEncounter(encounter, scene, npcs, partyData) {
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
          npcEntries.push({
            id: 'npc_' + npcIdCounter,
            name: label,
            type: 'npc',
            threat: enemy.threat || enemy.classification || 'standard',
            tier: tier,
            role: enemy.role || '',
            initiative: npcData && npcData.threatBuild ? npcData.threatBuild.computed.initiative : (1 + tier),
            power: npcData && npcData.threatBuild ? npcData.threatBuild.computed.power : 0,
            defense: npcData && npcData.threatBuild ? npcData.threatBuild.computed.defense : 0,
            evasion: npcData && npcData.threatBuild ? npcData.threatBuild.computed.evasion : 0,
            resist: npcData && npcData.threatBuild ? npcData.threatBuild.computed.resist : 0,
            vitalityMax: npcData && npcData.threatBuild ? npcData.threatBuild.computed.vitality : 5,
            vitalityCurrent: npcData && npcData.threatBuild ? npcData.threatBuild.computed.vitality : 5,
            actions: npcData && npcData.threatBuild ? npcData.threatBuild.computed.actions : 1,
            conditions: [],
            roleKit: npcData && npcData.threatBuild ? npcData.threatBuild.roleKit : null,
            zone: null
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
          id: 'pc_' + (pc.id || pc.name.toLowerCase().replace(/\s+/g, '_')),
          name: pc.name,
          initiative: 0
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
      collapsed: false,
      tacticalMap: scene.tacticalMap || null,
      turnOrder: [],
      tokenPositions: {},
      selectedToken: null
    };

    rebuildTurnOrder();

    if (pcTokenZone) {
      combatState.tokenPositions['PCs'] = pcTokenZone;
    }
    npcEntries.forEach(function (npc) {
      if (npc.zone) combatState.tokenPositions[npc.id] = npc.zone;
    });

    renderCombatTracker();
  }

  function endEncounter() {
    combatState = null;
    var container = document.getElementById('combat-tracker-panel');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
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

  function renderCombatTracker() {
    var container = document.getElementById('combat-tracker-panel');
    if (!container || !combatState) return;
    container.style.display = 'block';

    var html = '';
    html += '<div class="ct-header">';
    html += '<div class="ct-title">' + esc(combatState.encounter.name) + '</div>';
    html += '<div class="ct-round">Round <span id="ct-round-num">' + combatState.round + '</span></div>';
    html += '<div class="ct-header-actions">';
    html += '<button class="ct-collapse-btn" id="ct-collapse">' + (combatState.collapsed ? '&#9654; Expand' : '&#9660; Collapse') + '</button>';
    html += '<button class="ct-end-btn" id="ct-end-encounter">End Encounter</button>';
    html += '</div>';
    html += '</div>';

    if (!combatState.collapsed) {
      html += renderJoinBattleRef();
      html += renderInitiativeTracker();
      html += renderNpcCards();
      if (combatState.tacticalMap) {
        html += renderTacticalMap();
      }
    }

    container.innerHTML = html;
    attachCombatEvents(container);
  }

  function renderJoinBattleRef() {
    var tier = combatState.highestTier;
    var html = '<div class="ct-jb-ref">';
    html += '<div class="ct-section-label">Join Battle Reference</div>';
    html += '<div class="ct-jb-body">';
    html += '<div class="ct-jb-rule"><span class="ct-jb-key">Control Step-Down:</span> Highest enemy Tier = <strong>' + tier + '</strong> &rarr; step down Control Die <strong>' + tier + '</strong> time' + (tier !== 1 ? 's' : '') + '</div>';
    html += '<div class="ct-jb-rule ct-jb-fail"><span class="ct-jb-key">Failed Control (1-3):</span> PC is <strong>surprised</strong> &mdash; [Disoriented] + [Exposed] until end of first turn</div>';
    html += '<div class="ct-jb-rule ct-jb-master"><span class="ct-jb-key">Mastery (8+):</span> PC designates one enemy as surprised &mdash; [Disoriented] + [Exposed] on that NPC</div>';
    html += '<div class="ct-jb-rule"><span class="ct-jb-key">Power Die result</span> = initiative slot (higher acts first). NPCs act at static Initiative (Wits + Tier).</div>';
    html += '</div></div>';
    return html;
  }

  function renderInitiativeTracker() {
    var html = '<div class="ct-initiative">';
    html += '<div class="ct-section-label">Initiative Order</div>';

    html += '<div class="ct-pc-inputs" id="ct-pc-inputs">';
    html += '<div class="ct-add-pc-row">';
    html += '<input type="text" class="ct-input ct-pc-name-input" id="ct-new-pc-name" placeholder="PC Name" />';
    html += '<input type="number" class="ct-input ct-pc-init-input" id="ct-new-pc-init" placeholder="Init" min="1" max="15" />';
    html += '<button class="ct-add-pc-btn" id="ct-add-pc">+ Add PC</button>';
    html += '</div>';
    html += '</div>';

    var turnOrder = getTurnOrder();
    html += '<div class="ct-turn-list" id="ct-turn-list">';
    turnOrder.forEach(function (c, idx) {
      var isCurrent = idx === combatState.currentTurnIndex;
      var isNpc = c.type === 'npc';
      var cls = 'ct-turn-entry' + (isCurrent ? ' ct-current-turn' : '') + (isNpc ? ' ct-npc-entry' : ' ct-pc-entry');
      html += '<div class="' + cls + '">';
      if (!isNpc) {
        html += '<input type="number" class="ct-input ct-inline-init" data-pc-id="' + esc(c.id) + '" value="' + c.initiative + '" min="1" max="15" title="Edit initiative" />';
      } else {
        html += '<span class="ct-turn-init">' + c.initiative + '</span>';
      }
      html += '<span class="ct-turn-name">' + esc(c.name) + '</span>';
      html += '<span class="ct-turn-type ' + (isNpc ? 'ct-type-npc' : 'ct-type-pc') + '">' + (isNpc ? 'NPC' : 'PC') + '</span>';
      html += '<span class="ct-reorder-btns">';
      html += '<button class="ct-reorder-btn" data-dir="up" data-idx="' + idx + '"' + (idx === 0 ? ' disabled' : '') + '>&uarr;</button>';
      html += '<button class="ct-reorder-btn" data-dir="down" data-idx="' + idx + '"' + (idx === turnOrder.length - 1 ? ' disabled' : '') + '>&darr;</button>';
      html += '</span>';
      if (!isNpc) {
        html += '<button class="ct-remove-pc" data-pc-id="' + esc(c.id) + '">&times;</button>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="ct-turn-controls">';
    html += '<button class="ct-ctrl-btn" id="ct-prev-turn">&larr; Prev Turn</button>';
    html += '<button class="ct-ctrl-btn ct-ctrl-primary" id="ct-next-turn">Next Turn &rarr;</button>';
    html += '<button class="ct-ctrl-btn" id="ct-next-round">Next Round &#8635;</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderNpcCards() {
    if (!combatState) return '';
    var html = '<div class="ct-npc-cards">';
    html += '<div class="ct-section-label">NPC Combat Status</div>';

    combatState.combatants.forEach(function (npc) {
      var hpPercent = npc.vitalityMax > 0 ? Math.max(0, Math.min(100, (npc.vitalityCurrent / npc.vitalityMax) * 100)) : 0;
      var hpColor = hpPercent > 60 ? '#22c55e' : hpPercent > 30 ? '#eab308' : '#ef4444';
      var isDown = npc.vitalityCurrent <= 0;

      html += '<div class="ct-npc-card' + (isDown ? ' ct-npc-down' : '') + '" data-npc-id="' + esc(npc.id) + '">';
      html += '<div class="ct-npc-card-header">';
      html += '<div class="ct-npc-card-name">' + esc(npc.name) + '</div>';
      var threatColor = npc.threat === 'minion' ? '#6b7280' : npc.threat === 'boss' ? '#ef4444' : 'var(--color-accent-primary)';
      html += '<span class="ct-npc-threat" style="color:' + threatColor + ';">' + esc(npc.threat).toUpperCase() + '</span>';
      html += '</div>';

      html += '<div class="ct-npc-stats">';
      html += '<span class="ct-stat" title="Power">PWR <strong>' + npc.power + '</strong></span>';
      html += '<span class="ct-stat" title="Defense">DEF <strong>' + npc.defense + '</strong></span>';
      html += '<span class="ct-stat" title="Evasion">EVA <strong>' + npc.evasion + '</strong></span>';
      html += '<span class="ct-stat" title="Resist">RES <strong>' + npc.resist + '</strong></span>';
      html += '<span class="ct-stat" title="Initiative">INIT <strong>' + npc.initiative + '</strong></span>';
      html += '</div>';

      html += '<div class="ct-vitality-row">';
      html += '<button class="ct-vit-btn ct-vit-minus" data-npc-id="' + esc(npc.id) + '" data-delta="-1">&minus;</button>';
      html += '<div class="ct-vitality-bar-wrap">';
      html += '<div class="ct-vitality-bar" style="width:' + hpPercent + '%;background:' + hpColor + ';"></div>';
      html += '<span class="ct-vitality-text">' + npc.vitalityCurrent + ' / ' + npc.vitalityMax + '</span>';
      html += '</div>';
      html += '<button class="ct-vit-btn ct-vit-plus" data-npc-id="' + esc(npc.id) + '" data-delta="1">+</button>';
      html += '</div>';

      html += '<div class="ct-conditions-row">';
      html += '<div class="ct-active-conditions" data-npc-id="' + esc(npc.id) + '">';
      npc.conditions.forEach(function (cid) {
        var cond = CONDITIONS.find(function (c) { return c.id === cid; });
        if (cond) {
          html += '<span class="ct-condition-chip" style="background:' + cond.color + '22;color:' + cond.color + ';border-color:' + cond.color + '44;" title="' + esc(cond.effect) + '" data-npc-id="' + esc(npc.id) + '" data-cond="' + cond.id + '">' + esc(cond.name) + ' &times;</span>';
        }
      });
      html += '</div>';
      html += '<button class="ct-add-condition-btn" data-npc-id="' + esc(npc.id) + '">+ Condition</button>';
      html += '</div>';

      if (npc.roleKit) {
        html += '<details class="ct-rolekit-details">';
        html += '<summary class="ct-rolekit-summary">Role Kit</summary>';
        html += '<div class="ct-rolekit-body">';
        if (npc.roleKit.passive) {
          html += '<div class="ct-rk-entry"><span class="ct-rk-label">Passive:</span> <strong>' + esc(npc.roleKit.passive.name) + '</strong> &mdash; ' + esc(npc.roleKit.passive.description) + '</div>';
        }
        if (npc.roleKit.actions) {
          npc.roleKit.actions.forEach(function (a) {
            html += '<div class="ct-rk-entry"><span class="ct-rk-label">Action:</span> <strong>' + esc(a.name) + '</strong> &mdash; ' + esc(a.description) + '</div>';
          });
        }
        if (npc.roleKit.maneuver) {
          html += '<div class="ct-rk-entry"><span class="ct-rk-label">Maneuver:</span> <strong>' + esc(npc.roleKit.maneuver.name) + '</strong> &mdash; ' + esc(npc.roleKit.maneuver.description) + '</div>';
        }
        if (npc.roleKit.gambit) {
          html += '<div class="ct-rk-entry"><span class="ct-rk-label">Gambit:</span> <strong>' + esc(npc.roleKit.gambit.name) + '</strong> (' + esc(npc.roleKit.gambit.cost) + ') &mdash; ' + esc(npc.roleKit.gambit.description) + '</div>';
        }
        if (npc.roleKit.exploit) {
          html += '<div class="ct-rk-entry"><span class="ct-rk-label">Exploit:</span> <strong>' + esc(npc.roleKit.exploit.name) + '</strong> &mdash; ' + esc(npc.roleKit.exploit.description) + '</div>';
        }
        html += '</div></details>';
      }

      html += '</div>';
    });

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

  function attachCombatEvents(container) {
    var endBtn = container.querySelector('#ct-end-encounter');
    if (endBtn) endBtn.addEventListener('click', endEncounter);

    var collapseBtn = container.querySelector('#ct-collapse');
    if (collapseBtn) collapseBtn.addEventListener('click', function () {
      combatState.collapsed = !combatState.collapsed;
      renderCombatTracker();
    });

    var addPcBtn = container.querySelector('#ct-add-pc');
    if (addPcBtn) addPcBtn.addEventListener('click', function () {
      var nameInput = container.querySelector('#ct-new-pc-name');
      var initInput = container.querySelector('#ct-new-pc-init');
      var name = (nameInput.value || '').trim();
      var init = parseInt(initInput.value, 10);
      if (!name || isNaN(init)) return;
      combatState.pcSlots.push({
        id: 'pc_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
        name: name,
        initiative: init
      });
      rebuildTurnOrder();
      combatState.currentTurnIndex = 0;
      renderCombatTracker();
    });

    container.querySelectorAll('.ct-remove-pc').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pcId = btn.dataset.pcId;
        combatState.pcSlots = combatState.pcSlots.filter(function (p) { return p.id !== pcId; });
        combatState.turnOrder = combatState.turnOrder.filter(function (e) { return e.id !== pcId; });
        combatState.currentTurnIndex = 0;
        renderCombatTracker();
      });
    });

    container.querySelectorAll('.ct-reorder-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.idx, 10);
        var dir = btn.dataset.dir;
        var order = combatState.turnOrder;
        if (!order || isNaN(idx)) return;
        var swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= order.length) return;
        var tmp = order[idx];
        order[idx] = order[swapIdx];
        order[swapIdx] = tmp;
        if (combatState.currentTurnIndex === idx) {
          combatState.currentTurnIndex = swapIdx;
        } else if (combatState.currentTurnIndex === swapIdx) {
          combatState.currentTurnIndex = idx;
        }
        renderCombatTracker();
      });
    });

    container.querySelectorAll('.ct-inline-init').forEach(function (input) {
      input.addEventListener('change', function () {
        var pcId = input.dataset.pcId;
        var newInit = parseInt(input.value, 10);
        if (isNaN(newInit) || newInit < 1) return;
        var pc = combatState.pcSlots.find(function (p) { return p.id === pcId; });
        if (pc) pc.initiative = newInit;
        var currentId = combatState.turnOrder[combatState.currentTurnIndex] ? combatState.turnOrder[combatState.currentTurnIndex].id : null;
        rebuildTurnOrder();
        if (currentId) {
          for (var ri = 0; ri < combatState.turnOrder.length; ri++) {
            if (combatState.turnOrder[ri].id === currentId) { combatState.currentTurnIndex = ri; break; }
          }
        }
        renderCombatTracker();
      });
    });

    var nextTurnBtn = container.querySelector('#ct-next-turn');
    if (nextTurnBtn) nextTurnBtn.addEventListener('click', function () {
      var order = getTurnOrder();
      if (order.length === 0) return;
      combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % order.length;
      if (combatState.currentTurnIndex === 0) combatState.round++;
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
      renderCombatTracker();
    });

    var nextRoundBtn = container.querySelector('#ct-next-round');
    if (nextRoundBtn) nextRoundBtn.addEventListener('click', function () {
      combatState.round++;
      combatState.currentTurnIndex = 0;
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
        var npcId = btn.dataset.npcId;
        showConditionPalette(btn, npcId);
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

  function showConditionPalette(anchorEl, npcId) {
    var existing = document.querySelector('.ct-condition-palette');
    if (existing) existing.remove();

    var npc = combatState.combatants.find(function (n) { return n.id === npcId; });
    if (!npc) return;

    var palette = document.createElement('div');
    palette.className = 'ct-condition-palette';

    var html = '<div class="ct-palette-title">Apply Condition</div>';
    CONDITIONS.forEach(function (cond) {
      var active = npc.conditions.indexOf(cond.id) !== -1;
      html += '<div class="ct-palette-item' + (active ? ' ct-palette-active' : '') + '" data-cond="' + cond.id + '" data-npc-id="' + esc(npcId) + '" title="' + esc(cond.effect) + '">';
      html += '<span class="ct-palette-dot" style="background:' + cond.color + ';"></span>';
      html += '<span class="ct-palette-name">' + esc(cond.name) + '</span>';
      html += '<span class="ct-palette-effect">' + esc(cond.effect) + '</span>';
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

  window.CombatTracker = {
    start: startEncounter,
    end: endEncounter,
    isActive: function () { return combatState !== null; }
  };
}());

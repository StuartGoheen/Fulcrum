(function () {
  const SESSION_KEY = 'eote-session';

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (_) {
      return null;
    }
  }

  function setConnectionIndicator(status) {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;

    const styles = {
      connected:    { background: '#4CAF50', title: 'Connected' },
      disconnected: { background: 'var(--color-accent-secondary)', title: 'Disconnected' },
      connecting:   { background: 'var(--color-text-secondary)', title: 'Connecting...' },
    };

    const s = styles[status] || styles.connecting;
    indicator.style.background = s.background;
    indicator.title = s.title;
  }

  var _currentSocket = null;
  var _lastPool = [];

  function renderDestinyPool(pool) {
    var tracker = document.getElementById('force-tracker');
    if (!tracker) return;
    if (!pool || pool.length === 0) {
      tracker.innerHTML = '<span style="font-size:0.7rem;color:var(--color-text-secondary);font-style:italic;">No crew connected</span>';
      _lastPool = [];
      return;
    }
    _lastPool = pool;

    var indexed = pool.map(function (t, i) { return { token: t, origIdx: i }; });
    indexed.sort(function (a, b) {
      if (a.token.side === b.token.side) return 0;
      return a.token.side === 'toll' ? -1 : 1;
    });

    tracker.innerHTML = indexed.map(function (item) {
      var t = item.token;
      var cls = 'destiny-token';
      cls += t.side === 'toll' ? ' destiny-token--toll' : ' destiny-token--hope';
      if (t.tapped) cls += ' destiny-token--tapped';
      var canTap = !t.tapped;
      var title = (t.side === 'toll' ? 'Toll' : 'Hope') + (t.tapped ? ' (tapped)' : '');
      if (canTap) title += ' \u2014 click to tap';
      var symbol = t.side === 'toll' ? '\u25CF' : '\u25CF';
      return '<span class="' + cls + '" data-dest-idx="' + item.origIdx + '" title="' + title + '"' +
        (canTap ? ' style="cursor:pointer;"' : '') + '>' + symbol + '</span>';
    }).join('');

    _renderDestinyState(pool);
  }

  function _renderDestinyState(pool) {
    var el = document.getElementById('destiny-state');
    if (!el) return;
    if (!pool || pool.length === 0) { el.innerHTML = ''; return; }

    var hope = 0; var toll = 0;
    pool.forEach(function (t) {
      if (t.side === 'hope') hope++;
      else toll++;
    });

    var diff = hope - toll;
    var label, cls, bonus;

    if (diff >= 4) {
      label = 'Soft Touch';
      cls = 'destiny-state--soft-touch';
      bonus = '+1 Charm/Persuasion \u2022 \u22121 Intimidate/Deception';
    } else if (diff >= 2) {
      label = 'Hope Dominant';
      cls = 'destiny-state--hope';
      bonus = '+1 Charm/Persuasion';
    } else if (diff === 0) {
      label = 'Equilibrium';
      cls = 'destiny-state--equilibrium';
      bonus = 'No passive bonuses';
    } else if (diff <= -4) {
      label = 'The Monster';
      cls = 'destiny-state--monster';
      bonus = '+1 Intimidate/Deception \u2022 \u22121 Charm/Persuasion';
    } else {
      label = 'Toll Dominant';
      cls = 'destiny-state--toll';
      bonus = '+1 Intimidate/Deception';
    }

    el.className = 'destiny-state ' + cls;
    el.innerHTML = '<span class="destiny-state-label">' + label + '</span>' +
      '<span class="destiny-state-bonus">' + bonus + '</span>';
  }

  document.addEventListener('click', function (e) {
    var pip = e.target.closest('.destiny-token[data-dest-idx]');
    if (!pip || !_currentSocket) return;
    var idx = parseInt(pip.getAttribute('data-dest-idx'), 10);
    if (isNaN(idx)) return;
    var t = _lastPool[idx];
    if (!t || t.tapped) return;
    _currentSocket.emit('destiny:tap', { index: idx });
  });

  function updateCrewList(connectedPlayers) {
    const crewList = document.getElementById('crew-list');
    if (!crewList) return;

    if (!connectedPlayers || connectedPlayers.length === 0) {
      crewList.innerHTML = '<li style="color:var(--color-text-secondary);">No crew online</li>';
      return;
    }

    crewList.innerHTML = connectedPlayers
      .map((p) => `<li style="color:var(--color-text-primary);">${p.name}</li>`)
      .join('');
  }

  function init() {
    const session = getSession();
    const characterDisplay = document.getElementById('character-display');
    const statusCharacter  = document.getElementById('status-character');
    const statusConnection = document.getElementById('status-connection');

    if (session && session.characterName && characterDisplay) {
      characterDisplay.textContent = session.characterName;
    }
    if (session && session.characterName && statusCharacter) {
      statusCharacter.textContent = session.characterName;
    }

    setConnectionIndicator('connecting');

    const socket = io({
      reconnection:        true,
      reconnectionDelay:   1000,
      reconnectionAttempts: 10,
    });

    window._socket = socket;
    _currentSocket = socket;
    const connectedPlayers = [];

    socket.on('connect', () => {
      setConnectionIndicator('connected');
      if (statusConnection) statusConnection.textContent = 'Online';

      if (session) {
        socket.emit('session:join', {
          role:          session.role,
          characterId:   session.characterId || null,
          sessionToken:  session.token,
        });
      }
    });

    socket.on('disconnect', () => {
      setConnectionIndicator('disconnected');
      if (statusConnection) statusConnection.textContent = 'Offline';
    });

    socket.on('connect_error', () => {
      setConnectionIndicator('disconnected');
      console.warn('[socket] Connection error');
    });

    socket.on('state:sync', ({ state }) => {
    });

    socket.on('destiny:sync', ({ pool }) => {
      renderDestinyPool(pool);
    });

    socket.on('player:connected', ({ characterId, name }) => {
      if (!connectedPlayers.find((p) => p.characterId === characterId)) {
        connectedPlayers.push({ characterId, name });
      }
      updateCrewList(connectedPlayers);
    });

    socket.on('player:disconnected', ({ characterId, name }) => {
      const idx = connectedPlayers.findIndex((p) => p.characterId === characterId);
      if (idx !== -1) connectedPlayers.splice(idx, 1);
      updateCrewList(connectedPlayers);
    });

    socket.on('error', ({ message }) => {
      console.error('[socket] Server error:', message);
    });

    _setupDecisionSocketListeners(socket);

    socket.on('combat:join-battle-prompt', ({ encounterName, highestTier }) => {
      _showJoinBattleModal(encounterName, highestTier);
    });

    socket.on('combat:state', function (data) {
      if (!data || !data.active) return;
      if (data.alreadyJoined) {
        var modal = document.getElementById('join-battle-modal');
        if (modal) modal.remove();
        _showInitiativeTracker(data);
        _renderPlayerCombatTokens(data);
      }
    });

    socket.on('combat:state-update', function (data) {
      if (!data || !data.active) return;
      _showInitiativeTracker(data);
      _renderPlayerCombatTokens(data);
    });

    socket.on('combat:ended', () => {
      var modal = document.getElementById('join-battle-modal');
      if (modal) modal.remove();
      var tracker = document.getElementById('player-init-tracker');
      if (tracker) tracker.remove();
    });

    socket.on('condition:applied', (entry) => {
      if (window.EffectManager && window.EffectManager.applyEffect) {
        window.EffectManager.applyEffect(entry.effectId, entry.target || 'universal', entry.duration || 'tactical', entry.hazardValue || 0);
      }
    });

    socket.on('condition:removed', ({ conditionId, uid }) => {
      if (window.EffectManager) {
        if (uid) {
          window.EffectManager.removeEffect(uid);
        } else if (conditionId) {
          var effects = window.EffectManager.activeEffects || [];
          for (var i = 0; i < effects.length; i++) {
            if (effects[i].effectId === conditionId) {
              window.EffectManager.removeEffect(effects[i].uid);
              break;
            }
          }
        }
      }
    });

    document.addEventListener('effects:changed', function () {
      if (window.EffectManager && socket && socket.connected) {
        var effects = window.EffectManager.activeEffects || [];
        var summary = effects.map(function (e) { return { effectId: e.effectId, target: e.target, uid: e.uid, duration: e.duration, hazardValue: e.hazardValue, source: e.source }; });
        socket.emit('condition:sync', { effects: summary });
      }
    });

    socket.on('inventory:added', function (data) {
      var char = window.CharacterPanel && window.CharacterPanel.currentChar;
      if (!char || String(char.id) !== String(data.charId)) return;
      fetch('/api/characters/' + encodeURIComponent(char.id))
        .then(function (res) { return res.json(); })
        .then(function (updated) {
          if (window.CharacterPanel) window.CharacterPanel.currentChar = updated;
          document.dispatchEvent(new CustomEvent('character:stateChanged'));
        });
    });

    socket.on('tutorial:start', function (data) {
      _showTutorialPanel(data);
    });

    socket.on('tutorial:phase', function (data) {
      _updateTutorialPhase(data);
    });

    socket.on('tutorial:end', function () {
      _closeTutorialPanel();
    });

    socket.on('challenge:start', function (data) {
      _showChallengeModal(data);
    });

    socket.on('challenge:resolved', function (data) {
      _showChallengeResolutionToast(data);
    });

    socket.on('session:joined', function (joinData) {
      if (joinData && joinData.playerToken) {
        window._playerToken = joinData.playerToken;
      }
      socket.emit('combat:request');
      _checkForActiveChallenge();
    });

    _initPlayerTacticalMap(socket);
  }

  var _playerMapViewer = null;
  var _playerMapKey = '';
  var _pendingPlayerCombatState = null;

  function _resolvePlayerTokenInfo(tokId, combatants, pcSlots) {
    var shortName = tokId;
    var type = 'pc';
    var disposition = null;
    if (tokId === 'PCs') {
      shortName = 'PCs';
    } else {
      var pc = (pcSlots || []).find(function (p) { return p.id === tokId; });
      if (pc) {
        shortName = pc.name.length > 8 ? pc.name.substring(0, 7) + '.' : pc.name;
        type = 'pc';
      } else {
        var npc = (combatants || []).find(function (n) { return n.id === tokId; });
        if (npc) {
          var numMatch = npc.name.match(/ #(\d+)$/);
          var numSuffix = numMatch ? ' #' + numMatch[1] : '';
          var nameBase = numMatch ? npc.name.replace(/ #\d+$/, '') : npc.name;
          var maxBase = 8 - numSuffix.length;
          shortName = nameBase.length > maxBase ? nameBase.substring(0, maxBase - 1) + '.' + numSuffix : npc.name;
          type = 'npc';
          disposition = npc.disposition || 'enemy';
        }
      }
    }
    return { id: tokId, shortName: shortName, type: type, disposition: disposition };
  }

  function _renderPlayerCombatTokens(state) {
    if (!state || !state.tokenPositions) return;
    _pendingPlayerCombatState = state;
    if (!_playerMapViewer) {
      if (state.mapKey && state.mapKey !== _playerMapKey) {
        return;
      }
      return;
    }
    if (!_playerMapViewer.meta) return;
    var tokenPositions = state.tokenPositions;
    var objectives = state.objectives || {};
    var tokenData = [];
    Object.keys(tokenPositions).forEach(function (tokId) {
      var zoneId = tokenPositions[tokId];
      if (!zoneId) return;
      var info = _resolvePlayerTokenInfo(tokId, state.combatants || [], state.pcSlots || []);
      info.zoneId = zoneId;
      info.objective = !!objectives[tokId];
      tokenData.push(info);
    });
    _playerMapViewer.renderCombatTokens(tokenData);
  }

  function _showPlayerTokenDetails(tokenId, state) {
    if (!state) return;
    var npc = (state.combatants || []).find(function (n) { return n.id === tokenId; });
    if (!npc) return;
    var dispLabel = npc.disposition === 'ally' ? 'Ally' : npc.disposition === 'neutral' ? 'Neutral' : 'Enemy';
    var objectives = state.objectives || {};
    var details = [
      { key: 'Type', value: 'NPC' },
      { key: 'Disposition', value: dispLabel }
    ];
    if (objectives[tokenId]) {
      details.push({ key: 'Objective', value: 'Yes' });
    }
    var existing = document.getElementById('tm-dialog-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'tm-dialog-overlay';
    overlay.className = 'tm-dialog-overlay';
    var box = document.createElement('div');
    box.className = 'tm-dialog-box';
    var titleEl = document.createElement('div');
    titleEl.className = 'tm-dialog-title';
    titleEl.textContent = _escHtml(npc.name);
    box.appendChild(titleEl);
    details.forEach(function (d) {
      var row = document.createElement('div');
      row.className = 'tm-dialog-detail';
      row.innerHTML = '<span class="tm-dialog-key">' + _escHtml(d.key) + ':</span> ' + _escHtml(d.value);
      box.appendChild(row);
    });
    var btnRow = document.createElement('div');
    btnRow.className = 'tm-dialog-btns';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'tm-dialog-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    btnRow.appendChild(closeBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function _initPlayerTacticalMap(socket) {
    var panel = null;
    var viewer = null;
    var currentMapKey = '';
    var _drag = { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };
    var _resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 };

    function openPanel(mapKey, preloadedPins) {
      if (panel) {
        panel.style.display = 'flex';
        if (mapKey !== currentMapKey) {
          currentMapKey = mapKey;
          loadMap(mapKey, preloadedPins);
        }
        return;
      }

      currentMapKey = mapKey;
      panel = document.createElement('div');
      panel.id = 'player-tactical-panel';
      panel.className = 'tm-floating-panel tm-floating-panel--player';
      panel.innerHTML =
        '<div class="tm-panel-header" id="player-tm-drag">' +
          '<span class="tm-panel-title">Tactical Map</span>' +
          '<span class="tm-panel-map-name" id="player-tm-map-name"></span>' +
          '<button class="tm-panel-btn" id="player-tm-minimize" title="Minimize">&#x2015;</button>' +
          '<button class="tm-panel-close" id="player-tm-close" title="Close">&times;</button>' +
        '</div>' +
        '<div class="tm-panel-body" id="player-tm-body"></div>' +
        '<div class="tm-resize-handle" id="player-tm-resize"></div>';
      document.body.appendChild(panel);

      panel.querySelector('#player-tm-close').addEventListener('click', function () {
        panel.style.display = 'none';
      });

      var minimized = false;
      var savedHeight = '';
      panel.querySelector('#player-tm-minimize').addEventListener('click', function () {
        var body = document.getElementById('player-tm-body');
        var resize = document.getElementById('player-tm-resize');
        if (!minimized) {
          savedHeight = panel.style.height || (panel.offsetHeight + 'px');
          body.style.display = 'none';
          resize.style.display = 'none';
          panel.style.height = 'auto';
          minimized = true;
        } else {
          body.style.display = '';
          resize.style.display = '';
          panel.style.height = savedHeight;
          minimized = false;
          if (viewer) viewer.fitView();
        }
      });

      var dragHandle = panel.querySelector('#player-tm-drag');
      dragHandle.addEventListener('mousedown', function (e) {
        if (e.target.id === 'player-tm-close') return;
        _drag.active = true;
        _drag.startX = e.clientX;
        _drag.startY = e.clientY;
        _drag.origLeft = panel.offsetLeft;
        _drag.origTop = panel.offsetTop;
        e.preventDefault();
      });

      var resizeHandle = panel.querySelector('#player-tm-resize');
      resizeHandle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _resize.active = true;
        _resize.startX = e.clientX;
        _resize.startY = e.clientY;
        _resize.startW = panel.offsetWidth;
        _resize.startH = panel.offsetHeight;
      });

      loadMap(mapKey, preloadedPins);
    }

    function loadMap(mapKey, preloadedPins) {
      var body = document.getElementById('player-tm-body');
      if (!body) return;
      body.innerHTML = '';
      var nameEl = document.getElementById('player-tm-map-name');

      var sess = getSession();
      var charName = sess ? (sess.characterName || 'Unknown') : 'Unknown';

      viewer = new window.TacticalMapViewer({
        container: body,
        role: 'player',
        socket: socket,
        playerName: charName,
        onClipToJournal: function (zone, mk, mapTitle) {
          var title = 'Map: ' + (mapTitle || mk) + ' \u2014 ' + zone.room;
          var comment = prompt('Add a note (optional):') || '';
          var entryBody = (zone.desc || '(No description)');
          if (comment) entryBody += '\n\n--- Player Note ---\n' + comment;
          entryBody += '\n\n[map:' + mk + ']';
          fetch('/api/journal/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title,
              body: entryBody,
              author_character_name: charName,
              source_scene_id: 'map-' + mk
            })
          })
          .then(function (r) {
            if (!r.ok) throw new Error('Journal save failed');
            return r.json();
          })
          .then(function () {
            var toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(34,197,94,0.9);color:#000;padding:8px 16px;border-radius:4px;font-size:0.7rem;z-index:9999;font-family:Audiowide,sans-serif;';
            toast.textContent = 'Clipped to Journal';
            document.body.appendChild(toast);
            setTimeout(function () { toast.remove(); }, 2500);
          })
          .catch(function (err) {
            console.error('[player] Journal clip failed:', err);
            var toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.9);color:#fff;padding:8px 16px;border-radius:4px;font-size:0.7rem;z-index:9999;font-family:Audiowide,sans-serif;';
            toast.textContent = 'Failed to clip to journal';
            document.body.appendChild(toast);
            setTimeout(function () { toast.remove(); }, 3000);
          });
        }
      });
      _playerMapViewer = viewer;
      _playerMapKey = mapKey;
      viewer.onTokenClick = function (tokenId) {
        if (_pendingPlayerCombatState) {
          _showPlayerTokenDetails(tokenId, _pendingPlayerCombatState);
        }
      };
      viewer.onMapLoaded = function () {
        if (_pendingPlayerCombatState) {
          _renderPlayerCombatTokens(_pendingPlayerCombatState);
        }
      };
      viewer.loadMap(mapKey, preloadedPins);

      fetch('/api/maps/' + encodeURIComponent(mapKey) + '/meta')
        .then(function (r) {
          if (!r.ok) throw new Error('Meta fetch failed');
          return r.json();
        })
        .then(function (meta) {
          if (nameEl) nameEl.textContent = meta.title || mapKey;
        })
        .catch(function (err) {
          console.error('[player] Map meta fetch error:', err);
          if (nameEl) nameEl.textContent = mapKey;
        });
    }

    document.addEventListener('mousemove', function (e) {
      if (_drag.active && panel) {
        panel.style.left = (_drag.origLeft + e.clientX - _drag.startX) + 'px';
        panel.style.top = (_drag.origTop + e.clientY - _drag.startY) + 'px';
        panel.style.right = 'auto';
        panel.style.transform = 'none';
      }
      if (_resize.active && panel) {
        panel.style.width = Math.max(400, _resize.startW + e.clientX - _resize.startX) + 'px';
        panel.style.height = Math.max(300, _resize.startH + e.clientY - _resize.startY) + 'px';
      }
    });
    document.addEventListener('mouseup', function () {
      _drag.active = false;
      _resize.active = false;
    });

    socket.on('map:broadcast', function (data) {
      if (!data || !data.mapKey) return;
      openPanel(data.mapKey, data.pins || []);
    });

    window._openTacticalMapFromJournal = function (mapKey) {
      openPanel(mapKey, []);
    };

    socket.on('map:dismiss', function () {
      if (panel) panel.style.display = 'none';
    });

    socket.on('map:pin-added', function (data) {
      if (viewer && data.pin) viewer.handlePinAdded(data.pin);
    });
    socket.on('map:pin-updated', function (data) {
      if (viewer && data.pin) viewer.handlePinUpdated(data.pin);
    });
    socket.on('map:pin-removed', function (data) {
      if (viewer) viewer.handlePinRemoved(data.id);
    });
    socket.on('map:pins-sync', function (data) {
      if (viewer && data.mapKey === currentMapKey) viewer.handlePinsSync(data.pins);
    });
  }

  function _escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var _initTrackerDrag = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
  var _initTrackerResize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 };

  function _showInitiativeTracker(state) {
    var tracker = document.getElementById('player-init-tracker');
    if (!tracker) {
      tracker = document.createElement('div');
      tracker.id = 'player-init-tracker';
      tracker.className = 'pit-container';
      document.body.appendChild(tracker);
    }

    var turnOrder = state.turnOrder || [];
    var round = state.round || 1;
    var currentIdx = state.currentTurnIndex || 0;
    var combatants = state.combatants || [];
    var pcSlots = state.pcSlots || [];

    var sess = getSession();
    var myName = sess ? (sess.characterName || '') : '';

    var currentEntry = turnOrder[currentIdx];
    var isMyTurn = currentEntry && currentEntry.type === 'pc' && currentEntry.name === myName;

    var html = '<div class="pit-header" id="pit-drag-handle">';
    html += '<span class="pit-title">INITIATIVE</span>';
    html += '<span class="pit-round">R' + round + '</span>';
    html += '<button class="pit-collapse-btn" id="pit-collapse-btn">&minus;</button>';
    html += '</div>';

    if (isMyTurn) {
      html += '<div class="pit-my-turn-banner">YOUR TURN</div>';
    }

    html += '<div class="pit-body" id="pit-body">';
    html += '<div class="pit-turn-list">';

    turnOrder.forEach(function (entry, idx) {
      var isCurrent = idx === currentIdx;
      var isNpc = entry.type === 'npc';
      var isMe = !isNpc && entry.name === myName;
      var npc = null;
      var pc = null;
      if (isNpc) {
        for (var i = 0; i < combatants.length; i++) {
          if (combatants[i].id === entry.id) { npc = combatants[i]; break; }
        }
      } else {
        for (var j = 0; j < pcSlots.length; j++) {
          if (pcSlots[j].id === entry.id) { pc = pcSlots[j]; break; }
        }
      }

      var isDown = npc && npc.vitalityCurrent !== undefined && npc.vitalityCurrent <= 0;
      var cls = 'pit-entry';
      if (isCurrent) cls += ' pit-current';
      if (isNpc) cls += ' pit-npc';
      else cls += ' pit-pc';
      if (isMe) cls += ' pit-me';
      if (isDown) cls += ' pit-down';

      html += '<div class="' + cls + '">';
      html += '<span class="pit-init">' + (entry.initiative || '—') + '</span>';
      if (isNpc && npc) {
        var disp = npc.disposition || 'enemy';
        var dispLabel = disp === 'ally' ? 'A' : disp === 'neutral' ? 'N' : 'E';
        var dispColor = disp === 'ally' ? '#22c55e' : disp === 'neutral' ? '#eab308' : '#ef4444';
        html += '<span class="pit-disp" style="background:' + dispColor + ';">' + dispLabel + '</span>';
      }
      html += '<span class="pit-name">' + _escHtml(entry.name) + '</span>';

      if (isNpc && npc && npc.vitalityCurrent !== undefined) {
        var pct = npc.vitalityMax > 0 ? Math.round((npc.vitalityCurrent / npc.vitalityMax) * 100) : 0;
        var cs = getComputedStyle(document.documentElement);
        var hpColor = pct > 60 ? (cs.getPropertyValue('--color-success').trim() || '#22c55e') : pct > 30 ? (cs.getPropertyValue('--color-warn').trim() || '#eab308') : (cs.getPropertyValue('--color-fail').trim() || '#ef4444');
        html += '<span class="pit-hp" style="color:' + hpColor + ';">' + npc.vitalityCurrent + '/' + npc.vitalityMax + '</span>';
      }

      var condList = null;
      if (npc && npc.conditions && npc.conditions.length) condList = npc.conditions;
      else if (pc && pc.conditions && pc.conditions.length) condList = pc.conditions;

      if (condList) {
        html += '<span class="pit-conds">';
        condList.forEach(function (c) {
          var label = typeof c === 'string' ? c : (c.id || c.name || '?');
          html += '<span class="pit-cond">' + _escHtml(label) + '</span>';
        });
        html += '</span>';
      }

      html += '</div>';
    });

    html += '</div>';
    html += '</div>';
    html += '<div class="pit-resize-handle" id="pit-resize-handle"></div>';

    var wasCollapsed = false;
    var prevBody = document.getElementById('pit-body');
    if (prevBody) wasCollapsed = prevBody.style.display === 'none';

    var prevW = tracker.style.width;
    var prevH = tracker.style.height;
    var prevL = tracker.style.left;
    var prevT = tracker.style.top;
    var prevR = tracker.style.right;
    var prevB = tracker.style.bottom;

    tracker.innerHTML = html;

    if (prevW) tracker.style.width = prevW;
    if (prevH) tracker.style.height = prevH;
    if (prevL) { tracker.style.left = prevL; tracker.style.right = 'auto'; }
    if (prevT) { tracker.style.top = prevT; tracker.style.bottom = 'auto'; }

    if (wasCollapsed) {
      var newBody = document.getElementById('pit-body');
      if (newBody) newBody.style.display = 'none';
      var btn = document.getElementById('pit-collapse-btn');
      if (btn) btn.textContent = '+';
    }

    var handle = document.getElementById('pit-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', function (e) {
        if (e.target.id === 'pit-collapse-btn') return;
        _initTrackerDrag.active = true;
        _initTrackerDrag.startX = e.clientX - (tracker.offsetLeft || 0);
        _initTrackerDrag.startY = e.clientY - (tracker.offsetTop || 0);
        e.preventDefault();
      });
    }

    var resizeHandle = document.getElementById('pit-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _initTrackerResize.active = true;
        _initTrackerResize.startX = e.clientX;
        _initTrackerResize.startY = e.clientY;
        _initTrackerResize.startW = tracker.offsetWidth;
        _initTrackerResize.startH = tracker.offsetHeight;
      });
    }

    var collapseBtn = document.getElementById('pit-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        var body = document.getElementById('pit-body');
        if (!body) return;
        if (body.style.display === 'none') {
          body.style.display = '';
          collapseBtn.textContent = '\u2212';
        } else {
          body.style.display = 'none';
          collapseBtn.textContent = '+';
        }
      });
    }
  }

  document.addEventListener('mousemove', function (e) {
    if (!_initTrackerDrag.active) return;
    var tracker = document.getElementById('player-init-tracker');
    if (!tracker) { _initTrackerDrag.active = false; return; }
    tracker.style.left = (e.clientX - _initTrackerDrag.startX) + 'px';
    tracker.style.top = (e.clientY - _initTrackerDrag.startY) + 'px';
    tracker.style.right = 'auto';
    tracker.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', function () {
    _initTrackerDrag.active = false;
    _initTrackerResize.active = false;
  });

  document.addEventListener('mousemove', function (e) {
    if (!_initTrackerResize.active) return;
    var tracker = document.getElementById('player-init-tracker');
    if (!tracker) { _initTrackerResize.active = false; return; }
    var newW = Math.max(180, _initTrackerResize.startW + (e.clientX - _initTrackerResize.startX));
    var newH = Math.max(80, _initTrackerResize.startH + (e.clientY - _initTrackerResize.startY));
    tracker.style.width = newW + 'px';
    tracker.style.height = newH + 'px';
    tracker.style.maxHeight = 'none';
  });

  function _showJoinBattleModal(encounterName, highestTier) {
    var existing = document.getElementById('join-battle-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'join-battle-modal';
    overlay.className = 'jb-modal-overlay';

    var stepDownText = highestTier > 0
      ? 'Step down your Control Die <strong>' + highestTier + '</strong> time' + (highestTier !== 1 ? 's' : '') + ' (highest enemy Tier).'
      : 'No step-down (no enemy Tier advantage).';

    overlay.innerHTML =
      '<div class="jb-modal">' +
        '<div class="jb-modal-header">' +
          '<div class="jb-modal-icon">&#9876;</div>' +
          '<h2 class="jb-modal-title">JOIN BATTLE</h2>' +
          '<div class="jb-modal-encounter">' + (encounterName || 'Combat') + '</div>' +
        '</div>' +
        '<div class="jb-modal-body">' +
          '<div class="jb-step-down">' + stepDownText + '</div>' +
          '<div class="jb-rules">' +
            '<div class="jb-rule jb-rule-fail"><strong>Control 1-3:</strong> Surprised &mdash; [Disoriented] + [Exposed]</div>' +
            '<div class="jb-rule jb-rule-master"><strong>Control 8+:</strong> Mastery &mdash; designate one enemy as surprised</div>' +
            '<div class="jb-rule"><strong>Power Die result</strong> = your initiative slot</div>' +
          '</div>' +
          '<div class="jb-inputs">' +
            '<div class="jb-input-group">' +
              '<label for="jb-control">Control Result</label>' +
              '<input type="number" id="jb-control" min="1" max="12" placeholder="1-12" />' +
            '</div>' +
            '<div class="jb-input-group">' +
              '<label for="jb-power">Power Result</label>' +
              '<input type="number" id="jb-power" min="1" max="12" placeholder="1-12" />' +
            '</div>' +
          '</div>' +
          '<button id="jb-submit" class="jb-submit-btn">ENTER THE FRAY</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var submitBtn = overlay.querySelector('#jb-submit');
    submitBtn.addEventListener('click', function () {
      var control = parseInt(document.getElementById('jb-control').value, 10);
      var power = parseInt(document.getElementById('jb-power').value, 10);
      if (isNaN(control) || isNaN(power) || control < 1 || power < 1) return;

      if (_currentSocket) {
        _currentSocket.emit('combat:join-battle', {
          controlResult: control,
          powerResult: power
        });
      }

      overlay.innerHTML =
        '<div class="jb-modal">' +
          '<div class="jb-modal-header">' +
            '<div class="jb-modal-icon">&#9876;</div>' +
            '<h2 class="jb-modal-title">BATTLE JOINED</h2>' +
          '</div>' +
          '<div class="jb-modal-body">' +
            '<div class="jb-result">' +
              '<div>Control: <strong>' + control + '</strong>' + (control <= 3 ? ' <span style="color:#ef4444;">SURPRISED</span>' : control >= 8 ? ' <span style="color:#22c55e;">MASTERY</span>' : '') + '</div>' +
              '<div>Initiative Slot: <strong>' + power + '</strong></div>' +
            '</div>' +
            '<div class="jb-waiting">Waiting for GM to begin round...</div>' +
          '</div>' +
        '</div>';

      setTimeout(function () { overlay.remove(); }, 8000);
    });
  }

  var _tutDrag = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
  var _tutData = null;
  var _tutCollapsed = false;
  var _tutKitsCache = null;
  var _tutManeuversCache = null;

  var _DIE_RANK = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };

  function _tutEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _getPlayerAssessAbilities() {
    var char = window.CharacterPanel && window.CharacterPanel.currentChar;
    if (!char) return [];
    var results = [];

    if (_tutManeuversCache) {
      var allDiscs = (char.arenas || []).flatMap(function (a) {
        return (a.disciplines || []).map(function (d) { return { id: d.id, die: (d.die || 'D4').toUpperCase() }; });
      });
      var discMap = {};
      allDiscs.forEach(function (d) { discMap[d.id] = d.die; });

      var discData = _tutManeuversCache.disciplineGambits || {};
      Object.keys(discData).forEach(function (discId) {
        var playerDie = discMap[discId];
        if (!playerDie) return;
        var playerRank = _DIE_RANK[playerDie] || 0;
        var disc = discData[discId];
        (disc.gambits || []).forEach(function (g) {
          if (g.modifiesAction !== 'action_assess') return;
          var reqRank = _DIE_RANK[(g.requiredDie || 'D4').toUpperCase()] || 0;
          if (playerRank >= reqRank) {
            results.push({
              type: 'gambit',
              name: g.name || 'Unnamed',
              rule: g.rule || '',
              source: (disc.name || discId) + ' ' + (g.requiredDie || ''),
              reqDie: g.requiredDie || ''
            });
          }
        });
      });
    }

    if (_tutKitsCache && char.kits) {
      var playerKits = Array.isArray(char.kits) ? char.kits : [];
      var playerKitMap = {};
      playerKits.forEach(function (k) { playerKitMap[k.id] = k.tier || 0; });
      _tutKitsCache.forEach(function (kit) {
        if (!(kit.id in playerKitMap)) return;
        var playerTier = playerKitMap[kit.id];
        (kit.abilities || []).forEach(function (ab) {
          if (ab.modifiesAction !== 'action_assess') return;
          if (ab.tier && ab.tier > playerTier) return;
          results.push({
            type: ab.type || 'passive',
            name: ab.name || ab.shorthand || 'Unnamed',
            rule: ab.rule || ab.shorthand || '',
            source: (kit.name || kit.id) + (ab.tier ? ' T' + ab.tier : '')
          });
        });
      });
    }

    return results;
  }

  function _loadTutorialData(cb) {
    var pending = 2;
    var done = function () { pending--; if (pending <= 0) cb(); };

    if (_tutKitsCache) { done(); } else {
      fetch('/data/kits.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _tutKitsCache = Array.isArray(data) ? data : (data.kits || []);
          done();
        })
        .catch(function () { done(); });
    }

    if (_tutManeuversCache) { done(); } else {
      fetch('/data/maneuvers.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _tutManeuversCache = data;
          done();
        })
        .catch(function () { done(); });
    }
  }

  function _showTutorialPanel(data) {
    _tutData = data;
    _loadTutorialData(function () {
      _renderTutorialPanel();
    });
  }

  function _updateTutorialPhase(data) {
    if (!_tutData) return;
    _tutData.phase = data.phase;
    _tutData.phaseIndex = data.phaseIndex;
    _tutData.totalPhases = data.totalPhases;
    _renderTutorialPanel();
  }

  function _closeTutorialPanel() {
    _tutData = null;
    var el = document.getElementById('player-tutorial-panel');
    if (el) el.remove();
  }

  function _renderTutorialPanel() {
    if (!_tutData) return;

    var panel = document.getElementById('player-tutorial-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'player-tutorial-panel';
      panel.className = 'tut-container';
      document.body.appendChild(panel);
    }

    var phase = _tutData.phase;
    var phaseIdx = _tutData.phaseIndex || 0;
    var totalPhases = _tutData.totalPhases || 1;

    var html = '<div class="tut-header" id="tut-drag-handle">';
    html += '<span class="tut-title">ASSESS GUIDE</span>';
    html += '<span class="tut-phase-badge">' + (phaseIdx + 1) + '/' + totalPhases + '</span>';
    html += '<button class="tut-collapse-btn" id="tut-collapse-btn">' + (_tutCollapsed ? '\u25B2' : '\u25BC') + '</button>';
    html += '</div>';

    if (!_tutCollapsed) {
      html += '<div class="tut-body">';

      html += '<div class="tut-phase-label">' + _tutEsc(phase.label) + '</div>';

      if (_tutData.assessDescription && phaseIdx === 0) {
        html += '<div class="tut-section-title">What is Assess?</div>';
        html += '<div class="tut-assess-desc">' + _tutEsc(_tutData.assessDescription) + '</div>';
      }

      html += '<div class="tut-section-title">Example Questions</div>';
      (phase.disciplines || []).forEach(function (disc) {
        var qs = disc.questions || [];
        if (qs.length === 0) return;
        html += '<div class="tut-disc-group">';
        html += '<div class="tut-disc-name">' + _tutEsc(disc.name) + '</div>';
        qs.forEach(function (q) {
          var qText = typeof q === 'string' ? q : (q.question || q.text || '');
          if (qText) html += '<div class="tut-question">\u201C' + _tutEsc(qText) + '\u201D</div>';
        });
        html += '</div>';
      });

      var abilities = _getPlayerAssessAbilities();
      html += '<div class="tut-section-title">Your Assess Abilities</div>';
      if (abilities.length === 0) {
        html += '<div class="tut-no-gambits">No assess-specific abilities unlocked yet.</div>';
      } else {
        abilities.forEach(function (ab) {
          html += '<div class="tut-gambit-card">';
          html += '<div class="tut-gambit-name">' + _tutEsc(ab.name) + '</div>';
          html += '<div class="tut-gambit-kit">' + _tutEsc(ab.source) + ' \u2014 ' + _tutEsc(ab.type) + '</div>';
          html += '<div class="tut-gambit-rule">' + _tutEsc(ab.rule) + '</div>';
          html += '</div>';
        });
      }

      html += '</div>';
    }

    panel.innerHTML = html;

    var collapseBtn = document.getElementById('tut-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        _tutCollapsed = !_tutCollapsed;
        _renderTutorialPanel();
      });
    }

    var dragHandle = document.getElementById('tut-drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', function (e) {
        if (e.target.tagName === 'BUTTON') return;
        _tutDrag.active = true;
        _tutDrag.startX = e.clientX;
        _tutDrag.startY = e.clientY;
        var rect = panel.getBoundingClientRect();
        _tutDrag.x = rect.left;
        _tutDrag.y = rect.top;
        e.preventDefault();
      });
    }
  }

  document.addEventListener('mousemove', function (e) {
    if (!_tutDrag.active) return;
    var panel = document.getElementById('player-tutorial-panel');
    if (!panel) { _tutDrag.active = false; return; }
    var dx = e.clientX - _tutDrag.startX;
    var dy = e.clientY - _tutDrag.startY;
    panel.style.left = (_tutDrag.x + dx) + 'px';
    panel.style.top = (_tutDrag.y + dy) + 'px';
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', function () {
    _tutDrag.active = false;
  });

  var _challengeData = null;
  var _challengeCurrentRound = 0;

  function _getSessionCharId() {
    try {
      var s = JSON.parse(sessionStorage.getItem('eote-session'));
      return s ? s.characterId : null;
    } catch (_) { return null; }
  }

  function _checkForActiveChallenge() {
    var charId = _getSessionCharId();
    if (!charId) return;
    var tokenParam = window._playerToken ? '&player_token=' + encodeURIComponent(window._playerToken) : '';
    fetch('/api/narrative-challenges/player/active?character_id=' + encodeURIComponent(charId) + tokenParam)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.resolved && data.resolution) {
          var overlay = document.createElement('div');
          overlay.id = 'nc-player-overlay';
          overlay.className = 'nc-player-overlay';
          document.body.appendChild(overlay);
          var resolvedChallenge = {
            name: data.resolution.challengeName || 'Narrative Challenge',
            resolutions: {}
          };
          if (data.resolution.resolutionText) {
            var sl = data.resolution.gmScore === 5 ? 'light' : data.resolution.gmScore === 1 ? 'dark' : 'neutral';
            resolvedChallenge.resolutions[sl] = data.resolution.resolutionText;
          }
          _renderChallengeResolved(overlay, resolvedChallenge, data.resolution);
          return;
        }
        if (data.instance && data.challenge) {
          _showChallengeModal({
            instance: data.instance,
            challenge: data.challenge,
            characterName: data.instance.character_name || ''
          });
        }
      })
      .catch(function () {});
  }

  function _showChallengeModal(data) {
    var existing = document.getElementById('nc-player-overlay');
    if (existing) existing.remove();

    _challengeData = data;
    var inst = data.instance;
    var challenge = data.challenge;
    var existingChoices = [];
    try { existingChoices = JSON.parse(inst.choices || '[]'); } catch (_) {}
    _challengeCurrentRound = existingChoices.length;

    var nextRoundId = _getNextRoundId(challenge, existingChoices);

    var overlay = document.createElement('div');
    overlay.id = 'nc-player-overlay';
    overlay.className = 'nc-player-overlay';

    _renderChallengeRound(overlay, challenge, inst, existingChoices, nextRoundId);
    document.body.appendChild(overlay);
  }

  function _getNextRoundId(challenge, existingChoices) {
    var rounds = challenge.rounds || [];
    if (!rounds.length) return null;
    if (!existingChoices || !existingChoices.length) return rounds[0].id;

    var lastChoice = existingChoices[existingChoices.length - 1];
    var lastRound = rounds.find(function (r) { return r.id === lastChoice.round_id; });
    if (!lastRound) return null;
    var chosen = (lastRound.choices || []).find(function (c) { return c.id === lastChoice.choice_id; });
    if (!chosen) return null;

    if (chosen.nextRound) return chosen.nextRound;

    var hasBranching = rounds.some(function (r) {
      return (r.choices || []).some(function (c) { return !!c.nextRound; });
    });
    if (hasBranching) return null;

    var lastIdx = rounds.indexOf(lastRound);
    return (lastIdx + 1 < rounds.length) ? rounds[lastIdx + 1].id : null;
  }

  function _renderChallengeRound(overlay, challenge, inst, existingChoices, roundId) {
    var rounds = challenge.rounds || [];

    if (!roundId) {
      _renderChallengeComplete(overlay, challenge, inst);
      return;
    }

    var round = rounds.find(function (r) { return r.id === roundId; });
    if (!round) {
      _renderChallengeComplete(overlay, challenge, inst);
      return;
    }

    var ri = _challengeCurrentRound;
    var totalPathRounds = _getTotalPathRounds(challenge);
    var html = '<div class="nc-player-modal">';
    html += '<div class="nc-player-header">';
    html += '<span class="nc-player-title">' + _escHtml(challenge.name) + '</span>';
    html += '<span class="nc-player-round">Round ' + (ri + 1) + ' / ' + totalPathRounds + '</span>';
    html += '</div>';

    if (ri === 0) {
      html += '<div class="nc-player-setup">';
      html += '<div class="nc-player-desc">' + _escHtml(challenge.description || '') + '</div>';
      html += '<div class="nc-player-setup-text">' + _escHtml(challenge.setup || '') + '</div>';
      html += '</div>';
    }

    html += '<div class="nc-player-prompt">' + _escHtml(round.prompt) + '</div>';
    if (round.narrativeContext) {
      html += '<div class="nc-player-context">' + _escHtml(round.narrativeContext) + '</div>';
    }

    html += '<div class="nc-player-choices">';
    (round.choices || []).forEach(function (ch) {
      html += '<button class="nc-player-choice-btn" data-round-id="' + _escHtml(round.id) + '" data-choice-id="' + _escHtml(ch.id) + '">';
      html += '<span class="nc-player-choice-label">' + _escHtml(ch.label) + '</span>';
      html += '</button>';
    });
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;

    overlay.querySelectorAll('.nc-player-choice-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var roundId = btn.dataset.roundId;
        var choiceId = btn.dataset.choiceId;
        _submitPlayerChoice(overlay, challenge, inst, roundId, choiceId, round);
      });
    });
  }

  function _getTotalPathRounds(challenge) {
    var rounds = challenge.rounds || [];
    if (!rounds.length) return 0;
    var hasBranching = rounds.some(function (r) {
      return (r.choices || []).some(function (c) { return !!c.nextRound; });
    });
    if (!hasBranching) return rounds.length;

    var depth = 1;
    var current = rounds[0];
    while (current) {
      var firstChoice = (current.choices || [])[0];
      if (!firstChoice || !firstChoice.nextRound) break;
      var next = rounds.find(function (r) { return r.id === firstChoice.nextRound; });
      if (!next) break;
      depth++;
      current = next;
    }
    return depth;
  }

  function _submitPlayerChoice(overlay, challenge, inst, roundId, choiceId, round) {
    var charId = _getSessionCharId();
    if (!charId) return;

    overlay.querySelectorAll('.nc-player-choice-btn').forEach(function (b) { b.disabled = true; });

    var chosenBtn = overlay.querySelector('.nc-player-choice-btn[data-choice-id="' + choiceId + '"]');
    if (chosenBtn) chosenBtn.classList.add('nc-player-choice--selected');

    fetch('/api/narrative-challenges/player/choice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character_id: charId,
        instance_id: inst.id,
        round_id: roundId,
        choice_id: choiceId,
        player_token: window._playerToken || ''
      })
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (result) {
      if (!result.ok) throw new Error(result.data.error || 'Failed');
      var resolution = (result.data.resolved && result.data.resolution) ? result.data.resolution : null;
      _showChoiceNarration(overlay, challenge, inst, round, choiceId, resolution);
    })
    .catch(function () {
      overlay.querySelectorAll('.nc-player-choice-btn').forEach(function (b) { b.disabled = false; });
      if (chosenBtn) chosenBtn.classList.remove('nc-player-choice--selected');
      var modal = overlay.querySelector('.nc-player-modal');
      if (modal) {
        var errDiv = modal.querySelector('.nc-player-error');
        if (errDiv) errDiv.remove();
        errDiv = document.createElement('div');
        errDiv.className = 'nc-player-error';
        errDiv.textContent = 'Failed to save choice. Please try again.';
        errDiv.style.cssText = 'color:#f87171;font-size:0.7rem;text-align:center;margin-top:0.5rem;';
        modal.appendChild(errDiv);
      }
    });
  }

  function _showChoiceNarration(overlay, challenge, inst, round, choiceId, resolution) {
    var chosenData = (round.choices || []).find(function (c) { return c.id === choiceId; });
    var narration = chosenData ? chosenData.narration : '';
    var outcome = chosenData ? (chosenData.outcome || '') : '';

    var isFinal = !chosenData || !chosenData.nextRound;
    var hasBranching = (challenge.rounds || []).some(function (r) {
      return (r.choices || []).some(function (c) { return !!c.nextRound; });
    });
    if (!hasBranching) {
      isFinal = _challengeCurrentRound + 1 >= (challenge.rounds || []).length;
    }

    var displayText = narration;
    if (isFinal && outcome) {
      displayText = outcome;
    }

    if (displayText) {
      var modal = overlay.querySelector('.nc-player-modal');
      if (modal) {
        var narDiv = document.createElement('div');
        narDiv.className = 'nc-player-narration';
        narDiv.textContent = displayText;
        modal.appendChild(narDiv);

        var contBtn = document.createElement('button');
        contBtn.className = 'nc-player-continue-btn';
        contBtn.textContent = isFinal ? 'View Your Destiny' : 'Continue';
        modal.appendChild(contBtn);

        var nextRoundId = chosenData && chosenData.nextRound ? chosenData.nextRound : null;
        if (!hasBranching && !isFinal) {
          var ri = (challenge.rounds || []).indexOf(round);
          if (ri + 1 < (challenge.rounds || []).length) {
            nextRoundId = (challenge.rounds || [])[ri + 1].id;
          }
        }

        contBtn.addEventListener('click', function () {
          _challengeCurrentRound++;
          if (isFinal && resolution) {
            _renderChallengeResolved(overlay, challenge, resolution);
          } else {
            _renderChallengeRound(overlay, challenge, inst, [], nextRoundId);
          }
        });
      }
    }
  }

  function _renderChallengeResolved(overlay, challenge, resolution) {
    var html = '<div class="nc-player-modal">';
    html += '<div class="nc-player-header">';
    html += '<span class="nc-player-title">' + _escHtml(challenge.name) + '</span>';
    html += '<span class="nc-player-round">Resolved</span>';
    html += '</div>';

    var resolutions = challenge.resolutions || {};
    var scoreLabel = resolution.gmScore === 5 ? 'light' : resolution.gmScore === 1 ? 'dark' : 'neutral';
    var resolutionText = resolutions[scoreLabel] || '';

    if (resolutionText) {
      html += '<div class="nc-player-narration" style="margin-bottom:0.8rem;">' + _escHtml(resolutionText) + '</div>';
    }

    html += '<div class="nc-player-waiting">';
    html += '<div class="nc-player-waiting-icon" style="font-size:1.5rem;">&#9733;</div>';

    if (resolution.shifted) {
      html += '<div class="nc-player-waiting-text" style="color:#c8a44e;">Destiny shifted: ' +
        _escHtml(resolution.oldSpectrum) + ' \u2192 ' + _escHtml(resolution.newSpectrum) + '</div>';
    } else {
      html += '<div class="nc-player-waiting-text">Destiny held steady: ' + _escHtml(resolution.oldSpectrum) + '</div>';
    }

    html += '<div style="font-size:0.6rem;color:#94a3b8;margin-top:0.3rem;">Score: ' + resolution.gmScore + '/5</div>';
    html += '</div>';

    html += '<div style="text-align:center;margin-top:0.8rem;">';
    html += '<button class="nc-player-continue-btn" id="nc-resolved-close">Close</button>';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;

    var closeBtn = document.getElementById('nc-resolved-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        overlay.remove();
      });
    }
  }

  function _renderChallengeComplete(overlay, challenge, inst) {
    var html = '<div class="nc-player-modal">';
    html += '<div class="nc-player-header">';
    html += '<span class="nc-player-title">' + _escHtml(challenge.name) + '</span>';
    html += '<span class="nc-player-round">Complete</span>';
    html += '</div>';
    html += '<div class="nc-player-waiting">';
    html += '<div class="nc-player-waiting-icon">&#9876;</div>';
    html += '<div class="nc-player-waiting-text">Your choices have been recorded.<br>Processing your destiny...</div>';
    html += '</div>';
    html += '</div>';
    overlay.innerHTML = html;
  }

  function _showChallengeResolutionToast(data) {
    var overlay = document.getElementById('nc-player-overlay');
    var result = data.characterResult;
    if (!result) {
      if (overlay) overlay.remove();
      return;
    }

    if (overlay && _challengeData && _challengeData.challenge) {
      _renderChallengeResolved(overlay, _challengeData.challenge, result);
      return;
    }

    if (overlay) overlay.remove();

    var toast = document.createElement('div');
    toast.className = 'nc-player-resolution-toast';
    var msg = '';
    if (result.shifted) {
      msg = 'Destiny shifted: ' + result.oldSpectrum + ' \u2192 ' + result.newSpectrum;
    } else {
      msg = 'Destiny held steady: ' + result.oldSpectrum;
    }
    msg += ' \u2014 ' + data.tokenOutcome;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 8000);
  }

  var _decisionPollActive = false;

  function _showDecisionPoll(data) {
    _decisionPollActive = true;
    var existing = document.getElementById('decision-vote-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'decision-vote-overlay';
    overlay.className = 'decision-vote-overlay';

    var html = '<div class="decision-vote-modal">';
    html += '<div class="decision-vote-header">CREW DECISION</div>';
    if (data.decisionKey) {
      html += '<div class="decision-vote-key">' + _escHtml(data.decisionKey) + '</div>';
    }
    html += '<div class="decision-vote-choices">';
    data.choices.forEach(function (c, i) {
      html += '<button class="decision-vote-btn" data-choice-idx="' + i + '">' + _escHtml(c) + '</button>';
    });
    html += '</div>';
    html += '<div class="decision-vote-status" id="decision-vote-status">Cast your vote</div>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.decision-vote-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.choiceIdx, 10);
        if (_currentSocket) {
          _currentSocket.emit('decision:vote', { choiceIndex: idx });
        }
        overlay.querySelectorAll('.decision-vote-btn').forEach(function (b) {
          b.disabled = true;
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
        var status = document.getElementById('decision-vote-status');
        if (status) status.textContent = 'Vote submitted — waiting for GM\u2026';
      });
    });
  }

  function _closeDecisionPoll() {
    _decisionPollActive = false;
    var overlay = document.getElementById('decision-vote-overlay');
    if (overlay) overlay.remove();
  }

  function _setupDecisionSocketListeners(sock) {
    sock.on('decision:poll', function (data) {
      _showDecisionPoll(data);
    });
    sock.on('decision:resolved', function () {
      _closeDecisionPoll();
    });
    sock.on('decision:poll-cancelled', function () {
      _closeDecisionPoll();
    });
  }

  function initAdminTools() {
    const btn = document.getElementById('admin-release-all');
    const msg = document.getElementById('admin-release-msg');
    if (!btn) return;

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Releasing\u2026';
      fetch('/api/admin/release-all', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (msg) {
            msg.textContent = data.message || 'Done.';
            msg.style.display = 'block';
          }
          btn.textContent = 'Release All Characters';
          btn.disabled = false;
          sessionStorage.removeItem('eote-session');
        })
        .catch(function () {
          if (msg) {
            msg.textContent = 'Request failed.';
            msg.style.display = 'block';
          }
          btn.textContent = 'Release All Characters';
          btn.disabled = false;
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); initAdminTools(); });
  } else {
    init();
    initAdminTools();
  }
}());

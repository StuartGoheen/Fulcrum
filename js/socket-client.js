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

    socket.on('combat:join-battle-prompt', ({ encounterName, highestTier }) => {
      _showJoinBattleModal(encounterName, highestTier);
    });

    socket.on('combat:state', function (data) {
      if (!data || !data.active) return;
      if (data.alreadyJoined) {
        var modal = document.getElementById('join-battle-modal');
        if (modal) modal.remove();
        _showInitiativeTracker(data);
      }
    });

    socket.on('combat:state-update', function (data) {
      if (!data || !data.active) return;
      _showInitiativeTracker(data);
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

    socket.on('session:joined', function () {
      socket.emit('combat:request');
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

    var html = '<div class="pit-header" id="pit-drag-handle">';
    html += '<span class="pit-title">INITIATIVE</span>';
    html += '<span class="pit-round">R' + round + '</span>';
    html += '<button class="pit-collapse-btn" id="pit-collapse-btn">&minus;</button>';
    html += '</div>';

    html += '<div class="pit-body" id="pit-body">';
    html += '<div class="pit-turn-list">';

    turnOrder.forEach(function (entry, idx) {
      var isCurrent = idx === currentIdx;
      var isNpc = entry.type === 'npc';
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

      var isDown = npc && npc.vitalityCurrent <= 0;
      var cls = 'pit-entry';
      if (isCurrent) cls += ' pit-current';
      if (isNpc) cls += ' pit-npc';
      else cls += ' pit-pc';
      if (isDown) cls += ' pit-down';

      html += '<div class="' + cls + '">';
      html += '<span class="pit-init">' + (entry.initiative || '—') + '</span>';
      html += '<span class="pit-name">' + _escHtml(entry.name) + '</span>';

      if (isNpc && npc) {
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
          html += '<span class="pit-cond">' + _escHtml(c) + '</span>';
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

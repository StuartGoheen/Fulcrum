(function () {
  'use strict';

  var STATE_KEY = 'adv1_vanishing_place_alert';
  var DATA_URL  = '/data/adventures/vanishing-place-fortress.json';

  var _data = null;
  var _dataPromise = null;
  var _currentState = null;
  var _panel = null;
  var _socket = null;
  var _stateListener = null;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _loadData() {
    if (_data) return Promise.resolve(_data);
    if (_dataPromise) return _dataPromise;
    _dataPromise = fetch(DATA_URL).then(function (r) {
      if (!r.ok) throw new Error('Failed to load fortress data: ' + r.status);
      return r.json();
    }).then(function (d) { _data = d; return d; });
    return _dataPromise;
  }

  function _getTier(id) {
    if (!_data) return null;
    for (var i = 0; i < _data.tiers.length; i++) if (_data.tiers[i].id === id) return _data.tiers[i];
    return null;
  }

  function _defaultState() {
    return {
      tier: 'GREEN',
      orangeRound: 0,
      redRound: 0,
      sabotage: null,
      flags: {
        turrets_offline: false,
        laser_fences_dropped: false,
        mag_locks_open: false,
        sensor_grid_blind: false,
        security_droid_active: false
      },
      updatedAt: null
    };
  }

  function _initState() {
    // Seed with defaults; the state:sync listener will overwrite once the server responds.
    if (!_currentState) _currentState = _defaultState();
  }

  function _pushState(newState) {
    _currentState = newState;
    newState.updatedAt = new Date().toISOString();
    if (_socket) _socket.emit('state:update', { key: STATE_KEY, value: newState });
    _render();
  }

  function _bindStateListener() {
    if (_stateListener || !_socket) return;
    _stateListener = function (msg) {
      try {
        var st = msg && msg.state ? msg.state[STATE_KEY] : null;
        if (st) {
          _currentState = st;
          if (_panel && _data) _render();
        }
      } catch (_) {}
    };
    _socket.on('state:sync', _stateListener);
  }

  function _unbindStateListener() {
    if (_stateListener && _socket && typeof _socket.off === 'function') {
      try { _socket.off('state:sync', _stateListener); } catch (_) {}
    }
    _stateListener = null;
  }

  // ---------- rendering ----------

  function _render() {
    if (!_panel || !_data || !_currentState) return;
    var tier = _getTier(_currentState.tier) || _data.tiers[0];

    var header = _panel.querySelector('.vpf-header');
    var body   = _panel.querySelector('.vpf-body');
    if (!header || !body) return;

    header.style.background = tier.bgColor;
    header.style.borderColor = tier.color;

    var flagChips = '';
    var flags = _currentState.flags || {};
    Object.keys(flags).forEach(function (k) {
      if (flags[k] === true) {
        flagChips += '<span class="vpf-flag">' + _esc(k.replace(/_/g, ' ')) + '</span>';
      }
    });

    header.innerHTML =
      '<div class="vpf-tier-chip" style="background:' + tier.color + ';color:#0a0a0a;">' +
        _esc(tier.label) +
      '</div>' +
      '<div class="vpf-summary-col">' +
        '<div class="vpf-title">Fortress: The Vanishing Place</div>' +
        '<div class="vpf-one-liner">' + _esc(tier.oneLiner) + '</div>' +
      '</div>' +
      '<div class="vpf-actions">' +
        '<button class="vpf-btn vpf-btn-escalate" title="Escalate to next tier">Escalate &uarr;</button>' +
        '<button class="vpf-btn vpf-btn-deescalate" title="De-escalate (only within same round where allowed)">De-esc &darr;</button>' +
        '<button class="vpf-btn vpf-btn-sabotage" title="Apply generator sabotage outcome">Sabotage&hellip;</button>' +
        '<button class="vpf-btn vpf-btn-reset" title="Reset to GREEN / clear flags">Reset</button>' +
        '<button class="vpf-btn vpf-btn-ref" title="Open full reactive-fortress reference">How it reacts &rarr;</button>' +
      '</div>';

    var tempoLine = '<div class="vpf-tempo"><strong>Patrol tempo:</strong> ' + _esc(tier.patrolTempo) + '</div>';
    var summaryLine = '<div class="vpf-tier-summary">' + _esc(tier.summary) + '</div>';

    var zonesHtml = '<div class="vpf-section-label">Zones — this tier</div><div class="vpf-zone-grid">';
    (_data.zones || []).forEach(function (z) {
      var zt = z.byTier[tier.id] || {};
      zonesHtml += '<div class="vpf-zone"><div class="vpf-zone-name">' + _esc(z.label) + '</div>' +
        '<div class="vpf-zone-state"><span class="vpf-zone-pill">' + _esc(zt.state || '—') + '</span></div>' +
        '<div class="vpf-zone-note">' + _esc(zt.note || '') + '</div></div>';
    });
    zonesHtml += '</div>';

    var npcHtml = '<div class="vpf-section-label">NPC groups — behavior this tier</div><div class="vpf-npc-list">';
    (_data.npcGroups || []).forEach(function (g) {
      npcHtml += '<div class="vpf-npc"><div class="vpf-npc-name">' + _esc(g.label) + '</div>' +
        '<div class="vpf-npc-comp">' + _esc(g.composition) + '</div>' +
        '<div class="vpf-npc-behav">' + _esc(g.byTier[tier.id] || '—') + '</div></div>';
    });
    npcHtml += '</div>';

    var clockHtml = '';
    if (tier.id === 'ORANGE' || tier.id === 'RED') {
      var round = tier.id === 'RED' ? _currentState.redRound : _currentState.orangeRound;
      clockHtml += '<div class="vpf-section-label">' + (tier.id === 'RED' ? 'Draco clock' : 'Reinforcement clock') +
        ' <span class="vpf-round">Round ' + (round || 1) + '</span>' +
        ' <button class="vpf-btn vpf-btn-tick" title="Advance round">Tick +1</button>' +
        '</div>';
      var sched = tier.id === 'RED' ? _data.reinforcementClock.dracoClock.countdown : _data.reinforcementClock.schedule;
      clockHtml += '<ol class="vpf-clock">';
      sched.forEach(function (row) {
        var active = (row.round === (round || 1));
        clockHtml += '<li class="' + (active ? 'vpf-clock-active' : '') + '"><strong>R' + row.round + '</strong> — ' +
          _esc(row.event) + (row.zone ? ' <span class="vpf-clock-zone">[' + _esc(row.zone) + ']</span>' : '') + '</li>';
      });
      clockHtml += '</ol>';
    }

    var flagsHtml = '';
    if (flagChips) {
      flagsHtml = '<div class="vpf-section-label">Sabotage cascade flags</div><div class="vpf-flag-row">' + flagChips + '</div>';
    }

    body.innerHTML = tempoLine + summaryLine + flagsHtml + clockHtml + zonesHtml + npcHtml;

    // bind
    var $ = function (sel) { return _panel.querySelector(sel); };
    $('.vpf-btn-escalate')  .addEventListener('click', _onEscalate);
    $('.vpf-btn-deescalate').addEventListener('click', _onDeEscalate);
    $('.vpf-btn-sabotage')  .addEventListener('click', _onSabotage);
    $('.vpf-btn-reset')     .addEventListener('click', _onReset);
    $('.vpf-btn-ref')       .addEventListener('click', openReference);
    var tickBtn = $('.vpf-btn-tick');
    if (tickBtn) tickBtn.addEventListener('click', _onTick);

    var toggleBtn = _panel.querySelector('.vpf-toggle');
    if (toggleBtn) toggleBtn.textContent = _panel.classList.contains('vpf-collapsed') ? 'Expand' : 'Collapse';
  }

  // ---------- user actions ----------

  var ORDER = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

  function _onEscalate() {
    var idx = ORDER.indexOf(_currentState.tier);
    if (idx < 0 || idx >= ORDER.length - 1) return;
    var next = ORDER[idx + 1];
    _confirmTierChange(_currentState.tier, next, 'escalate');
  }

  function _onDeEscalate() {
    var idx = ORDER.indexOf(_currentState.tier);
    if (idx <= 0) return;
    var next = ORDER[idx - 1];
    var allowed = false;
    var msg = '';
    if (_currentState.tier === 'YELLOW') {
      allowed = true;
      msg = 'YELLOW → GREEN is reversible if the trigger was neutralized this round (body hidden, witness silenced, comm check faked). Confirm?';
    } else if (_currentState.tier === 'ORANGE') {
      allowed = true;
      msg = 'ORANGE → YELLOW is ONLY valid if it is still the same round the alarm was raised AND the alarm line has been severed OR an all-clear was faked over Comms. Otherwise ORANGE is one-way. Confirm?';
    } else if (_currentState.tier === 'RED') {
      alert('RED is terminal. Draco is coming. There is no de-escalation.');
      return;
    }
    if (!allowed) return;
    _confirmTierChange(_currentState.tier, next, 'de-escalate', msg);
  }

  function _confirmTierChange(fromId, toId, action, extraMsg) {
    var fromTier = _getTier(fromId);
    var toTier = _getTier(toId);
    if (!toTier) return;

    // Find the most relevant escalation/deescalation trigger's read-aloud cue.
    var cue = '';
    var triggers = action === 'escalate' ? _data.escalationTriggers : _data.deEscalationTriggers;
    for (var i = 0; i < triggers.length; i++) {
      var t = triggers[i];
      if (action === 'escalate') {
        if ((t.from || []).indexOf(fromId) >= 0 && t.to === toId) { cue = t.readAloud; break; }
      } else {
        if (t.from === fromId && t.to === toId) { cue = t.readAloud; break; }
      }
    }

    var html =
      '<div class="vpf-modal-tier" style="background:' + toTier.bgColor + ';border-color:' + toTier.color + ';">' +
        '<div class="vpf-modal-tier-chip" style="background:' + toTier.color + ';">' + _esc(toTier.label) + '</div>' +
        '<div class="vpf-modal-tier-summary">' + _esc(toTier.summary) + '</div>' +
      '</div>' +
      (extraMsg ? '<div class="vpf-modal-warn">' + _esc(extraMsg) + '</div>' : '') +
      (cue ? '<div class="vpf-modal-cue"><div class="vpf-modal-cue-label">Read-aloud cue</div><div class="vpf-modal-cue-text">' + _esc(cue) + '</div></div>' : '') +
      '<div class="vpf-modal-section-label">NPC behavior this tier</div>' +
      '<ul class="vpf-modal-npcs">' +
        _data.npcGroups.map(function (g) {
          return '<li><strong>' + _esc(g.label) + ':</strong> ' + _esc(g.byTier[toId]) + '</li>';
        }).join('') +
      '</ul>';

    _openModal(
      (action === 'escalate' ? 'Escalate' : 'De-escalate') + ': ' + _esc(fromTier ? fromTier.label : fromId) + ' → ' + _esc(toTier.label),
      html,
      'Confirm tier change',
      function () {
        var ns = JSON.parse(JSON.stringify(_currentState));
        ns.tier = toId;
        if (toId === 'ORANGE' && fromId !== 'ORANGE') ns.orangeRound = 1;
        if (toId === 'RED' && fromId !== 'RED') ns.redRound = 1;
        if (toId !== 'ORANGE') ns.orangeRound = 0;
        if (toId !== 'RED') ns.redRound = 0;
        _pushState(ns);
      }
    );
  }

  function _onTick() {
    var ns = JSON.parse(JSON.stringify(_currentState));
    if (ns.tier === 'RED') {
      ns.redRound = Math.min((ns.redRound || 1) + 1, 4);
    } else if (ns.tier === 'ORANGE') {
      ns.orangeRound = (ns.orangeRound || 1) + 1;
      if (ns.orangeRound > 4) {
        ns.tier = 'RED';
        ns.redRound = 1;
        ns.orangeRound = 0;
      }
    }
    _pushState(ns);
  }

  function _onSabotage() {
    var outcomes = _data.sabotageCascade.outcomes;
    var html = '<div class="vpf-modal-sub">Choose the generator sabotage outcome. This sets the fortress tier and cascade flags that P2-S7 and P2-S8 read downstream.</div>' +
      '<div class="vpf-sabot-options">';
    Object.keys(outcomes).forEach(function (key) {
      var o = outcomes[key];
      html += '<button class="vpf-sabot-opt" data-key="' + _esc(key) + '">' +
        '<div class="vpf-sabot-title">' + _esc(o.label) + '</div>' +
        '<div class="vpf-sabot-tier">Sets tier to: <strong>' + _esc(o.tierSetTo) + '</strong></div>' +
        '<div class="vpf-sabot-read">' + _esc(o.readAloud) + '</div>' +
      '</button>';
    });
    html += '</div>';
    _openModal('Generator Sabotage Outcome', html, null, null);

    setTimeout(function () {
      document.querySelectorAll('.vpf-sabot-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.dataset.key;
          _applySabotage(key);
          _closeModal();
        });
      });
    }, 0);
  }

  function _applySabotage(outcomeKey) {
    var outcome = _data.sabotageCascade.outcomes[outcomeKey];
    if (!outcome) return;
    var ns = JSON.parse(JSON.stringify(_currentState));
    ns.sabotage = outcomeKey;
    ns.tier = outcome.tierSetTo;
    if (ns.tier === 'ORANGE') ns.orangeRound = 1;
    ns.flags = ns.flags || _defaultState().flags;
    Object.keys(outcome.flags).forEach(function (k) {
      var v = outcome.flags[k];
      if (v === true) ns.flags[k] = true;
      else if (v === false) ns.flags[k] = false;
      // 'gm-choice' leaves the existing value alone — GM toggles manually if wanted
    });
    _pushState(ns);
  }

  function _onReset() {
    if (!confirm('Reset the fortress to GREEN and clear all sabotage / cascade flags? (Use this between sessions or if you need to rewind.)')) return;
    _pushState(_defaultState());
  }

  // ---------- reference modal ----------

  function openReference() {
    if (!_data) { _loadData().then(openReference); return; }
    var html = '<div class="vpf-ref-section"><h3>Tiers</h3><div class="vpf-ref-tiers">' +
      _data.tiers.map(function (t) {
        return '<div class="vpf-ref-tier" style="border-color:' + t.color + ';">' +
          '<div class="vpf-ref-tier-chip" style="background:' + t.color + ';">' + _esc(t.label) + '</div>' +
          '<div class="vpf-ref-tier-line"><strong>One-liner:</strong> ' + _esc(t.oneLiner) + '</div>' +
          '<div class="vpf-ref-tier-line">' + _esc(t.summary) + '</div>' +
          '<div class="vpf-ref-tier-line"><strong>Patrol tempo:</strong> ' + _esc(t.patrolTempo) + '</div>' +
        '</div>';
      }).join('') + '</div></div>';

    html += '<div class="vpf-ref-section"><h3>Escalation triggers</h3><table class="vpf-ref-table"><thead><tr><th>Trigger</th><th>→ Tier</th><th>Read-aloud</th><th>Counter</th></tr></thead><tbody>' +
      _data.escalationTriggers.map(function (t) {
        return '<tr><td><strong>' + _esc(t.label) + '</strong></td><td>' + _esc(t.to) + '</td><td class="vpf-ref-cue">' + _esc(t.readAloud) + '</td><td>' + _esc(t.counter) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += '<div class="vpf-ref-section"><h3>De-escalation paths</h3><table class="vpf-ref-table"><thead><tr><th>Action</th><th>Path</th><th>Check</th><th>Read-aloud</th></tr></thead><tbody>' +
      _data.deEscalationTriggers.map(function (t) {
        return '<tr><td><strong>' + _esc(t.label) + '</strong></td><td>' + _esc(t.from) + ' → ' + _esc(t.to) + '</td><td>' + _esc(t.check) + '</td><td class="vpf-ref-cue">' + _esc(t.readAloud) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += '<div class="vpf-ref-section"><h3>Ratchet rules</h3><ul class="vpf-ref-list">' +
      _data.ratchet.paths.map(function (p) {
        return '<li><strong>' + _esc(p.from) + ' → ' + _esc(p.to) + ':</strong> ' +
          'reversible = <em>' + _esc(String(p.reversible)) + '</em>' +
          (p.window ? '. ' + _esc(p.window) : '') +
          (p.note   ? ' — ' + _esc(p.note)   : '') +
          (p.auto   ? ' AUTO: ' + _esc(p.auto) : '') +
          '</li>';
      }).join('') +
      '</ul><div class="vpf-ref-note">' + _esc(_data.ratchet.description) + '</div></div>';

    html += '<div class="vpf-ref-section"><h3>Reinforcement clock (from ORANGE)</h3><ol class="vpf-ref-list">' +
      _data.reinforcementClock.schedule.map(function (r) {
        return '<li><strong>Round ' + r.round + ':</strong> ' + _esc(r.event) + ' <em>[' + _esc(r.zone) + ']</em></li>';
      }).join('') + '</ol></div>';

    html += '<div class="vpf-ref-section"><h3>Draco clock (from RED)</h3><div class="vpf-ref-note">' + _esc(_data.reinforcementClock.dracoClock.description) + '</div><ol class="vpf-ref-list">' +
      _data.reinforcementClock.dracoClock.countdown.map(function (r) {
        return '<li><strong>Round ' + r.round + ':</strong> ' + _esc(r.event) + '</li>';
      }).join('') + '</ol></div>';

    html += '<div class="vpf-ref-section"><h3>Sabotage cascade</h3><div class="vpf-ref-note">' + _esc(_data.sabotageCascade.description) + '</div><table class="vpf-ref-table"><thead><tr><th>Outcome</th><th>Tier</th><th>Flags</th><th>Read-aloud</th></tr></thead><tbody>' +
      Object.keys(_data.sabotageCascade.outcomes).map(function (k) {
        var o = _data.sabotageCascade.outcomes[k];
        var flagStr = Object.keys(o.flags).map(function (fk) { return fk + '=' + o.flags[fk]; }).join('<br>');
        return '<tr><td><strong>' + _esc(o.label) + '</strong></td><td>' + _esc(o.tierSetTo) + '</td><td class="vpf-ref-flags">' + flagStr + '</td><td class="vpf-ref-cue">' + _esc(o.readAloud) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    _openModal('How the Vanishing Place reacts', html, null, null, true);
  }

  function _openModal(title, bodyHtml, okText, onOk, wide) {
    _closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'vpf-modal-overlay';
    overlay.id = 'vpf-modal';
    var box = document.createElement('div');
    box.className = 'vpf-modal-box' + (wide ? ' vpf-modal-wide' : '');
    box.innerHTML =
      '<div class="vpf-modal-head"><span>' + _esc(title) + '</span>' +
        '<button class="vpf-modal-close" title="Close">&times;</button></div>' +
      '<div class="vpf-modal-body">' + bodyHtml + '</div>' +
      '<div class="vpf-modal-foot">' +
        (okText ? '<button class="vpf-modal-ok">' + _esc(okText) + '</button>' : '') +
        '<button class="vpf-modal-cancel">' + (okText ? 'Cancel' : 'Close') + '</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector('.vpf-modal-close').addEventListener('click', _closeModal);
    box.querySelector('.vpf-modal-cancel').addEventListener('click', _closeModal);
    if (okText && onOk) {
      box.querySelector('.vpf-modal-ok').addEventListener('click', function () {
        try { onOk(); } finally { _closeModal(); }
      });
    }
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) _closeModal();
    });
  }

  function _closeModal() {
    var existing = document.getElementById('vpf-modal');
    if (existing) existing.remove();
  }

  // ---------- attach / detach ----------

  function _ensurePanel(hostEl) {
    if (_panel && _panel.parentNode === hostEl) return _panel;
    if (_panel) { _panel.remove(); _panel = null; }
    _panel = document.createElement('div');
    _panel.className = 'vpf-panel';
    _panel.innerHTML =
      '<div class="vpf-top">' +
        '<div class="vpf-header"></div>' +
        '<button class="vpf-toggle" title="Collapse / expand">Collapse</button>' +
      '</div>' +
      '<div class="vpf-body"></div>';
    hostEl.insertBefore(_panel, hostEl.firstChild);
    _panel.querySelector('.vpf-toggle').addEventListener('click', function () {
      _panel.classList.toggle('vpf-collapsed');
      this.textContent = _panel.classList.contains('vpf-collapsed') ? 'Expand' : 'Collapse';
    });
    return _panel;
  }

  function attach(opts) {
    var hostEl = opts.host;
    _socket = opts.socket || window._gmSocket || null;
    if (!hostEl) return;
    _ensurePanel(hostEl);
    _bindStateListener();
    _initState();
    // Ask the server for the current campaign_state. The state:sync listener will
    // overwrite _currentState and re-render when the server responds.
    if (_socket && typeof _socket.emit === 'function') {
      try { _socket.emit('state:request'); } catch (_) {}
    }
    _loadData().then(function () {
      _render();
    }).catch(function (err) {
      console.error('[vpf] load error:', err);
      var body = _panel.querySelector('.vpf-body');
      if (body) body.innerHTML = '<div style="color:#ef4444;padding:8px;">Failed to load fortress state data.</div>';
    });
  }

  function detach() {
    _unbindStateListener();
    if (_panel) { _panel.remove(); _panel = null; }
    _closeModal();
  }

  window.VanishingPlaceFortress = {
    attach: attach,
    detach: detach,
    openReference: openReference,
    STATE_KEY: STATE_KEY
  };
})();

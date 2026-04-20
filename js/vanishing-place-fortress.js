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
  var _viewer = null;
  var _zonePanelPatched = false;
  var _originalShowZoneInfo = null;

  // Maps a zone.state string to a visual intensity bucket. Drives hitbox tint.
  function _intensityOf(stateStr) {
    if (!stateStr) return 'calm';
    var s = String(stateStr).toLowerCase();
    // RED-tier state strings
    if (/receiving-draco|locked-in-or-dead|fenced-or-chaos|redeployed|guarded/.test(s)) return 'combat';
    // ORANGE-tier state strings
    if (/convergence-zone|sealed-externally|troop-transport|locked-from-inside|locked-in|armed-weapons-free|descending|command-active|staffed-active|converging|mag-locked-hot|looted-by-defenders/.test(s)) return 'hot';
    // YELLOW-tier state strings
    if (/alert|active|held|fenced-watched|standing|staffed-alert/.test(s)) return 'watchful';
    return 'calm';
  }

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
        '<button class="vpf-btn vpf-btn-trigger" title="Fire a specific escalation trigger (blaster fire, body found, alarm, etc.)">Trigger&hellip;</button>' +
        '<button class="vpf-btn vpf-btn-counter" title="Apply a counter-action (hide body, sever alarm, fake all-clear)">Counter&hellip;</button>' +
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
    $('.vpf-btn-trigger')  .addEventListener('click', _onOpenTriggerPicker);
    $('.vpf-btn-counter')  .addEventListener('click', _onOpenCounterPicker);
    $('.vpf-btn-sabotage') .addEventListener('click', _onSabotage);
    $('.vpf-btn-reset')    .addEventListener('click', _onReset);
    $('.vpf-btn-ref')      .addEventListener('click', openReference);
    var tickBtn = $('.vpf-btn-tick');
    if (tickBtn) tickBtn.addEventListener('click', _onTick);

    var toggleBtn = _panel.querySelector('.vpf-toggle');
    if (toggleBtn) toggleBtn.textContent = _panel.classList.contains('vpf-collapsed') ? 'Expand' : 'Collapse';

    // Tint hitboxes on the tactical map.
    _applyHitboxStates();
  }

  // ---------- user actions ----------

  var ORDER = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

  function _onOpenTriggerPicker() {
    var fromId = _currentState.tier;
    var applicable = (_data.escalationTriggers || []).filter(function (t) {
      return (t.from || []).indexOf(fromId) >= 0;
    });
    if (!applicable.length) {
      alert('No escalation triggers apply from ' + fromId + '. The fortress is already as hot as it gets.');
      return;
    }
    var html = '<div class="vpf-modal-sub">Pick the <em>specific</em> event that just happened in fiction. The chosen trigger sets the tier, fires the read-aloud cue, and logs the escalation reason.</div>' +
      '<div class="vpf-trigger-list">';
    applicable.forEach(function (t) {
      var toTier = _getTier(t.to);
      html += '<button class="vpf-trigger-opt" data-trigger-id="' + _esc(t.id) + '">' +
        '<div class="vpf-trigger-title">' +
          '<span class="vpf-trigger-label">' + _esc(t.label) + '</span>' +
          '<span class="vpf-trigger-arrow">→</span>' +
          '<span class="vpf-trigger-to" style="background:' + (toTier ? toTier.color : '#555') + ';color:#0a0a0a;">' + _esc(t.to) + '</span>' +
        '</div>' +
        '<div class="vpf-trigger-cue">' + _esc(t.readAloud) + '</div>' +
        (t.counter ? '<div class="vpf-trigger-counter"><strong>Counter:</strong> ' + _esc(t.counter) + '</div>' : '') +
        '</button>';
    });
    html += '</div>';
    _openModal('Escalation Trigger', html, null, null);
    setTimeout(function () {
      document.querySelectorAll('.vpf-trigger-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var trigId = btn.dataset.triggerId;
          var trig = applicable.filter(function (x) { return x.id === trigId; })[0];
          if (!trig) return;
          _closeModal();
          _applyTrigger(trig);
        });
      });
    }, 0);
  }

  function _onOpenCounterPicker() {
    var fromId = _currentState.tier;
    var applicable = (_data.deEscalationTriggers || []).filter(function (t) { return t.from === fromId; });
    if (!applicable.length) {
      alert('No counter-actions apply from ' + fromId + '. ' + (fromId === 'RED' ? 'RED is terminal. Draco is coming. There is no de-escalation.' : 'The fortress is already at its calmest.'));
      return;
    }
    var html = '<div class="vpf-modal-sub">The crew neutralized the escalation. Pick the counter-action the players pulled off.</div>' +
      '<div class="vpf-trigger-list">';
    applicable.forEach(function (t) {
      var toTier = _getTier(t.to);
      html += '<button class="vpf-trigger-opt" data-counter-id="' + _esc(t.id) + '">' +
        '<div class="vpf-trigger-title">' +
          '<span class="vpf-trigger-label">' + _esc(t.label) + '</span>' +
          '<span class="vpf-trigger-arrow">→</span>' +
          '<span class="vpf-trigger-to" style="background:' + (toTier ? toTier.color : '#555') + ';color:#0a0a0a;">' + _esc(t.to) + '</span>' +
        '</div>' +
        '<div class="vpf-trigger-cue">' + _esc(t.readAloud) + '</div>' +
        '<div class="vpf-trigger-counter"><strong>Check:</strong> ' + _esc(t.check) + '</div>' +
        '</button>';
    });
    html += '</div>';
    _openModal('Counter-action', html, null, null);
    setTimeout(function () {
      document.querySelectorAll('.vpf-trigger-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.counterId;
          var trig = applicable.filter(function (x) { return x.id === id; })[0];
          if (!trig) return;
          _closeModal();
          _applyDeEscTrigger(trig);
        });
      });
    }, 0);
  }

  function _applyTrigger(trig) {
    var toId = trig.to;
    var toTier = _getTier(toId);
    if (!toTier) return;
    var html =
      '<div class="vpf-modal-tier" style="background:' + toTier.bgColor + ';border-color:' + toTier.color + ';">' +
        '<div class="vpf-modal-tier-chip" style="background:' + toTier.color + ';">' + _esc(toTier.label) + '</div>' +
        '<div class="vpf-modal-tier-summary">' + _esc(toTier.summary) + '</div>' +
      '</div>' +
      '<div class="vpf-modal-cue"><div class="vpf-modal-cue-label">Trigger: ' + _esc(trig.label) + '</div><div class="vpf-modal-cue-text">' + _esc(trig.readAloud) + '</div></div>' +
      (trig.counter ? '<div class="vpf-modal-warn"><strong>Counter available:</strong> ' + _esc(trig.counter) + '</div>' : '') +
      '<div class="vpf-modal-section-label">NPC behavior at ' + _esc(toTier.label) + '</div>' +
      '<ul class="vpf-modal-npcs">' +
        _data.npcGroups.map(function (g) {
          return '<li><strong>' + _esc(g.label) + ':</strong> ' + _esc(g.byTier[toId]) + '</li>';
        }).join('') +
      '</ul>';

    _openModal('Fire trigger: ' + _esc(trig.label), html, 'Apply & read-aloud to players', function () {
      var fromId = _currentState.tier;
      var ns = JSON.parse(JSON.stringify(_currentState));
      ns.tier = toId;
      ns.lastTrigger = { id: trig.id, label: trig.label, from: fromId, to: toId, at: Date.now() };
      if (toId === 'ORANGE' && fromId !== 'ORANGE') ns.orangeRound = 1;
      if (toId === 'RED' && fromId !== 'RED') ns.redRound = 1;
      if (toId !== 'ORANGE') ns.orangeRound = toId === 'RED' ? 0 : ns.orangeRound;
      if (toId !== 'RED') ns.redRound = 0;
      _pushState(ns);
    });
  }

  function _applyDeEscTrigger(trig) {
    var toId = trig.to;
    var toTier = _getTier(toId);
    if (!toTier) return;
    var html =
      '<div class="vpf-modal-tier" style="background:' + toTier.bgColor + ';border-color:' + toTier.color + ';">' +
        '<div class="vpf-modal-tier-chip" style="background:' + toTier.color + ';">' + _esc(toTier.label) + '</div>' +
        '<div class="vpf-modal-tier-summary">' + _esc(toTier.summary) + '</div>' +
      '</div>' +
      '<div class="vpf-modal-warn"><strong>Window:</strong> ' + _esc(trig.check) + '</div>' +
      '<div class="vpf-modal-cue"><div class="vpf-modal-cue-label">Counter: ' + _esc(trig.label) + '</div><div class="vpf-modal-cue-text">' + _esc(trig.readAloud) + '</div></div>';
    _openModal('Apply counter: ' + _esc(trig.label), html, 'Roll back tier', function () {
      var ns = JSON.parse(JSON.stringify(_currentState));
      ns.tier = toId;
      ns.lastTrigger = { id: trig.id, label: trig.label, from: _currentState.tier, to: toId, at: Date.now(), kind: 'counter' };
      if (toId !== 'ORANGE') ns.orangeRound = 0;
      if (toId !== 'RED') ns.redRound = 0;
      _pushState(ns);
    });
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

  // ---------- map integration (tinting + zone panel) ----------

  function _findViewer(hostEl) {
    // TacticalMapViewer stores itself on its canvas element or container. Find it.
    if (!hostEl) return null;
    // Search within hostEl for a known-canvas marker.
    var canvas = hostEl.querySelector('.tm-canvas') || hostEl.querySelector('.tm-hitbox-layer');
    // Most viewers stash self on the container; check common parent slots.
    var probe = hostEl._tmViewer || hostEl.__tmViewer;
    if (probe) return probe;
    // Walk the container hierarchy looking for a viewer instance.
    var el = hostEl;
    while (el) {
      if (el._tmViewer) return el._tmViewer;
      if (el.__tmViewer) return el.__tmViewer;
      el = el.parentElement;
    }
    return null;
  }

  function _zoneForRoomName(room) {
    if (!_data || !_data.zones) return null;
    var target = String(room || '').toLowerCase().trim();
    for (var i = 0; i < _data.zones.length; i++) {
      var z = _data.zones[i];
      if (z.label && z.label.toLowerCase() === target) return z;
    }
    // Fuzzy: fortress-data "Exterior West (Staging Area)" vs hitbox "Exterior Staging Area"
    for (var j = 0; j < _data.zones.length; j++) {
      var z2 = _data.zones[j];
      var zl = z2.label.toLowerCase();
      if (zl.indexOf(target) >= 0 || target.indexOf(zl) >= 0) return z2;
      // Token match on first significant word
      var zlFirst = zl.split(/[\s\(\-]/)[0];
      var tgFirst = target.split(/[\s\(\-]/)[0];
      if (zlFirst && tgFirst && zlFirst === tgFirst) return z2;
    }
    return null;
  }

  function _applyHitboxStates() {
    try {
      if (!_data || !_currentState) return;
      // Find all hitbox rects in the currently-visible tactical map.
      // They live in the main document (SVG overlay), not the iframe.
      var hitboxes = document.querySelectorAll('.tm-hitbox-layer .tm-hitbox');
      if (!hitboxes.length) {
        // Try again shortly in case the viewer hasn't rendered yet.
        setTimeout(_applyHitboxStates, 250);
        return;
      }
      // Resolve zone idx → zone.room from the active viewer.
      var v = _viewer;
      if (!v || !v.meta) return;
      var zones = v.meta.zones || [];
      var tier = _currentState.tier;
      hitboxes.forEach(function (rect) {
        var idx = parseInt(rect.getAttribute('data-zone-idx'), 10);
        var mapZone = zones[idx];
        if (!mapZone) return;
        var fortressZone = _zoneForRoomName(mapZone.room);
        if (!fortressZone) {
          rect.removeAttribute('data-vpf-state');
          rect.removeAttribute('data-vpf-intensity');
          return;
        }
        var zt = fortressZone.byTier[tier] || {};
        rect.setAttribute('data-vpf-state', zt.state || '');
        rect.setAttribute('data-vpf-intensity', _intensityOf(zt.state));
      });
    } catch (e) { /* silent */ }
  }

  function _patchZonePanel() {
    if (_zonePanelPatched) return;
    var TMV = window.TacticalMapViewer;
    if (!TMV || !TMV.prototype || !TMV.prototype._showZoneInfo) return;
    _originalShowZoneInfo = TMV.prototype._showZoneInfo;
    var self = { original: _originalShowZoneInfo };
    TMV.prototype._showZoneInfo = function (idx) {
      self.original.call(this, idx);
      try {
        if (!_panel || !_data || !_currentState) return;
        // Only augment when we're the active map.
        if (!this.meta || this.meta.mapKey !== 'vanishing-place') return;
        var zone = this.meta.zones[idx];
        if (!zone) return;
        var fortressZone = _zoneForRoomName(zone.room);
        if (!fortressZone) return;
        var tier = _getTier(_currentState.tier);
        var zt = fortressZone.byTier[_currentState.tier] || {};
        var relevantNpcs = _data.npcGroups.filter(function (g) {
          var beh = (g.byTier[_currentState.tier] || '').toLowerCase();
          var zoneTokens = fortressZone.label.toLowerCase().split(/[\s\(\-,]+/);
          return zoneTokens.some(function (tok) { return tok.length > 3 && beh.indexOf(tok) >= 0; });
        });
        var html = '<div class="tm-zone-vpf-block" style="margin-top:10px;border-top:1px solid rgba(200,164,78,0.25);padding-top:8px;">' +
          '<div style="font-size:0.55rem;letter-spacing:0.14em;text-transform:uppercase;color:' + tier.color + ';margin-bottom:4px;">Fortress tier: ' + _esc(tier.label) + '</div>' +
          '<div style="font-size:0.62rem;margin-bottom:4px;"><span style="display:inline-block;background:rgba(200,164,78,0.12);border:1px solid rgba(200,164,78,0.3);color:#c8a44e;padding:1px 6px;border-radius:3px;font-size:0.52rem;letter-spacing:0.05em;text-transform:uppercase;">' + _esc(zt.state || '—') + '</span></div>' +
          '<div style="font-size:0.62rem;color:#a8a08a;line-height:1.45;">' + _esc(zt.note || '') + '</div>';
        if (relevantNpcs.length) {
          html += '<div style="font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;color:#c8a44e;margin-top:6px;margin-bottom:3px;">NPCs present / relevant</div>';
          relevantNpcs.forEach(function (g) {
            html += '<div style="font-size:0.6rem;margin-bottom:3px;"><strong style="color:#e6dcc4;">' + _esc(g.label) + ':</strong> ' + _esc(g.byTier[_currentState.tier] || '') + '</div>';
          });
        }
        html += '</div>';
        this._zonePanel.insertAdjacentHTML('beforeend', html);
      } catch (e) { /* silent */ }
    };
    _zonePanelPatched = true;
  }

  function _unpatchZonePanel() {
    if (!_zonePanelPatched) return;
    var TMV = window.TacticalMapViewer;
    if (TMV && TMV.prototype && _originalShowZoneInfo) {
      TMV.prototype._showZoneInfo = _originalShowZoneInfo;
    }
    _zonePanelPatched = false;
    _originalShowZoneInfo = null;
  }

  function attach(opts) {
    var hostEl = opts.host;
    _socket = opts.socket || window._gmSocket || null;
    _viewer = opts.viewer || _findViewer(hostEl);
    if (!hostEl) return;
    _ensurePanel(hostEl);
    _bindStateListener();
    _patchZonePanel();
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
    _unpatchZonePanel();
    // Clear any tint we applied.
    try {
      document.querySelectorAll('.tm-hitbox[data-vpf-state]').forEach(function (r) {
        r.removeAttribute('data-vpf-state');
        r.removeAttribute('data-vpf-intensity');
      });
    } catch (_) {}
    _viewer = null;
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

(function () {
  'use strict';

  function _showModal(opts) {
    var existing = document.getElementById('adv-modal-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'adv-modal-overlay';
    overlay.className = 'adv-modal-overlay';

    var box = document.createElement('div');
    box.className = 'adv-modal-box';

    var msg = document.createElement('div');
    msg.className = 'adv-modal-msg';
    msg.textContent = opts.message || '';
    box.appendChild(msg);

    if (opts.type === 'prompt') {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'adv-modal-input';
      if (opts.placeholder) input.placeholder = opts.placeholder;
      box.appendChild(input);
      setTimeout(function () { input.focus(); }, 50);
    }

    var actions = document.createElement('div');
    actions.className = 'adv-modal-actions';

    if (opts.type === 'alert') {
      var okBtn = document.createElement('button');
      okBtn.className = 'adv-modal-btn adv-modal-btn--primary';
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', function () { overlay.remove(); if (opts.onOk) opts.onOk(); });
      actions.appendChild(okBtn);
    } else if (opts.type === 'confirm') {
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'adv-modal-btn adv-modal-btn--cancel';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function () { overlay.remove(); if (opts.onCancel) opts.onCancel(); });
      actions.appendChild(cancelBtn);

      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'adv-modal-btn adv-modal-btn--primary';
      confirmBtn.textContent = opts.confirmLabel || 'Confirm';
      confirmBtn.addEventListener('click', function () { overlay.remove(); if (opts.onConfirm) opts.onConfirm(); });
      actions.appendChild(confirmBtn);
    } else if (opts.type === 'prompt') {
      var cancelBtn2 = document.createElement('button');
      cancelBtn2.className = 'adv-modal-btn adv-modal-btn--cancel';
      cancelBtn2.textContent = 'Cancel';
      cancelBtn2.addEventListener('click', function () { overlay.remove(); if (opts.onCancel) opts.onCancel(); });
      actions.appendChild(cancelBtn2);

      var submitBtn = document.createElement('button');
      submitBtn.className = 'adv-modal-btn adv-modal-btn--primary';
      submitBtn.textContent = opts.confirmLabel || 'OK';
      submitBtn.addEventListener('click', function () { overlay.remove(); if (opts.onSubmit) opts.onSubmit(input.value); });
      actions.appendChild(submitBtn);

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { overlay.remove(); if (opts.onSubmit) opts.onSubmit(input.value); }
      });
    }

    box.appendChild(actions);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.remove();
        if (opts.onCancel) opts.onCancel();
      }
    });
    document.body.appendChild(overlay);
  }

  var ADVENTURE_TRIGGERS = [
    { id: 'act_milestone_1', label: 'Act I Milestone',  value: 1, desc: 'Crew completes Act 1 or a major objective.', group: true },
    { id: 'act_milestone_2', label: 'Act II Milestone', value: 1, desc: 'Crew completes Act 2 or a major objective.', group: true },
    { id: 'act_milestone_3', label: 'Act III Milestone',value: 1, desc: 'Crew completes Act 3 or a major objective.', group: true },
    { id: 'crucible',        label: 'The Crucible',     value: 1, desc: 'The plan catastrophically fails and the crew improvises under fire to survive.', group: true },
    { id: 'hard_call',       label: 'The Hard Call',    value: 1, desc: 'Crew makes a definitive choice that shapes the story. Flips a Destiny Token.', group: true }
  ];

  var EDGE_TRIGGERS = [
    { id: 'gear_solved',     label: 'Gear Solved It',            value: 1, desc: 'Your gear helped you achieve a significant challenge that without it may not have been possible or would have been extremely dangerous.' },
    { id: 'env_weapon',      label: 'Environment Weapon',        value: 1, desc: 'You used the physical environment as a tactical tool — shot a steam pipe, toppled debris, lured someone into a hazard, used terrain to negate a disadvantage.' },
    { id: 'raw_power',       label: 'Raw Power',                 value: 1, desc: 'You achieved Unleashed on a roll without your Power die exploding. Pure skill and base dice got you there.' },
    { id: 'in_your_element', label: 'In Your Element',           value: 1, desc: 'One of your Favored Skills Unleashed and hit the Unleashed tier. Your specialty came through when it mattered.' },
    { id: 'plan_b',          label: 'Plan B',                    value: 1, desc: 'You failed a challenge that significantly worsened the scene, then adapted and still accomplished the goals of the mission (even if partially).' },
    { id: 'debt_collector',  label: 'Debt Collector',            value: 1, desc: 'You took on or paid off a debt (financial or narrative) during the adventure. Accrued interest, paid down a loan, called in a favor, or owed one.' }
  ];

  var _destinyData = null;
  var _allKitsData = null;
  var _currentAdventureId = 'adv1';

  var DISC_TRACK_SIZE = 5;
  var ARENA_TRACK_SIZE = 3;
  var VOC_TRACK_SIZE = 5;
  var DISC_GATE = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };
  var DIE_STEPS = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var DISC_UPGRADE_COST = {
    D4:  { adv: 2, elite: 0 },
    D6:  { adv: 1, elite: 0 },
    D8:  { adv: 1, elite: 1 },
    D10: { adv: 1, elite: 2 }
  };
  var ARENA_UPGRADE_COST = {
    D4: { adv: 2 },
    D6: { adv: 1 },
    D8: { adv: 3 },
    D10:{ adv: 5 }
  };

  var _charId = null;
  var _advancement = null;
  var _char = null;
  var _saveTimeout = null;
  var _collapsedBuckets = {};
  var _panelVisible = false;
  var _initialized = false;
  var _openSpendPanel = null;

  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _getMarkBuckets() {
    var destinyTriggers = [];
    var destinyName = 'Destiny';
    if (_destinyData && _char && _char.personalDestiny) {
      var pid = _char.personalDestiny.id || _char.personalDestiny;
      var found = _destinyData.find(function (d) { return d.id === pid; });
      if (found && found.marks) {
        destinyName = found.name;
        destinyTriggers = found.marks.map(function (m) {
          return { id: m.id, label: m.label, value: 1, desc: m.desc, tier: m.tier };
        });
      }
    }
    return [
      {
        bucket: 'The Adventure',
        subtitle: 'Shared Milestones',
        budget: '5 Marks',
        icon: '\u2694',
        key: 'adventure',
        triggers: ADVENTURE_TRIGGERS
      },
      {
        bucket: destinyName,
        subtitle: 'Destiny Marks',
        budget: '3 Marks',
        icon: '\u2605',
        key: 'destiny',
        triggers: destinyTriggers
      },
      {
        bucket: 'The Edge',
        subtitle: 'Systems & Grit',
        budget: '6 Marks',
        icon: '\u2699',
        key: 'edge',
        triggers: EDGE_TRIGGERS
      }
    ];
  }

  function _countEarnedMarks() {
    if (!_advancement || !_advancement.marks) return 0;
    var checks = _advancement.marks.earnedChecks || {};
    var total = 0;
    var buckets = _getMarkBuckets();
    buckets.forEach(function (bucket) {
      bucket.triggers.forEach(function (t) {
        if (checks[t.id]) total += t.value;
      });
    });
    return total;
  }

  function _totalMarks() {
    var banked = (_advancement && _advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;
    return banked + _countEarnedMarks();
  }

  function _getSocket() {
    return window._socket || null;
  }

  function _broadcastAdvancement() {
    var sock = _getSocket();
    if (sock && _charId && _advancement) {
      sock.emit('advancement:update', { characterId: _charId, advancement: _advancement });
    }
  }

  function _persist() {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(function () {
      if (!_charId || !_advancement) return;
      fetch('/api/characters/' + encodeURIComponent(_charId) + '/advancement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_advancement)
      }).catch(function (err) {
        console.error('[AdvancementPanel] save error', err);
      });
      _persistAdventureMarks();
      _broadcastAdvancement();
    }, 400);
  }

  function _persistAdventureMarks() {
    if (!_charId || !_advancement || !_advancement.marks) return;
    var checks = _advancement.marks.earnedChecks || {};
    var buckets = _getMarkBuckets();
    var marks = [];
    buckets.forEach(function (bucket) {
      bucket.triggers.forEach(function (t) {
        if (checks[t.id]) {
          marks.push({ mark_id: t.id, bucket: bucket.key });
        }
      });
    });
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/adventure-marks/' + encodeURIComponent(_currentAdventureId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marks: marks })
    }).catch(function (err) {
      console.error('[AdvancementPanel] adventure marks save error', err);
    });
  }

  function _countD12Arenas() {
    if (!_char || !_char.arenas) return 0;
    var count = 0;
    _char.arenas.forEach(function (a) {
      if (a.die === 'D12') count++;
    });
    return count;
  }

  function _ensureDefaults() {
    if (!_advancement) _advancement = {};
    if (!_advancement.marks) _advancement.marks = { earnedChecks: {}, totalBanked: 0 };
    if (!_advancement.disciplineTrack) _advancement.disciplineTrack = { level: 2, filled: 0, eliteTokens: 0, focusBurns: 0, unspentAdvances: 0, invested: 0 };
    if (_advancement.disciplineTrack.unspentAdvances === undefined) _advancement.disciplineTrack.unspentAdvances = 0;
    if (_advancement.disciplineTrack.invested === undefined) _advancement.disciplineTrack.invested = 0;
    if (!_advancement.arenaTrack) _advancement.arenaTrack = { level: 2, filled: 0, unspentAdvances: 0, invested: 0 };
    if (_advancement.arenaTrack.unspentAdvances === undefined) _advancement.arenaTrack.unspentAdvances = 0;
    if (_advancement.arenaTrack.invested === undefined) _advancement.arenaTrack.invested = 0;
    if (!_advancement.vocationTrack) _advancement.vocationTrack = { level: 2, filled: 0, unspentAdvances: 0, invested: 0 };
    if (_advancement.vocationTrack.unspentAdvances === undefined) _advancement.vocationTrack.unspentAdvances = 0;
    if (_advancement.vocationTrack.invested === undefined) _advancement.vocationTrack.invested = 0;
    if (!_advancement.vocationUnlocks) _advancement.vocationUnlocks = {};
    if (!_advancement.missionPhase) _advancement.missionPhase = 'mission';
  }

  function _getUninvestedMarks() {
    var earned = _countEarnedMarks();
    var banked = (_advancement && _advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;
    var totalPool = earned + banked;
    var totalInvested = (_advancement.disciplineTrack.invested || 0)
                      + (_advancement.arenaTrack.invested || 0)
                      + (_advancement.vocationTrack.invested || 0);
    return totalPool - totalInvested;
  }

  function _isAdvancementPhase() {
    return _advancement && _advancement.missionPhase === 'advancement';
  }

  function _buildMarkChecklist() {
    var checks = (_advancement && _advancement.marks) ? (_advancement.marks.earnedChecks || {}) : {};
    var buckets = _getMarkBuckets();
    var html = '';

    buckets.forEach(function (bucket, bIdx) {
      var collapsed = _collapsedBuckets[bIdx];
      var chevron = collapsed ? '\u25B6' : '\u25BC';
      var bucketEarned = 0;
      bucket.triggers.forEach(function (t) { if (checks[t.id]) bucketEarned += t.value; });
      var countBadge = bucketEarned > 0 ? ' <span class="adv-bucket-earned">' + bucketEarned + '</span>' : '';
      html += '<div class="adv-bucket" data-bucket-key="' + _esc(bucket.key) + '">';
      html += '<div class="adv-bucket-header" data-bucket-idx="' + bIdx + '">';
      html += '<span class="adv-bucket-chevron">' + chevron + '</span>';
      html += '<span class="adv-bucket-icon">' + bucket.icon + '</span>';
      html += '<span class="adv-bucket-title">' + _esc(bucket.bucket) + countBadge + '</span>';
      html += '<span class="adv-bucket-subtitle">' + _esc(bucket.subtitle) + '</span>';
      html += '<span class="adv-bucket-budget">' + _esc(bucket.budget) + '</span>';
      html += '</div>';
      if (!collapsed) {
        if (bucket.triggers.length === 0) {
          html += '<div class="adv-bucket-triggers"><div class="adv-trigger-empty">No destiny selected.</div></div>';
        } else {
          html += '<div class="adv-bucket-triggers">';
          bucket.triggers.forEach(function (t) {
            var checked = checks[t.id] ? ' checked' : '';
            var groupTag = t.group ? '<span class="adv-tag adv-tag--group">GROUP</span>' : '';
            var tierTag = t.tier ? '<span class="adv-tag adv-tag--tier">TIER ' + t.tier + '</span>' : '';
            html += '<label class="adv-trigger-row">';
            html += '<input type="checkbox" class="adv-trigger-check" data-trigger-id="' + _esc(t.id) + '" data-bucket="' + _esc(bucket.key) + '"' + checked + ' />';
            html += '<div class="adv-trigger-info">';
            html += '<span class="adv-trigger-label">' + _esc(t.label) + groupTag + tierTag + '</span>';
            html += '<span class="adv-trigger-desc">' + _esc(t.desc) + '</span>';
            html += '</div>';
            html += '</label>';
          });
          html += '</div>';
        }
      }
      html += '</div>';
    });
    return html;
  }

  function _buildInvestRow(trackKey, label, currentInv, uninvested) {
    var canAdd = uninvested > 0;
    var canSub = currentInv > 0;
    var html = '<div class="adv-invest-row">';
    html += '<span class="adv-invest-label">' + _esc(label) + '</span>';
    html += '<div class="adv-invest-stepper">';
    html += '<button class="adv-invest-btn" data-invest-track="' + trackKey + '" data-invest-dir="sub"' + (canSub ? '' : ' disabled') + '>\u2212</button>';
    html += '<span class="adv-invest-value">' + currentInv + '</span>';
    html += '<button class="adv-invest-btn" data-invest-track="' + trackKey + '" data-invest-dir="add"' + (canAdd ? '' : ' disabled') + '>+</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function _buildPipTrack(trackKey, trackObj, trackSize, costMult, label, extraAfterPips) {
    var costPerBox = trackObj.level * costMult;
    var totalTrackCost = costPerBox * trackSize;
    var unspent = trackObj.unspentAdvances || 0;
    var invested = trackObj.invested || 0;
    var inAdv = _isAdvancementPhase();
    var pipShape = trackKey === 'disc' ? ' adv-pip--disc' : ' adv-pip--square';
    var html = '';
    html += '<div class="adv-track-section">';
    html += '<div class="adv-track-header">';
    html += '<span class="adv-track-title">' + _esc(label) + '</span>';
    html += '<span class="adv-track-meta">Track ' + trackObj.level + ' \u2022 ' + costPerBox + ' Mark' + (costPerBox > 1 ? 's' : '') + '/pip \u2022 ' + totalTrackCost + ' to clear</span>';
    html += '</div>';

    html += '<div class="adv-track-pips">';
    for (var i = 0; i < trackSize; i++) {
      var filled = i < trackObj.filled ? ' adv-pip--filled' : '';
      var clickable = inAdv ? '' : ' adv-pip--locked';
      html += '<span class="adv-pip' + pipShape + filled + clickable + '" data-track="' + trackKey + '" data-index="' + i + '"></span>';
    }
    html += '</div>';

    html += '<div class="adv-track-stats">';
    html += '<span class="adv-stat"><b>Progress:</b> ' + trackObj.filled + '/' + trackSize + '</span>';
    html += '<span class="adv-stat"><b>Invested:</b> ' + invested + '</span>';
    html += '<span class="adv-stat adv-stat--advances"><b>Unspent Advances:</b> ' + unspent + '</span>';
    html += '</div>';

    if (inAdv) {
      html += '<div class="adv-track-actions">';
      html += '<button class="adv-btn adv-btn--spend' + (unspent < 1 ? ' adv-btn--disabled' : '') + '" data-spend-track="' + trackKey + '"' + (unspent < 1 ? ' disabled' : '') + '>Spend Advance</button>';
      html += '</div>';
    }

    if (extraAfterPips) html += extraAfterPips;

    html += '</div>';
    return html;
  }

  function _buildDisciplineTrack() {
    var dt = _advancement.disciplineTrack;
    var costPerBox = dt.level;
    var invested = dt.invested || 0;
    var focusBurnCost = costPerBox * 2;
    var inAdv = _isAdvancementPhase();
    var canFocusBurn = inAdv && invested >= focusBurnCost;

    var extra = '';
    extra += '<div class="adv-track-stats">';
    extra += '<span class="adv-stat adv-stat--elite"><b>Elite Tokens:</b> ' + (dt.eliteTokens || 0) + '</span>';
    extra += '<span class="adv-stat"><b>Focus Burns:</b> ' + (dt.focusBurns || 0) + '</span>';
    extra += '</div>';

    if (inAdv) {
      extra += '<div class="adv-track-actions">';
      extra += '<button class="adv-btn adv-btn--focus' + (canFocusBurn ? '' : ' adv-btn--disabled') + '" id="adv-focus-burn-btn" title="Pay ' + focusBurnCost + ' invested mark(s), fill 2 pips, skip die advance, accelerate toward Elite Token"' + (canFocusBurn ? '' : ' disabled') + '>Focus Burn (' + focusBurnCost + 'M)</button>';
      extra += '</div>';
    }

    if (_openSpendPanel === 'disc') {
      extra += _buildDisciplineSpendPanel();
    } else {
      extra += '<div class="adv-track-ref">';
      extra += '<div class="adv-ref-title">Discipline Die Costs</div>';
      extra += '<div class="adv-ref-row">D4 \u2192 D6 (Fixing a Flaw): 2 Advances</div>';
      extra += '<div class="adv-ref-row">D6 \u2192 D8: 1 Advance</div>';
      extra += '<div class="adv-ref-row">D8 \u2192 D10: 1 Advance + 1 Elite Token</div>';
      extra += '<div class="adv-ref-row">D10 \u2192 D12: 1 Advance + 2 Elite Tokens</div>';
      extra += '<div class="adv-ref-row adv-ref-note">Focus Burn: Pay 2\u00d7 Mark cost, fill 2 pips, skip die advance, accelerate toward Elite Token.</div>';
      extra += '</div>';
    }

    return _buildPipTrack('disc', dt, DISC_TRACK_SIZE, 1, 'Discipline Track', extra);
  }

  function _buildArenaTrack() {
    var at = _advancement.arenaTrack;

    var extra = '';
    if (_openSpendPanel === 'arena') {
      extra += _buildArenaSpendPanel();
    } else {
      var d12Count = _countD12Arenas();
      if (d12Count >= 1) {
        extra += '<div class="adv-apex-warning">\u26A0 Apex Rule Active: You already have an Arena at D12. Pushing another to D12 will degrade the first to D10.</div>';
      }
      extra += '<div class="adv-track-ref">';
      extra += '<div class="adv-ref-title">Arena Die Costs</div>';
      extra += '<div class="adv-ref-row">D4 \u2192 D6 (Fixing a Flaw): 2 Advances</div>';
      extra += '<div class="adv-ref-row">D6 \u2192 D8: 1 Advance</div>';
      extra += '<div class="adv-ref-row">D8 \u2192 D10: 3 Advances</div>';
      extra += '<div class="adv-ref-row">D10 \u2192 D12 (Master): 5 Advances</div>';
      extra += '<div class="adv-ref-row adv-ref-note">Apex Rule: Only one Arena may be at D12. Pushing a second degrades the first to D10.</div>';
      extra += '</div>';
    }

    return _buildPipTrack('arena', at, ARENA_TRACK_SIZE, 3, 'Arena Track', extra);
  }

  function _buildVocationTrack() {
    var vt = _advancement.vocationTrack;
    var kits = (_char && _char.kits) ? _char.kits : [];

    var extra = '';

    if (kits.length > 0) {
      extra += '<div class="adv-voc-list">';
      kits.forEach(function (kit) {
        var kitId = kit.id || kit.kitId || '';
        var currentTier = kit.tier || kit.currentTier || 1;
        var kitLabel = kit.name || kit.label || kitId;
        var favDisc = kit.favoredDiscipline || '\u2014';
        var favDie = _getFavoredDie(favDisc);
        var maxTier = DISC_GATE[favDie] || 1;

        extra += '<div class="adv-voc-card">';
        extra += '<div class="adv-voc-name">' + _esc(kitLabel) + '</div>';
        extra += '<div class="adv-voc-gate">Favored: ' + _esc(favDisc) + ' (' + _esc(favDie) + ') \u2014 Max Tier ' + maxTier + ' \u2022 Current Tier ' + currentTier + '</div>';
        extra += '<div class="adv-voc-tiers">';
        for (var tier = 1; tier <= 5; tier++) {
          var unlocked = tier <= currentTier;
          var gated = tier > maxTier;
          var cls = 'adv-voc-tier';
          if (unlocked) cls += ' adv-voc-tier--unlocked';
          if (gated && !unlocked) cls += ' adv-voc-tier--gated';
          extra += '<span class="' + cls + '">T' + tier + '</span>';
        }
        extra += '</div></div>';
      });
      extra += '</div>';
    } else {
      extra += '<div class="adv-voc-empty">No vocations assigned.</div>';
    }

    if (_openSpendPanel === 'voc') {
      extra += _buildVocationSpendPanel();
    } else {
      extra += '<div class="adv-track-ref">';
      extra += '<div class="adv-ref-title">Discipline Gate</div>';
      extra += '<div class="adv-ref-row">D4: Max Tier 1 \u2022 D6: Max Tier 2 \u2022 D8: Max Tier 3</div>';
      extra += '<div class="adv-ref-row">D10: Max Tier 4 \u2022 D12: Max Tier 5</div>';
      extra += '<div class="adv-ref-row adv-ref-note">Spend 1 Advance to bump any eligible vocation up 1 tier.</div>';
      extra += '</div>';
    }

    return _buildPipTrack('voc', vt, VOC_TRACK_SIZE, 3, 'Vocation Track', extra);
  }

  function _getFavoredDie(discId) {
    if (!_char || !_char.arenas) return 'D6';
    var clean = (discId || '').toLowerCase().replace(/\s+/g, '');
    for (var i = 0; i < _char.arenas.length; i++) {
      var arena = _char.arenas[i];
      if (!arena.disciplines) continue;
      for (var j = 0; j < arena.disciplines.length; j++) {
        var d = arena.disciplines[j];
        if (d.id === clean || (d.label || '').toLowerCase().replace(/\s+/g, '') === clean) {
          return d.die || 'D6';
        }
      }
    }
    return 'D6';
  }

  var DEBT_CREDITORS = [
    { id: 'hutt_cartel', name: 'The Hutt Cartel', interest: '10%', rate: 0.10 },
    { id: 'black_sun', name: 'Black Sun', interest: '15%', rate: 0.15 },
    { id: 'imperial_surplus', name: 'Imperial Surplus Broker', interest: '20%', rate: 0.20 },
    { id: 'czerka_arms', name: 'Czerka Arms', interest: '25%', rate: 0.25 },
    { id: 'local_fixer', name: 'Local Fixer', interest: '30%', rate: 0.30 },
  ];

  function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _buildCreditsAndLedger() {
    if (!_char) return '';
    var html = '';
    var credits = _char.credits || 0;

    html += '<div class="adv-section-divider" style="margin-top:18px">CREDITS &amp; DEBT</div>';

    html += '<div class="char-credits-bar">' +
      '<span class="char-credits-label">Credits on Hand</span>' +
      '<span class="char-credits-value" id="adv-credits-display">' + credits.toLocaleString() + ' cr</span>' +
      '<div class="char-credits-controls">' +
        '<button class="char-credits-btn" id="adv-credits-add" title="Add credits">+</button>' +
        '<button class="char-credits-btn" id="adv-credits-sub" title="Subtract credits">&minus;</button>' +
      '</div>' +
    '</div>';

    var debt = _char.debt;
    if (debt && debt.balance > 0) {
      var creditor = DEBT_CREDITORS.find(function(c) { return c.id === debt.creditorId; }) || DEBT_CREDITORS[0];
      var rateLabel = Math.round((debt.rate || creditor.rate) * 100) + '%';
      var nextCycle = Math.round(debt.balance * (1 + (debt.rate || creditor.rate)));

      html += '<div class="char-ledger-card">' +
        '<div class="char-ledger-header">' +
          '<span class="char-ledger-title">The Ledger</span>' +
          '<span class="char-ledger-creditor">' + _escHtml(creditor.name) + '</span>' +
        '</div>' +
        '<div class="char-ledger-body">' +
          '<div class="char-ledger-row">' +
            '<span class="char-ledger-label">Principal</span>' +
            '<span class="char-ledger-val">' + (debt.principal || 0).toLocaleString() + ' cr</span>' +
          '</div>' +
          '<div class="char-ledger-row char-ledger-row--balance">' +
            '<span class="char-ledger-label">Balance Owed</span>' +
            '<span class="char-ledger-val char-ledger-val--danger">' + debt.balance.toLocaleString() + ' cr</span>' +
          '</div>' +
          '<div class="char-ledger-row">' +
            '<span class="char-ledger-label">Interest Rate</span>' +
            '<span class="char-ledger-val">' + _escHtml(rateLabel) + ' compound</span>' +
          '</div>' +
          '<div class="char-ledger-row">' +
            '<span class="char-ledger-label">Cycles Elapsed</span>' +
            '<span class="char-ledger-val">' + (debt.cyclesElapsed || 0) + '</span>' +
          '</div>' +
          '<div class="char-ledger-row">' +
            '<span class="char-ledger-label">After Next Cycle</span>' +
            '<span class="char-ledger-val char-ledger-val--warn">' + nextCycle.toLocaleString() + ' cr</span>' +
          '</div>' +
        '</div>' +
        '<div class="char-ledger-actions">' +
          '<button class="char-ledger-pay-btn" id="adv-ledger-pay">Make Payment</button>' +
          '<button class="char-ledger-accrue-btn" id="adv-ledger-accrue" title="Compound interest (end of adventure)">Accrue Interest</button>' +
        '</div>';

      var history = debt.history || [];
      if (history.length > 0) {
        html += '<div class="char-ledger-history">' +
          '<div class="char-ledger-history-label">History</div>';
        var recent = history.slice(-8).reverse();
        for (var h = 0; h < recent.length; h++) {
          var entry = recent[h];
          if (entry.type === 'payment') {
            html += '<div class="char-ledger-history-row char-ledger-history--payment">' +
              '<span>Payment</span><span>-' + entry.amount.toLocaleString() + ' cr</span>' +
              '<span>Bal: ' + entry.balanceAfter.toLocaleString() + ' cr</span></div>';
          } else if (entry.type === 'interest') {
            html += '<div class="char-ledger-history-row char-ledger-history--interest">' +
              '<span>Cycle ' + entry.cycle + '</span><span>+' + entry.amount.toLocaleString() + ' cr</span>' +
              '<span>Bal: ' + entry.balanceAfter.toLocaleString() + ' cr</span></div>';
          }
        }
        html += '</div>';
      }

      html += '</div>';
    } else if (!debt || debt.balance <= 0) {
      html += '<div class="char-ledger-card" style="opacity:0.5">' +
        '<div class="char-ledger-header">' +
          '<span class="char-ledger-title">The Ledger</span>' +
          '<span class="char-ledger-creditor" style="color:var(--color-success)">Debt Free</span>' +
        '</div>' +
      '</div>';
    }

    return html;
  }

  function _patchCredits(action, amount) {
    if (!_charId) return;
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/credits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, amount: amount })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok && _char) {
        _char.credits = data.credits;
        var cp = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (cp) cp.credits = data.credits;
        _render();
      }
    })
    .catch(function(err) { console.error('[Credits]', err); });
  }

  function _patchDebtPay(amount) {
    if (!_charId) return;
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/debt/pay', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok && _char) {
        _char.credits = data.credits;
        _char.debt = data.debt;
        var cp = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (cp) { cp.credits = data.credits; cp.debt = data.debt; }
        _render();
      } else if (data.error) {
        _showModal({ type: 'alert', message: data.error });
      }
    })
    .catch(function(err) { console.error('[DebtPay]', err); });
  }

  function _patchDebtAccrue() {
    if (!_charId) return;
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/debt/accrue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok && _char) {
        _char.debt = data.debt;
        var cp = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (cp) cp.debt = data.debt;
        _render();
      } else if (data.error) {
        _showModal({ type: 'alert', message: data.error });
      }
    })
    .catch(function(err) { console.error('[DebtAccrue]', err); });
  }

  function _render() {
    var container = document.getElementById('panel-5');
    if (!container) return;
    _ensureDefaults();

    var earned = _countEarnedMarks();
    var banked = (_advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;
    var totalPool = earned + banked;
    var uninvested = _getUninvestedMarks();
    var inAdv = _isAdvancementPhase();
    var discInv = _advancement.disciplineTrack.invested || 0;
    var arenaInv = _advancement.arenaTrack.invested || 0;
    var vocInv = _advancement.vocationTrack.invested || 0;

    var html = '<div class="adv-panel">';

    html += '<div class="adv-header">';
    html += '<div class="adv-header-title">ADVANCEMENT ENGINE</div>';
    if (inAdv) {
      html += '<div class="adv-header-subtitle adv-phase-badge adv-phase-badge--adv">ADVANCEMENT PHASE \u2014 Spend invested marks on upgrades</div>';
    } else {
      html += '<div class="adv-header-subtitle adv-phase-badge adv-phase-badge--mission">MISSION PHASE \u2014 Earn marks and invest into tracks</div>';
    }
    html += '</div>';

    var totalInvested = discInv + arenaInv + vocInv;
    var displayMarks = inAdv ? totalInvested : uninvested;
    var displayLabel = inAdv ? 'INVESTED' : 'AVAILABLE';

    html += '<div class="adv-marks-summary">';
    html += '<div class="adv-marks-total">';
    html += '<span class="adv-marks-number">' + displayMarks + '</span>';
    html += '<span class="adv-marks-label">' + displayLabel + '</span>';
    html += '</div>';
    html += '<div class="adv-marks-breakdown">';
    html += '<span class="adv-marks-detail">Earned this adventure: ' + earned + '</span>';
    if (banked > 0) html += '<span class="adv-marks-detail">Carried over: ' + banked + '</span>';
    if (!inAdv && totalInvested > 0) html += '<span class="adv-marks-detail">Invested: ' + totalInvested + '</span>';
    html += '</div>';

    if (!inAdv) {
      html += '<div class="adv-invest-section">';
      html += '<div class="adv-invest-title">Invest Marks Into Tracks</div>';
      html += _buildInvestRow('disc', 'Discipline', discInv, uninvested);
      html += _buildInvestRow('arena', 'Arena', arenaInv, uninvested);
      html += _buildInvestRow('voc', 'Vocation', vocInv, uninvested);
      html += '</div>';

      html += '<div class="adv-marks-actions">';
      html += '<button class="adv-btn adv-btn--endmission" id="adv-end-mission-btn" title="End mission: lock in investments and enable advancement spending">End Mission</button>';
      html += '</div>';
    } else {
      html += '<div class="adv-invest-section">';
      html += '<div class="adv-invest-title">Invested Marks</div>';
      html += '<div class="adv-invest-locked">';
      html += '<span>Discipline: ' + discInv + '</span>';
      html += '<span>Arena: ' + arenaInv + '</span>';
      html += '<span>Vocation: ' + vocInv + '</span>';
      html += '</div>';
      html += '</div>';

      html += '<div class="adv-marks-actions">';
      html += '<button class="adv-btn adv-btn--startmission" id="adv-start-mission-btn" title="Start new mission: reset marks and re-enable earning">Start Mission</button>';
      html += '</div>';
    }
    html += '</div>';

    if (!inAdv) {
      html += '<div class="adv-checklist-wrap">';
      html += _buildMarkChecklist();
      html += '</div>';
    }

    html += '<div class="adv-tracks-wrap">';
    html += '<div class="adv-section-divider">ADVANCEMENT TRACKS</div>';
    html += _buildDisciplineTrack();
    html += _buildArenaTrack();
    html += _buildVocationTrack();
    html += '<div class="adv-4th-placeholder"><span class="adv-4th-placeholder-text">Additional track slot reserved</span></div>';
    html += '</div>';

    html += _buildCreditsAndLedger();

    html += '</div>';

    container.innerHTML = html;
    _bindEvents(container);
  }

  function _bindEvents(container) {
    var checks = container.querySelectorAll('.adv-trigger-check');
    checks.forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-trigger-id');
        if (!_advancement.marks.earnedChecks) _advancement.marks.earnedChecks = {};
        _advancement.marks.earnedChecks[id] = cb.checked;
        _updateMarksSummary();
        _persist();
      });
    });

    var pips = container.querySelectorAll('.adv-pip');
    pips.forEach(function (pip) {
      if (pip.classList.contains('adv-pip--locked')) return;
      pip.addEventListener('click', function () {
        var track = pip.getAttribute('data-track');
        var index = parseInt(pip.getAttribute('data-index'), 10);
        _handlePipClick(track, index);
      });
    });

    var investBtns = container.querySelectorAll('.adv-invest-btn');
    investBtns.forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function () {
        var trackKey = btn.getAttribute('data-invest-track');
        var dir = btn.getAttribute('data-invest-dir');
        var t = _getTrackObj(trackKey);
        if (!t) return;
        if (dir === 'add') {
          if (_getUninvestedMarks() > 0) {
            t.invested = (t.invested || 0) + 1;
            _persist();
            _render();
          }
        } else if (dir === 'sub') {
          if ((t.invested || 0) > 0) {
            t.invested = t.invested - 1;
            _persist();
            _render();
          }
        }
      });
    });

    var endMissionBtn = container.querySelector('#adv-end-mission-btn');
    if (endMissionBtn) {
      endMissionBtn.addEventListener('click', function () {
        var uninvested = _getUninvestedMarks();
        if (uninvested > 0) {
          _showModal({ type: 'alert', message: 'You have ' + uninvested + ' uninvested mark(s). Invest all marks into tracks before ending the mission.' });
          return;
        }
        _advancement.missionPhase = 'advancement';
        _persist();
        _render();
      });
    }

    var startMissionBtn = container.querySelector('#adv-start-mission-btn');
    if (startMissionBtn) {
      startMissionBtn.addEventListener('click', function () {
        _advancement.missionPhase = 'mission';
        var carry = (_advancement.disciplineTrack.invested || 0)
                  + (_advancement.arenaTrack.invested || 0)
                  + (_advancement.vocationTrack.invested || 0);
        _advancement.marks.totalBanked = carry;
        _advancement.marks.earnedChecks = {};
        _persistAdventureMarks();
        _persist();
        _render();
      });
    }

    var bucketHeaders = container.querySelectorAll('.adv-bucket-header');
    bucketHeaders.forEach(function (hdr) {
      hdr.addEventListener('click', function (e) {
        if (e.target.closest('.adv-trigger-check')) return;
        var idx = parseInt(hdr.getAttribute('data-bucket-idx'), 10);
        _collapsedBuckets[idx] = !_collapsedBuckets[idx];
        _render();
      });
    });

    var focusBurnBtn = container.querySelector('#adv-focus-burn-btn');
    if (focusBurnBtn) {
      focusBurnBtn.addEventListener('click', function () {
        _handleFocusBurn();
      });
    }

    var spendBtns = container.querySelectorAll('.adv-btn--spend');
    spendBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var trackKey = btn.getAttribute('data-spend-track');
        _handleSpendAdvance(trackKey);
      });
    });

    var closeBtns = container.querySelectorAll('.adv-spend-close');
    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        _openSpendPanel = null;
        _render();
      });
    });

    var discRows = container.querySelectorAll('[data-upgrade-disc]');
    discRows.forEach(function (row) {
      if (row.classList.contains('adv-spend-row--locked')) return;
      row.addEventListener('click', function () {
        var parts = row.getAttribute('data-upgrade-disc').split(',');
        _applyDisciplineUpgrade(parseInt(parts[0], 10), parseInt(parts[1], 10));
      });
    });

    var arenaRows = container.querySelectorAll('[data-upgrade-arena]');
    arenaRows.forEach(function (row) {
      if (row.classList.contains('adv-spend-row--locked')) return;
      row.addEventListener('click', function () {
        var idx = parseInt(row.getAttribute('data-upgrade-arena'), 10);
        _applyArenaUpgrade(idx);
      });
    });

    var vocRows = container.querySelectorAll('[data-upgrade-voc]');
    vocRows.forEach(function (row) {
      if (row.classList.contains('adv-spend-row--locked')) return;
      row.addEventListener('click', function () {
        var idx = parseInt(row.getAttribute('data-upgrade-voc'), 10);
        _applyVocationUpgrade(idx);
      });
    });

    var learnRows = container.querySelectorAll('[data-learn-voc]');
    learnRows.forEach(function (row) {
      if (row.classList.contains('adv-spend-row--locked')) return;
      row.addEventListener('click', function () {
        var kitId = row.getAttribute('data-learn-voc');
        _learnNewVocation(kitId);
      });
    });

    var credAddBtn = container.querySelector('#adv-credits-add');
    var credSubBtn = container.querySelector('#adv-credits-sub');
    if (credAddBtn) {
      credAddBtn.addEventListener('click', function () {
        _showModal({
          type: 'prompt',
          message: 'Credits to add:',
          placeholder: 'Amount',
          onSubmit: function (val) {
            var amt = parseInt(val, 10);
            if (isNaN(amt) || amt <= 0) return;
            _patchCredits('add', amt);
          }
        });
      });
    }
    if (credSubBtn) {
      credSubBtn.addEventListener('click', function () {
        _showModal({
          type: 'prompt',
          message: 'Credits to subtract:',
          placeholder: 'Amount',
          onSubmit: function (val) {
            var amt = parseInt(val, 10);
            if (isNaN(amt) || amt <= 0) return;
            _patchCredits('subtract', amt);
          }
        });
      });
    }

    var payBtn = container.querySelector('#adv-ledger-pay');
    if (payBtn) {
      payBtn.addEventListener('click', function () {
        _showModal({
          type: 'prompt',
          message: 'Payment amount (credits):',
          placeholder: 'Amount',
          onSubmit: function (val) {
            var amt = parseInt(val, 10);
            if (isNaN(amt) || amt <= 0) return;
            _patchDebtPay(amt);
          }
        });
      });
    }

    var accrueBtn = container.querySelector('#adv-ledger-accrue');
    if (accrueBtn) {
      accrueBtn.addEventListener('click', function () {
        _showModal({
          type: 'confirm',
          message: 'Compound interest on debt? This happens at end-of-adventure settlement.',
          confirmLabel: 'Accrue',
          onConfirm: function () { _patchDebtAccrue(); }
        });
      });
    }
  }

  function _spendFromTrack(trackKey, cost) {
    var t = _getTrackObj(trackKey);
    if (!t) return false;
    var inv = t.invested || 0;
    if (inv >= cost) {
      t.invested = inv - cost;
      return true;
    }
    return false;
  }

  function _refundToTrack(trackKey, cost) {
    var t = _getTrackObj(trackKey);
    if (!t) return;
    t.invested = (t.invested || 0) + cost;
  }

  function _getTrackObj(trackKey) {
    if (trackKey === 'disc') return _advancement.disciplineTrack;
    if (trackKey === 'arena') return _advancement.arenaTrack;
    if (trackKey === 'voc') return _advancement.vocationTrack;
    return null;
  }

  function _getTrackSize(trackKey) {
    if (trackKey === 'disc') return DISC_TRACK_SIZE;
    if (trackKey === 'arena') return ARENA_TRACK_SIZE;
    if (trackKey === 'voc') return VOC_TRACK_SIZE;
    return 5;
  }

  function _getCostMult(trackKey) {
    if (trackKey === 'disc') return 1;
    return 3;
  }

  function _handlePipClick(trackKey, index) {
    if (!_isAdvancementPhase()) return;
    var t = _getTrackObj(trackKey);
    if (!t) return;
    var costPerBox = t.level * _getCostMult(trackKey);
    var trackSize = _getTrackSize(trackKey);

    if (index === t.filled) {
      if (!_spendFromTrack(trackKey, costPerBox)) return;
      t.filled++;
      t.unspentAdvances = (t.unspentAdvances || 0) + 1;
      if (t.filled >= trackSize) {
        if (trackKey === 'disc') {
          t.eliteTokens = (t.eliteTokens || 0) + 1;
        }
        t.level++;
        t.filled = 0;
      }
      _persist();
      _render();
    } else if (index === t.filled - 1) {
      _refundToTrack(trackKey, costPerBox);
      t.filled--;
      t.unspentAdvances = Math.max(0, (t.unspentAdvances || 0) - 1);
      _persist();
      _render();
    }
  }

  function _handleFocusBurn() {
    if (!_isAdvancementPhase()) return;
    var dt = _advancement.disciplineTrack;
    var costPerBox = dt.level;
    var markCost = costPerBox * 2;
    if (!_spendFromTrack('disc', markCost)) return;
    dt.focusBurns = (dt.focusBurns || 0) + 1;
    dt.filled += 2;
    if (dt.filled >= DISC_TRACK_SIZE) {
      dt.eliteTokens = (dt.eliteTokens || 0) + 1;
      dt.level++;
      dt.filled = Math.max(0, dt.filled - DISC_TRACK_SIZE);
    }
    _persist();
    _render();
  }

  function _handleSpendAdvance(trackKey) {
    if (_openSpendPanel === trackKey) {
      _openSpendPanel = null;
    } else {
      _openSpendPanel = trackKey;
    }
    _render();
  }

  function _nextDie(die) {
    var idx = DIE_STEPS.indexOf(die);
    if (idx < 0 || idx >= DIE_STEPS.length - 1) return null;
    return DIE_STEPS[idx + 1];
  }

  function _persistDice(payload, cb) {
    if (!_charId) return;
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/dice', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('dice save failed: ' + res.status);
      if (cb) cb();
    }).catch(function (err) {
      console.error('[AdvancementPanel] dice save error', err);
    });
  }

  function _applyDisciplineUpgrade(arenaIdx, discIdx) {
    var arena = _char.arenas[arenaIdx];
    if (!arena || !arena.disciplines) return;
    var disc = arena.disciplines[discIdx];
    if (!disc) return;
    var dt = _advancement.disciplineTrack;
    var curDie = disc.die || 'D6';
    var cost = DISC_UPGRADE_COST[curDie];
    if (!cost) return;
    if ((dt.unspentAdvances || 0) < cost.adv) return;
    if (cost.elite > 0 && (dt.eliteTokens || 0) < cost.elite) return;
    var newDie = _nextDie(curDie);
    if (!newDie) return;

    dt.unspentAdvances -= cost.adv;
    if (cost.elite > 0) dt.eliteTokens -= cost.elite;
    disc.die = newDie;
    _persist();
    _persistDice({ type: 'discipline', id: disc.id, newDie: newDie });
    document.dispatchEvent(new CustomEvent('character:stateChanged'));
    if (window.CharacterPanel && window.CharacterPanel.refreshFront) window.CharacterPanel.refreshFront();
    _render();
  }

  function _applyArenaUpgrade(arenaIdx) {
    var arena = _char.arenas[arenaIdx];
    if (!arena) return;
    var at = _advancement.arenaTrack;
    var curDie = arena.die || 'D6';
    var cost = ARENA_UPGRADE_COST[curDie];
    if (!cost) return;
    if ((at.unspentAdvances || 0) < cost.adv) return;
    var newDie = _nextDie(curDie);
    if (!newDie) return;

    function _finishArenaUpgrade() {
      at.unspentAdvances -= cost.adv;
      arena.die = newDie;
      _persist();
      _persistDice({ type: 'arena', id: arena.id, newDie: newDie });
      document.dispatchEvent(new CustomEvent('character:stateChanged'));
      if (window.CharacterPanel && window.CharacterPanel.refreshFront) window.CharacterPanel.refreshFront();
      _render();
    }

    if (newDie === 'D12') {
      var existing = _countD12Arenas();
      if (existing >= 1) {
        var otherArena = null;
        _char.arenas.forEach(function (a) {
          if (a.die === 'D12' && a.id !== arena.id) otherArena = a;
        });
        if (otherArena) {
          _showModal({
            type: 'confirm',
            message: 'Apex Rule: ' + otherArena.label + ' is currently D12 and will be degraded to D10. Continue?',
            confirmLabel: 'Continue',
            onConfirm: function () {
              otherArena.die = 'D10';
              _persistDice({ type: 'arena', id: otherArena.id, newDie: 'D10' });
              _finishArenaUpgrade();
            }
          });
          return;
        }
      }
    }

    _finishArenaUpgrade();
  }

  function _applyVocationUpgrade(kitIdx) {
    var kits = (_char && _char.kits) ? _char.kits : [];
    var kit = kits[kitIdx];
    if (!kit) return;
    var vt = _advancement.vocationTrack;
    if ((vt.unspentAdvances || 0) < 1) return;

    var kitId = kit.id || kit.kitId || '';
    var currentTier = kit.tier || kit.currentTier || 1;
    var favDisc = kit.favoredDiscipline || '';
    var favDie = _getFavoredDie(favDisc);
    var maxTier = DISC_GATE[favDie] || 1;

    if (currentTier >= 5 || currentTier >= maxTier) return;

    vt.unspentAdvances--;
    if (!_advancement.vocationUnlocks) _advancement.vocationUnlocks = {};
    _advancement.vocationUnlocks[kitId] = (_advancement.vocationUnlocks[kitId] || 0) + 1;
    kit.tier = currentTier + 1;
    _persist();
    document.dispatchEvent(new CustomEvent('character:stateChanged'));
    if (window.CharacterPanel && window.CharacterPanel.refreshFront) window.CharacterPanel.refreshFront();
    _render();
  }

  function _learnNewVocation(kitId) {
    if (!_charId || !kitId) return;
    var vt = _advancement.vocationTrack;
    if ((vt.unspentAdvances || 0) < 1) return;

    vt.unspentAdvances--;
    _persist();

    fetch('/api/characters/' + encodeURIComponent(_charId) + '/kits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitId: kitId })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok && data.kits) {
          _char.kits = data.kits;
        }
        document.dispatchEvent(new CustomEvent('character:stateChanged'));
        if (window.CharacterPanel && window.CharacterPanel.refreshFront) window.CharacterPanel.refreshFront();
        _render();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] Failed to learn vocation:', err);
        vt.unspentAdvances++;
        _persist();
        _render();
      });
  }

  function _buildDisciplineSpendPanel() {
    var dt = _advancement.disciplineTrack;
    var unspent = dt.unspentAdvances || 0;
    var tokens = dt.eliteTokens || 0;
    var html = '<div class="adv-spend-panel">';
    html += '<div class="adv-spend-panel-title"><span>Upgrade a Discipline</span><button class="adv-spend-close" data-close-spend="disc">\u2715</button></div>';
    html += '<div class="adv-spend-note">Available: ' + unspent + ' Advance(s), ' + tokens + ' Elite Token(s)</div>';

    if (!_char || !_char.arenas) { html += '</div>'; return html; }

    _char.arenas.forEach(function (arena, ai) {
      html += '<div class="adv-spend-arena-group">';
      html += '<div class="adv-spend-arena-label">' + _esc(arena.label) + '<span class="adv-spend-arena-die">' + _esc(arena.die) + '</span></div>';
      arena.disciplines.forEach(function (disc, di) {
        var curDie = disc.die || 'D6';
        var next = _nextDie(curDie);
        var cost = DISC_UPGRADE_COST[curDie] || null;
        var maxed = !next || !cost;
        var canAfford = !maxed && unspent >= cost.adv && tokens >= (cost.elite || 0);
        var locked = maxed || !canAfford;
        var cls = 'adv-spend-row';
        if (locked) cls += ' adv-spend-row--locked';
        if (maxed) cls += ' adv-spend-row--maxed';
        if (!locked) cls += ' adv-spend-row--can-afford';

        html += '<div class="' + cls + '" data-upgrade-disc="' + ai + ',' + di + '">';
        html += '<div class="adv-spend-row-left">';
        html += '<span class="adv-spend-row-name">' + _esc(disc.label || disc.id) + '</span>';
        html += '</div>';
        html += '<span class="adv-spend-row-die">' + _esc(curDie) + '</span>';
        if (!maxed) {
          html += '<span class="adv-spend-row-arrow">\u2192</span>';
          html += '<span class="adv-spend-row-die">' + next + '</span>';
          var costStr = '<b>' + cost.adv + ' Adv</b>';
          if (cost.elite > 0) costStr += ' + <b>' + cost.elite + ' ET</b>';
          html += '<span class="adv-spend-row-cost">' + costStr + '</span>';
        } else {
          html += '<span class="adv-spend-row-cost">MAX</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _buildArenaSpendPanel() {
    var at = _advancement.arenaTrack;
    var unspent = at.unspentAdvances || 0;
    var html = '<div class="adv-spend-panel">';
    html += '<div class="adv-spend-panel-title"><span>Upgrade an Arena</span><button class="adv-spend-close" data-close-spend="arena">\u2715</button></div>';
    html += '<div class="adv-spend-note">Available: ' + unspent + ' Advance(s)</div>';

    if (!_char || !_char.arenas) { html += '</div>'; return html; }

    _char.arenas.forEach(function (arena, ai) {
      var curDie = arena.die || 'D6';
      var next = _nextDie(curDie);
      var cost = ARENA_UPGRADE_COST[curDie] || null;
      var maxed = !next || !cost;
      var canAfford = !maxed && unspent >= cost.adv;
      var locked = maxed || !canAfford;
      var cls = 'adv-spend-row';
      if (locked) cls += ' adv-spend-row--locked';
      if (maxed) cls += ' adv-spend-row--maxed';
      if (!locked) cls += ' adv-spend-row--can-afford';

      html += '<div class="' + cls + '" data-upgrade-arena="' + ai + '">';
      html += '<div class="adv-spend-row-left">';
      html += '<span class="adv-spend-row-name">' + _esc(arena.label) + '</span>';
      html += '</div>';
      html += '<span class="adv-spend-row-die">' + _esc(curDie) + '</span>';
      if (!maxed) {
        html += '<span class="adv-spend-row-arrow">\u2192</span>';
        html += '<span class="adv-spend-row-die">' + next + '</span>';
        html += '<span class="adv-spend-row-cost"><b>' + cost.adv + ' Adv</b></span>';
      } else {
        html += '<span class="adv-spend-row-cost">MAX</span>';
      }
      html += '</div>';
    });

    if (_countD12Arenas() >= 1) {
      html += '<div class="adv-apex-warning">\u26A0 Apex Rule: Only one Arena may sit at D12. Pushing another to D12 will degrade the current one to D10.</div>';
    }
    html += '</div>';
    return html;
  }

  function _buildVocationSpendPanel() {
    var vt = _advancement.vocationTrack;
    var unspent = vt.unspentAdvances || 0;
    var kits = (_char && _char.kits) ? _char.kits : [];
    var html = '<div class="adv-spend-panel">';
    html += '<div class="adv-spend-panel-title"><span>Upgrade a Vocation</span><button class="adv-spend-close" data-close-spend="voc">\u2715</button></div>';
    html += '<div class="adv-spend-note">Available: ' + unspent + ' Advance(s). Cost: 1 Advance per tier bump.</div>';

    if (kits.length === 0) {
      html += '<div class="adv-voc-empty">No vocations assigned.</div>';
      html += '</div>';
      return html;
    }

    if (kits.length > 0) {
      html += '<div class="adv-spend-section-label">Upgrade Existing</div>';
      kits.forEach(function (kit, ki) {
        var kitId = kit.id || kit.kitId || '';
        var currentTier = kit.tier || kit.currentTier || 1;
        var kitLabel = kit.name || kit.label || kitId;
        var favDisc = kit.favoredDiscipline || '';
        var favDie = _getFavoredDie(favDisc);
        var maxTier = DISC_GATE[favDie] || 1;
        var atMax = currentTier >= 5 || currentTier >= maxTier;
        var locked = atMax || unspent < 1;
        var cls = 'adv-spend-voc-row';
        if (locked) cls += ' adv-spend-row--locked';

        html += '<div class="' + cls + '" data-upgrade-voc="' + ki + '">';
        html += '<div>';
        html += '<div class="adv-spend-voc-name">' + _esc(kitLabel) + '</div>';
        html += '<div class="adv-spend-voc-info">Gate: ' + _esc(favDisc) + ' (' + _esc(favDie) + ') \u2014 Max Tier ' + maxTier + '</div>';
        html += '</div>';
        if (!atMax) {
          html += '<span class="adv-spend-voc-tier">T' + currentTier + ' \u2192 T' + (currentTier + 1) + '</span>';
        } else {
          html += '<span class="adv-spend-voc-tier" style="opacity:0.4">T' + currentTier + ' (MAX)</span>';
        }
        html += '</div>';
      });
    }

    var availableKits = _getUnlearnedKits(kits);
    if (availableKits.length > 0) {
      html += '<div class="adv-spend-section-label">Learn New Vocation (1 Advance)</div>';
      availableKits.forEach(function (kit) {
        var locked = unspent < 1;
        var cls = 'adv-spend-voc-row adv-spend-voc-row--new';
        if (locked) cls += ' adv-spend-row--locked';
        html += '<div class="' + cls + '" data-learn-voc="' + _esc(kit.id) + '">';
        html += '<div>';
        html += '<div class="adv-spend-voc-name">' + _esc(kit.name) + '</div>';
        html += '<div class="adv-spend-voc-info">' + _esc(kit.governingArena || '') + ' \u2022 ' + _esc(kit.favoredDiscipline || '') + '</div>';
        html += '</div>';
        html += '<span class="adv-spend-voc-tier">New \u2192 T1</span>';
        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  }

  function _getUnlearnedKits(currentKits) {
    if (!_allKitsData) return [];
    var owned = {};
    currentKits.forEach(function (k) { owned[k.id || k.kitId || ''] = true; });
    return _allKitsData.filter(function (k) { return !owned[k.id]; });
  }

  function _updateMarksSummary() {
    var numEl = document.querySelector('.adv-marks-number');
    if (numEl) {
      var earned = _countEarnedMarks();
      var banked = (_advancement && _advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;
      numEl.textContent = earned + banked;
    }
  }

  function _loadDestinyData(cb) {
    fetch('/data/destinies.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _destinyData = data.destinies || [];
        if (cb) cb();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] Failed to load destinies:', err);
        _destinyData = [];
        if (cb) cb();
      });
  }

  function _loadKitsData(cb) {
    fetch('/data/kits.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _allKitsData = Array.isArray(data) ? data : [];
        if (cb) cb();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] Failed to load kits:', err);
        _allKitsData = [];
        if (cb) cb();
      });
  }

  function _loadCampaignProgress(cb) {
    fetch('/api/campaign/progress')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var advId = (data && data.progress && data.progress.adventure_id) || (data && data.adventure_id);
        if (advId) _currentAdventureId = advId;
        if (cb) cb();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] Failed to load campaign progress:', err);
        if (cb) cb();
      });
  }

  function _loadAdventureMarks(cb) {
    if (!_charId) { if (cb) cb(); return; }
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/adventure-marks/' + encodeURIComponent(_currentAdventureId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _advancement.marks.earnedChecks = {};
        if (data.ok && data.marks && data.marks.length > 0) {
          data.marks.forEach(function (m) {
            _advancement.marks.earnedChecks[m.mark_id] = true;
          });
        }
        if (cb) cb();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] Failed to load adventure marks:', err);
        if (cb) cb();
      });
  }

  function init() {
    function tryRender() {
      var char = window.CharacterPanel && window.CharacterPanel.currentChar;
      if (!char) { setTimeout(tryRender, 50); return; }

      _char = char;
      _charId = char.id || null;
      _advancement = char.advancement || {};
      _ensureDefaults();

      var panel5 = document.getElementById('panel-5');
      if (panel5 && panel5.offsetParent !== null) {
        _panelVisible = true;
      }

      var loaded = 0;
      var totalLoads = 4;
      function onLoaded() {
        loaded++;
        if (loaded >= totalLoads) {
          if (_panelVisible) _render();
          _initialized = true;
        }
      }

      _loadDestinyData(onLoaded);
      _loadKitsData(onLoaded);
      _loadCampaignProgress(function () {
        _loadAdventureMarks(onLoaded);
        onLoaded();
      });

      document.addEventListener('character:stateChanged', function () {
        var c = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (c) {
          _char = c;
          _charId = c.id || null;
          _advancement = c.advancement || _advancement;
          _ensureDefaults();
          if (_panelVisible) _render();
        }
      });

      document.addEventListener('panel:shown', function (e) {
        var panelId = e.detail && e.detail.panelId;
        if (panelId === 'panel-5') {
          _panelVisible = true;
          _render();
        } else {
          _panelVisible = false;
        }
      });

      var sock = _getSocket();
      if (sock) {
        sock.on('advancement:sync', function (data) {
          if (data.characterId === _charId && data.advancement) {
            _advancement = data.advancement;
            _ensureDefaults();
            if (_panelVisible) _render();
          }
        });
      }
    }
    tryRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

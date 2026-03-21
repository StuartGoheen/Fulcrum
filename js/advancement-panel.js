(function () {
  'use strict';

  var MARK_TRIGGERS = [
    {
      bucket: 'The Mission',
      subtitle: 'Shared Struggle',
      budget: '4\u20135 Marks',
      icon: '\u2694',
      triggers: [
        { id: 'act_milestone_1', label: 'Act Milestone I',  value: 1, desc: 'Crew completes Act 1 or a major objective.', group: true },
        { id: 'act_milestone_2', label: 'Act Milestone II', value: 1, desc: 'Crew completes Act 2 or a major objective.', group: true },
        { id: 'act_milestone_3', label: 'Act Milestone III',value: 1, desc: 'Crew completes Act 3 or a major objective.', group: true },
        { id: 'crucible',        label: 'The Crucible',     value: 1, desc: 'Crew survives a catastrophic setback, boss encounter, or brutal twist.', group: true },
        { id: 'hard_call',       label: 'The Hard Call',    value: 1, desc: 'Crew makes a definitive, galaxy-altering choice.', group: true }
      ]
    },
    {
      bucket: 'The Past',
      subtitle: 'Phase Trio Triggers',
      budget: '2\u20133 Marks',
      icon: '\u23F3',
      triggers: [
        { id: 'ghost_past',  label: 'Ghost of the Past', value: 1, desc: 'Used a Phase 1/2/3 detail to complicate the current mission.' },
        { id: 'debt_paid',   label: 'The Debt Paid',     value: 1, desc: 'Went out of the way at personal risk to honor a bond or protect a crewmate.' },
        { id: 'old_scars',   label: 'The Old Scars',     value: 1, desc: 'Intentionally failed a social/mental check due to background trauma, phobia, or bias.' }
      ]
    },
    {
      bucket: 'The Future',
      subtitle: 'Destiny Triggers',
      budget: '2\u20133 Marks',
      icon: '\u2605',
      triggers: [
        { id: 'reckless_pursuit',  label: 'The Reckless Pursuit', value: 1, desc: 'Took a dangerous action specifically to inch closer to Destiny.' },
        { id: 'destiny_milestone', label: 'The Destiny Milestone',value: 2, desc: 'Achieved a tangible, permanent step toward ultimate Destiny goal. Rare.' }
      ]
    },
    {
      bucket: 'The Mechanics',
      subtitle: 'Action Triggers',
      budget: '2\u20134 Marks',
      icon: '\u2699',
      triggers: [
        { id: 'd4_burden_1',       label: 'The D4 Burden I',       value: 1, desc: 'Willingly auto-failed a roll tied to D4 Arena, narrating how the flaw ruined the moment.' },
        { id: 'd4_burden_2',       label: 'The D4 Burden II',      value: 1, desc: 'Second auto-fail tied to D4 Arena this adventure. Max 2 per adventure.' },
        { id: 'unleashed_miracle', label: 'The Unleashed Miracle', value: 1, desc: 'Went Unleashed at the most dramatic moment, turning failure into a scene-ending victory. Max 1 per adventure.' },
        { id: 'edge_burn',         label: 'The Edge Burn',         value: 1, desc: 'Burned Edge pool to 0 to fuel a desperate Gambit/Maneuver saving a crewmate.' }
      ]
    }
  ];

  var DISC_TRACK_SIZE = 5;
  var ARENA_TRACK_SIZE = 3;
  var VOC_TRACK_SIZE = 5;
  var DISC_GATE = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };
  var DIE_STEPS = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var DISC_UPGRADE_COST = {
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

  function _countEarnedMarks() {
    if (!_advancement || !_advancement.marks) return 0;
    var checks = _advancement.marks.earnedChecks || {};
    var total = 0;
    MARK_TRIGGERS.forEach(function (bucket) {
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
      _broadcastAdvancement();
    }, 400);
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
    if (!_advancement.disciplineTrack) _advancement.disciplineTrack = { level: 2, filled: 0, eliteTokens: 0, focusBurns: 0, unspentAdvances: 0 };
    if (_advancement.disciplineTrack.unspentAdvances === undefined) _advancement.disciplineTrack.unspentAdvances = 0;
    if (!_advancement.arenaTrack) _advancement.arenaTrack = { level: 2, filled: 0, unspentAdvances: 0 };
    if (_advancement.arenaTrack.unspentAdvances === undefined) _advancement.arenaTrack.unspentAdvances = 0;
    if (!_advancement.vocationTrack) _advancement.vocationTrack = { level: 2, filled: 0, unspentAdvances: 0 };
    if (_advancement.vocationTrack.unspentAdvances === undefined) _advancement.vocationTrack.unspentAdvances = 0;
    if (!_advancement.vocationUnlocks) _advancement.vocationUnlocks = {};
  }

  function _buildMarkChecklist() {
    var checks = (_advancement && _advancement.marks) ? (_advancement.marks.earnedChecks || {}) : {};
    var html = '';

    MARK_TRIGGERS.forEach(function (bucket, bIdx) {
      var collapsed = _collapsedBuckets[bIdx];
      var chevron = collapsed ? '\u25B6' : '\u25BC';
      var bucketEarned = 0;
      bucket.triggers.forEach(function (t) { if (checks[t.id]) bucketEarned += t.value; });
      var countBadge = bucketEarned > 0 ? ' <span class="adv-bucket-earned">' + bucketEarned + '</span>' : '';
      html += '<div class="adv-bucket">';
      html += '<div class="adv-bucket-header" data-bucket-idx="' + bIdx + '">';
      html += '<span class="adv-bucket-chevron">' + chevron + '</span>';
      html += '<span class="adv-bucket-icon">' + bucket.icon + '</span>';
      html += '<span class="adv-bucket-title">' + _esc(bucket.bucket) + countBadge + '</span>';
      html += '<span class="adv-bucket-subtitle">' + _esc(bucket.subtitle) + '</span>';
      html += '<span class="adv-bucket-budget">' + _esc(bucket.budget) + '</span>';
      html += '</div>';
      if (!collapsed) {
        html += '<div class="adv-bucket-triggers">';
        bucket.triggers.forEach(function (t) {
          var checked = checks[t.id] ? ' checked' : '';
          var groupTag = t.group ? '<span class="adv-tag adv-tag--group">GROUP</span>' : '';
          var valueBadge = t.value > 1 ? '<span class="adv-mark-value">' + t.value + '</span>' : '';
          html += '<label class="adv-trigger-row">';
          html += '<input type="checkbox" class="adv-trigger-check" data-trigger-id="' + _esc(t.id) + '"' + checked + ' />';
          html += '<div class="adv-trigger-info">';
          html += '<span class="adv-trigger-label">' + _esc(t.label) + groupTag + valueBadge + '</span>';
          html += '<span class="adv-trigger-desc">' + _esc(t.desc) + '</span>';
          html += '</div>';
          html += '</label>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    return html;
  }

  function _buildPipTrack(trackKey, trackObj, trackSize, costMult, label, extraAfterPips) {
    var costPerBox = trackObj.level * costMult;
    var totalTrackCost = costPerBox * trackSize;
    var unspent = trackObj.unspentAdvances || 0;
    var pipShape = trackKey === 'disc' ? ' adv-pip--disc' : ' adv-pip--square';
    var html = '';
    html += '<div class="adv-track-section">';
    html += '<div class="adv-track-header">';
    html += '<span class="adv-track-title">' + _esc(label) + '</span>';
    html += '<span class="adv-track-meta">Track ' + trackObj.level + ' \u2022 ' + costPerBox + ' Mark' + (costPerBox > 1 ? 's' : '') + '/box \u2022 ' + totalTrackCost + ' to clear</span>';
    html += '</div>';

    html += '<div class="adv-track-pips">';
    for (var i = 0; i < trackSize; i++) {
      var filled = i < trackObj.filled ? ' adv-pip--filled' : '';
      html += '<span class="adv-pip' + pipShape + filled + '" data-track="' + trackKey + '" data-index="' + i + '"></span>';
    }
    html += '</div>';

    html += '<div class="adv-track-stats">';
    html += '<span class="adv-stat"><b>Progress:</b> ' + trackObj.filled + '/' + trackSize + '</span>';
    html += '<span class="adv-stat adv-stat--advances"><b>Unspent Advances:</b> ' + unspent + '</span>';
    html += '</div>';

    html += '<div class="adv-track-actions">';
    html += '<button class="adv-btn adv-btn--spend' + (unspent < 1 ? ' adv-btn--disabled' : '') + '" data-spend-track="' + trackKey + '"' + (unspent < 1 ? ' disabled' : '') + '>Spend Advance</button>';
    html += '</div>';

    if (extraAfterPips) html += extraAfterPips;

    html += '</div>';
    return html;
  }

  function _buildDisciplineTrack() {
    var dt = _advancement.disciplineTrack;
    var costPerBox = dt.level;
    var banked = (_advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;
    var canFocusBurn = banked >= costPerBox;

    var extra = '';
    extra += '<div class="adv-track-stats">';
    extra += '<span class="adv-stat adv-stat--elite"><b>Elite Tokens:</b> ' + (dt.eliteTokens || 0) + '</span>';
    extra += '<span class="adv-stat"><b>Focus Burns:</b> ' + (dt.focusBurns || 0) + '</span>';
    extra += '</div>';

    extra += '<div class="adv-track-actions">';
    extra += '<button class="adv-btn adv-btn--focus' + (canFocusBurn ? '' : ' adv-btn--disabled') + '" id="adv-focus-burn-btn" title="Pay ' + costPerBox + ' Mark(s), skip die upgrade, gain progress toward Elite Token"' + (canFocusBurn ? '' : ' disabled') + '>Focus Burn (' + costPerBox + 'M)</button>';
    extra += '</div>';

    if (_openSpendPanel === 'disc') {
      extra += _buildDisciplineSpendPanel();
    } else {
      extra += '<div class="adv-track-ref">';
      extra += '<div class="adv-ref-title">Discipline Die Costs</div>';
      extra += '<div class="adv-ref-row">D6 \u2192 D8: 1 Advance</div>';
      extra += '<div class="adv-ref-row">D8 \u2192 D10: 1 Advance + 1 Elite Token</div>';
      extra += '<div class="adv-ref-row">D10 \u2192 D12: 1 Advance + 2 Elite Tokens</div>';
      extra += '<div class="adv-ref-row adv-ref-note">Focus Burn: Pay Mark cost, skip die upgrade, accelerate toward Elite Token.</div>';
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
    var unlocks = _advancement.vocationUnlocks || {};
    var kits = (_char && _char.kits) ? _char.kits : [];

    var extra = '';

    if (kits.length > 0) {
      extra += '<div class="adv-voc-list">';
      kits.forEach(function (kit) {
        var kitId = kit.id || kit.kitId || '';
        var baseTier = kit.tier || kit.currentTier || 1;
        var advancedTier = unlocks[kitId] || 0;
        var currentTier = baseTier + advancedTier;
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

  function _render() {
    var container = document.getElementById('panel-5');
    if (!container) return;
    _ensureDefaults();

    var total = _totalMarks();
    var earned = _countEarnedMarks();
    var banked = (_advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;

    var html = '<div class="adv-panel">';

    html += '<div class="adv-header">';
    html += '<div class="adv-header-title">ADVANCEMENT ENGINE</div>';
    html += '<div class="adv-header-subtitle">Track marks earned. Spend advances. Forge your legend.</div>';
    html += '</div>';

    html += '<div class="adv-marks-summary">';
    html += '<div class="adv-marks-total">';
    html += '<span class="adv-marks-number">' + total + '</span>';
    html += '<span class="adv-marks-label">MARKS</span>';
    html += '</div>';
    html += '<div class="adv-marks-breakdown">';
    html += '<span class="adv-marks-detail">Earned this adventure: ' + earned + '</span>';
    html += '<span class="adv-marks-detail">Banked from previous: ' + banked + '</span>';
    html += '</div>';
    html += '<div class="adv-marks-actions">';
    html += '<button class="adv-btn adv-btn--bank" id="adv-bank-btn" title="Bank earned marks and reset checklist for next adventure">Bank &amp; Reset</button>';
    html += '<button class="adv-btn adv-btn--newadv" id="adv-new-adventure-btn" title="Start new adventure: reset checklist (requires banked marks spent to 0)">New Adventure</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="adv-checklist-wrap">';
    html += _buildMarkChecklist();
    html += '</div>';

    html += '<div class="adv-tracks-wrap">';
    html += '<div class="adv-section-divider">ADVANCEMENT TRACKS</div>';
    html += _buildDisciplineTrack();
    html += _buildArenaTrack();
    html += _buildVocationTrack();
    html += '<div class="adv-4th-placeholder"><span class="adv-4th-placeholder-text">Additional track slot reserved</span></div>';
    html += '</div>';

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
      pip.addEventListener('click', function () {
        var track = pip.getAttribute('data-track');
        var index = parseInt(pip.getAttribute('data-index'), 10);
        _handlePipClick(track, index);
      });
    });

    var bankBtn = container.querySelector('#adv-bank-btn');
    if (bankBtn) {
      bankBtn.addEventListener('click', function () {
        var earned = _countEarnedMarks();
        _advancement.marks.totalBanked = (_advancement.marks.totalBanked || 0) + earned;
        _advancement.marks.earnedChecks = {};
        _persist();
        _render();
      });
    }

    var newAdvBtn = container.querySelector('#adv-new-adventure-btn');
    if (newAdvBtn) {
      newAdvBtn.addEventListener('click', function () {
        var banked = _advancement.marks.totalBanked || 0;
        if (banked > 0) {
          alert('You must spend all banked Marks before starting a new adventure. Current banked: ' + banked);
          return;
        }
        _advancement.marks.earnedChecks = {};
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
  }

  function _spendMarks(cost) {
    var banked = _advancement.marks.totalBanked || 0;
    if (banked >= cost) {
      _advancement.marks.totalBanked = banked - cost;
      return true;
    }
    return false;
  }

  function _refundMarks(cost) {
    _advancement.marks.totalBanked = (_advancement.marks.totalBanked || 0) + cost;
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
    var t = _getTrackObj(trackKey);
    if (!t) return;
    var costPerBox = t.level * _getCostMult(trackKey);
    var trackSize = _getTrackSize(trackKey);

    if (index === t.filled) {
      if (!_spendMarks(costPerBox)) return;
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
      _refundMarks(costPerBox);
      t.filled--;
      t.unspentAdvances = Math.max(0, (t.unspentAdvances || 0) - 1);
      _persist();
      _render();
    }
  }

  function _handleFocusBurn() {
    var dt = _advancement.disciplineTrack;
    var costPerBox = dt.level;
    if (!_spendMarks(costPerBox)) return;
    dt.focusBurns = (dt.focusBurns || 0) + 1;
    dt.filled++;
    dt.unspentAdvances = (dt.unspentAdvances || 0) + 1;
    if (dt.filled >= DISC_TRACK_SIZE) {
      dt.eliteTokens = (dt.eliteTokens || 0) + 1;
      dt.level++;
      dt.filled = 0;
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

    if (newDie === 'D12') {
      var existing = _countD12Arenas();
      if (existing >= 1) {
        var otherArena = null;
        _char.arenas.forEach(function (a) {
          if (a.die === 'D12' && a.id !== arena.id) otherArena = a;
        });
        if (otherArena) {
          if (!confirm('Apex Rule: ' + otherArena.label + ' is currently D12 and will be degraded to D10. Continue?')) return;
          otherArena.die = 'D10';
          _persistDice({ type: 'arena', id: otherArena.id, newDie: 'D10' });
        }
      }
    }

    at.unspentAdvances -= cost.adv;
    arena.die = newDie;
    _persist();
    _persistDice({ type: 'arena', id: arena.id, newDie: newDie });
    document.dispatchEvent(new CustomEvent('character:stateChanged'));
    _render();
  }

  function _applyVocationUpgrade(kitIdx) {
    var kits = (_char && _char.kits) ? _char.kits : [];
    var kit = kits[kitIdx];
    if (!kit) return;
    var vt = _advancement.vocationTrack;
    if ((vt.unspentAdvances || 0) < 1) return;

    var kitId = kit.id || kit.kitId || '';
    var unlocks = _advancement.vocationUnlocks || {};
    var baseTier = kit.tier || kit.currentTier || 1;
    var advancedTier = unlocks[kitId] || 0;
    var currentTier = baseTier + advancedTier;
    var favDisc = kit.favoredDiscipline || '';
    var favDie = _getFavoredDie(favDisc);
    var maxTier = DISC_GATE[favDie] || 1;

    if (currentTier >= 5 || currentTier >= maxTier) return;

    vt.unspentAdvances--;
    if (!_advancement.vocationUnlocks) _advancement.vocationUnlocks = {};
    _advancement.vocationUnlocks[kitId] = (unlocks[kitId] || 0) + 1;
    _persist();
    document.dispatchEvent(new CustomEvent('character:stateChanged'));
    _render();
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
    var unlocks = _advancement.vocationUnlocks || {};
    var kits = (_char && _char.kits) ? _char.kits : [];
    var html = '<div class="adv-spend-panel">';
    html += '<div class="adv-spend-panel-title"><span>Upgrade a Vocation</span><button class="adv-spend-close" data-close-spend="voc">\u2715</button></div>';
    html += '<div class="adv-spend-note">Available: ' + unspent + ' Advance(s). Cost: 1 Advance per tier bump.</div>';

    if (kits.length === 0) {
      html += '<div class="adv-voc-empty">No vocations assigned.</div>';
      html += '</div>';
      return html;
    }

    kits.forEach(function (kit, ki) {
      var kitId = kit.id || kit.kitId || '';
      var baseTier = kit.tier || kit.currentTier || 1;
      var advancedTier = unlocks[kitId] || 0;
      var currentTier = baseTier + advancedTier;
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

    html += '</div>';
    return html;
  }

  function _updateMarksSummary() {
    var numEl = document.querySelector('.adv-marks-number');
    var earnedEl = document.querySelectorAll('.adv-marks-detail');
    if (numEl) numEl.textContent = _totalMarks();
    if (earnedEl.length > 0) earnedEl[0].textContent = 'Earned this adventure: ' + _countEarnedMarks();
  }

  function init() {
    function tryRender() {
      var char = window.CharacterPanel && window.CharacterPanel.currentChar;
      if (!char) { setTimeout(tryRender, 50); return; }

      _char = char;
      _charId = char.id || null;
      _advancement = char.advancement || {};
      _ensureDefaults();

      if (_panelVisible) _render();
      _initialized = true;

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

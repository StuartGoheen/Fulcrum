(function () {
  'use strict';

  var MARK_TRIGGERS = [
    {
      bucket: 'The Mission',
      subtitle: 'Shared Struggle',
      budget: '4–5 Marks',
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
      budget: '2–3 Marks',
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
      budget: '2–3 Marks',
      icon: '\u2605',
      triggers: [
        { id: 'reckless_pursuit',  label: 'The Reckless Pursuit', value: 1, desc: 'Took a dangerous action specifically to inch closer to Destiny.' },
        { id: 'destiny_milestone', label: 'The Destiny Milestone',value: 2, desc: 'Achieved a tangible, permanent step toward ultimate Destiny goal. Rare.' }
      ]
    },
    {
      bucket: 'The Mechanics',
      subtitle: 'Action Triggers',
      budget: '2–4 Marks',
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
  var VOCATION_TIER_COSTS = [0, 0, 6, 9, 12, 15];
  var DISC_GATE = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };

  var _charId = null;
  var _advancement = null;
  var _char = null;
  var _saveTimeout = null;

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
    }, 400);
  }

  function _buildMarkChecklist() {
    var checks = (_advancement && _advancement.marks) ? (_advancement.marks.earnedChecks || {}) : {};
    var html = '';

    MARK_TRIGGERS.forEach(function (bucket) {
      html += '<div class="adv-bucket">';
      html += '<div class="adv-bucket-header">';
      html += '<span class="adv-bucket-icon">' + bucket.icon + '</span>';
      html += '<span class="adv-bucket-title">' + _esc(bucket.bucket) + '</span>';
      html += '<span class="adv-bucket-subtitle">' + _esc(bucket.subtitle) + '</span>';
      html += '<span class="adv-bucket-budget">' + _esc(bucket.budget) + '</span>';
      html += '</div>';
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
      html += '</div></div>';
    });
    return html;
  }

  function _buildDisciplineTrack() {
    var dt = _advancement ? _advancement.disciplineTrack : { level: 1, filled: 0, eliteTokens: 0, focusBurns: 0 };
    var costPerBox = dt.level;
    var totalTrackCost = costPerBox * DISC_TRACK_SIZE;
    var html = '';
    html += '<div class="adv-track-section">';
    html += '<div class="adv-track-header">';
    html += '<span class="adv-track-title">Discipline Track</span>';
    html += '<span class="adv-track-meta">Track ' + dt.level + ' \u2022 ' + costPerBox + ' Mark' + (costPerBox > 1 ? 's' : '') + '/box \u2022 ' + totalTrackCost + ' to clear</span>';
    html += '</div>';

    html += '<div class="adv-track-pips">';
    for (var i = 0; i < DISC_TRACK_SIZE; i++) {
      var filled = i < dt.filled ? ' adv-pip--filled' : '';
      html += '<span class="adv-pip adv-pip--disc' + filled + '" data-track="disc" data-index="' + i + '"></span>';
    }
    html += '</div>';

    html += '<div class="adv-track-stats">';
    html += '<span class="adv-stat"><b>Advances Earned:</b> ' + dt.filled + '/' + DISC_TRACK_SIZE + '</span>';
    html += '<span class="adv-stat adv-stat--elite"><b>Elite Tokens:</b> ' + (dt.eliteTokens || 0) + '</span>';
    if (dt.focusBurns) html += '<span class="adv-stat"><b>Focus Burns:</b> ' + dt.focusBurns + '</span>';
    html += '</div>';

    html += '<div class="adv-track-ref">';
    html += '<div class="adv-ref-title">Discipline Die Costs</div>';
    html += '<div class="adv-ref-row">D6 \u2192 D8: 1 Advance (soft cap)</div>';
    html += '<div class="adv-ref-row">D8 \u2192 D10: 1 Advance + 1 Elite Token</div>';
    html += '<div class="adv-ref-row">D10 \u2192 D12: 1 Advance + 2 Elite Tokens</div>';
    html += '<div class="adv-ref-row adv-ref-note">Focus Burn: Pay Mark cost, skip die upgrade, accelerate toward Elite Token.</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _buildArenaTrack() {
    var at = _advancement ? _advancement.arenaTrack : { level: 1, filled: 0 };
    var costPerBox = at.level * 3;
    var totalTrackCost = costPerBox * ARENA_TRACK_SIZE;
    var html = '';
    html += '<div class="adv-track-section">';
    html += '<div class="adv-track-header">';
    html += '<span class="adv-track-title">Arena Track</span>';
    html += '<span class="adv-track-meta">Track ' + at.level + ' \u2022 ' + costPerBox + ' Marks/box \u2022 ' + totalTrackCost + ' to clear</span>';
    html += '</div>';

    html += '<div class="adv-track-pips">';
    for (var i = 0; i < ARENA_TRACK_SIZE; i++) {
      var filled = i < at.filled ? ' adv-pip--filled' : '';
      html += '<span class="adv-pip adv-pip--arena' + filled + '" data-track="arena" data-index="' + i + '"></span>';
    }
    html += '</div>';

    html += '<div class="adv-track-stats">';
    html += '<span class="adv-stat"><b>Advances Earned:</b> ' + at.filled + '/' + ARENA_TRACK_SIZE + '</span>';
    html += '</div>';

    html += '<div class="adv-track-ref">';
    html += '<div class="adv-ref-title">Arena Die Costs</div>';
    html += '<div class="adv-ref-row">D4 \u2192 D6 (Fixing a Flaw): 2 Advances</div>';
    html += '<div class="adv-ref-row">D6 \u2192 D8: 1 Advance</div>';
    html += '<div class="adv-ref-row">D8 \u2192 D10: 3 Advances</div>';
    html += '<div class="adv-ref-row">D10 \u2192 D12 (Master): 5 Advances</div>';
    html += '<div class="adv-ref-row adv-ref-note">Apex Rule: Only one Arena may be at D12. Pushing a second degrades the first to D10.</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _buildVocationTrack() {
    var unlocks = (_advancement ? _advancement.vocationUnlocks : {}) || {};
    var kits = (_char && _char.kits) ? _char.kits : [];
    var html = '';
    html += '<div class="adv-track-section">';
    html += '<div class="adv-track-header">';
    html += '<span class="adv-track-title">Vocation Track</span>';
    html += '<span class="adv-track-meta">Tier unlocks gated by Favored Discipline die</span>';
    html += '</div>';

    if (kits.length === 0) {
      html += '<div class="adv-voc-empty">No vocations assigned.</div>';
    } else {
      kits.forEach(function (kit) {
        var currentTier = kit.tier || kit.currentTier || 1;
        var kitId = kit.id || kit.kitId || '';
        var kitLabel = kit.name || kit.label || kitId;
        var favDisc = kit.favoredDiscipline || '—';
        var favDie = _getFavoredDie(favDisc);
        var maxTier = DISC_GATE[favDie] || 1;

        html += '<div class="adv-voc-card">';
        html += '<div class="adv-voc-name">' + _esc(kitLabel) + '</div>';
        html += '<div class="adv-voc-gate">Favored: ' + _esc(favDisc) + ' (' + _esc(favDie) + ') \u2014 Max Tier ' + maxTier + '</div>';
        html += '<div class="adv-voc-tiers">';
        for (var tier = 1; tier <= 5; tier++) {
          var cost = VOCATION_TIER_COSTS[tier];
          var unlocked = tier <= currentTier;
          var gated = tier > maxTier;
          var cls = 'adv-voc-tier';
          if (unlocked) cls += ' adv-voc-tier--unlocked';
          if (gated && !unlocked) cls += ' adv-voc-tier--gated';
          html += '<span class="' + cls + '">';
          html += 'T' + tier;
          if (cost > 0) html += ' <small>(' + cost + 'M)</small>';
          html += '</span>';
        }
        html += '</div></div>';
      });
    }

    html += '<div class="adv-track-ref">';
    html += '<div class="adv-ref-title">Discipline Gate</div>';
    html += '<div class="adv-ref-row">D4: Max Tier 1 \u2022 D6: Max Tier 2 \u2022 D8: Max Tier 3</div>';
    html += '<div class="adv-ref-row">D10: Max Tier 4 \u2022 D12: Max Tier 5</div>';
    html += '</div>';

    html += '</div>';
    return html;
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

    var total = _totalMarks();
    var earned = _countEarnedMarks();
    var banked = (_advancement && _advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;

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
    html += '<button class="adv-btn adv-btn--bank" id="adv-bank-btn" title="Bank earned marks and reset checklist">Bank &amp; Reset</button>';
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
        if (track === 'disc') {
          _handleDiscPipClick(index);
        } else if (track === 'arena') {
          _handleArenaPipClick(index);
        }
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

  function _handleDiscPipClick(index) {
    var dt = _advancement.disciplineTrack;
    var costPerBox = dt.level;
    if (index === dt.filled) {
      if (!_spendMarks(costPerBox)) return;
      dt.filled++;
      if (dt.filled >= DISC_TRACK_SIZE) {
        dt.eliteTokens = (dt.eliteTokens || 0) + 1;
        dt.level++;
        dt.filled = 0;
      }
      _persist();
      _render();
    } else if (index === dt.filled - 1) {
      _refundMarks(costPerBox);
      dt.filled--;
      _persist();
      _render();
    }
  }

  function _handleArenaPipClick(index) {
    var at = _advancement.arenaTrack;
    var costPerBox = at.level * 3;
    if (index === at.filled) {
      if (!_spendMarks(costPerBox)) return;
      at.filled++;
      if (at.filled >= ARENA_TRACK_SIZE) {
        at.level++;
        at.filled = 0;
      }
      _persist();
      _render();
    } else if (index === at.filled - 1) {
      _refundMarks(costPerBox);
      at.filled--;
      _persist();
      _render();
    }
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
      _advancement = char.advancement || {
        marks: { earnedChecks: {}, totalBanked: 0 },
        disciplineTrack: { level: 1, filled: 0, eliteTokens: 0, focusBurns: 0 },
        arenaTrack: { level: 1, filled: 0 },
        vocationUnlocks: {}
      };

      _render();

      document.addEventListener('character:stateChanged', function () {
        var c = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (c) {
          _char = c;
          _charId = c.id || null;
          _advancement = c.advancement || _advancement;
          _render();
        }
      });
    }
    tryRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

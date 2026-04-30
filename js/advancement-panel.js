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
  var _adventureMarksData = null;
  var _currentAdventureId = 'adv1';
  // Act number of the active adventure — populated by the marks endpoint.
  // Drives Linked Destiny share-target lookups for the "Shares to" badge.
  var _currentAdventureAct = null;
  // Lightweight party roster cache (id, name, personalDestiny) used by the
  // "Shares to: <Name>" badge and the GM "Goals to Reveal" cockpit. Loaded
  // once per panel mount and refreshed when the GM toggles a Linked Destiny
  // partner via the floating Destiny Link panel.
  var _partyCache = [];
  // Goals-to-Reveal cockpit collapse state (GM only).
  var _gtrCollapsed = false;
  // Linked Destiny: while a Field Report is awaiting GM approval, we lock the
  // advancement panel and show an overlay. The pending-tier bump is held so the
  // approval handler can pop the Hero Tier celebration after the GM lets the
  // player into the advancement phase.
  var _pendingReviewId = null;
  var _pendingTierBump = null;
  var _rejectionNote = '';
  var _isGmView = window.location.pathname.indexOf('/gm') === 0;

  var DISC_TRACK_SIZE = 5;
  var ARENA_TRACK_SIZE = 3;
  var VOC_TRACK_SIZE = 5;
  var DISC_GATE = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };
  var DIE_STEPS = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var HERO_TIERS = [
    { tier: 0, name: 'Drifter',      threshold: 0,   shortBenefit: 'Baseline — no additional benefits.' },
    { tier: 1, name: 'Survivor',     threshold: 30,  shortBenefit: 'Adaptability: one-time respec — step down an arena, discipline, or vocation to step up a lower one.' },
    { tier: 2, name: 'Veteran',      threshold: 55,  shortBenefit: '+1 Exploit pip (2E per round).' },
    { tier: 3, name: 'Name',         threshold: 80,  shortBenefit: 'Signature Move: define a narrative trigger — once per scene, gain 1 Edge.' },
    { tier: 4, name: 'Heavy Hitter', threshold: 115, shortBenefit: 'Edge Mastery: reroll both Control AND Power on Edge spend. Keep best of each.' },
    { tier: 5, name: 'The Name',     threshold: 150, shortBenefit: '+1 Exploit pip (3E). Choose one Arena — all its disciplines become Favored. Choose your moniker.' }
  ];

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
  var _collapsedSections = {};
  var _panelVisible = false;
  var _initialized = false;
  var _openSpendPanel = null;

  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _getPcDestinyId() {
    if (!_char || !_char.personalDestiny) return null;
    return _char.personalDestiny.id || _char.personalDestiny || null;
  }

  // Returns destiny-match info for a goal trigger:
  //   { hasDestiny, anyMatch, chosenPathId, chosenMatch }
  // anyMatch: true if any path's (or top-level) destiny tags include the PC's destiny.
  // chosenMatch: true if the player has selected a path AND that path matches.
  function _getDestinyInfo(t) {
    var pcDest = _getPcDestinyId();
    var info = { hasDestiny: false, anyMatch: false, chosenPathId: null, chosenMatch: false };
    if (!t) return info;
    var paths = Array.isArray(t.paths) ? t.paths : [];
    var topDestinies = Array.isArray(t.destinies) ? t.destinies : [];
    if (paths.length > 0) {
      paths.forEach(function (p) {
        if (Array.isArray(p.destinies) && p.destinies.length) info.hasDestiny = true;
        if (pcDest && Array.isArray(p.destinies) && p.destinies.indexOf(pcDest) !== -1) info.anyMatch = true;
      });
    } else if (topDestinies.length > 0) {
      info.hasDestiny = true;
      if (pcDest && topDestinies.indexOf(pcDest) !== -1) info.anyMatch = true;
    }
    var pathChoices = (_advancement && _advancement.marks && _advancement.marks.paths) || {};
    var chosenId = pathChoices[t.id] || null;
    if (chosenId && paths.length > 0) {
      info.chosenPathId = chosenId;
      var chosen = paths.find(function (p) { return p.id === chosenId; });
      if (chosen && pcDest && Array.isArray(chosen.destinies) && chosen.destinies.indexOf(pcDest) !== -1) {
        info.chosenMatch = true;
      }
    } else if (paths.length === 0 && topDestinies.length > 0) {
      // No paths at all — destiny is decided by the top-level tag list.
      info.chosenMatch = !!info.anyMatch;
    }
    return info;
  }

  // Footprint payout: 2 if the chosen path (or no-path goal) matches PC destiny, else 1.
  function _getTriggerValue(t) {
    if (!t) return 1;
    var info = _getDestinyInfo(t);
    return info.chosenMatch ? 2 : 1;
  }

  function _getAdventureTriggers() {
    if (!_adventureMarksData || !_adventureMarksData.length) return [];
    var triggers = [];
    _adventureMarksData.forEach(function (m) {
      if (m.hidden && !_isGmView) return; // hidden goals never render in player UI
      triggers.push({
        id: m.id,
        label: m.label,
        value: 1,
        desc: m.desc,
        group: true,
        hidden: m.hidden,
        noHide: !!m.noHide,
        scene: m.scene || null,
        part: m.part || null,
        destinies: Array.isArray(m.destinies) ? m.destinies.slice() : [],
        paths: Array.isArray(m.paths) ? m.paths.map(function (p) {
          return {
            id: p.id,
            label: p.label,
            desc: p.desc,
            destinies: Array.isArray(p.destinies) ? p.destinies.slice() : []
          };
        }) : []
      });
    });
    return triggers;
  }

  function _getMarkBuckets() {
    var advTriggers = _getAdventureTriggers();
    var visibleCount = advTriggers.filter(function (t) { return !t.hidden; }).length;
    return [
      {
        bucket: 'The Adventure',
        subtitle: 'Footprints on the road',
        budget: visibleCount + ' Goal' + (visibleCount === 1 ? '' : 's') + ' revealed',
        icon: '\u2694',
        key: 'adventure',
        triggers: advTriggers
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
        if (checks[t.id]) {
          total += (bucket.key === 'adventure') ? _getTriggerValue(t) : (t.value || 1);
        }
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
      _saveTimeout = null;
      _flushPersist(false);
    }, 400);
  }

  // Flush the pending save synchronously enough to survive page hide/close.
  // useKeepalive: true → fetch keepalive flag so the request survives unload.
  function _flushPersist(useKeepalive) {
    if (!_charId || !_advancement) return;
    var opts = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_advancement)
    };
    if (useKeepalive) opts.keepalive = true;
    try {
      fetch('/api/characters/' + encodeURIComponent(_charId) + '/advancement', opts)
        .catch(function (err) { console.error('[AdvancementPanel] save error', err); });
    } catch (err) {
      console.error('[AdvancementPanel] save threw', err);
    }
    _persistAdventureMarks(useKeepalive);
    _broadcastAdvancement();
  }

  // Returns a Promise that resolves to `true` when the PUT lands (HTTP 2xx) and
  // `false` on network failure or non-2xx response. Errors are logged but never
  // thrown so existing fire-and-forget callers keep working. The End Mission
  // flow awaits the result and aborts the Field Report POST if persistence
  // failed, ensuring the server's frozen snapshot is never stale (Task #240).
  function _persistAdventureMarks(useKeepalive) {
    if (!_charId || !_advancement || !_advancement.marks) return Promise.resolve(true);
    // Wrap the entire body — including synchronous setup like _getMarkBuckets()
    // and JSON.stringify() — so any throw resolves to `false` instead of
    // escaping the promise contract callers rely on.
    try {
      var checks = _advancement.marks.earnedChecks || {};
      var pathMap = _advancement.marks.paths || {};
      var buckets = _getMarkBuckets();
      var marks = [];
      buckets.forEach(function (bucket) {
        bucket.triggers.forEach(function (t) {
          if (checks[t.id]) {
            marks.push({
              mark_id: t.id,
              bucket: bucket.key,
              path_id: pathMap[t.id] || null
            });
          }
        });
      });
      var opts = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks: marks })
      };
      if (useKeepalive) opts.keepalive = true;
      return fetch('/api/characters/' + encodeURIComponent(_charId) + '/adventure-marks/' + encodeURIComponent(_currentAdventureId), opts)
        .then(function (r) {
          if (!r.ok) {
            console.error('[AdvancementPanel] adventure marks save failed', r.status);
            return false;
          }
          return true;
        })
        .catch(function (err) {
          console.error('[AdvancementPanel] adventure marks save error', err);
          return false;
        });
    } catch (err) {
      console.error('[AdvancementPanel] adventure marks save threw', err);
      return Promise.resolve(false);
    }
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
    if (!_advancement.marks) _advancement.marks = { earnedChecks: {}, totalBanked: 0, paths: {} };
    if (!_advancement.marks.paths) _advancement.marks.paths = {};
    if (!_advancement.disciplineTrack) _advancement.disciplineTrack = { level: 2, filled: 0, eliteTokens: 0, focusBurns: 0, unspentAdvances: 0, invested: 0, lockedInvested: 0 };
    if (_advancement.disciplineTrack.unspentAdvances === undefined) _advancement.disciplineTrack.unspentAdvances = 0;
    if (_advancement.disciplineTrack.invested === undefined) _advancement.disciplineTrack.invested = 0;
    if (_advancement.disciplineTrack.lockedInvested === undefined) _advancement.disciplineTrack.lockedInvested = 0;
    if (!_advancement.arenaTrack) _advancement.arenaTrack = { level: 2, filled: 0, unspentAdvances: 0, invested: 0, lockedInvested: 0 };
    if (_advancement.arenaTrack.unspentAdvances === undefined) _advancement.arenaTrack.unspentAdvances = 0;
    if (_advancement.arenaTrack.invested === undefined) _advancement.arenaTrack.invested = 0;
    if (_advancement.arenaTrack.lockedInvested === undefined) _advancement.arenaTrack.lockedInvested = 0;
    if (!_advancement.vocationTrack) _advancement.vocationTrack = { level: 2, filled: 0, unspentAdvances: 0, invested: 0, lockedInvested: 0 };
    if (_advancement.vocationTrack.unspentAdvances === undefined) _advancement.vocationTrack.unspentAdvances = 0;
    if (_advancement.vocationTrack.invested === undefined) _advancement.vocationTrack.invested = 0;
    if (_advancement.vocationTrack.lockedInvested === undefined) _advancement.vocationTrack.lockedInvested = 0;
    if (!_advancement.vocationUnlocks) _advancement.vocationUnlocks = {};
    if (!_advancement.missionPhase) _advancement.missionPhase = 'mission';
    if (_advancement.careerMarksEarned === undefined) _advancement.careerMarksEarned = 0;
    if (!_advancement.heroTier) _advancement.heroTier = { current: 0, respecUsed: false, signatureMove: '', moniker: '', favoredArena: '' };
    if (_advancement.heroTier.customMoniker && !_advancement.heroTier.moniker) { _advancement.heroTier.moniker = _advancement.heroTier.customMoniker; delete _advancement.heroTier.customMoniker; }
  }

  function _getHeroTier() {
    var marks = _advancement.careerMarksEarned || 0;
    var result = HERO_TIERS[0];
    for (var i = HERO_TIERS.length - 1; i >= 0; i--) {
      if (marks >= HERO_TIERS[i].threshold) {
        result = HERO_TIERS[i];
        break;
      }
    }
    return result;
  }

  function _getNextHeroTier() {
    var current = _getHeroTier();
    if (current.tier >= 5) return null;
    return HERO_TIERS[current.tier + 1];
  }

  function _buildHeroTierCard() {
    var ht = _getHeroTier();
    var next = _getNextHeroTier();
    var marks = _advancement.careerMarksEarned || 0;
    var htData = _advancement.heroTier || {};
    var displayName = (ht.tier === 5 && htData.moniker) ? htData.moniker : ht.name;
    var collapsed = _collapsedSections['heroTier'];

    var html = '<div class="adv-hero-tier-card adv-collapsible-section' + (collapsed ? '' : ' open') + '">';
    html += '<div class="adv-hero-tier-header adv-collapsible-toggle" data-collapse-key="heroTier">';
    html += '<span class="adv-hero-tier-badge">' + _esc(ht.name) + '</span>';
    html += '<span class="adv-hero-tier-name">Hero Tier</span>';
    html += '<span class="adv-hero-tier-marks">' + marks + ' Career Marks</span>';
    html += '<span class="adv-collapse-chevron">' + (collapsed ? '\u25B8' : '\u25BE') + '</span>';
    html += '</div>';

    if (!collapsed) {
      html += '<div class="adv-hero-tier-body">';
      html += '<div class="adv-hero-tier-benefit">' + _esc(ht.shortBenefit) + '</div>';

      if (ht.tier >= 1 && !htData.respecUsed) {
        html += '<button class="adv-btn adv-btn--respec" id="adv-ht-respec-btn">Use Respec (one-time)</button>';
      } else if (htData.respecUsed) {
        html += '<div class="adv-hero-tier-display" style="opacity:0.5;font-size:0.72rem;">Respec used.</div>';
      }

      if (next) {
        var progress = marks - ht.threshold;
        var needed = next.threshold - ht.threshold;
        var pct = Math.min(100, Math.round((progress / needed) * 100));
        html += '<div class="adv-hero-tier-next">';
        html += '<div class="adv-hero-tier-next-label">Next: <b>' + _esc(next.name) + '</b> at ' + next.threshold + ' marks (' + (next.threshold - marks) + ' remaining)</div>';
        html += '<div class="adv-hero-tier-bar"><div class="adv-hero-tier-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '</div>';
      } else {
        html += '<div class="adv-hero-tier-next"><div class="adv-hero-tier-next-label">Campaign capstone reached.</div></div>';
      }

      html += '<div class="adv-hero-tier-all">';
      for (var i = 0; i < HERO_TIERS.length; i++) {
        var t = HERO_TIERS[i];
        var unlocked = marks >= t.threshold;
        var cls = 'adv-hero-tier-row' + (unlocked ? ' adv-hero-tier-row--unlocked' : '') + (t.tier === ht.tier ? ' adv-hero-tier-row--current' : '');
        html += '<div class="' + cls + '">';
        html += '<span class="adv-hero-tier-row-name">' + _esc(t.name) + '</span>';
        html += '<span class="adv-hero-tier-row-threshold">' + t.threshold + '</span>';
        html += '</div>';
      }
      html += '</div>';

      if (ht.tier >= 3) {
        html += '<div class="adv-hero-tier-inputs">';
        html += '<div class="adv-hero-tier-input-group">';
        html += '<label class="adv-hero-tier-input-label">Signature Move Trigger</label>';
        html += '<input type="text" class="adv-hero-tier-input" id="adv-ht-signature" placeholder="When I..." value="' + _esc(htData.signatureMove || '') + '" />';
        html += '</div>';
        if (ht.tier >= 5) {
          if (htData.ht5Finalized) {
            html += '<div class="adv-hero-tier-display"><b>Moniker:</b> ' + _esc(htData.moniker || '—') + '</div>';
            if (htData.favoredArena) {
              var arenaLabel5 = htData.favoredArena;
              if (_char && _char.arenas) {
                var found5 = _char.arenas.find(function (a) { return a.id === htData.favoredArena; });
                if (found5) arenaLabel5 = found5.label;
              }
              html += '<div class="adv-hero-tier-display"><b>Favored Arena:</b> ' + _esc(arenaLabel5) + ' (all disciplines Favored)</div>';
            }
            html += '<div class="adv-hero-tier-display" style="opacity:0.5;font-size:0.68rem;">The Name tier finalized.</div>';
          } else {
            html += '<div class="adv-hero-tier-input-group">';
            html += '<label class="adv-hero-tier-input-label">Personal Moniker</label>';
            html += '<input type="text" class="adv-hero-tier-input" id="adv-ht-moniker" placeholder="What do they call you?" value="' + _esc(htData.moniker || '') + '" />';
            html += '</div>';
            html += '<div class="adv-hero-tier-input-group">';
            html += '<label class="adv-hero-tier-input-label">Favored Arena</label>';
            html += '<select class="adv-hero-tier-input" id="adv-ht-arena">';
            html += '<option value="">— Select —</option>';
            if (_char && _char.arenas) {
              _char.arenas.forEach(function (a) {
                var sel = (htData.favoredArena === a.id) ? ' selected' : '';
                html += '<option value="' + _esc(a.id) + '"' + sel + '>' + _esc(a.label) + ' (' + _esc(a.die) + ')</option>';
              });
            }
            html += '</select>';
            html += '</div>';
            var canFinalize = (htData.moniker || '').trim() && (htData.favoredArena || '').trim();
            html += '<button class="adv-btn adv-btn--spend' + (canFinalize ? '' : ' adv-btn--disabled') + '" id="adv-ht5-finalize"' + (canFinalize ? '' : ' disabled') + '>Finalize The Name</button>';
          }
        }
        html += '</div>';
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function _prevDie(die) {
    var idx = DIE_STEPS.indexOf(die);
    if (idx <= 0) return null;
    return DIE_STEPS[idx - 1];
  }

  function _showRespecModal() {
    var existing = document.getElementById('adv-modal-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'adv-modal-overlay';
    overlay.className = 'adv-modal-overlay';

    var box = document.createElement('div');
    box.className = 'adv-modal-box respec-modal';

    var respecState = {
      activeTab: 'discipline',
      disc: { downTarget: null, upTarget: null, applied: false },
      arena: { downTarget: null, upTarget: null, applied: false },
      vocation: { fromKit: null, toKit: null, amount: 0, applied: false }
    };

    function _discLabel(id) {
      if (!_char || !_char.arenas) return id;
      var lbl = id;
      _char.arenas.forEach(function (a) {
        a.disciplines.forEach(function (d) { if (d.id === id) lbl = d.label || id; });
      });
      return lbl;
    }

    function _arenaLabel(id) {
      if (!_char || !_char.arenas) return id;
      var lbl = id;
      _char.arenas.forEach(function (a) { if (a.id === id) lbl = a.label; });
      return lbl;
    }

    function renderRespecContent() {
      box.innerHTML = '';

      var header = document.createElement('div');
      header.className = 'respec-header';
      header.innerHTML = '<div class="respec-title">Survivor Respec</div>' +
        '<div class="respec-desc">One-time respec. You may make <b>one swap in each category</b>. ' +
        'Step down a die to step up a lower one. Vocation tiers can be reallocated freely between two vocations.</div>';
      box.appendChild(header);

      var summaryItems = [];
      if (respecState.disc.applied) summaryItems.push('Discipline: ' + _discLabel(respecState.disc.downTarget) + ' \u2193 / ' + _discLabel(respecState.disc.upTarget) + ' \u2191');
      if (respecState.arena.applied) summaryItems.push('Arena: ' + _arenaLabel(respecState.arena.downTarget) + ' \u2193 / ' + _arenaLabel(respecState.arena.upTarget) + ' \u2191');
      if (respecState.vocation.applied) {
        var kits = (_char && _char.kits) ? _char.kits : [];
        var fk = kits[respecState.vocation.fromKit];
        var tk = kits[respecState.vocation.toKit];
        summaryItems.push('Vocation: ' + (fk ? fk.name : '?') + ' \u2192 ' + (tk ? tk.name : '?') + ' (' + respecState.vocation.amount + ' tiers)');
      }
      if (summaryItems.length > 0) {
        var summary = document.createElement('div');
        summary.className = 'respec-summary';
        summary.innerHTML = '<b>Queued changes:</b> ' + summaryItems.join(' \u2022 ');
        box.appendChild(summary);
      }

      var tabs = document.createElement('div');
      tabs.className = 'respec-tabs';
      var tabDefs = [
        { key: 'discipline', label: 'Disciplines', done: respecState.disc.applied },
        { key: 'arena', label: 'Arenas', done: respecState.arena.applied },
        { key: 'vocation', label: 'Vocations', done: respecState.vocation.applied }
      ];
      tabDefs.forEach(function (t) {
        var btn = document.createElement('button');
        btn.className = 'respec-tab' + (respecState.activeTab === t.key ? ' respec-tab--active' : '') + (t.done ? ' respec-tab--done' : '');
        btn.innerHTML = t.label + (t.done ? ' &#10003;' : '');
        btn.addEventListener('click', function () {
          respecState.activeTab = t.key;
          renderRespecContent();
        });
        tabs.appendChild(btn);
      });
      box.appendChild(tabs);

      var body = document.createElement('div');
      body.className = 'respec-body';

      if (respecState.activeTab === 'discipline') {
        renderDisciplineRespec(body);
      } else if (respecState.activeTab === 'arena') {
        renderArenaRespec(body);
      } else if (respecState.activeTab === 'vocation') {
        renderVocationRespec(body);
      }
      box.appendChild(body);

      var actions = document.createElement('div');
      actions.className = 'respec-actions';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'adv-modal-btn adv-modal-btn--cancel';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function () { overlay.remove(); });
      actions.appendChild(cancelBtn);

      var anyApplied = respecState.disc.applied || respecState.arena.applied || respecState.vocation.applied;
      if (anyApplied) {
        var confirmBtn = document.createElement('button');
        confirmBtn.className = 'adv-modal-btn adv-modal-btn--primary';
        confirmBtn.textContent = 'Confirm All Changes';
        confirmBtn.addEventListener('click', function () {
          _executeRespec(respecState);
          overlay.remove();
        });
        actions.appendChild(confirmBtn);
      }

      box.appendChild(actions);
    }

    function makeRow(container, label, dieOrTier, isDown, targetKey, isSelected, isDisabled, stateObj) {
      var row = document.createElement('div');
      row.className = 'respec-row' + (isSelected ? ' respec-row--selected' : '') + (isDisabled ? ' respec-row--disabled' : '');
      var nameEl = document.createElement('span');
      nameEl.className = 'respec-row-name';
      nameEl.textContent = label;
      row.appendChild(nameEl);
      var dieEl = document.createElement('span');
      dieEl.className = 'respec-row-die';
      dieEl.textContent = dieOrTier;
      row.appendChild(dieEl);
      if (!isDisabled) {
        row.addEventListener('click', function () {
          if (isDown) {
            stateObj.downTarget = (stateObj.downTarget === targetKey) ? null : targetKey;
            if (stateObj.downTarget === stateObj.upTarget) stateObj.upTarget = null;
          } else {
            stateObj.upTarget = (stateObj.upTarget === targetKey) ? null : targetKey;
          }
          stateObj.applied = !!(stateObj.downTarget && stateObj.upTarget);
          renderRespecContent();
        });
      }
      container.appendChild(row);
    }

    function renderDisciplineRespec(container) {
      if (!_char || !_char.arenas) return;
      if (respecState.disc.applied) {
        var note = document.createElement('div');
        note.className = 'respec-applied-note';
        note.innerHTML = 'Discipline swap queued: <b>' + _discLabel(respecState.disc.downTarget) + '</b> \u2193 and <b>' + _discLabel(respecState.disc.upTarget) + '</b> \u2191.';
        var editBtn = document.createElement('button');
        editBtn.className = 'adv-btn';
        editBtn.style.cssText = 'margin-left:8px;font-size:0.7rem;padding:3px 8px;';
        editBtn.textContent = 'Change';
        editBtn.addEventListener('click', function () {
          respecState.disc.applied = false;
          respecState.disc.downTarget = null;
          respecState.disc.upTarget = null;
          renderRespecContent();
        });
        note.appendChild(editBtn);
        container.appendChild(note);
        return;
      }

      var grid = document.createElement('div');
      grid.className = 'respec-disc-grid';

      var downCol = document.createElement('div');
      downCol.className = 'respec-col';
      var downLabel = document.createElement('div');
      downLabel.className = 'respec-col-label respec-col-label--down';
      downLabel.textContent = 'Step Down (D8+)';
      downCol.appendChild(downLabel);

      var upCol = document.createElement('div');
      upCol.className = 'respec-col';
      var upLabel = document.createElement('div');
      upLabel.className = 'respec-col-label respec-col-label--up';
      upLabel.textContent = 'Step Up (must be lower)';
      upCol.appendChild(upLabel);

      var downDie = null;
      if (respecState.disc.downTarget) {
        _char.arenas.forEach(function (arena) {
          arena.disciplines.forEach(function (disc) {
            if (disc.id === respecState.disc.downTarget) downDie = disc.die || 'D6';
          });
        });
      }

      _char.arenas.forEach(function (arena) {
        var arenaHeader1 = document.createElement('div');
        arenaHeader1.className = 'respec-arena-header';
        arenaHeader1.textContent = arena.label + ' (' + arena.die + ')';
        downCol.appendChild(arenaHeader1);

        var arenaHeader2 = document.createElement('div');
        arenaHeader2.className = 'respec-arena-header';
        arenaHeader2.textContent = arena.label + ' (' + arena.die + ')';
        upCol.appendChild(arenaHeader2);

        arena.disciplines.forEach(function (disc) {
          var die = disc.die || 'D6';
          var key = disc.id;
          var canDown = DIE_STEPS.indexOf(die) >= 2;
          makeRow(downCol, disc.label || disc.id, die, true, key, respecState.disc.downTarget === key, !canDown, respecState.disc);

          if (key === respecState.disc.downTarget) {
            var placeholder = document.createElement('div');
            placeholder.className = 'respec-row respec-row--disabled';
            placeholder.style.opacity = '0.2';
            placeholder.innerHTML = '<span class="respec-row-name">' + _esc(disc.label || disc.id) + '</span><span class="respec-row-die">' + die + '</span>';
            upCol.appendChild(placeholder);
          } else {
            var canUp = downDie && DIE_STEPS.indexOf(die) < DIE_STEPS.indexOf(downDie) && DIE_STEPS.indexOf(die) < DIE_STEPS.length - 1;
            makeRow(upCol, disc.label || disc.id, die, false, key, respecState.disc.upTarget === key, !canUp, respecState.disc);
          }
        });
      });

      grid.appendChild(downCol);
      grid.appendChild(upCol);
      container.appendChild(grid);
    }

    function renderArenaRespec(container) {
      if (!_char || !_char.arenas) return;
      if (respecState.arena.applied) {
        var note = document.createElement('div');
        note.className = 'respec-applied-note';
        note.innerHTML = 'Arena swap queued: <b>' + _arenaLabel(respecState.arena.downTarget) + '</b> \u2193 and <b>' + _arenaLabel(respecState.arena.upTarget) + '</b> \u2191.';
        var editBtn = document.createElement('button');
        editBtn.className = 'adv-btn';
        editBtn.style.cssText = 'margin-left:8px;font-size:0.7rem;padding:3px 8px;';
        editBtn.textContent = 'Change';
        editBtn.addEventListener('click', function () {
          respecState.arena.applied = false;
          respecState.arena.downTarget = null;
          respecState.arena.upTarget = null;
          renderRespecContent();
        });
        note.appendChild(editBtn);
        container.appendChild(note);
        return;
      }

      var grid = document.createElement('div');
      grid.className = 'respec-disc-grid';

      var downCol = document.createElement('div');
      downCol.className = 'respec-col';
      var downLabel = document.createElement('div');
      downLabel.className = 'respec-col-label respec-col-label--down';
      downLabel.textContent = 'Step Down (D8+)';
      downCol.appendChild(downLabel);

      var upCol = document.createElement('div');
      upCol.className = 'respec-col';
      var upLabel = document.createElement('div');
      upLabel.className = 'respec-col-label respec-col-label--up';
      upLabel.textContent = 'Step Up (must be lower)';
      upCol.appendChild(upLabel);

      var downDie = null;
      if (respecState.arena.downTarget) {
        _char.arenas.forEach(function (arena) {
          if (arena.id === respecState.arena.downTarget) downDie = arena.die || 'D6';
        });
      }

      _char.arenas.forEach(function (arena) {
        var die = arena.die || 'D6';
        var key = arena.id;
        var canDown = DIE_STEPS.indexOf(die) >= 2;
        makeRow(downCol, arena.label, die, true, key, respecState.arena.downTarget === key, !canDown, respecState.arena);

        if (key === respecState.arena.downTarget) {
          var placeholder = document.createElement('div');
          placeholder.className = 'respec-row respec-row--disabled';
          placeholder.style.opacity = '0.2';
          placeholder.innerHTML = '<span class="respec-row-name">' + _esc(arena.label) + '</span><span class="respec-row-die">' + die + '</span>';
          upCol.appendChild(placeholder);
        } else {
          var canUp = downDie && DIE_STEPS.indexOf(die) < DIE_STEPS.indexOf(downDie) && DIE_STEPS.indexOf(die) < DIE_STEPS.length - 1;
          makeRow(upCol, arena.label, die, false, key, respecState.arena.upTarget === key, !canUp, respecState.arena);
        }
      });

      grid.appendChild(downCol);
      grid.appendChild(upCol);
      container.appendChild(grid);
    }

    function renderVocationRespec(container) {
      var kits = (_char && _char.kits) ? _char.kits : [];
      if (kits.length < 2) {
        var note = document.createElement('div');
        note.className = 'respec-applied-note';
        note.textContent = 'Need at least 2 vocations to reallocate tiers.';
        container.appendChild(note);
        return;
      }
      if (respecState.vocation.applied) {
        var fk = kits[respecState.vocation.fromKit];
        var tk = kits[respecState.vocation.toKit];
        var doneNote = document.createElement('div');
        doneNote.className = 'respec-applied-note';
        doneNote.innerHTML = 'Vocation reallocation queued: <b>' + (fk ? fk.name : '?') + '</b> \u2192 <b>' + (tk ? tk.name : '?') + '</b> (' + respecState.vocation.amount + ' tiers).';
        var editBtn = document.createElement('button');
        editBtn.className = 'adv-btn';
        editBtn.style.cssText = 'margin-left:8px;font-size:0.7rem;padding:3px 8px;';
        editBtn.textContent = 'Change';
        editBtn.addEventListener('click', function () {
          respecState.vocation.applied = false;
          respecState.vocation.fromKit = null;
          respecState.vocation.toKit = null;
          respecState.vocation.amount = 0;
          renderRespecContent();
        });
        doneNote.appendChild(editBtn);
        container.appendChild(doneNote);
        return;
      }

      var desc = document.createElement('div');
      desc.className = 'respec-voc-desc';
      desc.textContent = 'Select a source and destination vocation, then choose how many tiers to move. The destination must still qualify (gated by its Favored Discipline die).';
      container.appendChild(desc);

      var grid = document.createElement('div');
      grid.className = 'respec-disc-grid';

      var fromCol = document.createElement('div');
      fromCol.className = 'respec-col';
      var fromLabel = document.createElement('div');
      fromLabel.className = 'respec-col-label respec-col-label--down';
      fromLabel.textContent = 'Take Tiers From';
      fromCol.appendChild(fromLabel);

      var toCol = document.createElement('div');
      toCol.className = 'respec-col';
      var toLabel = document.createElement('div');
      toLabel.className = 'respec-col-label respec-col-label--up';
      toLabel.textContent = 'Give Tiers To';
      toCol.appendChild(toLabel);

      kits.forEach(function (kit, idx) {
        var tier = kit.tier || kit.currentTier || 1;
        var canFrom = tier >= 2;
        var isFromSel = respecState.vocation.fromKit === idx;
        var fromRow = document.createElement('div');
        fromRow.className = 'respec-row' + (isFromSel ? ' respec-row--selected' : '') + (!canFrom ? ' respec-row--disabled' : '');
        fromRow.innerHTML = '<span class="respec-row-name">' + _esc(kit.name || kit.id) + '</span><span class="respec-row-die">T' + tier + '</span>';
        if (canFrom) {
          fromRow.addEventListener('click', function () {
            respecState.vocation.fromKit = isFromSel ? null : idx;
            if (respecState.vocation.fromKit === respecState.vocation.toKit) respecState.vocation.toKit = null;
            respecState.vocation.amount = 0;
            respecState.vocation.applied = false;
            renderRespecContent();
          });
        }
        fromCol.appendChild(fromRow);

        var isToSel = respecState.vocation.toKit === idx;
        var favDisc = kit.favoredDiscipline || '';
        var favDie = _getFavoredDie(favDisc);
        var maxTier = DISC_GATE[favDie] || 1;
        var canTo = respecState.vocation.fromKit !== null && respecState.vocation.fromKit !== idx && tier < maxTier && tier < 5;
        var toRow = document.createElement('div');
        toRow.className = 'respec-row' + (isToSel ? ' respec-row--selected' : '') + (!canTo ? ' respec-row--disabled' : '');
        toRow.innerHTML = '<span class="respec-row-name">' + _esc(kit.name || kit.id) + '</span><span class="respec-row-die">T' + tier + ' <span style="font-size:0.6rem;opacity:0.6;">(max T' + maxTier + ')</span></span>';
        if (canTo) {
          toRow.addEventListener('click', function () {
            respecState.vocation.toKit = isToSel ? null : idx;
            respecState.vocation.amount = 0;
            respecState.vocation.applied = false;
            renderRespecContent();
          });
        }
        toCol.appendChild(toRow);
      });

      grid.appendChild(fromCol);
      grid.appendChild(toCol);
      container.appendChild(grid);

      if (respecState.vocation.fromKit !== null && respecState.vocation.toKit !== null) {
        var fKit = kits[respecState.vocation.fromKit];
        var tKit = kits[respecState.vocation.toKit];
        var fTier = fKit.tier || fKit.currentTier || 1;
        var tTier = tKit.tier || tKit.currentTier || 1;
        var tFavDisc = tKit.favoredDiscipline || '';
        var tFavDie = _getFavoredDie(tFavDisc);
        var tMaxTier = DISC_GATE[tFavDie] || 1;
        var maxTransfer = Math.min(fTier - 1, Math.min(5, tMaxTier) - tTier);
        if (maxTransfer < 1) maxTransfer = 0;

        var amtWrap = document.createElement('div');
        amtWrap.className = 'respec-amount-wrap';
        amtWrap.innerHTML = '<span class="respec-amount-label">Tiers to move from <b>' + _esc(fKit.name) + '</b> (T' + fTier + ') to <b>' + _esc(tKit.name) + '</b> (T' + tTier + ', max T' + tMaxTier + '):</span>';

        var stepper = document.createElement('div');
        stepper.className = 'respec-stepper';
        var minusBtn = document.createElement('button');
        minusBtn.className = 'respec-stepper-btn';
        minusBtn.textContent = '\u2212';
        minusBtn.disabled = respecState.vocation.amount <= 0;
        minusBtn.addEventListener('click', function () {
          if (respecState.vocation.amount > 0) { respecState.vocation.amount--; respecState.vocation.applied = respecState.vocation.amount > 0; renderRespecContent(); }
        });
        var valSpan = document.createElement('span');
        valSpan.className = 'respec-stepper-val';
        valSpan.textContent = respecState.vocation.amount;
        var plusBtn = document.createElement('button');
        plusBtn.className = 'respec-stepper-btn';
        plusBtn.textContent = '+';
        plusBtn.disabled = respecState.vocation.amount >= maxTransfer;
        plusBtn.addEventListener('click', function () {
          if (respecState.vocation.amount < maxTransfer) { respecState.vocation.amount++; respecState.vocation.applied = true; renderRespecContent(); }
        });
        stepper.appendChild(minusBtn);
        stepper.appendChild(valSpan);
        stepper.appendChild(plusBtn);
        amtWrap.appendChild(stepper);

        if (respecState.vocation.amount > 0) {
          var preview = document.createElement('div');
          preview.className = 'respec-preview';
          preview.innerHTML = _esc(fKit.name) + ': T' + fTier + ' \u2192 T' + (fTier - respecState.vocation.amount) + ' &nbsp;\u2022&nbsp; ' + _esc(tKit.name) + ': T' + tTier + ' \u2192 T' + (tTier + respecState.vocation.amount);
          amtWrap.appendChild(preview);
        }

        container.appendChild(amtWrap);
      }
    }

    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    renderRespecContent();
  }

  function _executeRespec(state) {
    if (state.disc.applied && state.disc.downTarget && state.disc.upTarget) {
      var downDisc = null, upDisc = null;
      _char.arenas.forEach(function (arena) {
        arena.disciplines.forEach(function (disc) {
          if (disc.id === state.disc.downTarget) downDisc = disc;
          if (disc.id === state.disc.upTarget) upDisc = disc;
        });
      });
      if (downDisc && upDisc && DIE_STEPS.indexOf(upDisc.die) < DIE_STEPS.indexOf(downDisc.die)) {
        var prevDown = _prevDie(downDisc.die);
        var nextUp = _nextDie(upDisc.die);
        if (prevDown && nextUp) {
          downDisc.die = prevDown;
          upDisc.die = nextUp;
          _persistDice({ type: 'discipline', id: downDisc.id, newDie: prevDown });
          _persistDice({ type: 'discipline', id: upDisc.id, newDie: nextUp });
        }
      }
    }

    if (state.arena.applied && state.arena.downTarget && state.arena.upTarget) {
      var downArena = null, upArena = null;
      _char.arenas.forEach(function (arena) {
        if (arena.id === state.arena.downTarget) downArena = arena;
        if (arena.id === state.arena.upTarget) upArena = arena;
      });
      if (downArena && upArena && DIE_STEPS.indexOf(upArena.die) < DIE_STEPS.indexOf(downArena.die)) {
        var prevDown2 = _prevDie(downArena.die);
        var nextUp2 = _nextDie(upArena.die);
        if (prevDown2 && nextUp2) {
          downArena.die = prevDown2;
          upArena.die = nextUp2;
          _persistDice({ type: 'arena', id: downArena.id, newDie: prevDown2 });
          _persistDice({ type: 'arena', id: upArena.id, newDie: nextUp2 });
        }
      }
    }

    if (state.vocation.applied && state.vocation.fromKit !== null && state.vocation.toKit !== null && state.vocation.amount > 0) {
      var kits = (_char && _char.kits) ? _char.kits : [];
      var downKit = kits[state.vocation.fromKit];
      var upKit = kits[state.vocation.toKit];
      if (downKit && upKit) {
        var dTier = downKit.tier || downKit.currentTier || 1;
        var uTier = upKit.tier || upKit.currentTier || 1;
        var amt = state.vocation.amount;
        var upFavDisc = upKit.favoredDiscipline || '';
        var upFavDie = _getFavoredDie(upFavDisc);
        var upMaxTier = DISC_GATE[upFavDie] || 1;
        var maxSafe = Math.min(dTier - 1, Math.min(5, upMaxTier) - uTier);
        if (maxSafe < 1) maxSafe = 0;
        if (amt > maxSafe) amt = maxSafe;
        if (amt > 0) {
          downKit.tier = dTier - amt;
          upKit.tier = uTier + amt;
          var downKitId = downKit.id || downKit.kitId || '';
          var upKitId = upKit.id || upKit.kitId || '';
          if (!_advancement.vocationUnlocks) _advancement.vocationUnlocks = {};
          _advancement.vocationUnlocks[downKitId] = Math.max(0, (_advancement.vocationUnlocks[downKitId] || 0) - amt);
          _advancement.vocationUnlocks[upKitId] = (_advancement.vocationUnlocks[upKitId] || 0) + amt;
        }
      }
    }

    _advancement.heroTier.respecUsed = true;
    _persist();
    document.dispatchEvent(new CustomEvent('character:stateChanged'));
    if (window.CharacterPanel && window.CharacterPanel.refreshFront) window.CharacterPanel.refreshFront();
    _render();
    _showModal({ type: 'alert', message: 'Respec applied. This was your one-time Survivor respec.' });
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

  // Returns the partner's display name if the current PC has a Linked Destiny
  // partner set for the active Act, else null. Used by the "Shares to" badge
  // on destiny-tagged goal rows in PLAYER view.
  function _getLinkedPartnerName() {
    if (!_advancement || !_currentAdventureAct) return null;
    var lp = _advancement.linkedPartners || {};
    var pid = lp[String(_currentAdventureAct)];
    if (!pid) return null;
    var pidNum = parseInt(pid, 10);
    var match = (_partyCache || []).find(function (c) { return parseInt(c.id, 10) === pidNum; });
    return match ? match.name : null;
  }

  // GM-side resolver: for a given trigger, return the FULL list of party
  // PCs whose personalDestiny matches any of the trigger's destiny tags
  // (or any path destiny tag), each annotated with that PC's per-Act
  // Linked Destiny partner name (or null = unlinked). This is what the
  // Advancement Engine GM badges render — one badge per matching PC, so
  // the GM sees every share consequence at tick-time without having to
  // switch the selected character.
  function _getGmShareTargets(t) {
    if (!_isGmView) return [];
    if (!t || !_partyCache || !_partyCache.length) return [];
    // Collect every destiny id this trigger touches (top-level + path).
    var tagSet = {};
    if (Array.isArray(t.destinies)) t.destinies.forEach(function (d) { if (d) tagSet[d] = true; });
    if (Array.isArray(t.paths)) {
      t.paths.forEach(function (p) {
        if (p && Array.isArray(p.destinies)) p.destinies.forEach(function (d) { if (d) tagSet[d] = true; });
      });
    }
    var tags = Object.keys(tagSet);
    if (!tags.length) return [];
    var actKey = String(_currentAdventureAct || '1');
    var out = [];
    _partyCache.forEach(function (pc) {
      var pcDest = (pc && pc.personalDestiny && (pc.personalDestiny.id || pc.personalDestiny)) || null;
      if (!pcDest || tags.indexOf(pcDest) === -1) return;
      var lp = (pc.linkedPartners && typeof pc.linkedPartners === 'object') ? pc.linkedPartners : {};
      var partnerId = lp[actKey] || null;
      var partnerName = null;
      if (partnerId) {
        var partnerNum = parseInt(partnerId, 10);
        var partner = _partyCache.find(function (c) { return parseInt(c.id, 10) === partnerNum; });
        if (partner) partnerName = partner.name;
      }
      out.push({ pcId: pc.id, pcName: pc.name, partnerName: partnerName });
    });
    return out;
  }

  // GM cockpit shown at the top of the Advancement Engine. Lists every
  // adventure goal that is still hidden, grouped by Part / Scene with a
  // one-click reveal button. Hidden in player view; collapsible in GM view.
  // Empty state is a quiet "all goals revealed" line so the cockpit doesn't
  // take real estate when there's nothing to do.
  function _buildGoalsToRevealCockpit() {
    if (!_isGmView) return '';
    var marks = _adventureMarksData || [];
    var hidden = marks.filter(function (m) { return m.hidden && !m.noHide; });
    var totalGoals = marks.length;
    var revealedCount = totalGoals - hidden.length;
    var chevron = _gtrCollapsed ? '\u25B8' : '\u25BE';
    var html = '<div class="adv-gtr-cockpit" data-gtr-collapsed="' + (_gtrCollapsed ? '1' : '0') + '">';
    html += '<div class="adv-gtr-header" id="adv-gtr-toggle">';
    html += '<span class="adv-gtr-chevron">' + chevron + '</span>';
    html += '<span class="adv-gtr-title">GM Cockpit \u2014 Goals to Reveal</span>';
    html += '<span class="adv-gtr-count">' + revealedCount + '/' + totalGoals + ' revealed</span>';
    html += '</div>';
    if (!_gtrCollapsed) {
      if (!hidden.length) {
        html += '<div class="adv-gtr-empty">All adventure goals are revealed. Reveal new ones from the checklist below as scenes unfold.</div>';
      } else {
        // Group by part_title (fallback to part code), preserving JSON order.
        var groups = [];
        var groupIdx = {};
        hidden.forEach(function (m) {
          var key = m.part || '_';
          if (groupIdx[key] === undefined) {
            groupIdx[key] = groups.length;
            groups.push({
              key: key,
              title: m.part_title || ('Part ' + (m.part || '?')),
              items: []
            });
          }
          groups[groupIdx[key]].items.push(m);
        });
        html += '<div class="adv-gtr-help">Reveal goals as players uncover narrative breaches. Each reveal pushes live to player panels.</div>';
        html += '<div class="adv-gtr-groups">';
        groups.forEach(function (g) {
          html += '<div class="adv-gtr-group">';
          html += '<div class="adv-gtr-group-title">' + _esc(g.title) + '</div>';
          g.items.forEach(function (m) {
            var sceneLine = m.scene_title ? _esc(m.scene_title) : (m.scene ? _esc(m.scene) : '');
            html += '<div class="adv-gtr-row">';
            html += '<div class="adv-gtr-row-info">';
            html += '<span class="adv-gtr-row-label">' + _esc(m.label) + '</span>';
            if (sceneLine) html += '<span class="adv-gtr-row-scene">' + sceneLine + '</span>';
            if (m.desc) html += '<span class="adv-gtr-row-desc">' + _esc(m.desc) + '</span>';
            html += '</div>';
            html += '<button class="adv-btn adv-btn--reveal adv-gtr-row-btn" data-gtr-reveal-mark="' +
              _esc(m.id) + '" data-gtr-reveal-adv="' + _esc(_currentAdventureId) + '">Reveal</button>';
            html += '</div>';
          });
          html += '</div>';
        });
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
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
          var emptyMsg = (bucket.key === 'adventure')
            ? 'No goals revealed yet — they will appear as the GM advances scenes.'
            : 'No triggers available.';
          html += '<div class="adv-bucket-triggers"><div class="adv-trigger-empty">' + _esc(emptyMsg) + '</div></div>';
        } else {
          html += '<div class="adv-bucket-triggers">';
          bucket.triggers.forEach(function (t) {
            var isAdv = (bucket.key === 'adventure');
            var info = isAdv ? _getDestinyInfo(t) : { hasDestiny: false, anyMatch: false, chosenPathId: null, chosenMatch: false };
            var isChecked = !!checks[t.id];
            var checked = isChecked ? ' checked' : '';
            var groupTag = (t.group && !isAdv) ? '<span class="adv-tag adv-tag--group">GROUP</span>' : '';
            var tierTag = t.tier ? '<span class="adv-tag adv-tag--tier">TIER ' + t.tier + '</span>' : '';
            var hiddenClass = t.hidden ? ' adv-trigger-row--hidden' : '';
            var hiddenTag = (t.hidden && _isGmView) ? '<span class="adv-tag adv-tag--hidden">HIDDEN</span>' : '';
            // Destiny preview badge — surface the road match before the player even checks.
            var destinyTag = '';
            if (isAdv && info.anyMatch) {
              destinyTag = '<span class="adv-tag adv-tag--destiny" title="A footprint on your destiny road. If you choose this path it counts as 2 footprints and refills your Edge.">\u2605 ON YOUR ROAD</span>';
            }
            // Shares-to / Unlinked badge(s) — always rendered for destiny-
            // tagged rows so the consequence is visible at tick-time.
            // Clickable: opens the floating Destiny Link panel.
            //
            // PLAYER view: one badge resolved against the SELECTED PC's own
            //              linkedPartners[currentAct].
            // GM view:    one badge per matching PC across the whole party
            //              (any PC whose personalDestiny matches the trigger),
            //              prefixed with the PC's name so the GM can read
            //              "Maya \u2192 Shares to: Tess" / "Tess \u2192 Unlinked"
            //              without switching the active character.
            var sharesTag = '';
            if (isAdv) {
              if (_isGmView) {
                var targets = _getGmShareTargets(t);
                if (targets.length) {
                  targets.forEach(function (tg) {
                    if (tg.partnerName) {
                      sharesTag += '<button type="button" class="adv-tag adv-tag--shares adv-tag--clickable" data-open-destiny-link="1" title="Linked Destiny set for ' + _esc(tg.pcName) + '. Click to change.">' + _esc(tg.pcName) + ' \u2192 Shares to: ' + _esc(tg.partnerName) + '</button>';
                    } else {
                      sharesTag += '<button type="button" class="adv-tag adv-tag--shares adv-tag--unlinked adv-tag--clickable" data-open-destiny-link="1" title="No Linked Destiny partner for ' + _esc(tg.pcName) + ' in this Act. Click to set one.">' + _esc(tg.pcName) + ' \u2192 Unlinked</button>';
                    }
                  });
                }
              } else if (info.anyMatch) {
                var partnerName = _getLinkedPartnerName();
                if (partnerName) {
                  sharesTag = '<button type="button" class="adv-tag adv-tag--shares adv-tag--clickable" data-open-destiny-link="1" title="Linked Destiny is set. Click to change.">Shares to: ' + _esc(partnerName) + '</button>';
                } else {
                  sharesTag = '<button type="button" class="adv-tag adv-tag--shares adv-tag--unlinked adv-tag--clickable" data-open-destiny-link="1" title="No Linked Destiny partner for this Act. Click to set one.">Unlinked</button>';
                }
              }
            }
            // Footprint payout badge — show the actual landed payout when checked.
            var footprintTag = '';
            if (isAdv && isChecked) {
              var val = _getTriggerValue(t);
              var lbl = val === 2 ? '\u272A 2 FOOTPRINTS' : '\u00B7 1 FOOTPRINT';
              var cls = val === 2 ? ' adv-tag--footprint adv-tag--footprint-strong' : ' adv-tag--footprint';
              footprintTag = '<span class="adv-tag' + cls + '">' + lbl + '</span>';
            }
            // Chosen path read-out, when applicable.
            var chosenPathLine = '';
            if (isAdv && isChecked && info.chosenPathId && Array.isArray(t.paths)) {
              var chosen = t.paths.find(function (p) { return p.id === info.chosenPathId; });
              if (chosen) {
                chosenPathLine = '<span class="adv-trigger-path">Path: <b>' + _esc(chosen.label) + '</b></span>';
              }
            }
            html += '<label class="adv-trigger-row' + hiddenClass + (info.anyMatch && isAdv ? ' adv-trigger-row--ondest' : '') + '">';
            html += '<input type="checkbox" class="adv-trigger-check" data-trigger-id="' + _esc(t.id) + '" data-bucket="' + _esc(bucket.key) + '"' + checked + ' />';
            html += '<div class="adv-trigger-info">';
            html += '<span class="adv-trigger-label">' + _esc(t.label) + groupTag + tierTag + hiddenTag + destinyTag + sharesTag + footprintTag + '</span>';
            html += '<span class="adv-trigger-desc">' + _esc(t.desc) + '</span>';
            if (chosenPathLine) html += chosenPathLine;
            if (_isGmView && isAdv && t.hidden) {
              html += '<button class="adv-btn adv-btn--reveal" data-reveal-mark="' + _esc(t.id) + '" data-reveal-adv="' + _esc(_currentAdventureId) + '">Reveal to Players</button>';
            }
            if (_isGmView && isAdv && !t.hidden && !t.noHide) {
              var origMark = _adventureMarksData && _adventureMarksData.find(function (m) { return m.id === t.id; });
              if (origMark) {
                html += '<button class="adv-btn adv-btn--hide" data-hide-mark="' + _esc(t.id) + '" data-hide-adv="' + _esc(_currentAdventureId) + '">Hide from Players</button>';
              }
            }
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
    var t = _getTrackObj(trackKey);
    var floor = (t && t.lockedInvested) ? t.lockedInvested : 0;
    var canAdd = uninvested > 0;
    var canSub = currentInv > floor;
    var newInv = currentInv - floor;
    var html = '<div class="adv-invest-row">';
    html += '<span class="adv-invest-label">' + _esc(label) + '</span>';
    if (floor > 0) html += '<span class="adv-invest-locked">\uD83D\uDD12' + floor + '</span>';
    html += '<div class="adv-invest-stepper">';
    html += '<button class="adv-invest-btn" data-invest-track="' + trackKey + '" data-invest-dir="sub"' + (canSub ? '' : ' disabled') + '>\u2212</button>';
    html += '<span class="adv-invest-value">' + (floor > 0 ? '+' + newInv : currentInv) + '</span>';
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
    var collapsed = _collapsedSections[trackKey];
    var html = '';
    html += '<div class="adv-track-section adv-collapsible-section' + (collapsed ? '' : ' open') + '">';
    html += '<div class="adv-track-header adv-collapsible-toggle" data-collapse-key="' + trackKey + '">';
    html += '<span class="adv-track-title">' + _esc(label) + '</span>';
    html += '<span class="adv-track-meta">Track ' + trackObj.level + ' \u2022 ' + costPerBox + ' Mark' + (costPerBox > 1 ? 's' : '') + '/pip \u2022 ' + totalTrackCost + ' to clear</span>';
    html += '<span class="adv-track-progress-badge">' + trackObj.filled + '/' + trackSize;
    if (unspent > 0) html += ' \u2022 ' + unspent + ' Adv';
    html += '</span>';
    html += '<span class="adv-collapse-chevron">' + (collapsed ? '\u25B8' : '\u25BE') + '</span>';
    html += '</div>';

    if (!collapsed) {
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
    }

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

  function _buildLedger() {
    if (!_char) return '';
    var html = '';
    var debt = _char.debt;
    var collapsed = _collapsedSections['ledger'];

    if (debt && debt.balance > 0) {
      var creditor = DEBT_CREDITORS.find(function(c) { return c.id === debt.creditorId; }) || DEBT_CREDITORS[0];
      var rateLabel = Math.round((debt.rate || creditor.rate) * 100) + '%';
      var nextCycle = Math.round(debt.balance * (1 + (debt.rate || creditor.rate)));

      html += '<div class="char-ledger-card adv-collapsible-section' + (collapsed ? '' : ' open') + '">';
      html += '<div class="char-ledger-header adv-collapsible-toggle" data-collapse-key="ledger">';
      html += '<span class="char-ledger-title">The Ledger</span>';
      html += '<span class="char-ledger-summary-inline">' + debt.balance.toLocaleString() + ' cr owed</span>';
      html += '<span class="adv-collapse-chevron">' + (collapsed ? '\u25B8' : '\u25BE') + '</span>';
      html += '</div>';

      if (!collapsed) {
        html += '<div class="char-ledger-body">' +
          '<div class="char-ledger-row">' +
            '<span class="char-ledger-label">Creditor</span>' +
            '<span class="char-ledger-val">' + _escHtml(creditor.name) + '</span>' +
          '</div>' +
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
      }

      html += '</div>';
    } else if (!debt || debt.balance <= 0) {
      html += '<div class="char-ledger-card adv-collapsible-section" style="opacity:0.5">' +
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

  // ── Linked Destiny: Field Report overlay helpers ────────────────────────
  var FIELD_REPORT_PHRASES = [
    'Filing Field Report with Imperial Operations Coordinator…',
    'Routing to Sector Command for chain-of-custody review…',
    'Stamping triplicate forms IRA-227(b), IRA-227(c)…',
    'Awaiting GM signature on Form ROK-12: Destiny Disposition…',
    'Sector Vice-Coordinator is on a comm break. Holding…',
    'Cross-checking your campaign log against ImpSec footprints…',
    'Your Field Report has been escalated. This is normal.'
  ];
  var _fieldReportTickerHandle = null;
  var _fieldReportTickerIdx = 0;

  function _refetchCharacter(cb) {
    if (!_charId) { if (cb) cb(); return; }
    fetch('/api/characters/' + encodeURIComponent(_charId))
      .then(function (r) { return r.json(); })
      .then(function (c) {
        if (c && c.id) {
          _char = c;
          _advancement = c.advancement || _advancement;
          _ensureDefaults();
          if (window.CharacterPanel) window.CharacterPanel.currentChar = c;
          document.dispatchEvent(new CustomEvent('character:stateChanged'));
        }
        if (cb) cb();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] refetch failed', err);
        if (cb) cb();
      });
  }

  function _checkPendingReviewOnBoot() {
    if (!_charId || _isGmView) return;
    var token = window._playerToken || '';
    var url = '/api/characters/' + encodeURIComponent(_charId) + '/pending-mission-review';
    if (token) url += '?player_token=' + encodeURIComponent(token);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.pending && data.pending.reviewId) {
          _pendingReviewId = data.pending.reviewId;
          if (_panelVisible) _render();
        }
      })
      .catch(function () { /* non-fatal */ });
  }

  function _submitFieldReport(proposedAdvancement) {
    if (!_charId) return;
    var token = window._playerToken || '';
    // Persist the source's adventure-marks first AND wait for the round-trip so
    // the server's frozen snapshot matches the latest local toggles. Without the
    // await, the POST below could race the PUT and snapshot stale marks.
    Promise.resolve(_persistAdventureMarks(false)).then(function (ok) {
      if (!ok) {
        // Marks didn't make it to the server — abort so the GM never reviews a
        // stale snapshot. Player can retry once their connection recovers.
        _showModal({ type: 'alert', message: 'Could not save your marks to the server. Check your connection and try again.' });
        return null;
      }
      var url = '/api/characters/' + encodeURIComponent(_charId) + '/end-mission/request';
      if (token) url += '?player_token=' + encodeURIComponent(token);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advancement: proposedAdvancement })
      });
    })
      .then(function (r) {
        if (!r) return null;
        return r.json().then(function (j) { return { ok: r.ok, body: j }; });
      })
      .then(function (resp) {
        if (!resp) return;
        if (!resp.ok) {
          var msg = (resp.body && resp.body.error) || 'Unable to file Field Report.';
          _showModal({ type: 'alert', message: msg });
          return;
        }
        _pendingReviewId = resp.body.reviewId;
        _rejectionNote = '';
        if (_panelVisible) _render();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] field report submit failed', err);
        _showModal({ type: 'alert', message: 'Could not reach the GM. Try again.' });
      });
  }

  function _renderFieldReportOverlay(container) {
    var existing = container.querySelector('.adv-field-report-overlay');
    if (existing) existing.remove();
    if (!_pendingReviewId) {
      if (_fieldReportTickerHandle) { clearInterval(_fieldReportTickerHandle); _fieldReportTickerHandle = null; }
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'adv-field-report-overlay';
    overlay.innerHTML =
      '<div class="adv-field-report-card">' +
        '<div class="adv-field-report-stamp">FIELD REPORT</div>' +
        '<div class="adv-field-report-title">Awaiting GM Approval</div>' +
        '<div class="adv-field-report-ticker">' + _esc(FIELD_REPORT_PHRASES[0]) + '</div>' +
        '<div class="adv-field-report-meta">Form #' + _esc(String(_pendingReviewId)) + ' &middot; In Queue</div>' +
      '</div>';
    container.appendChild(overlay);
    if (_fieldReportTickerHandle) clearInterval(_fieldReportTickerHandle);
    _fieldReportTickerIdx = 0;
    _fieldReportTickerHandle = setInterval(function () {
      _fieldReportTickerIdx = (_fieldReportTickerIdx + 1) % FIELD_REPORT_PHRASES.length;
      var ticker = container.querySelector('.adv-field-report-ticker');
      if (ticker) ticker.textContent = FIELD_REPORT_PHRASES[_fieldReportTickerIdx];
    }, 3000);
  }

  function _renderRejectionBanner(container) {
    var existing = container.querySelector('.adv-field-report-rejection');
    if (existing) existing.remove();
    if (!_rejectionNote && _rejectionNote !== '') return;
    if (!_rejectionNote) return;
    var panel = container.querySelector('.adv-panel');
    if (!panel) return;
    var banner = document.createElement('div');
    banner.className = 'adv-field-report-rejection';
    banner.innerHTML =
      '<div class="adv-field-report-rejection-title">Field Report Returned by GM</div>' +
      '<div class="adv-field-report-rejection-body">' + _esc(_rejectionNote) + '</div>' +
      '<button class="adv-btn adv-field-report-rejection-dismiss" type="button">Dismiss</button>';
    panel.insertBefore(banner, panel.firstChild);
    var dismiss = banner.querySelector('.adv-field-report-rejection-dismiss');
    if (dismiss) dismiss.addEventListener('click', function () { _rejectionNote = ''; _render(); });
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

    html += _buildGoalsToRevealCockpit();
    html += _buildLedger();

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
    html += '<div class="adv-section-divider">HERO TIER</div>';
    html += _buildHeroTierCard();
    html += '<div class="adv-section-divider">ADVANCEMENT TRACKS</div>';
    html += _buildDisciplineTrack();
    html += _buildArenaTrack();
    html += _buildVocationTrack();
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;
    _bindEvents(container);
    _renderRejectionBanner(container);
    _renderFieldReportOverlay(container);
  }

  function _showPathPickModal(trigger, onConfirm, onCancel) {
    var existing = document.getElementById('adv-modal-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'adv-modal-overlay';
    overlay.className = 'adv-modal-overlay';

    var box = document.createElement('div');
    box.className = 'adv-modal-box adv-modal-box--paths';

    var title = document.createElement('div');
    title.className = 'adv-pathpick-title';
    title.textContent = 'Which way did it go down?';
    box.appendChild(title);

    var sub = document.createElement('div');
    sub.className = 'adv-pathpick-subtitle';
    sub.innerHTML = '<b>' + _esc(trigger.label) + '</b> — pick the path that best matches what you actually did. The path you took decides which footprint lands on which road.';
    box.appendChild(sub);

    var pcDest = _getPcDestinyId();
    var paths = Array.isArray(trigger.paths) ? trigger.paths : [];

    var list = document.createElement('div');
    list.className = 'adv-pathpick-list';
    paths.forEach(function (p) {
      var card = document.createElement('button');
      card.type = 'button';
      var match = pcDest && Array.isArray(p.destinies) && p.destinies.indexOf(pcDest) !== -1;
      card.className = 'adv-pathpick-card' + (match ? ' adv-pathpick-card--match' : '');
      var destLabels = (Array.isArray(p.destinies) ? p.destinies : []).map(function (d) {
        var found = (_destinyData || []).find(function (x) { return x.id === d; });
        return found ? found.name : d;
      });
      var destLine = destLabels.length > 0
        ? '<span class="adv-pathpick-dest">Destiny tag: ' + _esc(destLabels.join(' / ')) + (match ? ' \u2605 your road' : '') + '</span>'
        : '<span class="adv-pathpick-dest adv-pathpick-dest--neutral">No destiny tag — neutral spine.</span>';
      card.innerHTML =
        '<div class="adv-pathpick-card-label">' + _esc(p.label) + (match ? ' <span class="adv-tag adv-tag--destiny">\u2605 ON YOUR ROAD</span>' : '') + '</div>' +
        '<div class="adv-pathpick-card-desc">' + _esc(p.desc || '') + '</div>' +
        destLine;
      card.addEventListener('click', function () {
        overlay.remove();
        if (onConfirm) onConfirm(p.id);
      });
      list.appendChild(card);
    });
    box.appendChild(list);

    var actions = document.createElement('div');
    actions.className = 'adv-modal-actions';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'adv-modal-btn adv-modal-btn--cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { overlay.remove(); if (onCancel) onCancel(); });
    actions.appendChild(cancelBtn);
    box.appendChild(actions);

    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { overlay.remove(); if (onCancel) onCancel(); }
    });
    document.body.appendChild(overlay);
  }

  function _showEdgeRefillToast() {
    var existing = document.getElementById('adv-edge-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'adv-edge-toast';
    toast.className = 'adv-edge-toast';
    toast.innerHTML = '<span class="adv-edge-toast-star">\u2605</span><span>The road carries you forward — your Edge is full again.</span>';
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('adv-edge-toast--out');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 2400);
  }

  function _applyDestinyMatchSideEffect(trigger) {
    // 2-footprint payout is computed at count time via _getTriggerValue.
    // The side-effect here is the Edge refill to max.
    if (window.CharacterPanel && typeof window.CharacterPanel.refillEngine === 'function') {
      var refilled = window.CharacterPanel.refillEngine();
      if (refilled) _showEdgeRefillToast();
    }
  }

  // Find the trigger object (with paths/destinies) for a given mark id.
  function _findAdventureTrigger(id) {
    var triggers = _getAdventureTriggers();
    return triggers.find(function (t) { return t.id === id; }) || null;
  }

  function _bindEvents(container) {
    var checks = container.querySelectorAll('.adv-trigger-check');
    checks.forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-trigger-id');
        var bucketKey = cb.getAttribute('data-bucket');
        if (!_advancement.marks.earnedChecks) _advancement.marks.earnedChecks = {};
        if (!_advancement.marks.paths) _advancement.marks.paths = {};

        // Edge bucket and Destiny-bucket leftovers behave like simple toggles.
        if (bucketKey !== 'adventure') {
          _advancement.marks.earnedChecks[id] = cb.checked;
          _updateMarksSummary();
          _persist();
          return;
        }

        var trigger = _findAdventureTrigger(id);
        if (!trigger) {
          _advancement.marks.earnedChecks[id] = cb.checked;
          _updateMarksSummary();
          _persist();
          return;
        }

        if (cb.checked) {
          var paths = Array.isArray(trigger.paths) ? trigger.paths : [];
          if (paths.length >= 2) {
            // Defer: revert the visual check until the player picks a path.
            cb.checked = false;
            _showPathPickModal(trigger,
              function (pathId) {
                _advancement.marks.earnedChecks[id] = true;
                _advancement.marks.paths[id] = pathId;
                var info = _getDestinyInfo(trigger);
                if (info.chosenMatch) _applyDestinyMatchSideEffect(trigger);
                _render();
                _persist();
              },
              function () { /* cancelled — leave unchecked */ }
            );
            return;
          }
          // Single-path or no-path goal: auto-claim.
          _advancement.marks.earnedChecks[id] = true;
          if (paths.length === 1) {
            _advancement.marks.paths[id] = paths[0].id;
          }
          var infoNow = _getDestinyInfo(trigger);
          if (infoNow.chosenMatch) _applyDestinyMatchSideEffect(trigger);
          _render();
          _persist();
        } else {
          _advancement.marks.earnedChecks[id] = false;
          if (_advancement.marks.paths[id]) delete _advancement.marks.paths[id];
          _render();
          _persist();
        }
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
          var floor = t.lockedInvested || 0;
          if ((t.invested || 0) > floor) {
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
        // Build the would-be advancement payload WITHOUT mutating _advancement locally
        // (the GM gate is the only thing that should flip missionPhase). The server stores
        // this as the frozen snapshot to apply on approve.
        var earned = _countEarnedMarks();
        var oldTier = _advancement.heroTier ? _advancement.heroTier.current : 0;
        var newHt = _getHeroTier();
        var proposed = JSON.parse(JSON.stringify(_advancement));
        proposed.careerMarksEarned = (proposed.careerMarksEarned || 0) + earned;
        if (!proposed.heroTier) proposed.heroTier = { current: 0, respecUsed: false, signatureMove: '', moniker: '', favoredArena: '' };
        proposed.heroTier.current = newHt.tier;
        proposed.missionPhase = 'advancement';
        // Stash the tier delta so the approval handler can show the Hero Tier modal.
        _pendingTierBump = (newHt.tier > oldTier) ? newHt : null;
        _submitFieldReport(proposed);
      });
    }

    var startMissionBtn = container.querySelector('#adv-start-mission-btn');
    if (startMissionBtn) {
      startMissionBtn.addEventListener('click', function () {
        // Footprint model: marks earned during this adventure persist for the
        // ENTIRE adventure — they represent the player's road to a Destiny
        // Moment, not single-session scratch state. Start Mission only locks
        // current investments so they can't be undone. earnedChecks and paths
        // are intentionally preserved (and so is totalBanked, which now stays
        // at 0 because earnedChecks is the cumulative source of footprint truth
        // across the whole adventure — see _countEarnedMarks).
        _advancement.missionPhase = 'mission';
        _advancement.disciplineTrack.lockedInvested = _advancement.disciplineTrack.invested || 0;
        _advancement.arenaTrack.lockedInvested = _advancement.arenaTrack.invested || 0;
        _advancement.vocationTrack.lockedInvested = _advancement.vocationTrack.invested || 0;
        _advancement.marks.totalBanked = 0;
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

    // Shares-to / Unlinked badge: open the Destiny Link panel. We stop
    // propagation so the surrounding <label> doesn't toggle the goal's
    // checkbox when the GM only meant to edit the link.
    var dlBtns = container.querySelectorAll('[data-open-destiny-link]');
    dlBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.CommandBridge && typeof window.CommandBridge.openDestinyLinkPanel === 'function') {
          window.CommandBridge.openDestinyLinkPanel();
        } else {
          var panelBtn = document.getElementById('cb-destiny-link-btn');
          if (panelBtn) panelBtn.click();
        }
      });
    });

    // Goals-to-Reveal cockpit collapse toggle.
    var gtrToggle = container.querySelector('#adv-gtr-toggle');
    if (gtrToggle) {
      gtrToggle.addEventListener('click', function () {
        _gtrCollapsed = !_gtrCollapsed;
        _render();
      });
    }

    // Cockpit reveal buttons share the same endpoint as the per-row reveal
    // buttons in the checklist below, so a single broadcast keeps everyone
    // in sync via the marks:revealed socket event.
    var gtrRevealBtns = container.querySelectorAll('[data-gtr-reveal-mark]');
    gtrRevealBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var markId = btn.getAttribute('data-gtr-reveal-mark');
        var advId = btn.getAttribute('data-gtr-reveal-adv');
        btn.disabled = true;
        btn.textContent = 'Revealing\u2026';
        fetch('/api/campaign/adventures/' + encodeURIComponent(advId) + '/marks/' + encodeURIComponent(markId) + '/reveal', { method: 'POST' })
          .then(function (r) {
            if (!r.ok) throw new Error('Reveal failed: ' + r.status);
            return r.json();
          })
          .then(function (data) {
            if (!data.ok) throw new Error('Reveal rejected');
            var sock = _getSocket();
            if (sock) sock.emit('marks:reveal', { adventureId: advId, markId: markId });
            if (_adventureMarksData) {
              _adventureMarksData.forEach(function (m) { if (m.id === markId) m.hidden = false; });
            }
            _render();
          })
          .catch(function (err) {
            console.error('[AdvancementPanel] GTR Reveal error:', err);
            btn.disabled = false;
            btn.textContent = 'Reveal';
          });
      });
    });

    var revealBtns = container.querySelectorAll('.adv-btn--reveal:not([data-gtr-reveal-mark])');
    revealBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var markId = btn.getAttribute('data-reveal-mark');
        var advId = btn.getAttribute('data-reveal-adv');
        fetch('/api/campaign/adventures/' + encodeURIComponent(advId) + '/marks/' + encodeURIComponent(markId) + '/reveal', { method: 'POST' })
          .then(function (r) {
            if (!r.ok) throw new Error('Reveal failed: ' + r.status);
            return r.json();
          })
          .then(function (data) {
            if (!data.ok) throw new Error('Reveal rejected');
            var sock = _getSocket();
            if (sock) sock.emit('marks:reveal', { adventureId: advId, markId: markId });
            if (_adventureMarksData) {
              _adventureMarksData.forEach(function (m) { if (m.id === markId) m.hidden = false; });
            }
            _render();
          })
          .catch(function (err) { console.error('[AdvancementPanel] Reveal error:', err); });
      });
    });

    var hideBtns = container.querySelectorAll('.adv-btn--hide');
    hideBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var markId = btn.getAttribute('data-hide-mark');
        var advId = btn.getAttribute('data-hide-adv');
        fetch('/api/campaign/adventures/' + encodeURIComponent(advId) + '/marks/' + encodeURIComponent(markId) + '/hide', { method: 'POST' })
          .then(function (r) {
            if (!r.ok) throw new Error('Hide failed: ' + r.status);
            return r.json();
          })
          .then(function (data) {
            if (!data.ok) throw new Error('Hide rejected');
            var sock = _getSocket();
            if (sock) sock.emit('marks:hide', { adventureId: advId, markId: markId });
            if (_adventureMarksData) {
              _adventureMarksData.forEach(function (m) { if (m.id === markId) m.hidden = true; });
            }
            _render();
          })
          .catch(function (err) { console.error('[AdvancementPanel] Hide error:', err); });
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

    var collapsibleToggles = container.querySelectorAll('.adv-collapsible-toggle');
    collapsibleToggles.forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        if (e.target.closest('.adv-pip') || e.target.closest('button')) return;
        var key = toggle.getAttribute('data-collapse-key');
        if (key) {
          _collapsedSections[key] = !_collapsedSections[key];
          _render();
        }
      });
    });

    var respecBtn = container.querySelector('#adv-ht-respec-btn');
    if (respecBtn) {
      respecBtn.addEventListener('click', function () {
        _showRespecModal();
      });
    }

    var htSignature = container.querySelector('#adv-ht-signature');
    if (htSignature) {
      htSignature.addEventListener('change', function () {
        _advancement.heroTier.signatureMove = htSignature.value;
        _persist();
      });
    }
    var htMoniker = container.querySelector('#adv-ht-moniker');
    if (htMoniker) {
      htMoniker.addEventListener('change', function () {
        _advancement.heroTier.moniker = htMoniker.value;
        _persist();
        _render();
      });
    }
    var htArena = container.querySelector('#adv-ht-arena');
    if (htArena) {
      htArena.addEventListener('change', function () {
        _advancement.heroTier.favoredArena = htArena.value;
        _persist();
        _render();
      });
    }
    var ht5Finalize = container.querySelector('#adv-ht5-finalize');
    if (ht5Finalize) {
      ht5Finalize.addEventListener('click', function () {
        var mon = (_advancement.heroTier.moniker || '').trim();
        var fav = (_advancement.heroTier.favoredArena || '').trim();
        if (!mon || !fav) return;
        _showModal({
          type: 'confirm',
          message: 'Finalize "The Name" tier?\n\nMoniker: ' + mon + '\nFavored Arena: ' + fav + '\n\nThis is permanent — all disciplines in that arena become Favored and your moniker replaces your archetype title.',
          onConfirm: function () {
            _advancement.heroTier.ht5Finalized = true;
            _persist();
            _render();
            document.dispatchEvent(new CustomEvent('character:stateChanged'));
            if (window.CharacterPanel && window.CharacterPanel.refresh) {
              window.CharacterPanel.refresh();
            }
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
    var earned = _countEarnedMarks();
    var banked = (_advancement && _advancement.marks) ? (_advancement.marks.totalBanked || 0) : 0;
    var totalPool = earned + banked;
    var uninvested = _getUninvestedMarks();

    var numEl = document.querySelector('.adv-marks-number');
    if (numEl) numEl.textContent = uninvested;

    var earnedEl = document.querySelector('.adv-marks-detail');
    if (earnedEl) earnedEl.textContent = 'Earned this adventure: ' + earned;

    var investBtns = document.querySelectorAll('.adv-invest-btn');
    investBtns.forEach(function (btn) {
      var dir = btn.getAttribute('data-invest-dir');
      var trackKey = btn.getAttribute('data-invest-track');
      var t = _getTrackObj(trackKey);
      if (dir === 'add') {
        btn.disabled = uninvested <= 0;
      } else if (dir === 'sub') {
        var floor = (t && t.lockedInvested) ? t.lockedInvested : 0;
        btn.disabled = !t || (t.invested || 0) <= floor;
      }
    });
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

  function _loadAdventureMarksData(cb) {
    fetch('/api/campaign/adventures/' + encodeURIComponent(_currentAdventureId) + '/marks')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok && data.marks) {
          _adventureMarksData = data.marks;
        } else {
          _adventureMarksData = [];
        }
        // Capture the Act number too (Linked Destiny share lookups need it).
        if (data && Number.isFinite(data.act)) _currentAdventureAct = data.act;
        if (cb) cb();
      })
      .catch(function (err) {
        console.error('[AdvancementPanel] Failed to load adventure marks data:', err);
        _adventureMarksData = [];
        if (cb) cb();
      });
  }

  // Roster snapshot used for Linked Destiny partner-name lookups (Shares-to
  // badge) and to power the GM "Goals to Reveal" cockpit. Strict cache —
  // refreshed only on init or when a destiny link save fires.
  function _loadPartyCache(cb) {
    fetch('/api/characters')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _partyCache = (data && Array.isArray(data.characters)) ? data.characters : [];
        if (cb) cb();
      })
      .catch(function () { _partyCache = []; if (cb) cb(); });
  }

  function _loadAdventureMarks(cb) {
    if (!_charId) { if (cb) cb(); return; }
    fetch('/api/characters/' + encodeURIComponent(_charId) + '/adventure-marks/' + encodeURIComponent(_currentAdventureId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Relational table is the source of truth — fully replace the JSON
        // mirror to avoid stale checks/paths surviving a remote clear.
        _advancement.marks.earnedChecks = {};
        _advancement.marks.paths = {};
        if (data.ok && Array.isArray(data.marks)) {
          data.marks.forEach(function (m) {
            _advancement.marks.earnedChecks[m.mark_id] = true;
            if (m.path_id) _advancement.marks.paths[m.mark_id] = m.path_id;
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
      var totalLoads = 6;
      function onLoaded() {
        loaded++;
        if (loaded >= totalLoads) {
          if (_panelVisible) _render();
          _initialized = true;
          document.dispatchEvent(new CustomEvent('advancement:ready'));
        }
      }

      _loadDestinyData(onLoaded);
      _loadKitsData(onLoaded);
      _loadPartyCache(onLoaded);
      _loadCampaignProgress(function () {
        _loadAdventureMarksData(onLoaded);
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

      // Destiny Link panel save → refresh party cache so the GM
      // "Shares to: X" badges update immediately without a reload.
      // Dispatched by command-bridge._saveLinkedPartner on success.
      document.addEventListener('destiny-link:changed', function () {
        _loadPartyCache(function () { if (_panelVisible) _render(); });
      });

      // Flush any pending debounced save before the page goes away.
      // visibilitychange fires reliably on tab-away on mobile + desktop;
      // beforeunload covers full window close. fetch keepalive lets the
      // request finish even after the document is gone.
      var _flushIfPending = function () {
        if (_saveTimeout) {
          clearTimeout(_saveTimeout);
          _saveTimeout = null;
          _flushPersist(true);
        }
      };
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') _flushIfPending();
      });
      window.addEventListener('pagehide', _flushIfPending);
      window.addEventListener('beforeunload', _flushIfPending);

      // Re-hydrate the pending review state so the Field Report overlay survives
      // page reloads (the server is the source of truth).
      _checkPendingReviewOnBoot();

      var sock = _getSocket();
      if (sock) {
        sock.on('advancement:sync', function (data) {
          if (data.characterId === _charId && data.advancement) {
            _advancement = data.advancement;
            _ensureDefaults();
            if (_panelVisible) _render();
          }
        });
        sock.on('missionReview:approved', function (data) {
          if (!_pendingReviewId || data.reviewId !== _pendingReviewId) return;
          _pendingReviewId = null;
          _rejectionNote = '';
          // Refetch the character so banked-mark / advancement state is authoritative.
          _refetchCharacter(function () {
            if (_panelVisible) _render();
            if (_pendingTierBump) {
              var newHt = _pendingTierBump;
              _pendingTierBump = null;
              _showModal({ type: 'alert', message: 'Hero Tier reached: ' + newHt.name + '!\n\n' + newHt.shortBenefit });
            }
          });
        });
        sock.on('missionReview:rejected', function (data) {
          if (!_pendingReviewId || data.reviewId !== _pendingReviewId) return;
          _pendingReviewId = null;
          _pendingTierBump = null;
          _rejectionNote = (data && data.gmNote) || '';
          if (_panelVisible) _render();
        });
        sock.on('marks:revealed', function (data) {
          if (data.adventureId === _currentAdventureId && _adventureMarksData) {
            _adventureMarksData.forEach(function (m) {
              if (m.id === data.markId) m.hidden = false;
            });
            if (_panelVisible) _render();
          }
        });
        sock.on('marks:hidden', function (data) {
          if (data.adventureId === _currentAdventureId && _adventureMarksData) {
            _adventureMarksData.forEach(function (m) {
              if (m.id === data.markId) m.hidden = true;
            });
            if (_panelVisible) _render();
          }
        });
      }
    }
    tryRender();
  }

  window.AdvancementPanel = window.AdvancementPanel || {};
  window.AdvancementPanel.getHeroTierLevel = function () {
    if (!_advancement) return 0;
    return _getHeroTier().tier;
  };
  window.AdvancementPanel.getHeroTierData = function () {
    if (!_advancement || !_advancement.heroTier) return null;
    return {
      tier: _getHeroTier().tier,
      tierName: _getHeroTier().name,
      signatureMove: _advancement.heroTier.signatureMove || '',
      moniker: _advancement.heroTier.moniker || '',
      favoredArena: _advancement.heroTier.favoredArena || '',
      ht5Finalized: !!_advancement.heroTier.ht5Finalized
    };
  };
  window.AdvancementPanel.setSignatureMove = function (val) {
    if (!_advancement) return;
    if (!_advancement.heroTier) _advancement.heroTier = { current: 0, respecUsed: false, signatureMove: '', moniker: '', favoredArena: '' };
    _advancement.heroTier.signatureMove = val;
    _persist();
    _render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

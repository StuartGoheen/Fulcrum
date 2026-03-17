(function () {
  'use strict';

  var _entries = {};
  var _maneuversByDisc = {};
  var _panel = null;
  var _isOpen = false;
  var _providers = [];
  var _activeEntryId = null;
  var _searchTerm = '';
  var _expandedCategories = {};
  var _dataReady = false;

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var _GLOSSARY_CONDITION_MAP = {
    'disoriented': 'condition_disoriented', 'rattled': 'condition_rattled',
    'optimized': 'condition_optimized', 'weakened': 'condition_weakened',
    'empowered': 'condition_empowered', 'shaken': 'condition_shaken',
    'exposed': 'condition_exposed', 'pinned': 'condition_pinned',
    'prone': 'condition_prone', 'hazard': 'condition_hazard',
    'guarded': 'condition_guarded', 'cover': 'condition_cover',
    'buffered': 'condition_buffered', 'blinded': 'condition_blinded',
    'shut down': 'condition_shut_down', 'restrained': 'condition_restrained',
    'suppressed': 'condition_suppressed', 'bleeding': 'condition_bleeding',
    'stunned': 'condition_stunned', 'incapacitated': 'condition_incapacitated',
    'marked': 'condition_marked', 'slowed': 'condition_slowed',
    'stimmed': 'stimmed', 'natural recovery': 'natural_recovery',
  };

  function _linkify(str) {
    var s = String(str);
    var out = '';
    var re = /\[([^\]]+)\]/g;
    var last = 0;
    var match;
    while ((match = re.exec(s)) !== null) {
      out += _esc(s.slice(last, match.index));
      var inner = match[1];
      var normalized = inner.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
      var glossaryId = _GLOSSARY_CONDITION_MAP[normalized];
      if (glossaryId) {
        out += '<span class="condition-link" data-glossary-id="' + _esc(glossaryId) + '">[' + _esc(inner) + ']</span>';
      } else {
        out += _esc(match[0]);
      }
      last = match.index + match[0].length;
    }
    out += _esc(s.slice(last));
    return out;
  }

  var ARENA_ORDER = ['physique', 'grit', 'reflex', 'wits', 'presence'];
  var ARENA_LABELS = {
    physique: 'Physique', grit: 'Grit', reflex: 'Reflex', wits: 'Wits', presence: 'Presence'
  };

  var CONDITION_TYPE_ORDER = ['physical', 'mental', 'positional', 'environmental', 'buff', 'tag', 'special', 'combined'];
  var CONDITION_TYPE_LABELS = {
    physical: 'Physical', mental: 'Mental', positional: 'Positional',
    environmental: 'Environmental', buff: 'Buff', tag: 'Tag',
    special: 'Special', combined: 'Combined'
  };

  function _registerProviders() {
    _providers = [];

    _providers.push({
      id: 'destiny',
      label: 'Destiny Pool',
      icon: '\u2727',
      getGroups: function () {
        var e = _entries['destiny_pool'];
        if (!e) return [];
        return [{ groupLabel: null, entries: [{ id: e.id, name: e.name }] }];
      },
      hasEntry: function (id) { return id === 'destiny_pool'; }
    });

    _providers.push({
      id: 'arenas',
      label: 'Arenas',
      icon: '\u2726',
      getGroups: function () {
        var groups = [];
        ARENA_ORDER.forEach(function (aid) {
          var entry = _entries[aid];
          if (entry) {
            groups.push({
              groupLabel: null,
              entries: [{ id: entry.id, name: entry.name }]
            });
          }
        });
        return groups;
      },
      hasEntry: function (id) {
        var e = _entries[id];
        return e && e.type === 'Core Attribute';
      }
    });

    _providers.push({
      id: 'disciplines',
      label: 'Disciplines',
      icon: '\u2694',
      getGroups: function () {
        var groups = [];
        ARENA_ORDER.forEach(function (aid) {
          var label = ARENA_LABELS[aid] || aid;
          var discs = [];
          Object.keys(_entries).forEach(function (eid) {
            var e = _entries[eid];
            if (e.type && e.type.indexOf('Discipline') !== -1 && e.type.indexOf(label) !== -1) {
              discs.push({ id: e.id, name: e.name });
            }
          });
          discs.sort(function (a, b) { return a.name.localeCompare(b.name); });
          if (discs.length) {
            groups.push({ groupLabel: label, entries: discs });
          }
        });
        return groups;
      },
      hasEntry: function (id) {
        var e = _entries[id];
        return e && e.type && e.type.indexOf('Discipline') !== -1;
      }
    });

    _providers.push({
      id: 'conditions',
      label: 'Conditions',
      icon: '\u26A0',
      getGroups: function () {
        var groups = [];
        CONDITION_TYPE_ORDER.forEach(function (ct) {
          var label = CONDITION_TYPE_LABELS[ct] || ct;
          var conds = [];
          Object.keys(_entries).forEach(function (eid) {
            var e = _entries[eid];
            if (!e.type) return;
            var isCondition = e.type === 'Condition' || e.type === 'Condition (Combined)' || e.type === 'Condition (Stacking)';
            if (isCondition && e.conditionType === ct) {
              conds.push({ id: e.id, name: e.name });
            }
          });
          conds.sort(function (a, b) { return a.name.localeCompare(b.name); });
          if (conds.length) {
            groups.push({ groupLabel: label, entries: conds });
          }
        });
        var rules = [];
        Object.keys(_entries).forEach(function (eid) {
          var e = _entries[eid];
          if (e.type === 'Rule') {
            rules.push({ id: e.id, name: e.name });
          }
        });
        if (rules.length) {
          rules.sort(function (a, b) { return a.name.localeCompare(b.name); });
          groups.push({ groupLabel: 'Rules', entries: rules });
        }
        return groups;
      },
      hasEntry: function (id) {
        var e = _entries[id];
        if (!e) return false;
        return e.type === 'Condition' || e.type === 'Condition (Combined)' || e.type === 'Condition (Stacking)' || e.type === 'Rule';
      }
    });
  }

  function _buildPanel() {
    var el = document.createElement('div');
    el.id = 'handbook-panel';
    el.className = 'handbook-panel';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', "Player's Handbook");
    el.innerHTML =
      '<div class="handbook-backdrop"></div>' +
      '<div class="handbook-container">' +
        '<div class="handbook-sidebar">' +
          '<div class="handbook-sidebar-header">' +
            '<span class="handbook-title">Handbook</span>' +
            '<button class="handbook-close-btn" id="handbook-close-btn" aria-label="Close">&times;</button>' +
          '</div>' +
          '<div class="handbook-search-wrap">' +
            '<input type="text" class="handbook-search" id="handbook-search" placeholder="Search rules\u2026" autocomplete="off" />' +
          '</div>' +
          '<div class="handbook-index" id="handbook-index"></div>' +
        '</div>' +
        '<div class="handbook-content" id="handbook-content">' +
          '<div class="handbook-empty" id="handbook-empty">' +
            '<div class="handbook-empty-icon">\uD83D\uDCD6</div>' +
            '<div class="handbook-empty-text">Select an entry from the index<br>or search for a rule.</div>' +
          '</div>' +
          '<div class="handbook-entry" id="handbook-entry" style="display:none;">' +
            '<div class="handbook-entry-header">' +
              '<span class="handbook-entry-name" id="handbook-entry-name"></span>' +
              '<span class="handbook-entry-type" id="handbook-entry-type"></span>' +
            '</div>' +
            '<div class="handbook-entry-body">' +
              '<div class="handbook-section" id="hb-rule-section">' +
                '<div class="handbook-section-label">The Rule</div>' +
                '<div class="handbook-rule-text" id="handbook-rule-text"></div>' +
              '</div>' +
              '<div class="handbook-section" id="hb-guide-section">' +
                '<div class="handbook-section-label">The Spacer\'s Guide</div>' +
                '<div class="handbook-guide-text" id="handbook-guide-text"></div>' +
              '</div>' +
              '<div id="hb-maneuvers-section" class="hb-maneuvers-section"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return el;
  }

  function _buildTriggerBtn() {
    var btn = document.createElement('button');
    btn.id = 'handbook-trigger';
    btn.className = 'handbook-trigger';
    btn.setAttribute('aria-label', "Open Player's Handbook");
    btn.title = "Player's Handbook";
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></svg>';
    return btn;
  }

  function _buildSidebarIndex() {
    var container = document.getElementById('handbook-index');
    if (!container) return;
    container.innerHTML = '';

    var term = _searchTerm.toLowerCase().trim();

    _providers.forEach(function (prov) {
      var groups = prov.getGroups();
      var filteredGroups = [];

      groups.forEach(function (g) {
        var filteredEntries = g.entries;
        if (term) {
          filteredEntries = g.entries.filter(function (e) {
            var entry = _entries[e.id];
            if (e.name.toLowerCase().indexOf(term) !== -1) return true;
            if (entry && entry.rule && entry.rule.toLowerCase().indexOf(term) !== -1) return true;
            if (entry && entry.guide && entry.guide.toLowerCase().indexOf(term) !== -1) return true;
            return false;
          });
        }
        if (filteredEntries.length) {
          filteredGroups.push({ groupLabel: g.groupLabel, entries: filteredEntries });
        }
      });

      if (!filteredGroups.length) return;

      var catKey = prov.id;
      var isExpanded = _expandedCategories[catKey] !== false;
      if (term) isExpanded = true;

      var catDiv = document.createElement('div');
      catDiv.className = 'hb-cat';

      var catBtn = document.createElement('button');
      catBtn.className = 'hb-cat-btn' + (isExpanded ? ' is-expanded' : '');
      catBtn.innerHTML = '<span class="hb-cat-icon">' + prov.icon + '</span><span class="hb-cat-label">' + _esc(prov.label) + '</span><span class="hb-cat-chevron">\u25B8</span>';
      catBtn.addEventListener('click', function () {
        _expandedCategories[catKey] = !(_expandedCategories[catKey] !== false);
        _buildSidebarIndex();
      });
      catDiv.appendChild(catBtn);

      if (isExpanded) {
        var listDiv = document.createElement('div');
        listDiv.className = 'hb-cat-list';

        filteredGroups.forEach(function (g) {
          if (g.groupLabel) {
            var groupHeader = document.createElement('div');
            groupHeader.className = 'hb-group-label';
            groupHeader.textContent = g.groupLabel;
            listDiv.appendChild(groupHeader);
          }
          g.entries.forEach(function (e) {
            var item = document.createElement('button');
            item.className = 'hb-entry-btn' + (e.id === _activeEntryId ? ' is-active' : '');
            item.textContent = e.name;
            item.setAttribute('data-entry-id', e.id);
            item.addEventListener('click', function () {
              _showEntry(e.id);
            });
            listDiv.appendChild(item);
          });
        });

        catDiv.appendChild(listDiv);
      }

      container.appendChild(catDiv);
    });
  }

  function _renderManeuvers(disciplineId) {
    var section = document.getElementById('hb-maneuvers-section');
    if (!section) return;
    section.innerHTML = '';

    var maneuvers = _maneuversByDisc[disciplineId];
    if (!maneuvers || maneuvers.length === 0) return;

    var heading = document.createElement('div');
    heading.className = 'handbook-section-label hb-maneuvers-heading';
    heading.textContent = 'Maneuvers & Gambits';
    section.appendChild(heading);

    maneuvers.forEach(function (m) {
      var block = document.createElement('div');
      block.className = 'glo-maneuver-block';

      var header = document.createElement('div');
      header.className = 'glo-maneuver-header';
      var name = document.createElement('span');
      name.className = 'glo-maneuver-name';
      name.textContent = m.name;
      header.appendChild(name);

      var tagRow = document.createElement('div');
      tagRow.className = 'glo-maneuver-tags';
      var unlockTag = document.createElement('span');
      unlockTag.className = 'glo-tag glo-tag--unlock';
      unlockTag.textContent = 'Unlocks at D8';
      tagRow.appendChild(unlockTag);
      if (m.actionType) {
        var typeTag = document.createElement('span');
        typeTag.className = 'glo-tag glo-tag--action';
        typeTag.textContent = m.actionType;
        tagRow.appendChild(typeTag);
      }
      if (m.arenaTag) {
        var arenaTag = document.createElement('span');
        arenaTag.className = 'glo-tag glo-tag--arena';
        arenaTag.textContent = m.arenaTag;
        tagRow.appendChild(arenaTag);
      }
      header.appendChild(tagRow);
      block.appendChild(header);

      if (m.roll || m.target) {
        var rollRow = document.createElement('div');
        rollRow.className = 'glo-maneuver-rollrow';
        if (m.roll)   rollRow.innerHTML += '<span class="glo-rollrow-label">Roll</span> <span class="glo-rollrow-val">' + _esc(m.roll) + '</span>';
        if (m.target) rollRow.innerHTML += '<span class="glo-rollrow-sep">\u2022</span><span class="glo-rollrow-label">vs</span> <span class="glo-rollrow-val">' + _esc(m.target) + '</span>';
        block.appendChild(rollRow);
      }

      if (m.risk) {
        var risk = document.createElement('div');
        risk.className = 'glo-maneuver-risk';
        risk.innerHTML = '<span class="glo-risk-label">Risk</span> ' + _esc(m.risk);
        block.appendChild(risk);
      }

      if (m.effect && m.effect.length) {
        var effectHead = document.createElement('div');
        effectHead.className = 'glo-sub-label';
        effectHead.textContent = 'Effect Tiers';
        block.appendChild(effectHead);

        var effectList = document.createElement('div');
        effectList.className = 'glo-effect-list';
        m.effect.forEach(function (eff) {
          var row = document.createElement('div');
          row.className = 'glo-effect-row';
          row.innerHTML =
            '<span class="glo-effect-tier glo-effect-tier--' + eff.tier + '">' + _esc(eff.label) + '</span>' +
            '<div class="glo-effect-body">' +
              '<span class="glo-effect-name">' + _esc(eff.name) + '</span>' +
              '<span class="glo-effect-desc">' + _esc(eff.description) + '</span>' +
              (eff.duration ? '<span class="glo-effect-duration">' + _esc(eff.duration) + '</span>' : '') +
            '</div>';
          effectList.appendChild(row);
        });
        block.appendChild(effectList);
      }

      if (m.gambits && m.gambits.length) {
        var gambitHead = document.createElement('div');
        gambitHead.className = 'glo-sub-label';
        gambitHead.textContent = 'Gambits';
        block.appendChild(gambitHead);

        var gambitList = document.createElement('div');
        gambitList.className = 'glo-gambit-list';
        m.gambits.forEach(function (g) {
          var row = document.createElement('div');
          row.className = 'glo-gambit-row';
          row.innerHTML =
            '<span class="glo-gambit-die">' + _esc(g.requiredDie) + '</span>' +
            '<div class="glo-gambit-body">' +
              '<span class="glo-gambit-name">' + _esc(g.name) + '</span>' +
              '<span class="glo-gambit-rule">' + _linkify(g.rule) + '</span>' +
            '</div>';
          gambitList.appendChild(row);
        });
        block.appendChild(gambitList);
      }

      section.appendChild(block);
    });
  }

  function _renderRichSections(sections) {
    var container = document.getElementById('hb-maneuvers-section');
    if (!container) return;
    container.innerHTML = '';
    sections.forEach(function (s) {
      var sec = document.createElement('div');
      sec.className = 'handbook-section';
      var label = document.createElement('div');
      label.className = 'handbook-section-label';
      label.textContent = s.heading;
      sec.appendChild(label);
      if (s.body) {
        var p = document.createElement('p');
        p.className = 'handbook-rich-body';
        p.textContent = s.body;
        sec.appendChild(p);
      }
      if (s.list && s.list.length) {
        var ul = document.createElement('ul');
        ul.className = 'handbook-rich-list';
        s.list.forEach(function (item) {
          var li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        });
        sec.appendChild(ul);
      }
      container.appendChild(sec);
    });
  }

  function _showEntry(id) {
    var entry = _entries[id];
    if (!entry) return;
    _activeEntryId = id;

    document.getElementById('handbook-empty').style.display = 'none';
    var entryEl = document.getElementById('handbook-entry');
    entryEl.style.display = '';

    document.getElementById('handbook-entry-name').textContent = entry.name || '';
    document.getElementById('handbook-entry-type').textContent = entry.type || '';
    document.getElementById('handbook-rule-text').innerHTML = _linkify(entry.rule || '');

    var guideSection = document.getElementById('hb-guide-section');
    if (guideSection) {
      guideSection.style.display = entry.guide ? '' : 'none';
      document.getElementById('handbook-guide-text').innerHTML = _linkify(entry.guide || '');
    }

    var manSection = document.getElementById('hb-maneuvers-section');
    if (manSection) manSection.innerHTML = '';

    if (entry.richSections && entry.richSections.length) {
      _renderRichSections(entry.richSections);
    }

    var isDisc = entry.type && entry.type.toLowerCase().indexOf('discipline') !== -1;
    if (isDisc) {
      _renderManeuvers(entry.id);
    }

    var activeBtn = document.querySelector('.hb-entry-btn.is-active');
    if (activeBtn) activeBtn.classList.remove('is-active');
    var newBtn = document.querySelector('.hb-entry-btn[data-entry-id="' + id + '"]');
    if (newBtn) newBtn.classList.add('is-active');

    var contentArea = document.getElementById('handbook-content');
    if (contentArea) contentArea.scrollTop = 0;
  }

  function _open(id) {
    if (!_dataReady) return;
    if (id && !_entries[id]) { console.warn('[Handbook] No entry for id:', id); return; }

    _panel.setAttribute('aria-hidden', 'false');
    _panel.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    _isOpen = true;

    if (id) {
      for (var i = 0; i < _providers.length; i++) {
        if (_providers[i].hasEntry(id)) {
          _expandedCategories[_providers[i].id] = true;
          break;
        }
      }
      _buildSidebarIndex();
      _showEntry(id);
    }
  }

  function _close() {
    if (!_isOpen) return;
    _panel.classList.remove('is-open');
    _panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    _isOpen = false;
  }

  function _onDocClick(e) {
    if (e.target.closest('#handbook-trigger')) {
      if (_isOpen) { _close(); } else { _open(); }
      return;
    }

    var trigger = e.target.closest('[data-glossary-id]');
    if (trigger) {
      var id = trigger.getAttribute('data-glossary-id');
      if (_entries[id]) {
        if (_isOpen && trigger.closest('#handbook-panel')) {
          _showEntry(id);
        } else {
          _open(id);
        }
        return;
      }
    }

    if (e.target.closest('#handbook-close-btn')) { _close(); return; }

    if (_isOpen && e.target.closest('.handbook-backdrop')) {
      _close();
    }
  }

  function _onKeyDown(e) {
    if (_isOpen && (e.key === 'Escape' || e.keyCode === 27)) { _close(); }
  }

  function _initDraggableTrigger(btn) {
    var STORAGE_KEY = 'handbook-trigger-pos';
    var dragging = false;
    var didDrag = false;
    var startX, startY, origLeft, origTop;

    function _applyPos(x, y) {
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      btn.style.transform = 'none';
      btn.style.left = Math.max(0, Math.min(window.innerWidth - 44, x)) + 'px';
      btn.style.top = Math.max(0, Math.min(window.innerHeight - 44, y)) + 'px';
    }

    function _savePos() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          left: btn.style.left, top: btn.style.top
        }));
      } catch (e) {}
    }

    function _loadPos() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var pos = JSON.parse(raw);
          btn.style.right = 'auto';
          btn.style.bottom = 'auto';
          btn.style.transform = 'none';
          btn.style.left = pos.left;
          btn.style.top = pos.top;
          var rect = btn.getBoundingClientRect();
          if (rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
            localStorage.removeItem(STORAGE_KEY);
            btn.style.left = '';
            btn.style.top = '';
            btn.style.right = '';
            btn.style.bottom = '';
            btn.style.transform = '';
          }
        }
      } catch (e) {}
    }

    function onPointerDown(e) {
      if (e.button && e.button !== 0) return;
      dragging = true;
      didDrag = false;
      var touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;
      var rect = btn.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      btn.style.transition = 'none';
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      var touch = e.touches ? e.touches[0] : e;
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (!didDrag && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      didDrag = true;
      _applyPos(origLeft + dx, origTop + dy);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      btn.style.transition = '';
      if (didDrag) {
        _savePos();
      }
    }

    btn.addEventListener('mousedown', onPointerDown);
    btn.addEventListener('touchstart', onPointerDown, { passive: false });
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);

    btn.addEventListener('click', function (e) {
      if (didDrag) {
        e.stopPropagation();
        e.preventDefault();
        didDrag = false;
        return;
      }
    }, true);

    _loadPos();

    window.addEventListener('resize', function () {
      var rect = btn.getBoundingClientRect();
      if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
        _applyPos(
          Math.min(rect.left, window.innerWidth - 44),
          Math.min(rect.top, window.innerHeight - 44)
        );
        _savePos();
      }
    });
  }

  function init() {
    _panel = _buildPanel();
    document.body.appendChild(_panel);

    var triggerBtn = _buildTriggerBtn();
    document.body.appendChild(triggerBtn);
    _initDraggableTrigger(triggerBtn);

    var searchInput = document.getElementById('handbook-search');
    searchInput.addEventListener('input', function () {
      _searchTerm = searchInput.value;
      _buildSidebarIndex();
    });

    _entries['destiny_pool'] = {
      id: 'destiny_pool',
      name: 'The Destiny Pool: Hope & Toll',
      type: 'System',
      rule: '2 tokens per player, any side up at campaign start. The ratio persists between sessions — it is a running ledger, not a mood ring.',
      guide: '',
      richSections: [
        { heading: 'The Karma State', body: 'The current ratio grants passive bonuses to social actions:', list: [
          'Hope dominant: +1 Tier on Charm/Persuasion vs. honorable or neutral contacts. Gap of 2+: \u22121 Tier on Intimidate/Deception (Soft Touch).',
          'Toll dominant: +1 Tier on Intimidate/Deception vs. the underworld. Gap of 2+: \u22121 Tier on Charm/Persuasion (The Monster).'
        ]},
        { heading: 'Tapping', body: 'Once per scene, after any roll, any player may tap one available token to increase the result by +1 Tier. Tapped tokens slide aside for the scene — they do not flip.' },
        { heading: 'The Lockout', list: [
          'Toll \u2192 Hope: Only possible if the token is untapped. Tap a dark token to survive — the guilt of that method is sealed. A sacrifice later cannot redeem it.',
          'Hope \u2192 Toll: Possible regardless of tap state. A dark deed taints the soul whether or not you were focused. A tapped Hope token that falls becomes a tapped Toll token immediately.'
        ]},
        { heading: 'Flipping', list: [
          'Hope \u2192 Toll (The Fall): An act of unmitigated cruelty — executing a prisoner, torture, abandoning innocents, betrayal for credits.',
          'Toll \u2192 Hope (Redemption): Accepting a severe, concrete disadvantage to stay clean — sparing a villain who will return, surrendering a major payday, deliberately failing an objective.'
        ]},
        { heading: 'The Crossroads', body: 'When a declared action would trigger The Fall, the GM pauses before it resolves. Any crewmate may intervene out-of-turn by tapping an available Hope token and making a Social Maneuver against the acting player. The acting player then chooses:', list: [
          'Relent \u2014 Stand down. The Hope token was spent and the threat walks free. The crew flips one Toll \u2192 Hope.',
          'Pull the Trigger \u2014 The plea is ignored. The Fall resolves. Flip one Hope \u2192 Toll. The intervening player\u2019s token stays tapped — they tried.'
        ]}
      ]
    };

    var glossaryReady = fetch('/data/glossary.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        data.forEach(function (entry) { _entries[entry.id] = entry; });
      });

    var maneuversReady = fetch('/data/maneuvers.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var gambits = data.disciplineGambits || {};
        Object.keys(gambits).forEach(function (key) {
          var set = gambits[key];
          if (!set || set.placeholder) return;
          var discId = set.disciplineId;
          if (!_maneuversByDisc[discId]) _maneuversByDisc[discId] = [];
          (set.gambits || []).forEach(function (g) {
            _maneuversByDisc[discId].push({
              name: g.name,
              actionType: 'Gambit',
              arenaTag: (g.tags || []).join(' '),
              roll: set.name + ' (' + (set.arenaId || '').charAt(0).toUpperCase() + (set.arenaId || '').slice(1) + ')',
              target: g.modifiesAction || '',
              effect: [],
              gambits: [g],
              disciplineRequirement: { disciplineId: discId, arenaId: set.arenaId, minDie: g.requiredDie },
            });
          });
        });
      });

    Promise.all([glossaryReady, maneuversReady]).then(function () {
      _dataReady = true;
      _registerProviders();
      _expandedCategories = {};
      _providers.forEach(function (p) { _expandedCategories[p.id] = true; });
      _buildSidebarIndex();
    }).catch(function (err) {
      console.error('[Handbook]', err);
    });

    document.addEventListener('click', _onDocClick);
    document.addEventListener('keydown', _onKeyDown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.GlossaryOverlay = { open: _open, close: _close };
}());

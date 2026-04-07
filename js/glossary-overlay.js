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
  var _chassisData = {};
  var _actionEntryIds = {};
  var _coreRuleEntryIds = {};
  var _vocationEntryIds = {};
  var _speciesEntryIds = {};
  var _equipmentEntryIds = {};

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
    'marked': 'condition_marked', 'locked on': 'condition_locked_on',
    'slowed': 'condition_slowed', 'elusive': 'condition_elusive',
    'jammed': 'condition_jammed',
    'stimmed': 'stimmed', 'natural recovery': 'natural_recovery',
    'attack': 'action_attack', 'aim': 'action_aim', 'move': 'action_move',
    'reload': 'action_reload', 'take cover': 'action_take_cover',
    'overwatch': 'action_overwatch', 'draw / holster': 'action_draw_holster',
    'assess': 'action_assess', 'treat injury': 'action_treat_injury',
    'interact': 'action_interact', 'join battle': 'action_join_battle',
    'dodge': 'action_dodge', 'endure': 'action_endure', 'resist': 'action_resist',
    'coordinate': 'action_coordinate', 'command beast': 'action_command_beast',
    'centering focus': 'force_centering_focus', 'force sense': 'force_sense',
    'telekinesis': 'force_telekinesis',
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

  var ACTION_GROUP_ORDER = ['Action', 'Maneuver', 'Defense', 'Free'];
  var ACTION_GROUP_LABELS = {
    'Action': 'Actions', 'Maneuver': 'Maneuvers', 'Defense': 'Defenses',
    'Free': 'Free'
  };

  var CORE_RULE_ORDER = ['destiny_pool', 'modes_of_play', 'opening_exploit_defense', 'dual_wielding', 'concealment'];

  function _registerProviders() {
    _providers = [];

    _providers.push({
      id: 'actions',
      label: 'Actions',
      icon: '\u2604',
      getGroups: function () {
        var grouped = {};
        ACTION_GROUP_ORDER.forEach(function (g) { grouped[g] = []; });
        Object.keys(_actionEntryIds).forEach(function (eid) {
          var e = _entries[eid];
          if (!e) return;
          var grp = e._actionGroup || 'Action';
          if (!grouped[grp]) grouped[grp] = [];
          grouped[grp].push({ id: e.id, name: e.name });
        });
        var groups = [];
        ACTION_GROUP_ORDER.forEach(function (g) {
          if (grouped[g] && grouped[g].length) {
            groups.push({ groupLabel: ACTION_GROUP_LABELS[g] || g, entries: grouped[g] });
          }
        });
        return groups;
      },
      hasEntry: function (id) { return !!_actionEntryIds[id]; }
    });

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
      id: 'coreRules',
      label: 'Core Rules',
      icon: '\u2699',
      getGroups: function () {
        var items = [];
        CORE_RULE_ORDER.forEach(function (rid) {
          var e = _entries[rid];
          if (e) items.push({ id: e.id, name: e.name });
        });
        return items.length ? [{ groupLabel: null, entries: items }] : [];
      },
      hasEntry: function (id) { return !!_coreRuleEntryIds[id]; }
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
        return groups;
      },
      hasEntry: function (id) {
        var e = _entries[id];
        if (!e) return false;
        return e.type === 'Condition' || e.type === 'Condition (Combined)' || e.type === 'Condition (Stacking)';
      }
    });

    _providers.push({
      id: 'rules',
      label: 'Rules',
      icon: '\uD83D\uDCDC',
      getGroups: function () {
        var rules = [];
        Object.keys(_entries).forEach(function (eid) {
          var e = _entries[eid];
          if (e.type === 'Rule') {
            rules.push({ id: e.id, name: e.name });
          }
        });
        rules.sort(function (a, b) { return a.name.localeCompare(b.name); });
        return rules.length ? [{ groupLabel: null, entries: rules }] : [];
      },
      hasEntry: function (id) {
        var e = _entries[id];
        return e && e.type === 'Rule';
      }
    });

    _providers.push({
      id: 'vocations',
      label: 'Vocations',
      icon: '\u269C',
      getGroups: function () {
        var items = [];
        Object.keys(_vocationEntryIds).forEach(function (eid) {
          var e = _entries[eid];
          if (e) items.push({ id: e.id, name: e.name });
        });
        items.sort(function (a, b) { return a.name.localeCompare(b.name); });
        return items.length ? [{ groupLabel: null, entries: items }] : [];
      },
      hasEntry: function (id) { return !!_vocationEntryIds[id]; }
    });

    _providers.push({
      id: 'species',
      label: 'Species',
      icon: '\uD83C\uDF0D',
      getGroups: function () {
        var items = [];
        Object.keys(_speciesEntryIds).forEach(function (eid) {
          var e = _entries[eid];
          if (e) items.push({ id: e.id, name: e.name });
        });
        items.sort(function (a, b) { return a.name.localeCompare(b.name); });
        return items.length ? [{ groupLabel: null, entries: items }] : [];
      },
      hasEntry: function (id) { return !!_speciesEntryIds[id]; }
    });

    _providers.push({
      id: 'equipment',
      label: 'Equipment',
      icon: '\uD83D\uDEE1',
      getGroups: function () {
        var weapons = [], armor = [], gear = [];
        Object.keys(_equipmentEntryIds).forEach(function (eid) {
          var e = _entries[eid];
          if (!e) return;
          if (e._equipCategory === 'weapon') weapons.push({ id: e.id, name: e.name });
          else if (e._equipCategory === 'armor') armor.push({ id: e.id, name: e.name });
          else gear.push({ id: e.id, name: e.name });
        });
        weapons.sort(function (a, b) { return a.name.localeCompare(b.name); });
        armor.sort(function (a, b) { return a.name.localeCompare(b.name); });
        gear.sort(function (a, b) { return a.name.localeCompare(b.name); });
        var groups = [];
        if (gear.length) groups.push({ groupLabel: 'Gear', entries: gear });
        if (weapons.length) groups.push({ groupLabel: 'Weapons', entries: weapons });
        if (armor.length) groups.push({ groupLabel: 'Armor', entries: armor });
        return groups;
      },
      hasEntry: function (id) { return !!_equipmentEntryIds[id]; }
    });
  }

  var _activeTab = 'handbook';
  var _journalEntries = [];
  var _journalTags = [];
  var _journalFilterTag = null;
  var _journalFormMode = null;
  var _journalEditId = null;
  var _journalFormTagIds = [];
  var _journalTagSearch = '';
  var _characterName = '';
  var _journalAdventures = [];
  var _journalCompletions = {};
  var _journalNav = { level: 'list', actNum: null, advId: null, sceneId: null };
  var _journalExpandedEntry = null;

  function _detectCharacterName() {
    var el = document.querySelector('.char-name');
    if (el && el.textContent) _characterName = el.textContent.trim();
    if (!_characterName) {
      try {
        var stored = sessionStorage.getItem('eote-character-name');
        if (stored) _characterName = stored;
      } catch (e) {}
    }
  }

  var PANEL_GEO_KEY = 'handbook-panel-geo';

  function _savePanelGeo() {
    if (!_panel) return;
    try {
      localStorage.setItem(PANEL_GEO_KEY, JSON.stringify({
        left: _panel.style.left,
        top: _panel.style.top,
        width: _panel.style.width,
        height: _panel.style.height
      }));
    } catch (e) {}
  }

  function _loadPanelGeo() {
    try {
      var raw = localStorage.getItem(PANEL_GEO_KEY);
      if (raw) {
        var geo = JSON.parse(raw);
        if (geo.left) _panel.style.left = geo.left;
        if (geo.top) _panel.style.top = geo.top;
        if (geo.width) _panel.style.width = geo.width;
        if (geo.height) _panel.style.height = geo.height;
        if (geo.left) _panel.style.transform = 'none';
      }
    } catch (e) {}
  }

  function _initPanelDrag() {
    var titlebar = _panel.querySelector('.handbook-titlebar');
    if (!titlebar) return;
    var dragging = false;
    var startX, startY, origLeft, origTop;

    titlebar.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true;
      var rect = _panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      _panel.style.transform = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      _panel.style.left = Math.max(0, origLeft + dx) + 'px';
      _panel.style.top = Math.max(0, origTop + dy) + 'px';
    });
    document.addEventListener('mouseup', function () {
      if (dragging) { dragging = false; _savePanelGeo(); }
    });

    var ro = new ResizeObserver(function () { _savePanelGeo(); });
    ro.observe(_panel);
  }

  function _buildPanel() {
    var el = document.createElement('div');
    el.id = 'handbook-panel';
    el.className = 'handbook-panel';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', "Player's Handbook");
    el.innerHTML =
      '<div class="handbook-titlebar">' +
        '<span class="handbook-titlebar-label">Player\'s Handbook</span>' +
        '<button class="handbook-close-btn" id="handbook-close-btn" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="handbook-tab-bar">' +
        '<button class="handbook-tab-btn is-active" data-hb-tab="handbook">Handbook</button>' +
        '<button class="handbook-tab-btn" data-hb-tab="journal">Journal</button>' +
        '<button class="handbook-tab-btn" data-hb-tab="dramatis">Dramatis Personae</button>' +
      '</div>' +
      '<div class="handbook-tab-content is-active" data-hb-tab-content="handbook">' +
        '<div class="handbook-sidebar">' +
          '<div class="handbook-sidebar-header">' +
            '<span class="handbook-title">Index</span>' +
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
      '</div>' +
      '<div class="handbook-tab-content" data-hb-tab-content="journal">' +
        '<div class="journal-tab-wrap" id="journal-tab-wrap"></div>' +
      '</div>' +
      '<div class="handbook-tab-content" data-hb-tab-content="dramatis">' +
        '<div class="dramatis-tab-wrap" id="dramatis-tab-wrap">' +
          '<div class="dp-player-empty">Loading dossiers\u2026</div>' +
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
    btn.innerHTML = '<img src="/images/fulcrum-logo.png" alt="Fulcrum" width="50" height="50" style="pointer-events:none;">';
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
            if (entry && entry._searchText && entry._searchText.indexOf(term) !== -1) return true;
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
        p.innerHTML = _linkify(s.body);
        sec.appendChild(p);
      }
      if (s.list && s.list.length) {
        var ul = document.createElement('ul');
        ul.className = 'handbook-rich-list';
        s.list.forEach(function (item) {
          var li = document.createElement('li');
          li.innerHTML = _linkify(item);
          ul.appendChild(li);
        });
        sec.appendChild(ul);
      }
      container.appendChild(sec);
    });
  }

  var NARRATIVE_TIER_ORDER = [
    { key: 'fleeting',      label: 'Fleeting',       range: '0\u20133',   tier: 1 },
    { key: 'masterful',     label: 'Masterful',      range: '4\u20137',   tier: 2 },
    { key: 'legendary',     label: 'Legendary',      range: '8\u201311',  tier: 3 },
    { key: 'unleashedI',    label: 'Unleashed I',    range: '12\u201315', tier: 4 },
    { key: 'unleashedII',   label: 'Unleashed II',   range: '16\u201319', tier: 5 },
    { key: 'unleashedIII',  label: 'Unleashed III',  range: '20+',        tier: 6 }
  ];

  function _renderNarrativeTiers(tiers) {
    var container = document.getElementById('hb-maneuvers-section');
    if (!container) return;

    var section = document.createElement('div');
    section.className = 'handbook-section hb-narrative-tiers-section';

    var heading = document.createElement('div');
    heading.className = 'handbook-section-label hb-narrative-heading';
    heading.textContent = 'Narrative Results';
    section.appendChild(heading);

    var list = document.createElement('div');
    list.className = 'hb-narrative-tier-list';

    NARRATIVE_TIER_ORDER.forEach(function (def) {
      var text = tiers[def.key];
      if (!text) return;

      var isUnleashed = def.tier >= 4;

      var row = document.createElement('div');
      row.className = 'hb-narrative-row' + (isUnleashed ? ' hb-narrative-row--unleashed' : '');

      var badge = document.createElement('span');
      badge.className = 'hb-narrative-badge hb-narrative-badge--t' + def.tier;
      badge.textContent = def.label;
      row.appendChild(badge);

      var range = document.createElement('span');
      range.className = 'hb-narrative-range';
      range.textContent = def.range;
      row.appendChild(range);

      var desc = document.createElement('span');
      desc.className = 'hb-narrative-desc';
      desc.innerHTML = _linkify(text);
      row.appendChild(desc);

      list.appendChild(row);
    });

    section.appendChild(list);
    container.appendChild(section);
  }

  function _renderEffectTiers(container, effects) {
    if (!effects || !effects.length) return;
    var effectHead = document.createElement('div');
    effectHead.className = 'glo-sub-label';
    effectHead.textContent = 'Effect Tiers';
    container.appendChild(effectHead);

    var effectList = document.createElement('div');
    effectList.className = 'glo-effect-list';
    effects.forEach(function (eff) {
      var t = eff.tier || 1;
      if (t > 3) t = 3;
      var row = document.createElement('div');
      row.className = 'glo-effect-row';
      row.innerHTML =
        '<span class="glo-effect-tier glo-effect-tier--' + t + '">' + _esc(eff.label || ('Tier ' + eff.tier)) + '</span>' +
        '<div class="glo-effect-body">' +
          (eff.range ? '<span class="glo-effect-name">' + _esc(eff.range) + '</span>' : '') +
          '<span class="glo-effect-desc">' + _linkify(eff.description || '') + '</span>' +
        '</div>';
      effectList.appendChild(row);
    });
    container.appendChild(effectList);
  }

  function _renderGambitList(container, gambits) {
    if (!gambits || !gambits.length) return;
    var gambitHead = document.createElement('div');
    gambitHead.className = 'glo-sub-label';
    gambitHead.textContent = 'Gambits';
    container.appendChild(gambitHead);

    var gambitList = document.createElement('div');
    gambitList.className = 'glo-gambit-list';
    gambits.forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'glo-gambit-row';
      row.innerHTML =
        '<span class="glo-gambit-die">\u2726</span>' +
        '<div class="glo-gambit-body">' +
          '<span class="glo-gambit-name">' + _esc(g.name) + '</span>' +
          '<span class="glo-gambit-rule">' + _linkify(g.rule) + '</span>' +
        '</div>';
      gambitList.appendChild(row);
    });
    container.appendChild(gambitList);
  }

  function _renderTraitList(container, traits) {
    if (!traits || !traits.length) return;
    var traitHead = document.createElement('div');
    traitHead.className = 'glo-sub-label';
    traitHead.textContent = 'Traits';
    container.appendChild(traitHead);

    traits.forEach(function (t) {
      var block = document.createElement('div');
      block.className = 'hb-trait-block';
      block.innerHTML =
        '<span class="hb-trait-name">' + _esc(t.name) + '</span>' +
        '<span class="hb-trait-desc">' + _linkify(t.description) + '</span>';
      container.appendChild(block);
    });
  }

  function _renderActionDetail(entry) {
    var container = document.getElementById('hb-maneuvers-section');
    if (!container) return;
    var d = entry._actionData;
    if (!d) return;

    var meta = document.createElement('div');
    meta.className = 'hb-action-meta';
    var pipClass = 'hb-pip hb-pip--' + (d.pip || 'A').toLowerCase().replace(/\s+/g, '');
    meta.innerHTML = '<span class="' + pipClass + '">' + _esc(d.pip || 'A') + '</span>';
    if (d.tags) {
      d.tags.forEach(function (t) {
        meta.innerHTML += '<span class="glo-tag glo-tag--action">' + _esc(t) + '</span>';
      });
    }
    if (d.discipline) {
      var discLabel = (d.discipline || '').replace(/_/g, ' ').replace(/\bspark\b/, '').trim();
      discLabel = discLabel.charAt(0).toUpperCase() + discLabel.slice(1);
      var arLabel = (d.arena || '').charAt(0).toUpperCase() + (d.arena || '').slice(1);
      meta.innerHTML += '<span class="glo-tag glo-tag--arena">' + _esc(discLabel + ' (' + arLabel + ')') + '</span>';
    }
    container.appendChild(meta);

    if (d.risk) {
      var risk = document.createElement('div');
      risk.className = 'glo-maneuver-risk';
      risk.innerHTML = '<span class="glo-risk-label">Risk</span> ' + _linkify(d.risk);
      container.appendChild(risk);
    }

    if (d.note) {
      var note = document.createElement('div');
      note.className = 'hb-action-note';
      note.textContent = d.note;
      container.appendChild(note);
    }

    _renderEffectTiers(container, d.effect);
  }

  function _renderVocationDetail(entry) {
    var container = document.getElementById('hb-maneuvers-section');
    if (!container) return;
    var k = entry._kitData;
    if (!k) return;

    if (k.fluff) {
      var fluff = document.createElement('div');
      fluff.className = 'hb-voc-fluff';
      fluff.textContent = k.fluff;
      container.appendChild(fluff);
    }

    var meta = document.createElement('div');
    meta.className = 'hb-voc-meta';
    var arenaLabel = ARENA_LABELS[k.governingArena] || k.governingArena;
    meta.innerHTML =
      '<span class="glo-tag glo-tag--arena">' + _esc(arenaLabel) + '</span>' +
      '<span class="glo-tag glo-tag--action">' + _esc((k.favoredDiscipline || '').replace(/_/g, ' ').replace(/\bspark\b/, '').trim()) + '</span>';
    container.appendChild(meta);

    if (k.abilities && k.abilities.length) {
      var treeHead = document.createElement('div');
      treeHead.className = 'handbook-section-label';
      treeHead.textContent = 'Ability Tree';
      container.appendChild(treeHead);

      k.abilities.forEach(function (ab) {
        var card = document.createElement('div');
        card.className = 'hb-ability-card';

        var hdr = document.createElement('div');
        hdr.className = 'hb-ability-header';

        var tierBadge = document.createElement('span');
        tierBadge.className = 'hb-ability-tier hb-ability-tier--' + ab.tier;
        tierBadge.textContent = 'T' + ab.tier;
        hdr.appendChild(tierBadge);

        var typeBadge = document.createElement('span');
        typeBadge.className = 'hb-ability-type hb-ability-type--' + (ab.type || 'passive');
        typeBadge.textContent = (ab.type || 'passive').charAt(0).toUpperCase() + (ab.type || 'passive').slice(1);
        hdr.appendChild(typeBadge);

        var abName = document.createElement('span');
        abName.className = 'hb-ability-name';
        abName.textContent = ab.name;
        hdr.appendChild(abName);

        if (ab.tags && ab.tags.length) {
          ab.tags.forEach(function (t) {
            var tag = document.createElement('span');
            tag.className = 'glo-tag glo-tag--action';
            tag.textContent = t;
            hdr.appendChild(tag);
          });
        }

        card.appendChild(hdr);

        if (ab.discipline || ab.defense) {
          var rollRow = document.createElement('div');
          rollRow.className = 'glo-maneuver-rollrow';
          if (ab.discipline) {
            var dLabel = (ab.discipline || '').replace(/_/g, ' ').replace(/\bspark\b/, '').trim();
            dLabel = dLabel.charAt(0).toUpperCase() + dLabel.slice(1);
            var aLabel = (ab.arena || '').charAt(0).toUpperCase() + (ab.arena || '').slice(1);
            rollRow.innerHTML += '<span class="glo-rollrow-label">Roll</span> <span class="glo-rollrow-val">' + _esc(dLabel + ' (' + aLabel + ')') + '</span>';
          }
          if (ab.defense) {
            var defLabel = (ab.defense || '').charAt(0).toUpperCase() + (ab.defense || '').slice(1);
            rollRow.innerHTML += '<span class="glo-rollrow-sep">\u2022</span><span class="glo-rollrow-label">vs</span> <span class="glo-rollrow-val">' + _esc(defLabel) + '</span>';
          }
          card.appendChild(rollRow);
        }

        var ruleDiv = document.createElement('div');
        ruleDiv.className = 'hb-ability-rule';
        ruleDiv.innerHTML = _linkify(ab.rule || '');
        card.appendChild(ruleDiv);

        if (ab.risk) {
          var riskDiv = document.createElement('div');
          riskDiv.className = 'glo-maneuver-risk';
          riskDiv.innerHTML = '<span class="glo-risk-label">Risk</span> ' + _linkify(ab.risk);
          card.appendChild(riskDiv);
        }

        _renderEffectTiers(card, ab.effect);
        _renderGambitList(card, ab.gambits);

        container.appendChild(card);
      });
    }
  }

  function _renderSpeciesDetail(entry) {
    var container = document.getElementById('hb-maneuvers-section');
    if (!container) return;
    var sp = entry._speciesData;
    if (!sp) return;

    if (sp.arenas) {
      var arenaSection = document.createElement('div');
      arenaSection.className = 'hb-species-arenas';
      ARENA_ORDER.forEach(function (a) {
        var dieVal = sp.arenas[a] || 'D6';
        var badge = document.createElement('span');
        badge.className = 'hb-arena-die';
        badge.innerHTML = '<span class="hb-arena-die-label">' + _esc(ARENA_LABELS[a] || a) + '</span><span class="hb-arena-die-val">' + _esc(dieVal) + '</span>';
        arenaSection.appendChild(badge);
      });
      container.appendChild(arenaSection);
    }

    if (sp.arenaShift) {
      var shiftSec = document.createElement('div');
      shiftSec.className = 'hb-species-block';
      shiftSec.innerHTML =
        '<div class="handbook-section-label">' + _esc(sp.arenaShift.name) + '</div>' +
        '<p class="handbook-rich-body">' + _linkify(sp.arenaShift.desc) + '</p>';
      container.appendChild(shiftSec);
    }

    if (sp.favoredDiscipline) {
      var favSec = document.createElement('div');
      favSec.className = 'hb-species-block';
      var favHtml = '<div class="handbook-section-label">Favored Discipline</div>' +
        '<p class="handbook-rich-body">' + _esc(sp.favoredDiscipline.desc) + '</p>';
      if (sp.favoredDiscipline.choices && sp.favoredDiscipline.choices.length) {
        favHtml += '<div class="hb-species-choices">';
        sp.favoredDiscipline.choices.forEach(function (c) {
          favHtml += '<span class="glo-tag glo-tag--action">' + _esc(c.label) + '</span>';
        });
        favHtml += '</div>';
      }
      favSec.innerHTML = favHtml;
      container.appendChild(favSec);
    }

    if (sp.biologicalTruth) {
      var bioSec = document.createElement('div');
      bioSec.className = 'hb-species-block';
      bioSec.innerHTML =
        '<div class="handbook-section-label">' + _esc(sp.biologicalTruth.name) + '</div>' +
        '<p class="handbook-rich-body">' + _linkify(sp.biologicalTruth.desc) + '</p>';
      container.appendChild(bioSec);
    }

    if (sp.speciesTrait) {
      var traitSec = document.createElement('div');
      traitSec.className = 'hb-species-block';
      traitSec.innerHTML =
        '<div class="handbook-section-label">' + _esc(sp.speciesTrait.name) + '</div>' +
        '<p class="handbook-rich-body">' + _linkify(sp.speciesTrait.desc) + '</p>';
      container.appendChild(traitSec);
    }
  }

  function _renderEquipmentDetail(entry) {
    var container = document.getElementById('hb-maneuvers-section');
    if (!container) return;
    var eq = entry._equipData;
    if (!eq) return;

    var meta = document.createElement('div');
    meta.className = 'hb-equip-meta';
    if (eq.cost !== undefined) meta.innerHTML += '<span class="hb-equip-stat"><b>Cost</b> ' + _esc(eq.cost) + ' cr</span>';
    if (eq.availability) meta.innerHTML += '<span class="hb-equip-stat"><b>Avail</b> ' + _esc(eq.availability) + '</span>';
    if (eq.chassisLabel) meta.innerHTML += '<span class="hb-equip-stat"><b>Chassis</b> ' + _esc(eq.chassisLabel) + '</span>';
    if (eq.stunSetting !== undefined) meta.innerHTML += '<span class="hb-equip-stat"><b>Stun</b> ' + (eq.stunSetting ? 'Yes' : 'No') + '</span>';
    container.appendChild(meta);

    if (eq.discipline) {
      var discRow = document.createElement('div');
      discRow.className = 'hb-equip-meta';
      var dl = (eq.discipline || '').replace(/_/g, ' ').replace(/\bspark\b/, '').trim();
      dl = dl.charAt(0).toUpperCase() + dl.slice(1);
      var al = (eq.arena || '').charAt(0).toUpperCase() + (eq.arena || '').slice(1);
      discRow.innerHTML = '<span class="glo-tag glo-tag--arena">' + _esc(dl + ' (' + al + ')') + '</span>';

      if (eq.range) {
        var rangeStr = '';
        if (Array.isArray(eq.range)) {
          rangeStr = eq.range.join(' / ') + ' zones';
        } else if (eq.range.engaged) {
          rangeStr = 'Engaged only';
        }
        if (rangeStr) discRow.innerHTML += '<span class="hb-equip-stat"><b>Range</b> ' + _esc(rangeStr) + '</span>';
      }
      container.appendChild(discRow);
    }

    var chassis = _chassisData[eq.chassisId];
    var dmgTiers = eq.customDamage || (chassis ? chassis.tiers : null);
    if (dmgTiers) {
      var dmgHead = document.createElement('div');
      dmgHead.className = 'glo-sub-label';
      dmgHead.textContent = 'Damage Track';
      container.appendChild(dmgHead);

      var dmgList = document.createElement('div');
      dmgList.className = 'glo-effect-list';

      if (Array.isArray(dmgTiers) && typeof dmgTiers[0] === 'number') {
        var tierLabels = ['Fleeting', 'Masterful', 'Legendary'];
        var tierRanges = ['0\u20133', '4\u20137', '8+'];
        dmgTiers.forEach(function (dmg, i) {
          var t = i + 1;
          var row = document.createElement('div');
          row.className = 'glo-effect-row';
          row.innerHTML =
            '<span class="glo-effect-tier glo-effect-tier--' + t + '">' + _esc(tierLabels[i] || 'T' + t) + '</span>' +
            '<div class="glo-effect-body">' +
              '<span class="glo-effect-name">' + _esc(tierRanges[i] || '') + '</span>' +
              '<span class="glo-effect-desc">' + dmg + ' damage</span>' +
            '</div>';
          dmgList.appendChild(row);
        });
      } else if (Array.isArray(dmgTiers)) {
        dmgTiers.forEach(function (t, i) {
          var tierNum = Math.min(i + 1, 3);
          var row = document.createElement('div');
          row.className = 'glo-effect-row';
          row.innerHTML =
            '<span class="glo-effect-tier glo-effect-tier--' + tierNum + '">' + _esc(t.label || 'T' + tierNum) + '</span>' +
            '<div class="glo-effect-body">' +
              '<span class="glo-effect-name">' + _esc(t.range || '') + '</span>' +
              '<span class="glo-effect-desc">' + _esc(t.damage + ' dmg' + (t.stunDamage ? ' / ' + t.stunDamage + ' stun' : '')) + '</span>' +
            '</div>';
          dmgList.appendChild(row);
        });
      }
      container.appendChild(dmgList);
    }

    if (eq.weaponProfile) {
      var wp = eq.weaponProfile;
      var wpMeta = document.createElement('div');
      wpMeta.className = 'hb-equip-meta';
      var wdl = (wp.discipline || '').replace(/_/g, ' ').trim();
      wdl = wdl.charAt(0).toUpperCase() + wdl.slice(1);
      var wal = (wp.arena || '').charAt(0).toUpperCase() + (wp.arena || '').slice(1);
      wpMeta.innerHTML = '<span class="glo-tag glo-tag--arena">' + _esc(wdl + ' (' + wal + ')') + '</span>';
      if (wp.defense) wpMeta.innerHTML += '<span class="hb-equip-stat"><b>vs</b> ' + _esc(wp.defense.charAt(0).toUpperCase() + wp.defense.slice(1)) + '</span>';
      if (wp.range) wpMeta.innerHTML += '<span class="hb-equip-stat"><b>Range</b> ' + _esc(wp.range.join(' / ')) + '</span>';
      container.appendChild(wpMeta);

      if (wp.customDamage) {
        var wpDmgHead = document.createElement('div');
        wpDmgHead.className = 'glo-sub-label';
        wpDmgHead.textContent = 'Damage Track';
        container.appendChild(wpDmgHead);
        var wpDmgList = document.createElement('div');
        wpDmgList.className = 'glo-effect-list';
        var wpLabels = ['Fleeting', 'Masterful', 'Legendary'];
        var wpRanges = ['0\u20133', '4\u20137', '8+'];
        wp.customDamage.forEach(function (dmg, i) {
          var t = i + 1;
          var row = document.createElement('div');
          row.className = 'glo-effect-row';
          row.innerHTML =
            '<span class="glo-effect-tier glo-effect-tier--' + t + '">' + _esc(wpLabels[i]) + '</span>' +
            '<div class="glo-effect-body"><span class="glo-effect-name">' + _esc(wpRanges[i]) + '</span><span class="glo-effect-desc">' + dmg + ' damage</span></div>';
          wpDmgList.appendChild(row);
        });
        container.appendChild(wpDmgList);
      }
    }

    if (eq.customEffectRows && eq.customEffectRows.length) {
      var ceHead = document.createElement('div');
      ceHead.className = 'glo-sub-label';
      ceHead.textContent = 'Effect Tiers';
      container.appendChild(ceHead);
      var ceList = document.createElement('div');
      ceList.className = 'glo-effect-list';
      var ceLabels = ['Fleeting', 'Masterful', 'Legendary'];
      eq.customEffectRows.forEach(function (desc, i) {
        var t = Math.min(i + 1, 3);
        var row = document.createElement('div');
        row.className = 'glo-effect-row';
        row.innerHTML =
          '<span class="glo-effect-tier glo-effect-tier--' + t + '">' + _esc(ceLabels[i] || 'T' + t) + '</span>' +
          '<div class="glo-effect-body"><span class="glo-effect-desc">' + _linkify(desc) + '</span></div>';
        ceList.appendChild(row);
      });
      container.appendChild(ceList);
    }

    if (eq.trait) {
      _renderTraitList(container, [eq.trait]);
    }
    if (eq.traits && eq.traits.length) {
      _renderTraitList(container, eq.traits);
    }
    _renderGambitList(container, eq.gambits);

    if (eq.tags && eq.tags.length) {
      var tagRow = document.createElement('div');
      tagRow.className = 'hb-equip-tags';
      eq.tags.forEach(function (t) {
        tagRow.innerHTML += '<span class="glo-tag">' + _esc(t) + '</span>';
      });
      container.appendChild(tagRow);
    }
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

    var ruleSection = document.getElementById('hb-rule-section');
    if (ruleSection) {
      var hasRule = entry.rule && entry.rule.trim();
      ruleSection.style.display = hasRule ? '' : 'none';
      document.getElementById('handbook-rule-text').innerHTML = hasRule ? _linkify(entry.rule) : '';
    }

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
      if (entry.narrativeTiers) {
        _renderNarrativeTiers(entry.narrativeTiers);
      }
    }

    if (entry._providerType === 'action') {
      _renderActionDetail(entry);
    } else if (entry._providerType === 'vocation') {
      _renderVocationDetail(entry);
    } else if (entry._providerType === 'species') {
      _renderSpeciesDetail(entry);
    } else if (entry._providerType === 'equipment') {
      _renderEquipmentDetail(entry);
    }

    var activeBtn = document.querySelector('.hb-entry-btn.is-active');
    if (activeBtn) activeBtn.classList.remove('is-active');
    var newBtn = document.querySelector('.hb-entry-btn[data-entry-id="' + id + '"]');
    if (newBtn) newBtn.classList.add('is-active');

    var contentArea = document.getElementById('handbook-content');
    if (contentArea) contentArea.scrollTop = 0;
  }

  function _tagCategoryClass(cat) {
    var safe = /^(npc|location|lore|item|custom)$/.test(cat) ? cat : 'custom';
    return 'journal-tag-chip--' + safe;
  }

  function _formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return mon[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function _getTagCategory(tagName) {
    for (var i = 0; i < _journalTags.length; i++) {
      if (_journalTags[i].name === tagName) return _journalTags[i].category;
    }
    return 'custom';
  }

  function _bindJournalFormEvents() {
    var form = document.getElementById('journal-form');
    if (!form) return;

    var saveBtn = document.getElementById('journal-form-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var title = document.getElementById('journal-form-title').value.trim();
        var body = document.getElementById('journal-form-body').value;
        if (!title) return;

        _detectCharacterName();
        var authorName = _characterName || 'Unknown';

        var url, method;
        if (_journalFormMode === 'edit') {
          url = '/api/journal/entries/' + _journalEditId;
          method = 'PUT';
        } else {
          url = '/api/journal/entries';
          method = 'POST';
        }

        var payload = { title: title, body: body, author_character_name: authorName, tag_ids: _journalFormTagIds };
        if (_journalFormMode === 'create' && _journalNav.sceneId) {
          payload.source_scene_id = _journalNav.sceneId;
        }
        fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) { if (!r.ok) throw new Error('Server error ' + r.status); return r.json(); }).then(function () {
          _journalFormMode = null;
          _journalEditId = null;
          _journalFormTagIds = [];
          if (_journalNav.level === 'scene-detail') {
            _loadSceneEntries();
          } else {
            _loadJournalData();
          }
        }).catch(function (err) { console.error('[Journal] Save failed:', err); });
      });
    }

    var cancelBtn = document.getElementById('journal-form-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        _journalFormMode = null;
        _journalEditId = null;
        _journalFormTagIds = [];
        _renderJournal();
      });
    }

    var deleteBtn = document.getElementById('journal-form-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!confirm('Delete this journal entry?')) return;
        fetch('/api/journal/entries/' + _journalEditId, { method: 'DELETE' })
          .then(function (r) { if (!r.ok) throw new Error('Server error ' + r.status); return r.json(); })
          .then(function () {
            _journalFormMode = null;
            _journalEditId = null;
            _journalFormTagIds = [];
            _loadJournalData();
          }).catch(function (err) { console.error('[Journal] Delete failed:', err); });
      });
    }

    var tagSearch = document.getElementById('journal-tag-search');
    if (tagSearch) {
      tagSearch.addEventListener('input', function () {
        _journalTagSearch = tagSearch.value;
        _renderJournal();
        var newSearch = document.getElementById('journal-tag-search');
        if (newSearch) { newSearch.focus(); newSearch.selectionStart = newSearch.selectionEnd = newSearch.value.length; }
      });
    }

    form.querySelectorAll('[data-journal-form-add-tag]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var tagId = parseInt(chip.getAttribute('data-journal-form-add-tag'), 10);
        if (_journalFormTagIds.indexOf(tagId) === -1) _journalFormTagIds.push(tagId);
        _renderJournal();
      });
    });

    form.querySelectorAll('[data-journal-form-remove-tag]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        var tagId = parseInt(chip.getAttribute('data-journal-form-remove-tag'), 10);
        _journalFormTagIds = _journalFormTagIds.filter(function (id) { return id !== tagId; });
        _renderJournal();
      });
    });

    form.querySelectorAll('[data-journal-form-create-tag]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var tagName = chip.getAttribute('data-journal-form-create-tag');
        fetch('/api/journal/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName, category: 'custom' })
        }).then(function (r) { if (!r.ok) throw new Error('Server error ' + r.status); return r.json(); }).then(function (data) {
          if (data.tag) {
            _journalTags.push(data.tag);
            _journalFormTagIds.push(data.tag.id);
            _journalTagSearch = '';
            _renderJournal();
          }
        }).catch(function (err) { console.error('[Journal] Create tag failed:', err); });
      });
    });
  }

  function _renderJournalForm() {
    var entry = null;
    if (_journalFormMode === 'edit') {
      entry = _journalEntries.find(function (e) { return e.id === _journalEditId; });
    }

    var html = '<div class="journal-form" id="journal-form">';
    html += '<div class="journal-form-title">' + (_journalFormMode === 'edit' ? 'Edit Entry' : 'New Entry') + '</div>';

    html += '<div class="journal-form-row">';
    html += '<label class="journal-form-label">Title</label>';
    html += '<input class="journal-form-input" id="journal-form-title" type="text" value="' + _esc(entry ? entry.title : '') + '" placeholder="Entry title..." />';
    html += '</div>';

    html += '<div class="journal-form-row">';
    html += '<label class="journal-form-label">Body</label>';
    html += '<textarea class="journal-form-textarea" id="journal-form-body" placeholder="Write your notes...">' + _esc(entry ? entry.body : '') + '</textarea>';
    html += '</div>';

    html += '<div class="journal-form-row">';
    html += '<label class="journal-form-label">Tags</label>';
    html += '<div id="journal-form-selected-tags" style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-bottom:0.2rem;">';
    _journalFormTagIds.forEach(function (tid) {
      var t = _journalTags.find(function (tag) { return tag.id === tid; });
      if (t) {
        html += '<span class="journal-tag-chip ' + _tagCategoryClass(t.category) + '" data-journal-form-remove-tag="' + tid + '">' + _esc(t.name) + ' <span class="journal-tag-chip-remove">&times;</span></span>';
      }
    });
    html += '</div>';
    html += '<input class="journal-tag-picker-search" id="journal-tag-search" type="text" placeholder="Search tags..." value="' + _esc(_journalTagSearch) + '" />';
    html += '<div class="journal-tag-picker" id="journal-tag-picker">';
    var searchLower = _journalTagSearch.toLowerCase();
    _journalTags.forEach(function (t) {
      if (_journalFormTagIds.indexOf(t.id) !== -1) return;
      if (searchLower && t.name.toLowerCase().indexOf(searchLower) === -1) return;
      html += '<span class="journal-tag-chip ' + _tagCategoryClass(t.category) + '" data-journal-form-add-tag="' + t.id + '">' + _esc(t.name) + '</span>';
    });
    if (searchLower && !_journalTags.some(function (t) { return t.name.toLowerCase() === searchLower; })) {
      html += '<span class="journal-tag-chip journal-tag-chip--custom" data-journal-form-create-tag="' + _esc(_journalTagSearch) + '">+ Create "' + _esc(_journalTagSearch) + '"</span>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="journal-form-actions">';
    html += '<button class="journal-form-save" id="journal-form-save">Save</button>';
    html += '<button class="journal-form-cancel" id="journal-form-cancel">Cancel</button>';
    if (_journalFormMode === 'edit') {
      html += '<button class="journal-form-delete" id="journal-form-delete">Delete</button>';
    }
    html += '</div>';
    html += '</div>';

    return html;
  }

  function _findSceneInAdvs(sceneId) {
    for (var i = 0; i < _journalAdventures.length; i++) {
      var adv = _journalAdventures[i];
      for (var j = 0; j < (adv.parts || []).length; j++) {
        var part = adv.parts[j];
        for (var k = 0; k < (part.scenes || []).length; k++) {
          if (part.scenes[k].id === sceneId) return part.scenes[k];
        }
      }
    }
    return null;
  }

  function _getCompletedScenes() {
    var scenes = [];
    _journalAdventures.forEach(function (adv) {
      (adv.parts || []).forEach(function (part) {
        (part.scenes || []).forEach(function (scene) {
          var comp = _journalCompletions[scene.id];
          if (comp && comp.completed) {
            scenes.push({
              id: scene.id,
              title: scene.title,
              number: scene.number,
              completedAt: comp.completed_at || null
            });
          }
        });
      });
    });
    scenes.sort(function (a, b) {
      if (a.completedAt && b.completedAt) return new Date(a.completedAt) - new Date(b.completedAt);
      return a.id < b.id ? -1 : 1;
    });
    return scenes;
  }

  function _renderBreadcrumbs() {
    var parts = [];
    var isSubView = _journalNav.level === 'scene-detail' || _journalNav.level === 'tag-search';
    parts.push('<span class="jnav-crumb"' + (isSubView ? ' data-jnav-to="list"' : '') + '>Campaign Journal</span>');
    if (_journalNav.level === 'scene-detail' && _journalNav.sceneId) {
      var scene = _findSceneInAdvs(_journalNav.sceneId);
      if (scene) {
        parts.push('<span class="jnav-sep">\u203A</span>');
        parts.push('<span class="jnav-crumb is-current">' + _esc(scene.title) + '</span>');
      }
    }
    if (_journalNav.level === 'tag-search' && _journalNav.searchTag) {
      parts.push('<span class="jnav-sep">\u203A</span>');
      parts.push('<span class="jnav-crumb is-current">Tag: ' + _esc(_journalNav.searchTag) + '</span>');
    }
    return '<div class="jnav-breadcrumbs">' + parts.join('') + '</div>';
  }

  var _journalExpandedAdv = {};
  var _journalExpandedPart = {};

  function _getDebriefsByAdventure() {
    var map = {};
    _journalEntries.forEach(function (e) {
      if (e.author_character_name !== 'Mission Debrief') return;
      var sid = e.source_scene_id || '';
      var advId = null;
      if (sid.indexOf('adventure:') === 0) {
        advId = sid.replace('adventure:', '');
      } else if (sid.indexOf('parts:') === 0) {
        var firstPart = sid.replace('parts:', '').split(',')[0].trim();
        for (var i = 0; i < _journalAdventures.length; i++) {
          var adv = _journalAdventures[i];
          for (var j = 0; j < (adv.parts || []).length; j++) {
            if (adv.parts[j].id === firstPart) { advId = adv.id; break; }
          }
          if (advId) break;
        }
      }
      if (advId) {
        if (!map[advId]) map[advId] = [];
        map[advId].push(e);
      }
    });
    return map;
  }

  function _renderCompletedScenesView() {
    var completionMap = _journalCompletions;
    var debriefMap = _getDebriefsByAdventure();
    var hasAnyContent = false;

    var holonetEntries = _journalEntries.filter(function (e) {
      return e.source_scene_id === 'holonet';
    });

    var adventuresWithContent = [];
    _journalAdventures.forEach(function (adv) {
      var advDebriefs = debriefMap[adv.id] || [];
      var advHasCompletedScene = false;
      var totalEntries = 0;
      (adv.parts || []).forEach(function (part) {
        (part.scenes || []).forEach(function (scene) {
          var comp = completionMap[scene.id];
          if (comp && comp.completed) advHasCompletedScene = true;
          _journalEntries.forEach(function (e) {
            if (e.source_scene_id === scene.id) totalEntries++;
          });
        });
      });
      if (advHasCompletedScene || advDebriefs.length > 0) {
        hasAnyContent = true;
        adventuresWithContent.push({ adv: adv, debriefs: advDebriefs, totalEntries: totalEntries });
      }
    });

    if (holonetEntries.length > 0) hasAnyContent = true;

    var html = '';
    if (!hasAnyContent) {
      html += '<div class="journal-empty"><div class="journal-empty-text">No completed scenes yet.<br>Your journal will fill as you progress through the campaign.</div></div>';
      return html;
    }

    if (holonetEntries.length > 0) {
      var isHnExpanded = _journalExpandedAdv['holonet'] !== false;
      html += '<div class="jnav-adv-group jnav-holonet-group">';
      html += '<div class="jnav-adv-header" data-jnav-adv-toggle="holonet">';
      html += '<span class="jnav-adv-chevron">' + (isHnExpanded ? '\u25BC' : '\u25B6') + '</span>';
      html += '<div class="jnav-adv-info">';
      html += '<span class="jnav-adv-title jnav-holonet-title">\u{1F4E1} HoloNet Broadcasts</span>';
      html += '<span class="jnav-adv-meta">' + holonetEntries.length + ' clipping' + (holonetEntries.length !== 1 ? 's' : '') + '</span>';
      html += '</div>';
      html += '</div>';

      if (isHnExpanded) {
        html += '<div class="jnav-adv-body">';
        holonetEntries.forEach(function (entry) {
          var isExpanded = _journalExpandedEntry === entry.id;
          html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '">';
          html += '<div class="journal-entry-card-header" data-journal-toggle="' + entry.id + '">';
          html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
          html += '<span class="journal-entry-title">' + _esc(entry.title) + '</span>';
          html += '<span class="journal-entry-date">' + _formatDate(entry.created_at) + '</span>';
          html += '</div>';
          if (isExpanded) {
            html += '<div class="journal-entry-expanded">';
            html += '<div class="journal-entry-meta">';
            html += '<span class="journal-entry-author">' + _esc(entry.author_character_name) + '</span>';
            html += '<span class="journal-entry-scene-ref">HoloNet Broadcast</span>';
            var tags = entry.tags || [];
            if (tags.length) {
              html += '<span class="journal-entry-tags">';
              tags.forEach(function (t) {
                html += '<span class="journal-tag-chip ' + _tagCategoryClass(t.category) + '" data-journal-tag-search="' + _esc(t.name) + '">' + _esc(t.name) + '</span>';
              });
              html += '</span>';
            }
            html += '</div>';
            html += '<div class="journal-entry-body">' + _esc(entry.body || '').replace(/\n/g, '<br>') + '</div>';
            html += '</div>';
          } else {
            html += '<div class="journal-entry-meta-inline">';
            html += '<span class="journal-entry-author">' + _esc(entry.author_character_name) + '</span>';
            html += '<span class="journal-entry-scene-ref">HoloNet Broadcast</span>';
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    }

    adventuresWithContent.forEach(function (item) {
      var adv = item.adv;
      var advDebriefs = item.debriefs;
      var isAdvExpanded = _journalExpandedAdv[adv.id] !== false;
      var completedCount = 0;
      var totalScenes = 0;
      (adv.parts || []).forEach(function (part) {
        (part.scenes || []).forEach(function (scene) {
          totalScenes++;
          var comp = completionMap[scene.id];
          if (comp && comp.completed) completedCount++;
        });
      });

      html += '<div class="jnav-adv-group">';
      html += '<div class="jnav-adv-header" data-jnav-adv-toggle="' + _esc(adv.id) + '">';
      html += '<span class="jnav-adv-chevron">' + (isAdvExpanded ? '\u25BC' : '\u25B6') + '</span>';
      html += '<div class="jnav-adv-info">';
      html += '<span class="jnav-adv-title">Episode ' + adv.number + ': ' + _esc(adv.title) + '</span>';
      html += '<span class="jnav-adv-meta">' + completedCount + '/' + totalScenes + ' scenes';
      if (item.totalEntries > 0) html += ' \u00B7 ' + item.totalEntries + ' entries';
      if (advDebriefs.length > 0) html += ' \u00B7 ' + advDebriefs.length + ' chronicle' + (advDebriefs.length > 1 ? 's' : '');
      html += '</span>';
      html += '</div>';
      html += '</div>';

      if (isAdvExpanded) {
        html += '<div class="jnav-adv-body">';

        advDebriefs.forEach(function (debrief) {
          html += '<div class="journal-scene-log journal-mission-debrief" data-scene-log-id="' + debrief.id + '">';
          html += '<div class="journal-scene-log-header journal-mission-debrief-header">';
          html += '<span class="journal-scene-log-chevron">\u25B6</span>';
          html += '<span class="journal-mission-debrief-label">' + _esc(debrief.title || 'Mission Chronicle') + '</span>';
          html += '<span class="journal-scene-log-date">' + _formatDate(debrief.created_at) + '</span>';
          html += '</div>';
          html += '<div class="journal-scene-log-body">';
          html += '<pre class="journal-mission-debrief-content">' + _esc(debrief.body || '') + '</pre>';
          html += '</div></div>';
        });

        (adv.parts || []).forEach(function (part) {
          var partScenes = part.scenes || [];
          var partCompletedScenes = [];
          var partEntryCount = 0;
          partScenes.forEach(function (scene) {
            var comp = completionMap[scene.id];
            if (comp && comp.completed) partCompletedScenes.push(scene);
            _journalEntries.forEach(function (e) {
              if (e.source_scene_id === scene.id) partEntryCount++;
            });
          });
          if (partCompletedScenes.length === 0) return;

          var isPartExpanded = _journalExpandedPart[part.id] !== false;

          html += '<div class="jnav-part-group">';
          html += '<div class="jnav-part-header" data-jnav-part-toggle="' + _esc(part.id) + '">';
          html += '<span class="jnav-part-chevron">' + (isPartExpanded ? '\u25BC' : '\u25B6') + '</span>';
          html += '<span class="jnav-part-title">Part ' + part.number + ': ' + _esc(part.title || part.id) + '</span>';
          html += '<span class="jnav-part-meta">' + partCompletedScenes.length + '/' + partScenes.length + ' scenes</span>';
          html += '</div>';

          if (isPartExpanded) {
            html += '<div class="jnav-part-body">';
            partCompletedScenes.forEach(function (scene) {
              var entryCount = 0;
              _journalEntries.forEach(function (e) { if (e.source_scene_id === scene.id) entryCount++; });
              html += '<div class="jnav-row" data-jnav-scene="' + _esc(scene.id) + '">';
              html += '<span class="jnav-row-icon">\u25B6</span>';
              html += '<div class="jnav-row-text">';
              html += '<span class="jnav-row-title">' + _esc(scene.title) + '</span>';
              if (entryCount > 0) {
                html += '<span class="jnav-row-sub">' + entryCount + ' journal ' + (entryCount === 1 ? 'entry' : 'entries') + '</span>';
              }
              html += '</div>';
              html += '</div>';
            });
            html += '</div>';
          }
          html += '</div>';
        });

        html += '</div>';
      }
      html += '</div>';
    });

    return html;
  }

  function _renderTagSearchView() {
    var html = '';
    var tagName = _journalNav.searchTag;
    var matches = _journalEntries.filter(function (e) {
      return (e.tags || []).some(function (t) { return t.name === tagName; });
    });
    if (!matches.length) {
      html += '<div class="journal-empty"><div class="journal-empty-text">No entries tagged "' + _esc(tagName) + '"</div></div>';
      return html;
    }
    matches.forEach(function (entry) {
      var isCampaignLog = entry.author_character_name === 'Campaign Log';
      var isExpanded = _journalExpandedEntry === entry.id;
      var sceneName = '';
      var scene = entry.source_scene_id ? _findSceneInAdvs(entry.source_scene_id) : null;
      if (scene) sceneName = scene.title;
      if (isCampaignLog) {
        html += '<div class="journal-scene-log" data-scene-log-id="' + entry.id + '">';
        html += '<div class="journal-scene-log-header">';
        html += '<span class="journal-scene-log-chevron">\u25B6</span>';
        html += '<span class="journal-scene-log-title">' + _esc(entry.title) + '</span>';
        html += '<span class="journal-scene-log-date">' + _formatDate(entry.created_at) + '</span>';
        html += '</div>';
        html += '<div class="journal-scene-log-body">';
        html += '<pre class="journal-scene-log-content">' + _esc(entry.body || '') + '</pre>';
        html += '</div>';
        html += '</div>';
      } else {
        html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '">';
        html += '<div class="journal-entry-card-header" data-journal-toggle="' + entry.id + '">';
        html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
        html += '<span class="journal-entry-title">' + _esc(entry.title) + '</span>';
        html += '<span class="journal-entry-date">' + _formatDate(entry.created_at) + '</span>';
        html += '</div>';
        if (isExpanded) {
          html += '<div class="journal-entry-expanded">';
          html += '<div class="journal-entry-meta">';
          html += '<span class="journal-entry-author">' + _esc(entry.author_character_name) + '</span>';
          if (sceneName) {
            html += '<span class="journal-entry-scene-ref">' + _esc(sceneName) + '</span>';
          }
          var tags = entry.tags || [];
          if (tags.length) {
            html += '<span class="journal-entry-tags">';
            tags.forEach(function (t) {
              html += '<span class="journal-tag-chip ' + _tagCategoryClass(t.category) + '" data-journal-tag-search="' + _esc(t.name) + '">' + _esc(t.name) + '</span>';
            });
            html += '</span>';
          }
          html += '</div>';
          html += '<div class="journal-entry-body">' + _esc(entry.body || '').replace(/\n/g, '<br>') + '</div>';
          html += '</div>';
        } else {
          html += '<div class="journal-entry-meta-inline">';
          html += '<span class="journal-entry-author">' + _esc(entry.author_character_name) + '</span>';
          if (sceneName) {
            html += '<span class="journal-entry-scene-ref">' + _esc(sceneName) + '</span>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
    });
    return html;
  }

  function _renderSceneDetailView() {
    var html = '';
    var campaignLog = null;
    var playerEntries = [];
    _journalEntries.forEach(function (e) {
      if (e.source_scene_id !== _journalNav.sceneId) return;
      if (e.author_character_name === 'Campaign Log') {
        campaignLog = e;
      } else {
        playerEntries.push(e);
      }
    });

    if (campaignLog) {
      html += '<div class="journal-scene-log" data-scene-log-id="' + campaignLog.id + '">';
      html += '<div class="journal-scene-log-header">';
      html += '<span class="journal-scene-log-chevron">\u25B6</span>';
      html += '<span class="journal-scene-log-title">Scene Summary</span>';
      html += '<span class="journal-scene-log-date">' + _formatDate(campaignLog.created_at) + '</span>';
      html += '</div>';
      html += '<div class="journal-scene-log-body">';
      html += '<pre class="journal-scene-log-content">' + _esc(campaignLog.body || '') + '</pre>';
      html += '</div>';
      html += '</div>';
    }

    if (_journalFormMode) {
      html += _renderJournalForm();
    } else {
      html += '<div class="journal-toolbar">';
      html += '<button class="journal-new-btn" id="journal-new-btn">+ New Entry</button>';
      html += '</div>';
    }

    if (playerEntries.length === 0 && !_journalFormMode) {
      html += '<div class="journal-empty"><div class="journal-empty-text">No crew notes for this scene yet.<br>Be the first to record what happened.</div></div>';
    } else {
      playerEntries.forEach(function (entry) {
        var isExpanded = _journalExpandedEntry === entry.id;
        html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '" data-journal-entry-id="' + entry.id + '">';
        html += '<div class="journal-entry-card-header" data-journal-toggle="' + entry.id + '">';
        html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
        html += '<span class="journal-entry-title">' + _esc(entry.title) + '</span>';
        html += '<span class="journal-entry-date">' + _formatDate(entry.created_at) + '</span>';
        html += '</div>';
        if (isExpanded) {
          html += '<div class="journal-entry-expanded">';
          html += '<div class="journal-entry-meta">';
          html += '<span class="journal-entry-author">' + _esc(entry.author_character_name) + '</span>';
          var tags = entry.tags || [];
          if (tags.length) {
            html += '<span class="journal-entry-tags">';
            tags.forEach(function (t) {
              html += '<span class="journal-tag-chip ' + _tagCategoryClass(t.category) + '" data-journal-tag-search="' + _esc(t.name) + '">' + _esc(t.name) + '</span>';
            });
            html += '</span>';
          }
          html += '</div>';
          html += '<div class="journal-entry-body">' + _esc(entry.body || '').replace(/\n/g, '<br>') + '</div>';
          html += '<div class="journal-entry-actions">';
          html += '<button class="journal-edit-btn" data-journal-edit="' + entry.id + '">Edit</button>';
          html += '</div>';
          html += '</div>';
        } else {
          html += '<div class="journal-entry-meta-inline">';
          html += '<span class="journal-entry-author">' + _esc(entry.author_character_name) + '</span>';
          html += '</div>';
        }
        html += '</div>';
      });
    }

    return html;
  }

  function _renderJournal() {
    var wrap = document.getElementById('journal-tab-wrap');
    if (!wrap) return;

    var html = '';
    html += _renderBreadcrumbs();
    html += '<div class="jnav-content">';
    if (_journalNav.level === 'tag-search') {
      html += _renderTagSearchView();
    } else if (_journalNav.level === 'scene-detail') {
      html += _renderSceneDetailView();
    } else {
      html += _renderCompletedScenesView();
    }
    html += '</div>';

    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-jnav-to]').forEach(function (el) {
      el.addEventListener('click', function () {
        var wasTagSearch = _journalNav.level === 'tag-search';
        _journalNav = { level: 'list', actNum: null, advId: null, sceneId: null, searchTag: null };
        _journalFormMode = null;
        _journalExpandedEntry = null;
        if (wasTagSearch) {
          _journalEntries = [];
          _renderJournal();
        } else {
          _renderJournal();
        }
      });
    });

    wrap.querySelectorAll('[data-jnav-scene]').forEach(function (el) {
      el.addEventListener('click', function () {
        _journalNav.level = 'scene-detail';
        _journalNav.sceneId = el.getAttribute('data-jnav-scene');
        _journalNav.searchTag = null;
        _journalExpandedEntry = null;
        _journalFormMode = null;
        _loadSceneEntries();
      });
    });

    wrap.querySelectorAll('[data-journal-tag-search]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        var tagName = chip.getAttribute('data-journal-tag-search');
        _journalNav = { level: 'tag-search', actNum: null, advId: null, sceneId: null, searchTag: tagName };
        _journalExpandedEntry = null;
        _journalFormMode = null;
        fetch('/api/journal/entries?tag=' + encodeURIComponent(tagName))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            _journalEntries = data.entries || [];
            _renderJournal();
          }).catch(function () { _renderJournal(); });
      });
    });

    wrap.querySelectorAll('[data-jnav-adv-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var advId = el.getAttribute('data-jnav-adv-toggle');
        var cur = _journalExpandedAdv[advId];
        _journalExpandedAdv[advId] = (cur === false) ? true : false;
        _renderJournal();
      });
    });

    wrap.querySelectorAll('[data-jnav-part-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var partId = el.getAttribute('data-jnav-part-toggle');
        var cur = _journalExpandedPart[partId];
        _journalExpandedPart[partId] = (cur === false) ? true : false;
        _renderJournal();
      });
    });

    wrap.querySelectorAll('[data-scene-log-id]').forEach(function (log) {
      var header = log.querySelector('.journal-scene-log-header');
      if (header) {
        header.addEventListener('click', function () {
          log.classList.toggle('is-expanded');
        });
      }
    });

    wrap.querySelectorAll('[data-journal-toggle]').forEach(function (header) {
      header.addEventListener('click', function () {
        var id = parseInt(header.getAttribute('data-journal-toggle'), 10);
        _journalExpandedEntry = (_journalExpandedEntry === id) ? null : id;
        _renderJournal();
      });
    });

    wrap.querySelectorAll('[data-journal-edit]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var entryId = parseInt(btn.getAttribute('data-journal-edit'), 10);
        var entry = _journalEntries.find(function (en) { return en.id === entryId; });
        if (entry) {
          _journalFormMode = 'edit';
          _journalEditId = entryId;
          _journalFormTagIds = (entry.tags || []).map(function (t) { return t.id; });
          _journalTagSearch = '';
          _journalExpandedEntry = null;
          _renderJournal();
          var titleInput = document.getElementById('journal-form-title');
          if (titleInput) titleInput.value = entry.title || '';
          var bodyInput = document.getElementById('journal-form-body');
          if (bodyInput) bodyInput.value = entry.body || '';
        }
      });
    });

    var newBtn = document.getElementById('journal-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        _journalFormMode = 'create';
        _journalEditId = null;
        _journalFormTagIds = [];
        _journalTagSearch = '';
        _journalExpandedEntry = null;
        _renderJournal();
      });
    }

    _bindJournalFormEvents();
  }

  function _loadSceneEntries() {
    var sceneId = _journalNav.sceneId || _journalNav.advId;
    if (_journalNav.level === 'scene-detail' && _journalNav.sceneId) {
      fetch('/api/journal/entries?scene_id=' + encodeURIComponent(_journalNav.sceneId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _journalEntries = data.entries || [];
          _renderJournal();
        }).catch(function () { _renderJournal(); });
    } else if (_journalNav.level === 'scenes' && _journalNav.advId) {
      fetch('/api/journal/entries')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _journalEntries = data.entries || [];
          _renderJournal();
        }).catch(function () { _renderJournal(); });
    } else {
      _renderJournal();
    }
  }

  function _loadJournalData() {
    _detectCharacterName();
    Promise.all([
      fetch('/api/campaign/adventures').then(function (r) { return r.json(); }),
      fetch('/api/campaign/progress').then(function (r) { return r.json(); }),
      fetch('/api/journal/entries').then(function (r) { return r.json(); }),
      fetch('/api/journal/tags').then(function (r) { return r.json(); })
    ]).then(function (results) {
      _journalAdventures = results[0].adventures || [];
      _journalCompletions = results[1].completions || {};
      _journalEntries = results[2].entries || [];
      _journalTags = results[3].tags || [];
      _renderJournal();
    }).catch(function (err) {
      console.error('[Journal] Failed to load:', err);
    });
  }

  (function _listenJournalSocket() {
    var sock = window._socket;
    if (!sock) { setTimeout(_listenJournalSocket, 2000); return; }
    sock.on('journal:updated', function () {
      if (_activeTab === 'journal' && !_journalFormMode) _loadJournalData();
    });
  })();

  function _switchTab(tabName) {
    _activeTab = tabName;
    _panel.querySelectorAll('.handbook-tab-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-hb-tab') === tabName);
    });
    _panel.querySelectorAll('.handbook-tab-content').forEach(function (tc) {
      tc.classList.toggle('is-active', tc.getAttribute('data-hb-tab-content') === tabName);
    });
    if (tabName === 'journal') {
      _loadJournalData();
    }
    if (tabName === 'dramatis') {
      _loadDramatisData();
    }
  }

  function _open(id) {
    if (!_dataReady) return;
    if (id && !_entries[id]) { console.warn('[Handbook] No entry for id:', id); return; }

    _panel.setAttribute('aria-hidden', 'false');
    _panel.classList.add('is-open');
    _isOpen = true;

    if (id) {
      _switchTab('handbook');
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
    _isOpen = false;
  }

  function _onDocClick(e) {
    if (e.target.closest('#handbook-trigger')) {
      if (_isOpen) { _close(); } else { _open(); }
      return;
    }

    var tabBtn = e.target.closest('.handbook-tab-btn');
    if (tabBtn && tabBtn.closest('#handbook-panel')) {
      var tab = tabBtn.getAttribute('data-hb-tab');
      if (tab) _switchTab(tab);
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
      if (e.touches) e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      var touch = e.touches ? e.touches[0] : e;
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (!didDrag && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      didDrag = true;
      e.preventDefault();
      _applyPos(origLeft + dx, origTop + dy);
    }

    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      btn.style.transition = '';
      if (didDrag) {
        _savePos();
      } else if (e.type === 'touchend') {
        e.preventDefault();
        if (_isOpen) { _close(); } else { _open(); }
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

  function _buildSearchText(parts) {
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function _loadActions(data) {
    var universalActions = data.universalActions || [];
    universalActions.forEach(function (a) {
      var searchParts = [a.name, a.description, a.risk, a.note];
      if (a.effect) a.effect.forEach(function (e) { searchParts.push(e.description); });
      _entries[a.id] = {
        id: a.id,
        name: a.name,
        type: a.actionType || 'Action',
        rule: a.description || '',
        _providerType: 'action',
        _actionGroup: a.actionType || 'Action',
        _actionData: a,
        _searchText: _buildSearchText(searchParts)
      };
      _actionEntryIds[a.id] = true;
    });

  }

  function _loadDestinyPool(gamesystemArr) {
    var byId = {};
    gamesystemArr.forEach(function (entry) { byId[entry.id] = entry; });
    var dp = byId['destiny_pool'];
    if (!dp) return;
    var richSections = [];
    if (dp.karmaState) {
      richSections.push({ heading: 'The Karma State', body: dp.karmaState.note || '', list: [
        'Hope dominant: ' + (dp.karmaState.hopeDominant || ''),
        'Toll dominant: ' + (dp.karmaState.tollDominant || ''),
        dp.karmaState.infamyPenalty || ''
      ].filter(Boolean) });
    }
    if (dp.tapping) {
      richSections.push({ heading: 'Tapping', body: dp.tapping.rule || '', list: dp.tapping.note ? [dp.tapping.note] : [] });
    }
    if (dp.lockout) {
      richSections.push({ heading: 'The Lockout', body: dp.lockout.note || '', list: [
        'Toll \u2192 Hope: ' + (dp.lockout.tollToHope || ''),
        'Hope \u2192 Toll: ' + (dp.lockout.hopeToToll || '')
      ] });
    }
    if (dp.flipping) {
      richSections.push({ heading: 'Flipping', body: dp.flipping.note || '', list: [
        'The Fall (Hope \u2192 Toll): ' + (dp.flipping.theFall || ''),
        'Redemption (Toll \u2192 Hope): ' + (dp.flipping.redemption || '')
      ] });
    }
    if (dp.theCrossroads) {
      richSections.push({ heading: 'The Crossroads', body: dp.theCrossroads.trigger || '', list: [
        'Intervention: ' + (dp.theCrossroads.intervention || ''),
        'Relent: ' + (dp.theCrossroads.relent || ''),
        'Pull the Trigger: ' + (dp.theCrossroads.pullTheTrigger || '')
      ] });
    }
    _entries['destiny_pool'] = {
      id: 'destiny_pool',
      name: dp.name || 'The Destiny Pool',
      type: 'Meta-Currency',
      rule: dp.rule || dp.description || '',
      guide: '',
      richSections: richSections,
      _providerType: 'destiny',
      _searchText: _buildSearchText(['destiny pool', 'hope', 'toll', 'karma', 'tapping', 'lockout', 'flipping', 'crossroads', 'meta currency'])
    };
  }

  function _loadCoreRules(gamesystemArr) {
    var byId = {};
    gamesystemArr.forEach(function (entry) { byId[entry.id] = entry; });

    CORE_RULE_ORDER.forEach(function (ruleId) {
      if (ruleId === 'destiny_pool') {
        _coreRuleEntryIds['destiny_pool'] = true;
        return;
      }
      var gs = byId[ruleId];
      if (!gs) return;

      var richSections = [];
      if (ruleId === 'modes_of_play' && gs.modes) {
        gs.modes.forEach(function (m) {
          var list = [];
          if (m.structure) list.push('Structure: ' + m.structure);
          if (m.initiative) list.push('Initiative: ' + m.initiative);
          if (m.availableActions) list.push('Actions: ' + m.availableActions);
          if (m.resolution) list.push('Resolution: ' + m.resolution);
          richSections.push({ heading: m.mode, body: m.when || '', list: list });
        });
      } else if (ruleId === 'opening_exploit_defense') {
        if (gs.openings) {
          var oList = (gs.openings.systemSources || []).concat(gs.openings.otherSources || []);
          richSections.push({ heading: 'Openings', body: gs.openings.definition || '', list: oList });
        }
        if (gs.exploits) {
          richSections.push({ heading: 'Exploits', body: gs.exploits.definition || '', list: [
            'Default: ' + (gs.exploits.defaultExploit || ''),
            'Cost: ' + (gs.exploits.cost || ''),
            gs.exploits.restrictions || ''
          ].filter(Boolean) });
        }
        if (gs.defenses) {
          var dList = (gs.defenses.types || []).map(function (d) {
            return d.name + ' \u2014 ' + d.discipline + ': ' + d.description;
          });
          richSections.push({ heading: 'Defenses', body: gs.defenses.definition || '', list: dList });
        }
        if (gs.actionEconomy) {
          richSections.push({ heading: 'Action Economy', body: gs.actionEconomy.perRound || '', list: [gs.actionEconomy.note || ''].filter(Boolean) });
        }
      } else if (ruleId === 'dual_wielding') {
        richSections.push({ heading: 'Mechanic', body: gs.mechanic || '' });
      } else if (ruleId === 'concealment') {
        richSections.push({ heading: 'Mechanic', body: gs.mechanic || '' });
        if (gs.concealmentVsCover) richSections.push({ heading: 'Concealment vs Cover', body: gs.concealmentVsCover });
        if (gs.targetSpecific) richSections.push({ heading: 'Target-Specific Concealment', body: gs.targetSpecific });
      }

      var searchParts = [gs.name, gs.summary, gs.mechanic, gs.tag];
      _entries[ruleId] = {
        id: ruleId,
        name: gs.name,
        type: gs.tag || 'System Rule',
        rule: gs.summary || '',
        richSections: richSections,
        _providerType: 'coreRule',
        _searchText: _buildSearchText(searchParts)
      };
      _coreRuleEntryIds[ruleId] = true;
    });
  }

  function _loadAdvancementEntry() {
    var richSections = [
      {
        heading: 'Earning Marks',
        body: 'Marks are the single advancement currency. Each adventure offers 10–15 Marks spread across four trigger buckets. The GM checks off triggers as they occur; at adventure end, earned Marks are banked.',
        list: [
          'The Adventure (varies): Mission-specific goals loaded per adventure. Some are revealed by the GM mid-session. Includes The Crucible (universal).',
          'Destiny (3 M): Personal destiny marks tied to your character\'s chosen destiny path.',
          'The Edge (6 M): Systems and grit triggers — gear, environment, raw power, adaptability.'
        ]
      },
      {
        heading: 'Discipline Track',
        body: 'A 5-box track. Each box costs (Track Level \u00d7 1) Marks. Each box filled earns 1 Advance. When the track clears, earn 1 Elite Token, then the track resets at the next level.',
        list: [
          'D6 → D8: 1 Advance (soft cap).',
          'D8 → D10: 1 Advance + 1 Elite Token.',
          'D10 → D12: 1 Advance + 2 Elite Tokens.',
          'Focus Burn: Pay Mark cost, skip die upgrade, accelerate toward Elite Token.'
        ]
      },
      {
        heading: 'Arena Track',
        body: 'A 3-box track. Each box costs (Track Level \u00d7 3) Marks. Each box filled earns 1 Advance. Track resets at the next level when cleared.',
        list: [
          'D4 → D6 (Fixing a Flaw): 2 Advances.',
          'D6 → D8: 1 Advance.',
          'D8 → D10: 3 Advances.',
          'D10 → D12 (Master): 5 Advances.',
          'Apex Rule: Only one Arena may sit at D12. Pushing a second degrades the first to D10.'
        ]
      },
      {
        heading: 'Vocation Track',
        body: 'A 5-box pip track. Each box costs (Track Level \u00d7 3) Marks. Each box filled earns 1 Advance (no Elite Tokens). Track resets at the next level when cleared. Spend 1 Advance to bump any eligible vocation up 1 tier, gated by Favored Discipline die.',
        list: [
          'D4: Max Tier 1 \u2022 D6: Max Tier 2 \u2022 D8: Max Tier 3.',
          'D10: Max Tier 4 \u2022 D12: Max Tier 5.',
          'Discipline Gate: Your Favored Discipline die caps the maximum Vocation tier.',
          'Advances can be spent between adventures to bump any eligible vocation.'
        ]
      }
    ];

    _entries['marks_advancement'] = {
      id: 'marks_advancement',
      name: 'Marks & Advancement',
      type: 'Rule',
      rule: 'Marks are earned through narrative triggers during play and spent on three advancement tracks: Discipline, Arena, and Vocation. Open the Advancement panel on your character sheet to track progress.',
      richSections: richSections,
      _providerType: 'rule',
      _searchText: _buildSearchText(['marks', 'advancement', 'discipline track', 'arena track', 'vocation track', 'vocation tier', 'elite token', 'focus burn', 'apex rule', 'earning marks'])
    };
  }

  function _loadVocations(kitsArr) {
    kitsArr.forEach(function (k) {
      var searchParts = [k.name, k.description, k.fluff, k.governingArena, k.favoredDiscipline];
      if (k.abilities) k.abilities.forEach(function (ab) {
        searchParts.push(ab.name, ab.rule);
        if (ab.effect) ab.effect.forEach(function (e) { searchParts.push(e.description); });
        if (ab.gambits) ab.gambits.forEach(function (g) { searchParts.push(g.name, g.rule); });
      });
      _entries[k.id] = {
        id: k.id,
        name: k.name,
        type: 'Vocation',
        rule: k.description || '',
        _providerType: 'vocation',
        _kitData: k,
        _searchText: _buildSearchText(searchParts)
      };
      _vocationEntryIds[k.id] = true;
    });
  }

  function _loadSpecies(speciesArr) {
    speciesArr.forEach(function (sp) {
      var searchParts = [sp.name, sp.tagline, sp.lore];
      if (sp.arenaShift) searchParts.push(sp.arenaShift.name, sp.arenaShift.desc);
      if (sp.biologicalTruth) searchParts.push(sp.biologicalTruth.name, sp.biologicalTruth.desc);
      if (sp.speciesTrait) searchParts.push(sp.speciesTrait.name, sp.speciesTrait.desc);
      if (sp.favoredDiscipline) {
        searchParts.push(sp.favoredDiscipline.desc);
        if (sp.favoredDiscipline.choices) sp.favoredDiscipline.choices.forEach(function (c) { searchParts.push(c.label); });
      }
      _entries[sp.id] = {
        id: sp.id,
        name: sp.name,
        type: sp.tagline || 'Species',
        rule: sp.lore || '',
        _providerType: 'species',
        _speciesData: sp,
        _searchText: _buildSearchText(searchParts)
      };
      _speciesEntryIds[sp.id] = true;
    });
  }

  function _loadEquipment(weaponsArr, armorArr, gearArr) {
    weaponsArr.forEach(function (w) {
      var searchParts = [w.name, w.description, w.chassisLabel, w.discipline, w.arena];
      if (w.trait) searchParts.push(w.trait.name, w.trait.description);
      if (w.gambits) w.gambits.forEach(function (g) { searchParts.push(g.name, g.rule); });
      if (w.tags) w.tags.forEach(function (t) { searchParts.push(t); });
      _entries[w.id] = {
        id: w.id,
        name: w.name,
        type: w.chassisLabel || 'Weapon',
        rule: w.description || '',
        _providerType: 'equipment',
        _equipCategory: 'weapon',
        _equipData: w,
        _searchText: _buildSearchText(searchParts)
      };
      _equipmentEntryIds[w.id] = true;
    });

    armorArr.forEach(function (a) {
      var searchParts = [a.name, a.description, a.categoryLabel];
      if (a.traits) a.traits.forEach(function (t) { searchParts.push(t.name, t.description); });
      if (a.gambits) a.gambits.forEach(function (g) { searchParts.push(g.name, g.rule); });
      if (a.tags) a.tags.forEach(function (t) { searchParts.push(t); });
      _entries[a.id] = {
        id: a.id,
        name: a.name,
        type: a.categoryLabel || 'Armor',
        rule: a.description || '',
        _providerType: 'equipment',
        _equipCategory: 'armor',
        _equipData: a,
        _searchText: _buildSearchText(searchParts)
      };
      _equipmentEntryIds[a.id] = true;
    });

    gearArr.forEach(function (g) {
      var searchParts = [g.name, g.description, g.categoryLabel];
      if (g.traits) g.traits.forEach(function (t) { searchParts.push(t.name, t.description); });
      if (g.gambits) g.gambits.forEach(function (g2) { searchParts.push(g2.name, g2.rule); });
      if (g.tags) g.tags.forEach(function (t) { searchParts.push(t); });
      _entries[g.id] = {
        id: g.id,
        name: g.name,
        type: g.categoryLabel || 'Gear',
        rule: g.description || '',
        _providerType: 'equipment',
        _equipCategory: 'gear',
        _equipData: g,
        _searchText: _buildSearchText(searchParts)
      };
      _equipmentEntryIds[g.id] = true;
    });
  }

  function init() {
    _panel = _buildPanel();
    document.body.appendChild(_panel);
    _loadPanelGeo();
    _initPanelDrag();

    var triggerBtn = _buildTriggerBtn();
    document.body.appendChild(triggerBtn);
    _initDraggableTrigger(triggerBtn);

    var searchInput = document.getElementById('handbook-search');
    searchInput.addEventListener('input', function () {
      _searchTerm = searchInput.value;
      _buildSidebarIndex();
    });

    var glossaryReady = fetch('/data/glossary.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        data.forEach(function (entry) { _entries[entry.id] = entry; });
      });

    var maneuversReady = fetch('/data/maneuvers.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        _loadActions(data);

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

    var speciesReady = fetch('/data/species.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { _loadSpecies(data); });

    var kitsReady = fetch('/data/kits.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { _loadVocations(data); });

    var chassisReady = fetch('/data/chassis.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { _chassisData = data; });

    var gamesystemReady = fetch('/data/gamesystem.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { _loadDestinyPool(data); _loadCoreRules(data); _loadAdvancementEntry(); });

    var weaponsData, armorData, gearData;
    var weaponsReady = fetch('/data/weapons.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { weaponsData = data; });
    var armorReady = fetch('/data/armor.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { armorData = data; });
    var gearReady = fetch('/data/gear.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { gearData = data; });

    Promise.all([glossaryReady, maneuversReady, speciesReady, kitsReady, chassisReady, gamesystemReady, weaponsReady, armorReady, gearReady]).then(function () {
      _loadEquipment(weaponsData || [], armorData || [], gearData || []);
      Object.keys(_maneuversByDisc).forEach(function (discId) {
        var entry = _entries[discId];
        if (!entry) return;
        var gambitParts = [];
        _maneuversByDisc[discId].forEach(function (m) {
          gambitParts.push(m.name);
          if (m.gambits) m.gambits.forEach(function (g) {
            gambitParts.push(g.name, g.rule, g.effect);
          });
        });
        if (gambitParts.length) {
          var extra = gambitParts.filter(Boolean).join(' ').toLowerCase();
          entry._searchText = (entry._searchText || '') + ' ' + extra;
        }
      });
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

  function _openToProvider(providerId) {
    if (!_dataReady) return;
    _panel.setAttribute('aria-hidden', 'false');
    _panel.classList.add('is-open');
    _isOpen = true;
    _switchTab('handbook');

    for (var i = 0; i < _providers.length; i++) {
      _expandedCategories[_providers[i].id] = (_providers[i].id === providerId);
    }
    _buildSidebarIndex();

    var prov = null;
    for (var j = 0; j < _providers.length; j++) {
      if (_providers[j].id === providerId) { prov = _providers[j]; break; }
    }
    if (prov) {
      var groups = prov.getGroups();
      if (groups.length && groups[0].entries && groups[0].entries.length) {
        _showEntry(groups[0].entries[0].id);
      }
    }
  }

  var _dramatisProfiles = [];
  var _dramatisExpanded = null;

  function _loadDramatisData() {
    var wrap = document.getElementById('dramatis-tab-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="dp-player-empty">Loading dossiers\u2026</div>';
    fetch('/api/npc-profiles/revealed')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _dramatisProfiles = data.profiles || [];
        _renderDramatisTab();
      })
      .catch(function () {
        wrap.innerHTML = '<div class="dp-player-empty">Could not load dossiers.</div>';
      });
  }

  function _renderDramatisTab() {
    var wrap = document.getElementById('dramatis-tab-wrap');
    if (!wrap) return;

    if (_dramatisProfiles.length === 0) {
      wrap.innerHTML = '<div class="dp-player-empty">No known contacts yet. NPCs will appear here as you encounter them during the campaign.</div>';
      return;
    }

    var statusColors = { allied: '#22c55e', neutral: '#eab308', hostile: '#ef4444', unknown: '#6b7280', deceased: '#9333ea' };
    var html = '';

    _dramatisProfiles.forEach(function (p) {
      var sColor = statusColors[p.status] || '#6b7280';
      var isExp = _dramatisExpanded === p.npc_key;

      html += '<div class="dp-player-card' + (isExp ? ' dp-player-card--expanded' : '') + '" data-dramatis-toggle="' + _esc(p.npc_key) + '">';
      html += '<div class="dp-player-header">';
      if (p.portrait_url) {
        html += '<img class="dp-player-portrait" src="' + _esc(p.portrait_url) + '" alt="' + _esc(p.name) + '" />';
      } else {
        html += '<div class="dp-player-placeholder">' + _esc(p.name.charAt(0)) + '</div>';
      }
      html += '<div class="dp-player-info">';
      html += '<div class="dp-player-name">' + _esc(p.name) + '</div>';
      html += '<div class="dp-player-sub">' + _esc(p.species || '') + (p.role ? ' \u2014 ' + _esc(p.role) : '') + '</div>';
      html += '</div>';
      html += '<span class="dp-player-status" style="background:' + sColor + ';">' + _esc(p.status) + '</span>';
      html += '</div>';

      if (isExp) {
        html += '<div class="dp-player-detail">';
        if (p.portrait_url) {
          html += '<div class="dp-player-portrait-large-wrap">';
          html += '<img class="dp-player-portrait-large" src="' + _esc(p.portrait_url) + '" alt="' + _esc(p.name) + '" data-dp-lightbox="' + _esc(p.portrait_url) + '" />';
          html += '</div>';
        }
        if (p.player_bio) {
          html += '<div class="dp-player-bio">' + _esc(p.player_bio) + '</div>';
        }
        if (p.traits && p.traits.length) {
          html += '<div class="dp-player-section-title">Known Traits</div>';
          html += '<div class="dp-player-traits">';
          p.traits.forEach(function (t) {
            html += '<span class="dp-player-trait">' + _esc(t) + '</span>';
          });
          html += '</div>';
        }
        if (p.connections && p.connections.length) {
          html += '<div class="dp-player-section-title">Connections</div>';
          p.connections.forEach(function (c) {
            html += '<div class="dp-player-connection">' + _esc(c) + '</div>';
          });
        }
        if (p.timeline && p.timeline.length) {
          html += '<div class="dp-player-section-title">Timeline</div>';
          p.timeline.forEach(function (tl) {
            html += '<div class="dp-player-timeline-entry">';
            html += '<span class="dp-player-timeline-ref">' + _esc(tl.scene_ref || '') + '</span>';
            html += '<span class="dp-player-timeline-text">' + _esc(tl.event_text || tl.summary || '') + '</span>';
            html += '</div>';
          });
        }
        html += '</div>';
      }
      html += '</div>';
    });

    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-dramatis-toggle]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-dp-lightbox]')) return;
        var key = card.dataset.dramatisToggle;
        _dramatisExpanded = (_dramatisExpanded === key) ? null : key;
        _renderDramatisTab();
      });
    });

    wrap.querySelectorAll('[data-dp-lightbox]').forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        _openDpLightbox(img.dataset.dpLightbox, img.alt);
      });
    });
  }

  function _openDpLightbox(src, alt) {
    var existing = document.getElementById('dp-lightbox-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'dp-lightbox-overlay';
    overlay.className = 'dp-lightbox-overlay';
    overlay.innerHTML =
      '<div class="dp-lightbox-content">' +
        '<img class="dp-lightbox-img" src="' + _esc(src) + '" alt="' + _esc(alt || '') + '" />' +
        '<div class="dp-lightbox-caption">' + _esc(alt || '') + '</div>' +
        '<button class="dp-lightbox-close">&times;</button>' +
      '</div>';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('dp-lightbox-close')) {
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);
  }

  (function _listenDramatisSocket() {
    var sock = window._socket;
    if (!sock) { setTimeout(_listenDramatisSocket, 2000); return; }

    sock.on('npc:sync', function (data) {
      _dramatisProfiles = data.profiles || [];
      if (_activeTab === 'dramatis') _renderDramatisTab();
    });
    sock.on('npc:revealed', function (data) {
      var prof = data.profile || data;
      if (!prof || !prof.npc_key) return;
      var exists = _dramatisProfiles.find(function (p) { return p.npc_key === prof.npc_key; });
      if (!exists) {
        _dramatisProfiles.push(prof);
        if (_activeTab === 'dramatis') _renderDramatisTab();
      }
    });
    sock.on('npc:hidden', function (data) {
      var key = data.npc_key || (data.profile && data.profile.npc_key);
      if (!key) return;
      _dramatisProfiles = _dramatisProfiles.filter(function (p) { return p.npc_key !== key; });
      if (_dramatisExpanded === key) _dramatisExpanded = null;
      if (_activeTab === 'dramatis') _renderDramatisTab();
    });
    sock.on('npc:status', function (data) {
      var key = data.npc_key;
      if (!key) return;
      var p = _dramatisProfiles.find(function (pr) { return pr.npc_key === key; });
      if (p) p.status = data.status;
      if (_activeTab === 'dramatis') _renderDramatisTab();
    });
    sock.on('npc:updated', function (data) {
      var prof = data.profile || data;
      if (!prof || !prof.npc_key) return;
      var idx = -1;
      for (var i = 0; i < _dramatisProfiles.length; i++) {
        if (_dramatisProfiles[i].npc_key === prof.npc_key) { idx = i; break; }
      }
      if (idx >= 0) {
        _dramatisProfiles[idx] = prof;
      } else if (prof.revealed) {
        _dramatisProfiles.push(prof);
      }
      if (_activeTab === 'dramatis') _renderDramatisTab();
    });
    sock.on('npc:timeline', function (data) {
      if (!data.npc_key) return;
      var p = _dramatisProfiles.find(function (pr) { return pr.npc_key === data.npc_key; });
      if (p) {
        if (data.timeline) {
          p.timeline = data.timeline;
        } else if (data.entry) {
          if (!p.timeline) p.timeline = [];
          p.timeline.push(data.entry);
        }
        if (_activeTab === 'dramatis') _renderDramatisTab();
      }
    });
  })();

  window.GlossaryOverlay = { open: _open, close: _close, openToProvider: _openToProvider };
}());

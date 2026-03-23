(function () {
  'use strict';

  var TIER_RANGES = ['0\u20133', '4\u20137', '8+'];

  var _CONDITION_MAP = {
    'disoriented': 'condition_disoriented',
    'rattled':     'condition_rattled',
    'optimized':   'condition_optimized',
    'weakened':    'condition_weakened',
    'empowered':   'condition_empowered',
    'shaken':      'condition_shaken',
    'exposed':     'condition_exposed',
    'pinned':      'condition_pinned',
    'prone':       'condition_prone',
    'hazard':      'condition_hazard',
    'guarded':     'condition_guarded',
    'cover':       'condition_cover',
    'buffered':    'condition_buffered',
    'blinded':     'condition_blinded',
    'shut down':   'condition_shut_down',
    'restrained':  'condition_restrained',
    'suppressed':  'condition_suppressed',
    'bleeding':    'condition_bleeding',
    'stunned':     'condition_stunned',
    'incapacitated': 'condition_incapacitated',
    'marked':      'condition_marked',
    'slowed':      'condition_slowed',
    'elusive':     'condition_elusive',
    'jammed':      'condition_jammed',
    'disabled':    'condition_disabled',
  };

  var STATION_ICONS = {
    station_pilot:    '\u2708',
    station_gunner:   '\u2694',
    station_operator: '\u2609',
    station_engineer: '\u2699',
    station_copilot:  '\u2706',
  };

  var STATION_COLORS = {
    station_pilot:    'var(--color-accent-blue, #3b82f6)',
    station_gunner:   'var(--color-accent-red, #ef4444)',
    station_operator: 'var(--color-accent-cyan, #06b6d4)',
    station_engineer: 'var(--color-accent-amber, #f59e0b)',
    station_copilot:  'var(--color-accent-green, #22c55e)',
  };

  var SYSTEM_KEYS = ['handling', 'engines', 'shields', 'sensors', 'weapon_mounts'];

  var STATUS_LABELS = {
    operational:  'Online',
    impaired:     'Impaired',
    debilitated:  'Debilitated',
    offline:      'Offline',
  };

  var STATUS_COLORS = {
    operational:  '#22c55e',
    impaired:     '#f59e0b',
    debilitated:  '#ef4444',
    offline:      '#6b7280',
  };

  var ACTION_TYPE_LABELS = {
    'action':   { pip: 'A', color: 'var(--color-accent-red, #ef4444)' },
    'reaction': { pip: 'R', color: 'var(--color-accent-cyan, #06b6d4)' },
    'exploit':  { pip: 'E', color: 'var(--color-accent-blue, #3b82f6)' },
  };

  var _state = {
    active: false,
    ship: null,
    stations: [],
    weapons: [],
    hardware: [],
    chassis: {},
    seats: {},
    myCharacterId: null,
    myStationId: null,
  };

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _linkify(str) {
    var s = String(str);
    var out = '';
    var re = /\[([^\]]+)\]/g;
    var last = 0;
    var match;
    while ((match = re.exec(s)) !== null) {
      out += _esc(s.slice(last, match.index)).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
      var inner = match[1];
      var normalized = inner.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
      var glossaryId = _CONDITION_MAP[normalized];
      if (glossaryId) {
        out += '<span class="condition-link" data-glossary-id="' + _esc(glossaryId) + '">[' + _esc(inner) + ']</span>';
      } else {
        out += _esc(match[0]);
      }
      last = match.index + match[0].length;
    }
    out += _esc(s.slice(last)).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    return out;
  }

  function _getMount() {
    return document.getElementById('shipcombat-overlay-mount');
  }

  function _getMyCharacterId() {
    try {
      var session = JSON.parse(sessionStorage.getItem('eote-session'));
      return session ? session.characterId : null;
    } catch (_) {
      return null;
    }
  }

  function _findMyStation() {
    var charId = _state.myCharacterId;
    if (!charId) return null;
    for (var sid in _state.seats) {
      if (_state.seats[sid] && _state.seats[sid].characterId === charId) {
        return sid;
      }
    }
    return null;
  }

  function _buildEffectTrack(effectArr) {
    if (!effectArr || !effectArr.length) return '';
    var html = '<div class="sc-effect-track">';
    for (var e = 0; e < effectArr.length; e++) {
      var tier = effectArr[e];
      var range = tier.range || TIER_RANGES[e] || String(e);
      html +=
        '<div class="sc-effect-row">' +
          '<span class="sc-effect-range">' + _esc(range) + '</span>' +
          '<span class="sc-effect-desc">' + _linkify(tier.description) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function _pipBadge(actionType) {
    var info = ACTION_TYPE_LABELS[actionType];
    if (!info) return '';
    return '<span class="sc-pip-badge" style="background:' + info.color + ';">' + info.pip + '</span>';
  }

  function _buildActionCard(action, stationColor) {
    var controlHtml = action.control ? '<span class="sc-card-control">' + _esc(action.control) + '</span>' : '';
    var powerHtml = action.power ? '<span class="sc-card-power">Power: ' + _esc(action.power) + '</span>' : '';

    var descHtml = '<div class="sc-card-desc">' + _linkify(action.description) + '</div>';

    var riskHtml = '';
    if (action.risk) {
      riskHtml =
        '<div class="sc-card-risk">' +
          '<span class="sc-risk-label">Risk</span>' +
          '<span class="sc-risk-text">' + _linkify(action.risk) + '</span>' +
        '</div>';
    }

    var effectHtml = _buildEffectTrack(action.effect);

    return (
      '<div class="sc-action-card sc-collapsible" data-action-id="' + _esc(action.id) + '">' +
        '<div class="sc-card-header sc-collapse-toggle" style="border-left-color:' + stationColor + ';" role="button" tabindex="0">' +
          '<div class="sc-card-header-left">' +
            _pipBadge(action.type) +
            '<span class="sc-card-name">' + _esc(action.name) + '</span>' +
          '</div>' +
          '<span class="sc-collapse-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="sc-card-body">' +
          '<div class="sc-card-meta">' +
            controlHtml +
            powerHtml +
          '</div>' +
          descHtml +
          riskHtml +
          effectHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildReactionCard(reaction, stationColor) {
    var triggerHtml = reaction.trigger
      ? '<div class="sc-card-trigger"><span class="sc-trigger-label">Trigger</span> ' + _linkify(reaction.trigger) + '</div>'
      : '';
    var costHtml = reaction.cost ? '<span class="sc-card-cost">' + _esc(reaction.cost) + '</span>' : '';

    var ruleHtml = '';
    if (reaction.rule) {
      ruleHtml = '<div class="sc-card-desc">' + _linkify(reaction.rule) + '</div>';
    } else if (reaction.description) {
      ruleHtml = '<div class="sc-card-desc">' + _linkify(reaction.description) + '</div>';
    }

    return (
      '<div class="sc-action-card sc-reaction-card sc-collapsible" data-action-id="' + _esc(reaction.id) + '">' +
        '<div class="sc-card-header sc-collapse-toggle" style="border-left-color:' + stationColor + ';" role="button" tabindex="0">' +
          '<div class="sc-card-header-left">' +
            _pipBadge(reaction.type) +
            '<span class="sc-card-name">' + _esc(reaction.name) + '</span>' +
          '</div>' +
          '<div class="sc-card-header-right">' +
            costHtml +
            '<span class="sc-collapse-chevron">&#9656;</span>' +
          '</div>' +
        '</div>' +
        '<div class="sc-card-body">' +
          triggerHtml +
          ruleHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildGambitCard(gambit, stationColor) {
    return (
      '<div class="sc-gambit-block">' +
        '<div class="sc-gambit-toggle" role="button" tabindex="0">' +
          '<span class="sc-gambit-label">Gambit</span>' +
          '<span class="sc-gambit-name">' + _esc(gambit.name) + '</span>' +
          '<span class="sc-gambit-die">' + _esc(gambit.unlockDie) + '+</span>' +
          '<span class="sc-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="sc-gambit-body">' +
          '<div class="sc-gambit-text">' + _linkify(gambit.rule) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildWeaponCard(mount, weaponDef, chassisData) {
    if (!weaponDef) return '';
    var chassis = chassisData[weaponDef.chassis] || null;

    var traitsHtml = '';
    if (weaponDef.traits && weaponDef.traits.length) {
      for (var t = 0; t < weaponDef.traits.length; t++) {
        var trait = weaponDef.traits[t];
        traitsHtml +=
          '<div class="sc-weapon-trait">' +
            '<span class="sc-weapon-trait-name">' + _esc(trait.name) + '</span>' +
            '<span class="sc-weapon-trait-desc">' + _linkify(trait.description) + '</span>' +
          '</div>';
      }
    }

    var dmgHtml = '';
    if (chassis && chassis.tiers) {
      dmgHtml = '<div class="sc-effect-track">';
      for (var d = 0; d < chassis.tiers.length; d++) {
        var tier = chassis.tiers[d];
        dmgHtml +=
          '<div class="sc-effect-row">' +
            '<span class="sc-effect-range">' + _esc(tier.range) + '</span>' +
            '<span class="sc-effect-desc">' + _esc(tier.label) + ' \u2014 ' + _esc(String(tier.damage)) + ' Dmg</span>' +
          '</div>';
      }
      dmgHtml += '</div>';
    }

    var gambitsHtml = '';
    if (weaponDef.gambits && weaponDef.gambits.length) {
      for (var g = 0; g < weaponDef.gambits.length; g++) {
        gambitsHtml += _buildGambitCard(weaponDef.gambits[g], STATION_COLORS.station_gunner);
      }
    }

    var arcBadge = mount.arc ? '<span class="sc-weapon-arc">' + _esc(mount.arc) + '</span>' : '';
    var statusBadge = '<span class="sc-weapon-status" style="color:' + (STATUS_COLORS[mount.status] || '#22c55e') + ';">' + _esc(STATUS_LABELS[mount.status] || mount.status) + '</span>';

    return (
      '<div class="sc-weapon-card">' +
        '<div class="sc-weapon-header">' +
          '<span class="sc-weapon-name">' + _esc(weaponDef.name) + '</span>' +
          '<span class="sc-weapon-mount-label">' + _esc(mount.label) + '</span>' +
        '</div>' +
        '<div class="sc-weapon-meta">' +
          '<span class="sc-weapon-chassis-label">' + _esc(weaponDef.chassisLabel) + '</span>' +
          '<span class="sc-weapon-power-die">Power: ' + _esc(weaponDef.powerDie) + '</span>' +
          (weaponDef.range ? '<span class="sc-weapon-range">Range: ' + _esc(weaponDef.range) + '</span>' : '') +
          arcBadge +
          statusBadge +
        '</div>' +
        traitsHtml +
        dmgHtml +
        gambitsHtml +
      '</div>'
    );
  }

  function _buildSystemsBar(ship) {
    if (!ship || !ship.systems) return '';
    var html = '<div class="sc-systems-bar">';
    for (var i = 0; i < SYSTEM_KEYS.length; i++) {
      var key = SYSTEM_KEYS[i];
      var sys = ship.systems[key];
      if (!sys) continue;
      var color = STATUS_COLORS[sys.status] || '#22c55e';
      var label = STATUS_LABELS[sys.status] || sys.status;
      html +=
        '<div class="sc-system-item">' +
          '<div class="sc-system-name">' + _esc(sys.name) + '</div>' +
          '<div class="sc-system-die">' + _esc(sys.baseDie) + '</div>' +
          '<div class="sc-system-status" style="color:' + color + ';">' + _esc(label) + '</div>' +
          '<div class="sc-system-indicator" style="background:' + color + ';"></div>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function _buildShipHeader(ship) {
    if (!ship) return '';
    var integ = ship.integrity || {};
    return (
      '<div class="sc-ship-header">' +
        '<div class="sc-ship-identity">' +
          '<span class="sc-ship-name">' + _esc(ship.name) + '</span>' +
          '<span class="sc-ship-class">' + _esc(ship.class) + '</span>' +
        '</div>' +
        '<div class="sc-ship-hull">' +
          '<span class="sc-hull-label">Hull Integrity</span>' +
          '<span class="sc-hull-value">' + (integ.current || 0) + ' / ' + (integ.max || 0) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildHudPanel(stationDef, seatInfo, myCharId, mini) {
    var stationId = stationDef.id;
    var color = STATION_COLORS[stationId] || 'var(--color-accent-primary)';
    var icon = STATION_ICONS[stationId] || '\u2605';
    var claimed = !!seatInfo;
    var claimedByMe = claimed && seatInfo.characterId === myCharId;

    var cls = 'sc-hud-panel';
    if (mini) cls += ' sc-hud-mini';
    if (claimedByMe) cls += ' sc-hud-mine';
    else if (claimed) cls += ' sc-hud-claimed';

    var occupantHtml = '';
    if (claimed) {
      occupantHtml = '<div class="sc-hud-occupant">' + _esc(seatInfo.characterName) + '</div>';
    }

    var actionHtml = '';
    if (!mini) {
      if (!claimed) {
        actionHtml = '<button class="sc-seat-claim-btn sc-hud-btn" data-station-id="' + _esc(stationId) + '">ENGAGE</button>';
      } else if (claimedByMe) {
        actionHtml = '<button class="sc-seat-release-btn sc-hud-btn" data-station-id="' + _esc(stationId) + '">DISENGAGE</button>';
      }
    }

    var disciplineHtml = mini ? '' :
      '<div class="sc-hud-discipline">' + _esc(stationDef.controlDiscipline) + ' (' + _esc(stationDef.controlArena) + ')</div>';

    var powerHtml = mini ? '' :
      '<div class="sc-hud-power">' + _esc(stationDef.powerSystems.join(' \u2022 ')) + '</div>';

    return (
      '<div class="' + cls + '" data-station-id="' + _esc(stationId) + '" style="--hud-color:' + color + ';">' +
        '<div class="sc-hud-corner sc-hud-tl"></div>' +
        '<div class="sc-hud-corner sc-hud-tr"></div>' +
        '<div class="sc-hud-corner sc-hud-bl"></div>' +
        '<div class="sc-hud-corner sc-hud-br"></div>' +
        '<div class="sc-hud-icon">' + icon + '</div>' +
        '<div class="sc-hud-name">' + _esc(stationDef.name) + '</div>' +
        disciplineHtml +
        powerHtml +
        occupantHtml +
        actionHtml +
      '</div>'
    );
  }

  function _linkGambitsToActions(stationDef) {
    var gambits = stationDef.gambits || [];
    var actions = (stationDef.actions || []).concat(stationDef.reactions || []);
    var map = {};
    var unlinked = [];
    for (var g = 0; g < gambits.length; g++) {
      var gambit = gambits[g];
      var rule = (gambit.rule || '').toLowerCase();
      var linked = false;
      for (var a = 0; a < actions.length; a++) {
        var actName = (actions[a].name || '').toLowerCase();
        if (actName && rule.indexOf(actName.toLowerCase()) !== -1) {
          var aid = actions[a].id;
          if (!map[aid]) map[aid] = [];
          map[aid].push(gambit);
          linked = true;
        }
      }
      if (!linked) unlinked.push(gambit);
    }
    return { map: map, unlinked: unlinked };
  }

  function _buildStationDetail(stationDef) {
    var stationId = stationDef.id;
    var color = STATION_COLORS[stationId] || 'var(--color-accent-primary)';
    var icon = STATION_ICONS[stationId] || '\u2605';
    var gambitLinks = _linkGambitsToActions(stationDef);

    var html = '<div class="sc-station-detail">';

    html +=
      '<div class="sc-detail-header" style="--hud-color:' + color + ';">' +
        '<span class="sc-detail-icon">' + icon + '</span>' +
        '<span class="sc-detail-name">' + _esc(stationDef.name) + ' Station</span>' +
        '<button class="sc-detail-release-btn">DISENGAGE</button>' +
      '</div>';

    html += '<div class="sc-detail-meta">' +
      '<span class="sc-detail-control">' + _esc(stationDef.controlDiscipline) + ' (' + _esc(stationDef.controlArena) + ')</span>' +
      '<span class="sc-detail-power">' + _esc(stationDef.powerSystems.join(' \u2022 ')) + '</span>' +
    '</div>';

    if (stationDef.actions && stationDef.actions.length) {
      html += '<div class="sc-detail-section"><div class="sc-section-label">Actions</div>';
      for (var a = 0; a < stationDef.actions.length; a++) {
        var action = stationDef.actions[a];
        html += _buildActionCard(action, color);
        var linked = gambitLinks.map[action.id];
        if (linked) {
          for (var lg = 0; lg < linked.length; lg++) {
            html += '<div class="sc-gambit-inline">' + _buildGambitCard(linked[lg], color) + '</div>';
          }
        }
      }
      html += '</div>';
    }

    if (stationId === 'station_gunner' && _state.ship && _state.ship.weapons) {
      html += '<div class="sc-detail-section"><div class="sc-section-label">Weapon Mounts</div>';
      for (var w = 0; w < _state.ship.weapons.length; w++) {
        var mount = _state.ship.weapons[w];
        var weaponDef = null;
        for (var wd = 0; wd < _state.weapons.length; wd++) {
          if (_state.weapons[wd].id === mount.weaponId) {
            weaponDef = _state.weapons[wd];
            break;
          }
        }
        html += _buildWeaponCard(mount, weaponDef, _state.chassis);
      }
      html += '</div>';
    }

    if (stationDef.reactions && stationDef.reactions.length) {
      html += '<div class="sc-detail-section"><div class="sc-section-label">Reactions</div>';
      for (var r = 0; r < stationDef.reactions.length; r++) {
        var reaction = stationDef.reactions[r];
        html += _buildReactionCard(reaction, color);
        var rLinked = gambitLinks.map[reaction.id];
        if (rLinked) {
          for (var rg = 0; rg < rLinked.length; rg++) {
            html += '<div class="sc-gambit-inline">' + _buildGambitCard(rLinked[rg], color) + '</div>';
          }
        }
      }
      html += '</div>';
    }

    if (gambitLinks.unlinked.length) {
      html += '<div class="sc-detail-section"><div class="sc-section-label">Gambits</div>';
      for (var ug = 0; ug < gambitLinks.unlinked.length; ug++) {
        html += _buildGambitCard(gambitLinks.unlinked[ug], color);
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  var _minimized = false;

  function _ensureFloatingIndicator() {
    var existing = document.getElementById('sc-floating-indicator');
    if (!_state.active) {
      if (existing) existing.remove();
      return;
    }
    if (!_minimized) {
      if (existing) existing.style.display = 'none';
      return;
    }
    if (!existing) {
      existing = document.createElement('button');
      existing.id = 'sc-floating-indicator';
      existing.className = 'sc-floating-indicator';
      existing.innerHTML = '\u2726 SHIP COMBAT';
      existing.addEventListener('click', function () {
        _minimized = false;
        render();
      });
      document.body.appendChild(existing);
    }
    existing.style.display = 'flex';
  }

  function render() {
    var mount = _getMount();
    if (!mount) return;

    if (!_state.active) {
      mount.innerHTML = '';
      mount.style.display = 'none';
      _ensureFloatingIndicator();
      return;
    }

    if (_minimized) {
      mount.style.display = 'none';
      _ensureFloatingIndicator();
      return;
    }

    mount.style.display = 'block';
    _ensureFloatingIndicator();
    _state.myCharacterId = _getMyCharacterId();
    _state.myStationId = _findMyStation();

    var myStationDef = null;
    if (_state.myStationId) {
      for (var s = 0; s < _state.stations.length; s++) {
        if (_state.stations[s].id === _state.myStationId) {
          myStationDef = _state.stations[s];
          break;
        }
      }
    }

    var html = '<div class="sc-overlay">';

    html += '<div class="sc-overlay-header">' +
      '<span class="sc-overlay-title">STARSHIP COMBAT</span>' +
      '<button class="sc-minimize-btn" title="Minimize overlay">\u2014</button>' +
    '</div>';

    html += _buildShipHeader(_state.ship);
    html += _buildSystemsBar(_state.ship);

    if (myStationDef) {
      var leftPanels = [];
      var rightPanels = [];
      var otherCount = 0;
      for (var oi = 0; oi < _state.stations.length; oi++) {
        var ost = _state.stations[oi];
        if (ost.id === _state.myStationId) continue;
        var oSeat = _state.seats[ost.id] || null;
        if (otherCount < 2) {
          leftPanels.push(_buildHudPanel(ost, oSeat, _state.myCharacterId, true));
        } else {
          rightPanels.push(_buildHudPanel(ost, oSeat, _state.myCharacterId, true));
        }
        otherCount++;
      }

      html += '<div class="sc-cockpit-seated">';
      html += '<div class="sc-cockpit-wing sc-cockpit-left">' + leftPanels.join('') + '</div>';
      html += '<div class="sc-cockpit-center">' + _buildStationDetail(myStationDef) + '</div>';
      html += '<div class="sc-cockpit-wing sc-cockpit-right">' + rightPanels.join('') + '</div>';
      html += '</div>';
    } else {
      html += '<div class="sc-hud-grid">';
      for (var i = 0; i < _state.stations.length; i++) {
        var st = _state.stations[i];
        var seatInfo = _state.seats[st.id] || null;
        html += _buildHudPanel(st, seatInfo, _state.myCharacterId, false);
      }
      html += '</div>';
    }

    html += '</div>';
    mount.innerHTML = html;
  }

  function _onSync(data) {
    if (!data.active) {
      _state.active = false;
      render();
      return;
    }
    _state.active = true;
    _state.ship = data.ship || _state.ship;
    _state.stations = data.stations || _state.stations;
    _state.weapons = data.weapons || _state.weapons;
    _state.hardware = data.hardware || _state.hardware;
    _state.chassis = data.chassis || _state.chassis;
    _state.seats = data.seats || _state.seats;
    render();
  }

  function _onSeatsUpdate(data) {
    _state.seats = data.seats || {};
    render();
  }

  function _initSocketListeners() {
    var socket = window._socket;
    if (!socket) {
      setTimeout(_initSocketListeners, 500);
      return;
    }

    socket.on('shipcombat:sync', _onSync);
    socket.on('shipcombat:seats_update', _onSeatsUpdate);

    socket.on('connect', function () {
      socket.emit('shipcombat:request');
    });

    socket.emit('shipcombat:request');
  }

  function _handleClick(e) {
    var socket = window._socket;
    if (!socket) return;

    var claimBtn = e.target.closest('.sc-seat-claim-btn');
    if (claimBtn) {
      var stationId = claimBtn.getAttribute('data-station-id');
      if (stationId) {
        socket.emit('shipcombat:claim_seat', { stationId: stationId });
      }
      return;
    }

    var releaseBtn = e.target.closest('.sc-seat-release-btn') || e.target.closest('.sc-detail-release-btn');
    if (releaseBtn) {
      socket.emit('shipcombat:release_seat');
      return;
    }

    var minimizeBtn = e.target.closest('.sc-minimize-btn');
    if (minimizeBtn) {
      _minimized = true;
      render();
      return;
    }

    var collapseToggle = e.target.closest('.sc-collapse-toggle');
    if (collapseToggle) {
      var card = collapseToggle.closest('.sc-collapsible');
      if (card) {
        card.classList.toggle('is-open');
      }
      return;
    }

    var gambitToggle = e.target.closest('.sc-gambit-toggle');
    if (gambitToggle) {
      var block = gambitToggle.closest('.sc-gambit-block');
      if (block) {
        block.classList.toggle('is-open');
      }
      return;
    }
  }

  function init() {
    var mount = _getMount();
    if (!mount) return;
    mount.style.display = 'none';

    document.addEventListener('click', _handleClick);
    _initSocketListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StarshipCombat = {
    render: render,
    getState: function () { return _state; }
  };
}());

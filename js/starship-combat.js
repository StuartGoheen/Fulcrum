(function () {
  'use strict';

  var TIER_RANGES = ['0\u20133', '4\u20137', '8+'];
  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];
  var STATUS_CYCLE = ['operational', 'impaired', 'debilitated', 'disabled'];

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
    disabled:     'Disabled',
  };

  var STATUS_COLORS = {
    operational:  '#22c55e',
    impaired:     '#f59e0b',
    debilitated:  '#ef4444',
    disabled:     '#6b7280',
  };

  var POWER_ALIAS = {
    'weapon mount die': 'weapon_mounts',
    'weapon mounts':    'weapon_mounts',
    'handling':         'handling',
    'engines':          'engines',
    'shields':          'shields',
    'sensors':          'sensors',
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

  function _dieIndex(dieStr) {
    return DIE_ORDER.indexOf(dieStr.toUpperCase());
  }

  function _dieImg(dieType, extraClass) {
    var cls = 'armory-weapon-disc-die';
    if (extraClass) cls += ' ' + extraClass;
    return '<img src="/assets/' + dieType.toLowerCase() + '.png" alt="' + _esc(dieType) + '" class="' + cls + '">';
  }

  function _getCharacter() {
    if (window.CharacterPanel && window.CharacterPanel.currentChar) {
      return window.CharacterPanel.currentChar;
    }
    return null;
  }

  function _parseControl(controlStr) {
    if (!controlStr) return null;
    var m = controlStr.match(/^(.+?)\s*\((.+?)\)$/);
    if (!m) return null;
    var discName = m[1].trim();
    var arenaName = m[2].trim();
    var discId = discName.toLowerCase().replace(/\s+/g, '_');
    var arenaId = arenaName.toLowerCase().replace(/\s+/g, '_');
    return { discId: discId, arenaId: arenaId };
  }

  function _getEffectiveDisciplineDie(char, arenaId, discId) {
    var arenas = char.arenas || [];
    var arenaObj = null;
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id === arenaId) { arenaObj = arenas[i]; break; }
    }
    if (!arenaObj) return null;
    var discs = arenaObj.disciplines || [];
    var discObj = null;
    for (var j = 0; j < discs.length; j++) {
      if (discs[j].id === discId) { discObj = discs[j]; break; }
    }
    if (!discObj) return null;
    var baseIdx = _dieIndex(discObj.die.toUpperCase());
    if (baseIdx < 0) return discObj.die.toUpperCase();
    var discOffset = window.CharacterPanel ? window.CharacterPanel.getDiscEffectOffset(discId, arenaId) : 0;
    var effIdx = baseIdx + (discOffset || 0);
    if (effIdx < 0) effIdx = 0;
    if (effIdx > 4) effIdx = 4;
    return DIE_ORDER[effIdx];
  }

  function _resolveSystemKey(powerStr) {
    if (!powerStr) return null;
    var lower = powerStr.toLowerCase().trim();
    if (POWER_ALIAS[lower]) return POWER_ALIAS[lower];
    var underscored = lower.replace(/\s+/g, '_');
    if (_state.ship && _state.ship.systems && _state.ship.systems[underscored]) return underscored;
    return null;
  }

  function _getEffectivePowerDie(systemKey) {
    if (!_state.ship || !_state.ship.systems) return null;
    var normalKey = _resolveSystemKey(systemKey);
    if (!normalKey) return null;
    var sys = _state.ship.systems[normalKey];
    if (!sys) return null;
    var baseIdx = _dieIndex(sys.baseDie);
    if (baseIdx < 0) return null;
    var stepDown = 0;
    if (sys.status === 'impaired') stepDown = 1;
    else if (sys.status === 'debilitated') stepDown = 2;
    else if (sys.status === 'disabled') return { die: null, status: 'disabled', key: normalKey };
    var effIdx = baseIdx - stepDown;
    if (effIdx < 0) return { die: null, status: sys.status, key: normalKey };
    return { die: DIE_ORDER[effIdx], status: sys.status, key: normalKey };
  }

  function _buildControlDice(action) {
    var parsed = _parseControl(action.control);
    if (!parsed) return '';
    var char = _getCharacter();
    if (!char) return '';
    var discDie = _getEffectiveDisciplineDie(char, parsed.arenaId, parsed.discId);
    if (!discDie) return '';
    return (
      '<div class="sc-die-pair sc-die-control" title="' + _esc(action.control) + '">' +
        _dieImg(discDie) +
      '</div>'
    );
  }

  function _buildPowerDie(action) {
    if (!action.power) return '';
    var result = _getEffectivePowerDie(action.power);
    if (!result) return '';
    var sysKey = result.key;

    var dieHtml;
    if (result.status === 'disabled') {
      dieHtml =
        '<span class="char-disc-2die-stack below-d4" title="DISABLED — ' + _esc(action.power) + '">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-back" alt="D4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-front" alt="D4">' +
        '</span>';
    } else if (!result.die) {
      dieHtml =
        '<span class="char-disc-2die-stack below-d4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-back" alt="D4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-front" alt="D4">' +
        '</span>';
    } else {
      dieHtml = _dieImg(result.die);
    }

    return (
      '<div class="sc-die-pair sc-die-power sc-power-die-click" ' +
        'data-system-key="' + _esc(sysKey) + '" ' +
        'title="Power: ' + _esc(action.power) + ' (' + _esc(STATUS_LABELS[result.status] || result.status) + ') — Click to cycle">' +
        dieHtml +
      '</div>'
    );
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

  var TIER_LABELS = { 1: 'Fleeting', 2: 'Masterful', 3: 'Legendary' };

  function _buildEffectTrack(effectArr) {
    if (!effectArr || !effectArr.length) return '';
    var html = '<div class="manv-effect-track">';
    for (var e = 0; e < effectArr.length; e++) {
      var tier = effectArr[e];
      var range = tier.range || TIER_RANGES[e] || String(e);
      var label = tier.label || TIER_LABELS[tier.tier] || '';
      html +=
        '<div class="manv-effect-row">' +
          '<span class="manv-tier-label">' + _esc(label) + '</span>' +
          '<span class="manv-tier-range">' + _esc(range) + '</span>' +
          '<span class="manv-tier-desc">' + _linkify(tier.description) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function _pipBadge(actionType) {
    var info = ACTION_TYPE_LABELS[actionType];
    if (!info) return '';
    return '<span class="manv-pip-badge manv-pip-badge-header" style="background:' + info.color + ';">' + info.pip + '</span>';
  }

  function _buildActionCard(action, stationColor, gambitsHtml) {
    var metaHtml = '';
    if (action.control || action.power) {
      metaHtml = '<div class="manv-meta">';
      if (action.control) metaHtml += '<span class="manv-rolled-badge">' + _esc(action.control) + '</span>';
      if (action.power) metaHtml += '<span class="manv-rolled-badge">Power: ' + _esc(action.power) + '</span>';
      metaHtml += '</div>';
    }

    var descHtml = '<div class="manv-desc-text">' + _linkify(action.description) + '</div>';

    var riskHtml = '';
    if (action.risk) {
      riskHtml =
        '<div class="manv-risk-block">' +
          '<span class="manv-risk-label">Risk</span>' +
          '<span class="manv-risk-text">' + _linkify(action.risk) + '</span>' +
        '</div>';
    }

    var effectHtml = _buildEffectTrack(action.effect);

    var diceHtml = '';
    var controlDice = _buildControlDice(action);
    var powerDice = _buildPowerDie(action);
    if (controlDice || powerDice) {
      var sep = (controlDice && powerDice) ? '<span class="sc-dice-sep">+</span>' : '';
      diceHtml = '<div class="armory-weapon-disc sc-action-dice">' + controlDice + sep + powerDice + '</div>';
    }

    return (
      '<div class="manv-card sc-manv-card" data-action-id="' + _esc(action.id) + '">' +
        '<div class="manv-header" style="border-left:2px solid ' + stationColor + ';" role="button" tabindex="0">' +
          '<div class="manv-header-left" style="flex-direction:row;align-items:center;gap:5px;">' +
            _pipBadge(action.type) +
            '<span class="manv-name">' + _esc(action.name) + '</span>' +
          '</div>' +
          diceHtml +
        '</div>' +
        '<div class="manv-body">' +
          metaHtml +
          descHtml +
          effectHtml +
          riskHtml +
          (gambitsHtml || '') +
        '</div>' +
      '</div>'
    );
  }

  function _buildReactionCard(reaction, stationColor, gambitsHtml) {
    var triggerHtml = reaction.trigger
      ? '<div class="manv-risk-block" style="border-top:none;padding-top:0;margin-top:0;">' +
          '<span class="manv-risk-label" style="color:var(--color-accent-cyan,#06b6d4);">Trigger</span>' +
          '<span class="manv-risk-text">' + _linkify(reaction.trigger) + '</span>' +
        '</div>'
      : '';

    var ruleHtml = '';
    if (reaction.rule) {
      ruleHtml = '<div class="manv-desc-text">' + _linkify(reaction.rule) + '</div>';
    } else if (reaction.description) {
      ruleHtml = '<div class="manv-desc-text">' + _linkify(reaction.description) + '</div>';
    }

    var costHtml = '';
    if (reaction.cost) {
      var lowerCost = reaction.cost.toLowerCase();
      var isFreeReaction = (lowerCost.indexOf('free (defense reaction)') !== -1 || lowerCost.indexOf('free (reaction)') !== -1 || lowerCost === 'free');
      if (!isFreeReaction) {
        costHtml = '<span class="manv-rolled-badge">' + _esc(reaction.cost) + '</span>';
      }
    }

    var diceHtml = '';
    var controlDice = _buildControlDice(reaction);
    var powerDice = _buildPowerDie(reaction);
    if (controlDice || powerDice) {
      var sep = (controlDice && powerDice) ? '<span class="sc-dice-sep">+</span>' : '';
      diceHtml = '<div class="armory-weapon-disc sc-action-dice">' + controlDice + sep + powerDice + '</div>';
    }

    return (
      '<div class="manv-card sc-manv-card" data-action-id="' + _esc(reaction.id) + '">' +
        '<div class="manv-header" style="border-left:2px solid ' + stationColor + ';" role="button" tabindex="0">' +
          '<div class="manv-header-left" style="flex-direction:row;align-items:center;gap:5px;">' +
            _pipBadge(reaction.type) +
            '<span class="manv-name">' + _esc(reaction.name) + '</span>' +
          '</div>' +
          '<div class="sc-header-right">' +
            diceHtml +
            (costHtml ? '<div>' + costHtml + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="manv-body">' +
          triggerHtml +
          ruleHtml +
          (gambitsHtml || '') +
        '</div>' +
      '</div>'
    );
  }

  function _buildGambitCard(gambit) {
    return (
      '<div class="armory-gambit-block manv-gambit-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label">Gambit</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(gambit.name) + '</span>' +
          '<span class="manv-gambit-req-die">' + _esc(gambit.unlockDie) + '+</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          '<div class="manv-gambit-text">' + _linkify(gambit.rule) + '</div>' +
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
      dmgHtml = '<div class="manv-effect-track">';
      for (var d = 0; d < chassis.tiers.length; d++) {
        var tier = chassis.tiers[d];
        dmgHtml +=
          '<div class="manv-effect-row">' +
            '<span class="manv-tier-label">' + _esc(tier.label) + '</span>' +
            '<span class="manv-tier-range">' + _esc(tier.range) + '</span>' +
            '<span class="manv-tier-desc">' + _esc(String(tier.damage)) + ' Dmg</span>' +
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

  function _buildSystemDieHtml(sys) {
    var baseIdx = _dieIndex(sys.baseDie);
    if (baseIdx < 0) return '<span>' + _esc(sys.baseDie) + '</span>';
    var stepDown = 0;
    if (sys.status === 'impaired') stepDown = 1;
    else if (sys.status === 'debilitated') stepDown = 2;
    else if (sys.status === 'disabled') {
      return (
        '<span class="char-disc-2die-stack below-d4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-back" alt="D4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-front" alt="D4">' +
        '</span>'
      );
    }
    var effIdx = baseIdx - stepDown;
    if (effIdx < 0) {
      return (
        '<span class="char-disc-2die-stack below-d4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-back" alt="D4">' +
          '<img src="/assets/d4.png" class="armory-weapon-disc-die char-arena-2die-front" alt="D4">' +
        '</span>'
      );
    }
    var dieName = DIE_ORDER[effIdx];
    return '<img src="/assets/' + dieName.toLowerCase() + '.png" alt="' + _esc(dieName) + '" class="sc-system-die-img">';
  }

  function _buildSystemPill(sys) {
    if (sys.status === 'impaired') {
      return '<div class="char-arena-trauma-pill trauma-pill-impaired">Impaired</div>';
    } else if (sys.status === 'debilitated') {
      return '<div class="char-arena-trauma-pill trauma-pill-debilitated">Debilitated</div>';
    } else if (sys.status === 'disabled') {
      return '<div class="char-arena-trauma-pill trauma-pill-disabled">Disabled</div>';
    }
    return '';
  }

  function _buildSystemsBar(ship) {
    if (!ship || !ship.systems) return '';
    var html = '<div class="sc-systems-bar">';
    for (var i = 0; i < SYSTEM_KEYS.length; i++) {
      var key = SYSTEM_KEYS[i];
      var sys = ship.systems[key];
      if (!sys) continue;
      var color = STATUS_COLORS[sys.status] || '#22c55e';
      html +=
        '<div class="sc-system-item sc-system-clickable" data-system-key="' + _esc(key) + '" ' +
          'title="' + _esc(sys.name) + ' — ' + _esc(STATUS_LABELS[sys.status] || sys.status) + ' (click to cycle)">' +
          '<div class="sc-system-name">' + _esc(sys.name) + '</div>' +
          '<div class="sc-system-die-wrap">' +
            _buildSystemDieHtml(sys) +
          '</div>' +
          _buildSystemPill(sys) +
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
        var gambitsHtml = '';
        var linked = gambitLinks.map[action.id];
        if (linked) {
          for (var lg = 0; lg < linked.length; lg++) {
            gambitsHtml += _buildGambitCard(linked[lg]);
          }
        }
        html += _buildActionCard(action, color, gambitsHtml);
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
        var rGambitsHtml = '';
        var rLinked = gambitLinks.map[reaction.id];
        if (rLinked) {
          for (var rg = 0; rg < rLinked.length; rg++) {
            rGambitsHtml += _buildGambitCard(rLinked[rg]);
          }
        }
        html += _buildReactionCard(reaction, color, rGambitsHtml);
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

  function _migrateSystemStatuses(ship) {
    if (!ship || !ship.systems) return;
    for (var key in ship.systems) {
      if (ship.systems[key] && ship.systems[key].status === 'offline') {
        ship.systems[key].status = 'disabled';
      }
    }
  }

  function _onSync(data) {
    if (!data.active) {
      _state.active = false;
      render();
      return;
    }
    _state.active = true;
    if (data.ship) _migrateSystemStatuses(data.ship);
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

  function _cycleSystemStatus(sysKey, socket) {
    if (!sysKey || !_state.ship || !_state.ship.systems || !_state.ship.systems[sysKey]) return;
    var curStatus = _state.ship.systems[sysKey].status || 'operational';
    var curIdx = STATUS_CYCLE.indexOf(curStatus);
    var nextIdx = (curIdx + 1) % STATUS_CYCLE.length;
    var newStatus = STATUS_CYCLE[nextIdx];
    _state.ship.systems[sysKey].status = newStatus;
    if (socket) {
      socket.emit('shipcombat:system_status', { systemKey: sysKey, status: newStatus });
    }
    render();
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

    var systemClick = e.target.closest('.sc-system-clickable');
    if (systemClick) {
      e.stopPropagation();
      var sysKey = systemClick.getAttribute('data-system-key');
      if (sysKey) {
        _cycleSystemStatus(sysKey, socket);
      }
      return;
    }

    var powerDieClick = e.target.closest('.sc-power-die-click');
    if (powerDieClick) {
      e.stopPropagation();
      var sysKey2 = powerDieClick.getAttribute('data-system-key');
      if (sysKey2) {
        _cycleSystemStatus(sysKey2, socket);
      }
      return;
    }

    var manvHeader = e.target.closest('.manv-header');
    if (manvHeader && manvHeader.closest('#shipcombat-overlay-mount')) {
      e.stopImmediatePropagation();
      var card = manvHeader.closest('.manv-card');
      if (!card) return;
      var isOpen = card.classList.contains('is-open');
      var allCards = document.querySelectorAll('#shipcombat-overlay-mount .sc-manv-card');
      for (var ci = 0; ci < allCards.length; ci++) {
        allCards[ci].classList.remove('is-open');
        var b = allCards[ci].querySelector('.manv-body');
        if (b) b.classList.remove('open');
      }
      if (!isOpen) {
        card.classList.add('is-open');
        var body = card.querySelector('.manv-body');
        if (body) body.classList.add('open');
      }
      return;
    }

    var gambitToggle = e.target.closest('.manv-gambit-toggle');
    if (gambitToggle && gambitToggle.closest('#shipcombat-overlay-mount')) {
      e.stopImmediatePropagation();
      var block = gambitToggle.closest('.manv-gambit-block');
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

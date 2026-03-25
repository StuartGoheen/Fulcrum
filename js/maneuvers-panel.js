(function () {
  'use strict';

  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];

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
    'locked on':   'condition_locked_on',
    'slowed':      'condition_slowed',
    'elusive':     'condition_elusive',
    'jammed':      'condition_jammed',
    'stimmed':     'stimmed',
    'natural recovery': 'natural_recovery',
  };

  var ARMOR_ENDURE_STEP = { none: -1, light: 0, medium: 1, heavy: 2 };
  var ARMOR_EVADE_STEP  = { none: 0,  light: 0, medium: -1, heavy: -2 };

  function _getEquippedArmorMods() {
    var armorData = window._equippedArmorData;
    if (!armorData) return { endureStep: 0, evadeStep: 0, hasArmor: false };
    var cat = armorData.category || 'light';
    var endureStep = ARMOR_ENDURE_STEP[cat] != null ? ARMOR_ENDURE_STEP[cat] : 0;
    var evadeStep  = ARMOR_EVADE_STEP[cat] != null ? ARMOR_EVADE_STEP[cat] : 0;
    if (armorData.evasionException) {
      evadeStep = 0;
    } else if (typeof armorData.evasionReduction === 'number' && evadeStep < 0) {
      evadeStep = Math.min(0, evadeStep + armorData.evasionReduction);
    }
    return { endureStep: endureStep, evadeStep: evadeStep, hasArmor: true };
  }

  function _steppedDie(baseDie, steps) {
    var idx = DIE_ORDER.indexOf(baseDie.toUpperCase());
    if (idx < 0) return baseDie;
    var eff = Math.max(0, Math.min(DIE_ORDER.length - 1, idx + steps));
    return DIE_ORDER[eff];
  }

  var ACTION_TYPE_ORDER = { 'Action': 0, 'Maneuver': 1, 'Exploit': 2, 'Defense': 3, 'Free': 4 };
  var ACTION_TYPE_LABELS = {
    'Action':   { pip: 'A', color: 'var(--color-accent-red, #ef4444)' },
    'Maneuver': { pip: 'M', color: 'var(--color-accent-amber, #f59e0b)' },
    'Exploit':  { pip: 'E', color: 'var(--color-accent-blue, #3b82f6)' },
    'Defense':  { pip: 'D', color: 'var(--color-accent-cyan, #06b6d4)' },
    'Free':     { pip: 'F', color: 'var(--color-accent-green, #22c55e)' },
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

  function _dieImg(dieType) {
    return '<img src="/assets/' + dieType.toLowerCase() + '.png" alt="' + _esc(dieType) + '" class="armory-weapon-disc-die">';
  }

  function _dieIndex(dieStr) {
    return DIE_ORDER.indexOf(dieStr.toUpperCase());
  }

  function _getBaseDisciplineDie(char, arenaId, disciplineId) {
    var arenas = char.arenas || [];
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id !== arenaId) continue;
      var discs = arenas[i].disciplines || [];
      for (var j = 0; j < discs.length; j++) {
        if (discs[j].id !== disciplineId) continue;
        return discs[j].die.toUpperCase();
      }
    }
    return null;
  }

  function _getEffectiveDisciplineDie(char, arenaId, disciplineId) {
    var baseDie = _getBaseDisciplineDie(char, arenaId, disciplineId);
    if (!baseDie) return null;
    var baseIdx = _dieIndex(baseDie);
    var discOffset = window.CharacterPanel ? window.CharacterPanel.getDiscEffectOffset(disciplineId, arenaId) : 0;
    var effIdx = baseIdx + (discOffset || 0);
    if (effIdx < 0) effIdx = 0;
    if (effIdx > 4) effIdx = 4;
    return DIE_ORDER[effIdx];
  }

  function _getEffectiveArenaDie(char, arenaId) {
    var trauma = window.CharacterPanel ? window.CharacterPanel.getArenaTrauma() : {};
    var traumaLevel  = (trauma && trauma[arenaId]) || 0;
    var effectOffset = window.CharacterPanel ? (window.CharacterPanel.getArenaEffectOffset(arenaId) || 0) : 0;
    var arenas = char.arenas || [];
    var arenaObj = null;
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id === arenaId) { arenaObj = arenas[i]; break; }
    }
    if (!arenaObj) return 'D4';
    var baseIdx = _dieIndex(arenaObj.die.toUpperCase());
    var effIdx  = baseIdx - traumaLevel + effectOffset;
    if (effIdx < 0) effIdx = 0;
    if (effIdx > 4) effIdx = 4;
    return DIE_ORDER[effIdx];
  }

  function _buildEffectTrack(effectArr) {
    if (!effectArr || !effectArr.length) return '';
    var html = '<div class="armory-effect-track manv-effect-track">';
    for (var e = 0; e < effectArr.length; e++) {
      var tier = effectArr[e];
      var range = tier.range || TIER_RANGES[e] || String(e);
      html +=
        '<div class="armory-effect-row manv-effect-row">' +
          '<span class="armory-effect-range">' + _esc(range) + '</span>' +
          '<span class="manv-tier-desc">' + _linkify(tier.description) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function _pipBadge(actionType, customPip) {
    if (customPip && ACTION_TYPE_LABELS[customPip]) {
      var customInfo = ACTION_TYPE_LABELS[customPip];
      return '<span class="manv-pip-badge" style="background:' + customInfo.color + ';">' + customInfo.pip + '</span>';
    }
    var info = ACTION_TYPE_LABELS[actionType];
    if (!info) return '';
    return '<span class="manv-pip-badge" style="background:' + info.color + ';">' + info.pip + '</span>';
  }

  function _buildUniversalActionCard(action, char) {
    var tagHtml = '';
    if (action.tags && action.tags.length) {
      tagHtml = ' <span class="manv-arena-tag">' + action.tags.map(_esc).join(' ') + '</span>';
    }

    var discDieHtml = '';
    if (action.discipline && action.arena && char) {
      var discDie  = _getEffectiveDisciplineDie(char, action.arena, action.discipline);
      var arenaDie = _getEffectiveArenaDie(char, action.arena);
      if (discDie && arenaDie) {
        var armorMods = _getEquippedArmorMods();
        if (action.discipline === 'endure' && action.arena === 'physique') {
          arenaDie = _steppedDie(arenaDie, armorMods.endureStep);
        } else if (action.discipline === 'evasion' && action.arena === 'reflex') {
          arenaDie = _steppedDie(arenaDie, armorMods.evadeStep);
        }
        discDieHtml =
          '<div class="armory-weapon-disc">' +
            _dieImg(discDie) +
            '<span class="armory-weapon-disc-sep">/</span>' +
            _dieImg(arenaDie) +
          '</div>';
      }
    }

    var metaHtml =
      '<div class="armory-weapon-meta manv-meta">' +
        '<span class="armory-weapon-chassis">' + _esc(action.actionType) + tagHtml + '</span>' +
        (action.rolled ? '<span class="manv-rolled-badge">Rolled</span>' : action.rolledWhenEngaged ? '<span class="manv-rolled-badge manv-conditional">Diceless / Rolled if Engaged</span>' : '<span class="manv-rolled-badge manv-diceless">Diceless</span>') +
      '</div>';

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

    var noteHtml = '';
    if (action.note) {
      noteHtml = '<div class="manv-note">' + _linkify(action.note) + '</div>';
    }
    if (action.painkillerProtocol) {
      noteHtml += '<div class="manv-note manv-note-special"><strong>Painkiller Protocol:</strong> ' + _linkify(action.painkillerProtocol) + '</div>';
    }

    return (
      '<div class="manv-card manv-universal-card" data-action-id="' + _esc(action.id) + '">' +
        '<div class="manv-header">' +
          '<div class="manv-header-left">' +
            _pipBadge(action.actionType, action.pip) +
            '<span class="manv-name">' + _esc(action.name) + '</span>' +
          '</div>' +
          discDieHtml +
        '</div>' +
        '<div class="manv-body">' +
          metaHtml +
          descHtml +
          riskHtml +
          effectHtml +
          noteHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildForceCard(force, char) {
    var discDieHtml = '';
    if (force.discipline && force.arena && char) {
      var fDiscDie  = _getEffectiveDisciplineDie(char, force.arena, force.discipline);
      var fArenaDie = _getEffectiveArenaDie(char, force.arena);
      if (fDiscDie && fArenaDie) {
        discDieHtml =
          '<div class="armory-weapon-disc">' +
            _dieImg(fDiscDie) +
            '<span class="armory-weapon-disc-sep">/</span>' +
            _dieImg(fArenaDie) +
          '</div>';
      }
    }

    var tagHtml = '';
    if (force.tags && force.tags.length) {
      tagHtml = ' <span class="manv-arena-tag">' + force.tags.map(_esc).join(' ') + '</span>';
    }

    var metaHtml =
      '<div class="armory-weapon-meta manv-meta">' +
        '<span class="armory-weapon-chassis">' + _esc(force.actionType) + tagHtml + '</span>' +
        '<span class="manv-rolled-badge">Rolled</span>' +
      '</div>';

    var descHtml = '<div class="manv-desc-text">' + _linkify(force.description) + '</div>';

    var riskHtml = '';
    if (force.risk) {
      riskHtml =
        '<div class="manv-risk-block">' +
          '<span class="manv-risk-label">Risk</span>' +
          '<span class="manv-risk-text">' + _linkify(force.risk) + '</span>' +
        '</div>';
    }

    var effectHtml = _buildEffectTrack(force.effect);

    return (
      '<div class="manv-card manv-force-card" data-action-id="' + _esc(force.id) + '">' +
        '<div class="manv-header">' +
          '<div class="manv-header-left">' +
            _pipBadge(force.actionType) +
            '<span class="manv-name">' + _esc(force.name) + '</span>' +
          '</div>' +
          discDieHtml +
        '</div>' +
        '<div class="manv-body">' +
          metaHtml +
          descHtml +
          riskHtml +
          effectHtml +
        '</div>' +
      '</div>'
    );
  }

  function _getQualifiedGambitsForAction(actionId, disciplineGambits, char) {
    var result = [];
    var keys = Object.keys(disciplineGambits);
    for (var k = 0; k < keys.length; k++) {
      var set = disciplineGambits[keys[k]];
      if (set.placeholder) continue;
      var gambits = set.gambits || [];
      for (var g = 0; g < gambits.length; g++) {
        var gambit = gambits[g];
        if (gambit.modifiesAction !== actionId) continue;
        var baseDie = _getBaseDisciplineDie(char, set.arenaId, set.disciplineId);
        if (!baseDie) continue;
        if (_dieIndex(baseDie) >= _dieIndex(gambit.requiredDie)) {
          result.push({
            gambit: gambit,
            disciplineName: set.name,
            disciplineId: set.disciplineId,
            arenaId: set.arenaId,
          });
        }
      }
    }
    result.sort(function (a, b) {
      var da = _dieIndex(a.gambit.requiredDie);
      var db = _dieIndex(b.gambit.requiredDie);
      if (da !== db) return da - db;
      return a.disciplineName < b.disciplineName ? -1 : 1;
    });
    return result;
  }

  function _buildDisciplineGambitBlock(entry) {
    var gambit = entry.gambit;
    return (
      '<div class="armory-gambit-block manv-gambit-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label">' + _esc(entry.disciplineName) + '</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(gambit.name) + '</span>' +
          '<span class="manv-gambit-req-die">' + _dieImg(gambit.requiredDie) + '</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          '<div class="armory-gambit-text">' + _linkify(gambit.rule) + '</div>' +
          '<div class="manv-gambit-duration">' + _esc(gambit.duration) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildEngineGambitBlock(gambit, engineName) {
    return (
      '<div class="armory-gambit-block manv-gambit-block engine-gambit-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label engine-gambit-label">' + _esc(engineName) + '</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(gambit.name) + '</span>' +
          '<span class="engine-gambit-tag">' + _esc(gambit.arenaTag) + '</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          '<div class="engine-gambit-cost">' + _esc(gambit.cost) + '</div>' +
          '<div class="armory-gambit-text">' + _linkify(gambit.rule) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildGearGambitBlock(gambit, gearName) {
    return (
      '<div class="armory-gambit-block manv-gambit-block engine-gambit-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label engine-gambit-label">Gear</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(gambit.name) + '</span>' +
          '<span class="engine-gambit-tag">' + _esc(gearName) + '</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          '<div class="armory-gambit-text">' + _linkify(gambit.rule) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildKitGambitBlock(ability, kitName) {
    return (
      '<div class="armory-gambit-block manv-gambit-block engine-gambit-block kit-gambit-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label engine-gambit-label kit-gambit-label">' + _esc(kitName) + '</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(ability.name) + '</span>' +
          (ability.arenaTag ? '<span class="engine-gambit-tag">' + _esc(ability.arenaTag) + '</span>' : '') +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          (ability.cost ? '<div class="engine-gambit-cost">' + _esc(ability.cost) + '</div>' : '') +
          '<div class="armory-gambit-text">' + _linkify(ability.rule) + '</div>' +
          (ability.buyOff
            ? '<div class="kit-gambit-buyoff">Buy-Off: ' + _linkify(ability.buyOff) + '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  function _getGearGambits(actionId, activeGear) {
    var result = [];
    for (var i = 0; i < activeGear.length; i++) {
      var entry = activeGear[i];
      var gambits = entry.item.gambits || [];
      for (var g = 0; g < gambits.length; g++) {
        if (gambits[g].targetManeuver === actionId || gambits[g].modifiesAction === actionId) {
          result.push({ gambit: gambits[g], gearName: entry.item.name });
        }
      }
    }
    return result;
  }

  function _getEngineGambits(char, actionId) {
    var engine = char.engine;
    if (!engine || !engine.gambits) return [];
    return engine.gambits.filter(function (g) {
      return g.modifiesAction === actionId || (g.targetType === 'maneuver' && g.target === actionId);
    });
  }

  function _getKitGambits(char, actionId) {
    var result = [];
    var kits = char.kits || [];
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var abilities = kit.abilities || [];
      for (var ai = 0; ai < abilities.length; ai++) {
        var ab = abilities[ai];
        if (ab.tier > unlockedTier) continue;
        if (ab.type !== 'gambit') continue;
        if (ab.modifiesAction === actionId || (ab.targetType === 'maneuver' && ab.target === actionId)) {
          result.push({ ability: ab, kitName: kit.name });
        }
      }
    }
    return result;
  }

  function _getKitPassives(char, actionId) {
    var result = [];
    var kits = char.kits || [];
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var abilities = kit.abilities || [];
      for (var ai = 0; ai < abilities.length; ai++) {
        var ab = abilities[ai];
        if (ab.tier > unlockedTier) continue;
        if (ab.type !== 'passive') continue;
        if (!ab.modifiesAction) continue;
        if (ab.modifiesAction === actionId) {
          result.push({ ability: ab, kitName: kit.name });
        }
      }
    }
    return result;
  }

  function _buildKitPassiveBlock(ability, kitName) {
    var text = ability.shorthand || ability.rule;
    return (
      '<div class="armory-gambit-block manv-gambit-block manv-passive-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label manv-passive-label">' + _esc(kitName) + '</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(ability.name) + '</span>' +
          '<span class="manv-passive-badge">Passive</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          '<div class="armory-gambit-text">' + _linkify(text) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildActionWithGambits(action, data, char, activeGear) {
    var cardHtml = _buildUniversalActionCard(action, char);
    var gambitsHtml = '';

    var discGambits = _getQualifiedGambitsForAction(action.id, data.disciplineGambits, char);
    for (var g = 0; g < discGambits.length; g++) {
      gambitsHtml += _buildDisciplineGambitBlock(discGambits[g]);
    }

    var engineGambits = _getEngineGambits(char, action.id);
    for (var eg = 0; eg < engineGambits.length; eg++) {
      gambitsHtml += _buildEngineGambitBlock(engineGambits[eg], char.engine.name);
    }

    var gearGambits = _getGearGambits(action.id, activeGear || []);
    for (var gg = 0; gg < gearGambits.length; gg++) {
      gambitsHtml += _buildGearGambitBlock(gearGambits[gg].gambit, gearGambits[gg].gearName);
    }

    var kitGambits = _getKitGambits(char, action.id);
    for (var kg = 0; kg < kitGambits.length; kg++) {
      gambitsHtml += _buildKitGambitBlock(kitGambits[kg].ability, kitGambits[kg].kitName);
    }

    var kitPassives = _getKitPassives(char, action.id);
    for (var kp = 0; kp < kitPassives.length; kp++) {
      gambitsHtml += _buildKitPassiveBlock(kitPassives[kp].ability, kitPassives[kp].kitName);
    }

    if (gambitsHtml) {
      var insertPoint = cardHtml.lastIndexOf('</div></div>');
      cardHtml = cardHtml.substring(0, insertPoint) + gambitsHtml + '</div></div>';
    }

    return cardHtml;
  }

  function _buildForceCardWithGambits(force, data, char, activeGear) {
    var cardHtml = _buildForceCard(force, char);
    var gambitsHtml = '';

    var discGambits = _getQualifiedGambitsForAction(force.id, data.disciplineGambits, char);
    for (var g = 0; g < discGambits.length; g++) {
      gambitsHtml += _buildDisciplineGambitBlock(discGambits[g]);
    }

    var engineGambits = _getEngineGambits(char, force.id);
    for (var eg = 0; eg < engineGambits.length; eg++) {
      gambitsHtml += _buildEngineGambitBlock(engineGambits[eg], char.engine.name);
    }

    var gearGambits = _getGearGambits(force.id, activeGear || []);
    for (var gg = 0; gg < gearGambits.length; gg++) {
      gambitsHtml += _buildGearGambitBlock(gearGambits[gg].gambit, gearGambits[gg].gearName);
    }

    var kitGambits = _getKitGambits(char, force.id);
    for (var kg = 0; kg < kitGambits.length; kg++) {
      gambitsHtml += _buildKitGambitBlock(kitGambits[kg].ability, kitGambits[kg].kitName);
    }

    var kitPassives = _getKitPassives(char, force.id);
    for (var kp = 0; kp < kitPassives.length; kp++) {
      gambitsHtml += _buildKitPassiveBlock(kitPassives[kp].ability, kitPassives[kp].kitName);
    }

    if (gambitsHtml) {
      var insertPoint = cardHtml.lastIndexOf('</div></div>');
      cardHtml = cardHtml.substring(0, insertPoint) + gambitsHtml + '</div></div>';
    }

    return cardHtml;
  }

  function _getVocationManeuvers(char) {
    var result = [];
    var kits = char.kits || [];
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var abilities = kit.abilities || [];
      for (var ai = 0; ai < abilities.length; ai++) {
        var ab = abilities[ai];
        if (ab.tier > unlockedTier) continue;
        if (ab.type !== 'maneuver' && ab.type !== 'action') continue;
        result.push({ ability: ab, kitName: kit.name });
      }
    }
    return result;
  }

  function _buildVocationManeuverCard(ab, kitName, char) {
    var discDieHtml = '';
    if (ab.discipline && ab.arena && char) {
      var vDiscDie  = _getEffectiveDisciplineDie(char, ab.arena, ab.discipline);
      var vArenaDie = _getEffectiveArenaDie(char, ab.arena);
      if (vDiscDie && vArenaDie) {
        discDieHtml =
          '<div class="armory-weapon-disc">' +
            _dieImg(vDiscDie) +
            '<span class="armory-weapon-disc-sep">/</span>' +
            _dieImg(vArenaDie) +
          '</div>';
      }
    }

    var tagHtml = '';
    if (ab.tags && ab.tags.length) {
      tagHtml = ' <span class="manv-arena-tag">' + ab.tags.map(_esc).join(' ') + '</span>';
    }

    var actionTypeLabel = ab.type === 'action' ? 'Action' : 'Maneuver';

    var metaHtml =
      '<div class="armory-weapon-meta manv-meta">' +
        '<span class="armory-weapon-chassis">' + actionTypeLabel + tagHtml + '</span>' +
        '<span class="manv-rolled-badge manv-source-tag">' + _esc(kitName) + '</span>' +
        (ab.rolled ? '<span class="manv-rolled-badge">Rolled</span>' : '<span class="manv-rolled-badge manv-diceless">Diceless</span>') +
      '</div>';

    var descHtml = '<div class="manv-desc-text">' + _linkify(ab.rule) + '</div>';

    var riskHtml = '';
    if (ab.risk) {
      riskHtml =
        '<div class="manv-risk-block">' +
          '<span class="manv-risk-label">Risk</span>' +
          '<span class="manv-risk-text">' + _linkify(ab.risk) + '</span>' +
        '</div>';
    }

    var effectHtml = _buildEffectTrack(ab.effect);

    return (
      '<div class="manv-card manv-vocation-card" data-action-id="' + _esc(ab.id) + '">' +
        '<div class="manv-header">' +
          '<div class="manv-header-left">' +
            _pipBadge(actionTypeLabel) +
            '<span class="manv-name">' + _esc(ab.name) + '</span>' +
          '</div>' +
          discDieHtml +
        '</div>' +
        '<div class="manv-body">' +
          metaHtml +
          descHtml +
          riskHtml +
          effectHtml +
        '</div>' +
      '</div>'
    );
  }

  function _hasForceDiscipline(char) {
    var forceDiscs = ['control_spark', 'sense_spark', 'alter_spark'];
    var arenas = char.arenas || [];
    for (var i = 0; i < arenas.length; i++) {
      var discs = arenas[i].disciplines || [];
      for (var j = 0; j < discs.length; j++) {
        if (forceDiscs.indexOf(discs[j].id) !== -1 && _dieIndex(discs[j].die.toUpperCase()) >= 0) {
          return true;
        }
      }
    }
    return false;
  }

  var _lastHtml = '';
  var SLOT_IDS = ['slot-left-content', 'slot-mid-content', 'slot-right-content'];

  function _injectIntoVisibleSlots(innerHtml) {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var child = slot.firstElementChild;
      if (child && child.id === 'panel-3') {
        child.innerHTML = innerHtml;
      }
    });
  }

  function _setupSlotObservers() {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var observer = new MutationObserver(function () {
        if (_lastHtml) _injectIntoVisibleSlots(_lastHtml);
      });
      observer.observe(slot, { childList: true });
    });
  }

  function _render(data, char, activeGear) {
    var actions = data.universalActions || [];
    var forceManeuvers = data.forceManeuvers || [];

    var grouped = { 'Action': [], 'Maneuver': [], 'Exploit': [], 'Defense': [], 'Free': [] };
    for (var i = 0; i < actions.length; i++) {
      var at = actions[i].actionType;
      if (grouped[at]) grouped[at].push(actions[i]);
    }

    var html = '<div class="armory-panel-wrap manv-panel-wrap">';

    var groupOrder = ['Action', 'Maneuver', 'Exploit', 'Defense', 'Free'];
    for (var gi = 0; gi < groupOrder.length; gi++) {
      var groupName = groupOrder[gi];
      var groupActions = grouped[groupName];
      if (!groupActions || !groupActions.length) continue;

      var info = ACTION_TYPE_LABELS[groupName];
      html += '<div class="manv-action-group">';
      var groupLabel = groupName === 'Free' ? 'Free Actions' : _esc(groupName) + 's';
      html += '<div class="armory-category-label manv-category-label">' +
        '<span class="manv-pip-badge manv-pip-badge-header" style="background:' + info.color + ';">' + info.pip + '</span> ' +
        groupLabel + '</div>';

      for (var ai = 0; ai < groupActions.length; ai++) {
        html += _buildActionWithGambits(groupActions[ai], data, char, activeGear);
      }

      html += '</div>';
    }

    if (_hasForceDiscipline(char) && forceManeuvers.length) {
      html += '<div class="manv-action-group">';
      html += '<div class="armory-category-label manv-category-label">' +
        '<span class="manv-pip-badge manv-pip-badge-header" style="background:var(--color-accent-violet, #8b5cf6);">F</span> ' +
        'Force Techniques</div>';
      for (var fi = 0; fi < forceManeuvers.length; fi++) {
        html += _buildForceCardWithGambits(forceManeuvers[fi], data, char, activeGear);
      }
      html += '</div>';
    }

    var vocManeuvers = _getVocationManeuvers(char);
    if (vocManeuvers.length) {
      html += '<div class="manv-action-group">';
      html += '<div class="armory-category-label manv-category-label">' +
        '<span class="manv-pip-badge manv-pip-badge-header" style="background:var(--color-accent-amber, #f59e0b);">V</span> ' +
        'Vocation Techniques</div>';
      for (var vm = 0; vm < vocManeuvers.length; vm++) {
        html += _buildVocationManeuverCard(vocManeuvers[vm].ability, vocManeuvers[vm].kitName, char);
      }
      html += '</div>';
    }

    if (data.advancedManeuvers && data.advancedManeuvers.length) {
      html += '<div class="manv-action-group">';
      html += '<div class="armory-category-label manv-category-label">Advanced Maneuvers</div>';
      for (var am = 0; am < data.advancedManeuvers.length; am++) {
        html += _buildUniversalActionCard(data.advancedManeuvers[am], char);
      }
      html += '</div>';
    }

    html += '</div>';

    _lastHtml = html;
    var panels = document.querySelectorAll('[id="panel-3"]');
    for (var p = 0; p < panels.length; p++) {
      panels[p].innerHTML = html;
    }
    _injectIntoVisibleSlots(html);
  }

  document.addEventListener('click', function (e) {
    var header = e.target.closest && e.target.closest('.manv-header');
    if (header) {
      if (header.closest('#shipcombat-overlay-mount')) return;
      var card = header.closest('.manv-card');
      if (!card) return;
      var body = card.querySelector('.manv-body');
      if (!body) return;
      var isOpen = card.classList.contains('is-open');
      var allCards = document.querySelectorAll('.manv-card');
      for (var i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove('is-open');
        var b = allCards[i].querySelector('.manv-body');
        if (b) b.classList.remove('open');
      }
      if (!isOpen) {
        card.classList.add('is-open');
        body.classList.add('open');
      }
      return;
    }
    var gambitToggle = e.target.closest && e.target.closest('.manv-gambit-toggle');
    if (gambitToggle) {
      if (gambitToggle.closest('#shipcombat-overlay-mount')) return;
      var block = gambitToggle.closest('.manv-gambit-block');
      if (!block) return;
      block.classList.toggle('is-open');
      return;
    }
  });

  var ACTIVE_STATUSES = { equipped: true, carried: true };

  function _buildActiveGear(gear, statusMap, char) {
    var charGearIds = char.gearIds || [];
    var seenGear = {};
    var result = [];
    charGearIds.forEach(function (gid) {
      if (seenGear[gid]) return;
      seenGear[gid] = true;
      var entry = statusMap[gid];
      var status = entry ? entry.status : 'stowed';
      if (!ACTIVE_STATUSES[status]) return;
      for (var j = 0; j < gear.length; j++) {
        if (gear[j].id === gid) { result.push({ item: gear[j], status: status }); break; }
      }
    });
    return result;
  }

  function init() {
    _setupSlotObservers();

    Promise.all([
      fetch('/data/maneuvers.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load maneuvers: ' + res.status);
        return res.json();
      }),
      fetch('/data/gear.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load gear: ' + res.status);
        return res.json();
      }),
      fetch('/data/armor.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load armor: ' + res.status);
        return res.json();
      })
    ])
    .then(function (results) {
      var data = results[0];
      var gear = results[1];
      var armorList = results[2];

      function tryRender() {
        var char = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (!char) { setTimeout(tryRender, 50); return; }

        var charId = char.id || null;

        function doRender(statusMap) {
          var sm = statusMap || {};
          var charArmorIds = char.armorIds || (char.armorId ? [char.armorId] : []);
          var eqArmor = null;
          for (var ai = 0; ai < charArmorIds.length; ai++) {
            var ae = sm[charArmorIds[ai]];
            if (ae && ae.status === 'equipped') {
              for (var aj = 0; aj < armorList.length; aj++) {
                if (armorList[aj].id === charArmorIds[ai]) { eqArmor = armorList[aj]; break; }
              }
              if (eqArmor) break;
            }
          }
          window._equippedArmorData = eqArmor;
          var activeGear = _buildActiveGear(gear, sm, char);
          _render(data, char, activeGear);
        }

        function fetchAndRender() {
          if (charId) {
            fetch('/api/equipment/' + encodeURIComponent(charId))
              .then(function (r) { return r.ok ? r.json() : {}; })
              .then(doRender)
              .catch(function () { doRender({}); });
          } else {
            doRender({});
          }
        }

        fetchAndRender();

        document.addEventListener('equipment:changed', fetchAndRender);
        document.addEventListener('character:stateChanged', fetchAndRender);
        document.addEventListener('effects:changed', fetchAndRender);
      }
      tryRender();
    })
    .catch(function (err) {
      console.error('[ManeuversPanel]', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());

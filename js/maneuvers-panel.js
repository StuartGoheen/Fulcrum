(function () {
  'use strict';

  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var TIER_RANGES = ['0\u20133', '4\u20137', '8+'];

  var _CONDITION_MAP = {
    'distracted':  'condition_distracted',
    'optimized':   'condition_optimized',
    'weakened':    'condition_weakened',
    'empowered':   'condition_empowered',
    'dazed':       'condition_dazed',
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
    'bleeding':    'condition_bleeding',
    'stimmed':     'stimmed',
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
      var normalized = inner.replace(/\s*\d+$/, '').trim().toLowerCase();
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

  function _characterQualifies(char, req) {
    var baseDie = _getBaseDisciplineDie(char, req.arenaId, req.disciplineId);
    if (!baseDie) return false;
    return _dieIndex(baseDie) >= _dieIndex(req.minDie);
  }

  function _qualifyingGambits(char, maneuver) {
    var req = maneuver.disciplineRequirement;
    var baseDie = _getBaseDisciplineDie(char, req.arenaId, req.disciplineId);
    if (!baseDie) return [];
    var charDieIdx = _dieIndex(baseDie);
    return (maneuver.gambits || []).filter(function (g) {
      return charDieIdx >= _dieIndex(g.requiredDie);
    });
  }

  function _buildEffectTrack(effectArr) {
    var html = '<div class="armory-effect-track manv-effect-track">';
    for (var e = 0; e < effectArr.length; e++) {
      var tier = effectArr[e];
      var range = TIER_RANGES[e] || String(e);
      html +=
        '<div class="armory-effect-row manv-effect-row">' +
          '<span class="armory-effect-range">' + _esc(range) + '</span>' +
          '<span class="manv-tier-desc">' + _linkify(tier.description) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
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

  function _getGearGambits(maneuver, activeGear) {
    var result = [];
    for (var i = 0; i < activeGear.length; i++) {
      var entry = activeGear[i];
      var gambits = entry.item.gambits || [];
      for (var g = 0; g < gambits.length; g++) {
        if (gambits[g].targetManeuver === maneuver.id) {
          result.push({ gambit: gambits[g], gearName: entry.item.name });
        }
      }
    }
    return result;
  }

  function _buildGambitBlock(gambit, requiredDie) {
    return (
      '<div class="armory-gambit-block manv-gambit-block">' +
        '<div class="manv-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label">Gambit</span>' +
          '<span class="manv-gambit-name-preview">' + _esc(gambit.name) + '</span>' +
          '<span class="manv-gambit-req-die">' + _dieImg(requiredDie) + '</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="manv-gambit-body">' +
          '<div class="armory-gambit-text">' + _linkify(gambit.rule) + '</div>' +
          '<div class="manv-gambit-duration">' + _esc(gambit.duration) + '</div>' +
          (gambit.spacersGuide
            ? '<div class="manv-gambit-guide">&ldquo;' + _esc(gambit.spacersGuide) + '&rdquo;</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  function _getEngineGambits(char, disciplineId) {
    var engine = char.engine;
    if (!engine || !engine.gambits) return [];
    return engine.gambits.filter(function (g) {
      return g.targetType === 'maneuver' && g.target === disciplineId;
    });
  }

  function _getKitGambits(char, disciplineId) {
    var result = [];
    var kits = char.kits || [];
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var abilities = kit.abilities || [];
      for (var ai = 0; ai < abilities.length; ai++) {
        var ab = abilities[ai];
        if (ab.tier > unlockedTier) continue;
        if (ab.type !== 'gambit' || ab.targetType !== 'maneuver') continue;
        if (ab.target === disciplineId) {
          result.push({ ability: ab, kitName: kit.name });
        }
      }
    }
    return result;
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

  function _buildManeuverCard(maneuver, char, activeGear) {
    var req = maneuver.disciplineRequirement;
    var discDie = _getEffectiveDisciplineDie(char, req.arenaId, req.disciplineId) || req.minDie;
    var arenaDie = _getEffectiveArenaDie(char, req.arenaId);
    var qualGambits = _qualifyingGambits(char, maneuver);
    var engineGambits = _getEngineGambits(char, req.disciplineId);
    var gearGambits = _getGearGambits(maneuver, activeGear || []);
    var kitGambits = _getKitGambits(char, req.disciplineId);

    var discHtml =
      '<div class="armory-weapon-disc">' +
        _dieImg(discDie) +
        '<span class="armory-weapon-disc-sep">/</span>' +
        _dieImg(arenaDie) +
      '</div>';

    var arenaTagHtml = maneuver.arenaTag
      ? ' <span class="manv-arena-tag">' + _esc(maneuver.arenaTag) + '</span>'
      : '';

    var metaHtml =
      '<div class="armory-weapon-meta manv-meta">' +
        '<span class="armory-weapon-chassis">' + _esc(maneuver.actionType) + arenaTagHtml + ' &mdash; Roll: ' + _esc(maneuver.roll) + '</span>' +
        '<span class="armory-weapon-range">Target: ' + _esc(maneuver.target) + '</span>' +
      '</div>';

    var riskHtml =
      '<div class="manv-risk-block">' +
        '<span class="manv-risk-label">Risk</span>' +
        '<span class="manv-risk-text">' + _linkify(maneuver.risk) + '</span>' +
      '</div>';

    var effectHtml = _buildEffectTrack(maneuver.effect);

    var gambitsHtml = '';
    for (var g = 0; g < qualGambits.length; g++) {
      gambitsHtml += _buildGambitBlock(qualGambits[g], qualGambits[g].requiredDie);
    }
    for (var eg = 0; eg < engineGambits.length; eg++) {
      gambitsHtml += _buildEngineGambitBlock(engineGambits[eg], char.engine.name);
    }
    for (var gg = 0; gg < gearGambits.length; gg++) {
      gambitsHtml += _buildGearGambitBlock(gearGambits[gg].gambit, gearGambits[gg].gearName);
    }
    for (var kg = 0; kg < kitGambits.length; kg++) {
      gambitsHtml += _buildKitGambitBlock(kitGambits[kg].ability, kitGambits[kg].kitName);
    }

    return (
      '<div class="manv-card" data-maneuver-id="' + _esc(maneuver.id) + '">' +
        '<div class="manv-header">' +
          '<div class="manv-header-left">' +
            '<span class="manv-name">' + _esc(maneuver.name) + '</span>' +
          '</div>' +
          discHtml +
        '</div>' +
        '<div class="manv-body">' +
          metaHtml +
          riskHtml +
          effectHtml +
          gambitsHtml +
        '</div>' +
      '</div>'
    );
  }

  var _lastHtml = '';
  var SLOT_IDS = ['slot-left-content', 'slot-right-content'];

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

  function _render(maneuvers, char, activeGear) {
    var qualified = maneuvers.filter(function (m) {
      return _characterQualifies(char, m.disciplineRequirement);
    });

    qualified.sort(function (a, b) {
      var ta = a.masteryTrack.toLowerCase();
      var tb = b.masteryTrack.toLowerCase();
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    });

    var html = '<div class="armory-panel-wrap manv-panel-wrap">';

    if (qualified.length === 0) {
      html +=
        '<div class="manv-empty">' +
          '<p class="font-display text-xs tracking-widest uppercase" style="color:var(--color-text-secondary);">No maneuvers available</p>' +
        '</div>';
    } else {
      var currentTrack = null;
      for (var i = 0; i < qualified.length; i++) {
        var m = qualified[i];
        if (m.masteryTrack !== currentTrack) {
          currentTrack = m.masteryTrack;
          html += '<div class="armory-category-label">' + _esc(currentTrack) + ' Mastery</div>';
        }
        html += _buildManeuverCard(m, char, activeGear || []);
      }
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
      var block = gambitToggle.closest('.manv-gambit-block');
      if (!block) return;
      block.classList.toggle('is-open');
      return;
    }
  });

  var ACTIVE_STATUSES = { equipped: true, carried: true };

  function _buildActiveGear(gear, statusMap, char) {
    var charGearIds = char.gearIds || [];
    var result = [];
    charGearIds.forEach(function (gid) {
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
      })
    ])
    .then(function (results) {
      var maneuvers = results[0];
      var gear      = results[1];

      function tryRender() {
        var char = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (!char) { setTimeout(tryRender, 50); return; }

        var charId = char.id || null;

        function doRender(statusMap) {
          var activeGear = _buildActiveGear(gear, statusMap || {}, char);
          _render(maneuvers, char, activeGear);
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

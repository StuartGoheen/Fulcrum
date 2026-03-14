(function () {
  'use strict';

  // ─── Die Size Helpers ─────────────────────────────────────────────────────────

  var DIE_SIZE  = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };
  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];
  var DIE_POOL  = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };

  var _arenaTrauma = {};

  function _effectiveDieIndex(baseDie, traumaLevel) {
    var idx = DIE_ORDER.indexOf(baseDie.toUpperCase());
    return idx - traumaLevel;
  }

  function _dieSize(dieType) {
    return DIE_SIZE[dieType.toUpperCase()] || 0;
  }

  var _vitalityState = { current: null, max: 0 };
  var _engineState   = { current: null, max: 0 };

  function _calcEngineMax(char) {
    if (!char.engine) return 0;
    var best = 0;
    var kits = char.kits || [];
    kits.forEach(function (kit) {
      var arenaId = kit.governingArena;
      if (!arenaId) return;
      var arena = (char.arenas || []).find(function (a) { return a.id === arenaId; });
      if (arena) {
        var val = DIE_POOL[arena.die.toUpperCase()] || 0;
        if (val > best) best = val;
      }
    });
    if (best === 0) {
      var governing = char.engine.governingArenas || [];
      governing.forEach(function (arenaId) {
        var arena = (char.arenas || []).find(function (a) { return a.id === arenaId; });
        if (arena) {
          var val = DIE_POOL[arena.die.toUpperCase()] || 0;
          if (val > best) best = val;
        }
      });
    }
    return best;
  }

  function _calcVitality(char) {
    var arenas = char.arenas || [];
    var grit = arenas.find(function (a) { return a.id === 'grit'; });
    var physique = arenas.find(function (a) { return a.id === 'physique'; });
    var base = (_dieSize(grit ? grit.die : 'D4')) + (_dieSize(physique ? physique.die : 'D4'));
    var mod = char.vitalityModifier || 0;
    var total = base + mod;
    _vitalityState.max = total;
    if (_vitalityState.current === null) _vitalityState.current = total;
    return { base: base, mod: mod, total: total };
  }

  function _vitalityClass(current, max) {
    if (current === 0) return 'vitality-zero';
    var pct = max > 0 ? current / max : 0;
    if (pct > 0.6) return 'vitality-high';
    if (pct > 0.3) return 'vitality-mid';
    return 'vitality-low';
  }

  var _EKG_PATH = (function () {
    var beat = [
      'L 14,20', 'L 19,17.5', 'L 22,14', 'L 25,17.5',
      'L 29,20', 'L 31,22',   'L 33.5,2', 'L 36,30',
      'L 38.5,20', 'L 42,22.5', 'L 49,17', 'L 56,20', 'L 100,20'
    ].join(' ');
    var path = 'M 0,20';
    for (var r = 0; r < 4; r++) {
      path += ' ' + beat.replace(/(\d+\.?\d*),/g, function (_, n) {
        return (parseFloat(n) + r * 100) + ',';
      });
    }
    return path;
  }());

  // ─── Die Image Helpers ────────────────────────────────────────────────────────

  function _dieImg(dieType, variant) {
    var src = '/assets/' + dieType.toLowerCase() + '.png';
    var cls = variant === 'arena' ? 'char-arena-die-img' : 'char-disc-die-img';
    return '<img src="' + src + '" alt="' + dieType + '" class="' + cls + '">';
  }

  function _arrowSvg(dir) {
    if (dir === 'up') {
      return (
        '<div class="char-arena-die-arrow char-arena-die-arrow-up">' +
          '<svg viewBox="0 0 14 22" width="14" height="22" fill="none" aria-hidden="true">' +
            '<line x1="7" y1="20" x2="7" y2="8" stroke="var(--color-accent-primary)" stroke-width="2.5" stroke-linecap="round"/>' +
            '<polygon points="0,10 14,10 7,1" fill="var(--color-accent-primary)"/>' +
          '</svg>' +
        '</div>'
      );
    }
    return (
      '<div class="char-arena-die-arrow char-arena-die-arrow-down">' +
        '<svg viewBox="0 0 14 22" width="14" height="22" fill="none" aria-hidden="true">' +
          '<line x1="7" y1="2" x2="7" y2="14" stroke="#e74c3c" stroke-width="2.5" stroke-linecap="round"/>' +
          '<polygon points="0,12 14,12 7,21" fill="#e74c3c"/>' +
        '</svg>' +
      '</div>'
    );
  }

  function _doubleDieHtml(dieFile, dir) {
    return (
      '<div class="char-arena-2die-stack">' +
        '<img src="/assets/' + dieFile + '" alt="" class="char-arena-2die-back">' +
        '<img src="/assets/' + dieFile + '" alt="" class="char-arena-2die-front">' +
      '</div>' +
      _arrowSvg(dir)
    );
  }

  function _arenaDieBlock(arena) {
    var traumaLevel  = _arenaTrauma[arena.id] || 0;
    var effectOffset = window.CharacterPanel ? window.CharacterPanel.getArenaEffectOffset(arena.id) : 0;
    var baseDieIdx   = DIE_ORDER.indexOf(arena.die.toUpperCase());
    var effectiveIdx = baseDieIdx - traumaLevel + effectOffset;

    var imgClasses = 'char-arena-die-img';
    var arrowHtml  = '';
    var innerHtml;

    if (effectiveIdx < 0) {
      innerHtml = _doubleDieHtml('d4.png', 'down');
    } else if (effectiveIdx > 4) {
      innerHtml = _doubleDieHtml('d12.png', 'up');
    } else {
      var effectiveDie = DIE_ORDER[effectiveIdx];
      var dieSrc = '/assets/' + effectiveDie.toLowerCase() + '.png';
      if (traumaLevel === 1) imgClasses += ' trauma-impaired';
      if (traumaLevel === 2) imgClasses += ' trauma-debilitated';
      if (effectOffset > 0) arrowHtml = _arrowSvg('up');
      if (effectOffset < 0) arrowHtml = _arrowSvg('down');
      innerHtml = '<img src="' + dieSrc + '" alt="' + effectiveDie + '" class="' + imgClasses + '">' + arrowHtml;
    }

    var pillHtml = '';
    if (traumaLevel === 1) {
      pillHtml = '<div class="char-arena-trauma-pill trauma-pill-impaired">Impaired</div>';
    } else if (traumaLevel === 2) {
      pillHtml = '<div class="char-arena-trauma-pill trauma-pill-debilitated">Debilitated</div>';
    }

    return (
      '<div class="char-arena-label" data-glossary-id="' + _esc(arena.id) + '">' + _esc(arena.label) + '</div>' +
      '<div class="char-arena-die-wrap" data-arena-id="' + _esc(arena.id) + '">' +
        innerHtml +
      '</div>' +
      pillHtml
    );
  }

  // ─── HTML Builders ────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _alignedDisciplineIds(char) {
    var ids = {};
    (char.kits || []).forEach(function (kit) {
      if (kit.alignedDiscipline) ids[kit.alignedDiscipline] = true;
    });
    return ids;
  }

  function _buildFront(char) {
    var html = '';
    var alignedIds = _alignedDisciplineIds(char);

    // Identity header
    html +=
      '<div class="char-identity">' +
        '<div class="char-name-row">' +
          '<div class="char-name">' + _esc(char.name) + '</div>' +
          '<button class="char-palette-btn" id="char-theme-toggle" title="Change theme" aria-label="Change theme">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"/>' +
              '<circle cx="8.5" cy="9" r="1.5" fill="currentColor" stroke="none"/>' +
              '<circle cx="15.5" cy="9" r="1.5" fill="currentColor" stroke="none"/>' +
              '<circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>' +
              '<path d="M12 2a10 10 0 0 1 0 20"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="char-meta">' + _esc(char.species) + ' &mdash; ' + _esc(char.archetype) + '</div>' +
      '</div>';

    // Arena / discipline grid
    html += '<div class="char-arena-grid">';

    char.arenas.forEach(function (arena) {
      html += '<div class="char-arena-row">';

      // Left column: arena name + die + trauma pill
      html +=
        '<div class="char-arena-col">' +
          _arenaDieBlock(arena) +
        '</div>';

      // Right column: 5 discipline rows
      html += '<div class="char-disciplines-col">';
      arena.disciplines.forEach(function (disc) {
        var discOffset   = window.CharacterPanel ? window.CharacterPanel.getDiscEffectOffset(disc.id, arena.id) : 0;
        var baseDieIdx   = DIE_ORDER.indexOf(disc.die.toUpperCase());
        var effIdx       = Math.max(0, Math.min(4, baseDieIdx + discOffset));
        var effDie       = DIE_ORDER[effIdx] || disc.die.toUpperCase();
        var isAligned    = !!alignedIds[disc.id];
        var discImgHtml;
        if (baseDieIdx + discOffset < 0) {
          discImgHtml =
            '<span class="char-disc-2die-stack">' +
              '<img src="/assets/d4.png" alt="" class="char-disc-2die-back">' +
              '<img src="/assets/d4.png" alt="" class="char-disc-2die-front">' +
            '</span>' +
            _arrowSvg('down').replace('char-arena-die-arrow', 'char-disc-die-arrow');
        } else if (baseDieIdx + discOffset > 4) {
          discImgHtml =
            '<span class="char-disc-2die-stack">' +
              '<img src="/assets/d12.png" alt="" class="char-disc-2die-back">' +
              '<img src="/assets/d12.png" alt="" class="char-disc-2die-front">' +
            '</span>' +
            _arrowSvg('up').replace('char-arena-die-arrow', 'char-disc-die-arrow');
        } else {
          var arrowH = discOffset > 0 ? _arrowSvg('up').replace('char-arena-die-arrow', 'char-disc-die-arrow')
                     : discOffset < 0 ? _arrowSvg('down').replace('char-arena-die-arrow', 'char-disc-die-arrow')
                     : '';
          discImgHtml = _dieImg(effDie, 'discipline') + arrowH;
        }
        var alignedMarker = isAligned ? '<span class="char-discipline-aligned-pip" aria-label="Edge aligned" title="Edge aligned"></span>' : '';
        html +=
          '<div class="char-discipline-row' + (isAligned ? ' char-discipline-row--aligned' : '') + '">' +
            '<span class="char-discipline-die" style="position:relative;">' + discImgHtml + '</span>' +
            '<span class="char-discipline-name" data-glossary-id="' + _esc(disc.id) + '">' + _esc(disc.label.replace(/\s*\(The Spark\)/i, '')) + '</span>' +
            alignedMarker +
          '</div>';
      });
      html += '</div>';

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  function _buildBack(char) {
    return (
      '<div style="padding:0.5rem 0.625rem;">' +
        '<p style="font-family:\'Audiowide\',sans-serif;font-size:0.5rem;letter-spacing:0.08em;' +
            'text-transform:uppercase;color:var(--color-accent-primary);margin-bottom:0.5rem;">' +
          'Character Narrative' +
        '</p>' +
        '<p style="font-size:0.55rem;color:var(--color-text-secondary);line-height:1.6;">' +
          _esc(char.narrative) +
        '</p>' +
      '</div>'
    );
  }

  function _flipBtn(label) {
    return (
      '<button class="char-flip-btn" aria-label="' + label + '" title="' + label + '">&#8635;</button>'
    );
  }

  function _buildStatus(char) {
    var v = _calcVitality(char);
    var current = _vitalityState.current;
    var max = _vitalityState.max;
    var vClass = _vitalityClass(current, max);

    var gritArena    = char.arenas.find(function (a) { return a.id === 'grit'; })    || { die: '?' };
    var physiqueArena = char.arenas.find(function (a) { return a.id === 'physique'; }) || { die: '?' };

    var ekgSvg = current === 0
      ? '<div class="char-vitality-ekg-wrap ekg-flatline-wrap">' +
          '<svg viewBox="0 0 100 40" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">' +
            '<path class="ekg-path ekg-flatline" d="M 0,20 L 100,20"/>' +
          '</svg>' +
        '</div>'
      : '<div class="char-vitality-ekg-wrap">' +
          '<svg viewBox="0 0 400 40" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">' +
            '<path class="ekg-path" d="' + _EKG_PATH + '"/>' +
          '</svg>' +
        '</div>';

    var pips = '';
    for (var i = 1; i <= 10; i++) {
      if (i <= current) {
        pips += '<button class="char-vitality-pip filled" data-pip="' + i + '" aria-label="Set vitality to ' + i + '"></button>';
      } else if (i <= max) {
        pips += '<button class="char-vitality-pip" data-pip="' + i + '" aria-label="Set vitality to ' + i + '"></button>';
      } else {
        pips += '<div class="char-vitality-pip locked" aria-hidden="true"></div>';
      }
    }

    return (
      '<div class="char-status">' +
        '<div class="char-vitality ' + vClass + '">' +
          '<div class="char-vitality-header">' +
            '<span class="char-status-label">Vitality</span>' +
            '<span class="char-vitality-value">' + current + ' / ' + max + '</span>' +
          '</div>' +
          '<div class="char-vitality-formula">' +
            _esc(gritArena.die) + ' Grit + ' + _esc(physiqueArena.die) + ' Physique' +
            (v.mod !== 0 ? ' + ' + v.mod + ' mod' : '') +
          '</div>' +
          '<div class="char-vitality-track">' +
            ekgSvg +
            '<div class="char-vitality-pips">' + pips + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildEngine(char) {
    if (!char.engine) return '';
    var max     = _engineState.max;
    var current = _engineState.current;
    var kits    = char.kits || [];

    var subtitleParts = [];
    kits.forEach(function (kit) {
      var arenaId = kit.governingArena;
      if (!arenaId) return;
      var arena = (char.arenas || []).find(function (a) { return a.id === arenaId; });
      if (arena) subtitleParts.push(arena.label + ' ' + arena.die + ' \u00b7 ' + kit.name);
    });
    if (subtitleParts.length === 0) {
      (char.engine.governingArenas || []).forEach(function (arenaId) {
        var arena = (char.arenas || []).find(function (a) { return a.id === arenaId; });
        if (arena) subtitleParts.push(arena.label + ' ' + arena.die);
      });
    }

    var pips = '';
    for (var i = 1; i <= 5; i++) {
      if (i <= current) {
        pips += '<button class="char-engine-pip filled" data-engine-pip="' + i + '" aria-label="Set ' + _esc(char.engine.poolName) + ' to ' + i + '"></button>';
      } else if (i <= max) {
        pips += '<button class="char-engine-pip" data-engine-pip="' + i + '" aria-label="Set ' + _esc(char.engine.poolName) + ' to ' + i + '"></button>';
      } else {
        pips += '<div class="char-engine-pip locked" aria-hidden="true"></div>';
      }
    }

    var alignedParts = [];
    kits.forEach(function (kit) {
      if (!kit.alignedDiscipline || !kit.tier) return;
      var label = kit.alignedDiscipline.charAt(0).toUpperCase() + kit.alignedDiscipline.slice(1);
      alignedParts.push(label + ' (' + kit.name + ')');
    });

    var coreHtml = '';
    if (char.engine.coreUtility) {
      var cu = char.engine.coreUtility;
      var alignedHtml = alignedParts.length
        ? '<div class="char-engine-ability-restriction char-engine-aligned">Favored: ' + _esc(alignedParts.join(' \u00b7 ')) + '</div>'
        : (cu.restriction ? '<div class="char-engine-ability-restriction">' + _esc(cu.restriction) + '</div>' : '');
      coreHtml =
        '<div class="char-engine-ability">' +
          '<div class="char-engine-ability-header">' +
            '<span class="char-engine-ability-type">Core Utility</span>' +
            '<span class="char-engine-ability-name">' + _esc(cu.name) + '</span>' +
            '<span class="char-engine-ability-cost">' + _esc(cu.cost) + '</span>' +
          '</div>' +
          '<div class="char-engine-ability-rule">' + _esc(cu.rule) + '</div>' +
          alignedHtml +
        '</div>';
    }

    var kitsHtml = '';
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var abilities = kit.abilities || [];
      for (var ai = 0; ai < abilities.length; ai++) {
        var ab = abilities[ai];
        if (ab.tier > unlockedTier) continue;
        if (ab.type !== 'passive') continue;
        var actionBonusHtml = '';
        if (ab.actionBonus) {
          var bonus = ab.actionBonus;
          var parts = [];
          if (bonus.action) parts.push('Action ' + (bonus.action > 0 ? '+' : '') + bonus.action);
          if (bonus.trigger) parts.push('Trigger ' + (bonus.trigger > 0 ? '+' : '') + bonus.trigger);
          if (bonus.maneuver) parts.push('Maneuver ' + (bonus.maneuver > 0 ? '+' : '') + bonus.maneuver);
          if (parts.length) {
            actionBonusHtml = '<div class="char-engine-ability-restriction kit-action-bonus">' + _esc(parts.join(' \u00b7 ')) + '</div>';
          }
        }
        kitsHtml +=
          '<div class="char-engine-ability char-engine-ability--passive char-kit-ability">' +
            '<div class="char-engine-ability-header">' +
              '<span class="char-engine-ability-type">Passive \u00b7 ' + _esc(kit.name) + '</span>' +
              '<span class="char-engine-ability-name">' + _esc(ab.name) + '</span>' +
              '<span class="char-engine-ability-cost kit-tier-badge">T' + ab.tier + '</span>' +
            '</div>' +
            '<div class="char-engine-ability-rule">' + _esc(ab.rule) + '</div>' +
            actionBonusHtml +
          '</div>';
      }
    }

    return (
      '<div class="char-engine-section">' +
        '<div class="char-engine-header">' +
          '<span class="char-engine-label">' + _esc(char.engine.poolName) + '</span>' +
          '<span class="char-engine-value">' + current + ' / ' + max + '</span>' +
        '</div>' +
        '<div class="char-engine-subtitle">' + _esc(char.engine.name) + ' \u2014 ' + subtitleParts.join(' / ') + '</div>' +
        '<div class="char-engine-pips">' + pips + '</div>' +
        coreHtml +
        kitsHtml +
      '</div>'
    );
  }

  // ─── Panel Builder ────────────────────────────────────────────────────────────

  var _currentChar = null;

  function _refreshStatus() {
    var wrap = document.getElementById('char-vitality-wrap') ||
               document.getElementById('char-status-container');
    if (wrap && _currentChar) {
      wrap.innerHTML = _buildStatus(_currentChar);
    }
  }

  function _refreshEngine() {
    var wrap = document.getElementById('char-engine-wrap');
    if (wrap && _currentChar) {
      wrap.innerHTML = _buildEngine(_currentChar);
    }
  }

  function _refreshFront() {
    var frontEl = document.querySelector('.char-panel-front');
    if (frontEl && _currentChar) {
      frontEl.innerHTML = _flipBtn('Show narrative') + _buildFront(_currentChar);
    }
  }

  function buildCharacterPanel(char) {
    _currentChar = char;
    _vitalityState.current = null;
    _engineState.max     = _calcEngineMax(char);
    _engineState.current = _engineState.max;
    _arenaTrauma = {};

    var panel = document.getElementById('char-panel-container');
    if (!panel) return;

    panel.innerHTML =
      '<div class="char-panel-outer">' +
        '<div class="char-panel-flipper">' +
          '<div class="char-panel-front">' +
            _flipBtn('Show narrative') +
            _buildFront(char) +
          '</div>' +
          '<div class="char-panel-back">' +
            _flipBtn('Show character') +
            _buildBack(char) +
          '</div>' +
        '</div>' +
      '</div>';

    _refreshStatus();
    _refreshEngine();
  }

  // ─── State Change Dispatch ────────────────────────────────────────────────────

  function _dispatchStateChanged() {
    document.dispatchEvent(new CustomEvent('character:stateChanged'));
  }

  // ─── Event Delegation ─────────────────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.char-flip-btn');
    if (btn) {
      var flipper = btn.closest('.char-panel-flipper');
      if (flipper) flipper.classList.toggle('flipped');
      return;
    }

    var pip = e.target.closest('.char-vitality-pip[data-pip]');
    if (pip) {
      var val = parseInt(pip.getAttribute('data-pip'), 10);
      if (!isNaN(val)) {
        _vitalityState.current = (val === _vitalityState.current) ? val - 1 : val;
        _refreshStatus();
        _dispatchStateChanged();
      }
      return;
    }

    var arenaWrap = e.target.closest('.char-arena-die-wrap[data-arena-id]');
    if (arenaWrap) {
      var arenaId = arenaWrap.getAttribute('data-arena-id');
      _arenaTrauma[arenaId] = ((_arenaTrauma[arenaId] || 0) + 1) % 3;
      _refreshFront();
      _dispatchStateChanged();
      return;
    }

    var enginePip = e.target.closest('.char-engine-pip[data-engine-pip]');
    if (enginePip) {
      var epVal = parseInt(enginePip.getAttribute('data-engine-pip'), 10);
      if (!isNaN(epVal)) {
        _engineState.current = (epVal === _engineState.current) ? epVal - 1 : epVal;
        _refreshEngine();
        _dispatchStateChanged();
      }
      return;
    }
  });

  // ─── Bootstrap ────────────────────────────────────────────────────────────────

  function init() {
    fetch('/data/character-test.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load character data: ' + res.status);
        return res.json();
      })
      .then(function (char) {
        buildCharacterPanel(char);
      })
      .catch(function (err) {
        console.error('[CharacterPanel]', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  window.CharacterPanel = window.CharacterPanel || {};

  Object.defineProperty(window.CharacterPanel, 'currentChar', {
    get: function () { return _currentChar; },
    enumerable: true,
  });

  window.CharacterPanel.getArenaTrauma = function () {
    var copy = {};
    for (var k in _arenaTrauma) {
      if (Object.prototype.hasOwnProperty.call(_arenaTrauma, k)) {
        copy[k] = _arenaTrauma[k];
      }
    }
    return copy;
  };

  window.CharacterPanel.getArenaEffectOffset = function (arenaId) {
    if (window.EffectManager && window.EffectManager.getArenaEffectOffset) {
      return window.EffectManager.getArenaEffectOffset(arenaId);
    }
    return 0;
  };

  window.CharacterPanel.getDiscEffectOffset = function (discId, arenaId) {
    if (window.EffectManager && window.EffectManager.getDiscEffectOffset) {
      return window.EffectManager.getDiscEffectOffset(discId, arenaId);
    }
    return 0;
  };

  window.CharacterPanel.applyVitalityDelta = function (delta) {
    var next = (_vitalityState.current || 0) + delta;
    if (next < 0) next = 0;
    if (next > _vitalityState.max) next = _vitalityState.max;
    _vitalityState.current = next;
    _refreshStatus();
    _dispatchStateChanged();
  };

  window.CharacterPanel.refresh = function () {
    _refreshFront();
    _refreshStatus();
    _refreshEngine();
  };

  document.addEventListener('effects:changed', function () {
    if (_currentChar) {
      _refreshFront();
    }
  });

}());

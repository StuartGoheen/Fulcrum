(function () {
  'use strict';

  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var CATEGORY_RULES = {
    none:   'Step Down Physique to Endure.',
    light:  'No modification to Physique when Enduring.',
    medium: 'Step Up Physique to Endure. Step Down Reflex for Evasion.',
    heavy:  'Step Up Physique twice to Endure. Step Down Reflex twice for Evasion.'
  };

  var ENDURE_STEP  = { none: -1, light: 0, medium: 1, heavy: 2 };
  var EVADE_STEP   = { none: 0,  light: 0, medium: -1, heavy: -2 };

  function _steppedDie(baseDie, steps) {
    var idx = DIE_ORDER.indexOf(baseDie.toUpperCase());
    if (idx < 0) return baseDie;
    var eff = Math.max(0, Math.min(DIE_ORDER.length - 1, idx + steps));
    return DIE_ORDER[eff];
  }

  function _findArenaDie(char, arenaId) {
    if (!char || !char.arenas) return 'D6';
    for (var i = 0; i < char.arenas.length; i++) {
      if (char.arenas[i].id === arenaId) return char.arenas[i].die || 'D6';
    }
    return 'D6';
  }

  function _findDiscDie(char, arenaId, discId) {
    if (!char || !char.arenas) return 'D6';
    for (var i = 0; i < char.arenas.length; i++) {
      if (char.arenas[i].id === arenaId) {
        var discs = char.arenas[i].disciplines || [];
        for (var j = 0; j < discs.length; j++) {
          if (discs[j].id === discId) return discs[j].die || 'D6';
        }
      }
    }
    return 'D6';
  }

  function _dieImgHtml(dieName, label, arrowDir) {
    var src = '/assets/' + dieName.toLowerCase() + '.png';
    var arrowHtml = '';
    if (arrowDir === 'up') {
      arrowHtml = '<svg class="armor-die-arrow armor-die-arrow--up" viewBox="0 0 12 12" width="10" height="10"><polygon points="6,1 11,9 1,9" fill="var(--color-accent-primary)"/></svg>';
    } else if (arrowDir === 'down') {
      arrowHtml = '<svg class="armor-die-arrow armor-die-arrow--down" viewBox="0 0 12 12" width="10" height="10"><polygon points="6,11 1,3 11,3" fill="#ef4444"/></svg>';
    }
    return (
      '<div class="armor-die-cell">' +
        '<img src="' + src + '" alt="' + dieName + '" class="armor-die-img">' +
        arrowHtml +
        '<span class="armor-die-label">' + label + '</span>' +
      '</div>'
    );
  }

  function _buildDiceDisplay(armor, char) {
    var cat = armor.category || 'light';
    var endureSteps = ENDURE_STEP[cat] != null ? ENDURE_STEP[cat] : 0;
    var evadeSteps  = EVADE_STEP[cat] != null ? EVADE_STEP[cat] : 0;
    if (armor.evasionException) evadeSteps = 0;

    var physiqueDie = _findArenaDie(char, 'physique');
    var reflexDie   = _findArenaDie(char, 'reflex');
    var endureDie   = _findDiscDie(char, 'physique', 'endure');
    var evadeDie    = _findDiscDie(char, 'reflex', 'evasion');

    var effPhysiqueForEndure = _steppedDie(physiqueDie, endureSteps);
    var effReflexForEvade    = _steppedDie(reflexDie, evadeSteps);

    var endureArrow = endureSteps > 0 ? 'up' : (endureSteps < 0 ? 'down' : '');
    var evadeArrow  = evadeSteps < 0 ? 'down' : '';

    var html = '<div class="armor-dice-display">';

    html += '<div class="armor-dice-group">';
    html += '<div class="armor-dice-group-label">Endure</div>';
    html += '<div class="armor-dice-row">';
    html += _dieImgHtml(endureDie, 'Control', '');
    html += '<span class="armor-dice-sep">+</span>';
    html += _dieImgHtml(effPhysiqueForEndure, 'Power' + (endureSteps !== 0 ? ' (' + physiqueDie + ')' : ''), endureArrow);
    html += '</div>';
    html += '</div>';

    if (cat === 'medium' || cat === 'heavy') {
      html += '<div class="armor-dice-group">';
      html += '<div class="armor-dice-group-label">Evade' + (armor.evasionException ? ' <span class="armor-exception">(No Penalty)</span>' : '') + '</div>';
      html += '<div class="armor-dice-row">';
      html += _dieImgHtml(evadeDie, 'Control', '');
      html += '<span class="armor-dice-sep">+</span>';
      html += _dieImgHtml(effReflexForEvade, 'Power' + (evadeSteps !== 0 ? ' (' + reflexDie + ')' : ''), evadeArrow);
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _buildArmorCard(armor, char) {
    var categoryRule = CATEGORY_RULES[armor.category] || '';

    var diceHtml = _buildDiceDisplay(armor, char);

    var metaHtml =
      '<div class="armor-card-meta">' +
        '<span class="armor-card-category">' + _esc(armor.categoryLabel || armor.category) + '</span>' +
        (armor.cost
          ? '<span class="armor-card-cost">' + _esc(String(armor.cost)) + ' cr</span>'
          : '<span class="armor-card-cost">Not for sale</span>') +
        (armor.availability
          ? '<span class="armor-card-avail">Avail: ' + _esc(armor.availability) + '</span>'
          : '') +
      '</div>';

    var ruleHtml = '';
    if (categoryRule) {
      var displayRule = categoryRule;
      if (armor.evasionException) {
        displayRule = displayRule.replace(/Step Down Reflex( twice)? for Evasion\./i, '').trim();
        displayRule += ' <span class="armor-exception">(See Trait)</span>';
      }
      ruleHtml =
        '<div class="armor-category-rule">' + displayRule + '</div>';
    }

    var traitsHtml = '';
    var traits = armor.traits || [];
    for (var i = 0; i < traits.length; i++) {
      traitsHtml +=
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(traits[i].name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(traits[i].description) + '</div>' +
        '</div>';
    }

    var gambitsHtml = '';
    var gambits = armor.gambits || [];
    for (var g = 0; g < gambits.length; g++) {
      gambitsHtml +=
        '<div class="armory-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label">Gambit</span>' +
            '<span class="armory-gambit-name">' + _esc(gambits[g].name) + '</span>' +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _esc(gambits[g].rule) + '</div>' +
          '</div>' +
        '</div>';
    }

    return (
      '<div class="armor-card" data-armor-id="' + _esc(armor.id) + '">' +
        '<div class="armor-card-header">' +
          '<span class="armor-card-name">' + _esc(armor.name) + '</span>' +
        '</div>' +
        '<div class="armor-card-body">' +
          metaHtml +
          diceHtml +
          ruleHtml +
          (armor.description
            ? '<div class="armor-card-desc">' + _esc(armor.description) + '</div>'
            : '') +
          traitsHtml +
          gambitsHtml +
        '</div>' +
      '</div>'
    );
  }

  var _lastHtml = '';
  var SLOT_IDS = ['slot-left-content', 'slot-mid-content', 'slot-right-content'];

  function _injectIntoVisibleSlots(innerHtml) {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var child = slot.firstElementChild;
      if (child && child.id === 'panel-4') {
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

  function _getEquippedArmorId(char, statusMap) {
    var ids = char.armorIds || (char.armorId ? [char.armorId] : []);
    for (var i = 0; i < ids.length; i++) {
      var entry = statusMap && statusMap[ids[i]];
      if (entry && entry.status === 'equipped') return ids[i];
    }
    if (ids.length > 0) return ids[0];
    return null;
  }

  function _render(armors, char) {
    var statusMap = {};
    if (window._armorStatusMap) statusMap = window._armorStatusMap;
    var equippedId = _getEquippedArmorId(char, statusMap);
    var equipped = null;
    if (equippedId) {
      for (var i = 0; i < armors.length; i++) {
        if (armors[i].id === equippedId) { equipped = armors[i]; break; }
      }
    }

    var html = '<div class="armory-panel-wrap">';
    html += '<div class="armory-category-label">Armor</div>';

    if (equipped) {
      html += _buildArmorCard(equipped, char);
    } else {
      html +=
        '<div class="armor-none-equipped">' +
          '<span>No armor equipped.</span>' +
        '</div>';
    }

    html += '</div>';

    _lastHtml = html;
    var panels = document.querySelectorAll('[id="panel-4"]');
    for (var p = 0; p < panels.length; p++) {
      panels[p].innerHTML = html;
    }
    _injectIntoVisibleSlots(html);
  }

  document.addEventListener('click', function (e) {
    var header = e.target.closest && e.target.closest('.armor-card-header');
    if (header) {
      var card = header.closest('.armor-card');
      if (!card) return;
      var body = card.querySelector('.armor-card-body');
      if (!body) return;
      var isOpen = card.classList.contains('is-open');
      var allCards = document.querySelectorAll('.armor-card');
      for (var i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove('is-open');
        var b = allCards[i].querySelector('.armor-card-body');
        if (b) b.classList.remove('open');
      }
      if (!isOpen) {
        card.classList.add('is-open');
        body.classList.add('open');
      }
    }
  });

  function init() {
    _setupSlotObservers();

    fetch('/data/armor.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load armor: ' + res.status);
        return res.json();
      })
      .then(function (armors) {
        function tryRender() {
          var char = window.CharacterPanel && window.CharacterPanel.currentChar;
          if (!char || !char.id) { setTimeout(tryRender, 50); return; }
          fetch('/api/equipment/' + char.id)
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (statusMap) {
              window._armorStatusMap = statusMap;
              _render(armors, char);
            })
            .catch(function () { _render(armors, char); });
          function _rerender() {
            var c = window.CharacterPanel && window.CharacterPanel.currentChar;
            if (!c) return;
            fetch('/api/equipment/' + c.id)
              .then(function (r) { return r.ok ? r.json() : {}; })
              .then(function (statusMap) {
                window._armorStatusMap = statusMap;
                _render(armors, c);
              })
              .catch(function () { _render(armors, c); });
          }
          document.addEventListener('character:stateChanged', _rerender);
          document.addEventListener('equipment:changed', _rerender);
        }
        tryRender();
      })
      .catch(function (err) {
        console.error('[ArmorPanel]', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());

(function () {
  'use strict';

  var CATEGORY_RULES = {
    none:   'Step Down Physique to Endure.',
    light:  'No modification to Physique when Enduring.',
    medium: 'Step Up Physique to Endure. Step Down Reflex for Evasion.',
    heavy:  'Step Up Physique twice to Endure. Step Down Reflex twice for Evasion.'
  };

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _buildArmorCard(armor) {
    var categoryRule = CATEGORY_RULES[armor.category] || '';

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
        displayRule = displayRule.replace('Step Down Reflex for Evasion.', '').trim();
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
  var SLOT_IDS = ['slot-left-content', 'slot-right-content'];

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

  function _render(armors, char) {
    var armorId = char.armorId || null;
    var equipped = null;
    for (var i = 0; i < armors.length; i++) {
      if (armors[i].id === armorId) { equipped = armors[i]; break; }
    }

    var html = '<div class="armory-panel-wrap">';
    html += '<div class="armory-category-label">Armor</div>';

    if (equipped) {
      html += _buildArmorCard(equipped);
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
          if (!char) { setTimeout(tryRender, 50); return; }
          _render(armors, char);
          function _rerender() {
            var c = window.CharacterPanel && window.CharacterPanel.currentChar;
            if (c) _render(armors, c);
          }
          document.addEventListener('character:stateChanged', _rerender);
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

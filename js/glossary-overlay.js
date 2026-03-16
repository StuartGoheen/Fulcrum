(function () {
  'use strict';

  var _entries = {};
  var _maneuversByDisc = {};
  var _overlay = null;
  var _isOpen = false;

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _buildOverlayEl() {
    var el = document.createElement('div');
    el.id = 'glossary-overlay';
    el.className = 'glossary-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', "The Spacer's Guide to Not Dying Today");
    el.innerHTML =
      '<div class="glossary-overlay-inner">' +
        '<div class="glossary-overlay-header">' +
          '<div class="glossary-overlay-header-left">' +
            '<span class="glossary-overlay-name" id="glossary-entry-name"></span>' +
            '<span class="glossary-overlay-type" id="glossary-entry-type"></span>' +
          '</div>' +
          '<button class="glossary-overlay-close" id="glossary-close-btn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="glossary-overlay-body">' +
          '<div class="glossary-overlay-section" id="glo-rule-section">' +
            '<div class="glossary-overlay-section-label">The Rule</div>' +
            '<div class="glossary-overlay-rule" id="glossary-entry-rule"></div>' +
          '</div>' +
          '<div class="glossary-overlay-section" id="glo-guide-section">' +
            '<div class="glossary-overlay-section-label">The Spacer\'s Guide</div>' +
            '<div class="glossary-overlay-guide" id="glossary-entry-guide"></div>' +
          '</div>' +
          '<div id="glo-maneuvers-section" class="glo-maneuvers-section"></div>' +
        '</div>' +
      '</div>';
    return el;
  }

  function _renderManeuvers(disciplineId) {
    var section = document.getElementById('glo-maneuvers-section');
    if (!section) return;
    section.innerHTML = '';

    var maneuvers = _maneuversByDisc[disciplineId];
    if (!maneuvers || maneuvers.length === 0) return;

    var heading = document.createElement('div');
    heading.className = 'glossary-overlay-section-label glo-maneuvers-heading';
    heading.textContent = 'Maneuvers & Gambits';
    section.appendChild(heading);

    maneuvers.forEach(function (m) {
      var block = document.createElement('div');
      block.className = 'glo-maneuver-block';

      // Header row: name + action tags
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

      // Roll + Target
      if (m.roll || m.target) {
        var rollRow = document.createElement('div');
        rollRow.className = 'glo-maneuver-rollrow';
        if (m.roll)   rollRow.innerHTML += '<span class="glo-rollrow-label">Roll</span> <span class="glo-rollrow-val">' + _esc(m.roll) + '</span>';
        if (m.target) rollRow.innerHTML += '<span class="glo-rollrow-sep">\u2022</span><span class="glo-rollrow-label">vs</span> <span class="glo-rollrow-val">' + _esc(m.target) + '</span>';
        block.appendChild(rollRow);
      }

      // Risk
      if (m.risk) {
        var risk = document.createElement('div');
        risk.className = 'glo-maneuver-risk';
        risk.innerHTML = '<span class="glo-risk-label">Risk</span> ' + _esc(m.risk);
        block.appendChild(risk);
      }

      // Effects
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

      // Gambits
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
              '<span class="glo-gambit-rule">' + _esc(g.rule) + '</span>' +
            '</div>';
          gambitList.appendChild(row);
        });
        block.appendChild(gambitList);
      }

      section.appendChild(block);
    });
  }

  function _render(entry) {
    document.getElementById('glossary-entry-name').textContent = entry.name || '';
    document.getElementById('glossary-entry-type').textContent = entry.type || '';
    document.getElementById('glossary-entry-rule').textContent = entry.rule || '';
    document.getElementById('glossary-entry-guide').textContent = entry.guide || '';

    var guideSection = document.getElementById('glo-guide-section');
    if (guideSection) guideSection.style.display = entry.guide ? '' : 'none';

    var manSection = document.getElementById('glo-maneuvers-section');
    if (manSection) manSection.innerHTML = '';

    var isDisc = entry.type && entry.type.toLowerCase().indexOf('discipline') !== -1;
    if (isDisc) {
      _renderManeuvers(entry.id);
    }
  }

  function _open(id) {
    var entry = _entries[id];
    if (!entry) { console.warn('[GlossaryOverlay] No entry for id:', id); return; }
    _render(entry);
    _overlay.setAttribute('aria-hidden', 'false');
    _overlay.classList.add('is-open');
    var body = _overlay.querySelector('.glossary-overlay-body');
    if (body) body.scrollTop = 0;
    _isOpen = true;
  }

  function _close() {
    if (!_isOpen) return;
    _overlay.classList.remove('is-open');
    _overlay.setAttribute('aria-hidden', 'true');
    _isOpen = false;
  }

  function _onDocClick(e) {
    var trigger = e.target.closest('[data-glossary-id]');
    if (trigger) {
      var id = trigger.getAttribute('data-glossary-id');
      if (_entries[id]) { _open(id); return; }
    }
    var closeBtn = e.target.closest('#glossary-close-btn');
    if (closeBtn) { _close(); return; }
    if (_isOpen && !e.target.closest('.glossary-overlay-inner')) {
      _close();
    }
  }

  function _onKeyDown(e) {
    if (_isOpen && (e.key === 'Escape' || e.keyCode === 27)) { _close(); }
  }

  function init() {
    _overlay = _buildOverlayEl();
    document.body.appendChild(_overlay);

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

    Promise.all([glossaryReady, maneuversReady]).catch(function (err) {
      console.error('[GlossaryOverlay]', err);
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

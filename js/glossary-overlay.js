(function () {
  'use strict';

  var _entries = {};
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
          '<div class="glossary-overlay-section">' +
            '<div class="glossary-overlay-section-label">The Rule</div>' +
            '<div class="glossary-overlay-rule" id="glossary-entry-rule"></div>' +
          '</div>' +
          '<div class="glossary-overlay-section">' +
            '<div class="glossary-overlay-section-label">The Spacer\'s Guide</div>' +
            '<div class="glossary-overlay-guide" id="glossary-entry-guide"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return el;
  }

  function _render(entry) {
    document.getElementById('glossary-entry-name').textContent = entry.name;
    document.getElementById('glossary-entry-type').textContent = entry.type;
    document.getElementById('glossary-entry-rule').textContent = entry.rule;
    document.getElementById('glossary-entry-guide').textContent = entry.guide;
  }

  function _open(id) {
    var entry = _entries[id];
    if (!entry) return;
    _render(entry);
    _overlay.setAttribute('aria-hidden', 'false');
    _overlay.classList.add('is-open');
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
      if (_entries[id]) {
        _open(id);
        return;
      }
    }
    var closeBtn = e.target.closest('#glossary-close-btn');
    if (closeBtn) {
      _close();
    }
  }

  function _onKeyDown(e) {
    if (_isOpen && (e.key === 'Escape' || e.keyCode === 27)) {
      _close();
    }
  }

  function init() {
    _overlay = _buildOverlayEl();
    document.body.appendChild(_overlay);

    fetch('/data/glossary.json')
      .then(function (res) {
        if (!res.ok) throw new Error('[GlossaryOverlay] Failed to load glossary: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        data.forEach(function (entry) {
          _entries[entry.id] = entry;
        });
      })
      .catch(function (err) {
        console.error(err);
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

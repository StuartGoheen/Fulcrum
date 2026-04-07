(function () {
  'use strict';

  var _mount = null;
  var _overlay = null;
  var _stories = [];
  var _broadcastAt = null;

  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _getSocket() {
    return window._socket || null;
  }

  function _getCharacterName() {
    var cp = window.CharacterPanel && window.CharacterPanel.currentChar;
    return cp ? (cp.name || 'Unknown') : 'Unknown';
  }

  function _buildOverlayHtml(stories) {
    var h = '';
    h += '<div class="holonet-overlay">';
    h += '<div class="holonet-overlay-backdrop"></div>';
    h += '<div class="holonet-terminal">';

    h += '<div class="holonet-terminal-header">';
    h += '<div class="holonet-scanline"></div>';
    h += '<div class="holonet-logo">';
    h += '<span class="holonet-logo-icon">&#128225;</span>';
    h += '<span class="holonet-logo-text">IMPERIAL HOLONET</span>';
    h += '</div>';
    h += '<div class="holonet-signal">INCOMING BROADCAST</div>';
    h += '<button class="holonet-close-btn" id="holonet-close">&times;</button>';
    h += '</div>';

    h += '<div class="holonet-stories">';
    stories.forEach(function (story, idx) {
      h += '<div class="holonet-story" data-story-index="' + idx + '">';
      h += '<div class="holonet-story-headline">' + _esc(story.headline) + '</div>';
      h += '<div class="holonet-story-source">' + _esc(story.source) + '</div>';
      h += '<div class="holonet-story-body">' + _esc(story.body) + '</div>';
      h += '<button class="holonet-clip-btn" data-clip-index="' + idx + '">&#128203; CLIP TO JOURNAL</button>';
      h += '</div>';
      if (idx < stories.length - 1) {
        h += '<div class="holonet-divider">&#9679; &#9679; &#9679;</div>';
      }
    });
    h += '</div>';

    h += '<div class="holonet-terminal-footer">';
    h += '<span class="holonet-footer-text">TRANSMISSION ENDS — THE EMPIRE PROTECTS</span>';
    h += '</div>';

    h += '</div>';
    h += '</div>';
    return h;
  }

  function _clipToJournal(story) {
    var title = 'HoloNet: ' + story.headline;
    var body = '**' + story.source + '**\n\n' + story.body;
    var charName = _getCharacterName();

    fetch('/api/journal/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        body: body,
        author_character_name: charName,
        source_scene_id: 'holonet'
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Journal clip failed: ' + r.status);
        return r.json();
      })
      .then(function () {
        var btn = _overlay && _overlay.querySelector('[data-clip-index="' + _stories.indexOf(story) + '"]');
        if (btn) {
          btn.textContent = '\u2713 CLIPPED';
          btn.disabled = true;
          btn.classList.add('holonet-clip-btn--done');
        }
      })
      .catch(function (err) {
        console.error('[HoloNet] Journal clip error:', err);
      });
  }

  function _show(stories, broadcastAt) {
    _stories = stories;
    _broadcastAt = broadcastAt;
    _mount = document.getElementById('holonet-overlay-mount');
    if (!_mount) return;

    _mount.innerHTML = _buildOverlayHtml(stories);
    _overlay = _mount.querySelector('.holonet-overlay');

    var closeBtn = _mount.querySelector('#holonet-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { _hide(); });
    }

    var backdrop = _mount.querySelector('.holonet-overlay-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () { _hide(); });
    }

    _mount.querySelectorAll('.holonet-clip-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.clipIndex, 10);
        if (_stories[idx]) _clipToJournal(_stories[idx]);
      });
    });

    requestAnimationFrame(function () {
      if (_overlay) _overlay.classList.add('holonet-overlay--visible');
    });
  }

  function _hide() {
    if (_overlay) {
      _overlay.classList.remove('holonet-overlay--visible');
      _overlay.classList.add('holonet-overlay--closing');
      setTimeout(function () {
        if (_mount) _mount.innerHTML = '';
        _overlay = null;
        _stories = [];
      }, 400);
    }
  }

  function init() {
    function trySocket() {
      var sock = _getSocket();
      if (!sock) { setTimeout(trySocket, 200); return; }

      sock.on('holonet:incoming', function (data) {
        if (data && data.stories && data.stories.length > 0) {
          _show(data.stories, data.broadcastAt);
        }
      });
    }
    trySocket();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HoloNetOverlay = {
    show: _show,
    hide: _hide
  };
})();

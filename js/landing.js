(function () {
  const THEME_KEY     = 'eote-theme';
  const SESSION_KEY   = 'eote-session';
  const DEFAULT_THEME = 'theme-rebellion';
  const THEMES        = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader', 'theme-fett', 'theme-holo'];
  const THEME_LABELS  = {
    'theme-rebellion': 'Rebellion',
    'theme-fringe':    'The Fringe',
    'theme-r2d2':      'R2-D2',
    'theme-vader':     'Darth Vader',
    'theme-fett':      'Fett',
    'theme-holo':      'Holo',
  };

  function applyTheme(theme) {
    THEMES.forEach((t) => document.documentElement.classList.remove(t));
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
    const label = document.getElementById('theme-label');
    if (label) label.textContent = THEME_LABELS[theme];
  }

  function loadTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored && THEMES.includes(stored) ? stored : DEFAULT_THEME);
  }

  function showModal() {
    var overlay = document.getElementById('modal-overlay');
    overlay.classList.add('is-visible');
    loadCharacters();
  }

  function hideModal() {
    var overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('is-visible');
  }

  function showError(message) {
    var el = document.getElementById('modal-error');
    el.textContent = message;
    el.style.display = 'block';
  }

  function hideError() {
    var el = document.getElementById('modal-error');
    el.style.display = 'none';
  }

  function loadCharacters() {
    var list = document.getElementById('character-list');
    list.innerHTML = '<p style="font-size:0.7rem;color:#7a7068;">Loading crew manifest&hellip;</p>';
    hideError();

    fetch('/api/characters')
      .then((res) => res.json())
      .then((data) => renderCharacterList(data.characters))
      .catch(() => {
        list.innerHTML = '';
        showError('Unable to reach the ship\'s computer. Is the server running?');
      });
  }

  function renderCharacterList(characters) {
    const list = document.getElementById('character-list');
    list.innerHTML = '';

    if (!characters || characters.length === 0) {
      list.innerHTML = '<p style="font-size:0.7rem;color:#7a7068;">No characters found — create one below.</p>';
      return;
    }

    characters.filter(function(c) { return c.name; }).forEach(function(char) {
      var card = document.createElement('div');
      card.className = 'crew-card';
      card.style.cssText = 'background:#252528;border:1px solid #3a3632;padding:0.5rem 0.6rem;display:flex;flex-direction:column;gap:0.2rem;' + (char.is_connected ? 'opacity:0.45;' : '');

      var nameLine = document.createElement('div');
      nameLine.style.cssText = 'font-size:0.72rem;font-weight:500;letter-spacing:0.04em;color:#d4c5a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      nameLine.textContent = char.name;
      card.appendChild(nameLine);

      if (char.species || char.archetype) {
        var metaLine = document.createElement('div');
        metaLine.style.cssText = 'font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#7a7068;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        var parts = [char.species, char.archetype].filter(Boolean);
        metaLine.textContent = parts.join(' — ');
        card.appendChild(metaLine);
      }

      if (char.is_connected) {
        var tag = document.createElement('div');
        tag.style.cssText = 'font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#a064dc;margin-top:0.15rem;';
        tag.textContent = 'In Session';
        card.appendChild(tag);
      } else {
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:0.35rem;margin-top:0.25rem;';

        var loadBtn = document.createElement('button');
        loadBtn.style.cssText = 'flex:1;padding:0.2rem 0;font-family:Exo 2,sans-serif;font-size:0.6rem;font-weight:600;letter-spacing:0.08em;background:transparent;border:1px solid #c8a44e;color:#c8a44e;cursor:pointer;transition:background 0.2s;';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', function() { joinAsPlayer(char.id, char.name); });

        var editBtn = document.createElement('button');
        editBtn.style.cssText = 'flex:1;padding:0.2rem 0;font-family:Exo 2,sans-serif;font-size:0.6rem;font-weight:600;letter-spacing:0.08em;background:transparent;border:1px solid #3a3632;color:#7a7068;cursor:pointer;transition:border-color 0.2s,color 0.2s;';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', function() {
          window.location.href = '/create/?edit=' + encodeURIComponent(char.id);
        });

        var delBtn = document.createElement('button');
        delBtn.style.cssText = 'padding:0.2rem 0.4rem;font-family:Exo 2,sans-serif;font-size:0.6rem;font-weight:600;letter-spacing:0.08em;background:transparent;border:1px solid #3a3632;color:#7a7068;cursor:pointer;transition:border-color 0.2s,color 0.2s;';
        delBtn.textContent = '\u2716';
        delBtn.title = 'Delete character';
        (function (cId, cName) {
          delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showDeleteConfirm(cId, cName);
          });
        })(char.id, char.name);

        btnRow.appendChild(loadBtn);
        btnRow.appendChild(editBtn);
        btnRow.appendChild(delBtn);
        card.appendChild(btnRow);
      }

      list.appendChild(card);
    });
  }

  function showDeleteConfirm(charId, charName) {
    var existing = document.getElementById('del-confirm-overlay');
    if (existing) existing.remove();

    var ov = document.createElement('div');
    ov.id = 'del-confirm-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9000;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1a1a1e;border:1px solid #ef4444;box-shadow:0 0 30px rgba(239,68,68,0.2);padding:1.25rem;width:320px;max-width:85vw;text-align:center;';

    var icon = document.createElement('div');
    icon.style.cssText = 'font-size:2rem;margin-bottom:0.5rem;';
    icon.textContent = '\u{1F525}';

    var ttl = document.createElement('div');
    ttl.style.cssText = 'font-family:Audiowide,sans-serif;font-size:0.7rem;color:#ef4444;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.5rem;';
    ttl.textContent = 'Disintegrate ' + charName + '?';

    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:0.65rem;color:#7a7068;margin-bottom:1rem;line-height:1.5;';
    msg.textContent = 'This character and all their adventure marks, equipment, and session data will be permanently destroyed.';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:0.5rem;';

    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'flex:1;background:#232328;border:1px solid #3a3632;color:#7a7068;font-family:Exo 2,sans-serif;font-size:0.65rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:0.5rem;cursor:pointer;min-height:44px;';
    cancelBtn.textContent = 'Abort';
    cancelBtn.addEventListener('click', function () { ov.remove(); });

    var execBtn = document.createElement('button');
    execBtn.style.cssText = 'flex:1;background:#ef4444;border:1px solid #ef4444;color:#1a1a1e;font-family:Exo 2,sans-serif;font-size:0.65rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:0.5rem;cursor:pointer;min-height:44px;';
    execBtn.textContent = 'Disintegrate';
    execBtn.addEventListener('click', function () {
      ov.remove();
      executeDelete(charId);
    });

    btns.appendChild(cancelBtn);
    btns.appendChild(execBtn);
    box.appendChild(icon);
    box.appendChild(ttl);
    box.appendChild(msg);
    box.appendChild(btns);
    ov.appendChild(box);
    document.body.appendChild(ov);

    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  }

  function executeDelete(charId) {
    fetch('/api/characters/' + charId, { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          loadCharacters();
        } else {
          showError(data.error || 'Failed to delete character.');
        }
      })
      .catch(function () {
        showError('Connection failed during deletion.');
      });
  }

  function joinAsPlayer(characterId, characterName) {
    hideError();

    fetch('/api/session/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: 'player', characterId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) { showError(data.error); return; }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          token:         data.token,
          role:          data.role,
          characterId:   data.characterId,
          characterName: data.characterName,
        }));
        window.location.href = '/player/';
      })
      .catch(() => showError('Connection failed. Check server status.'));
  }

  function joinAsGM() {
    fetch('/api/session/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: 'gm' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) { alert(data.error); return; }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          token: data.token,
          role:  data.role,
        }));
        window.location.href = '/gm/';
      })
      .catch(() => alert('Connection failed. Check server status.'));
  }

  function applyRoleVisibility() {
    fetch('/api/auth/role')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var gmBtn = document.getElementById('btn-gm');
        if (d.role === 'player' && gmBtn) {
          gmBtn.style.display = 'none';
        }
      })
      .catch(function () {});
  }

  loadTheme();
  applyRoleVisibility();

  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = THEMES.find(function (t) { return document.documentElement.classList.contains(t); }) || DEFAULT_THEME;
      var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
      applyTheme(next);
    });
  }

  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST' })
        .then(function () { window.location.href = '/login'; })
        .catch(function () { window.location.href = '/login'; });
    });
  }

  var playerBtn = document.getElementById('btn-player');
  if (playerBtn) playerBtn.addEventListener('click', showModal);
  var gmBtn = document.getElementById('btn-gm');
  if (gmBtn) gmBtn.addEventListener('click', joinAsGM);
  var modalCloseBtn = document.getElementById('modal-close');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  var createBtn = document.getElementById('btn-create-character');
  if (createBtn) {
    createBtn.addEventListener('click', function () {
      window.location.href = '/create/?new';
    });
  }

  var modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === e.currentTarget) hideModal();
    });
  }

  const releaseBtn = document.getElementById('admin-release-all');
  const releaseMsg = document.getElementById('admin-release-msg');
  if (releaseBtn) {
    releaseBtn.addEventListener('click', () => {
      releaseBtn.disabled = true;
      releaseBtn.textContent = 'Releasing\u2026';
      fetch('/api/admin/release-all', { method: 'POST' })
        .then((r) => r.json())
        .then(() => {
          releaseBtn.textContent = 'Release All Characters';
          releaseBtn.disabled = false;
          if (releaseMsg) { releaseMsg.textContent = 'Done \u2014 reload list'; releaseMsg.style.display = 'inline'; }
          loadCharacters();
        })
        .catch(() => {
          releaseBtn.textContent = 'Release All Characters';
          releaseBtn.disabled = false;
          if (releaseMsg) { releaseMsg.textContent = 'Failed.'; releaseMsg.style.display = 'inline'; }
        });
    });
  }

  var crawlBtn = document.getElementById('btn-crawl');
  if (crawlBtn) {
    crawlBtn.addEventListener('click', function () {
      if (typeof window.launchCrawl !== 'function') return;

      fetch('/api/crawls/active')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.crawl) {
            window.CRAWL_MISSIONS = window.CRAWL_MISSIONS || {};
            window.CRAWL_MISSIONS._active = data.crawl;
            window.launchCrawl('_active');
          } else if (window.CRAWL_MISSIONS && window.CRAWL_MISSIONS.mission1) {
            window.launchCrawl('mission1');
          }
        })
        .catch(function () {
          if (window.CRAWL_MISSIONS && window.CRAWL_MISSIONS.mission1) {
            window.launchCrawl('mission1');
          }
        });
    });
  }
}());

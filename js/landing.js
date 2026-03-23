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
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    loadCharacters();
  }

  function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }

  function showError(message) {
    const el = document.getElementById('modal-error');
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function hideError() {
    const el = document.getElementById('modal-error');
    el.classList.add('hidden');
  }

  function loadCharacters() {
    const list = document.getElementById('character-list');
    list.innerHTML = '<p class="text-xs" style="color:var(--color-text-secondary);">Loading crew manifest&hellip;</p>';
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
      list.innerHTML = '<p class="text-xs" style="color:var(--color-text-secondary);">No characters found — create one below.</p>';
      return;
    }

    characters.forEach((char) => {
      const card = document.createElement('div');
      card.className = 'crew-card';
      card.style.cssText = 'background:var(--color-bg-frame);border:1px solid var(--color-border);padding:0.5rem 0.6rem;display:flex;flex-direction:column;gap:0.2rem;' + (char.is_connected ? 'opacity:0.45;' : '');

      const nameLine = document.createElement('div');
      nameLine.className = 'text-xs font-medium tracking-wide';
      nameLine.style.cssText = 'color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      nameLine.textContent = char.name;
      card.appendChild(nameLine);

      if (char.species || char.archetype) {
        const metaLine = document.createElement('div');
        metaLine.style.cssText = 'font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        const parts = [char.species, char.archetype].filter(Boolean);
        metaLine.textContent = parts.join(' — ');
        card.appendChild(metaLine);
      }

      if (char.is_connected) {
        const tag = document.createElement('div');
        tag.style.cssText = 'font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-accent-secondary);margin-top:0.15rem;';
        tag.textContent = 'In Session';
        card.appendChild(tag);
      } else {
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:0.35rem;margin-top:0.25rem;';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'text-xs tracking-wider font-medium';
        loadBtn.style.cssText = 'flex:1;padding:0.2rem 0;background:transparent;border:1px solid var(--color-accent-primary);color:var(--color-accent-primary);cursor:pointer;';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => joinAsPlayer(char.id, char.name));

        const editBtn = document.createElement('button');
        editBtn.className = 'text-xs tracking-wider font-medium';
        editBtn.style.cssText = 'flex:1;padding:0.2rem 0;background:transparent;border:1px solid var(--color-border);color:var(--color-text-secondary);cursor:pointer;';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
          window.location.href = '/create/?edit=' + encodeURIComponent(char.id);
        });

        btnRow.appendChild(loadBtn);
        btnRow.appendChild(editBtn);
        card.appendChild(btnRow);
      }

      list.appendChild(card);
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

  loadTheme();

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = THEMES.find((t) => document.documentElement.classList.contains(t)) || DEFAULT_THEME;
    const next    = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(next);
  });

  document.getElementById('btn-player').addEventListener('click', showModal);
  document.getElementById('btn-gm').addEventListener('click', joinAsGM);
  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('btn-create-character').addEventListener('click', () => {
    window.location.href = '/create/?new';
  });

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

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
      if (typeof window.launchCrawl === 'function') {
        window.launchCrawl('mission1');
      }
    });
  }
}());

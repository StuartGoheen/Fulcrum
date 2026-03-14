(function () {
  const THEME_KEY     = 'eote-theme';
  const SESSION_KEY   = 'eote-session';
  const DEFAULT_THEME = 'theme-rebellion';
  const THEMES        = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader'];
  const THEME_LABELS  = {
    'theme-rebellion': 'Rebellion',
    'theme-fringe':    'The Fringe',
    'theme-r2d2':      'R2-D2',
    'theme-vader':     'Darth Vader',
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
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-4 py-3 transition-all duration-150';
      btn.style.cssText = [
        'background:var(--color-bg-frame)',
        'border:1px solid var(--color-border)',
        char.is_connected ? 'opacity:0.45;cursor:not-allowed;' : 'cursor:pointer;',
      ].join(';');

      const nameLine = document.createElement('div');
      nameLine.className = 'text-sm font-medium tracking-wide';
      nameLine.style.color = 'var(--color-text-primary)';
      nameLine.textContent = char.is_connected ? `${char.name} — In Session` : char.name;

      btn.appendChild(nameLine);

      if (char.species || char.archetype) {
        const metaLine = document.createElement('div');
        metaLine.className = 'text-xs mt-1 tracking-widest uppercase';
        metaLine.style.color = 'var(--color-text-secondary)';
        const parts = [char.species, char.archetype].filter(Boolean);
        metaLine.textContent = parts.join(' \u2014 ');
        btn.appendChild(metaLine);
      }

      if (!char.is_connected) {
        btn.addEventListener('click', () => joinAsPlayer(char.id, char.name));
      }

      list.appendChild(btn);
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
    window.location.href = '/create/';
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
}());

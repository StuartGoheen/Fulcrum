(function () {
  const SESSION_KEY = 'eote-session';

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (_) {
      return null;
    }
  }

  function setConnectionIndicator(status) {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;

    const styles = {
      connected:    { background: '#4CAF50', title: 'Connected' },
      disconnected: { background: 'var(--color-accent-secondary)', title: 'Disconnected' },
      connecting:   { background: 'var(--color-text-secondary)', title: 'Connecting...' },
    };

    const s = styles[status] || styles.connecting;
    indicator.style.background = s.background;
    indicator.title = s.title;
  }

  function updateCrewList(connectedPlayers) {
    const crewList = document.getElementById('crew-list');
    if (!crewList) return;

    if (!connectedPlayers || connectedPlayers.length === 0) {
      crewList.innerHTML = '<li style="color:var(--color-text-secondary);">No crew online</li>';
      return;
    }

    crewList.innerHTML = connectedPlayers
      .map((p) => `<li style="color:var(--color-text-primary);">${p.name}</li>`)
      .join('');
  }

  function init() {
    const session = getSession();
    const characterDisplay = document.getElementById('character-display');
    const statusCharacter  = document.getElementById('status-character');
    const statusConnection = document.getElementById('status-connection');

    if (session && session.characterName && characterDisplay) {
      characterDisplay.textContent = session.characterName;
    }
    if (session && session.characterName && statusCharacter) {
      statusCharacter.textContent = session.characterName;
    }

    setConnectionIndicator('connecting');

    const socket = io({
      reconnection:        true,
      reconnectionDelay:   1000,
      reconnectionAttempts: 10,
    });

    const connectedPlayers = [];

    socket.on('connect', () => {
      setConnectionIndicator('connected');
      if (statusConnection) statusConnection.textContent = 'Online';
      console.log('[socket] Connected:', socket.id);

      if (session) {
        socket.emit('session:join', {
          role:          session.role,
          characterId:   session.characterId || null,
          sessionToken:  session.token,
        });
      }
    });

    socket.on('disconnect', () => {
      setConnectionIndicator('disconnected');
      if (statusConnection) statusConnection.textContent = 'Offline';
      console.log('[socket] Disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionIndicator('disconnected');
      console.warn('[socket] Connection error');
    });

    socket.on('state:sync', ({ state }) => {
      console.log('[socket] State synced:', state);
    });

    socket.on('player:connected', ({ characterId, name }) => {
      console.log('[socket] Player connected:', name);
      if (!connectedPlayers.find((p) => p.characterId === characterId)) {
        connectedPlayers.push({ characterId, name });
      }
      updateCrewList(connectedPlayers);
    });

    socket.on('player:disconnected', ({ characterId, name }) => {
      console.log('[socket] Player disconnected:', name);
      const idx = connectedPlayers.findIndex((p) => p.characterId === characterId);
      if (idx !== -1) connectedPlayers.splice(idx, 1);
      updateCrewList(connectedPlayers);
    });

    socket.on('error', ({ message }) => {
      console.error('[socket] Server error:', message);
    });
  }

  function initAdminTools() {
    const btn = document.getElementById('admin-release-all');
    const msg = document.getElementById('admin-release-msg');
    if (!btn) return;

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Releasing\u2026';
      fetch('/api/admin/release-all', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (msg) {
            msg.textContent = data.message || 'Done.';
            msg.style.display = 'block';
          }
          btn.textContent = 'Release All Characters';
          btn.disabled = false;
          sessionStorage.removeItem('eote-session');
        })
        .catch(function () {
          if (msg) {
            msg.textContent = 'Request failed.';
            msg.style.display = 'block';
          }
          btn.textContent = 'Release All Characters';
          btn.disabled = false;
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); initAdminTools(); });
  } else {
    init();
    initAdminTools();
  }
}());

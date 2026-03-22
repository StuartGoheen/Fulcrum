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

  var _currentSocket = null;
  var _lastPool = [];

  function renderDestinyPool(pool) {
    var tracker = document.getElementById('force-tracker');
    if (!tracker) return;
    if (!pool || pool.length === 0) {
      tracker.innerHTML = '<span style="font-size:0.7rem;color:var(--color-text-secondary);font-style:italic;">No crew connected</span>';
      _lastPool = [];
      return;
    }
    _lastPool = pool;

    var indexed = pool.map(function (t, i) { return { token: t, origIdx: i }; });
    indexed.sort(function (a, b) {
      if (a.token.side === b.token.side) return 0;
      return a.token.side === 'toll' ? -1 : 1;
    });

    tracker.innerHTML = indexed.map(function (item) {
      var t = item.token;
      var cls = 'destiny-pip';
      cls += t.side === 'toll' ? ' is-toll' : ' is-hope';
      if (t.tapped) cls += ' is-tapped';
      var canTap = !t.tapped;
      var title = (t.side === 'toll' ? 'Toll' : 'Hope') + (t.tapped ? ' (tapped)' : '');
      if (canTap) title += ' \u2014 click to tap';
      return '<div class="' + cls + '" data-dest-idx="' + item.origIdx + '" title="' + title + '"' +
        (canTap ? ' style="cursor:pointer;"' : '') + '></div>';
    }).join('');

    _renderDestinyState(pool);
  }

  function _renderDestinyState(pool) {
    var el = document.getElementById('destiny-state');
    if (!el) return;
    if (!pool || pool.length === 0) { el.innerHTML = ''; return; }

    var hope = 0; var toll = 0;
    pool.forEach(function (t) {
      if (t.side === 'hope') hope++;
      else toll++;
    });

    var diff = hope - toll;
    var label, cls, bonus;

    if (diff >= 2) {
      label = 'Soft Touch';
      cls = 'destiny-state--soft-touch';
      bonus = '+1 Charm/Persuasion \u2022 \u22121 Intimidate/Deception';
    } else if (diff === 1) {
      label = 'Hope Dominant';
      cls = 'destiny-state--hope';
      bonus = '+1 Charm/Persuasion';
    } else if (diff === 0) {
      label = 'Equilibrium';
      cls = 'destiny-state--equilibrium';
      bonus = 'No passive bonuses';
    } else if (diff === -1) {
      label = 'Toll Dominant';
      cls = 'destiny-state--toll';
      bonus = '+1 Intimidate/Deception';
    } else {
      label = 'The Monster';
      cls = 'destiny-state--monster';
      bonus = '+1 Intimidate/Deception \u2022 \u22121 Charm/Persuasion';
    }

    el.className = 'destiny-state ' + cls;
    el.innerHTML = '<span class="destiny-state-label">' + label + '</span>' +
      '<span class="destiny-state-bonus">' + bonus + '</span>';
  }

  document.addEventListener('click', function (e) {
    var pip = e.target.closest('.destiny-pip[data-dest-idx]');
    if (!pip || !_currentSocket) return;
    var idx = parseInt(pip.getAttribute('data-dest-idx'), 10);
    if (isNaN(idx)) return;
    var t = _lastPool[idx];
    if (!t || t.tapped) return;
    _currentSocket.emit('destiny:tap', { index: idx });
  });

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

    window._socket = socket;
    _currentSocket = socket;
    const connectedPlayers = [];

    socket.on('connect', () => {
      setConnectionIndicator('connected');
      if (statusConnection) statusConnection.textContent = 'Online';

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
    });

    socket.on('connect_error', () => {
      setConnectionIndicator('disconnected');
      console.warn('[socket] Connection error');
    });

    socket.on('state:sync', ({ state }) => {
    });

    socket.on('destiny:sync', ({ pool }) => {
      renderDestinyPool(pool);
    });

    socket.on('player:connected', ({ characterId, name }) => {
      if (!connectedPlayers.find((p) => p.characterId === characterId)) {
        connectedPlayers.push({ characterId, name });
      }
      updateCrewList(connectedPlayers);
    });

    socket.on('player:disconnected', ({ characterId, name }) => {
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

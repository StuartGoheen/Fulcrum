(function () {
  const SESSION_PANELS_KEY = 'eote-panels';
  const THEME_KEY          = 'eote-theme';
  const THEMES             = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader', 'theme-fett', 'theme-holo'];
  const THEME_LABELS       = {
    'theme-rebellion': 'Rebellion',
    'theme-fringe':    'The Fringe',
    'theme-r2d2':      'R2-D2',
    'theme-vader':     'Darth Vader',
    'theme-fett':      'Fett',
    'theme-holo':      'Holo',
  };

  const PANELS = [
    { id: 'panel-1', label: 'Character' },
    { id: 'panel-2', label: 'Armory' },
    { id: 'panel-3', label: 'Maneuvers' },
    { id: 'panel-4', label: 'Loadout' },
    { id: 'panel-5', label: 'Advancement' },
  ];

  const state = {
    leftIndex:  0,
    rightIndex: 1,
  };

  // ─── Panel Navigation ─────────────────────────────────────────────────────────

  function loadState() {
    try {
      const stored = sessionStorage.getItem(SESSION_PANELS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          typeof parsed.leftIndex === 'number' &&
          typeof parsed.rightIndex === 'number' &&
          parsed.leftIndex !== parsed.rightIndex &&
          parsed.leftIndex >= 0 && parsed.leftIndex < PANELS.length &&
          parsed.rightIndex >= 0 && parsed.rightIndex < PANELS.length
        ) {
          state.leftIndex  = parsed.leftIndex;
          state.rightIndex = parsed.rightIndex;
        }
      }
    } catch (_) {}
  }

  function saveState() {
    sessionStorage.setItem(SESSION_PANELS_KEY, JSON.stringify({
      leftIndex:  state.leftIndex,
      rightIndex: state.rightIndex,
    }));
  }

  function nextIndex(current, blocked) {
    let next = (current + 1) % PANELS.length;
    if (next === blocked) next = (next + 1) % PANELS.length;
    return next;
  }

  function prevIndex(current, blocked) {
    let prev = (current - 1 + PANELS.length) % PANELS.length;
    if (prev === blocked) prev = (prev - 1 + PANELS.length) % PANELS.length;
    return prev;
  }

  const _panelDock = null;

  function _ensureDock() {
    let dock = document.getElementById('panel-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'panel-dock';
      dock.style.display = 'none';
      document.body.appendChild(dock);
    }
    return dock;
  }

  function render() {
    const leftContent  = document.getElementById('slot-left-content');
    const rightContent = document.getElementById('slot-right-content');
    if (!leftContent || !rightContent) return;

    const dock = _ensureDock();

    while (leftContent.firstChild) {
      var child = leftContent.firstChild;
      if (child.classList) {
        child.classList.add('hidden');
        child.classList.remove('block');
      }
      dock.appendChild(child);
    }
    while (rightContent.firstChild) {
      var child = rightContent.firstChild;
      if (child.classList) {
        child.classList.add('hidden');
        child.classList.remove('block');
      }
      dock.appendChild(child);
    }

    const leftPanel  = document.getElementById(PANELS[state.leftIndex].id);
    const rightPanel = document.getElementById(PANELS[state.rightIndex].id);

    if (leftPanel) {
      leftPanel.classList.remove('hidden');
      leftPanel.classList.add('block');
      leftContent.appendChild(leftPanel);
      document.dispatchEvent(new CustomEvent('panel:shown', {
        detail: { panelId: PANELS[state.leftIndex].id, label: PANELS[state.leftIndex].label }
      }));
    }

    if (rightPanel) {
      rightPanel.classList.remove('hidden');
      rightPanel.classList.add('block');
      rightContent.appendChild(rightPanel);
      document.dispatchEvent(new CustomEvent('panel:shown', {
        detail: { panelId: PANELS[state.rightIndex].id, label: PANELS[state.rightIndex].label }
      }));
    }

    updateLabels();
    saveState();
  }

  function updateLabels() {
    const leftLabel  = document.getElementById('slot-left-label');
    const rightLabel = document.getElementById('slot-right-label');
    if (leftLabel)  leftLabel.textContent  = PANELS[state.leftIndex].label;
    if (rightLabel) rightLabel.textContent = PANELS[state.rightIndex].label;
  }

  // ─── Theme ────────────────────────────────────────────────────────────────────

  function applyTheme(theme) {
    THEMES.forEach((t) => document.documentElement.classList.remove(t));
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function cycleTheme() {
    const current = THEMES.find((t) => document.documentElement.classList.contains(t)) || 'theme-rebellion';
    const next    = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(next);
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored && THEMES.includes(stored) ? stored : 'theme-rebellion');
  }

  // ─── Tablet Tab System ────────────────────────────────────────────────────────

  // matchMedia for tablet breakpoint (must match CSS @media max-width: 1280px)
  const _tabletMQ = window.matchMedia('(max-width: 1280px)');
  let   _isTablet = _tabletMQ.matches;

  /**
   * Physically moves #char-status-container between its two homes:
   *   tablet  → #tab-status  (left frame Status tab)
   *   desktop → #frame-right (original right column)
   *
   * All child elements keep their IDs so effect-manager.js and
   * character-panel.js continue to find them with getElementById.
   */
  function syncStatusContainer() {
    const statusContainer = document.getElementById('char-status-container');
    if (!statusContainer) return;

    if (_isTablet) {
      const tabStatus = document.getElementById('tab-status');
      if (tabStatus && !tabStatus.contains(statusContainer)) {
        tabStatus.appendChild(statusContainer);
      }
    } else {
      const frameRight = document.getElementById('frame-right');
      if (frameRight && !frameRight.contains(statusContainer)) {
        frameRight.appendChild(statusContainer);
      }
    }
  }

  /** Switch the active left-frame tab. */
  function activateFrameTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.frame-left-tab').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    // Update tab panels — force animation by removing/re-adding is-active
    document.querySelectorAll('.frame-tab-panel').forEach((panel) => {
      const targetId = 'tab-' + tabName;
      if (panel.id === targetId) {
        panel.classList.add('is-active');
      } else {
        panel.classList.remove('is-active');
      }
    });
  }

  /** Wire up tab button clicks. */
  function initFrameTabs() {
    document.querySelectorAll('.frame-left-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) activateFrameTab(tabName);
      });
    });
  }

  /** Handle viewport crossing the 1280px breakpoint. */
  function onTabletChange(e) {
    _isTablet = e.matches;
    syncStatusContainer();

    // When switching back to desktop, reset left frame to Character tab
    // so the status content isn't visually missing from the right frame
    if (!_isTablet) {
      activateFrameTab('character');
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    loadState();
    initTheme();
    render();
    initFrameTabs();

    // Sync status container placement on load
    syncStatusContainer();

    // Listen for viewport size changes across the tablet breakpoint
    _tabletMQ.addEventListener('change', onTabletChange);

    // Center panel navigation
    document.getElementById('slot-left-prev').addEventListener('click', () => {
      state.leftIndex = prevIndex(state.leftIndex, state.rightIndex);
      render();
    });
    document.getElementById('slot-left-next').addEventListener('click', () => {
      state.leftIndex = nextIndex(state.leftIndex, state.rightIndex);
      render();
    });
    document.getElementById('slot-right-prev').addEventListener('click', () => {
      state.rightIndex = prevIndex(state.rightIndex, state.leftIndex);
      render();
    });
    document.getElementById('slot-right-next').addEventListener('click', () => {
      state.rightIndex = nextIndex(state.rightIndex, state.leftIndex);
      render();
    });

    // Global click delegation
    document.addEventListener('click', (e) => {
      if (e.target.closest('#char-theme-toggle')) cycleTheme();
      if (e.target.closest('#destiny-info-btn')) {
        if (window.GlossaryOverlay) window.GlossaryOverlay.open('destiny_pool');
      }
    });

  }

  window.PanelSystem = { render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

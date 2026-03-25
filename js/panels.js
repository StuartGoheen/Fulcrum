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

  const TRIPLE_MIN_WIDTH = 900;

  const state = {
    leftIndex:  0,
    rightIndex: 1,
    midIndex:   2,
    tripleMode: false,
  };

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
        if (typeof parsed.midIndex === 'number' &&
            parsed.midIndex >= 0 && parsed.midIndex < PANELS.length) {
          state.midIndex = parsed.midIndex;
        }
      }
    } catch (_) {}
    _ensureUnique();
  }

  function _ensureUnique() {
    var used = [state.leftIndex, state.rightIndex];
    if (state.tripleMode) {
      if (used.indexOf(state.midIndex) !== -1) {
        for (var i = 0; i < PANELS.length; i++) {
          if (used.indexOf(i) === -1) { state.midIndex = i; break; }
        }
      }
    }
  }

  function saveState() {
    sessionStorage.setItem(SESSION_PANELS_KEY, JSON.stringify({
      leftIndex:  state.leftIndex,
      rightIndex: state.rightIndex,
      midIndex:   state.midIndex,
    }));
  }

  function _allOccupied() {
    var arr = [state.leftIndex, state.rightIndex];
    if (state.tripleMode) arr.push(state.midIndex);
    return arr;
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

  function _dockSlot(contentEl, dock) {
    while (contentEl.firstChild) {
      var child = contentEl.firstChild;
      if (child.classList) {
        child.classList.add('hidden');
        child.classList.remove('block');
      }
      dock.appendChild(child);
    }
  }

  function _fillSlot(contentEl, panelIndex) {
    var panel = document.getElementById(PANELS[panelIndex].id);
    if (panel) {
      panel.classList.remove('hidden');
      panel.classList.add('block');
      contentEl.appendChild(panel);
      document.dispatchEvent(new CustomEvent('panel:shown', {
        detail: { panelId: PANELS[panelIndex].id, label: PANELS[panelIndex].label }
      }));
    }
  }

  function render() {
    const leftContent  = document.getElementById('slot-left-content');
    const rightContent = document.getElementById('slot-right-content');
    const midContent   = document.getElementById('slot-mid-content');
    if (!leftContent || !rightContent) return;

    const dock = _ensureDock();

    _dockSlot(leftContent, dock);
    _dockSlot(rightContent, dock);
    if (midContent) _dockSlot(midContent, dock);

    _fillSlot(leftContent, state.leftIndex);
    _fillSlot(rightContent, state.rightIndex);

    if (state.tripleMode && midContent) {
      _fillSlot(midContent, state.midIndex);
    }

    updateTabs();
    saveState();
  }

  function updateLabels() {
    updateTabs();
  }

  function updateTabs() {
    var occupied = _allOccupied();
    var allTabs = document.querySelectorAll('.panel-tab');
    for (var i = 0; i < allTabs.length; i++) {
      var tab = allTabs[i];
      var slot = tab.getAttribute('data-slot');
      var panelIdx = parseInt(tab.getAttribute('data-panel'), 10);

      var isActive = false;
      if (slot === 'left')  isActive = (panelIdx === state.leftIndex);
      if (slot === 'right') isActive = (panelIdx === state.rightIndex);
      if (slot === 'mid')   isActive = (panelIdx === state.midIndex);

      var isBlocked = false;
      if (slot === 'left')  isBlocked = occupied.indexOf(panelIdx) !== -1 && panelIdx !== state.leftIndex;
      if (slot === 'right') isBlocked = occupied.indexOf(panelIdx) !== -1 && panelIdx !== state.rightIndex;
      if (slot === 'mid')   isBlocked = occupied.indexOf(panelIdx) !== -1 && panelIdx !== state.midIndex;

      tab.classList.toggle('active', isActive);
      tab.classList.toggle('blocked', isBlocked);
      tab.disabled = isBlocked;
    }
  }

  function _checkTripleMode() {
    var center = document.getElementById('center-content');
    if (!center) return;
    var w = center.offsetWidth;
    var shouldTriple = w >= TRIPLE_MIN_WIDTH;
    if (shouldTriple === state.tripleMode) return;
    state.tripleMode = shouldTriple;
    _ensureUnique();
    _applyTripleVisibility();
    render();
    document.dispatchEvent(new CustomEvent('triplemode:changed', { detail: { tripleMode: shouldTriple } }));
  }

  function _applyTripleVisibility() {
    var slotMid = document.getElementById('slot-mid');
    var handle2 = document.getElementById('center-resize-handle-2');
    var tabsMid = document.getElementById('tabs-mid');
    var triDividers = document.querySelectorAll('.panel-nav-divider--triple');

    if (state.tripleMode) {
      if (slotMid) slotMid.style.display = '';
      if (handle2) handle2.style.display = '';
      if (tabsMid) tabsMid.style.display = '';
      for (var d = 0; d < triDividers.length; d++) triDividers[d].style.display = '';
    } else {
      if (slotMid) slotMid.style.display = 'none';
      if (handle2) handle2.style.display = 'none';
      if (tabsMid) tabsMid.style.display = 'none';
      for (var d = 0; d < triDividers.length; d++) triDividers[d].style.display = 'none';
    }
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

  const _tabletMQ = window.matchMedia('(max-width: 1280px)');
  let   _isTablet = _tabletMQ.matches;

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

  function activateFrameTab(tabName) {
    document.querySelectorAll('.frame-left-tab').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('.frame-tab-panel').forEach((panel) => {
      const targetId = 'tab-' + tabName;
      if (panel.id === targetId) {
        panel.classList.add('is-active');
      } else {
        panel.classList.remove('is-active');
      }
    });
  }

  function initFrameTabs() {
    document.querySelectorAll('.frame-left-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) activateFrameTab(tabName);
      });
    });
  }

  function onTabletChange(e) {
    _isTablet = e.matches;
    syncStatusContainer();

    if (!_isTablet) {
      activateFrameTab('character');
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    loadState();
    initTheme();

    _applyTripleVisibility();
    render();
    initFrameTabs();

    syncStatusContainer();

    _tabletMQ.addEventListener('change', onTabletChange);

    setTimeout(function () { _checkTripleMode(); }, 100);
    window.addEventListener('resize', function () { _checkTripleMode(); });

    document.addEventListener('click', function (e) {
      var tab = e.target.closest('.panel-tab');
      if (!tab) return;
      var slot = tab.getAttribute('data-slot');
      var panelIdx = parseInt(tab.getAttribute('data-panel'), 10);
      if (isNaN(panelIdx) || panelIdx < 0 || panelIdx >= PANELS.length) return;

      var occupied = _allOccupied();
      if (occupied.indexOf(panelIdx) !== -1) return;

      if (slot === 'left') {
        state.leftIndex = panelIdx;
        render();
      } else if (slot === 'right') {
        state.rightIndex = panelIdx;
        render();
      } else if (slot === 'mid' && state.tripleMode) {
        state.midIndex = panelIdx;
        render();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#char-theme-toggle')) cycleTheme();
      if (e.target.closest('#destiny-info-btn')) {
        if (window.GlossaryOverlay) window.GlossaryOverlay.open('destiny_pool');
      }
    });

  }

  window.PanelSystem = { render: render, checkTripleMode: _checkTripleMode };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

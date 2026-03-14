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
    'theme-holo':      'HOLO',
  };

  const PANELS = [
    { id: 'panel-1', label: 'Character' },
    { id: 'panel-2', label: 'Armory' },
    { id: 'panel-3', label: 'Maneuvers' },
    { id: 'panel-4', label: 'Loadout' },
  ];

  const state = {
    leftIndex:  0,
    rightIndex: 1,
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

  function renderPanel(slotContentEl, panelIndex) {
    const panelEl = document.getElementById(PANELS[panelIndex].id);
    if (!panelEl) return;

    slotContentEl.innerHTML = '';
    slotContentEl.appendChild(panelEl.cloneNode(true));
    slotContentEl.firstChild.classList.remove('hidden');
    slotContentEl.firstChild.classList.add('block');
  }

  function updateLabels() {
    const leftLabel  = document.getElementById('slot-left-label');
    const rightLabel = document.getElementById('slot-right-label');
    if (leftLabel)  leftLabel.textContent  = PANELS[state.leftIndex].label;
    if (rightLabel) rightLabel.textContent = PANELS[state.rightIndex].label;
  }

  function render() {
    const leftContent  = document.getElementById('slot-left-content');
    const rightContent = document.getElementById('slot-right-content');
    if (leftContent)  renderPanel(leftContent,  state.leftIndex);
    if (rightContent) renderPanel(rightContent, state.rightIndex);
    updateLabels();
    saveState();
  }

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

  function init() {
    loadState();
    initTheme();
    render();

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

    document.addEventListener('click', (e) => {
      if (e.target.closest('#char-theme-toggle')) cycleTheme();
      if (e.target.closest('#destiny-info-btn')) {
        var ov = document.getElementById('destiny-overlay');
        if (ov) ov.hidden = !ov.hidden;
      }
      if (e.target.closest('#destiny-overlay-close')) {
        var ov = document.getElementById('destiny-overlay');
        if (ov) ov.hidden = true;
      }
    });

    document.querySelectorAll('.force-token').forEach((token) => {
      token.addEventListener('click', () => {
        token.classList.toggle('is-dark');
        updateDestinyCounts();
      });
    });
  }

  function updateDestinyCounts() {
    var tokens = document.querySelectorAll('.force-token');
    var toll   = document.querySelectorAll('.force-token.is-dark').length;
    var hope   = tokens.length - toll;
    var hopeEl = document.getElementById('hope-count');
    var tollEl = document.getElementById('toll-count');
    if (hopeEl) hopeEl.textContent = hope;
    if (tollEl) tollEl.textContent = toll;
  }

  window.PanelSystem = { render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

(function () {
  'use strict';

  function _toast(msg) {
    var el = document.getElementById('cc-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cc-toast';
      el.className = 'cc-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('cc-toast--visible');
    void el.offsetWidth;
    el.classList.add('cc-toast--visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('cc-toast--visible');
    }, 3000);
  }

  var THEME_KEY     = 'eote-theme';
  var DEFAULT_THEME = 'theme-rebellion';
  var THEMES        = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader', 'theme-fett', 'theme-holo'];
  var THEME_LABELS  = {
    'theme-rebellion': 'Rebellion',
    'theme-fringe':    'The Fringe',
    'theme-r2d2':      'R2-D2',
    'theme-vader':     'Darth Vader',
    'theme-fett':      'Fett',
    'theme-holo':      'Holo',
  };

  var CREATION_KEY = 'eote-char-creation';

  var ARENA_ORDER  = ['physique', 'reflex', 'grit', 'wits', 'presence'];
  var ARENA_LABELS = {
    physique: 'Physique',
    reflex:   'Reflex',
    grit:     'Grit',
    wits:     'Wits',
    presence: 'Presence',
  };
  var ARENA_BASELINE = { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' };
  var DIE_ORDER      = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var SPECIES = [];

  var PHASE1_CARDS = [];
  var PHASE2_CARDS = [];
  var PHASE3_CARDS = [];


  var state = {
    species:            null,
    previewId:          null,
    favoredDiscipline:  null,
    phase1:         null,
    phase2:         null,
    phase3:         null,
    arenaAdj:       {},
    discValues:     {},
    discIncomp:     {},
    spentAdv:        0,
    eliteTokensUsed: 0,
    kitChoices:      {},
    startingGear:    [],
    soldBackCredits: 0,
    soldBackgroundKeys: [],
    destiny:         null,
    personalDestiny: null,
    charName:        '',
    charTitle:       '',
    charGender:      'Male',
    backstory:       '',
    editId:          null,
  };



  var characterSheet = {
    species:     null,
    arenas:      null,
    disciplines: [],
    abilities:   [],
  };

  /* ── Theme ─────────────────────────────────────────────────────────────── */

  function applyTheme(theme) {
    THEMES.forEach(function (t) { document.documentElement.classList.remove(t); });
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
    var el = document.getElementById('theme-label');
    if (el) el.textContent = THEME_LABELS[theme] || theme;
  }

  function loadTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored && THEMES.indexOf(stored) !== -1 ? stored : DEFAULT_THEME);
  }

  /* ── Persistence ────────────────────────────────────────────────────────── */

  function saveState() {
    try { sessionStorage.setItem(CREATION_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function loadSavedState() {
    try {
      var s = JSON.parse(sessionStorage.getItem(CREATION_KEY));
      if (s) Object.assign(state, s);
    } catch (_) {}
  }

  /* ── Carousel ───────────────────────────────────────────────────────────── */

  function buildCarousel() {
    buildPhaseCarousel(SPECIES, "ph-grid-species", selectSpecies, buildSpeciesCardFlat);
  }

  function buildSpeciesCardFlat(sp, selectFn) {
    var wrapper = document.createElement("div");
    wrapper.className = "ph-card-wrap ph-card-flat";

    var cardEl = document.createElement("div");
    cardEl.className = "ph3-species-card";

    var imgCol = document.createElement("div");
    imgCol.className = "ph3-img-col";
    if (sp.imageUrl) {
      var img = document.createElement("img");
      img.src = sp.imageUrl;
      img.alt = sp.name;
      img.className = "ph3-card-img";
      imgCol.appendChild(img);
    }

    var detailCol = document.createElement("div");
    detailCol.className = "ph3-detail-col";

    var nameEl = document.createElement("h2");
    nameEl.className = "ph3-card-name";
    nameEl.textContent = sp.name;
    detailCol.appendChild(nameEl);

    var tagEl = document.createElement("p");
    tagEl.className = "ph3-card-symbol";
    tagEl.textContent = sp.tagline;
    detailCol.appendChild(tagEl);

    var loreEl = document.createElement("p");
    loreEl.className = "ph3-narrative";
    loreEl.textContent = sp.lore || "";
    detailCol.appendChild(loreEl);

    var arenaBlock = document.createElement("div");
    arenaBlock.className = "ph3-knack-block";
    var arenaLabel = document.createElement("p");
    arenaLabel.className = "ph3-knack-label";
    arenaLabel.textContent = "Arena Shift";
    arenaBlock.appendChild(arenaLabel);
    var arenaName = document.createElement("p");
    arenaName.className = "ph3-knack-name";
    arenaName.textContent = sp.arenaShift.name;
    arenaBlock.appendChild(arenaName);
    var arenaDesc = document.createElement("p");
    arenaDesc.className = "ph3-knack-desc";
    arenaDesc.textContent = sp.arenaShift.desc;
    arenaBlock.appendChild(arenaDesc);
    detailCol.appendChild(arenaBlock);

    var favBlock = document.createElement("div");
    favBlock.className = "ph3-knack-block";
    var favLabel = document.createElement("p");
    favLabel.className = "ph3-knack-label";
    favLabel.textContent = "Favored Discipline";
    favBlock.appendChild(favLabel);
    var favDescEl = document.createElement("p");
    favDescEl.className = "ph3-knack-desc";
    favDescEl.textContent = sp.favoredDiscipline.desc;
    favBlock.appendChild(favDescEl);

    var choices = sp.favoredDiscipline.choices;
    if (choices && choices.length > 5) {
      var selectEl = document.createElement("select");
      selectEl.className = "cc-favored-select";
      var defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "— Choose a discipline —";
      selectEl.appendChild(defaultOpt);
      choices.forEach(function (ch) {
        var opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = ch.label;
        selectEl.appendChild(opt);
      });
      selectEl.addEventListener("change", function () {
        state.favoredDiscipline = selectEl.value || null;
      });
      if (state.favoredDiscipline) selectEl.value = state.favoredDiscipline;
      favBlock.appendChild(selectEl);
    } else if (choices && choices.length > 0) {
      var pillWrap = document.createElement("div");
      pillWrap.className = "cc-favored-pills";
      choices.forEach(function (ch) {
        var pill = document.createElement("button");
        pill.className = "cc-favored-pill";
        pill.textContent = ch.label;
        pill.dataset.disciplineId = ch.id;
        if (state.favoredDiscipline && state.favoredDiscipline === ch.id) {
          pill.classList.add("cc-favored-pill-selected");
        }
        pill.addEventListener("click", function (e) {
          e.stopPropagation();
          state.favoredDiscipline = ch.id;
          pillWrap.querySelectorAll(".cc-favored-pill").forEach(function (p) {
            p.classList.remove("cc-favored-pill-selected");
          });
          pill.classList.add("cc-favored-pill-selected");
        });
        pillWrap.appendChild(pill);
      });
      favBlock.appendChild(pillWrap);
    }
    detailCol.appendChild(favBlock);

    var bioBlock = document.createElement("div");
    bioBlock.className = "ph3-knack-block";
    var bioLabel = document.createElement("p");
    bioLabel.className = "ph3-knack-label";
    bioLabel.textContent = "Biological Truth";
    bioBlock.appendChild(bioLabel);
    var bioName = document.createElement("p");
    bioName.className = "ph3-knack-name";
    bioName.textContent = sp.biologicalTruth.name;
    bioBlock.appendChild(bioName);
    var bioDesc = document.createElement("p");
    bioDesc.className = "ph3-knack-desc";
    bioDesc.textContent = sp.biologicalTruth.desc;
    bioBlock.appendChild(bioDesc);
    detailCol.appendChild(bioBlock);

    if (sp.speciesTrait) {
      var traitBlock = document.createElement("div");
      traitBlock.className = "ph3-knack-block";
      var traitLabel = document.createElement("p");
      traitLabel.className = "ph3-knack-label";
      traitLabel.textContent = "Species Trait";
      traitBlock.appendChild(traitLabel);
      var traitName = document.createElement("p");
      traitName.className = "ph3-knack-name";
      traitName.textContent = sp.speciesTrait.name;
      traitBlock.appendChild(traitName);
      var traitDesc = document.createElement("p");
      traitDesc.className = "ph3-knack-desc";
      traitDesc.textContent = sp.speciesTrait.desc;
      traitBlock.appendChild(traitDesc);
      detailCol.appendChild(traitBlock);
    }

    var selectBtn = document.createElement("button");
    selectBtn.className = "cc-select-btn";
    selectBtn.textContent = "Select " + sp.name + " →";
    selectBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      selectFn(sp);
    });
    detailCol.appendChild(selectBtn);

    cardEl.appendChild(imgCol);
    cardEl.appendChild(detailCol);
    wrapper.appendChild(cardEl);
    return wrapper;
  }
    function buildFavoredList(sp) {
      if (!sp.favoredDiscipline || !sp.favoredDiscipline.choices) return [];
      if (sp.favoredDiscipline.choices.length > 5) {
        return ['Any Discipline (Your Choice)'];
      }
      return sp.favoredDiscipline.choices.map(function (ch) {
        return ch.label;
      });
    }

  /* ── Arenas & Disciplines step ───────────────────────────────────── */

  var DISCIPLINES_BY_ARENA = [
    { id: 'physique', name: 'Physique', disciplines: [
      { id: 'athletics',     name: 'Athletics' },
      { id: 'brawl',         name: 'Brawl' },
      { id: 'endure',        name: 'Endure' },
      { id: 'melee',         name: 'Melee' },
      { id: 'heavy_weapons', name: 'Heavy Weapons' },
    ]},
    { id: 'reflex', name: 'Reflex', disciplines: [
      { id: 'evasion',       name: 'Evasion' },
      { id: 'piloting',      name: 'Piloting' },
      { id: 'ranged',        name: 'Ranged' },
      { id: 'skulduggery',   name: 'Skulduggery' },
      { id: 'stealth',       name: 'Stealth' },
    ]},
    { id: 'grit', name: 'Grit', disciplines: [
      { id: 'beast_handling', name: 'Beast Handling' },
      { id: 'intimidate',    name: 'Intimidate' },
      { id: 'resolve',       name: 'Resolve' },
      { id: 'survival',      name: 'Survival' },
      { id: 'control_spark',  name: 'Control',       force: true },
    ]},
    { id: 'wits', name: 'Wits', disciplines: [
      { id: 'investigation', name: 'Investigation' },
      { id: 'medicine',      name: 'Medicine' },
      { id: 'tactics',       name: 'Tactics' },
      { id: 'tech',          name: 'Tech' },
      { id: 'sense_spark',    name: 'Sense',         force: true },
    ]},
    { id: 'presence', name: 'Presence', disciplines: [
      { id: 'charm',         name: 'Charm' },
      { id: 'deception',     name: 'Deception' },
      { id: 'insight',       name: 'Insight' },
      { id: 'persuasion',    name: 'Persuasion' },
      { id: 'alter_spark',    name: 'Alter',         force: true },
    ]},
  ];

  var DIE_STEPS            = ['2D4L', 'D4', 'D6', 'D8', 'D10', 'D12', '2D12H'];
  var MAX_INCOMP_REQUIRED  = 5;
  var MAX_INCOMP_OPTIONAL  = 4;
  var MAX_INCOMP_TOTAL     = 9;
  var ARENA_ADVANCE_BUDGET = 3;

  function favoredToId(str) {
    if (!str) return null;
    return str.split('(')[0].trim().toLowerCase().replace(/\s+/g, '_');
  }

  function getFavoredIds() {
    var ids = {};
    var p1 = state.phase1 ? PHASE1_CARDS.find(function(c){ return c.id === state.phase1; }) : null;
    var p2 = state.phase2 ? PHASE2_CARDS.find(function(c){ return c.id === state.phase2; }) : null;
    if (p1 && p1._meta && p1._meta.favored) ids[favoredToId(p1._meta.favored)] = true;
    if (p2 && p2._meta && p2._meta.favored) ids[favoredToId(p2._meta.favored)] = true;
    if (state.favoredDiscipline && state.favoredDiscipline !== 'any') ids[state.favoredDiscipline] = true;
    return ids;
  }

  function getSpeciesArenas() {
    var sp = state.species ? SPECIES.find(function(s){ return s.id === state.species; }) : null;
    if (!sp) return { physique:'D6', reflex:'D6', grit:'D6', wits:'D6', presence:'D6' };
    return Object.assign({}, ARENA_BASELINE, sp.arenas);
  }

  function statsGetDerived() {
    var baseArenas = getSpeciesArenas();
    var arenaAdj   = state.arenaAdj || {};
    var netArenaSpend = Object.values(arenaAdj).reduce(function(acc, v){ return acc + v; }, 0);
    var arenaAdvAvail = ARENA_ADVANCE_BUDGET - netArenaSpend;
    var arenaValues = {};
    ['physique','reflex','grit','wits','presence'].forEach(function(k) {
      var base = DIE_STEPS.indexOf(baseArenas[k] || 'D6');
      var adj  = arenaAdj[k] || 0;
      var idx  = Math.max(0, Math.min(DIE_STEPS.indexOf('D10'), base + adj));
      arenaValues[k] = DIE_STEPS[idx];
    });
    var discIncomp       = state.discIncomp  || {};
    var discValues       = state.discValues  || {};
    var allIncompKeys    = Object.keys(discIncomp);
    var forceIncompCount = allIncompKeys.filter(function(k) { return FORCE_DISC_IDS.indexOf(k) >= 0; }).length;
    var playerIncompCount = allIncompKeys.length - forceIncompCount;
    var incompCount      = allIncompKeys.length;
    var sp = state.species ? SPECIES.find(function(s){ return s.id === state.species; }) : null;
    var freeAdv = (sp && sp.speciesTrait && sp.speciesTrait.name === "Adaptable") ? 1 : 0;
    var totalAdv         = incompCount + freeAdv;
    var totalEliteTokens = Math.floor(totalAdv / 5);
    var spentAdv         = state.spentAdv         || 0;
    var eliteTokensUsed  = state.eliteTokensUsed  || 0;
    var advAvail         = totalAdv - spentAdv;
    var eliteTokensAvail = totalEliteTokens - eliteTokensUsed;
    return {
      baseArenas:       baseArenas,
      arenaValues:      arenaValues,
      arenaAdvAvail:    arenaAdvAvail,
      incompCount:      incompCount,
      playerIncompCount: playerIncompCount,
      forceIncompCount:  forceIncompCount,
      totalAdv:         totalAdv,
      totalEliteTokens: totalEliteTokens,
      spentAdv:         spentAdv,
      eliteTokensUsed:  eliteTokensUsed,
      advAvail:         advAvail,
      eliteTokensAvail: eliteTokensAvail,
      discValues:       discValues,
      discIncomp:       discIncomp,
      freeAdv:          freeAdv,
    };
  }

  function statsGetDiscValue(discId, d) {
    if (d.discIncomp[discId]) return 'D4';
    return d.discValues[discId] || 'D6';
  }

  /* ══════════════════════════════════════════════════════════════════════
     Arenas & Disciplines — Guided 3-Phase Workflow
     ══════════════════════════════════════════════════════════════════════ */

  var FORCE_DISC_IDS = ['control_spark', 'sense_spark', 'alter_spark'];
  var _statsGlossary = {};
  var _statsPhase = 'incomp'; // 'incomp' | 'arenas' | 'disciplines'
  var _selectedCell = null;   // { type:'arena'|'disc', id:string } or null

  function initStatsScreen() {
    if (!state.discValues)      state.discValues      = {};
    if (!state.discIncomp)      state.discIncomp      = {};
    if (!state.arenaAdj)        state.arenaAdj        = {};
    if (!state.spentAdv)        state.spentAdv        = 0;
    if (!state.eliteTokensUsed) state.eliteTokensUsed = 0;

    // Auto-set Force disciplines as incompetent if not explicitly touched
    if (!state._forceAutoSet) {
      FORCE_DISC_IDS.forEach(function(fid) {
        if (!state.discIncomp[fid] && !state.discValues[fid]) {
          state.discIncomp[fid] = true;
          state.discValues[fid] = 'D4';
        }
      });
      state._forceAutoSet = true;
      saveState();
    }

    _statsPhase = 'incomp';
    _selectedCell = null;

    if (Object.keys(_statsGlossary).length === 0) {
      fetch('/data/glossary.json').then(function(r) { return r.json(); }).then(function(data) {
        data.forEach(function(entry) { _statsGlossary[entry.id] = entry; });
        renderStatsContent();
      });
    }

    renderStatsContent();
    showScreen('stats');
    updateStepTrack(4);
  }

  function normalizeAdvances() {
    if (!state.discValues) return;
    var d = statsGetDerived();
    var changed = false;
    while (d.advAvail < 0) {
      var found = false;
      var keys = Object.keys(state.discValues);
      for (var i = keys.length - 1; i >= 0; i--) {
        var dk = keys[i];
        if (!state.discIncomp || !state.discIncomp[dk]) {
          var val = state.discValues[dk];
          if (val && val !== 'D6') {
            if (val === 'D10') {
              state.spentAdv = Math.max(0, (state.spentAdv || 0) - 2);
              state.eliteTokensUsed = Math.max(0, (state.eliteTokensUsed || 0) - 1);
            } else if (val === 'D8') {
              state.spentAdv = Math.max(0, (state.spentAdv || 0) - 1);
            }
            delete state.discValues[dk];
            found = true;
            changed = true;
            break;
          }
        }
      }
      if (!found) break;
      d = statsGetDerived();
    }
    if (changed) saveState();
  }

    function renderStatsContent() {
    normalizeAdvances();
    var d          = statsGetDerived();
    var favoredIds = getFavoredIds();

    renderStatsPhaseIndicator();
    renderStatsStatusBar(d);
    renderStatsGrid(d, favoredIds);
    renderStatsDetailCard(d, favoredIds);
    updateStatsNav(d);
  }

  /* ── Phase indicator breadcrumb ──────────────────────────────────── */

  function renderStatsPhaseIndicator() {
    var el = document.getElementById('stats-phase-indicator');
    if (!el) return;
    var phases = [
      { key: 'incomp',      label: 'Weaknesses' },
      { key: 'arenas',      label: 'Arenas' },
      { key: 'disciplines', label: 'Specialize' },
    ];
    var order = ['incomp', 'arenas', 'disciplines'];
    var curIdx = order.indexOf(_statsPhase);
    el.innerHTML = '';

    phases.forEach(function(p, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.className = 'stats-phase-sep';
        sep.textContent = '\u203A';
        el.appendChild(sep);
      }
      var pip = document.createElement('span');
      var cls = 'stats-phase-pip';
      if (i < curIdx) cls += ' stats-phase-pip--done';
      else if (i === curIdx) cls += ' stats-phase-pip--active';
      pip.className = cls;

      var num = document.createElement('span');
      num.className = 'stats-phase-pip__num';
      num.textContent = i < curIdx ? '\u2713' : String(i + 1);
      pip.appendChild(num);

      var lbl = document.createElement('span');
      lbl.textContent = p.label;
      pip.appendChild(lbl);

      if (i <= curIdx) {
        pip.style.cursor = 'pointer';
        pip.addEventListener('click', (function(phase) {
          return function() {
            _statsPhase = phase;
            _selectedCell = null;
            renderStatsContent();
          };
        })(p.key));
      }

      el.appendChild(pip);
    });

    // Update subtitle
    var sub = document.getElementById('stats-phase-sub');
    if (sub) {
      var subs = {
        incomp: 'Mark your weaknesses. Force disciplines start sealed — most characters leave them that way.',
        arenas: 'Spend 3 free advances to boost your Arenas. Step up to strengthen, step down to refund.',
        disciplines: 'Spend earned advances to specialize. Restore Force disciplines here if you want the Force.',
      };
      sub.textContent = subs[_statsPhase] || '';
    }
  }

  /* ── Status bar (badges) ─────────────────────────────────────────── */

  function renderStatsStatusBar(d) {
    var bar = document.getElementById('stats-status-bar');
    if (!bar) return;
    bar.innerHTML = '';

    if (_statsPhase === 'incomp') {
      var totalIncomp = d.playerIncompCount + d.forceIncompCount;
      var effectiveReq = Math.max(0, MAX_INCOMP_REQUIRED - (d.freeAdv || 0));
      var badge = document.createElement('span');
      var ok = totalIncomp >= effectiveReq;
      badge.className = 'cc-adv-badge ' + (ok ? 'cc-adv-badge--ok' : 'cc-adv-badge--warn');
      badge.textContent = totalIncomp + '/' + effectiveReq + ' required' +
        (d.freeAdv ? ' (Adaptable: +' + d.freeAdv + ' free)' : '');
      bar.appendChild(badge);

      var playerOpt = Math.max(0, d.playerIncompCount - Math.max(0, effectiveReq - d.forceIncompCount));
      var optCap = MAX_INCOMP_TOTAL - FORCE_DISC_IDS.length - Math.max(0, effectiveReq - d.forceIncompCount);
      if (playerOpt > 0 || ok) {
        var optBadge = document.createElement('span');
        optBadge.className = 'cc-adv-badge';
        optBadge.textContent = '+' + playerOpt + '/' + optCap + ' optional';
        bar.appendChild(optBadge);
      }
    } else if (_statsPhase === 'arenas') {
      var ab = document.createElement('span');
      ab.className = 'cc-adv-badge ' + (d.arenaAdvAvail > 0 ? 'cc-adv-badge--ok' : '');
      ab.textContent = d.arenaAdvAvail + ' of ' + ARENA_ADVANCE_BUDGET + ' arena advances remaining';
      bar.appendChild(ab);
    } else if (_statsPhase === 'disciplines') {
      if (d.totalAdv > 0) {
        var db = document.createElement('span');
        db.className = 'cc-adv-badge ' + (d.advAvail > 0 ? 'cc-adv-badge--ok' : '');
        db.textContent = d.advAvail + ' advance' + (d.advAvail !== 1 ? 's' : '') + ' available';
        bar.appendChild(db);
      }
      if (d.totalEliteTokens > 0) {
        var eb = document.createElement('span');
        eb.className = 'cc-adv-badge cc-adv-badge--enhanced';
        eb.textContent = d.eliteTokensAvail + '/' + d.totalEliteTokens + ' Elite token' + (d.totalEliteTokens !== 1 ? 's' : '');
        bar.appendChild(eb);
      }
      // Advance dots
      if (d.totalAdv > 0) {
        var dotsWrap = document.createElement('div');
        dotsWrap.className = 'cc-adv-dots';
        for (var i = 1; i <= d.totalAdv; i++) {
          var isElite = (i % 5 === 0);
          if (isElite && i > 1) { var g = document.createElement('div'); g.className = 'cc-adv-dot-gap'; dotsWrap.appendChild(g); }
          var dot = document.createElement('div');
          var spent = i <= d.spentAdv;
          dot.className = 'cc-adv-dot' + (spent ? '' : ' cc-adv-dot--filled') + (isElite ? ' cc-adv-dot--enhanced' : '');
          dotsWrap.appendChild(dot);
        }
        bar.appendChild(dotsWrap);
      }
    }
  }

  /* ── 5×5 Grid ────────────────────────────────────────────────────── */

  function renderStatsGrid(d, favoredIds) {
    var grid = document.getElementById('stats-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Top row: 5 arena header cells
    DISCIPLINES_BY_ARENA.forEach(function(ag) {
      var cell = buildArenaCell(ag, d);
      grid.appendChild(cell);
    });

    // 5 rows of disciplines (row-major: row 0 = first disc of each arena, etc.)
    for (var row = 0; row < 5; row++) {
      DISCIPLINES_BY_ARENA.forEach(function(ag) {
        var disc = ag.disciplines[row];
        var cell = buildDiscCell(disc, ag.id, d, favoredIds);
        grid.appendChild(cell);
      });
    }
  }

  function buildArenaCell(ag, d) {
    var val = d.arenaValues[ag.id] || 'D6';
    var cell = document.createElement('div');
    var cls = 'sg-cell sg-cell--arena';

    var isActive = _selectedCell && _selectedCell.type === 'arena' && _selectedCell.id === ag.id;
    if (isActive) cls += ' sg-cell--active';

    // Phase gating
    if (_statsPhase !== 'arenas') cls += ' sg-cell--disabled';

    var curIdx = DIE_STEPS.indexOf(val);
    if (curIdx > DIE_STEPS.indexOf(d.baseArenas[ag.id] || 'D6')) cls += ' sg-cell--advanced';

    cell.className = cls;

    var img = document.createElement('img');
    img.src = '/assets/' + val.toLowerCase() + '.png';
    img.alt = val;
    img.className = 'sg-cell__die';
    cell.appendChild(img);

    var name = document.createElement('span');
    name.className = 'sg-cell__name';
    name.textContent = capitalize(ag.id);
    cell.appendChild(name);

    if (_statsPhase === 'arenas') {
      cell.addEventListener('click', function() {
        _selectedCell = { type: 'arena', id: ag.id };
        renderStatsContent();
      });
    }

    return cell;
  }

  function buildDiscCell(disc, arenaId, d, favoredIds) {
    var isIncomp  = !!d.discIncomp[disc.id];
    var isForce   = !!disc.force;
    var isFavored = !!favoredIds[disc.id];
    var cur       = statsGetDiscValue(disc.id, d);

    var cell = document.createElement('div');
    var cls = 'sg-cell';

    if (isForce) cls += ' sg-cell--force';
    if (isFavored) cls += ' sg-cell--favored';

    var isActive = _selectedCell && _selectedCell.type === 'disc' && _selectedCell.id === disc.id;
    if (isActive) cls += ' sg-cell--active';

    // State styling
    if (isIncomp && isForce) {
      cls += ' sg-cell--force-locked';
    } else if (isIncomp) {
      cls += ' sg-cell--incomp';
    } else if (cur !== 'D6') {
      cls += ' sg-cell--advanced';
    }

    // Phase gating
    var clickable = false;
    if (_statsPhase === 'incomp') {
      clickable = true;
    } else if (_statsPhase === 'arenas') {
      cls += ' sg-cell--disabled';
    } else if (_statsPhase === 'disciplines') {
      // All cells clickable in specialize phase (incomp ones can view detail)
      clickable = true;
    }

    if (!clickable && cls.indexOf('sg-cell--disabled') === -1) {
      cls += ' sg-cell--disabled';
    }

    cell.className = cls;

    var img = document.createElement('img');
    img.src = '/assets/' + cur.toLowerCase() + '.png';
    img.alt = cur;
    img.className = 'sg-cell__die';
    cell.appendChild(img);

    var name = document.createElement('span');
    name.className = 'sg-cell__name';
    name.textContent = disc.name;
    cell.appendChild(name);

    // Tags
    if (isForce) {
      var tag = document.createElement('span');
      tag.className = 'sg-cell__tag sg-cell__tag--force';
      tag.textContent = 'F';
      cell.appendChild(tag);
    }
    if (isFavored && !isForce) {
      var ftag = document.createElement('span');
      ftag.className = 'sg-cell__tag sg-cell__tag--favored';
      ftag.textContent = '\u2605';
      cell.appendChild(ftag);
    }

    if (clickable) {
      cell.addEventListener('click', function() {
        _selectedCell = { type: 'disc', id: disc.id, arenaId: arenaId, force: isForce };
        renderStatsContent();
      });
    }

    return cell;
  }

  /* ── Detail card ─────────────────────────────────────────────────── */

  /* ── Flat navigation index (disc-by-disc, arena-by-arena) ───────── */
  function buildDiscNavList() {
    var list = [];
    DISCIPLINES_BY_ARENA.forEach(function(ag) {
      ag.disciplines.forEach(function(disc) {
        list.push({ discId: disc.id, discName: disc.name, arenaId: ag.id, arenaName: ag.name, force: !!disc.force });
      });
    });
    return list;
  }

  var _discNavList = buildDiscNavList();

  function navDiscByOffset(offset) {
    if (!_selectedCell || _selectedCell.type !== "disc") return;
    var curIdx = -1;
    for (var i = 0; i < _discNavList.length; i++) {
      if (_discNavList[i].discId === _selectedCell.id) { curIdx = i; break; }
    }
    if (curIdx === -1) return;
    var next = curIdx + offset;
    if (next < 0) next = _discNavList.length - 1;
    if (next >= _discNavList.length) next = 0;
    _selectedCell = { type: "disc", id: _discNavList[next].discId };
    renderStatsDetailCard(statsGetDerived(), getFavoredIds());
  }

  function renderStatsDetailCard(d, favoredIds) {
    var panel = document.getElementById("stats-detail-card");
    if (!panel) return;
    if (!_selectedCell) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      return;
    }
    panel.classList.remove("hidden");
    panel.innerHTML = "";

    if (_selectedCell.type === "arena") {
      renderArenaDetailCard(panel, _selectedCell.id, d);
    } else {
      renderDiscDetailCard(panel, _selectedCell, d, favoredIds);
    }

    // Touch swipe support for disc cards (bind once via _sdcSwipe flag)
    if (_selectedCell.type === "disc" && !panel._sdcSwipe) {
      panel._sdcSwipe = true;
      var startX = 0, startY = 0;
      panel.addEventListener("touchstart", function(e) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
      panel.addEventListener("touchend", function(e) {
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) navDiscByOffset(dx < 0 ? 1 : -1);
      });
    }
  }

  function renderArenaDetailCard(panel, arenaId, d) {
    var val  = d.arenaValues[arenaId] || "D6";
    var base = d.baseArenas[arenaId]  || "D6";

    // Left column
    var imgCol = document.createElement("div");
    imgCol.className = "sdc-img-col";
    var dieImg = document.createElement("img");
    dieImg.src = "/assets/" + val.toLowerCase() + ".png";
    dieImg.alt = val;
    dieImg.className = "sdc-die";
    imgCol.appendChild(dieImg);
    var badge = document.createElement("span");
    badge.className = "sdc-arena-badge";
    badge.textContent = "Arena";
    imgCol.appendChild(badge);
    panel.appendChild(imgCol);

    // Right column
    var contentCol = document.createElement("div");
    contentCol.className = "sdc-content-col";

    // Top bar
    var topbar = document.createElement("div");
    topbar.className = "sdc-topbar";
    var spacer = document.createElement("span");
    var nameEl = document.createElement("h3");
    nameEl.className = "sdc-name";
    nameEl.textContent = capitalize(arenaId);
    var closeBtn = document.createElement("button");
    closeBtn.className = "sdc-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", function() { _selectedCell = null; renderStatsContent(); });
    topbar.appendChild(spacer);
    topbar.appendChild(nameEl);
    topbar.appendChild(closeBtn);
    contentCol.appendChild(topbar);

    // Body
    var body = document.createElement("div");
    body.className = "sdc-body";

    var meta = document.createElement("p");
    meta.className = "sdc-rule";
    meta.textContent = "Species base: " + base + " • Current: " + val;
    body.appendChild(meta);

    var glossEntry = _statsGlossary[arenaId];
    if (glossEntry) {
      if (glossEntry.guide) {
        var guideEl = document.createElement("p");
        guideEl.className = "sdc-guide";
        guideEl.textContent = glossEntry.guide;
        body.appendChild(guideEl);
      }
      if (glossEntry.rule) {
        var ruleEl = document.createElement("p");
        ruleEl.className = "sdc-rule";
        ruleEl.textContent = glossEntry.rule;
        body.appendChild(ruleEl);
      }
    }
    contentCol.appendChild(body);

    // Stepper in actions footer
    if (_statsPhase === "arenas") {
      var actions = document.createElement("div");
      actions.className = "sdc-actions";
      var curIdx = DIE_STEPS.indexOf(val);
      var canUp = d.arenaAdvAvail > 0 && curIdx < DIE_STEPS.indexOf("D10");
      var canDn = curIdx > DIE_STEPS.indexOf(base);
      var stepper = document.createElement("div");
      stepper.className = "sdc-stepper";
      var btnDn = document.createElement("button");
      btnDn.className = "sdc-stepper-btn";
      btnDn.textContent = "−";
      btnDn.disabled = !canDn;
      btnDn.addEventListener("click", function() { handleArenaStep(arenaId, -1); });
      var stepVal = document.createElement("span");
      stepVal.className = "sdc-stepper-val";
      stepVal.textContent = val;
      var btnUp = document.createElement("button");
      btnUp.className = "sdc-stepper-btn";
      btnUp.textContent = "+";
      btnUp.disabled = !canUp;
      btnUp.addEventListener("click", function() { handleArenaStep(arenaId, 1); });
      stepper.appendChild(btnDn);
      stepper.appendChild(stepVal);
      stepper.appendChild(btnUp);
      actions.appendChild(stepper);
      contentCol.appendChild(actions);
    }

    panel.appendChild(contentCol);
  }

  function renderDiscDetailCard(panel, sel, d, favoredIds) {
    var disc = null;
    var arenaName = "";
    DISCIPLINES_BY_ARENA.forEach(function(ag) {
      ag.disciplines.forEach(function(dd) {
        if (dd.id === sel.id) { disc = dd; arenaName = ag.name; }
      });
    });
    if (!disc) return;

    var isIncomp  = !!d.discIncomp[disc.id];
    var isForce   = !!disc.force;
    var isFavored = !!favoredIds[disc.id];
    var cur       = statsGetDiscValue(disc.id, d);

    // Left column: die + arena + tags
    var imgCol = document.createElement("div");
    imgCol.className = "sdc-img-col";
    var dieImg = document.createElement("img");
    dieImg.src = "/assets/" + cur.toLowerCase() + ".png";
    dieImg.alt = cur;
    dieImg.className = "sdc-die";
    imgCol.appendChild(dieImg);
    var badge = document.createElement("span");
    badge.className = "sdc-arena-badge";
    badge.textContent = arenaName;
    imgCol.appendChild(badge);

    var tags = document.createElement("div");
    tags.className = "sdc-tags";
    if (isForce) {
      var ft = document.createElement("span");
      ft.className = "sdc-tag sdc-tag--force";
      ft.textContent = "Force";
      tags.appendChild(ft);
    }
    if (isFavored) {
      var fav = document.createElement("span");
      fav.className = "sdc-tag sdc-tag--favored";
      fav.textContent = "Favored";
      tags.appendChild(fav);
    }
    if (isIncomp) {
      var inc = document.createElement("span");
      inc.className = "sdc-tag sdc-tag--incomp";
      inc.textContent = "Incompetent";
      tags.appendChild(inc);
    }
    if (tags.children.length) imgCol.appendChild(tags);
    panel.appendChild(imgCol);

    // Right column
    var contentCol = document.createElement("div");
    contentCol.className = "sdc-content-col";

    // Top bar with nav arrows + name + close
    var topbar = document.createElement("div");
    topbar.className = "sdc-topbar";
    var prevBtn = document.createElement("button");
    prevBtn.className = "sdc-nav-btn";
    prevBtn.innerHTML = "&#8249;";
    prevBtn.addEventListener("click", function() { navDiscByOffset(-1); });
    var nameEl = document.createElement("h3");
    nameEl.className = "sdc-name";
    nameEl.textContent = disc.name;
    var nextBtn = document.createElement("button");
    nextBtn.className = "sdc-nav-btn";
    nextBtn.innerHTML = "&#8250;";
    nextBtn.addEventListener("click", function() { navDiscByOffset(1); });
    var closeBtn = document.createElement("button");
    closeBtn.className = "sdc-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", function() { _selectedCell = null; renderStatsContent(); });
    topbar.appendChild(prevBtn);
    topbar.appendChild(nameEl);
    topbar.appendChild(nextBtn);
    topbar.appendChild(closeBtn);
    contentCol.appendChild(topbar);

    // Scrollable body
    var body = document.createElement("div");
    body.className = "sdc-body";

    var glossEntry = _statsGlossary[disc.id];
    if (glossEntry) {
      if (glossEntry.guide) {
        var guideEl = document.createElement("p");
        guideEl.className = "sdc-guide";
        guideEl.textContent = glossEntry.guide;
        body.appendChild(guideEl);
      }
      if (glossEntry.rule) {
        var ruleEl = document.createElement("p");
        ruleEl.className = "sdc-rule";
        ruleEl.textContent = glossEntry.rule;
        body.appendChild(ruleEl);
      }
      if (glossEntry.narrativeTiers) {
        var tierSection = document.createElement("div");
        tierSection.className = "sdc-tier-section";
        var tierHead = document.createElement("h4");
        tierHead.className = "sdc-tier-heading";
        tierHead.textContent = "Narrative Tiers";
        tierSection.appendChild(tierHead);
        var tierNames = [
          ["fleeting", "Fleeting"],
          ["masterful", "Masterful"],
          ["legendary", "Legendary"],
          ["unleashedI", "Unleashed I"],
          ["unleashedII", "Unleashed II"],
          ["unleashedIII", "Unleashed III"],
        ];
        tierNames.forEach(function(pair) {
          var txt = glossEntry.narrativeTiers[pair[0]];
          if (!txt) return;
          var row = document.createElement("div");
          row.className = "sdc-tier";
          var label = document.createElement("span");
          label.className = "sdc-tier-label";
          label.textContent = pair[1];
          var val = document.createElement("span");
          val.className = "sdc-tier-text";
          val.textContent = txt;
          row.appendChild(label);
          row.appendChild(val);
          tierSection.appendChild(row);
        });
        body.appendChild(tierSection);
      }
    }
    contentCol.appendChild(body);

    // Actions footer
    var actions = document.createElement("div");
    actions.className = "sdc-actions";

    if (_statsPhase === "incomp") {
      if (isIncomp && isForce) {
        var restoreForce = document.createElement("button");
        restoreForce.className = "sdc-btn sdc-btn--primary";
        restoreForce.textContent = "Awaken — Restore to D6";
        restoreForce.addEventListener("click", function() { handleForceRestore(disc.id); });
        actions.appendChild(restoreForce);
      } else if (isIncomp && !isForce) {
        var restore = document.createElement("button");
        restore.className = "sdc-btn sdc-btn--restore";
        restore.textContent = "Restore to D6";
        restore.addEventListener("click", function() { handleDiscRestore(disc.id); });
        actions.appendChild(restore);
      } else if (!isIncomp && !isForce) {
        var weak = document.createElement("button");
        weak.className = "sdc-btn sdc-btn--incomp";
        weak.textContent = "Mark Incompetent (D4)";
        weak.disabled = d.playerIncompCount >= (MAX_INCOMP_TOTAL - d.forceIncompCount);
        weak.addEventListener("click", function() { handleDiscIncomp(disc.id); });
        actions.appendChild(weak);
      } else if (!isIncomp && isForce) {
        var sealed = document.createElement("p");
        sealed.className = "sdc-rule";
        sealed.textContent = "Awakened — restored to D6.";
        actions.appendChild(sealed);
      }
    } else if (_statsPhase === "disciplines") {
      if (isIncomp && isForce) {
        var rf = document.createElement("button");
        rf.className = "sdc-btn sdc-btn--primary";
        rf.textContent = "Awaken — Restore to D6 (1 advance)";
        rf.disabled = d.advAvail <= 0;
        rf.addEventListener("click", function() { handleForceRestore(disc.id); });
        actions.appendChild(rf);
      } else if (cur === "D6") {
        var adv = document.createElement("button");
        adv.className = "sdc-btn";
        adv.textContent = "Advance to D8 (1 advance)";
        adv.disabled = d.advAvail <= 0;
        adv.addEventListener("click", function() { handleDiscAdvance(disc.id); });
        actions.appendChild(adv);
      } else if (cur === "D8") {
        var red = document.createElement("button");
        red.className = "sdc-btn";
        red.textContent = "Reduce to D6 (refund 1)";
        red.addEventListener("click", function() { handleDiscReduce(disc.id); });
        actions.appendChild(red);
        if (d.totalEliteTokens > 0) {
          var canElite = d.advAvail > 0 && d.eliteTokensAvail > 0;
          var elite = document.createElement("button");
          elite.className = "sdc-btn sdc-btn--elite";
          elite.textContent = "Elite to D10 (1 adv + 1 token)";
          elite.disabled = !canElite;
          elite.addEventListener("click", function() { handleDiscElite(disc.id); });
          actions.appendChild(elite);
        }
      } else if (cur === "D10") {
        var r10 = document.createElement("button");
        r10.className = "sdc-btn";
        r10.textContent = "Reduce to D8 (refund 1 adv + 1 token)";
        r10.addEventListener("click", function() { handleDiscReduceElite(disc.id); });
        actions.appendChild(r10);
      }
    }

    if (actions.children.length) contentCol.appendChild(actions);
    panel.appendChild(contentCol);
  }
  /* ── Nav button logic ────────────────────────────────────────────── */

  function updateStatsNav(d) {
    if (!headerNavPrev) headerNavPrev = document.getElementById("cc-nav-prev");
    if (!headerNavNext) headerNavNext = document.getElementById("cc-nav-next");
    if (!headerNavPrev || !headerNavNext) return;

    if (_statsPhase === "incomp") {
      headerNavPrev.textContent = "← Debt";
      headerNavPrev.classList.remove("hidden");
      headerNavPrev.onclick = function() { showScreen("phase3"); updateStepTrack(3); };

      var effectiveReq = Math.max(0, MAX_INCOMP_REQUIRED - (d.freeAdv || 0));
      var canProceed = (d.playerIncompCount + d.forceIncompCount) >= effectiveReq;
      headerNavNext.textContent = "Arenas →";
      headerNavNext.classList.remove("hidden");
      headerNavNext.disabled = !canProceed;
      headerNavNext.onclick = function() {
        _statsPhase = "arenas";
        _selectedCell = null;
        renderStatsContent();
      };
    } else if (_statsPhase === "arenas") {
      headerNavPrev.textContent = "← Weaknesses";
      headerNavPrev.classList.remove("hidden");
      headerNavPrev.onclick = function() {
        _statsPhase = "incomp";
        _selectedCell = null;
        renderStatsContent();
      };
      headerNavNext.textContent = "Specialize →";
      headerNavNext.classList.remove("hidden");
      headerNavNext.disabled = false;
      headerNavNext.onclick = function() {
        _statsPhase = "disciplines";
        _selectedCell = null;
        renderStatsContent();
      };
    } else if (_statsPhase === "disciplines") {
      headerNavPrev.textContent = "← Arenas";
      headerNavPrev.classList.remove("hidden");
      headerNavPrev.onclick = function() {
        _statsPhase = "arenas";
        _selectedCell = null;
        renderStatsContent();
      };
      headerNavNext.textContent = "Vocations →";
      headerNavNext.classList.remove("hidden");
      headerNavNext.disabled = false;
      headerNavNext.onclick = function() {
        initKitsScreen();
      };
    }
  }

  /* ── Force restore handler ───────────────────────────────────────── */

  function handleForceRestore(discId) {
    if (!state.discIncomp[discId]) return;
    if (_statsPhase === 'disciplines') {
      var d = statsGetDerived();
      if (d.advAvail <= 0) return;
      state.spentAdv = (state.spentAdv || 0) + 1;
    }
    delete state.discIncomp[discId];
    if (state.discValues) delete state.discValues[discId];
    saveState();
    renderStatsContent();
  }

  /* ── Arena section (kept for compatibility) ─────────────────────── */

  function handleArenaStep(aId, dir) {
    if (!state.arenaAdj) state.arenaAdj = {};
    var d = statsGetDerived();
    var curIdx = DIE_STEPS.indexOf(d.arenaValues[aId]);
    if (dir ===  1 && (d.arenaAdvAvail <= 0 || curIdx >= DIE_STEPS.indexOf("D10"))) return;
    if (dir === -1 && curIdx <= 0) return;
    state.arenaAdj[aId] = (state.arenaAdj[aId] || 0) + dir;
    saveState();
    renderStatsContent();
  }

  /* ── Disc action handlers ────────────────────────────────────────── */

  function handleDiscIncomp(discId) {
    if (!state.discIncomp) state.discIncomp = {};
    var _pInc = Object.keys(state.discIncomp).filter(function(k) { return FORCE_DISC_IDS.indexOf(k) < 0; }).length;
    if (_pInc >= (MAX_INCOMP_TOTAL - FORCE_DISC_IDS.length)) return;
    state.discIncomp[discId] = true;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId] = 'D4';
    saveState();
    renderStatsContent();
  }

  function handleDiscRestore(discId) {
    if (!state.discIncomp) return;
    delete state.discIncomp[discId];
    if (state.discValues) delete state.discValues[discId];
    var d = statsGetDerived();
    if (d.eliteTokensAvail < 0) {
      var overe = -d.eliteTokensAvail;
      DISCIPLINES_BY_ARENA.forEach(function(ag) { ag.disciplines.forEach(function(disc) {
        if (overe <= 0) return;
        if (state.discValues && state.discValues[disc.id] === 'D10') {
          state.discValues[disc.id] = 'D8';
          state.eliteTokensUsed = Math.max(0, (state.eliteTokensUsed||0) - 1);
          state.spentAdv = Math.max(0, (state.spentAdv||0) - 1);
          overe--;
        }
      }); });
    }
    d = statsGetDerived();
    if (d.advAvail < 0) {
      var over = -d.advAvail;
      DISCIPLINES_BY_ARENA.forEach(function(ag) { ag.disciplines.forEach(function(disc) {
        if (over <= 0) return;
        if (state.discValues && state.discValues[disc.id] === 'D8') {
          delete state.discValues[disc.id];
          state.spentAdv = Math.max(0, (state.spentAdv||0) - 1);
          over--;
        }
      }); });
    }
    saveState();
    renderStatsContent();
  }

  function handleDiscAdvance(discId) {
    var d = statsGetDerived();
    if (d.advAvail <= 0) return;
    if (statsGetDiscValue(discId, d) !== 'D6') return;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId] = 'D8';
    state.spentAdv = (state.spentAdv || 0) + 1;
    saveState();
    renderStatsContent();
  }

  function handleDiscElite(discId) {
    var d = statsGetDerived();
    if (d.advAvail <= 0 || d.eliteTokensAvail <= 0) return;
    if (statsGetDiscValue(discId, d) !== 'D8') return;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId] = 'D10';
    state.spentAdv = (state.spentAdv || 0) + 1;
    state.eliteTokensUsed = (state.eliteTokensUsed || 0) + 1;
    saveState();
    renderStatsContent();
  }

  function handleDiscReduce(discId) {
    if (statsGetDiscValue(discId, statsGetDerived()) !== 'D8') return;
    if (state.discValues) delete state.discValues[discId];
    state.spentAdv = Math.max(0, (state.spentAdv || 0) - 1);
    saveState();
    renderStatsContent();
  }

  function handleDiscReduceElite(discId) {
    if (statsGetDiscValue(discId, statsGetDerived()) !== 'D10') return;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId] = 'D8';
    state.spentAdv = Math.max(0, (state.spentAdv || 0) - 1);
    state.eliteTokensUsed = Math.max(0, (state.eliteTokensUsed || 0) - 1);
    saveState();
    renderStatsContent();
  }


  /* ── Kits step ──────────────────────────────────────────────────── */

  var KITS_DATA     = [];
  var KITS_BUDGET   = 5;

  function loadKits() {
    return fetch('/data/kits.json')
      .then(function(r) { return r.json(); })
      .then(function(data) { KITS_DATA = data; })
      .catch(function (e) {
        _gen_in_flight = false; console.error('[Kits] Failed to load:', e); });
  }

  function kitsSpent() {
    var choices = state.kitChoices || {};
    return Object.values(choices).reduce(function(acc, tier) { return acc + tier; }, 0);
  }

  function initKitsScreen() {
    if (!state.kitChoices) state.kitChoices = {};
    var doShow = function() {
      normalizeKitChoices();
      renderKitsBudgetBar();
      buildPhaseCarousel(KITS_DATA, "ph-grid-vocations", null, buildVocationCardFlat);
            showScreen("kits");
      updateStepTrack(5);
    };
    if (KITS_DATA.length === 0) {
      loadKits().then(doShow);
    } else {
      doShow();
    }
  }

  function renderKitsBudgetBar() {
    var bar = document.getElementById("kits-budget-bar");
    if (!bar) return;
    bar.innerHTML = "";
    var spent = kitsSpent();
    var avail = KITS_BUDGET - spent;
    var pips = document.createElement("div");
    pips.className = "cc-kits-budget-pips";
    for (var pi = 0; pi < KITS_BUDGET; pi++) {
      var pip = document.createElement("div");
      pip.className = "cc-kit-budget-pip" + (pi < spent ? " cc-kit-budget-pip--used" : "");
      pips.appendChild(pip);
    }
    var label = document.createElement("span");
    label.className = "cc-kits-budget-label";
    label.textContent = avail + " point" + (avail !== 1 ? "s" : "") + " remaining";
    bar.appendChild(pips);
    bar.appendChild(label);
    var disp = document.getElementById("kits-budget-display");
    if (disp) disp.textContent = avail;
  }



  function kitMaxTier(kit) {
    var d = statsGetDerived();
    var discId = kit.favoredDiscipline || kit.alignedDiscipline;
    if (!discId) return 2;
    var dieVal = statsGetDiscValue(discId, d);
    var tierMap = { D4: 1, D6: 2, D8: 3, D10: 4, D12: 5 };
    return tierMap[dieVal] || 2;
  }

  function formatDiscName(rawDisc) {
    if (!rawDisc) return "";
    var discName = rawDisc;
    if (discName.indexOf("_spark") !== -1) {
      discName = discName.replace("_spark", "").replace(/_/g, " ");
      discName = discName.charAt(0).toUpperCase() + discName.slice(1) + " (Force)";
    } else {
      discName = discName.replace(/_/g, " ");
      discName = discName.charAt(0).toUpperCase() + discName.slice(1);
    }
    return discName;
  }

  function buildVocationCardFlat(kit) {
    var choices = state.kitChoices || {};
    var currentTier = choices[kit.id] || 0;
    var spent = kitsSpent();
    var avail = KITS_BUDGET - spent;
    var isForce = kit.favoredDiscipline && kit.favoredDiscipline.indexOf("_spark") !== -1;
    var maxTier = kitMaxTier(kit);
    var abilities = kit.abilities || [];
    var discName = formatDiscName(kit.favoredDiscipline);
    var arenaName = kit.governingArena ? (kit.governingArena.charAt(0).toUpperCase() + kit.governingArena.slice(1)) : "";

    var wrapper = document.createElement("div");
    wrapper.className = "ph-card-wrap ph-card-flat";
    wrapper.dataset.kitId = kit.id;

    var cardEl = document.createElement("div");
    cardEl.className = "ph3-species-card" +
      (currentTier > 0 ? " voc-card--active" : "") +
      (isForce ? " voc-card--force" : "");

    var imgCol = document.createElement("div");
    imgCol.className = "ph3-img-col";
    if (kit.imageUrl) {
      var img = document.createElement("img");
      img.src = kit.imageUrl;
      img.alt = kit.name;
      img.className = "ph3-card-img";
      imgCol.appendChild(img);
    }

    var detailCol = document.createElement("div");
    detailCol.className = "ph3-detail-col voc-detail-col";

    var nameEl = document.createElement("h2");
    nameEl.className = "ph3-card-name";
    nameEl.textContent = kit.name;
    detailCol.appendChild(nameEl);

    var meta = document.createElement("p");
    meta.className = "ph3-card-symbol";
    meta.textContent = arenaName + " / " + discName;
    detailCol.appendChild(meta);

    var desc = document.createElement("p");
    desc.className = "ph3-narrative";
    desc.textContent = kit.description || "";
    detailCol.appendChild(desc);

    if (kit.fluff) {
      var fluff = document.createElement("p");
      fluff.className = "ph3-narrative voc-fluff";
      fluff.textContent = kit.fluff;
      detailCol.appendChild(fluff);
    }

    var capInfo = document.createElement("div");
    capInfo.className = "cc-kit-flat-cap";
    var d = statsGetDerived();
    var discId = kit.favoredDiscipline || kit.alignedDiscipline;
    var dieVal = discId ? statsGetDiscValue(discId, d) : "D6";
    capInfo.textContent = discName + " at " + dieVal + " → max Tier " + maxTier;
    detailCol.appendChild(capInfo);

    var tierActions = document.createElement("div");
    tierActions.className = "cc-kit-flat-actions";
    if (currentTier === 0) {
      var takeBtn = document.createElement("button");
      takeBtn.className = "cc-kit-btn cc-kit-btn--take";
      takeBtn.textContent = "Take T1 (1pt)";
      takeBtn.disabled = avail < 1;
      takeBtn.addEventListener("click", function() { handleKitSelect(kit.id, 1); });
      tierActions.appendChild(takeBtn);
    } else {
      var tierLabel = document.createElement("span");
      tierLabel.className = "cc-kit-flat-tier-label";
      tierLabel.textContent = "Tier " + currentTier;
      tierActions.appendChild(tierLabel);
      if (currentTier < maxTier && avail >= 1) {
        var upBtn = document.createElement("button");
        upBtn.className = "cc-kit-btn cc-kit-btn--take";
        upBtn.textContent = "+1 Tier";
        upBtn.title = "Upgrade to Tier " + (currentTier + 1) + " (1pt)";
        upBtn.addEventListener("click", function() { handleKitSelect(kit.id, currentTier + 1); });
        tierActions.appendChild(upBtn);
      }
      if (currentTier > 1) {
        var dnBtn = document.createElement("button");
        dnBtn.className = "cc-kit-btn";
        dnBtn.textContent = "− 1 Tier";
        dnBtn.title = "Downgrade to Tier " + (currentTier - 1) + " (refund 1pt)";
        dnBtn.addEventListener("click", function() { handleKitSelect(kit.id, currentTier - 1); });
        tierActions.appendChild(dnBtn);
      }
      var remBtn = document.createElement("button");
      remBtn.className = "cc-kit-btn cc-kit-btn--remove";
      remBtn.textContent = "Remove";
      remBtn.addEventListener("click", function() { handleKitSelect(kit.id, 0); });
      tierActions.appendChild(remBtn);
    }
    detailCol.appendChild(tierActions);

    var abilitiesWrap = document.createElement("div");
    abilitiesWrap.className = "voc-abilities-wrap";
    for (var t = 1; t <= 5; t++) {
      var ab = abilities.find(function(a) { return a.tier === t; });
      if (!ab) continue;
      var locked = t > maxTier;
      var active = t <= currentTier;
      var row = document.createElement("div");
      row.className = "cc-kit-flat-ab-row" +
        (active ? " cc-kit-flat-ab-row--active" : "") +
        (locked ? " cc-kit-flat-ab-row--locked" : "");

      var tierBadge = document.createElement("span");
      tierBadge.className = "cc-kit-flat-ab-tier";
      tierBadge.textContent = "T" + t;
      row.appendChild(tierBadge);

      var abBody = document.createElement("div");
      abBody.className = "cc-kit-flat-ab-body";
      var abHead = document.createElement("div");
      abHead.className = "cc-kit-flat-ab-head";
      var abName = document.createElement("span");
      abName.className = "cc-kit-flat-ab-name";
      abName.textContent = ab.name;
      abHead.appendChild(abName);
      var typeBadge = document.createElement("span");
      typeBadge.className = "cc-kit-flat-ab-type cc-kit-flat-ab-type--" + (ab.type || "passive");
      typeBadge.textContent = ab.type === "gambit" ? "Gambit" : (ab.type === "maneuver" ? "Maneuver" : (ab.type === "exploit" ? "Exploit" : (ab.type === "action" ? "Action" : (ab.type === "permission" ? "Permission" : "Passive"))));
      abHead.appendChild(typeBadge);
      abBody.appendChild(abHead);

      if (!locked) {
        var abRule = document.createElement("p");
        abRule.className = "cc-kit-flat-ab-rule";
        abRule.textContent = ab.rule;
        abBody.appendChild(abRule);
      } else {
        var lockMsg = document.createElement("p");
        lockMsg.className = "cc-kit-flat-ab-lock-msg";
        var dieName = ["D4","D6","D8","D10","D12"][t-1] || "D12";
        lockMsg.textContent = "Requires " + discName + " at " + dieName;
        abBody.appendChild(lockMsg);
      }
      row.appendChild(abBody);
      abilitiesWrap.appendChild(row);
    }
    detailCol.appendChild(abilitiesWrap);

    cardEl.appendChild(imgCol);
    cardEl.appendChild(detailCol);
    wrapper.appendChild(cardEl);
    return wrapper;
  }

  function handleKitSelect(kitId, tier) {
    if (!state.kitChoices) state.kitChoices = {};
    if (tier === 0) {
      delete state.kitChoices[kitId];
    } else {
      var kit = KITS_DATA.find(function(k) { return k.id === kitId; });
      var max = kit ? kitMaxTier(kit) : 5;
      var currentTier = state.kitChoices[kitId] || 0;
      var spent = kitsSpent() - currentTier;
      var budgetLeft = KITS_BUDGET - spent;
      tier = Math.min(tier, max, budgetLeft);
      if (tier < 1) return;
      state.kitChoices[kitId] = tier;
    }
    saveState();
    rebuildActiveVocationSlide();
    renderKitsBudgetBar();
  }

  function rebuildActiveVocationSlide() {
    var cs = phaseCarouselStates["ph-grid-vocations"];
    if (!cs) return;
    var kit = KITS_DATA[cs.current];
    if (!kit) return;
    var container = document.getElementById("ph-grid-vocations");
    if (!container) return;
    var track = container.querySelector(".ph-carousel-track");
    if (!track) return;
    var oldSlide = track.children[cs.current];
    if (!oldSlide) return;
    var newSlide = buildVocationCardFlat(kit);
    newSlide.dataset.index = cs.current;
    newSlide.classList.add("ph-slide-active");
    track.replaceChild(newSlide, oldSlide);
  }

  function normalizeKitChoices() {
    if (!state.kitChoices) return;
    var changed = false;
    Object.keys(state.kitChoices).forEach(function(kitId) {
      var kit = KITS_DATA.find(function(k) { return k.id === kitId; });
      if (!kit) return;
      var max = kitMaxTier(kit);
      if (state.kitChoices[kitId] > max) {
        state.kitChoices[kitId] = max;
        changed = true;
      }
    });
    if (changed) saveState();
  }

  /* ── Outfitting step ─────────────────────────────────────────────────── */

  var STARTING_CREDITS = 500;

  function getVocationItems(vocId) {
    if (!window._kitsData) return [];
    var kit = window._kitsData.find(function(k) { return k.id === vocId; });
    return (kit && kit.startingItems) ? kit.startingItems : [];
  }

  function collectBackgroundItems() {
    var items = [];
    var phase1Card = state.phase1 ? PHASE1_CARDS.find(function(c) { return c.id === state.phase1; }) : null;
    var phase2Card = state.phase2 ? PHASE2_CARDS.find(function(c) { return c.id === state.phase2; }) : null;
    if (phase1Card && phase1Card.backgroundItems) {
      phase1Card.backgroundItems.forEach(function(item) {
        items.push({ id: item.id, name: item.name, cost: item.cost, source: item.source, acquisition: 'background', origin: phase1Card.title });
      });
    }
    if (phase2Card && phase2Card.backgroundItems) {
      phase2Card.backgroundItems.forEach(function(item) {
        items.push({ id: item.id, name: item.name, cost: item.cost, source: item.source, acquisition: 'background', origin: phase2Card.title });
      });
    }
    var kc = state.kitChoices || {};
    Object.keys(kc).forEach(function(vocId) {
      if (kc[vocId] > 0 && getVocationItems(vocId)) {
        var vocName = vocId.replace('voc_', '').replace(/_/g, ' ');
        vocName = vocName.charAt(0).toUpperCase() + vocName.slice(1);
        getVocationItems(vocId).forEach(function(item) {
          items.push({ id: item.id, name: item.name, cost: item.cost, source: item.source, acquisition: 'background', origin: 'Vocation: ' + vocName });
        });
      }
    });
    return items;
  }
  var OUTFITTING_CATALOG = [];

  function loadOutfittingCatalog() {
    if (OUTFITTING_CATALOG.length > 0) return Promise.resolve();
    return Promise.all([
      fetch('/data/gear.json').then(function(r) { return r.json(); }),
      fetch('/data/weapons.json').then(function(r) { return r.json(); }),
      fetch('/data/armor.json').then(function(r) { return r.json(); }),
    ]).then(function(results) {
      var gear = results[0].map(function(item) {
        return {
          id: item.id, name: item.name, cost: item.cost || 0,
          category: item.categoryLabel || item.category || 'Gear',
          source: 'gear', description: item.description || '',
          availability: item.availability || '',
          tags: item.tags || [],
          traits: item.traits || [],
          gambits: item.gambits || []
        };
      });
      var weapons = results[1].map(function(item) {
        return {
          id: item.id, name: item.name, cost: item.cost || 0,
          category: item.chassisLabel || 'Weapon',
          source: 'weapon', description: item.description || '',
          availability: item.availability || '',
          tags: item.tags || [],
          trait: item.trait || null,
          gambits: item.gambits || [],
          chassisLabel: item.chassisLabel || '',
          range: item.range || null,
          clipSize: item.clipSize || null,
          stunSetting: item.stunSetting || false
        };
      });
      var armor = results[2].map(function(item) {
        return {
          id: item.id, name: item.name, cost: item.cost || 0,
          category: item.categoryLabel || 'Armor',
          source: 'armor', description: item.description || '',
          availability: item.availability || '',
          tags: item.tags || [],
          traits: item.traits || []
        };
      });
      OUTFITTING_CATALOG = gear.concat(weapons.filter(function(w) { return w.id !== "wpn_fists_01" && w.id !== "wpn_cathar_claws_01"; })).concat(armor);
      OUTFITTING_CATALOG.sort(function(a, b) { return a.cost - b.cost; });
    }).catch(function(e) {
      console.error('[Outfitting] Failed to load catalog:', e);
      OUTFITTING_CATALOG = [];
    });
  }

  function outfittingCreditsSpent() {
    var items = state.startingGear || [];
    return items.reduce(function(acc, item) {
      if (item.acquisition === 'background' || item.acquisition === 'innate') return acc;
      return acc + (item.cost || 0);
    }, 0);
  }

  function outfittingCreditsRemaining() {
    return STARTING_CREDITS - outfittingCreditsSpent() + (state.soldBackCredits || 0);
  }

  function initOutfittingScreen() {
    if (!state.startingGear) state.startingGear = [];
    var bgItems = collectBackgroundItems();
    var existingBgIds = {};
    state.startingGear.forEach(function(g) {
      if (g.acquisition === 'background') existingBgIds[g.id + '|' + (g.origin || '')] = true;
    });
    var soldKeys = {};
    (state.soldBackgroundKeys || []).forEach(function(k) { soldKeys[k] = true; });
    bgItems.forEach(function(bg) {
      var key = bg.id + '|' + (bg.origin || '');
      if (!existingBgIds[key] && !soldKeys[key]) {
        state.startingGear.push(bg);
        existingBgIds[key] = true;
      }
    });
    var validBgKeys = {};
    bgItems.forEach(function(bg) { validBgKeys[bg.id + '|' + (bg.origin || '')] = true; });
    state.startingGear = state.startingGear.filter(function(g) {
      if (g.acquisition !== 'background') return true;
      return validBgKeys[g.id + '|' + (g.origin || '')];
    });
    if (state.soldBackgroundKeys) {
      state.soldBackgroundKeys = state.soldBackgroundKeys.filter(function(k) {
        return validBgKeys[k];
      });
    }
    var unarmedId = (state.species === "cathar") ? "wpn_cathar_claws_01" : "wpn_fists_01";
    var hasInnate = state.startingGear.some(function(g) { return g.innate; });
    if (!hasInnate) {
      var unarmedName = (state.species === "cathar") ? "Cathar Claws" : "Fists";
      state.startingGear.push({ id: unarmedId, name: unarmedName, source: "weapon", acquisition: "innate", innate: true, cost: 0 });
    } else {
      var curInnate = state.startingGear.find(function(g) { return g.innate; });
      if (curInnate && curInnate.id !== unarmedId) {
        curInnate.id = unarmedId;
        curInnate.name = (state.species === "cathar") ? "Cathar Claws" : "Fists";
      }
    }
    saveState();
    var doShow = function() {
      renderOutfittingContent();
      showScreen('outfitting');
      updateStepTrack(6);
    };
    if (OUTFITTING_CATALOG.length === 0) {
      loadOutfittingCatalog().then(doShow);
    } else {
      doShow();
    }
  }

  function renderOutfittingContent() {
    var container = document.getElementById('outfitting-content');
    if (!container) return;
    container.innerHTML = '';

    var remaining = outfittingCreditsRemaining();

    var creditsDisp = document.getElementById('outfitting-credits-display');
    if (creditsDisp) creditsDisp.textContent = remaining;

    var layout = document.createElement('div');
    layout.className = 'outfitting-layout';

    var catalogPanel = document.createElement('div');
    catalogPanel.className = 'outfitting-catalog';

    var searchRow = document.createElement('div');
    searchRow.className = 'outfitting-search-row';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search gear, weapons, armor\u2026';
    searchInput.className = 'outfitting-search';
    searchRow.appendChild(searchInput);
    catalogPanel.appendChild(searchRow);

    var marketToggle = document.createElement('div');
    marketToggle.className = 'outfitting-market-toggle';
    var activeMarket = 'market';
    ['market', 'black-market'].forEach(function(mk) {
      var btn = document.createElement('button');
      btn.className = 'outfitting-market-btn' + (mk === activeMarket ? ' active' : '');
      btn.textContent = mk === 'market' ? 'Market' : 'Black Market';
      btn.dataset.market = mk;
      btn.addEventListener('click', function() {
        activeMarket = mk;
        marketToggle.querySelectorAll('.outfitting-market-btn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.market === mk);
        });
        renderCatalogItems();
      });
      marketToggle.appendChild(btn);
    });
    catalogPanel.appendChild(marketToggle);

    var catFilters = document.createElement('div');
    catFilters.className = 'outfitting-cat-filters';
    var categories = ['All', 'Gear', 'Weapons', 'Armor'];
    var activeCat = 'All';
    categories.forEach(function(cat) {
      var btn = document.createElement('button');
      btn.className = 'outfitting-cat-btn' + (cat === activeCat ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', function() {
        activeCat = cat;
        catFilters.querySelectorAll('.outfitting-cat-btn').forEach(function(b) {
          b.classList.toggle('active', b.textContent === cat);
        });
        renderCatalogItems();
      });
      catFilters.appendChild(btn);
    });
    catalogPanel.appendChild(catFilters);

    var itemList = document.createElement('div');
    itemList.className = 'outfitting-item-list';
    catalogPanel.appendChild(itemList);

    var cartPanel = document.createElement('div');
    cartPanel.className = 'outfitting-cart';

    var cartTitle = document.createElement('div');
    cartTitle.className = 'outfitting-cart-title';
    cartTitle.innerHTML = '<span class="outfitting-cart-label">Your Loadout</span><span class="outfitting-cart-credits" id="outfitting-cart-credits">' + remaining + ' cr remaining</span>';
    cartPanel.appendChild(cartTitle);

    var cartItems = document.createElement('div');
    cartItems.className = 'outfitting-cart-items';
    cartItems.id = 'outfitting-cart-items';
    cartPanel.appendChild(cartItems);

    var cartTotal = document.createElement('div');
    cartTotal.className = 'outfitting-cart-total';
    cartTotal.id = 'outfitting-cart-total';
    cartPanel.appendChild(cartTotal);

    layout.appendChild(catalogPanel);
    layout.appendChild(cartPanel);
    container.appendChild(layout);

    searchInput.addEventListener('input', function() { renderCatalogItems(); });

    function isRestricted(avail) {
      return /R|X/.test(avail || '');
    }

    function availLabel(avail) {
      if (!avail) return '';
      if (avail.indexOf('X') >= 0) return 'Illegal';
      if (avail.indexOf('R') >= 0) return 'Restricted';
      return '';
    }

    function buildDetailPanel(item) {
      var d = document.createElement('div');
      d.className = 'outfitting-detail';

      if (item.description) {
        var desc = document.createElement('p');
        desc.className = 'outfitting-detail-desc';
        desc.textContent = item.description;
        d.appendChild(desc);
      }

      if (item.source === 'weapon') {
        var meta = document.createElement('div');
        meta.className = 'outfitting-detail-meta';
        if (item.chassisLabel) meta.innerHTML += '<span>Chassis: ' + item.chassisLabel + '</span>';
        if (item.range && item.range.length) meta.innerHTML += '<span>Range: ' + item.range.join(' / ') + ' zones</span>';
        if (item.clipSize) meta.innerHTML += '<span>Clip: ' + item.clipSize + '</span>';
        if (item.stunSetting) meta.innerHTML += '<span>Stun: Yes</span>';
        if (item.availability) meta.innerHTML += '<span>Avail: ' + item.availability + '</span>';
        d.appendChild(meta);
      }

      if (item.source === 'armor' && item.availability) {
        var aMeta = document.createElement('div');
        aMeta.className = 'outfitting-detail-meta';
        aMeta.innerHTML = '<span>Avail: ' + item.availability + '</span>';
        d.appendChild(aMeta);
      }

      if (item.trait) {
        var tb = document.createElement('div');
        tb.className = 'outfitting-detail-trait';
        tb.innerHTML = '<span class="outfitting-trait-label">' + item.trait.name + '</span> ' + item.trait.description;
        d.appendChild(tb);
      }

      var traitArr = item.traits || [];
      traitArr.forEach(function(t) {
        var tb = document.createElement('div');
        tb.className = 'outfitting-detail-trait';
        tb.innerHTML = '<span class="outfitting-trait-label">' + (t.name || '') + '</span> ' + (t.description || t.rule || '');
        d.appendChild(tb);
      });

      var gArr = item.gambits || [];
      gArr.forEach(function(g) {
        var gb = document.createElement('div');
        gb.className = 'outfitting-detail-gambit';
        gb.innerHTML = '<span class="outfitting-gambit-label">Gambit: ' + g.name + '</span> ' + (g.rule || '');
        d.appendChild(gb);
      });

      if (item.tags && item.tags.length) {
        var pills = document.createElement('div');
        pills.className = 'outfitting-detail-tags';
        item.tags.forEach(function(t) {
          var pill = document.createElement('span');
          pill.className = 'outfitting-tag-pill';
          pill.textContent = t;
          pills.appendChild(pill);
        });
        d.appendChild(pills);
      }

      return d;
    }

    var expandedItemId = null;

    function renderCatalogItems() {
      var query = searchInput.value.trim().toLowerCase();
      itemList.innerHTML = '';

      var filtered = OUTFITTING_CATALOG.filter(function(item) {
        var restricted = isRestricted(item.availability);
        if (activeMarket === 'market' && restricted) return false;
        if (activeMarket === 'black-market' && !restricted) return false;
        if (activeCat === 'Weapons' && item.source !== 'weapon') return false;
        if (activeCat === 'Armor' && item.source !== 'armor') return false;
        if (activeCat === 'Gear' && item.source !== 'gear') return false;
        if (query && item.name.toLowerCase().indexOf(query) === -1 && item.category.toLowerCase().indexOf(query) === -1 && item.description.toLowerCase().indexOf(query) === -1) return false;
        return true;
      });

      if (OUTFITTING_CATALOG.length === 0) {
        var err = document.createElement('p');
        err.className = 'outfitting-empty';
        err.textContent = 'Failed to load gear catalog. Try going back and returning to this screen.';
        itemList.appendChild(err);
        return;
      }

      if (filtered.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'outfitting-empty';
        empty.textContent = 'No items match your search.';
        itemList.appendChild(empty);
        return;
      }

      filtered.forEach(function(item) {
        var wrapper = document.createElement('div');
        wrapper.className = 'outfitting-item-wrapper' + (expandedItemId === item.id ? ' expanded' : '');

        var row = document.createElement('div');
        row.className = 'outfitting-item-row';

        var info = document.createElement('div');
        info.className = 'outfitting-item-info';
        info.style.cursor = 'pointer';
        var nameEl = document.createElement('span');
        nameEl.className = 'outfitting-item-name';
        nameEl.textContent = item.name;
        var catLine = document.createElement('span');
        catLine.className = 'outfitting-item-cat';
        var catText = item.category;
        var al = availLabel(item.availability);
        if (al) catText += '  \u2022  ' + al;
        catLine.textContent = catText;
        if (al) {
          var badge = document.createElement('span');
          badge.className = 'outfitting-avail-badge' + (al === 'Illegal' ? ' illegal' : ' restricted');
          badge.textContent = al;
          catLine.textContent = item.category + '  ';
          catLine.appendChild(badge);
        }
        info.appendChild(nameEl);
        info.appendChild(catLine);

        info.addEventListener('click', function() {
          expandedItemId = expandedItemId === item.id ? null : item.id;
          renderCatalogItems();
        });

        var priceEl = document.createElement('span');
        priceEl.className = 'outfitting-item-price';
        priceEl.textContent = item.cost + ' cr';

        var addBtn = document.createElement('button');
        addBtn.className = 'outfitting-add-btn';
        addBtn.textContent = '+';
        var canAfford = outfittingCreditsRemaining() >= item.cost;
        addBtn.disabled = !canAfford;
        addBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          addToLoadout(item);
        });

        row.appendChild(info);
        row.appendChild(priceEl);
        row.appendChild(addBtn);
        wrapper.appendChild(row);

        if (expandedItemId === item.id) {
          wrapper.appendChild(buildDetailPanel(item));
        }

        itemList.appendChild(wrapper);
      });
    }

    function addToLoadout(item) {
      if (outfittingCreditsRemaining() < item.cost) return;
      if (!state.startingGear) state.startingGear = [];
      var acq = activeMarket === 'black-market' ? 'contraband' : 'registered';
      state.startingGear.push({ id: item.id, name: item.name, cost: item.cost, source: item.source, acquisition: acq });
      saveState();
      renderCart();
      renderCatalogItems();
    }

    function removeFromLoadout(index) {
      if (!state.startingGear) return;
      state.startingGear.splice(index, 1);
      saveState();
      renderCart();
      renderCatalogItems();
    }

    function sellBackgroundItem(index) {
      if (!state.startingGear || !state.startingGear[index]) return;
      var item = state.startingGear[index];
      if (item.acquisition !== 'background') return;
      var sellValue = Math.floor(item.cost / 2);
      state.soldBackCredits = (state.soldBackCredits || 0) + sellValue;
      var soldKey = item.id + '|' + (item.origin || '');
      if (!state.soldBackgroundKeys) state.soldBackgroundKeys = [];
      state.soldBackgroundKeys.push(soldKey);
      state.startingGear.splice(index, 1);
      saveState();
      renderCart();
      renderCatalogItems();
    }

    function renderCart() {
      var rem = outfittingCreditsRemaining();
      var spent = outfittingCreditsSpent();

      var creditsEl = document.getElementById("outfitting-cart-credits");
      if (creditsEl) creditsEl.textContent = rem + " cr remaining";

      var creditsDispMain = document.getElementById("outfitting-credits-display");
      if (creditsDispMain) creditsDispMain.textContent = rem;

      var cartEl = document.getElementById("outfitting-cart-items");
      if (!cartEl) return;
      cartEl.innerHTML = "";

      var items = state.startingGear || [];
      var bgItems = items.filter(function(g) { return g.acquisition === "background"; });
      var innateItems = items.filter(function(g) { return g.acquisition === "innate"; });
      var purchasedItems = items.filter(function(g) { return g.acquisition !== "background" && g.acquisition !== "innate"; });

      if (innateItems.length > 0) {
        var innateHeader = document.createElement("div");
        innateHeader.className = "outfitting-cart-section-head";
        innateHeader.textContent = "Innate";
        cartEl.appendChild(innateHeader);
        innateItems.forEach(function(item) {
          var row = document.createElement("div");
          row.className = "outfitting-cart-row outfitting-cart-row--bg";
          var nameEl = document.createElement("span");
          nameEl.className = "outfitting-cart-item-name";
          nameEl.textContent = item.name || item.id;
          var badge = document.createElement("span");
          badge.className = "outfitting-acq-badge background";
          badge.textContent = "Innate";
          nameEl.appendChild(document.createTextNode(" "));
          nameEl.appendChild(badge);
          var priceEl = document.createElement("span");
          priceEl.className = "outfitting-cart-item-price outfitting-cart-item-price--free";
          priceEl.textContent = "—";
          row.appendChild(nameEl);
          row.appendChild(priceEl);
          cartEl.appendChild(row);
        });
      }

      if (bgItems.length > 0) {
        var bgHeader = document.createElement("div");
        bgHeader.className = "outfitting-cart-section-head";
        bgHeader.textContent = "Background Gear";
        cartEl.appendChild(bgHeader);
        bgItems.forEach(function(item) {
          var idx = items.indexOf(item);
          var row = document.createElement("div");
          row.className = "outfitting-cart-row outfitting-cart-row--bg";

          var nameEl = document.createElement("span");
          nameEl.className = "outfitting-cart-item-name";
          nameEl.textContent = item.name;
          var originBadge = document.createElement("span");
          originBadge.className = "outfitting-acq-badge background";
          originBadge.textContent = item.origin || "Background";
          nameEl.appendChild(document.createTextNode(" "));
          nameEl.appendChild(originBadge);

          var priceEl = document.createElement("span");
          priceEl.className = "outfitting-cart-item-price outfitting-cart-item-price--free";
          priceEl.textContent = "Free";

          var sellBtn = document.createElement("button");
          sellBtn.className = "outfitting-sell-btn";
          sellBtn.textContent = "Sell " + Math.floor(item.cost / 2) + "cr";
          sellBtn.title = "Sell for half value (" + Math.floor(item.cost / 2) + " cr)";
          sellBtn.addEventListener("click", function() {
            sellBackgroundItem(idx);
          });

          row.appendChild(nameEl);
          row.appendChild(priceEl);
          row.appendChild(sellBtn);
          cartEl.appendChild(row);
        });
      }

      if (purchasedItems.length > 0) {
        if (bgItems.length > 0) {
          var shopHeader = document.createElement("div");
          shopHeader.className = "outfitting-cart-section-head";
          shopHeader.textContent = "Purchased Gear";
          cartEl.appendChild(shopHeader);
        }
        purchasedItems.forEach(function(item) {
          var idx = items.indexOf(item);
          var row = document.createElement("div");
          row.className = "outfitting-cart-row";

          var nameEl = document.createElement("span");
          nameEl.className = "outfitting-cart-item-name";
          nameEl.textContent = item.name;

          if (item.acquisition) {
            var acqBadge = document.createElement("span");
            acqBadge.className = "outfitting-acq-badge" + (item.acquisition === "contraband" ? " contraband" : " registered");
            acqBadge.textContent = item.acquisition === "contraband" ? "Contraband" : "Registered";
            nameEl.appendChild(document.createTextNode(" "));
            nameEl.appendChild(acqBadge);
          }

          var priceEl = document.createElement("span");
          priceEl.className = "outfitting-cart-item-price";
          priceEl.textContent = item.cost + " cr";

          var removeBtn = document.createElement("button");
          removeBtn.className = "outfitting-remove-btn";
          removeBtn.textContent = "×";
          removeBtn.addEventListener("click", function() {
            removeFromLoadout(idx);
          });

          row.appendChild(nameEl);
          row.appendChild(priceEl);
          row.appendChild(removeBtn);
          cartEl.appendChild(row);
        });
      }

      if (items.length === 0) {
        var emptyMsg = document.createElement("p");
        emptyMsg.className = "outfitting-cart-empty";
        emptyMsg.textContent = "No gear selected. Browse the catalog to add items.";
        cartEl.appendChild(emptyMsg);
      }

      var totalEl = document.getElementById("outfitting-cart-total");
      if (totalEl) {
        var soldBack = items.filter(function(g) { return g.acquisition === "sold-back"; }).reduce(function(acc, g) { return acc + (g.cost || 0); }, 0);
        var totalLine = spent + " / " + STARTING_CREDITS + " cr";
        if (state.soldBackCredits > 0) totalLine += " (+ " + state.soldBackCredits + " cr sell-back)";
        totalEl.innerHTML = '<span class="outfitting-total-label">Total Spent</span><span class="outfitting-total-value">' + totalLine + '</span>';
      }
    }

    renderCatalogItems();
    renderCart();
  }

  /* ── Phase card grid ────────────────────────────────────────────────────── */

  function buildPhaseCarousel(cards, containerId, selectFn, cardBuilder) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var stateKey = containerId;
    if (!phaseCarouselStates) phaseCarouselStates = {};
    if (!phaseCarouselStates[stateKey]) phaseCarouselStates[stateKey] = { current: 0, total: cards.length, touchStartX: 0, touchStartY: 0 };
    var cs = phaseCarouselStates[stateKey];

    var track = document.createElement('div');
    track.className = 'ph-carousel-track';

    cards.forEach(function (card, idx) {
      var builder = cardBuilder || buildPhase3CardFlat;
      var slide = builder(card, selectFn);
      slide.dataset.index = idx;
      track.appendChild(slide);
    });

    container.appendChild(track);

    

    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'ph-carousel-dots';
    dotsWrap.id = stateKey + '-dots';
    cards.forEach(function (card, idx) {
      var dot = document.createElement('button');
      dot.className = 'ph-carousel-dot' + (idx === 0 ? ' ph-dot-active' : '');
      dot.addEventListener('click', function () {
        if (stateKey === "ph-grid-species") resetSpeciesFavoredUI();
        cs.current = idx;
        phaseCarouselUpdate(stateKey, cards);
      });
      dotsWrap.appendChild(dot);
    });
    container.appendChild(dotsWrap);

    if (!container.dataset.touchBound) {
    container.dataset.touchBound = '1';
    container.addEventListener('touchstart', function (e) {
      cs.touchStartX = e.touches[0].clientX;
      cs.touchStartY = e.touches[0].clientY;
    }, { passive: true });
    container.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - cs.touchStartX;
      var dy = e.changedTouches[0].clientY - cs.touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        phaseCarouselNav(stateKey, cards, dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    }

    phaseCarouselUpdate(stateKey, cards);
  }

  var phaseCarouselStates = {};

  function resetSpeciesFavoredUI() {
    state.favoredDiscipline = null;
    var speciesContainer = document.getElementById("ph-grid-species");
    if (!speciesContainer) return;
    speciesContainer.querySelectorAll(".cc-favored-pill-selected").forEach(function (p) {
      p.classList.remove("cc-favored-pill-selected");
    });
    speciesContainer.querySelectorAll(".cc-favored-select").forEach(function (s) {
      s.value = "";
    });
  }

  function phaseCarouselNav(stateKey, cards, dir) {
    var cs = phaseCarouselStates[stateKey];
    if (stateKey === "ph-grid-species") resetSpeciesFavoredUI();
    cs.current = (cs.current + dir + cs.total) % cs.total;
    phaseCarouselUpdate(stateKey, cards);
  }

  function phaseCarouselUpdate(stateKey, cards) {
    var cs = phaseCarouselStates[stateKey];
    var container = document.getElementById(stateKey);
    if (!container) return;

    var slides = container.querySelectorAll('.ph-card-wrap');
    slides.forEach(function (slide, idx) {
      var offset = idx - cs.current;
      if (offset > cs.total / 2)  offset -= cs.total;
      if (offset < -cs.total / 2) offset += cs.total;
      slide.classList.remove('ph-slide-active', 'ph-slide-prev', 'ph-slide-next', 'ph-slide-hidden');
      if (offset === 0)       slide.classList.add('ph-slide-active');
      else                    slide.classList.add('ph-slide-hidden');
    });
    var dots = container.querySelectorAll('.ph-carousel-dot');
    dots.forEach(function (d, i) {
      d.classList.toggle('ph-dot-active', i === cs.current);
    });
    if (stateKey === "ph-grid-vocations") {
            rebuildActiveVocationSlide();
    }
  }



  function buildPhase3CardFlat(card, selectFn) {
    var wrapper = document.createElement("div");
    wrapper.className = "ph-card-wrap ph-card-flat";

    var cardEl = document.createElement("div");
    cardEl.className = "ph3-species-card";

    var imgCol = document.createElement("div");
    imgCol.className = "ph3-img-col";
    if (card.imageUrl) {
      var img = document.createElement("img");
      img.src = card.imageUrl;
      img.alt = card.title;
      img.className = "ph3-card-img";
      imgCol.appendChild(img);
    }

    var detailCol = document.createElement("div");
    detailCol.className = "ph3-detail-col";

    var titleEl = document.createElement("h2");
    titleEl.className = "ph3-card-name";
    titleEl.textContent = card.title;
    detailCol.appendChild(titleEl);

    var symbolEl = document.createElement("p");
    symbolEl.className = "ph3-card-symbol";
    symbolEl.textContent = card.symbol;
    detailCol.appendChild(symbolEl);

    var narrativeEl = document.createElement("p");
    narrativeEl.className = "ph3-narrative";
    narrativeEl.textContent = card.narrative;
    detailCol.appendChild(narrativeEl);

    if (card._meta && card._meta.knackName) {
      var knackBlock = document.createElement("div");
      knackBlock.className = "ph3-knack-block";

      var knackLabel = document.createElement("p");
      knackLabel.className = "ph3-knack-label";
      knackLabel.textContent = card._meta.knackType || "Narrative Truth";
      knackBlock.appendChild(knackLabel);

      var knackName = document.createElement("p");
      knackName.className = "ph3-knack-name";
      knackName.textContent = card._meta.knackName;
      knackBlock.appendChild(knackName);

      var knackDesc = document.createElement("p");
      knackDesc.className = "ph3-knack-desc";
      knackDesc.textContent = card._meta.knack;
      knackBlock.appendChild(knackDesc);

      detailCol.appendChild(knackBlock);
    }

    if (card._meta && card._meta.favored) {
      var favBlock = document.createElement("div");
      favBlock.className = "ph3-knack-block";

      var favLabel = document.createElement("p");
      favLabel.className = "ph3-knack-label";
      favLabel.textContent = "Favored Discipline";
      favBlock.appendChild(favLabel);

      var favBadge = document.createElement("span");
      favBadge.className = "ph-mech-badge";
      favBadge.textContent = card._meta.favored;
      favBlock.appendChild(favBadge);

      if (card._meta.favoredName) {
        var favName = document.createElement("p");
        favName.className = "ph3-knack-name";
        favName.textContent = card._meta.favoredName;
        favBlock.appendChild(favName);
      }

      if (card._meta.favoredDesc) {
        var favDesc = document.createElement("p");
        favDesc.className = "ph3-knack-desc";
        favDesc.textContent = card._meta.favoredDesc;
        favBlock.appendChild(favDesc);
      }

      detailCol.appendChild(favBlock);
    }

    var selectBtn = document.createElement("button");
    selectBtn.className = "cc-select-btn";
    selectBtn.textContent = "Choose This →";
    selectBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      selectFn(card);
    });
    detailCol.appendChild(selectBtn);

    cardEl.appendChild(imgCol);
    cardEl.appendChild(detailCol);
    wrapper.appendChild(cardEl);
    return wrapper;
  }

  function selectPhase1(card) {
    state.phase1 = card.id;
    saveState();
    showScreen('phase2');
    updateStepTrack(2);
  }

  function selectPhase2(card) {
    state.phase2 = card.id;
    saveState();
    showScreen('phase3');
    updateStepTrack(3);
  }

  function selectPhase3(card) {
    state.phase3 = card.id;
    saveState();
    initStatsScreen();
  }

  /* ── Summary overlay ────────────────────────────────────────────────────── */


    /* ── Destiny Screen ──────────────────────────────────────────────────────── */

    var DESTINY_POOL_CARDS = [
      {
        id: "two-light",
        value: "Two Light",
        title: "The Idealist",
        symbol: "CONVICTION OVER COMPROMISE",
        narrative: "You carry two Hope tokens into the crew's shared pool — a declaration that you still believe in something bigger than survival. In the cantinas and corridors of the civilized galaxy, that conviction opens doors. Honorable contacts trust you. Merchants deal fair. The desperate look to you first when they need someone who will do the right thing, even when it costs. But in the back alleys of Nar Shaddaa, in the slave pits and the spice dens, your light marks you as soft. The underworld doesn't respect principle — it respects power. Hope tokens can be tapped once per scene to boost any roll by +1 Tier, and a Hope-dominant pool grants +1 Tier on Charm and Persuasion. But every token is a promise. Break it, and the fall hits harder.",
        imageUrl: "/assets/destiny/pool-light.png"
      },
      {
        id: "light-dark",
        value: "Light & Dark",
        title: "The Pragmatist",
        symbol: "WHATEVER THE JOB DEMANDS",
        narrative: "You carry one Hope and one Toll into the crew's shared pool — the mark of someone who lives in the grey. You've done good work and dirty work, and you know the difference even when you pretend you don't. In polite society, people sense the edge beneath your manners — a little too comfortable with violence, a little too quick to calculate the cost of a life. In the underworld, you're not ruthless enough to be feared, not connected enough to be trusted. You walk both worlds and belong to neither. That tension is your strength: the crew can tap either side when the moment demands it. But the ledger is always watching. One bad night tips you toward the dark. One sacrifice pulls you back. You are the fulcrum — and the galaxy will test which way you fall.",
        imageUrl: "/assets/destiny/pool-mixed.png"
      },
      {
        id: "two-dark",
        value: "Two Dark",
        title: "The Survivor",
        symbol: "THE GALAXY TAKES. YOU TAKE BACK.",
        narrative: "You carry two Toll tokens into the crew's shared pool — not because you're evil, but because you've learned what the galaxy actually rewards. In the underworld, your reputation precedes you. Crime lords respect you. Enforcers step aside. When you walk into a room full of killers, they see someone who speaks their language. A Toll-dominant pool grants +1 Tier on Intimidate and Deception — fear is a currency, and you're rich. But among the honest and the hopeful, you are a warning sign. Merchants charge you double. Informants clam up. Children cross the street. Hope tokens are harder to earn and easier to lose. Toll tokens, once tapped, are locked — the guilt of that method is sealed in, and no sacrifice later can undo it. You chose this road. Now walk it.",
        imageUrl: "/assets/destiny/pool-dark.png"
      }
    ];

    var PERSONAL_DESTINY_CARDS = [];

    function initDestinyScreen() {
      var continueBtn = null;
      var backBtn = document.getElementById("btn-back-to-outfitting");
      var personalSection = document.getElementById("destiny-personal-section");

      buildPhaseCarousel(DESTINY_POOL_CARDS, "ph-grid-destiny-pool", selectDestinyPool, buildDestinyPoolCardFlat);

      var poolSection = document.getElementById("destiny-pool-section");
      if (state.destiny) {
        var poolIdx = DESTINY_POOL_CARDS.findIndex(function(c) { return c.value === state.destiny; });
        if (poolIdx >= 0 && phaseCarouselStates["ph-grid-destiny-pool"]) {
          phaseCarouselStates["ph-grid-destiny-pool"].current = poolIdx;
          phaseCarouselUpdate("ph-grid-destiny-pool", DESTINY_POOL_CARDS);
        }
        showPersonalDestinyCarousel();
      } else {
        if (poolSection) poolSection.classList.remove("hidden");
        personalSection.classList.add("hidden");
      }

      if (!document.getElementById("screen-destiny").dataset.bound) {
        document.getElementById("screen-destiny").dataset.bound = "1";

        if (continueBtn) {
          continueBtn.addEventListener("click", function () {
            showScreen("backstory");
            updateStepTrack(8);
            initBackstoryScreen();
          });
        }

        if (backBtn) {
          backBtn.addEventListener("click", function () {
            var personalSection = document.getElementById("destiny-personal-section");
            var poolSection = document.getElementById("destiny-pool-section");
            if (personalSection && !personalSection.classList.contains("hidden")) {
              personalSection.classList.add("hidden");
              if (poolSection) poolSection.classList.remove("hidden");
            } else {
              initOutfittingScreen();
            }
          });
        }


      }

      updateDestinyContinue();
    }

    function selectDestinyPool(poolCard) {
      state.destiny = poolCard.value;
      saveState();
      showPersonalDestinyCarousel();
      updateDestinyContinue();
    }

    function showPersonalDestinyCarousel() {
      var poolSection = document.getElementById("destiny-pool-section");
      var personalSection = document.getElementById("destiny-personal-section");
      if (!personalSection) return;
      if (poolSection) poolSection.classList.add("hidden");

      if (PERSONAL_DESTINY_CARDS.length === 0) {
        fetch("/data/destinies.json")
          .then(function(r) { return r.json(); })
          .then(function(data) {
            PERSONAL_DESTINY_CARDS = data.destinies.map(function(d) {
              return {
                id: d.id,
                title: d.name,
                symbol: d.tagline,
                narrative: d.narrativeHook,
                imageUrl: d.imageUrl,
                _destinyData: d
              };
            });
            buildPhaseCarousel(PERSONAL_DESTINY_CARDS, "ph-grid-personal-destiny", selectPersonalDestiny, buildPersonalDestinyCardFlat);
            restorePersonalDestinyIndex();
            personalSection.classList.remove("hidden");
          })
          .catch(function(err) {
            console.error("[destiny] Failed to load destinies:", err);
          });
      } else {
        buildPhaseCarousel(PERSONAL_DESTINY_CARDS, "ph-grid-personal-destiny", selectPersonalDestiny, buildPersonalDestinyCardFlat);
        restorePersonalDestinyIndex();
        personalSection.classList.remove("hidden");
      }
    }

    function restorePersonalDestinyIndex() {
      if (state.personalDestiny && phaseCarouselStates["ph-grid-personal-destiny"]) {
        var pdIdx = PERSONAL_DESTINY_CARDS.findIndex(function(c) { return c.id === state.personalDestiny.id; });
        if (pdIdx >= 0) {
          phaseCarouselStates["ph-grid-personal-destiny"].current = pdIdx;
          phaseCarouselUpdate("ph-grid-personal-destiny", PERSONAL_DESTINY_CARDS);
        }
      }
    }

    function selectPersonalDestiny(card) {
      var d = card._destinyData;
      state.personalDestiny = {
        id: d.id,
        name: d.name,
        tagline: d.tagline,
        hopeRecovery: d.hopeRecovery,
        tollRecovery: d.tollRecovery,
        advanceTrigger: d.advanceTrigger,
        narrativeHook: d.narrativeHook,
        coreQuestion: d.coreQuestion
      };
      saveState();
      showScreen("backstory");
      updateStepTrack(8);
      initBackstoryScreen();
    }

    function buildDestinyPoolCardFlat(card, selectFn) {
      var wrapper = document.createElement("div");
      wrapper.className = "ph-card-wrap ph-card-flat";

      var cardEl = document.createElement("div");
      cardEl.className = "ph3-species-card";

      var imgCol = document.createElement("div");
      imgCol.className = "ph3-img-col";
      if (card.imageUrl) {
        var img = document.createElement("img");
        img.src = card.imageUrl;
        img.alt = card.title;
        img.className = "ph3-card-img";
        imgCol.appendChild(img);
      }

      var detailCol = document.createElement("div");
      detailCol.className = "ph3-detail-col";

      var nameEl = document.createElement("h2");
      nameEl.className = "ph3-card-name";
      nameEl.textContent = card.title;
      detailCol.appendChild(nameEl);

      var symbolEl = document.createElement("p");
      symbolEl.className = "ph3-card-symbol";
      symbolEl.textContent = card.symbol;
      detailCol.appendChild(symbolEl);

      var narrativeEl = document.createElement("p");
      narrativeEl.className = "ph3-narrative";
      narrativeEl.textContent = card.narrative;
      detailCol.appendChild(narrativeEl);

      var btn = document.createElement("button");
      btn.className = "cc-select-btn";
      btn.textContent = "Select " + card.title + " →";
      btn.addEventListener("click", function () { selectFn(card); });
      detailCol.appendChild(btn);

      cardEl.appendChild(imgCol);
      cardEl.appendChild(detailCol);
      wrapper.appendChild(cardEl);
      return wrapper;
    }

    function buildPersonalDestinyCardFlat(card, selectFn) {
      var d = card._destinyData;
      var wrapper = document.createElement("div");
      wrapper.className = "ph-card-wrap ph-card-flat";

      var cardEl = document.createElement("div");
      cardEl.className = "ph3-species-card";

      var imgCol = document.createElement("div");
      imgCol.className = "ph3-img-col";
      if (card.imageUrl) {
        var img = document.createElement("img");
        img.src = card.imageUrl;
        img.alt = card.title;
        img.className = "ph3-card-img";
        imgCol.appendChild(img);
      }

      var detailCol = document.createElement("div");
      detailCol.className = "ph3-detail-col";

      var nameEl = document.createElement("h2");
      nameEl.className = "ph3-card-name";
      nameEl.textContent = card.title;
      detailCol.appendChild(nameEl);

      var tagEl = document.createElement("p");
      tagEl.className = "ph3-card-symbol";
      tagEl.textContent = d.tagline;
      detailCol.appendChild(tagEl);

      var narrativeEl = document.createElement("p");
      narrativeEl.className = "ph3-narrative";
      narrativeEl.textContent = d.narrativeHook;
      detailCol.appendChild(narrativeEl);

      var hopeBlock = document.createElement("div");
      hopeBlock.className = "ph3-knack-block";
      var hopeLabel = document.createElement("p");
      hopeLabel.className = "ph3-knack-label destiny-label--hope";
      hopeLabel.textContent = "Hope Recovery";
      hopeBlock.appendChild(hopeLabel);
      var hopeName = document.createElement("p");
      hopeName.className = "ph3-knack-name";
      hopeName.textContent = d.hopeRecovery.title;
      hopeBlock.appendChild(hopeName);
      var hopeDesc = document.createElement("p");
      hopeDesc.className = "ph3-knack-desc";
      hopeDesc.textContent = d.hopeRecovery.description;
      hopeBlock.appendChild(hopeDesc);
      detailCol.appendChild(hopeBlock);

      var tollBlock = document.createElement("div");
      tollBlock.className = "ph3-knack-block";
      var tollLabel = document.createElement("p");
      tollLabel.className = "ph3-knack-label destiny-label--toll";
      tollLabel.textContent = "Toll Recovery";
      tollBlock.appendChild(tollLabel);
      var tollName = document.createElement("p");
      tollName.className = "ph3-knack-name";
      tollName.textContent = d.tollRecovery.title;
      tollBlock.appendChild(tollName);
      var tollDesc = document.createElement("p");
      tollDesc.className = "ph3-knack-desc";
      tollDesc.textContent = d.tollRecovery.description;
      tollBlock.appendChild(tollDesc);
      detailCol.appendChild(tollBlock);

      var advBlock = document.createElement("div");
      advBlock.className = "ph3-knack-block";
      var advLabel = document.createElement("p");
      advLabel.className = "ph3-knack-label destiny-label--advance";
      advLabel.textContent = "Advance";
      advBlock.appendChild(advLabel);
      var advDesc = document.createElement("p");
      advDesc.className = "ph3-knack-desc";
      advDesc.textContent = d.advanceTrigger;
      advBlock.appendChild(advDesc);
      detailCol.appendChild(advBlock);

      var btn = document.createElement("button");
      btn.className = "cc-select-btn";
      btn.textContent = "Choose " + d.name + " →";
      btn.addEventListener("click", function () { selectFn(card); });
      detailCol.appendChild(btn);

      cardEl.appendChild(imgCol);
      cardEl.appendChild(detailCol);
      wrapper.appendChild(cardEl);
      return wrapper;
    }

    function updateDestinyContinue() {
      var btn = null;
      if (btn) btn.disabled = !(state.destiny && state.personalDestiny);
    }

        /* ── Backstory Screen ────────────────────────────────────────────────────── */

    var _regen_cooldown = false;
    var _gen_in_flight  = false;
    var _regen_timer    = null;

    function initBackstoryScreen() {
      var screen = document.getElementById('screen-backstory');
      if (!screen) return;

      // Populate species display
      var sp = SPECIES.find(function (s) { return s.id === state.species; });
      var speciesEl = document.getElementById('bs-species-display');
      if (speciesEl) speciesEl.textContent = sp ? sp.name : '—';

      // Restore prior form values
      var nameInput  = document.getElementById('bs-char-name');
      var genNameChk = document.getElementById('bs-generate-name');
      var genderSel  = document.getElementById('bs-gender');
      var titleInput = document.getElementById('bs-char-title');
      var playerIn   = document.getElementById('bs-player-input');
      var genBtn     = document.getElementById('btn-generate-backstory');
      var regenBtn   = document.getElementById('btn-regenerate');
      var copyBtn    = document.getElementById('btn-copy-backstory');
      var finalizeBtn = null;
      var backBtn    = null;

      if (nameInput && state.charName)   nameInput.value  = state.charName;
      if (genderSel && state.charGender) genderSel.value  = state.charGender;
      if (titleInput && state.charTitle) titleInput.value = state.charTitle;

      // If we already have backstory, show it
      if (state.backstory) {
        showProseState(state.backstory);
        if (regenBtn) regenBtn.disabled = _regen_cooldown;
      }

      updateGenBtn();

      // Only bind once
      if (screen.dataset.bound) return;
      screen.dataset.bound = '1';

      if (nameInput) {
        nameInput.addEventListener('input', function () {
          state.charName = nameInput.value.trim();
          updateGenBtn();
        });
      }

      if (genNameChk) {
        genNameChk.addEventListener('change', function () {
          if (nameInput) nameInput.disabled = genNameChk.checked;
          updateGenBtn();
        });
      }

      if (genderSel) {
        genderSel.addEventListener('change', function () {
          state.charGender = genderSel.value;
        });
      }

      if (titleInput) {
        titleInput.addEventListener('input', function () {
          state.charTitle = titleInput.value.trim();
        });
      }

      if (genBtn) {
        genBtn.addEventListener('click', function () {
          if (!_gen_in_flight) generateBackstory();
        });
      }

      if (regenBtn) {
        regenBtn.addEventListener('click', function () {
          if (!_regen_cooldown && !_gen_in_flight) generateBackstory();
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          copyToClipboard(state.backstory);
        });
      }

      if (finalizeBtn) {
        finalizeBtn.addEventListener('click', function () {
          showSummary();
        });
      }

      if (backBtn) {
        backBtn.addEventListener('click', function () {
          showScreen('destiny');
          updateStepTrack(7);
          initDestinyScreen();
        });
      }

      function updateGenBtn() {
        if (!genBtn) return;
        var nameOk = (genNameChk && genNameChk.checked) || (nameInput && nameInput.value.trim().length > 0);
        genBtn.disabled = !nameOk;
      }
    }

    function showProseState(text) {
      document.getElementById('bs-idle-state').classList.add('hidden');
      document.getElementById('bs-loading-state').classList.add('hidden');
      document.getElementById('bs-error-state').classList.add('hidden');
      var proseEl = document.getElementById('bs-prose-state');
      proseEl.classList.remove('hidden');
      var contentEl = document.getElementById('bs-prose-content');
      if (contentEl) contentEl.textContent = text;
    }

    function showLoadingState() {
      document.getElementById('bs-idle-state').classList.add('hidden');
      document.getElementById('bs-prose-state').classList.add('hidden');
      document.getElementById('bs-error-state').classList.add('hidden');
      document.getElementById('bs-loading-state').classList.remove('hidden');
    }

    function showErrorState(msg) {
      document.getElementById('bs-idle-state').classList.add('hidden');
      document.getElementById('bs-loading-state').classList.add('hidden');
      document.getElementById('bs-prose-state').classList.add('hidden');
      var errEl = document.getElementById('bs-error-state');
      errEl.classList.remove('hidden');
      var msgEl = document.getElementById('bs-error-msg');
      if (msgEl) msgEl.textContent = msg;
    }

    function copyToClipboard(text) {
      if (!text) return;
      // HTTP-safe clipboard: try modern API, fall back to execCommand
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(function () { execCopy(text); });
      } else {
        execCopy(text);
      }
    }

    function execCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top  = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }

    function generateBackstory() {
      if (_gen_in_flight) return;
      _gen_in_flight = true;
      var sp      = SPECIES.find(function (s) { return s.id === state.species; });
      var p1card  = PHASE1_CARDS.find(function (c) { return c.id === state.phase1; });
      var p2card  = PHASE2_CARDS.find(function (c) { return c.id === state.phase2; });
      var p3card  = PHASE3_CARDS.find(function (c) { return c.id === state.phase3; });

      var genNameChk = document.getElementById('bs-generate-name');
      var nameInput  = document.getElementById('bs-char-name');
      var genderSel  = document.getElementById('bs-gender');
      var titleInput = document.getElementById('bs-char-title');
      var playerIn   = document.getElementById('bs-player-input');
      var regenBtn   = document.getElementById('btn-regenerate');
      var genBtn     = document.getElementById('btn-generate-backstory');

      var generateName  = genNameChk  ? genNameChk.checked  : false;
      var characterName = nameInput   ? nameInput.value.trim()  : state.charName;
      var gender        = genderSel   ? genderSel.value         : state.charGender || 'Male';
      var charTitle     = titleInput  ? titleInput.value.trim() : state.charTitle;
      var playerInput   = playerIn    ? playerIn.value.trim()   : '';

      var kitEntries = [];
      if (state.kitChoices) {
        Object.keys(state.kitChoices).forEach(function (k) {
          if (!state.kitChoices[k]) return;
          var kitDef = KITS_DATA.length ? KITS_DATA.find(function (kd) { return kd.id === k; }) : null;
          kitEntries.push({
            name: kitDef ? kitDef.name : k,
            tier: state.kitChoices[k],
            arena: kitDef ? kitDef.governingArena : '',
            discipline: kitDef ? kitDef.alignedDiscipline : '',
          });
        });
      }

      // Build discipline display name map
      var discDisplayNames = {};
      DISCIPLINES_BY_ARENA.forEach(function (arena) {
        arena.disciplines.forEach(function (d) {
          discDisplayNames[d.id] = d.name;
        });
      });

      var discStrengths = [];
      var discWeaknesses = [];
      if (state.discValues) {
        Object.keys(state.discValues).forEach(function (k) {
          var dv = state.discValues[k];
          var label = discDisplayNames[k] || k;
          if (dv === 'D8' || dv === 'D10' || dv === 'D12') {
            discStrengths.push(label + ' (' + dv + ')');
          }
        });
      }
      if (state.discIncomp) {
        Object.keys(state.discIncomp).forEach(function (k) {
          if (state.discIncomp[k]) {
            var label = discDisplayNames[k] || k;
            discWeaknesses.push(label + ' (D4 — incompetent)');
          }
        });
      }

      var allArenas = [];
      var speciesObj = SPECIES.find(function (s) { return s.id === state.species; });
      if (speciesObj) {
        ARENA_ORDER.forEach(function (aid) {
          var baseIdx = DIE_ORDER.indexOf(speciesObj.arenas[aid] || 'D6');
          var adj = (state.arenaAdj && state.arenaAdj[aid]) || 0;
          var finalIdx = Math.max(0, Math.min(DIE_ORDER.length - 1, baseIdx + adj));
          var finalDie = DIE_ORDER[finalIdx];
          allArenas.push(ARENA_LABELS[aid] + ': ' + finalDie);
        });
      }

      var forceSensitive = false;
      var forceState = [];
      var FORCE_IDS = ['control_spark', 'sense_spark', 'alter_spark'];
      FORCE_IDS.forEach(function(fid) {
        var isIncomp = state.discIncomp && state.discIncomp[fid];
        var isAutoSet = state._forceAutoSet && state._forceAutoSet[fid];
        if (isIncomp && !isAutoSet) {
          forceState.push((discDisplayNames[fid] || fid) + ': sealed (player chose to leave locked)');
        } else if (!isIncomp) {
          forceState.push((discDisplayNames[fid] || fid) + ': awakened (' + (state.discValues[fid] || 'D6') + ')');
          forceSensitive = true;
        } else {
          forceState.push((discDisplayNames[fid] || fid) + ': dormant (default)');
        }
      });

      var gearWithOrigin = (state.startingGear || []).map(function(g) {
        var origin = g.origin || g.source || '';
        return g.name + (origin ? ' (from ' + origin + ')' : '');
      });

      var soldItems = (state.soldBackgroundKeys || []).map(function(key) {
        var parts = key.split('|');
        return parts[0] || key;
      });

      var favDiscLabel = '';
      if (state.favoredDiscipline) {
        favDiscLabel = discDisplayNames[state.favoredDiscipline] || state.favoredDiscipline;
      }

      var payload = {
        species: sp ? {
          name:          sp.name,
          biologicalTruth: sp.biologicalTruth ? sp.biologicalTruth.desc : '',
          loreAnchors:   sp._aiMeta ? sp._aiMeta.loreAnchors.join('; ') : '',
          directive:     sp._aiMeta ? sp._aiMeta.directives : '',
          traitName:     sp.speciesTrait ? sp.speciesTrait.name : '',
          traitDesc:     sp.speciesTrait ? sp.speciesTrait.desc : '',
        } : { name: 'Unknown', biologicalTruth: '', loreAnchors: '', directive: '', traitName: '', traitDesc: '' },
        phase1: p1card ? {
          title:       p1card.title,
          narrative:   p1card.narrative,
          environment: p1card._meta ? p1card._meta.environment : '',
          tone:        p1card._meta ? p1card._meta.tone : '',
          themes:      p1card._meta ? p1card._meta.themes.join(', ') : '',
          locationHints: p1card._meta && p1card._meta.locationHints ? p1card._meta.locationHints : [],
          favored:     p1card._meta ? p1card._meta.favored || '' : '',
          favoredName: p1card._meta ? p1card._meta.favoredName || '' : '',
          favoredDesc: p1card._meta ? p1card._meta.favoredDesc || '' : '',
        } : { title: 'Unknown', narrative: '', environment: '', tone: '', themes: '', locationHints: [], favored: '', favoredName: '', favoredDesc: '' },
        phase2: p2card ? {
          title:       p2card.title,
          narrative:   p2card.narrative,
          environment: p2card._meta ? p2card._meta.environment : '',
          tone:        p2card._meta ? p2card._meta.tone : '',
          themes:      p2card._meta ? p2card._meta.themes ? p2card._meta.themes.join(', ') : p2card._meta.archetype || '' : '',
          archetype:     p2card._meta ? p2card._meta.archetype || '' : '',
          proficiencies: p2card._meta && p2card._meta.proficiencies ? p2card._meta.proficiencies.join(', ') : '',
          variability:   p2card._meta ? p2card._meta.variability || '' : '',
          favored:     p2card._meta ? p2card._meta.favored || '' : '',
          favoredName: p2card._meta ? p2card._meta.favoredName || '' : '',
          favoredDesc: p2card._meta ? p2card._meta.favoredDesc || '' : '',
        } : { title: 'Unknown', narrative: '', environment: '', tone: '', themes: '', archetype: '', proficiencies: '', variability: '', favored: '', favoredName: '', favoredDesc: '' },
        phase3: p3card ? {
          title:       p3card.title,
          narrative:   p3card.narrative,
          environment: p3card._meta ? p3card._meta.environment || '' : '',
          tone:        p3card._meta ? p3card._meta.tone : '',
          themes:      p3card._meta ? p3card._meta.themes ? p3card._meta.themes.join(', ') : p3card._meta.archetype || '' : '',
          archetype:   p3card._meta ? p3card._meta.archetype || '' : '',
          knackName:   p3card._meta ? p3card._meta.knackName || '' : '',
          knackType:   p3card._meta ? p3card._meta.knackType || '' : '',
          knack:       p3card._meta ? p3card._meta.knack || '' : '',
        } : { title: 'Unknown', narrative: '', environment: '', tone: '', themes: '', archetype: '', knackName: '', knackType: '', knack: '' },
        kits:            kitEntries,
        startingGear:    gearWithOrigin,
        soldItems:       soldItems,
        disciplines:     discStrengths,
        weakDisciplines: discWeaknesses,
        favoredDiscipline: { id: state.favoredDiscipline || null, name: favDiscLabel },
        arenas:          allArenas,
        forceSensitive:  forceSensitive,
        forceState:      forceState,
        destiny:      state.destiny || 'Light & Dark',
        personalDestiny: state.personalDestiny || null,
        gender:       gender,
        generateName: generateName,
        characterName: characterName,
        generateTitle: !charTitle,
        characterTitle: charTitle,
        playerInput:  playerInput,
      };

      // Lock UI
      if (genBtn) genBtn.disabled = true;
      if (regenBtn) regenBtn.disabled = true;
      showLoadingState();

      // 5-second minimum display delay + fetch race
      var fetchPromise = fetch('/api/backstory/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); });

      var minDelay = new Promise(function (res) { setTimeout(res, 5000); });

      Promise.all([fetchPromise, minDelay]).then(function (results) {
        _gen_in_flight = false;
        var res = results[0];
        if (!res.ok) {
          var errMsg = 'Generation failed. Try again.';
          if (res.status === 429 || (res.data && res.data.error === 'rate_limit')) {
            errMsg = 'The chronicler is busy — too many stories generating at once. Wait a moment and try again.';
          } else if (res.status === 504 || (res.data && res.data.error === 'timeout')) {
            errMsg = 'The chronicler went quiet. Check your connection and try regenerating.';
          } else if (res.data && res.data.error) {
            errMsg = res.data.error;
          }
          showErrorState(errMsg);
          if (genBtn) genBtn.disabled = false;
          if (regenBtn) regenBtn.disabled = false;
          return;
        }

        var data = res.data;

        // Fill in generated name/title
        if (data.name) {
          state.charName = data.name;
          var nameInput2 = document.getElementById('bs-char-name');
          if (nameInput2) nameInput2.value = data.name;
        }
        if (data.title) {
          state.charTitle = data.title;
          var titleInput2 = document.getElementById('bs-char-title');
          if (titleInput2) titleInput2.value = data.title;
        }
        state.charGender = gender;
        state.backstory  = data.backstory || '';

        showProseState(state.backstory);
        if (genBtn) genBtn.disabled = false;

        // 15-second cooldown on regenerate
        _regen_cooldown = true;
        if (regenBtn) regenBtn.disabled = true;
        clearTimeout(_regen_timer);
        _regen_timer = setTimeout(function () {
          _regen_cooldown = false;
          if (regenBtn) regenBtn.disabled = false;
        }, 15000);

      }).catch(function (err) {
        console.error('[backstory]', err);
        showErrorState('Something went wrong. Check the server and try again.');
        if (genBtn) genBtn.disabled = false;
        if (regenBtn) regenBtn.disabled = false;
      });
    }

    
    /* ── Character Save ──────────────────────────────────────────────────────── */

    function saveCharacterToDB() {
      var saveName = state.charName && state.charName.trim() ? state.charName.trim() : null;
      if (!saveName) {
        var statusEl = document.getElementById('sum-save-status');
        if (statusEl) { statusEl.textContent = 'Please set a character name on the Your Story screen first.'; statusEl.style.color = '#ef4444'; }
        return;
      }

      var sp     = SPECIES.find(function (s) { return s.id === state.species; });
      var p1card = PHASE1_CARDS.find(function (c) { return c.id === state.phase1; });
      var p2card = PHASE2_CARDS.find(function (c) { return c.id === state.phase2; });
      var p3card = PHASE3_CARDS.find(function (c) { return c.id === state.phase3; });

      var unarmedId = (state.species === "cathar") ? "wpn_cathar_claws_01" : "wpn_fists_01";
      var unarmedName = (state.species === "cathar") ? "Cathar Claws" : "Fists";
      if (!state.startingGear) state.startingGear = [];
      var hasInnateGear = state.startingGear.some(function(g) { return g.innate; });
      if (!hasInnateGear) {
        state.startingGear.push({ id: unarmedId, name: unarmedName, source: "weapon", acquisition: "innate", innate: true, cost: 0 });
      }

      var charData = {
        species:    sp   ? sp.name   : null,
        archetype:  state.charTitle || null,
        phase1:     p1card ? p1card.title : null,
        phase2:     p2card ? p2card.title : null,
        phase3:     p3card ? p3card.title : null,
        destiny:    state.destiny,
        personalDestiny: state.personalDestiny || null,
        gender:     state.charGender,
        title:      state.charTitle,
        backstory:  state.backstory,
        kits:       state.kitChoices,
        startingGear: state.startingGear || [],
        soldBackgroundKeys: state.soldBackgroundKeys || [],
        soldBackCredits: state.soldBackCredits || 0,
        startingCredits: STARTING_CREDITS,
        creditsRemaining: outfittingCreditsRemaining(),
        arenaAdj:   state.arenaAdj,
        discValues: state.discValues,
        creationState: JSON.parse(JSON.stringify(state)),
      };

      var statusEl  = document.getElementById('sum-save-status');
      var saveBtn   = document.getElementById('btn-sum-save');
      if (statusEl) { statusEl.textContent = 'Saving…'; statusEl.style.color = 'var(--color-text-secondary)'; }
      if (saveBtn)  saveBtn.disabled = true;

      fetch('/api/characters/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: saveName, character_data: charData, editId: state.editId || null }),
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          if (statusEl) { statusEl.textContent = 'Saved! Launching character sheet…'; statusEl.style.color = '#22c55e'; }
          if (saveBtn)  saveBtn.textContent = 'Saved ✓';
          setTimeout(function() {
            fetch('/api/session/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: 'player', characterId: data.id }),
            })
            .then(function(r) { return r.json(); })
            .then(function(sess) {
              if (sess.error) { if (statusEl) statusEl.textContent = sess.error; return; }
              sessionStorage.setItem('eote-session', JSON.stringify({
                token: sess.token,
                role: sess.role,
                characterId: sess.characterId,
                characterName: sess.characterName,
              }));
              window.location.href = '/player/';
            })
            .catch(function(e) { if (statusEl) { statusEl.textContent = 'Redirect failed: ' + e.message; statusEl.style.color = '#ef4444'; } if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Launch Character Sheet'; } });
          }, 1200);
        } else {
          throw new Error(data.error || 'Save failed');
        }
      })
      .catch(function (err) {
        if (statusEl) { statusEl.textContent = 'Save failed: ' + err.message; statusEl.style.color = '#ef4444'; }
        if (saveBtn)  { saveBtn.disabled = false; }
      });
    }

      function showSummary() {
    var overlay = document.getElementById('cc-summary-overlay');
    if (!overlay) return;
    buildSummaryContent(overlay);
    overlay.classList.remove('hidden');
  }

  function buildSummaryContent(overlay) {
    var sp = SPECIES.find(function (s) { return s.id === state.species; });
    var p1 = PHASE1_CARDS.find(function (c) { return c.id === state.phase1; });
    var p2 = PHASE2_CARDS.find(function (c) { return c.id === state.phase2; });
    var p3 = PHASE3_CARDS.find(function (c) { return c.id === state.phase3; });

    var body = overlay.querySelector('.sum-body');
    if (!body) return;
    body.innerHTML = '';

    body.appendChild(buildSumSection('Species', sp ? [
      sumRow('Name',       sp.name),
      sumRow('Tagline',    sp.tagline),
      sumRow('Arena Shift', sp.arenaShift.name + ' — ' + sp.arenaShift.desc),
      sumRow('Favored Discipline', (function() {
        var chosen = sp.favoredDiscipline.choices.find(function(c) { return c.id === state.favoredDiscipline; });
        return chosen ? chosen.label : 'Not selected';
      })()),
      sumRow('Biological Truth', sp.biologicalTruth.name + ' — ' + sp.biologicalTruth.desc),
      sumRow('Species Trait', sp.speciesTrait ? sp.speciesTrait.name + ' — ' + sp.speciesTrait.desc : 'None'),
      sumRow('Arenas', Object.keys(sp.arenas).map(function (k) {
        return k.charAt(0).toUpperCase() + k.slice(1) + ': ' + sp.arenas[k];
      }).join(' · ')),
      sumRow('AI Lore Anchors', sp._aiMeta.loreAnchors.join(' / ')),
      sumRow('AI Directives',   sp._aiMeta.directives),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 1 — The Dust (Origin)', p1 ? [
      sumRow('Card',        p1.title),
      sumRow('Symbol',      p1.symbol),
      sumRow('Narrative',   p1.narrative),
      sumRow('Environment', p1._meta.environment),
      sumRow('Tone',        p1._meta.tone),
      sumRow('Themes',      p1._meta.themes.join(', ')),
      sumRow('Favored Skill', p1._meta.favored),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 2 — The Departure (Catalyst)', p2 ? [
      sumRow('Card',         p2.title),
      sumRow('Symbol',       p2.symbol),
      sumRow('Narrative',    p2.narrative),
      sumRow('Archetype',    p2._meta.archetype),
      sumRow('Tone',         p2._meta.tone),
      sumRow('Favored Skill', p2._meta.favored),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 3 — The Debt (Adversity)', p3 ? [
      sumRow('Card',       p3.title),
      sumRow('Symbol',     p3.symbol),
      sumRow('Narrative',  p3.narrative),
      sumRow('Archetype',  p3._meta.archetype),
      sumRow('Tone',       p3._meta.tone),
      sumRow('Knack',      p3._meta.knackName + ' (' + p3._meta.knackType + ')'),
      sumRow('Knack Desc', p3._meta.knack),
    ] : [sumRow('Status', 'Not selected')]));

    var gearItems = state.startingGear || [];
    var gearRows = [];
    if (gearItems.length === 0) {
      gearRows.push(sumRow('Status', 'No gear selected'));
    } else {
      var bgGear = gearItems.filter(function(g) { return g.acquisition === 'background'; });
      var shopGear = gearItems.filter(function(g) { return g.acquisition !== 'background'; });
      if (bgGear.length > 0) {
        bgGear.forEach(function(item) {
          gearRows.push(sumRow(item.name, (item.origin || 'Background') + ' (free)'));
        });
      }
      if (shopGear.length > 0) {
        shopGear.forEach(function(item) {
          gearRows.push(sumRow(item.name, item.cost + ' cr'));
        });
      }
      gearRows.push(sumRow('Credits Spent', outfittingCreditsSpent() + ' / ' + STARTING_CREDITS));
      gearRows.push(sumRow('Credits Remaining', outfittingCreditsRemaining() + ' cr'));
      if (state.soldBackCredits > 0) gearRows.push(sumRow('Sell-Back Bonus', '+' + state.soldBackCredits + ' cr'));
    }
    body.appendChild(buildSumSection('Starting Gear', gearRows));

    var destinyRows = [
      sumRow('Pool Contribution', state.destiny || '(not set)'),
    ];
    if (state.personalDestiny) {
      destinyRows.push(sumRow('Personal Destiny', state.personalDestiny.name + ' — ' + state.personalDestiny.tagline));
      destinyRows.push(sumRow('Hope Recovery', state.personalDestiny.hopeRecovery.title + ': ' + state.personalDestiny.hopeRecovery.description));
      destinyRows.push(sumRow('Toll Recovery', state.personalDestiny.tollRecovery.title + ': ' + state.personalDestiny.tollRecovery.description));
      destinyRows.push(sumRow('Advance', state.personalDestiny.advanceTrigger));
    } else {
      destinyRows.push(sumRow('Personal Destiny', '(not set)'));
    }
    body.appendChild(buildSumSection('Destiny', destinyRows));

    body.appendChild(buildSumSection('Character Identity', [
      sumRow('Name',    state.charName  || '(not set)'),
      sumRow('Title',   state.charTitle || '(not set)'),
      sumRow('Gender',  state.charGender || '(not set)'),
    ]));

    if (state.backstory) {
      var bsSection = document.createElement('div');
      bsSection.className = 'sum-section';
      var bsHead = document.createElement('h3');
      bsHead.className = 'sum-section-title';
      bsHead.textContent = 'Generated Backstory';
      bsSection.appendChild(bsHead);
      var bsPara = document.createElement('p');
      bsPara.style.cssText = 'font-size:0.52rem;line-height:1.8;color:var(--color-text-primary);white-space:pre-wrap;padding:0.25rem 0;';
      bsPara.textContent = state.backstory;
      bsSection.appendChild(bsPara);
      body.appendChild(bsSection);
    }
  }

  function buildSumSection(title, rows) {
    var section = document.createElement('div');
    section.className = 'sum-section';

    var h = document.createElement('h3');
    h.className   = 'sum-section-title';
    h.textContent = title;
    section.appendChild(h);

    rows.forEach(function (row) { section.appendChild(row); });
    return section;
  }

  function sumRow(label, value) {
    var row = document.createElement('div');
    row.className = 'sum-row';

    var l = document.createElement('span');
    l.className   = 'sum-label';
    l.textContent = label;

    var v = document.createElement('span');
    v.className   = 'sum-value';
    v.textContent = value || '—';

    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  /* ── Species selection ──────────────────────────────────────────────────── */

  function selectSpecies(sp) {
    if (!state.favoredDiscipline) {
      if (sp.favoredDiscipline.choices.length === 1) {
        state.favoredDiscipline = sp.favoredDiscipline.choices[0].id;
      } else {
        _toast('Please select a favored discipline before confirming.');
        return;
      }
    }

    state.species   = sp.id;
    state.previewId = null;
    saveState();

    var chosenId = state.favoredDiscipline;
    var chosenLabel = chosenId;
    sp.favoredDiscipline.choices.forEach(function (ch) {
      if (ch.id === chosenId) chosenLabel = ch.label;
    });

    characterSheet.species     = sp.name;
    characterSheet.arenas      = Object.assign({}, ARENA_BASELINE, sp.arenas);
    characterSheet.disciplines = ['Favored: ' + chosenLabel];
    characterSheet.abilities   = [sp.biologicalTruth.name];
    if (sp.speciesTrait) characterSheet.abilities.push(sp.speciesTrait.name);
    characterSheet.favoredDiscipline = chosenId;

    showScreen('phase1');
    updateStepTrack(1);
  }

  /* ── Screen management ──────────────────────────────────────────────────── */

  function showScreen(id) {
    document.querySelectorAll('[id^="screen-"]').forEach(function (s) {
      s.classList.add('hidden');
    });
    var el = document.getElementById('screen-' + id);
    if (el) el.classList.remove('hidden');
  }

  var headerNavPrev = null;
  var headerNavNext = null;
  var currentScreen = "species";

  function updateHeaderNav(screen) {
    currentScreen = screen;
    if (!headerNavPrev) headerNavPrev = document.getElementById("cc-nav-prev");
    if (!headerNavNext) headerNavNext = document.getElementById("cc-nav-next");
    if (!headerNavPrev || !headerNavNext) return;

    var nav = {
      species:    { prev: null, next: null },
      phase1:     { prev: { label: "← Species",    fn: function() { showScreen("species"); updateStepTrack(0); } }, next: null },
      phase2:     { prev: { label: "← Origin",     fn: function() { showScreen("phase1"); updateStepTrack(1); } },  next: null },
      phase3:     { prev: { label: "← Catalyst",   fn: function() { showScreen("phase2"); updateStepTrack(2); } },  next: null },
      stats:      { prev: { label: "← Debt",       fn: function() { showScreen("phase3"); updateStepTrack(3); } },  next: { label: "Vocations →", fn: function() { initKitsScreen(); } } },
      kits:       { prev: { label: "← Arenas",     fn: function() { showScreen("stats"); updateStepTrack(4); } },   next: { label: "Outfitting →", fn: function() { initOutfittingScreen(); } } },
      outfitting: { prev: { label: "← Vocations",  fn: function() { initKitsScreen(); } },                            next: { label: "Destiny →",    fn: function() { showScreen("destiny"); updateStepTrack(7); initDestinyScreen(); } } },
      destiny:    { prev: { label: "← Outfitting", fn: function() { initOutfittingScreen(); } },                       next: { label: "Your Story →", fn: function() { showScreen("backstory"); updateStepTrack(8); initBackstoryScreen(); }, disabled: true } },
      backstory:  { prev: { label: "← Destiny",    fn: function() { showScreen("destiny"); updateStepTrack(7); initDestinyScreen(); } }, next: { label: "Finalize →", fn: function() { showSummary(); } } },
    };

    var cfg = nav[screen] || { prev: null, next: null };

    if (cfg.prev) {
      headerNavPrev.textContent = cfg.prev.label;
      headerNavPrev.classList.remove("hidden");
      headerNavPrev.onclick = cfg.prev.fn;
    } else {
      headerNavPrev.classList.add("hidden");
      headerNavPrev.onclick = null;
    }

    if (cfg.next) {
      headerNavNext.textContent = cfg.next.label;
      headerNavNext.classList.remove("hidden");
      headerNavNext.onclick = cfg.next.fn;
      headerNavNext.disabled = !!cfg.next.disabled;
    } else {
      headerNavNext.classList.add("hidden");
      headerNavNext.onclick = null;
    }
  }

  function enableHeaderNext() {
    if (headerNavNext) headerNavNext.disabled = false;
  }

  function disableHeaderNext() {
    if (headerNavNext) headerNavNext.disabled = true;
  }
  function updateStepTrack(activeIdx) {
    document.querySelectorAll('.cc-step-pip').forEach(function (pip, i) {
      pip.classList.toggle('cc-pip-active', i === activeIdx);
      pip.classList.toggle('cc-pip-done',   i < activeIdx);
    });
    var screenMap = ["species", "phase1", "phase2", "phase3", "stats", "kits", "outfitting", "destiny", "backstory"];
    if (screenMap[activeIdx]) updateHeaderNav(screenMap[activeIdx]);
  }

  /* ── Utilities ──────────────────────────────────────────────────────────── */

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */

  function loadEditCharacter(callback) {
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('edit');
    if (!editId) { callback(); return; }

    fetch('/api/characters/' + encodeURIComponent(editId) + '?raw=1')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { console.warn('Edit load failed:', data.error); callback(); return; }
        var cd = data.character_data || {};
        if (cd.creationState) {
          Object.assign(state, cd.creationState);
        } else {
          var sp = SPECIES.find(function (s) { return s.name === cd.species; });
          if (sp) state.species = sp.id;
          var p1 = PHASE1_CARDS.find(function (c) { return c.title === cd.phase1; });
          if (p1) state.phase1 = p1.id;
          var p2 = PHASE2_CARDS.find(function (c) { return c.title === cd.phase2; });
          if (p2) state.phase2 = p2.id;
          var p3 = PHASE3_CARDS.find(function (c) { return c.title === cd.phase3; });
          if (p3) state.phase3 = p3.id;
          if (cd.destiny) state.destiny = cd.destiny;
          if (cd.personalDestiny) state.personalDestiny = cd.personalDestiny;
          if (cd.gender)  state.charGender = cd.gender;
          if (cd.title)   state.charTitle = cd.title;
          if (cd.backstory) state.backstory = cd.backstory;
          if (cd.kits) state.kitChoices = cd.kits;
          if (cd.startingGear) state.startingGear = cd.startingGear;
          if (cd.soldBackgroundKeys) state.soldBackgroundKeys = cd.soldBackgroundKeys;
          if (cd.soldBackCredits) state.soldBackCredits = cd.soldBackCredits;
          if (cd.arenaAdj) state.arenaAdj = cd.arenaAdj;
          if (cd.discValues) {
            state.discValues = cd.discValues;
            state.discIncomp = {};
            var d8Count = 0;
            var d10Count = 0;
            Object.keys(cd.discValues).forEach(function (k) {
              if (cd.discValues[k] === 'D4') state.discIncomp[k] = true;
              if (cd.discValues[k] === 'D8') d8Count++;
              if (cd.discValues[k] === 'D10') d10Count++;
            });
            state.spentAdv = d8Count + d10Count;
            state.eliteTokensUsed = d10Count;
          }
        }
        state.charName = data.name || '';
        state.editId = editId;
        callback();
      })
      .catch(function () { callback(); });
  }

  function init() {
    loadTheme();
    Promise.allSettled([
      fetch("/data/species.json").then(function (r) { return r.json(); }),
      fetch("/data/phases.json").then(function (r) { return r.json(); }),
      fetch("/data/kits.json").then(function (r) { return r.json(); })
    ])
      .then(function (results) {
        if (results[0].status === "fulfilled") SPECIES = results[0].value;
        else console.error("[init] species.json failed", results[0].reason);
        if (results[1].status === "fulfilled") {
          var phases = results[1].value;
          PHASE1_CARDS = phases.phase1 || [];
          PHASE2_CARDS = phases.phase2 || [];
          PHASE3_CARDS = phases.phase3 || [];
        } else console.error("[init] phases.json failed", results[1].reason);
        if (results[2].status === "fulfilled") window._kitsData = results[2].value;
        else console.error("[init] kits.json failed", results[2].reason);
        _bootAfterSpecies();
      });
  }

  function _bootAfterSpecies() {
    var params = new URLSearchParams(window.location.search);
    var isEdit = params.has("edit");
    if (isEdit) {
      sessionStorage.removeItem(CREATION_KEY);
    } else if (params.has("new")) {
      sessionStorage.removeItem(CREATION_KEY);
    } else {
      loadSavedState();
    }
    loadEditCharacter(function () {
      initCreator();
      if (isEdit && state.species) {
        showScreen("backstory");
        updateStepTrack(8);
        initBackstoryScreen();
        return;
      }
      var dbg = new URLSearchParams(window.location.search).get("debug");
      if (dbg === "stats") {
        state.species = "human";
        state.phase1 = "soldier";
        state.phase2 = "enforcer";
        state.phase3 = "exile";
        initStatsScreen();
      }
    });
  }

  function initCreator() {

    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', function () {
        var current = THEMES.find(function (t) {
          return document.documentElement.classList.contains(t);
        }) || DEFAULT_THEME;
        applyTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
      });
    }

    buildCarousel();
    buildPhaseCarousel(PHASE1_CARDS, 'ph-grid-phase1', selectPhase1, buildPhase3CardFlat);
    buildPhaseCarousel(PHASE2_CARDS, 'ph-grid-phase2', selectPhase2, buildPhase3CardFlat);
    buildPhaseCarousel(PHASE3_CARDS, 'ph-grid-phase3', selectPhase3, buildPhase3CardFlat);


    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      var speciesScreen = document.getElementById('screen-species');
      if (speciesScreen && !speciesScreen.classList.contains('hidden')) {
        e.preventDefault();
        phaseCarouselNav('ph-grid-species', [], e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      var phaseScreens = [
        { id: 'screen-phase1', key: 'ph-grid-phase1', cards: PHASE1_CARDS },
        { id: 'screen-phase2', key: 'ph-grid-phase2', cards: PHASE2_CARDS },
        { id: 'screen-phase3', key: 'ph-grid-phase3', cards: PHASE3_CARDS }
      ];
      for (var i = 0; i < phaseScreens.length; i++) {
        var ps = phaseScreens[i];
        var el = document.getElementById(ps.id);
        if (el && !el.classList.contains('hidden')) {
          e.preventDefault();
          phaseCarouselNav(ps.key, ps.cards, e.key === 'ArrowLeft' ? -1 : 1);
          return;
        }
      }
      var statsEl = document.getElementById('screen-stats');
      if (statsEl && !statsEl.classList.contains('hidden') && _selectedCell && _selectedCell.type === 'disc') {
        e.preventDefault();
        navDiscByOffset(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
            var kitsEl = document.getElementById('screen-kits');
      if (kitsEl && !kitsEl.classList.contains('hidden')) {
        e.preventDefault();
        phaseCarouselNav('ph-grid-vocations', KITS_DATA, e.key === 'ArrowLeft' ? -1 : 1);
                return;
      }
            var destinyEl = document.getElementById('screen-destiny');
      if (destinyEl && !destinyEl.classList.contains('hidden')) {
        e.preventDefault();
        var personalSection = document.getElementById('destiny-personal-section');
        if (personalSection && !personalSection.classList.contains('hidden') && phaseCarouselStates['ph-grid-personal-destiny']) {
          phaseCarouselNav('ph-grid-personal-destiny', PERSONAL_DESTINY_CARDS, e.key === 'ArrowLeft' ? -1 : 1);
        } else if (phaseCarouselStates['ph-grid-destiny-pool']) {
          phaseCarouselNav('ph-grid-destiny-pool', DESTINY_POOL_CARDS, e.key === 'ArrowLeft' ? -1 : 1);
        }
        return;
      }
    });

    document.querySelectorAll('.ph-header-arrow').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stateKey = btn.dataset.carousel;
        if (!phaseCarouselStates[stateKey]) return;
        var dir = btn.classList.contains('ph-header-arrow-prev') ? -1 : 1;
        phaseCarouselNav(stateKey, [], dir);
        });
    });

    var sumSaveBtn = document.getElementById('btn-sum-save');
    if (sumSaveBtn) {
      sumSaveBtn.addEventListener('click', function () { saveCharacterToDB(); });
    }

    var sumClose = document.getElementById('btn-sum-close');
    if (sumClose) {
      sumClose.addEventListener('click', function () {
        document.getElementById('cc-summary-overlay').classList.add('hidden');
      });
    }


    if (state.species) {
      var sp = SPECIES.find(function (s) { return s.id === state.species; });
      if (sp) {
        characterSheet.species     = sp.name;
        characterSheet.arenas      = Object.assign({}, ARENA_BASELINE, sp.arenas);
        if (state.favoredDiscipline) {
          var restoredLabel = state.favoredDiscipline;
          sp.favoredDiscipline.choices.forEach(function (ch) {
            if (ch.id === state.favoredDiscipline) restoredLabel = ch.label;
          });
          characterSheet.disciplines = ['Favored: ' + restoredLabel];
          characterSheet.favoredDiscipline = state.favoredDiscipline;
        } else {
          characterSheet.disciplines = buildFavoredList(sp);
        }
        characterSheet.abilities   = [sp.biologicalTruth.name];
        if (sp.speciesTrait) characterSheet.abilities.push(sp.speciesTrait.name);

        if (state.arenaAdj) {
          var baseArenas = characterSheet.arenas;
          ['physique','reflex','grit','wits','presence'].forEach(function(k) {
            var baseIdx = DIE_STEPS.indexOf(baseArenas[k] || 'D6');
            var adj = state.arenaAdj[k] || 0;
            var idx = Math.max(0, Math.min(DIE_STEPS.length - 1, baseIdx + adj));
            characterSheet.arenas[k] = DIE_STEPS[idx];
          });
        }

        if (state.discValues) {
          characterSheet.disciplines.forEach(function(d) {
            if (state.discValues[d.id]) d.die = state.discValues[d.id];
          });
        }

        var idx = SPECIES.indexOf(sp);
        if (idx >= 0 && phaseCarouselStates["ph-grid-species"]) {
          phaseCarouselStates["ph-grid-species"].current = idx;
          phaseCarouselUpdate("ph-grid-species", SPECIES);
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

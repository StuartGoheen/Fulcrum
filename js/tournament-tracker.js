/* Adv3 Tournament Tracker
 * Scene-attached UI for the Cloud City Sabacc tournament (Adv3).
 * Persists state via the existing campaign_state K/V table (single nested
 * key: `adv3_tournament`) and broadcasts public chip/status data to players
 * through the existing state:update / state:sync socket relay.
 *
 * Scope (Phase 1):
 *   adv3-p1-s4 -> Tournament Roster (entry-path assignment)
 *   adv3-p1-s5 -> Tournament Roster (review-mode + Mandelbrot briefing checkbox)
 *   adv3-p2-s1 -> Day 1 Standings (12 tables x 5 seats = 60-seat chart, beats,
 *                 cheat-catch consequences, tournament log)
 *
 * Persistence shape (single key: `adv3_tournament`):
 * {
 *   roster: { [characterId]: 'competitor'|'security'|'spectator'|'dirty_money'|'none' },
 *   spectatorChecks: { [characterId]: 'pending'|'pass'|'fail' },
 *   switchFork: 'unoffered'|'considering'|'committed'|'declined',
 *   mandelbrotBriefingAttentive: bool,
 *   mandelbrotRapportTier: number,
 *   crewCredits: number,
 *   seating: { [tableIdx 1..12]: [seat0..seat4] }
 *     each seat = { kind:'pc'|'npc'|'generic'|'empty', id?, name?, chips, status, note }
 *   day1: {
 *     beats: { reading_floor, catch_cheater, day1_cards, back_bar, day1_close },
 *     cheatCatch: 'none'|'marker'|'accusation',
 *     log: [{ ts, text }],
 *     fieldRemaining: number   // derived display only; canonical source = seating
 *   }
 * }
 *
 * Player-facing state (filtered server-side; see server/sockets/handlers.js):
 *   - seating.kind, seating.name (for named seats), seating.chips, seating.status
 *   - everything else stripped.
 */
(function () {
  'use strict';

  var STATE_KEY = 'adv3_tournament';
  var SCENE_ROSTER = 'adv3-p1-s4';
  var SCENE_EVE = 'adv3-p1-s5';
  var SCENE_DAY1 = 'adv3-p2-s1';
  var SCENE_DAY2 = 'adv3-p2-s2';
  var TOURNAMENT_SCENES = [SCENE_ROSTER, SCENE_EVE, SCENE_DAY1, SCENE_DAY2];

  var BUY_IN = 10000;
  var BUY_BACK = 2000;
  var TABLES = 12;
  var SEATS_PER_TABLE = 5;
  var TOTAL_SEATS = TABLES * SEATS_PER_TABLE; // 60
  var DAY2_TABLES = 4;
  var DAY2_SEATS_PER_TABLE = 6;
  var DAY2_TOTAL_SEATS = DAY2_TABLES * DAY2_SEATS_PER_TABLE; // 24

  var NAMED_NPCS = [
    { id: 'arandis', name: 'Arandis', flavor: 'The mark' },
    { id: 'fioro', name: 'Lady Fioro', flavor: 'Hapan, ruthless' },
    { id: 'draver', name: 'Silas Draver', flavor: 'Acts drunk; isn\'t' },
    { id: 'creeska', name: 'Creeska', flavor: 'Rodian — cheating' },
    { id: 'moro', name: 'Koroma Moro', flavor: 'Switch\'s man' }
  ];

  var STATUSES = ['Healthy', 'Short Stack', 'On the Rail', 'Eliminated', 'Bought Back In'];
  var STATUS_COLORS = {
    'Healthy': '#22c55e',
    'Short Stack': '#eab308',
    'On the Rail': '#f97316',
    'Eliminated': '#71717a',
    'Bought Back In': '#a855f7'
  };

  var ENTRY_PATHS = [
    { value: 'none', label: 'Not Entering' },
    { value: 'competitor', label: 'Competitor (10,000 cr)' },
    { value: 'security', label: 'Security (Mandelbrot, 500 cr/day)' },
    { value: 'spectator', label: 'Spectator (Charm vs Resist 3)' },
    { value: 'dirty_money', label: 'Dirty Money (Switch fork)' }
  ];

  var BEATS = [
    { key: 'reading_floor', label: 'Reading the Floor' },
    { key: 'catch_cheater', label: 'Catch the Cheater (Creeska)' },
    { key: 'day1_cards', label: 'Day 1 Cards (6 hands)' },
    { key: 'back_bar', label: 'Back Bar (Switch reminder)' },
    { key: 'day1_close', label: 'Day 1 Closes' }
  ];

  var DAY2_BEATS = [
    { key: 'day2_open', label: 'Day 2 Opens' },
    { key: 'banshee_message', label: 'Message from the Banshee' },
    { key: 'switch_reminder', label: 'Switch Day 2 Reminder' },
    { key: 'day2_cards', label: 'Day 2 Card Play' },
    { key: 'day2_close', label: 'Day 2 Closes' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function defaultState() {
    return {
      roster: {},
      spectatorChecks: {},
      switchFork: 'unoffered',
      mandelbrotBriefingAttentive: false,
      mandelbrotRapportTier: 0,
      crewCredits: 0,
      seating: {},
      day1: {
        beats: { reading_floor: false, catch_cheater: false, day1_cards: false, back_bar: false, day1_close: false },
        cheatCatch: 'none',
        log: [],
        recapNotes: ''
      },
      day2: {
        beats: { day2_open: false, banshee_message: false, switch_reminder: false, day2_cards: false, day2_close: false },
        seating: {},
        winnerSeatId: null,
        crewPayout: 0,
        switchCommit: 'pending',
        log: []
      }
    };
  }

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  function readState(campaignState) {
    var raw = (campaignState && campaignState[STATE_KEY]) || null;
    var s = raw ? clone(raw) : defaultState();
    // Backfill missing fields from defaults (forward-compat).
    var d = defaultState();
    Object.keys(d).forEach(function (k) { if (s[k] == null) s[k] = d[k]; });
    if (!s.day1.beats) s.day1.beats = d.day1.beats;
    if (!s.day1.log) s.day1.log = [];
    if (typeof s.day1.recapNotes !== 'string') s.day1.recapNotes = '';
    if (!s.day2) s.day2 = d.day2;
    if (!s.day2.beats) s.day2.beats = d.day2.beats;
    if (!s.day2.seating) s.day2.seating = {};
    if (!s.day2.log) s.day2.log = [];
    if (s.day2.winnerSeatId === undefined) s.day2.winnerSeatId = null;
    if (s.day2.crewPayout == null) s.day2.crewPayout = 0;
    if (!s.day2.switchCommit) s.day2.switchCommit = 'pending';
    return s;
  }

  // ── Seating seed ─────────────────────────────────────────────────────────
  // Auto-seed when seating is empty: NPCs at T1S1..T5S1, Competitor PCs fill
  // T1S2..T1S5, T2S2..T2S5, ... wherever available; the rest are generics.
  function seedSeating(state, partyCache) {
    var seating = {};
    for (var t = 1; t <= TABLES; t++) {
      seating[t] = [];
      for (var s = 0; s < SEATS_PER_TABLE; s++) {
        seating[t].push({ kind: 'empty', chips: 0, status: 'Healthy', note: '' });
      }
    }
    // NPCs: T1S1..T5S1
    NAMED_NPCS.forEach(function (npc, i) {
      var t = i + 1;
      seating[t][0] = { kind: 'npc', id: npc.id, name: npc.name, chips: 5000, status: 'Healthy', note: npc.flavor };
    });
    // Competitor PCs
    var competitors = (partyCache || []).filter(function (p) {
      return state.roster && state.roster[p.id] === 'competitor';
    });
    var seatedPCs = 0;
    outer:
    for (var t2 = 1; t2 <= TABLES; t2++) {
      for (var s2 = 0; s2 < SEATS_PER_TABLE; s2++) {
        if (seating[t2][s2].kind !== 'empty') continue;
        if (seatedPCs >= competitors.length) break outer;
        var pc = competitors[seatedPCs++];
        seating[t2][s2] = { kind: 'pc', id: 'pc_' + pc.id, name: pc.name, chips: 5000, status: 'Healthy', note: '' };
      }
    }
    // Generics fill the rest
    var gNum = 1;
    for (var t3 = 1; t3 <= TABLES; t3++) {
      for (var s3 = 0; s3 < SEATS_PER_TABLE; s3++) {
        if (seating[t3][s3].kind !== 'empty') continue;
        var label = 'G' + (gNum < 10 ? '0' + gNum : '' + gNum);
        seating[t3][s3] = { kind: 'generic', id: label, name: label, chips: 0, status: 'Healthy', note: '' };
        gNum++;
      }
    }
    return seating;
  }

  function fieldRemaining(state) {
    var seating = state.seating || {};
    var alive = 0;
    for (var t = 1; t <= TABLES; t++) {
      var row = seating[t] || [];
      for (var s = 0; s < SEATS_PER_TABLE; s++) {
        var seat = row[s];
        if (seat && seat.status !== 'Eliminated') alive++;
      }
    }
    return alive;
  }

  // ── Persistence: push state via socket ───────────────────────────────────
  function save(state, socket) {
    if (!socket) { console.warn('[TournamentTracker] no socket; cannot persist'); return; }
    socket.emit('state:update', { key: STATE_KEY, value: state });
  }

  function pushLog(state, text) {
    state.day1 = state.day1 || { log: [] };
    state.day1.log = state.day1.log || [];
    state.day1.log.unshift({ ts: new Date().toISOString(), text: text });
    if (state.day1.log.length > 50) state.day1.log.length = 50;
  }

  function pushLog2(state, text) {
    state.day2 = state.day2 || { log: [] };
    state.day2.log = state.day2.log || [];
    state.day2.log.unshift({ ts: new Date().toISOString(), text: text });
    if (state.day2.log.length > 50) state.day2.log.length = 50;
  }

  // ── Day 2 seating seed ──────────────────────────────────────────────────
  // Pull every non-eliminated PC and named NPC from Day 1 seating into the
  // Day-2 final-table grid (4 tables x 6 seats = 24). Fill the rest with
  // generic placeholder seats (G01..) so the GM can name late-bracket entrants.
  function seedDay2Seating(state) {
    var grid = {};
    for (var t = 1; t <= DAY2_TABLES; t++) {
      grid[t] = [];
      for (var s = 0; s < DAY2_SEATS_PER_TABLE; s++) {
        grid[t].push({ kind: 'empty', chips: 0, status: 'Healthy', note: '' });
      }
    }
    var carry = [];
    var d1 = (state && state.seating) || {};
    for (var dt = 1; dt <= TABLES; dt++) {
      var row = d1[dt] || [];
      for (var ds = 0; ds < SEATS_PER_TABLE; ds++) {
        var seat = row[ds];
        if (!seat) continue;
        if ((seat.kind === 'pc' || seat.kind === 'npc') && seat.status !== 'Eliminated') {
          carry.push({
            kind: seat.kind,
            id: seat.id,
            name: seat.name,
            chips: seat.chips || 5000,
            status: 'Healthy',
            note: seat.note || ''
          });
        }
      }
    }
    var i = 0;
    outer:
    for (var t2 = 1; t2 <= DAY2_TABLES; t2++) {
      for (var s2 = 0; s2 < DAY2_SEATS_PER_TABLE; s2++) {
        if (i >= carry.length) break outer;
        grid[t2][s2] = carry[i++];
      }
    }
    var gNum = 1;
    for (var t3 = 1; t3 <= DAY2_TABLES; t3++) {
      for (var s3 = 0; s3 < DAY2_SEATS_PER_TABLE; s3++) {
        if (grid[t3][s3].kind !== 'empty') continue;
        var label = 'G' + (gNum < 10 ? '0' + gNum : '' + gNum);
        grid[t3][s3] = { kind: 'generic', id: label, name: label, chips: 0, status: 'Healthy', note: '' };
        gNum++;
      }
    }
    return grid;
  }

  function fieldRemainingDay2(state) {
    var seating = (state && state.day2 && state.day2.seating) || {};
    var alive = 0;
    for (var t = 1; t <= DAY2_TABLES; t++) {
      var row = seating[t] || [];
      for (var s = 0; s < DAY2_SEATS_PER_TABLE; s++) {
        var seat = row[s];
        if (seat && seat.kind !== 'empty' && seat.status !== 'Eliminated') alive++;
      }
    }
    return alive;
  }

  function _seatKey(t, s) { return t + ':' + s; }

  // ────────────────────────────────────────────────────────────────────────
  //  PANEL: DAY 2 STANDINGS  (adv3-p2-s2)
  // ────────────────────────────────────────────────────────────────────────
  function buildDay2Html(scene, partyCache, campaignState) {
    var state = readState(campaignState);
    if (!state.day2.seating || !state.day2.seating[1]) {
      state.day2.seating = seedDay2Seating(state);
    }
    var alive = fieldRemainingDay2(state);
    var html = '<div class="tt-panel" data-mode="day2">';

    html += '<div class="tt-day1-header">';
    html += '<div class="tt-field-counter">Final Field: <span class="tt-field-num">' + alive + '</span> / ' + DAY2_TOTAL_SEATS + '</div>';
    html += '<div class="tt-beats">';
    DAY2_BEATS.forEach(function (b) {
      var done = !!(state.day2.beats && state.day2.beats[b.key]);
      html += '<label class="tt-beat-chk' + (done ? ' on' : '') + '"><input type="checkbox" data-beat2="' + b.key + '" ' + (done ? 'checked' : '') + ' /> ' + esc(b.label) + '</label>';
    });
    html += '</div>';
    html += '<div class="tt-day1-tools">';
    html += '<button class="tt-btn tt-btn-sm" data-act="d2-reseed">Re-seed from Day 1</button>';
    html += '<span class="tt-credits-mini">Crew: <strong>' + (state.crewCredits || 0).toLocaleString() + ' cr</strong></span>';
    html += '</div>';
    html += '</div>';

    // Switch commit + Crew Payout row
    html += '<div class="tt-day2-meta">';
    html += '<label>Switch Day 2 Commit: <select class="tt-d2-switch">';
    ['pending', 'in_principle', 'committed', 'declined'].forEach(function (k) {
      var lbl = k === 'in_principle' ? 'In Principle' : (k.charAt(0).toUpperCase() + k.slice(1));
      html += '<option value="' + k + '"' + (state.day2.switchCommit === k ? ' selected' : '') + '>' + lbl + '</option>';
    });
    html += '</select></label>';
    html += '<label>Crew Payout (championship pot share): <input type="number" class="tt-d2-payout" value="' + (state.day2.crewPayout || 0) + '" step="500" min="0" /> cr</label>';
    var winnerName = '—';
    if (state.day2.winnerSeatId) {
      // find seat by id
      Object.keys(state.day2.seating || {}).forEach(function (t) {
        (state.day2.seating[t] || []).forEach(function (seat) {
          if (seat && seat.id === state.day2.winnerSeatId) winnerName = seat.name || seat.id;
        });
      });
    }
    html += '<span class="tt-d2-winner-label">Champion: <strong>' + esc(winnerName) + '</strong></span>';
    html += '</div>';

    html += '<div class="tt-tables-grid tt-tables-grid--day2">';
    for (var t = 1; t <= DAY2_TABLES; t++) {
      html += _day2TableCardHtml(t, state.day2.seating[t] || [], state.day2.winnerSeatId);
    }
    html += '</div>';

    html += '<div class="tt-day1-footer">';
    html += '<div class="tt-log">';
    html += '<div class="tt-log-label">Day 2 Log</div>';
    if (!state.day2.log || state.day2.log.length === 0) {
      html += '<div class="tt-log-empty">No events yet.</div>';
    } else {
      state.day2.log.forEach(function (e) {
        var when = (e.ts || '').slice(11, 16);
        html += '<div class="tt-log-entry"><span class="tt-log-time">' + esc(when) + '</span> ' + esc(e.text) + '</div>';
      });
    }
    html += '</div>';
    html += '</div>';

    html += _styleBlock();
    html += '</div>';
    return html;
  }

  function _day2TableCardHtml(tIdx, seats, winnerSeatId) {
    var html = '<div class="tt-table-card" data-table="' + tIdx + '">';
    html += '<div class="tt-table-head">FT' + tIdx + '</div>';
    for (var s = 0; s < DAY2_SEATS_PER_TABLE; s++) {
      var seat = seats[s] || { kind: 'empty', name: '—', chips: 0, status: 'Healthy', note: '' };
      html += _day2SeatRowHtml(tIdx, s, seat, winnerSeatId);
    }
    html += '</div>';
    return html;
  }

  function _day2SeatRowHtml(tIdx, sIdx, seat, winnerSeatId) {
    var isWinner = !!(winnerSeatId && seat.id === winnerSeatId);
    var nameClass = seat.kind === 'pc' ? 'tt-seat-name tt-seat-name--pc'
      : seat.kind === 'npc' ? 'tt-seat-name tt-seat-name--npc'
      : 'tt-seat-name tt-seat-name--gen';
    if (isWinner) nameClass += ' tt-seat-name--winner';
    var color = STATUS_COLORS[seat.status] || '#71717a';
    var html = '<div class="tt-seat-row' + (isWinner ? ' tt-seat-row--winner' : '') + '" data-d2table="' + tIdx + '" data-d2seat="' + sIdx + '">';
    html += '<span class="' + nameClass + '" title="' + esc(seat.note || '') + '">' + (isWinner ? '👑 ' : '') + esc(seat.name || '—') + '</span>';
    if (seat.kind === 'pc' || seat.kind === 'npc') {
      html += '<span class="tt-chips">';
      html += '<button class="tt-chip-btn" data-act="d2-chip-down" data-d2table="' + tIdx + '" data-d2seat="' + sIdx + '">−</button>';
      html += '<input type="number" class="tt-chip-input" value="' + (seat.chips || 0) + '" step="500" min="0" data-d2table="' + tIdx + '" data-d2seat="' + sIdx + '" />';
      html += '<button class="tt-chip-btn" data-act="d2-chip-up" data-d2table="' + tIdx + '" data-d2seat="' + sIdx + '">+</button>';
      html += '</span>';
    } else {
      html += '<span class="tt-chips tt-chips--gen">—</span>';
    }
    html += '<button class="tt-status-pill" data-act="d2-cycle-status" data-d2table="' + tIdx + '" data-d2seat="' + sIdx + '" style="background:' + color + ';" title="Click to cycle">' + esc(seat.status.charAt(0)) + '</button>';
    if (seat.kind === 'pc' || seat.kind === 'npc') {
      html += '<button class="tt-mini-btn" data-act="d2-mark-winner" data-d2table="' + tIdx + '" data-d2seat="' + sIdx + '" title="Mark as tournament champion">' + (isWinner ? '★' : '☆') + '</button>';
    }
    html += '</div>';
    return html;
  }

  function bindDay2(panel, scene, partyCache, campaignState, socket, refresh) {
    // Persist seeded grid on first open.
    var seedCheck = readState(campaignState);
    if (!seedCheck.day2.seating || !seedCheck.day2.seating[1]) {
      seedCheck.day2.seating = seedDay2Seating(seedCheck);
      save(seedCheck, socket);
      if (campaignState && typeof campaignState === 'object') {
        campaignState[STATE_KEY] = seedCheck;
      }
    }

    panel.querySelectorAll('[data-beat2]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var s = readState(campaignState);
        s.day2.beats[chk.dataset.beat2] = chk.checked;
        if (chk.checked) {
          var lbl = chk.parentElement.textContent.trim();
          pushLog2(s, 'Beat marked complete: ' + lbl);
        }
        save(s, socket);
        if (chk.dataset.beat2 === 'day2_close' && chk.checked && socket) {
          socket.emit('tournament:save-day2-recap', { sceneId: scene.id });
        }
        refresh();
      });
    });

    panel.querySelectorAll('[data-act="d2-cycle-status"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        var t = btn.dataset.d2table, si = btn.dataset.d2seat;
        if (!s.day2.seating || !s.day2.seating[t] || !s.day2.seating[t][si]) return;
        var seat = s.day2.seating[t][si];
        var i = STATUSES.indexOf(seat.status);
        seat.status = STATUSES[(i + 1) % STATUSES.length];
        if (seat.status === 'Eliminated' && seat.kind !== 'generic') {
          pushLog2(s, esc(seat.name) + ' eliminated at FT' + t + 'S' + (parseInt(si) + 1) + '.');
        }
        save(s, socket);
        refresh();
      });
    });

    panel.querySelectorAll('[data-act="d2-chip-up"], [data-act="d2-chip-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        var t = btn.dataset.d2table, si = btn.dataset.d2seat;
        if (!s.day2.seating || !s.day2.seating[t] || !s.day2.seating[t][si]) return;
        var seat = s.day2.seating[t][si];
        var step = btn.dataset.act === 'd2-chip-up' ? 500 : -500;
        seat.chips = Math.max(0, (seat.chips || 0) + step);
        save(s, socket);
        refresh();
      });
    });
    panel.querySelectorAll('.tt-chip-input[data-d2table]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var s = readState(campaignState);
        var t = inp.dataset.d2table, si = inp.dataset.d2seat;
        if (!s.day2.seating || !s.day2.seating[t] || !s.day2.seating[t][si]) return;
        var seat = s.day2.seating[t][si];
        seat.chips = Math.max(0, parseInt(inp.value, 10) || 0);
        save(s, socket);
      });
    });

    panel.querySelectorAll('[data-act="d2-mark-winner"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        var t = btn.dataset.d2table, si = btn.dataset.d2seat;
        if (!s.day2.seating || !s.day2.seating[t] || !s.day2.seating[t][si]) return;
        var seat = s.day2.seating[t][si];
        if (!seat.id) return;
        if (s.day2.winnerSeatId === seat.id) {
          s.day2.winnerSeatId = null;
          pushLog2(s, 'Champion marker cleared (' + esc(seat.name) + ').');
        } else {
          s.day2.winnerSeatId = seat.id;
          pushLog2(s, esc(seat.name) + ' marked as tournament champion.');
        }
        save(s, socket);
        refresh();
      });
    });

    var sw = panel.querySelector('.tt-d2-switch');
    if (sw) {
      sw.addEventListener('change', function () {
        var s = readState(campaignState);
        s.day2.switchCommit = sw.value;
        pushLog2(s, 'Switch Day 2 commit: ' + sw.value + '.');
        save(s, socket);
      });
    }
    var payout = panel.querySelector('.tt-d2-payout');
    if (payout) {
      payout.addEventListener('change', function () {
        var s = readState(campaignState);
        s.day2.crewPayout = Math.max(0, parseInt(payout.value, 10) || 0);
        save(s, socket);
      });
    }

    var reseed = panel.querySelector('[data-act="d2-reseed"]');
    if (reseed) {
      reseed.addEventListener('click', function () {
        if (!window.confirm('Re-seed the Day 2 final tables from Day 1 survivors? This resets Day 2 chips and statuses.')) return;
        var s = readState(campaignState);
        s.day2.seating = seedDay2Seating(s);
        s.day2.winnerSeatId = null;
        pushLog2(s, 'Day 2 final tables re-seeded from Day 1 survivors.');
        save(s, socket);
        refresh();
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  //  PANEL: ROSTER  (adv3-p1-s4 + adv3-p1-s5)
  // ────────────────────────────────────────────────────────────────────────
  function buildRosterHtml(scene, partyCache, campaignState) {
    var state = readState(campaignState);
    var reviewMode = scene.id === SCENE_EVE;
    var party = (partyCache || []).slice();

    var html = '<div class="tt-panel" data-mode="' + (reviewMode ? 'eve' : 'roster') + '">';
    html += '<div class="tt-header">';
    html += '<div class="tt-title">' + (reviewMode ? 'Tournament Eve Review' : 'Entry Paths') + '</div>';
    html += '<div class="tt-subtitle">' + (reviewMode
      ? 'Lock-in review — change only if something broke. Mandelbrot briefing affects Day 1 rapport.'
      : 'Assign each PC an entry path. Multi-path party split is a feature, not a bug.') + '</div>';
    html += '</div>';

    // Crew credits row
    html += '<div class="tt-credits-row">';
    html += '<label>Crew Credits: </label>';
    html += '<input type="number" class="tt-credits-input" value="' + (state.crewCredits || 0) + '" step="100" min="0" /> cr';
    html += '<span class="tt-credits-hint"> (10,000 per Competitor seat; 2,000 per buy-back-in)</span>';
    html += '</div>';

    // Switch fork status
    html += '<div class="tt-fork-row">';
    html += '<label>Switch (Dirty Money) Fork: </label>';
    html += '<select class="tt-fork-select">';
    ['unoffered', 'considering', 'committed', 'declined'].forEach(function (k) {
      var lbl = k.charAt(0).toUpperCase() + k.slice(1);
      html += '<option value="' + k + '"' + (state.switchFork === k ? ' selected' : '') + '>' + lbl + '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Per-PC roster table
    html += '<table class="tt-roster-table">';
    html += '<thead><tr><th>PC</th><th>Entry Path</th><th>Notes</th></tr></thead><tbody>';
    if (party.length === 0) {
      html += '<tr><td colspan="3" class="tt-empty">No PCs in the party cache. Players must connect first.</td></tr>';
    } else {
      party.forEach(function (pc) {
        var path = (state.roster && state.roster[pc.id]) || 'none';
        html += '<tr data-pc-id="' + esc(pc.id) + '">';
        html += '<td><strong>' + esc(pc.name) + '</strong></td>';
        html += '<td><select class="tt-path-select" data-pc-id="' + esc(pc.id) + '">';
        ENTRY_PATHS.forEach(function (p) {
          html += '<option value="' + p.value + '"' + (path === p.value ? ' selected' : '') + '>' + esc(p.label) + '</option>';
        });
        html += '</select></td>';
        html += '<td class="tt-path-flags" data-pc-id="' + esc(pc.id) + '">' + _flagBadgesHtml(pc, path, state) + '</td>';
        html += '</tr>';
      });
    }
    html += '</tbody></table>';

    // Summary
    var summary = _rosterSummary(state, party);
    html += '<div class="tt-summary">';
    html += '<span>Competitors: <strong>' + summary.competitor + '</strong></span>';
    html += '<span>Security: <strong>' + summary.security + '</strong></span>';
    html += '<span>Spectators: <strong>' + summary.spectator + '</strong></span>';
    html += '<span>Dirty Money: <strong>' + summary.dirty_money + '</strong></span>';
    html += '<span>Buy-In Total: <strong>' + (summary.competitor * BUY_IN).toLocaleString() + ' cr</strong></span>';
    html += '</div>';

    // Eve-only: Mandelbrot briefing checkbox
    if (reviewMode) {
      html += '<div class="tt-eve-row">';
      html += '<label><input type="checkbox" class="tt-mandelbrot-attentive" ' + (state.mandelbrotBriefingAttentive ? 'checked' : '') + ' /> ';
      html += 'Mandelbrot briefing run attentively (sets Mandelbrot Rapport Tier 2; otherwise Tier 0)</label>';
      html += '<div class="tt-eve-rapport">Current Rapport Tier: <strong>' + (state.mandelbrotRapportTier || 0) + '</strong></div>';
      html += '</div>';
    }

    // Action footer
    html += '<div class="tt-actions">';
    if (!reviewMode) {
      html += '<button class="tt-btn tt-btn-primary" data-act="charge-buyins">Charge Buy-Ins (' + (summary.competitor * BUY_IN).toLocaleString() + ' cr)</button>';
    }
    html += '<button class="tt-btn" data-act="reset-seating">Re-seed Day 1 Tables</button>';
    html += '</div>';

    html += _styleBlock();
    html += '</div>';
    return html;
  }

  function _rosterSummary(state, party) {
    var s = { none: 0, competitor: 0, security: 0, spectator: 0, dirty_money: 0 };
    (party || []).forEach(function (pc) {
      var p = (state.roster && state.roster[pc.id]) || 'none';
      if (s[p] != null) s[p]++;
    });
    return s;
  }

  function _flagBadgesHtml(pc, path, state) {
    var html = '';
    if (path === 'competitor') {
      html += '<span class="tt-badge tt-badge--red" title="Comm-jamming pin during play">PIN</span>';
      html += '<span class="tt-badge tt-badge--gold" title="10,000 cr buy-in">10k</span>';
    } else if (path === 'security') {
      html += '<span class="tt-badge tt-badge--blue" title="Mandelbrot weapons permit">PERMIT</span>';
      html += '<span class="tt-badge tt-badge--green" title="Free intel relay">RELAY</span>';
    } else if (path === 'spectator') {
      var sc = (state.spectatorChecks && state.spectatorChecks[pc.id]) || 'pending';
      var color = sc === 'pass' ? 'tt-badge--green' : sc === 'fail' ? 'tt-badge--red' : 'tt-badge--gold';
      html += '<span class="tt-badge ' + color + '" title="Charm/Persuasion vs Resist 3">VASS: ' + sc.toUpperCase() + '</span>';
      html += '<button class="tt-mini-btn" data-act="cycle-spectator" data-pc-id="' + esc(pc.id) + '">cycle</button>';
    } else if (path === 'dirty_money') {
      html += '<span class="tt-badge tt-badge--purple" title="Switch fork in principle">FORK</span>';
    } else {
      html += '<span class="tt-badge tt-badge--dim">—</span>';
    }
    return html;
  }

  // ────────────────────────────────────────────────────────────────────────
  //  PANEL: DAY 1 STANDINGS  (adv3-p2-s1)
  // ────────────────────────────────────────────────────────────────────────
  function buildDay1Html(scene, partyCache, campaignState) {
    var state = readState(campaignState);
    if (!state.seating || !state.seating[1]) {
      state.seating = seedSeating(state, partyCache);
    }
    var alive = fieldRemaining(state);
    var html = '<div class="tt-panel" data-mode="day1">';

    // Header strip
    html += '<div class="tt-day1-header">';
    html += '<div class="tt-field-counter">Field: <span class="tt-field-num">' + alive + '</span> / ' + TOTAL_SEATS + '</div>';
    html += '<div class="tt-beats">';
    BEATS.forEach(function (b) {
      var done = !!(state.day1.beats && state.day1.beats[b.key]);
      html += '<label class="tt-beat-chk' + (done ? ' on' : '') + '"><input type="checkbox" data-beat="' + b.key + '" ' + (done ? 'checked' : '') + ' /> ' + esc(b.label) + '</label>';
    });
    html += '</div>';
    html += '<div class="tt-day1-tools">';
    html += '<button class="tt-btn tt-btn-sm" data-act="bulk-eliminate">−5 Generics</button>';
    html += '<button class="tt-btn tt-btn-sm" data-act="reseat">Re-seed Tables</button>';
    html += '<span class="tt-credits-mini">Crew: <strong>' + (state.crewCredits || 0).toLocaleString() + ' cr</strong></span>';
    html += '</div>';
    html += '</div>';

    // Seating grid: 12 tables, render in a 4-column grid (3 rows of 4)
    html += '<div class="tt-tables-grid">';
    for (var t = 1; t <= TABLES; t++) {
      html += _tableCardHtml(t, state.seating[t] || []);
    }
    html += '</div>';

    // Cheat-Catch consequence + log
    html += '<div class="tt-day1-footer">';
    html += '<div class="tt-cheat-row">';
    html += '<div class="tt-cheat-label">Cheat-Catch (Creeska): <strong>' + (state.day1.cheatCatch || 'none').toUpperCase() + '</strong></div>';
    html += '<button class="tt-btn tt-btn-good" data-act="cheat-marker">Marker Spotted (clean)</button>';
    html += '<button class="tt-btn tt-btn-bad" data-act="cheat-accusation">Public Accusation (no evidence)</button>';
    html += '</div>';
    html += '<div class="tt-recap-row">';
    html += '<div class="tt-recap-label">Day 1 Recap (Journal Entry)</div>';
    html += '<div class="tt-recap-hint">Notes are preserved across regenerations and appended to the auto-generated body.</div>';
    html += '<textarea class="tt-recap-notes" rows="3" placeholder="GM narrative notes — color, callouts, side moments…">' + esc(state.day1.recapNotes || '') + '</textarea>';
    html += '<div class="tt-recap-actions">';
    html += '<button class="tt-btn tt-btn-sm" data-act="regenerate-recap">Regenerate Recap</button>';
    html += '<span class="tt-recap-status" data-recap-status></span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="tt-log">';
    html += '<div class="tt-log-label">Tournament Log</div>';
    if (!state.day1.log || state.day1.log.length === 0) {
      html += '<div class="tt-log-empty">No events yet.</div>';
    } else {
      state.day1.log.forEach(function (e) {
        var when = (e.ts || '').slice(11, 16);
        html += '<div class="tt-log-entry"><span class="tt-log-time">' + esc(when) + '</span> ' + esc(e.text) + '</div>';
      });
    }
    html += '</div>';
    html += '</div>';

    html += _styleBlock();
    html += '</div>';
    return html;
  }

  function _tableCardHtml(tIdx, seats) {
    var html = '<div class="tt-table-card" data-table="' + tIdx + '">';
    html += '<div class="tt-table-head">T' + tIdx + '</div>';
    for (var s = 0; s < SEATS_PER_TABLE; s++) {
      var seat = seats[s] || { kind: 'empty', name: '—', chips: 0, status: 'Healthy', note: '' };
      html += _seatRowHtml(tIdx, s, seat);
    }
    html += '</div>';
    return html;
  }

  function _seatRowHtml(tIdx, sIdx, seat) {
    var nameClass = seat.kind === 'pc' ? 'tt-seat-name tt-seat-name--pc'
      : seat.kind === 'npc' ? 'tt-seat-name tt-seat-name--npc'
      : 'tt-seat-name tt-seat-name--gen';
    var color = STATUS_COLORS[seat.status] || '#71717a';
    var html = '<div class="tt-seat-row" data-table="' + tIdx + '" data-seat="' + sIdx + '">';
    html += '<span class="' + nameClass + '" title="' + esc(seat.note || '') + '">' + esc(seat.name || '—') + '</span>';
    if (seat.kind === 'pc' || seat.kind === 'npc') {
      html += '<span class="tt-chips">';
      html += '<button class="tt-chip-btn" data-act="chip-down" data-table="' + tIdx + '" data-seat="' + sIdx + '">−</button>';
      html += '<input type="number" class="tt-chip-input" value="' + (seat.chips || 0) + '" step="500" min="0" data-table="' + tIdx + '" data-seat="' + sIdx + '" />';
      html += '<button class="tt-chip-btn" data-act="chip-up" data-table="' + tIdx + '" data-seat="' + sIdx + '">+</button>';
      html += '</span>';
    } else {
      html += '<span class="tt-chips tt-chips--gen">—</span>';
    }
    html += '<button class="tt-status-pill" data-act="cycle-status" data-table="' + tIdx + '" data-seat="' + sIdx + '" style="background:' + color + ';" title="Click to cycle">' + esc(seat.status.charAt(0)) + '</button>';
    if (seat.status === 'Eliminated' && (seat.kind === 'pc' || seat.kind === 'npc')) {
      html += '<button class="tt-buyback-btn" data-act="buyback" data-table="' + tIdx + '" data-seat="' + sIdx + '" title="Buy back in (2,000 cr)">↻</button>';
    }
    html += '</div>';
    return html;
  }

  // ────────────────────────────────────────────────────────────────────────
  //  EVENT BINDING
  // ────────────────────────────────────────────────────────────────────────
  function bindRoster(panel, scene, partyCache, campaignState, socket, refresh) {
    var reviewMode = scene.id === SCENE_EVE;

    panel.querySelectorAll('.tt-path-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var s = readState(campaignState);
        s.roster = s.roster || {};
        s.roster[sel.dataset.pcId] = sel.value;
        save(s, socket);
        refresh();
      });
    });
    panel.querySelectorAll('[data-act="cycle-spectator"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        s.spectatorChecks = s.spectatorChecks || {};
        var cur = s.spectatorChecks[btn.dataset.pcId] || 'pending';
        var next = cur === 'pending' ? 'pass' : cur === 'pass' ? 'fail' : 'pending';
        s.spectatorChecks[btn.dataset.pcId] = next;
        save(s, socket);
        refresh();
      });
    });
    var creditsInput = panel.querySelector('.tt-credits-input');
    if (creditsInput) {
      creditsInput.addEventListener('change', function () {
        var s = readState(campaignState);
        s.crewCredits = Math.max(0, parseInt(creditsInput.value, 10) || 0);
        save(s, socket);
      });
    }
    var fork = panel.querySelector('.tt-fork-select');
    if (fork) {
      fork.addEventListener('change', function () {
        var s = readState(campaignState);
        s.switchFork = fork.value;
        save(s, socket);
      });
    }
    var attentive = panel.querySelector('.tt-mandelbrot-attentive');
    if (attentive) {
      attentive.addEventListener('change', function () {
        var s = readState(campaignState);
        s.mandelbrotBriefingAttentive = attentive.checked;
        s.mandelbrotRapportTier = attentive.checked ? 2 : 0;
        save(s, socket);
        refresh();
      });
    }
    var charge = panel.querySelector('[data-act="charge-buyins"]');
    if (charge) {
      charge.addEventListener('click', function () {
        var s = readState(campaignState);
        var summary = _rosterSummary(s, partyCache);
        var cost = summary.competitor * BUY_IN;
        if (cost === 0) return;
        if (s.crewCredits < cost) {
          if (!window.confirm('Crew has only ' + s.crewCredits.toLocaleString() + ' cr but ' + cost.toLocaleString() + ' is needed. Charge anyway (negative balance)?')) return;
        }
        s.crewCredits = (s.crewCredits || 0) - cost;
        pushLog(s, 'Charged ' + cost.toLocaleString() + ' cr in tournament buy-ins (' + summary.competitor + ' seat' + (summary.competitor === 1 ? '' : 's') + ').');
        save(s, socket);
        refresh();
      });
    }
    var reseat = panel.querySelector('[data-act="reset-seating"]');
    if (reseat) {
      reseat.addEventListener('click', function () {
        if (!window.confirm('Re-seed the Day 1 seating chart? This will reset all chip stacks and statuses.')) return;
        var s = readState(campaignState);
        s.seating = seedSeating(s, partyCache);
        s.day1 = defaultState().day1;
        pushLog(s, 'Day 1 seating chart re-seeded.');
        save(s, socket);
        refresh();
      });
    }
  }

  function bindDay1(panel, scene, partyCache, campaignState, socket, refresh) {
    // Persist auto-seeded seating on first open so handlers operate on real state.
    var seedCheck = readState(campaignState);
    if (!seedCheck.seating || !seedCheck.seating[1]) {
      seedCheck.seating = seedSeating(seedCheck, partyCache);
      save(seedCheck, socket);
      // Mirror into the in-memory campaignState so handlers below see it immediately,
      // before the next state:sync round-trip lands.
      if (campaignState && typeof campaignState === 'object') {
        campaignState[STATE_KEY] = seedCheck;
      }
    }

    panel.querySelectorAll('[data-beat]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var s = readState(campaignState);
        s.day1.beats[chk.dataset.beat] = chk.checked;
        if (chk.checked) {
          var lbl = chk.parentElement.textContent.trim();
          pushLog(s, 'Beat marked complete: ' + lbl);
        }
        save(s, socket);
        if (chk.dataset.beat === 'day1_close' && chk.checked && socket) {
          socket.emit('tournament:save-day1-recap', { sceneId: scene.id });
        }
        refresh();
      });
    });

    panel.querySelectorAll('[data-act="cycle-status"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        var t = btn.dataset.table, si = btn.dataset.seat;
        if (!s.seating || !s.seating[t] || !s.seating[t][si]) return;
        var seat = s.seating[t][si];
        var i = STATUSES.indexOf(seat.status);
        seat.status = STATUSES[(i + 1) % STATUSES.length];
        if (seat.status === 'Eliminated' && seat.kind !== 'generic') {
          pushLog(s, esc(seat.name) + ' eliminated at T' + t + 'S' + (parseInt(si) + 1) + '.');
        }
        save(s, socket);
        refresh();
      });
    });

    panel.querySelectorAll('[data-act="chip-up"], [data-act="chip-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        var t = btn.dataset.table, si = btn.dataset.seat;
        if (!s.seating || !s.seating[t] || !s.seating[t][si]) return;
        var seat = s.seating[t][si];
        var step = btn.dataset.act === 'chip-up' ? 500 : -500;
        seat.chips = Math.max(0, (seat.chips || 0) + step);
        save(s, socket);
        refresh();
      });
    });
    panel.querySelectorAll('.tt-chip-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var s = readState(campaignState);
        var t = inp.dataset.table, si = inp.dataset.seat;
        if (!s.seating || !s.seating[t] || !s.seating[t][si]) return;
        var seat = s.seating[t][si];
        seat.chips = Math.max(0, parseInt(inp.value, 10) || 0);
        save(s, socket);
      });
    });

    panel.querySelectorAll('[data-act="buyback"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = readState(campaignState);
        var t = btn.dataset.table, si = btn.dataset.seat;
        if (!s.seating || !s.seating[t] || !s.seating[t][si]) return;
        var seat = s.seating[t][si];
        if (s.crewCredits < BUY_BACK) {
          if (!window.confirm('Crew has only ' + s.crewCredits.toLocaleString() + ' cr. Charge buy-back anyway (negative balance)?')) return;
        }
        s.crewCredits = (s.crewCredits || 0) - BUY_BACK;
        seat.status = 'Bought Back In';
        seat.chips = Math.max(seat.chips || 0, 3000);
        pushLog(s, esc(seat.name) + ' bought back in (−' + BUY_BACK.toLocaleString() + ' cr) at T' + t + 'S' + (parseInt(si) + 1) + '.');
        save(s, socket);
        refresh();
      });
    });

    var bulk = panel.querySelector('[data-act="bulk-eliminate"]');
    if (bulk) {
      bulk.addEventListener('click', function () {
        var s = readState(campaignState);
        if (!s.seating) return;
        var killed = 0;
        outer:
        for (var t = 1; t <= TABLES; t++) {
          var row = s.seating[t] || [];
          for (var si = 0; si < SEATS_PER_TABLE; si++) {
            var seat = row[si];
            if (seat && seat.kind === 'generic' && seat.status !== 'Eliminated') {
              seat.status = 'Eliminated';
              killed++;
              if (killed >= 5) break outer;
            }
          }
        }
        if (killed > 0) {
          pushLog(s, 'Eliminated ' + killed + ' generic competitors. Field thinning.');
          save(s, socket);
          refresh();
        }
      });
    }
    var reseat = panel.querySelector('[data-act="reseat"]');
    if (reseat) {
      reseat.addEventListener('click', function () {
        if (!window.confirm('Re-seed the seating chart? This resets all chips and statuses.')) return;
        var s = readState(campaignState);
        s.seating = seedSeating(s, partyCache);
        s.day1 = defaultState().day1;
        pushLog(s, 'Day 1 seating chart re-seeded.');
        save(s, socket);
        refresh();
      });
    }
    var marker = panel.querySelector('[data-act="cheat-marker"]');
    if (marker) {
      marker.addEventListener('click', function () {
        var s = readState(campaignState);
        s.day1.cheatCatch = 'marker';
        s.mandelbrotRapportTier = (s.mandelbrotRapportTier || 0) + 1;
        // mark Creeska eliminated
        if (s.seating) {
          for (var t = 1; t <= TABLES; t++) {
            var row = s.seating[t] || [];
            for (var si = 0; si < SEATS_PER_TABLE; si++) {
              var seat = row[si];
              if (seat && seat.kind === 'npc' && seat.id === 'creeska') {
                seat.status = 'Eliminated';
                seat.note = 'Caught marking — escorted out.';
              }
            }
          }
        }
        s.day1.beats.catch_cheater = true;
        pushLog(s, 'Cheat-Catch: Creeska\'s marker spotted cleanly. Mandelbrot Rapport +1 (now ' + s.mandelbrotRapportTier + '). Creeska expelled.');
        save(s, socket);
        refresh();
      });
    }
    var notes = panel.querySelector('.tt-recap-notes');
    if (notes) {
      var notesTimer = null;
      notes.addEventListener('input', function () {
        if (notesTimer) clearTimeout(notesTimer);
        notesTimer = setTimeout(function () {
          var s = readState(campaignState);
          s.day1.recapNotes = notes.value;
          save(s, socket);
        }, 400);
      });
      notes.addEventListener('blur', function () {
        if (notesTimer) { clearTimeout(notesTimer); notesTimer = null; }
        var s = readState(campaignState);
        if ((s.day1.recapNotes || '') !== notes.value) {
          s.day1.recapNotes = notes.value;
          save(s, socket);
        }
      });
    }
    var regen = panel.querySelector('[data-act="regenerate-recap"]');
    if (regen) {
      regen.addEventListener('click', function () {
        if (!socket) return;
        if (!window.confirm('Regenerate the Day 1 recap from the current tournament state? GM notes will be preserved.')) return;
        // Send the freshest notes value directly with the regenerate event so the
        // server uses it even if the debounced state save hasn't landed yet.
        var liveNotes = notes ? notes.value : null;
        if (notes) {
          var s = readState(campaignState);
          if ((s.day1.recapNotes || '') !== notes.value) {
            s.day1.recapNotes = notes.value;
            save(s, socket);
          }
        }
        var status = panel.querySelector('[data-recap-status]');
        if (status) { status.textContent = 'Regenerating…'; status.style.color = '#9ca3af'; }
        var payload = { sceneId: scene.id };
        if (typeof liveNotes === 'string') payload.gmNotes = liveNotes;
        socket.emit('tournament:regenerate-day1-recap', payload);
      });
    }
    if (socket && !socket._ttRecapAckBound) {
      socket._ttRecapAckBound = true;
      socket.on('tournament:recap-regenerated', function () {
        var status = document.querySelector('[data-recap-status]');
        if (!status) return;
        status.textContent = 'Recap updated.';
        status.style.color = '#22c55e';
        setTimeout(function () { if (status) status.textContent = ''; }, 2500);
      });
    }

    var accuse = panel.querySelector('[data-act="cheat-accusation"]');
    if (accuse) {
      accuse.addEventListener('click', function () {
        var s = readState(campaignState);
        s.day1.cheatCatch = 'accusation';
        s.mandelbrotRapportTier = Math.max(0, (s.mandelbrotRapportTier || 0) - 1);
        s.day1.beats.catch_cheater = true;
        pushLog(s, 'Cheat-Catch: Public accusation without evidence. Mandelbrot Rapport −1 (now ' + s.mandelbrotRapportTier + '). Accusing PC expelled or marked.');
        save(s, socket);
        refresh();
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  //  PLAYER STRIP
  // ────────────────────────────────────────────────────────────────────────
  function isTournamentScene(sceneId) {
    return TOURNAMENT_SCENES.indexOf(sceneId) !== -1;
  }

  // Filter for the player wire — strips GM-only fields from the persisted blob.
  function filterForPlayers(blob) {
    if (!blob) return null;
    var seating = {};
    if (blob.seating) {
      Object.keys(blob.seating).forEach(function (t) {
        seating[t] = (blob.seating[t] || []).map(function (seat) {
          if (!seat) return null;
          return {
            kind: seat.kind,
            name: seat.kind === 'generic' ? '—' : seat.name,
            chips: (seat.kind === 'pc' || seat.kind === 'npc') ? seat.chips : 0,
            status: seat.status
          };
        });
      });
    }
    return { seating: seating };
  }

  var ROLE_LABELS = {
    competitor: 'Competitor',
    security: 'Security',
    spectator: 'Spectator',
    dirty_money: 'Dirty Money',
    none: 'Unassigned'
  };

  function renderPlayerStrip(state, mountEl, currentSceneId) {
    if (!mountEl) return;
    var blob = (state && state[STATE_KEY]) || null;
    if (!blob || !isTournamentScene(currentSceneId) || !blob.seating) {
      mountEl.style.display = 'none';
      mountEl.innerHTML = '';
      return;
    }
    var myRole = blob.myRole || null;
    var mySeat = blob.mySeat || null;

    var html = '<div class="tt-strip">';
    html += '<div class="tt-strip-header">';
    html += '<div class="tt-strip-title">Sabacc Tournament — Live Standings</div>';
    if (myRole) {
      var roleLabel = ROLE_LABELS[myRole] || myRole;
      var seatLoc = '';
      if (myRole === 'competitor' && mySeat) {
        seatLoc = ' — T' + mySeat.table + 'S' + (mySeat.seat + 1);
      }
      html += '<div class="tt-strip-me tt-strip-me--' + esc(myRole) + '">';
      html += '<span class="tt-strip-me-label">Your role:</span> ';
      html += '<span class="tt-strip-me-role">' + esc(roleLabel) + seatLoc + '</span>';
      if (mySeat && (myRole === 'competitor')) {
        html += ' <span class="tt-strip-me-chips">' + (mySeat.chips || 0).toLocaleString() + ' chips</span>';
        html += ' <span class="tt-strip-me-status" style="background:' + (STATUS_COLORS[mySeat.status] || '#71717a') + ';">' + esc(mySeat.status || '') + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="tt-strip-grid">';
    for (var t = 1; t <= TABLES; t++) {
      var seats = blob.seating[t] || [];
      var alive = seats.filter(function (s) { return s && s.status !== 'Eliminated'; }).length;
      var hasMine = seats.some(function (s) { return s && s.mine; });
      html += '<div class="tt-strip-table' + (hasMine ? ' tt-strip-table--mine' : '') + '"><div class="tt-strip-tnum">T' + t + '</div><div class="tt-strip-tcount">' + alive + '/5</div><div class="tt-strip-tseats">';
      seats.forEach(function (seat) {
        if (!seat) return;
        var color = STATUS_COLORS[seat.status] || '#71717a';
        var lbl = (seat.kind === 'pc' || seat.kind === 'npc') ? esc(seat.name) : '·';
        var cls = 'tt-strip-seat' + (seat.mine ? ' tt-strip-seat--mine' : '');
        var title = esc(seat.name || '') + ' — ' + esc(seat.status || '') + (seat.chips ? ' (' + seat.chips + ' chips)' : '');
        if (seat.mine) title = 'YOU: ' + title;
        html += '<span class="' + cls + '" style="background:' + color + ';" title="' + title + '">' + lbl + '</span>';
      });
      html += '</div></div>';
    }
    html += '</div></div>';
    html += _stripStyles();
    mountEl.innerHTML = html;
    mountEl.style.display = 'block';
  }

  // ────────────────────────────────────────────────────────────────────────
  //  STYLES
  // ────────────────────────────────────────────────────────────────────────
  function _styleBlock() {
    return '<style>' +
      '.tt-panel{font-size:.75rem;color:#d8d8e8;padding:.5rem;}' +
      '.tt-header{margin-bottom:.5rem;}' +
      '.tt-title{font-family:Audiowide,sans-serif;font-size:.95rem;color:#f5d56b;}' +
      '.tt-subtitle{color:#9ca3af;font-size:.65rem;margin-top:.15rem;}' +
      '.tt-credits-row,.tt-fork-row,.tt-eve-row{margin:.4rem 0;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;}' +
      '.tt-credits-input{background:#15151f;color:#d8d8e8;border:1px solid #2a2a3a;border-radius:3px;padding:.2rem .3rem;width:6rem;}' +
      '.tt-credits-hint{color:#666;font-size:.6rem;}' +
      '.tt-fork-select,.tt-path-select{background:#15151f;color:#d8d8e8;border:1px solid #2a2a3a;border-radius:3px;padding:.2rem .3rem;font-size:.7rem;}' +
      '.tt-roster-table{width:100%;border-collapse:collapse;margin:.5rem 0;}' +
      '.tt-roster-table th,.tt-roster-table td{padding:.3rem .4rem;border-bottom:1px solid #2a2a3a;text-align:left;font-size:.7rem;}' +
      '.tt-roster-table th{color:#888;font-weight:400;text-transform:uppercase;font-size:.6rem;letter-spacing:.05rem;}' +
      '.tt-empty{color:#888;font-style:italic;text-align:center;}' +
      '.tt-path-flags{display:flex;gap:.25rem;flex-wrap:wrap;align-items:center;}' +
      '.tt-badge{padding:.1rem .35rem;border-radius:3px;font-size:.55rem;font-weight:600;letter-spacing:.04rem;}' +
      '.tt-badge--red{background:rgba(239,68,68,.15);color:#ef4444;}' +
      '.tt-badge--gold{background:rgba(245,213,107,.15);color:#f5d56b;}' +
      '.tt-badge--blue{background:rgba(59,130,246,.15);color:#60a5fa;}' +
      '.tt-badge--green{background:rgba(34,197,94,.15);color:#22c55e;}' +
      '.tt-badge--purple{background:rgba(168,85,247,.15);color:#a855f7;}' +
      '.tt-badge--dim{background:rgba(120,120,140,.1);color:#666;}' +
      '.tt-mini-btn{background:#1f1f2e;color:#888;border:1px solid #333;border-radius:3px;padding:.05rem .25rem;font-size:.55rem;cursor:pointer;}' +
      '.tt-mini-btn:hover{color:#fff;border-color:#555;}' +
      '.tt-summary{margin:.5rem 0;display:flex;flex-wrap:wrap;gap:.6rem;padding:.4rem .5rem;background:rgba(0,0,0,.25);border-radius:4px;font-size:.65rem;color:#aaa;}' +
      '.tt-summary strong{color:#f5d56b;}' +
      '.tt-eve-row{flex-direction:column;align-items:flex-start;background:rgba(245,213,107,.06);padding:.5rem;border-left:2px solid #f5d56b;border-radius:3px;}' +
      '.tt-eve-rapport{color:#9ca3af;font-size:.65rem;margin-top:.2rem;}' +
      '.tt-actions{display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap;}' +
      '.tt-btn{background:#1f1f2e;color:#d8d8e8;border:1px solid #333;border-radius:3px;padding:.35rem .6rem;font-size:.65rem;cursor:pointer;font-family:Audiowide,sans-serif;letter-spacing:.04rem;}' +
      '.tt-btn:hover{background:#2a2a3a;border-color:#555;}' +
      '.tt-btn-primary{background:rgba(245,213,107,.15);color:#f5d56b;border-color:#f5d56b;}' +
      '.tt-btn-good{background:rgba(34,197,94,.12);color:#22c55e;border-color:#22c55e;}' +
      '.tt-btn-bad{background:rgba(239,68,68,.12);color:#ef4444;border-color:#ef4444;}' +
      '.tt-btn-sm{padding:.2rem .4rem;font-size:.55rem;}' +
      // Day 1
      '.tt-day1-header{margin-bottom:.5rem;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;padding:.5rem;background:rgba(0,0,0,.3);border-radius:4px;}' +
      '.tt-field-counter{font-family:Audiowide,sans-serif;color:#f5d56b;font-size:.85rem;}' +
      '.tt-field-num{font-size:1.1rem;}' +
      '.tt-beats{display:flex;gap:.3rem;flex-wrap:wrap;}' +
      '.tt-beat-chk{font-size:.6rem;color:#888;cursor:pointer;padding:.15rem .35rem;border-radius:3px;background:rgba(120,120,140,.08);user-select:none;}' +
      '.tt-beat-chk.on{color:#22c55e;background:rgba(34,197,94,.12);}' +
      '.tt-beat-chk input{margin-right:.2rem;vertical-align:middle;}' +
      '.tt-day1-tools{margin-left:auto;display:flex;gap:.4rem;align-items:center;}' +
      '.tt-credits-mini{font-size:.6rem;color:#888;}.tt-credits-mini strong{color:#f5d56b;}' +
      '.tt-tables-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.6rem;}' +
      '.tt-tables-grid--day2{grid-template-columns:repeat(2,1fr);gap:.6rem;}' +
      '.tt-day2-meta{margin:.4rem 0;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;padding:.4rem .5rem;background:rgba(245,213,107,.06);border-left:2px solid #f5d56b;border-radius:3px;font-size:.65rem;color:#d8d8e8;}' +
      '.tt-day2-meta select,.tt-d2-payout{background:#15151f;color:#d8d8e8;border:1px solid #2a2a3a;border-radius:3px;padding:.2rem .3rem;font-size:.7rem;}' +
      '.tt-d2-payout{width:7rem;}' +
      '.tt-d2-winner-label strong{color:#f5d56b;}' +
      '.tt-seat-name--winner{color:#f5d56b !important;font-weight:700;}' +
      '.tt-seat-row--winner{background:rgba(245,213,107,.08);}' +
      '.tt-table-card{background:rgba(0,0,0,.3);border:1px solid #2a2a3a;border-radius:4px;padding:.3rem;}' +
      '.tt-table-head{font-family:Audiowide,sans-serif;font-size:.65rem;color:#f5d56b;border-bottom:1px solid #2a2a3a;padding-bottom:.15rem;margin-bottom:.2rem;text-align:center;letter-spacing:.05rem;}' +
      '.tt-seat-row{display:flex;align-items:center;gap:.2rem;padding:.1rem 0;font-size:.6rem;border-bottom:1px dotted rgba(255,255,255,.04);}' +
      '.tt-seat-row:last-child{border-bottom:none;}' +
      '.tt-seat-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.tt-seat-name--pc{color:#60a5fa;font-weight:700;}' +
      '.tt-seat-name--npc{color:#f5d56b;font-style:italic;}' +
      '.tt-seat-name--gen{color:#555;}' +
      '.tt-chips{display:flex;align-items:center;gap:.1rem;}' +
      '.tt-chips--gen{color:#444;width:3.4rem;justify-content:center;display:flex;}' +
      '.tt-chip-btn{background:#1f1f2e;color:#888;border:1px solid #333;width:1rem;height:1rem;font-size:.6rem;line-height:.8rem;border-radius:2px;cursor:pointer;padding:0;}' +
      '.tt-chip-btn:hover{color:#fff;border-color:#555;}' +
      '.tt-chip-input{background:#15151f;color:#d8d8e8;border:1px solid #2a2a3a;border-radius:2px;padding:.05rem .15rem;width:2.6rem;font-size:.55rem;text-align:right;}' +
      '.tt-status-pill{width:1.1rem;height:1.1rem;border-radius:50%;border:none;color:#000;font-weight:700;font-size:.55rem;cursor:pointer;}' +
      '.tt-buyback-btn{background:rgba(168,85,247,.15);color:#a855f7;border:1px solid #a855f7;border-radius:50%;width:1.1rem;height:1.1rem;cursor:pointer;font-size:.55rem;line-height:.8rem;padding:0;}' +
      '.tt-day1-footer{padding:.4rem;background:rgba(0,0,0,.25);border-radius:4px;}' +
      '.tt-cheat-row{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.4rem;}' +
      '.tt-cheat-label{font-size:.65rem;color:#888;}.tt-cheat-label strong{color:#f5d56b;}' +
      '.tt-recap-row{margin:.4rem 0;padding:.4rem;background:rgba(245,213,107,.05);border-left:2px solid #f5d56b;border-radius:3px;}' +
      '.tt-recap-label{font-family:Audiowide,sans-serif;color:#f5d56b;font-size:.65rem;letter-spacing:.05rem;}' +
      '.tt-recap-hint{color:#666;font-size:.55rem;margin:.15rem 0 .3rem;}' +
      '.tt-recap-notes{width:100%;background:#15151f;color:#d8d8e8;border:1px solid #2a2a3a;border-radius:3px;padding:.3rem;font-size:.65rem;font-family:inherit;resize:vertical;min-height:3rem;}' +
      '.tt-recap-actions{display:flex;align-items:center;gap:.5rem;margin-top:.3rem;}' +
      '.tt-recap-status{font-size:.6rem;color:#9ca3af;}' +
      '.tt-log{margin-top:.3rem;max-height:8rem;overflow-y:auto;background:rgba(0,0,0,.3);border-radius:3px;padding:.3rem;}' +
      '.tt-log-label{font-size:.55rem;color:#666;text-transform:uppercase;letter-spacing:.05rem;margin-bottom:.2rem;}' +
      '.tt-log-empty{color:#555;font-style:italic;font-size:.6rem;}' +
      '.tt-log-entry{font-size:.6rem;color:#aaa;padding:.1rem 0;border-bottom:1px dotted rgba(255,255,255,.04);}' +
      '.tt-log-time{color:#666;margin-right:.3rem;}' +
      '</style>';
  }

  function _stripStyles() {
    return '<style>' +
      '.tt-strip{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(15,15,25,.96);border-bottom:1px solid #2a2a3a;padding:.3rem .5rem;color:#d8d8e8;font-family:Exo 2,sans-serif;}' +
      '.tt-strip-header{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.2rem;flex-wrap:wrap;}' +
      '.tt-strip-title{font-family:Audiowide,sans-serif;font-size:.65rem;color:#f5d56b;letter-spacing:.05rem;}' +
      '.tt-strip-me{display:flex;align-items:center;gap:.4rem;font-size:.65rem;padding:.15rem .45rem;border-radius:3px;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.4);}' +
      '.tt-strip-me--competitor{background:rgba(245,213,107,.12);border-color:rgba(245,213,107,.5);}' +
      '.tt-strip-me--security{background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.5);}' +
      '.tt-strip-me--spectator{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.5);}' +
      '.tt-strip-me--dirty_money{background:rgba(168,85,247,.12);border-color:rgba(168,85,247,.5);}' +
      '.tt-strip-me-label{color:#888;text-transform:uppercase;font-size:.55rem;letter-spacing:.05rem;}' +
      '.tt-strip-me-role{font-family:Audiowide,sans-serif;color:#f5d56b;}' +
      '.tt-strip-me-chips{color:#22c55e;font-weight:700;}' +
      '.tt-strip-me-status{display:inline-block;padding:.05rem .35rem;border-radius:2px;color:#000;font-weight:700;font-size:.55rem;}' +
      '.tt-strip-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:.2rem;}' +
      '.tt-strip-table{background:rgba(0,0,0,.3);border-radius:3px;padding:.15rem;text-align:center;border:1px solid transparent;}' +
      '.tt-strip-table--mine{border-color:#f5d56b;background:rgba(245,213,107,.08);box-shadow:0 0 4px rgba(245,213,107,.3);}' +
      '.tt-strip-tnum{font-size:.5rem;color:#666;font-family:Audiowide,sans-serif;}' +
      '.tt-strip-table--mine .tt-strip-tnum{color:#f5d56b;}' +
      '.tt-strip-tcount{font-size:.6rem;color:#f5d56b;font-weight:700;}' +
      '.tt-strip-tseats{display:flex;justify-content:center;gap:1px;flex-wrap:wrap;margin-top:.1rem;}' +
      '.tt-strip-seat{display:inline-block;min-width:.5rem;height:.5rem;border-radius:1px;font-size:.4rem;line-height:.5rem;color:#000;font-weight:700;padding:0 .1rem;}' +
      '.tt-strip-seat--mine{outline:1.5px solid #f5d56b;outline-offset:1px;transform:scale(1.15);}' +
      '@media (max-width:768px){.tt-strip-grid{grid-template-columns:repeat(6,1fr);}}' +
      '</style>';
  }

  // ────────────────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ────────────────────────────────────────────────────────────────────────
  window.TournamentTracker = {
    STATE_KEY: STATE_KEY,
    SCENE_ROSTER: SCENE_ROSTER,
    SCENE_EVE: SCENE_EVE,
    SCENE_DAY1: SCENE_DAY1,
    SCENE_DAY2: SCENE_DAY2,
    isTournamentScene: isTournamentScene,
    hasTileForScene: function (sceneId) { return isTournamentScene(sceneId); },
    isDay1Scene: function (sceneId) { return sceneId === SCENE_DAY1; },
    isDay2Scene: function (sceneId) { return sceneId === SCENE_DAY2; },
    isRosterScene: function (sceneId) { return sceneId === SCENE_ROSTER || sceneId === SCENE_EVE; },
    buildRosterHtml: buildRosterHtml,
    buildDay1Html: buildDay1Html,
    buildDay2Html: buildDay2Html,
    bindRoster: bindRoster,
    bindDay1: bindDay1,
    bindDay2: bindDay2,
    renderPlayerStrip: renderPlayerStrip,
    filterForPlayers: filterForPlayers,
    readState: readState,
    defaultState: defaultState,
    fieldRemaining: fieldRemaining,
    fieldRemainingDay2: fieldRemainingDay2
  };
})();

(function () {
  if (window.ConversationOverlay) return;

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem('eote-session')) || null; }
    catch (_) { return null; }
  }
  function isGm() {
    var s = getSession();
    return !!(s && s.role === 'gm');
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function getSocket() { return window.__sharedSocket || null; }
  function chargeCharacter() {
    var s = getSession();
    return {
      characterId: s && s.characterId ? String(s.characterId) : null,
      characterName: s && s.characterName ? s.characterName : 'Unknown'
    };
  }

  var state = {
    overlay: null,
    active: null,
    viewingFollowUps: null,
    hidden: false
  };

  function findQ(def, id) {
    var r = (def.roots || []).find(function (x) { return x.id === id; });
    if (r) return r;
    return (def.followUps || {})[id] || null;
  }
  function isExplored(id) {
    var st = state.active.state || {};
    return (st.explored || []).indexOf(id) !== -1;
  }
  function isQueued(id) {
    var st = state.active.state || {};
    return (st.queue || []).some(function (q) {
      return q.questionId === id && q.status === 'pending';
    });
  }
  function isLocked(q) {
    return !!(q.minComfort && state.active.comfort < q.minComfort);
  }

  // GM-only inline styles (player styles live in player.css under .conv-p-*)
  var GM_STYLE_ID = 'conv-gm-style';
  function injectGmStyles() {
    if (document.getElementById(GM_STYLE_ID)) return;
    var css = `
/* ===== Conversation GM Console — Black Ledger floating window ===== */
.conv-gm-window {
  position: fixed; z-index: 9100;
  left: 50%; top: 50px; transform: translateX(-50%);
  width: 980px; height: 640px;
  background: linear-gradient(180deg, #2e2e32 0%, #2a2a2e 100%);
  border: 1px solid rgba(200,164,78,0.3);
  box-shadow: 0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,164,78,0.08), inset 0 1px 0 rgba(200,164,78,0.18);
  display: flex; flex-direction: column;
  color: #d8d4cc;
  font-family: 'Exo 2', -apple-system, sans-serif;
  overflow: hidden;
  min-width: 560px; min-height: 360px;
  max-width: calc(100vw - 12px); max-height: calc(100vh - 12px);
}
.conv-gm-window.dragging, .conv-gm-window.resizing { user-select: none; }

.conv-gm-header {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px;
  background: linear-gradient(180deg, #34342f 0%, #2c2c28 100%);
  border-bottom: 1px solid rgba(200,164,78,0.25);
  box-shadow: inset 0 -1px 0 rgba(200,164,78,0.12);
  cursor: grab; touch-action: none; flex-shrink: 0;
}
.conv-gm-header.dragging, .conv-gm-header:active { cursor: grabbing; }
.conv-gm-header .h-title {
  font-family: 'Audiowide', sans-serif;
  font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase;
  color: #c8a44e;
}
.conv-gm-header .h-sub { font-size: 0.7rem; color: #8a8378; margin-top: 2px; }
.conv-gm-header .h-spacer { flex: 1; }
.conv-comfort-pips { display: inline-flex; gap: 4px; align-items: center; }
.conv-pip { width: 10px; height: 10px; border-radius: 50%; background: #1d1d20; border: 1px solid #3a3833; }
.conv-pip.active { background: #c8a44e; border-color: #c8a44e; }
.conv-pip.warn { background: #d4a574; border-color: #d4a574; }
.conv-pip.danger { background: #c46a4a; border-color: #c46a4a; }
.conv-beat {
  font-family: 'Audiowide', sans-serif;
  font-size: 0.6rem; color: #c8a44e; text-transform: uppercase; letter-spacing: 0.12em;
  padding: 3px 9px; background: #1d1d20; border: 1px solid rgba(200,164,78,0.3); border-radius: 2px;
}
.conv-gm-close {
  background: transparent; border: 1px solid #3a3632; color: #8a8378;
  padding: 3px 10px; cursor: pointer; font-size: 0.65rem;
  font-family: 'Audiowide', sans-serif; text-transform: uppercase; letter-spacing: 0.1em;
  transition: all 0.15s;
}
.conv-gm-close:hover { border-color: #c8a44e; color: #c8a44e; }

.conv-gm-body {
  flex: 1; display: grid; grid-template-columns: 1fr 360px;
  min-height: 0; background: #232325;
}

/* Left: Notes + Log */
.conv-gm-left { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid rgba(200,164,78,0.15); }
.conv-gm-section { border-bottom: 1px solid rgba(200,164,78,0.12); }
.conv-gm-section:last-child { border-bottom: none; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.conv-gm-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; background: rgba(200,164,78,0.05);
  font-family: 'Audiowide', sans-serif; font-size: 0.62rem;
  color: #c8a44e; text-transform: uppercase; letter-spacing: 0.12em;
  cursor: pointer; user-select: none;
}
.conv-gm-section-head .chev { transition: transform 0.18s; display: inline-block; color: #8a7a4a; }
.conv-gm-section.collapsed .chev { transform: rotate(-90deg); }
.conv-gm-section.collapsed .conv-gm-section-body { display: none; }
.conv-gm-section-body {
  padding: 10px 14px; overflow-y: auto; min-height: 0;
  scrollbar-width: thin; scrollbar-color: #c8a44e #232328;
}
.conv-gm-section.notes .conv-gm-section-body { max-height: 200px; font-size: 0.78rem; line-height: 1.55; color: #c4bfb5; white-space: pre-wrap; }
.conv-gm-section.log .conv-gm-section-body { flex: 1; }

.conv-gm-log-entry { margin-bottom: 10px; }
.conv-gm-readaloud { background: rgba(200,164,78,0.06); border-left: 3px solid #c8a44e; padding: 10px 14px; font-style: italic; line-height: 1.55; color: #c4bfb5; white-space: pre-wrap; }
.conv-gm-qa { background: #1c1c1e; border: 1px solid #353330; border-radius: 3px; padding: 10px 14px; }
.conv-gm-qa .who { font-family: 'Audiowide', sans-serif; font-size: 0.6rem; color: #8a7a4a; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
.conv-gm-qa .q { color: #d8d4cc; margin-bottom: 8px; font-size: 0.85rem; font-style: italic; }
.conv-gm-qa .a-speaker { font-family: 'Audiowide', sans-serif; font-size: 0.6rem; color: #c8a44e; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
.conv-gm-qa .a { color: #e8e4d8; line-height: 1.55; white-space: pre-wrap; font-size: 0.83rem; }
.conv-gm-qa .gm-note { margin-top: 10px; padding: 8px 10px; background: rgba(99,102,241,0.08); border-left: 2px solid #6366f1; font-size: 0.72rem; color: #b8b8d6; line-height: 1.5; }
.conv-gm-pass { background: rgba(120,120,110,0.08); border-left: 2px solid #4a4640; padding: 6px 12px; font-size: 0.72rem; color: #8a8378; font-style: italic; }
.conv-gm-maya { background: rgba(143,107,178,0.08); border-left: 3px solid #8f6bb2; padding: 10px 14px; }
.conv-gm-maya .speaker { font-family: 'Audiowide', sans-serif; font-size: 0.6rem; color: #b89cd6; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
.conv-gm-ended { text-align: center; padding: 22px; color: #8a8378; font-style: italic; line-height: 1.6; border: 1px dashed #3a3833; background: rgba(0,0,0,0.2); }

/* Right: Console */
.conv-gm-side { background: #1d1d1f; display: flex; flex-direction: column; min-height: 0; }
.gm-participants {
  padding: 8px 12px; font-size: 0.7rem; color: #8a8378; line-height: 1.7;
  border-bottom: 1px solid rgba(200,164,78,0.12);
}
.gm-participants strong {
  display: block; font-family: 'Audiowide', sans-serif; font-size: 0.6rem;
  color: #c8a44e; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;
}
.gm-participants .pname { display: inline-block; padding: 2px 8px; background: #2a2a2c; border: 1px solid #3a3833; border-radius: 2px; margin: 0 4px 4px 0; font-size: 0.7rem; color: #8a8378; }
.gm-participants .pname.acted { color: #c8a44e; border-color: #c8a44e; background: rgba(200,164,78,0.08); }

.conv-gm-side-body { flex: 1; overflow-y: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: #c8a44e #232328; }
.gm-queue-head {
  padding: 6px 12px; font-family: 'Audiowide', sans-serif; font-size: 0.62rem;
  color: #c8a44e; text-transform: uppercase; letter-spacing: 0.12em;
  background: rgba(200,164,78,0.05); border-bottom: 1px solid rgba(200,164,78,0.12);
}
.gm-queue { padding: 10px; }
.gm-queue-item {
  background: #232325; border: 1px solid #3a3833; border-radius: 3px;
  padding: 10px; margin-bottom: 8px;
}
.gm-queue-item.passed { opacity: 0.55; border-style: dashed; }
.gm-queue-item .who { font-family: 'Audiowide', sans-serif; font-size: 0.6rem; color: #b89cd6; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
.gm-queue-item .q { color: #d8d4cc; font-size: 0.78rem; margin-bottom: 6px; font-style: italic; }
.gm-queue-item .preview { background: #1a1a1c; border-left: 2px solid #c8a44e; padding: 8px 10px; font-size: 0.75rem; color: #c4bfb5; line-height: 1.5; max-height: 180px; overflow-y: auto; margin-bottom: 6px; white-space: pre-wrap; }
.gm-queue-item .gm-note-prev { background: rgba(99,102,241,0.08); border-left: 2px solid #6366f1; padding: 6px 10px; font-size: 0.7rem; color: #b8b8d6; margin-bottom: 6px; line-height: 1.5; }
.gm-queue-item .deliver-btn {
  width: 100%; padding: 6px 10px; background: #c8a44e; color: #1a1a1c;
  border: none; border-radius: 2px; cursor: pointer;
  font-family: 'Audiowide', sans-serif; font-size: 0.65rem;
  text-transform: uppercase; letter-spacing: 0.1em;
  transition: background 0.15s;
}
.gm-queue-item .deliver-btn:hover { background: #d8b45e; }
.gm-queue-item .delivered-tag { font-family: 'Audiowide', sans-serif; font-size: 0.6rem; color: #6a9c4a; text-transform: uppercase; letter-spacing: 0.12em; padding: 4px 0; }
.gm-empty { padding: 22px 16px; text-align: center; color: #6a655c; font-style: italic; font-size: 0.78rem; }
.gm-actions { padding: 10px; border-top: 1px solid rgba(200,164,78,0.15); flex-shrink: 0; }
.gm-actions button {
  width: 100%; padding: 8px; background: rgba(196,106,74,0.1); color: #c46a4a;
  border: 1px solid rgba(196,106,74,0.4); border-radius: 2px; cursor: pointer;
  font-family: 'Audiowide', sans-serif; font-size: 0.65rem;
  text-transform: uppercase; letter-spacing: 0.1em;
  transition: all 0.15s;
}
.gm-actions button:hover { background: rgba(196,106,74,0.2); border-color: #c46a4a; }

.conv-gm-resize {
  position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;
  cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, rgba(200,164,78,0.5) 50%, rgba(200,164,78,0.5) 60%, transparent 60%, transparent 70%, rgba(200,164,78,0.5) 70%, rgba(200,164,78,0.5) 80%, transparent 80%);
  z-index: 2;
}

.conv-gm-peek {
  position: fixed; bottom: 1rem; right: 1rem; z-index: 9050;
  background: linear-gradient(180deg, #34342f 0%, #2c2c28 100%);
  border: 1px solid rgba(200,164,78,0.4); color: #c8a44e;
  font-family: 'Audiowide', sans-serif; font-size: 0.65rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  padding: 8px 14px; cursor: pointer;
  box-shadow: 0 6px 20px rgba(0,0,0,0.6);
}
.conv-gm-peek:hover { border-color: #c8a44e; }

@media (max-width: 768px) {
  .conv-gm-window { width: calc(100vw - 12px); left: 6px; transform: none; }
  .conv-gm-body { grid-template-columns: 1fr; }
  .conv-gm-side { border-top: 1px solid rgba(200,164,78,0.15); }
}
`;
    var s = document.createElement('style');
    s.id = GM_STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ====== Player floating modal ======
  // Persisted window geometry across re-renders
  var winGeom = { left: null, top: null, width: null, height: null };
  // Per-question expanded state (key = questionId, true = expanded)
  var expandedMap = Object.create(null);

  function renderPlayerModal() {
    var existing = document.getElementById('conv-overlay');
    var prevScroll = 0;
    if (existing) {
      var prevLog = existing.querySelector('#conv-p-log-col');
      if (prevLog) prevScroll = prevLog.scrollTop;
      existing.remove();
    }
    if (!state.active) return;

    var a = state.active;
    var def = a.definition || {};
    var st = a.state || {};
    var ch = chargeCharacter();
    var npcName = (def.npc && def.npc.name) || '';

    var win = document.createElement('div');
    win.id = 'conv-overlay';
    win.className = 'conv-p-window';

    if (winGeom.left != null) {
      win.style.left = winGeom.left + 'px';
      win.style.top = winGeom.top + 'px';
      win.style.transform = 'none';
    }
    if (winGeom.width != null) win.style.width = winGeom.width + 'px';
    if (winGeom.height != null) win.style.height = winGeom.height + 'px';

    // ===== Header (drag handle) =====
    var header = document.createElement('div');
    header.className = 'conv-p-header';
    header.innerHTML =
      '<div class="conv-p-header-text">' +
        '<div class="conv-p-title">' + escHtml(def.title || 'Conversation') + '</div>' +
        (npcName || def.subtitle ? '<div class="conv-p-subtitle">' + escHtml(def.subtitle || npcName) + '</div>' : '') +
      '</div>' +
      '<div class="conv-p-header-btns">' +
        '<button class="conv-p-icon-btn" id="conv-p-hide" title="Hide window">Hide</button>' +
      '</div>';
    win.appendChild(header);

    // ===== Body: two columns =====
    var body = document.createElement('div');
    body.className = 'conv-p-body';
    win.appendChild(body);

    // -- Left column: topics + actions --
    var leftCol = document.createElement('div');
    leftCol.className = 'conv-p-col conv-p-col-left';
    leftCol.innerHTML = '<div class="conv-p-col-header">Questions</div>';
    var leftBody = document.createElement('div');
    leftBody.className = 'conv-p-col-body';
    leftCol.appendChild(leftBody);
    body.appendChild(leftCol);

    if (def.readAloud) {
      var ra = document.createElement('div');
      ra.className = 'conv-p-readaloud';
      ra.textContent = def.readAloud;
      leftBody.appendChild(ra);
    }

    if (a.status === 'ended') {
      var endLine = (def.comfort && (def.comfort.dryLine || def.comfort.exitLine)) || 'The conversation has ended.';
      var ended = document.createElement('div');
      ended.className = 'conv-p-status';
      ended.textContent = endLine;
      leftBody.appendChild(ended);
    } else {
      var actedThisBeat = (st.actedThisBeat || []).indexOf(String(ch.characterId)) !== -1;
      if (actedThisBeat) {
        var myAction = (st.queue || []).find(function (q) {
          return String(q.characterId) === String(ch.characterId) && q.beat === a.beat;
        });
        var msg = 'Waiting for the others...';
        if (myAction && myAction.action === 'ask' && myAction.status === 'pending') {
          msg = 'Your question has been heard. Awaiting their reply...';
        } else if (myAction && myAction.action === 'pass') {
          msg = 'You said nothing this round. Listening to the others...';
        }
        var wait = document.createElement('div');
        wait.className = 'conv-p-status';
        wait.textContent = msg;
        leftBody.appendChild(wait);
      } else {
        leftBody.appendChild(buildTopicsSection(def, st));
      }
    }

    // -- Right column: collapsible Q&A log, newest first --
    var rightCol = document.createElement('div');
    rightCol.className = 'conv-p-col conv-p-col-right';
    rightCol.innerHTML = '<div class="conv-p-col-header">Responses (newest first)</div>';
    var logEl = document.createElement('div');
    logEl.className = 'conv-p-col-body';
    logEl.id = 'conv-p-log-col';
    rightCol.appendChild(logEl);
    body.appendChild(rightCol);

    // Build log items reversed (newest first)
    var logItems = (st.log || []).slice().reverse();
    var qaItems = logItems.filter(function (i) { return i.type === 'qa'; });
    var newestQaId = qaItems.length ? qaItems[0].questionId : null;
    // Auto-expand newest if user hasn't touched anything yet
    if (newestQaId && !(newestQaId in expandedMap)) {
      expandedMap[newestQaId] = true;
    }

    if (!logItems.length) {
      logEl.innerHTML = '<div class="conv-p-empty">No responses yet. Pick a question to get the conversation started.</div>';
    } else {
      logItems.forEach(function (item) {
        if (item.type === 'qa') {
          var expanded = !!expandedMap[item.questionId];
          var card = document.createElement('div');
          card.className = 'conv-p-qa-card' + (expanded ? ' expanded' : '') +
            (item.questionId === newestQaId ? ' newest' : '');
          card.innerHTML =
            '<button class="conv-p-qa-toggle" data-toggle-q="' + escHtml(item.questionId) + '">' +
              '<span class="chev">\u25B8</span>' +
              '<span class="qtext">' + escHtml(item.questionText) +
                '<span class="qmeta">' + escHtml(item.characterName) + '</span>' +
              '</span>' +
            '</button>' +
            '<div class="conv-p-qa-content">' +
              '<div class="a-speaker">' + escHtml(npcName || 'Reply') + '</div>' +
              '<div class="a">' + item.response + '</div>' +
              '<div class="conv-p-clip-row"><button class="conv-p-clip-btn" data-clip-q="' + escHtml(item.questionId) + '">+ Clip to Journal</button></div>' +
            '</div>';
          logEl.appendChild(card);
        } else if (item.type === 'pass') {
          var pl = document.createElement('div');
          pl.className = 'conv-p-pass-log';
          pl.textContent = item.characterName + ' said nothing this round.';
          logEl.appendChild(pl);
        } else if (item.type === 'maya') {
          var ml = document.createElement('div');
          ml.className = 'conv-p-maya';
          ml.innerHTML = '<div class="speaker">Maya</div><div class="text">' + item.text + '</div>';
          logEl.appendChild(ml);
        }
      });
    }

    // ===== Resize handle =====
    var resize = document.createElement('div');
    resize.className = 'conv-p-resize';
    win.appendChild(resize);

    document.body.appendChild(win);
    state.overlay = win;

    // Restore log scroll position so re-renders don't jump
    if (prevScroll) logEl.scrollTop = prevScroll;

    // ===== Wire interactions =====
    document.getElementById('conv-p-hide').addEventListener('click', function () {
      state.hidden = true;
      win.remove();
      state.overlay = null;
      showPeekButton();
    });

    Array.prototype.forEach.call(win.querySelectorAll('[data-toggle-q]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var qid = btn.getAttribute('data-toggle-q');
        expandedMap[qid] = !expandedMap[qid];
        var card = btn.closest('.conv-p-qa-card');
        if (card) card.classList.toggle('expanded', expandedMap[qid]);
      });
    });

    Array.prototype.forEach.call(win.querySelectorAll('[data-clip-q]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openClipModal(btn.getAttribute('data-clip-q'));
      });
    });

    Array.prototype.forEach.call(win.querySelectorAll('[data-ask-q]'), function (btn) {
      btn.addEventListener('click', function () { askQuestion(btn.getAttribute('data-ask-q')); });
    });

    var passBtn = win.querySelector('#conv-p-pass-btn');
    if (passBtn) passBtn.addEventListener('click', passBeat);

    var backBtn = win.querySelector('#conv-p-back-btn');
    if (backBtn) backBtn.addEventListener('click', function () {
      state.viewingFollowUps = null;
      renderAll();
    });

    enableDrag(win, header);
    enableResize(win, resize);
  }

  function buildTopicsSection(def, st) {
    var topics = document.createElement('div');

    function makeBtn(q) {
      var explored = isExplored(q.id);
      var queued = isQueued(q.id);
      var locked = isLocked(q);
      var disabled = explored || queued || locked;
      var tag = (q.type || '');
      if (queued) tag = 'queued — awaiting reply';
      else if (locked) tag = 'locked';
      else if (explored) tag = 'asked';
      var html = escHtml(q.text) + (tag ? '<span class="tag">' + escHtml(tag) + '</span>' : '');
      return '<button class="conv-p-choice-btn' + (queued ? ' queued' : '') + '"' +
        (disabled ? ' disabled' : ' data-ask-q="' + escHtml(q.id) + '"') + '>' + html + '</button>';
    }

    if (state.viewingFollowUps) {
      topics.innerHTML += '<button class="conv-p-pass-btn" id="conv-p-back-btn" style="margin-bottom:0.4rem;">\u2190 Back</button>';
      var followUps = ((findQ(def, state.viewingFollowUps) || {}).unlocks || [])
        .map(function (uid) { return (def.followUps || {})[uid]; })
        .filter(function (q) { return q && !isExplored(q.id); });
      topics.innerHTML += '<div class="conv-p-section-label">Follow-ups</div>';
      followUps.forEach(function (q) { topics.innerHTML += makeBtn(q); });
    } else {
      topics.innerHTML += '<div class="conv-p-section-label">What do you ask?</div>';
      (def.roots || []).forEach(function (q) { topics.innerHTML += makeBtn(q); });

      var unlocked = (st.unlocked || [])
        .map(function (uid) { return (def.followUps || {})[uid]; })
        .filter(function (q) { return q && !isExplored(q.id); });
      if (unlocked.length) {
        topics.innerHTML += '<div class="conv-p-section-label">Unlocked</div>';
        unlocked.forEach(function (q) { topics.innerHTML += makeBtn(q); });
      }
    }

    topics.innerHTML += '<button class="conv-p-pass-btn" id="conv-p-pass-btn">Stay quiet this round</button>';
    return topics;
  }

  // ====== Drag & resize (pointer events: mouse + touch) ======
  function enableDrag(win, handle) {
    var startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;
    handle.addEventListener('pointerdown', function (e) {
      // Don't start drag from buttons
      if (e.target.closest('button')) return;
      dragging = true;
      var rect = win.getBoundingClientRect();
      win.style.left = rect.left + 'px';
      win.style.top = rect.top + 'px';
      win.style.transform = 'none';
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      win.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = startLeft + (e.clientX - startX);
      var ny = startTop + (e.clientY - startY);
      // Clamp into viewport (keep at least 60px visible)
      nx = Math.max(-(win.offsetWidth - 80), Math.min(window.innerWidth - 80, nx));
      ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    });
    function stop(e) {
      if (!dragging) return;
      dragging = false;
      win.classList.remove('dragging');
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      var rect = win.getBoundingClientRect();
      winGeom.left = rect.left;
      winGeom.top = rect.top;
    }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function enableResize(win, handle) {
    var startX = 0, startY = 0, startW = 0, startH = 0, resizing = false;
    handle.addEventListener('pointerdown', function (e) {
      resizing = true;
      var rect = win.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = rect.width; startH = rect.height;
      win.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!resizing) return;
      var nw = Math.max(320, Math.min(window.innerWidth - 20, startW + (e.clientX - startX)));
      var nh = Math.max(280, Math.min(window.innerHeight - 20, startH + (e.clientY - startY)));
      win.style.width = nw + 'px';
      win.style.height = nh + 'px';
    });
    function stop(e) {
      if (!resizing) return;
      resizing = false;
      win.classList.remove('resizing');
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      winGeom.width = win.offsetWidth;
      winGeom.height = win.offsetHeight;
    }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function showPeekButton() {
    var existing = document.getElementById('conv-peek-btn');
    if (existing) existing.remove();
    if (!state.active || state.active.status !== 'active') return;
    var def = state.active.definition || {};
    var btn = document.createElement('button');
    btn.id = 'conv-peek-btn';
    btn.className = 'conv-p-peek';
    btn.textContent = '\u270D ' + (def.title || 'Conversation');
    btn.addEventListener('click', function () {
      state.hidden = false;
      btn.remove();
      renderAll();
    });
    document.body.appendChild(btn);
  }

  // ====== GM Console — Black Ledger floating window ======
  var gmGeom = { left: null, top: null, width: null, height: null };
  var gmNotesCollapsed = false;

  function renderGmShell() {
    var existing = document.getElementById('conv-overlay');
    if (existing) existing.remove();
    var win = document.createElement('div');
    win.id = 'conv-overlay';
    win.className = 'conv-gm-window';

    if (gmGeom.left != null) {
      win.style.left = gmGeom.left + 'px';
      win.style.top = gmGeom.top + 'px';
      win.style.transform = 'none';
    }
    if (gmGeom.width != null) win.style.width = gmGeom.width + 'px';
    if (gmGeom.height != null) win.style.height = gmGeom.height + 'px';

    win.innerHTML =
      '<div class="conv-gm-header" id="conv-gm-header">' +
        '<div>' +
          '<div class="h-title" id="conv-h-title">Conversation</div>' +
          '<div class="h-sub" id="conv-h-sub"></div>' +
        '</div>' +
        '<div class="h-spacer"></div>' +
        '<div class="conv-beat" id="conv-h-beat">Beat 1</div>' +
        '<div class="conv-comfort-pips" id="conv-h-pips" title="Comfort"></div>' +
        '<button class="conv-gm-close" id="conv-h-close">Hide</button>' +
      '</div>' +
      '<div class="conv-gm-body">' +
        '<div class="conv-gm-left">' +
          '<div class="conv-gm-section notes' + (gmNotesCollapsed ? ' collapsed' : '') + '" id="conv-notes-sec">' +
            '<div class="conv-gm-section-head" id="conv-notes-head">' +
              '<span>GM Notes</span><span class="chev">\u25BE</span>' +
            '</div>' +
            '<div class="conv-gm-section-body" id="conv-notes-body"></div>' +
          '</div>' +
          '<div class="conv-gm-section log">' +
            '<div class="conv-gm-section-head"><span>Scene Log</span></div>' +
            '<div class="conv-gm-section-body" id="conv-log"></div>' +
          '</div>' +
        '</div>' +
        '<div class="conv-gm-side" id="conv-side"></div>' +
      '</div>' +
      '<div class="conv-gm-resize" id="conv-gm-resize"></div>';

    document.body.appendChild(win);
    state.overlay = win;

    document.getElementById('conv-h-close').addEventListener('click', function () {
      win.remove();
      state.overlay = null;
      showGmPeekButton();
    });

    var notesHead = document.getElementById('conv-notes-head');
    notesHead.addEventListener('click', function () {
      gmNotesCollapsed = !gmNotesCollapsed;
      document.getElementById('conv-notes-sec').classList.toggle('collapsed', gmNotesCollapsed);
    });

    enableGmDrag(win, document.getElementById('conv-gm-header'));
    enableGmResize(win, document.getElementById('conv-gm-resize'));
  }

  function enableGmDrag(win, handle) {
    var startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true;
      var rect = win.getBoundingClientRect();
      win.style.left = rect.left + 'px';
      win.style.top = rect.top + 'px';
      win.style.transform = 'none';
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      win.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = startLeft + (e.clientX - startX);
      var ny = startTop + (e.clientY - startY);
      nx = Math.max(-(win.offsetWidth - 100), Math.min(window.innerWidth - 100, nx));
      ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    });
    function stop(e) {
      if (!dragging) return;
      dragging = false;
      win.classList.remove('dragging');
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      var rect = win.getBoundingClientRect();
      gmGeom.left = rect.left; gmGeom.top = rect.top;
    }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function enableGmResize(win, handle) {
    var startX = 0, startY = 0, startW = 0, startH = 0, resizing = false;
    handle.addEventListener('pointerdown', function (e) {
      resizing = true;
      var rect = win.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = rect.width; startH = rect.height;
      win.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!resizing) return;
      var nw = Math.max(560, Math.min(window.innerWidth - 12, startW + (e.clientX - startX)));
      var nh = Math.max(360, Math.min(window.innerHeight - 12, startH + (e.clientY - startY)));
      win.style.width = nw + 'px';
      win.style.height = nh + 'px';
    });
    function stop(e) {
      if (!resizing) return;
      resizing = false;
      win.classList.remove('resizing');
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      gmGeom.width = win.offsetWidth; gmGeom.height = win.offsetHeight;
    }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function showGmPeekButton() {
    var existing = document.getElementById('conv-gm-peek-btn');
    if (existing) existing.remove();
    if (!state.active) return;
    var def = state.active.definition || {};
    var btn = document.createElement('button');
    btn.id = 'conv-gm-peek-btn';
    btn.className = 'conv-gm-peek';
    btn.textContent = 'GM \u25B8 ' + (def.title || 'Conversation');
    btn.addEventListener('click', function () { btn.remove(); renderAll(); });
    document.body.appendChild(btn);
  }

  function renderGmHeader() {
    var a = state.active; if (!a) return;
    var def = a.definition || {};
    var npcName = (def.npc && def.npc.name) || '';
    document.getElementById('conv-h-title').textContent = def.title || 'Conversation';
    document.getElementById('conv-h-sub').textContent = def.subtitle || npcName || '';
    document.getElementById('conv-h-beat').textContent = a.status === 'ended' ? 'Ended' : ('Beat ' + a.beat);
    var pipsEl = document.getElementById('conv-h-pips');
    pipsEl.innerHTML = '';
    var max = (def.comfort && def.comfort.max) || 5;
    for (var i = 1; i <= max; i++) {
      var pip = document.createElement('div');
      pip.className = 'conv-pip';
      if (i <= a.comfort) {
        pip.classList.add('active');
        if (a.comfort <= 2) pip.classList.add('warn');
        if (a.comfort <= 1) pip.classList.add('danger');
      }
      pipsEl.appendChild(pip);
    }

    // Populate GM Notes body
    var notesBody = document.getElementById('conv-notes-body');
    if (notesBody) {
      var notesText = def.gmNotes || '';
      if (notesText) {
        notesBody.textContent = notesText;
      } else {
        notesBody.innerHTML = '<div style="color:#6a655c;font-style:italic;">No GM notes for this scene.</div>';
      }
    }
  }

  function renderGmLog() {
    var a = state.active;
    var def = a.definition || {};
    var logEl = document.getElementById('conv-log');
    logEl.innerHTML = '';

    if (def.readAloud) {
      var ra = document.createElement('div');
      ra.className = 'conv-gm-log-entry';
      ra.innerHTML = '<div class="conv-gm-readaloud">' + escHtml(def.readAloud) + '</div>';
      logEl.appendChild(ra);
    }
    var st = a.state || {};
    (st.log || []).forEach(function (item) {
      var w = document.createElement('div');
      w.className = 'conv-gm-log-entry';
      if (item.type === 'qa') {
        var npcName = (def.npc && def.npc.name) || 'NPC';
        w.innerHTML =
          '<div class="conv-gm-qa">' +
            '<div class="who">Beat ' + item.beat + ' \u2014 ' + escHtml(item.characterName) + ' asked</div>' +
            '<div class="q">"' + escHtml(item.questionText) + '"</div>' +
            '<div class="a-speaker">' + escHtml(npcName) + '</div>' +
            '<div class="a">' + item.response + '</div>' +
            (item.gmNote ? '<div class="gm-note"><strong>GM Note:</strong> ' + item.gmNote + '</div>' : '') +
          '</div>';
      } else if (item.type === 'pass') {
        w.innerHTML = '<div class="conv-gm-pass">Beat ' + item.beat + ' \u2014 ' + escHtml(item.characterName) + ' passed.</div>';
      } else if (item.type === 'maya') {
        w.innerHTML =
          '<div class="conv-gm-maya">' +
            '<div class="speaker">Maya</div>' +
            '<div>' + item.text + '</div>' +
            (item.gmNote ? '<div class="gm-note" style="margin-top:8px;"><strong>GM Note:</strong> ' + item.gmNote + '</div>' : '') +
          '</div>';
      }
      logEl.appendChild(w);
    });
    if (a.status === 'ended') {
      var end = document.createElement('div');
      end.className = 'conv-gm-log-entry';
      var line = (def.comfort && (def.comfort.dryLine || def.comfort.exitLine)) || 'The conversation has ended.';
      end.innerHTML = '<div class="conv-gm-ended">' + escHtml(line) + '</div>';
      logEl.appendChild(end);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderGmSide() {
    var sideEl = document.getElementById('conv-side');
    var a = state.active;
    var st = a.state || {};
    var def = a.definition || {};

    sideEl.innerHTML = '';

    var partsBlock = document.createElement('div');
    partsBlock.className = 'gm-participants';
    var parts = a.participants || [];
    var actedSet = new Set((st.actedThisBeat || []).map(String));
    partsBlock.innerHTML = '<strong>Participants &mdash; ' + actedSet.size + '/' + parts.length + ' acted this beat</strong>' +
      parts.map(function (p) {
        var cls = actedSet.has(String(p.characterId)) ? 'pname acted' : 'pname';
        return '<span class="' + cls + '">' + escHtml(p.characterName) + '</span>';
      }).join('');
    sideEl.appendChild(partsBlock);

    var queueHead = document.createElement('div');
    queueHead.className = 'gm-queue-head';
    queueHead.textContent = 'Question Queue';
    sideEl.appendChild(queueHead);

    var sideBody = document.createElement('div');
    sideBody.className = 'conv-gm-side-body';
    sideEl.appendChild(sideBody);

    var queueBlock = document.createElement('div');
    queueBlock.className = 'gm-queue';
    sideBody.appendChild(queueBlock);

    var pending = (st.queue || []).filter(function (q) { return q.beat === a.beat; });
    if (a.status === 'ended') {
      queueBlock.innerHTML = '<div class="gm-empty">Conversation has ended.</div>';
    } else if (!pending.length) {
      queueBlock.innerHTML = '<div class="gm-empty">No questions submitted for this beat yet.</div>';
    } else {
      pending.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'gm-queue-item' + (item.action === 'pass' ? ' passed' : '');
        if (item.action === 'pass') {
          card.innerHTML =
            '<div class="who">' + escHtml(item.characterName) + '</div>' +
            '<div class="q" style="color:#888;font-style:italic;">passed this beat.</div>';
        } else {
          var q = findQ(def, item.questionId);
          var response = (q && q.response) || '(no response defined)';
          var gmNote = q && q.gmNote ? '<div class="gm-note-prev"><strong>GM Note:</strong> ' + q.gmNote + '</div>' : '';
          var deliveredTag = item.status === 'delivered' ? '<div class="delivered-tag">\u2713 Delivered</div>' : '';
          card.innerHTML =
            '<div class="who">' + escHtml(item.characterName) + '</div>' +
            '<div class="q">"' + escHtml(item.questionText) + '"</div>' +
            '<div class="preview">' + response + '</div>' +
            gmNote +
            deliveredTag;
          if (item.status === 'pending') {
            var btn = document.createElement('button');
            btn.className = 'deliver-btn';
            btn.textContent = 'Deliver Response';
            btn.addEventListener('click', function () { deliverResponse(item.questionId, item.characterId); });
            card.appendChild(btn);
          }
        }
        queueBlock.appendChild(card);
      });
    }

    if (a.status !== 'ended') {
      var actions = document.createElement('div');
      actions.className = 'gm-actions';
      var endBtn = document.createElement('button');
      endBtn.textContent = 'End Conversation';
      endBtn.addEventListener('click', function () {
        if (!confirm('End this conversation now?')) return;
        endConversation();
      });
      actions.appendChild(endBtn);
      sideEl.appendChild(actions);
    }
  }

  // ====== Top-level render ======
  // Signature of the last rendered active state, used to suppress redundant
  // re-renders (e.g. when a socket broadcast echoes the state we just applied
  // from our own POST response — that double-render caused the overlay to
  // briefly close and re-render off-center on selection).
  var lastRenderedSig = null;
  var lastRenderedHidden = null;
  function activeSig(a) {
    if (!a) return '';
    try {
      var st = a.state || {};
      return JSON.stringify({
        id: a.id || a.conversationId || (a.definition && a.definition.id) || null,
        b: a.beat,
        s: a.status,
        c: a.comfort,
        q: st.queue || [],
        l: st.log || [],
        at: st.actedThisBeat || [],
        u: st.unlocked || [],
        v: a.viewingFollowUps || null
      });
    } catch (e) { return String(Math.random()); }
  }

  function renderAll() {
    if (!state.active) return;
    var sig = activeSig(state.active) + '|hidden=' + (state.hidden ? '1' : '0') +
              '|view=' + (state.viewingFollowUps || '');
    if (sig === lastRenderedSig && state.overlay && document.body.contains(state.overlay)) {
      // Nothing meaningful changed since the last render; skip the teardown/rebuild
      // to avoid the visible flicker on selection.
      return;
    }
    lastRenderedSig = sig;
    lastRenderedHidden = state.hidden;
    if (isGm()) {
      injectGmStyles();
      if (!state.overlay || !state.overlay.classList.contains('conv-gm-window')) {
        renderGmShell();
      } else {
        state.overlay.style.display = '';
      }
      renderGmHeader();
      renderGmLog();
      renderGmSide();
    } else {
      // Player floating modal
      if (state.hidden) { showPeekButton(); return; }
      renderPlayerModal();
    }
  }

  // ====== Actions ======
  function askQuestion(qid) {
    var ch = chargeCharacter();
    fetch('/api/conversations/active/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, characterId: ch.characterId, characterName: ch.characterName })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.active) { state.active = data.active; renderAll(); }
      else if (data && data.error) { alert(data.error); }
    });
  }
  function passBeat() {
    var ch = chargeCharacter();
    fetch('/api/conversations/active/pass', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: ch.characterId, characterName: ch.characterName })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.active) { state.active = data.active; renderAll(); }
    });
  }
  function deliverResponse(qid, charId) {
    fetch('/api/conversations/active/deliver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, characterId: charId })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.active) { state.active = data.active; renderAll(); }
      else if (data && data.error) { alert(data.error); }
    });
  }
  function endConversation() {
    fetch('/api/conversations/active/end', { method: 'POST' })
      .then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.active) { state.active = data.active; renderAll(); }
      });
  }

  // ====== Clip modal ======
  function openClipModal(qid) {
    var existing = document.getElementById('conv-clip-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'conv-clip-modal';
    modal.className = 'conv-p-clip-modal';
    modal.innerHTML =
      '<div class="conv-p-clip-card">' +
        '<h3>Clip to Journal</h3>' +
        '<div style="font-size:0.65rem;color:var(--color-text-secondary,#9ca3af);">Save this question and reply to your journal.</div>' +
        '<div class="conv-p-clip-scope">' +
          '<label><input type="radio" name="clip-scope" value="private" checked><span>Private</span></label>' +
          '<label><input type="radio" name="clip-scope" value="crew"><span>Crew Journal</span></label>' +
        '</div>' +
        '<textarea id="conv-clip-notes" placeholder="Optional notes..."></textarea>' +
        '<div class="conv-p-clip-actions">' +
          '<button class="cancel">Cancel</button>' +
          '<button class="save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.cancel').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('.save').addEventListener('click', function () {
      var scope = (modal.querySelector('input[name="clip-scope"]:checked') || {}).value || 'private';
      var notes = modal.querySelector('#conv-clip-notes').value;
      var ch = chargeCharacter();
      fetch('/api/conversations/active/clip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, scope: scope, notes: notes, characterId: ch.characterId, characterName: ch.characterName })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.entry) {
          modal.remove();
          var toast = document.createElement('div');
          toast.className = 'nc-player-resolution-toast';
          toast.textContent = 'Clipped to ' + (scope === 'private' ? 'private' : 'crew') + ' journal.';
          document.body.appendChild(toast);
          setTimeout(function () { toast.remove(); }, 2400);
        } else {
          alert((data && data.error) || 'Failed to clip.');
        }
      });
    });
  }

  // ====== Sockets ======
  function wireSockets() {
    var sock = getSocket();
    if (!sock) { setTimeout(wireSockets, 500); return; }

    function update(d) {
      if (!d || !d.active) return;
      state.active = d.active;
      renderAll();
    }
    sock.on('conversation:start', function (d) { state.hidden = false; update(d); });
    sock.on('conversation:queued', update);
    sock.on('conversation:passed', update);
    sock.on('conversation:delivered', update);
    sock.on('conversation:beat-advanced', update);
    sock.on('conversation:ended', update);
  }

  function checkActiveOnLoad() {
    fetch('/api/conversations/active').then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.active && data.active.status === 'active') {
        state.active = data.active;
        renderAll();
      }
    }).catch(function () {});
  }

  window.ConversationOverlay = {
    open: function () {
      state.hidden = false;
      var peek = document.getElementById('conv-peek-btn');
      if (peek) peek.remove();
      if (state.active) renderAll();
      else checkActiveOnLoad();
    },
    isActive: function () { return state.active && state.active.status === 'active'; },
    launch: function (slug) {
      return fetch('/api/conversations/instances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.active) { state.active = data.active; renderAll(); }
        return data;
      });
    },
    listLibrary: function () {
      return fetch('/api/conversations/library').then(function (r) { return r.json(); });
    }
  };

  function init() {
    wireSockets();
    checkActiveOnLoad();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

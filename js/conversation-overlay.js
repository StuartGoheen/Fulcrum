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
      // Always release the live clock subscription before discarding the node,
      // otherwise GalacticClock.onChange listeners accumulate across re-renders.
      if (typeof existing.__convClockUnsub === 'function') {
        try { existing.__convClockUnsub(); } catch (e) {}
        existing.__convClockUnsub = null;
      }
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
    var convVoice = def.voice || (def.npc && def.npc.voice) || 'citizen';
    function _renderConvDate() {
      if (!(window.GalacticClock && typeof window.GalacticClock.formatForVoice === 'function')) return '';
      var voiced = window.GalacticClock.formatForVoice(convVoice);
      return voiced ? '<div class="conv-p-date" data-voice="' + escHtml(convVoice) + '">' + escHtml(voiced) + '</div>' : '';
    }
    header.innerHTML =
      '<div class="conv-p-header-text">' +
        '<div class="conv-p-title">' + escHtml(def.title || 'Conversation') + '</div>' +
        (npcName || def.subtitle ? '<div class="conv-p-subtitle">' + escHtml(def.subtitle || npcName) + '</div>' : '') +
        '<div class="conv-p-date-mount">' + _renderConvDate() + '</div>' +
      '</div>' +
      '<div class="conv-p-header-btns">' +
        '<button class="conv-p-icon-btn" id="conv-p-hide" title="Hide window">Hide</button>' +
      '</div>';
    win.appendChild(header);
    // Subscribe to clock changes so the date line stays current while the
    // overlay is open. Unsubscribe is bound to the close button below.
    var _convClockUnsub = null;
    if (window.GalacticClock && typeof window.GalacticClock.onChange === 'function') {
      _convClockUnsub = window.GalacticClock.onChange(function () {
        var mount = header.querySelector('.conv-p-date-mount');
        if (mount) mount.innerHTML = _renderConvDate();
      });
    }
    win.__convClockUnsub = _convClockUnsub;

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
      if (typeof win.__convClockUnsub === 'function') { try { win.__convClockUnsub(); } catch (e) {} win.__convClockUnsub = null; }
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
      // GM-only render code lives in the separate js/conversation-overlay-gm.js
      // bundle that the player HTML does not include. Without that module
      // loaded we simply do nothing — the player overlay never has GM markup
      // assembled in its DOM, no matter what the server payload contains.
      var gm = window.ConversationOverlayGm;
      if (!gm) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[conversation-overlay] GM module (conversation-overlay-gm.js) is not loaded; GM render skipped.');
        }
        return;
      }
      gm.injectStyles();
      if (!state.overlay || !state.overlay.classList.contains('conv-gm-window')) {
        gm.renderShell();
      } else {
        state.overlay.style.display = '';
      }
      gm.renderHeader();
      gm.renderLog();
      gm.renderSide();
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

  // Internal API consumed by the optional GM-only module
  // (js/conversation-overlay-gm.js). Player HTML never loads that module so
  // none of the GM render code reaches the player browser.
  window.__convOverlayInternal = {
    state: state,
    escHtml: escHtml,
    findQ: findQ,
    renderAll: renderAll,
    actions: {
      deliverResponse: deliverResponse,
      endConversation: endConversation
    }
  };

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

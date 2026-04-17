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
.conv-gm-overlay { position: fixed; inset: 0; background: rgba(5,5,12,0.92); z-index: 9000; display: flex; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #e8e8f0; }
.conv-gm-shell { flex: 1; display: flex; flex-direction: column; max-height: 100vh; }
.conv-gm-header { display: flex; align-items: center; gap: 16px; padding: 14px 22px; background: linear-gradient(180deg, #15151f, #0c0c14); border-bottom: 1px solid #2a2a3a; }
.conv-gm-header .h-title { font-weight: 600; font-size: 17px; letter-spacing: 0.4px; }
.conv-gm-header .h-sub { font-size: 12px; color: #8a8aa0; }
.conv-gm-header .h-spacer { flex: 1; }
.conv-pip { width: 11px; height: 11px; border-radius: 50%; background: #1f1f2c; border: 1px solid #2f2f40; }
.conv-pip.active { background: #4a90e2; border-color: #4a90e2; }
.conv-pip.warn { background: #d4a574; border-color: #d4a574; }
.conv-pip.danger { background: #d65a5a; border-color: #d65a5a; }
.conv-comfort-pips { display: inline-flex; gap: 4px; align-items: center; }
.conv-beat { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 10px; background: #1a1a26; border-radius: 4px; }
.conv-gm-close { background: transparent; color: #888; border: 1px solid #333; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.conv-gm-close:hover { color: #fff; border-color: #555; }
.conv-gm-body { flex: 1; display: grid; grid-template-columns: 1fr 380px; min-height: 0; }
.conv-gm-log { overflow-y: auto; padding: 22px 28px; background: #0a0a12; }
.conv-gm-log-entry { margin-bottom: 16px; }
.conv-gm-readaloud { background: rgba(212,165,116,0.06); border-left: 3px solid #d4a574; padding: 14px 18px; font-style: italic; line-height: 1.6; color: #c9c9d8; white-space: pre-wrap; border-radius: 0 6px 6px 0; }
.conv-gm-qa { background: #11111c; border: 1px solid #20202c; border-radius: 8px; padding: 14px 18px; }
.conv-gm-qa .who { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.conv-gm-qa .q { color: #6fb1ff; margin-bottom: 12px; font-size: 15px; }
.conv-gm-qa .a-speaker { font-size: 11px; color: #d4a574; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.conv-gm-qa .a { color: #e8e8f0; line-height: 1.55; white-space: pre-wrap; }
.conv-gm-qa .gm-note { margin-top: 12px; padding: 10px 12px; background: rgba(99,102,241,0.08); border-left: 2px solid #6366f1; font-size: 12px; color: #c7c7e0; line-height: 1.5; border-radius: 0 4px 4px 0; }
.conv-gm-pass { background: rgba(120,120,140,0.08); border-left: 2px solid #555; padding: 8px 14px; font-size: 12px; color: #888; border-radius: 0 4px 4px 0; }
.conv-gm-maya { background: rgba(143,107,178,0.08); border-left: 3px solid #8f6bb2; padding: 12px 16px; border-radius: 0 6px 6px 0; }
.conv-gm-maya .speaker { font-size: 11px; color: #b89cd6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.conv-gm-ended { text-align: center; padding: 30px; color: #888; font-style: italic; line-height: 1.6; border: 1px dashed #333; border-radius: 8px; background: rgba(0,0,0,0.3); }
.conv-gm-side { background: #10101a; border-left: 1px solid #2a2a3a; display: flex; flex-direction: column; min-height: 0; }
.conv-gm-side-header { padding: 12px 16px; border-bottom: 1px solid #2a2a3a; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; }
.conv-gm-side-body { flex: 1; overflow-y: auto; padding: 0; }
.gm-participants { padding: 10px 14px; font-size: 11px; color: #888; border-bottom: 1px solid #2a2a3a; line-height: 1.6; }
.gm-participants .pname { display: inline-block; padding: 2px 8px; background: #1a1a26; border-radius: 3px; margin: 0 4px 4px 0; }
.gm-participants .pname.acted { color: #4a90e2; border: 1px solid #4a90e2; }
.gm-queue { padding: 12px; }
.gm-queue-item { background: #161622; border: 1px solid #262636; border-radius: 6px; padding: 12px; margin-bottom: 10px; }
.gm-queue-item.passed { opacity: 0.6; border-style: dashed; }
.gm-queue-item .who { font-size: 11px; color: #b89cd6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.gm-queue-item .q { color: #6fb1ff; font-size: 13px; margin-bottom: 8px; }
.gm-queue-item .preview { background: #0a0a12; border-left: 2px solid #d4a574; padding: 8px 10px; font-size: 12px; color: #c7c7d6; line-height: 1.5; max-height: 220px; overflow-y: auto; margin-bottom: 8px; white-space: pre-wrap; }
.gm-queue-item .gm-note-prev { background: rgba(99,102,241,0.08); border-left: 2px solid #6366f1; padding: 6px 10px; font-size: 11px; color: #b8b8d6; margin-bottom: 8px; line-height: 1.5; }
.gm-queue-item .deliver-btn { width: 100%; padding: 8px; background: #4a90e2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; }
.gm-queue-item .deliver-btn:hover { background: #5aa0f2; }
.gm-empty { padding: 30px 20px; text-align: center; color: #666; font-style: italic; font-size: 13px; }
.gm-actions { padding: 10px; border-top: 1px solid #2a2a3a; }
.gm-actions button { width: 100%; padding: 8px; background: #2a1a1a; color: #d65a5a; border: 1px solid #3a2a2a; border-radius: 4px; cursor: pointer; font-size: 12px; }
.gm-actions button:hover { background: #3a2222; }
`;
    var s = document.createElement('style');
    s.id = GM_STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ====== Player floating modal ======
  function renderPlayerModal() {
    var existing = document.getElementById('conv-overlay');
    if (existing) existing.remove();
    if (!state.active) return;

    var a = state.active;
    var def = a.definition || {};
    var st = a.state || {};
    var ch = chargeCharacter();
    var npcName = (def.npc && def.npc.name) || '';

    var overlay = document.createElement('div');
    overlay.id = 'conv-overlay';
    overlay.className = 'conv-p-overlay';

    var modal = document.createElement('div');
    modal.className = 'conv-p-modal';
    overlay.appendChild(modal);

    // Header
    var header = document.createElement('div');
    header.className = 'conv-p-header';
    header.innerHTML =
      '<div class="conv-p-header-text">' +
        '<div class="conv-p-title">' + escHtml(def.title || 'Conversation') + '</div>' +
        (npcName || def.subtitle ? '<div class="conv-p-subtitle">' + escHtml(def.subtitle || npcName) + '</div>' : '') +
      '</div>' +
      '<button class="conv-p-hide-btn" id="conv-p-hide">Hide</button>';
    modal.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.className = 'conv-p-body';
    modal.appendChild(body);

    if (def.readAloud) {
      var ra = document.createElement('div');
      ra.className = 'conv-p-readaloud';
      ra.textContent = def.readAloud;
      body.appendChild(ra);
    }

    // Log
    var log = document.createElement('div');
    log.className = 'conv-p-log';
    (st.log || []).forEach(function (item) {
      var w = document.createElement('div');
      w.className = 'conv-p-log-entry';
      if (item.type === 'qa') {
        w.innerHTML =
          '<div class="conv-p-qa">' +
            '<div class="who">' + escHtml(item.characterName) + ' asked</div>' +
            '<div class="q">"' + escHtml(item.questionText) + '"</div>' +
            '<div class="a-speaker">' + escHtml(npcName || 'Reply') + '</div>' +
            '<div class="a">' + item.response + '</div>' +
            '<div class="conv-p-clip-row"><button class="conv-p-clip-btn" data-clip-q="' + escHtml(item.questionId) + '">+ Clip to Journal</button></div>' +
          '</div>';
      } else if (item.type === 'pass') {
        w.innerHTML = '<div class="conv-p-pass-log">' + escHtml(item.characterName) + ' passed.</div>';
      } else if (item.type === 'maya') {
        w.innerHTML =
          '<div class="conv-p-maya">' +
            '<div class="speaker">Maya</div>' +
            '<div class="text">' + item.text + '</div>' +
          '</div>';
      }
      log.appendChild(w);
    });
    body.appendChild(log);

    // Action area: topics OR waiting OR ended
    if (a.status === 'ended') {
      var endLine = (def.comfort && (def.comfort.dryLine || def.comfort.exitLine)) || 'The conversation has ended.';
      var ended = document.createElement('div');
      ended.className = 'conv-p-ended';
      ended.textContent = endLine;
      body.appendChild(ended);
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
        wait.className = 'conv-p-waiting';
        wait.innerHTML = '<div class="conv-p-waiting-icon">\u25CB</div><div>' + escHtml(msg) + '</div>';
        body.appendChild(wait);
      } else {
        body.appendChild(buildTopicsSection(def, st));
      }
    }

    document.body.appendChild(overlay);
    state.overlay = overlay;

    document.getElementById('conv-p-hide').addEventListener('click', function () {
      state.hidden = true;
      overlay.remove();
      state.overlay = null;
      showPeekButton();
    });

    Array.prototype.forEach.call(overlay.querySelectorAll('[data-clip-q]'), function (btn) {
      btn.addEventListener('click', function () { openClipModal(btn.getAttribute('data-clip-q')); });
    });

    Array.prototype.forEach.call(overlay.querySelectorAll('[data-ask-q]'), function (btn) {
      btn.addEventListener('click', function () { askQuestion(btn.getAttribute('data-ask-q')); });
    });

    var passBtn = overlay.querySelector('#conv-p-pass-btn');
    if (passBtn) passBtn.addEventListener('click', passBeat);

    var backBtn = overlay.querySelector('#conv-p-back-btn');
    if (backBtn) backBtn.addEventListener('click', function () {
      state.viewingFollowUps = null;
      renderPlayerModal();
    });

    Array.prototype.forEach.call(overlay.querySelectorAll('[data-followup-root]'), function (btn) {
      btn.addEventListener('click', function () {
        state.viewingFollowUps = btn.getAttribute('data-followup-root');
        renderPlayerModal();
      });
    });

    // auto-scroll log
    log.scrollTop = log.scrollHeight;
  }

  function buildTopicsSection(def, st) {
    var topics = document.createElement('div');
    topics.className = 'conv-p-topics';

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
      topics.innerHTML += '<button class="conv-p-pass-btn" id="conv-p-back-btn" style="margin-bottom:0.5rem;">\u2190 Back</button>';
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

  function showPeekButton() {
    var existing = document.getElementById('conv-peek-btn');
    if (existing) existing.remove();
    if (!state.active || state.active.status !== 'active') return;
    var def = state.active.definition || {};
    var btn = document.createElement('button');
    btn.id = 'conv-peek-btn';
    btn.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:9400;background:var(--color-bg-panel,#1a1a2e);border:2px solid var(--color-accent-primary,#c79234);color:var(--color-accent-primary,#c79234);font-family:Audiowide,sans-serif;font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;padding:0.6rem 0.9rem;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    btn.textContent = '\u270D ' + (def.title || 'Conversation');
    btn.addEventListener('click', function () {
      state.hidden = false;
      btn.remove();
      renderPlayerModal();
    });
    document.body.appendChild(btn);
  }

  // ====== GM full-screen workspace ======
  function renderGmShell() {
    var existing = document.getElementById('conv-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'conv-overlay';
    overlay.className = 'conv-gm-overlay';
    overlay.innerHTML =
      '<div class="conv-gm-shell">' +
        '<div class="conv-gm-header">' +
          '<div>' +
            '<div class="h-title" id="conv-h-title">Conversation</div>' +
            '<div class="h-sub" id="conv-h-sub"></div>' +
          '</div>' +
          '<div class="h-spacer"></div>' +
          '<div class="conv-beat" id="conv-h-beat">Beat 1</div>' +
          '<div class="conv-comfort-pips" id="conv-h-pips"></div>' +
          '<button class="conv-gm-close" id="conv-h-close">Hide</button>' +
        '</div>' +
        '<div class="conv-gm-body">' +
          '<div class="conv-gm-log" id="conv-log"></div>' +
          '<div class="conv-gm-side" id="conv-side"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    state.overlay = overlay;
    document.getElementById('conv-h-close').addEventListener('click', function () {
      overlay.style.display = 'none';
    });
  }

  function renderGmHeader() {
    var a = state.active; if (!a) return;
    var def = a.definition || {};
    document.getElementById('conv-h-title').textContent = def.title || 'Conversation';
    document.getElementById('conv-h-sub').textContent = def.subtitle || '';
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

    sideEl.innerHTML =
      '<div class="conv-gm-side-header"><span>GM Console</span></div>';

    var partsBlock = document.createElement('div');
    partsBlock.className = 'gm-participants';
    var parts = a.participants || [];
    var actedSet = new Set((st.actedThisBeat || []).map(String));
    partsBlock.innerHTML = '<strong>Participants ' + actedSet.size + '/' + parts.length + ' acted this beat:</strong> ' +
      parts.map(function (p) {
        var cls = actedSet.has(String(p.characterId)) ? 'pname acted' : 'pname';
        return '<span class="' + cls + '">' + escHtml(p.characterName) + '</span>';
      }).join('');
    sideEl.appendChild(partsBlock);

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
          var deliveredTag = item.status === 'delivered' ? '<div style="font-size:10px;color:#4a9c4a;text-transform:uppercase;letter-spacing:1px;">Delivered</div>' : '';
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
  function renderAll() {
    if (!state.active) return;
    if (isGm()) {
      injectGmStyles();
      if (!state.overlay || !state.overlay.classList.contains('conv-gm-overlay')) {
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

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

  var STYLE_ID = 'conversation-overlay-style';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = `
.conv-overlay { position: fixed; inset: 0; background: rgba(5,5,12,0.92); z-index: 9000; display: flex; align-items: stretch; justify-content: stretch; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #e8e8f0; }
.conv-shell { flex: 1; display: flex; flex-direction: column; max-height: 100vh; }
.conv-header { display: flex; align-items: center; gap: 16px; padding: 14px 22px; background: linear-gradient(180deg, #15151f, #0c0c14); border-bottom: 1px solid #2a2a3a; }
.conv-header .h-title { font-weight: 600; font-size: 17px; letter-spacing: 0.4px; }
.conv-header .h-sub { font-size: 12px; color: #8a8aa0; }
.conv-header .h-spacer { flex: 1; }
.conv-comfort-pips { display: inline-flex; gap: 4px; align-items: center; }
.conv-pip { width: 11px; height: 11px; border-radius: 50%; background: #1f1f2c; border: 1px solid #2f2f40; }
.conv-pip.active { background: #4a90e2; border-color: #4a90e2; }
.conv-pip.warn { background: #d4a574; border-color: #d4a574; }
.conv-pip.danger { background: #d65a5a; border-color: #d65a5a; }
.conv-beat { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 10px; background: #1a1a26; border-radius: 4px; }
.conv-close { background: transparent; color: #888; border: 1px solid #333; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.conv-close:hover { color: #fff; border-color: #555; }
.conv-body { flex: 1; display: grid; grid-template-columns: 1fr 380px; min-height: 0; }
.conv-log { overflow-y: auto; padding: 22px 28px; background: #0a0a12; }
.conv-log-entry { margin-bottom: 16px; animation: convFadeIn 0.4s ease; }
@keyframes convFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.conv-readaloud { background: rgba(212,165,116,0.06); border-left: 3px solid #d4a574; padding: 14px 18px; font-style: italic; line-height: 1.6; color: #c9c9d8; white-space: pre-wrap; border-radius: 0 6px 6px 0; }
.conv-qa { background: #11111c; border: 1px solid #20202c; border-radius: 8px; padding: 14px 18px; }
.conv-qa .who { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.conv-qa .q { color: #6fb1ff; margin-bottom: 12px; font-size: 15px; }
.conv-qa .a-speaker { font-size: 11px; color: #d4a574; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.conv-qa .a { color: #e8e8f0; line-height: 1.55; white-space: pre-wrap; }
.conv-qa .gm-note { margin-top: 12px; padding: 10px 12px; background: rgba(99,102,241,0.08); border-left: 2px solid #6366f1; font-size: 12px; color: #c7c7e0; line-height: 1.5; border-radius: 0 4px 4px 0; }
.conv-clip-row { display: flex; gap: 6px; margin-top: 10px; }
.conv-clip-btn { background: #1a1a26; color: #d4a574; border: 1px dashed #3a3a4a; padding: 5px 10px; font-size: 11px; border-radius: 4px; cursor: pointer; }
.conv-clip-btn:hover { background: #222238; border-color: #d4a574; }
.conv-pass { background: rgba(120,120,140,0.08); border-left: 2px solid #555; padding: 8px 14px; font-size: 12px; color: #888; border-radius: 0 4px 4px 0; }
.conv-maya { background: rgba(143,107,178,0.08); border-left: 3px solid #8f6bb2; padding: 12px 16px; border-radius: 0 6px 6px 0; }
.conv-maya .speaker { font-size: 11px; color: #b89cd6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.conv-ended { text-align: center; padding: 30px; color: #888; font-style: italic; line-height: 1.6; border: 1px dashed #333; border-radius: 8px; background: rgba(0,0,0,0.3); }
.conv-side { background: #10101a; border-left: 1px solid #2a2a3a; display: flex; flex-direction: column; min-height: 0; }
.conv-side-header { padding: 12px 16px; border-bottom: 1px solid #2a2a3a; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; }
.conv-side-body { flex: 1; overflow-y: auto; padding: 10px; }
.conv-back-btn { display: block; width: calc(100% - 16px); margin: 8px; padding: 10px 12px; background: #1a1a26; border: 1px dashed #3a3a4a; border-radius: 6px; color: #d4a574; font-size: 13px; cursor: pointer; }
.conv-back-btn:hover { background: #222238; border-color: #d4a574; }
.conv-q-group-label { padding: 12px 8px 6px; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1.5px; }
.conv-q-btn { display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 6px; background: #161622; border: 1px solid #262636; color: #d8d8e8; border-radius: 6px; cursor: pointer; font-size: 13px; line-height: 1.4; transition: all .15s; }
.conv-q-btn:hover { background: #1f1f30; border-color: #4a90e2; }
.conv-q-btn .type-tag { display: block; margin-top: 6px; font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
.conv-q-btn.story .type-tag { color: #4a90e2; }
.conv-q-btn.business .type-tag { color: #d4a574; }
.conv-q-btn.probe .type-tag { color: #d65a5a; }
.conv-q-btn.explored { opacity: .35; cursor: default; }
.conv-q-btn.locked { opacity: .35; cursor: default; border-style: dashed; }
.conv-q-btn.queued { background: #1a2a40; border-color: #4a90e2; cursor: default; }
.conv-pass-btn { display: block; width: calc(100% - 16px); margin: 12px 8px 8px; padding: 10px 12px; background: #1a1a26; border: 1px solid #444; color: #aaa; border-radius: 6px; cursor: pointer; font-size: 12px; }
.conv-pass-btn:hover { background: #2a2a3a; border-color: #888; color: #fff; }
.conv-acted-msg { padding: 14px; text-align: center; color: #888; font-size: 13px; font-style: italic; border: 1px dashed #333; border-radius: 6px; margin: 8px; }
.conv-clip-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9100; display: flex; align-items: center; justify-content: center; }
.conv-clip-card { width: min(520px, 92vw); background: #15151f; border: 1px solid #2a2a3a; border-radius: 10px; padding: 22px; }
.conv-clip-card h3 { margin: 0 0 12px; color: #d4a574; font-size: 15px; letter-spacing: 0.5px; }
.conv-clip-scope { display: flex; gap: 8px; margin: 12px 0; }
.conv-clip-scope label { flex: 1; padding: 10px; border: 1px solid #2a2a3a; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; }
.conv-clip-scope input { display: none; }
.conv-clip-scope input:checked + span { color: #d4a574; font-weight: 600; }
.conv-clip-scope label:has(input:checked) { border-color: #d4a574; background: rgba(212,165,116,0.08); }
.conv-clip-card textarea { width: 100%; box-sizing: border-box; padding: 10px; background: #0c0c14; color: #e8e8f0; border: 1px solid #2a2a3a; border-radius: 6px; font-family: inherit; font-size: 13px; resize: vertical; min-height: 90px; margin-top: 8px; }
.conv-clip-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.conv-clip-actions button { padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; border: 1px solid #333; }
.conv-clip-cancel { background: transparent; color: #aaa; }
.conv-clip-save { background: #4a90e2; border-color: #4a90e2; color: #fff; }
.conv-clip-save:hover { background: #5aa0f2; }

/* GM-specific */
.gm-mode .conv-side-body { padding: 0; }
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
.gm-participants { padding: 10px 14px; font-size: 11px; color: #888; border-bottom: 1px solid #2a2a3a; line-height: 1.6; }
.gm-participants .pname { display: inline-block; padding: 2px 8px; background: #1a1a26; border-radius: 3px; margin: 0 4px 4px 0; }
.gm-participants .pname.acted { color: #4a90e2; border: 1px solid #4a90e2; }
`;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ====== State ======
  var state = {
    overlay: null,
    active: null,           // server-provided active conversation
    viewingFollowUps: null  // root id whose follow-ups player is browsing
  };

  function getSocket() { return window.__sharedSocket || null; }

  function chargeCharacter() {
    var s = getSession();
    return {
      characterId: s && s.characterId ? String(s.characterId) : null,
      characterName: s && s.characterName ? s.characterName : 'Unknown'
    };
  }

  // ====== Rendering ======

  function renderShell() {
    var existing = document.getElementById('conv-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'conv-overlay';
    overlay.className = 'conv-overlay' + (isGm() ? ' gm-mode' : '');

    overlay.innerHTML =
      '<div class="conv-shell">' +
        '<div class="conv-header">' +
          '<div>' +
            '<div class="h-title" id="conv-h-title">Conversation</div>' +
            '<div class="h-sub" id="conv-h-sub"></div>' +
          '</div>' +
          '<div class="h-spacer"></div>' +
          '<div class="conv-beat" id="conv-h-beat">Beat 1</div>' +
          '<div class="conv-comfort-pips" id="conv-h-pips"></div>' +
          '<button class="conv-close" id="conv-h-close">Hide</button>' +
        '</div>' +
        '<div class="conv-body">' +
          '<div class="conv-log" id="conv-log"></div>' +
          '<div class="conv-side" id="conv-side"></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    state.overlay = overlay;

    document.getElementById('conv-h-close').addEventListener('click', function () {
      overlay.style.display = 'none';
    });

    return overlay;
  }

  function renderHeader() {
    var a = state.active;
    if (!a) return;
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

  function renderLog() {
    var a = state.active;
    var logEl = document.getElementById('conv-log');
    logEl.innerHTML = '';
    var def = a.definition || {};

    if (def.readAloud) {
      var ra = document.createElement('div');
      ra.className = 'conv-log-entry';
      ra.innerHTML = '<div class="conv-readaloud">' + escHtml(def.readAloud) + '</div>';
      logEl.appendChild(ra);
    }

    var st = a.state || {};
    var entries = st.log || [];
    entries.forEach(function (item) {
      var w = document.createElement('div');
      w.className = 'conv-log-entry';
      if (item.type === 'qa') {
        var npcName = (def.npc && def.npc.name) || 'NPC';
        var canClip = !isGm();
        w.innerHTML =
          '<div class="conv-qa">' +
            '<div class="who">Beat ' + item.beat + ' \u2014 ' + escHtml(item.characterName) + ' asked</div>' +
            '<div class="q">"' + escHtml(item.questionText) + '"</div>' +
            '<div class="a-speaker">' + escHtml(npcName) + '</div>' +
            '<div class="a">' + item.response + '</div>' +
            (item.gmNote && isGm() ? '<div class="gm-note"><strong>GM Note:</strong> ' + item.gmNote + '</div>' : '') +
            (canClip ? '<div class="conv-clip-row"><button class="conv-clip-btn" data-clip-q="' + escHtml(item.questionId) + '">+ Clip to Journal</button></div>' : '') +
          '</div>';
      } else if (item.type === 'pass') {
        w.innerHTML = '<div class="conv-pass">Beat ' + item.beat + ' \u2014 ' + escHtml(item.characterName) + ' passed.</div>';
      } else if (item.type === 'maya') {
        w.innerHTML =
          '<div class="conv-maya">' +
            '<div class="speaker">Maya</div>' +
            '<div>' + item.text + '</div>' +
            (item.gmNote && isGm() ? '<div class="gm-note" style="margin-top:8px;"><strong>GM Note:</strong> ' + item.gmNote + '</div>' : '') +
          '</div>';
      }
      logEl.appendChild(w);
    });

    if (a.status === 'ended') {
      var end = document.createElement('div');
      end.className = 'conv-log-entry';
      var line = (def.comfort && (def.comfort.dryLine || def.comfort.exitLine)) || 'The conversation has ended.';
      end.innerHTML = '<div class="conv-ended">' + escHtml(line) + '</div>';
      logEl.appendChild(end);
    }

    // Wire clip buttons
    Array.prototype.forEach.call(logEl.querySelectorAll('[data-clip-q]'), function (btn) {
      btn.addEventListener('click', function () { openClipModal(btn.getAttribute('data-clip-q')); });
    });

    logEl.scrollTop = logEl.scrollHeight;
  }

  function findQ(def, id) {
    var r = (def.roots || []).find(function (x) { return x.id === id; });
    if (r) return r;
    return (def.followUps || {})[id] || null;
  }

  function isExplored(id) {
    var st = state.active.state || {};
    return (st.explored || []).indexOf(id) !== -1;
  }

  function isQueued(id, charId) {
    var st = state.active.state || {};
    return (st.queue || []).some(function (q) {
      return q.questionId === id && q.status === 'pending' &&
        (charId == null || String(q.characterId) === String(charId));
    });
  }

  function isLocked(q) {
    return !!(q.minComfort && state.active.comfort < q.minComfort);
  }

  function makeQBtn(q) {
    var btn = document.createElement('button');
    btn.className = 'conv-q-btn ' + (q.type || '');
    var costNote = (q.comfortCost && q.comfortCost < 0) ? ' \u2022 costs comfort' : '';
    btn.innerHTML = escHtml(q.text) + '<span class="type-tag">' + (q.type || '') + costNote + '</span>';
    if (isExplored(q.id)) {
      btn.classList.add('explored');
    } else if (isQueued(q.id)) {
      btn.classList.add('queued');
      btn.innerHTML = escHtml(q.text) + '<span class="type-tag">Queued \u2014 awaiting GM</span>';
    } else if (isLocked(q)) {
      btn.classList.add('locked');
    } else {
      btn.addEventListener('click', function () { askQuestion(q.id); });
    }
    return btn;
  }

  function renderPlayerSide() {
    var sideEl = document.getElementById('conv-side');
    var a = state.active;
    var ch = chargeCharacter();
    var st = a.state || {};
    var def = a.definition || {};

    sideEl.innerHTML =
      '<div class="conv-side-header">' +
        '<span>Topics</span>' +
        '<span id="conv-explored-count"></span>' +
      '</div>';

    var sideBody = document.createElement('div');
    sideBody.className = 'conv-side-body';
    sideEl.appendChild(sideBody);

    if (a.status === 'ended') {
      sideBody.innerHTML = '<div class="conv-acted-msg">The conversation has ended.</div>';
      updateExploredCount();
      return;
    }

    var actedThisBeat = (st.actedThisBeat || []).indexOf(String(ch.characterId)) !== -1;
    if (actedThisBeat) {
      var myAction = (st.queue || []).find(function (q) {
        return String(q.characterId) === String(ch.characterId) && q.beat === a.beat;
      });
      var msg = 'Waiting for the GM to deliver responses and advance the beat.';
      if (myAction && myAction.action === 'ask' && myAction.status === 'pending') {
        msg = 'Your question is queued. Waiting for the GM to deliver the response.';
      } else if (myAction && myAction.action === 'pass') {
        msg = 'You passed this beat. Waiting for the others.';
      }
      sideBody.innerHTML = '<div class="conv-acted-msg">' + escHtml(msg) + '</div>';
      updateExploredCount();
      return;
    }

    if (state.viewingFollowUps) {
      var backBtn = document.createElement('button');
      backBtn.className = 'conv-back-btn';
      backBtn.textContent = '\u2190 Back to topics';
      backBtn.addEventListener('click', function () { state.viewingFollowUps = null; renderPlayerSide(); });
      sideBody.appendChild(backBtn);

      var followUps = ((findQ(def, state.viewingFollowUps) || {}).unlocks || [])
        .map(function (uid) { return (def.followUps || {})[uid]; })
        .filter(function (q) { return q && !isExplored(q.id); });
      if (followUps.length) {
        var lbl = document.createElement('div');
        lbl.className = 'conv-q-group-label';
        lbl.textContent = 'Follow-up Questions';
        sideBody.appendChild(lbl);
        followUps.forEach(function (q) { sideBody.appendChild(makeQBtn(q)); });
      }
    } else {
      var topicsLbl = document.createElement('div');
      topicsLbl.className = 'conv-q-group-label';
      topicsLbl.textContent = 'Topics';
      sideBody.appendChild(topicsLbl);
      (def.roots || []).forEach(function (q) { sideBody.appendChild(makeQBtn(q)); });

      var unlocked = (st.unlocked || [])
        .map(function (uid) { return (def.followUps || {})[uid]; })
        .filter(function (q) { return q && !isExplored(q.id); });
      if (unlocked.length) {
        var ulbl = document.createElement('div');
        ulbl.className = 'conv-q-group-label';
        ulbl.textContent = 'Unlocked Follow-ups';
        sideBody.appendChild(ulbl);
        unlocked.forEach(function (q) { sideBody.appendChild(makeQBtn(q)); });
      }
    }

    var passBtn = document.createElement('button');
    passBtn.className = 'conv-pass-btn';
    passBtn.textContent = 'Pass this beat';
    passBtn.addEventListener('click', passBeat);
    sideBody.appendChild(passBtn);

    updateExploredCount();
  }

  function updateExploredCount() {
    var a = state.active; if (!a) return;
    var def = a.definition || {};
    var total = (def.roots || []).length + Object.keys(def.followUps || {}).length;
    var explored = ((a.state || {}).explored || []).length;
    var el = document.getElementById('conv-explored-count');
    if (el) el.textContent = explored + ' / ' + total + ' explored';
  }

  function renderGmSide() {
    var sideEl = document.getElementById('conv-side');
    var a = state.active;
    var st = a.state || {};
    var def = a.definition || {};

    sideEl.innerHTML =
      '<div class="conv-side-header">' +
        '<span>GM Console</span>' +
        '<span id="conv-explored-count"></span>' +
      '</div>';

    var partsBlock = document.createElement('div');
    partsBlock.className = 'gm-participants';
    var parts = a.participants || [];
    var actedSet = new Set((st.actedThisBeat || []).map(String));
    partsBlock.innerHTML = '<strong>Participants ' + actedSet.size + '/' + parts.length + ' acted this beat:</strong> ' +
      parts.map(function (p) {
        var cls = actedSet.has(String(p.characterId)) ? 'pname acted' : 'pname';
        return '<span class="' + cls + '">' + escHtml(p.characterName) + '</span>';
      }).join('') ;
    sideEl.appendChild(partsBlock);

    var sideBody = document.createElement('div');
    sideBody.className = 'conv-side-body';
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

    updateExploredCount();
  }

  function renderAll() {
    if (!state.active) return;
    if (!state.overlay) renderShell();
    renderHeader();
    renderLog();
    if (isGm()) renderGmSide(); else renderPlayerSide();
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
    modal.className = 'conv-clip-modal';
    modal.innerHTML =
      '<div class="conv-clip-card">' +
        '<h3>Clip to Journal</h3>' +
        '<div style="font-size:12px;color:#888;">Save this question and the response to your journal.</div>' +
        '<div class="conv-clip-scope">' +
          '<label><input type="radio" name="clip-scope" value="private" checked><span>Private (just me)</span></label>' +
          '<label><input type="radio" name="clip-scope" value="crew"><span>Crew Journal (everyone)</span></label>' +
        '</div>' +
        '<textarea id="conv-clip-notes" placeholder="Optional notes..."></textarea>' +
        '<div class="conv-clip-actions">' +
          '<button class="conv-clip-cancel">Cancel</button>' +
          '<button class="conv-clip-save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.conv-clip-cancel').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('.conv-clip-save').addEventListener('click', function () {
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
          toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#4a9c4a;color:#fff;padding:10px 18px;border-radius:6px;z-index:9200;font-size:13px;';
          toast.textContent = 'Clipped to ' + (scope === 'private' ? 'private' : 'crew') + ' journal.';
          document.body.appendChild(toast);
          setTimeout(function () { toast.remove(); }, 2400);
        } else {
          alert((data && data.error) || 'Failed to clip.');
        }
      });
    });
  }

  // ====== Socket wiring ======
  function wireSockets() {
    var sock = getSocket();
    if (!sock) { setTimeout(wireSockets, 500); return; }

    function update(d) {
      if (!d || !d.active) return;
      state.active = d.active;
      if (state.overlay) {
        state.overlay.style.display = '';
      } else {
        renderShell();
      }
      renderAll();
    }

    sock.on('conversation:start', function (d) { update(d); });
    sock.on('conversation:queued', function (d) { update(d); });
    sock.on('conversation:passed', function (d) { update(d); });
    sock.on('conversation:delivered', function (d) { update(d); });
    sock.on('conversation:beat-advanced', function (d) { update(d); });
    sock.on('conversation:ended', function (d) { update(d); });
  }

  function checkActiveOnLoad() {
    fetch('/api/conversations/active').then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.active && data.active.status === 'active') {
        state.active = data.active;
        renderShell();
        renderAll();
      }
    }).catch(function () {});
  }

  // ====== Public API ======
  window.ConversationOverlay = {
    open: function () {
      if (state.overlay) state.overlay.style.display = '';
      else if (state.active) { renderShell(); renderAll(); }
      else checkActiveOnLoad();
    },
    isActive: function () { return state.active && state.active.status === 'active'; },
    launch: function (slug) {
      return fetch('/api/conversations/instances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.active) { state.active = data.active; renderShell(); renderAll(); }
        return data;
      });
    },
    listLibrary: function () {
      return fetch('/api/conversations/library').then(function (r) { return r.json(); });
    }
  };

  // ====== Init ======
  function init() {
    injectStyles();
    wireSockets();
    checkActiveOnLoad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

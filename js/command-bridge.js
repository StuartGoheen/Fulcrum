(function () {
  var THEMES = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader', 'theme-fett', 'theme-holo'];
  var THEME_KEY = 'eote-theme';

  function applyTheme(theme) {
    THEMES.forEach(function (t) { document.documentElement.classList.remove(t); });
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function cycleTheme() {
    var current = THEMES.find(function (t) { return document.documentElement.classList.contains(t); }) || THEMES[0];
    var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    applyTheme(next);
  }

  function initTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored && THEMES.indexOf(stored) !== -1 ? stored : THEMES[0]);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CONDITION_MAP = {
    'disoriented': 'condition_disoriented', 'rattled': 'condition_rattled',
    'optimized': 'condition_optimized', 'weakened': 'condition_weakened',
    'empowered': 'condition_empowered', 'shaken': 'condition_shaken',
    'exposed': 'condition_exposed', 'pinned': 'condition_pinned',
    'prone': 'condition_prone', 'hazard': 'condition_hazard',
    'guarded': 'condition_guarded', 'cover': 'condition_cover',
    'buffered': 'condition_buffered', 'blinded': 'condition_blinded',
    'shut down': 'condition_shut_down', 'restrained': 'condition_restrained',
    'suppressed': 'condition_suppressed', 'bleeding': 'condition_bleeding',
    'stunned': 'condition_stunned', 'incapacitated': 'condition_incapacitated',
    'marked': 'condition_marked', 'locked on': 'condition_locked_on',
    'slowed': 'condition_slowed', 'elusive': 'condition_elusive',
    'jammed': 'condition_jammed',
    'stimmed': 'stimmed', 'natural recovery': 'natural_recovery',
  };

  function linkify(str) {
    var s = String(str);
    var out = '';
    var re = /\[([^\]]+)\]/g;
    var last = 0;
    var match;
    while ((match = re.exec(s)) !== null) {
      out += esc(s.slice(last, match.index));
      var inner = match[1];
      var normalized = inner.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
      var glossaryId = CONDITION_MAP[normalized];
      if (glossaryId) {
        out += '<span class="cb-condition-link" data-condition-id="' + esc(glossaryId) + '">[' + esc(inner) + ']</span>';
      } else {
        out += '[' + esc(inner) + ']';
      }
      last = match.index + match[0].length;
    }
    out += esc(s.slice(last));
    return out;
  }

  var socket = typeof io !== 'undefined' ? io() : null;

  var adventuresData = null;
  var progressData = { adventure_id: 'adv1', part_id: 'adv1-p1', scene_id: 'adv1-p1-s1' };
  var completionsData = {};
  var currentAdventure = null;
  var currentPart = null;
  var currentScene = null;
  var glossaryData = null;

  function getAdventure(id) { return adventuresData ? adventuresData.adventures.find(function (a) { return a.id === id; }) : null; }
  function getPart(adv, pid) { return (adv.parts || []).find(function (p) { return p.id === pid; }); }
  function getScene(part, sid) { return (part.scenes || []).find(function (s) { return s.id === sid; }); }

  function getAllScenes() {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    return part ? (part.scenes || []) : [];
  }

  function currentSceneIndex() {
    var scenes = getAllScenes();
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].id === currentScene) return i;
    }
    return -1;
  }

  function initCampaign() {
    Promise.all([
      fetch('/api/campaign/adventures').then(function (r) { return r.json(); }),
      fetch('/api/campaign/progress').then(function (r) { return r.json(); })
    ]).then(function (results) {
      adventuresData = results[0];
      progressData = results[1].progress;
      completionsData = results[1].completions || {};
      currentAdventure = progressData.adventure_id;
      currentPart = progressData.part_id;
      currentScene = progressData.scene_id;
      renderAdvNav();
      renderPartNav();
      renderScene();
      renderSceneCounter();
      loadPartyMonitor();
    }).catch(function (err) {
      var el = document.getElementById('scene-carousel');
      if (el) el.innerHTML = '<p style="color:var(--color-accent-primary);font-size:0.85rem;">Failed to load campaign data: ' + esc(err.message) + '</p>';
    });
  }

  function renderAdvNav() {
    var nav = document.getElementById('adv-nav');
    if (!nav || !adventuresData) return;
    nav.innerHTML = adventuresData.adventures.map(function (adv) {
      var isActive = adv.id === currentAdventure;
      return '<button class="cb-nav-btn' + (isActive ? ' active' : '') + '" data-adv="' + adv.id + '">' +
        '<span class="cb-nav-num">' + adv.number + '</span>' +
        '<span>' + esc(adv.title) + '</span>' +
      '</button>';
    }).join('');
    nav.querySelectorAll('.cb-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var advId = btn.dataset.adv;
        var adv = getAdventure(advId);
        if (!adv || !(adv.parts || []).length) return;
        currentAdventure = advId;
        currentPart = adv.parts[0].id;
        var firstScene = (adv.parts[0].scenes || [])[0];
        currentScene = firstScene ? firstScene.id : null;
        renderAdvNav();
        renderPartNav();
        renderScene();
        renderSceneCounter();
        if (currentScene) saveProgress();
      });
    });
  }

  function renderPartNav() {
    var adv = getAdventure(currentAdventure);
    var nav = document.getElementById('part-nav');
    if (!nav || !adv) return;
    nav.innerHTML = (adv.parts || []).map(function (part) {
      var isActive = part.id === currentPart;
      return '<button class="cb-nav-btn cb-part-btn' + (isActive ? ' active' : '') + '" data-part="' + part.id + '">' +
        'Part ' + part.number + ': ' + esc(part.title) +
      '</button>';
    }).join('');
    nav.querySelectorAll('.cb-part-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var partId = btn.dataset.part;
        var adv = getAdventure(currentAdventure);
        var part = getPart(adv, partId);
        if (!part) return;
        currentPart = partId;
        var firstScene = (part.scenes || [])[0];
        currentScene = firstScene ? firstScene.id : null;
        renderPartNav();
        renderScene();
        renderSceneCounter();
        if (currentScene) saveProgress();
      });
    });
  }

  function renderSceneCounter() {
    var el = document.getElementById('scene-counter');
    if (!el) return;
    var scenes = getAllScenes();
    var idx = currentSceneIndex();
    if (scenes.length === 0) {
      el.textContent = '';
      return;
    }
    el.textContent = 'Scene ' + (idx + 1) + ' of ' + scenes.length;
  }

  function navigateScene(dir) {
    var scenes = getAllScenes();
    var idx = currentSceneIndex();
    var next = idx + dir;
    if (next < 0 || next >= scenes.length) return;
    currentScene = scenes[next].id;
    renderScene();
    renderSceneCounter();
    saveProgress();
  }

  function renderScene() {
    var container = document.getElementById('scene-carousel');
    if (!container) return;
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;

    if (!scene) {
      if (adv && part && !(part.scenes || []).length) {
        container.innerHTML = '<div class="cb-empty-scene"><h3>' + esc(adv.title) + ' — Part ' + part.number + ': ' + esc(part.title) + '</h3><p>Scene content for this part is coming soon.</p></div>';
      } else {
        container.innerHTML = '<div class="cb-empty-scene"><p>Select a scene to begin.</p></div>';
      }
      return;
    }

    var comp = completionsData[scene.id];
    var isDone = comp && comp.completed;
    var scenes = getAllScenes();
    var idx = currentSceneIndex();

    var html = '';

    html += '<div class="cb-scene-header">';
    html += '<h2>Scene ' + scene.number + ': ' + esc(scene.title) + '</h2>';
    if (scene.subtitle) html += '<div class="cb-scene-subtitle">' + esc(scene.subtitle) + '</div>';
    html += '</div>';

    if (scene.readAloud) {
      html += '<div class="cb-read-aloud">';
      html += '<div class="cb-section-label">Player Read-Aloud</div>';
      html += '<div class="cb-read-aloud-text">' + linkify(scene.readAloud) + '</div>';
      html += '</div>';
    }

    if (scene.gmNotes) {
      html += '<div class="cb-gm-notes">';
      html += '<div class="cb-section-label">GM Notes</div>';
      html += '<div>' + linkify(scene.gmNotes) + '</div>';
      html += '</div>';
    }

    if (scene.npcs && scene.npcs.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">NPC Roster</div>';
      html += '<div class="cb-npc-grid">';
      html += '<div class="cb-npc-row cb-npc-header"><div>Name</div><div>Type</div><div>Count</div><div>Notes</div></div>';
      scene.npcs.forEach(function (npc) {
        html += '<div class="cb-npc-row"><div class="cb-npc-name">' + esc(npc.name) + '</div><div>' + esc(npc.type) + '</div><div style="text-align:center;font-family:Audiowide,sans-serif;color:var(--color-accent-primary);">' + npc.count + '</div><div style="color:var(--color-text-secondary);">' + linkify(npc.notes || '') + '</div></div>';
      });
      html += '</div></div>';
    }

    if (scene.hazards) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Hazards / Environment</div>';
      html += '<div>' + linkify(scene.hazards) + '</div>';
      html += '</div>';
    }

    if (scene.decisions && scene.decisions.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Decision Points</div>';
      scene.decisions.forEach(function (d) {
        html += '<div class="cb-decision"><div class="cb-decision-choice">' + esc(d.choice) + '</div><div class="cb-decision-consequence">' + esc(d.consequence) + '</div></div>';
      });
      html += '</div>';
    }

    if (scene.loreTags && scene.loreTags.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Lore Tags</div>';
      html += '<div class="cb-lore-tags">';
      scene.loreTags.forEach(function (tag) {
        html += '<span class="cb-lore-tag" data-lore-tag="' + esc(tag) + '">' + esc(tag) + '</span>';
      });
      html += '</div></div>';
    }

    if (scene.narrativeLinks && scene.narrativeLinks.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Narrative Links</div>';
      scene.narrativeLinks.forEach(function (link) {
        html += '<a class="cb-narrative-link" data-nav-scene="' + esc(link.targetScene) + '">&rarr; ' + esc(link.note) + '</a>';
      });
      html += '</div>';
    }

    html += '<div class="cb-scene-footer">';
    html += '<button class="cb-complete-btn' + (isDone ? ' completed' : '') + '" data-scene="' + scene.id + '">' + (isDone ? '&#10003; Scene Complete' : '&#9675; Mark Scene Complete') + '</button>';
    html += '<div class="cb-scene-nav-arrows">';
    html += '<button class="cb-arrow-btn" id="scene-prev"' + (idx <= 0 ? ' disabled' : '') + '>&larr; Prev</button>';
    html += '<button class="cb-arrow-btn" id="scene-next"' + (idx >= scenes.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.cb-lore-tag').forEach(function (el) {
      el.addEventListener('click', function () { openLoreModal(el.dataset.loreTag); });
    });
    container.querySelectorAll('.cb-narrative-link').forEach(function (el) {
      el.addEventListener('click', function () { navigateToScene(el.dataset.navScene); });
    });
    container.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
    var completeBtn = container.querySelector('.cb-complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function () { toggleSceneComplete(completeBtn.dataset.scene); });
    }
    var prevBtn = document.getElementById('scene-prev');
    var nextBtn = document.getElementById('scene-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { navigateScene(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { navigateScene(1); });
  }

  function toggleSceneComplete(sceneId) {
    var current = completionsData[sceneId];
    var newState = !(current && current.completed);
    fetch('/api/campaign/scene/' + sceneId + '/complete', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: newState })
    }).then(function (res) {
      if (!res.ok) throw new Error('Server error');
      if (!completionsData[sceneId]) completionsData[sceneId] = {};
      completionsData[sceneId].completed = newState ? 1 : 0;
      renderScene();
    }).catch(function (err) { console.error('Failed to update scene completion:', err); });
  }

  function saveProgress() {
    if (!currentAdventure || !currentPart || !currentScene) return;
    fetch('/api/campaign/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adventure_id: currentAdventure, part_id: currentPart, scene_id: currentScene })
    }).catch(function (err) { console.error('Failed to save progress:', err); });
  }

  function navigateToScene(sceneId) {
    if (!adventuresData) return;
    adventuresData.adventures.forEach(function (adv) {
      (adv.parts || []).forEach(function (part) {
        (part.scenes || []).forEach(function (scene) {
          if (scene.id === sceneId) {
            currentAdventure = adv.id;
            currentPart = part.id;
            currentScene = scene.id;
            renderAdvNav();
            renderPartNav();
            renderScene();
            renderSceneCounter();
            saveProgress();
          }
        });
      });
    });
  }

  function openLoreModal(tag) {
    var overlay = document.getElementById('lore-modal-overlay');
    var title = document.getElementById('lore-modal-title');
    var body = document.getElementById('lore-modal-body');
    title.textContent = 'Lore: ' + tag;
    body.innerHTML = '<p style="color:var(--color-text-secondary);">Loading...</p>';
    overlay.classList.add('active');
    fetch('/api/campaign/lore-tags/' + encodeURIComponent(tag))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.scenes || !data.scenes.length) {
          body.innerHTML = '<p style="color:var(--color-text-secondary);">No scenes found with this tag.</p>';
          return;
        }
        body.innerHTML = data.scenes.map(function (s) {
          return '<div class="cb-lore-scene-link" data-nav-scene="' + esc(s.sceneId) + '">' +
            '<div style="font-weight:600;">Adventure ' + s.adventureNumber + ': ' + esc(s.adventureTitle) + '</div>' +
            '<div style="color:var(--color-text-secondary);font-size:0.8rem;">Part ' + s.partNumber + ': ' + esc(s.partTitle) + ' — Scene ' + s.sceneNumber + ': ' + esc(s.sceneTitle) + '</div>' +
          '</div>';
        }).join('');
        body.querySelectorAll('.cb-lore-scene-link').forEach(function (el) {
          el.addEventListener('click', function () {
            overlay.classList.remove('active');
            navigateToScene(el.dataset.navScene);
          });
        });
      })
      .catch(function () { body.innerHTML = '<p style="color:var(--color-accent-primary);">Failed to load lore data.</p>'; });
  }

  function loadPartyMonitor() {
    fetch('/api/campaign/party')
      .then(function (r) { return r.json(); })
      .then(function (data) { renderPartyList(data.party || []); })
      .catch(function () {
        var el = document.getElementById('party-list');
        if (el) el.innerHTML = '<p class="cb-muted">Failed to load party data.</p>';
      });
  }

  function renderPartyList(party) {
    var list = document.getElementById('party-list');
    if (!list) return;
    if (!party.length) {
      list.innerHTML = '<p class="cb-muted" style="font-style:italic;">No characters found.</p>';
      return;
    }
    list.innerHTML = party.map(function (pc) {
      return '<div class="cb-player-card ' + (pc.connected ? 'connected' : 'disconnected') + '">' +
        '<div class="cb-player-top">' +
          '<div>' +
            '<div class="cb-player-name">' + esc(pc.name) + '</div>' +
            '<div class="cb-player-detail">' + esc(pc.species || '') + (pc.archetype ? ' — ' + esc(pc.archetype) : '') + '</div>' +
          '</div>' +
          (pc.vitality !== null ? '<div class="cb-player-vitality">' + pc.vitality + '</div>' : '') +
        '</div>' +
        '<div class="cb-player-status">' +
          (pc.connected ? '<span style="color:#44AA66;">&#9679; Connected</span>' : '<span>&#9899; Offline</span>') +
          (pc.marks != null ? ' <span style="color:var(--color-accent-primary);margin-left:0.5rem;">' + pc.marks + ' Marks</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderGmDestinyPool(pool) {
    var container = document.getElementById('gm-destiny-tokens');
    var countEl = document.getElementById('gm-destiny-count');
    if (!container) return;
    if (!pool || pool.length === 0) {
      container.innerHTML = '<span class="cb-muted" style="font-style:italic;">No crew connected</span>';
      if (countEl) countEl.textContent = '';
      return;
    }
    container.innerHTML = pool.map(function (t, idx) {
      var isDark = t.side === 'toll';
      var tappedCls = t.tapped ? ' is-tapped' : '';
      return '<div class="gm-destiny-token' + (isDark ? ' is-dark' : '') + tappedCls + '" data-index="' + idx + '" title="Click to flip">' +
        '<div class="force-token-inner">' +
          '<div class="force-token-face force-token-front"></div>' +
          '<div class="force-token-face force-token-back"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    container.querySelectorAll('.gm-destiny-token').forEach(function (el) {
      el.addEventListener('click', function () {
        if (socket) socket.emit('destiny:flip', { index: parseInt(el.dataset.index, 10) });
      });
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (socket) socket.emit('destiny:untap-one', { index: parseInt(el.dataset.index, 10) });
      });
    });
    if (countEl) {
      var hopeCount = pool.filter(function (t) { return t.side === 'hope'; }).length;
      var tollCount = pool.filter(function (t) { return t.side === 'toll'; }).length;
      var tappedCount = pool.filter(function (t) { return t.tapped; }).length;
      var summary = '<span class="hope-count">' + hopeCount + 'H</span> / <span class="toll-count">' + tollCount + 'T</span>';
      if (tappedCount > 0) summary += ' <span style="color:var(--color-text-secondary);">(' + tappedCount + ' tapped)</span>';
      countEl.innerHTML = summary;
    }
  }

  function loadGlossary() {
    fetch('/data/glossary.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { glossaryData = data; })
      .catch(function () { console.error('Failed to load glossary'); });
  }

  function showGlossaryEntry(id) {
    var panel = document.getElementById('glossary-content');
    if (!panel) return;
    if (!glossaryData) {
      panel.innerHTML = '<p class="cb-muted">Glossary data not loaded.</p>';
      return;
    }
    var entry = glossaryData.find(function (e) { return e.id === id; });
    if (!entry) {
      panel.innerHTML = '<p class="cb-muted">Entry not found: ' + esc(id) + '</p>';
      return;
    }

    var html = '';
    html += '<div class="cb-glossary-header">' + esc(entry.name) + '</div>';
    if (entry.type) html += '<div class="cb-glossary-type">' + esc(entry.type) + '</div>';

    if (entry.rule) {
      var pcNpc = splitPcNpc(entry.rule);
      if (pcNpc.pc || pcNpc.npc) {
        html += '<div class="cb-glossary-dual">';
        html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:#5588CC;">PC Effect</div><div>' + linkify(pcNpc.pc || entry.rule) + '</div></div>';
        html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:var(--color-accent-secondary);">NPC Effect</div><div>' + linkify(pcNpc.npc || '—') + '</div></div>';
        html += '</div>';
      } else {
        html += '<div class="cb-glossary-rule">' + linkify(entry.rule) + '</div>';
      }
    }

    if (entry.guide) {
      html += '<div class="cb-glossary-guide">' + esc(entry.guide) + '</div>';
    }

    panel.innerHTML = html;

    panel.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
  }

  function splitPcNpc(ruleText) {
    if (!ruleText) return { pc: '', npc: '' };
    var pcMatch = ruleText.match(/PC:\s*(.*?)(?=\s*NPC:|$)/s);
    var npcMatch = ruleText.match(/NPC:\s*(.*?)(?=\s*PC:|$)/s);
    return { pc: pcMatch ? pcMatch[1].trim() : '', npc: npcMatch ? npcMatch[1].trim() : '' };
  }

  function initDragHandles() {
    var leftHandle = document.getElementById('drag-left');
    var rightHandle = document.getElementById('drag-right');
    var grid = document.getElementById('bridge-grid');
    if (!grid) return;

    function setupDrag(handle, side) {
      if (!handle) return;
      var dragging = false;

      handle.addEventListener('mousedown', startDrag);
      handle.addEventListener('touchstart', startDrag, { passive: false });

      function startDrag(e) {
        e.preventDefault();
        dragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
      }

      function onDrag(e) {
        if (!dragging) return;
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var gridRect = grid.getBoundingClientRect();

        if (side === 'left') {
          var leftW = Math.max(200, Math.min(450, clientX - gridRect.left));
          grid.style.gridTemplateColumns = leftW + 'px 6px 1fr 6px auto';
          var rightCol = grid.querySelector('.cb-col-right');
          if (rightCol) {
            var rightW = parseInt(rightCol.style.width) || 300;
            grid.style.gridTemplateColumns = leftW + 'px 6px 1fr 6px ' + rightW + 'px';
          }
        } else {
          var rightW = Math.max(240, Math.min(500, gridRect.right - clientX));
          grid.style.gridTemplateColumns = 'auto 6px 1fr 6px ' + rightW + 'px';
          var leftCol = grid.querySelector('.cb-col-left');
          if (leftCol) {
            var leftW = parseInt(getComputedStyle(leftCol).width) || 260;
            grid.style.gridTemplateColumns = leftW + 'px 6px 1fr 6px ' + rightW + 'px';
          }
        }
      }

      function stopDrag() {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
      }
    }

    setupDrag(leftHandle, 'left');
    setupDrag(rightHandle, 'right');
  }

  function renderStarshipStatus(active, seats) {
    var statusEl = document.getElementById('sc-status');
    var seatsEl = document.getElementById('sc-seats');
    var endBtn = document.getElementById('cb-end-starship');
    var seatsSection = document.getElementById('sc-seats-section');
    if (statusEl) {
      statusEl.textContent = active ? 'ACTIVE' : 'Inactive';
      statusEl.style.color = active ? '#22c55e' : 'var(--color-text-secondary)';
    }
    if (endBtn) endBtn.style.display = active ? '' : 'none';
    if (seatsSection) seatsSection.style.display = active ? '' : 'none';
    if (seatsEl && seats) {
      var keys = Object.keys(seats);
      if (!keys.length) {
        seatsEl.innerHTML = '<div class="cb-muted">No stations claimed.</div>';
      } else {
        seatsEl.innerHTML = keys.map(function (sid) {
          var s = seats[sid];
          var label = sid.replace('station_', '').replace(/^\w/, function (c) { return c.toUpperCase(); });
          return '<div style="padding:0.15rem 0;">' + esc(label) + ': <strong>' + esc(s.characterName || 'Unknown') + '</strong></div>';
        }).join('');
      }
    }
  }

  function initSockets() {
    if (!socket) return;
    socket.emit('session:join', { role: 'gm' });
    socket.emit('destiny:request');

    socket.on('destiny:sync', function (data) {
      renderGmDestinyPool(data.pool || data);
    });

    socket.on('player:connected', function () { loadPartyMonitor(); });
    socket.on('player:disconnected', function () { loadPartyMonitor(); });
    socket.on('state:sync', function () { loadPartyMonitor(); });
    socket.on('advancement:sync', function () { loadPartyMonitor(); });

    socket.emit('shipcombat:request');
    socket.on('shipcombat:sync', function (data) {
      window._scActive = !!data.active;
      renderStarshipStatus(data.active, data.seats);
    });
    socket.on('shipcombat:seats_update', function (data) {
      if (data.seats) renderStarshipStatus(window._scActive, data.seats);
    });
  }

  var destinyUntapBtn = document.getElementById('gm-destiny-untap');
  var destinyResetBtn = document.getElementById('gm-destiny-reset');
  if (destinyUntapBtn) destinyUntapBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:untap'); });
  if (destinyResetBtn) destinyResetBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:reset'); });

  var themeBtn = document.getElementById('cb-theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

  var logoutBtn = document.getElementById('cb-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function () { window.location.href = '/login'; })
      .catch(function () { window.location.href = '/login'; });
  });

  var scLaunchBtn = document.getElementById('cb-launch-starship');
  if (scLaunchBtn) {
    scLaunchBtn.addEventListener('click', function () {
      if (socket) socket.emit('shipcombat:enter');
    });
  }

  var scEndBtn = document.getElementById('cb-end-starship');
  if (scEndBtn) {
    scEndBtn.addEventListener('click', function () {
      if (socket) socket.emit('shipcombat:exit');
    });
  }

  document.getElementById('lore-modal-close').addEventListener('click', function () {
    document.getElementById('lore-modal-overlay').classList.remove('active');
  });
  document.getElementById('lore-modal-overlay').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  initTheme();
  initDragHandles();
  initSockets();
  initCampaign();
  loadGlossary();
}());

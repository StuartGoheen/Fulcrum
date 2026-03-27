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
  var sceneIntelData = null;
  var partyCache = [];

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
      loadSceneIntel(currentScene);
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
        if (npc.behavior) {
          html += '<div class="cb-npc-detail-row" style="grid-column:1/-1;padding:0.15rem 0.5rem;font-size:0.7rem;color:var(--color-text-secondary);border-left:2px solid var(--color-accent-primary);margin-left:0.5rem;"><strong>Behavior:</strong> ' + linkify(npc.behavior) + '</div>';
        }
        if (npc.dialogue && npc.dialogue.length) {
          html += '<div class="cb-npc-detail-row" style="grid-column:1/-1;padding:0.15rem 0.5rem;font-size:0.7rem;color:var(--color-accent-secondary,#c084fc);border-left:2px solid var(--color-accent-secondary,#c084fc);margin-left:0.5rem;"><strong>Dialogue:</strong> ' + npc.dialogue.map(function(d){ return linkify(d); }).join(' ') + '</div>';
        }
        if (npc.intel) {
          html += '<div class="cb-npc-detail-row" style="grid-column:1/-1;padding:0.15rem 0.5rem;font-size:0.7rem;color:#f59e0b;border-left:2px solid #f59e0b;margin-left:0.5rem;"><strong>Intel:</strong> ' + linkify(npc.intel) + '</div>';
        }
      });
      html += '</div></div>';
    }

    if (scene.hazards) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Hazards / Environment</div>';
      html += '<div>' + linkify(scene.hazards) + '</div>';
      html += '</div>';
    }

    if (scene.encounters && scene.encounters.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Encounters</div>';
      scene.encounters.forEach(function (enc) {
        var typeColor = enc.type === 'combat' ? 'var(--color-danger,#ef4444)' : enc.type === 'social' ? 'var(--color-accent-secondary,#c084fc)' : enc.type === 'infiltration' ? '#818cf8' : 'var(--color-accent-primary)';
        html += '<div style="margin-bottom:0.5rem;padding:0.4rem;border-left:3px solid ' + typeColor + ';background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;"><strong style="color:var(--color-text-primary);font-size:0.8rem;">' + esc(enc.name) + '</strong><span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + typeColor + ';color:#000;font-family:Audiowide,sans-serif;text-transform:uppercase;">' + esc(enc.type) + '</span></div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;"><strong>Trigger:</strong> ' + linkify(enc.trigger) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">' + linkify(enc.description) + '</div>';
        if (enc.tactics) html += '<div style="font-size:0.7rem;color:var(--color-accent-primary);"><strong>Tactics:</strong> ' + linkify(enc.tactics) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (scene.skillChecks && scene.skillChecks.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Skill Checks</div>';
      scene.skillChecks.forEach(function (sc) {
        var diffColor = sc.difficulty === 'Easy' ? '#22c55e' : sc.difficulty === 'Moderate' ? '#eab308' : sc.difficulty === 'Hard' ? '#f97316' : '#ef4444';
        html += '<div style="margin-bottom:0.4rem;padding:0.3rem 0.4rem;border-radius:4px;background:rgba(0,0,0,0.1);">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.15rem;">';
        html += '<span style="font-size:0.75rem;color:var(--color-accent-primary);font-family:Audiowide,sans-serif;">' + esc((sc.discipline || '').replace(/_/g, ' ')) + '</span>';
        html += '<span style="font-size:0.6rem;padding:0.05rem 0.25rem;border-radius:3px;background:' + diffColor + ';color:#000;font-family:Audiowide,sans-serif;">' + esc(sc.difficulty) + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.1rem;">' + linkify(sc.context) + '</div>';
        html += '<div style="font-size:0.65rem;color:#22c55e;">&#10003; ' + linkify(sc.success) + '</div>';
        html += '<div style="font-size:0.65rem;color:#ef4444;">&#10007; ' + linkify(sc.failure) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (scene.environmentMechanics && scene.environmentMechanics.length) {
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Environment Mechanics</div>';
      scene.environmentMechanics.forEach(function (em) {
        html += '<div style="margin-bottom:0.4rem;padding:0.3rem 0.4rem;border-left:2px solid var(--color-accent-deep,#818cf8);border-radius:0 4px 4px 0;background:rgba(0,0,0,0.1);">';
        html += '<div style="font-size:0.8rem;color:var(--color-text-primary);font-weight:bold;margin-bottom:0.1rem;">' + esc(em.name) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.1rem;"><strong>Trigger:</strong> ' + linkify(em.trigger) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.1rem;"><strong>Effect:</strong> ' + linkify(em.effect) + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--color-accent-primary);"><strong>Mitigation:</strong> ' + linkify(em.mitigation) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (scene.rewards) {
      var r = scene.rewards;
      var hasRewardContent = r.credits || (r.items && r.items.length) || (r.intel && r.intel.length) || (r.connections && r.connections.length);
      if (hasRewardContent) {
        html += '<div class="cb-card">';
        html += '<div class="cb-section-label">Rewards</div>';
        if (r.credits) html += '<div style="font-size:0.7rem;color:var(--color-accent-primary);margin-bottom:0.15rem;">&#9670; Credits: ' + r.credits + '</div>';
        if (r.items && r.items.length) html += '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">&#9670; Items: ' + r.items.map(function(i){return esc(i);}).join(', ') + '</div>';
        if (r.intel && r.intel.length) {
          html += '<div style="font-size:0.7rem;color:#f59e0b;margin-bottom:0.15rem;">&#9670; Intel:</div>';
          r.intel.forEach(function(i){ html += '<div style="font-size:0.65rem;color:var(--color-text-secondary);padding-left:0.8rem;">• ' + linkify(i) + '</div>'; });
        }
        if (r.connections && r.connections.length) html += '<div style="font-size:0.7rem;color:var(--color-accent-secondary,#c084fc);margin-bottom:0.15rem;">&#9670; Connections: ' + r.connections.map(function(c){return esc(c);}).join(', ') + '</div>';
        html += '</div>';
      }
    }

    if (scene.pacing) {
      var p = scene.pacing;
      html += '<div class="cb-card">';
      html += '<div class="cb-section-label">Pacing Guide' + (p.estimatedMinutes ? ' (~' + p.estimatedMinutes + ' min)' : '') + '</div>';
      if (p.openingBeat) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:var(--color-accent-primary);font-family:Audiowide,sans-serif;font-size:0.6rem;">OPENING</span> ' + linkify(p.openingBeat) + '</div>';
      if (p.risingAction) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#eab308;font-family:Audiowide,sans-serif;font-size:0.6rem;">RISING</span> ' + linkify(p.risingAction) + '</div>';
      if (p.climax) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:var(--color-danger,#ef4444);font-family:Audiowide,sans-serif;font-size:0.6rem;">CLIMAX</span> ' + linkify(p.climax) + '</div>';
      if (p.resolution) html += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#22c55e;font-family:Audiowide,sans-serif;font-size:0.6rem;">RESOLUTION</span> ' + linkify(p.resolution) + '</div>';
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
    loadSceneIntel(currentScene);
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
      .then(function (data) {
        partyCache = data.party || [];
        renderPartyList(partyCache);
      })
      .catch(function () {
        var el = document.getElementById('party-list');
        if (el) el.innerHTML = '<p class="cb-muted">Failed to load party data.</p>';
      });
  }

  function loadSceneIntel(sceneId) {
    if (!sceneId) { sceneIntelData = null; renderPartyList(partyCache); return; }
    fetch('/api/campaign/scene-intel/' + encodeURIComponent(sceneId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sceneIntelData = data;
        renderPartyList(partyCache);
      })
      .catch(function () {
        sceneIntelData = null;
        renderPartyList(partyCache);
      });
  }

  function renderPartyList(party) {
    var list = document.getElementById('party-list');
    if (!list) return;
    if (!party.length) {
      list.innerHTML = '<p class="cb-muted" style="font-style:italic;">No characters found.</p>';
      return;
    }

    var hasIntel = sceneIntelData && sceneIntelData.hasTags;
    var html = '';

    if (hasIntel) {
      var typeLabel = sceneIntelData.challengeType ? sceneIntelData.challengeType.toUpperCase() : 'TAGGED';
      html += '<div class="cb-scene-intel-bar"><span class="cb-intel-pulse"></span> Scene Intel Active — ' + esc(typeLabel) + '</div>';
    }

    html += party.map(function (pc) {
      var intelForChar = null;
      if (hasIntel && sceneIntelData.intel) {
        intelForChar = sceneIntelData.intel.find(function (i) { return i.id === pc.id; });
      }
      var insights = intelForChar ? intelForChar.insights || [] : [];

      var vocLabel = '';
      if (pc.vocations && pc.vocations.length) {
        vocLabel = pc.vocations.map(function (v) {
          return esc(v.name || v.kitId || '') + ' T' + (v.tier || 1);
        }).join(', ');
      }

      var cardHtml = '<div class="cb-player-card ' + (pc.connected ? 'connected' : 'disconnected') + '" data-char-id="' + esc(pc.id) + '">';
      cardHtml += '<div class="cb-player-top">';
      cardHtml += '<div>';
      cardHtml += '<div class="cb-player-name">' + esc(pc.name) + ' <span class="cb-player-expand-icon">&#9654;</span></div>';
      cardHtml += '<div class="cb-player-detail">' + esc(pc.species || '') + (pc.archetype ? ' — ' + esc(pc.archetype) : '') + '</div>';
      cardHtml += '</div>';
      cardHtml += (pc.vitality !== null ? '<div class="cb-player-vitality">' + pc.vitality + '</div>' : '');
      cardHtml += '</div>';

      cardHtml += '<div class="cb-player-status">';
      cardHtml += (pc.connected ? '<span style="color:#44AA66;">&#9679; Connected</span>' : '<span>&#9899; Offline</span>');
      cardHtml += (pc.marks != null ? ' <span style="color:var(--color-accent-primary);margin-left:0.5rem;">' + pc.marks + ' Marks</span>' : '');
      cardHtml += '</div>';

      if (insights.length) {
        insights.forEach(function (ins) {
          var ratingCls = '';
          var labelHtml = esc(ins.label);
          if (ins.rating) {
            ratingCls = ' rating-' + ins.rating;
            labelHtml = '<span class="rating-' + esc(ins.rating) + '">' + esc(ins.label) + '</span>';
          }
          cardHtml += '<div class="cb-intel-row type-' + esc(ins.type) + ratingCls + '">';
          cardHtml += '<span class="cb-intel-icon">' + (ins.icon || '·') + '</span>';
          cardHtml += '<span>' + labelHtml + '</span>';
          cardHtml += '</div>';
        });
      }

      cardHtml += '<div class="cb-player-body">';

      if (vocLabel) {
        cardHtml += '<div class="cb-player-vocations">' + vocLabel + '</div>';
      }

      if (pc.vocationAbilities && pc.vocationAbilities.length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">Abilities</div>';
        pc.vocationAbilities.forEach(function (a) {
          cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);padding:0.02rem 0;">';
          cardHtml += '<span style="color:var(--color-accent-primary);">T' + a.tier + '</span> ';
          cardHtml += esc(a.name);
          if (a.type) cardHtml += ' <span style="opacity:0.5;">(' + esc(a.type) + ')</span>';
          cardHtml += '</div>';
        });
        cardHtml += '</div>';
      }

      if (pc.conditions && pc.conditions.length) {
        cardHtml += '<div class="cb-player-conditions">';
        pc.conditions.forEach(function (c) {
          cardHtml += '<span class="cb-condition-pip">' + esc(c) + '</span>';
        });
        cardHtml += '</div>';
      }

      if (pc.destiny) {
        var destName = pc.destiny.name || pc.destiny.id || '';
        if (destName) {
          cardHtml += '<div style="font-size:0.65rem;color:var(--color-accent-secondary,#c084fc);margin-top:0.2rem;">Destiny: ' + esc(destName) + '</div>';
          if (pc.destiny.coreQuestion) {
            cardHtml += '<div style="font-size:0.55rem;color:var(--color-text-secondary);opacity:0.7;padding-left:0.3rem;">' + esc(pc.destiny.coreQuestion) + '</div>';
          }
        }
      }

      if (pc.backgroundFavored && pc.backgroundFavored.length) {
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-accent-deep,#818cf8);margin-top:0.15rem;">Favored: ' + pc.backgroundFavored.map(function (f) { return esc(f.replace(/_/g, ' ')); }).join(', ') + '</div>';
      }

      var ARENA_GROUPS = [
        { id: 'physique', label: 'PHY', discs: ['athletics','brawl','endure','melee','heavy_weapons'] },
        { id: 'reflex', label: 'REF', discs: ['evasion','piloting','ranged','skulduggery','stealth'] },
        { id: 'grit', label: 'GRT', discs: ['beast_handling','intimidate','resolve','survival','control_spark'] },
        { id: 'wits', label: 'WIT', discs: ['investigation','medicine','tactics','tech','sense_spark'] },
        { id: 'presence', label: 'PRS', discs: ['charm','deception','insight','persuasion','alter_spark'] },
      ];

      if (pc.disciplines && Object.keys(pc.disciplines).length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">Disciplines</div>';
        ARENA_GROUPS.forEach(function (arena) {
          var arenaDie = pc.arenas && pc.arenas[arena.id] ? pc.arenas[arena.id] : '';
          cardHtml += '<div style="font-size:0.58rem;margin-top:0.15rem;">';
          cardHtml += '<span style="color:var(--color-accent-primary);font-family:Audiowide,sans-serif;">' + arena.label + '</span>';
          if (arenaDie) cardHtml += ' <span style="color:var(--color-text-secondary);opacity:0.7;">' + esc(arenaDie) + '</span>';
          cardHtml += '</div>';
          arena.discs.forEach(function (discId) {
            var disc = pc.disciplines[discId];
            if (!disc) return;
            var trained = disc.training === 'trained' || disc.training === 'formative';
            var color = disc.favored ? 'var(--color-accent-secondary,#c084fc)' : trained ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
            var opacity = trained || disc.favored ? '1' : '0.4';
            cardHtml += '<div style="font-size:0.55rem;color:' + color + ';opacity:' + opacity + ';padding:0.01rem 0 0.01rem 0.5rem;">';
            cardHtml += esc(discId.replace(/_/g, ' '));
            if (disc.die) cardHtml += ' ' + esc(disc.die);
            if (disc.favored) cardHtml += ' ★';
            cardHtml += '</div>';
          });
        });
        cardHtml += '</div>';
      }

      if (pc.gear && pc.gear.length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:var(--color-text-secondary);margin-bottom:0.15rem;">Gear (' + pc.gear.length + ')</div>';
        pc.gear.forEach(function (g) {
          var tagStr = (g.tags || []).concat(g.traits || []).filter(Boolean).join(', ');
          var isRestricted = (g.tags || []).some(function(t){ return /restricted|illegal/i.test(t); }) || (g.availability && /restricted|illegal/i.test(g.availability));
          var color = isRestricted ? 'var(--color-danger,#ef4444)' : 'var(--color-text-secondary)';
          cardHtml += '<div style="font-size:0.6rem;color:' + color + ';padding:0.05rem 0;">' + esc(g.name);
          if (g.availability) cardHtml += ' <span style="opacity:0.6;">[' + esc(g.availability) + ']</span>';
          if (tagStr) cardHtml += ' <span style="opacity:0.5;">(' + esc(tagStr) + ')</span>';
          cardHtml += '</div>';
        });
        cardHtml += '</div>';
      }

      cardHtml += '</div>';
      cardHtml += '</div>';
      return cardHtml;
    }).join('');

    list.innerHTML = html;

    list.querySelectorAll('.cb-player-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        card.classList.toggle('expanded');
      });
    });
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

  function loadItemRequests() {
    fetch('/api/item-requests')
      .then(function (r) { return r.json(); })
      .then(function (data) { renderItemRequests(data.requests || []); })
      .catch(function () {
        var el = document.getElementById('item-requests-list');
        if (el) el.innerHTML = '<p class="cb-muted">Failed to load requests.</p>';
      });
  }

  function renderItemRequests(requests) {
    var list = document.getElementById('item-requests-list');
    var badge = document.getElementById('req-badge');
    if (!list) return;

    var pendingCount = requests.filter(function (r) { return r.status === 'pending'; }).length;
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }

    if (!requests.length) {
      list.innerHTML = '<p class="cb-muted" style="font-style:italic;">No item requests yet.</p>';
      return;
    }

    list.innerHTML = requests.map(function (req) {
      var date = new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var html = '<div class="cb-req-card status-' + esc(req.status) + '">';
      html += '<span class="cb-req-status-tag ' + esc(req.status) + '">' + esc(req.status) + '</span>';
      html += '<div class="cb-req-item-name">' + esc(req.item_name) + '</div>';
      html += '<div class="cb-req-char">' + esc(req.character_name) + ' &middot; ' + date + '</div>';
      if (req.description) html += '<div class="cb-req-desc">' + esc(req.description) + '</div>';
      if (req.reference_url) html += '<div><a class="cb-req-link" href="' + esc(req.reference_url) + '" target="_blank">' + esc(req.reference_url) + '</a></div>';
      if (req.gm_notes) html += '<div style="font-size:0.7rem;color:var(--color-accent-secondary);margin-top:0.2rem;">GM: ' + esc(req.gm_notes) + '</div>';
      if (req.status === 'pending') {
        html += '<div class="cb-req-actions">';
        html += '<button class="cb-req-action approve" data-req-id="' + req.id + '" data-req-action="approved">Approve</button>';
        html += '<button class="cb-req-action deny" data-req-id="' + req.id + '" data-req-action="denied">Deny</button>';
        html += '<button class="cb-req-action" data-req-id="' + req.id + '" data-req-action="converted">Converted</button>';
        html += '</div>';
      }
      html += '</div>';
      return html;
    }).join('');

    list.querySelectorAll('.cb-req-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var reqId = btn.dataset.reqId;
        var action = btn.dataset.reqAction;
        fetch('/api/item-requests/' + reqId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action })
        }).then(function (r) {
          if (!r.ok) throw new Error('Server error');
          loadItemRequests();
        }).catch(function (err) { console.error('Failed to update request:', err); });
      });
    });
  }

  initTheme();
  initDragHandles();
  initSockets();
  initCampaign();
  loadGlossary();
  loadItemRequests();
}());

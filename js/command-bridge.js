(function () {
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
    'attack': 'action_attack', 'aim': 'action_aim', 'move': 'action_move',
    'reload': 'action_reload', 'take cover': 'action_take_cover',
    'overwatch': 'action_overwatch', 'draw / holster': 'action_draw_holster',
    'assess': 'action_assess', 'treat injury': 'action_treat_injury',
    'interact': 'action_interact', 'join battle': 'action_join_battle',
    'dodge': 'action_dodge', 'endure': 'action_endure', 'resist': 'action_resist',
    'coordinate': 'action_coordinate', 'command beast': 'action_command_beast',
    'centering focus': 'force_centering_focus', 'force sense': 'force_sense',
    'telekinesis': 'force_telekinesis',
  };

  function _slugToTitle(slug) {
    return String(slug || '').replace(/[-_]/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  }

  function _resolveEncounterName(encId) {
    if (!encId) return null;
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    if (!scene || !scene.encounters) return null;
    for (var i = 0; i < scene.encounters.length; i++) {
      if (scene.encounters[i].id === encId) return scene.encounters[i].name || encId;
    }
    return null;
  }

  function linkify(str) {
    var s = String(str);
    var out = '';
    var re = /\[([^\]]+)\]/g;
    var last = 0;
    var match;
    while ((match = re.exec(s)) !== null) {
      out += esc(s.slice(last, match.index));
      var inner = match[1];

      var mapMatch = inner.match(/^map:(.+)$/);
      if (mapMatch) {
        var mapKey = mapMatch[1].trim();
        var mapTitle = _slugToTitle(mapKey);
        out += '<span class="cb-map-link" data-map-key="' + esc(mapKey) + '" title="Open tactical map">&#128506; ' + esc(mapTitle) + '</span>';
        last = match.index + match[0].length;
        continue;
      }

      var convMatch = inner.match(/^conversation:(.+)$/);
      if (convMatch) {
        var convSlug = convMatch[1].trim();
        var convTitle = _slugToTitle(convSlug);
        out += '<span class="cb-conversation-link" data-conv-slug="' + esc(convSlug) + '" title="Launch conversation overlay">&#128172; ' + esc(convTitle) + '</span>';
        last = match.index + match[0].length;
        continue;
      }

      var encMatch = inner.match(/^encounter:(.+)$/);
      if (encMatch) {
        var encId = encMatch[1].trim();
        var encName = _resolveEncounterName(encId) || _slugToTitle(encId);
        out += '<span class="cb-encounter-link" data-enc-id="' + esc(encId) + '" title="Start encounter in combat tracker">&#9876; ' + esc(encName) + '</span>';
        last = match.index + match[0].length;
        continue;
      }

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

  function _proseInlineFormat(text) {
    var s = String(text == null ? '' : text);
    var m = s.match(/^([^a-z\n:]{4,80}:)(\s+|$)/);
    if (m) {
      return '<strong class="cb-prose-label">' + esc(m[1]) + '</strong>' + (m[2] ? ' ' : '') + linkify(s.substring(m[0].length));
    }
    return linkify(s);
  }

  function _formatProse(text) {
    if (text == null) return '';
    var s = String(text).replace(/\r\n/g, '\n').trim();
    if (!s) return '';
    var paragraphs = s.split(/\n\n+/);
    var html = '';
    paragraphs.forEach(function (para) {
      var lines = para.split(/\n/).map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim().length > 0; });
      if (!lines.length) return;
      var i = 0;
      var pendingHeader = null;
      while (i < lines.length) {
        var line = lines[i].replace(/^\s+/, '');
        var headerOnly = line.match(/^([^a-z\n:]{4,80}):$/);
        if (headerOnly && (i + 1 < lines.length)) {
          pendingHeader = headerOnly[1];
          i++;
          continue;
        }
        if (/^[•\-]\s+/.test(line)) {
          var items = [];
          while (i < lines.length) {
            var cur = lines[i].replace(/^\s+/, '');
            if (!/^[•\-]\s+/.test(cur)) break;
            items.push(cur.replace(/^[•\-]\s+/, ''));
            i++;
          }
          var listHtml = '<ul class="cb-prose-list">';
          items.forEach(function (it) { listHtml += '<li>' + _proseInlineFormat(it) + '</li>'; });
          listHtml += '</ul>';
          if (pendingHeader) {
            html += '<div class="cb-prose-section"><div class="cb-prose-header">' + esc(pendingHeader) + '</div>' + listHtml + '</div>';
            pendingHeader = null;
          } else {
            html += listHtml;
          }
        } else {
          var paraBuf = [];
          while (i < lines.length) {
            var cur2 = lines[i].replace(/^\s+/, '');
            if (/^[•\-]\s+/.test(cur2)) break;
            var hdr2 = cur2.match(/^([^a-z\n:]{4,80}):$/);
            if (hdr2 && (i + 1 < lines.length) && paraBuf.length) break;
            paraBuf.push(cur2);
            i++;
          }
          var paraText = paraBuf.join(' ');
          if (pendingHeader) {
            html += '<div class="cb-prose-section"><div class="cb-prose-header">' + esc(pendingHeader) + '</div><p>' + _proseInlineFormat(paraText) + '</p></div>';
            pendingHeader = null;
          } else {
            html += '<p>' + _proseInlineFormat(paraText) + '</p>';
          }
        }
      }
      if (pendingHeader) {
        html += '<div class="cb-prose-header">' + esc(pendingHeader) + '</div>';
        pendingHeader = null;
      }
    });
    return html;
  }

  var socket = typeof io !== 'undefined' ? io() : null;
  if (socket) window.__sharedSocket = socket;

  var adventuresData = null;
  var progressData = { adventure_id: 'adv1', part_id: 'adv1-p1', scene_id: 'adv1-p1-s1' };
  var completionsData = {};
  var currentAdventure = null;
  var currentPart = null;
  var currentScene = null;
  var glossaryData = null;
  var maneuversData = null;
  var sceneIntelData = null;
  var partyCache = [];

  function getAdventure(id) { return adventuresData ? adventuresData.adventures.find(function (a) { return a.id === id; }) : null; }
  function getPart(adv, pid) { return (adv.parts || []).find(function (p) { return p.id === pid; }); }
  function getScene(part, sid) { return (part.scenes || []).find(function (s) { return s.id === sid; }); }

  function _getSceneAdaptations(sceneId) {
    if (!adventuresData) return [];
    var results = [];
    var adventures = adventuresData.adventures || [];
    for (var i = 0; i < adventures.length; i++) {
      var adap = adventures[i]._adaptations;
      if (!adap) continue;
      for (var j = 0; j < adap.length; j++) {
        if (adap[j].target === sceneId) {
          for (var k = 0; k < adap[j].adaptations.length; k++) {
            results.push(adap[j].adaptations[k]);
          }
        }
      }
    }
    return results;
  }

  function _getPartAdaptations(partId) {
    if (!adventuresData) return [];
    var results = [];
    var adventures = adventuresData.adventures || [];
    for (var i = 0; i < adventures.length; i++) {
      var adap = adventures[i]._adaptations;
      if (!adap) continue;
      for (var j = 0; j < adap.length; j++) {
        if (adap[j].target === partId) {
          for (var k = 0; k < adap[j].adaptations.length; k++) {
            results.push(adap[j].adaptations[k]);
          }
        }
      }
    }
    return results;
  }

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
      renderAdvSelect();
      renderAdvNav();
      renderPartSelect();
      renderPartNav();
      renderScene();
      renderSceneCounter();
      loadPartyMonitor();
      loadSceneIntel(currentScene);
    }).catch(function (err) {
      var el = document.getElementById('scene-carousel');
      if (el) el.innerHTML = '<p style="color:#c8a44e;font-size:0.85rem;">Failed to load campaign data: ' + esc(err.message) + '</p>';
    });
  }

  function selectAdventure(advId) {
    var adv = getAdventure(advId);
    if (!adv || !(adv.parts || []).length) return;
    closeAllFloatingPanels();
    currentAdventure = advId;
    currentPart = adv.parts[0].id;
    var firstScene = (adv.parts[0].scenes || [])[0];
    currentScene = firstScene ? firstScene.id : null;
    renderAdvNav();
    renderAdvSelect();
    renderPartNav();
    renderPartSelect();
    renderScene();
    renderSceneCounter();
    if (currentScene) saveProgress();
  }

  function renderAdvSelect() {
    var el = document.getElementById('cb-header-adv');
    if (!el || !adventuresData) return;
    var adv = getAdventure(currentAdventure);
    el.textContent = adv ? adv.title : '';
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
        selectAdventure(btn.dataset.adv);
      });
    });
  }

  function selectPart(partId) {
    var adv = getAdventure(currentAdventure);
    var part = getPart(adv, partId);
    if (!part) return;
    closeAllFloatingPanels();
    currentPart = partId;
    var firstScene = (part.scenes || [])[0];
    currentScene = firstScene ? firstScene.id : null;
    renderPartNav();
    renderPartSelect();
    renderScene();
    renderSceneCounter();
    if (currentScene) saveProgress();
  }

  function renderPartSelect() {
    var el = document.getElementById('cb-header-part');
    var adv = getAdventure(currentAdventure);
    if (!el || !adv) return;
    var part = getPart(adv, currentPart);
    el.textContent = part ? 'Part ' + part.number + ': ' + part.title : '';
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
        selectPart(btn.dataset.part);
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
    var leavingSceneId = currentScene;
    // Offer to log key decisions for the scene we're leaving (if it has any
    // decisionPoints and none have been logged yet for this adventure).
    // Captured before the swap so openDecisionModal sees the correct scene.
    if (leavingSceneId) promptDecisionOnComplete(leavingSceneId);
    currentScene = scenes[next].id;
    closeAllFloatingPanels();
    renderScene();
    renderSceneCounter();
    saveProgress();
  }

  var _lastRenderedScene = null;
  var _npcExpandState = {};
  var _sceneNpcOverrides = {};
  var _runSceneActive = {};
  var _runSceneBeat = {};
  var _runSceneCollapsed = {};

  function _runStorageKey(sceneId) { return 'cb-runscene:' + sceneId; }
  function _isRunSceneActive(sceneId) {
    if (sceneId in _runSceneActive) return !!_runSceneActive[sceneId];
    try {
      var raw = localStorage.getItem(_runStorageKey(sceneId));
      if (raw) {
        var parsed = JSON.parse(raw);
        _runSceneActive[sceneId] = !!parsed.active;
        if (typeof parsed.beat === 'number') _runSceneBeat[sceneId] = parsed.beat;
        if (parsed.collapsed && typeof parsed.collapsed === 'object') {
          Object.keys(parsed.collapsed).forEach(function (k) { _runSceneCollapsed[k] = !!parsed.collapsed[k]; });
        }
        return !!parsed.active;
      }
    } catch (_) {}
    _runSceneActive[sceneId] = false;
    return false;
  }
  function _persistRunScene(sceneId) {
    try {
      var collapsed = {};
      Object.keys(_runSceneCollapsed).forEach(function (k) {
        if (k.indexOf(sceneId + ':') === 0) collapsed[k] = _runSceneCollapsed[k];
      });
      localStorage.setItem(_runStorageKey(sceneId), JSON.stringify({
        active: !!_runSceneActive[sceneId],
        beat: _runSceneBeat[sceneId] || 0,
        collapsed: collapsed
      }));
    } catch (_) {}
  }
  function _setRunSceneActive(sceneId, on) {
    _runSceneActive[sceneId] = !!on;
    if (on && typeof _runSceneBeat[sceneId] !== 'number') _runSceneBeat[sceneId] = 0;
    _persistRunScene(sceneId);
  }
  function _setRunSceneBeat(sceneId, idx) {
    _runSceneBeat[sceneId] = Math.max(0, idx | 0);
    _persistRunScene(sceneId);
  }
  function _getRunSceneBeat(sceneId) {
    _isRunSceneActive(sceneId);
    return Math.max(0, (_runSceneBeat[sceneId] | 0));
  }

  function ensureComputedAttacks(npc) {
    if (!npc.threatBuild) return;
    var tb = npc.threatBuild;
    if (tb.attacks && tb.attacks.length && !tb.computedAttacks) {
      if (window.NpcBuilder) {
        window.NpcBuilder.ensureThreatData().then(function () {
          window.NpcBuilder.buildNpcFromSaved(tb).then(function (built) {
            tb.computedAttacks = built.computedAttacks || [];
            renderScene();
          });
        });
      }
    }
  }

  function getSceneNpcs() {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    if (!scene) return [];
    if (_sceneNpcOverrides[currentScene]) return _sceneNpcOverrides[currentScene];
    var npcs = (scene.npcs || []).slice();
    npcs.forEach(ensureComputedAttacks);
    return npcs;
  }

  function setSceneNpcs(npcs) {
    _sceneNpcOverrides[currentScene] = npcs;
  }

  function stripTransientFields(npc) {
    var copy = JSON.parse(JSON.stringify(npc));
    if (copy.threatBuild) {
      delete copy.threatBuild.computedAttacks;
    }
    delete copy._templateName;
    return copy;
  }

  function persistSceneNpc(idx, npc) {
    if (!currentScene) return;
    fetch('/api/campaign/scene/' + encodeURIComponent(currentScene) + '/npc/' + idx, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stripTransientFields(npc))
    }).then(function (r) {
      if (!r.ok) console.error('Failed to persist NPC update', r.status);
    }).catch(function (err) { console.error('NPC persist error', err); });
  }

  function addSceneNpc(npc) {
    if (!currentScene) return;
    fetch('/api/campaign/scene/' + encodeURIComponent(currentScene) + '/npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stripTransientFields(npc))
    }).then(function (r) {
      if (!r.ok) console.error('Failed to persist NPC add', r.status);
    }).catch(function (err) { console.error('NPC add error', err); });
  }

  function deleteSceneNpc(idx) {
    if (!currentScene) return;
    fetch('/api/campaign/scene/' + encodeURIComponent(currentScene) + '/npc/' + idx, {
      method: 'DELETE'
    }).then(function (r) {
      if (!r.ok) console.error('Failed to persist NPC delete', r.status);
    }).catch(function (err) { console.error('NPC delete error', err); });
  }

  function getNpcTypeId(npc) {
    if (npc._templateName) return npc._templateName;
    return (npc.name || '').toLowerCase().trim();
  }

  function buildNpcLabels(npcs) {
    var counts = {};
    npcs.forEach(function (npc) {
      var key = getNpcTypeId(npc);
      counts[key] = (counts[key] || 0) + 1;
    });
    var indices = {};
    return npcs.map(function (npc) {
      var key = getNpcTypeId(npc);
      indices[key] = (indices[key] || 0) + 1;
      return {
        number: indices[key],
        total: counts[key]
      };
    });
  }

  function renderNpcCardBody(npc, expandKey) {
    var tb = npc.threatBuild;
    var h = '';

    if (npc.notes) {
      h += '<div class="cb-npc-meta-row">' + linkify(npc.notes) + '</div>';
    }
    if (npc.behavior) {
      h += '<div class="cb-npc-detail-section" style="border-color:#c8a44e;"><strong>Behavior:</strong> ' + linkify(npc.behavior) + '</div>';
    }
    if (npc.dialogue && npc.dialogue.length) {
      h += '<div class="cb-npc-detail-section" style="border-color:#c084fc;color:#c084fc;"><strong>Dialogue:</strong> ' + npc.dialogue.map(function(d){ return linkify(d); }).join(' ') + '</div>';
    }
    if (npc.intel) {
      h += '<div class="cb-npc-detail-section" style="border-color:#f59e0b;color:#f59e0b;"><strong>Intel:</strong> ' + linkify(npc.intel) + '</div>';
    }

    if (!tb) return h;
    var baseC = tb.computed || {};
    var c = baseC;
    var hasDamage = baseC.damageTiers;
    var isCombat = !!hasDamage;

    var arenaNames = ['physique', 'reflex', 'grit', 'wits', 'presence'];
    var arenaLabels = { physique: 'PHY', reflex: 'REF', grit: 'GRT', wits: 'WIT', presence: 'PRE' };
    var baseA = tb.arenas || {};
    h += '<div class="cb-npc-arena-bar">';
    var cbPowers = c.powers || {};
    arenaNames.forEach(function (an) {
      h += '<div class="cb-arena-cell">';
      h += '<span class="cb-arena-label">' + arenaLabels[an] + '</span>';
      h += '<span class="cb-arena-val">' + (baseA[an] || 1) + '</span>';
      if (cbPowers[an] != null) h += '<span style="font-size:0.45rem;color:#c8a44e;opacity:0.7;">Pwr ' + cbPowers[an] + '</span>';
      h += '</div>';
    });
    h += '</div>';

    var displayPower = c.power;
    if (displayPower == null && c.powers) {
      displayPower = 0;
      Object.keys(c.powers).forEach(function (k) { if (c.powers[k] > displayPower) displayPower = c.powers[k]; });
    }
    if (displayPower == null) {
      var tier = tb.tier || 0;
      var maxArena = 0;
      var a = tb.arenas || {};
      ['physique','reflex','grit','wits','presence'].forEach(function (k) { if ((a[k] || 0) > maxArena) maxArena = a[k]; });
      displayPower = maxArena > 0 ? (maxArena + tier) : 0;
    }

    h += '<div class="cb-npc-stat-bar">';
    h += '<div class="cb-npc-stat combat-key">Init <span class="val">' + (c.initiative != null ? c.initiative : '—') + '</span></div>';
    h += '<div class="cb-npc-stat combat-key">Def <span class="val">' + (c.defense != null ? c.defense : '—') + '</span></div>';
    h += '<div class="cb-npc-stat combat-key">Eva <span class="val">' + (c.evasion != null ? c.evasion : '—') + '</span></div>';
    h += '<div class="cb-npc-stat">Pwr <span class="val">' + displayPower + '</span></div>';
    h += '<div class="cb-npc-stat">Res <span class="val">' + (c.resist != null ? c.resist : '—') + '</span></div>';
    h += '<div class="cb-npc-stat">Vit <span class="val">' + (c.vitality != null ? c.vitality : '—') + '</span></div>';
    if (baseC.actions) h += '<div class="cb-npc-stat">' + baseC.actions + ' act/rnd</div>';
    h += '</div>';

    if (isCombat) {
      var dt = baseC.damageTiers;
      h += '<div class="cb-npc-dmg-bar">';
      h += '<span class="dmg-label">' + esc(dt.label) + '</span>';
      h += '<span class="dmg-label">F</span><span class="dmg-val">' + dt.fleeting + '</span>';
      h += '<span class="dmg-label">M</span><span class="dmg-val">' + dt.masterful + '</span>';
      h += '<span class="dmg-label">L</span><span class="dmg-val">' + dt.legendary + '</span>';
      h += '</div>';
    }

    if (tb.roleKit) {
      var rk = tb.roleKit;
      if (rk.roleName) {
        h += '<div class="cb-npc-role-header">' + esc(rk.roleName) + '</div>';
      }

      if (rk.passive) {
        var passiveDesc = rk.passive.description;
        if (rk.passive.statMod) passiveDesc += ' (included in stats)';
        h += '<div class="cb-npc-passive"><strong>' + esc(rk.passive.name) + '</strong>: ' + linkify(passiveDesc) + '</div>';
      }

      if (rk.action && !rk.action.isAttack) {
        h += '<div class="cb-npc-ability"><span class="cb-npc-ability-tag cb-tag-sig">Signature</span> <strong>' + esc(rk.action.name) + '</strong>';
        if (rk.action.defense && rk.action.defense !== 'none') h += ' <span class="cb-npc-meta">(Defense: ' + esc(rk.action.defense) + ')</span>';
        if (rk.action.npcEffects) {
          h += '<div class="cb-npc-effects">';
          h += '<span><strong>F:</strong> ' + linkify(rk.action.npcEffects.fleeting) + '</span>';
          h += '<span><strong>M:</strong> ' + linkify(rk.action.npcEffects.masterful) + '</span>';
          h += '<span><strong>L:</strong> ' + linkify(rk.action.npcEffects.legendary) + '</span>';
          h += '</div>';
        }
        h += '</div>';
      }

      if (rk.maneuver && rk.maneuver.name) {
        h += '<div class="cb-npc-ability"><span class="cb-npc-ability-tag cb-tag-maneuver">Maneuver</span> <strong>' + esc(rk.maneuver.name) + '</strong>';
        if (rk.maneuver.modifies) h += ' <span class="cb-npc-meta">(mod ' + esc(rk.maneuver.modifies) + ')</span>';
        h += ' — ' + linkify(rk.maneuver.description) + '</div>';
      }
    }

    var allAttacks = tb.computedAttacks || [];
    var roleDefense = (tb.roleKit && tb.roleKit.action) ? tb.roleKit.action.defense : '';
    var roleActionName = (tb.roleKit && tb.roleKit.action && tb.roleKit.action.isAttack) ? tb.roleKit.action.name : null;

    var gambits = [];
    if (tb.roleKit) {
      if (tb.roleKit.gambits && tb.roleKit.gambits.length) {
        gambits = gambits.concat(tb.roleKit.gambits);
      } else if (tb.roleKit.gambit) {
        gambits.push(tb.roleKit.gambit);
      }
    }
    if (tb.extraGambits && tb.extraGambits.length) {
      gambits = gambits.concat(tb.extraGambits);
    }

    if (allAttacks.length || gambits.length) {
      h += '<div class="cb-npc-attacks-section">';
      if (allAttacks.length) {
        h += '<div class="cb-npc-attacks-label">ATTACKS</div>';
        allAttacks.forEach(function (atk) {
          var isRole = !!atk.isRoleAction || (roleActionName && atk.name === roleActionName);
          h += '<div class="cb-npc-attack-card' + (isRole ? ' cb-npc-role-attack' : '') + '">';
          h += '<div class="cb-npc-attack-header">';
          if (isRole) h += '<span class="cb-npc-ability-tag cb-tag-action">Action</span> ';
          h += '<strong>' + esc(atk.name) + '</strong>';
          if (isRole && roleDefense && roleDefense !== 'none') h += ' <span class="cb-npc-meta">(Defense: ' + esc(roleDefense) + ')</span>';
          h += ' <span class="cb-power-badge">POWER ' + atk.attackPower + '</span>';
          h += ' <span class="cb-chassis-badge">' + esc(atk.chassisLabel) + '</span>';
          if (atk.arena) h += ' <span class="cb-npc-meta">' + esc(atk.arena) + '</span>';
          h += '</div>';
          h += '<div class="cb-npc-attack-dmg-row">';
          h += '<span class="cb-dmg-tier"><span class="cb-dmg-lbl">F</span> ' + atk.damage.fleeting + '</span>';
          h += '<span class="cb-dmg-tier"><span class="cb-dmg-lbl">M</span> ' + atk.damage.masterful + '</span>';
          h += '<span class="cb-dmg-tier"><span class="cb-dmg-lbl">L</span> ' + atk.damage.legendary + '</span>';
          if (atk.canStun && atk.stun) {
            h += '<span class="cb-stun-inline"><span class="cb-stun-lbl">STUN</span> ' + atk.stun.fleeting + ' / ' + atk.stun.masterful + ' / ' + atk.stun.legendary + '</span>';
          }
          h += '</div>';
          h += '</div>';
        });
      }
      if (gambits.length) {
        h += '<div class="cb-npc-gambits-row">';
        gambits.forEach(function (g) {
          h += '<div class="cb-npc-gambit-item"><span class="cb-npc-ability-tag cb-tag-gambit">Gambit</span> <strong>' + esc(g.name) + '</strong> <span class="cb-npc-meta">(' + esc(g.cost) + ')</span> — ' + linkify(g.description) + '</div>';
        });
        h += '</div>';
      }
      h += '</div>';
    }

    if (tb.roleKit && tb.roleKit.exploit) {
      var expl = tb.roleKit.exploit;
      h += '<div class="cb-npc-exploit">';
      h += '<span class="cb-npc-ability-tag cb-tag-exploit">Exploit</span> <strong>' + esc(expl.name) + '</strong>';
      if (expl.trigger) {
        h += '<div class="cb-exploit-trigger"><strong>TRIGGER:</strong> ' + linkify(expl.trigger) + '</div>';
      }
      h += '<div>' + linkify(expl.description) + '</div>';
      h += '</div>';
    }

    var loot = npc.loot || (tb && tb.loot) || [];
    if (loot.length) {
      h += '<div class="cb-npc-loot-section">';
      h += '<div class="cb-npc-loot-label">Loot</div>';
      loot.forEach(function (item, li) {
        h += '<div class="cb-npc-loot-row" data-npc-idx="' + expandKey + '" data-loot-idx="' + li + '">';
        h += '<span class="cb-npc-loot-name">' + esc(item.name) + (item.qty > 1 ? ' x' + item.qty : '') + '</span>';
        if (item.type) h += '<span class="cb-npc-loot-type">' + esc(item.type) + '</span>';
        h += '<button class="cb-npc-loot-assign-btn" data-loot-idx="' + li + '" title="Assign to PC">&#9654; Assign</button>';
        h += '</div>';
      });
      h += '</div>';
    }

    return h;
  }

  function renderNpcCard(npc, idx, label) {
    var tb = npc.threatBuild;
    var c = tb ? (tb.computed || {}) : {};
    var cls = tb ? (tb.classification || '') : '';
    var tier = tb ? tb.tier : null;
    var role = tb ? tb.role : '';
    var cardId = 'npc-card-' + idx;
    var expandKey = currentScene + ':' + idx + ':' + npc.name;
    var isExpanded = _npcExpandState[expandKey];

    var init = c.initiative;

    var displayName = npc.name || 'Unnamed';
    if (label && label.total > 1) {
      displayName += ' #' + label.number;
    }

    var h = '<div class="cb-npc-card' + (isExpanded ? ' expanded' : '') + '" id="' + cardId + '" data-npc-idx="' + idx + '">';

    h += '<div class="cb-npc-card-header" data-npc-toggle="' + esc(expandKey) + '">';
    h += '<span class="cb-npc-chevron">&#9654;</span>';
    h += '<span class="cb-npc-name">' + esc(displayName) + '</span>';
    if (tier != null) h += '<span class="cb-npc-tier-badge">T' + tier + '</span>';
    if (cls) h += '<span class="cb-npc-class-badge ' + esc(cls) + '">' + esc(cls) + '</span>';
    if (role) h += '<span style="font-size:0.6rem;color:#7a7068;text-transform:capitalize;">' + esc(role) + '</span>';
    h += '<span class="cb-npc-count-badge">x' + (npc.count || 1) + '</span>';
    if (init != null) h += '<span class="cb-npc-init-badge">Init <span>' + init + '</span></span>';
    h += '<span class="cb-npc-card-actions">';
    h += '<button class="cb-npc-edit-btn" data-npc-idx="' + idx + '" title="Edit in Threat Builder">&#9998;</button>';
    h += '<button class="cb-npc-remove-btn" data-npc-idx="' + idx + '" title="Remove NPC">&times;</button>';
    h += '</span>';
    h += '</div>';

    h += '<div class="cb-npc-card-body">';
    h += '<div class="cb-npc-meta-row"><span>' + esc(npc.type) + '</span></div>';
    h += renderNpcCardBody(npc, expandKey);
    h += '</div>';

    h += '</div>';
    return h;
  }

  function showLootToast(msg) {
    var t = document.createElement('div');
    t.className = 'cb-loot-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('visible'); }, 10);
    setTimeout(function () { t.classList.remove('visible'); setTimeout(function () { t.remove(); }, 300); }, 2500);
  }

  function assignLootToPC(npcIdx, lootIdx, charId, charName) {
    var npcs = getSceneNpcs();
    var npc = npcs[npcIdx];
    if (!npc) return;
    var lootSource = npc.loot || (npc.threatBuild && npc.threatBuild.loot) || [];
    var item = lootSource[lootIdx];
    if (!item) return;
    var itemType = (item.type || 'gear').toLowerCase();
    if (itemType === 'weapon') itemType = 'weapon';
    else if (itemType === 'armor') itemType = 'armor';
    else itemType = 'gear';
    fetch('/api/inventory/' + encodeURIComponent(charId) + '/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, itemType: itemType })
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed');
      return res.json();
    }).then(function () {
      showLootToast(esc(item.name) + ' assigned to ' + esc(charName));
      if (socket) socket.emit('inventory:added', { charId: String(charId), itemId: item.id, itemType: itemType });
      if (item.qty && item.qty > 1) {
        item.qty -= 1;
      } else {
        lootSource.splice(lootIdx, 1);
      }
      setSceneNpcs(npcs);
      renderScene();
    }).catch(function (err) {
      showLootToast('Failed to assign loot: ' + err.message);
    });
  }

  var _openPanels = {};
  var _panelZCounter = 121;

  function _panelTypeKey(panelId) {
    if (panelId.indexOf('lore-') === 0) return 'lore';
    if (panelId === 'assess-guide') return 'assess-guide';
    return panelId;
  }

  function _loadPanelGeometry(panelId) {
    try {
      var store = JSON.parse(localStorage.getItem('cb_panel_geo') || '{}');
      return store[_panelTypeKey(panelId)] || null;
    } catch (e) { return null; }
  }

  function _savePanelGeometry(panelId, geo) {
    try {
      var store = JSON.parse(localStorage.getItem('cb_panel_geo') || '{}');
      store[_panelTypeKey(panelId)] = geo;
      localStorage.setItem('cb_panel_geo', JSON.stringify(store));
    } catch (e) { /* ignore */ }
  }

  function _captureAndSaveGeo(panel, panelId) {
    var rect = { x: panel.offsetLeft, y: panel.offsetTop, w: panel.offsetWidth, h: panel.offsetHeight };
    if (rect.w < 50 || rect.h < 50) return;
    _savePanelGeometry(panelId, rect);
  }

  function _buildTtsSettingsHtml() {
    var prefs = window.TtsNarration ? window.TtsNarration.getPrefs() : { rate: 0.92, pitch: 0.85, autoContinue: true };
    var h = '';
    h += '<div class="cb-tts-settings">';
    h += '<button class="cb-tts-settings-toggle" data-tts-toggle="settings">&#9881; Voice Settings</button>';
    h += '<div class="cb-tts-settings-body" style="display:none;">';
    h += '<div class="cb-tts-row"><label>Voice</label><select class="cb-tts-voice-select" data-tts-control="voice"></select></div>';
    h += '<div class="cb-tts-row"><label>Speed <span data-tts-val="rate">' + prefs.rate.toFixed(2) + '</span></label><input type="range" min="0.6" max="1.4" step="0.05" value="' + prefs.rate + '" data-tts-control="rate"></div>';
    h += '<div class="cb-tts-row"><label>Pitch <span data-tts-val="pitch">' + prefs.pitch.toFixed(2) + '</span></label><input type="range" min="0.7" max="1.3" step="0.05" value="' + prefs.pitch + '" data-tts-control="pitch"></div>';
    h += '<div class="cb-tts-row"><label><input type="checkbox" data-tts-control="autoContinue"' + (prefs.autoContinue ? ' checked' : '') + '> Auto-continue Part 1 → Part 2</label></div>';
    h += '</div></div>';
    return h;
  }

  function _buildReadAloudHtml(scene) {
    var h = '';
    h += _buildTtsSettingsHtml();
    if (scene.readAloudPart1 && scene.readAloudPart2) {
      h += '<div class="cb-read-aloud" style="margin-bottom:0.75rem;" data-tts-section="part1">';
      h += '<div class="cb-section-label">Read-Aloud — Part 1 <button class="cb-tts-narrate-btn" data-tts-action="narrate-all" title="Narrate Part 1 then auto-continue to Part 2">&#9654; Narrate</button></div>';
      h += '<div class="cb-read-aloud-text cb-prose">' + _formatProse(scene.readAloudPart1) + '</div>';
      if (scene.readAloudPart1PauseNote) {
        h += '<div class="cb-pause-note" style="margin-top:12px;padding:10px 14px;background:rgba(245,158,11,0.12);border-left:3px solid #f59e0b;border-radius:4px;color:#f59e0b;font-size:0.85rem;font-style:italic;">' + scene.readAloudPart1PauseNote + '</div>';
      }
      h += '</div>';
      h += '<div class="cb-read-aloud" style="margin-top:6px;" data-tts-section="part2">';
      h += '<div class="cb-section-label">Read-Aloud — Part 2 <button class="cb-tts-narrate-btn" data-tts-action="narrate-part2" title="Narrate Part 2">&#9654; Narrate</button></div>';
      h += '<div class="cb-read-aloud-text cb-prose">' + _formatProse(scene.readAloudPart2) + '</div>';
      h += '</div>';
    } else if (scene.readAloud) {
      h += '<div class="cb-read-aloud" data-tts-section="single">';
      h += '<div class="cb-section-label">Player Read-Aloud <button class="cb-tts-narrate-btn" data-tts-action="narrate-single" title="Narrate">&#9654; Narrate</button></div>';
      h += '<div class="cb-read-aloud-text cb-prose">' + _formatProse(scene.readAloud) + '</div>';
      h += '</div>';
    }
    return h;
  }

  function _buildGmNotesHtml(scene) {
    if (!scene.gmNotes) return '';
    return '<div class="cb-gm-notes"><div class="cb-section-label">GM Notes</div><div class="cb-prose">' + _formatProse(scene.gmNotes) + '</div></div>';
  }

  function _buildNpcRosterHtml(scene) {
    var sceneNpcs = getSceneNpcs();
    var h = '<div class="cb-card" id="cb-npc-roster-card">';
    h += '<div class="cb-section-label" style="display:flex;align-items:center;justify-content:space-between;">';
    h += '<span>NPC Roster</span>';
    h += '<button class="cb-add-npc-btn" id="cb-add-npc-btn">+ NPC</button>';
    h += '</div>';
    h += '<div id="cb-add-npc-panel" class="cb-add-npc-panel" style="display:none;"></div>';
    if (sceneNpcs.length) {
      var labels = buildNpcLabels(sceneNpcs);
      h += '<div class="cb-npc-grid">';
      sceneNpcs.forEach(function (npc, idx) {
        h += renderNpcCard(npc, idx, labels[idx]);
      });
      h += '</div>';
    } else {
      h += '<p class="cb-muted" style="font-style:italic;font-size:0.75rem;">No NPCs in this scene. Click "+ NPC" to add one.</p>';
    }
    h += '</div>';
    return h;
  }

  function _escCondLabel(cid) {
    if (window.EffectManager && window.EffectManager.EFFECT_DEFS) {
      var defs = window.EffectManager.EFFECT_DEFS;
      for (var i = 0; i < defs.length; i++) {
        if (defs[i].id === cid && defs[i].name) return defs[i].name;
      }
    }
    return String(cid).charAt(0).toUpperCase() + String(cid).slice(1);
  }

  var _ESC_PC_TARGETS = ['pcs', 'players', 'party', 'all pcs'];

  function _escSceneNpcNames(scene) {
    var npcs = (scene && scene.npcs) || [];
    return npcs.map(function (n) { return String(n.name || n.type || '').trim(); }).filter(Boolean);
  }

  function _escTargetResolves(target, sceneNpcNames, actionType) {
    var t = String(target == null ? '' : target).trim();
    if (!t) return false;
    var tLower = t.toLowerCase();
    if (_ESC_PC_TARGETS.indexOf(tLower) !== -1) {
      return actionType === 'damage';
    }
    for (var i = 0; i < sceneNpcNames.length; i++) {
      if (sceneNpcNames[i].toLowerCase() === tLower) return true;
    }
    var escaped = tLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re;
    try { re = new RegExp('\\b' + escaped + '\\b', 'i'); } catch (e) { return false; }
    for (var j = 0; j < sceneNpcNames.length; j++) {
      var n = sceneNpcNames[j];
      if (re.test(n) || re.test(n + ' #1')) return true;
    }
    return false;
  }

  function _escSpawnResolves(template, sceneNpcNames) {
    var t = String(template == null ? '' : template).trim().toLowerCase();
    if (!t) return false;
    for (var i = 0; i < sceneNpcNames.length; i++) {
      var nm = sceneNpcNames[i].toLowerCase();
      if (nm === t || nm.indexOf(t) !== -1 || t.indexOf(nm) !== -1) return true;
    }
    return false;
  }

  function _escTargetSpan(target, sceneNpcNames, actionType) {
    var ok = _escTargetResolves(target, sceneNpcNames, actionType);
    if (ok) return '<span style="color:#d4c5a0;">' + esc(target) + '</span>';
    var tLower = String(target || '').trim().toLowerCase();
    var isPcAlias = _ESC_PC_TARGETS.indexOf(tLower) !== -1;
    var tip = isPcAlias
      ? 'Only damage actions can target PCs — applyCondition/removeCondition target combatants on the tracker only'
      : 'No combatant in this scene matches this target';
    return '<span class="cb-esc-bad-target" style="color:#ef4444;text-decoration:underline wavy #ef4444;" title="' + esc(tip) + '">' + esc(target) + '</span>';
  }

  function _escActionToHtml(act, sceneNpcNames) {
    var line = '';
    var hasBad = false;
    var targets = Array.isArray(act.targets) ? act.targets : [];
    var checkTargets = function () {
      return targets.map(function (t) {
        if (!_escTargetResolves(t, sceneNpcNames, act.type)) hasBad = true;
        return _escTargetSpan(t, sceneNpcNames, act.type);
      }).join(', ');
    };
    if (act.type === 'applyCondition' || act.type === 'removeCondition') {
      var conds = (act.conditions || []).map(function (c) { return '[' + _escCondLabel(c) + ']'; }).join(' ');
      var verb = act.type === 'applyCondition' ? '&rarr;' : '&times;';
      var tgtHtml = checkTargets();
      line = esc(conds) + ' ' + verb + ' ' + tgtHtml;
      if (!targets.length) hasBad = true;
      if (!(act.conditions || []).length) hasBad = true;
    } else if (act.type === 'damage') {
      var amt = parseInt(act.amount, 10) || 0;
      var dtgts = checkTargets();
      var pcsAffected = targets.some(function (t) {
        return _ESC_PC_TARGETS.indexOf(String(t || '').trim().toLowerCase()) !== -1;
      });
      line = '<span style="color:#ef4444;">&#9888; ' + amt + ' damage</span> &rarr; ' + dtgts;
      if (pcsAffected) line += ' <span style="color:#7a7068;">(GM applies to PC sheets)</span>';
      if (!amt || !targets.length) hasBad = true;
    } else if (act.type === 'spawn') {
      var tmpl = act.npc || act.template || '';
      var count = Math.max(1, parseInt(act.count, 10) || 1);
      var labels = [];
      for (var i = 0; i < count; i++) labels.push(tmpl);
      var spawnOk = _escSpawnResolves(tmpl, sceneNpcNames);
      if (!spawnOk) hasBad = true;
      var spawnSpan = spawnOk
        ? '<span style="color:#d4c5a0;">' + esc(labels.join(', ')) + '</span>'
        : '<span class="cb-esc-bad-target" style="color:#ef4444;text-decoration:underline wavy #ef4444;" title="No NPC template in this scene matches this name">' + esc(labels.join(', ')) + '</span>';
      line = '<span style="color:#a855f7;">&#10010; Reinforcements:</span> ' + spawnSpan;
      if (act.zone) line += ' <span style="color:#7a7068;">@ ' + esc(act.zone) + '</span>';
    } else if (act.type === 'narrate') {
      var text = String(act.text || act.note || '').trim();
      if (!text) hasBad = true;
      line = '<span style="color:#c084fc;">&#9836;</span> <em style="color:#d4c5a0;">' + esc(text) + '</em>';
    } else {
      return null;
    }
    return { line: line, hasBad: hasBad };
  }

  function _buildEscalationPreviewHtml(scene, enc) {
    var sceneNpcNames = _escSceneNpcNames(scene);
    var h = '<div style="font-size:0.65rem;margin-top:0.25rem;padding:0.3rem 0.4rem;background:rgba(245,158,11,0.08);border-left:2px solid #f59e0b;border-radius:0 3px 3px 0;">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.2rem;">';
    h += '<span style="color:#f59e0b;font-family:Audiowide,sans-serif;font-size:0.55rem;letter-spacing:0.05em;">SCRIPTED ESCALATION &mdash; LOG PREVIEW</span>';
    h += '<span style="color:#7a7068;font-size:0.55rem;font-style:italic;">mirrors combat log</span>';
    h += '</div>';
    var totalBad = 0;
    enc.scriptedEscalation.forEach(function (se) {
      var actions = (Array.isArray(se.actions) && se.actions.length) ? se.actions : null;
      if (!actions) {
        var lt = Array.isArray(se.targets) ? se.targets : [];
        var lc = Array.isArray(se.conditions) ? se.conditions : [];
        actions = (lt.length && lc.length)
          ? [{ type: 'applyCondition', targets: lt, conditions: lc, note: se.note || '' }]
          : [];
      }
      actions.forEach(function (act) {
        if (!act || !act.type) return;
        var rendered = _escActionToHtml(act, sceneNpcNames);
        if (!rendered) return;
        if (rendered.hasBad) totalBad++;
        h += '<div style="color:#fbbf24;padding:0.1rem 0;">R' + (se.round || '?') + ': ' + rendered.line;
        if (act.note && act.type !== 'narrate') {
          h += ' <span style="color:#7a7068;font-style:italic;">&mdash; ' + esc(act.note) + '</span>';
        }
        h += '</div>';
      });
    });
    if (totalBad > 0) {
      h += '<div style="margin-top:0.25rem;padding:0.2rem 0.3rem;background:rgba(239,68,68,0.12);border-left:2px solid #ef4444;border-radius:0 3px 3px 0;color:#fca5a5;font-size:0.6rem;">';
      h += '&#9888; ' + totalBad + ' action' + (totalBad === 1 ? '' : 's') + ' contain values that won\'t resolve or apply at runtime (bad target name, missing amount/conditions/text, etc.). Fix them before saving or those parts will be skipped.';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _buildEncountersHtml(scene) {
    if (!scene.encounters || !scene.encounters.length) return '';
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Encounters</div>';
    scene.encounters.forEach(function (enc) {
      var typeColor = enc.type === 'combat' ? '#ef4444' : enc.type === 'social' ? '#c084fc' : enc.type === 'infiltration' ? '#818cf8' : '#c8a44e';
      h += '<div style="margin-bottom:0.5rem;padding:0.4rem;border-left:3px solid ' + typeColor + ';background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;">';
      h += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;"><strong style="color:#d4c5a0;font-size:0.8rem;">' + esc(enc.name) + '</strong><span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + typeColor + ';color:#000;font-family:Audiowide,sans-serif;text-transform:uppercase;">' + esc(enc.type) + '</span></div>';
      h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;"><strong>Trigger:</strong> ' + linkify(enc.trigger) + '</div>';
      h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;">' + linkify(enc.description) + '</div>';
      if (enc.tactics) h += '<div style="font-size:0.7rem;color:#c8a44e;"><strong>Tactics:</strong> ' + linkify(enc.tactics) + '</div>';
      if (enc.composition) {
        h += '<div style="font-size:0.65rem;margin-top:0.2rem;padding:0.25rem;background:rgba(0,0,0,0.1);border-radius:3px;">';
        if (enc.composition.enemies) {
          enc.composition.enemies.forEach(function(e) {
            var threatColor = e.threat === 'rival' ? '#f59e0b' : e.threat === 'nemesis' ? '#ef4444' : '#7a7068';
            h += '<div><span style="color:' + threatColor + ';text-transform:uppercase;font-size:0.55rem;font-family:Audiowide,sans-serif;">' + esc(e.threat) + '</span> ' + esc(e.type) + ' x' + e.count + '</div>';
          });
        }
        if (enc.composition.terrain) h += '<div style="color:#7a7068;margin-top:0.1rem;"><strong>Terrain:</strong> ' + esc(enc.composition.terrain) + '</div>';
        if (enc.composition.positioning) h += '<div style="color:#7a7068;"><strong>Positioning:</strong> ' + esc(enc.composition.positioning) + '</div>';
        h += '</div>';
      }
      if (Array.isArray(enc.scriptedEscalation) && enc.scriptedEscalation.length) {
        h += _buildEscalationPreviewHtml(scene, enc);
      }
      var thisEncIdx = scene.encounters.indexOf(enc);
      h += '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">';
      if (enc.type === 'combat' && window.CombatTracker) {
        h += '<button class="ct-start-encounter-btn" data-enc-idx="' + thisEncIdx + '">&#9876; Start Encounter</button>';
      }
      h += '<button class="cb-edit-escalation-btn" data-enc-idx="' + thisEncIdx + '" style="font-size:0.6rem;padding:0.25rem 0.5rem;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid #f59e0b;border-radius:3px;cursor:pointer;font-family:Audiowide,sans-serif;letter-spacing:0.05em;">&#9999; Edit Script</button>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  var _escalationDraft = {};

  function _getConditionOptions() {
    var defs = (window.EffectManager && window.EffectManager.EFFECT_DEFS) || [];
    return defs.map(function (d) { return { id: d.id, label: d.label || d.id }; });
  }

  function _getDurationOptions() {
    var defs = (window.EffectManager && window.EffectManager.DURATIONS) || [
      { id: 'immediate', label: 'Immediate' },
      { id: 'tactical', label: 'Tactical' },
      { id: 'lingering', label: 'Lingering' },
      { id: 'ongoing', label: 'Ongoing' },
      { id: 'end_of_scene', label: 'End of Scene' },
      { id: 'permanent', label: 'Permanent' }
    ];
    return defs.map(function (d) { return { id: d.id, label: d.label || d.id }; });
  }

  function _getSceneNpcNames(scene) {
    return ((scene && scene.npcs) || []).map(function (n) { return n.name || n.type || ''; }).filter(Boolean);
  }

  function _normalizeEscalationFromEnc(enc) {
    var raw = Array.isArray(enc.scriptedEscalation) ? enc.scriptedEscalation : [];
    return raw.map(function (entry) {
      var actions = (Array.isArray(entry.actions) && entry.actions.length) ? entry.actions : null;
      if (!actions) {
        var lt = Array.isArray(entry.targets) ? entry.targets : [];
        var lc = Array.isArray(entry.conditions) ? entry.conditions : [];
        actions = (lt.length && lc.length)
          ? [{ type: 'applyCondition', targets: lt.slice(), conditions: lc.slice(), note: entry.note || '' }]
          : [];
      }
      return {
        round: parseInt(entry.round, 10) || 1,
        actions: actions.map(function (a) { return JSON.parse(JSON.stringify(a)); })
      };
    });
  }

  function _buildEscalationEditorHtml(scene, encIdx) {
    var enc = scene.encounters[encIdx];
    var draftKey = scene.id + ':' + encIdx;
    if (!_escalationDraft[draftKey]) {
      _escalationDraft[draftKey] = _normalizeEscalationFromEnc(enc);
    }
    var draft = _escalationDraft[draftKey];
    var conds = _getConditionOptions();
    var durations = _getDurationOptions();
    var npcNames = _getSceneNpcNames(scene);
    var arenas = ['', 'physique', 'reflex', 'grit', 'wits', 'presence'];
    var actionTypes = [
      { id: 'applyCondition', label: 'Apply Condition' },
      { id: 'removeCondition', label: 'Remove Condition' },
      { id: 'damage', label: 'Damage' },
      { id: 'spawn', label: 'Spawn Reinforcements' },
      { id: 'narrate', label: 'Narrate' }
    ];

    var h = '<div class="cb-esc-editor" data-enc-idx="' + encIdx + '" data-scene-id="' + esc(scene.id) + '" style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.72rem;">';
    h += '<div style="font-size:0.65rem;color:#7a7068;line-height:1.4;">Build per-round actions for <strong style="color:#d4c5a0;">' + esc(enc.name) + '</strong>. Saved here, the combat tracker auto-applies them on the listed round.</div>';

    if (!draft.length) {
      h += '<div style="font-style:italic;color:#7a7068;font-size:0.7rem;">No rounds scripted yet. Click "+ Add Round" below.</div>';
    }

    draft.forEach(function (entry, ri) {
      h += '<div class="cb-esc-round" data-round-idx="' + ri + '" style="border:1px solid rgba(245,158,11,0.4);border-radius:4px;padding:0.4rem 0.5rem;background:rgba(245,158,11,0.05);">';
      h += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.35rem;">';
      h += '<span style="font-family:Audiowide,sans-serif;color:#f59e0b;font-size:0.7rem;">ROUND</span>';
      h += '<input type="number" min="1" class="cb-esc-round-num" value="' + (entry.round || 1) + '" style="width:3.5rem;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-family:Audiowide,sans-serif;" />';
      h += '<button class="cb-esc-move-round-up" title="Move round up"' + (ri === 0 ? ' disabled' : '') + ' style="font-size:0.65rem;padding:0.1rem 0.35rem;background:rgba(245,158,11,0.15);color:' + (ri === 0 ? '#7a7068' : '#f59e0b') + ';border:1px solid ' + (ri === 0 ? '#7a7068' : '#f59e0b') + ';border-radius:3px;cursor:' + (ri === 0 ? 'not-allowed' : 'pointer') + ';">&uarr;</button>';
      h += '<button class="cb-esc-move-round-down" title="Move round down"' + (ri === draft.length - 1 ? ' disabled' : '') + ' style="font-size:0.65rem;padding:0.1rem 0.35rem;background:rgba(245,158,11,0.15);color:' + (ri === draft.length - 1 ? '#7a7068' : '#f59e0b') + ';border:1px solid ' + (ri === draft.length - 1 ? '#7a7068' : '#f59e0b') + ';border-radius:3px;cursor:' + (ri === draft.length - 1 ? 'not-allowed' : 'pointer') + ';">&darr;</button>';
      h += '<button class="cb-esc-preview-round" style="margin-left:auto;font-size:0.6rem;padding:0.15rem 0.45rem;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid #f59e0b;border-radius:3px;cursor:pointer;">Preview Round ' + (entry.round || 1) + '</button>';
      h += '<button class="cb-esc-del-round" style="font-size:0.6rem;padding:0.15rem 0.4rem;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid #ef4444;border-radius:3px;cursor:pointer;">Remove Round</button>';
      h += '</div>';
      h += '<div class="cb-esc-preview-out" style="display:none;"></div>';

      if (!entry.actions.length) {
        h += '<div style="font-size:0.65rem;color:#7a7068;font-style:italic;">No actions. Add one below.</div>';
      }

      entry.actions.forEach(function (act, ai) {
        var lastAi = entry.actions.length - 1;
        h += '<div class="cb-esc-action" data-action-idx="' + ai + '" style="margin-top:0.3rem;padding:0.35rem;border-left:2px solid #c8a44e;background:rgba(0,0,0,0.2);border-radius:0 3px 3px 0;">';
        h += '<div style="display:flex;align-items:center;gap:0.35rem;margin-bottom:0.25rem;">';
        h += '<select class="cb-esc-action-type" style="padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
        actionTypes.forEach(function (t) {
          h += '<option value="' + t.id + '"' + (act.type === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
        });
        h += '</select>';
        h += '<button class="cb-esc-move-action-up" title="Move action up"' + (ai === 0 ? ' disabled' : '') + ' style="margin-left:auto;font-size:0.6rem;padding:0.1rem 0.3rem;background:rgba(200,164,78,0.15);color:' + (ai === 0 ? '#7a7068' : '#c8a44e') + ';border:1px solid ' + (ai === 0 ? '#7a7068' : '#c8a44e') + ';border-radius:3px;cursor:' + (ai === 0 ? 'not-allowed' : 'pointer') + ';">&uarr;</button>';
        h += '<button class="cb-esc-move-action-down" title="Move action down"' + (ai === lastAi ? ' disabled' : '') + ' style="font-size:0.6rem;padding:0.1rem 0.3rem;background:rgba(200,164,78,0.15);color:' + (ai === lastAi ? '#7a7068' : '#c8a44e') + ';border:1px solid ' + (ai === lastAi ? '#7a7068' : '#c8a44e') + ';border-radius:3px;cursor:' + (ai === lastAi ? 'not-allowed' : 'pointer') + ';">&darr;</button>';
        h += '<button class="cb-esc-del-action" style="font-size:0.6rem;padding:0.1rem 0.35rem;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid #ef4444;border-radius:3px;cursor:pointer;">&times;</button>';
        h += '</div>';

        if (act.type === 'applyCondition' || act.type === 'removeCondition') {
          h += '<div style="display:flex;flex-direction:column;gap:0.25rem;">';
          h += '<label style="font-size:0.6rem;color:#7a7068;">Targets (Ctrl-click for multi; "PCs"/"All PCs" for the party — damage only):</label>';
          h += '<select class="cb-esc-targets" multiple size="' + Math.min(5, Math.max(3, npcNames.length + 1)) + '" style="padding:0.2rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
          npcNames.forEach(function (nm) {
            var sel = (act.targets || []).indexOf(nm) !== -1 ? ' selected' : '';
            h += '<option value="' + esc(nm) + '"' + sel + '>' + esc(nm) + '</option>';
          });
          h += '</select>';
          h += '<input type="text" class="cb-esc-extra-targets" placeholder="Other targets (comma-separated, e.g. PCs, Trandoshan)" value="' + esc(((act.targets || []).filter(function (t) { return npcNames.indexOf(t) === -1; }).join(', '))) + '" style="padding:0.2rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;" />';
          h += '<label style="font-size:0.6rem;color:#7a7068;">Conditions (Ctrl-click for multi):</label>';
          h += '<select class="cb-esc-conditions" multiple size="5" style="padding:0.2rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
          conds.forEach(function (c) {
            var sel = (act.conditions || []).indexOf(c.id) !== -1 ? ' selected' : '';
            h += '<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.label) + '</option>';
          });
          h += '</select>';
          if (act.type === 'applyCondition') {
            h += '<div style="display:flex;gap:0.4rem;">';
            h += '<div style="flex:1;"><label style="font-size:0.6rem;color:#7a7068;">Duration:</label>';
            h += '<select class="cb-esc-duration" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            h += '<option value="">(default)</option>';
            durations.forEach(function (d) {
              h += '<option value="' + esc(d.id) + '"' + (act.duration === d.id ? ' selected' : '') + '>' + esc(d.label) + '</option>';
            });
            h += '</select></div>';
            h += '<div style="flex:1;"><label style="font-size:0.6rem;color:#7a7068;">Arena (optional):</label>';
            h += '<select class="cb-esc-arena" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            arenas.forEach(function (a) {
              h += '<option value="' + esc(a) + '"' + (act.arena === a ? ' selected' : '') + '>' + (a ? esc(a) : '(none)') + '</option>';
            });
            h += '</select></div>';
            h += '</div>';
          }
          h += '</div>';
        } else if (act.type === 'damage') {
          h += '<div style="display:flex;flex-direction:column;gap:0.25rem;">';
          h += '<label style="font-size:0.6rem;color:#7a7068;">Targets:</label>';
          h += '<select class="cb-esc-targets" multiple size="' + Math.min(5, Math.max(3, npcNames.length + 1)) + '" style="padding:0.2rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
          npcNames.forEach(function (nm) {
            var sel = (act.targets || []).indexOf(nm) !== -1 ? ' selected' : '';
            h += '<option value="' + esc(nm) + '"' + sel + '>' + esc(nm) + '</option>';
          });
          h += '</select>';
          h += '<input type="text" class="cb-esc-extra-targets" placeholder="Other targets — use PCs/All PCs/Players for the party" value="' + esc(((act.targets || []).filter(function (t) { return npcNames.indexOf(t) === -1; }).join(', '))) + '" style="padding:0.2rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;" />';
          h += '<label style="font-size:0.6rem;color:#7a7068;">Amount:</label>';
          h += '<input type="number" min="0" class="cb-esc-amount" value="' + (parseInt(act.amount, 10) || 0) + '" style="width:5rem;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;" />';
          h += '</div>';
        } else if (act.type === 'spawn') {
          var savedTemplates = (window.NpcBuilder && window.NpcBuilder.getSavedNpcs) ? window.NpcBuilder.getSavedNpcs() : [];
          var spawnSource = act._source;
          if (!spawnSource) {
            if (act._stub) spawnSource = 'stub';
            else if (act.npc && npcNames.indexOf(act.npc) === -1 && savedTemplates.some(function (t) { return (t.name || '').toLowerCase() === String(act.npc).toLowerCase(); })) spawnSource = 'library';
            else spawnSource = 'roster';
          }
          h += '<div style="display:flex;flex-direction:column;gap:0.25rem;">';
          h += '<label style="font-size:0.6rem;color:#7a7068;">Spawn source:</label>';
          h += '<select class="cb-esc-spawn-source" style="padding:0.2rem;background:rgba(0,0,0,0.4);border:1px solid #a855f7;color:#c084fc;border-radius:3px;font-size:0.65rem;">';
          h += '<option value="roster"' + (spawnSource === 'roster' ? ' selected' : '') + '>Scene Roster</option>';
          h += '<option value="library"' + (spawnSource === 'library' ? ' selected' : '') + '>Threat Library (saved templates)</option>';
          h += '<option value="stub"' + (spawnSource === 'stub' ? ' selected' : '') + '>+ Inline NPC Stub</option>';
          h += '</select>';
          if (spawnSource === 'roster') {
            h += '<label style="font-size:0.6rem;color:#7a7068;">NPC (from this scene\'s roster):</label>';
            h += '<select class="cb-esc-spawn-npc" style="padding:0.2rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            h += '<option value="">— pick NPC —</option>';
            npcNames.forEach(function (nm) {
              h += '<option value="' + esc(nm) + '"' + ((act.npc || act.template) === nm ? ' selected' : '') + '>' + esc(nm) + '</option>';
            });
            h += '</select>';
          } else if (spawnSource === 'library') {
            h += '<label style="font-size:0.6rem;color:#7a7068;">Saved threat template:</label>';
            h += '<select class="cb-esc-spawn-library" style="padding:0.2rem;background:rgba(0,0,0,0.4);border:1px solid #a855f7;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            h += '<option value="">— pick template —</option>';
            savedTemplates.forEach(function (t) {
              var label = (t.name || 'Unnamed') + ' (T' + (t.tier || 0) + ' ' + (t.classification || '') + (t.role ? ' ' + t.role : '') + ')';
              var sel = (t.name === act.npc) ? ' selected' : '';
              h += '<option value="' + esc(t.name || '') + '"' + sel + '>' + esc(label) + '</option>';
            });
            h += '</select>';
            if (!savedTemplates.length) h += '<div style="font-size:0.6rem;color:#7a7068;font-style:italic;">No saved templates yet. Open the Threat Builder to save some.</div>';
            h += '<div style="font-size:0.55rem;color:#a78bfa;font-style:italic;">On save, this template will be added to the scene roster so the spawn resolves mid-encounter.</div>';
          } else if (spawnSource === 'stub') {
            var stub = act._stub || { name: act.npc || '', tier: 1, classification: 'standard', role: '', powerSource: 'martial' };
            h += '<label style="font-size:0.6rem;color:#7a7068;">Quick NPC stub (added to scene roster on save):</label>';
            h += '<input type="text" class="cb-esc-stub-name" value="' + esc(stub.name) + '" placeholder="NPC name" style="padding:0.2rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #a855f7;color:#d4c5a0;border-radius:3px;font-size:0.65rem;" />';
            h += '<div style="display:flex;gap:0.4rem;">';
            h += '<div style="flex:1;"><label style="font-size:0.55rem;color:#7a7068;">Tier:</label>';
            h += '<input type="number" min="1" max="5" class="cb-esc-stub-tier" value="' + (parseInt(stub.tier, 10) || 1) + '" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;" /></div>';
            h += '<div style="flex:2;"><label style="font-size:0.55rem;color:#7a7068;">Classification:</label>';
            h += '<select class="cb-esc-stub-class" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            ['minion','standard','elite','rival','boss'].forEach(function (c) {
              h += '<option value="' + c + '"' + (stub.classification === c ? ' selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>';
            });
            h += '</select></div></div>';
            h += '<div style="display:flex;gap:0.4rem;">';
            h += '<div style="flex:1;"><label style="font-size:0.55rem;color:#7a7068;">Role:</label>';
            h += '<select class="cb-esc-stub-role" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            ['', 'anchor','threat','harrier','support','controller'].forEach(function (r) {
              h += '<option value="' + r + '"' + ((stub.role || '') === r ? ' selected' : '') + '>' + (r ? r.charAt(0).toUpperCase() + r.slice(1) : '(none)') + '</option>';
            });
            h += '</select></div>';
            h += '<div style="flex:1;"><label style="font-size:0.55rem;color:#7a7068;">Power Source:</label>';
            h += '<select class="cb-esc-stub-power" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">';
            ['martial','ranged','force','leader'].forEach(function (p) {
              h += '<option value="' + p + '"' + ((stub.powerSource || 'martial') === p ? ' selected' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
            });
            h += '</select></div></div>';
            h += '<div style="font-size:0.55rem;color:#a78bfa;font-style:italic;">Default arenas 2/2/2/2/2. Refine in the Threat Builder afterward for traits, attacks, etc.</div>';
          }
          h += '<div style="display:flex;gap:0.4rem;">';
          h += '<div style="flex:1;"><label style="font-size:0.6rem;color:#7a7068;">Count:</label>';
          h += '<input type="number" min="1" class="cb-esc-spawn-count" value="' + (parseInt(act.count, 10) || 1) + '" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;" /></div>';
          h += '<div style="flex:2;"><label style="font-size:0.6rem;color:#7a7068;">Zone (optional):</label>';
          h += '<input type="text" class="cb-esc-spawn-zone" value="' + esc(act.zone || '') + '" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;" /></div>';
          h += '</div>';
          h += '</div>';
        } else if (act.type === 'narrate') {
          h += '<label style="font-size:0.6rem;color:#7a7068;">Narration text:</label>';
          h += '<textarea class="cb-esc-narrate" rows="2" style="width:100%;padding:0.2rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;">' + esc(act.text || '') + '</textarea>';
        }

        if (act.type !== 'narrate') {
          h += '<label style="font-size:0.6rem;color:#7a7068;margin-top:0.25rem;display:block;">Note (optional):</label>';
          h += '<input type="text" class="cb-esc-note" value="' + esc(act.note || '') + '" style="width:100%;padding:0.15rem 0.3rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.65rem;" />';
        }

        h += '<div class="cb-esc-action-preview" style="margin-top:0.35rem;padding:0.25rem 0.35rem;border-top:1px dashed rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);font-size:0.65rem;color:#fbbf24;">';
        h += _renderActionPreviewHtml(act, entry.round, npcNames);
        h += '</div>';

        h += '</div>';
      });

      h += '<button class="cb-esc-add-action" style="margin-top:0.35rem;font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(200,164,78,0.15);color:#c8a44e;border:1px solid #c8a44e;border-radius:3px;cursor:pointer;">+ Add Action</button>';
      h += '</div>';
    });

    h += '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">';
    h += '<button class="cb-esc-add-round" style="font-size:0.65rem;padding:0.3rem 0.6rem;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid #f59e0b;border-radius:3px;cursor:pointer;font-family:Audiowide,sans-serif;letter-spacing:0.05em;">+ Add Round</button>';
    h += '<button class="cb-esc-save" style="margin-left:auto;font-size:0.65rem;padding:0.3rem 0.7rem;background:#22c55e;color:#000;border:none;border-radius:3px;cursor:pointer;font-family:Audiowide,sans-serif;letter-spacing:0.05em;font-weight:bold;">Save Script</button>';
    h += '<button class="cb-esc-cancel" style="font-size:0.65rem;padding:0.3rem 0.6rem;background:rgba(122,112,104,0.2);color:#7a7068;border:1px solid #7a7068;border-radius:3px;cursor:pointer;">Discard</button>';
    h += '</div>';
    h += '<div class="cb-esc-live-preview" data-scene-id="' + esc(scene.id) + '">' + _buildLiveEscalationPreview(scene, draft) + '</div>';
    h += '<div class="cb-esc-status" style="font-size:0.6rem;color:#7a7068;min-height:0.8rem;"></div>';
    h += '</div>';
    return h;
  }

  function _buildLiveEscalationPreview(scene, draft) {
    var clean = (draft || []).filter(function (entry) { return entry && entry.actions && entry.actions.length; });
    if (!clean.length) {
      return '<div style="font-size:0.6rem;color:#7a7068;font-style:italic;margin-top:0.5rem;padding:0.4rem;border:1px dashed rgba(245,158,11,0.3);border-radius:3px;">Live log preview will appear here once you add at least one action.</div>';
    }
    var syntheticEnc = { scriptedEscalation: clean };
    return _buildEscalationPreviewHtml(scene, syntheticEnc);
  }

  function _renderActionPreviewHtml(act, roundNum, sceneNpcNames) {
    if (!act || !act.type) {
      return '<span style="color:#7a7068;font-style:italic;">— select an action type —</span>';
    }
    var rendered = _escActionToHtml(act, sceneNpcNames);
    if (!rendered) {
      return '<span style="color:#7a7068;font-style:italic;">— preview unavailable —</span>';
    }
    var out = '<span style="color:#7a7068;font-family:Audiowide,sans-serif;font-size:0.5rem;letter-spacing:0.05em;">PREVIEW &raquo;</span> ';
    out += 'R' + (roundNum || '?') + ': ' + rendered.line;
    if (act.note && act.type !== 'narrate') {
      out += ' <span style="color:#7a7068;font-style:italic;">&mdash; ' + esc(act.note) + '</span>';
    }
    if (rendered.hasBad) {
      out += '<div style="margin-top:0.15rem;color:#fca5a5;font-size:0.6rem;">&#9888; Some values won\'t resolve in this scene — those parts will be skipped at runtime.</div>';
    }
    return out;
  }

  function _readActionFromDom(aEl) {
    var typeSel = aEl.querySelector('.cb-esc-action-type');
    var type = typeSel ? typeSel.value : '';
    var act = { type: type };
    if (type === 'applyCondition' || type === 'removeCondition') {
      var tgts = [];
      aEl.querySelectorAll('.cb-esc-targets option:checked').forEach(function (o) { tgts.push(o.value); });
      var extra = aEl.querySelector('.cb-esc-extra-targets');
      if (extra && extra.value.trim()) {
        extra.value.split(',').forEach(function (t) {
          var v = t.trim();
          if (v && tgts.indexOf(v) === -1) tgts.push(v);
        });
      }
      act.targets = tgts;
      var conds = [];
      aEl.querySelectorAll('.cb-esc-conditions option:checked').forEach(function (o) { conds.push(o.value); });
      act.conditions = conds;
      if (type === 'applyCondition') {
        var dur = aEl.querySelector('.cb-esc-duration');
        if (dur && dur.value) act.duration = dur.value;
        var arena = aEl.querySelector('.cb-esc-arena');
        if (arena && arena.value) act.arena = arena.value;
      }
    } else if (type === 'damage') {
      var dtgts = [];
      aEl.querySelectorAll('.cb-esc-targets option:checked').forEach(function (o) { dtgts.push(o.value); });
      var dextra = aEl.querySelector('.cb-esc-extra-targets');
      if (dextra && dextra.value.trim()) {
        dextra.value.split(',').forEach(function (t) {
          var v = t.trim();
          if (v && dtgts.indexOf(v) === -1) dtgts.push(v);
        });
      }
      act.targets = dtgts;
      var amtEl = aEl.querySelector('.cb-esc-amount');
      act.amount = amtEl ? (parseInt(amtEl.value, 10) || 0) : 0;
    } else if (type === 'spawn') {
      var srcEl = aEl.querySelector('.cb-esc-spawn-source');
      var src = srcEl ? srcEl.value : 'roster';
      act._source = src;
      if (src === 'library') {
        var libEl = aEl.querySelector('.cb-esc-spawn-library');
        act.npc = libEl ? libEl.value : '';
      } else if (src === 'stub') {
        var nameEl = aEl.querySelector('.cb-esc-stub-name');
        var tierEl = aEl.querySelector('.cb-esc-stub-tier');
        var classEl = aEl.querySelector('.cb-esc-stub-class');
        var roleEl = aEl.querySelector('.cb-esc-stub-role');
        var powerEl = aEl.querySelector('.cb-esc-stub-power');
        act._stub = {
          name: nameEl ? nameEl.value.trim() : '',
          tier: tierEl ? (parseInt(tierEl.value, 10) || 1) : 1,
          classification: classEl ? classEl.value : 'standard',
          role: roleEl ? roleEl.value : '',
          powerSource: powerEl ? powerEl.value : 'martial'
        };
        act.npc = act._stub.name;
      } else {
        var rosterEl = aEl.querySelector('.cb-esc-spawn-npc');
        act.npc = rosterEl ? rosterEl.value : '';
      }
      var countEl = aEl.querySelector('.cb-esc-spawn-count');
      act.count = countEl ? (parseInt(countEl.value, 10) || 1) : 1;
      var zoneEl = aEl.querySelector('.cb-esc-spawn-zone');
      var zn = zoneEl ? zoneEl.value.trim() : '';
      if (zn) act.zone = zn;
    } else if (type === 'narrate') {
      var nEl = aEl.querySelector('.cb-esc-narrate');
      act.text = nEl ? nEl.value : '';
    }
    if (type !== 'narrate') {
      var noteEl = aEl.querySelector('.cb-esc-note');
      if (noteEl && noteEl.value.trim()) act.note = noteEl.value.trim();
    }
    return act;
  }

  function _refreshActionPreview(aEl, scene) {
    var rEl = aEl.closest('.cb-esc-round');
    if (!rEl) return;
    var roundNumEl = rEl.querySelector('.cb-esc-round-num');
    var roundNum = roundNumEl ? (parseInt(roundNumEl.value, 10) || 1) : 1;
    var act = _readActionFromDom(aEl);
    var preview = aEl.querySelector('.cb-esc-action-preview');
    if (preview) {
      var npcNames = _getSceneNpcNames(scene);
      preview.innerHTML = _renderActionPreviewHtml(act, roundNum, npcNames);
    }
    var panel = aEl.closest('.cb-esc-editor');
    if (panel) _refreshLivePreview(panel, scene);
  }

  function _refreshLivePreview(panel, scene) {
    var live = panel.querySelector('.cb-esc-live-preview');
    if (!live) return;
    var draft = _readEscalationFromDom(panel);
    live.innerHTML = _buildLiveEscalationPreview(scene, draft);
  }

  function _readEscalationFromDom(panel) {
    var rounds = [];
    panel.querySelectorAll('.cb-esc-round').forEach(function (rEl) {
      var roundNum = parseInt(rEl.querySelector('.cb-esc-round-num').value, 10) || 1;
      var actions = [];
      rEl.querySelectorAll('.cb-esc-action').forEach(function (aEl) {
        actions.push(_readActionFromDom(aEl));
      });
      rounds.push({ round: roundNum, actions: actions });
    });
    return rounds;
  }

  function _refreshEscalationEditor(panel, scene, encIdx) {
    var draftKey = scene.id + ':' + encIdx;
    _escalationDraft[draftKey] = _readEscalationFromDom(panel);
    var body = panel.querySelector('.cb-fpanel-body');
    if (!body) return;
    body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
    _bindEscalationEditorEvents(panel, scene, encIdx);
  }

  function _condLabelForPreview(cid) {
    var defs = (window.EffectManager && window.EffectManager.EFFECT_DEFS) || [];
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].id === cid) return defs[i].name || cid;
    }
    return cid.charAt(0).toUpperCase() + cid.slice(1);
  }

  function _findSceneNpcsByTarget(scene, target) {
    var sceneNpcs = (scene && scene.npcs) || [];
    var t = String(target || '').trim();
    if (!t) return [];
    var tLower = t.toLowerCase();
    var exact = sceneNpcs.filter(function (n) { return (n.name || '').toLowerCase() === tLower; });
    if (exact.length) return exact;
    var escaped = tLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re;
    try { re = new RegExp('\\b' + escaped + '\\b', 'i'); } catch (e) { re = null; }
    if (!re) return [];
    return sceneNpcs.filter(function (n) { return re.test(n.name || ''); });
  }

  function _simulateEscalationEntry(scene, entry) {
    var resolved = [];
    (entry.actions || []).forEach(function (act) {
      if (!act || !act.type) return;
      var targets = Array.isArray(act.targets) ? act.targets : [];
      var matched = [];
      var pcLabels = [];
      var unresolved = [];
      targets.forEach(function (tgt) {
        var t = String(tgt || '').trim();
        if (!t) return;
        var tLower = t.toLowerCase();
        if (tLower === 'pcs' || tLower === 'players' || tLower === 'party' || tLower === 'all pcs') {
          if (pcLabels.indexOf('All PCs') === -1) pcLabels.push('All PCs');
          return;
        }
        var hits = _findSceneNpcsByTarget(scene, tgt);
        if (!hits.length) {
          if (unresolved.indexOf(t) === -1) unresolved.push(t);
        } else {
          hits.forEach(function (n) { if (matched.indexOf(n) === -1) matched.push(n); });
        }
      });
      var record = { type: act.type, note: act.note || '', unresolved: unresolved };
      if (act.type === 'applyCondition' || act.type === 'removeCondition') {
        record.conditions = (act.conditions || []).slice();
        record.targets = matched.map(function (n) { return n.name; }).concat(pcLabels);
        if (act.type === 'applyCondition') {
          if (act.duration) record.duration = act.duration;
          if (act.arena) record.arena = act.arena;
        }
        if (!record.conditions.length) record._skip = 'no conditions selected';
        else if (!record.targets.length) record._skip = 'no targets resolved in scene roster';
      } else if (act.type === 'damage') {
        record.amount = Math.max(0, parseInt(act.amount, 10) || 0);
        record.targets = matched.map(function (n) { return n.name; }).concat(pcLabels);
        record.pcsAffected = pcLabels.length > 0;
        if (!record.amount) record._skip = 'amount is 0';
        else if (!record.targets.length) record._skip = 'no targets resolved';
      } else if (act.type === 'spawn') {
        var name = act.npc || act.template || (act._stub && act._stub.name) || '';
        var num = Math.max(1, parseInt(act.count, 10) || 1);
        var spawned = [];
        if (name) { for (var i = 0; i < num; i++) spawned.push(name); }
        record.spawned = spawned;
        record.zone = act.zone || '';
        record.spawnSource = act._source || 'roster';
        if (!spawned.length) record._skip = 'no NPC selected';
      } else if (act.type === 'narrate') {
        record.text = String(act.text || act.note || '').trim();
        if (!record.text) record._skip = 'no narration text';
      } else {
        return;
      }
      resolved.push(record);
    });
    return resolved;
  }

  function _renderEscalationPreviewHtml(round, entries) {
    if (!entries.length) {
      return '<div style="margin:0.3rem 0 0;padding:0.4rem 0.6rem;border-left:3px solid #7a7068;background:rgba(122,112,104,0.1);border-radius:0 4px 4px 0;color:#7a7068;font-size:0.65rem;font-style:italic;">No actions to preview. Add at least one action.</div>';
    }
    var html = '<div style="margin:0.4rem 0 0;padding:0.4rem 0.6rem;border-left:3px solid #f59e0b;background:rgba(245,158,11,0.12);border-radius:0 4px 4px 0;color:#fbbf24;font-size:0.7rem;">';
    html += '<div style="display:flex;align-items:center;gap:0.4rem;"><strong style="font-family:Audiowide,sans-serif;font-size:0.6rem;letter-spacing:0.06em;color:#f59e0b;">PREVIEW &mdash; ROUND ' + round + '</strong>';
    html += '<span style="font-size:0.55rem;color:#7a7068;font-style:italic;">(simulated against current scene roster — no state changed)</span>';
    html += '<button class="cb-esc-preview-close" style="margin-left:auto;font-size:0.55rem;padding:0.05rem 0.3rem;background:transparent;color:#7a7068;border:1px solid #7a7068;border-radius:3px;cursor:pointer;">Hide</button>';
    html += '</div>';
    entries.forEach(function (en) {
      var line = '';
      if (en._skip) {
        var typeLbl = en.type.replace(/([A-Z])/g, ' $1').toLowerCase();
        line = '<span style="color:#7a7068;font-style:italic;">[' + esc(typeLbl) + ' skipped: ' + esc(en._skip) + ']</span>';
      } else if (en.type === 'applyCondition') {
        var condStr = (en.conditions || []).map(function (c) { return '[' + _condLabelForPreview(c) + ']'; }).join(' ');
        line = esc(condStr) + ' applied to <strong>' + esc((en.targets || []).join(', ')) + '</strong>';
        var meta = [];
        if (en.duration) meta.push(en.duration);
        if (en.arena) meta.push(en.arena);
        if (meta.length) line += ' <span style="color:#7a7068;font-size:0.6rem;">(' + esc(meta.join(', ')) + ')</span>';
      } else if (en.type === 'removeCondition') {
        var rcondStr = (en.conditions || []).map(function (c) { return '[' + _condLabelForPreview(c) + ']'; }).join(' ');
        line = esc(rcondStr) + ' removed from <strong>' + esc((en.targets || []).join(', ')) + '</strong>';
      } else if (en.type === 'damage') {
        line = '<span style="color:#ef4444;">&#9888; ' + en.amount + ' damage</span> to <strong>' + esc((en.targets || []).join(', ')) + '</strong>';
        if (en.pcsAffected) line += ' <span style="color:#7a7068;font-style:italic;">(GM applies to PC sheets)</span>';
      } else if (en.type === 'spawn') {
        line = '<span style="color:#a855f7;">&#10010; Reinforcements:</span> <strong>' + esc((en.spawned || []).join(', ')) + '</strong>';
        if (en.zone) line += ' <span style="color:#7a7068;">@ ' + esc(en.zone) + '</span>';
        if (en.spawnSource && en.spawnSource !== 'roster') line += ' <span style="color:#a78bfa;font-size:0.6rem;">(from ' + esc(en.spawnSource) + ' — added to roster on save)</span>';
      } else if (en.type === 'narrate') {
        line = '<span style="color:#c084fc;">&#9836;</span> <em>' + esc(en.text) + '</em>';
      }
      html += '<div style="margin-top:0.2rem;">' + line;
      if (en.note && en.type !== 'narrate' && !en._skip) html += ' &mdash; <em>' + esc(en.note) + '</em>';
      if (en.unresolved && en.unresolved.length) {
        html += ' <span style="color:#f97316;font-size:0.6rem;">(unmatched: ' + esc(en.unresolved.join(', ')) + ')</span>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _bindEscalationEditorEvents(panel, scene, encIdx) {
    var draftKey = scene.id + ':' + encIdx;

    panel.querySelectorAll('.cb-esc-action').forEach(function (aEl) {
      var refresh = function () { _refreshActionPreview(aEl, scene); };
      aEl.querySelectorAll('input, textarea, select').forEach(function (el) {
        if (el.classList.contains('cb-esc-action-type')) return;
        el.addEventListener('input', refresh);
        el.addEventListener('change', refresh);
      });
    });

    panel.querySelectorAll('.cb-esc-round').forEach(function (rEl) {
      var roundNumEl = rEl.querySelector('.cb-esc-round-num');
      if (!roundNumEl) return;
      roundNumEl.addEventListener('input', function () {
        rEl.querySelectorAll('.cb-esc-action').forEach(function (aEl) {
          _refreshActionPreview(aEl, scene);
        });
        _refreshLivePreview(panel, scene);
      });
    });

    function reorderAndRerender(mutator) {
      var draft = _readEscalationFromDom(panel);
      mutator(draft);
      _escalationDraft[draftKey] = draft;
      var body = panel.querySelector('.cb-fpanel-body');
      body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
      _bindEscalationEditorEvents(panel, scene, encIdx);
    }

    panel.querySelectorAll('.cb-esc-move-round-up').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        if (ri <= 0) return;
        reorderAndRerender(function (draft) {
          var tmp = draft[ri - 1];
          draft[ri - 1] = draft[ri];
          draft[ri] = tmp;
        });
      });
    });

    panel.querySelectorAll('.cb-esc-move-round-down').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        reorderAndRerender(function (draft) {
          if (ri >= draft.length - 1) return;
          var tmp = draft[ri + 1];
          draft[ri + 1] = draft[ri];
          draft[ri] = tmp;
        });
      });
    });

    panel.querySelectorAll('.cb-esc-move-action-up').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        var ai = parseInt(btn.closest('.cb-esc-action').dataset.actionIdx, 10);
        if (ai <= 0) return;
        reorderAndRerender(function (draft) {
          if (!draft[ri]) return;
          var arr = draft[ri].actions;
          var tmp = arr[ai - 1];
          arr[ai - 1] = arr[ai];
          arr[ai] = tmp;
        });
      });
    });

    panel.querySelectorAll('.cb-esc-move-action-down').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        var ai = parseInt(btn.closest('.cb-esc-action').dataset.actionIdx, 10);
        reorderAndRerender(function (draft) {
          if (!draft[ri]) return;
          var arr = draft[ri].actions;
          if (ai >= arr.length - 1) return;
          var tmp = arr[ai + 1];
          arr[ai + 1] = arr[ai];
          arr[ai] = tmp;
        });
      });
    });

    panel.querySelectorAll('.cb-esc-preview-round').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rEl = btn.closest('.cb-esc-round');
        var ri = parseInt(rEl.dataset.roundIdx, 10);
        var draft = _readEscalationFromDom(panel);
        _escalationDraft[draftKey] = draft;
        var entry = draft[ri];
        if (!entry) return;
        var resolved = _simulateEscalationEntry(scene, entry);
        var out = rEl.querySelector('.cb-esc-preview-out');
        if (!out) return;
        out.innerHTML = _renderEscalationPreviewHtml(entry.round || 1, resolved);
        out.style.display = 'block';
        var closeBtn = out.querySelector('.cb-esc-preview-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function () {
            out.style.display = 'none';
            out.innerHTML = '';
          });
        }
      });
    });

    panel.querySelectorAll('.cb-esc-action-type').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var draft = _readEscalationFromDom(panel);
        var rEl = sel.closest('.cb-esc-round');
        var aEl = sel.closest('.cb-esc-action');
        var ri = parseInt(rEl.dataset.roundIdx, 10);
        var ai = parseInt(aEl.dataset.actionIdx, 10);
        if (draft[ri] && draft[ri].actions[ai]) {
          draft[ri].actions[ai] = { type: sel.value };
        }
        _escalationDraft[draftKey] = draft;
        var body = panel.querySelector('.cb-fpanel-body');
        body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
        _bindEscalationEditorEvents(panel, scene, encIdx);
      });
    });

    panel.querySelectorAll('.cb-esc-spawn-source').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var draft = _readEscalationFromDom(panel);
        var rEl = sel.closest('.cb-esc-round');
        var aEl = sel.closest('.cb-esc-action');
        var ri = parseInt(rEl.dataset.roundIdx, 10);
        var ai = parseInt(aEl.dataset.actionIdx, 10);
        if (draft[ri] && draft[ri].actions[ai]) {
          var current = draft[ri].actions[ai];
          current._source = sel.value;
          if (sel.value !== 'stub') delete current._stub;
          if (sel.value !== 'roster' && sel.value !== 'library') current.npc = '';
          if (sel.value === 'stub' && !current._stub) current._stub = { name: '', tier: 1, classification: 'standard', role: '', powerSource: 'martial' };
        }
        _escalationDraft[draftKey] = draft;
        var body = panel.querySelector('.cb-fpanel-body');
        body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
        _bindEscalationEditorEvents(panel, scene, encIdx);
      });
    });

    panel.querySelectorAll('.cb-esc-del-round').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        var draft = _readEscalationFromDom(panel);
        draft.splice(ri, 1);
        _escalationDraft[draftKey] = draft;
        var body = panel.querySelector('.cb-fpanel-body');
        body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
        _bindEscalationEditorEvents(panel, scene, encIdx);
      });
    });

    panel.querySelectorAll('.cb-esc-del-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        var ai = parseInt(btn.closest('.cb-esc-action').dataset.actionIdx, 10);
        var draft = _readEscalationFromDom(panel);
        if (draft[ri]) draft[ri].actions.splice(ai, 1);
        _escalationDraft[draftKey] = draft;
        var body = panel.querySelector('.cb-fpanel-body');
        body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
        _bindEscalationEditorEvents(panel, scene, encIdx);
      });
    });

    panel.querySelectorAll('.cb-esc-add-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ri = parseInt(btn.closest('.cb-esc-round').dataset.roundIdx, 10);
        var draft = _readEscalationFromDom(panel);
        if (draft[ri]) {
          draft[ri].actions.push({ type: 'applyCondition', targets: [], conditions: [] });
        }
        _escalationDraft[draftKey] = draft;
        var body = panel.querySelector('.cb-fpanel-body');
        body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
        _bindEscalationEditorEvents(panel, scene, encIdx);
      });
    });

    var addRoundBtn = panel.querySelector('.cb-esc-add-round');
    if (addRoundBtn) {
      addRoundBtn.addEventListener('click', function () {
        var draft = _readEscalationFromDom(panel);
        var nextRound = draft.length ? (Math.max.apply(null, draft.map(function (e) { return e.round; })) + 1) : 1;
        draft.push({ round: nextRound, actions: [] });
        _escalationDraft[draftKey] = draft;
        var body = panel.querySelector('.cb-fpanel-body');
        body.innerHTML = _buildEscalationEditorHtml(scene, encIdx);
        _bindEscalationEditorEvents(panel, scene, encIdx);
      });
    }

    var cancelBtn = panel.querySelector('.cb-esc-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        delete _escalationDraft[draftKey];
        closeFloatingPanel('escalation-' + encIdx);
      });
    }

    var saveBtn = panel.querySelector('.cb-esc-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var status = panel.querySelector('.cb-esc-status');
        var draft = _readEscalationFromDom(panel);
        var clean = draft.filter(function (entry) { return entry.actions && entry.actions.length; });
        clean.forEach(function (entry) {
          entry.actions = entry.actions.filter(function (act) {
            if (act.type === 'applyCondition' || act.type === 'removeCondition') {
              return (act.targets && act.targets.length) && (act.conditions && act.conditions.length);
            }
            if (act.type === 'damage') return (act.targets && act.targets.length) && act.amount > 0;
            if (act.type === 'spawn') return !!act.npc;
            if (act.type === 'narrate') return !!(act.text && act.text.trim());
            return false;
          });
        });
        clean = clean.filter(function (entry) { return entry.actions.length; });

        if (status) { status.style.color = '#7a7068'; status.textContent = 'Resolving spawns…'; }
        var savedTemplates = (window.NpcBuilder && window.NpcBuilder.getSavedNpcs) ? window.NpcBuilder.getSavedNpcs() : [];
        var rosterPromises = [];
        clean.forEach(function (entry) {
          (entry.actions || []).forEach(function (act) {
            if (act.type !== 'spawn') return;
            if (act._source === 'library' && act.npc) {
              var tpl = savedTemplates.find(function (t) { return (t.name || '') === act.npc; });
              if (tpl) rosterPromises.push(_addEscalationNpcToSceneRoster(tpl));
            } else if (act._source === 'stub' && act._stub && act._stub.name) {
              var stubSaved = _materializeEscalationStub(act._stub);
              act.npc = stubSaved.name;
              rosterPromises.push(_addEscalationNpcToSceneRoster(stubSaved));
            }
            delete act._source;
            delete act._stub;
          });
        });

        Promise.all(rosterPromises).then(function () {
        if (status) { status.style.color = '#7a7068'; status.textContent = 'Saving…'; }
        return fetch('/api/campaign/scene/' + encodeURIComponent(scene.id) + '/encounter/' + encIdx + '/escalation', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptedEscalation: clean })
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function () {
          if (clean.length === 0) {
            delete scene.encounters[encIdx].scriptedEscalation;
          } else {
            scene.encounters[encIdx].scriptedEscalation = clean;
          }
          delete _escalationDraft[draftKey];
          if (status) { status.style.color = '#22c55e'; status.textContent = 'Saved.'; }
          var encPanel = document.getElementById('fp-encounters');
          if (encPanel) {
            var body = encPanel.querySelector('.cb-fpanel-body');
            if (body) {
              body.innerHTML = _buildEncountersHtml(scene);
              _bindEncounterPanelEvents(encPanel);
            }
          }
          setTimeout(function () { closeFloatingPanel('escalation-' + encIdx); }, 400);
        }).catch(function (err) {
          if (status) { status.style.color = '#ef4444'; status.textContent = 'Save failed: ' + err.message; }
        });
        }).catch(function (err) {
          if (status) { status.style.color = '#ef4444'; status.textContent = 'Spawn resolution failed: ' + err.message; }
        });
      });
    }
  }

  function _materializeEscalationStub(stub) {
    return {
      name: stub.name,
      tier: stub.tier || 1,
      threatCategory: 'character',
      classification: stub.classification || 'standard',
      role: stub.role || '',
      powerSource: stub.powerSource || 'martial',
      arenas: { physique: 2, reflex: 2, grit: 2, wits: 2, presence: 2 },
      traits: [],
      tags: [],
      extraGambits: [],
      attacks: [],
      loot: [],
      numPlayers: 4,
      weaponChassis: 'medium'
    };
  }

  function _addEscalationNpcToSceneRoster(savedNpc) {
    if (!window.NpcBuilder || !window.NpcBuilder.buildNpcFromSaved) {
      return Promise.reject(new Error('NpcBuilder not available'));
    }
    return window.NpcBuilder.buildNpcFromSaved(savedNpc).then(function (built) {
      var existing = getSceneNpcs();
      var nameLc = (savedNpc.name || '').toLowerCase().trim();
      if (existing.some(function (n) { return (n.name || '').toLowerCase().trim() === nameLc; })) {
        return savedNpc.name;
      }
      var newNpc = {
        name: savedNpc.name || 'Unnamed',
        _templateName: nameLc || 'unnamed',
        type: (savedNpc.threatCategory || 'character').charAt(0).toUpperCase() + (savedNpc.threatCategory || 'character').slice(1),
        count: 1,
        loot: savedNpc.loot ? JSON.parse(JSON.stringify(savedNpc.loot)) : [],
        threatBuild: {
          role: savedNpc.role,
          tier: savedNpc.tier,
          classification: savedNpc.classification,
          threatCategory: savedNpc.threatCategory,
          powerSource: savedNpc.powerSource || '',
          arenas: JSON.parse(JSON.stringify(savedNpc.arenas)),
          computed: built.computed,
          traits: savedNpc.traits ? JSON.parse(JSON.stringify(savedNpc.traits)) : [],
          tags: savedNpc.tags ? JSON.parse(JSON.stringify(savedNpc.tags)) : [],
          roleKit: built.roleKit,
          computedAttacks: built.computedAttacks || [],
          weaponChassis: savedNpc.weaponChassis || 'medium',
          loot: savedNpc.loot ? JSON.parse(JSON.stringify(savedNpc.loot)) : []
        }
      };
      existing.push(newNpc);
      setSceneNpcs(existing);
      addSceneNpc(newNpc);
      var adv = getAdventure(currentAdventure);
      var part = adv ? getPart(adv, currentPart) : null;
      var scene = part ? getScene(part, currentScene) : null;
      if (scene) {
        if (!scene.npcs) scene.npcs = [];
        scene.npcs.push(JSON.parse(JSON.stringify(newNpc)));
      }
      return newNpc.name;
    });
  }

  function _openEscalationEditor(scene, encIdx) {
    var panelId = 'escalation-' + encIdx;
    var draftKey = scene.id + ':' + encIdx;
    delete _escalationDraft[draftKey];
    openFloatingPanel(panelId, 'Escalation Script — ' + (scene.encounters[encIdx].name || 'Encounter'),
      _buildEscalationEditorHtml(scene, encIdx),
      { width: 560, height: 560 });
    var panel = document.getElementById('fp-' + panelId);
    if (panel) _bindEscalationEditorEvents(panel, scene, encIdx);
  }

  function _buildChallengesHtml(scene) {
    var dcList = (scene.disciplineChallenges && scene.disciplineChallenges.length) ? scene.disciplineChallenges : (scene.skillChecks || []);
    if (!dcList.length) return '';
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Discipline Challenges</div>';
    dcList.forEach(function (dc) {
      var hasNewFormat = dc.actionType || dc.arena || dc.control || dc.effect;
      h += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.15);border-left:3px solid ' + (dc.actionType === 'assess' ? '#818cf8' : '#c8a44e') + ';">';
      h += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;flex-wrap:wrap;">';
      if (dc.actionType) {
        var atColor = dc.actionType === 'assess' ? '#818cf8' : '#c8a44e';
        h += '<span style="font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:3px;background:' + atColor + ';color:#000;font-family:Audiowide,sans-serif;font-weight:bold;letter-spacing:0.05em;">' + esc(dc.actionType.toUpperCase()) + '</span>';
      }
      var discLabel = (dc.discipline || '').replace(/_/g, ' ');
      var arenaLabel = dc.arena ? ' (' + dc.arena.charAt(0).toUpperCase() + dc.arena.slice(1) + ')' : '';
      h += '<span style="font-size:0.75rem;color:#c8a44e;font-family:Audiowide,sans-serif;">' + esc(discLabel) + esc(arenaLabel) + '</span>';
      if (dc.isOptional) h += '<span style="font-size:0.55rem;padding:0.05rem 0.2rem;border-radius:3px;background:rgba(255,255,255,0.15);color:#7a7068;">OPTIONAL</span>';
      if (dc.isGated) h += '<span style="font-size:0.55rem;padding:0.05rem 0.2rem;border-radius:3px;background:rgba(239,68,68,0.2);color:#f97316;">GATED</span>';
      h += '</div>';
      if (dc.target || dc.defense || dc.tier != null || dc.resist != null || dc.power != null) {
        h += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.15rem;font-size:0.65rem;">';
        if (dc.target) h += '<span style="color:#7a7068;">vs <strong style="color:#d4c5a0;">' + esc(dc.target) + '</strong></span>';
        if (dc.defense) {
          var defLabel = dc.defense.charAt(0).toUpperCase() + dc.defense.slice(1);
          h += '<span style="padding:0.05rem 0.25rem;border-radius:3px;background:rgba(249,115,22,0.15);color:#f97316;font-family:Audiowide,sans-serif;font-size:0.6rem;font-weight:bold;">' + esc(defLabel) + '</span>';
        } else if (dc.tier != null) {
          h += '<span style="padding:0.05rem 0.25rem;border-radius:3px;background:rgba(200,164,78,0.15);color:#c8a44e;font-family:Audiowide,sans-serif;font-size:0.6rem;font-weight:bold;">T' + dc.tier + '</span>';
        }
        if (dc.resist != null) h += '<span style="color:#f97316;">Resist ' + dc.resist + '</span>';
        if (dc.power != null) h += '<span style="color:#eab308;">Power ' + dc.power + '</span>';
        h += '</div>';
      }
      if (dc.isGated) h += '<div style="font-size:0.6rem;color:#f97316;font-style:italic;margin-bottom:0.1rem;">&#128274; ' + esc(dc.isGated) + '</div>';
      h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;">' + linkify(dc.context) + '</div>';
      if (dc.narrativePacing) {
        h += '<div style="font-size:0.6rem;color:#a78bfa;font-style:italic;margin-bottom:0.15rem;">&#9654; ' + esc(dc.narrativePacing) + '</div>';
      }
      if (hasNewFormat && dc.control) {
        h += '<div style="margin-top:0.15rem;padding:0.2rem 0.3rem;border-radius:3px;background:rgba(0,0,0,0.15);">';
        h += '<div style="font-size:0.55rem;color:#7a7068;font-family:Audiowide,sans-serif;margin-bottom:0.1rem;letter-spacing:0.05em;">CONTROL</div>';
        if (dc.control.failure) h += '<div style="font-size:0.65rem;color:#ef4444;margin-bottom:0.05rem;">&#10007; <strong>Fail:</strong> ' + linkify(dc.control.failure) + '</div>';
        if (dc.control.success) h += '<div style="font-size:0.65rem;color:#22c55e;margin-bottom:0.05rem;">&#10003; <strong>Success:</strong> ' + linkify(dc.control.success) + '</div>';
        if (dc.control.mastery) h += '<div style="font-size:0.65rem;color:#fbbf24;margin-bottom:0.05rem;">&#9733; <strong>Mastery:</strong> ' + linkify(dc.control.mastery) + '</div>';
        h += '</div>';
      } else if (!hasNewFormat) {
        if (dc.success) h += '<div style="font-size:0.65rem;color:#22c55e;">&#10003; ' + linkify(dc.success) + '</div>';
        if (dc.failure) h += '<div style="font-size:0.65rem;color:#ef4444;">&#10007; ' + linkify(dc.failure) + '</div>';
      }
      if (hasNewFormat && dc.effect) {
        h += '<div style="margin-top:0.15rem;padding:0.2rem 0.3rem;border-radius:3px;background:rgba(0,0,0,0.1);">';
        h += '<div style="font-size:0.55rem;color:#7a7068;font-family:Audiowide,sans-serif;margin-bottom:0.1rem;letter-spacing:0.05em;">EFFECT TIERS</div>';
        var tierColors = { fleeting: '#6b7280', masterful: '#3b82f6', legendary: '#a855f7', unleashed: '#f59e0b' };
        ['fleeting', 'masterful', 'legendary', 'unleashed'].forEach(function (tier) {
          if (dc.effect[tier]) {
            var tColor = tierColors[tier] || '#6b7280';
            h += '<div style="font-size:0.65rem;margin-bottom:0.05rem;"><span style="color:' + tColor + ';font-weight:bold;">' + tier.charAt(0).toUpperCase() + tier.slice(1) + ':</span> <span style="color:#7a7068;">' + linkify(dc.effect[tier]) + '</span></div>';
          }
        });
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function _buildEnvironmentHtml(scene) {
    var h = '';
    if (scene.hazards) {
      h += '<div class="cb-card">';
      h += '<div class="cb-section-label">Hazards / Environment</div>';
      h += '<div>' + linkify(scene.hazards) + '</div>';
      h += '</div>';
    }
    if (scene.environmentMechanics && scene.environmentMechanics.length) {
      h += '<div class="cb-card">';
      h += '<div class="cb-section-label">Environment Mechanics</div>';
      scene.environmentMechanics.forEach(function (em) {
        h += '<div style="margin-bottom:0.4rem;padding:0.3rem 0.4rem;border-left:2px solid #818cf8;border-radius:0 4px 4px 0;background:rgba(0,0,0,0.1);">';
        h += '<div style="font-size:0.8rem;color:#d4c5a0;font-weight:bold;margin-bottom:0.1rem;">' + esc(em.name) + '</div>';
        h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.1rem;"><strong>Trigger:</strong> ' + linkify(em.trigger) + '</div>';
        h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.1rem;"><strong>Effect:</strong> ' + linkify(em.effect) + '</div>';
        h += '<div style="font-size:0.7rem;color:#c8a44e;"><strong>Mitigation:</strong> ' + linkify(em.mitigation) + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  function _buildRewardsHtml(scene) {
    if (!scene.rewards) return '';
    var r = scene.rewards;
    var hasRewardContent = r.credits || (r.items && r.items.length) || (r.intel && r.intel.length) || (r.connections && r.connections.length);
    if (!hasRewardContent) return '';
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Rewards</div>';
    if (r.credits) h += '<div style="font-size:0.7rem;color:#c8a44e;margin-bottom:0.15rem;">&#9670; Credits: ' + r.credits + '</div>';
    if (r.items && r.items.length) h += '<div style="font-size:0.7rem;color:#7a7068;margin-bottom:0.15rem;">&#9670; Items: ' + r.items.map(function(i){ return esc(typeof i === 'object' ? (i.name || i.id || JSON.stringify(i)) + (i.qty && i.qty > 1 ? ' x' + i.qty : '') : i); }).join(', ') + '</div>';
    if (r.intel && r.intel.length) {
      h += '<div style="font-size:0.7rem;color:#f59e0b;margin-bottom:0.15rem;">&#9670; Intel:</div>';
      r.intel.forEach(function(i){ h += '<div style="font-size:0.65rem;color:#7a7068;padding-left:0.8rem;">• ' + linkify(i) + '</div>'; });
    }
    if (r.connections && r.connections.length) h += '<div style="font-size:0.7rem;color:#c084fc;margin-bottom:0.15rem;">&#9670; Connections: ' + r.connections.map(function(c){return esc(c);}).join(', ') + '</div>';
    h += '</div>';
    return h;
  }

  function _buildPacingHtml(scene) {
    if (!scene.pacing) return '';
    var p = scene.pacing;
    var h = '<div class="cb-card">';
    h += '<div class="cb-section-label">Pacing Guide' + (p.estimatedMinutes ? ' (~' + p.estimatedMinutes + ' min)' : '') + '</div>';
    if (p.openingBeat) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#c8a44e;font-family:Audiowide,sans-serif;font-size:0.6rem;">OPENING</span> ' + linkify(p.openingBeat) + '</div>';
    if (p.risingAction) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#eab308;font-family:Audiowide,sans-serif;font-size:0.6rem;">RISING</span> ' + linkify(p.risingAction) + '</div>';
    if (p.climax) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#ef4444;font-family:Audiowide,sans-serif;font-size:0.6rem;">CLIMAX</span> ' + linkify(p.climax) + '</div>';
    if (p.resolution) h += '<div style="font-size:0.7rem;margin-bottom:0.15rem;"><span style="color:#22c55e;font-family:Audiowide,sans-serif;font-size:0.6rem;">RESOLUTION</span> ' + linkify(p.resolution) + '</div>';
    h += '</div>';
    return h;
  }

  var _holonetFeeds = null;
  var _holonetHistory = null;
  var _holonetSelected = {};

  function _loadHolonetData(cb) {
    var loaded = 0;
    function check() { loaded++; if (loaded >= 2 && cb) cb(); }
    fetch('/api/campaign/holonet/feeds')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) _holonetFeeds = d.feeds; check(); })
      .catch(function () { check(); });
    fetch('/api/campaign/holonet/history')
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) _holonetHistory = d.broadcasts; check(); })
      .catch(function () { check(); });
  }

  function _getAlreadySentIds() {
    if (!_holonetHistory) return {};
    var sent = {};
    _holonetHistory.forEach(function (b) {
      try {
        var ids = JSON.parse(b.story_ids);
        ids.forEach(function (id) { sent[id] = b.broadcast_at; });
      } catch (e) {}
    });
    return sent;
  }

  function _buildHoloNetHtml() {
    if (!_holonetFeeds) {
      _loadHolonetData(function () {
        var panel = document.getElementById('fp-holonet');
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) body.innerHTML = _buildHoloNetHtml();
          _bindHolonetHandlers(panel);
        }
      });
      return '<div class="hn-loading">Loading HoloNet feeds...</div>';
    }

    var sentIds = _getAlreadySentIds();
    var selectedCount = Object.keys(_holonetSelected).filter(function (k) { return _holonetSelected[k]; }).length;

    var h = '<div class="hn-panel">';
    h += '<div class="hn-header">';
    h += '<span class="hn-header-logo">&#128225; IMPERIAL HOLONET — BROADCAST TERMINAL</span>';
    h += '<div class="hn-header-actions">';
    h += '<button class="hn-broadcast-btn' + (selectedCount === 0 ? ' hn-btn--disabled' : '') + '" id="hn-send-broadcast"' + (selectedCount === 0 ? ' disabled' : '') + '>&#9889; BROADCAST (' + selectedCount + ')</button>';
    h += '<button class="hn-select-none-btn" id="hn-clear-selection">CLEAR</button>';
    h += '</div>';
    h += '</div>';

    _holonetFeeds.forEach(function (feed) {
      h += '<div class="hn-feed-group">';
      h += '<div class="hn-feed-label">' + esc(feed.label) + '</div>';

      feed.stories.forEach(function (story) {
        var isSent = !!sentIds[story.id];
        var isSelected = !!_holonetSelected[story.id];
        var typeClass = 'hn-type--' + (story.type || 'flavor');

        h += '<div class="hn-story-card' + (isSelected ? ' hn-story--selected' : '') + (isSent ? ' hn-story--sent' : '') + '" data-story-id="' + esc(story.id) + '">';
        h += '<div class="hn-story-select">';
        h += '<input type="checkbox" class="hn-story-check" data-story-id="' + esc(story.id) + '"' + (isSelected ? ' checked' : '') + ' />';
        h += '</div>';
        h += '<div class="hn-story-content">';
        h += '<div class="hn-story-headline">' + esc(story.headline) + '</div>';
        h += '<div class="hn-story-meta">';
        h += '<span class="hn-story-source">' + esc(story.source) + '</span>';
        h += '<span class="hn-story-type ' + typeClass + '">' + esc(story.type || 'flavor').toUpperCase() + '</span>';
        if (isSent) h += '<span class="hn-story-sent-badge">SENT</span>';
        h += '</div>';
        h += '<div class="hn-story-body">' + esc(story.body) + '</div>';
        if (story.tags && story.tags.length > 0) {
          h += '<div class="hn-story-tags">';
          story.tags.forEach(function (tag) {
            h += '<span class="hn-tag">' + esc(tag) + '</span>';
          });
          h += '</div>';
        }
        h += '</div>';
        h += '</div>';
      });

      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  function _bindHolonetHandlers(container) {
    if (!container) return;
    container.querySelectorAll('.hn-story-check').forEach(function (chk) {
      chk.addEventListener('change', function () {
        _holonetSelected[chk.dataset.storyId] = chk.checked;
        var panel = document.getElementById('fp-holonet');
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) { body.innerHTML = _buildHoloNetHtml(); _bindHolonetHandlers(panel); }
        }
      });
    });
    container.querySelectorAll('.hn-story-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.classList.contains('hn-story-check')) return;
        var chk = card.querySelector('.hn-story-check');
        if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
      });
    });
    var sendBtn = container.querySelector('#hn-send-broadcast');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var ids = Object.keys(_holonetSelected).filter(function (k) { return _holonetSelected[k]; });
        if (ids.length === 0) return;
        sendBtn.disabled = true;
        sendBtn.textContent = 'TRANSMITTING...';
        fetch('/api/campaign/holonet/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyIds: ids })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok && data.stories) {
              _holonetSelected = {};
              _loadHolonetData(function () {
                var panel = document.getElementById('fp-holonet');
                if (panel) {
                  var body = panel.querySelector('.cb-fpanel-body');
                  if (body) { body.innerHTML = _buildHoloNetHtml(); _bindHolonetHandlers(panel); }
                }
              });
            }
          })
          .catch(function (err) {
            console.error('[HoloNet] Broadcast failed:', err);
            sendBtn.disabled = false;
            sendBtn.textContent = '⚡ BROADCAST (retry)';
          });
      });
    }
    var clearBtn = container.querySelector('#hn-clear-selection');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        _holonetSelected = {};
        var panel = document.getElementById('fp-holonet');
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) { body.innerHTML = _buildHoloNetHtml(); _bindHolonetHandlers(panel); }
        }
      });
    }
  }

  function openFloatingPanel(panelId, title, contentHtml, opts) {
    opts = opts || {};
    var existing = document.getElementById('fp-' + panelId);
    if (existing) {
      existing.style.zIndex = ++_panelZCounter;
      return;
    }
    _openPanels[panelId] = true;
    var tile = document.querySelector('[data-panel-id="' + panelId + '"]');
    if (tile) tile.classList.add('cb-tile--active');

    var panel = document.createElement('div');
    panel.className = 'cb-floating-panel';
    panel.id = 'fp-' + panelId;
    panel.dataset.panelKey = panelId;
    panel.style.zIndex = ++_panelZCounter;

    var saved = _loadPanelGeometry(panelId);
    var w = saved ? saved.w : (opts.width || 480);
    var h = saved ? saved.h : (opts.height || 400);
    var posX, posY;
    if (saved) {
      posX = Math.max(0, Math.min(saved.x, window.innerWidth - 100));
      posY = Math.max(0, Math.min(saved.y, window.innerHeight - 60));
    } else {
      posX = Math.max(40, Math.round((window.innerWidth - w) / 2) + (Object.keys(_openPanels).length - 1) * 24);
      posY = Math.max(60, Math.round((window.innerHeight - h) / 2) + (Object.keys(_openPanels).length - 1) * 24);
    }
    panel.style.left = posX + 'px';
    panel.style.top = posY + 'px';
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';

    panel.innerHTML =
      '<div class="cb-fpanel-titlebar">' +
        '<span class="cb-fpanel-title">' + esc(title) + '</span>' +
        '<button class="cb-fpanel-close">&times;</button>' +
      '</div>' +
      '<div class="cb-fpanel-body">' + contentHtml + '</div>';

    document.body.appendChild(panel);

    panel.addEventListener('mousedown', function () {
      panel.style.zIndex = ++_panelZCounter;
    });

    panel.querySelector('.cb-fpanel-close').addEventListener('click', function () {
      closeFloatingPanel(panelId);
    });

    _initPanelDrag(panel);
    _initPanelResizeObserver(panel);
    _bindPanelContent(panel, panelId);
  }

  function closeFloatingPanel(panelId) {
    var panel = document.getElementById('fp-' + panelId);
    if (panel) {
      _captureAndSaveGeo(panel, panelId);
      panel.remove();
    }
    delete _openPanels[panelId];
    var tile = document.querySelector('[data-panel-id="' + panelId + '"]');
    if (tile) tile.classList.remove('cb-tile--active');
    if (panelId === 'readaloud' && window.TtsNarration) {
      window.TtsNarration.stop();
    }
  }

  function closeAllFloatingPanels() {
    Object.keys(_openPanels).forEach(function (id) {
      closeFloatingPanel(id);
    });
  }

  function _initPanelDrag(panel) {
    var titlebar = panel.querySelector('.cb-fpanel-titlebar');
    var panelId = panel.dataset.panelKey;
    var startX, startY, origLeft, origTop;
    function onStart(x, y) {
      startX = x;
      startY = y;
      origLeft = panel.offsetLeft;
      origTop = panel.offsetTop;
    }
    function onMove(x, y) {
      panel.style.left = Math.max(0, origLeft + x - startX) + 'px';
      panel.style.top = Math.max(0, origTop + y - startY) + 'px';
    }
    function onEnd() {
      if (panelId) _captureAndSaveGeo(panel, panelId);
    }
    titlebar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.cb-fpanel-close')) return;
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      document.addEventListener('mousemove', mmove);
      document.addEventListener('mouseup', mup);
    });
    function mmove(e) { onMove(e.clientX, e.clientY); }
    function mup() {
      document.removeEventListener('mousemove', mmove);
      document.removeEventListener('mouseup', mup);
      onEnd();
    }
    titlebar.addEventListener('touchstart', function (e) {
      if (e.target.closest('.cb-fpanel-close')) return;
      var t = e.touches[0];
      onStart(t.clientX, t.clientY);
      document.addEventListener('touchmove', tmove, { passive: false });
      document.addEventListener('touchend', tend);
    });
    function tmove(e) {
      e.preventDefault();
      var t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }
    function tend() {
      document.removeEventListener('touchmove', tmove);
      document.removeEventListener('touchend', tend);
      onEnd();
    }
  }

  function _initPanelResizeObserver(panel) {
    var panelId = panel.dataset.panelKey;
    if (!panelId) return;
    var initW = panel.offsetWidth;
    var initH = panel.offsetHeight;
    var settled = false;
    var debounceTimer = null;
    var ro = new ResizeObserver(function () {
      if (!settled) {
        var curW = panel.offsetWidth;
        var curH = panel.offsetHeight;
        if (curW === initW && curH === initH) return;
        if (Math.abs(curW - initW) < 3 && Math.abs(curH - initH) < 3) return;
        settled = true;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        _captureAndSaveGeo(panel, panelId);
      }, 300);
    });
    ro.observe(panel);
  }

  function _bindPanelContent(panel, panelId) {
    panel.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
    panel.querySelectorAll('.cb-map-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.dataset.mapKey;
        if (key) openTacticalMapToKey(key);
      });
    });
    panel.querySelectorAll('.cb-conversation-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var slug = el.dataset.convSlug;
        if (slug && window.ConversationOverlay) window.ConversationOverlay.launch(slug);
      });
    });
    panel.querySelectorAll('.cb-encounter-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var encId = el.dataset.encId;
        var adv = getAdventure(currentAdventure);
        var part = adv ? getPart(adv, currentPart) : null;
        var sc = part ? getScene(part, currentScene) : null;
        if (!encId || !sc || !sc.encounters) return;
        var enc = null;
        for (var i = 0; i < sc.encounters.length; i++) if (sc.encounters[i].id === encId) { enc = sc.encounters[i]; break; }
        if (enc && window.CombatTracker) {
          window._cbSocket = socket;
          window.CombatTracker.start(enc, sc, getSceneNpcs(), partyCache, socket);
          var ctPanel = document.getElementById('combat-tracker-panel');
          if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    panel.querySelectorAll('.cb-lore-tag').forEach(function (el) {
      el.addEventListener('click', function () { openLoreModal(el.dataset.loreTag); });
    });
    panel.querySelectorAll('.cb-narrative-link').forEach(function (el) {
      el.addEventListener('click', function () { navigateToScene(el.dataset.navScene); });
    });

    if (panelId === 'readaloud') {
      _bindTtsEvents(panel);
    }
    if (panelId === 'npcs') {
      _bindNpcPanelEvents(panel);
    }
    if (panelId === 'encounters') {
      _bindEncounterPanelEvents(panel);
    }
    if (panelId === 'holonet') {
      _bindHolonetHandlers(panel);
    }
    if (panelId === 'groupchallenge') {
      _bindGroupChallengeEvents(panel);
    }
  }

  function _bindTtsEvents(panel) {
    if (!window.TtsNarration) return;
    var TTS = window.TtsNarration;

    if (!TTS.isSupported()) {
      panel.querySelectorAll('.cb-tts-narrate-btn').forEach(function (btn) {
        btn.disabled = true;
        btn.title = 'Text-to-speech not supported in this browser';
        btn.style.opacity = '0.4';
      });
      var settingsEl = panel.querySelector('.cb-tts-settings');
      if (settingsEl) settingsEl.style.display = 'none';
      return;
    }

    function _populateVoiceSelect(voices) {
      var sel = panel.querySelector('[data-tts-control="voice"]');
      if (!sel) return;
      var prefs = TTS.getPrefs();
      sel.innerHTML = '';
      voices.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = v.name + ' (' + v.lang + ')';
        if (prefs.voiceURI && v.voiceURI === prefs.voiceURI) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!prefs.voiceURI && sel.options.length) {
        var en = voices.filter(function (v) { return v.lang && v.lang.indexOf('en') === 0; });
        var deep = en.filter(function (v) {
          var n = v.name.toLowerCase();
          return n.indexOf('male') > -1 || n.indexOf('daniel') > -1 || n.indexOf('david') > -1;
        });
        var best = deep[0] || en[0] || voices[0];
        if (best) { sel.value = best.voiceURI; TTS.setPref('voiceURI', best.voiceURI); }
      }
    }

    TTS.loadVoices().then(_populateVoiceSelect);
    TTS.onVoicesLoaded(_populateVoiceSelect);

    var toggleBtn = panel.querySelector('[data-tts-toggle="settings"]');
    var settingsBody = panel.querySelector('.cb-tts-settings-body');
    if (toggleBtn && settingsBody) {
      toggleBtn.addEventListener('click', function () {
        var open = settingsBody.style.display !== 'none';
        settingsBody.style.display = open ? 'none' : 'block';
        toggleBtn.classList.toggle('active', !open);
      });
    }

    var voiceSel = panel.querySelector('[data-tts-control="voice"]');
    if (voiceSel) voiceSel.addEventListener('change', function () {
      TTS.setPref('voiceURI', this.value);
    });
    var rateSlider = panel.querySelector('[data-tts-control="rate"]');
    if (rateSlider) rateSlider.addEventListener('input', function () {
      var v = parseFloat(this.value);
      TTS.setPref('rate', v);
      var lbl = panel.querySelector('[data-tts-val="rate"]');
      if (lbl) lbl.textContent = v.toFixed(2);
    });
    var pitchSlider = panel.querySelector('[data-tts-control="pitch"]');
    if (pitchSlider) pitchSlider.addEventListener('input', function () {
      var v = parseFloat(this.value);
      TTS.setPref('pitch', v);
      var lbl = panel.querySelector('[data-tts-val="pitch"]');
      if (lbl) lbl.textContent = v.toFixed(2);
    });
    var autoCont = panel.querySelector('[data-tts-control="autoContinue"]');
    if (autoCont) autoCont.addEventListener('change', function () {
      TTS.setPref('autoContinue', this.checked);
    });

    function _getPart1Text() {
      var el = panel.querySelector('[data-tts-section="part1"] .cb-read-aloud-text');
      return el ? el.innerHTML : '';
    }
    function _getPart2Text() {
      var el = panel.querySelector('[data-tts-section="part2"] .cb-read-aloud-text');
      return el ? el.innerHTML : '';
    }
    function _getSingleText() {
      var el = panel.querySelector('[data-tts-section="single"] .cb-read-aloud-text');
      return el ? el.innerHTML : '';
    }

    function _updateButtons(state, partId) {
      var isSpeaking = state === 'speaking' || state === 'waiting';
      panel.querySelectorAll('.cb-tts-narrate-btn').forEach(function (btn) {
        var action = btn.dataset.ttsAction;
        if (isSpeaking) {
          btn.innerHTML = '&#9632; Stop';
          btn.classList.add('speaking');
        } else {
          btn.classList.remove('speaking');
          btn.innerHTML = '&#9654; Narrate';
        }
      });

      panel.querySelectorAll('[data-tts-section]').forEach(function (sec) {
        sec.classList.remove('cb-tts-active');
      });
      if (isSpeaking && partId) {
        var sectionKey = partId.replace(/^.*?(part1|part2|single)$/, '$1');
        var activeSec = panel.querySelector('[data-tts-section="' + sectionKey + '"]');
        if (activeSec) activeSec.classList.add('cb-tts-active');
      }
    }

    TTS.onStateChange(_updateButtons);

    panel.querySelectorAll('.cb-tts-narrate-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = btn.dataset.ttsAction;
        if (TTS.getState() === 'speaking' || TTS.getState() === 'waiting') {
          TTS.stop();
          return;
        }
        if (action === 'narrate-all') {
          TTS.speakParts(_getPart1Text(), _getPart2Text(), 'ra_');
        } else if (action === 'narrate-part2') {
          TTS.speak(_getPart2Text(), 'ra_part2');
        } else if (action === 'narrate-single') {
          TTS.speak(_getSingleText(), 'ra_single');
        }
      });
    });
  }

  function _bindNpcPanelEvents(panel) {
    panel.querySelectorAll('.cb-npc-card-header').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.cb-npc-edit-btn') || e.target.closest('.cb-npc-remove-btn')) return;
        var card = el.closest('.cb-npc-card');
        if (!card) return;
        var expandKey = el.dataset.npcToggle;
        card.classList.toggle('expanded');
        _npcExpandState[expandKey] = card.classList.contains('expanded');
      });
    });
    panel.querySelectorAll('.cb-npc-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.npcIdx, 10);
        var npcs = getSceneNpcs();
        var npc = npcs[idx];
        if (!npc || !npc.threatBuild) return;
        var buildData = JSON.parse(JSON.stringify(npc.threatBuild));
        buildData.name = npc.name || buildData.name || '';
        if (npc.loot) buildData.loot = JSON.parse(JSON.stringify(npc.loot));
        if (window.NpcBuilder) {
          window.NpcBuilder.openWithNpc(buildData, function (updated) {
            npc.name = updated.name || npc.name;
            npc.threatBuild = updated;
            npc.threatBuild.computed = updated.computed;
            if (updated.roleKit) npc.threatBuild.roleKit = updated.roleKit;
            if (updated.powerSource) npc.threatBuild.powerSource = updated.powerSource;
            npc.threatBuild.computedAttacks = updated.computedAttacks || [];
            if (updated.loot) npc.loot = updated.loot;
            setSceneNpcs(npcs);
            persistSceneNpc(idx, npc);
            _refreshNpcPanel();
          });
        }
      });
    });
    panel.querySelectorAll('.cb-npc-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.npcIdx, 10);
        var npcs = getSceneNpcs();
        if (idx < 0 || idx >= npcs.length) return;
        npcs.splice(idx, 1);
        setSceneNpcs(npcs);
        deleteSceneNpc(idx);
        _refreshNpcPanel();
        renderScene();
      });
    });
    panel.querySelectorAll('.cb-npc-loot-assign-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.dataset.menuOpen === 'true') return;
        btn.dataset.menuOpen = 'true';
        var lootIdx = parseInt(btn.dataset.lootIdx, 10);
        var card = btn.closest('.cb-npc-card');
        var npcIdx = card ? parseInt(card.dataset.npcIdx, 10) : -1;
        var online = partyCache.filter(function (pc) { return pc.id; });
        if (!online.length) {
          showLootToast('No players online.');
          btn.dataset.menuOpen = 'false';
          return;
        }
        var menu = document.createElement('div');
        menu.className = 'cb-loot-assign-menu';
        online.forEach(function (pc) {
          var opt = document.createElement('button');
          opt.className = 'cb-loot-assign-option';
          opt.textContent = pc.name || ('PC #' + pc.id);
          opt.addEventListener('click', function () {
            assignLootToPC(npcIdx, lootIdx, pc.id, pc.name || ('PC #' + pc.id));
            menu.remove();
            btn.dataset.menuOpen = 'false';
          });
          menu.appendChild(opt);
        });
        btn.parentNode.style.position = 'relative';
        btn.parentNode.appendChild(menu);
        setTimeout(function () {
          document.addEventListener('click', function closeMenu(ev) {
            if (!menu.contains(ev.target)) {
              menu.remove();
              btn.dataset.menuOpen = 'false';
              document.removeEventListener('click', closeMenu);
            }
          });
        }, 0);
      });
    });
    var addNpcBtn = panel.querySelector('#cb-add-npc-btn');
    if (addNpcBtn) {
      addNpcBtn.addEventListener('click', function () {
        var addPanel = panel.querySelector('#cb-add-npc-panel');
        if (!addPanel) return;
        if (addPanel.style.display !== 'none') {
          addPanel.style.display = 'none';
          return;
        }
        _renderAddNpcPanel(panel, addPanel, null);
      });
    }
  }

  function _buildInlineStub(name) {
    var nm = (name || '').trim() || 'New Stub';
    return {
      name: nm,
      tier: 1,
      threatCategory: 'character',
      arenas: { physique: 2, reflex: 2, grit: 2, wits: 2, presence: 2 },
      role: '',
      powerSource: '',
      classification: 'standard',
      traits: [],
      tags: [],
      extraGambits: [],
      attacks: [],
      loot: [],
      numPlayers: 4,
      socialNotes: '',
      weaponChassis: 'medium',
      shipDetails: { hullType: '', crew: '', hyperdrive: '', sensors: '', shields: '', cargo: '', speed: '' }
    };
  }

  function _addStubToScene(stub) {
    return window.NpcBuilder.buildNpcFromSaved(stub).then(function (built) {
      var newNpc = {
        name: stub.name,
        _templateName: stub.name.toLowerCase().trim(),
        type: 'Character',
        count: 1,
        loot: [],
        threatBuild: {
          role: '',
          tier: stub.tier,
          classification: stub.classification,
          threatCategory: stub.threatCategory,
          powerSource: '',
          arenas: JSON.parse(JSON.stringify(stub.arenas)),
          computed: built.computed,
          traits: [],
          tags: [],
          roleKit: null,
          computedAttacks: [],
          weaponChassis: 'medium',
          loot: []
        }
      };
      var npcs = getSceneNpcs();
      npcs.push(newNpc);
      var newIdx = npcs.length - 1;
      setSceneNpcs(npcs);
      addSceneNpc(newNpc);
      return newIdx;
    });
  }

  function _editNpcInBuilder(npcIdx, onDone) {
    var npcs = getSceneNpcs();
    var npc = npcs[npcIdx];
    if (!npc || !npc.threatBuild || !window.NpcBuilder) return;
    var buildData = JSON.parse(JSON.stringify(npc.threatBuild));
    buildData.name = npc.name || buildData.name || '';
    if (npc.loot) buildData.loot = JSON.parse(JSON.stringify(npc.loot));
    window.NpcBuilder.openWithNpc(buildData, function (updated) {
      npc.name = updated.name || npc.name;
      npc.threatBuild = updated;
      npc.threatBuild.computed = updated.computed;
      if (updated.roleKit) npc.threatBuild.roleKit = updated.roleKit;
      if (updated.powerSource) npc.threatBuild.powerSource = updated.powerSource;
      npc.threatBuild.computedAttacks = updated.computedAttacks || [];
      if (updated.loot) npc.loot = updated.loot;
      setSceneNpcs(npcs);
      persistSceneNpc(npcIdx, npc);
      if (typeof onDone === 'function') onDone();
    });
  }

  function _renderAddNpcPanel(panel, addPanel, lastStubIdx) {
    var saved = window.NpcBuilder ? window.NpcBuilder.getSavedNpcs() : [];
    var ph = '';

    ph += '<div class="cb-add-npc-stub" style="padding:0.4rem 0.5rem;border:1px dashed #c8a44e;border-radius:4px;background:rgba(200,164,78,0.05);margin-bottom:0.5rem;">';
    ph += '<div style="font-family:Audiowide,sans-serif;font-size:0.6rem;color:#c8a44e;letter-spacing:0.05em;margin-bottom:0.25rem;">INLINE NPC STUB</div>';
    ph += '<div style="font-size:0.6rem;color:#7a7068;line-height:1.3;margin-bottom:0.3rem;">Quick 2/2/2/2/2 NPC with no role, traits, or attacks. Flesh it out in the Threat Builder.</div>';
    ph += '<div style="display:flex;gap:0.3rem;align-items:center;">';
    ph += '<input type="text" id="cb-stub-name" placeholder="Name (e.g. Imperial Guard)" style="flex:1;padding:0.25rem 0.4rem;background:rgba(0,0,0,0.4);border:1px solid #c8a44e;color:#d4c5a0;border-radius:3px;font-size:0.7rem;" />';
    ph += '<button id="cb-stub-create" style="font-size:0.65rem;padding:0.3rem 0.6rem;background:#22c55e;color:#000;border:none;border-radius:3px;cursor:pointer;font-family:Audiowide,sans-serif;letter-spacing:0.05em;font-weight:bold;">Create</button>';
    ph += '</div>';
    if (lastStubIdx != null) {
      var npcs = getSceneNpcs();
      var stubNpc = npcs[lastStubIdx];
      var stubName = stubNpc ? (stubNpc.name || 'New Stub') : 'New Stub';
      ph += '<div id="cb-stub-followup" style="margin-top:0.4rem;padding:0.35rem 0.45rem;background:rgba(34,197,94,0.1);border-left:2px solid #22c55e;border-radius:0 3px 3px 0;font-size:0.65rem;color:#d4c5a0;">';
      ph += 'Created <strong>' + esc(stubName) + '</strong>. ';
      ph += '<a href="#" id="cb-stub-open-builder" data-stub-idx="' + lastStubIdx + '" style="color:#f59e0b;text-decoration:underline;cursor:pointer;font-family:Audiowide,sans-serif;letter-spacing:0.04em;">Open in Threat Builder &rarr;</a>';
      ph += '</div>';
    }
    ph += '</div>';

    if (saved.length) {
      ph += '<div style="font-family:Audiowide,sans-serif;font-size:0.55rem;color:#7a7068;letter-spacing:0.05em;margin-bottom:0.2rem;">SAVED NPCS</div>';
      ph += '<div class="cb-add-npc-list">';
      saved.forEach(function (npc, si) {
        var catBadge = (npc.threatCategory && npc.threatCategory !== 'character') ? esc(npc.threatCategory.charAt(0).toUpperCase() + npc.threatCategory.slice(1)) + ' ' : '';
        ph += '<button class="cb-add-npc-item" data-saved-idx="' + si + '">';
        ph += '<span class="cb-add-npc-item-name">' + esc(npc.name || 'Unnamed') + '</span>';
        ph += '<span class="cb-add-npc-item-meta">' + catBadge + 'T' + (npc.tier || 0) + ' ' + esc(npc.classification || '') + ' ' + esc(npc.role || '') + '</span>';
        ph += '</button>';
      });
      ph += '</div>';
    } else {
      ph += '<p class="cb-muted" style="font-size:0.65rem;font-style:italic;">No saved NPCs in Threat Builder yet.</p>';
    }

    addPanel.innerHTML = ph;
    addPanel.style.display = 'block';

    var createBtn = addPanel.querySelector('#cb-stub-create');
    var nameInput = addPanel.querySelector('#cb-stub-name');
    function doCreate() {
      var stub = _buildInlineStub(nameInput ? nameInput.value : '');
      _addStubToScene(stub).then(function (newIdx) {
        _refreshNpcPanel();
        renderScene();
        var refreshedPanel = document.getElementById('fp-npcs');
        var refreshedAdd = refreshedPanel ? refreshedPanel.querySelector('#cb-add-npc-panel') : null;
        if (refreshedPanel && refreshedAdd) {
          _renderAddNpcPanel(refreshedPanel, refreshedAdd, newIdx);
        }
      });
    }
    if (createBtn) createBtn.addEventListener('click', doCreate);
    if (nameInput) {
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); doCreate(); }
      });
    }

    var openLink = addPanel.querySelector('#cb-stub-open-builder');
    if (openLink) {
      openLink.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(openLink.dataset.stubIdx, 10);
        _editNpcInBuilder(idx, function () {
          _refreshNpcPanel();
          var refreshedPanel = document.getElementById('fp-npcs');
          var refreshedAdd = refreshedPanel ? refreshedPanel.querySelector('#cb-add-npc-panel') : null;
          if (refreshedPanel && refreshedAdd) {
            _renderAddNpcPanel(refreshedPanel, refreshedAdd, idx);
          }
        });
      });
    }

    addPanel.querySelectorAll('.cb-add-npc-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var si = parseInt(item.dataset.savedIdx, 10);
        var savedNpc = saved[si];
        if (!savedNpc) return;
        window.NpcBuilder.buildNpcFromSaved(savedNpc).then(function (built) {
          var newNpc = {
            name: savedNpc.name || 'Unnamed',
            _templateName: (savedNpc.name || 'unnamed').toLowerCase().trim(),
            type: (savedNpc.threatCategory || 'character').charAt(0).toUpperCase() + (savedNpc.threatCategory || 'character').slice(1),
            count: 1,
            loot: savedNpc.loot ? JSON.parse(JSON.stringify(savedNpc.loot)) : [],
            threatBuild: {
              role: savedNpc.role,
              tier: savedNpc.tier,
              classification: savedNpc.classification,
              threatCategory: savedNpc.threatCategory,
              powerSource: savedNpc.powerSource || built.powerSource || '',
              arenas: JSON.parse(JSON.stringify(savedNpc.arenas)),
              computed: built.computed,
              traits: savedNpc.traits ? JSON.parse(JSON.stringify(savedNpc.traits)) : [],
              tags: savedNpc.tags ? JSON.parse(JSON.stringify(savedNpc.tags)) : [],
              roleKit: built.roleKit,
              computedAttacks: built.computedAttacks || [],
              weaponChassis: savedNpc.weaponChassis || 'medium',
              loot: savedNpc.loot ? JSON.parse(JSON.stringify(savedNpc.loot)) : []
            }
          };
          var npcs = getSceneNpcs();
          npcs.push(newNpc);
          setSceneNpcs(npcs);
          addSceneNpc(newNpc);
          addPanel.style.display = 'none';
          _refreshNpcPanel();
          renderScene();
        });
      });
    });
  }

  function _refreshNpcPanel() {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    if (!scene) return;
    var panel = document.getElementById('fp-npcs');
    if (!panel) return;
    var body = panel.querySelector('.cb-fpanel-body');
    if (body) {
      body.innerHTML = _buildNpcRosterHtml(scene);
      _bindNpcPanelEvents(panel);
    }
  }

  function _bindEncounterPanelEvents(panel) {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    panel.querySelectorAll('.ct-start-encounter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var encIdx = parseInt(btn.dataset.encIdx, 10);
        if (isNaN(encIdx) || !scene || !scene.encounters || !scene.encounters[encIdx]) return;
        var enc = scene.encounters[encIdx];
        if (window.CombatTracker) {
          window._cbSocket = socket;
          window.CombatTracker.start(enc, scene, getSceneNpcs(), partyCache, socket);
          closeFloatingPanel('encounters');
          var ctPanel = document.getElementById('combat-tracker-panel');
          if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    panel.querySelectorAll('.cb-edit-escalation-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var encIdx = parseInt(btn.dataset.encIdx, 10);
        if (isNaN(encIdx) || !scene || !scene.encounters || !scene.encounters[encIdx]) return;
        _openEscalationEditor(scene, encIdx);
      });
    });
  }

  function _detectHookTokens(text) {
    var s = String(text || '');
    var re = /\[(conversation|map|encounter):([^\]]+)\]/g;
    var out = []; var m;
    while ((m = re.exec(s)) !== null) {
      out.push({ kind: m[1], target: m[2].trim() });
    }
    return out;
  }

  function _renderRunSceneSpotlight(scene, beatIdx) {
    var encs = (scene.encounters || []);
    var beat = encs[beatIdx] || null;
    var html = '';
    if (!beat) {
      html += '<div class="cb-rs-spotlight">';
      html += '<div class="cb-rs-beat-head"><div class="cb-rs-beat-title">Whole Scene</div><div class="cb-rs-beat-meta">No beats authored — scene-level overview</div></div>';
      var tokens = _detectHookTokens((scene.readAloud || '') + ' ' + (scene.gmNotes || ''));
      if (encs.length || tokens.length) {
        html += '<div class="cb-rs-hooks"><div class="cb-rs-hook-label">Quick Launch</div>';
        encs.forEach(function (e) {
          html += '<button class="cb-rs-hook-btn cb-encounter-link" data-enc-id="' + esc(e.id) + '">&#9876; ' + esc(e.name || e.id) + '</button>';
        });
        tokens.forEach(function (t) {
          if (t.kind === 'conversation') {
            html += '<button class="cb-rs-hook-btn cb-conversation-link" data-conv-slug="' + esc(t.target) + '">&#128172; ' + esc(_slugToTitle(t.target)) + '</button>';
          } else if (t.kind === 'map') {
            html += '<button class="cb-rs-hook-btn cb-map-link" data-map-key="' + esc(t.target) + '">&#128506; ' + esc(_slugToTitle(t.target)) + '</button>';
          }
        });
        html += '</div>';
      }
      html += '</div>';
      return html;
    }
    var typeColor = beat.type === 'combat' ? '#ef4444' : beat.type === 'social' ? '#c084fc' : beat.type === 'infiltration' ? '#818cf8' : '#c8a44e';
    html += '<div class="cb-rs-spotlight" style="border-left-color:' + typeColor + ';">';
    html += '<div class="cb-rs-beat-head">';
    html += '<div class="cb-rs-beat-title">' + esc(beat.name || ('Beat ' + (beatIdx + 1))) + '</div>';
    html += '<span class="cb-rs-beat-pill" style="background:' + typeColor + ';">' + esc(beat.type || 'beat') + '</span>';
    html += '</div>';
    if (beat.trigger) html += '<div class="cb-rs-beat-trigger"><strong>Trigger:</strong> ' + linkify(beat.trigger) + '</div>';
    if (beat.readAloud) {
      var beatRaKey = scene.id + ':b' + beatIdx + ':beat-ra';
      var beatRaCollapsed = _runSceneCollapsed[beatRaKey] === true; // default expanded
      html += '<div class="cb-rs-strip cb-rs-beat-readaloud' + (beatRaCollapsed ? ' collapsed' : '') + '" data-rs-strip="' + esc(beatRaKey) + '">';
      html += '<div class="cb-rs-strip-head" data-rs-toggle="' + esc(beatRaKey) + '"><span class="cb-rs-chev">&#9656;</span><span class="cb-rs-strip-label">&#128220; Read Aloud</span><span class="cb-rs-strip-hint">click to ' + (beatRaCollapsed ? 'expand' : 'collapse') + '</span></div>';
      html += '<div class="cb-rs-strip-body cb-prose">';
      html += _formatProse(beat.readAloud);
      html += '</div></div>';
    }
    if (beat.description) html += '<div class="cb-rs-beat-desc">' + linkify(beat.description) + '</div>';
    if (beat.gmNotes) {
      var beatNotesKey = scene.id + ':b' + beatIdx + ':beat-notes';
      var beatNotesCollapsed = _runSceneCollapsed[beatNotesKey] !== false; // default collapsed
      html += '<div class="cb-rs-strip cb-rs-beat-gmnotes' + (beatNotesCollapsed ? ' collapsed' : '') + '" data-rs-strip="' + esc(beatNotesKey) + '">';
      html += '<div class="cb-rs-strip-head" data-rs-toggle="' + esc(beatNotesKey) + '"><span class="cb-rs-chev">&#9656;</span><span class="cb-rs-strip-label">&#128221; GM Notes for this Beat</span><span class="cb-rs-strip-hint">click to ' + (beatNotesCollapsed ? 'expand' : 'collapse') + '</span></div>';
      html += '<div class="cb-rs-strip-body cb-prose">';
      html += _formatProse(beat.gmNotes);
      html += '</div></div>';
    }
    if (beat.tactics) html += '<div class="cb-rs-beat-tactics"><div class="cb-rs-beat-tactics-label">GM Tactics</div>' + linkify(beat.tactics) + '</div>';
    if (beat.composition) {
      html += '<div class="cb-rs-comp">';
      if (beat.composition.enemies) {
        beat.composition.enemies.forEach(function (e) {
          var thr = e.threat === 'rival' ? '#f59e0b' : e.threat === 'nemesis' ? '#ef4444' : '#7a7068';
          html += '<div class="cb-rs-comp-row"><span class="cb-rs-comp-thr" style="color:' + thr + ';">' + esc(e.threat || '') + '</span> ' + esc(e.type) + ' &times;' + e.count + '</div>';
        });
      }
      if (beat.composition.terrain) html += '<div class="cb-rs-comp-row"><strong>Terrain:</strong> ' + esc(beat.composition.terrain) + '</div>';
      if (beat.composition.positioning) html += '<div class="cb-rs-comp-row"><strong>Positioning:</strong> ' + esc(beat.composition.positioning) + '</div>';
      html += '</div>';
    }
    if (Array.isArray(beat.scriptedEscalation) && beat.scriptedEscalation.length) {
      html += _buildEscalationPreviewHtml(scene, beat);
    }
    var beatHooks = '';
    if (beat.type === 'combat' && window.CombatTracker) {
      beatHooks += '<button class="cb-rs-hook-btn cb-encounter-link" data-enc-id="' + esc(beat.id) + '">&#9876; Start ' + esc(beat.name || 'Encounter') + '</button>';
    }
    if (beatHooks) {
      html += '<div class="cb-rs-hooks"><div class="cb-rs-hook-label">Run This Beat</div>' + beatHooks + '</div>';
    }
    html += '</div>';
    return html;
  }

  function _renderRunScene(scene, container, sceneIdx, allScenes) {
    var encs = (scene.encounters || []);
    var hasBeats = encs.length > 0;
    var beatIdx = Math.min(_getRunSceneBeat(scene.id), Math.max(0, encs.length - 1));
    var sceneNpcs = getSceneNpcs();
    var raKey = scene.id + ':ra';
    var notesKey = scene.id + ':notes';
    var raCollapsed = _runSceneCollapsed[raKey] !== false;
    var notesCollapsed = _runSceneCollapsed[notesKey] !== false;
    var anyBeatReadAloud = encs.some(function (e) { return e && e.readAloud; });
    var anyBeatGmNotes = encs.some(function (e) { return e && e.gmNotes; });

    var html = '<div class="cb-runscene">';

    // Read Aloud strip — hidden when any beat supplies its own read-aloud (avoids duplication)
    if (!anyBeatReadAloud && (scene.readAloud || scene.readAloudPart1)) {
      html += '<div class="cb-rs-strip' + (raCollapsed ? ' collapsed' : '') + '" data-rs-strip="' + esc(raKey) + '">';
      html += '<div class="cb-rs-strip-head" data-rs-toggle="' + esc(raKey) + '"><span class="cb-rs-chev">&#9656;</span><span class="cb-rs-strip-label">&#128220; Read Aloud</span><span class="cb-rs-strip-hint">click to ' + (raCollapsed ? 'expand' : 'collapse') + '</span></div>';
      html += '<div class="cb-rs-strip-body">' + _buildReadAloudHtml(scene) + '</div>';
      html += '</div>';
    }
    // GM Notes strip — hidden when any beat supplies its own GM notes (avoids duplication)
    if (!anyBeatGmNotes && scene.gmNotes) {
      html += '<div class="cb-rs-strip' + (notesCollapsed ? ' collapsed' : '') + '" data-rs-strip="' + esc(notesKey) + '">';
      html += '<div class="cb-rs-strip-head" data-rs-toggle="' + esc(notesKey) + '"><span class="cb-rs-chev">&#9656;</span><span class="cb-rs-strip-label">&#128221; GM Notes</span><span class="cb-rs-strip-hint">click to ' + (notesCollapsed ? 'expand' : 'collapse') + '</span></div>';
      html += '<div class="cb-rs-strip-body">' + _buildGmNotesHtml(scene) + '</div>';
      html += '</div>';
    }

    // Checks strip — surfaces structured disciplineChallenges / skillChecks
    var rsDcList = (scene.disciplineChallenges && scene.disciplineChallenges.length) ? scene.disciplineChallenges : (scene.skillChecks || []);
    if (rsDcList.length) {
      var checksKey = scene.id + ':checks';
      var checksCollapsed = _runSceneCollapsed[checksKey] !== false; // default collapsed
      html += '<div class="cb-rs-strip cb-rs-checks' + (checksCollapsed ? ' collapsed' : '') + '" data-rs-strip="' + esc(checksKey) + '">';
      html += '<div class="cb-rs-strip-head" data-rs-toggle="' + esc(checksKey) + '"><span class="cb-rs-chev">&#9656;</span><span class="cb-rs-strip-label">&#127922; Checks for this Scene <span class="cb-rs-checks-count">(' + rsDcList.length + ')</span></span><span class="cb-rs-strip-hint">click to ' + (checksCollapsed ? 'expand' : 'collapse') + '</span></div>';
      html += '<div class="cb-rs-strip-body">' + _buildChallengesHtml(scene) + '</div>';
      html += '</div>';
    }

    // Beat strip
    if (hasBeats) {
      html += '<div class="cb-rs-beatstrip">';
      html += '<button class="cb-rs-nav" id="cb-rs-prev"' + (beatIdx === 0 ? ' disabled' : '') + '>&larr; Prev</button>';
      html += '<div class="cb-rs-beatdots">';
      encs.forEach(function (e, i) {
        var done = !!(completionsData[scene.id] && completionsData[scene.id].beatsDone && completionsData[scene.id].beatsDone[i]);
        var cls = 'cb-rs-dot' + (i === beatIdx ? ' active' : '') + (done ? ' done' : '');
        html += '<button class="' + cls + '" data-rs-jump="' + i + '" title="' + esc(e.name || ('Beat ' + (i + 1))) + '">' + (i + 1) + '</button>';
      });
      html += '</div>';
      html += '<div class="cb-rs-beatcount">Beat ' + (beatIdx + 1) + ' of ' + encs.length + '</div>';
      html += '<button class="cb-rs-nav" id="cb-rs-next"' + (beatIdx >= encs.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>';
      html += '</div>';
    }

    // Body: spotlight + side rail
    html += '<div class="cb-rs-body">';
    html += '<div class="cb-rs-main">' + _renderRunSceneSpotlight(scene, beatIdx) + '</div>';
    if (sceneNpcs.length) {
      html += '<div class="cb-rs-side"><div class="cb-rs-side-label">Scene NPCs</div>';
      sceneNpcs.forEach(function (n) {
        html += '<div class="cb-rs-side-npc"><strong>' + esc(n.name || n.type || 'NPC') + '</strong>';
        if (n.type && n.type !== n.name) html += '<div class="cb-rs-side-sub">' + esc(n.type) + '</div>';
        if (n.count && n.count > 1) html += '<div class="cb-rs-side-sub">&times;' + n.count + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Footer
    html += '<div class="cb-rs-footer">';
    if (hasBeats) {
      var beatDone = !!(completionsData[scene.id] && completionsData[scene.id].beatsDone && completionsData[scene.id].beatsDone[beatIdx]);
      html += '<button class="cb-rs-mark-beat' + (beatDone ? ' done' : '') + '" id="cb-rs-mark-beat">' + (beatDone ? '&#10003; Beat Complete' : '&#9675; Mark Beat Done') + '</button>';
    }
    html += '<div class="cb-rs-spacer"></div>';
    var sceneList = allScenes || [];
    var sIdx = (typeof sceneIdx === 'number') ? sceneIdx : -1;
    html += '<button class="cb-rs-nav" id="scene-prev"' + (sIdx <= 0 ? ' disabled' : '') + '>&larr; Prev Scene</button>';
    html += '<button class="cb-rs-nav" id="scene-next"' + (sIdx < 0 || sIdx >= sceneList.length - 1 ? ' disabled' : '') + '>Next Scene &rarr;</button>';
    html += '<button class="cb-rs-exit" id="cb-rs-exit">&times; Back to Dashboard</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _bindRunSceneEvents(container, scene) {
    container.querySelectorAll('[data-rs-toggle]').forEach(function (head) {
      head.addEventListener('click', function () {
        var key = head.getAttribute('data-rs-toggle');
        // Read the actual rendered state from the DOM so the toggle works
        // regardless of whether this strip defaults expanded or collapsed.
        var strip = head.closest('.cb-rs-strip');
        var currentlyCollapsed = !!(strip && strip.classList.contains('collapsed'));
        _runSceneCollapsed[key] = !currentlyCollapsed;
        _persistRunScene(scene.id);
        renderScene();
      });
    });
    container.querySelectorAll('[data-rs-jump]').forEach(function (b) {
      b.addEventListener('click', function () {
        _setRunSceneBeat(scene.id, parseInt(b.getAttribute('data-rs-jump'), 10) || 0);
        renderScene();
      });
    });
    var prev = container.querySelector('#cb-rs-prev');
    var next = container.querySelector('#cb-rs-next');
    if (prev) prev.addEventListener('click', function () {
      _setRunSceneBeat(scene.id, _getRunSceneBeat(scene.id) - 1);
      renderScene();
    });
    if (next) next.addEventListener('click', function () {
      _setRunSceneBeat(scene.id, _getRunSceneBeat(scene.id) + 1);
      renderScene();
    });
    var mark = container.querySelector('#cb-rs-mark-beat');
    if (mark) mark.addEventListener('click', function () {
      var idx = _getRunSceneBeat(scene.id);
      if (!completionsData[scene.id]) completionsData[scene.id] = {};
      if (!completionsData[scene.id].beatsDone) completionsData[scene.id].beatsDone = {};
      completionsData[scene.id].beatsDone[idx] = !completionsData[scene.id].beatsDone[idx];
      var encs = scene.encounters || [];
      if (completionsData[scene.id].beatsDone[idx] && idx < encs.length - 1) {
        _setRunSceneBeat(scene.id, idx + 1);
      }
      renderScene();
    });
    var exit = container.querySelector('#cb-rs-exit');
    if (exit) exit.addEventListener('click', function () {
      _setRunSceneActive(scene.id, false);
      renderScene();
    });
    // Bind escalation preview button if present
    container.querySelectorAll('.cb-esc-preview-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var encIdx = parseInt(btn.dataset.encIdx, 10);
        if (!isNaN(encIdx)) _openEscalationEditor(scene, encIdx);
      });
    });
    // Bind hook click handlers (conversation, encounter, map) — generic binders below also catch these.
  }

  function renderScene() {
    if (window.CombatTracker && window.CombatTracker.isActive() && currentScene !== _lastRenderedScene) {
      window.CombatTracker.end();
    }
    _lastRenderedScene = currentScene;
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

    var hasReadAloud = !!(scene.readAloudPart1 || scene.readAloud);
    var hasGmNotes = !!scene.gmNotes;
    var sceneNpcs = getSceneNpcs();
    var hasNpcs = true;
    var hasEncounters = !!(scene.encounters && scene.encounters.length);
    var dcList = (scene.disciplineChallenges && scene.disciplineChallenges.length) ? scene.disciplineChallenges : (scene.skillChecks || []);
    var hasChallenges = dcList.length > 0;
    var hasEnvironment = !!(scene.hazards || (scene.environmentMechanics && scene.environmentMechanics.length));
    var hasRewards = !!(scene.rewards && (scene.rewards.credits || (scene.rewards.items && scene.rewards.items.length) || (scene.rewards.intel && scene.rewards.intel.length) || (scene.rewards.connections && scene.rewards.connections.length)));
    var hasPacing = !!scene.pacing;
    var hasDecisionPoints = !!(scene.decisionPoints && scene.decisionPoints.length);
    var hasLoreTags = !!(scene.loreTags && scene.loreTags.length);
    var hasNarrativeLinks = !!(scene.narrativeLinks && scene.narrativeLinks.length);
    var hasGroupChallenge = !!scene.groupChallenge;

    var runActive = _isRunSceneActive(scene.id);

    var html = '<div class="cb-dashboard">';

    html += '<div class="cb-dash-header">';
    html += '<h2>Scene ' + scene.number + ': ' + esc(scene.title) + '<button class="cb-runscene-toggle' + (runActive ? ' on' : '') + '" id="cb-runscene-toggle" title="' + (runActive ? 'Switch back to dashboard view' : 'Switch to focused beat-by-beat view') + '">' + (runActive ? '&#9881; Dashboard' : '&#9654; Run Scene') + '</button></h2>';
    if (scene.subtitle) html += '<div class="cb-scene-subtitle">' + esc(scene.subtitle) + '</div>';
    var sceneAdaptations = _getSceneAdaptations(scene.id);
    var partAdaptations = part ? _getPartAdaptations(part.id) : [];
    var allBadgeAdaptations = sceneAdaptations.concat(partAdaptations);
    if (allBadgeAdaptations.length) {
      html += '<div class="cb-adaptation-badges">';
      for (var ai = 0; ai < allBadgeAdaptations.length; ai++) {
        var ad = allBadgeAdaptations[ai];
        html += '<span class="cb-adaptation-badge" title="' + esc(ad.impact + ' = ' + ad.is + ' (' + ad.action + (ad.field ? ': ' + ad.field : '') + ')') + '">&#9881; Adapted: ' + esc(ad.impact) + '</span>';
      }
      html += '</div>';
    }
    if (scene.id === 'adv1-p1-s1') {
      html += '<div class="assess-controls-row" id="assess-controls-row">';
      html += '<button class="assess-guide-btn" id="assess-guide-btn">&#9733; GM Reference</button>';
      html += '<button class="assess-guide-btn assess-tutorial-start" id="tutorial-start-btn">&#9656; Start Player Tutorial</button>';
      html += '<button class="assess-guide-btn assess-tutorial-advance hidden" id="tutorial-advance-btn">&#9656;&#9656; Next Phase</button>';
      html += '<button class="assess-guide-btn assess-tutorial-end hidden" id="tutorial-end-btn">&#9632; End Tutorial</button>';
      html += '<span class="assess-tutorial-status hidden" id="tutorial-status"></span>';
      html += '</div>';
    }
    html += '</div>';

    if (runActive) {
      html += _renderRunScene(scene, container, idx, scenes);
      html += '</div>';
      container.innerHTML = html;
      var rsToggleBtn = container.querySelector('#cb-runscene-toggle');
      if (rsToggleBtn) rsToggleBtn.addEventListener('click', function () {
        _setRunSceneActive(scene.id, false);
        renderScene();
      });
      _bindRunSceneEvents(container, scene);
      // Generic link binders
      container.querySelectorAll('.cb-condition-link').forEach(function (el) {
        el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
      });
      container.querySelectorAll('.cb-map-link').forEach(function (el) {
        el.addEventListener('click', function () { var key = el.dataset.mapKey; if (key) openTacticalMapToKey(key); });
      });
      container.querySelectorAll('.cb-conversation-link').forEach(function (el) {
        el.addEventListener('click', function () {
          var slug = el.dataset.convSlug;
          if (slug && window.ConversationOverlay) window.ConversationOverlay.launch(slug);
        });
      });
      container.querySelectorAll('.cb-encounter-link').forEach(function (el) {
        el.addEventListener('click', function () {
          var encId = el.dataset.encId;
          if (!encId || !scene.encounters) return;
          var enc = null;
          for (var i = 0; i < scene.encounters.length; i++) if (scene.encounters[i].id === encId) { enc = scene.encounters[i]; break; }
          if (enc && window.CombatTracker) {
            window._cbSocket = socket;
            window.CombatTracker.start(enc, scene, getSceneNpcs(), partyCache, socket);
            var ctPanel = document.getElementById('combat-tracker-panel');
            if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
      var prevBtnRs = document.getElementById('scene-prev');
      var nextBtnRs = document.getElementById('scene-next');
      if (prevBtnRs) prevBtnRs.addEventListener('click', function () { navigateScene(-1); });
      if (nextBtnRs) nextBtnRs.addEventListener('click', function () { navigateScene(1); });
      return;
    }

    html += '<div class="cb-tile-grid">';
    if (hasReadAloud) {
      var raMeta = (scene.readAloudPart1 && scene.readAloudPart2) ? '2 parts' : 'Ready';
      html += '<div class="cb-tile' + (_openPanels['readaloud'] ? ' cb-tile--active' : '') + '" data-panel-id="readaloud"><span class="cb-tile-icon">&#128220;</span><span class="cb-tile-label">Read Aloud</span><span class="cb-tile-meta">' + raMeta + '</span></div>';
    }
    if (hasGmNotes) {
      var noteLineCount = scene.gmNotes.split(/\n\s*\n/).filter(function(s){ return s.trim(); }).length;
      html += '<div class="cb-tile' + (_openPanels['gmnotes'] ? ' cb-tile--active' : '') + '" data-panel-id="gmnotes"><span class="cb-tile-icon">&#128221;</span><span class="cb-tile-label">GM Notes</span><span class="cb-tile-meta">' + noteLineCount + ' sections</span></div>';
    }
    if (hasNpcs) {
      html += '<div class="cb-tile' + (_openPanels['npcs'] ? ' cb-tile--active' : '') + '" data-panel-id="npcs"><span class="cb-tile-icon">&#9876;</span><span class="cb-tile-label">NPCs</span><span class="cb-tile-meta">' + sceneNpcs.length + ' in roster</span></div>';
    }
    if (hasEncounters) {
      html += '<div class="cb-tile' + (_openPanels['encounters'] ? ' cb-tile--active' : '') + '" data-panel-id="encounters"><span class="cb-tile-icon">&#9876;</span><span class="cb-tile-label">Encounters</span><span class="cb-tile-meta">' + scene.encounters.length + ' total</span></div>';
    }
    if (hasChallenges) {
      html += '<div class="cb-tile' + (_openPanels['challenges'] ? ' cb-tile--active' : '') + '" data-panel-id="challenges"><span class="cb-tile-icon">&#127922;</span><span class="cb-tile-label">Challenges</span><span class="cb-tile-meta">' + dcList.length + ' checks</span></div>';
    }
    if (hasEnvironment) {
      var envCount = (scene.environmentMechanics ? scene.environmentMechanics.length : 0) + (scene.hazards ? 1 : 0);
      html += '<div class="cb-tile' + (_openPanels['environment'] ? ' cb-tile--active' : '') + '" data-panel-id="environment"><span class="cb-tile-icon">&#127758;</span><span class="cb-tile-label">Environment</span><span class="cb-tile-meta">' + envCount + ' effects</span></div>';
    }
    if (hasRewards) {
      html += '<div class="cb-tile' + (_openPanels['rewards'] ? ' cb-tile--active' : '') + '" data-panel-id="rewards"><span class="cb-tile-icon">&#127942;</span><span class="cb-tile-label">Rewards</span><span class="cb-tile-meta">' + (scene.rewards.credits ? scene.rewards.credits + ' cr' : 'Loot') + '</span></div>';
    }
    if (hasPacing) {
      html += '<div class="cb-tile' + (_openPanels['pacing'] ? ' cb-tile--active' : '') + '" data-panel-id="pacing"><span class="cb-tile-icon">&#9200;</span><span class="cb-tile-label">Pacing</span><span class="cb-tile-meta">' + (scene.pacing.estimatedMinutes ? '~' + scene.pacing.estimatedMinutes + ' min' : 'Guide') + '</span></div>';
    }
    html += '<div class="cb-tile' + (_openPanels['holonet'] ? ' cb-tile--active' : '') + '" data-panel-id="holonet"><span class="cb-tile-icon">&#128225;</span><span class="cb-tile-label">HoloNet</span><span class="cb-tile-meta">Broadcast</span></div>';
    if (hasGroupChallenge) {
      html += '<div class="cb-tile cb-tile--gc' + (_openPanels['groupchallenge'] ? ' cb-tile--active' : '') + '" data-panel-id="groupchallenge"><span class="cb-tile-icon">&#9876;</span><span class="cb-tile-label">Group Challenge</span><span class="cb-tile-meta">' + esc(scene.groupChallenge.name) + ' \u2022 ' + scene.groupChallenge.vpThreshold + ' VP</span></div>';
    }
    html += '</div>';

    if (hasDecisionPoints) {
      html += '<div class="cb-dash-decisions">';
      html += '<div class="cb-dash-section-label">Decision Points</div>';
      scene.decisionPoints.forEach(function (dp) {
        html += '<div class="cb-dash-dp-group" data-dp-id="' + esc(dp.id) + '">';
        html += '<div class="cb-dash-dp-prompt">' + esc(dp.prompt) + '</div>';
        dp.options.forEach(function (opt) {
          var impactsArr = Array.isArray(opt.impacts) ? opt.impacts
            : (dp.campaignImpact && opt.sets ? [{ key: dp.campaignImpact, value: opt.sets }] : []);
          var impactsJson = JSON.stringify(impactsArr).replace(/"/g, '&quot;');
          html += '<div class="cb-dash-dp-option" data-dp-id="' + esc(dp.id) + '" data-opt-key="' + esc(opt.key) + '" data-impacts="' + impactsJson + '" data-opt-label="' + esc(opt.label) + '" data-opt-consequence="' + esc(opt.consequence || '') + '">';
          html += '<strong>' + esc(opt.label) + '</strong>';
          if (opt.consequence) html += ' <span>&rarr; ' + esc(opt.consequence) + '</span>';
          if (impactsArr.length) {
            html += '<div class="cb-dash-dp-impacts">';
            impactsArr.forEach(function (imp) {
              html += '<span class="cb-dash-dp-impact">' + esc(imp.key) + ' &rarr; ' + esc(imp.value) + '</span>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      });
      html += '</div>';
    }

    if (hasLoreTags) {
      html += '<div class="cb-dash-lore-row">';
      scene.loreTags.forEach(function (tag) {
        html += '<span class="cb-lore-tag" data-lore-tag="' + esc(tag) + '">' + esc(tag) + '</span>';
      });
      html += '</div>';
    }

    if (hasNarrativeLinks) {
      html += '<div class="cb-dash-narrative-row">';
      scene.narrativeLinks.forEach(function (link) {
        html += '<a class="cb-narrative-link" data-nav-scene="' + esc(link.targetScene) + '">&rarr; ' + esc(link.note) + '</a> ';
      });
      html += '</div>';
    }

    var allScenesComplete = scenes.length > 0 && scenes.every(function (s) { var c = completionsData[s.id]; return c && c.completed; });
    html += '<div class="cb-dash-footer">';
    html += '<button class="cb-complete-btn' + (isDone ? ' completed' : '') + '" data-scene="' + scene.id + '">' + (isDone ? '&#10003; Scene Complete' : '&#9675; Mark Scene Complete') + '</button>';
    html += '<button class="cb-mission-debrief-btn' + (allScenesComplete ? ' all-complete' : '') + '" id="cb-gen-summary" title="' + (allScenesComplete ? 'All scenes complete — generate Mission Chronicle' : 'Generate Mission Chronicle (adventure in progress)') + '">&#9881; Mission Debrief</button>';
    html += '<div class="cb-scene-nav-arrows">';
    html += '<button class="cb-arrow-btn" id="scene-prev"' + (idx <= 0 ? ' disabled' : '') + '>&larr; Prev</button>';
    html += '<button class="cb-arrow-btn" id="scene-next"' + (idx >= scenes.length - 1 ? ' disabled' : '') + '>Next &rarr;</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.cb-tile').forEach(function (tile) {
      tile.addEventListener('click', function () {
        var panelId = tile.dataset.panelId;
        if (_openPanels[panelId]) {
          closeFloatingPanel(panelId);
          return;
        }
        var titleMap = { readaloud: 'Read Aloud', gmnotes: 'GM Notes', npcs: 'NPC Roster', encounters: 'Encounters', challenges: 'Discipline Challenges', environment: 'Environment', rewards: 'Rewards', pacing: 'Pacing Guide', holonet: 'HoloNet Broadcast Terminal', groupchallenge: 'Group Challenge' };
        var contentMap = {
          readaloud: function () { return _buildReadAloudHtml(scene); },
          gmnotes: function () { return _buildGmNotesHtml(scene); },
          npcs: function () { return _buildNpcRosterHtml(scene); },
          encounters: function () { return _buildEncountersHtml(scene); },
          challenges: function () { return _buildChallengesHtml(scene); },
          environment: function () { return _buildEnvironmentHtml(scene); },
          rewards: function () { return _buildRewardsHtml(scene); },
          pacing: function () { return _buildPacingHtml(scene); },
          holonet: function () { return _buildHoloNetHtml(); },
          groupchallenge: function () { return _buildGroupChallengeHtml(scene); }
        };
        var sizeMap = { readaloud: { width: 560, height: 450 }, gmnotes: { width: 520, height: 400 }, npcs: { width: 520, height: 500 }, encounters: { width: 560, height: 480 }, challenges: { width: 540, height: 460 }, environment: { width: 480, height: 380 }, rewards: { width: 420, height: 300 }, pacing: { width: 440, height: 320 }, holonet: { width: 620, height: 560 }, groupchallenge: { width: 600, height: 560 } };
        var builder = contentMap[panelId];
        if (builder) {
          openFloatingPanel(panelId, titleMap[panelId] || panelId, builder(), sizeMap[panelId]);
        }
      });
    });

    container.querySelectorAll('.cb-dash-dp-option').forEach(function (opt) {
      opt.style.cursor = 'pointer';
      opt.addEventListener('click', function () {
        var impactsArr = [];
        try { impactsArr = JSON.parse(opt.dataset.impacts || '[]'); } catch (e) {}
        openDecisionModal({
          decisionPointId: opt.dataset.dpId,
          optionKey: opt.dataset.optKey,
          impacts: impactsArr,
          choice: opt.dataset.optLabel,
          consequence: opt.dataset.optConsequence || ''
        });
      });
    });
    container.querySelectorAll('.cb-lore-tag').forEach(function (el) {
      el.addEventListener('click', function () { openLoreModal(el.dataset.loreTag); });
    });
    container.querySelectorAll('.cb-narrative-link').forEach(function (el) {
      el.addEventListener('click', function () { navigateToScene(el.dataset.navScene); });
    });
    container.querySelectorAll('.cb-condition-link').forEach(function (el) {
      el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
    });
    container.querySelectorAll('.cb-map-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.dataset.mapKey;
        if (key) openTacticalMapToKey(key);
      });
    });
    var assessBtn = document.getElementById('assess-guide-btn');
    if (assessBtn) {
      assessBtn.addEventListener('click', function () { openAssessGuide(); });
    }
    var tutStartBtn = document.getElementById('tutorial-start-btn');
    if (tutStartBtn) {
      tutStartBtn.addEventListener('click', function () { _startPlayerTutorial(); });
    }
    var tutAdvBtn = document.getElementById('tutorial-advance-btn');
    if (tutAdvBtn) {
      tutAdvBtn.addEventListener('click', function () { _advancePlayerTutorial(); });
    }
    var tutEndBtn = document.getElementById('tutorial-end-btn');
    if (tutEndBtn) {
      tutEndBtn.addEventListener('click', function () { _endPlayerTutorial(); });
    }
    var completeBtn = container.querySelector('.cb-complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function () { toggleSceneComplete(completeBtn.dataset.scene); });
    }
    var genSummaryBtn = document.getElementById('cb-gen-summary');
    if (genSummaryBtn) {
      genSummaryBtn.addEventListener('click', function () { openMissionSummaryModal(); });
    }
    var prevBtn = document.getElementById('scene-prev');
    var nextBtn = document.getElementById('scene-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { navigateScene(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { navigateScene(1); });
    var rsToggleBtnDash = document.getElementById('cb-runscene-toggle');
    if (rsToggleBtnDash) rsToggleBtnDash.addEventListener('click', function () {
      _setRunSceneActive(scene.id, true);
      renderScene();
    });
    container.querySelectorAll('.cb-conversation-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var slug = el.dataset.convSlug;
        if (slug && window.ConversationOverlay) window.ConversationOverlay.launch(slug);
      });
    });
    container.querySelectorAll('.cb-encounter-link').forEach(function (el) {
      el.addEventListener('click', function () {
        var encId = el.dataset.encId;
        if (!encId || !scene.encounters) return;
        var enc = null;
        for (var i = 0; i < scene.encounters.length; i++) if (scene.encounters[i].id === encId) { enc = scene.encounters[i]; break; }
        if (enc && window.CombatTracker) {
          window._cbSocket = socket;
          window.CombatTracker.start(enc, scene, getSceneNpcs(), partyCache, socket);
          var ctPanel = document.getElementById('combat-tracker-panel');
          if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
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
      if (newState) promptDecisionOnComplete(sceneId);
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
    closeAllFloatingPanels();
    adventuresData.adventures.forEach(function (adv) {
      (adv.parts || []).forEach(function (part) {
        (part.scenes || []).forEach(function (scene) {
          if (scene.id === sceneId) {
            currentAdventure = adv.id;
            currentPart = part.id;
            currentScene = scene.id;
            renderAdvNav();
            renderAdvSelect();
            renderPartNav();
            renderPartSelect();
            renderScene();
            renderSceneCounter();
            saveProgress();
          }
        });
      });
    });
  }

  function openLoreModal(tag) {
    var panelId = 'lore-' + tag.replace(/[^a-zA-Z0-9]/g, '_');
    var loadingHtml = '<p style="color:#7a7068;">Loading...</p>';
    openFloatingPanel(panelId, 'Lore: ' + tag, loadingHtml, { width: 420, height: 320 });
    fetch('/api/campaign/lore-tags/' + encodeURIComponent(tag))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var panel = document.getElementById('fp-' + panelId);
        if (!panel) return;
        var body = panel.querySelector('.cb-fpanel-body');
        if (!body) return;
        if (!data.scenes || !data.scenes.length) {
          body.innerHTML = '<p style="color:#7a7068;">No scenes found with this tag.</p>';
          return;
        }
        body.innerHTML = data.scenes.map(function (s) {
          return '<div class="cb-lore-scene-link" data-nav-scene="' + esc(s.sceneId) + '">' +
            '<div style="font-weight:600;">Adventure ' + s.adventureNumber + ': ' + esc(s.adventureTitle) + '</div>' +
            '<div style="color:#7a7068;font-size:0.8rem;">Part ' + s.partNumber + ': ' + esc(s.partTitle) + ' — Scene ' + s.sceneNumber + ': ' + esc(s.sceneTitle) + '</div>' +
          '</div>';
        }).join('');
        body.querySelectorAll('.cb-lore-scene-link').forEach(function (el) {
          el.addEventListener('click', function () {
            closeFloatingPanel(panelId);
            navigateToScene(el.dataset.navScene);
          });
        });
      })
      .catch(function () {
        var panel = document.getElementById('fp-' + panelId);
        if (panel) {
          var body = panel.querySelector('.cb-fpanel-body');
          if (body) body.innerHTML = '<p style="color:#c8a44e;">Failed to load lore data.</p>';
        }
      });
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
      list.innerHTML = '<p class="cb-muted" style="font-style:italic;">No crew online.</p>';
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
      cardHtml += (pc.marks != null ? ' <span style="color:#c8a44e;margin-left:0.5rem;">' + pc.marks + ' Marks</span>' : '');
      cardHtml += '</div>';

      if (insights.length) {
        insights.forEach(function (ins) {
          var ratingCls = '';
          var labelHtml = esc(ins.label);
          if (ins.rating) {
            ratingCls = ' rating-' + ins.rating;
            labelHtml = '<span class="rating-' + esc(ins.rating) + '">' + esc(ins.label) + '</span>';
          }
          var hasExpandable = ins.description || (ins.details && ins.details.length);
          cardHtml += '<div class="cb-intel-row type-' + esc(ins.type) + ratingCls + (hasExpandable ? ' cb-intel-expandable' : '') + '">';
          cardHtml += '<span class="cb-intel-icon">' + (ins.icon || '·') + '</span>';
          cardHtml += '<span>' + labelHtml + (hasExpandable ? ' <span class="cb-intel-expand-arrow">&#9660;</span>' : '') + '</span>';
          cardHtml += '</div>';
          if (hasExpandable) {
            cardHtml += '<div class="cb-intel-detail" style="display:none;padding:0.2rem 0.4rem 0.3rem 1.2rem;font-size:0.6rem;line-height:1.4;">';
            if (ins.details && ins.details.length) {
              ins.details.forEach(function(d) {
                cardHtml += '<div style="margin-bottom:0.2rem;"><strong style="color:#c8a44e;">' + esc(d.title) + ':</strong> <span style="color:#7a7068;">' + esc(d.text) + '</span></div>';
              });
            } else if (ins.description) {
              cardHtml += '<div style="color:#7a7068;">' + esc(ins.description) + '</div>';
            }
            cardHtml += '</div>';
          }
        });
      }

      cardHtml += '<div class="cb-player-body">';

      if (vocLabel) {
        cardHtml += '<div class="cb-player-vocations">' + vocLabel + '</div>';
      }

      if (pc.vocationAbilities && pc.vocationAbilities.length) {
        cardHtml += '<div class="cb-intel-section">';
        cardHtml += '<div style="font-size:0.6rem;color:#7a7068;margin-bottom:0.15rem;">Abilities</div>';
        pc.vocationAbilities.forEach(function (a) {
          cardHtml += '<div style="font-size:0.6rem;color:#7a7068;padding:0.02rem 0;">';
          cardHtml += '<span style="color:#c8a44e;">T' + a.tier + '</span> ';
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
          cardHtml += '<div style="font-size:0.65rem;color:#c084fc;margin-top:0.2rem;">Destiny: ' + esc(destName) + '</div>';
          if (pc.destiny.coreQuestion) {
            cardHtml += '<div style="font-size:0.55rem;color:#7a7068;opacity:0.7;padding-left:0.3rem;">' + esc(pc.destiny.coreQuestion) + '</div>';
          }
        }
      }

      if (pc.backgroundFavored && pc.backgroundFavored.length) {
        cardHtml += '<div style="font-size:0.6rem;color:#818cf8;margin-top:0.15rem;">Favored: ' + pc.backgroundFavored.map(function (f) { return esc(f.replace(/_/g, ' ')); }).join(', ') + '</div>';
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
        cardHtml += '<div style="font-size:0.6rem;color:#7a7068;margin-bottom:0.15rem;">Disciplines</div>';
        ARENA_GROUPS.forEach(function (arena) {
          var arenaDie = pc.arenas && pc.arenas[arena.id] ? pc.arenas[arena.id] : '';
          cardHtml += '<div style="font-size:0.58rem;margin-top:0.15rem;">';
          cardHtml += '<span style="color:#c8a44e;font-family:Audiowide,sans-serif;">' + arena.label + '</span>';
          if (arenaDie) cardHtml += ' <span style="color:#7a7068;opacity:0.7;">' + esc(arenaDie) + '</span>';
          cardHtml += '</div>';
          arena.discs.forEach(function (discId) {
            var disc = pc.disciplines[discId];
            if (!disc) return;
            var trained = disc.training === 'trained' || disc.training === 'formative';
            var color = disc.favored ? '#c084fc' : trained ? '#d4c5a0' : '#7a7068';
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
        cardHtml += '<div style="font-size:0.6rem;color:#7a7068;margin-bottom:0.15rem;">Gear (' + pc.gear.length + ')</div>';
        pc.gear.forEach(function (g) {
          var tagStr = (g.tags || []).concat(g.traits || []).filter(Boolean).join(', ');
          var isRestricted = (g.tags || []).some(function(t){ return /restricted|illegal/i.test(t); }) || (g.availability && /restricted|illegal/i.test(g.availability));
          var color = isRestricted ? '#ef4444' : '#7a7068';
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
        if (e.target.closest('.cb-intel-expandable')) {
          e.stopPropagation();
          var row = e.target.closest('.cb-intel-expandable');
          var detail = row.nextElementSibling;
          if (detail && detail.classList.contains('cb-intel-detail')) {
            var isOpen = detail.style.display !== 'none';
            detail.style.display = isOpen ? 'none' : 'block';
            var arrow = row.querySelector('.cb-intel-expand-arrow');
            if (arrow) arrow.innerHTML = isOpen ? '&#9660;' : '&#9650;';
          }
          return;
        }
        card.classList.toggle('expanded');
      });
    });
  }

  var _destinyLocked = false;
  var _destinyTokenMenu = null;

  function _closeDestinyMenu() {
    if (_destinyTokenMenu) {
      _destinyTokenMenu.remove();
      _destinyTokenMenu = null;
    }
  }

  function _showDestinyTokenMenu(e, index, token) {
    _closeDestinyMenu();
    var menu = document.createElement('div');
    menu.className = 'gm-destiny-token-menu';

    var flipBtn = document.createElement('button');
    flipBtn.className = 'menu-flip';
    flipBtn.textContent = '\u21BB Flip to ' + (token.side === 'hope' ? 'Toll' : 'Hope');
    flipBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (socket) socket.emit('destiny:flip', { index: index });
      _closeDestinyMenu();
    });
    menu.appendChild(flipBtn);

    var sep = document.createElement('div');
    sep.className = 'gm-destiny-menu-sep';
    menu.appendChild(sep);

    if (!token.tapped) {
      var tapBtn = document.createElement('button');
      tapBtn.className = 'menu-tap';
      tapBtn.textContent = '\u25CB Tap  \u2014 spend token';
      tapBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (socket) socket.emit('destiny:tap', { index: index });
        _closeDestinyMenu();
      });
      menu.appendChild(tapBtn);
    } else {
      var untapBtn = document.createElement('button');
      untapBtn.className = 'menu-untap';
      untapBtn.textContent = '\u25C9 Untap \u2014 restore token';
      untapBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (socket) socket.emit('destiny:untap-one', { index: index });
        _closeDestinyMenu();
      });
      menu.appendChild(untapBtn);
    }

    document.body.appendChild(menu);
    _destinyTokenMenu = menu;

    var rect = e.currentTarget.getBoundingClientRect();
    menu.style.visibility = 'hidden';
    requestAnimationFrame(function () {
      var mr = menu.getBoundingClientRect();
      var left = rect.left;
      var top  = rect.bottom + 6;
      if (left + mr.width > window.innerWidth - 8)  left = window.innerWidth - mr.width - 8;
      if (top  + mr.height > window.innerHeight - 8) top  = rect.top - mr.height - 6;
      menu.style.left = left + 'px';
      menu.style.top  = top  + 'px';
      menu.style.visibility = 'visible';
    });

    function dismissMenu(ev) {
      if (_destinyTokenMenu && !_destinyTokenMenu.contains(ev.target)) {
        _closeDestinyMenu();
        document.removeEventListener('click', dismissMenu, true);
      }
    }
    setTimeout(function () {
      document.addEventListener('click', dismissMenu, true);
    }, 0);
  }

  function renderGmDestinyPool(pool) {
    var container = document.getElementById('gm-destiny-tokens');
    var countEl = document.getElementById('gm-destiny-count');
    var lockBtn = document.getElementById('gm-destiny-lock');
    if (!container) return;
    if (!pool || pool.length === 0) {
      var emptyMsg = _destinyLocked ? 'Pool locked (empty)' : 'No crew connected';
      container.innerHTML = '<span class="cb-muted" style="font-style:italic;">' + emptyMsg + '</span>';
      if (countEl) countEl.innerHTML = _destinyLocked ? '<span class="destiny-locked-badge">LOCKED</span>' : '';
      if (lockBtn) {
        lockBtn.textContent = _destinyLocked ? 'Unlock Pool' : 'Lock Pool';
        if (_destinyLocked) { lockBtn.classList.add('locked'); } else { lockBtn.classList.remove('locked'); }
      }
      return;
    }
    container.innerHTML = pool.map(function (t, idx) {
      var side = t.side === 'toll' ? 'toll' : 'hope';
      var cls = 'gm-destiny-pip gm-destiny-pip--' + side;
      if (t.tapped) cls += ' gm-destiny-pip--tapped';
      var label = side === 'hope' ? 'Hope' : 'Toll';
      var state = t.tapped ? 'tapped' : 'available';
      return '<span class="' + cls + '" data-index="' + idx + '" title="' + label + ' \u2014 ' + state + ' \u2014 click to manage">\u2B24</span>';
    }).join('');
    container.querySelectorAll('.gm-destiny-pip').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(el.dataset.index, 10);
        _showDestinyTokenMenu(e, idx, pool[idx]);
      });
    });
    if (countEl) {
      var hopeCount = pool.filter(function (t) { return t.side === 'hope'; }).length;
      var tollCount = pool.filter(function (t) { return t.side === 'toll'; }).length;
      var tappedCount = pool.filter(function (t) { return t.tapped; }).length;
      var summary = '<span class="hope-count">' + hopeCount + 'H</span> / <span class="toll-count">' + tollCount + 'T</span>';
      if (tappedCount > 0) summary += ' <span style="color:#7a7068;">(' + tappedCount + ' tapped)</span>';
      if (_destinyLocked) summary += ' <span class="destiny-locked-badge">LOCKED</span>';
      countEl.innerHTML = summary;
    }
    if (lockBtn) {
      lockBtn.textContent = _destinyLocked ? 'Unlock Pool' : 'Lock Pool';
      if (_destinyLocked) { lockBtn.classList.add('locked'); } else { lockBtn.classList.remove('locked'); }
    }
  }

  function loadGlossary() {
    fetch('/data/glossary.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { glossaryData = data; })
      .catch(function () { console.error('Failed to load glossary'); });
    fetch('/data/maneuvers.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        maneuversData = [];
        Object.keys(data).forEach(function (k) {
          if (Array.isArray(data[k])) {
            data[k].forEach(function (a) { if (a.id) maneuversData.push(a); });
          }
        });
      })
      .catch(function () { console.error('Failed to load maneuvers'); });
  }

  function showGlossaryEntry(id) {
    if (_panelCollapseState.right) {
      expandPanel('right');
    }
    var panel = document.getElementById('glossary-content');
    if (!panel) return;

    var entry = glossaryData ? glossaryData.find(function (e) { return e.id === id; }) : null;

    if (entry) {
      var html = '';
      html += '<div class="cb-glossary-header">' + esc(entry.name) + '</div>';
      if (entry.type) html += '<div class="cb-glossary-type">' + esc(entry.type) + '</div>';

      if (entry.rule) {
        var pcNpc = splitPcNpc(entry.rule);
        if (pcNpc.pc || pcNpc.npc) {
          html += '<div class="cb-glossary-dual">';
          html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:#5588CC;">PC Effect</div><div>' + linkify(pcNpc.pc || entry.rule) + '</div></div>';
          html += '<div class="cb-glossary-dual-side"><div class="cb-glossary-dual-label" style="color:#c084fc;">NPC Effect</div><div>' + linkify(pcNpc.npc || '—') + '</div></div>';
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
      return;
    }

    var action = maneuversData ? maneuversData.find(function (a) { return a.id === id; }) : null;

    if (action) {
      var html = '';
      html += '<div class="cb-glossary-header">' + esc(action.name) + '</div>';
      html += '<div class="cb-glossary-type">' + esc(action.actionType || 'Action');
      if (action.discipline) html += ' — ' + esc(action.discipline.charAt(0).toUpperCase() + action.discipline.slice(1));
      if (action.arena) html += ' (' + esc(action.arena.charAt(0).toUpperCase() + action.arena.slice(1)) + ')';
      if (action.tags) html += ' ' + esc(action.tags.join(' '));
      html += '</div>';
      if (action.description) html += '<div class="cb-glossary-rule">' + linkify(action.description) + '</div>';
      if (action.risk) html += '<div class="cb-glossary-guide" style="border-left:2px solid #c084fc;padding-left:8px;margin-top:6px;"><strong>Risk:</strong> ' + linkify(action.risk) + '</div>';
      if (action.mastery) html += '<div class="cb-glossary-guide" style="border-left:2px solid #5588CC;padding-left:8px;margin-top:6px;"><strong>Mastery:</strong> ' + linkify(action.mastery) + '</div>';
      if (action.effect && Array.isArray(action.effect)) {
        html += '<div style="margin-top:8px;">';
        action.effect.forEach(function (e) {
          html += '<div style="margin-top:4px;"><span style="color:#c8a44e;">' + esc(e.label || ('Tier ' + e.tier)) + '</span>';
          if (e.range) html += ' <span class="cb-muted">(' + esc(e.range) + ')</span>';
          html += ' — ' + linkify(e.description) + '</div>';
        });
        html += '</div>';
      }
      panel.innerHTML = html;
      panel.querySelectorAll('.cb-condition-link').forEach(function (el) {
        el.addEventListener('click', function () { showGlossaryEntry(el.dataset.conditionId); });
      });
      return;
    }

    panel.innerHTML = '<p class="cb-muted">Entry not found: ' + esc(id) + '</p>';
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

    var COL_SIZE_KEY = 'cb_col_widths';

    function _saveColWidths() {
      try {
        sessionStorage.setItem(COL_SIZE_KEY, JSON.stringify({ left: _colWidths.left, right: _colWidths.right }));
      } catch (e) { /* ignore */ }
    }

    function _restoreColWidths() {
      try {
        var saved = JSON.parse(sessionStorage.getItem(COL_SIZE_KEY) || 'null');
        if (!saved) return;
        if (saved.left  && saved.left  >= 180 && saved.left  <= 480) _colWidths.left  = saved.left;
        if (saved.right && saved.right >= 220 && saved.right <= 520) _colWidths.right = saved.right;
      } catch (e) { /* ignore */ }
    }

    _restoreColWidths();
    _applyGridTemplate();

    function setupDrag(handle, side) {
      if (!handle) return;
      var dragging = false;
      var startX = 0;
      var startWidth = 0;

      handle.addEventListener('mousedown', startDrag);
      handle.addEventListener('touchstart', startDrag, { passive: false });

      function startDrag(e) {
        e.preventDefault();
        dragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startWidth = _colWidths[side];
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
        var delta = clientX - startX;
        if (side === 'left') {
          _colWidths.left = Math.max(180, Math.min(480, startWidth + delta));
        } else {
          _colWidths.right = Math.max(220, Math.min(520, startWidth - delta));
        }
        _applyGridTemplate();
      }

      function stopDrag() {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
        _saveColWidths();
      }
    }

    setupDrag(leftHandle, 'left');
    setupDrag(rightHandle, 'right');
  }

  function openPicker(type) {
    var overlay = document.getElementById('cb-picker-overlay');
    var title = document.getElementById('cb-picker-title');
    var list = document.getElementById('cb-picker-list');
    if (!overlay || !title || !list) return;
    var html = '';
    if (type === 'adventure') {
      title.textContent = 'SELECT ADVENTURE';
      html = adventuresData.adventures.map(function (adv) {
        var active = adv.id === currentAdventure;
        return '<div class="cb-picker-item' + (active ? ' active' : '') + '" data-value="' + adv.id + '">' +
          '<span class="cb-picker-item-num">' + adv.number + '</span>' +
          '<span>' + esc(adv.title) + '</span></div>';
      }).join('');
    } else {
      title.textContent = 'SELECT PART';
      var adv = getAdventure(currentAdventure);
      if (adv) {
        html = (adv.parts || []).map(function (part) {
          var active = part.id === currentPart;
          return '<div class="cb-picker-item' + (active ? ' active' : '') + '" data-value="' + part.id + '">' +
            '<span class="cb-picker-item-num">' + part.number + '</span>' +
            '<span>' + esc(part.title) + '</span></div>';
        }).join('');
      }
    }
    list.innerHTML = html;
    list.querySelectorAll('.cb-picker-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var val = item.dataset.value;
        closePicker();
        if (type === 'adventure') selectAdventure(val);
        else selectPart(val);
      });
    });
    overlay.classList.add('active');
  }

  function closePicker() {
    var overlay = document.getElementById('cb-picker-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  var _cbHeaderAdv = document.getElementById('cb-header-adv');
  var _cbHeaderPart = document.getElementById('cb-header-part');
  if (_cbHeaderAdv) _cbHeaderAdv.addEventListener('click', function () { openPicker('adventure'); });
  if (_cbHeaderPart) _cbHeaderPart.addEventListener('click', function () { openPicker('part'); });

  var _cbPickerClose = document.getElementById('cb-picker-close');
  if (_cbPickerClose) _cbPickerClose.addEventListener('click', closePicker);
  var _cbPickerOverlay = document.getElementById('cb-picker-overlay');
  if (_cbPickerOverlay) _cbPickerOverlay.addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closePicker();
  });

  function initSockets() {
    if (!socket) return;
    socket.emit('session:join', { role: 'gm' });
    socket.emit('destiny:request');

    socket.on('destiny:sync', function (data) {
      if (typeof data.locked === 'boolean') _destinyLocked = data.locked;
      renderGmDestinyPool(data.pool || data);
    });

    socket.on('player:connected', function () { loadPartyMonitor(); });
    socket.on('player:disconnected', function () { loadPartyMonitor(); });
    socket.on('state:sync', function () { loadPartyMonitor(); });
    socket.on('advancement:sync', function () { loadPartyMonitor(); });

    socket.on('combat:state', function (data) {
      if (data && data.active && window.CombatTracker && !window.CombatTracker.isActive()) {
        window._cbSocket = socket;
        if (data.broadcastedMapKey) {
          data._restoreBroadcastedMapKey = data.broadcastedMapKey;
        }
        window.CombatTracker.restore(data);
        var ctPanel = document.getElementById('combat-tracker-panel');
        if (ctPanel) ctPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    socket.on('combat:turn-advanced', function (data) {
      if (window.CombatTracker && window.CombatTracker.applyTurnAdvance) {
        window.CombatTracker.applyTurnAdvance(data);
      }
    });
    socket.on('session:joined', function () {
      socket.emit('combat:request-state');
      socket.emit('groupChallenge:request');
    });

    socket.on('tutorial:gm-ack', function (data) {
      _updateTutorialControls(data);
    });

    socket.on('groupChallenge:gm-ack', function (data) {
      _gcActive = !!data.active;
      _gcBeat = data.currentBeat || 1;
      _gcTotalVP = data.totalVP || 0;
      if (data.rollLog) _gcRollLog = data.rollLog;
      if (data.revealedThresholds) _gcRevealedThresholds = data.revealedThresholds;
      if (data.vpThreshold != null) _gcVpThreshold = data.vpThreshold;
      if (data.crewSize != null) _gcCrewSize = data.crewSize;
      if (data.modifiers) _gcModifiers = data.modifiers;
      if (data.modifierState) _gcModifierState = data.modifierState;
      if (data.resolvedThresholds) _gcResolvedThresholds = data.resolvedThresholds;
      _refreshGcPanel();
    });

    socket.on('groupChallenge:update', function (data) {
      _gcTotalVP = data.totalVP;
      _gcBeat = data.currentBeat;
      if (data.entry) _gcRollLog.push(data.entry);
      if (data.revealedThresholds) _gcRevealedThresholds = data.revealedThresholds;
      if (data.vpThreshold != null) _gcVpThreshold = data.vpThreshold;
      if (data.modifierState) _gcModifierState = data.modifierState;
      if (data.eligibleDisciplines && _gcChallengeData) _gcChallengeData.eligibleDisciplines = data.eligibleDisciplines;
      if (data.phaseChanged) {
        showToast('Phase Shift: ' + data.phaseChanged.name + ' \u2014 ' + data.phaseChanged.narrativeText);
      }
      _refreshGcPanel();
    });

    socket.on('groupChallenge:beatAdvanced', function (data) {
      _gcBeat = data.currentBeat;
      _gcTotalVP = data.totalVP;
      if (data.vpThreshold != null) _gcVpThreshold = data.vpThreshold;
      if (data.modifierState) _gcModifierState = data.modifierState;
      _refreshGcPanel();
    });

    socket.on('groupChallenge:timedOut', function (data) {
      showToast('TIMED OUT \u2014 Beat ' + data.beat + '/' + data.maxBeats + ' reached. Challenge fails unless VP threshold is met.');
    });

    socket.on('groupChallenge:completed', function (data) {
      _gcActive = false;
      _gcRollLog = [];
      _gcRevealedThresholds = [];
      _gcModifiers = null;
      _gcModifierState = null;
      _gcVpThreshold = 0;
      _gcCrewSize = 0;
      _gcResolvedThresholds = [];
      _refreshGcPanel();
      showToast('Group Challenge ' + (data.success ? 'Succeeded' : 'Failed') + ': ' + data.name + ' (' + data.totalVP + '/' + data.vpThreshold + ' VP)');
      loadCrewJournal();
      openDecisionModal({
        choice: 'Group Challenge: ' + data.name + ' \u2014 ' + (data.success ? 'Success' : 'Failure'),
        consequence: (data.success ? 'Succeeded' : 'Failed') + ' with ' + data.totalVP + '/' + data.vpThreshold + ' VP over ' + (data.totalBeats || 1) + ' beat(s).' + (data.failureConsequence ? ' ' + data.failureConsequence : ''),
        campaignImpact: data.success ? 'faction_standing' : 'threat_level'
      });
    });
  }

  var destinyUntapBtn = document.getElementById('gm-destiny-untap');
  var destinyResetBtn = document.getElementById('gm-destiny-reset');
  var destinyLockBtn = document.getElementById('gm-destiny-lock');
  if (destinyUntapBtn) destinyUntapBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:untap'); });
  if (destinyResetBtn) destinyResetBtn.addEventListener('click', function () { if (socket) socket.emit('destiny:reset'); });
  if (destinyLockBtn) destinyLockBtn.addEventListener('click', function () {
    if (!socket) return;
    if (_destinyLocked) {
      socket.emit('destiny:unlock');
    } else {
      socket.emit('destiny:lock');
    }
  });

  var logoutBtn = document.getElementById('cb-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function () { window.location.href = '/login'; })
      .catch(function () { window.location.href = '/login'; });
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
      if (req.gm_notes) html += '<div style="font-size:0.7rem;color:#c084fc;margin-top:0.2rem;">GM: ' + esc(req.gm_notes) + '</div>';
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

  var _gcActive = false;
  var _gcBeat = 1;
  var _gcTotalVP = 0;
  var _gcRollLog = [];
  var _gcRevealedThresholds = [];
  var _gcChallengeData = null;

  var _gcModifiers = null;
  var _gcModifierState = null;
  var _gcVpThreshold = 0;
  var _gcCrewSize = 0;
  var _gcResolvedThresholds = [];

  function _buildGroupChallengeHtml(scene) {
    var gc = scene.groupChallenge;
    if (!gc) return '<div style="padding:1rem;color:var(--color-text-secondary);">No group challenge in this scene.</div>';
    _gcChallengeData = gc;
    var mods = _gcModifiers || gc.modifiers || {};
    var modState = _gcModifierState || {};
    var effectivePower = modState.effectivePower != null ? modState.effectivePower : gc.power;
    var effectiveTier = modState.effectiveTier != null ? modState.effectiveTier : gc.tier;
    var vpT = _gcVpThreshold;
    if (!vpT) {
      var previewCrewSize = Math.max(1, (partyCache || []).filter(function(p) { return p.connected; }).length);
      var vpBase = Number(gc.vpBase) || 3;
      var gcVpAdj = 0;
      var gcMods2 = gc.modifiers || {};
      if (gcMods2.escalating && typeof gcMods2.escalating.vpAdjust === 'number') gcVpAdj += gcMods2.escalating.vpAdjust;
      if (gcMods2.failurePenalty && typeof gcMods2.failurePenalty.vpAdjust === 'number') gcVpAdj += gcMods2.failurePenalty.vpAdjust;
      vpT = Math.max(1, (vpBase + gcVpAdj) * previewCrewSize);
    }
    var html = '<div class="gc-panel">';
    html += '<div class="gc-header-info">';
    html += '<div class="gc-name">' + esc(gc.name) + '</div>';
    html += '<div class="gc-desc">' + esc(gc.description) + '</div>';
    var statsLine = 'Tier ' + effectiveTier;
    if (effectiveTier !== gc.tier) statsLine += ' (base ' + gc.tier + ')';
    statsLine += ' \u2022 Power ' + effectivePower;
    if (effectivePower !== gc.power) statsLine += ' (base ' + gc.power + ')';
    statsLine += ' \u2022 VP Target: ' + vpT;
    if (_gcCrewSize) statsLine += ' (' + _gcCrewSize + ' crew)';
    html += '<div class="gc-stats">' + statsLine + '</div>';
    html += '</div>';

    if (Object.keys(mods).length > 0) {
      html += '<div class="gc-modifiers" style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem;">';
      if (mods.timed) {
        var remaining = mods.timed.beats - _gcBeat + 1;
        html += '<span class="gc-mod-badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">TIMED: ' + remaining + '/' + mods.timed.beats + ' beats</span>';
      }
      if (mods.failurePenalty) {
        html += '<span class="gc-mod-badge" style="background:rgba(249,115,22,0.15);color:#f97316;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">FAILURE: -' + mods.failurePenalty.value + ' VP</span>';
      }
      if (mods.escalating) {
        html += '<span class="gc-mod-badge" style="background:rgba(168,85,247,0.15);color:#a855f7;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">ESCALATING: ' + esc(mods.escalating.field) + ' +' + mods.escalating.increment + '/beat</span>';
      }
      if (mods.disciplineLimit) {
        var dlLabel = mods.disciplineLimit.type || 'limited';
        if (mods.disciplineLimit.type === 'cooldown') dlLabel += ' (' + (mods.disciplineLimit.beats || 2) + ' beats)';
        html += '<span class="gc-mod-badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">DISCIPLINE: ' + esc(dlLabel) + '</span>';
      }
      if (mods.pressure) {
        html += '<span class="gc-mod-badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">PRESSURE</span>';
      }
      if (mods.momentum) {
        html += '<span class="gc-mod-badge" style="background:rgba(34,197,94,0.15);color:#22c55e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">MOMENTUM</span>';
      }
      if (mods.fatigue) {
        html += '<span class="gc-mod-badge" style="background:rgba(249,115,22,0.15);color:#f97316;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">FATIGUE</span>';
      }
      if (mods.adaptation) {
        var adBoost = modState.adaptationBoost || 0;
        html += '<span class="gc-mod-badge" style="background:rgba(168,85,247,0.15);color:#a855f7;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">ADAPTATION +' + adBoost + '</span>';
      }
      if (mods.allHands) {
        html += '<span class="gc-mod-badge" style="background:rgba(234,179,8,0.15);color:#eab308;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">ALL HANDS</span>';
      }
      if (mods.solo) {
        html += '<span class="gc-mod-badge" style="background:rgba(234,179,8,0.15);color:#eab308;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-family:Audiowide,sans-serif;">SOLO</span>';
      }
      html += '</div>';
    }

    var curPhase = _gcModifierState && _gcModifierState.currentPhase ? _gcModifierState.currentPhase : null;
    if (curPhase) {
      html += '<div class="gc-phase-badge" style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:0.2rem 0.5rem;font-size:0.6rem;font-weight:600;margin-bottom:0.3rem;font-family:Audiowide,sans-serif;">PHASE: ' + esc(curPhase.name) + '</div>';
    }
    html += '<div class="gc-vp-section">';
    html += '<div class="gc-vp-label">Victory Points: <span id="gc-vp-current">' + _gcTotalVP + '</span> / ' + vpT + '</div>';
    var pct = vpT > 0 ? Math.min(100, Math.round((_gcTotalVP / vpT) * 100)) : 0;
    html += '<div class="gc-vp-bar"><div class="gc-vp-fill" id="gc-vp-fill" style="width:' + pct + '%"></div></div>';
    var beatLabel = 'Beat: <span id="gc-beat-num">' + _gcBeat + '</span>';
    if (mods.timed) beatLabel += ' / ' + mods.timed.beats;
    html += '<div class="gc-beat-label">' + beatLabel + '</div>';
    html += '</div>';
    html += '<div class="gc-disciplines">';
    var primaryDiscs = (gc.eligibleDisciplines || []).filter(function (d) { return d.role !== 'secondary'; });
    var secondaryDiscs = (gc.eligibleDisciplines || []).filter(function (d) { return d.role === 'secondary'; });
    if (primaryDiscs.length > 0) {
      html += '<div class="gc-section-label">Primary Approaches <span style="font-weight:400;font-size:0.55rem;opacity:0.7;">(earns VP)</span></div>';
      primaryDiscs.forEach(function (d) {
        html += '<div class="gc-disc-chip gc-disc--primary"><strong>' + esc(d.discipline) + '</strong> \u2014 ' + esc(d.approach) + '</div>';
      });
    }
    if (secondaryDiscs.length > 0) {
      html += '<div class="gc-section-label" style="margin-top:0.4rem;">Secondary Approaches <span style="font-weight:400;font-size:0.55rem;opacity:0.7;">(support ally)</span></div>';
      secondaryDiscs.forEach(function (d) {
        var sup = d.support || {};
        var supTag = '';
        if (sup.type && sup.targetDiscipline) {
          var supColor = sup.type === 'optimized' ? '#3b82f6' : '#22c55e';
          var supLabel = sup.type === 'optimized' ? '[Optimized]' : '[Empowered]';
          supTag = ' <span style="color:' + supColor + ';font-size:0.55rem;">' + supLabel + ' \u2192 ' + esc(sup.targetDiscipline) + '</span>';
        }
        html += '<div class="gc-disc-chip gc-disc--secondary" style="border-left:2px solid rgba(34,197,94,0.4);"><strong>' + esc(d.discipline) + '</strong>' + supTag + ' \u2014 ' + esc(d.approach) + '</div>';
      });
    }
    if (primaryDiscs.length === 0 && secondaryDiscs.length === 0) {
      html += '<div class="gc-section-label">Eligible Approaches</div>';
      (gc.eligibleDisciplines || []).forEach(function (d) {
        html += '<div class="gc-disc-chip"><strong>' + esc(d.discipline) + '</strong> \u2014 ' + esc(d.approach) + '</div>';
      });
    }
    var pendingBuffs = (modState.pendingBuffs && Object.keys(modState.pendingBuffs).length > 0) ? modState.pendingBuffs : null;
    if (pendingBuffs) {
      html += '<div class="gc-section-label" style="margin-top:0.4rem;">Active Buffs</div>';
      Object.keys(pendingBuffs).forEach(function (tgtId) {
        var b = pendingBuffs[tgtId];
        var buffColor = b.type === 'optimized' ? '#3b82f6' : '#22c55e';
        var tgtDiscLabel = (b.targetDiscipline || '').charAt(0).toUpperCase() + (b.targetDiscipline || '').slice(1).replace(/_/g, ' ');
        var buffLabel = b.type === 'optimized' ? '[Optimized] Control \u2191 on ' + tgtDiscLabel : '[Empowered] Power \u2191 on ' + tgtDiscLabel;
        html += '<div style="font-size:0.6rem;padding:0.15rem 0.3rem;margin-bottom:0.15rem;background:rgba(0,0,0,0.2);border-radius:3px;border-left:2px solid ' + buffColor + ';">';
        html += '<span style="color:' + buffColor + ';">' + buffLabel + '</span> on <strong>' + esc(tgtId) + '</strong> from ' + esc(b.fromCharName);
        html += '</div>';
      });
    }
    html += '</div>';
    var scoring = gc.vpScoring || {};
    html += '<div class="gc-scoring">';
    html += '<div class="gc-section-label">VP Scoring</div>';
    html += '<div class="gc-scoring-grid">';
    var tierOrder = ['failure', 'fleetingCost', 'masterfulCost', 'legendaryCost', 'fleeting', 'masterful', 'legendary', 'unleashedI', 'unleashedII', 'unleashedIII'];
    var tierLabels = { failure: 'Failure', fleetingCost: 'Fleeting Cost', masterfulCost: 'Masterful Cost', legendaryCost: 'Legendary Cost', fleeting: 'Fleeting', masterful: 'Masterful', legendary: 'Legendary', unleashedI: 'Unleashed I', unleashedII: 'Unleashed II', unleashedIII: 'Unleashed III' };
    tierOrder.forEach(function (t) {
      if (typeof scoring[t] === 'number') {
        var vpDisplay = scoring[t];
        if (t === 'failure' && mods.failurePenalty) vpDisplay = '-' + mods.failurePenalty.value;
        html += '<span class="gc-score-item"><span class="gc-score-tier">' + tierLabels[t] + '</span><span class="gc-score-vp">' + vpDisplay + '</span></span>';
      }
    });
    if (scoring.masteryBonus) html += '<span class="gc-score-item gc-score-mastery"><span class="gc-score-tier">Mastery</span><span class="gc-score-vp">+' + scoring.masteryBonus + '</span></span>';
    html += '</div></div>';
    if (gc.failureConsequence) {
      html += '<div class="gc-failure">';
      html += '<div class="gc-section-label">Failure Consequence</div>';
      html += '<div class="gc-failure-text">' + esc(gc.failureConsequence) + '</div>';
      html += '</div>';
    }
    var displayThresholds = _gcResolvedThresholds.length ? _gcResolvedThresholds : (gc.thresholds || []);
    html += '<div class="gc-thresholds">';
    html += '<div class="gc-section-label">Intel Thresholds</div>';
    html += '<div id="gc-threshold-feed">';
    displayThresholds.forEach(function (t) {
      var tvp = t.vp != null ? t.vp : (t.at != null ? Math.round(t.at * vpT) : 0);
      var revealed = _gcRevealedThresholds.find(function (r) { return r.vp === tvp; });
      var cpMark = t.checkpoint ? ' \u2693' : '';
      html += '<div class="gc-threshold-item' + (revealed ? ' gc-threshold--revealed' : '') + '" data-gc-vp="' + tvp + '">';
      html += '<span class="gc-threshold-vp">' + tvp + ' VP' + cpMark + '</span>';
      html += '<span class="gc-threshold-intel">' + (revealed ? esc(t.intel) : '???') + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    html += '<div class="gc-roll-log">';
    html += '<div class="gc-section-label">Roll Log</div>';
    html += '<div id="gc-roll-log-feed">';
    if (_gcRollLog.length === 0) {
      html += '<div class="gc-roll-empty">No rolls yet</div>';
    } else {
      _gcRollLog.forEach(function (r) {
        var roleTag = r.role === 'secondary' ? ' <span style="color:#22c55e;font-size:0.55rem;">[SUPPORT]</span>' : '';
        var buffTag = '';
        if (r.buffType) {
          var gmBtColor = r.buffType === 'optimized' ? '#3b82f6' : '#22c55e';
          var gmBtLabel = r.buffType === 'optimized' ? 'Optimized' : 'Empowered';
          var gmBtDisc = r.buffTargetDiscipline ? r.buffTargetDiscipline.charAt(0).toUpperCase() + r.buffTargetDiscipline.slice(1).replace(/_/g, ' ') : '';
          buffTag = ' <span style="color:' + gmBtColor + ';font-size:0.55rem;">\u2192 [' + gmBtLabel + '] on ' + esc(gmBtDisc) + '</span>';
        }
        if (r.consumedBuff) {
          var gmCbLabel = r.consumedBuff === 'optimized' ? 'Optimized' : 'Empowered';
          var gmCbDisc = r.consumedBuffDiscipline ? r.consumedBuffDiscipline.charAt(0).toUpperCase() + r.consumedBuffDiscipline.slice(1).replace(/_/g, ' ') : '';
          buffTag += ' <span style="color:#eab308;font-size:0.55rem;">[' + gmCbLabel + (gmCbDisc ? '/' + esc(gmCbDisc) : '') + ' from ' + esc(r.consumedBuffFrom || '?') + ']</span>';
        }
        html += '<div class="gc-roll-entry">B' + r.beat + ': <strong>' + esc(r.characterName) + '</strong>' + roleTag + ' \u2014 ' + esc(r.discipline) + ' (' + esc(r.tier) + ') \u2192 ' + r.vp + ' VP' + (r.mastery ? ' <span class="gc-mastery-tag">+M</span>' : '') + buffTag + '</div>';
      });
    }
    html += '</div></div>';
    html += '<div class="gc-controls">';
    if (!_gcActive) {
      html += '<button class="cb-header-btn accent" id="gc-announce-btn" style="width:100%;justify-content:center;">Announce to Crew</button>';
    } else {
      html += '<button class="cb-header-btn" id="gc-advance-beat-btn" style="flex:1;justify-content:center;">Advance Beat</button>';
      html += '<button class="cb-header-btn accent" id="gc-complete-btn" style="flex:1;justify-content:center;">Complete Challenge</button>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function _bindGroupChallengeEvents(panel) {
    var announceBtn = panel.querySelector('#gc-announce-btn');
    if (announceBtn) {
      announceBtn.addEventListener('click', function () {
        if (!socket || !_gcChallengeData) return;
        var adv = getAdventure(currentAdventure);
        var part = adv ? getPart(adv, currentPart) : null;
        var scene = part ? getScene(part, currentScene) : null;
        _gcActive = true;
        _gcBeat = 1;
        _gcTotalVP = 0;
        _gcRollLog = [];
        _gcRevealedThresholds = [];
        socket.emit('groupChallenge:announce', {
          challengeData: _gcChallengeData,
          adventureId: currentAdventure,
          sceneId: scene ? scene.id : ''
        });
        _refreshGcPanel();
      });
    }
    var advBtn = panel.querySelector('#gc-advance-beat-btn');
    if (advBtn) {
      advBtn.addEventListener('click', function () {
        if (!socket) return;
        socket.emit('groupChallenge:advanceBeat');
      });
    }
    var completeBtn = panel.querySelector('#gc-complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function () {
        if (!socket) return;
        socket.emit('groupChallenge:complete');
      });
    }
  }

  function _refreshGcPanel() {
    var panel = document.getElementById('fp-groupchallenge');
    if (!panel) return;
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    if (!scene || !scene.groupChallenge) return;
    var body = panel.querySelector('.cb-fpanel-body');
    if (body) {
      body.innerHTML = _buildGroupChallengeHtml(scene);
      _bindGroupChallengeEvents(panel);
    }
  }

  var assessData = null;
  var assessActivePhase = 0;
  var assessActiveDisc = 0;

  function openAssessGuide() {
    if (assessData) {
      _renderAssessPanel();
      return;
    }
    fetch('/data/tutorials/scene1-assess.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        assessData = data;
        assessActivePhase = 0;
        assessActiveDisc = 0;
        _renderAssessPanel();
      })
      .catch(function (err) {
        console.error('Failed to load assess guide:', err);
      });
  }

  function _renderAssessPanel() {
    if (!assessData) return;
    var panelId = 'assess-guide';
    var contentHtml = _buildAssessHtml();
    var existing = document.getElementById('fp-' + panelId);
    if (existing) {
      var body = existing.querySelector('.cb-fpanel-body');
      if (body) body.innerHTML = contentHtml;
      _bindAssessEvents(existing);
      existing.style.zIndex = ++_panelZCounter;
      return;
    }
    openFloatingPanel(panelId, assessData.title || 'ASSESS GUIDE', contentHtml, { width: 720, height: 520 });
    var panel = document.getElementById('fp-' + panelId);
    if (panel) _bindAssessEvents(panel);
  }

  function _buildAssessHtml() {
    if (!assessData) return '';
    var html = '';
    html += '<div class="assess-phase-tabs">';
    html += assessData.phases.map(function (phase, pi) {
      return '<button class="assess-phase-tab' + (pi === assessActivePhase ? ' active' : '') + '" data-phase="' + pi + '">' +
        esc(phase.label) + '</button>';
    }).join('');
    html += '</div>';
    var phase = assessData.phases[assessActivePhase];
    if (!phase) return html;
    html += '<div class="assess-body">';
    html += '<nav class="assess-disc-nav">';
    html += phase.disciplines.map(function (disc, di) {
      return '<button class="assess-disc-btn' + (di === assessActiveDisc ? ' active' : '') + '" data-disc="' + di + '">' +
        esc(disc.label) + '<span class="assess-disc-arena">(' + esc(disc.arena) + ')</span></button>';
    }).join('');
    html += '</nav>';
    html += '<div class="assess-content">' + _buildAssessContentHtml() + '</div>';
    html += '</div>';
    return html;
  }

  function _buildAssessContentHtml() {
    if (!assessData) return '';
    var phase = assessData.phases[assessActivePhase];
    if (!phase) return '';
    var disc = phase.disciplines[assessActiveDisc];
    if (!disc) return '';
    var html = '';
    if (disc.focus) {
      html += '<div class="assess-disc-focus">' + esc(disc.focus) + '</div>';
    }
    disc.entries.forEach(function (entry) {
      var cls = 'assess-entry';
      if (entry.type === 'gambit') cls += ' type-gambit';
      if (entry.type === 'trained') cls += ' type-trained';
      html += '<div class="' + cls + '">';
      if (entry.type === 'gambit') {
        html += '<div class="assess-entry-badge assess-badge-gambit">D8 Gambit</div>';
        if (entry.label) html += '<div class="assess-entry-label">' + esc(entry.label) + '</div>';
      } else if (entry.type === 'trained') {
        html += '<div class="assess-entry-badge assess-badge-trained">Trained</div>';
        if (entry.label) html += '<div class="assess-entry-label">' + esc(entry.label) + '</div>';
      } else {
        if (entry.question) html += '<div class="assess-question">"' + esc(entry.question) + '"</div>';
      }
      if (entry.response) html += '<div class="assess-response">' + esc(entry.response) + '</div>';
      html += '</div>';
    });
    return html;
  }

  function _bindAssessEvents(panel) {
    panel.querySelectorAll('.assess-phase-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        assessActivePhase = parseInt(btn.dataset.phase, 10);
        assessActiveDisc = 0;
        _renderAssessPanel();
      });
    });
    panel.querySelectorAll('.assess-disc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        assessActiveDisc = parseInt(btn.dataset.disc, 10);
        var contentEl = panel.querySelector('.assess-content');
        if (contentEl) {
          contentEl.innerHTML = _buildAssessContentHtml();
          contentEl.scrollTop = 0;
        }
        panel.querySelectorAll('.assess-disc-btn').forEach(function (b) {
          b.classList.toggle('active', parseInt(b.dataset.disc, 10) === assessActiveDisc);
        });
      });
    });
  }

  var _tutorialActive = false;

  function _startPlayerTutorial() {
    if (!socket) return;
    socket.emit('tutorial:start', { file: 'scene1-assess.json' });
  }

  function _advancePlayerTutorial() {
    if (!socket) return;
    socket.emit('tutorial:advance');
  }

  function _endPlayerTutorial() {
    if (!socket) return;
    socket.emit('tutorial:end');
  }

  function _updateTutorialControls(data) {
    var startBtn = document.getElementById('tutorial-start-btn');
    var advBtn = document.getElementById('tutorial-advance-btn');
    var endBtn = document.getElementById('tutorial-end-btn');
    var status = document.getElementById('tutorial-status');

    if (data.ended) {
      _tutorialActive = false;
      if (startBtn) startBtn.classList.remove('hidden');
      if (advBtn) advBtn.classList.add('hidden');
      if (endBtn) endBtn.classList.add('hidden');
      if (status) { status.classList.add('hidden'); status.textContent = ''; }
      return;
    }

    _tutorialActive = true;
    if (startBtn) startBtn.classList.add('hidden');
    if (endBtn) endBtn.classList.remove('hidden');

    var isLastPhase = data.currentPhase >= data.totalPhases - 1;
    if (advBtn) {
      if (isLastPhase) advBtn.classList.add('hidden');
      else advBtn.classList.remove('hidden');
    }

    if (status) {
      status.classList.remove('hidden');
      status.textContent = 'Phase ' + (data.currentPhase + 1) + '/' + data.totalPhases + ': ' + (data.phaseLabel || '');
    }
  }


  var _panelCollapseState = { left: false, right: false };
  var _colWidths = { left: 260, right: 300 };
  var COLLAPSE_STORAGE_KEY = 'cb_panel_collapse';

  function _applyGridTemplate() {
    var grid = document.getElementById('bridge-grid');
    if (!grid) return;
    var lw = _panelCollapseState.left  ? 0 : _colWidths.left;
    var rw = _panelCollapseState.right ? 0 : _colWidths.right;
    var lg = _panelCollapseState.left  ? 0 : 6;
    var rg = _panelCollapseState.right ? 0 : 6;
    grid.style.gridTemplateColumns = lw + 'px ' + lg + 'px 1fr ' + rg + 'px ' + rw + 'px';
  }

  function _loadCollapseState() {
    try {
      var saved = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || '{}');
      _panelCollapseState.left = !!saved.left;
      _panelCollapseState.right = !!saved.right;
    } catch (e) { /* ignore */ }
  }

  function _saveCollapseState() {
    try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(_panelCollapseState)); } catch (e) { /* ignore */ }
  }

  function collapsePanel(side) {
    var col = document.getElementById('cb-col-' + side);
    var handle = document.getElementById(side === 'left' ? 'drag-left' : 'drag-right');
    var tab = document.getElementById('cb-tab-' + side);
    var grid = document.getElementById('bridge-grid');
    if (!col) return;

    _panelCollapseState[side] = true;
    col.classList.add('cb-collapsed');
    if (grid) grid.classList.add('cb-' + side + '-collapsed');
    if (handle) handle.classList.add('cb-handle-hidden');
    if (tab) tab.classList.add('cb-tab-visible');

    _applyGridTemplate();
    _saveCollapseState();
  }

  function expandPanel(side) {
    var col = document.getElementById('cb-col-' + side);
    var handle = document.getElementById(side === 'left' ? 'drag-left' : 'drag-right');
    var tab = document.getElementById('cb-tab-' + side);
    var grid = document.getElementById('bridge-grid');
    if (!col) return;

    _panelCollapseState[side] = false;
    col.classList.remove('cb-collapsed');
    if (grid) grid.classList.remove('cb-' + side + '-collapsed');
    if (handle) handle.classList.remove('cb-handle-hidden');
    if (tab) tab.classList.remove('cb-tab-visible');

    _applyGridTemplate();
    _saveCollapseState();
  }

  function initCollapsiblePanels() {
    _loadCollapseState();

    var collapseLeft = document.getElementById('cb-collapse-left');
    var collapseRight = document.getElementById('cb-collapse-right');
    var tabLeft = document.getElementById('cb-tab-left');
    var tabRight = document.getElementById('cb-tab-right');

    if (collapseLeft) collapseLeft.addEventListener('click', function () { collapsePanel('left'); });
    if (collapseRight) collapseRight.addEventListener('click', function () { collapsePanel('right'); });
    if (tabLeft) tabLeft.addEventListener('click', function () { expandPanel('left'); });
    if (tabRight) tabRight.addEventListener('click', function () { expandPanel('right'); });

    if (_panelCollapseState.left) collapsePanel('left');
    if (_panelCollapseState.right) collapsePanel('right');

    var journalToggle  = document.getElementById('cb-journal-toggle');
    var journalSection = document.getElementById('cb-journal-section');
    var JOURNAL_COLLAPSE_KEY = 'cb_journal_collapsed';

    function _applyJournalState(collapsed) {
      if (!journalSection) return;
      if (collapsed) {
        journalSection.classList.add('collapsed');
      } else {
        journalSection.classList.remove('collapsed');
      }
    }

    if (journalToggle && journalSection) {
      var journalCollapsed = sessionStorage.getItem(JOURNAL_COLLAPSE_KEY) === '1';
      _applyJournalState(journalCollapsed);

      journalToggle.addEventListener('click', function () {
        var nowCollapsed = !journalSection.classList.contains('collapsed');
        _applyJournalState(nowCollapsed);
        try { sessionStorage.setItem(JOURNAL_COLLAPSE_KEY, nowCollapsed ? '1' : '0'); } catch (e) { /* ignore */ }
      });
    }
  }

  function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _tagCatClass(cat) {
    var safe = /^(npc|location|lore|item|custom)$/.test(cat) ? cat : 'custom';
    return 'journal-tag-chip--' + safe;
  }

  function _fmtDate(ds) {
    if (!ds) return '';
    var d = new Date(ds);
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  var _crewJournalEntries = [];
  var _crewJournalTags = [];
  var _crewAdventures = [];
  var _crewCompletions = {};
  var _crewNav = { level: 'acts', actNum: null, advId: null, sceneId: null };
  var _crewExpandedEntry = null;

  var _CREW_ACT_NAMES = {
    1: 'The Dawn of Defiance',
    2: 'The Shadow War',
    3: 'The Final Reckoning'
  };

  function _getCrewActAdvs(actNum) {
    return _crewAdventures.filter(function (a) { return a.act === actNum || a.act === 'Act ' + actNum; });
  }

  function _countCrewActScenes(actNum) {
    var advs = _getCrewActAdvs(actNum);
    var total = 0, done = 0;
    advs.forEach(function (adv) {
      (adv.parts || []).forEach(function (p) {
        (p.scenes || []).forEach(function (s) {
          total++;
          if (_crewCompletions[s.id] && _crewCompletions[s.id].completed) done++;
        });
      });
    });
    return { total: total, done: done };
  }

  function _findCrewScene(sceneId) {
    for (var i = 0; i < _crewAdventures.length; i++) {
      var adv = _crewAdventures[i];
      for (var j = 0; j < (adv.parts || []).length; j++) {
        var part = adv.parts[j];
        for (var k = 0; k < (part.scenes || []).length; k++) {
          if (part.scenes[k].id === sceneId) return part.scenes[k];
        }
      }
    }
    return null;
  }

  function _renderCrewBreadcrumbs() {
    var parts = [];
    parts.push('<span class="jnav-crumb" data-cj-nav-to="acts">Crew Journal</span>');
    if (_crewNav.level === 'tag-search' && _crewNav.searchTag) {
      parts.push('<span class="jnav-sep">\u203A</span>');
      parts.push('<span class="jnav-crumb is-current">Tag: ' + _escHtml(_crewNav.searchTag) + '</span>');
    } else {
      if (_crewNav.level !== 'acts' && _crewNav.actNum) {
        parts.push('<span class="jnav-sep">\u203A</span>');
        parts.push('<span class="jnav-crumb" data-cj-nav-to="episodes">Act ' + _crewNav.actNum + '</span>');
      }
      if ((_crewNav.level === 'scenes' || _crewNav.level === 'scene-detail') && _crewNav.advId) {
        var adv = _crewAdventures.find(function (a) { return a.id === _crewNav.advId; });
        if (adv) {
          parts.push('<span class="jnav-sep">\u203A</span>');
          parts.push('<span class="jnav-crumb" data-cj-nav-to="scenes">' + _escHtml(adv.title) + '</span>');
        }
      }
      if (_crewNav.level === 'scene-detail' && _crewNav.sceneId) {
        var scene = _findCrewScene(_crewNav.sceneId);
        if (scene) {
          parts.push('<span class="jnav-sep">\u203A</span>');
          parts.push('<span class="jnav-crumb is-current">' + _escHtml(scene.title) + '</span>');
        }
      }
    }
    return '<div class="jnav-breadcrumbs">' + parts.join('') + '</div>';
  }

  function loadCrewJournal() {
    Promise.all([
      fetch('/api/campaign/adventures').then(function (r) { return r.json(); }),
      fetch('/api/campaign/progress').then(function (r) { return r.json(); }),
      fetch('/api/journal/entries').then(function (r) { return r.json(); }),
      fetch('/api/journal/tags').then(function (r) { return r.json(); })
    ]).then(function (results) {
      _crewAdventures = results[0].adventures || [];
      _crewCompletions = results[1].completions || {};
      _crewJournalEntries = results[2].entries || [];
      _crewJournalTags = results[3].tags || [];
      renderCrewJournal();
    }).catch(function (err) {
      console.error('[CrewJournal] Load failed:', err);
    });
  }

  function _loadCrewSceneEntries() {
    if (_crewNav.level === 'scene-detail' && _crewNav.sceneId) {
      fetch('/api/journal/entries?scene_id=' + encodeURIComponent(_crewNav.sceneId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _crewJournalEntries = data.entries || [];
          renderCrewJournal();
        }).catch(function () { renderCrewJournal(); });
    } else if (_crewNav.level === 'scenes') {
      fetch('/api/journal/entries')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          _crewJournalEntries = data.entries || [];
          renderCrewJournal();
        }).catch(function () { renderCrewJournal(); });
    } else {
      renderCrewJournal();
    }
  }

  function renderCrewJournal() {
    var wrap = document.getElementById('cb-crew-journal');
    if (!wrap) return;

    var html = '';
    html += _renderCrewBreadcrumbs();
    html += '<div class="jnav-content">';

    if (_crewNav.level === 'acts') {
      var actNums = [];
      _crewAdventures.forEach(function (a) {
        var n = typeof a.act === 'number' ? a.act : parseInt(String(a.act).replace(/\D/g, ''), 10) || 0;
        if (n && actNums.indexOf(n) === -1) actNums.push(n);
      });
      actNums.sort();
      if (!actNums.length) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No adventures loaded.</div>';
      }
      actNums.forEach(function (actNum) {
        var counts = _countCrewActScenes(actNum);
        var name = _CREW_ACT_NAMES[actNum] || '';
        html += '<div class="jnav-row" data-cj-act="' + actNum + '">';
        html += '<span class="jnav-row-icon">\u25B6</span>';
        html += '<div class="jnav-row-text">';
        html += '<span class="jnav-row-title">Act ' + actNum + (name ? ' \u2014 ' + _escHtml(name) : '') + '</span>';
        html += '<span class="jnav-row-sub">' + counts.done + ' / ' + counts.total + ' scenes completed</span>';
        html += '</div></div>';
      });
    } else if (_crewNav.level === 'episodes') {
      var advs = _getCrewActAdvs(_crewNav.actNum);
      if (!advs.length) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No episodes in this act yet.</div>';
      }
      advs.forEach(function (adv) {
        var total = 0, done = 0;
        (adv.parts || []).forEach(function (p) {
          (p.scenes || []).forEach(function (s) {
            total++;
            if (_crewCompletions[s.id] && _crewCompletions[s.id].completed) done++;
          });
        });
        html += '<div class="jnav-row" data-cj-adv="' + _escHtml(adv.id) + '">';
        html += '<span class="jnav-row-icon">\u25B6</span>';
        html += '<div class="jnav-row-text">';
        html += '<span class="jnav-row-title">Episode ' + adv.number + ': ' + _escHtml(adv.title) + '</span>';
        html += '<span class="jnav-row-sub">' + done + ' / ' + total + ' scenes completed</span>';
        html += '</div></div>';
      });
    } else if (_crewNav.level === 'scenes') {
      var adv = _crewAdventures.find(function (a) { return a.id === _crewNav.advId; });
      if (!adv) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">Adventure not found.</div>';
      } else {
        var advDebriefTag = 'adventure:' + _crewNav.advId;
        var advDebriefs = _crewJournalEntries.filter(function (e) {
          return e.source_scene_id === advDebriefTag && e.author_character_name === 'Mission Debrief';
        });
        if (advDebriefs.length > 0) {
          advDebriefs.forEach(function (debrief) {
            html += '<div class="journal-scene-log journal-mission-debrief" data-cj-scene-log>';
            html += '<div class="journal-scene-log-header journal-mission-debrief-header">';
            html += '<span class="journal-scene-log-chevron">\u25B6</span>';
            html += '<span class="journal-mission-debrief-label">Mission Chronicle</span>';
            html += '<span class="journal-scene-log-date">' + _fmtDate(debrief.created_at) + '</span>';
            html += '</div>';
            html += '<div class="journal-scene-log-body">';
            html += '<pre class="journal-mission-debrief-content">' + _escHtml(debrief.body || '') + '</pre>';
            html += '</div></div>';
          });
        }
        (adv.parts || []).forEach(function (part) {
          html += '<div class="jnav-part-label">Part ' + part.number + ': ' + _escHtml(part.title) + '</div>';
          (part.scenes || []).forEach(function (scene) {
            var comp = _crewCompletions[scene.id];
            var isDone = comp && comp.completed;
            var entryCount = 0;
            _crewJournalEntries.forEach(function (e) { if (e.source_scene_id === scene.id) entryCount++; });
            html += '<div class="jnav-row' + (isDone ? '' : ' is-locked') + '"' + (isDone ? ' data-cj-scene="' + _escHtml(scene.id) + '"' : '') + '>';
            html += '<span class="jnav-row-icon">' + (isDone ? '\u25B6' : '\u25CB') + '</span>';
            html += '<div class="jnav-row-text">';
            html += '<span class="jnav-row-title' + (isDone ? '' : ' is-dim') + '">Scene ' + scene.number + ': ' + _escHtml(scene.title) + '</span>';
            if (isDone && entryCount > 0) {
              html += '<span class="jnav-row-sub">' + entryCount + ' journal ' + (entryCount === 1 ? 'entry' : 'entries') + '</span>';
            } else if (!isDone) {
              html += '<span class="jnav-row-sub is-dim">Not yet completed</span>';
            }
            html += '</div></div>';
          });
        });
      }
    } else if (_crewNav.level === 'scene-detail') {
      var campaignLog = null;
      var playerEntries = [];
      _crewJournalEntries.forEach(function (e) {
        if (e.source_scene_id !== _crewNav.sceneId) return;
        if (e.author_character_name === 'Campaign Log') {
          campaignLog = e;
        } else if (e.author_character_name !== 'Mission Debrief') {
          playerEntries.push(e);
        }
      });

      if (campaignLog) {
        html += '<div class="journal-scene-log" data-cj-scene-log>';
        html += '<div class="journal-scene-log-header">';
        html += '<span class="journal-scene-log-chevron">\u25B6</span>';
        html += '<span class="journal-scene-log-title">Scene Summary</span>';
        html += '<span class="journal-scene-log-date">' + _fmtDate(campaignLog.created_at) + '</span>';
        html += '</div>';
        html += '<div class="journal-scene-log-body">';
        html += '<pre class="journal-scene-log-content">' + _escHtml(campaignLog.body || '') + '</pre>';
        html += '</div></div>';
      }

      if (playerEntries.length === 0) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No crew notes for this scene yet.</div>';
      } else if (playerEntries.length > 0) {
        playerEntries.forEach(function (entry) {
          var isExpanded = _crewExpandedEntry === entry.id;
          html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '" style="cursor:pointer;">';
          html += '<div class="journal-entry-card-header" data-cj-toggle="' + entry.id + '">';
          html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
          html += '<span class="journal-entry-title">' + _escHtml(entry.title) + '</span>';
          html += '<span class="journal-entry-date">' + _fmtDate(entry.created_at) + '</span>';
          html += '</div>';
          if (isExpanded) {
            html += '<div class="journal-entry-expanded">';
            html += '<div class="journal-entry-meta">';
            html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
            var tags = entry.tags || [];
            if (tags.length) {
              html += '<span class="journal-entry-tags">';
              tags.forEach(function (t) {
                html += '<span class="journal-tag-chip ' + _tagCatClass(t.category) + '" data-cj-tag-search="' + _escHtml(t.name) + '">' + _escHtml(t.name) + '</span>';
              });
              html += '</span>';
            }
            html += '</div>';
            html += '<div class="journal-entry-body">' + _escHtml(entry.body || '').replace(/\n/g, '<br>') + '</div>';
            html += '</div>';
          } else {
            html += '<div class="journal-entry-meta-inline">';
            html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
            html += '</div>';
          }
          html += '</div>';
        });
      }
    } else if (_crewNav.level === 'tag-search') {
      var tagName = _crewNav.searchTag;
      var tagMatches = _crewJournalEntries.filter(function (e) {
        return (e.tags || []).some(function (t) { return t.name === tagName; });
      });
      if (!tagMatches.length) {
        html += '<div style="padding:1rem;text-align:center;opacity:0.4;font-size:0.6rem;">No entries tagged "' + _escHtml(tagName) + '"</div>';
      } else {
        tagMatches.forEach(function (entry) {
          var isCampaignLog = entry.author_character_name === 'Campaign Log';
          var isMissionDebrief = entry.author_character_name === 'Mission Debrief';
          var isExpanded = _crewExpandedEntry === entry.id;
          var sceneName = '';
          var scene = entry.source_scene_id ? _findCrewScene(entry.source_scene_id) : null;
          if (scene) sceneName = scene.title;
          if (isMissionDebrief) {
            html += '<div class="journal-scene-log journal-mission-debrief" data-cj-scene-log>';
            html += '<div class="journal-scene-log-header journal-mission-debrief-header">';
            html += '<span class="journal-scene-log-chevron">\u25B6</span>';
            html += '<span class="journal-mission-debrief-label">' + _escHtml(entry.title) + '</span>';
            html += '<span class="journal-scene-log-date">' + _fmtDate(entry.created_at) + '</span>';
            html += '</div>';
            html += '<div class="journal-scene-log-body">';
            html += '<pre class="journal-mission-debrief-content">' + _escHtml(entry.body || '') + '</pre>';
            html += '</div></div>';
          } else if (isCampaignLog) {
            html += '<div class="journal-scene-log" data-cj-scene-log>';
            html += '<div class="journal-scene-log-header">';
            html += '<span class="journal-scene-log-chevron">\u25B6</span>';
            html += '<span class="journal-scene-log-title">' + _escHtml(entry.title) + '</span>';
            html += '<span class="journal-scene-log-date">' + _fmtDate(entry.created_at) + '</span>';
            html += '</div>';
            html += '<div class="journal-scene-log-body">';
            html += '<pre class="journal-scene-log-content">' + _escHtml(entry.body || '') + '</pre>';
            html += '</div></div>';
          } else {
            html += '<div class="journal-entry-card' + (isExpanded ? ' is-expanded' : '') + '" style="cursor:pointer;">';
            html += '<div class="journal-entry-card-header" data-cj-toggle="' + entry.id + '">';
            html += '<span class="journal-entry-chevron">' + (isExpanded ? '\u25BC' : '\u25B6') + '</span>';
            html += '<span class="journal-entry-title">' + _escHtml(entry.title) + '</span>';
            html += '<span class="journal-entry-date">' + _fmtDate(entry.created_at) + '</span>';
            html += '</div>';
            if (isExpanded) {
              html += '<div class="journal-entry-expanded">';
              html += '<div class="journal-entry-meta">';
              html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
              if (sceneName) {
                html += '<span class="journal-entry-scene-ref">' + _escHtml(sceneName) + '</span>';
              }
              var eTags = entry.tags || [];
              if (eTags.length) {
                html += '<span class="journal-entry-tags">';
                eTags.forEach(function (t) {
                  html += '<span class="journal-tag-chip ' + _tagCatClass(t.category) + '" data-cj-tag-search="' + _escHtml(t.name) + '">' + _escHtml(t.name) + '</span>';
                });
                html += '</span>';
              }
              html += '</div>';
              html += '<div class="journal-entry-body">' + _escHtml(entry.body || '').replace(/\n/g, '<br>') + '</div>';
              html += '</div>';
            } else {
              html += '<div class="journal-entry-meta-inline">';
              html += '<span class="journal-entry-author">' + _escHtml(entry.author_character_name) + '</span>';
              if (sceneName) {
                html += '<span class="journal-entry-scene-ref">' + _escHtml(sceneName) + '</span>';
              }
              html += '</div>';
            }
            html += '</div>';
          }
        });
      }
    }

    html += '</div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-cj-nav-to]').forEach(function (el) {
      el.addEventListener('click', function () {
        var target = el.getAttribute('data-cj-nav-to');
        if (target === 'acts') {
          _crewNav = { level: 'acts', actNum: null, advId: null, sceneId: null, searchTag: null };
        } else if (target === 'episodes') {
          _crewNav.level = 'episodes';
          _crewNav.advId = null;
          _crewNav.sceneId = null;
          _crewNav.searchTag = null;
        } else if (target === 'scenes') {
          _crewNav.level = 'scenes';
          _crewNav.sceneId = null;
          _crewNav.searchTag = null;
        }
        _crewExpandedEntry = null;
        renderCrewJournal();
      });
    });

    wrap.querySelectorAll('[data-cj-tag-search]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        var tn = chip.getAttribute('data-cj-tag-search');
        _crewNav = { level: 'tag-search', actNum: null, advId: null, sceneId: null, searchTag: tn };
        _crewExpandedEntry = null;
        fetch('/api/journal/entries?tag=' + encodeURIComponent(tn))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            _crewJournalEntries = data.entries || [];
            renderCrewJournal();
          }).catch(function () { renderCrewJournal(); });
      });
    });

    wrap.querySelectorAll('[data-cj-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        _crewNav = { level: 'episodes', actNum: parseInt(el.getAttribute('data-cj-act'), 10), advId: null, sceneId: null };
        _crewExpandedEntry = null;
        renderCrewJournal();
      });
    });

    wrap.querySelectorAll('[data-cj-adv]').forEach(function (el) {
      el.addEventListener('click', function () {
        _crewNav.level = 'scenes';
        _crewNav.advId = el.getAttribute('data-cj-adv');
        _crewNav.sceneId = null;
        _crewExpandedEntry = null;
        _loadCrewSceneEntries();
      });
    });

    wrap.querySelectorAll('[data-cj-scene]').forEach(function (el) {
      el.addEventListener('click', function () {
        _crewNav.level = 'scene-detail';
        _crewNav.sceneId = el.getAttribute('data-cj-scene');
        _crewExpandedEntry = null;
        _loadCrewSceneEntries();
      });
    });

    wrap.querySelectorAll('[data-cj-scene-log]').forEach(function (log) {
      var header = log.querySelector('.journal-scene-log-header');
      if (header) {
        header.addEventListener('click', function () {
          log.classList.toggle('is-expanded');
        });
      }
    });

    wrap.querySelectorAll('[data-cj-toggle]').forEach(function (header) {
      header.addEventListener('click', function () {
        var id = parseInt(header.getAttribute('data-cj-toggle'), 10);
        _crewExpandedEntry = (_crewExpandedEntry === id) ? null : id;
        renderCrewJournal();
      });
    });
  }

  function _getCrewTagCat(name) {
    for (var i = 0; i < _crewJournalTags.length; i++) {
      if (_crewJournalTags[i].name === name) return _crewJournalTags[i].category;
    }
    return 'custom';
  }

  var _decisionCache = [];
  var _pollVotes = {};
  var _impactTags = [
    { value: 'switch-deal', label: 'Switch Deal', color: '#a78bfa' },
    { value: 'maya-fate', label: 'Maya\u2019s Fate', color: '#c084fc' },
    { value: 'denia-fate', label: 'Denia\u2019s Fate', color: '#60a5fa' },
    { value: 'varth-relationship', label: 'Varth Relationship', color: '#f97316' },
    { value: 'malpaz-uprising', label: 'Malpaz Uprising', color: '#ef4444' },
    { value: 'soren-alliance', label: 'Soren Alliance', color: '#34d399' },
    { value: 'kessra-grudge', label: 'Kessra Grudge', color: '#fbbf24' },
    { value: 'mandrake-fate', label: 'Mandrake\u2019s Fate', color: '#fb923c' },
    { value: 'raden-fate', label: 'Raden\u2019s Fate', color: '#38bdf8' },
    { value: 'sinde-cipher', label: 'Sinde Cipher', color: '#e879f9' }
  ];
  var _campaignState = null;

  function _impactColor(tag) {
    for (var i = 0; i < _impactTags.length; i++) {
      if (_impactTags[i].value === tag) return _impactTags[i].color;
    }
    return '#9ca3af';
  }

  var _impactTagColors = {
    'switch-deal': '#a78bfa', 'maya-fate': '#c084fc', 'denia-fate': '#60a5fa',
    'varth-relationship': '#f97316', 'malpaz-uprising': '#ef4444', 'soren-alliance': '#34d399',
    'kessra-grudge': '#fbbf24', 'mandrake-fate': '#fb923c', 'raden-fate': '#38bdf8',
    'sinde-cipher': '#e879f9'
  };

  function _syncImpactTagsFromRegistry(registry) {
    if (!registry || typeof registry !== 'object') return;
    var newTags = [];
    for (var key in registry) {
      if (!registry.hasOwnProperty(key)) continue;
      var color = _impactTagColors[key] || '#9ca3af';
      var label = key.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      newTags.push({ value: key, label: label, color: color });
    }
    if (newTags.length > 0) _impactTags = newTags;
  }

  function loadDecisions() {
    fetch('/api/campaign/decisions')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _decisionCache = data.decisions || [];
        renderDecisionTimeline();
      })
      .catch(function (err) { console.error('Failed to load decisions:', err); });
    fetch('/api/campaign/decisions/state')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _campaignState = data.state || {};
        if (data.registry) _syncImpactTagsFromRegistry(data.registry);
        renderCampaignStatePanel();
      })
      .catch(function (err) { console.error('Failed to load campaign state:', err); });
  }

  function renderDecisionTimeline() {
    var container = document.getElementById('cb-decision-timeline');
    if (!container) return;
    if (_decisionCache.length === 0) {
      container.innerHTML = '<div class="cb-decision-empty">No decisions logged yet.</div>';
      return;
    }
    var groups = {};
    _decisionCache.forEach(function (d) {
      var key = d.adventure_id || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    var html = '';
    Object.keys(groups).forEach(function (advId) {
      var adv = getAdventure(advId);
      var advTitle = adv ? adv.title : advId;
      html += '<div class="cb-decision-group">';
      html += '<div class="cb-decision-group-header">' + esc(advTitle) + '</div>';
      groups[advId].forEach(function (d) {
        html += '<div class="cb-decision-entry" data-decision-id="' + d.id + '">';
        html += '<div class="cb-decision-choice">' + esc(d.choice) + '</div>';
        if (d.outcome) html += '<div class="cb-decision-outcome">' + esc(d.outcome) + '</div>';
        if (d.impact_value) html += '<div class="cb-decision-impact-value">Sets: ' + esc(d.impact_value) + '</div>';
        if (d.gm_notes) html += '<div class="cb-decision-gm-notes">' + esc(d.gm_notes) + '</div>';
        if (d.auto_notes) html += '<div class="cb-decision-auto-notes">' + esc(d.auto_notes) + '</div>';
        var vd = d.vote_data;
        if (typeof vd === 'string') { try { vd = JSON.parse(vd); } catch(e) { vd = null; } }
        if (vd && vd.tally) {
          html += '<div class="cb-decision-vote-summary">';
          html += '<span class="cb-decision-vote-count">' + (vd.totalVotes || 0) + ' votes</span>';
          Object.keys(vd.tally).forEach(function (opt) {
            html += '<span class="cb-decision-vote-bar"><span class="cb-vote-opt">' + esc(opt) + '</span>: ' + vd.tally[opt] + '</span>';
          });
          html += '</div>';
        }
        html += '<div class="cb-decision-meta">';
        if (d.campaign_impact) {
          html += '<span class="cb-decision-impact" style="border-color:' + _impactColor(d.campaign_impact) + ';color:' + _impactColor(d.campaign_impact) + '">' + esc(d.campaign_impact) + '</span>';
        }
        if (d.voted) html += '<span class="cb-decision-voted">&#9745; voted</span>';
        if (d.scene_id) html += '<span class="cb-decision-scene-ref">' + esc(d.scene_id) + '</span>';
        html += '<button class="cb-decision-delete" data-del-id="' + d.id + '" title="Delete">&times;</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.cb-decision-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.delId;
        if (!confirm('Delete this decision?')) return;
        fetch('/api/campaign/decisions/' + id, { method: 'DELETE' })
          .then(function () { loadDecisions(); })
          .catch(function (err) { console.error('Failed to delete decision:', err); });
      });
    });
  }

  function renderCampaignStatePanel() {
    var container = document.getElementById('cb-campaign-state-panel');
    if (!container) return;
    if (!_campaignState || Object.keys(_campaignState).length === 0) {
      container.innerHTML = '';
      return;
    }
    var html = '<div class="cb-campaign-state-header">Campaign State</div>';
    html += '<div class="cb-campaign-state-grid">';
    for (var i = 0; i < _impactTags.length; i++) {
      var tag = _impactTags[i];
      var val = _campaignState[tag.value];
      if (val === undefined) continue;
      html += '<div class="cb-campaign-state-item">';
      html += '<span class="cb-campaign-state-key" style="color:' + tag.color + '">' + esc(tag.label) + '</span>';
      html += '<span class="cb-campaign-state-val">' + esc(val) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function promptDecisionOnComplete(sceneId) {
    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, sceneId) : null;
    if (!scene || !scene.decisionPoints || scene.decisionPoints.length === 0) return;
    var alreadyLogged = _decisionCache.some(function (d) {
      return d.scene_id === sceneId && d.adventure_id === currentAdventure;
    });
    if (alreadyLogged) return;
    if (confirm('Scene "' + (scene.title || sceneId) + '" has ' + scene.decisionPoints.length + ' decision point(s). Log decisions now?')) {
      openDecisionModal();
    }
  }

  function openDecisionModal(structuredOpt) {
    var existing = document.getElementById('cb-decision-modal-overlay');
    if (existing) existing.remove();

    var adv = getAdventure(currentAdventure);
    var part = adv ? getPart(adv, currentPart) : null;
    var scene = part ? getScene(part, currentScene) : null;
    var sceneDecisionPoints = (scene && scene.decisionPoints) ? scene.decisionPoints : [];
    var _structuredData = structuredOpt || null;

    var overlay = document.createElement('div');
    overlay.id = 'cb-decision-modal-overlay';
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="cb-decision-modal">';
    html += '<div class="cb-decision-modal-header"><span>Log Decision</span><button class="cb-decision-modal-close" id="cb-decision-modal-close">&times;</button></div>';
    html += '<div class="cb-decision-modal-body">';

    if (_structuredData) {
      html += '<div class="cb-dec-structured-info">';
      html += '<div class="cb-dec-selected-label">Selected: <strong>' + esc(_structuredData.choice) + '</strong></div>';
      if (_structuredData.consequence) html += '<div class="cb-dec-selected-consequence">' + esc(_structuredData.consequence) + '</div>';
      var sImpacts = Array.isArray(_structuredData.impacts) ? _structuredData.impacts : [];
      if (sImpacts.length) {
        html += '<div class="cb-dec-selected-impact">Impacts:';
        sImpacts.forEach(function (imp) {
          html += ' <span class="cb-dash-dp-impact">' + esc(imp.key) + ' &rarr; ' + esc(imp.value) + '</span>';
        });
        html += '</div>';
      }
      html += '</div>';
    } else if (sceneDecisionPoints.length > 0) {
      html += '<label>Decision Points</label>';
      sceneDecisionPoints.forEach(function (dp, dpi) {
        html += '<div class="cb-dec-dp-group-modal">';
        html += '<div class="cb-dec-dp-prompt-modal">' + esc(dp.prompt) + '</div>';
        dp.options.forEach(function (opt, oi) {
          html += '<div class="cb-decision-scene-chip cb-dec-dp-opt-chip" data-dp-idx="' + dpi + '" data-opt-idx="' + oi + '">' + esc(opt.label) + '</div>';
        });
        html += '</div>';
      });
    }

    html += '<label>Choice</label>';
    html += '<input type="text" id="dec-choice" placeholder="What did the crew decide?" />';
    html += '<label>Outcome</label>';
    html += '<textarea id="dec-outcome" rows="2" placeholder="What happened as a result?"></textarea>';
    html += '<label>GM Notes</label>';
    html += '<textarea id="dec-gm-notes" rows="2" placeholder="Private GM notes about this decision..."></textarea>';
    html += '<label>Campaign Impact</label>';
    html += '<select id="dec-impact">';
    html += '<option value="">None</option>';
    _impactTags.forEach(function (t) {
      html += '<option value="' + t.value + '"' + (_structuredData && _structuredData.campaignImpact === t.value ? ' selected' : '') + '>' + esc(t.label) + '</option>';
    });
    html += '</select>';

    html += '<button class="cb-decision-poll-btn" id="dec-poll-btn">&#9745; Send to Crew for Vote</button>';
    html += '<div id="dec-vote-tally"></div>';

    html += '<div class="cb-decision-modal-actions">';
    html += '<button id="dec-cancel">Cancel</button>';
    html += '<button id="dec-save" class="primary">Save Decision</button>';
    html += '</div>';

    html += '</div></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    var choiceInput = document.getElementById('dec-choice');
    var outcomeInput = document.getElementById('dec-outcome');
    var gmNotesInput = document.getElementById('dec-gm-notes');
    var impactSelect = document.getElementById('dec-impact');

    if (_structuredData) {
      choiceInput.value = _structuredData.choice || '';
      outcomeInput.value = _structuredData.consequence || '';
    }

    overlay.querySelectorAll('.cb-dec-dp-opt-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        overlay.querySelectorAll('.cb-dec-dp-opt-chip').forEach(function (c) { c.classList.remove('selected'); });
        chip.classList.add('selected');
        var dpIdx = parseInt(chip.dataset.dpIdx, 10);
        var optIdx = parseInt(chip.dataset.optIdx, 10);
        var dp = sceneDecisionPoints[dpIdx];
        var opt = dp ? dp.options[optIdx] : null;
        if (dp && opt) {
          var impactsArr = Array.isArray(opt.impacts) ? opt.impacts
            : (dp.campaignImpact && opt.sets ? [{ key: dp.campaignImpact, value: opt.sets }] : []);
          _structuredData = {
            decisionPointId: dp.id,
            optionKey: opt.key,
            impacts: impactsArr,
            choice: opt.label,
            consequence: opt.consequence || ''
          };
          choiceInput.value = opt.label;
          outcomeInput.value = opt.consequence || '';
          if (impactsArr.length && impactsArr[0].key) impactSelect.value = impactsArr[0].key;
        }
      });
    });

    document.getElementById('cb-decision-modal-close').addEventListener('click', function () { closeDecisionModal(); });
    document.getElementById('dec-cancel').addEventListener('click', function () { closeDecisionModal(); });

    document.getElementById('dec-poll-btn').addEventListener('click', function () {
      var choices = [];
      if (_structuredData && _structuredData.decisionPointId) {
        var dp = null;
        for (var i = 0; i < sceneDecisionPoints.length; i++) {
          if (sceneDecisionPoints[i].id === _structuredData.decisionPointId) { dp = sceneDecisionPoints[i]; break; }
        }
        if (dp) dp.options.forEach(function (o) { choices.push(o.label); });
      }
      if (choiceInput.value.trim() && choices.indexOf(choiceInput.value.trim()) === -1) {
        choices.push(choiceInput.value.trim());
      }
      if (choices.length === 0) return;
      _pollVotes = {};
      if (socket) {
        var decKey = _structuredData ? _structuredData.decisionPointId : 'custom';
        socket.emit('decision:poll', {
          sceneId: currentScene,
          adventureId: currentAdventure,
          decisionKey: decKey,
          choices: choices
        });
      }
      var tallyEl = document.getElementById('dec-vote-tally');
      if (tallyEl) tallyEl.innerHTML = '<div class="cb-decision-vote-tally">Poll sent to crew. Waiting for votes\u2026</div>';
    });

    document.getElementById('dec-save').addEventListener('click', function () {
      var choice = choiceInput.value.trim();
      if (!choice) return;
      var impactVal = impactSelect.value || null;
      var gmNotes = gmNotesInput.value.trim() || null;
      var decKey = _structuredData ? _structuredData.decisionPointId : 'custom';
      var impactsArr = (_structuredData && Array.isArray(_structuredData.impacts) && _structuredData.impacts.length)
        ? _structuredData.impacts
        : (impactVal ? [{ key: impactVal, value: 'set' }] : []);
      var resolvePayload = {
        choice: choice,
        outcome: outcomeInput.value.trim() || null,
        campaign_impact: impactsArr.length ? impactsArr[0].key : null,
        impact_value: impactsArr.length ? impactsArr[0].value : null,
        impacts: impactsArr,
        adventure_id: currentAdventure,
        scene_id: currentScene,
        decision_key: decKey,
        decision_point_id: _structuredData ? _structuredData.decisionPointId : null,
        option_key: _structuredData ? _structuredData.optionKey : null,
        gm_notes: gmNotes,
        auto_notes: scene ? ('Scene: ' + (scene.title || currentScene)) : null
      };
      if (socket) {
        socket.emit('decision:resolve', resolvePayload);
      } else {
        fetch('/api/campaign/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resolvePayload)
        }).then(function () { loadDecisions(); });
      }
      closeDecisionModal();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeDecisionModal();
    });
  }

  function closeDecisionModal() {
    var overlay = document.getElementById('cb-decision-modal-overlay');
    if (overlay) overlay.remove();
    if (socket) socket.emit('decision:cancel-poll');
  }

  var _missionSummaryGenerating = false;

  var _msSelectedPartIds = [];

  function openMissionSummaryModal() {
    if (_missionSummaryGenerating) return;
    if (!currentAdventure) return;

    var existing = document.getElementById('cb-mission-summary-overlay');
    if (existing) existing.remove();

    var adv = getAdventure(currentAdventure);
    var advTitle = adv ? adv.title : currentAdventure;
    var parts = adv ? (adv.parts || []) : [];

    _msSelectedPartIds = [];

    var overlay = document.createElement('div');
    overlay.id = 'cb-mission-summary-overlay';
    overlay.className = 'cb-mission-summary-overlay';
    overlay.innerHTML =
      '<div class="cb-mission-summary-modal">' +
        '<div class="cb-mission-summary-header">' +
          '<span class="cb-mission-summary-title">MISSION CHRONICLE</span>' +
          '<span class="cb-mission-summary-subtitle">' + esc(advTitle) + '</span>' +
          '<button class="cb-mission-summary-close" id="ms-close">&times;</button>' +
        '</div>' +
        '<div class="cb-mission-summary-body" id="ms-body">' +
          '<div class="ms-scope-selector" id="ms-scope">' +
            '<div class="ms-scope-heading">Select scope for debrief</div>' +
            '<div class="ms-scope-hint">Parts with existing debriefs are excluded by default.</div>' +
            '<div class="ms-scope-parts" id="ms-scope-parts"></div>' +
          '</div>' +
          '<div class="cb-mission-summary-loading" id="ms-loading" style="display:none;">' +
            '<div class="cb-mission-summary-spinner"></div>' +
            '<span>Generating mission debrief\u2026</span>' +
          '</div>' +
        '</div>' +
        '<div class="cb-mission-summary-footer" id="ms-footer">' +
          '<button class="cb-header-btn accent" id="ms-generate-btn">Generate Debrief</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('ms-close').addEventListener('click', closeMissionSummaryModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeMissionSummaryModal();
    });

    fetch('/api/journal/entries')
      .then(function (r) { return r.json(); })
      .then(function (journal) {
        var entries = journal.entries || journal || [];
        var debriefedParts = {};
        entries.forEach(function (e) {
          if (e.author_character_name !== 'Mission Debrief') return;
          var sid = e.source_scene_id || '';
          if (sid.indexOf('parts:') === 0) {
            sid.replace('parts:', '').split(',').forEach(function (pid) {
              debriefedParts[pid.trim()] = true;
            });
          } else if (sid === 'adventure:' + currentAdventure) {
            parts.forEach(function (p) { debriefedParts[p.id] = true; });
          }
        });
        renderScopeSelector(parts, debriefedParts);
      })
      .catch(function () {
        renderScopeSelector(parts, {});
      });
  }

  function renderScopeSelector(parts, debriefedParts) {
    var container = document.getElementById('ms-scope-parts');
    if (!container) return;
    container.innerHTML = '';

    parts.forEach(function (part) {
      var scenes = part.scenes || [];
      var isDebriefed = !!debriefedParts[part.id];
      var partEl = document.createElement('label');
      partEl.className = 'ms-scope-part' + (isDebriefed ? ' ms-debriefed' : '');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = part.id;
      cb.checked = !isDebriefed;
      cb.className = 'ms-scope-cb';
      partEl.appendChild(cb);

      var info = document.createElement('div');
      info.className = 'ms-scope-part-info';
      var title = document.createElement('span');
      title.className = 'ms-scope-part-title';
      title.textContent = 'Part ' + part.number + ': ' + (part.title || part.id);
      info.appendChild(title);

      if (isDebriefed) {
        var badge = document.createElement('span');
        badge.className = 'ms-scope-badge';
        badge.textContent = 'DEBRIEFED';
        info.appendChild(badge);
      }

      var sceneList = document.createElement('div');
      sceneList.className = 'ms-scope-scenes';
      scenes.forEach(function (s) {
        var sEl = document.createElement('span');
        sEl.className = 'ms-scope-scene';
        sEl.textContent = 'S' + s.number + ': ' + s.title;
        sceneList.appendChild(sEl);
      });
      info.appendChild(sceneList);

      partEl.appendChild(info);
      container.appendChild(partEl);
    });

    var genBtn = document.getElementById('ms-generate-btn');
    if (genBtn) {
      genBtn.onclick = function () {
        var cbs = container.querySelectorAll('.ms-scope-cb:checked');
        _msSelectedPartIds = [];
        for (var i = 0; i < cbs.length; i++) _msSelectedPartIds.push(cbs[i].value);
        if (_msSelectedPartIds.length === 0) {
          showToast('Select at least one part to debrief');
          return;
        }
        generateMissionSummary();
      };
    }
  }

  function generateMissionSummary() {
    _missionSummaryGenerating = true;
    var bodyEl = document.getElementById('ms-body');
    var footerEl = document.getElementById('ms-footer');
    var loadingEl = document.getElementById('ms-loading');
    var scopeEl = document.getElementById('ms-scope');

    if (scopeEl) scopeEl.style.display = 'none';
    if (loadingEl) {
      loadingEl.innerHTML = '<div class="cb-mission-summary-spinner"></div><span>Generating mission debrief\u2026</span>';
      loadingEl.style.display = 'flex';
    }
    if (footerEl) footerEl.style.display = 'none';

    var existingTextarea = bodyEl ? bodyEl.querySelector('textarea') : null;
    if (existingTextarea) existingTextarea.remove();

    fetch('/api/campaign/adventures/' + encodeURIComponent(currentAdventure) + '/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partIds: _msSelectedPartIds })
    })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Generation failed'); });
      return r.json();
    })
    .then(function (data) {
      _missionSummaryGenerating = false;
      if (!document.getElementById('cb-mission-summary-overlay')) return;
      if (loadingEl) loadingEl.style.display = 'none';

      var textarea = document.createElement('textarea');
      textarea.className = 'cb-mission-summary-textarea';
      textarea.id = 'ms-textarea';
      textarea.value = data.summary || '';
      bodyEl.appendChild(textarea);

      if (footerEl) {
        footerEl.innerHTML =
          '<button class="cb-header-btn" id="ms-regenerate">Regenerate</button>' +
          '<button class="cb-header-btn accent" id="ms-save">Save to Journal</button>';
        footerEl.style.display = 'flex';
        document.getElementById('ms-regenerate').addEventListener('click', function () {
          generateMissionSummary();
        });
        document.getElementById('ms-save').addEventListener('click', function () {
          saveMissionDebrief();
        });
      }
    })
    .catch(function (err) {
      _missionSummaryGenerating = false;
      if (!document.getElementById('cb-mission-summary-overlay')) return;
      if (loadingEl) {
        loadingEl.innerHTML = '<span style="color:#ef4444;">' + esc(err.message || 'Generation failed') + '</span>';
        loadingEl.style.display = 'flex';
      }
      if (footerEl) {
        footerEl.innerHTML =
          '<button class="cb-header-btn" id="ms-regenerate">Retry</button>';
        footerEl.style.display = 'flex';
        document.getElementById('ms-regenerate').addEventListener('click', function () {
          generateMissionSummary();
        });
      }
    });
  }

  function saveMissionDebrief() {
    var textarea = document.getElementById('ms-textarea');
    if (!textarea || !textarea.value.trim()) return;

    var adv = getAdventure(currentAdventure);
    var advTitle = adv ? adv.title : currentAdventure;
    var partLabels = [];
    if (_msSelectedPartIds.length && adv) {
      _msSelectedPartIds.forEach(function (pid) {
        var p = getPart(adv, pid);
        if (p) partLabels.push('Part ' + p.number);
      });
    }
    var title = 'Mission Debrief: ' + advTitle + (partLabels.length ? ' \u2014 ' + partLabels.join(', ') : '');
    var sourceId = _msSelectedPartIds.length ? 'parts:' + _msSelectedPartIds.join(',') : 'adventure:' + currentAdventure;

    fetch('/api/journal/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        body: textarea.value.trim(),
        author_character_name: 'Mission Debrief',
        source_scene_id: sourceId
      })
    })
    .then(function (r) {
      if (!r.ok) throw new Error('Failed to save');
      return r.json();
    })
    .then(function () {
      closeMissionSummaryModal();
      loadCrewJournal();
      showToast('Mission debrief saved to Crew Journal');
    })
    .catch(function (err) {
      showToast('Failed to save debrief: ' + (err.message || 'Unknown error'));
    });
  }

  function closeMissionSummaryModal() {
    _missionSummaryGenerating = false;
    var overlay = document.getElementById('cb-mission-summary-overlay');
    if (overlay) overlay.remove();
  }

  function showToast(msg) {
    var toast = document.getElementById('npc-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3000);
  }

  function initDecisionTracker() {
    var logBtn = document.getElementById('cb-log-decision-btn');
    if (logBtn) {
      logBtn.addEventListener('click', function () { openDecisionModal(); });
    }
    loadDecisions();

    if (socket) {
      socket.on('decision:vote-received', function (data) {
        _pollVotes[data.characterId] = data;
        var tallyEl = document.getElementById('dec-vote-tally');
        if (tallyEl) {
          var lines = Object.values(_pollVotes).map(function (v) {
            return '<div class="cb-decision-vote-tally">' + esc(v.name) + ' \u2192 ' + esc(v.choiceText) + '</div>';
          });
          tallyEl.innerHTML = lines.join('');
        }
      });

      socket.on('decision:resolved', function () {
        loadDecisions();
      });
    }
  }

  var _challengeCache = [];
  var _activeInstances = [];

  function loadChallengeStatus() {
    var url = '/api/narrative-challenges/instances/active';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _activeInstances = data.instances || [];
        renderChallengeStatus();
      })
      .catch(function () { renderChallengeStatus(); });
  }

  function renderChallengeStatus() {
    var el = document.getElementById('cb-challenge-status');
    if (!el) return;
    if (_activeInstances.length === 0) {
      el.innerHTML = '<div class="cb-decision-empty">No active challenges.</div>';
      return;
    }
    var html = '';
    _activeInstances.forEach(function (inst) {
      var statusClass = inst.status === 'scored' ? 'nc-status--scored' : 'nc-status--active';
      html += '<div class="nc-instance-row ' + statusClass + '" data-inst-id="' + inst.id + '">';
      html += '<span class="nc-instance-char">' + esc(inst.character_name || 'Unknown') + '</span>';
      html += '<span class="nc-instance-challenge">' + esc(inst.challenge_id) + '</span>';
      html += '<span class="nc-instance-badge">' + esc(inst.status) + '</span>';
      html += '</div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.nc-instance-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var instId = parseInt(row.dataset.instId, 10);
        var inst = _activeInstances.find(function (i) { return i.id === instId; });
        if (inst) openChallengeRunner(inst);
      });
    });
  }

  function openChallengeLauncher() {
    var existing = document.getElementById('nc-launcher-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nc-launcher-overlay';
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="nc-launcher-modal">';
    html += '<div class="nc-launcher-header"><span>Launch Narrative Challenge</span><button class="nc-launcher-close" id="nc-launcher-close">&times;</button></div>';
    html += '<div class="nc-launcher-body">';
    html += '<div class="nc-launcher-loading">Loading challenges&hellip;</div>';
    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('nc-launcher-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    Promise.all([
      fetch('/api/narrative-challenges').then(function (r) { return r.json(); }),
      fetch('/api/characters').then(function (r) { return r.json(); })
    ]).then(function (results) {
      _challengeCache = results[0].challenges || [];
      var rawChars = results[1].characters || results[1] || [];
      var characters = rawChars.map(function (ch) {
        return { id: ch.id, name: ch.name, personalDestiny: ch.personalDestiny || null };
      });
      renderLauncherContent(overlay, characters);
    }).catch(function () {
      overlay.querySelector('.nc-launcher-loading').textContent = 'Failed to load data.';
    });
  }

  function renderLauncherContent(overlay, characters) {
    var body = overlay.querySelector('.nc-launcher-body');
    var html = '';

    html += '<label class="nc-label">Select Challenge</label>';
    html += '<div class="nc-challenge-grid">';
    _challengeCache.forEach(function (c) {
      html += '<div class="nc-challenge-card" data-challenge-id="' + esc(c.id) + '">';
      html += '<div class="nc-challenge-card-name">' + esc(c.name) + '</div>';
      html += '<div class="nc-challenge-card-destiny">' + esc(c.destiny) + '</div>';
      html += '<div class="nc-challenge-card-desc">' + esc((c.description || '').substring(0, 80)) + '</div>';
      html += '<div class="nc-challenge-card-meta">' + (c.roundCount || 0) + ' rounds</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<label class="nc-label" style="margin-top:0.75rem;">Assign Characters</label>';
    html += '<button class="cb-header-btn nc-auto-assign-btn" id="nc-auto-assign" style="font-size:0.55rem;padding:0.2rem 0.4rem;min-height:auto;margin-bottom:0.4rem;" disabled>Auto-Assign by Destiny</button>';
    html += '<div class="nc-char-list">';
    characters.forEach(function (ch) {
      var destinyLabel = ch.personalDestiny && ch.personalDestiny.id ? ' (' + ch.personalDestiny.id + ')' : '';
      html += '<label class="nc-char-check"><input type="checkbox" value="' + ch.id + '" data-char-name="' + esc(ch.name) + '" data-char-destiny="' + esc(ch.personalDestiny && ch.personalDestiny.id ? ch.personalDestiny.id : '') + '"> ' + esc(ch.name) + esc(destinyLabel) + '</label>';
    });
    html += '</div>';

    html += '<div style="margin-top:1rem;display:flex;gap:0.5rem;">';
    html += '<button class="cb-header-btn accent" id="nc-launch-go" disabled>Launch Challenge</button>';
    html += '<button class="cb-header-btn" id="nc-launch-cancel">Cancel</button>';
    html += '</div>';

    body.innerHTML = html;

    var selectedChallenge = null;
    var autoAssignBtn = document.getElementById('nc-auto-assign');
    body.querySelectorAll('.nc-challenge-card').forEach(function (card) {
      card.addEventListener('click', function () {
        body.querySelectorAll('.nc-challenge-card').forEach(function (c) { c.classList.remove('nc-selected'); });
        card.classList.add('nc-selected');
        selectedChallenge = card.dataset.challengeId;
        if (autoAssignBtn) autoAssignBtn.disabled = false;
        checkReady();
      });
    });
    if (autoAssignBtn) {
      autoAssignBtn.addEventListener('click', function () {
        if (!selectedChallenge) return;
        var challenge = _challengeCache.find(function (c) { return c.id === selectedChallenge; });
        if (!challenge) return;
        var destinyId = challenge.destiny;
        body.querySelectorAll('.nc-char-check input').forEach(function (cb) {
          cb.checked = (cb.dataset.charDestiny === destinyId);
        });
        checkReady();
      });
    }

    function checkReady() {
      var checked = body.querySelectorAll('.nc-char-check input:checked');
      var btn = document.getElementById('nc-launch-go');
      if (btn) btn.disabled = !(selectedChallenge && checked.length > 0);

      body.querySelectorAll('.nc-challenge-card').forEach(function (c) { c.classList.remove('nc-destiny-match'); });
      if (!selectedChallenge && checked.length > 0) {
        var destinyIds = [];
        checked.forEach(function (cb) {
          if (cb.dataset.charDestiny) destinyIds.push(cb.dataset.charDestiny);
        });
        var uniqueDestinies = destinyIds.filter(function (d, i, a) { return a.indexOf(d) === i; });
        uniqueDestinies.forEach(function (did) {
          _challengeCache.forEach(function (c) {
            if (c.destiny === did) {
              var card = body.querySelector('.nc-challenge-card[data-challenge-id="' + c.id + '"]');
              if (card) card.classList.add('nc-destiny-match');
            }
          });
        });
        if (uniqueDestinies.length === 1) {
          var matching = _challengeCache.filter(function (c) { return c.destiny === uniqueDestinies[0]; });
          if (matching.length === 1) {
            var card = body.querySelector('.nc-challenge-card[data-challenge-id="' + matching[0].id + '"]');
            if (card) card.click();
          }
        }
      }
    }
    body.querySelectorAll('.nc-char-check input').forEach(function (cb) {
      cb.addEventListener('change', checkReady);
    });

    document.getElementById('nc-launch-cancel').addEventListener('click', function () { overlay.remove(); });
    document.getElementById('nc-launch-go').addEventListener('click', function () {
      var checked = body.querySelectorAll('.nc-char-check input:checked');
      var charIds = [];
      checked.forEach(function (cb) { charIds.push(parseInt(cb.value, 10)); });
      launchChallengeInstances(selectedChallenge, charIds, overlay);
    });
  }

  function launchChallengeInstances(challengeId, charIds, overlay) {
    var promises = charIds.map(function (cid) {
      return fetch('/api/narrative-challenges/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          character_id: cid,
          adventure_id: currentAdventure || null,
          scene_id: currentScene || null
        })
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Server error ' + r.status);
          return data;
        });
      });
    });

    Promise.all(promises).then(function () {
      overlay.remove();
      loadChallengeStatus();
      showToast('Challenge launched for ' + charIds.length + ' character(s)');
    }).catch(function (err) {
      console.error('Failed to launch challenges:', err);
      showToast('Failed to launch: ' + (err.message || 'Unknown error'));
    });
  }

  function openChallengeRunner(inst) {
    var existing = document.getElementById('nc-runner-overlay');
    if (existing) existing.remove();

    fetch('/api/narrative-challenges/' + encodeURIComponent(inst.challenge_id))
      .then(function (r) { return r.json(); })
      .then(function (challenge) {
        renderChallengeRunner(inst, challenge);
      })
      .catch(function () { showToast('Failed to load challenge data'); });
  }

  function _calcAutoScore(challenge, choices) {
    if (!challenge || !challenge.rounds || !choices || !choices.length) return null;
    var alignScores = { light: 5, neutral: 3, dark: 1 };
    var total = 0;
    var count = 0;
    choices.forEach(function (c) {
      var round = challenge.rounds.find(function (r) { return r.id === c.round_id; });
      if (!round) return;
      var choice = (round.choices || []).find(function (ch) { return ch.id === c.choice_id; });
      if (!choice) return;
      total += alignScores[choice.alignment] || 3;
      count++;
    });
    if (count === 0) return null;
    return Math.round(total / count);
  }

  function renderChallengeRunner(inst, challenge) {
    var choices = [];
    try { choices = JSON.parse(inst.choices || '[]'); } catch (_) {}

    var overlay = document.createElement('div');
    overlay.id = 'nc-runner-overlay';
    overlay.dataset.instanceId = String(inst.id);
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="nc-runner-modal">';
    html += '<div class="nc-runner-header">';
    html += '<span>' + esc(challenge.name) + ' — ' + esc(inst.character_name || 'Unknown') + '</span>';
    html += '<button class="nc-runner-close" id="nc-runner-close">&times;</button>';
    html += '</div>';
    html += '<div class="nc-runner-body">';

    html += '<div class="nc-runner-intro">';
    html += '<div class="nc-runner-desc">' + esc(challenge.description || '') + '</div>';
    html += '<div class="nc-runner-poles">';
    html += '<span class="nc-pole nc-pole--hope">' + esc(challenge.hopePole || '') + '</span>';
    html += '<span class="nc-pole-sep">&harr;</span>';
    html += '<span class="nc-pole nc-pole--toll">' + esc(challenge.tollPole || '') + '</span>';
    html += '</div></div>';

    var allRounds = challenge.rounds || [];
    var traversedRoundIds = choices.map(function (c) { return c.round_id; });

    var hasBranching = allRounds.some(function (r) {
      return (r.choices || []).some(function (c) { return !!c.nextRound; });
    });

    var visibleRounds;
    if (hasBranching) {
      if (choices.length > 0) {
        var lastChoice = choices[choices.length - 1];
        var lastRound = allRounds.find(function (r) { return r.id === lastChoice.round_id; });
        var lastChosen = lastRound ? (lastRound.choices || []).find(function (c) { return c.id === lastChoice.choice_id; }) : null;
        var nextRoundId = lastChosen && lastChosen.nextRound ? lastChosen.nextRound : null;

        visibleRounds = allRounds.filter(function (r) {
          return traversedRoundIds.indexOf(r.id) !== -1;
        });
        if (nextRoundId) {
          var nextRound = allRounds.find(function (r) { return r.id === nextRoundId; });
          if (nextRound && traversedRoundIds.indexOf(nextRound.id) === -1) {
            visibleRounds.push(nextRound);
          }
        }
      } else {
        visibleRounds = allRounds.length > 0 ? [allRounds[0]] : [];
      }
    } else {
      visibleRounds = allRounds;
    }

    visibleRounds.forEach(function (round, ri) {
      var existingChoice = choices.find(function (c) { return c.round_id === round.id; });
      html += '<div class="nc-round" data-round-id="' + esc(round.id) + '">';
      html += '<div class="nc-round-header">Round ' + (ri + 1) + '</div>';
      html += '<div class="nc-round-prompt">' + esc(round.prompt) + '</div>';
      if (round.narrativeContext) {
        html += '<div class="nc-round-context">' + esc(round.narrativeContext) + '</div>';
      }
      html += '<div class="nc-round-choices">';
      (round.choices || []).forEach(function (ch) {
        var selected = existingChoice && existingChoice.choice_id === ch.id;
        var alignClass = 'nc-choice--' + (ch.alignment || 'neutral').toLowerCase();
        html += '<div class="nc-choice ' + alignClass + (selected ? ' nc-choice--selected' : '') + '" data-round-id="' + esc(round.id) + '" data-choice-id="' + esc(ch.id) + '">';
        html += '<div class="nc-choice-label">' + esc(ch.label) + '</div>';
        html += '<span class="nc-choice-align">' + esc(ch.alignment || '') + '</span>';
        if (selected && ch.outcome) {
          html += '<div class="nc-choice-outcome" style="font-size:0.55rem;color:#94a3b8;margin-top:0.3rem;font-style:italic;">' + esc(ch.outcome.substring(0, 120)) + '...</div>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    });

    if (inst.status === 'active') {
      var autoScore = _calcAutoScore(challenge, choices);
      html += '<div class="nc-scoring-section">';
      html += '<label class="nc-label">Score (1–5)</label>';
      if (autoScore !== null) {
        html += '<div class="nc-auto-score-info" style="font-size:0.6rem;color:#94a3b8;margin-bottom:0.4rem;">Auto-calculated from choices: <strong style="color:#c8a44e;">' + autoScore + '/5</strong></div>';
      }
      html += '<div class="nc-score-row">';
      for (var s = 1; s <= 5; s++) {
        var scoreLabel = s === 1 ? 'Dark' : s === 5 ? 'Light' : '';
        var autoSelected = autoScore === s ? ' nc-score--selected' : '';
        html += '<button class="nc-score-btn' + autoSelected + '" data-score="' + s + '">' + s + (scoreLabel ? '<br><small>' + scoreLabel + '</small>' : '') + '</button>';
      }
      html += '</div>';
      html += '<button class="cb-header-btn accent nc-submit-score" id="nc-submit-score"' + (autoScore === null ? ' disabled' : '') + '>Submit Score</button>';
      html += '</div>';
    } else if (inst.status === 'scored') {
      html += '<div class="nc-scored-banner">Scored: ' + inst.gm_score + '/5 (shift ' + (inst.shift_value > 0 ? '+' : '') + inst.shift_value + ')</div>';
    }

    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('nc-runner-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.nc-choice').forEach(function (choiceEl) {
      choiceEl.addEventListener('click', function () {
        var roundId = choiceEl.dataset.roundId;
        var choiceId = choiceEl.dataset.choiceId;
        if (inst.status !== 'active') return;

        var roundContainer = choiceEl.closest('.nc-round');
        roundContainer.querySelectorAll('.nc-choice').forEach(function (c) { c.classList.remove('nc-choice--selected'); });
        choiceEl.classList.add('nc-choice--selected');

        fetch('/api/narrative-challenges/instances/' + inst.id + '/choice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round_id: roundId, choice_id: choiceId })
        }).then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); }).then(function (data) {
          choices = data.choices || choices;
        }).catch(function () { showToast('Failed to record choice'); });
      });
    });

    var selectedScore = _calcAutoScore(challenge, choices);
    overlay.querySelectorAll('.nc-score-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        overlay.querySelectorAll('.nc-score-btn').forEach(function (b) { b.classList.remove('nc-score--selected'); });
        btn.classList.add('nc-score--selected');
        selectedScore = parseInt(btn.dataset.score, 10);
        var submitBtn = document.getElementById('nc-submit-score');
        if (submitBtn) submitBtn.disabled = false;
      });
    });

    var submitBtn = document.getElementById('nc-submit-score');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (!selectedScore) return;
        fetch('/api/narrative-challenges/instances/' + inst.id + '/score', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gm_score: selectedScore })
        }).then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); }).then(function () {
          overlay.remove();
          loadChallengeStatus();
          showToast('Challenge scored: ' + selectedScore + '/5');
        }).catch(function () { showToast('Failed to submit score'); });
      });
    }
  }

  function resolveAllChallenges() {
    var scoredIds = _activeInstances.filter(function (i) { return i.status === 'scored'; }).map(function (i) { return i.id; });
    if (scoredIds.length === 0) return;

    fetch('/api/narrative-challenges/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_ids: scoredIds })
    }).then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); }).then(function (data) {
      showResolveResultModal(data);
    }).catch(function () { showToast('Failed to resolve challenges'); });
  }

  function showResolveResultModal(data) {
    var existing = document.getElementById('nc-resolve-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nc-resolve-overlay';
    overlay.className = 'cb-decision-modal-overlay';

    var html = '<div class="nc-resolve-modal">';
    html += '<div class="nc-resolve-header"><span>Challenge Resolution</span><button class="nc-resolve-close" id="nc-resolve-close">&times;</button></div>';
    html += '<div class="nc-resolve-body">';

    html += '<div class="nc-resolve-outcome nc-outcome--' + esc(data.tokenOutcome) + '">';
    html += '<div class="nc-outcome-label">' + esc(data.message) + '</div>';
    html += '<div class="nc-outcome-sum">Party Sum: ' + (data.partySum > 0 ? '+' : '') + data.partySum + '</div>';
    html += '</div>';

    html += '<div class="nc-resolve-results">';
    (data.results || []).forEach(function (r) {
      html += '<div class="nc-resolve-char">';
      html += '<span class="nc-resolve-name">' + esc(r.characterName) + '</span>';
      html += '<span class="nc-resolve-shift">';
      if (r.shifted) {
        html += esc(r.oldSpectrum) + ' &rarr; ' + esc(r.newSpectrum);
      } else {
        html += esc(r.oldSpectrum) + ' (held)';
      }
      html += '</span>';
      html += '<span class="nc-resolve-score">Score ' + r.gmScore + '/5</span>';
      html += '</div>';
    });
    html += '</div>';

    if (data.journalEntries && data.journalEntries.length > 0) {
      html += '<div class="nc-resolve-journal">';
      html += '<div class="nc-label" style="margin-bottom:0.3rem;">Journal Entries Created</div>';
      data.journalEntries.forEach(function (je) {
        html += '<div class="nc-resolve-journal-entry">' + esc(je.title) + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="nc-resolve-applied">';
    if (data.tokensUntapped !== undefined) html += '<div class="nc-resolve-applied-item">&#10003; ' + data.tokensUntapped + ' destiny token(s) untapped</div>';
    if (data.tokensApplied) html += '<div class="nc-resolve-applied-item">&#10003; Token refresh applied (' + data.tokenOutcome + ')</div>';
    if (data.journalEntries && data.journalEntries.length > 0) html += '<div class="nc-resolve-applied-item">&#10003; ' + data.journalEntries.length + ' journal entries logged</div>';
    html += '</div>';

    html += '<div class="nc-resolve-actions">';
    html += '<button class="cb-header-btn accent" id="nc-resolve-done">Done</button>';
    html += '</div>';

    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('nc-resolve-close').addEventListener('click', function () {
      overlay.remove();
      loadChallengeStatus();
      loadCrewJournal();
      if (socket) socket.emit('destiny:request-pool');
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.remove();
        loadChallengeStatus();
        loadCrewJournal();
        if (socket) socket.emit('destiny:request-pool');
      }
    });

    document.getElementById('nc-resolve-done').addEventListener('click', function () {
      overlay.remove();
      loadChallengeStatus();
      loadCrewJournal();
      if (socket) socket.emit('destiny:request-pool');
    });
  }

  function initConversationScenes() {
    var sel = document.getElementById('cb-conv-select');
    var launchBtn = document.getElementById('cb-conv-launch-btn');
    var openBtn = document.getElementById('cb-conv-open-btn');
    var status = document.getElementById('cb-conv-status');
    if (!sel || !launchBtn) return;

    function refreshStatus() {
      fetch('/api/conversations/active').then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.active && data.active.status === 'active') {
          var def = data.active.definition || {};
          status.innerHTML = '<span style="color:#4a90e2;">\u25CF Active:</span> ' +
            (def.title || data.active.slug) + ' \u2014 Beat ' + data.active.beat +
            ', Comfort ' + data.active.comfort;
        } else {
          status.textContent = 'No active conversation.';
        }
      }).catch(function () {});
    }

    function loadLibrary() {
      fetch('/api/conversations/library').then(function (r) { return r.json(); }).then(function (data) {
        sel.innerHTML = '';
        (data.conversations || []).forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c.slug;
          opt.textContent = c.title || c.slug;
          sel.appendChild(opt);
        });
        if (!sel.options.length) {
          var opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '(none available)';
          sel.appendChild(opt);
        }
      });
    }

    launchBtn.addEventListener('click', function () {
      var slug = sel.value;
      if (!slug) return;
      if (!confirm('Launch "' + sel.options[sel.selectedIndex].text + '"? This will end any active conversation.')) return;
      if (window.ConversationOverlay) {
        window.ConversationOverlay.launch(slug).then(function (data) {
          if (data && data.error) alert(data.error);
          refreshStatus();
        });
      }
    });

    openBtn.addEventListener('click', function () {
      if (window.ConversationOverlay) window.ConversationOverlay.open();
    });

    if (socket) {
      socket.on('conversation:start', refreshStatus);
      socket.on('conversation:beat-advanced', refreshStatus);
      socket.on('conversation:delivered', refreshStatus);
      socket.on('conversation:ended', refreshStatus);
    }

    loadLibrary();
    refreshStatus();
  }

  function initNarrativeChallenges() {
    var launchBtn = document.getElementById('cb-launch-challenge-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', function () { openChallengeLauncher(); });
    }
    loadChallengeStatus();

    if (socket) {
      socket.on('challenge:player-choice', function (data) {
        _handlePlayerChoiceUpdate(data);
      });
      socket.on('challenge:auto-resolved', function (data) {
        showToast(
          (data.characterName || 'Unknown') + ' challenge auto-resolved — Score ' +
          data.gmScore + '/5' + (data.shifted ? ' (' + data.oldSpectrum + ' → ' + data.newSpectrum + ')' : ' (held)')
        );
        loadChallengeStatus();
      });
    }
  }

  function _handlePlayerChoiceUpdate(data) {
    var statusEl = document.getElementById('cb-challenge-status');
    if (!statusEl) return;

    var inst = _activeInstances.find(function (i) { return i.id === data.instanceId; });
    if (inst) {
      try {
        var choices = JSON.parse(inst.choices || '[]');
        choices = choices.filter(function (c) { return c.round_id !== data.roundId; });
        choices.push({ round_id: data.roundId, choice_id: data.choiceId });
        inst.choices = JSON.stringify(choices);
      } catch (_) {}
    }

    var existingBadge = statusEl.querySelector('.nc-instance-row[data-inst-id="' + data.instanceId + '"] .nc-live-badge');
    var row = statusEl.querySelector('.nc-instance-row[data-inst-id="' + data.instanceId + '"]');
    if (row) {
      var oldBadge = row.querySelector('.nc-live-badge');
      if (oldBadge) oldBadge.remove();
      var badge = document.createElement('span');
      badge.className = 'nc-live-badge';
      badge.textContent = data.totalChoices + '/' + data.totalRounds + ' chosen';
      badge.style.cssText = 'font-size:0.55rem;color:var(--color-success,#22c55e);margin-left:auto;padding:0.1rem 0.3rem;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);';
      row.appendChild(badge);
    }

    var runnerOverlay = document.getElementById('nc-runner-overlay');
    if (runnerOverlay && runnerOverlay.dataset.instanceId === String(data.instanceId)) {
      var roundEl = runnerOverlay.querySelector('.nc-round[data-round-id="' + data.roundId + '"]');
      if (roundEl) {
        var choiceEl = roundEl.querySelector('.nc-choice[data-choice-id="' + data.choiceId + '"]');
        if (choiceEl) {
          roundEl.querySelectorAll('.nc-choice').forEach(function (c) {
            c.classList.remove('nc-choice--player-selected');
          });
          choiceEl.classList.add('nc-choice--player-selected');
          var existingPlayerTag = choiceEl.querySelector('.nc-player-pick-tag');
          if (!existingPlayerTag) {
            var tag = document.createElement('span');
            tag.className = 'nc-player-pick-tag';
            tag.textContent = data.characterName + ' chose this';
            tag.style.cssText = 'font-size:0.5rem;color:var(--color-success);display:block;margin-top:0.2rem;';
            choiceEl.appendChild(tag);
          }
        }
      }
    }
  }

  var _dpProfiles = [];
  var _dpExpanded = null;

  function initDramatisPersonae() {
    var btn = document.getElementById('cb-dramatis-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      openDramatisPanel();
    });
  }

  function openDramatisPanel() {
    var panelId = 'dramatis';
    var existing = document.getElementById('fp-' + panelId);
    if (existing) {
      existing.style.zIndex = ++_panelZCounter;
      return;
    }
    openFloatingPanel(panelId, 'Dramatis Personae', '<div class="dp-loading" style="padding:1rem;color:var(--color-text-secondary);font-style:italic;">Loading NPC profiles\u2026</div>', { width: 620, height: 560 });
    _loadDpProfiles();
  }

  function _loadDpProfiles() {
    fetch('/api/npc-profiles')
      .then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(function (data) {
        _dpProfiles = data.profiles || [];
        if (_dpExpanded) {
          return fetch('/api/npc-profiles/' + _dpExpanded)
            .then(function (r2) { if (!r2.ok) throw new Error('Failed'); return r2.json(); })
            .then(function (d2) {
              var prof = d2.profile;
              if (prof) {
                for (var i = 0; i < _dpProfiles.length; i++) {
                  if (_dpProfiles[i].npc_key === prof.npc_key) {
                    _dpProfiles[i] = prof;
                    break;
                  }
                }
              }
            });
        }
      })
      .then(function () { _renderDpPanel(); })
      .catch(function () {
        var body = document.querySelector('#fp-dramatis .cb-fpanel-body');
        if (body) body.innerHTML = '<div style="padding:1rem;color:var(--color-danger);">Failed to load profiles.</div>';
      });
  }

  function _renderDpPanel() {
    var body = document.querySelector('#fp-dramatis .cb-fpanel-body');
    if (!body) return;

    var html = '<div class="dp-toolbar">' +
      '<button class="dp-btn dp-btn--add" id="dp-add-npc">+ New NPC</button>' +
      '<button class="dp-btn dp-btn--push" id="dp-push-all">Push All to Players</button>' +
      '</div>' +
      '<div class="dp-roster" id="dp-roster">';

    if (_dpProfiles.length === 0) {
      html += '<div class="dp-empty">No NPC profiles yet. Click "+ New NPC" to create one.</div>';
    } else {
      _dpProfiles.forEach(function (p) {
        var statusColors = { allied: '#22c55e', neutral: '#eab308', hostile: '#ef4444', unknown: '#6b7280', deceased: '#9333ea' };
        var statusColor = statusColors[p.status] || '#6b7280';
        var isExpanded = _dpExpanded === p.npc_key;

        html += '<div class="dp-card' + (isExpanded ? ' dp-card--expanded' : '') + '" data-npc-key="' + esc(p.npc_key) + '">';
        html += '<div class="dp-card-header" data-dp-toggle="' + esc(p.npc_key) + '">';
        if (p.portrait_url) {
          html += '<img class="dp-portrait-thumb" src="' + esc(p.portrait_url) + '" alt="' + esc(p.name) + '" />';
        } else {
          html += '<div class="dp-portrait-placeholder">' + esc(p.name.charAt(0)) + '</div>';
        }
        html += '<div class="dp-card-info">';
        html += '<div class="dp-card-name">' + esc(p.name) + '</div>';
        html += '<div class="dp-card-sub">' + esc(p.species) + (p.role ? ' \u2014 ' + esc(p.role) : '') + '</div>';
        html += '</div>';
        html += '<span class="dp-status-badge" style="background:' + statusColor + ';">' + esc(p.status) + '</span>';
        html += '<span class="dp-reveal-indicator" style="color:' + (p.revealed ? '#22c55e' : '#6b7280') + ';">' + (p.revealed ? '\u25C9' : '\u25CB') + '</span>';
        html += '</div>';

        if (isExpanded) {
          html += '<div class="dp-card-detail">';
          html += '<div class="dp-detail-row"><label>Status</label>';
          html += '<select class="dp-select" data-dp-status="' + esc(p.npc_key) + '">';
          ['allied', 'neutral', 'hostile', 'unknown', 'deceased'].forEach(function (s) {
            html += '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
          });
          html += '</select></div>';

          html += '<div class="dp-detail-row"><label>Revealed to Players</label>';
          html += '<button class="dp-btn dp-btn--small" data-dp-reveal="' + esc(p.npc_key) + '">' + (p.revealed ? 'Hide from Players' : 'Reveal to Players') + '</button></div>';

          html += '<div class="dp-detail-row"><label>Player Bio</label>';
          html += '<textarea class="dp-textarea" data-dp-bio="' + esc(p.npc_key) + '" rows="4">' + esc(p.player_bio) + '</textarea></div>';

          html += '<div class="dp-detail-row"><label>GM Notes</label>';
          html += '<textarea class="dp-textarea dp-textarea--gm" data-dp-gmnotes="' + esc(p.npc_key) + '" rows="3">' + esc(p.gm_notes) + '</textarea></div>';

          html += '<div class="dp-detail-row"><label>Traits</label>';
          html += '<input class="dp-input" data-dp-traits="' + esc(p.npc_key) + '" value="' + esc((p.traits || []).join(', ')) + '" placeholder="Brave, Cunning, etc." /></div>';

          html += '<div class="dp-detail-row"><label>Connections</label>';
          html += '<textarea class="dp-textarea" data-dp-connections="' + esc(p.npc_key) + '" rows="2" placeholder="One per line">' + esc((p.connections || []).join('\n')) + '</textarea></div>';

          html += '<div class="dp-detail-row"><label>Portrait URL</label>';
          html += '<input class="dp-input" data-dp-portrait="' + esc(p.npc_key) + '" value="' + esc(p.portrait_url || '') + '" placeholder="/attached_assets/..." /></div>';

          html += '<div class="dp-timeline-section">';
          html += '<div class="dp-timeline-header"><label>Timeline</label>';
          html += '<button class="dp-btn dp-btn--small dp-btn--add" data-dp-add-timeline="' + esc(p.npc_key) + '">+ Entry</button></div>';
          var timeline = p.timeline || [];
          if (timeline.length === 0) {
            html += '<div class="dp-timeline-empty">No timeline entries yet.</div>';
          } else {
            timeline.forEach(function (tl) {
              html += '<div class="dp-timeline-entry" data-tl-id="' + tl.id + '">';
              html += '<div class="dp-timeline-entry-header">';
              html += '<span class="dp-timeline-ref">' + esc(tl.scene_ref || tl.adventure_ref || '') + '</span>';
              html += '<span class="dp-timeline-vis" style="color:' + (tl.revealed ? '#22c55e' : '#6b7280') + ';" title="' + (tl.revealed ? 'Visible to players' : 'Hidden from players') + '">' + (tl.revealed ? '\u25C9' : '\u25CB') + '</span>';
              html += '<button class="dp-btn dp-btn--small" data-dp-toggle-tl="' + tl.id + '" data-tl-revealed="' + (tl.revealed ? '1' : '0') + '">' + (tl.revealed ? 'Hide' : 'Show') + '</button>';
              html += '<button class="dp-btn dp-btn--small dp-btn--delete" data-dp-del-tl="' + tl.id + '">\u00D7</button>';
              html += '</div>';
              html += '<div class="dp-timeline-text">' + esc(tl.event_text) + '</div>';
              html += '</div>';
            });
          }
          html += '</div>';

          html += '<div class="dp-detail-actions">';
          html += '<button class="dp-btn dp-btn--save" data-dp-save="' + esc(p.npc_key) + '">Save Changes</button>';
          html += '<button class="dp-btn dp-btn--push-one" data-dp-push="' + esc(p.npc_key) + '">Push to Players</button>';
          html += '<button class="dp-btn dp-btn--delete" data-dp-delete="' + esc(p.npc_key) + '">Delete</button>';
          html += '</div>';

          html += '</div>';
        }
        html += '</div>';
      });
    }

    html += '</div>';
    body.innerHTML = html;
    _bindDpEvents(body);
  }

  function _bindDpEvents(body) {
    body.querySelectorAll('[data-dp-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.dataset.dpToggle;
        _dpExpanded = (_dpExpanded === key) ? null : key;
        _renderDpPanel();
      });
    });

    var addBtn = body.querySelector('#dp-add-npc');
    if (addBtn) addBtn.addEventListener('click', function () {
      var name = prompt('NPC Name:');
      if (!name || !name.trim()) return;
      var key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      fetch('/api/npc-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc_key: key, name: name.trim() })
      })
      .then(function (r) { return r.json(); })
      .then(function () { _loadDpProfiles(); });
    });

    var pushAllBtn = body.querySelector('#dp-push-all');
    if (pushAllBtn) pushAllBtn.addEventListener('click', function () {
      fetch('/api/npc-profiles/push-all', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) { _showNpcToast('Pushed ' + (d.pushed || 0) + ' profiles to players'); });
    });

    body.querySelectorAll('[data-dp-status]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var key = sel.dataset.dpStatus;
        fetch('/api/npc-profiles/' + key + '/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: sel.value })
        }).then(function () { _loadDpProfiles(); });
      });
    });

    body.querySelectorAll('[data-dp-reveal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpReveal;
        var profile = _dpProfiles.find(function (p) { return p.npc_key === key; });
        if (!profile) return;
        fetch('/api/npc-profiles/' + key + '/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revealed: !profile.revealed })
        }).then(function () {
          _showNpcToast(profile.revealed ? 'Hidden: ' + profile.name : 'Revealed: ' + profile.name);
          _loadDpProfiles();
        });
      });
    });

    body.querySelectorAll('[data-dp-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpSave;
        var card = body.querySelector('.dp-card[data-npc-key="' + key + '"]');
        if (!card) return;

        var bioEl = card.querySelector('[data-dp-bio="' + key + '"]');
        var gmNotesEl = card.querySelector('[data-dp-gmnotes="' + key + '"]');
        var traitsEl = card.querySelector('[data-dp-traits="' + key + '"]');
        var connectionsEl = card.querySelector('[data-dp-connections="' + key + '"]');
        var portraitEl = card.querySelector('[data-dp-portrait="' + key + '"]');

        var updateData = {};
        if (bioEl) updateData.player_bio = bioEl.value;
        if (gmNotesEl) updateData.gm_notes = gmNotesEl.value;
        if (traitsEl) updateData.traits = traitsEl.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        if (connectionsEl) updateData.connections = connectionsEl.value.split('\n').map(function (c) { return c.trim(); }).filter(Boolean);
        if (portraitEl) updateData.portrait_url = portraitEl.value || null;

        fetch('/api/npc-profiles/' + key, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }).then(function () {
          _showNpcToast('Saved: ' + key);
          _loadDpProfiles();
        });
      });
    });

    body.querySelectorAll('[data-dp-push]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpPush;
        if (socket) socket.emit('npc:push-update', { npc_key: key });
        _showNpcToast('Pushed update: ' + key);
      });
    });

    body.querySelectorAll('[data-dp-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.dpDelete;
        if (!confirm('Delete NPC profile "' + key + '"? This cannot be undone.')) return;
        fetch('/api/npc-profiles/' + key, { method: 'DELETE' })
          .then(function () {
            _dpExpanded = null;
            _loadDpProfiles();
          });
      });
    });

    body.querySelectorAll('[data-dp-add-timeline]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.dataset.dpAddTimeline;
        var eventText = prompt('Timeline event text:');
        if (!eventText || !eventText.trim()) return;
        var sceneRef = prompt('Scene reference (e.g. Adv1-P2-S3):', '') || '';
        fetch('/api/npc-profiles/' + key + '/timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_text: eventText.trim(), scene_ref: sceneRef.trim(), revealed: true })
        })
        .then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
        .then(function () { _loadDpProfiles(); })
        .catch(function () { _showNpcToast('Failed to add timeline entry'); });
      });
    });

    body.querySelectorAll('[data-dp-toggle-tl]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.dpToggleTl;
        var currentlyRevealed = btn.dataset.tlRevealed === '1';
        fetch('/api/npc-timeline/' + id + '/reveal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revealed: !currentlyRevealed })
        })
        .then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
        .then(function () { _loadDpProfiles(); })
        .catch(function () { _showNpcToast('Failed to toggle timeline visibility'); });
      });
    });

    body.querySelectorAll('[data-dp-del-tl]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.dpDelTl;
        if (!confirm('Delete this timeline entry?')) return;
        fetch('/api/npc-timeline/' + id, { method: 'DELETE' })
          .then(function (r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
          .then(function () { _loadDpProfiles(); })
          .catch(function () { _showNpcToast('Failed to delete timeline entry'); });
      });
    });
  }

  function _showNpcToast(msg) {
    var toast = document.getElementById('npc-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(function () { toast.classList.remove('active'); }, 2500);
  }

  initDragHandles();
  initCollapsiblePanels();
  initSockets();
  initCampaign();
  loadGlossary();
  loadItemRequests();
  loadCrewJournal();
  initDecisionTracker();
  initNarrativeChallenges();
  initConversationScenes();
  initDramatisPersonae();

  var galaxyMapBtn = document.getElementById('cb-galaxy-map-btn');
  if (galaxyMapBtn) {
    galaxyMapBtn.addEventListener('click', function () {
      if (window.GalaxyMap) window.GalaxyMap.open();
    });
  }

  var _tmPendingKey = null;
  var _tmMapListReady = false;

  function openTacticalMapToKey(key) {
    _tmPendingKey = key;
    var btn = document.getElementById('cb-tactical-map-btn');
    if (btn) btn.click();
    if (_tmMapListReady) _tmApplyPendingKey();
  }

  function _tmApplyPendingKey() {
    if (!_tmPendingKey) return;
    var selectEl = document.getElementById('gm-tm-select');
    if (selectEl) {
      selectEl.value = _tmPendingKey;
      selectEl.dispatchEvent(new Event('change'));
    }
    _tmPendingKey = null;
  }

  (function initTacticalMapPanel() {
    var btn = document.getElementById('cb-tactical-map-btn');
    if (!btn || !socket) return;

    var panel = null;
    var viewer = null;
    var currentMapKey = '';
    var mapList = [];
    var _drag = { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };
    var _resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 };

    function open() {
      if (panel) { panel.style.display = 'flex'; return; }
      panel = document.createElement('div');
      panel.id = 'gm-tactical-panel';
      panel.className = 'tm-floating-panel tm-floating-panel--gm';
      panel.innerHTML =
        '<div class="tm-panel-header" id="gm-tm-drag">' +
          '<span class="tm-panel-title">Tactical Map</span>' +
          '<span class="tm-panel-map-name" id="gm-tm-map-name"></span>' +
          '<button class="tm-panel-close" id="gm-tm-close">&times;</button>' +
        '</div>' +
        '<div class="tm-gm-controls">' +
          '<select class="tm-gm-select" id="gm-tm-select"><option value="">— Select Map —</option></select>' +
          '<button class="tm-gm-btn tm-gm-btn--broadcast" id="gm-tm-broadcast">Broadcast</button>' +
          '<button class="tm-gm-btn tm-gm-btn--dismiss" id="gm-tm-dismiss">Dismiss</button>' +
        '</div>' +
        '<div class="tm-panel-body" id="gm-tm-body"><div class="tm-empty-state">Select a map above</div></div>' +
        '<div class="tm-resize-handle" id="gm-tm-resize"></div>';
      document.body.appendChild(panel);

      var selectEl = panel.querySelector('#gm-tm-select');
      fetch('/api/maps/list')
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load map list');
          return r.json();
        })
        .then(function (data) {
          mapList = data.maps || [];
          mapList.forEach(function (m) {
            var opt = document.createElement('option');
            opt.value = m.key;
            opt.textContent = m.title;
            selectEl.appendChild(opt);
          });
          _tmMapListReady = true;
          _tmApplyPendingKey();
        })
        .catch(function (err) {
          console.error('[command-bridge] Map list load error:', err);
          var opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '— Error loading maps —';
          selectEl.appendChild(opt);
        });

      selectEl.addEventListener('change', function () {
        var key = selectEl.value;
        if (!key) return;
        currentMapKey = key;
        loadMapInPanel(key);
      });

      panel.querySelector('#gm-tm-close').addEventListener('click', function () {
        panel.style.display = 'none';
      });

      panel.querySelector('#gm-tm-broadcast').addEventListener('click', function () {
        if (!currentMapKey) return;
        socket.emit('map:broadcast', { mapKey: currentMapKey });
      });

      panel.querySelector('#gm-tm-dismiss').addEventListener('click', function () {
        socket.emit('map:dismiss');
      });

      var dragHandle = panel.querySelector('#gm-tm-drag');
      dragHandle.addEventListener('mousedown', function (e) {
        if (e.target.id === 'gm-tm-close') return;
        _drag.active = true;
        _drag.startX = e.clientX;
        _drag.startY = e.clientY;
        _drag.origLeft = panel.offsetLeft;
        _drag.origTop = panel.offsetTop;
        e.preventDefault();
      });

      var resizeHandle = panel.querySelector('#gm-tm-resize');
      resizeHandle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _resize.active = true;
        _resize.startX = e.clientX;
        _resize.startY = e.clientY;
        _resize.startW = panel.offsetWidth;
        _resize.startH = panel.offsetHeight;
      });

      socket.on('map:broadcast-ack', function (data) {
        _showNpcToast('Map broadcast: ' + (data.mapKey || ''));
      });

      socket.on('map:pin-added', function (data) {
        if (viewer && data.pin) viewer.handlePinAdded(data.pin);
      });
      socket.on('map:pin-updated', function (data) {
        if (viewer && data.pin) viewer.handlePinUpdated(data.pin);
      });
      socket.on('map:pin-removed', function (data) {
        if (viewer) viewer.handlePinRemoved(data.id);
      });
      socket.on('map:pins-sync', function (data) {
        if (viewer && data.mapKey === currentMapKey) viewer.handlePinsSync(data.pins);
      });
    }

    function loadMapInPanel(key) {
      var body = panel.querySelector('#gm-tm-body');
      body.innerHTML = '';
      var mapNameEl = panel.querySelector('#gm-tm-map-name');
      var entry = mapList.find(function (m) { return m.key === key; });
      if (mapNameEl) mapNameEl.textContent = entry ? entry.title : key;

      viewer = new window.TacticalMapViewer({
        container: body,
        role: 'gm',
        socket: socket
      });
      viewer.loadMap(key);
    }

    btn.addEventListener('click', open);

    document.addEventListener('mousemove', function (e) {
      if (_drag.active && panel) {
        panel.style.left = (_drag.origLeft + e.clientX - _drag.startX) + 'px';
        panel.style.top = (_drag.origTop + e.clientY - _drag.startY) + 'px';
        panel.style.right = 'auto';
      }
      if (_resize.active && panel) {
        panel.style.width = Math.max(400, _resize.startW + e.clientX - _resize.startX) + 'px';
        panel.style.height = Math.max(300, _resize.startH + e.clientY - _resize.startY) + 'px';
      }
    });
    document.addEventListener('mouseup', function () {
      _drag.active = false;
      _resize.active = false;
    });
  })();

  (function initFullJournal() {
    var btn = document.getElementById('cb-open-full-journal');
    if (!btn) return;

    var overlay = document.createElement('div');
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;align-items:center;justify-content:center;';
    var dialog = document.createElement('div');
    dialog.style.cssText = 'background:#0e0e0e;border:1px solid rgba(200,164,78,0.4);border-radius:8px;width:min(900px,92vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    dialog.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(200,164,78,0.25);">' +
        '<div><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#c8a44e;">Full Crew Journal</div>' +
        '<div style="font-size:10px;opacity:0.6;margin-top:2px;">All entries — crew &amp; private — across every character.</div></div>' +
        '<button id="fj-close" style="background:transparent;border:1px solid rgba(200,164,78,0.4);color:#c8a44e;padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px;">Close</button>' +
      '</div>' +
      '<div style="padding:10px 18px;display:flex;gap:8px;align-items:center;border-bottom:1px solid rgba(200,164,78,0.15);">' +
        '<input id="fj-search" type="text" placeholder="filter by author / title / body" style="flex:1;background:#1a1a1a;border:1px solid rgba(200,164,78,0.3);color:#e6dcc4;padding:6px 10px;border-radius:4px;font-size:12px;">' +
        '<span id="fj-count" style="font-size:11px;opacity:0.6;"></span>' +
      '</div>' +
      '<div id="fj-list" style="flex:1;overflow-y:auto;padding:10px 18px;"></div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var searchEl = dialog.querySelector('#fj-search');
    var listEl = dialog.querySelector('#fj-list');
    var countEl = dialog.querySelector('#fj-count');
    var _entries = [];
    var _editing = {};

    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function fmtDate(d) {
      try { var dt = new Date(d); return dt.toLocaleString(); } catch (e) { return ''; }
    }
    function visBadge(v) {
      if (!v || v === 'crew') return '<span style="background:rgba(120,180,140,0.18);color:#9ad7a8;padding:1px 7px;border-radius:8px;font-size:10px;letter-spacing:0.5px;">CREW</span>';
      return '<span style="background:rgba(200,140,120,0.18);color:#e6a48a;padding:1px 7px;border-radius:8px;font-size:10px;letter-spacing:0.5px;">PRIVATE · ' + escHtml(v) + '</span>';
    }

    function render() {
      var q = (searchEl.value || '').toLowerCase().trim();
      var filtered = !q ? _entries : _entries.filter(function (e) {
        return (e.title && e.title.toLowerCase().indexOf(q) >= 0) ||
               (e.body && e.body.toLowerCase().indexOf(q) >= 0) ||
               (e.author_character_name && e.author_character_name.toLowerCase().indexOf(q) >= 0);
      });
      countEl.textContent = filtered.length + ' / ' + _entries.length + ' entries';
      if (!filtered.length) {
        listEl.innerHTML = '<div style="text-align:center;opacity:0.5;padding:30px;font-size:12px;">No entries.</div>';
        return;
      }
      var html = filtered.map(function (e) {
        var tags = (e.tags || []).map(function (t) {
          return '<span style="background:rgba(200,164,78,0.12);color:#c8a44e;padding:1px 6px;border-radius:8px;font-size:10px;margin-right:4px;">' + escHtml(t.name) + '</span>';
        }).join('');
        if (_editing[e.id]) {
          return '<div data-entry-id="' + e.id + '" style="border:1px solid rgba(200,164,78,0.5);border-radius:6px;padding:12px;margin-bottom:10px;background:#141414;">' +
            '<input data-field="title" value="' + escHtml(e.title) + '" style="width:100%;background:#1a1a1a;border:1px solid rgba(200,164,78,0.3);color:#e6dcc4;padding:6px 10px;border-radius:4px;font-size:13px;margin-bottom:8px;">' +
            '<textarea data-field="body" style="width:100%;min-height:140px;background:#1a1a1a;border:1px solid rgba(200,164,78,0.3);color:#e6dcc4;padding:8px 10px;border-radius:4px;font-size:12px;font-family:inherit;line-height:1.5;">' + escHtml(e.body) + '</textarea>' +
            '<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">' +
              '<button data-act="cancel" style="background:transparent;border:1px solid rgba(200,200,200,0.3);color:#aaa;padding:4px 12px;font-size:11px;cursor:pointer;border-radius:4px;">Cancel</button>' +
              '<button data-act="save" style="background:#c8a44e;border:none;color:#1a1a1a;padding:4px 14px;font-size:11px;cursor:pointer;border-radius:4px;font-weight:600;">Save</button>' +
            '</div>' +
          '</div>';
        }
        var bodyPreview = (e.body || '').replace(/\n/g, '<br>');
        return '<div data-entry-id="' + e.id + '" style="border:1px solid rgba(200,164,78,0.18);border-radius:6px;padding:12px;margin-bottom:10px;background:#141414;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
            '<div style="font-size:13px;color:#e6dcc4;font-weight:600;">' + escHtml(e.title) + '</div>' +
            visBadge(e.visibility) +
          '</div>' +
          '<div style="font-size:10px;opacity:0.55;margin-bottom:8px;">' + escHtml(e.author_character_name || '?') + ' · ' + fmtDate(e.created_at) + (e.updated_at && e.updated_at !== e.created_at ? ' · edited ' + fmtDate(e.updated_at) : '') + '</div>' +
          (tags ? '<div style="margin-bottom:8px;">' + tags + '</div>' : '') +
          '<div style="font-size:12px;color:#c9bfa6;line-height:1.5;white-space:pre-wrap;max-height:200px;overflow-y:auto;">' + escHtml(e.body || '').replace(/\n/g,'<br>') + '</div>' +
          '<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">' +
            '<button data-act="edit" style="background:transparent;border:1px solid rgba(200,164,78,0.3);color:#c8a44e;padding:3px 10px;font-size:10px;cursor:pointer;border-radius:4px;text-transform:uppercase;letter-spacing:1px;">Edit</button>' +
            '<button data-act="delete" style="background:transparent;border:1px solid rgba(220,140,140,0.4);color:#e6a48a;padding:3px 10px;font-size:10px;cursor:pointer;border-radius:4px;text-transform:uppercase;letter-spacing:1px;">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');
      listEl.innerHTML = html;
    }

    listEl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      var card = btn.closest('[data-entry-id]');
      if (!card) return;
      var id = parseInt(card.dataset.entryId, 10);
      var act = btn.dataset.act;
      if (act === 'edit') {
        _editing[id] = true; render();
      } else if (act === 'cancel') {
        delete _editing[id]; render();
      } else if (act === 'save') {
        var title = card.querySelector('[data-field="title"]').value.trim();
        var body = card.querySelector('[data-field="body"]').value;
        if (!title) { alert('Title cannot be empty.'); return; }
        fetch('/api/journal/entries/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, body: body })
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j.entry) {
              for (var i = 0; i < _entries.length; i++) {
                if (_entries[i].id === id) { _entries[i] = Object.assign(_entries[i], j.entry); break; }
              }
            }
            delete _editing[id]; render();
          })
          .catch(function () { alert('Save failed.'); });
      } else if (act === 'delete') {
        if (!confirm('Delete this journal entry permanently?')) return;
        fetch('/api/journal/entries/' + id, { method: 'DELETE' })
          .then(function () {
            _entries = _entries.filter(function (e) { return e.id !== id; });
            render();
          })
          .catch(function () { alert('Delete failed.'); });
      }
    });

    searchEl.addEventListener('input', render);

    function load() {
      listEl.innerHTML = '<div style="text-align:center;opacity:0.5;padding:30px;font-size:12px;">Loading…</div>';
      fetch('/api/journal/entries')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          _entries = j.entries || [];
          _editing = {};
          render();
        })
        .catch(function () {
          listEl.innerHTML = '<div style="text-align:center;color:#e6a48a;padding:30px;font-size:12px;">Failed to load.</div>';
        });
    }

    btn.addEventListener('click', function () {
      overlay.style.display = 'flex';
      load();
    });
    dialog.querySelector('#fj-close').addEventListener('click', function () { overlay.style.display = 'none'; });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });
  })();

  (function initOrbitalStrike() {
    var logo = document.querySelector('.cb-header-logo');
    if (!logo) return;

    var CATEGORIES = [
      { key: 'journal',   icon: '\u{1F4D3}', label: 'Purge Journal Entries',        confirmTitle: 'Purge the Archives',        confirmMsg: 'Every journal entry, every tag, every record — gone. The campaign log will be wiped clean as if no one ever wrote it.' },
      { key: 'holonet',   icon: '\u{1F4E1}', label: 'Purge HoloNet Broadcasts',     confirmTitle: 'Silence the HoloNet',       confirmMsg: 'All broadcast records will be erased. The galaxy goes dark.' },
      { key: 'decisions', icon: '\u2696',     label: 'Purge Decision Points',        confirmTitle: 'Rewrite History',           confirmMsg: 'Every decision the crew ever made — undone. The fork points vanish from the timeline.' },
      { key: 'progress',  icon: '\u{1F5FA}',  label: 'Reset Scene Progress',         confirmTitle: 'Reset the Campaign Clock',  confirmMsg: 'Scene completion marks and campaign progress will reset to the beginning.' },
      { key: 'npcs',      icon: '\u{1F464}',  label: 'Reset NPC Profiles & Timeline', confirmTitle: 'Memory Wipe — NPC Cortex', confirmMsg: 'All NPC profiles and timeline events will be wiped and re-seeded from factory defaults.' },
      { key: 'items',     icon: '\u{1F4E6}',  label: 'Purge Items & Equipment',      confirmTitle: 'Jettison the Cargo',        confirmMsg: 'All item requests and equipment status records will be jettisoned into the void.' },
      { key: 'protocol_pins', icon: '\u{1F916}', label: 'Purge Protocol Droid Pins', confirmTitle: 'Wipe the Droid\'s Pins',  confirmMsg: 'Every player-pinned answer the Protocol Droid has stored will be deleted.' }
    ];

    var overlay = document.createElement('div');
    overlay.className = 'os-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'os-dialog';

    var header = document.createElement('div');
    header.className = 'os-header';
    var title = document.createElement('span');
    title.className = 'os-title';
    title.textContent = 'Orbital Strike Console';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'os-close';
    closeBtn.innerHTML = '&#x2715;';
    header.appendChild(title);
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    var warning = document.createElement('div');
    warning.className = 'os-warning';
    warning.textContent = 'These operations permanently destroy campaign data. There is no undo.';
    dialog.appendChild(warning);

    var body = document.createElement('div');
    body.className = 'os-body';

    CATEGORIES.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className = 'os-btn';
      var icon = document.createElement('span');
      icon.className = 'os-btn-icon';
      icon.textContent = cat.icon;
      var lbl = document.createElement('span');
      lbl.className = 'os-btn-label';
      lbl.textContent = cat.label;
      btn.appendChild(icon);
      btn.appendChild(lbl);
      btn.addEventListener('click', function () { showOsConfirm(cat); });
      body.appendChild(btn);
    });

    var sep = document.createElement('div');
    sep.className = 'os-sep';
    body.appendChild(sep);

    var fullBtn = document.createElement('button');
    fullBtn.className = 'os-btn os-btn-full';
    var fullIcon = document.createElement('span');
    fullIcon.className = 'os-btn-icon';
    fullIcon.textContent = '\u{1F4A5}';
    var fullLbl = document.createElement('span');
    fullLbl.className = 'os-btn-label';
    fullLbl.textContent = 'Full Campaign Reset';
    fullBtn.appendChild(fullIcon);
    fullBtn.appendChild(fullLbl);
    fullBtn.addEventListener('click', function () {
      showOsConfirm({
        key: 'full',
        confirmTitle: 'Base Delta Zero',
        confirmMsg: 'Full orbital bombardment. Every journal, broadcast, decision, NPC, pin, progress marker, and item record will be annihilated. Only character sheets survive. NPC profiles will be re-seeded from factory templates.'
      });
    });
    body.appendChild(fullBtn);

    // --- Protocol Droid kill switch ---
    var sep2 = document.createElement('div');
    sep2.className = 'os-sep';
    body.appendChild(sep2);

    var droidRow = document.createElement('div');
    droidRow.className = 'os-toggle-row';
    droidRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid rgba(200,164,78,0.25);border-radius:6px;margin-top:4px;';
    var droidLbl = document.createElement('div');
    droidLbl.style.cssText = 'display:flex;align-items:center;gap:10px;';
    droidLbl.innerHTML = '<span style="font-size:18px;">\u{1F916}</span><span><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#c8a44e;">Protocol Droid</div><div style="font-size:11px;opacity:0.7;" id="os-droid-state">Loading…</div></span>';
    var droidBtn = document.createElement('button');
    droidBtn.id = 'os-droid-toggle';
    droidBtn.className = 'os-btn';
    droidBtn.style.cssText = 'min-width:120px;padding:8px 14px;font-size:11px;';
    droidBtn.textContent = '…';
    droidRow.appendChild(droidLbl);
    droidRow.appendChild(droidBtn);
    body.appendChild(droidRow);

    function refreshDroidState() {
      fetch('/api/protocol-droid/admin/state')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var stateEl = document.getElementById('os-droid-state');
          if (j.disabled) {
            droidBtn.textContent = 'Re-enable';
            if (stateEl) stateEl.textContent = 'OFFLINE — players see "droid is offline." (' + (j.totalPins || 0) + ' pins stored)';
            droidBtn.style.background = '#5a3a3a';
            droidBtn.style.color = '#ffb3b3';
          } else {
            droidBtn.textContent = 'Disable';
            if (stateEl) stateEl.textContent = 'Online. ' + (j.totalPins || 0) + ' pins stored across all players.';
            droidBtn.style.background = '';
            droidBtn.style.color = '';
          }
        })
        .catch(function () {
          var stateEl = document.getElementById('os-droid-state');
          if (stateEl) stateEl.textContent = 'Unable to read state.';
        });
    }
    droidBtn.addEventListener('click', function () {
      var goingOff = (droidBtn.textContent === 'Disable');
      fetch('/api/protocol-droid/admin/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: goingOff })
      })
        .then(function () { refreshDroidState(); })
        .catch(function () { refreshDroidState(); });
    });

    var status = document.createElement('div');
    status.className = 'os-status';
    body.appendChild(status);

    dialog.appendChild(body);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function openOs() { overlay.classList.add('os-visible'); status.textContent = ''; status.className = 'os-status'; refreshDroidState(); }
    function closeOs() { overlay.classList.remove('os-visible'); }

    logo.addEventListener('click', openOs);
    closeBtn.addEventListener('click', closeOs);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOs(); });

    function showOsConfirm(cat) {
      var cOverlay = document.createElement('div');
      cOverlay.className = 'os-confirm-overlay';

      var cDialog = document.createElement('div');
      cDialog.className = 'os-confirm-dialog';

      var cIcon = document.createElement('div');
      cIcon.className = 'os-confirm-icon';
      cIcon.textContent = cat.key === 'full' ? '\u{1F4A5}' : '\u26A0\uFE0F';

      var cTitle = document.createElement('div');
      cTitle.className = 'os-confirm-title';
      cTitle.textContent = cat.confirmTitle;

      var cMsg = document.createElement('div');
      cMsg.className = 'os-confirm-msg';
      cMsg.textContent = cat.confirmMsg;

      var cBtns = document.createElement('div');
      cBtns.className = 'os-confirm-btns';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'os-confirm-cancel';
      cancelBtn.textContent = 'Abort';
      cancelBtn.addEventListener('click', function () { cOverlay.remove(); });

      var execBtn = document.createElement('button');
      execBtn.className = 'os-confirm-exec';
      execBtn.textContent = 'Execute';
      execBtn.addEventListener('click', function () {
        cOverlay.remove();
        executeWipe(cat.key);
      });

      cBtns.appendChild(cancelBtn);
      cBtns.appendChild(execBtn);
      cDialog.appendChild(cIcon);
      cDialog.appendChild(cTitle);
      cDialog.appendChild(cMsg);
      cDialog.appendChild(cBtns);
      cOverlay.appendChild(cDialog);
      document.body.appendChild(cOverlay);

      cOverlay.addEventListener('click', function (e) { if (e.target === cOverlay) cOverlay.remove(); });
    }

    function executeWipe(categoryKey) {
      status.textContent = 'Executing orbital strike...';
      status.className = 'os-status';
      fetch('/api/admin/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: categoryKey })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            status.textContent = 'Target destroyed: ' + (data.label || categoryKey);
            status.className = 'os-status';
          } else {
            status.textContent = 'Strike failed: ' + (data.error || 'unknown error');
            status.className = 'os-status os-status-error';
          }
        })
        .catch(function () {
          status.textContent = 'Comms failure — strike could not be confirmed.';
          status.className = 'os-status os-status-error';
        });
    }
  })();
}());

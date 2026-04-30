(function () {
  'use strict';

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _formatRule(str) {
    var s = _esc(str);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n\n/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');
    return '<p>' + s + '</p>';
  }

  var ARENA_LABELS = {
    physique: 'Physique',
    reflex:   'Reflex',
    grit:     'Grit',
    wits:     'Wits',
    presence: 'Presence',
  };

  function _discLabel(id) {
    return (id || '')
      .replace('_spark', ' (The Spark)')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];

  function _dieIndex(d) {
    return DIE_ORDER.indexOf((d || '').toUpperCase());
  }

  function buildDetailsPanel(char, speciesData, maneuversData) {
    var panel = document.getElementById('panel-1');
    if (!panel) return;
    panel.innerHTML = '';

    var outer = document.createElement('div');
    outer.className = 'dp-wrap';

    outer.appendChild(_buildIdentity(char));
    outer.appendChild(_buildAbilities(char));
    if (maneuversData) {
      var techSection = _buildDisciplineTechniques(char, maneuversData);
      if (techSection) outer.appendChild(techSection);
    }
    outer.appendChild(_buildLanguages(char));
    outer.appendChild(_buildSpeciesTraits(char, speciesData));
    outer.appendChild(_buildKitProgression(char));

    var pdSection = _buildPersonalDestiny(char);
    if (pdSection) outer.appendChild(pdSection);

    panel.appendChild(outer);
  }

  function _buildIdentity(char) {
    var el = document.createElement('div');
    el.className = 'dp-identity';
    el.innerHTML =
      '<span class="dp-identity-name">' + _esc(char.name || 'Unknown') + '</span>' +
      '<span class="dp-identity-meta">' + _esc(char.species || '') + ' \u2014 ' + _esc(char.archetype || '') + '</span>';
    return el;
  }

  var ABILITY_TYPE_ORDER = ['passive', 'gambit', 'maneuver', 'exploit', 'permission'];
  var ABILITY_TYPE_LABELS = {
    passive: 'PASSIVE',
    gambit: 'GAMBIT',
    maneuver: 'MANEUVER',
    exploit: 'EXPLOIT',
    permission: 'PERMISSION',
  };

  function _buildAbilities(char) {
    var kits = char.kits || [];
    var buckets = {};
    ABILITY_TYPE_ORDER.forEach(function (t) { buckets[t] = []; });

    kits.forEach(function (kit) {
      var tier = kit.tier || 0;
      (kit.abilities || []).forEach(function (ab) {
        if (ab.tier > tier) return;
        var entry = {
          name: ab.name,
          rule: ab.rule,
          tier: ab.tier,
          type: ab.type || 'passive',
          kitName: kit.name,
          actionBonus: ab.actionBonus || null,
          cost: ab.cost || null,
          buyoff: ab.buyoff || null,
          arenaTag: ab.arenaTag || null,
          actionType: ab.actionType || null,
          target: ab.target || null,
          tags: ab.tags || null,
          effect: ab.effect || null,
          risk: ab.risk || null,
          discipline: ab.discipline || null,
          arena: ab.arena || null,
          defense: ab.defense || null,
          gambits: ab.gambits || null,
        };
        var bucket = buckets[entry.type] || buckets['passive'];
        bucket.push(entry);
      });
    });

    var allAbilities = [];
    ABILITY_TYPE_ORDER.forEach(function (t) {
      allAbilities = allAbilities.concat(buckets[t]);
    });

    var wrap = document.createElement('div');
    wrap.className = 'dp-abilities-section';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Vocation Abilities</span>' +
      '<span class="dp-section-bar-count">' + allAbilities.length + ' unlocked</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    if (allAbilities.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'dp-empty-msg';
      empty.textContent = 'No abilities unlocked yet.';
      wrap.appendChild(empty);
      return wrap;
    }

    allAbilities.forEach(function (ab) {
      wrap.appendChild(_abilityCard(ab, ab.type));
    });

    return wrap;
  }

  function _abilityCard(ab, type) {
    var card = document.createElement('div');
    card.className = 'dp-ability-card dp-ability-card--' + type;

    var topRow = document.createElement('div');
    topRow.className = 'dp-ability-card-top';

    var badge = document.createElement('span');
    badge.className = 'dp-ability-badge dp-ability-badge--' + type;
    badge.textContent = ABILITY_TYPE_LABELS[type] || type.toUpperCase();
    topRow.appendChild(badge);

    var name = document.createElement('span');
    name.className = 'dp-ability-card-name';
    name.textContent = ab.name;
    topRow.appendChild(name);

    var source = document.createElement('span');
    source.className = 'dp-ability-card-source';
    source.textContent = ab.kitName;
    topRow.appendChild(source);

    card.appendChild(topRow);

    var tags = [];
    if (ab.tags && ab.tags.length) { tags = tags.concat(ab.tags); }
    if (ab.actionType) tags.push(ab.actionType);
    if (ab.target) tags.push(ab.target);
    if (type === 'maneuver' && ab.discipline) {
      tags.push(_discLabel(ab.discipline) + ' (' + (ARENA_LABELS[ab.arena] || ab.arena || '') + ')');
      if (ab.defense) tags.push('vs ' + _discLabel(ab.defense));
    }
    if (tags.length) {
      var tagRow = document.createElement('div');
      tagRow.className = 'dp-ability-card-tags';
      tags.forEach(function (t) {
        var tag = document.createElement('span');
        tag.className = 'dp-ability-card-tag';
        tag.textContent = t;
        tagRow.appendChild(tag);
      });
      card.appendChild(tagRow);
    }

    var rule = document.createElement('div');
    rule.className = 'dp-ability-card-rule';
    rule.innerHTML = _formatRule(ab.rule);
    card.appendChild(rule);

    if (ab.risk) {
      var riskEl = document.createElement('div');
      riskEl.className = 'dp-ability-card-risk';
      riskEl.innerHTML = '<strong>Risk:</strong> ' + _esc(ab.risk);
      card.appendChild(riskEl);
    }

    if (ab.effect && ab.effect.length) {
      var effectWrap = document.createElement('div');
      effectWrap.className = 'dp-ability-effect-track';
      ab.effect.forEach(function (eff) {
        var row = document.createElement('div');
        row.className = 'dp-ability-effect-row';
        row.innerHTML =
          '<span class="dp-effect-label">' + _esc(eff.label) + '</span>' +
          '<span class="dp-effect-range">' + _esc(eff.range) + '</span>' +
          '<span class="dp-effect-desc">' + _esc(eff.description) + '</span>';
        effectWrap.appendChild(row);
      });
      card.appendChild(effectWrap);
    }

    if (ab.gambits && ab.gambits.length) {
      ab.gambits.forEach(function (g) {
        var gWrap = document.createElement('div');
        gWrap.className = 'dp-ability-card dp-ability-card--gambit';
        gWrap.style.marginTop = '0.35rem';
        var gTop = document.createElement('div');
        gTop.className = 'dp-ability-card-top';
        var gBadge = document.createElement('span');
        gBadge.className = 'dp-ability-badge dp-ability-badge--gambit';
        gBadge.textContent = 'GAMBIT';
        gTop.appendChild(gBadge);
        var gName = document.createElement('span');
        gName.className = 'dp-ability-card-name';
        gName.textContent = g.name;
        gTop.appendChild(gName);
        gWrap.appendChild(gTop);
        var gRule = document.createElement('div');
        gRule.className = 'dp-ability-card-rule';
        gRule.innerHTML = _formatRule(g.rule);
        gWrap.appendChild(gRule);
        card.appendChild(gWrap);
      });
    }

    var extras = [];
    if (ab.actionBonus) {
      var parts = [];
      if (ab.actionBonus.trigger) parts.push('+' + ab.actionBonus.trigger + ' Exploit');
      if (ab.actionBonus.action) parts.push('+' + ab.actionBonus.action + ' Action');
      if (ab.actionBonus.maneuver) parts.push('+' + ab.actionBonus.maneuver + ' Maneuver');
      if (parts.length) extras.push(parts.join(' \u00b7 '));
    }
    if (ab.cost) extras.push('Cost: ' + ab.cost);
    if (ab.buyoff) extras.push('Buyoff: ' + ab.buyoff);

    if (extras.length) {
      var extrasEl = document.createElement('div');
      extrasEl.className = 'dp-ability-card-extras';
      extrasEl.textContent = extras.join(' \u2014 ');
      card.appendChild(extrasEl);
    }

    return card;
  }

  function _getCharDisciplineDie(char, disciplineId) {
    var arenas = char.arenas || [];
    for (var i = 0; i < arenas.length; i++) {
      var discs = arenas[i].disciplines || [];
      for (var j = 0; j < discs.length; j++) {
        if (discs[j].id === disciplineId) return discs[j].die;
      }
    }
    return null;
  }

  var ACTION_LABELS = {
    action_assess: 'Assess',
    action_treat_injury: 'Treat Injury',
    action_interact: 'Interact',
    action_attack: 'Attack',
    action_move: 'Move',
    action_coordinate: 'Coordinate',
    action_command_beast: 'Command Beast',
  };

  function _classifyMode(tags) {
    var hasNarr = false;
    var hasCombat = false;
    var hasModeTag = false;
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (t.indexOf('Both') !== -1) { hasNarr = true; hasCombat = true; hasModeTag = true; }
      else if (t.indexOf('Narrative') !== -1) { hasNarr = true; hasModeTag = true; }
      else if (t.indexOf('Combat') !== -1) { hasCombat = true; hasModeTag = true; }
    }
    if (!hasModeTag) hasCombat = true;
    return { narrative: hasNarr, combat: hasCombat };
  }

  function _buildDisciplineTechniques(char, maneuversData) {
    var gambitsData = maneuversData.disciplineGambits;
    if (!gambitsData) return null;

    var unlocked = [];
    var discKeys = Object.keys(gambitsData);

    for (var k = 0; k < discKeys.length; k++) {
      var disc = gambitsData[discKeys[k]];
      if (disc.placeholder) continue;

      var charDie = _getCharDisciplineDie(char, disc.disciplineId);
      if (!charDie) continue;
      var charIdx = _dieIndex(charDie);

      var gambits = disc.gambits || [];
      for (var g = 0; g < gambits.length; g++) {
        var gambit = gambits[g];
        var reqIdx = _dieIndex(gambit.requiredDie);
        if (reqIdx === -1 || charIdx < reqIdx) continue;

        var modes = _classifyMode(gambit.tags || []);

        unlocked.push({
          name: gambit.name,
          rule: gambit.rule,
          requiredDie: gambit.requiredDie,
          disciplineName: disc.name,
          arenaId: disc.arenaId,
          tags: gambit.tags || [],
          modifiesAction: gambit.modifiesAction,
          duration: gambit.duration,
          isNarrative: modes.narrative,
          isCombat: modes.combat,
        });
      }
    }

    if (unlocked.length === 0) return null;

    unlocked.sort(function (a, b) {
      if (a.disciplineName !== b.disciplineName)
        return a.disciplineName < b.disciplineName ? -1 : 1;
      return _dieIndex(a.requiredDie) - _dieIndex(b.requiredDie);
    });

    var wrap = document.createElement('div');
    wrap.className = 'dp-techniques-section dp-section--closed';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Discipline Techniques</span>' +
      '<span class="dp-section-bar-count">' + unlocked.length + ' unlocked</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    var body = document.createElement('div');
    body.className = 'dp-techniques-body';

    var filterState = { narrative: true, combat: true };

    var filterBar = document.createElement('div');
    filterBar.className = 'dp-tech-filter-bar';

    var narrPill = document.createElement('button');
    narrPill.className = 'dp-tech-pill dp-tech-pill--active';
    narrPill.setAttribute('data-mode', 'narrative');
    narrPill.textContent = 'Narrative';

    var combatPill = document.createElement('button');
    combatPill.className = 'dp-tech-pill dp-tech-pill--active';
    combatPill.setAttribute('data-mode', 'combat');
    combatPill.textContent = 'Combat';

    filterBar.appendChild(narrPill);
    filterBar.appendChild(combatPill);
    body.appendChild(filterBar);

    var cardContainer = document.createElement('div');
    cardContainer.className = 'dp-tech-cards';

    var cardEls = [];
    unlocked.forEach(function (tech) {
      var card = _techniqueCard(tech);
      card.setAttribute('data-narr', tech.isNarrative ? '1' : '0');
      card.setAttribute('data-combat', tech.isCombat ? '1' : '0');
      cardEls.push(card);
      cardContainer.appendChild(card);
    });

    body.appendChild(cardContainer);

    function applyFilter() {
      var visibleCount = 0;
      cardEls.forEach(function (el) {
        var show = false;
        if (filterState.narrative && el.getAttribute('data-narr') === '1') show = true;
        if (filterState.combat && el.getAttribute('data-combat') === '1') show = true;
        el.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      narrPill.className = 'dp-tech-pill' + (filterState.narrative ? ' dp-tech-pill--active' : '');
      combatPill.className = 'dp-tech-pill' + (filterState.combat ? ' dp-tech-pill--active' : '');
    }

    narrPill.addEventListener('click', function () {
      filterState.narrative = !filterState.narrative;
      if (!filterState.narrative && !filterState.combat) filterState.combat = true;
      applyFilter();
    });

    combatPill.addEventListener('click', function () {
      filterState.combat = !filterState.combat;
      if (!filterState.narrative && !filterState.combat) filterState.narrative = true;
      applyFilter();
    });

    applyFilter();

    wrap.appendChild(body);
    return wrap;
  }

  function _techniqueCard(tech) {
    var card = document.createElement('div');
    card.className = 'dp-ability-card dp-ability-card--technique';

    var topRow = document.createElement('div');
    topRow.className = 'dp-ability-card-top';

    var badge = document.createElement('span');
    badge.className = 'dp-ability-badge dp-ability-badge--technique';
    badge.textContent = 'TECHNIQUE';
    topRow.appendChild(badge);

    var name = document.createElement('span');
    name.className = 'dp-ability-card-name';
    name.textContent = tech.name;
    topRow.appendChild(name);

    var source = document.createElement('span');
    source.className = 'dp-ability-card-source';
    source.textContent = tech.disciplineName;
    topRow.appendChild(source);

    card.appendChild(topRow);

    var tagRow = document.createElement('div');
    tagRow.className = 'dp-ability-card-tags';

    var dieTag = document.createElement('span');
    dieTag.className = 'dp-ability-card-tag dp-tag--die';
    dieTag.textContent = tech.requiredDie;
    tagRow.appendChild(dieTag);

    if (tech.modifiesAction) {
      var actionLabel = ACTION_LABELS[tech.modifiesAction] || tech.modifiesAction;
      var actionTag = document.createElement('span');
      actionTag.className = 'dp-ability-card-tag';
      actionTag.textContent = actionLabel;
      tagRow.appendChild(actionTag);
    }

    tech.tags.forEach(function (t) {
      var modeTag = document.createElement('span');
      modeTag.className = 'dp-ability-card-tag dp-tag--mode';
      modeTag.textContent = t;
      tagRow.appendChild(modeTag);
    });

    if (tech.duration) {
      var durTag = document.createElement('span');
      durTag.className = 'dp-ability-card-tag dp-tag--duration';
      durTag.textContent = tech.duration;
      tagRow.appendChild(durTag);
    }

    card.appendChild(tagRow);

    var rule = document.createElement('div');
    rule.className = 'dp-ability-card-rule';
    rule.textContent = tech.rule;
    card.appendChild(rule);

    return card;
  }

  var SOURCE_LABELS = { species: 'Species', background: 'Background', history: 'History' };

  function _saveLanguages(charId, langs) {
    var userLangs = langs.filter(function (l) { return l.source !== 'species'; }).map(function (l) {
      return { id: l.id, name: l.name, source: l.source, note: l.note || '', narrative: l.narrative || '', createdAt: l.createdAt || Date.now() };
    });
    return fetch('/api/characters/' + charId + '/languages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languages: userLangs }),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Save failed');
        return j;
      });
    });
  }

  function _reloadDetails() {
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem('eote-session')); } catch (_) {}
    var charId = session && session.characterId;
    if (!charId) return;
    Promise.all([
      fetch('/api/characters/' + charId).then(function (r) { return r.json(); }),
      fetch('/data/species.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/data/maneuvers.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
    ]).then(function (results) {
      buildDetailsPanel(results[0], results[1], results[2]);
    });
  }

  function _buildLanguages(char) {
    var langs = Array.isArray(char.languages) ? char.languages : [];
    var charId = char.id;

    var wrap = document.createElement('div');
    wrap.className = 'dp-languages-section';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Languages</span>' +
      '<span class="dp-section-bar-count">' + langs.length + ' known</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    var body = document.createElement('div');
    body.className = 'dp-languages-body';

    langs.forEach(function (lang) {
      body.appendChild(_languageCard(lang, charId, langs));
    });

    var addBtn = document.createElement('button');
    addBtn.className = 'dp-lang-add-btn';
    addBtn.type = 'button';
    addBtn.textContent = '+ Add Language';
    addBtn.addEventListener('click', function () {
      _openAddLanguageDialog(charId, langs);
    });
    body.appendChild(addBtn);

    wrap.appendChild(body);
    return wrap;
  }

  function _languageCard(lang, charId, allLangs) {
    var card = document.createElement('div');
    card.className = 'dp-lang-card dp-lang-card--' + lang.source;

    var top = document.createElement('div');
    top.className = 'dp-lang-card-top';

    var badge = document.createElement('span');
    badge.className = 'dp-lang-badge dp-lang-badge--' + lang.source;
    badge.textContent = SOURCE_LABELS[lang.source] || lang.source;
    top.appendChild(badge);

    var name = document.createElement('span');
    name.className = 'dp-lang-name';
    name.textContent = lang.name;
    top.appendChild(name);

    if (!lang.locked) {
      var actions = document.createElement('span');
      actions.className = 'dp-lang-actions';

      var editBtn = document.createElement('button');
      editBtn.className = 'dp-lang-act-btn';
      editBtn.type = 'button';
      editBtn.title = 'Edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        _openEditLanguageDialog(charId, allLangs, lang);
      });
      actions.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'dp-lang-act-btn dp-lang-act-btn--del';
      delBtn.type = 'button';
      delBtn.title = 'Remove';
      delBtn.textContent = '\u2715';
      delBtn.addEventListener('click', function () {
        if (!confirm('Remove "' + lang.name + '"? This does not refund Edge.')) return;
        var next = allLangs.filter(function (l) { return l.id !== lang.id; });
        _saveLanguages(charId, next).then(_reloadDetails).catch(function (err) {
          alert('Failed to remove language: ' + err.message);
        });
      });
      actions.appendChild(delBtn);

      top.appendChild(actions);
    }

    card.appendChild(top);

    var detail = '';
    if (lang.source === 'background' && lang.note) {
      detail = lang.note;
    } else if (lang.source === 'history' && lang.narrative) {
      detail = lang.narrative;
    }
    if (detail) {
      var det = document.createElement('div');
      det.className = 'dp-lang-detail';
      det.textContent = detail;
      card.appendChild(det);
    } else if (lang.source === 'history') {
      var empty = document.createElement('div');
      empty.className = 'dp-lang-detail dp-lang-detail--empty';
      empty.textContent = 'Narrative not yet written.';
      card.appendChild(empty);
    }

    return card;
  }

  function _closeDialog() {
    var existing = document.querySelector('.dp-lang-dialog-backdrop');
    if (existing) existing.parentNode.removeChild(existing);
  }

  function _buildDialogShell(title) {
    _closeDialog();
    var backdrop = document.createElement('div');
    backdrop.className = 'dp-lang-dialog-backdrop';
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) _closeDialog();
    });
    var dialog = document.createElement('div');
    dialog.className = 'dp-lang-dialog';
    var h = document.createElement('div');
    h.className = 'dp-lang-dialog-title';
    h.textContent = title;
    dialog.appendChild(h);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    return dialog;
  }

  function _openAddLanguageDialog(charId, allLangs) {
    var dialog = _buildDialogShell('Add Language');

    var prompt = document.createElement('div');
    prompt.className = 'dp-lang-dialog-text';
    prompt.textContent = 'Where did this language come from?';
    dialog.appendChild(prompt);

    var btnRow = document.createElement('div');
    btnRow.className = 'dp-lang-dialog-btnrow';

    var bgBtn = document.createElement('button');
    bgBtn.type = 'button';
    bgBtn.className = 'dp-lang-source-btn';
    bgBtn.innerHTML = '<span class="dp-lang-source-btn-name">Background</span>' +
      '<span class="dp-lang-source-btn-desc">GM hand-wave. Just name it.</span>';
    bgBtn.addEventListener('click', function () {
      _openEditLanguageDialog(charId, allLangs, { source: 'background' });
    });
    btnRow.appendChild(bgBtn);

    var hisBtn = document.createElement('button');
    hisBtn.type = 'button';
    hisBtn.className = 'dp-lang-source-btn';
    hisBtn.innerHTML = '<span class="dp-lang-source-btn-name">History</span>' +
      '<span class="dp-lang-source-btn-desc">Burn 1 Edge. Mid-scene narrative.</span>';
    hisBtn.addEventListener('click', function () {
      _openEditLanguageDialog(charId, allLangs, { source: 'history' });
    });
    btnRow.appendChild(hisBtn);

    dialog.appendChild(btnRow);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dp-lang-dialog-cancel';
    closeBtn.textContent = 'Cancel';
    closeBtn.addEventListener('click', _closeDialog);
    dialog.appendChild(closeBtn);
  }

  function _openEditLanguageDialog(charId, allLangs, existing) {
    var isNew = !existing.id;
    var source = existing.source || 'background';
    var dialog = _buildDialogShell(isNew ? 'New ' + SOURCE_LABELS[source] + ' Language' : 'Edit Language');

    var nameLbl = document.createElement('label');
    nameLbl.className = 'dp-lang-field-label';
    nameLbl.textContent = 'Language name';
    dialog.appendChild(nameLbl);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'dp-lang-field-input';
    nameInput.maxLength = 80;
    nameInput.value = existing.name || '';
    nameInput.placeholder = 'e.g. Huttese, Shyriiwook, Bocce...';
    dialog.appendChild(nameInput);

    var srcLbl = document.createElement('label');
    srcLbl.className = 'dp-lang-field-label';
    srcLbl.textContent = 'Source';
    dialog.appendChild(srcLbl);

    var srcRow = document.createElement('div');
    srcRow.className = 'dp-lang-source-pills';
    var srcOptions = [
      { id: 'background', label: 'Background' },
      { id: 'history',    label: 'History' },
    ];
    var currentSource = source;
    var pillEls = {};
    srcOptions.forEach(function (opt) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'dp-lang-source-pill' + (opt.id === currentSource ? ' dp-lang-source-pill--active' : '');
      pill.textContent = opt.label;
      pill.addEventListener('click', function () {
        currentSource = opt.id;
        Object.keys(pillEls).forEach(function (k) {
          pillEls[k].className = 'dp-lang-source-pill' + (k === currentSource ? ' dp-lang-source-pill--active' : '');
        });
        renderSourceFields();
      });
      pillEls[opt.id] = pill;
      srcRow.appendChild(pill);
    });
    dialog.appendChild(srcRow);

    var fieldsWrap = document.createElement('div');
    fieldsWrap.className = 'dp-lang-source-fields';
    dialog.appendChild(fieldsWrap);

    var noteInput, narrativeInput, edgeInfo;
    var edgeAvail = (window.CharacterPanel && window.CharacterPanel.getEngineCurrent) ? window.CharacterPanel.getEngineCurrent() : 0;
    var alreadyBurned = !isNew && existing.source === 'history';

    function renderSourceFields() {
      fieldsWrap.innerHTML = '';
      if (currentSource === 'background') {
        var nLbl = document.createElement('label');
        nLbl.className = 'dp-lang-field-label';
        nLbl.textContent = 'GM note (optional)';
        fieldsWrap.appendChild(nLbl);
        noteInput = document.createElement('textarea');
        noteInput.className = 'dp-lang-field-textarea';
        noteInput.rows = 2;
        noteInput.maxLength = 500;
        noteInput.value = existing.note || '';
        noteInput.placeholder = 'Optional context — e.g. "Spent two cycles in a Hutt slave camp."';
        fieldsWrap.appendChild(noteInput);
      } else {
        var hLbl = document.createElement('label');
        hLbl.className = 'dp-lang-field-label';
        hLbl.textContent = 'Narrative (where, who, what it cost)';
        fieldsWrap.appendChild(hLbl);
        var hint = document.createElement('div');
        hint.className = 'dp-lang-field-hint';
        hint.textContent = 'Required for the burn — must reference a faction, location, or person in the Western Reaches. You can save now and refine the prose later.';
        fieldsWrap.appendChild(hint);
        narrativeInput = document.createElement('textarea');
        narrativeInput.className = 'dp-lang-field-textarea';
        narrativeInput.rows = 5;
        narrativeInput.maxLength = 2000;
        narrativeInput.value = existing.narrative || '';
        narrativeInput.placeholder = 'When and where did you pick this up? Who taught you, or what did you survive?';
        fieldsWrap.appendChild(narrativeInput);

        edgeInfo = document.createElement('div');
        edgeInfo.className = 'dp-lang-edge-info';
        if (alreadyBurned) {
          edgeInfo.textContent = 'Edge was already burned for this entry. Saving will not burn additional Edge.';
        } else {
          edgeInfo.innerHTML = 'Saving will burn <strong>1 Edge</strong>. Current Edge: <strong>' + edgeAvail + '</strong>.';
          if (edgeAvail < 1) {
            edgeInfo.className += ' dp-lang-edge-info--blocked';
            edgeInfo.innerHTML += '<br><span class="dp-lang-edge-block">No Edge available — cannot burn a History entry right now.</span>';
          }
        }
        fieldsWrap.appendChild(edgeInfo);
      }
    }
    renderSourceFields();

    var errEl = document.createElement('div');
    errEl.className = 'dp-lang-dialog-err';
    dialog.appendChild(errEl);

    var btnRow = document.createElement('div');
    btnRow.className = 'dp-lang-dialog-btnrow dp-lang-dialog-btnrow--end';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'dp-lang-dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', _closeDialog);
    btnRow.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'dp-lang-dialog-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      errEl.textContent = '';
      var name = nameInput.value.trim();
      if (!name) { errEl.textContent = 'Language name is required.'; return; }
      var willBurn = currentSource === 'history' && !alreadyBurned;
      if (currentSource === 'history' && (!narrativeInput || !narrativeInput.value.trim())) {
        errEl.textContent = 'History entries require a narrative — the GM needs something to pull on later.';
        return;
      }
      if (willBurn) {
        var cur = (window.CharacterPanel && window.CharacterPanel.getEngineCurrent) ? window.CharacterPanel.getEngineCurrent() : 0;
        if (cur < 1) { errEl.textContent = 'No Edge available — cannot burn a History entry.'; return; }
      }

      var entry = {
        id: existing.id || ('lang_' + Math.random().toString(36).slice(2, 10)),
        name: name,
        source: currentSource,
        note: currentSource === 'background' && noteInput ? noteInput.value.trim() : '',
        narrative: currentSource === 'history' && narrativeInput ? narrativeInput.value.trim() : '',
        createdAt: existing.createdAt || Date.now(),
      };

      var next = allLangs.filter(function (l) { return l.source !== 'species' && l.id !== entry.id; });
      next.push(entry);

      saveBtn.disabled = true;
      _saveLanguages(charId, next).then(function () {
        if (willBurn && window.CharacterPanel && window.CharacterPanel.spendEngine) {
          window.CharacterPanel.spendEngine(1);
        }
        _closeDialog();
        _reloadDetails();
      }).catch(function (err) {
        saveBtn.disabled = false;
        errEl.textContent = 'Save failed: ' + err.message;
      });
    });
    btnRow.appendChild(saveBtn);

    dialog.appendChild(btnRow);

    setTimeout(function () { nameInput.focus(); }, 30);
  }

  function _buildSpeciesTraits(char, speciesData) {
    var sp = null;
    if (speciesData) {
      var sName = (char.species || '').toLowerCase();
      sp = speciesData.find(function (s) {
        return s.id === sName || s.name.toLowerCase() === sName;
      });
    }

    var wrap = document.createElement('div');
    wrap.className = 'dp-traits-section';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Species Traits</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    if (!sp) {
      var missing = document.createElement('div');
      missing.className = 'dp-empty-msg';
      missing.textContent = 'No species data available.';
      wrap.appendChild(missing);
      return wrap;
    }

    var body = document.createElement('div');
    body.className = 'dp-traits-body';

    var rawTraits = [
      { label: 'Arena Shift', data: sp.arenaShift },
      { label: 'Biological Truth', data: sp.biologicalTruth },
      { label: 'Species Trait', data: sp.speciesTrait },
    ];
    var traits = rawTraits.filter(function (t) { return t.data && t.data.name; }).map(function (t) {
      return { label: t.label, name: t.data.name, desc: t.data.desc || '' };
    });

    traits.forEach(function (t) {
      var trait = document.createElement('div');
      trait.className = 'dp-trait-card';

      var traitLabel = document.createElement('div');
      traitLabel.className = 'dp-trait-label';
      traitLabel.textContent = t.label;
      trait.appendChild(traitLabel);

      var traitName = document.createElement('div');
      traitName.className = 'dp-trait-name';
      traitName.textContent = t.name;
      trait.appendChild(traitName);

      var traitDesc = document.createElement('div');
      traitDesc.className = 'dp-trait-desc';
      traitDesc.textContent = t.desc;
      trait.appendChild(traitDesc);

      body.appendChild(trait);
    });

    wrap.appendChild(body);
    return wrap;
  }

  function _buildKitProgression(char) {
    var kits = char.kits || [];
    if (kits.length === 0) return document.createDocumentFragment();

    var wrap = document.createElement('div');
    wrap.className = 'dp-progression-section dp-section--closed';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Vocation Progression</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    var body = document.createElement('div');
    body.className = 'dp-progression-body';

    kits.forEach(function (kit) {
      var card = document.createElement('div');
      card.className = 'dp-prog-card';

      var cardHead = document.createElement('div');
      cardHead.className = 'dp-prog-card-head';

      var kitName = document.createElement('span');
      kitName.className = 'dp-prog-card-name';
      kitName.textContent = kit.name;
      cardHead.appendChild(kitName);

      var metaTags = [];
      if (kit.governingArena) metaTags.push(ARENA_LABELS[kit.governingArena] || kit.governingArena);
      if (kit.favoredDiscipline) metaTags.push(_discLabel(kit.favoredDiscipline) + ' (Favored)');

      if (metaTags.length) {
        var meta = document.createElement('span');
        meta.className = 'dp-prog-card-meta';
        meta.textContent = metaTags.join(' \u00b7 ');
        cardHead.appendChild(meta);
      }

      card.appendChild(cardHead);

      if (kit.description) {
        var descEl = document.createElement('div');
        descEl.className = 'dp-prog-card-desc';
        descEl.textContent = kit.description;
        card.appendChild(descEl);
      }

      var tierBar = document.createElement('div');
      tierBar.className = 'dp-prog-tier-bar';
      for (var t = 1; t <= 5; t++) {
        var pip = document.createElement('div');
        pip.className = 'dp-prog-tier-pip' + (t <= kit.tier ? ' dp-prog-tier-pip--active' : '');
        pip.textContent = 'T' + t;
        tierBar.appendChild(pip);
      }
      card.appendChild(tierBar);

      var locked = (kit.abilities || []).filter(function (a) { return a.tier > kit.tier; });
      if (locked.length > 0) {
        var lockedWrap = document.createElement('div');
        lockedWrap.className = 'dp-prog-locked';
        locked.forEach(function (ab) {
          var row = document.createElement('div');
          row.className = 'dp-prog-locked-row';
          row.innerHTML =
            '<span class="dp-prog-locked-tier">T' + ab.tier + '</span>' +
            '<span class="dp-prog-locked-name">' + _esc(ab.name) + '</span>' +
            '<span class="dp-prog-locked-type">' + _esc(ab.type) + '</span>';
          lockedWrap.appendChild(row);
        });
        card.appendChild(lockedWrap);
      }

      body.appendChild(card);
    });

    wrap.appendChild(body);
    return wrap;
  }

  // Threshold for destiny track-full (number of destiny-tagged earned marks).
  var DESTINY_TRACK_THRESHOLD = 5;

  // Returns { matchCount, displayCount, threshold, trackFull, used, baseline }
  // matchCount = total destiny-tagged earned marks (cumulative, never reset).
  // baseline = snapshot taken at last spend; displayCount = matchCount - baseline (the "active" track).
  // trackFull is computed from displayCount so the track resets to 0 on spend without erasing earned marks.
  function _computeDestinyTrackState(char, pd) {
    var ctx = {
      matchCount: 0,
      displayCount: 0,
      threshold: DESTINY_TRACK_THRESHOLD,
      trackFull: false,
      used: !!(char.advancement && char.advancement.destinyCapacityUsed),
      baseline: (char.advancement && Number(char.advancement.destinyTrackBaseline)) || 0
    };
    var pcDest = pd && pd.id;
    var checks = (char.advancement && char.advancement.marks && char.advancement.marks.earnedChecks) || {};
    var paths = (char.advancement && char.advancement.marks && char.advancement.marks.paths) || {};
    var advs = char._adventuresForCapacity || [];
    if (!pcDest) { return ctx; }
    advs.forEach(function (adv) {
      var marks = adv && adv.marks;
      if (!Array.isArray(marks)) return;
      marks.forEach(function (m) {
        var mid = m && m.id;
        if (!mid || !checks[mid]) return;
        var matched = false;
        if (Array.isArray(m.destinies) && m.destinies.indexOf(pcDest) !== -1) matched = true;
        if (!matched && Array.isArray(m.paths)) {
          var chosenId = paths[mid];
          if (chosenId) {
            var chosen = m.paths.find(function (p) { return p.id === chosenId; });
            if (chosen && Array.isArray(chosen.destinies) && chosen.destinies.indexOf(pcDest) !== -1) matched = true;
          }
        }
        if (matched) ctx.matchCount += 1;
      });
    });
    ctx.displayCount = Math.max(0, ctx.matchCount - ctx.baseline);
    ctx.trackFull = ctx.displayCount >= ctx.threshold && !ctx.used;
    return ctx;
  }

  function _buildPersonalDestiny(char) {
    var pd = char.personalDestiny;
    if (!pd) return null;

    var wrap = document.createElement('div');
    wrap.className = 'dp-narrative-section dp-section--closed';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Personal Destiny</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    var body = document.createElement('div');
    body.className = 'dp-destiny-body';

    var capacityHtml = '';
    var capacityCtx = null;
    if (pd.trackFullCapacity && pd.trackFullCapacity.title) {
      capacityCtx = _computeDestinyTrackState(char, pd);
      var used = capacityCtx.used;
      var trackFull = capacityCtx.trackFull;
      var btnLabel, btnAttrs;
      if (used) { btnLabel = 'Spent — Once Per Campaign'; btnAttrs = 'disabled aria-disabled="true"'; }
      else if (!trackFull) { btnLabel = 'Track Not Yet Full'; btnAttrs = 'disabled aria-disabled="true"'; }
      else { btnLabel = 'Spend Capacity'; btnAttrs = ''; }
      var meterHtml =
        '<span class="dp-destiny-mech-desc dp-destiny-mech-meter">' +
          '<b>Track:</b> ' + capacityCtx.displayCount + ' / ' + capacityCtx.threshold + ' destiny footprints earned' +
          (trackFull && !used ? ' <span class="dp-destiny-mech-meter-full">— FULL</span>' : '') +
          (used ? ' <span class="dp-destiny-mech-meter-spent">— SPENT</span>' : '') +
        '</span>';
      capacityHtml =
        '<div class="dp-destiny-mech dp-destiny-mech--capacity' + (used ? ' dp-destiny-mech--spent' : '') + '">' +
          '<span class="dp-destiny-mech-badge dp-destiny-mech-badge--capacity">Track Full</span>' +
          '<span class="dp-destiny-mech-title">' + _esc(pd.trackFullCapacity.title) + '</span>' +
          '<span class="dp-destiny-mech-desc">' + _esc(pd.trackFullCapacity.description) + '</span>' +
          (pd.trackFullCapacity.trigger ? '<span class="dp-destiny-mech-desc dp-destiny-mech-trigger"><b>Trigger:</b> ' + _esc(pd.trackFullCapacity.trigger) + '</span>' : '') +
          meterHtml +
          '<button type="button" class="dp-destiny-capacity-btn" data-spend-capacity="1" ' + btnAttrs + '>' + btnLabel + '</button>' +
        '</div>';
    }

    body.innerHTML =
      '<div class="dp-destiny-name">' + _esc(pd.name) + '</div>' +
      '<div class="dp-destiny-tagline">' + _esc(pd.tagline) + '</div>' +
      '<div class="dp-destiny-question">' + _esc(pd.coreQuestion) + '</div>' +
      '<div class="dp-destiny-mechs">' +
        '<div class="dp-destiny-mech">' +
          '<span class="dp-destiny-mech-badge dp-destiny-mech-badge--hope">Hope</span>' +
          '<span class="dp-destiny-mech-title">' + _esc(pd.hopeRecovery.title) + '</span>' +
          '<span class="dp-destiny-mech-desc">' + _esc(pd.hopeRecovery.description) + '</span>' +
        '</div>' +
        '<div class="dp-destiny-mech">' +
          '<span class="dp-destiny-mech-badge dp-destiny-mech-badge--toll">Toll</span>' +
          '<span class="dp-destiny-mech-title">' + _esc(pd.tollRecovery.title) + '</span>' +
          '<span class="dp-destiny-mech-desc">' + _esc(pd.tollRecovery.description) + '</span>' +
        '</div>' +
        '<div class="dp-destiny-mech">' +
          '<span class="dp-destiny-mech-badge dp-destiny-mech-badge--advance">Advance</span>' +
          '<span class="dp-destiny-mech-desc">' + _esc(pd.advanceTrigger) + '</span>' +
        '</div>' +
        capacityHtml +
      '</div>';

    wrap.appendChild(body);

    var btn = body.querySelector('[data-spend-capacity]');
    if (btn && capacityCtx) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        if (!capacityCtx.trackFull) return;
        if (capacityCtx.used) return;
        var capTitle = (pd.trackFullCapacity && pd.trackFullCapacity.title) || 'this capacity';
        var msg = 'Spend ' + capTitle + ' now?\n\n' +
          'This is a once-per-campaign action. On confirm:\n' +
          '  • The capacity is permanently spent\n' +
          '  • The destiny track resets to empty (your earned marks are preserved as campaign history; the active track counter restarts at 0)\n' +
          '  • This cannot be undone\n\n' +
          'GM and table should be at the table when you confirm.';
        if (!window.confirm(msg)) return;

        var session = null;
        try { session = JSON.parse(sessionStorage.getItem('eote-session')); } catch (_) {}
        var charId = session && session.characterId;
        if (!charId) return;

        // Build the next advancement state: snapshot the cumulative match count as the new
        // baseline (active track resets to 0) AND set the consumed flag. Earned marks are
        // preserved — this is purely a derived-display reset, not a destructive mutation.
        var nextAdv = Object.assign({}, char.advancement || {});
        nextAdv.destinyCapacityUsed = true;
        nextAdv.destinyTrackBaseline = capacityCtx.matchCount;

        btn.disabled = true;
        btn.textContent = 'Saving…';
        console.info('[DetailsPanel] destiny capacity spent', { charId: charId, destiny: pd.id, capacity: capTitle, baseline: capacityCtx.matchCount });
        fetch('/api/characters/' + encodeURIComponent(charId) + '/advancement', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextAdv)
        }).then(function (r) {
          if (!r.ok) throw new Error('save failed');
          char.advancement = nextAdv;
          btn.textContent = 'Spent — Once Per Campaign';
          btn.setAttribute('aria-disabled', 'true');
          var mech = btn.closest('.dp-destiny-mech');
          if (mech) mech.classList.add('dp-destiny-mech--spent');
          var meter = mech && mech.querySelector('.dp-destiny-mech-meter');
          if (meter) meter.innerHTML = '<b>Track:</b> 0 / ' + capacityCtx.threshold + ' destiny footprints earned <span class="dp-destiny-mech-meter-spent">— SPENT</span>';
        }).catch(function (err) {
          console.error('[DetailsPanel] capacity spend save failed', err);
          btn.disabled = false;
          btn.textContent = 'Spend Capacity';
          window.alert('Could not save. Please try again.');
        });
      });
    }

    return wrap;
  }

  function init() {
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem('eote-session')); } catch (_) {}
    var charId = session && session.characterId;
    if (!charId) {
      console.error('[DetailsPanel] No character session.');
      return;
    }

    Promise.all([
      fetch('/api/characters/' + charId).then(function (r) { return r.json(); }),
      fetch('/data/species.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/data/maneuvers.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/data/destinies.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/api/campaign/adventures').then(function (r) { return r.json(); }).catch(function () { return null; }),
    ]).then(function (results) {
      var char = results[0];
      var destinyData = results[3];
      var adventuresData = results[4];
      // Backfill trackFullCapacity for characters created before the field existed.
      if (char && char.personalDestiny && !char.personalDestiny.trackFullCapacity && destinyData && Array.isArray(destinyData.destinies)) {
        var canon = destinyData.destinies.find(function (x) { return x.id === char.personalDestiny.id; });
        if (canon && canon.trackFullCapacity) {
          char.personalDestiny.trackFullCapacity = canon.trackFullCapacity;
        }
      }
      // Stash adventures for the destiny capacity gate.
      char._adventuresForCapacity = (adventuresData && adventuresData.adventures) || [];
      buildDetailsPanel(char, results[1], results[2]);
    }).catch(function (err) {
      console.error('[DetailsPanel]', err);
    });
  }

  document.addEventListener('panel:shown', function (e) {
    if (e.detail && e.detail.panelId === 'panel-1') init();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());

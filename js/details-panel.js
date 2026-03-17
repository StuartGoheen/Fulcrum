(function () {
  'use strict';

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    outer.appendChild(_buildSpeciesTraits(char, speciesData));
    outer.appendChild(_buildKitProgression(char));

    var narr = _buildNarrative(char);
    if (narr) outer.appendChild(narr);

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

  function _buildAbilities(char) {
    var kits = char.kits || [];
    var passives = [];
    var gambits = [];

    kits.forEach(function (kit) {
      var tier = kit.tier || 0;
      (kit.abilities || []).forEach(function (ab) {
        if (ab.tier > tier) return;
        var entry = {
          name: ab.name,
          rule: ab.rule,
          tier: ab.tier,
          kitName: kit.name,
          actionBonus: ab.actionBonus || null,
          cost: ab.cost || null,
          buyoff: ab.buyoff || null,
          arenaTag: ab.arenaTag || null,
          actionType: ab.actionType || null,
          target: ab.target || null,
        };
        if (ab.type === 'gambit') gambits.push(entry);
        else passives.push(entry);
      });
    });

    var wrap = document.createElement('div');
    wrap.className = 'dp-abilities-section';

    var header = document.createElement('div');
    header.className = 'dp-section-bar';
    header.innerHTML = '<span class="dp-section-bar-label">Your Abilities</span>' +
      '<span class="dp-section-bar-count">' + (passives.length + gambits.length) + ' unlocked</span>';
    wrap.appendChild(header);

    if (passives.length === 0 && gambits.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'dp-empty-msg';
      empty.textContent = 'No abilities unlocked yet.';
      wrap.appendChild(empty);
      return wrap;
    }

    passives.forEach(function (ab) {
      wrap.appendChild(_abilityCard(ab, 'passive'));
    });

    gambits.forEach(function (ab) {
      wrap.appendChild(_abilityCard(ab, 'gambit'));
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
    badge.textContent = type === 'gambit' ? 'GAMBIT' : 'PASSIVE';
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

    if (type === 'gambit') {
      var tags = [];
      if (ab.arenaTag) tags.push(ab.arenaTag);
      if (ab.actionType) tags.push(ab.actionType);
      if (ab.target) tags.push(ab.target);
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
    }

    var rule = document.createElement('div');
    rule.className = 'dp-ability-card-rule';
    rule.textContent = ab.rule;
    card.appendChild(rule);

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
      { label: 'Native Skill', data: sp.nativeSkill },
      { label: 'Biological Truth', data: sp.biologicalTruth },
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
    header.innerHTML = '<span class="dp-section-bar-label">Kit Progression</span>' +
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
      if (kit.alignedDiscipline) metaTags.push(_discLabel(kit.alignedDiscipline));

      if (metaTags.length) {
        var meta = document.createElement('span');
        meta.className = 'dp-prog-card-meta';
        meta.textContent = metaTags.join(' \u00b7 ');
        cardHead.appendChild(meta);
      }

      card.appendChild(cardHead);

      var tierBar = document.createElement('div');
      tierBar.className = 'dp-prog-tier-bar';
      for (var t = 1; t <= 3; t++) {
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

  function _buildNarrative(char) {
    if (!char.narrative) return null;

    var wrap = document.createElement('div');
    wrap.className = 'dp-narrative-section dp-section--closed';

    var header = document.createElement('div');
    header.className = 'dp-section-bar dp-section-bar--toggle';
    header.innerHTML = '<span class="dp-section-bar-label">Backstory</span>' +
      '<span class="dp-section-bar-chevron">\u25B8</span>';
    header.addEventListener('click', function () {
      wrap.classList.toggle('dp-section--closed');
    });
    wrap.appendChild(header);

    var body = document.createElement('div');
    body.className = 'dp-narrative-body';

    var text = document.createElement('p');
    text.className = 'dp-narrative-text';
    text.textContent = char.narrative;
    body.appendChild(text);

    wrap.appendChild(body);
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
    ]).then(function (results) {
      buildDetailsPanel(results[0], results[1], results[2]);
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

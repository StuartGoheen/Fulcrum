(function () {
  'use strict';

  var ARENA_LABELS = {
    physique: 'Physique',
    reflex:   'Reflex',
    grit:     'Grit',
    wits:     'Wits',
    presence: 'Presence',
  };

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Species block ─────────────────────────────────────────────────────────

  function buildSpeciesBlock(char, speciesData) {
    var sp = null;
    if (speciesData) {
      var sName = (char.species || '').toLowerCase();
      sp = speciesData.find(function (s) {
        return s.id === sName || s.name.toLowerCase() === sName;
      });
    }

    var wrap = document.createElement('div');
    wrap.className = 'dp-section';

    var header = document.createElement('div');
    header.className = 'dp-section-header';
    header.innerHTML =
      '<span class="dp-section-label">Species</span>' +
      '<span class="dp-section-chevron">&#9662;</span>' +
      '<span class="dp-section-name">' + _esc(char.species || '—') + '</span>';
    header.style.cursor = 'pointer';
    header.addEventListener('click', function () { wrap.classList.toggle('dp-section--collapsed'); });
    wrap.appendChild(header);

    if (!sp) {
      var missing = document.createElement('p');
      missing.className = 'dp-missing';
      missing.textContent = 'No species data found.';
      wrap.appendChild(missing);
      return wrap;
    }

    var tagline = document.createElement('div');
    tagline.className = 'dp-species-tagline';
    tagline.textContent = sp.tagline;
    wrap.appendChild(tagline);

    var rows = [
      { label: 'Arena Shift',        name: sp.arenaShift.name,       desc: sp.arenaShift.desc       },
      { label: 'Native Skill',       name: sp.nativeSkill.name,      desc: sp.nativeSkill.desc      },
      { label: 'Biological Truth',   name: sp.biologicalTruth.name,  desc: sp.biologicalTruth.desc  },
    ];

    rows.forEach(function (row) {
      var block = document.createElement('div');
      block.className = 'dp-species-block';

      var blockLabel = document.createElement('div');
      blockLabel.className = 'dp-species-block-label';
      blockLabel.textContent = row.label;
      block.appendChild(blockLabel);

      var blockName = document.createElement('div');
      blockName.className = 'dp-species-block-name';
      blockName.textContent = row.name;
      block.appendChild(blockName);

      var blockDesc = document.createElement('div');
      blockDesc.className = 'dp-species-block-desc';
      blockDesc.textContent = row.desc;
      block.appendChild(blockDesc);

      wrap.appendChild(block);
    });

    return wrap;
  }

  // ─── Kit cards ─────────────────────────────────────────────────────────────

  function buildKitCard(kit) {
    var unlockedTier = kit.tier || 0;
    var abilities    = (kit.abilities || []).filter(function (ab) {
      return ab.tier <= unlockedTier;
    });

    var card = document.createElement('div');
    card.className = 'dp-kit-card';

    // ── Header ──
    var head = document.createElement('div');
    head.className = 'dp-kit-header';

    var nameWrap = document.createElement('div');
    nameWrap.className = 'dp-kit-name-row';

    var kitName = document.createElement('span');
    kitName.className = 'dp-kit-name';
    kitName.textContent = kit.name;
    nameWrap.appendChild(kitName);

    var tierBadge = document.createElement('span');
    tierBadge.className = 'dp-kit-tier-badge';
    tierBadge.textContent = 'T' + unlockedTier;
    nameWrap.appendChild(tierBadge);
    head.appendChild(nameWrap);

    var metaRow = document.createElement('div');
    metaRow.className = 'dp-kit-meta';

    if (kit.governingArena) {
      var arenaTag = document.createElement('span');
      arenaTag.className = 'dp-kit-meta-tag dp-kit-meta-arena';
      arenaTag.textContent = ARENA_LABELS[kit.governingArena] || kit.governingArena;
      metaRow.appendChild(arenaTag);
    }

    if (kit.alignedDiscipline) {
      var discLabel = kit.alignedDiscipline
        .replace('_spark', ' (Force)')
        .replace(/_/g, ' ');
      discLabel = discLabel.charAt(0).toUpperCase() + discLabel.slice(1);

      var discTag = document.createElement('span');
      discTag.className = 'dp-kit-meta-tag dp-kit-meta-disc';
      discTag.textContent = discLabel;
      metaRow.appendChild(discTag);
    }

    if (kit.primaryWeapons && kit.primaryWeapons.length) {
      var wpnTag = document.createElement('span');
      wpnTag.className = 'dp-kit-meta-tag dp-kit-meta-wpn';
      wpnTag.textContent = kit.primaryWeapons.join(' / ');
      metaRow.appendChild(wpnTag);
    }

    head.appendChild(metaRow);

    // ── Tier progress bar ──
    var tierBar = document.createElement('div');
    tierBar.className = 'dp-kit-tier-bar';
    for (var t = 1; t <= 3; t++) {
      var pip = document.createElement('div');
      pip.className = 'dp-kit-tier-pip' + (t <= unlockedTier ? ' is-active' : '');
      pip.textContent = 'T' + t;
      tierBar.appendChild(pip);
    }
    head.appendChild(tierBar);
    card.appendChild(head);

    // ── Abilities ──
    if (abilities.length === 0) {
      var noAb = document.createElement('div');
      noAb.className = 'dp-kit-no-abilities';
      noAb.textContent = 'No abilities unlocked yet.';
      card.appendChild(noAb);
      return card;
    }

    var abWrap = document.createElement('div');
    abWrap.className = 'dp-kit-abilities';

    var lockedAbilities = (kit.abilities || []).filter(function (ab) {
      return ab.tier > unlockedTier;
    });

    abilities.forEach(function (ab) {
      var row = document.createElement('div');
      row.className = 'dp-ability-row';

      // Left: type badge + tier marker
      var badgeCol = document.createElement('div');
      badgeCol.className = 'dp-ability-badge-col';

      var tierMark = document.createElement('div');
      tierMark.className = 'dp-ability-tier-mark';
      tierMark.textContent = 'T' + ab.tier;
      badgeCol.appendChild(tierMark);

      var typeBadge = document.createElement('div');
      var isGambit  = ab.type === 'gambit';
      typeBadge.className = 'dp-ability-type-badge dp-ability-type-' + _esc(ab.type || 'passive');
      typeBadge.textContent = isGambit ? 'Gambit' : 'Passive';
      badgeCol.appendChild(typeBadge);
      row.appendChild(badgeCol);

      // Right: name + tags + rule text
      var bodyCol = document.createElement('div');
      bodyCol.className = 'dp-ability-body';

      var abilityName = document.createElement('div');
      abilityName.className = 'dp-ability-name';
      abilityName.textContent = ab.name;
      bodyCol.appendChild(abilityName);

      // Gambit context tags
      if (isGambit) {
        var tagRow = document.createElement('div');
        tagRow.className = 'dp-ability-tags';
        if (ab.arenaTag) {
          var at = document.createElement('span');
          at.className = 'dp-ability-tag dp-ability-tag-arena';
          at.textContent = ab.arenaTag;
          tagRow.appendChild(at);
        }
        if (ab.actionType) {
          var act = document.createElement('span');
          act.className = 'dp-ability-tag';
          act.textContent = ab.actionType;
          tagRow.appendChild(act);
        }
        if (ab.target) {
          var tgt = document.createElement('span');
          tgt.className = 'dp-ability-tag dp-ability-tag-target';
          tgt.textContent = ab.target;
          tagRow.appendChild(tgt);
        }
        if (tagRow.children.length) bodyCol.appendChild(tagRow);
      }

      var rule = document.createElement('div');
      rule.className = 'dp-ability-rule';
      rule.textContent = ab.rule;
      bodyCol.appendChild(rule);

      // Action economy bonus (if any)
      if (ab.actionBonus) {
        var bonusParts = [];
        if (ab.actionBonus.trigger)  bonusParts.push('+' + ab.actionBonus.trigger  + ' Trigger');
        if (ab.actionBonus.action)   bonusParts.push('+' + ab.actionBonus.action   + ' Action');
        if (ab.actionBonus.maneuver) bonusParts.push('+' + ab.actionBonus.maneuver + ' Maneuver');
        if (bonusParts.length) {
          var bonus = document.createElement('div');
          bonus.className = 'dp-ability-bonus';
          bonus.textContent = bonusParts.join(' · ');
          bodyCol.appendChild(bonus);
        }
      }

      row.appendChild(bodyCol);
      abWrap.appendChild(row);
    });

    card.appendChild(abWrap);

    if (lockedAbilities.length > 0) {
      var details = document.createElement('details');
      details.className = 'dp-kit-locked-details';

      var summary = document.createElement('summary');
      summary.className = 'dp-kit-locked-summary';
      summary.textContent = lockedAbilities.length + ' locked tier ' + (unlockedTier + 1 <= 3 ? (unlockedTier + 1) + (unlockedTier + 2 <= 3 ? '–3' : '') : '') + ' abilities';
      details.appendChild(summary);

      lockedAbilities.forEach(function (ab) {
        var row = document.createElement('div');
        row.className = 'dp-ability-row dp-ability-row--locked';

        var badgeCol = document.createElement('div');
        badgeCol.className = 'dp-ability-badge-col';

        var tierMark = document.createElement('div');
        tierMark.className = 'dp-ability-tier-mark dp-ability-tier-mark--locked';
        tierMark.textContent = 'T' + ab.tier;
        badgeCol.appendChild(tierMark);

        var typeBadge = document.createElement('div');
        var isGambit  = ab.type === 'gambit';
        typeBadge.className = 'dp-ability-type-badge dp-ability-type-' + _esc(ab.type || 'passive') + ' dp-ability-type--locked';
        typeBadge.textContent = isGambit ? 'Gambit' : 'Passive';
        badgeCol.appendChild(typeBadge);
        row.appendChild(badgeCol);

        var bodyCol = document.createElement('div');
        bodyCol.className = 'dp-ability-body';

        var abilityName = document.createElement('div');
        abilityName.className = 'dp-ability-name dp-ability-name--locked';
        abilityName.textContent = ab.name;
        bodyCol.appendChild(abilityName);

        var rule = document.createElement('div');
        rule.className = 'dp-ability-rule dp-ability-rule--locked';
        rule.textContent = ab.rule;
        bodyCol.appendChild(rule);

        row.appendChild(bodyCol);
        details.appendChild(row);
      });

      card.appendChild(details);
    }

    return card;
  }

  // ─── Narrative block ───────────────────────────────────────────────────────

  function buildNarrativeBlock(char) {
    if (!char.narrative) return null;

    var wrap = document.createElement('div');
    wrap.className = 'dp-section dp-section--narrative';

    var header = document.createElement('div');
    header.className = 'dp-section-header';
    header.innerHTML = '<span class="dp-section-label">Background</span>' +
      '<span class="dp-section-chevron">&#9662;</span>';
    header.style.cursor = 'pointer';
    header.addEventListener('click', function () { wrap.classList.toggle('dp-section--collapsed'); });
    wrap.appendChild(header);

    var text = document.createElement('p');
    text.className = 'dp-narrative-text';
    text.textContent = char.narrative;
    wrap.appendChild(text);

    return wrap;
  }

  // ─── Full panel assembly ───────────────────────────────────────────────────

  function buildDetailsPanel(char, speciesData) {
    var panel = document.getElementById('panel-1');
    if (!panel) return;

    panel.innerHTML = '';

    var outer = document.createElement('div');
    outer.className = 'dp-panel-wrap';

    // ── Panel title ──
    var title = document.createElement('div');
    title.className = 'dp-panel-title';
    title.innerHTML =
      '<span class="dp-panel-title-name">' + _esc(char.name || 'Character') + '</span>' +
      '<span class="dp-panel-title-sub">' + _esc(char.species || '') + ' &mdash; ' + _esc(char.archetype || '') + '</span>';
    outer.appendChild(title);

    // ── Species ──
    outer.appendChild(buildSpeciesBlock(char, speciesData));

    // ── Narrative ──
    var narr = buildNarrativeBlock(char);
    if (narr) outer.appendChild(narr);

    // ── Kits ──
    var kits = char.kits || [];
    if (kits.length > 0) {
      var kitsSection = document.createElement('div');
      kitsSection.className = 'dp-section';

      var kitsHeader = document.createElement('div');
      kitsHeader.className = 'dp-section-header';
      kitsHeader.innerHTML =
        '<span class="dp-section-label">Kits</span>' +
        '<span class="dp-section-chevron">&#9662;</span>' +
        '<span class="dp-section-name">' + kits.length + ' equipped</span>';
      kitsHeader.style.cursor = 'pointer';
      kitsHeader.addEventListener('click', function () { kitsSection.classList.toggle('dp-section--collapsed'); });
      kitsSection.appendChild(kitsHeader);

      kits.forEach(function (kit) {
        kitsSection.appendChild(buildKitCard(kit));
      });

      outer.appendChild(kitsSection);
    }

    panel.appendChild(outer);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

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
    ]).then(function (results) {
      buildDetailsPanel(results[0], results[1]);
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

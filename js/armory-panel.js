(function () {
  'use strict';

  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];

  function _dieIndex(dieStr) {
    return DIE_ORDER.indexOf(dieStr.toUpperCase());
  }

  var DISCIPLINE_MAP = {
    'ranged':        { arenaId: 'reflex',   discId: 'ranged'        },
    'heavy_weapons': { arenaId: 'physique', discId: 'heavy_weapons' },
    'heavyweapons':  { arenaId: 'physique', discId: 'heavy_weapons' },
    'melee':         { arenaId: 'physique', discId: 'melee'         },
    'brawl':         { arenaId: 'physique', discId: 'brawl'         }
  };

  var _CATEGORY_TAGS = { 'Any': true, 'Combat': true, 'Force': true };

  function _gambitMatchesWeapon(gambitTags, wpnTags) {
    var hasSpecific = false;
    var specificMatch = false;
    for (var i = 0; i < gambitTags.length; i++) {
      var raw = gambitTags[i].replace(/^\[|\]$/g, '');
      if (_CATEGORY_TAGS[raw]) continue;
      hasSpecific = true;
      var parts = raw.split(/\s+/);
      if (parts.length > 1) {
        var allPresent = true;
        for (var p = 0; p < parts.length; p++) {
          if (wpnTags.indexOf(parts[p]) === -1) { allPresent = false; break; }
        }
        if (allPresent) { specificMatch = true; break; }
      } else {
        if (wpnTags.indexOf(raw) !== -1) { specificMatch = true; break; }
      }
    }
    if (hasSpecific) return specificMatch;
    return gambitTags.length > 0;
  }

  var STATUS_CYCLE = ['stowed', 'carried', 'equipped'];

  var _statusMap = {};
  var _currentCharId = null;

  function _statPill(itemId, itemType, statusMap, weapon) {
    if (weapon && weapon.innate) {
      return '<span class="armory-state-pill armory-state-equipped">Innate</span>';
    }
    var status = (statusMap && statusMap[itemId]) ? statusMap[itemId].status : 'stowed';
    return (
      '<span class="armory-state-pill armory-state-' + _esc(status) + '"' +
        ' data-pill-id="' + _esc(itemId) + '"' +
        ' data-pill-type="' + _esc(itemType) + '"' +
        ' data-pill-status="' + _esc(status) + '"' +
        ' role="button" tabindex="0">' +
        _esc(status.charAt(0).toUpperCase() + status.slice(1)) +
      '</span>'
    );
  }

  function _cycleStatus(current) {
    var idx = STATUS_CYCLE.indexOf(current);
    return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  }

  function _persistStatus(charId, itemId, itemType, status) {
    fetch('/api/equipment/' + encodeURIComponent(charId) + '/' + encodeURIComponent(itemId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status, itemType: itemType })
    }).then(function () {
      document.dispatchEvent(new CustomEvent('equipment:changed', {
        detail: { charId: charId, itemId: itemId, itemType: itemType, status: status }
      }));
    }).catch(function (err) {
      console.error('[ArmoryPanel] equipment persist error', err);
    });
  }

  var ARMOR_CATEGORY_RULES = {
    none:   'Step Down Physique to Endure.',
    light:  'No modification to Physique when Enduring.',
    medium: 'Step Up Physique to Endure \u00b7 Step Down Reflex for Evasion.',
    heavy:  'Step Up Physique twice to Endure \u00b7 Step Down Reflex twice for Evasion.'
  };

  var WEAPON_TIERS = [
    { range: '0\u20133', label: 'Fleeting' },
    { range: '4\u20137', label: 'Masterful'    },
    { range: '8+',       label: 'Legendary' }
  ];

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _renderRange(range) {
    if (!range) return '';
    if (range.engaged) return 'Engaged';
    if (Array.isArray(range)) {
      var eff = range[0];
      var med = range[1];
      var max = range[2];
      return '0\u2013' + eff + ' \u00b7 ' + (eff + 1) + '\u2013' + med + ' \u00b7 ' + (med + 1) + '\u2013' + max;
    }
    var min = range.min;
    var max = range.max;
    if (min === 0 && max === 0) return 'Engaged';
    if (min === max) return 'Zone ' + min;
    return 'Zones ' + min + '\u2013' + max;
  }

  var GLOSSARY_LINK_MAP = {
    'Disoriented': 'condition_disoriented',
    'Rattled':     'condition_rattled',
    'Optimized':   'condition_optimized',
    'Weakened':    'condition_weakened',
    'Empowered':   'condition_empowered',
    'Shaken':      'condition_shaken',
    'Exposed':     'condition_exposed',
    'Pinned':      'condition_pinned',
    'Prone':       'condition_prone',
    'Hazard':      'condition_hazard',
    'Guarded':     'condition_guarded',
    'Cover':       'condition_cover',
    'Buffered':    'condition_buffered',
    'Blinded':     'condition_blinded',
    'Shut Down':   'condition_shut_down',
    'Restrained':  'condition_restrained',
    'Suppressed':  'condition_suppressed',
    'Bleeding':    'condition_bleeding',
    'Stunned':     'condition_stunned',
    'Incapacitated': 'condition_incapacitated',
    'Marked':      'condition_marked',
    'Slowed':      'condition_slowed',
    'Stimmed':     'stimmed',
    'Natural Recovery': 'natural_recovery',
  };

  function _linkifyText(str) {
    var parts = String(str).split(/(\[[^\]]+\])/g);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part.charAt(0) === '[' && part.charAt(part.length - 1) === ']') {
        var term = part.slice(1, -1);
        var normalized = term.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/, '').trim();
        var gid  = GLOSSARY_LINK_MAP[normalized];
        if (gid) {
          out += '<span data-glossary-id="' + _esc(gid) + '" class="glossary-link">' + _esc(part) + '</span>';
        } else {
          out += _esc(part);
        }
      } else {
        out += _esc(part).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
      }
    }
    return out;
  }

  function _getDiscDie(char, arenaId, discId) {
    var arenas = char.arenas || [];
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id !== arenaId) continue;
      var discs = arenas[i].disciplines || [];
      for (var j = 0; j < discs.length; j++) {
        if (discs[j].id !== discId) continue;
        var baseDie    = discs[j].die.toUpperCase();
        var baseIdx    = DIE_ORDER.indexOf(baseDie);
        var discOffset = window.CharacterPanel ? window.CharacterPanel.getDiscEffectOffset(discId, arenaId) : 0;
        var effIdx     = baseIdx + discOffset;
        if (effIdx < 0) return 'D4';
        if (effIdx > 4) return 'D12';
        return DIE_ORDER[effIdx];
      }
    }
    return 'D4';
  }

  function _dieImg(dieType) {
    return '<img src="/assets/' + dieType.toLowerCase() + '.png" alt="' + _esc(dieType) + '" class="armory-weapon-disc-die">';
  }

  function _getEffectiveArenaDie(char, arenaId) {
    var trauma = window.CharacterPanel ? window.CharacterPanel.getArenaTrauma() : {};
    var traumaLevel  = trauma[arenaId] || 0;
    var effectOffset = window.CharacterPanel ? window.CharacterPanel.getArenaEffectOffset(arenaId) : 0;
    var arenas = char.arenas || [];
    var arenaObj = null;
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id === arenaId) { arenaObj = arenas[i]; break; }
    }
    if (!arenaObj) return 'D4';
    var baseIdx = DIE_ORDER.indexOf(arenaObj.die.toUpperCase());
    var effIdx  = baseIdx - traumaLevel + effectOffset;
    if (effIdx < 0) effIdx = 0;
    if (effIdx > 4) effIdx = 4;
    return DIE_ORDER[effIdx];
  }

  function _buildDamageTrack(dmgArr) {
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < WEAPON_TIERS.length && i < dmgArr.length; i++) {
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(WEAPON_TIERS[i].range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(WEAPON_TIERS[i].label) + '</span>' +
          '<span class="armory-effect-value">' + _esc(String(dmgArr[i])) + ' Dmg</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function _buildFixedPowerDieTrack(dieName) {
    var dieFile = dieName.toLowerCase() + '.png';
    var stackHtml =
      '<span class="char-disc-2die-stack">' +
        '<img src="/assets/' + dieFile + '" alt="" class="char-disc-2die-back">' +
        '<img src="/assets/' + dieFile + '" alt="" class="char-disc-2die-front">' +
      '</span>' +
      '<svg viewBox="0 0 10 14" width="8" height="12" style="vertical-align:middle;margin-left:2px;" aria-hidden="true">' +
        '<line x1="5" y1="12" x2="5" y2="5" stroke="var(--color-accent-primary)" stroke-width="2" stroke-linecap="round"/>' +
        '<polygon points="0,6 10,6 5,0" fill="var(--color-accent-primary)"/>' +
      '</svg>';
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < WEAPON_TIERS.length; i++) {
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(WEAPON_TIERS[i].range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(WEAPON_TIERS[i].label) + '</span>' +
          '<span class="armory-effect-value" style="display:flex;align-items:center;gap:0;">' + stackHtml + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function _buildCustomEffectTrack(rows) {
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < WEAPON_TIERS.length && i < rows.length; i++) {
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(WEAPON_TIERS[i].range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(WEAPON_TIERS[i].label) + '</span>' +
          '<span class="armory-effect-value">' + _esc(rows[i]) + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }


  function _buildStunOnlyTrack(chassisDef) {
    var tiers = chassisDef.tiers;
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      var condStr = t.stunCondition ? ' \u2014 [' + _esc(t.stunCondition) + ']' : '';
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(t.range) + '</span>' +
          '<span class="armory-effect-name">' + _esc(t.label) + '</span>' +
          '<span class="armory-effect-value">Stun ' + _esc(String(t.stunDamage)) + condStr + '</span>' +
        '</div>';
    }
    html += '</div>';
    html += '<div class="armory-mode-note">Stun Check: if Stun Value \u2265 target\u2019s current Vitality \u2192 [Unconscious]. Otherwise, the condition applies only \u2014 no Vitality damage is dealt.</div>';
    return html;
  }
  function _buildStunBlock(chassisDef) {
    var tiers = chassisDef.tiers;
    var rowsHtml = '';
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      rowsHtml +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(t.range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(t.label) + '</span>' +
          '<span class="armory-effect-value">Stun ' + _esc(String(t.stunDamage)) + ' \u2014 [' + _esc(t.stunCondition) + ']</span>' +
        '</div>';
    }

    return (
      '<div class="armory-gambit-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label">Stun</span>' +
          '<span class="armory-gambit-label armory-stun-setting-label">Setting</span>' +
          '<span class="armory-stun-meta">Max 2 Zones</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          '<div class="armory-effect-track">' + rowsHtml + '</div>' +
          '<div class="armory-mode-note">Stun Check: if Stun Value \u2265 target\u2019s current Vitality \u2192 [Unconscious]. Otherwise, the condition applies only \u2014 no Vitality damage is dealt.</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildEngineGambitBlock(gambit, engineName) {
    return (
      '<div class="armory-gambit-block engine-gambit-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label engine-gambit-label">' + _esc(engineName) + '</span>' +
          '<span class="armory-gambit-name">' + _esc(gambit.name) + '</span>' +
          '<span class="engine-gambit-tag">' + _esc(gambit.arenaTag) + '</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          '<div class="engine-gambit-cost">' + _esc(gambit.cost) + '</div>' +
          '<div class="armory-gambit-text">' + _esc(gambit.rule) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildKitGambitBlock(ability, kitName) {
    return (
      '<div class="armory-gambit-block engine-gambit-block kit-gambit-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label engine-gambit-label kit-gambit-label">' + _esc(kitName) + '</span>' +
          '<span class="armory-gambit-name">' + _esc(ability.name) + '</span>' +
          (ability.arenaTag ? '<span class="engine-gambit-tag">' + _esc(ability.arenaTag) + '</span>' : '') +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          (ability.cost ? '<div class="engine-gambit-cost">' + _esc(ability.cost) + '</div>' : '') +
          '<div class="armory-gambit-text">' + _linkifyText(ability.rule) + '</div>' +
          (ability.buyOff
            ? '<div class="kit-gambit-buyoff">Buy-Off: ' + _linkifyText(ability.buyOff) + '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  function _buildKitPassiveBlock(ability, kitName) {
    var text = ability.shorthand || ability.rule;
    return (
      '<div class="armory-gambit-block kit-passive-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label kit-passive-label">' + _esc(kitName) + '</span>' +
          '<span class="armory-gambit-name">' + _esc(ability.name) + '</span>' +
          '<span class="kit-passive-badge">Passive</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          '<div class="armory-gambit-text">' + _linkifyText(text) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  var ENDURE_STEP_MAP  = { none: -1, light: 0, medium: 1, heavy: 2 };

  function _steppedDie(baseDie, steps) {
    var idx = DIE_ORDER.indexOf(baseDie.toUpperCase());
    if (idx < 0) return baseDie;
    var eff = Math.max(0, Math.min(DIE_ORDER.length - 1, idx + steps));
    return DIE_ORDER[eff];
  }

  function _buildArmorInArmory(armor, char, statusMap) {
    var cat = armor.category || 'light';
    var endureSteps = ENDURE_STEP_MAP[cat] != null ? ENDURE_STEP_MAP[cat] : 0;
    var discDie  = _getDiscDie(char, 'physique', 'endure');
    var baseArenaDie = _getEffectiveArenaDie(char, 'physique');
    var arenaDie = _steppedDie(baseArenaDie, endureSteps);

    var discHtml =
      '<div class="armory-weapon-disc">' +
        _dieImg(discDie) +
        '<span class="armory-weapon-disc-sep">/</span>' +
        _dieImg(arenaDie) +
      '</div>';

    var categoryRule = ARMOR_CATEGORY_RULES[armor.category] || '';
    if (armor.evasionException && categoryRule) {
      categoryRule = categoryRule.replace(' \u00b7 Step Down Reflex for Evasion.', '') + ' \u00b7 No Evasion penalty (see Trait).';
    }
    if (typeof armor.evasionReduction === 'number' && categoryRule) {
      categoryRule = categoryRule.replace(/Step Down Reflex( twice)? for Evasion\./i, 'Evasion penalty reduced (see Trait).');
    }

    var metaHtml =
      '<div class="armory-weapon-meta">' +
        _statPill(armor.id, 'armor', statusMap) +
        '<span class="armory-weapon-chassis">' + _esc(armor.categoryLabel || armor.category) + '</span>' +
        (armor.cost
          ? '<span class="armory-weapon-cost">' + _esc(String(armor.cost)) + ' cr</span>'
          : '<span class="armory-weapon-cost">Not for sale</span>') +
        (armor.availability ? '<span class="armory-weapon-range">Avail: ' + _esc(armor.availability) + '</span>' : '') +
      '</div>';

    var ruleHtml = categoryRule
      ? '<div class="armor-category-rule">' + _esc(categoryRule) + '</div>'
      : '';

    var descHtml = armor.description
      ? '<div class="armory-gambit-text" style="margin-bottom:4px;">' + _esc(armor.description) + '</div>'
      : '';

    var traitsHtml = '';
    var traits = armor.traits || [];
    for (var i = 0; i < traits.length; i++) {
      traitsHtml +=
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(traits[i].name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(traits[i].description) + '</div>' +
        '</div>';
    }

    var gambitsHtml = '';
    var gambits = armor.gambits || [];
    for (var g = 0; g < gambits.length; g++) {
      gambitsHtml +=
        '<div class="armory-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label">Gambit</span>' +
            '<span class="armory-gambit-name">' + _esc(gambits[g].name) + '</span>' +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _esc(gambits[g].rule) + '</div>' +
          '</div>' +
        '</div>';
    }

    var armorDropHtml =
      '<div class="armory-item-actions">' +
        '<button class="armory-drop-btn" data-drop-id="' + _esc(armor.id) + '" data-drop-type="armor">Drop</button>' +
      '</div>';

    return (
      '<div class="armory-weapon-card" data-armor-id="' + _esc(armor.id) + '">' +
        '<div class="armory-weapon-header">' +
          '<span class="armory-weapon-name">' + _esc(armor.name) + '</span>' +
          discHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml +
          ruleHtml +
          descHtml +
          traitsHtml +
          gambitsHtml +
          armorDropHtml +
        '</div>' +
      '</div>'
    );
  }

  function _getAmmo(weaponId, clipSize) {
    try {
      var stored = localStorage.getItem('ammo_' + weaponId);
      if (stored !== null) {
        var val = parseFloat(stored);
        if (!isNaN(val)) return val;
      }
    } catch(e) {}
    return clipSize;
  }

  function _buildAmmoBar(clipSize, weaponId) {
    if (!clipSize || clipSize <= 0) return '';
    var SEGS = 8;
    var currentAmmo = weaponId ? _getAmmo(weaponId, clipSize) : clipSize;
    var pct = Math.max(0, Math.min(100, Math.round((currentAmmo / clipSize) * 100)));
    var filled = Math.round((pct / 100) * SEGS);
    var segColor = pct >= 75 ? '#22c55e' : (pct >= 30 ? '#f59e0b' : '#ef4444');
    var glowColor = pct >= 75 ? '#22c55e40' : (pct >= 30 ? '#f59e0b40' : '#ef444440');
    currentAmmo = Math.round(currentAmmo * 10) / 10;
    var html = '<div class="wpn-ammo-bar" data-clip-size="' + _esc(String(clipSize)) + '" data-ammo-pct="' + pct + '" title="' + currentAmmo + ' / ' + clipSize + ' charges">';
    for (var i = 0; i < SEGS; i++) {
      if (i < filled) {
        html += '<div class="wpn-ammo-seg" style="background:' + segColor + ';box-shadow:0 0 4px ' + glowColor + ';"></div>';
      } else {
        html += '<div class="wpn-ammo-seg wpn-ammo-seg-empty"></div>';
      }
    }
    html += '</div>';
    return html;
  }

  function _buildWeaponCard(weapon, char, chassisMap, statusMap, discGambits) {
    var mapping = DISCIPLINE_MAP[weapon.discipline];
    var discDie  = 'D4';
    var arenaDie = 'D4';
    if (mapping) {
      discDie  = _getDiscDie(char, mapping.arenaId, mapping.discId);
      arenaDie = _getEffectiveArenaDie(char, mapping.arenaId);
    }

    var chassisDef = chassisMap[weapon.chassisId] || null;

    var gambits = [];
    var weaponGambits = weapon.gambits || (weapon.gambit ? [weapon.gambit] : []);
    for (var wg = 0; wg < weaponGambits.length; wg++) {
      gambits.push({ name: weaponGambits[wg].name, source: null, text: weaponGambits[wg].rule });
    }
    var talents = char.talents || [];
    for (var t = 0; t < talents.length; t++) {
      var talent = talents[t];
      if (!talent.gambit || !talent.tags) continue;
      for (var ti = 0; ti < talent.tags.length; ti++) {
        if (weapon.tags.indexOf(talent.tags[ti]) !== -1) {
          gambits.push({ name: talent.name, source: talent.name, text: talent.gambit });
          break;
        }
      }
    }

    var engineGambits = [];
    var engine = char.engine;
    if (engine && engine.gambits) {
      for (var eg = 0; eg < engine.gambits.length; eg++) {
        var eg_ = engine.gambits[eg];
        if (eg_.targetType === 'weapon' && weapon.tags.indexOf(eg_.target) !== -1) {
          engineGambits.push(eg_);
        }
      }
    }

    var kitGambits = [];
    var kitPassives = [];
    var kits = char.kits || [];
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var kitAbilities = kit.abilities || [];
      for (var ka = 0; ka < kitAbilities.length; ka++) {
        var kab = kitAbilities[ka];
        if (kab.tier > unlockedTier) continue;
        if (kab.type === 'gambit' && kab.targetType === 'weapon') {
          if (weapon.tags.indexOf(kab.target) !== -1) {
            kitGambits.push({ ability: kab, kitName: kit.name });
          }
        } else if (kab.type === 'passive' && Array.isArray(kab.targetWeaponTags)) {
          var wpn = weapon.tags || [];
          var matched = false;
          for (var tw = 0; tw < kab.targetWeaponTags.length; tw++) {
            if (wpn.indexOf(kab.targetWeaponTags[tw]) !== -1) { matched = true; break; }
          }
          if (matched) {
            kitPassives.push({ ability: kab, kitName: kit.name });
          }
        }
      }
    }

    var disciplineGambitsList = [];
    if (discGambits) {
      var wpnTags = weapon.tags || [];
      var seen = {};
      var discKeys = Object.keys(discGambits);
      for (var dk = 0; dk < discKeys.length; dk++) {
        var dkey = discKeys[dk];
        var discSet = discGambits[dkey];
        if (!discSet || !discSet.gambits) continue;
        var dArena = discSet.arenaId;
        var dDisc  = discSet.disciplineId;
        var charDie = (dArena && dDisc) ? _getDiscDie(char, dArena, dDisc) : 'D4';
        for (var dg = 0; dg < discSet.gambits.length; dg++) {
          var dgam = discSet.gambits[dg];
          if (dgam.modifiesAction !== 'action_attack') continue;
          if (_dieIndex(charDie) < _dieIndex(dgam.requiredDie)) continue;
          if (!_gambitMatchesWeapon(dgam.tags || [], wpnTags)) continue;
          if (seen[dgam.id || dgam.name]) continue;
          seen[dgam.id || dgam.name] = true;
          disciplineGambitsList.push({ name: dgam.name, die: dgam.requiredDie, source: discSet.name, text: dgam.rule });
        }
      }
    }

    var rangeStr = _renderRange(weapon.range);
    var metaHtml =
      '<div class="armory-weapon-meta">' +
        _statPill(weapon.id, 'weapon', statusMap, weapon) +
        '<span class="armory-weapon-chassis">' + _esc(weapon.chassisLabel || '') + '</span>' +
        (rangeStr ? '<span class="armory-weapon-range">Range: ' + _esc(rangeStr) + '</span>' : '') +
        (weapon.cost ? '<span class="armory-weapon-cost">' + _esc(String(weapon.cost)) + ' cr</span>' : '') +
      '</div>';

    var effectHtml = '';
    var stunHtml = '';
    if (weapon.stunOnly && chassisDef) {
      effectHtml = _buildStunOnlyTrack(chassisDef);
    } else if (weapon.customEffectRows) {
      effectHtml = _buildCustomEffectTrack(weapon.customEffectRows);
    } else if (weapon.customDamage) {
      effectHtml = _buildDamageTrack(weapon.customDamage);
    } else if (chassisDef) {
      var dmg = chassisDef.tiers.map(function (t) { return t.damage; });
      effectHtml = _buildDamageTrack(dmg);
    }
    if (!weapon.stunOnly && weapon.stunSetting && chassisDef) {
      stunHtml = _buildStunBlock(chassisDef);
    }

    var traitHtml = '';
    if (weapon.trait) {
      traitHtml =
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(weapon.trait.name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(weapon.trait.description) + '</div>' +
        '</div>';
    }

    var gambitsHtml = '';
    for (var g = 0; g < gambits.length; g++) {
      var gambit = gambits[g];
      gambitsHtml +=
        '<div class="armory-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label">Gambit</span>' +
            (gambit.name ? '<span class="armory-gambit-name">' + _esc(gambit.name) + '</span>' : '') +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _linkifyText(gambit.text) + '</div>' +
          '</div>' +
        '</div>';
    }
    for (var eg2 = 0; eg2 < engineGambits.length; eg2++) {
      gambitsHtml += _buildEngineGambitBlock(engineGambits[eg2], engine.name);
    }
    for (var kg = 0; kg < kitGambits.length; kg++) {
      gambitsHtml += _buildKitGambitBlock(kitGambits[kg].ability, kitGambits[kg].kitName);
    }
    for (var kp = 0; kp < kitPassives.length; kp++) {
      gambitsHtml += _buildKitPassiveBlock(kitPassives[kp].ability, kitPassives[kp].kitName);
    }
    for (var dgi = 0; dgi < disciplineGambitsList.length; dgi++) {
      var dgItem = disciplineGambitsList[dgi];
      gambitsHtml +=
        '<div class="armory-gambit-block discipline-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label discipline-gambit-label">' + _esc(dgItem.source) + '</span>' +
            '<span class="armory-gambit-name">' + _esc(dgItem.name) + '</span>' +
            '<span class="armory-gambit-die-badge">' + _esc(dgItem.die) + '</span>' +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _linkifyText(dgItem.text) + '</div>' +
          '</div>' +
        '</div>';
    }

    var discHtml =
      '<div class="armory-weapon-disc">' +
        _dieImg(discDie) +
        '<span class="armory-weapon-disc-sep">/</span>' +
        _dieImg(arenaDie) +
      '</div>';

    var ammoBarHtml = _buildAmmoBar(weapon.clipSize, weapon.id);

    var dropBtnHtml = weapon.innate ? '' :
      '<div class="armory-item-actions">' +
        '<button class="armory-drop-btn" data-drop-id="' + _esc(weapon.id) + '" data-drop-type="weapon">Drop</button>' +
      '</div>';

    return (
      '<div class="armory-weapon-card" data-weapon-id="' + _esc(weapon.id) + '">' +
        '<div class="armory-weapon-header">' +
          '<span class="armory-weapon-name">' + _esc(weapon.name) + '</span>' +
          ammoBarHtml +
          discHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml +
          effectHtml +
          stunHtml +
          traitHtml +
          gambitsHtml +
          dropBtnHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildGearCard(gear, statusMap, char, qty) {
    var wp = gear.weaponProfile;
    var rangeStr = wp ? _renderRange(wp.range) : '';

    var metaHtml =
      '<div class="armory-weapon-meta">' +
        _statPill(gear.id, 'gear', statusMap) +
        '<span class="armory-weapon-chassis">' + _esc(gear.categoryLabel || gear.category) + '</span>' +
        (rangeStr ? '<span class="armory-weapon-range">Range: ' + _esc(rangeStr) + '</span>' : '') +
        (gear.cost ? '<span class="armory-weapon-cost">' + _esc(String(gear.cost)) + ' cr</span>' : '') +
        (gear.availability ? '<span class="armory-weapon-range">Avail: ' + _esc(gear.availability) + '</span>' : '') +
      '</div>';

    var effectHtml = '';
    if (gear.customEffectRows) {
      effectHtml = _buildCustomEffectTrack(gear.customEffectRows);
    } else if (wp && wp.customDamage) {
      effectHtml = _buildDamageTrack(wp.customDamage);
    } else if (wp && wp.fixedPowerDie) {
      effectHtml = _buildFixedPowerDieTrack(wp.fixedPowerDie);
    }

    var gearDiscHtml = '';
    if (wp && wp.fixedPowerDie) {
      var gdf = wp.fixedPowerDie.toLowerCase() + '.png';
      var mapping = DISCIPLINE_MAP[wp.discipline];
      var attackDieHtml = '';
      if (mapping && char) {
        var atkDie = _getDiscDie(char, mapping.arenaId, mapping.discId);
        attackDieHtml = _dieImg(atkDie) + '<span class="armory-weapon-disc-sep">/</span>';
      }
      gearDiscHtml =
        '<div class="armory-weapon-disc">' +
          attackDieHtml +
          '<span class="armory-2die-stack">' +
            '<img src="/assets/' + gdf + '" alt="" class="armory-2die-back">' +
            '<img src="/assets/' + gdf + '" alt="" class="armory-2die-front">' +
          '</span>' +
          '<svg viewBox="0 0 10 14" width="9" height="13" style="margin-left:2px;flex-shrink:0;" aria-hidden="true">' +
            '<line x1="5" y1="12" x2="5" y2="5" stroke="var(--color-accent-primary)" stroke-width="2" stroke-linecap="round"/>' +
            '<polygon points="0,6 10,6 5,0" fill="var(--color-accent-primary)"/>' +
          '</svg>' +
        '</div>';
    }

    var traits = gear.traits || [];
    var descHtml = traits.length === 0 && gear.description
      ? '<div class="armory-gambit-text" style="margin-bottom:4px;">' + _esc(gear.description) + '</div>'
      : '';

    var traitsHtml = '';
    for (var i = 0; i < traits.length; i++) {
      traitsHtml +=
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(traits[i].name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(traits[i].description) + '</div>' +
        '</div>';
    }

    var gambitsHtml = '';
    var gambits = gear.gambits || [];
    for (var g = 0; g < gambits.length; g++) {
      var gam = gambits[g];
      gambitsHtml +=
        '<div class="armory-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label">Gambit</span>' +
            (gam.name ? '<span class="armory-gambit-name">' + _esc(gam.name) + '</span>' : '') +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _linkifyText(gam.rule) + '</div>' +
          '</div>' +
        '</div>';
    }

    var isConsumable = (gear.tags || []).indexOf('Consumable') !== -1;
    var gearActionsHtml =
      '<div class="armory-item-actions">' +
        (isConsumable ? '<button class="armory-use-btn" data-use-id="' + _esc(gear.id) + '">Use' + (qty > 1 ? ' 1' : '') + '</button>' : '') +
        '<button class="armory-drop-btn" data-drop-id="' + _esc(gear.id) + '" data-drop-type="gear">Drop</button>' +
      '</div>';

    return (
      '<div class="armory-weapon-card" data-gear-id="' + _esc(gear.id) + '">' +
        '<div class="armory-weapon-header">' +
          '<span class="armory-weapon-name">' + _esc(gear.name) + (qty > 1 ? ' <span class="gear-qty-badge">\u00d7' + qty + '</span>' : '') + '</span>' +
          gearDiscHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml + effectHtml + descHtml + traitsHtml + gambitsHtml +
          gearActionsHtml +
        '</div>' +
      '</div>'
    );
  }

  var _lastHtml = '';
  var SLOT_IDS = ['slot-left-content', 'slot-mid-content', 'slot-right-content'];

  function _injectIntoVisibleSlots(innerHtml) {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var child = slot.firstElementChild;
      if (child && child.id === 'panel-2') {
        child.innerHTML = innerHtml;
      }
    });
  }

  function _setupSlotObservers() {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var observer = new MutationObserver(function () {
        if (_lastHtml) _injectIntoVisibleSlots(_lastHtml);
      });
      observer.observe(slot, { childList: true });
    });
  }

  function _render(weapons, char, chassisMap, armors, gear, discGambits) {
    var charWeaponIds = char.weaponIds || [];
    var rangedWeapons = [];
    var meleeWeapons  = [];
    for (var i = 0; i < charWeaponIds.length; i++) {
      for (var j = 0; j < weapons.length; j++) {
        if (weapons[j].id === charWeaponIds[i]) {
          var wpn = weapons[j];
          if ((wpn.tags || []).indexOf('Melee') !== -1) {
            meleeWeapons.push(wpn);
          } else {
            rangedWeapons.push(wpn);
          }
          break;
        }
      }
    }

    var charArmorIds = char.armorIds || (char.armorId ? [char.armorId] : []);
    var ownedArmors = [];
    if (armors && charArmorIds.length > 0) {
      for (var ai = 0; ai < charArmorIds.length; ai++) {
        for (var a = 0; a < armors.length; a++) {
          if (armors[a].id === charArmorIds[ai]) { ownedArmors.push(armors[a]); break; }
        }
      }
    }

    var statusMap = _statusMap;

    var html = '<div class="armory-panel-wrap">';
    if (ownedArmors.length > 0) {
      html += '<div class="armory-collapse-section open">';
      html += '<div class="armory-collapse-header" data-toggle-armory>Armor <span class="armory-collapse-chevron">\u25BE</span></div>';
      html += '<div class="armory-collapse-body">';
      for (var oa = 0; oa < ownedArmors.length; oa++) {
        html += _buildArmorInArmory(ownedArmors[oa], char, statusMap);
      }
      html += '</div></div>';
    }
    if (rangedWeapons.length > 0) {
      html += '<div class="armory-collapse-section open">';
      html += '<div class="armory-collapse-header" data-toggle-armory>Ranged <span class="armory-collapse-chevron">\u25BE</span></div>';
      html += '<div class="armory-collapse-body">';
      for (var r = 0; r < rangedWeapons.length; r++) {
        html += _buildWeaponCard(rangedWeapons[r], char, chassisMap, statusMap, discGambits);
      }
      html += '</div></div>';
    }
    if (meleeWeapons.length > 0) {
      html += '<div class="armory-collapse-section open">';
      html += '<div class="armory-collapse-header" data-toggle-armory>Melee <span class="armory-collapse-chevron">\u25BE</span></div>';
      html += '<div class="armory-collapse-body">';
      for (var m = 0; m < meleeWeapons.length; m++) {
        html += _buildWeaponCard(meleeWeapons[m], char, chassisMap, statusMap, discGambits);
      }
      html += '</div></div>';
    }

    var charGearIds = char.gearIds || [];
    var gearQtyMap = {};
    var gearOrder = [];
    for (var gi = 0; gi < charGearIds.length; gi++) {
      var ggid = charGearIds[gi];
      if (gearQtyMap[ggid]) { gearQtyMap[ggid]++; }
      else { gearQtyMap[ggid] = 1; gearOrder.push(ggid); }
    }
    var charGear = [];
    for (var go = 0; go < gearOrder.length; go++) {
      for (var gj = 0; gj < (gear || []).length; gj++) {
        if (gear[gj].id === gearOrder[go]) { charGear.push({ item: gear[gj], qty: gearQtyMap[gearOrder[go]] }); break; }
      }
    }
    if (charGear.length > 0) {
      html += '<div class="armory-collapse-section open">';
      html += '<div class="armory-collapse-header" data-toggle-armory>Gear <span class="armory-collapse-chevron">\u25BE</span></div>';
      html += '<div class="armory-collapse-body">';
      for (var gc = 0; gc < charGear.length; gc++) {
        html += _buildGearCard(charGear[gc].item, statusMap, char, charGear[gc].qty);
      }
      html += '</div></div>';
    }

    html += '</div>';

    _lastHtml = html;
    var panels = document.querySelectorAll('[id="panel-2"]');
    for (var p = 0; p < panels.length; p++) {
      panels[p].innerHTML = html;
    }
    _injectIntoVisibleSlots(html);
  }

  function _inventoryAction(charId, action, itemId, itemType) {
    return fetch('/api/inventory/' + encodeURIComponent(charId) + '/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: itemId, itemType: itemType })
    }).then(function (res) {
      if (!res.ok) throw new Error('Inventory ' + action + ' failed: ' + res.status);
      return res.json();
    });
  }

  function _refreshCharacterAfterInventory() {
    var char = window.CharacterPanel && window.CharacterPanel.currentChar;
    if (!char || !char.id) return;
    fetch('/api/characters/' + encodeURIComponent(char.id))
      .then(function (res) { return res.json(); })
      .then(function (updated) {
        if (window.CharacterPanel) window.CharacterPanel.currentChar = updated;
        document.dispatchEvent(new CustomEvent('character:stateChanged'));
      });
  }

  function _showInventoryConfirm(message, actionLabel, actionClass, onConfirm) {
    var existing = document.getElementById('inv-confirm-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'inv-confirm-overlay';
    overlay.className = 'inv-confirm-overlay';
    overlay.innerHTML =
      '<div class="inv-confirm-modal">' +
        '<div class="inv-confirm-msg">' + _esc(message) + '</div>' +
        '<div class="inv-confirm-actions">' +
          '<button class="inv-confirm-cancel">Cancel</button>' +
          '<button class="inv-confirm-ok ' + actionClass + '">' + _esc(actionLabel) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.inv-confirm-cancel').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) overlay.remove(); });
    overlay.querySelector('.inv-confirm-ok').addEventListener('click', function () {
      overlay.remove();
      onConfirm();
    });
  }

  document.addEventListener('click', function (e) {
    var armoryHdr = e.target.closest && e.target.closest('[data-toggle-armory]');
    if (armoryHdr) {
      var section = armoryHdr.closest('.armory-collapse-section');
      if (section) section.classList.toggle('open');
      return;
    }

    var useBtn = e.target.closest && e.target.closest('.armory-use-btn');
    if (useBtn && useBtn.closest('[id="panel-2"]')) {
      e.stopPropagation();
      var itemId = useBtn.dataset.useId;
      if (!itemId || !_currentCharId) return;
      var itemName = useBtn.closest('.armory-weapon-card').querySelector('.armory-weapon-name').textContent.split('\u00d7')[0].trim();
      var charId = _currentCharId;
      _showInventoryConfirm('Use one ' + itemName + '?', 'Use', 'inv-btn-use', function () {
        _inventoryAction(charId, 'use', itemId, 'gear')
          .then(function () { _refreshCharacterAfterInventory(); })
          .catch(function (err) { console.error('[ArmoryPanel] use error', err); });
      });
      return;
    }

    var dropBtn = e.target.closest && e.target.closest('.armory-drop-btn');
    if (dropBtn && dropBtn.closest('[id="panel-2"]')) {
      e.stopPropagation();
      var dropId = dropBtn.dataset.dropId;
      var dropType = dropBtn.dataset.dropType;
      if (!dropId || !dropType || !_currentCharId) return;
      var itemName = dropBtn.closest('.armory-weapon-card').querySelector('.armory-weapon-name').textContent.split('\u00d7')[0].trim();
      var charId = _currentCharId;
      _showInventoryConfirm('Drop ' + itemName + '?', 'Drop', 'inv-btn-drop', function () {
        _inventoryAction(charId, 'drop', dropId, dropType)
          .then(function () { _refreshCharacterAfterInventory(); })
          .catch(function (err) { console.error('[ArmoryPanel] drop error', err); });
      });
      return;
    }

    var pill = e.target.closest && e.target.closest('.armory-state-pill');
    if (pill && pill.closest('[id="panel-2"]')) {
      e.stopPropagation();
      var itemId   = pill.dataset.pillId;
      if (!itemId) return;
      var itemType = pill.dataset.pillType;
      var current  = pill.dataset.pillStatus || 'stowed';
      var next     = _cycleStatus(current);

      pill.dataset.pillStatus = next;
      pill.className = 'armory-state-pill armory-state-' + next;
      pill.textContent = next.charAt(0).toUpperCase() + next.slice(1);

      if (!_statusMap[itemId]) _statusMap[itemId] = {};
      _statusMap[itemId].status   = next;
      _statusMap[itemId].itemType = itemType;

      if (_currentCharId) _persistStatus(_currentCharId, itemId, itemType, next);
      return;
    }

    var header = e.target.closest && e.target.closest('.armory-weapon-header');
    if (header && header.closest('[id="panel-2"]')) {
      var card = header.closest('.armory-weapon-card');
      if (!card) return;
      var body = card.querySelector('.armory-weapon-body');
      if (!body) return;
      var isOpen = card.classList.contains('is-open');
      var allCards = document.querySelectorAll('[id="panel-2"] .armory-weapon-card');
      for (var i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove('is-open');
        var b = allCards[i].querySelector('.armory-weapon-body');
        if (b) b.classList.remove('open');
      }
      if (!isOpen) {
        card.classList.add('is-open');
        body.classList.add('open');
      }
      return;
    }
    var gambitToggle = e.target.closest && e.target.closest('.armory-gambit-toggle');
    if (gambitToggle && gambitToggle.closest('[id="panel-2"]')) {
      var block = gambitToggle.closest('.armory-gambit-block');
      if (!block) return;
      block.classList.toggle('is-open');
      return;
    }
  });

  function init() {
    _setupSlotObservers();

    Promise.all([
      fetch('/data/chassis.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load chassis: ' + res.status);
        return res.json();
      }),
      fetch('/data/weapons.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load weapons: ' + res.status);
        return res.json();
      }),
      fetch('/data/armor.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load armor: ' + res.status);
        return res.json();
      }),
      fetch('/data/gear.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load gear: ' + res.status);
        return res.json();
      }),
      fetch('/data/maneuvers.json').then(function (res) {
        if (!res.ok) throw new Error('Failed to load maneuvers: ' + res.status);
        return res.json();
      })
    ])
    .then(function (results) {
      var chassisMap = results[0];
      var weapons    = results[1];
      var armors     = results[2];
      var gear       = results[3];
      var maneuversData = results[4];
      var discGambits = maneuversData ? maneuversData.disciplineGambits || {} : {};

      function tryRender() {
        var char = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (!char) { setTimeout(tryRender, 50); return; }

        _currentCharId = char.id || null;

        function doRender() {
          var c = window.CharacterPanel && window.CharacterPanel.currentChar;
          if (!c) return;
          _render(weapons, c, chassisMap, armors, gear, discGambits);
        }

        if (_currentCharId) {
          fetch('/api/equipment/' + encodeURIComponent(_currentCharId))
            .then(function (res) { return res.ok ? res.json() : {}; })
            .then(function (map) {
              _statusMap = map || {};
              doRender();
            })
            .catch(function () { doRender(); });
        } else {
          doRender();
        }

        document.addEventListener('character:stateChanged', doRender);
        document.addEventListener('effects:changed',        doRender);

        document.addEventListener('ammo-changed', function (e) {
          var d = e.detail;
          if (!d) return;
          var panel = document.getElementById('panel-2');
          if (!panel) return;
          var cards = panel.querySelectorAll('.armory-weapon-card[data-weapon-id="' + d.weaponId + '"]');
          for (var i = 0; i < cards.length; i++) {
            var bar = cards[i].querySelector('.wpn-ammo-bar');
            if (!bar) continue;
            var SEGS = 8;
            var pct = d.clipSize > 0 ? Math.max(0, Math.min(100, Math.round((d.current / d.clipSize) * 100))) : 0;
            var filled = Math.round((pct / 100) * SEGS);
            var segColor = pct >= 75 ? '#22c55e' : (pct >= 30 ? '#f59e0b' : '#ef4444');
            var glowColor = pct >= 75 ? '#22c55e40' : (pct >= 30 ? '#f59e0b40' : '#ef444440');
            var segsHtml = '';
            for (var s = 0; s < SEGS; s++) {
              segsHtml += s < filled
                ? '<div class="wpn-ammo-seg" style="background:' + segColor + ';box-shadow:0 0 4px ' + glowColor + ';"></div>'
                : '<div class="wpn-ammo-seg wpn-ammo-seg-empty"></div>';
            }
            var disp = Math.round(d.current * 10) / 10;
            bar.setAttribute('data-ammo-pct', pct);
            bar.title = disp + ' / ' + d.clipSize + ' charges';
            bar.innerHTML = segsHtml;
          }
        });
      }
      tryRender();
    })
    .catch(function (err) {
      console.error('[ArmoryPanel]', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());

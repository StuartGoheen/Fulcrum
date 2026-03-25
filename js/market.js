(function () {
  'use strict';

  var WEAPON_TIERS = [
    { range: '0–3', label: 'Fleeting' },
    { range: '4–7', label: 'Masterful' },
    { range: '8+',  label: 'Legendary' }
  ];

  var MARKUP_BLACK = {
    '':  { min: 1.0,  max: 1.2,  label: 'Street Tax'    },
    'F': { min: 1.2,  max: 1.8,  label: 'Off-Book'       },
    'R': { min: 2.0,  max: 3.5,  label: 'Risk Premium'   },
    'X': { min: 3.0,  max: 8.0,  label: 'Death Sentence' }
  };

  var MARKUP_MARKET = {
    '':  { min: 0.90, max: 1.05 },
    'F': { min: 0.90, max: 1.05 }
  };

  var LICENSE_FEE_PCT = 0.15;
  var CTRL_SD = { 1: 0, 2: 1, 3: 2, 4: 3 };
  var PWR_SD  = { '': 0, 'F': 1, 'R': 2, 'X': 3 };

  var NO_DEAL_MSG_BLACK = {
    '':  'No contact. Try again next port.',
    'F': 'No contact. Try again next port.',
    'R': 'No contact. Someone may have noticed.',
    'X': 'No deal — and now someone is asking questions.'
  };

  var allItems = [];
  var selected = null;
  var shoppingList = [];
  var activeCat = 'all';
  var activeRest = 'all';
  var mode = 'black';
  var chassisMap = {};

  function parseAvail(raw) {
    var s = String(raw || '1').toUpperCase().trim().split('/');
    return { num: parseInt(s[0]) || 1, rest: s[1] || '' };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setMode(m) {
    mode = m;

    document.getElementById('btn-black').className  = 'store-btn' + (m === 'black'  ? ' active-black'  : '');
    document.getElementById('btn-market').className = 'store-btn' + (m === 'market' ? ' active-market' : '');

    var title    = document.getElementById('store-title');
    var tagline  = document.getElementById('store-tagline');
    var panelLbl = document.getElementById('deal-panel-title');

    if (m === 'market') {
      title.textContent    = 'The Market';
      title.style.color    = '#44CC66';
      tagline.textContent  = 'Licensed. Registered. Theoretically legal.';
      panelLbl.textContent = 'The Purchase';
      panelLbl.style.color = '#44CC66';
    } else {
      title.textContent    = 'The Black Market';
      title.style.color    = '#CC2222';
      tagline.textContent  = 'No questions. No receipts. No refunds.';
      panelLbl.textContent = 'The Art of the Deal';
      panelLbl.style.color = '#CC2222';
    }

    var pwrSdLabel = document.getElementById('pwr-sd-label');
    if (pwrSdLabel) pwrSdLabel.style.display = m === 'market' ? 'none' : '';

    var btnR = document.getElementById('rest-btn-R');
    var btnX = document.getElementById('rest-btn-X');
    if (btnR) btnR.style.display = m === 'market' ? 'none' : '';
    if (btnX) btnX.style.display = m === 'market' ? 'none' : '';

    if (m === 'market' && (activeRest === 'R' || activeRest === 'X')) {
      activeRest = 'all';
      document.querySelectorAll('#rest-bar .f-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.rest === 'all');
      });
    }

    shoppingList = [];
    if (selected) {
      document.getElementById('add-btn').disabled    = false;
      document.getElementById('add-btn').textContent = '+ Add';
    }

    updateSdPips();
    applyFilters();
    recalc();
  }

  function renderSdPips(el, filled) {
    if (!el) return;
    var h = '';
    for (var i = 0; i < 4; i++) h += '<div class="pip' + (i < filled ? '' : ' empty') + '"></div>';
    if (filled === 0) h += '<span style="font-size:0.38rem;color:var(--color-text-secondary);margin-left:3px;">none</span>';
    el.innerHTML = h;
  }

  function updateSdPips() {
    var items = shoppingList.length ? shoppingList : (selected ? [selected] : []);
    var maxCtrl = 0, maxPwr = 0;
    items.forEach(function (item) {
      var a = parseAvail(item.availability);
      maxCtrl = Math.max(maxCtrl, CTRL_SD[a.num] || 0);
      if (mode === 'black') maxPwr = Math.max(maxPwr, PWR_SD[a.rest] || 0);
    });
    renderSdPips(document.getElementById('ctrl-sd-pips'), maxCtrl);
    renderSdPips(document.getElementById('pwr-sd-pips'),  mode === 'market' ? 0 : maxPwr);
  }

  function ctrlLabel(n) {
    if (n === null) return { text: '—', color: 'var(--color-text-secondary)', fail: null };
    if (n >= 8) return { text: 'MASTERY', color: '#44CC66', fail: false };
    if (n >= 4) return { text: 'SUCCESS', color: 'var(--color-accent-primary)', fail: false };
    return { text: 'FAIL', color: '#CC3333', fail: true };
  }

  function pwrLabel(n) {
    if (n === null) return { text: '—', color: 'var(--color-text-secondary)' };
    if (n >= 8) return { text: 'Legendary', color: '#44CC66' };
    if (n >= 4) return { text: 'Masterful', color: 'var(--color-accent-primary)' };
    return { text: 'Fleeting', color: '#CC3333' };
  }

  function calcPrice(item, cVal, pVal, mVal) {
    var a = parseAvail(item.availability);
    var table = mode === 'market' ? MARKUP_MARKET : MARKUP_BLACK;
    var range = table[a.rest] || table[''];
    var norm  = pVal !== null ? Math.min(Math.max(pVal, 0), 12) / 12 : 0;
    var mult  = range.max - (norm * (range.max - range.min));
    if (cVal >= 8) mult *= 0.95;
    mult *= (1 + mVal / 100);
    return Math.round((item.cost || 0) * mult);
  }

  function calcLicenseFee(item) {
    if (mode !== 'market') return 0;
    var a = parseAvail(item.availability);
    return a.rest === 'F' ? Math.round((item.cost || 0) * LICENSE_FEE_PCT) : 0;
  }

  function marketAlwaysAvailable(item) {
    var a = parseAvail(item.availability);
    return mode === 'market' && a.num <= 1;
  }

  function recalc() {
    var cRaw = document.getElementById('ctrl-in').value;
    var pRaw = document.getElementById('pwr-in').value;
    var mRaw = document.getElementById('mod-in').value;

    var cVal = cRaw === '' ? null : parseInt(cRaw);
    var pVal = pRaw === '' ? null : Math.min(Math.max(parseInt(pRaw), 0), 12);
    var mVal = parseFloat(mRaw) || 0;

    var cl = ctrlLabel(cVal);
    var pl = pwrLabel(pVal);

    var ctrlTag = document.getElementById('ctrl-tag');
    ctrlTag.textContent = cl.text;
    ctrlTag.style.color = cl.color;

    var pwrTag = document.getElementById('pwr-tag');
    pwrTag.textContent = pl.text;
    pwrTag.style.color = pl.color;

    renderPackage(cVal, pVal, mVal, cl);
  }

  function addToList() {
    if (!selected) return;
    if (shoppingList.find(function (e) { return e.id === selected.id; })) return;
    shoppingList.push(selected);
    document.getElementById('add-btn').disabled = true;
    document.getElementById('add-btn').textContent = '✓ Added';
    updateSdPips();
    recalc();
  }

  function removeFromList(id) {
    shoppingList = shoppingList.filter(function (e) { return e.id !== id; });
    if (selected && selected.id === id) {
      document.getElementById('add-btn').disabled = false;
      document.getElementById('add-btn').textContent = '+ Add';
    }
    updateSdPips();
    recalc();
  }

  function clearList() {
    shoppingList = [];
    if (selected) {
      document.getElementById('add-btn').disabled = false;
      document.getElementById('add-btn').textContent = '+ Add';
    }
    updateSdPips();
    recalc();
  }

  function renderPackage(cVal, pVal, mVal, cl) {
    var pkgList  = document.getElementById('pkg-list');
    var noDeal   = document.getElementById('no-deal');
    var totalRow = document.getElementById('pkg-total-row');
    var totalVal = document.getElementById('pkg-total-val');

    if (!shoppingList.length) {
      pkgList.innerHTML      = '<p class="pkg-empty">Add items from the left<br/>to build your list.</p>';
      noDeal.style.display   = 'none';
      totalRow.style.display = 'none';
      return;
    }

    var isFail   = cl && cl.fail === true;
    var hasCalc  = cVal !== null && pVal !== null;
    var total = 0, html = '', outOfStockCount = 0;

    shoppingList.forEach(function (item) {
      var a = parseAvail(item.availability);
      var alwaysAvail = marketAlwaysAvailable(item);
      var notFound    = isFail && !alwaysAvail;

      if (notFound) {
        outOfStockCount++;
        html += '<div class="pkg-row" style="opacity:0.35;">'
          + '<span class="pkg-row-name">' + esc(item.name) + '</span>'
          + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '" style="font-size:0.4rem;padding:0.05rem 0.2rem;">' + esc(a.rest || 'LEGAL') + '</span>'
          + '<span class="pkg-row-price pending">' + (mode === 'market' ? 'out of stock' : 'not found') + '</span>'
          + '<button class="pkg-remove" data-remove-id="' + esc(item.id) + '">✕</button>'
          + '</div>';
        return;
      }

      if (hasCalc || alwaysAvail) {
        var effectivePval = (alwaysAvail && isFail) ? 0 : (pVal || 0);
        var effectiveCval = (alwaysAvail && isFail) ? 0 : (cVal || 0);
        var itemPrice  = calcPrice(item, effectiveCval, effectivePval, mVal);
        var licFee     = calcLicenseFee(item);
        total += itemPrice + licFee;

        html += '<div class="pkg-row">'
          + '<span class="pkg-row-name">' + esc(item.name) + '</span>'
          + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '" style="font-size:0.4rem;padding:0.05rem 0.2rem;">' + esc(a.rest || 'LEGAL') + '</span>'
          + '<span class="pkg-row-price">' + itemPrice.toLocaleString() + ' cr</span>'
          + '<button class="pkg-remove" data-remove-id="' + esc(item.id) + '">✕</button>'
          + '</div>';

        if (licFee > 0) {
          html += '<div class="pkg-row-license">'
            + '<span class="pkg-row-license-label">+ Imperial License (F)</span>'
            + '<span class="pkg-row-license-val">+' + licFee.toLocaleString() + ' cr</span>'
            + '</div>';
        }
      } else {
        var licFee2 = calcLicenseFee(item);
        html += '<div class="pkg-row">'
          + '<span class="pkg-row-name">' + esc(item.name) + '</span>'
          + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '" style="font-size:0.4rem;padding:0.05rem 0.2rem;">' + esc(a.rest || 'LEGAL') + '</span>'
          + '<span class="pkg-row-price pending">' + (item.cost || 0).toLocaleString() + ' cr base</span>'
          + '<button class="pkg-remove" data-remove-id="' + esc(item.id) + '">✕</button>'
          + '</div>';
        if (licFee2 > 0) {
          html += '<div class="pkg-row-license">'
            + '<span class="pkg-row-license-label">+ Imperial License (F)</span>'
            + '<span class="pkg-row-license-val">+' + licFee2.toLocaleString() + ' cr est.</span>'
            + '</div>';
        }
      }
    });

    pkgList.innerHTML = html;

    pkgList.querySelectorAll('.pkg-remove[data-remove-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { removeFromList(btn.dataset.removeId); });
    });

    if (isFail) {
      if (outOfStockCount === shoppingList.length) {
        noDeal.style.display = 'block';
        noDeal.className     = mode === 'market' ? 'out-of-stock-block' : 'no-deal-block';
        if (mode === 'market') {
          noDeal.textContent = 'Out of stock — check back next port.';
        } else {
          var worstRest = shoppingList.reduce(function (w, it) {
            var r = parseAvail(it.availability).rest;
            var rank = { 'X': 3, 'R': 2, 'F': 1, '': 0 };
            return (rank[r] || 0) > (rank[w] || 0) ? r : w;
          }, '');
          noDeal.innerHTML = 'NO DEAL<span class="no-deal-sub">' + (NO_DEAL_MSG_BLACK[worstRest] || '') + '</span>';
        }
      } else if (outOfStockCount > 0) {
        noDeal.style.display = 'block';
        noDeal.className     = mode === 'market' ? 'out-of-stock-block' : 'no-deal-block';
        noDeal.textContent   = mode === 'market' ? 'Some items out of stock.' : 'Partial fill — some items unavailable.';
      } else {
        noDeal.style.display = 'none';
      }
    } else {
      noDeal.style.display = 'none';
    }

    var showTotal = hasCalc || (isFail && shoppingList.some(function (it) { return marketAlwaysAvailable(it); }));
    if (showTotal && outOfStockCount < shoppingList.length) {
      totalRow.style.display = 'flex';
      totalVal.textContent   = total.toLocaleString() + ' cr';
      if (cVal >= 8) {
        totalVal.title       = '− 5% Friends & Family included';
        totalVal.style.color = '#44CC66';
      } else {
        totalVal.title       = '';
        totalVal.style.color = mode === 'market' ? '#44CC66' : '';
      }
    } else {
      totalRow.style.display = 'none';
    }
  }

  function selectItem(item) {
    selected = item;

    document.querySelectorAll('.armory-weapon-card').forEach(function (c) { c.classList.remove('mkt-selected'); });
    var card = document.querySelector('.armory-weapon-card[data-mid="' + item.id + '"]');
    if (card) card.classList.add('mkt-selected');

    var a = parseAvail(item.availability);
    document.getElementById('d-name').textContent = item.name;

    var badge = document.getElementById('d-rbadge');
    badge.textContent = a.rest || 'LEGAL';
    badge.className   = 'rbadge rbadge-' + (a.rest || 'none');

    var addBtn = document.getElementById('add-btn');
    var alreadyIn = shoppingList.find(function (e) { return e.id === item.id; });
    addBtn.disabled    = !!alreadyIn;
    addBtn.textContent = alreadyIn ? '✓ Added' : '+ Add';

    updateSdPips();
  }

  function renderRange(range) {
    if (!range) return '';
    if (range.engaged) return 'Engaged';
    if (Array.isArray(range)) {
      var eff = range[0], med = range[1], max = range[2];
      return '0–' + eff + ' · ' + (eff + 1) + '–' + med + ' · ' + (med + 1) + '–' + max;
    }
    if (range.min === 0 && range.max === 0) return 'Engaged';
    if (range.min === range.max) return 'Zone ' + range.min;
    return 'Zones ' + range.min + '–' + range.max;
  }

  function buildDamageTrack(dmgArr) {
    var h = '<div class="armory-effect-track">';
    WEAPON_TIERS.forEach(function (tier, i) {
      if (dmgArr[i] == null) return;
      h += '<div class="armory-effect-row">'
        + '<span class="armory-effect-range">' + esc(tier.range) + '</span>'
        + '<span class="armory-effect-name">' + esc(tier.label) + '</span>'
        + '<span class="armory-effect-value">' + esc(String(dmgArr[i])) + ' Dmg</span>'
        + '</div>';
    });
    return h + '</div>';
  }

  function buildCustomEffectTrack(rows) {
    if (!rows || !rows.length) return '';
    var h = '<div class="armory-effect-track">';
    rows.forEach(function (row) {
      h += '<div class="armory-effect-row">'
        + '<span class="armory-effect-range">' + esc(row.tier || '') + '</span>'
        + '<span class="armory-effect-name">' + esc(row.label || '') + '</span>'
        + '<span class="armory-effect-value" style="font-size:0.55rem;max-width:90px;white-space:normal;text-align:right;">' + esc(row.effect || '') + '</span>'
        + '</div>';
    });
    return h + '</div>';
  }

  function buildCard(item) {
    var a = parseAvail(item.availability);
    var ctrlSD = CTRL_SD[a.num] || 0;
    var pwrSD  = PWR_SD[a.rest] || 0;
    var traits  = item.traits  || [];
    var gambits = item.gambits || [];
    var cost    = item.cost ? item.cost.toLocaleString() + ' cr' : '—';

    var metaSdParts = [];
    if (ctrlSD > 0) metaSdParts.push('Ctrl ↓' + ctrlSD);
    if (pwrSD  > 0) metaSdParts.push('Pwr ↓' + pwrSD);
    var metaSd = metaSdParts.join(' · ');

    var wp = item.discipline ? item : (item.weaponProfile || null);

    var meta = '<div class="armory-weapon-meta">';
    meta += '<span class="armory-weapon-chassis">' + esc(item.categoryLabel || item.category || '') + '</span>';
    if (wp && wp.range) meta += '<span class="armory-weapon-range">Range: ' + esc(renderRange(wp.range)) + '</span>';
    meta += '<span class="armory-weapon-cost">' + esc(cost) + '</span>';
    if (item.availability) meta += '<span class="armory-weapon-range">Avail: ' + esc(item.availability) + '</span>';
    if (metaSd) meta += '<span class="armory-weapon-range" style="color:var(--color-text-secondary);">' + esc(metaSd) + '</span>';
    meta += '</div>';

    var effectHtml = '';
    if (wp) {
      if (wp.customEffectRows) {
        effectHtml = buildCustomEffectTrack(wp.customEffectRows);
      } else if (wp.fixedPowerDie) {
        effectHtml = '<div class="armory-effect-track"><div class="armory-effect-row">'
          + '<span class="armory-effect-range" style="color:var(--color-accent-primary);">Fixed</span>'
          + '<span class="armory-effect-name">Power Die</span>'
          + '<span class="armory-effect-value">' + esc(wp.fixedPowerDie) + '</span>'
          + '</div></div>';
      } else if (wp.customDamage) {
        effectHtml = buildDamageTrack(wp.customDamage);
      } else if (wp.chassisId && chassisMap[wp.chassisId]) {
        effectHtml = buildDamageTrack(chassisMap[wp.chassisId].tiers.map(function (t) { return t.damage; }));
      }
      if (wp.stunSetting && wp.chassisId && chassisMap[wp.chassisId]) {
        var stunTiers = chassisMap[wp.chassisId].tiers;
        effectHtml += '<div class="armory-effect-track" style="margin-top:2px;">';
        stunTiers.forEach(function (t) {
          effectHtml += '<div class="armory-effect-row">'
            + '<span class="armory-effect-range">' + esc(t.range) + '</span>'
            + '<span class="armory-effect-name" style="color:var(--color-accent-secondary);">Stun</span>'
            + '<span class="armory-effect-value">' + esc(String(t.stunDamage)) + ' Dmg · ' + esc(t.stunCondition) + '</span>'
            + '</div>';
        });
        effectHtml += '</div>';
      }
    }

    var showDesc = item.description && (traits.length === 0 && !wp);
    var descHtml = showDesc
      ? '<div class="armory-gambit-text" style="margin-bottom:3px;">' + esc(item.description) + '</div>' : '';

    var traitsHtml = '';
    traits.forEach(function (t) {
      traitsHtml += '<div class="armory-trait-block"><div class="armory-trait-name">' + esc(t.name) + '</div><div class="armory-trait-text">' + esc(t.description) + '</div></div>';
    });

    var gambitsHtml = '';
    gambits.forEach(function (g) {
      gambitsHtml += '<div class="armory-gambit-block">'
        + '<div class="armory-gambit-toggle" role="button" tabindex="0">'
        + '<span class="armory-gambit-label">Gambit</span>'
        + '<span class="armory-gambit-name">' + esc(g.name || '') + '</span>'
        + '<span class="armory-gambit-chevron">&#9656;</span>'
        + '</div>'
        + '<div class="armory-gambit-body">'
        + '<div class="armory-gambit-text">' + esc(g.rule || '') + '</div>'
        + '</div>'
        + '</div>';
    });

    return '<div class="armory-weapon-card" data-mid="' + esc(item.id) + '">'
      + '<div class="armory-weapon-header">'
      + '<span class="armory-weapon-name">' + esc(item.name) + '</span>'
      + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '">' + esc(a.rest || 'LEGAL') + '</span>'
      + '</div>'
      + '<div class="armory-weapon-body">'
      + meta + effectHtml + descHtml + traitsHtml + gambitsHtml
      + '</div>'
      + '</div>';
  }

  function handleCardClick(cardEl) {
    var mid = cardEl.dataset.mid;
    var item = allItems.find(function (it) { return it.id === mid; });
    if (!item) return;

    document.querySelectorAll('#item-list .armory-weapon-card.is-open').forEach(function (c) {
      if (c !== cardEl) {
        c.classList.remove('is-open');
        c.querySelector('.armory-weapon-body').classList.remove('open');
      }
    });
    var body = cardEl.querySelector('.armory-weapon-body');
    var isOpen = body.classList.toggle('open');
    cardEl.classList.toggle('is-open', isOpen);
    selectItem(item);
    cardEl.querySelectorAll('.armory-gambit-toggle').forEach(function (t) {
      t.onclick = function (e) {
        e.stopPropagation();
        var block = t.closest('.armory-gambit-block');
        if (block) block.classList.toggle('is-open');
      };
    });
  }

  function renderList(items) {
    var list = document.getElementById('item-list');
    if (!items.length) {
      list.innerHTML = '<p style="font-size:0.7rem;color:var(--color-text-secondary);padding:0.5rem 0;">No items match.</p>';
      return;
    }
    var groups = {};
    items.forEach(function (item) {
      var cat = item.categoryLabel || item.category || 'Other';
      (groups[cat] = groups[cat] || []).push(item);
    });
    var html = '';
    Object.entries(groups).forEach(function (entry) {
      html += '<p class="cat-label">' + esc(entry[0]) + '</p>';
      entry[1].forEach(function (item) { html += buildCard(item); });
    });
    list.innerHTML = html;

    list.querySelectorAll('.armory-weapon-card').forEach(function (card) {
      card.addEventListener('click', function () { handleCardClick(card); });
    });
  }

  function applyFilters() {
    var q = (document.getElementById('search').value || '').toLowerCase();
    var filtered = allItems.filter(function (item) {
      var a = parseAvail(item.availability);

      if (mode === 'market') {
        if (a.rest === 'R' || a.rest === 'X') return false;
        if (a.num >= 4) return false;
      }

      var matchCat  = activeCat  === 'all' || item.category === activeCat;
      var matchRest = activeRest === 'all' || a.rest === activeRest;
      var matchQ    = !q || item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
      return matchCat && matchRest && matchQ;
    });
    renderList(filtered);
  }

  function setCat(btn) {
    activeCat = btn.dataset.cat;
    document.querySelectorAll('#cat-bar .f-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    applyFilters();
  }

  function setRest(btn) {
    activeRest = btn.dataset.rest;
    document.querySelectorAll('#rest-bar .f-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    applyFilters();
  }

  function submitRequest() {
    var charName = document.getElementById('req-char').value.trim();
    var itemName = document.getElementById('req-name').value.trim();
    var statusEl = document.getElementById('req-status');
    if (!charName) { alert('Enter your character name.'); return; }
    if (!itemName) { alert('Enter an item name.'); return; }
    var desc = document.getElementById('req-desc').value.trim();
    var link = document.getElementById('req-link').value.trim();
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--color-text-secondary)';
    statusEl.textContent = 'Submitting...';
    fetch('/api/item-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: charName,
        itemName: itemName,
        description: desc || undefined,
        referenceUrl: link || undefined
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('Server error');
      return r.json();
    }).then(function () {
      statusEl.style.color = '#44AA66';
      statusEl.textContent = 'Request submitted! The GM will review it before next session.';
      document.getElementById('req-name').value = '';
      document.getElementById('req-desc').value = '';
      document.getElementById('req-link').value = '';
    }).catch(function () {
      statusEl.style.color = 'var(--color-accent-primary)';
      statusEl.textContent = 'Failed to submit. Try again.';
    });
  }

  function bindEvents() {
    document.getElementById('search').addEventListener('input', applyFilters);
    document.getElementById('ctrl-in').addEventListener('input', recalc);
    document.getElementById('pwr-in').addEventListener('input', recalc);
    document.getElementById('mod-in').addEventListener('input', recalc);

    document.getElementById('btn-black').addEventListener('click', function () { setMode('black'); });
    document.getElementById('btn-market').addEventListener('click', function () { setMode('market'); });
    document.getElementById('add-btn').addEventListener('click', addToList);
    document.getElementById('pkg-clear').addEventListener('click', clearList);
    document.getElementById('req-submit').addEventListener('click', submitRequest);

    document.querySelectorAll('#cat-bar .f-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setCat(btn); });
    });
    document.querySelectorAll('#rest-bar .f-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setRest(btn); });
    });
  }

  function boot() {
    bindEvents();

    Promise.all([
      fetch('/data/gear.json').then(function (r) { return r.json(); }),
      fetch('/data/weapons.json').then(function (r) { return r.json(); }),
      fetch('/data/armor.json').then(function (r) { return r.json(); }),
      fetch('/data/chassis.json').then(function (r) { return r.json(); })
    ]).then(function (results) {
      var gear = results[0], weapons = results[1], armor = results[2], chassis = results[3];
      chassisMap = chassis;

      var normWeapons = weapons.map(function (w) {
        return Object.assign({}, w, {
          category: w.discipline === 'melee' ? 'melee' : 'ranged',
          categoryLabel: w.chassisLabel || (w.discipline === 'melee' ? 'Melee Weapon' : 'Ranged Weapon'),
          traits: w.trait ? [w.trait] : []
        });
      });

      var normArmor = armor.map(function (a) {
        return Object.assign({}, a, { category: 'armor' });
      });

      allItems = [].concat(gear, normWeapons, normArmor);

      var catOrder = ['ranged', 'melee', 'armor'];
      var gearCats = [];
      gear.forEach(function (d) {
        if (d.category && gearCats.indexOf(d.category) === -1) gearCats.push(d.category);
      });
      var orderedCats = catOrder.concat(gearCats.filter(function (c) { return catOrder.indexOf(c) === -1; }));

      var catLabels = { ranged: 'Ranged Weapons', melee: 'Melee Weapons', armor: 'Armor' };
      gear.forEach(function (d) {
        if (d.category && d.categoryLabel) catLabels[d.category] = d.categoryLabel;
      });

      var bar = document.getElementById('cat-bar');
      orderedCats.forEach(function (cat) {
        var btn = document.createElement('button');
        btn.className = 'f-btn';
        btn.dataset.cat = cat;
        btn.textContent = catLabels[cat] || cat;
        btn.addEventListener('click', function () { setCat(btn); });
        bar.appendChild(btn);
      });

      renderList(allItems);
      recalc();
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

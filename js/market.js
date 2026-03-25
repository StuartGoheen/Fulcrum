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

  var DEBT_CREDITORS = [
    { id: 'hutt_cartel', name: 'The Hutt Cartel', interest: '10%', rate: 0.10, desc: 'They always collect. Always.' },
    { id: 'black_sun', name: 'Black Sun', interest: '15%', rate: 0.15, desc: "Xizor's network has a long reach and longer memory." },
    { id: 'imperial_surplus', name: 'Imperial Surplus Broker', interest: '20%', rate: 0.20, desc: 'Stolen manifest, borrowed time.' },
    { id: 'czerka_arms', name: 'Czerka Arms', interest: '25%', rate: 0.25, desc: 'Corporate collections. Legal in most systems.' },
    { id: 'local_fixer', name: 'Local Fixer', interest: '30%', rate: 0.30, desc: 'A friend of a friend. Favors owed.' },
  ];
  var DEBT_CREDITOR_NAMES = {};
  DEBT_CREDITORS.forEach(function(c) { DEBT_CREDITOR_NAMES[c.id] = c.name; });

  var CAT_ORDER = ['ranged', 'melee', 'armor'];
  var CAT_LABELS = { ranged: 'Ranged Weapons', melee: 'Melee Weapons', armor: 'Armor' };

  var allItems = [];
  var selected = null;
  var shoppingList = [];
  var activeRest = 'all';
  var mode = 'black';
  var chassisMap = {};
  var activeChar = null;
  var orderedCats = [];

  function parseAvail(raw) {
    var s = String(raw || '1').toUpperCase().trim().split('/');
    return { num: parseInt(s[0]) || 1, rest: s[1] || '' };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isPriceless(item) {
    return !item.cost && item.cost !== 0 && !item.innate;
  }

  function isSalvageEligible(item) {
    var a = parseAvail(item.availability);
    return a.rest !== 'R' && a.rest !== 'X' && !isPriceless(item);
  }

  var ALWAYS_CONTRABAND_IDS = [];
  function isAlwaysContraband(item) {
    if (ALWAYS_CONTRABAND_IDS.indexOf(item.id) >= 0) return true;
    var tags = item.tags || [];
    for (var i = 0; i < tags.length; i++) {
      var t = (tags[i] || '').toLowerCase();
      if (t === 'illegal' || t === 'contraband') return true;
    }
    var a = parseAvail(item.availability);
    if (a.rest === 'X') return true;
    return false;
  }

  function determineAcquisition(item, salvaged) {
    if (salvaged) return 'salvaged';
    if (isAlwaysContraband(item)) return 'contraband';
    var a = parseAvail(item.availability);
    if (a.rest === 'R') return 'contraband';
    if (a.rest === 'F') {
      return mode === 'market' ? 'registered' : 'contraband';
    }
    return 'legal';
  }

  function loadCharacterGate() {
    var gate = document.getElementById('char-gate');
    var list = document.getElementById('char-gate-list');

    fetch('/api/characters')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var chars = data.characters || [];
        if (!chars.length) {
          list.innerHTML = '<p class="char-gate-loading">No characters found. Create one first.</p>';
          return;
        }
        list.innerHTML = '';
        chars.forEach(function (c) {
          var card = document.createElement('div');
          card.className = 'char-gate-card';
          card.innerHTML =
            '<div class="char-gate-card-info">' +
              '<div class="char-gate-card-name">' + esc(c.name || 'Unnamed') + '</div>' +
              '<div class="char-gate-card-meta">' + esc(c.species || '') + (c.archetype ? ' · ' + esc(c.archetype) : '') + '</div>' +
            '</div>' +
            '<div class="char-gate-card-credits">' + (c.credits || 0).toLocaleString() + ' cr</div>';
          card.addEventListener('click', function () { selectCharacter(c); });
          list.appendChild(card);
        });
      })
      .catch(function () {
        list.innerHTML = '<p class="char-gate-loading">Failed to load roster.</p>';
      });
  }

  function selectCharacter(c) {
    activeChar = c;
    document.getElementById('char-gate').style.display = 'none';
    document.getElementById('mkt-app').style.display = 'flex';
    document.getElementById('request-fab').style.display = 'flex';
    document.getElementById('char-name-display').textContent = c.name || 'Unknown';
    document.getElementById('char-credits-display').textContent = (c.credits || 0).toLocaleString() + ' cr';
    updateLedger();
    applyFilters();
    recalc();
  }

  function switchCharacter() {
    activeChar = null;
    shoppingList = [];
    selected = null;
    document.getElementById('mkt-app').style.display = 'none';
    document.getElementById('request-fab').style.display = 'none';
    document.getElementById('char-gate').style.display = 'flex';
    loadCharacterGate();
  }

  var loanAmount = 1000;
  var loanCreditorIdx = 0;

  function updateLedger() {
    var banner = document.getElementById('ledger-banner');
    var loanOffer = document.getElementById('loan-offer');
    if (!activeChar) {
      banner.style.display = 'none';
      if (loanOffer) loanOffer.style.display = 'none';
      return;
    }

    var hasDebt = activeChar.debt && activeChar.debt.balance && activeChar.debt.balance > 0;
    if (hasDebt) {
      banner.style.display = 'flex';
      if (loanOffer) loanOffer.style.display = 'none';
      var d = activeChar.debt;
      document.getElementById('ledger-creditor').textContent = DEBT_CREDITOR_NAMES[d.creditorId] || d.creditorId;
      document.getElementById('ledger-balance').textContent = d.balance.toLocaleString() + ' cr owed';
      document.getElementById('ledger-principal').textContent = (d.principal || 0).toLocaleString() + ' cr';
      document.getElementById('ledger-rate').textContent = Math.round((d.rate || 0) * 100) + '%';
      document.getElementById('ledger-cycles').textContent = String(d.cyclesElapsed || 0);
      var nextBalance = Math.round(d.balance * (1 + (d.rate || 0)));
      document.getElementById('ledger-next').textContent = nextBalance.toLocaleString() + ' cr';
    } else {
      banner.style.display = 'none';
      if (loanOffer) {
        loanOffer.style.display = 'block';
        renderLoanOffer();
      }
    }
  }

  function renderLoanOffer() {
    var container = document.getElementById('loan-offer');
    if (!container) return;
    var cred = DEBT_CREDITORS[loanCreditorIdx];
    var html = '<div class="loan-offer-header"><span class="ledger-icon">📒</span><span class="ledger-banner-title">The Ledger</span></div>'
      + '<p class="loan-offer-desc">Need credits? Take on debt for extra buying power. Your creditor will come collecting — with interest.</p>'
      + '<div class="loan-offer-row"><label>Creditor</label><select id="loan-creditor-select">';
    DEBT_CREDITORS.forEach(function(c, i) {
      html += '<option value="' + i + '"' + (i === loanCreditorIdx ? ' selected' : '') + '>' + esc(c.name) + ' (' + c.interest + ')</option>';
    });
    html += '</select></div>'
      + '<p class="loan-offer-flavor">' + esc(cred.desc) + '</p>'
      + '<div class="loan-offer-row"><label>Loan Amount</label>'
      + '<div class="loan-stepper">'
      + '<button id="loan-minus" class="loan-step-btn">−</button>'
      + '<span id="loan-amount-display" class="loan-amount">' + loanAmount.toLocaleString() + ' cr</span>'
      + '<button id="loan-plus" class="loan-step-btn">+</button>'
      + '</div></div>'
      + '<button id="loan-borrow-btn" class="loan-borrow-btn">Borrow ' + loanAmount.toLocaleString() + ' cr</button>';
    container.innerHTML = html;

    document.getElementById('loan-creditor-select').addEventListener('change', function() {
      loanCreditorIdx = parseInt(this.value);
      renderLoanOffer();
    });
    document.getElementById('loan-minus').addEventListener('click', function() {
      loanAmount = Math.max(1000, loanAmount - 500);
      renderLoanOffer();
    });
    document.getElementById('loan-plus').addEventListener('click', function() {
      loanAmount = Math.min(10000, loanAmount + 500);
      renderLoanOffer();
    });
    document.getElementById('loan-borrow-btn').addEventListener('click', function() {
      takeLoan();
    });
  }

  function takeLoan() {
    if (!activeChar) return;
    var cred = DEBT_CREDITORS[loanCreditorIdx];
    var btn = document.getElementById('loan-borrow-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

    fetch('/api/characters/' + activeChar.id + '/debt/take', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditorId: cred.id, amount: loanAmount })
    })
    .then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Loan failed'); });
      return r.json();
    })
    .then(function(data) {
      activeChar.credits = data.credits;
      activeChar.debt = data.debt;
      document.getElementById('char-credits-display').textContent = data.credits.toLocaleString() + ' cr';
      updateLedger();
      recalc();
    })
    .catch(function(err) {
      alert(err.message || 'Failed to take loan.');
      if (btn) { btn.disabled = false; btn.textContent = 'Borrow ' + loanAmount.toLocaleString() + ' cr'; }
    });
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
    items.forEach(function (entry) {
      var item = entry.item || entry;
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

  function addToList(item, salvaged) {
    if (!item) return;
    if (isPriceless(item)) return;
    var existing = shoppingList.find(function (e) { return e.item.id === item.id && e.salvaged === salvaged; });
    if (existing) return;
    shoppingList.push({ item: item, salvaged: !!salvaged });
    updateCardButtons(item);
    updateSdPips();
    recalc();
  }

  function removeFromList(itemId, salvaged) {
    shoppingList = shoppingList.filter(function (e) {
      return !(e.item.id === itemId && e.salvaged === salvaged);
    });
    var item = allItems.find(function (it) { return it.id === itemId; });
    if (item) updateCardButtons(item);
    if (selected && selected.id === itemId) {
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
    document.querySelectorAll('.card-add-btn').forEach(function (b) { b.disabled = false; b.textContent = '+ Add'; });
    document.querySelectorAll('.card-salvage-btn').forEach(function (b) { b.disabled = false; });
    updateSdPips();
    recalc();
  }

  function updateCardButtons(item) {
    var card = document.querySelector('.armory-weapon-card[data-mid="' + item.id + '"]');
    if (!card) return;
    var inList = shoppingList.find(function (e) { return e.item.id === item.id && !e.salvaged; });
    var inListSalvaged = shoppingList.find(function (e) { return e.item.id === item.id && e.salvaged; });
    var addBtn = card.querySelector('.card-add-btn');
    var salvBtn = card.querySelector('.card-salvage-btn');
    if (addBtn) { addBtn.disabled = !!inList; addBtn.textContent = inList ? '✓ Added' : '+ Add'; }
    if (salvBtn) { salvBtn.disabled = !!inListSalvaged; }

    if (selected && selected.id === item.id) {
      var headerAdd = document.getElementById('add-btn');
      headerAdd.disabled = !!inList;
      headerAdd.textContent = inList ? '✓ Added' : '+ Add';
    }
  }

  function renderPackage(cVal, pVal, mVal, cl) {
    var pkgList  = document.getElementById('pkg-list');
    var noDeal   = document.getElementById('no-deal');
    var totalRow = document.getElementById('pkg-total-row');
    var totalVal = document.getElementById('pkg-total-val');
    var purchaseBtn = document.getElementById('purchase-btn');

    if (!shoppingList.length) {
      pkgList.innerHTML      = '<p class="pkg-empty">Add items from the left<br/>to build your list.</p>';
      noDeal.style.display   = 'none';
      totalRow.style.display = 'none';
      purchaseBtn.style.display = 'none';
      return;
    }

    var isFail   = cl && cl.fail === true;
    var hasCalc  = cVal !== null && pVal !== null;
    var total = 0, html = '', outOfStockCount = 0;

    shoppingList.forEach(function (entry) {
      var item = entry.item;
      var salvaged = entry.salvaged;
      var a = parseAvail(item.availability);
      var alwaysAvail = marketAlwaysAvailable(item);
      var notFound    = isFail && !alwaysAvail;

      if (notFound) {
        outOfStockCount++;
        html += '<div class="pkg-row" style="opacity:0.35;">'
          + '<span class="pkg-row-name">' + esc(item.name) + '</span>'
          + (salvaged ? '<span class="pkg-row-salvage-tag">SALVAGED</span>' : '')
          + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '" style="font-size:0.38rem;padding:0.04rem 0.18rem;">' + esc(a.rest || 'LEGAL') + '</span>'
          + '<span class="pkg-row-price pending">' + (mode === 'market' ? 'out of stock' : 'not found') + '</span>'
          + '<button class="pkg-remove" data-remove-id="' + esc(item.id) + '" data-salvaged="' + (salvaged ? '1' : '0') + '">✕</button>'
          + '</div>';
        return;
      }

      if (hasCalc || alwaysAvail) {
        var effectivePval = (alwaysAvail && isFail) ? 0 : (pVal || 0);
        var effectiveCval = (alwaysAvail && isFail) ? 0 : (cVal || 0);
        var itemPrice  = calcPrice(item, effectiveCval, effectivePval, mVal);
        if (salvaged) itemPrice = Math.round(itemPrice * 0.5);
        var licFee     = salvaged ? 0 : calcLicenseFee(item);
        total += itemPrice + licFee;

        html += '<div class="pkg-row">'
          + '<span class="pkg-row-name">' + esc(item.name) + '</span>'
          + (salvaged ? '<span class="pkg-row-salvage-tag">SALVAGED</span>' : '')
          + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '" style="font-size:0.38rem;padding:0.04rem 0.18rem;">' + esc(a.rest || 'LEGAL') + '</span>'
          + '<span class="pkg-row-price">' + itemPrice.toLocaleString() + ' cr</span>'
          + '<button class="pkg-remove" data-remove-id="' + esc(item.id) + '" data-salvaged="' + (salvaged ? '1' : '0') + '">✕</button>'
          + '</div>';

        if (licFee > 0) {
          html += '<div class="pkg-row-license">'
            + '<span class="pkg-row-license-label">+ Imperial License (F)</span>'
            + '<span class="pkg-row-license-val">+' + licFee.toLocaleString() + ' cr</span>'
            + '</div>';
        }
      } else {
        var basePrice = item.cost || 0;
        if (salvaged) basePrice = Math.round(basePrice * 0.5);
        var licFee2 = salvaged ? 0 : calcLicenseFee(item);
        html += '<div class="pkg-row">'
          + '<span class="pkg-row-name">' + esc(item.name) + '</span>'
          + (salvaged ? '<span class="pkg-row-salvage-tag">SALVAGED</span>' : '')
          + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '" style="font-size:0.38rem;padding:0.04rem 0.18rem;">' + esc(a.rest || 'LEGAL') + '</span>'
          + '<span class="pkg-row-price pending">' + basePrice.toLocaleString() + ' cr base</span>'
          + '<button class="pkg-remove" data-remove-id="' + esc(item.id) + '" data-salvaged="' + (salvaged ? '1' : '0') + '">✕</button>'
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
      btn.addEventListener('click', function () {
        removeFromList(btn.dataset.removeId, btn.dataset.salvaged === '1');
      });
    });

    if (isFail) {
      if (outOfStockCount === shoppingList.length) {
        noDeal.style.display = 'block';
        noDeal.className     = mode === 'market' ? 'out-of-stock-block' : 'no-deal-block';
        if (mode === 'market') {
          noDeal.textContent = 'Out of stock — check back next port.';
        } else {
          var worstRest = shoppingList.reduce(function (w, entry) {
            var r = parseAvail(entry.item.availability).rest;
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

    var showTotal = hasCalc || (isFail && shoppingList.some(function (entry) { return marketAlwaysAvailable(entry.item); }));
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
      purchaseBtn.style.display = 'block';
      purchaseBtn.disabled = false;
    } else {
      totalRow.style.display = 'none';
      purchaseBtn.style.display = 'none';
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
    if (isPriceless(item)) {
      addBtn.disabled = true;
      addBtn.textContent = 'Priceless';
    } else {
      var alreadyIn = shoppingList.find(function (e) { return e.item.id === item.id && !e.salvaged; });
      addBtn.disabled    = !!alreadyIn;
      addBtn.textContent = alreadyIn ? '✓ Added' : '+ Add';
    }

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
    var priceless = isPriceless(item);

    var metaSdParts = [];
    if (ctrlSD > 0) metaSdParts.push('Ctrl ↓' + ctrlSD);
    if (pwrSD  > 0) metaSdParts.push('Pwr ↓' + pwrSD);
    var metaSd = metaSdParts.join(' · ');

    var wp = item.discipline ? item : (item.weaponProfile || null);

    var meta = '<div class="armory-weapon-meta">';
    meta += '<span class="armory-weapon-chassis">' + esc(item.categoryLabel || item.category || '') + '</span>';
    if (wp && wp.range) meta += '<span class="armory-weapon-range">Range: ' + esc(renderRange(wp.range)) + '</span>';
    meta += '<span class="armory-weapon-cost">' + (priceless ? 'Priceless' : esc(cost)) + '</span>';
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

    var actionsHtml = '<div class="card-actions">';
    if (priceless) {
      actionsHtml += '<span class="card-priceless-tag">Beyond price — narrative acquisition only</span>';
    } else {
      var inList = shoppingList.find(function (e) { return e.item.id === item.id && !e.salvaged; });
      actionsHtml += '<button class="card-add-btn" data-add-id="' + esc(item.id) + '"' + (inList ? ' disabled' : '') + '>' + (inList ? '✓ Added' : '+ Add') + '</button>';
      if (isSalvageEligible(item)) {
        var inSalv = shoppingList.find(function (e) { return e.item.id === item.id && e.salvaged; });
        actionsHtml += '<button class="card-salvage-btn" data-salvage-id="' + esc(item.id) + '"' + (inSalv ? ' disabled' : '') + '>⚙ Salvaged (50%)</button>';
      }
    }
    actionsHtml += '</div>';

    return '<div class="armory-weapon-card" data-mid="' + esc(item.id) + '">'
      + '<div class="armory-weapon-header">'
      + '<span class="armory-weapon-name">' + esc(item.name) + '</span>'
      + '<span class="rbadge rbadge-' + esc(a.rest || 'none') + '">' + esc(a.rest || 'LEGAL') + '</span>'
      + '</div>'
      + '<div class="armory-weapon-body">'
      + meta + effectHtml + descHtml + traitsHtml + gambitsHtml + actionsHtml
      + '</div>'
      + '</div>';
  }

  function handleCardClick(cardEl, e) {
    if (e.target.closest('.card-add-btn') || e.target.closest('.card-salvage-btn') || e.target.closest('.armory-gambit-toggle')) return;

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
  }

  function bindCardEvents(container) {
    container.querySelectorAll('.armory-weapon-card').forEach(function (card) {
      card.addEventListener('click', function (e) { handleCardClick(card, e); });
    });
    container.querySelectorAll('.card-add-btn[data-add-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = allItems.find(function (it) { return it.id === btn.dataset.addId; });
        if (item) addToList(item, false);
      });
    });
    container.querySelectorAll('.card-salvage-btn[data-salvage-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = allItems.find(function (it) { return it.id === btn.dataset.salvageId; });
        if (item) addToList(item, true);
      });
    });
    container.querySelectorAll('.armory-gambit-toggle').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.stopPropagation();
        var block = t.closest('.armory-gambit-block');
        if (block) block.classList.toggle('is-open');
      });
    });
  }

  function renderList(items) {
    var list = document.getElementById('item-list');
    if (!items.length) {
      list.innerHTML = '<p class="mkt-loading-msg">No items match.</p>';
      return;
    }
    var groups = {};
    items.forEach(function (item) {
      var cat = item.category || 'other';
      (groups[cat] = groups[cat] || []).push(item);
    });

    var html = '';
    orderedCats.forEach(function (cat) {
      if (!groups[cat]) return;
      var label = CAT_LABELS[cat] || cat;
      var count = groups[cat].length;
      html += '<div class="accordion-section open" data-acc-cat="' + esc(cat) + '">';
      html += '<div class="accordion-header">';
      html += '<span class="accordion-chevron">&#9656;</span>';
      html += '<span class="accordion-label">' + esc(label) + '</span>';
      html += '<span class="accordion-count">' + count + '</span>';
      html += '</div>';
      html += '<div class="accordion-body">';
      groups[cat].forEach(function (item) { html += buildCard(item); });
      html += '</div></div>';
    });

    Object.keys(groups).forEach(function (cat) {
      if (orderedCats.indexOf(cat) !== -1) return;
      var label = CAT_LABELS[cat] || cat;
      var count = groups[cat].length;
      html += '<div class="accordion-section open" data-acc-cat="' + esc(cat) + '">';
      html += '<div class="accordion-header">';
      html += '<span class="accordion-chevron">&#9656;</span>';
      html += '<span class="accordion-label">' + esc(label) + '</span>';
      html += '<span class="accordion-count">' + count + '</span>';
      html += '</div>';
      html += '<div class="accordion-body">';
      groups[cat].forEach(function (item) { html += buildCard(item); });
      html += '</div></div>';
    });

    list.innerHTML = html;

    list.querySelectorAll('.accordion-header').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        hdr.closest('.accordion-section').classList.toggle('open');
      });
    });

    bindCardEvents(list);
  }

  function applyFilters() {
    var q = (document.getElementById('search').value || '').toLowerCase();
    var filtered = allItems.filter(function (item) {
      var a = parseAvail(item.availability);

      if (mode === 'market') {
        if (a.rest === 'R' || a.rest === 'X') return false;
        if (a.num >= 4) return false;
        if (isAlwaysContraband(item)) return false;
      }

      var matchRest = activeRest === 'all' || a.rest === activeRest;
      var matchQ    = !q || item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
      return matchRest && matchQ;
    });
    renderList(filtered);
  }

  function setRest(btn) {
    activeRest = btn.dataset.rest;
    document.querySelectorAll('#rest-bar .f-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    applyFilters();
  }

  function openPurchaseModal() {
    var cRaw = document.getElementById('ctrl-in').value;
    var pRaw = document.getElementById('pwr-in').value;
    var mRaw = document.getElementById('mod-in').value;
    var cVal = cRaw === '' ? null : parseInt(cRaw);
    var pVal = pRaw === '' ? null : Math.min(Math.max(parseInt(pRaw), 0), 12);
    var mVal = parseFloat(mRaw) || 0;

    var total = 0;
    var bodyHtml = '';
    shoppingList.forEach(function (entry) {
      var item = entry.item;
      var salvaged = entry.salvaged;
      var alwaysAvail = marketAlwaysAvailable(item);
      var cl = ctrlLabel(cVal);
      if (cl.fail && !alwaysAvail) return;

      var effectivePval = (alwaysAvail && cl.fail) ? 0 : (pVal || 0);
      var effectiveCval = (alwaysAvail && cl.fail) ? 0 : (cVal || 0);
      var price = calcPrice(item, effectiveCval, effectivePval, mVal);
      if (salvaged) price = Math.round(price * 0.5);
      var lic = salvaged ? 0 : calcLicenseFee(item);
      var lineTotal = price + lic;
      total += lineTotal;

      var acq = determineAcquisition(item, salvaged);
      var acqColor = acq === 'contraband' ? '#CC3333' : acq === 'salvaged' ? '#C8A000' : acq === 'registered' ? '#6fad6f' : '#6fad6f';
      var acqLabel = acq.charAt(0).toUpperCase() + acq.slice(1);
      bodyHtml += '<div class="modal-purchase-item">'
        + '<span>' + esc(item.name) + ' <em style="color:' + acqColor + ';font-size:0.85em">(' + acqLabel + ')</em></span>'
        + '<span>' + lineTotal.toLocaleString() + ' cr</span>'
        + '</div>';
    });

    var credits = activeChar ? (activeChar.credits || 0) : 0;
    var remaining = credits - total;

    bodyHtml += '<div class="modal-purchase-total"><span>Total</span><span>' + total.toLocaleString() + ' cr</span></div>';
    bodyHtml += '<div class="modal-purchase-balance"><span>Current Balance</span><span>' + credits.toLocaleString() + ' cr</span></div>';
    bodyHtml += '<div class="modal-purchase-balance"><span>After Purchase</span><span style="color:' + (remaining < 0 ? '#CC3333' : 'var(--color-text-primary)') + '">' + remaining.toLocaleString() + ' cr</span></div>';

    document.getElementById('purchase-modal-body').innerHTML = bodyHtml;
    document.getElementById('purchase-modal').style.display = 'flex';

    var confirmBtn = document.getElementById('purchase-confirm');
    confirmBtn.disabled = remaining < 0;
    confirmBtn.dataset.total = total;
  }

  function executePurchase() {
    var total = parseInt(document.getElementById('purchase-confirm').dataset.total) || 0;
    if (!activeChar) return;

    var cRaw = document.getElementById('ctrl-in').value;
    var cVal = cRaw === '' ? null : parseInt(cRaw);
    var cl = ctrlLabel(cVal);

    var items = [];
    shoppingList.forEach(function (entry) {
      var alwaysAvail = marketAlwaysAvailable(entry.item);
      if (cl.fail && !alwaysAvail) return;
      var cat = entry.item.category;
      var type = 'gear';
      if (cat === 'ranged' || cat === 'melee') type = 'weapon';
      else if (cat === 'armor') type = 'armor';
      var acq = determineAcquisition(entry.item, entry.salvaged);
      items.push({ id: entry.item.id, type: type, salvaged: entry.salvaged, acquisition: acq });
    });

    if (!items.length) return;

    document.getElementById('purchase-confirm').disabled = true;
    document.getElementById('purchase-confirm').textContent = 'Processing…';

    fetch('/api/characters/' + activeChar.id + '/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items, totalCost: total })
    })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Purchase failed'); });
      return r.json();
    })
    .then(function (data) {
      activeChar.credits = data.credits;
      document.getElementById('char-credits-display').textContent = data.credits.toLocaleString() + ' cr';
      shoppingList = [];
      document.getElementById('purchase-modal').style.display = 'none';
      document.getElementById('purchase-confirm').textContent = 'Pay & Acquire';
      recalc();
      applyFilters();
    })
    .catch(function (err) {
      alert(err.message || 'Purchase failed.');
      document.getElementById('purchase-confirm').disabled = false;
      document.getElementById('purchase-confirm').textContent = 'Pay & Acquire';
    });
  }

  function openRequestModal() {
    document.getElementById('request-modal').style.display = 'flex';
    document.getElementById('req-name').value = '';
    document.getElementById('req-desc').value = '';
    document.getElementById('req-link').value = '';
    document.getElementById('req-status').style.display = 'none';
  }

  function closeRequestModal() {
    document.getElementById('request-modal').style.display = 'none';
  }

  function submitRequest() {
    var itemName = document.getElementById('req-name').value.trim();
    var statusEl = document.getElementById('req-status');
    if (!itemName) { alert('Enter an item name.'); return; }
    if (!activeChar) { alert('No character selected.'); return; }
    var desc = document.getElementById('req-desc').value.trim();
    var link = document.getElementById('req-link').value.trim();
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--color-text-secondary)';
    statusEl.textContent = 'Submitting...';
    fetch('/api/item-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: activeChar.name,
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
      setTimeout(closeRequestModal, 2000);
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
    document.getElementById('add-btn').addEventListener('click', function () {
      if (selected && !isPriceless(selected)) addToList(selected, false);
    });
    document.getElementById('pkg-clear').addEventListener('click', clearList);
    document.getElementById('char-switch').addEventListener('click', switchCharacter);

    document.querySelectorAll('#rest-bar .f-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setRest(btn); });
    });

    document.getElementById('ledger-toggle').addEventListener('click', function () {
      var drawer = document.getElementById('ledger-drawer');
      var open = drawer.style.display === 'none';
      drawer.style.display = open ? 'block' : 'none';
      this.textContent = open ? 'Details ▴' : 'Details ▾';
    });

    document.getElementById('purchase-btn').addEventListener('click', openPurchaseModal);
    document.getElementById('purchase-cancel').addEventListener('click', function () {
      document.getElementById('purchase-modal').style.display = 'none';
    });
    document.getElementById('purchase-confirm').addEventListener('click', executePurchase);

    document.getElementById('request-fab').addEventListener('click', openRequestModal);
    document.getElementById('req-cancel').addEventListener('click', closeRequestModal);
    document.getElementById('req-submit').addEventListener('click', submitRequest);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.getElementById('purchase-modal').style.display = 'none';
        closeRequestModal();
      }
    });
  }

  function boot() {
    bindEvents();
    loadCharacterGate();

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

      var gearCats = [];
      gear.forEach(function (d) {
        if (d.category && gearCats.indexOf(d.category) === -1) gearCats.push(d.category);
      });
      orderedCats = CAT_ORDER.concat(gearCats.filter(function (c) { return CAT_ORDER.indexOf(c) === -1; }));

      gear.forEach(function (d) {
        if (d.category && d.categoryLabel && !CAT_LABELS[d.category]) {
          CAT_LABELS[d.category] = d.categoryLabel;
        }
      });

      applyFilters();
      recalc();
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

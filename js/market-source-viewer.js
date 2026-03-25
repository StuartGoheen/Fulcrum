(function () {
  'use strict';

  var DATASETS = {
    equipment: { url: '/data/equipment_source.json', label: 'Equipment' },
    weapons:   { url: '/data/weapons_source.json',   label: 'Weapons' }
  };

  var svData = { equipment: null, weapons: null };
  var svActive = 'equipment';
  var svFiltered = [];

  var SKIP_FIELDS = ['cost_raw', 'availability_raw', 'name', 'source'];
  var FIELD_ORDER = [
    'model', 'type', 'scale', 'skill', 'cost', 'availability',
    'damage', 'fire rate', 'fire control', 'range', 'blast radius', 'ammo', 'crew',
    'body strength', 'move', 'cover', 'altitude range', 'space range', 'atmosphere range',
    'shield code', 'cyber points', 'weight', 'length', 'capacity', 'size',
    'game notes', 'game effects', 'notes', 'source'
  ];

  function openSourceViewer() {
    var el = document.getElementById('sv-overlay');
    el.style.display = 'flex';
    svLoad(svActive);
  }

  function closeSourceViewer() {
    document.getElementById('sv-overlay').style.display = 'none';
  }

  function svSetDataset(ds) {
    svActive = ds;

    document.querySelectorAll('.sv-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.ds === ds);
    });

    document.getElementById('sv-search').value = '';
    document.getElementById('sv-type-filter').value = '';
    svClearDetail();
    svLoad(ds);
  }

  function svLoad(ds) {
    if (!svData[ds]) {
      fetch(DATASETS[ds].url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          svData[ds] = data;
          svBuildTypeFilter(ds);
          svFilter();
        });
    } else {
      svBuildTypeFilter(ds);
      svFilter();
    }
  }

  function svBuildTypeFilter(ds) {
    var typesSet = {};
    (svData[ds] || []).forEach(function (x) {
      if (x.type) typesSet[x.type] = true;
    });
    var types = Object.keys(typesSet).sort();
    var sel = document.getElementById('sv-type-filter');
    sel.innerHTML = '<option value="">All Types</option>';
    types.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    });
  }

  function svFilter() {
    var data = svData[svActive] || [];
    var q    = (document.getElementById('sv-search').value || '').toLowerCase();
    var type = document.getElementById('sv-type-filter').value;
    svFiltered = data.filter(function (item) {
      if (type && item.type !== type) return false;
      if (!q) return true;
      return (item.name   || '').toLowerCase().includes(q)
          || (item.type   || '').toLowerCase().includes(q)
          || (item.source || '').toLowerCase().includes(q);
    });
    svRenderList();
  }

  function svRenderList() {
    var list = document.getElementById('sv-list');
    document.getElementById('sv-count').textContent = svFiltered.length + ' items';
    list.innerHTML = '';
    svFiltered.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'sv-list-row';

      var nameEl = document.createElement('div');
      nameEl.className = 'sv-list-row-name';
      nameEl.textContent = item.model || item.name || '—';
      row.appendChild(nameEl);

      var typeEl = document.createElement('div');
      typeEl.className = 'sv-list-row-type';
      typeEl.textContent = item.type || '';
      row.appendChild(typeEl);

      row.addEventListener('click', function () { svSelectItem(item, row); });
      list.appendChild(row);
    });
  }

  function svSelectItem(item, rowEl) {
    document.querySelectorAll('#sv-list .sv-list-row').forEach(function (r) {
      r.classList.remove('active');
    });
    rowEl.classList.add('active');
    svRenderDetail(item);
  }

  function svRenderDetail(item) {
    var panel = document.getElementById('sv-detail');
    var seen = {};
    var allKeys = [];
    FIELD_ORDER.forEach(function (k) {
      if (k in item && !seen[k] && SKIP_FIELDS.indexOf(k) === -1) {
        allKeys.push(k);
        seen[k] = true;
      }
    });
    Object.keys(item).forEach(function (k) {
      if (!seen[k] && SKIP_FIELDS.indexOf(k) === -1) {
        allKeys.push(k);
        seen[k] = true;
      }
    });

    var titleEl = document.createElement('div');
    titleEl.className = 'sv-detail-title';
    titleEl.textContent = item.model || item.name || '—';

    var table = document.createElement('table');
    table.className = 'sv-detail-table';

    allKeys.forEach(function (k) {
      var val = item[k];
      if (val === null || val === undefined || val === '') return;
      var tr = document.createElement('tr');
      var tdKey = document.createElement('td');
      tdKey.textContent = k;
      var tdVal = document.createElement('td');
      tdVal.textContent = String(val);
      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      table.appendChild(tr);
    });

    panel.innerHTML = '';
    panel.appendChild(titleEl);
    panel.appendChild(table);
  }

  function svClearDetail() {
    var panel = document.getElementById('sv-detail');
    panel.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'sv-detail-empty';
    p.textContent = 'Select an item to view its fields.';
    panel.appendChild(p);
  }

  function bindEvents() {
    document.getElementById('sv-open').addEventListener('click', openSourceViewer);
    document.getElementById('sv-close-btn').addEventListener('click', closeSourceViewer);
    document.getElementById('sv-search').addEventListener('input', svFilter);
    document.getElementById('sv-type-filter').addEventListener('change', svFilter);

    document.querySelectorAll('.sv-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { svSetDataset(tab.dataset.ds); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSourceViewer();
    });
  }

  document.addEventListener('DOMContentLoaded', bindEvents);
})();

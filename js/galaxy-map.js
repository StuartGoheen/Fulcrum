(function () {
  'use strict';

  var map = null;
  var planetData = [];
  var hyperlaneData = [];
  var campaignPins = [];
  var planetMarkers = [];
  var hyperlaneLines = [];
  var pinMarkers = [];
  var gridLayer = null;
  var currentLocMarker = null;
  var markerClusterGroup = null;
  var showHyperlanes = false;
  var showGrid = true;
  var overlayEl = null;
  var searchInput = null;
  var searchResults = null;

  var IMG_W = 1600;
  var IMG_H = 1000;
  var BOUNDS = [[0, 0], [IMG_H, IMG_W]];

  var GAL_LEFT   = 0.214;
  var GAL_TOP    = 0.020;
  var GAL_RIGHT  = 0.689;
  var GAL_BOTTOM = 0.780;
  var GAL_W = GAL_RIGHT - GAL_LEFT;
  var GAL_H = GAL_BOTTOM - GAL_TOP;

  var REGION_COLORS = {
    'Core Worlds': '#4fc3f7',
    'Deep Core': '#7986cb',
    'Colonies': '#64b5f6',
    'Inner Rim': '#4db6ac',
    'Mid Rim': '#81c784',
    'Outer Rim': '#ffb74d',
    'Unknown Regions': '#e57373',
    'Wild Space': '#ce93d8',
    'Hutt Space': '#a1887f'
  };

  function toLatLng(nx, ny) {
    var imgX = (GAL_LEFT + nx * GAL_W) * IMG_W;
    var imgY = (GAL_TOP + ny * GAL_H) * IMG_H;
    return [IMG_H - imgY, imgX];
  }

  function fromLatLng(latlng) {
    var imgX = latlng.lng / IMG_W;
    var imgY = 1 - (latlng.lat / IMG_H);
    return {
      x: (imgX - GAL_LEFT) / GAL_W,
      y: (imgY - GAL_TOP) / GAL_H
    };
  }

  function createOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'galaxy-map-overlay';
    overlayEl.innerHTML =
      '<div class="gm-map-header">' +
        '<div class="gm-map-title">GALAXY MAP</div>' +
        '<div class="gm-map-controls">' +
          '<input type="text" id="gm-planet-search" class="gm-search-input" placeholder="Search planets..." autocomplete="off" />' +
          '<div id="gm-search-results" class="gm-search-results"></div>' +
          '<button class="gm-ctrl-btn" id="gm-toggle-lanes" title="Toggle Hyperlanes">Lanes</button>' +
          '<button class="gm-ctrl-btn" id="gm-toggle-grid" title="Toggle Grid">Grid</button>' +
          '<button class="gm-ctrl-btn" id="gm-grid-adjust" title="Adjust Grid Position">Adjust</button>' +
          '<button class="gm-ctrl-btn gm-close-btn" id="gm-close-map" title="Close Map">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div id="gm-map-container"></div>' +
      '<div class="gm-map-legend">' +
        '<span class="gm-legend-title">REGIONS:</span>' +
        '<span class="gm-legend-item" style="color:#4fc3f7;">Core</span>' +
        '<span class="gm-legend-item" style="color:#81c784;">Mid Rim</span>' +
        '<span class="gm-legend-item" style="color:#ffb74d;">Outer Rim</span>' +
        '<span class="gm-legend-item" style="color:#e57373;">Unknown</span>' +
        '<span class="gm-legend-item" style="color:#ce93d8;">Wild Space</span>' +
        '<span class="gm-legend-sep">|</span>' +
        '<span class="gm-legend-item" style="color:#ffd54f;">&#9733; Campaign</span>' +
        '<span class="gm-legend-item" style="color:#ef5350;">&#9873; Pin</span>' +
        '<span class="gm-legend-sep">|</span>' +
        '<span class="gm-legend-hint">Right-click map to place pin</span>' +
      '</div>';
    document.body.appendChild(overlayEl);

    document.getElementById('gm-close-map').addEventListener('click', closeMap);
    document.getElementById('gm-toggle-lanes').addEventListener('click', toggleHyperlanes);
    document.getElementById('gm-toggle-grid').addEventListener('click', toggleGrid);
    document.getElementById('gm-grid-adjust').addEventListener('click', function () {
      var panel = document.getElementById('gm-grid-controller');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? '' : 'none';
      } else {
        initGridController();
      }
    });

    searchInput = document.getElementById('gm-planet-search');
    searchResults = document.getElementById('gm-search-results');
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', handleSearch);
    document.addEventListener('click', function (e) {
      if (!searchResults.contains(e.target) && e.target !== searchInput) {
        searchResults.style.display = 'none';
      }
    });

    return overlayEl;
  }

  function openMap() {
    createOverlay();
    overlayEl.classList.add('visible');
    document.body.style.overflow = 'hidden';
    if (!map) {
      initMap();
    } else {
      map.invalidateSize();
    }
  }

  function closeMap() {
    if (overlayEl) {
      overlayEl.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }

  function initMap() {
    map = L.map('gm-map-container', {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 4,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBounds: [[-100, -200], [IMG_H + 100, IMG_W + 200]],
      maxBoundsViscosity: 0.8,
      attributionControl: false,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    var galaxyUrl = '/attached_assets/galaxy-map-bg.png';
    L.imageOverlay(galaxyUrl, BOUNDS).addTo(map);
    map.fitBounds(BOUNDS);

    map.on('contextmenu', function (e) {
      var coords = fromLatLng(e.latlng);
      showPinDialog(coords.x, coords.y);
    });

    loadGridConfig(function () {
      loadData();

      if (showGrid) {
        showGrid = false;
        toggleGrid();
      }
    });
  }

  function safeFetch(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' returned ' + r.status);
      return r.json();
    });
  }

  function loadData() {
    Promise.all([
      safeFetch('/data/galaxy-planets.json'),
      safeFetch('/data/galaxy-hyperlanes.json'),
      safeFetch('/api/galaxy-pins').catch(function () { return []; })
    ]).then(function (results) {
      planetData = results[0];
      hyperlaneData = results[1];
      campaignPins = results[2];
      renderPlanets();
      renderHyperlanes();
      renderPins();
      setCurrentLocation();
    }).catch(function (err) {
      console.error('[galaxy-map] Failed to load data:', err);
    });
  }

  function renderPlanets() {
    if (markerClusterGroup) {
      map.removeLayer(markerClusterGroup);
    }

    markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 20,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 0,
      showCoverageOnHover: false,
      iconCreateFunction: function (cluster) {
        var count = cluster.getChildCount();
        return L.divIcon({
          html: '<div class="gm-cluster-icon">' + count + '</div>',
          className: 'gm-cluster-wrapper',
          iconSize: [30, 30]
        });
      }
    });

    planetMarkers = [];
    planetData.forEach(function (p) {
      var ll = toLatLng(p.x, p.y);
      var isCampaign = !!p.campaign;
      var color = isCampaign ? '#ffd54f' : '#00e5ff';
      var size = isCampaign ? 10 : 8;
      var glow = isCampaign ? 'box-shadow:0 0 8px 2px #ffd54f;' : 'box-shadow:0 0 6px 1px rgba(0,229,255,0.5);';
      var border = isCampaign ? 'border:2px solid #ffd54f;' : 'border:1px solid rgba(0,229,255,0.6);';

      var icon = L.divIcon({
        html: '<div class="gm-planet-dot" style="background:' + color + ';width:' + size + 'px;height:' + size + 'px;' + border + glow + '"></div>' +
              '<div class="gm-planet-label' + (isCampaign ? ' gm-campaign-label' : '') + '">' + esc(p.name) + '</div>',
        className: 'gm-planet-icon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      var marker = L.marker(ll, { icon: icon });
      marker.bindPopup(buildPopup(p), { className: 'gm-popup', maxWidth: 320 });
      marker._planetData = p;
      markerClusterGroup.addLayer(marker);
      planetMarkers.push(marker);
    });

    map.addLayer(markerClusterGroup);
  }

  function buildPopup(p) {
    var isCampaign = !!p.campaign;
    var regionColor = REGION_COLORS[p.region] || '#aaa';
    var h = '<div class="gm-popup-inner">';
    h += '<div class="gm-popup-name">' + esc(p.name) + (isCampaign ? ' <span class="gm-popup-campaign">CAMPAIGN</span>' : '') + '</div>';
    h += '<div class="gm-popup-meta"><span style="color:' + regionColor + ';">' + esc(p.region) + '</span>';
    if (p.sector) h += ' &mdash; ' + esc(p.sector) + ' Sector';
    if (p.gridSquare) h += ' &mdash; Grid ' + esc(p.gridSquare);
    h += '</div>';
    h += '<div class="gm-popup-desc">' + esc(p.desc) + '</div>';
    h += '</div>';
    return h;
  }

  function renderHyperlanes() {
    hyperlaneLines.forEach(function (l) { map.removeLayer(l); });
    hyperlaneLines = [];

    if (!showHyperlanes) return;

    hyperlaneData.forEach(function (lane) {
      var pts = lane.points.map(function (p) { return toLatLng(p[0], p[1]); });

      var glowLine = L.polyline(pts, {
        color: lane.color,
        weight: 6,
        opacity: 0,
        smoothFactor: 1.5,
        interactive: false,
        className: 'gm-lane-glow'
      });
      glowLine.addTo(map);
      hyperlaneLines.push(glowLine);

      var bgLine = L.polyline(pts, {
        color: lane.color,
        weight: 4,
        opacity: 0.15,
        smoothFactor: 1.5,
        interactive: false
      });
      bgLine.addTo(map);
      hyperlaneLines.push(bgLine);

      var fgLine = L.polyline(pts, {
        color: lane.color,
        weight: 2,
        opacity: 0.7,
        dashArray: '8 4',
        smoothFactor: 1.5,
        interactive: false
      });
      fgLine.addTo(map);
      hyperlaneLines.push(fgLine);

      var hitLine = L.polyline(pts, {
        color: '#000',
        weight: 20,
        opacity: 0,
        smoothFactor: 1.5,
        interactive: true
      });
      hitLine.bindTooltip(lane.name, {
        permanent: false,
        sticky: true,
        direction: 'top',
        offset: [0, -10],
        className: 'gm-lane-tooltip'
      });
      hitLine.on('mouseover', function () {
        fgLine.setStyle({ weight: 3, opacity: 1, dashArray: null });
        bgLine.setStyle({ weight: 8, opacity: 0.3 });
        glowLine.setStyle({ opacity: 0.25, weight: 12 });
      });
      hitLine.on('mouseout', function () {
        fgLine.setStyle({ weight: 2, opacity: 0.7, dashArray: '8 4' });
        bgLine.setStyle({ weight: 4, opacity: 0.15 });
        glowLine.setStyle({ opacity: 0, weight: 6 });
      });
      hitLine.addTo(map);
      hyperlaneLines.push(hitLine);
    });
  }

  function renderPins() {
    pinMarkers.forEach(function (m) { map.removeLayer(m); });
    pinMarkers = [];

    campaignPins.forEach(function (pin) {
      addPinMarker(pin);
    });
  }

  function addPinMarker(pin) {
    var ll = toLatLng(pin.x, pin.y);
    var icon = L.divIcon({
      html: '<div class="gm-pin-marker">&#9873;</div><div class="gm-pin-label">' + esc(pin.title) + '</div>',
      className: 'gm-pin-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 20]
    });

    var marker = L.marker(ll, { icon: icon, draggable: false });
    var popupHtml = '<div class="gm-popup-inner">' +
      '<div class="gm-popup-name" style="color:#ef5350;">' + esc(pin.title) + '</div>' +
      (pin.note ? '<div class="gm-popup-desc">' + esc(pin.note) + '</div>' : '') +
      '<div class="gm-pin-actions">' +
        '<button class="gm-pin-edit" data-pin-id="' + pin.id + '">Edit</button>' +
        '<button class="gm-pin-delete" data-pin-id="' + pin.id + '">Delete</button>' +
      '</div>' +
    '</div>';
    marker.bindPopup(popupHtml, { className: 'gm-popup', maxWidth: 280 });
    marker._pinData = pin;

    marker.on('popupopen', function () {
      var popup = marker.getPopup();
      var container = popup.getElement();
      if (!container) return;
      var editBtn = container.querySelector('.gm-pin-edit');
      var deleteBtn = container.querySelector('.gm-pin-delete');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          marker.closePopup();
          showPinDialog(pin.x, pin.y, pin);
        });
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          deletePin(pin.id, marker);
        });
      }
    });

    marker.addTo(map);
    pinMarkers.push(marker);
    return marker;
  }

  function showPinDialog(x, y, existingPin) {
    var isEdit = !!existingPin;
    var dialog = document.createElement('div');
    dialog.className = 'gm-pin-dialog';
    dialog.innerHTML =
      '<div class="gm-pin-dialog-inner">' +
        '<div class="gm-pin-dialog-title">' + (isEdit ? 'EDIT PIN' : 'NEW CAMPAIGN PIN') + '</div>' +
        '<input type="text" id="gm-pin-title-input" class="gm-pin-input" placeholder="Pin title..." value="' + (isEdit ? esc(existingPin.title) : '') + '" />' +
        '<textarea id="gm-pin-note-input" class="gm-pin-textarea" placeholder="Notes (optional)...">' + (isEdit ? esc(existingPin.note) : '') + '</textarea>' +
        '<div class="gm-pin-dialog-btns">' +
          '<button class="gm-ctrl-btn" id="gm-pin-cancel">Cancel</button>' +
          '<button class="gm-ctrl-btn gm-pin-save" id="gm-pin-save">' + (isEdit ? 'Update' : 'Place Pin') + '</button>' +
        '</div>' +
      '</div>';
    overlayEl.appendChild(dialog);

    var titleInput = document.getElementById('gm-pin-title-input');
    titleInput.focus();

    document.getElementById('gm-pin-cancel').addEventListener('click', function () {
      dialog.remove();
    });

    document.getElementById('gm-pin-save').addEventListener('click', function () {
      var title = titleInput.value.trim();
      var note = document.getElementById('gm-pin-note-input').value.trim();
      if (!title) { titleInput.style.borderColor = '#ef5350'; return; }

      if (isEdit) {
        fetch('/api/galaxy-pins/' + existingPin.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, note: note })
        }).then(function (r) {
          if (!r.ok) throw new Error('Update failed: ' + r.status);
          return r.json();
        }).then(function (updated) {
          var idx = campaignPins.findIndex(function (p) { return p.id === existingPin.id; });
          if (idx !== -1) campaignPins[idx] = updated;
          renderPins();
          dialog.remove();
        }).catch(function (err) { console.error('[galaxy-map] Pin update error:', err); });
      } else {
        fetch('/api/galaxy-pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, note: note, x: x, y: y })
        }).then(function (r) {
          if (!r.ok) throw new Error('Create failed: ' + r.status);
          return r.json();
        }).then(function (pin) {
          campaignPins.push(pin);
          addPinMarker(pin);
          dialog.remove();
        }).catch(function (err) { console.error('[galaxy-map] Pin create error:', err); });
      }
    });

    titleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('gm-pin-save').click();
      if (e.key === 'Escape') dialog.remove();
    });
  }

  function deletePin(pinId, marker) {
    fetch('/api/galaxy-pins/' + pinId, { method: 'DELETE' })
      .then(function (r) {
        if (!r.ok) throw new Error('Delete failed: ' + r.status);
        map.removeLayer(marker);
        var idx = pinMarkers.indexOf(marker);
        if (idx !== -1) pinMarkers.splice(idx, 1);
        campaignPins = campaignPins.filter(function (p) { return p.id !== pinId; });
      }).catch(function (err) { console.error('[galaxy-map] Pin delete error:', err); });
  }

  function setCurrentLocation() {
    var ajak = planetData.find(function (p) { return p.name === 'Ajan Kloss'; });
    if (!ajak) {
      ajak = planetData.find(function (p) { return p.name === 'Jakku'; });
    }
    if (!ajak) return;
    if (currentLocMarker) map.removeLayer(currentLocMarker);
    var ll = toLatLng(ajak.x, ajak.y);
    currentLocMarker = L.circleMarker(ll, {
      radius: 18,
      color: '#ffd54f',
      weight: 2,
      opacity: 0.7,
      fillColor: '#ffd54f',
      fillOpacity: 0.08,
      dashArray: '4 4',
      interactive: false
    });
    currentLocMarker.addTo(map);
  }

  function toggleHyperlanes() {
    showHyperlanes = !showHyperlanes;
    var btn = document.getElementById('gm-toggle-lanes');
    btn.classList.toggle('active', showHyperlanes);
    renderHyperlanes();
  }

  function buildGridLayer() {
    var layer = L.layerGroup();
    var cols = 21;
    var rows = 21;
    var galPxL = GAL_LEFT * IMG_W;
    var galPxT = GAL_TOP * IMG_H;
    var galPxW = GAL_W * IMG_W;
    var galPxH = GAL_H * IMG_H;
    var cellW = galPxW / cols;
    var cellH = galPxH / rows;
    var letters = 'ABCDEFGHIJKLMNOPQRSTU';

    for (var c = 0; c <= cols; c++) {
      var x = galPxL + c * cellW;
      var latTop = IMG_H - galPxT;
      var latBot = IMG_H - (galPxT + galPxH);
      L.polyline([[latTop, x], [latBot, x]], {
        color: 'rgba(255,255,255,0.25)',
        weight: 1,
        interactive: false
      }).addTo(layer);
    }
    for (var r = 0; r <= rows; r++) {
      var y = galPxT + r * cellH;
      var lat = IMG_H - y;
      L.polyline([[lat, galPxL], [lat, galPxL + galPxW]], {
        color: 'rgba(255,255,255,0.25)',
        weight: 1,
        interactive: false
      }).addTo(layer);
    }

    for (var gr = 0; gr < rows; gr++) {
      for (var gc = 0; gc < cols; gc++) {
        var cy = IMG_H - (galPxT + gr * cellH + cellH / 2);
        var cx = galPxL + gc * cellW + cellW / 2;
        var label = letters[gc] + '-' + (gr + 1);
        L.marker([cy, cx], {
          icon: L.divIcon({
            html: '<span class="gm-grid-label">' + label + '</span>',
            className: 'gm-grid-label-wrapper',
            iconSize: [44, 18]
          }),
          interactive: false
        }).addTo(layer);
      }
    }
    return layer;
  }

  function rebuildGrid() {
    GAL_W = GAL_RIGHT - GAL_LEFT;
    GAL_H = GAL_BOTTOM - GAL_TOP;
    if (gridLayer) {
      map.removeLayer(gridLayer);
      gridLayer = null;
    }
    gridLayer = buildGridLayer();
    if (showGrid) {
      gridLayer.addTo(map);
    }
    updateControllerReadout();
  }

  function updateControllerReadout() {
    var el = document.getElementById('gm-grid-readout');
    if (el) {
      var px = Math.round(GAL_W * IMG_W);
      el.textContent = px + 'px | L:' + GAL_LEFT.toFixed(3) + ' T:' + GAL_TOP.toFixed(3);
    }
    var slider = document.getElementById('gm-gc-size');
    if (slider) {
      slider.value = Math.round(GAL_W * IMG_W);
      var sizeVal = document.getElementById('gm-gc-size-val');
      if (sizeVal) sizeVal.textContent = Math.round(GAL_W * IMG_W);
    }
  }

  function initGridController() {
    var panel = document.createElement('div');
    panel.id = 'gm-grid-controller';
    panel.innerHTML =
      '<div class="gm-gc-title">Grid Adjust</div>' +
      '<div class="gm-gc-arrows">' +
        '<button data-dir="up" title="Move Up">&#9650;</button>' +
        '<div class="gm-gc-lr">' +
          '<button data-dir="left" title="Move Left">&#9664;</button>' +
          '<button data-dir="right" title="Move Right">&#9654;</button>' +
        '</div>' +
        '<button data-dir="down" title="Move Down">&#9660;</button>' +
      '</div>' +
      '<label class="gm-gc-size-label">Size <span id="gm-gc-size-val">' + Math.round(GAL_W * IMG_W) + '</span>px</label>' +
      '<input type="range" id="gm-gc-size" min="500" max="1000" value="' + Math.round(GAL_W * IMG_W) + '" step="5">' +
      '<div id="gm-grid-readout" class="gm-gc-readout"></div>' +
      '<button id="gm-gc-save" class="gm-gc-save-btn">Save Position</button>' +
      '<button id="gm-gc-close" class="gm-gc-close-btn">Close</button>';

    overlayEl.appendChild(panel);

    var STEP = 0.005;

    panel.querySelectorAll('[data-dir]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-dir');
        if (dir === 'left')  { GAL_LEFT -= STEP; GAL_RIGHT -= STEP; }
        if (dir === 'right') { GAL_LEFT += STEP; GAL_RIGHT += STEP; }
        if (dir === 'up')    { GAL_TOP -= STEP; GAL_BOTTOM -= STEP; }
        if (dir === 'down')  { GAL_TOP += STEP; GAL_BOTTOM += STEP; }
        rebuildGrid();
      });
    });

    var slider = document.getElementById('gm-gc-size');
    var sizeVal = document.getElementById('gm-gc-size-val');
    slider.addEventListener('input', function () {
      var px = parseInt(slider.value, 10);
      sizeVal.textContent = px;
      var centerX = (GAL_LEFT + GAL_RIGHT) / 2;
      var centerY = (GAL_TOP + GAL_BOTTOM) / 2;
      var halfW = (px / IMG_W) / 2;
      var halfH = (px / IMG_H) / 2;
      GAL_LEFT = centerX - halfW;
      GAL_RIGHT = centerX + halfW;
      GAL_TOP = centerY - halfH;
      GAL_BOTTOM = centerY + halfH;
      rebuildGrid();
    });

    document.getElementById('gm-gc-save').addEventListener('click', function () {
      var saveBtn = document.getElementById('gm-gc-save');
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
      fetch('/api/grid-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left: parseFloat(GAL_LEFT.toFixed(4)),
          top: parseFloat(GAL_TOP.toFixed(4)),
          right: parseFloat(GAL_RIGHT.toFixed(4)),
          bottom: parseFloat(GAL_BOTTOM.toFixed(4))
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('Save failed');
        return r.json();
      }).then(function () {
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = 'rgba(76,175,80,0.3)';
        setTimeout(function () {
          saveBtn.textContent = 'Save Position';
          saveBtn.style.background = '';
          saveBtn.disabled = false;
        }, 2000);
      }).catch(function () {
        saveBtn.textContent = 'Save Failed';
        saveBtn.style.background = 'rgba(244,67,54,0.3)';
        setTimeout(function () {
          saveBtn.textContent = 'Save Position';
          saveBtn.style.background = '';
          saveBtn.disabled = false;
        }, 2000);
      });
    });

    document.getElementById('gm-gc-close').addEventListener('click', function () {
      panel.style.display = 'none';
    });

    updateControllerReadout();
  }

  function loadGridConfig(callback) {
    fetch('/api/grid-config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg) {
          GAL_LEFT = cfg.left;
          GAL_TOP = cfg.top;
          GAL_RIGHT = cfg.right;
          GAL_BOTTOM = cfg.bottom;
          GAL_W = GAL_RIGHT - GAL_LEFT;
          GAL_H = GAL_BOTTOM - GAL_TOP;
        }
        if (callback) callback();
      })
      .catch(function () {
        if (callback) callback();
      });
  }

  function toggleGrid() {
    showGrid = !showGrid;
    var btn = document.getElementById('gm-toggle-grid');
    btn.classList.toggle('active', showGrid);

    if (showGrid && !gridLayer) {
      gridLayer = buildGridLayer();
    }

    if (showGrid && gridLayer) {
      gridLayer.addTo(map);
    } else if (!showGrid && gridLayer) {
      map.removeLayer(gridLayer);
    }
  }

  function handleSearch() {
    var q = searchInput.value.trim().toLowerCase();
    if (!q) {
      searchResults.style.display = 'none';
      return;
    }
    var matches = planetData.filter(function (p) {
      return p.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 10);

    if (matches.length === 0) {
      searchResults.style.display = 'none';
      return;
    }

    searchResults.innerHTML = matches.map(function (p) {
      var color = REGION_COLORS[p.region] || '#aaa';
      return '<div class="gm-search-item" data-planet="' + esc(p.name) + '">' +
        '<span class="gm-search-dot" style="background:' + color + ';"></span>' +
        '<span>' + esc(p.name) + '</span>' +
        '<span class="gm-search-region">' + esc(p.region) + '</span>' +
      '</div>';
    }).join('');
    searchResults.style.display = 'block';

    searchResults.querySelectorAll('.gm-search-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var name = el.dataset.planet;
        var planet = planetData.find(function (p) { return p.name === name; });
        if (planet) flyToPlanet(planet);
        searchResults.style.display = 'none';
        searchInput.value = '';
      });
    });
  }

  function flyToPlanet(planet) {
    var ll = toLatLng(planet.x, planet.y);
    map.flyTo(ll, 2, { duration: 1.2 });

    var marker = planetMarkers.find(function (m) { return m._planetData && m._planetData.name === planet.name; });
    if (marker) {
      if (markerClusterGroup.hasLayer(marker)) {
        markerClusterGroup.zoomToShowLayer(marker, function () {
          marker.openPopup();
        });
      } else {
        setTimeout(function () { marker.openPopup(); }, 1300);
      }
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.GalaxyMap = {
    open: openMap,
    close: closeMap
  };
})();

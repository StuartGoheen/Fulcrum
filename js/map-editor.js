const MAPS = {
  'burning-deck':   { img: 'burning-deck.png',           vw: 1024, vh: 635 },
  'switch-lair':    { img: 'switch-lair.png',             vw: 1024, vh: 716 },
  'landing-field':  { img: 'landing-field.png',           vw: 1024, vh: 576 },
  'vanishing-place':{ img: 'vanishing-place-rendered.png', vw: 1024, vh: 576 },
  'banshee':        { img: 'banshee.png',                  vw: 1024, vh: 946 },
  'jungle-trek':    { img: 'jungle-trek.png',              vw: 1024, vh: 1024 },
  'blackwind-point':{ img: 'blackwind-point-map.png',      vw: 1024, vh: 778 },
  'filtration-plant':{ img: 'filtration-plant.png',        vw: 1024, vh: 791 },
  'gladiator-pit':   { img: 'gladiator-pit.png',          vw: 846,  vh: 1024 },
  'aviary':          { img: 'aviary.png',                vw: 1024, vh: 828 },
  'knife-in-the-dark':{ img: 'knife-in-the-dark.png',    vw: 711,  vh: 1024 },
  'command-center':   { img: 'command-center.png',       vw: 715,  vh: 1024 },
  'dungeons':         { img: 'dungeons.png',            vw: 622,  vh: 1024 },
  'throne-room':      { img: 'throne-room.png',        vw: 746,  vh: 1024 },
  'throne-room-court':{ img: 'throne-room-court.png',  vw: 746,  vh: 1024 }
};

let hitboxes = [];
let selectedIdx = -1;
let currentMap = null;
let currentMapKey = '';
let zoom = 1;
let dragState = null;
let isDirty = false;

let gridOn = false;
let gridSize = 40;
let gridOffX = 0;
let gridOffY = 0;
let gridOpacity = 40;
let gridColor = 'white';
let gridLineWidth = 1;
let gridFocused = false;

const $ = id => document.getElementById(id);
const mapSelect = $('mapSelect');
const hitboxList = $('hitboxList');
const propsPanel = $('propsPanel');
const mapWrap = $('mapWrap');
const canvasArea = $('canvasArea');

function saveGridSettings() {
  if (!currentMapKey) return;
  const settings = { gridOn, gridSize, gridOffX, gridOffY, gridOpacity, gridColor, gridLineWidth };
  try { localStorage.setItem('grid_' + currentMapKey, JSON.stringify(settings)); } catch(e) {}
}

function restoreGridSettings(key) {
  try {
    const raw = localStorage.getItem('grid_' + key);
    if (!raw) return;
    const s = JSON.parse(raw);
    gridOn = !!s.gridOn;
    gridSize = s.gridSize || 40;
    gridOffX = s.gridOffX || 0;
    gridOffY = s.gridOffY || 0;
    gridOpacity = s.gridOpacity || 40;
    gridColor = s.gridColor || 'white';
    gridLineWidth = s.gridLineWidth || 1;
    $('gridToggle').textContent = gridOn ? 'On' : 'Off';
    $('gridToggle').className = 'grid-toggle' + (gridOn ? ' on' : '');
    $('gridSize').value = gridSize;
    $('gridOffX').value = gridOffX;
    $('gridOffY').value = gridOffY;
    $('gridOpacity').value = gridOpacity;
    $('gridLineWidth').value = gridLineWidth;
    $('gridColorWhite').className = 'grid-toggle' + (gridColor === 'white' ? ' on' : '');
    $('gridColorBlack').className = 'grid-toggle' + (gridColor === 'black' ? ' on' : '');
    gridFocused = false;
    updateGridModeLabel();
  } catch(e) {}
}

function markDirty() {
  isDirty = true;
  $('dirtyIndicator').className = 'dirty-indicator show';
  $('btnSave').className = 'btn save dirty';
}

function markClean() {
  isDirty = false;
  $('dirtyIndicator').className = 'dirty-indicator';
  $('btnSave').className = 'btn save';
}

function updateGridModeLabel() {
  const label = $('gridModeLabel');
  if (!gridOn) { label.textContent = ''; return; }
  label.textContent = gridFocused ? 'Arrow keys: move grid' : 'Arrow keys: move hitbox (click grid panel to switch)';
  label.style.color = gridFocused ? '#aaeaaa' : '#6a8a6a';
}

mapSelect.addEventListener('change', () => {
  if (isDirty && !confirm('You have unsaved changes. Switch maps anyway?')) {
    mapSelect.value = currentMapKey;
    return;
  }
  loadMap(mapSelect.value);
});

async function loadMap(key) {
  if (!key || !MAPS[key]) {
    mapWrap.innerHTML = '<div style="padding:40px;color:#555;font-style:italic;">Select a map.</div>';
    currentMapKey = '';
    return;
  }
  currentMap = MAPS[key];
  currentMapKey = key;

  const metaResp = await fetch('/api/maps/' + key + '/meta');
  if (metaResp.ok) {
    const meta = await metaResp.json();
    currentMap.vw = meta.vw;
    currentMap.vh = meta.vh;
    hitboxes = (meta.zones || []).map(z => ({ room: z.room, desc: z.desc, x: z.x, y: z.y, w: z.w, h: z.h, rx: '3' }));
    if (meta.gridConfig) {
      gridOn = !!meta.gridConfig.gridOn;
      gridSize = meta.gridConfig.gridSize || 40;
      gridOffX = meta.gridConfig.gridOffX || 0;
      gridOffY = meta.gridConfig.gridOffY || 0;
      gridOpacity = meta.gridConfig.gridOpacity || 40;
      gridColor = meta.gridConfig.gridColor || 'white';
      gridLineWidth = meta.gridConfig.gridLineWidth || 1;
      $('gridToggle').textContent = gridOn ? 'On' : 'Off';
      $('gridToggle').className = 'grid-toggle' + (gridOn ? ' on' : '');
      $('gridSize').value = gridSize;
      $('gridOffX').value = gridOffX;
      $('gridOffY').value = gridOffY;
      $('gridOpacity').value = gridOpacity;
      $('gridLineWidth').value = gridLineWidth;
      $('gridColorWhite').className = 'grid-toggle' + (gridColor === 'white' ? ' on' : '');
      $('gridColorBlack').className = 'grid-toggle' + (gridColor === 'black' ? ' on' : '');
      gridFocused = false;
      updateGridModeLabel();
    } else {
      restoreGridSettings(key);
    }
  } else {
    const resp = await fetch(key + '.html');
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const svgSource = doc.querySelector('svg');
    if (svgSource) {
      const vb = svgSource.getAttribute('viewBox');
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        currentMap.vw = parts[2];
        currentMap.vh = parts[3];
      }
    }
    hitboxes = [];
    doc.querySelectorAll('.hitbox').forEach(el => {
      hitboxes.push({
        room: el.getAttribute('data-room') || '',
        desc: el.getAttribute('data-desc') || '',
        x: parseFloat(el.getAttribute('x')) || 0,
        y: parseFloat(el.getAttribute('y')) || 0,
        w: parseFloat(el.getAttribute('width')) || 0,
        h: parseFloat(el.getAttribute('height')) || 0,
        rx: el.getAttribute('rx') || '3'
      });
    });
    restoreGridSettings(key);
  }

  selectedIdx = -1;
  propsPanel.classList.remove('visible');
  markClean();
  render();
  zoomFit();
}

function buildGridSVG(vw, vh) {
  if (!gridOn) return '';
  let lines = '';
  const op = gridOpacity / 100;
  const rgb = gridColor === 'black' ? '0,0,0' : '255,255,255';
  const style = `stroke:rgba(${rgb},${op});stroke-width:${gridLineWidth};`;
  for (let x = gridOffX % gridSize; x <= vw; x += gridSize) {
    if (x >= 0) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${vh}" style="${style}" pointer-events="none"/>`;
  }
  for (let y = gridOffY % gridSize; y <= vh; y += gridSize) {
    if (y >= 0) lines += `<line x1="0" y1="${y}" x2="${vw}" y2="${y}" style="${style}" pointer-events="none"/>`;
  }
  return lines;
}

function render() {
  if (!currentMap) return;
  const { img, vw, vh } = currentMap;

  let svgContent = '';

  svgContent += buildGridSVG(vw, vh);

  hitboxes.forEach((hb, i) => {
    const sel = i === selectedIdx ? ' selected' : '';
    svgContent += `<rect x="${hb.x}" y="${hb.y}" width="${hb.w}" height="${hb.h}" rx="${hb.rx || 3}" class="hb-rect${sel}" data-idx="${i}"/>`;
    const labelX = hb.x + hb.w / 2;
    const labelY = hb.y + hb.h / 2;
    const short = hb.room.length > 20 ? hb.room.slice(0, 18) + '...' : hb.room;
    svgContent += `<text x="${labelX}" y="${labelY}" class="hb-label${sel}">${short}</text>`;
  });

  if (selectedIdx >= 0) {
    const hb = hitboxes[selectedIdx];
    const hs = 7;
    const handles = [
      { cls: 'tl', cx: hb.x, cy: hb.y },
      { cls: 'tr', cx: hb.x + hb.w, cy: hb.y },
      { cls: 'bl', cx: hb.x, cy: hb.y + hb.h },
      { cls: 'br', cx: hb.x + hb.w, cy: hb.y + hb.h },
      { cls: 't',  cx: hb.x + hb.w/2, cy: hb.y },
      { cls: 'b',  cx: hb.x + hb.w/2, cy: hb.y + hb.h },
      { cls: 'l',  cx: hb.x, cy: hb.y + hb.h/2 },
      { cls: 'r',  cx: hb.x + hb.w, cy: hb.y + hb.h/2 },
    ];
    handles.forEach(h => {
      svgContent += `<rect x="${h.cx - hs/2}" y="${h.cy - hs/2}" width="${hs}" height="${hs}" class="resize-handle active ${h.cls}" data-handle="${h.cls}" data-idx="${selectedIdx}"/>`;
    });
  }

  mapWrap.innerHTML = `<img src="${img}" style="width:${vw}px;height:${vh}px;" draggable="false"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="position:absolute;top:0;left:0;width:${vw}px;height:${vh}px;">${svgContent}</svg>`;
  mapWrap.style.width = vw + 'px';
  mapWrap.style.height = vh + 'px';
  applyZoom();
  renderList();
}

function renderList() {
  hitboxList.innerHTML = '';
  hitboxes.forEach((hb, i) => {
    const div = document.createElement('div');
    div.className = 'hitbox-item' + (i === selectedIdx ? ' active' : '');
    div.innerHTML = `<div class="name">${hb.room || '(unnamed)'}</div><div class="coords">x:${Math.round(hb.x)} y:${Math.round(hb.y)} w:${Math.round(hb.w)} h:${Math.round(hb.h)}</div>`;
    div.addEventListener('click', () => selectHitbox(i));
    hitboxList.appendChild(div);
  });
}

function selectHitbox(idx) {
  selectedIdx = idx;
  gridFocused = false;
  updateGridModeLabel();
  const hb = hitboxes[idx];
  propsPanel.classList.add('visible');
  $('propName').value = hb.room;
  $('propX').value = Math.round(hb.x);
  $('propY').value = Math.round(hb.y);
  $('propW').value = Math.round(hb.w);
  $('propH').value = Math.round(hb.h);
  $('propDesc').value = hb.desc;
  render();
}

['propX','propY','propW','propH'].forEach(id => {
  $(id).addEventListener('input', () => {
    if (selectedIdx < 0) return;
    const hb = hitboxes[selectedIdx];
    hb.x = parseFloat($('propX').value) || 0;
    hb.y = parseFloat($('propY').value) || 0;
    hb.w = parseFloat($('propW').value) || 0;
    hb.h = parseFloat($('propH').value) || 0;
    markDirty();
    render();
  });
});
$('propName').addEventListener('input', () => { if (selectedIdx >= 0) { hitboxes[selectedIdx].room = $('propName').value; markDirty(); renderList(); } });
$('propDesc').addEventListener('input', () => { if (selectedIdx >= 0) { hitboxes[selectedIdx].desc = $('propDesc').value; markDirty(); } });

function svgPoint(e) {
  const svg = mapWrap.querySelector('svg');
  if (!svg) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM().inverse();
  const svgP = pt.matrixTransform(ctm);
  return { x: svgP.x, y: svgP.y };
}

mapWrap.addEventListener('mousedown', e => {
  const handle = e.target.closest('.resize-handle');
  if (handle) {
    e.preventDefault();
    const idx = parseInt(handle.dataset.idx);
    const hb = hitboxes[idx];
    dragState = { type: 'resize', idx, handle: handle.dataset.handle, startX: hb.x, startY: hb.y, startW: hb.w, startH: hb.h, origin: svgPoint(e) };
    return;
  }
  const rect = e.target.closest('.hb-rect');
  if (rect) {
    e.preventDefault();
    const idx = parseInt(rect.dataset.idx);
    selectHitbox(idx);
    const hb = hitboxes[idx];
    dragState = { type: 'move', idx, startX: hb.x, startY: hb.y, origin: svgPoint(e) };
    return;
  }
  if (e.target.tagName === 'IMG' || e.target.tagName === 'svg') {
    selectedIdx = -1;
    propsPanel.classList.remove('visible');
    render();
  }
});

window.addEventListener('mousemove', e => {
  if (!dragState) return;
  e.preventDefault();
  const p = svgPoint(e);
  const dx = p.x - dragState.origin.x;
  const dy = p.y - dragState.origin.y;
  const hb = hitboxes[dragState.idx];

  if (dragState.type === 'move') {
    hb.x = Math.round(dragState.startX + dx);
    hb.y = Math.round(dragState.startY + dy);
    markDirty();
  } else if (dragState.type === 'resize') {
    const h = dragState.handle;
    const s = dragState;
    let newX = s.startX, newY = s.startY, newW = s.startW, newH = s.startH;
    if (h === 'r' || h === 'br' || h === 'tr') newW = s.startW + dx;
    if (h === 'l' || h === 'bl' || h === 'tl') { newX = s.startX + dx; newW = s.startW - dx; }
    if (h === 'b' || h === 'br' || h === 'bl') newH = s.startH + dy;
    if (h === 't' || h === 'tr' || h === 'tl') { newY = s.startY + dy; newH = s.startH - dy; }
    if (newW < 10) { newW = 10; if (h === 'l' || h === 'bl' || h === 'tl') newX = s.startX + s.startW - 10; }
    if (newH < 10) { newH = 10; if (h === 't' || h === 'tr' || h === 'tl') newY = s.startY + s.startH - 10; }
    hb.x = Math.round(newX); hb.y = Math.round(newY);
    hb.w = Math.round(newW); hb.h = Math.round(newH);
    markDirty();
  }

  $('propX').value = Math.round(hb.x);
  $('propY').value = Math.round(hb.y);
  $('propW').value = Math.round(hb.w);
  $('propH').value = Math.round(hb.h);
  render();
});

window.addEventListener('mouseup', () => { dragState = null; });

$('btnAdd').addEventListener('click', () => {
  if (!currentMap) { showToast('Load a map first', 'error'); return; }
  const vw = currentMap.vw;
  const vh = currentMap.vh;
  const newHb = {
    room: 'New Zone',
    desc: '',
    x: Math.round(vw / 2 - 50),
    y: Math.round(vh / 2 - 40),
    w: 100,
    h: 80,
    rx: '3'
  };
  hitboxes.push(newHb);
  markDirty();
  selectedIdx = hitboxes.length - 1;
  selectHitbox(selectedIdx);
  showToast('Added new hitbox — drag it into position');
  const items = hitboxList.querySelectorAll('.hitbox-item');
  if (items.length) items[items.length - 1].scrollIntoView({ behavior: 'smooth' });
});

$('btnDelete').addEventListener('click', () => {
  if (selectedIdx < 0) return;
  const name = hitboxes[selectedIdx].room || '(unnamed)';
  if (!confirm(`Delete hitbox "${name}"?`)) return;
  hitboxes.splice(selectedIdx, 1);
  selectedIdx = -1;
  propsPanel.classList.remove('visible');
  markDirty();
  render();
});

function generateSVG(idx) {
  const hb = hitboxes[idx];
  const descEsc = hb.desc.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const nameEsc = hb.room.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `    <rect x="${Math.round(hb.x)}" y="${Math.round(hb.y)}" width="${Math.round(hb.w)}" height="${Math.round(hb.h)}" rx="${hb.rx || 3}" class="hitbox"\n      data-room="${nameEsc}"\n      data-desc="${descEsc}"/>`;
}

$('btnCopyOne').addEventListener('click', () => {
  if (selectedIdx < 0) return;
  navigator.clipboard.writeText(generateSVG(selectedIdx)).then(() => showToast('Copied element SVG'));
});

$('btnCopyAll').addEventListener('click', () => {
  const all = hitboxes.map((_, i) => generateSVG(i)).join('\n\n');
  navigator.clipboard.writeText(all).then(() => showToast('Copied all ' + hitboxes.length + ' hitboxes'));
});

$('btnSave').addEventListener('click', async () => {
  if (!currentMapKey) { showToast('No map loaded', 'error'); return; }
  $('btnSave').textContent = 'Saving...';
  $('btnSave').disabled = true;
  try {
    const gridConfigPayload = { gridOn, gridSize, gridOffX, gridOffY, gridOpacity, gridColor, gridLineWidth };
    const resp = await fetch('/api/maps/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapKey: currentMapKey, hitboxes, gridConfig: gridConfigPayload })
    });
    const data = await resp.json();
    if (resp.ok && data.ok) {
      markClean();
      showToast('Saved ' + data.count + ' hitboxes to ' + currentMapKey + '.html', 'success');
    } else {
      showToast(data.error || 'Save failed', 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  } finally {
    $('btnSave').textContent = 'Save to Map File';
    $('btnSave').disabled = false;
  }
});

function toggleGrid() {
  gridOn = !gridOn;
  $('gridToggle').textContent = gridOn ? 'On' : 'Off';
  $('gridToggle').className = 'grid-toggle' + (gridOn ? ' on' : '');
  if (gridOn) gridFocused = true;
  updateGridModeLabel();
  saveGridSettings();
  render();
}

$('gridToggle').addEventListener('click', toggleGrid);

$('gridSize').addEventListener('input', () => {
  gridSize = Math.max(10, parseInt($('gridSize').value) || 40);
  saveGridSettings();
  render();
});

$('gridLineWidth').addEventListener('input', () => {
  gridLineWidth = Math.max(0.5, Math.min(5, parseFloat($('gridLineWidth').value) || 1));
  saveGridSettings();
  render();
});

$('gridOpacity').addEventListener('input', () => {
  gridOpacity = parseInt($('gridOpacity').value) || 40;
  saveGridSettings();
  render();
});

function setGridColor(c) {
  gridColor = c;
  $('gridColorWhite').className = 'grid-toggle' + (c === 'white' ? ' on' : '');
  $('gridColorBlack').className = 'grid-toggle' + (c === 'black' ? ' on' : '');
  saveGridSettings();
  render();
}
$('gridColorWhite').addEventListener('click', () => setGridColor('white'));
$('gridColorBlack').addEventListener('click', () => setGridColor('black'));

$('gridOffX').addEventListener('input', () => {
  gridOffX = parseInt($('gridOffX').value) || 0;
  saveGridSettings();
  render();
});

$('gridOffY').addEventListener('input', () => {
  gridOffY = parseInt($('gridOffY').value) || 0;
  saveGridSettings();
  render();
});

$('gridPanel').addEventListener('mousedown', () => {
  if (gridOn) {
    gridFocused = true;
    updateGridModeLabel();
  }
});

function showToast(msg, type) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

function applyZoom() {
  mapWrap.style.transform = `scale(${zoom})`;
}

function zoomFit() {
  if (!currentMap) return;
  const areaW = canvasArea.clientWidth - 40;
  const areaH = canvasArea.clientHeight - 40;
  zoom = Math.min(areaW / currentMap.vw, areaH / currentMap.vh, 1);
  applyZoom();
}

$('zoomIn').addEventListener('click', () => { zoom = Math.min(zoom * 1.25, 3); applyZoom(); });
$('zoomOut').addEventListener('click', () => { zoom = Math.max(zoom / 1.25, 0.2); applyZoom(); });
$('zoomFit').addEventListener('click', zoomFit);

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === 'g' || e.key === 'G') {
    toggleGrid();
    e.preventDefault();
    return;
  }

  if (gridOn && gridFocused) {
    const step = e.shiftKey ? 1 : 10;
    let moved = false;
    if (e.key === 'ArrowLeft')  { gridOffX -= step; moved = true; }
    if (e.key === 'ArrowRight') { gridOffX += step; moved = true; }
    if (e.key === 'ArrowUp')    { gridOffY -= step; moved = true; }
    if (e.key === 'ArrowDown')  { gridOffY += step; moved = true; }
    if (moved) {
      e.preventDefault();
      $('gridOffX').value = gridOffX;
      $('gridOffY').value = gridOffY;
      saveGridSettings();
      render();
      return;
    }
  }

  if (selectedIdx < 0) return;
  const hb = hitboxes[selectedIdx];
  const step = e.shiftKey ? 10 : 1;
  if (e.key === 'ArrowLeft')  { hb.x -= step; e.preventDefault(); }
  else if (e.key === 'ArrowRight') { hb.x += step; e.preventDefault(); }
  else if (e.key === 'ArrowUp')    { hb.y -= step; e.preventDefault(); }
  else if (e.key === 'ArrowDown')  { hb.y += step; e.preventDefault(); }
  else return;
  markDirty();
  $('propX').value = Math.round(hb.x);
  $('propY').value = Math.round(hb.y);
  render();
});

window.addEventListener('beforeunload', e => {
  if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});

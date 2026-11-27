(() => {
  'use strict';

  // ---------- World coordinates: Web Mercator pixels at zoom 16 ----------
  const WZ = 16;
  const WORLD = 256 * Math.pow(2, WZ);
  const lonToX = lon => (lon + 180) / 360 * WORLD;
  const latToY = lat => {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD;
  };
  const xToLon = x => x / WORLD * 360 - 180;
  const yToLat = y => {
    const n = Math.PI - 2 * Math.PI * y / WORLD;
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };
  const metersPerUnit = lat => 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, WZ);

  const STORE_KEY = 'taxi-maps-layout-v1';
  const PREFS_KEY = 'taxi-maps-prefs-v1';

  // ---------- State ----------
  const canvas = document.getElementById('map');
  const ctx = canvas.getContext('2d');
  let dpr = 1, vw = 0, vh = 0;
  const view = { cx: 0, cy: 0, scale: 1, rot: 0 };      // scale = css px per world unit, rot in radians
  const DEFAULT_BASE_STRENGTH = 0.45, DEFAULT_SHEET_ALPHA = 0.4;
  const EDIT_OTHERS_ALPHA = 0.05;
  let tempSelectedAlpha = 1;    // edit mode only, for checking alignment; back to 100% on every selection change
  const prefs = Object.assign({ base: true, baseStrength: DEFAULT_BASE_STRENGTH, sheetAlpha: DEFAULT_SHEET_ALPHA, labels: true }, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
  let editMode = false;
  // Creator tools (Edit layout, restore/export, size/rotation/opacity sliders) only with ?edit in the URL.
  // Editing is switched OFF for now (the owner will say when to bring it back).
  // To re-enable the ?edit address, set EDITING_ENABLED = true.
  const EDITING_ENABLED = false;
  const CREATOR = EDITING_ENABLED && [...new URLSearchParams(location.search).keys()].some(k => k.toLowerCase() === 'edit');   // ?edit, ?Edit, …
  let selected = null;
  let anim = null;

  // ---------- Sheets ----------
  function loadLayout() {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    const byId = saved ? Object.fromEntries(saved.map(s => [s.id, s])) : {};
    return window.DEFAULT_LAYOUT.map((d, i) => {
      const s = Object.assign({}, d, byId[d.id] ? pick(byId[d.id], ['lat', 'lon', 'width', 'rot', 'z']) : {});
      if (s.z == null) s.z = i;
      return s;
    });
  }
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null).map(k => [k, o[k]]));

  const sheets = loadLayout().map(s => {
    const small = new Image();
    small.onload = requestRender;
    small.src = `sheets/${s.id}-s.jpg`;
    return Object.assign(s, { small, full: null, aspect: 1744 / 1233 });
  });
  sheets.forEach(s => { s.small.addEventListener('load', () => { s.aspect = s.small.naturalHeight / s.small.naturalWidth; }); });

  const sheetGeom = s => {
    const w = s.width / metersPerUnit(s.lat);
    return { x: lonToX(s.lon), y: latToY(s.lat), w, h: w * s.aspect, r: s.rot * Math.PI / 180 };
  };

  // Every change is kept in the browser at once, then written to the project's layout.js
  // through server.py. On a plain static server the POST fails and the browser copy remains.
  let saveTimer = 0, saveSeq = 0;
  function saveLayout() {
    localStorage.setItem(STORE_KEY, JSON.stringify(sheets.map(s => pick(s, ['id', 'lat', 'lon', 'width', 'rot', 'z']))));
    setSaveStatus('Се зачувува…', '');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const seq = ++saveSeq;
      const body = JSON.stringify(sheets.map(s => pick(s, ['id', 'name', 'file', 'lat', 'lon', 'width', 'rot', 'z'])));
      try {
        const r = await fetch('api/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!r.ok) throw new Error(r.status);
        if (seq === saveSeq) { localStorage.removeItem(STORE_KEY); setSaveStatus('Зачувано во layout.js ✓', 'ok'); }
      } catch {
        if (seq === saveSeq) setSaveStatus('Зачувано само во овој прелистувач (стартувај server.py за да се зачува во проектот)', 'warn');
      }
    }, 600);
  }
  function setSaveStatus(text, cls) {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'save-status ' + cls;
  }
  const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

  // ---------- Transforms ----------
  function worldToScreen(x, y) {
    const dx = (x - view.cx) * view.scale, dy = (y - view.cy) * view.scale;
    const c = Math.cos(view.rot), s = Math.sin(view.rot);
    return [vw / 2 + dx * c - dy * s, vh / 2 + dx * s + dy * c];
  }
  function screenToWorld(sx, sy) {
    const dx = sx - vw / 2, dy = sy - vh / 2;
    const c = Math.cos(-view.rot), s = Math.sin(-view.rot);
    return [view.cx + (dx * c - dy * s) / view.scale, view.cy + (dx * s + dy * c) / view.scale];
  }
  // Keep world point (wx,wy) under screen point (sx,sy) after scale/rot changed
  function anchor(wx, wy, sx, sy) {
    const dx = sx - vw / 2, dy = sy - vh / 2;
    const c = Math.cos(-view.rot), s = Math.sin(-view.rot);
    view.cx = wx - (dx * c - dy * s) / view.scale;
    view.cy = wy - (dx * s + dy * c) / view.scale;
  }
  const MIN_SCALE = 1 / 64, MAX_SCALE = 16;
  const clampScale = s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  // ---------- Base map tiles (OSM) ----------
  const tiles = new Map();
  const TILE_MAX = 600;
  function getTile(z, x, y) {
    const key = z + '/' + x + '/' + y;
    let t = tiles.get(key);
    if (!t) {
      const img = new Image();
      t = { img, ok: false, used: 0 };
      img.onload = () => { t.ok = true; requestRender(); };
      img.onerror = () => { t.failed = true; };
      const sub = 'abc'[(x + y) % 3];
      img.src = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
      tiles.set(key, t);
      if (tiles.size > TILE_MAX) {
        const old = [...tiles.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 100);
        old.forEach(([k]) => tiles.delete(k));
      }
    }
    t.used = performance.now();
    return t;
  }

  function visibleBounds() {
    const pts = [[0, 0], [vw, 0], [0, vh], [vw, vh]].map(p => screenToWorld(p[0], p[1]));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  function drawBase(b) {
    const z = Math.max(3, Math.min(19, Math.round(WZ + Math.log2(view.scale * dpr))));
    const ts = 256 * Math.pow(2, WZ - z);           // tile size in world units
    const n = Math.pow(2, z);
    const tx0 = Math.max(0, Math.floor(b.x0 / ts)), tx1 = Math.min(n - 1, Math.floor(b.x1 / ts));
    const ty0 = Math.max(0, Math.floor(b.y0 / ts)), ty1 = Math.min(n - 1, Math.floor(b.y1 / ts));
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) return;
    const pad = 0.6 / view.scale;                    // hide seams
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = getTile(z, tx, ty);
      if (t.ok) { ctx.drawImage(t.img, tx * ts, ty * ts, ts + pad, ts + pad); continue; }
      // fallback: a loaded ancestor tile, cropped
      for (let up = 1; up <= 4 && z - up >= 0; up++) {
        const pz = z - up, f = Math.pow(2, up);
        const p = tiles.get(pz + '/' + Math.floor(tx / f) + '/' + Math.floor(ty / f));
        if (p && p.ok) {
          const sz = 256 / f, sx = (tx % f) * sz, sy = (ty % f) * sz;
          ctx.drawImage(p.img, sx, sy, sz, sz, tx * ts, ty * ts, ts + pad, ts + pad);
          break;
        }
      }
    }
  }

  // ---------- Rendering ----------
  let pending = false;
  function requestRender() { if (!pending) { pending = true; requestAnimationFrame(render); } }

  function render(now) {
    pending = false;
    if (anim) stepAnim(now);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#efe8da';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.rotate(view.rot);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.cx, -view.cy);
    const b = visibleBounds();

    if (prefs.base) {
      ctx.save();
      ctx.globalAlpha = prefs.baseStrength;
      ctx.imageSmoothingQuality = 'high';
      drawBase(b);
      ctx.restore();
      // Subdue: pull the street map most of the way to grey (cheap, single fill in screen space)
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
    }

    const order = [...sheets].sort((a, c) => a.z - c.z);
    if (selected) { order.splice(order.indexOf(selected), 1); order.push(selected); }   // selected always on top
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (const s of order) {
      const g = sheetGeom(s);
      const rad = Math.hypot(g.w, g.h) / 2;
      if (g.x + rad < b.x0 || g.x - rad > b.x1 || g.y + rad < b.y0 || g.y - rad > b.y1) continue;
      const pxW = g.w * view.scale * dpr;
      let img = s.small;
      if (pxW > 560) {
        if (!s.full) { s.full = new Image(); s.full.onload = requestRender; s.full.src = `sheets/${s.id}.jpg`; }
        if (s.full.complete && s.full.naturalWidth) img = s.full;
      }
      // The selected sheet is solid; the others follow "Sheet opacity".
      // Edit mode with a selection: the others nearly vanish so they don't get in the way.
      const alpha = s === selected ? (editMode ? tempSelectedAlpha : 1) : (editMode && selected) ? EDIT_OTHERS_ALPHA : prefs.sheetAlpha;
      const seeThrough = alpha < 0.999;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.r);
      ctx.globalAlpha = alpha;
      if (!seeThrough) {                                        // solid: paper backing + shadow
        ctx.shadowColor = 'rgba(40,25,10,.25)';
        ctx.shadowBlur = 12 * dpr;
        ctx.fillStyle = '#fffdf6';
        ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
        ctx.shadowColor = 'transparent';
      }
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -g.w / 2, -g.h / 2, g.w, g.h);
      if (seeThrough && s !== selected && alpha > EDIT_OTHERS_ALPHA) {  // thin outline so overlapping edges stay visible
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5 / view.scale;
        ctx.strokeStyle = '#2a2622';
        ctx.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
      }
      if (s === selected) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3 / view.scale;
        ctx.strokeStyle = editMode ? '#c8372d' : 'rgba(200,55,45,.8)';
        if (editMode) ctx.setLineDash([10 / view.scale, 6 / view.scale]);
        ctx.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
      }
      ctx.restore();
    }
    ctx.restore();

    // labels in screen space (always upright)
    labelHits = [];
    if (prefs.labels) {
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const s of order) {
        const g = sheetGeom(s);
        const pxW = g.w * view.scale;
        if (pxW > 420 || s === selected) continue;    // readable already, or named on the open card
        const [sx, sy] = worldToScreen(g.x, g.y);
        if (sx < -100 || sx > vw + 100 || sy < -40 || sy > vh + 40) continue;
        const label = pxW < 70 ? s.id.replace(/^0/, '') : `${s.id.replace(/^0/, '')} · ${s.name}`;
        const w = ctx.measureText(label).width + 16;
        ctx.fillStyle = 'rgba(42,38,34,.82)';
        roundRect(sx - w / 2, sy - 12, w, 24, 12);
        ctx.fill();
        labelHits.push({ s, x: sx - w / 2, y: sy - 12, w, h: 24 });
        ctx.fillStyle = '#fff';
        ctx.fillText(label, sx, sy + 0.5);
      }
    }

    document.getElementById('needle').setAttribute('transform', `rotate(${view.rot * 180 / Math.PI} 12 12)`);
    if (anim) requestRender();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    requestRender();
  }

  // ---------- Animation ----------
  function animateTo(target, ms = 450) {
    let dr = (target.rot ?? view.rot) - view.rot;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));     // shortest way round
    anim = { from: { ...view }, to: { cx: target.cx ?? view.cx, cy: target.cy ?? view.cy, scale: target.scale ?? view.scale, rot: view.rot + dr }, t0: performance.now(), ms };
    requestRender();
  }
  function stepAnim(now) {
    const t = Math.min(1, (now - anim.t0) / anim.ms);
    const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const { from: f, to } = anim;
    const ls = Math.log(f.scale) + (Math.log(to.scale) - Math.log(f.scale)) * e;
    view.scale = Math.exp(ls);
    view.cx = f.cx + (to.cx - f.cx) * e;
    view.cy = f.cy + (to.cy - f.cy) * e;
    view.rot = f.rot + (to.rot - f.rot) * e;
    if (t >= 1) { anim = null; view.rot = Math.atan2(Math.sin(view.rot), Math.cos(view.rot)); }
  }
  const stopAnim = () => { anim = null; };

  function fitAll() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sheets) {
      const g = sheetGeom(s), r = Math.hypot(g.w, g.h) / 2;
      x0 = Math.min(x0, g.x - r); x1 = Math.max(x1, g.x + r); y0 = Math.min(y0, g.y - r); y1 = Math.max(y1, g.y + r);
    }
    const scale = Math.min((vw - 40) / (x1 - x0), (vh - 40) / (y1 - y0));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, scale: clampScale(scale), rot: 0 };
  }
  function focusSheet(s) {
    const g = sheetGeom(s);
    const scale = clampScale(Math.min((vw - 30) / g.w, (vh - 150) / g.h));
    animateTo({ cx: g.x, cy: g.y, scale, rot: -g.r });
  }
  function zoomBy(f, sx = vw / 2, sy = vh / 2) {
    stopAnim();
    const [wx, wy] = screenToWorld(sx, sy);
    view.scale = clampScale(view.scale * f);
    anchor(wx, wy, sx, sy);
    requestRender();
  }
  function rotateBy(da, sx = vw / 2, sy = vh / 2) {
    stopAnim();
    const [wx, wy] = screenToWorld(sx, sy);
    view.rot += da;
    anchor(wx, wy, sx, sy);
    requestRender();
  }

  // ---------- Hit testing ----------
  // Labels are clickable: a click on a sheet's label picks that sheet, even over another sheet.
  let labelHits = [];
  function labelAt(sx, sy) {
    for (let i = labelHits.length - 1; i >= 0; i--) {        // last drawn = on top
      const l = labelHits[i];
      if (sx >= l.x - 4 && sx <= l.x + l.w + 4 && sy >= l.y - 4 && sy <= l.y + l.h + 4) return l.s;
    }
    return null;
  }
  function sheetAt(sx, sy) {
    const viaLabel = labelAt(sx, sy);
    if (viaLabel) return viaLabel;
    const [wx, wy] = screenToWorld(sx, sy);
    const order = [...sheets].sort((a, c) => c.z - a.z);
    if (selected) { order.splice(order.indexOf(selected), 1); order.unshift(selected); }  // drawn on top, so hit first
    for (const s of order) {
      const g = sheetGeom(s);
      const dx = wx - g.x, dy = wy - g.y;
      const c = Math.cos(-g.r), sn = Math.sin(-g.r);
      const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      if (Math.abs(lx) <= g.w / 2 && Math.abs(ly) <= g.h / 2) return s;
    }
    return null;
  }

  // ---------- Input: pointer (mouse + touch + pen) ----------
  const pointers = new Map();
  let gesture = null;     // state of current drag/pinch
  let tapInfo = null;
  let lastTap = { t: 0, x: 0, y: 0 };

  function pointerPos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  function beginGesture() {
    const pts = [...pointers.values()];
    if (pts.length === 1) {
      const p = pts[0];
      // Edit mode: grab any sheet and drag it straight away; empty map still pans.
      let moveSheet = false;
      if (editMode && !p.rotateMode) {
        const hit = sheetAt(p.x, p.y);
        if (hit) { if (hit !== selected) select(hit); moveSheet = true; }
      }
      gesture = { type: p.rotateMode ? 'rotate' : 'pan', last: [p.x, p.y], moveSheet };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      gesture = {
        type: 'pinch', mid, dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x),
        view0: { ...view }, world0: screenToWorld(mid[0], mid[1]),
        sheet0: editMode && selected ? { lat: selected.lat, lon: selected.lon, width: selected.width, rot: selected.rot } : null
      };
    } else gesture = null;
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pointerPos(e);
    pointers.set(e.pointerId, { x, y, rotateMode: e.button === 2 || (e.pointerType === 'mouse' && e.shiftKey) });
    stopAnim();
    tapInfo = pointers.size === 1 ? { x, y, t: performance.now(), moved: false } : null;
    beginGesture();
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && !pointers.size) {
      const [hx, hy] = pointerPos(e);
      canvas.style.cursor = labelAt(hx, hy) ? 'pointer' : '';
    }
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const [x, y] = pointerPos(e);
    p.x = x; p.y = y;
    if (tapInfo && Math.hypot(x - tapInfo.x, y - tapInfo.y) > 6) tapInfo.moved = true;
    if (!gesture) return;

    if (gesture.type === 'pan') {
      const [lx, ly] = gesture.last;
      if (gesture.moveSheet) {
        const [ax, ay] = screenToWorld(lx, ly), [bx, by] = screenToWorld(x, y);
        const gx = lonToX(selected.lon) + bx - ax, gy = latToY(selected.lat) + by - ay;
        selected.lon = xToLon(gx); selected.lat = yToLat(gy);
        saveLayout(); syncCard();
      } else {
        const [ax, ay] = screenToWorld(lx, ly), [bx, by] = screenToWorld(x, y);
        view.cx -= bx - ax; view.cy -= by - ay;
      }
      gesture.last = [x, y];
    } else if (gesture.type === 'rotate') {
      const [lx, ly] = gesture.last;
      const a0 = Math.atan2(ly - vh / 2, lx - vw / 2), a1 = Math.atan2(y - vh / 2, x - vw / 2);
      view.rot += a1 - a0;
      gesture.last = [x, y];
    } else if (gesture.type === 'pinch') {
      const [a, b] = [...pointers.values()];
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const ratio = Math.hypot(b.x - a.x, b.y - a.y) / gesture.dist;
      const da = Math.atan2(b.y - a.y, b.x - a.x) - gesture.ang;
      if (gesture.sheet0) {
        // Edit: transform the selected sheet; the view stays put.
        const s0 = gesture.sheet0;
        selected.width = Math.max(100, s0.width * ratio);
        selected.rot = normDeg(s0.rot + da * 180 / Math.PI);
        const [mx0, my0] = screenToWorld(gesture.mid[0], gesture.mid[1]);
        const [mx1, my1] = screenToWorld(mid[0], mid[1]);
        selected.lon = xToLon(lonToX(s0.lon) + mx1 - mx0);
        selected.lat = yToLat(latToY(s0.lat) + my1 - my0);
        saveLayout(); syncCard();
      } else {
        view.scale = clampScale(gesture.view0.scale * ratio);
        view.rot = gesture.view0.rot + da;
        anchor(gesture.world0[0], gesture.world0[1], mid[0], mid[1]);
      }
    }
    requestRender();
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = pointerPos(e);
    pointers.delete(e.pointerId);
    if (tapInfo && !tapInfo.moved && pointers.size === 0 && e.type === 'pointerup' && performance.now() - tapInfo.t < 400) {
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) {
        zoomBy(2, x, y);                       // double tap / double click
        lastTap.t = 0;
      } else {
        lastTap = { t: now, x, y };
        handleTap(x, y);
      }
    }
    tapInfo = null;
    beginGesture();                            // continue smoothly with remaining finger
    if (pointers.size === 0) canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function handleTap(x, y) {
    const s = sheetAt(x, y);
    select(s);
  }

  // ---------- Input: wheel / trackpad ----------
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [x, y] = pointerPos(e);
    let dy = e.deltaY, dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 16; dx *= 16; }
    else if (e.deltaMode === 2) { dy *= vh; dx *= vw; }
    if (editMode && selected && (e.altKey || e.shiftKey) ) {
      if (e.shiftKey) selected.rot = normDeg(selected.rot + (dy || dx) * 0.1);
      else selected.width = Math.max(100, selected.width * Math.exp(-dy * 0.002));
      saveLayout(); syncCard(); requestRender();
    } else if (e.shiftKey || e.altKey) {
      rotateBy((dy || dx) * 0.003, x, y);
    } else {
      // Scroll always zooms, keeping the point under the mouse fixed.
      // ctrlKey = trackpad pinch (small deltas), so it gets a stronger factor.
      const d = Math.max(-300, Math.min(300, dy));
      zoomBy(Math.exp(-d * (e.ctrlKey ? 0.012 : 0.0025)), x, y);
    }
  }, { passive: false });

  // Safari trackpad pinch/rotate (gesture events), only when no pointers are active (iOS uses pointers)
  let g0 = null;
  window.addEventListener('gesturestart', e => {
    e.preventDefault();
    if (pointers.size) return;
    const [x, y] = pointerPos(e);
    g0 = { scale: view.scale, rot: view.rot, x, y, w: screenToWorld(x, y) };
  });
  window.addEventListener('gesturechange', e => {
    e.preventDefault();
    if (!g0 || pointers.size) return;
    view.scale = clampScale(g0.scale * e.scale);
    view.rot = g0.rot + e.rotation * Math.PI / 180;
    anchor(g0.w[0], g0.w[1], g0.x, g0.y);
    requestRender();
  });
  window.addEventListener('gestureend', e => { e.preventDefault(); g0 = null; });

  // Keyboard
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (viewerSheet) {                                   // keys go to the full-screen viewer while it is open
      const cx = viewer.clientWidth / 2, cy = viewer.clientHeight / 2;
      if (e.key === 'Escape') closeViewer();
      else if (e.key === '+' || e.key === '=') zoomViewer(1.5, cx, cy);
      else if (e.key === '-' || e.key === '_') zoomViewer(1 / 1.5, cx, cy);
      else if (e.key === '0' || e.key === 'r') fitViewer();
      return;
    }
    const k = e.key;
    if (k === '+' || k === '=') zoomBy(1.5);
    else if (k === '-' || k === '_') zoomBy(1 / 1.5);
    else if (k === 'q' || k === '[') rotateBy(-Math.PI / 24);
    else if (k === 'e' || k === ']') rotateBy(Math.PI / 24);
    else if (k === '0' || k === 'r') animateTo(fitAll());
    else if (k === 'n') animateTo({ rot: 0 });
    else if (k === 'Escape') { select(null); closePanels(); }
    else if (k.startsWith('Arrow')) {
      const d = 80;
      const [ox, oy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[k];
      const [ax, ay] = screenToWorld(vw / 2, vh / 2), [bx, by] = screenToWorld(vw / 2 + ox, vh / 2 + oy);
      animateTo({ cx: view.cx + bx - ax, cy: view.cy + by - ay }, 180);
    }
  });

  // ---------- UI ----------
  const $ = id => document.getElementById(id);
  const normDeg = d => ((d + 180) % 360 + 360) % 360 - 180;

  $('zoomIn').onclick = () => animateTo({ scale: clampScale(view.scale * 2) }, 250);
  $('zoomOut').onclick = () => animateTo({ scale: clampScale(view.scale / 2) }, 250);
  $('compass').onclick = () => animateTo({ rot: 0 });
  $('reset').onclick = () => animateTo(fitAll());

  function closePanels() { $('listPanel').classList.add('hidden'); $('layersPanel').classList.add('hidden'); syncButtons(); }
  function togglePanel(id) {
    const el = $(id), open = el.classList.contains('hidden');
    closePanels();
    if (open) el.classList.remove('hidden');
    syncButtons();
  }
  function syncButtons() {
    $('listBtn').classList.toggle('on', !$('listPanel').classList.contains('hidden'));
    $('layersBtn').classList.toggle('on', !$('layersPanel').classList.contains('hidden'));
  }
  $('listBtn').onclick = () => {
    const opening = $('listPanel').classList.contains('hidden');
    togglePanel('listPanel');
    if (opening && selected && innerWidth <= 640) select(null);   // phones only: no room for both the list and the card
  };
  $('layersBtn').onclick = () => togglePanel('layersPanel');
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).classList.add('hidden'); syncButtons(); });

  // Sheet list
  const list = $('sheetList');
  // Sheet list in Macedonian Cyrillic alphabetical order (explicit, so every browser sorts the same)
  const MK_ALPHABET = 'абвгдѓежзѕијклљмнњопрстќуфхцчџш';
  const mkKey = name => [...name.toLowerCase().normalize('NFC')].map(ch => {
    const i = MK_ALPHABET.indexOf(ch);
    return i >= 0 ? String.fromCharCode(0x100 + i) : ch === ' ' || ch === ',' ? ' ' : ch;   // letters before anything else
  }).join('');
  const byName = [...sheets].sort((a, b) => mkKey(a.name) < mkKey(b.name) ? -1 : mkKey(a.name) > mkKey(b.name) ? 1 : 0);
  for (const s of byName) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="num">${+s.id}</span><img alt="" loading="lazy" src="sheets/${s.id}-s.jpg"><span></span>`;
    li.lastChild.textContent = s.name;
    const dl = Object.assign(document.createElement('a'), { className: 'row-dl', href: `sheets/${s.id}.jpg`, title: `Преземи: ${s.name}` });
    dl.setAttribute('download', s.file);
    dl.setAttribute('aria-label', `Преземи: ${s.name}`);
    dl.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
    dl.addEventListener('click', e => { e.stopPropagation(); downloadOriginal(e, s); });
    li.appendChild(dl);
    li.onclick = () => { select(s); focusSheet(s); if (vw < 700) closePanels(); };
    list.appendChild(li);
  }

  // Display prefs
  $('baseToggle').checked = prefs.base;
  $('opacity').value = prefs.sheetAlpha;
  $('baseStrength').value = prefs.baseStrength;
  // Magnetic default: within ±0.04 of the default the slider snaps onto it (tick mark via <datalist>)
  function magnetic(el, def) {
    let v = +el.value;
    if (Math.abs(v - def) <= 0.04) { v = def; el.value = def; }
    return v;
  }
  $('baseStrength').oninput = e => { prefs.baseStrength = magnetic(e.target, DEFAULT_BASE_STRENGTH); savePrefs(); requestRender(); };
  $('labelsToggle').checked = prefs.labels;
  $('baseToggle').onchange = e => { prefs.base = e.target.checked; savePrefs(); requestRender(); };
  $('opacity').oninput = e => { prefs.sheetAlpha = magnetic(e.target, DEFAULT_SHEET_ALPHA); savePrefs(); requestRender(); };
  $('labelsToggle').onchange = e => { prefs.labels = e.target.checked; savePrefs(); requestRender(); };
  $('creatorTools').hidden = !CREATOR;
  $('editToggle').onchange = e => { editMode = CREATOR && e.target.checked; tempSelectedAlpha = 1; syncCard(); requestRender(); };

  // Selected sheet card
  function select(s) {
    if (s !== selected) { tempSelectedAlpha = 1; viewBeforeFocus = null; }   // per-selection state never carries over
    selected = s;
    syncCard();
    syncFocusBtn();
    syncHash();
    requestRender();
  }
  function syncCard() {
    $('checkBar').classList.toggle('hidden', !(editMode && selected));
    const card = $('sheetCard');
    document.body.classList.toggle('card-open', !!selected);
    if (!selected) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    $('cardNum').textContent = +selected.id;
    $('cardName').textContent = selected.name;
    const dl = $('cardDownload');
    dl.href = `sheets/${selected.id}.jpg`;
    dl.setAttribute('download', selected.file);
    $('editControls').classList.toggle('hidden', !editMode);
    $('widthRange').value = selected.width;
    $('rotRange').value = selected.rot;
    $('tempAlphaRange').value = tempSelectedAlpha;
    $('tempAlphaVal').textContent = Math.round(tempSelectedAlpha * 100) + '%';
    $('widthVal').textContent = `широчина ${(selected.width / 1000).toFixed(2)} km`;
    $('rotVal').textContent = `${selected.rot.toFixed(1)}°`;
  }
  $('cardClose').onclick = () => select(null);
  // "Show on map" toggles: first click flies to the sheet (upright) and remembers the view,
  // the second click ("Back") flies back to exactly where the map was.
  let viewBeforeFocus = null;
  function syncFocusBtn() {
    $('cardFocus').textContent = viewBeforeFocus ? 'Назад' : 'На карта';
    $('cardFocus').title = viewBeforeFocus ? 'Врати ја картата каде што беше' : 'Прикажи ја мапата исправена на картата';
  }
  $('cardFocus').onclick = () => {
    if (!selected) return;
    if (viewBeforeFocus) { animateTo(viewBeforeFocus); viewBeforeFocus = null; }
    else { viewBeforeFocus = { cx: view.cx, cy: view.cy, scale: view.scale, rot: view.rot }; focusSheet(selected); }
    syncFocusBtn();
  };
  $('widthRange').oninput = e => { selected.width = +e.target.value; saveLayout(); syncCard(); requestRender(); };
  $('tempAlphaRange').oninput = e => { tempSelectedAlpha = +e.target.value; $('tempAlphaVal').textContent = Math.round(tempSelectedAlpha * 100) + '%'; requestRender(); };
  $('rotRange').oninput = e => { selected.rot = +e.target.value; saveLayout(); syncCard(); requestRender(); };
  document.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => {
    selected.rot = normDeg(selected.rot + +b.dataset.rot); saveLayout(); syncCard(); requestRender();
  });
  $('bringFront').onclick = () => { selected.z = Math.max(...sheets.map(s => s.z)) + 1; saveLayout(); requestRender(); };

  // Download originals (works also when a browser ignores the download attribute)
  $('cardDownload').addEventListener('click', e => { if (selected) downloadOriginal(e, selected); });
  async function downloadOriginal(e, s) {
    if (location.protocol === 'file:') return;
    e.preventDefault();
    const blob = await (await fetch(`sheets/${s.id}.jpg`)).blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: s.file });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Restore the automatic alignment saved in layout.claude.js (window.CLAUDE_LAYOUT)
  const claudeById = Object.fromEntries((window.CLAUDE_LAYOUT || []).map(c => [c.id, c]));
  function restoreClaude(list) {
    let n = 0;
    for (const s of list) {
      const c = claudeById[s.id];
      if (c) { Object.assign(s, { lat: c.lat, lon: c.lon, width: c.width, rot: c.rot }); n++; }
    }
    if (n) { saveLayout(); syncCard(); requestRender(); }
    return n;
  }
  if (!window.CLAUDE_LAYOUT) { $('restoreAllBtn').hidden = true; $('restoreOneBtn').hidden = true; }
  $('restoreAllBtn').onclick = () => {
    if (confirm('Да ги вратам сите 26 мапи на позициите од Claude? Твоите рачни поместувања ќе бидат заменети.')) restoreClaude(sheets);
  };
  $('restoreOneBtn').onclick = () => { if (selected) restoreClaude([selected]); };

  // Export / restore layout
  $('exportBtn').onclick = () => {
    const r = n => Math.round(n * 1e6) / 1e6;
    const rows = sheets.map(s => `  { id: ${JSON.stringify(s.id)}, name: ${JSON.stringify(s.name)}, file: ${JSON.stringify(s.file)}, lat: ${r(s.lat)}, lon: ${r(s.lon)}, width: ${Math.round(s.width)}, rot: ${Math.round(s.rot * 10) / 10}, z: ${s.z} }`);
    const text = `// Placement of each hand-drawn sheet on the Skopje map.\n// lat/lon = centre of the sheet, width = sheet width in metres on the ground,\n// rot = clockwise rotation in degrees (0 = sheet drawn with north up).\nwindow.DEFAULT_LAYOUT = [\n${rows.join(',\n')}\n];\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'layout.js' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  $('resetLayoutBtn').onclick = () => {
    if (!confirm('Да ги отфрлам промените зачувани само во овој прелистувач и повторно да вчитам од layout.js?')) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
  };

  // ---------- Full-screen viewer: the original scan, flat and unrotated ----------
  const viewer = $('viewer'), vImg = $('viewerImg');
  const vt = { x: 0, y: 0, s: 1, w: 1, h: 1 };       // translate, scale, natural image size
  let viewerSheet = null;
  const vPointers = new Map();
  let vGesture = null, vLastTap = 0;

  let vFit = null;                       // the fitted transform; Fit is enabled only when we differ from it
  function applyViewer() {
    vImg.style.transform = `translate(${vt.x}px, ${vt.y}px) scale(${vt.s})`;
    const moved = vFit && (Math.abs(vt.s * vt.w - vFit.sw) > 1 || Math.abs(vt.x - vFit.x) > 2 || Math.abs(vt.y - vFit.y) > 2);
    $('viewerFit').disabled = !moved;
  }
  function fitViewer() {
    const W = viewer.clientWidth, H = viewer.clientHeight, top = 64;          // leave room for the bar
    vt.s = Math.min((W - 24) / vt.w, (H - top - 16) / vt.h);
    vt.x = (W - vt.w * vt.s) / 2;
    vt.y = top + (H - top - 16 - vt.h * vt.s) / 2;
    vFit = { sw: vt.s * vt.w, x: vt.x, y: vt.y };      // on-screen width, so swapping in the full scan keeps it
    applyViewer();
  }
  function zoomViewer(f, px, py) {
    const s = Math.min(8, Math.max(fitScale() * 0.5, vt.s * f));
    vt.x = px - (px - vt.x) * (s / vt.s);
    vt.y = py - (py - vt.y) * (s / vt.s);
    vt.s = s;
    applyViewer();
  }
  const fitScale = () => Math.min((viewer.clientWidth - 24) / vt.w, (viewer.clientHeight - 80) / vt.h);

  function openViewer(s) {
    viewerSheet = s;
    $('viewerNum').textContent = +s.id;
    $('viewerTitle').textContent = s.name;
    $('viewerDownload').href = `sheets/${s.id}.jpg`;
    $('viewerDownload').setAttribute('download', s.file);
    viewer.classList.remove('hidden');
    // show the small preview at once, swap in the full scan when it arrives (same layout size)
    vt.w = 1000; vt.h = 1000 * s.aspect;               // placeholder size until the full scan loads
    vImg.style.width = vt.w + 'px'; vImg.style.height = vt.h + 'px';
    vImg.src = s.small.src;
    fitViewer();
    const full = new Image();
    full.onload = () => {
      if (viewerSheet !== s) return;
      const keepS = vt.s * vt.w / full.naturalWidth;     // keep what is on screen exactly where it is
      vt.w = full.naturalWidth; vt.h = full.naturalHeight; vt.s = keepS;
      vImg.style.width = vt.w + 'px'; vImg.style.height = vt.h + 'px';
      vImg.src = full.src;
      applyViewer();
    };
    full.src = `sheets/${s.id}.jpg`;
  }
  function closeViewer() { viewer.classList.add('hidden'); viewerSheet = null; vImg.removeAttribute('src'); vPointers.clear(); }

  function vPos(e) { return [e.clientX, e.clientY]; }
  function vBegin() {
    const pts = [...vPointers.values()];
    if (pts.length === 1) vGesture = { last: pts[0].slice() };
    else if (pts.length >= 2) {
      const [a, b] = pts;
      vGesture = { dist: Math.hypot(b[0] - a[0], b[1] - a[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t0: { ...vt } };
    } else vGesture = null;
  }
  viewer.addEventListener('pointerdown', e => {
    if (e.target.closest('.viewer-bar')) return;
    viewer.setPointerCapture(e.pointerId);
    vPointers.set(e.pointerId, vPos(e));
    viewer.classList.add('dragging');
    vBegin();
    if (vPointers.size === 1) {
      const now = performance.now();
      if (now - vLastTap < 300) {               // double tap / click: zoom in, or back to fit
        const [x, y] = vPos(e);
        if (vt.s > fitScale() * 1.5) fitViewer(); else zoomViewer(2.5, x, y);
        vLastTap = 0;
      } else vLastTap = now;
    }
  });
  viewer.addEventListener('pointermove', e => {
    if (!vPointers.has(e.pointerId) || !vGesture) return;
    vPointers.set(e.pointerId, vPos(e));
    const pts = [...vPointers.values()];
    if (pts.length === 1) {
      const [x, y] = pts[0];
      vt.x += x - vGesture.last[0]; vt.y += y - vGesture.last[1];
      vGesture.last = [x, y];
      applyViewer();
    } else {
      const [a, b] = pts, g = vGesture;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const s = Math.min(8, Math.max(fitScale() * 0.5, g.t0.s * Math.hypot(b[0] - a[0], b[1] - a[1]) / g.dist));
      vt.s = s;
      vt.x = mid[0] - (g.mid[0] - g.t0.x) * (s / g.t0.s);
      vt.y = mid[1] - (g.mid[1] - g.t0.y) * (s / g.t0.s);
      applyViewer();
    }
  });
  const vEnd = e => { vPointers.delete(e.pointerId); vBegin(); if (!vPointers.size) viewer.classList.remove('dragging'); };
  viewer.addEventListener('pointerup', vEnd);
  viewer.addEventListener('pointercancel', vEnd);
  viewer.addEventListener('wheel', e => {
    e.preventDefault();
    let dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    dy = Math.max(-300, Math.min(300, dy));
    zoomViewer(Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0025)), e.clientX, e.clientY);
  }, { passive: false });

  $('cardFull').onclick = () => selected && openViewer(selected);
  $('viewerClose').onclick = closeViewer;
  $('viewerFit').onclick = fitViewer;
  $('viewerDownload').addEventListener('click', e => { if (viewerSheet) downloadOriginal(e, viewerSheet); });
  window.addEventListener('resize', () => { if (viewerSheet) fitViewer(); });

  // ---------- Links to a sheet: #<name> in the address (a number like #23 works too) ----------
  const slug = s => s.name.toLowerCase().normalize('NFC').replace(/,/g, '').trim().replace(/\s+/g, '-');
  const linkFor = s => location.origin + location.pathname + '#' + encodeURIComponent(slug(s));   // never includes ?edit
  function sheetFromHash() {
    const h = decodeURIComponent(location.hash.slice(1)).toLowerCase().normalize('NFC');
    if (!h) return null;
    return sheets.find(s => slug(s) === h) || sheets.find(s => /^\d+$/.test(h) && +s.id === +h) || null;
  }
  function syncHash() {
    const want = selected ? '#' + encodeURIComponent(slug(selected)) : '';
    if (location.hash !== want) history.replaceState(null, '', location.pathname + location.search + want);
  }
  function openFromHash() {
    const s = sheetFromHash();
    if (!s || s === selected) return;
    select(s);
    viewBeforeFocus = fitAll();          // "Back" goes to the whole city
    syncFocusBtn();
    focusSheet(s);
  }
  window.addEventListener('hashchange', openFromHash);

  let toastTimer = 0;
  function toast(text) {
    const t = $('toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  $('cardShare').onclick = async () => {
    if (!selected) return;
    const url = linkFor(selected), title = `${selected.name} · Лудо Такси`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); toast('Линкот е копиран'); }
    catch { prompt('Копирај го линкот:', url); }
  };

  // ---------- About dialog: opened from the logo badge ----------
  const about = $('aboutDialog');
  const openAbout = () => { if (!about.open) about.showModal(); };
  $('titleBadge').addEventListener('click', openAbout);
  $('titleBadge').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAbout(); } });
  $('aboutClose').onclick = () => about.close();
  about.addEventListener('click', e => {                 // click on the dimmed backdrop (outside the box) closes
    const r = about.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) about.close();
  });

  // ---------- Start ----------
  window.addEventListener('resize', resize);
  resize();
  Object.assign(view, fitAll());
  requestRender();
  openFromHash();
})();

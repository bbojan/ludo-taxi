// Playful extras on top of app.js (which exposes window.LudoTaxi):
//   - secret code: type T A X I, or tap the logo in the About dialog 5 times → the map spins and honks
//   - „Каде, шефе?“: a random ride to one of the 26 neighbourhoods (button or K)
//   - taximeter: counts the kilometres the map has travelled; click it (or M) for a receipt
//   - „Погоди ја населбата“: a 5-round guessing game on the bare street map (button or P)
(() => {
  'use strict';
  const T = window.LudoTaxi;
  if (!T) return;
  const { view, sheets, fun, $ } = T;
  const rnd = n => Math.floor(Math.random() * n);
  const pickOne = a => a[rnd(a.length)];
  const centreLat = () => T.yToLat(view.cy);
  const mk = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

  // ---------- Honk: two short beeps, synthesised (no sound file), only ever on a user action ----------
  let audio = null;
  function honk() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      for (const d of [0, 0.24]) {
        for (const f of [392, 494]) {                    // a slightly sour two-tone car horn
          const o = audio.createOscillator(), g = audio.createGain();
          o.type = 'sawtooth'; o.frequency.value = f;
          g.gain.setValueAtTime(0, t + d);
          g.gain.linearRampToValueAtTime(0.09, t + d + 0.02);
          g.gain.setValueAtTime(0.09, t + d + 0.15);
          g.gain.linearRampToValueAtTime(0, t + d + 0.2);
          o.connect(g); g.connect(audio.destination);
          o.start(t + d); o.stop(t + d + 0.22);
        }
      }
    } catch { /* no audio: the spin is enough */ }
  }

  // ---------- 8. Secret code ----------
  // Only keys that do nothing else (T, A, X, I), so typing it never triggers another control.
  function party() {
    if (T.viewerOpen || game) return;
    const about = $('aboutDialog');
    if (about.open) about.close();
    honk();
    T.spin();
    T.toast('🚕 Бип-бип! Лудо такси на линија!');
  }
  const CODE = ['KeyT', 'KeyA', 'KeyX', 'KeyI'];
  let codePos = 0;
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.target.tagName === 'INPUT') return;
    if (e.code === CODE[codePos]) { if (++codePos === CODE.length) { codePos = 0; party(); } }
    else codePos = e.code === CODE[0] ? 1 : 0;
  });
  let logoTaps = [];                                     // mouse / touch: 5 quick taps on the logo in the About dialog
  $('aboutDialog').querySelector('img').addEventListener('click', () => {
    const now = performance.now();
    logoTaps = logoTaps.filter(t => now - t < 2000).concat(now);
    if (logoTaps.length >= 5) { logoTaps = []; party(); }
  });

  // ---------- 1. „Каде, шефе?“ ----------
  const RIDE_LINES = [
    n => `Тргнуваме за ${n}!`,
    n => `${n}? Може, ама по Партизанска е гужва.`,
    n => `За ${n} знам пократок пат.`,
    n => `${n}, без проблем. Ремен!`,
    n => `Ај, ${n}. Да пуштам музика?`,
    n => `${n}? Таму возев вчера, супер е.`,
    n => `${n}. Кусур имаш, нели?`,
  ];
  function ride() {
    if (T.viewerOpen || game) return;
    const s = pickOne(sheets.filter(x => x !== T.selected));
    T.closePanels();
    T.showOnMap(s);
    T.toast('🚕 ' + pickOne(RIDE_LINES)(s.name));
  }
  fun.actions.ride = ride;

  // ---------- 3. Taximeter ----------
  // Counts how far the centre of the map has travelled (panning, flying, rides). A joke tariff, not a real one.
  const TARIFF = { start: 40, perKm: 35, night: 0.2 };     // денари; +20 % between 22:00 and 06:00
  const meter = { km: 0, rides: new Set(), last: null };
  const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };
  const fare = () => Math.round((TARIFF.start + meter.km * TARIFF.perKm) * (isNight() ? 1 + TARIFF.night : 1));
  const meterEl = $('meter');
  function updateMeter() {
    meterEl.querySelector('.km').textContent = meter.km.toFixed(1) + ' km';
    meterEl.querySelector('.fare').textContent = fare() + ' ден';
    meterEl.classList.toggle('night', isNight());
  }
  fun.afterRender.push(() => {
    const p = [view.cx, view.cy];
    if (meter.last) {
      const d = Math.hypot(p[0] - meter.last[0], p[1] - meter.last[1]) * T.metersPerUnit(centreLat()) / 1000;
      if (d > 0 && d < 50) { meter.km += d; updateMeter(); }   // ignore jumps (window resize, first fit)
    }
    meter.last = p;
    if (T.selected) meter.rides.add(T.selected.name);
  });
  updateMeter();

  const receiptDlg = $('receiptDialog');
  function receipt() {
    if (T.viewerOpen) return;
    const body = receiptDlg.querySelector('.receipt-body');
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const rows = [
      ['Старт', TARIFF.start + ' ден'],
      [`Возење ${meter.km.toFixed(1)} km × ${TARIFF.perKm}`, Math.round(meter.km * TARIFF.perKm) + ' ден'],
    ];
    if (isNight()) rows.push(['Ноќна тарифа +20 %', Math.round((TARIFF.start + meter.km * TARIFF.perKm) * TARIFF.night) + ' ден']);
    rows.push(['Бакшиш', 'по желба 😉']);
    body.replaceChildren(
      mk('p', 'r-head', 'ЛУДО ТАКСИ · СКОПЈЕ'),
      mk('p', 'r-sub', `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} · ${pad(now.getHours())}:${pad(now.getMinutes())} · возач: МБ`),
      ...rows.map(([a, b]) => { const r = mk('div', 'r-row'); r.append(mk('span', '', a), mk('span', '', b)); return r; }),
      (() => { const r = mk('div', 'r-row r-total'); r.append(mk('span', '', 'ВКУПНО'), mk('span', '', fare() + ' ден')); return r; })(),
      mk('p', 'r-note', meter.rides.size
        ? `Населби: ${[...meter.rides].join(', ')}`
        : 'Уште не сме застанале никаде.'),
      mk('p', 'r-thanks', 'Ви благодариме што возевте со Лудо Такси!'),
    );
    receiptDlg.showModal();
  }
  fun.actions.receipt = receipt;
  meterEl.addEventListener('click', receipt);
  $('receiptClose').onclick = () => receiptDlg.close();
  $('receiptPay').onclick = () => { meter.km = 0; meter.rides.clear(); updateMeter(); receiptDlg.close(); T.toast('Платено. Пријатно! 👋'); };
  receiptDlg.addEventListener('click', e => { if (e.target === receiptDlg) receiptDlg.close(); });   // backdrop

  // ---------- 4. „Погоди ја населбата“ ----------
  // A piece of one drawing is shown; tap where it is on the bare street map. Five rounds, up to 1000 points each.
  const ROUNDS = 5;
  // Scores stay in this browser only: { best, bestDate, games, last }
  const STATS_KEY = 'taxi-maps-guess';
  const loadStats = () => {
    try { return Object.assign({ best: 0, bestDate: null, games: 0, last: null }, JSON.parse(localStorage.getItem(STATS_KEY) || '{}')); }
    catch { return { best: 0, bestDate: null, games: 0, last: null }; }
  };
  const fmtDate = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; };
  function showStats() {                                 // the „Погоди“ section in the About dialog
    const st = loadStats(), el = $('scoresText');
    el.replaceChildren();
    if (!st.games) { el.textContent = 'Уште немаш одиграно. Пет рунди, до 5000 поени.'; }
    else {
      el.append('Најдобар резултат: ', mk('strong', '', String(st.best)), ` / ${ROUNDS * 1000}`,
        st.bestDate ? ` (${fmtDate(st.bestDate)})` : '', mk('br'),
        `Одиграни игри: ${st.games} · последна: ${st.last ?? '–'}`);
    }
    $('scoresClear').hidden = !st.games;
    $('scoresClear').classList.remove('confirm');
    $('scoresClear').textContent = 'Избриши';
  }
  let game = null;                                       // { round, total, state: 'guess'|'result'|'over', target, guess, sheet, prevBase }
  const panel = $('gamePanel');
  const cropCanvas = $('gameCrop');

  function drawCrop(s, u, v) {
    const g = T.sheetGeom(s);
    const paint = img => {
      const c = cropCanvas, dpr = Math.min(window.devicePixelRatio || 1, 3);
      const W = c.clientWidth || 240, H = c.clientHeight || 160;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const cx = c.getContext('2d');
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.fillStyle = '#fffdf6'; cx.fillRect(0, 0, W, H);
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const k = W / (iw * 0.24);                          // show about a quarter of the sheet's width
      cx.translate(W / 2, H / 2);
      cx.rotate(g.r);                                    // turned the way it lies on the (north-up) map
      cx.scale(k, k);
      cx.drawImage(img, -u * iw, -v * ih);
    };
    if (s.small.complete && s.small.naturalWidth) paint(s.small);
    const full = s.full && s.full.complete && s.full.naturalWidth ? s.full : new Image();
    if (full !== s.full) { full.src = `sheets/${s.id}.jpg`; s.full = full; }
    if (full.complete && full.naturalWidth) paint(full);
    else full.addEventListener('load', () => { if (game && game.sheet === s) paint(full); }, { once: true });
  }

  function startGame() {
    if (T.viewerOpen) return;
    if (game) { endGame(); return; }
    game = { round: 0, total: 0, prevBase: T.prefs.base };
    T.prefs.base = true;                                 // the game needs the street map
    T.closePanels();
    panel.classList.remove('hidden');
    document.body.classList.add('game-on');
    nextRound();
  }
  function nextRound() {
    game.round++;
    game.state = 'guess';
    game.guess = null;
    T.select(null);
    fun.hideSheets = true;
    const s = game.sheet = pickOne(sheets);
    const u = 0.25 + Math.random() * 0.5, v = 0.25 + Math.random() * 0.5;
    const g = T.sheetGeom(s), lx = (u - 0.5) * g.w, ly = (v - 0.5) * g.h;
    game.target = [g.x + lx * Math.cos(g.r) - ly * Math.sin(g.r), g.y + lx * Math.sin(g.r) + ly * Math.cos(g.r)];
    drawCrop(s, u, v);
    $('gameTitle').textContent = `Погоди ја населбата · ${game.round}/${ROUNDS}`;
    $('gameText').textContent = 'Каде е ова парче од цртежот? Допри го местото на картата.';
    $('gameNext').textContent = 'Прескокни';
    T.animateTo(T.fitAll());
    T.requestRender();
  }
  function score(m) { return Math.round(1000 * Math.exp(-m / 800)); }
  function fmtDist(m) { return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`; }

  function reveal(guess) {
    const [tx, ty] = game.target;
    const m = guess ? Math.hypot(guess[0] - tx, guess[1] - ty) * T.metersPerUnit(T.yToLat(ty)) : Infinity;
    const pts = guess ? score(m) : 0;
    game.total += pts;
    game.guess = guess;
    game.state = 'result';
    fun.hideSheets = false;
    T.select(game.sheet);
    const name = game.sheet.name;
    $('gameText').textContent = guess
      ? `${name}: промаши за ${fmtDist(m)} → ${pts} поени.` + (m < 150 ? ' Право на адреса! 🎯' : m < 600 ? ' Блиску!' : '')
      : `Тоа беше ${name}. 0 поени.`;
    $('gameNext').textContent = game.round < ROUNDS ? 'Следна' : 'Резултат';
    // show both points
    const xs = [tx, guess?.[0] ?? tx], ys = [ty, guess?.[1] ?? ty];
    const g = T.sheetGeom(game.sheet);
    const w = Math.max(Math.max(...xs) - Math.min(...xs), g.w), h = Math.max(Math.max(...ys) - Math.min(...ys), g.h);
    const vw = window.innerWidth, vh = window.innerHeight;
    T.animateTo({ cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      scale: Math.min((vw - 60) / w, (vh - 320) / h), rot: 0 });
  }
  function gameOver() {
    game.state = 'over';
    fun.hideSheets = false;
    const st = loadStats();
    st.games++; st.last = game.total;
    if (game.total > st.best) { st.best = game.total; st.bestDate = Date.now(); }
    localStorage.setItem(STATS_KEY, JSON.stringify(st));
    showStats();
    const best = st.best;
    const max = ROUNDS * 1000, t = game.total;
    const verdict = t >= max * 0.8 ? 'Вистински таксист! 🚕' : t >= max * 0.5 ? 'Добро ги знаеш маалата.'
      : t >= max * 0.2 ? 'Уште малку возење и ќе ги знаеш.' : 'Следниот пат земи такси 😄';
    $('gameTitle').textContent = `Резултат: ${t} / ${max}`;
    $('gameText').textContent = `${verdict} Најдобар резултат: ${best}.`;
    $('gameNext').textContent = 'Играј пак';
    cropCanvas.getContext('2d').clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    T.select(null);
    T.animateTo(T.fitAll());
  }
  function endGame() {
    if (!game) return;
    T.prefs.base = game.prevBase;
    game = null;
    fun.hideSheets = false;
    panel.classList.add('hidden');
    document.body.classList.remove('game-on');
    T.requestRender();
  }
  $('gameNext').onclick = () => {
    if (!game) return;
    if (game.state === 'guess') reveal(null);
    else if (game.state === 'result') { if (game.round < ROUNDS) nextRound(); else gameOver(); }
    else { endGame(); startGame(); }
  };
  $('gameClose').onclick = endGame;
  fun.actions.game = startGame;
  fun.actions.escape = () => { if (!game) return false; endGame(); return true; };
  fun.onTap = (x, y) => {
    if (!game || game.state !== 'guess') return !!game && game.state === 'over';
    reveal(T.screenToWorld(x, y));
    return true;
  };
  // pins: where you tapped (dark) and where it really is (red), joined by a dashed line
  fun.afterRender.push(ctx => {
    if (!game || game.state !== 'result') return;
    const [tx, ty] = T.worldToScreen(...game.target);
    ctx.save();
    if (game.guess) {
      const [gx, gy] = T.worldToScreen(...game.guess);
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = '#2a2622';
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      pin(ctx, gx, gy, '#2a2622');
    }
    pin(ctx, tx, ty, '#c8372d');
    ctx.restore();
  });
  function pin(ctx, x, y, color) {
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  }

  // About dialog: play from there, or clear the scores (second click confirms)
  $('scoresPlay').onclick = () => { $('aboutDialog').close(); if (!game) startGame(); };
  $('scoresClear').onclick = () => {
    const b = $('scoresClear');
    if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Сигурно? Избриши'; return; }
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem('taxi-maps-guess-best');   // the key used before the stats object
    showStats();
  };
  $('aboutDialog').addEventListener('close', showStats);   // an unconfirmed "Сигурно?" resets when the dialog closes
  // carry over a best score saved by the first version of the game
  { const old = +localStorage.getItem('taxi-maps-guess-best') || 0, st = loadStats();
    if (old && !st.games) localStorage.setItem(STATS_KEY, JSON.stringify(Object.assign(st, { best: old, games: 1, last: old })));
    localStorage.removeItem('taxi-maps-guess-best'); }
  showStats();

  $('rideBtn').onclick = ride;
  $('gameBtn').onclick = startGame;
})();

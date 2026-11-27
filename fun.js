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
  let game = null;          // { seed, rnd, rounds: [...], round, total, state: 'guess'|'result'|'over', pending, challenge, timer }
  const panel = $('gamePanel');
  const cropCanvas = $('gameCrop');
  const TIMER_KEY = 'taxi-maps-guess-timer', ROUND_SECONDS = 60;

  // Every game comes from a seed, so the same five pieces can be sent to a friend (?pogodi=<seed>).
  const newSeed = () => Math.random().toString(36).slice(2, 8);
  function seededRandom(seed) {                          // mulberry32 on a hash of the seed text
    let h = 1779033703;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353), h = h << 13 | h >>> 19;
    let a = h >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const byIdOrder = [...sheets].sort((a, b) => a.id < b.id ? -1 : 1);   // same order for everyone

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
    else full.addEventListener('load', () => { if (game && game.rounds[game.round - 1]?.sheet === s) paint(full); }, { once: true });
  }

  function startGame(opts = {}) {
    if (T.viewerOpen) return;
    if (game) { endGame(); if (!opts.seed) return; }
    const seed = opts.seed || newSeed();
    const timer = opts.timer ?? (localStorage.getItem(TIMER_KEY) === '1' ? ROUND_SECONDS : 0);
    game = { seed, rnd: seededRandom(seed), rounds: [], round: 0, total: 0, prevBase: T.prefs.base,
      challenge: opts.challenge ?? null, timer, pending: null };
    T.prefs.base = true;                                 // the game needs the street map
    T.closePanels();
    T.$('aboutDialog').open && T.$('aboutDialog').close();
    panel.classList.remove('hidden');
    document.body.classList.add('game-on');
    nextRound();
  }
  function nextRound() {
    game.round++;
    game.state = 'guess';
    game.pending = null;
    T.select(null);
    fun.hideSheets = true;
    const r = game.rnd;
    const s = byIdOrder[Math.floor(r() * byIdOrder.length)];
    const u = 0.25 + r() * 0.5, v = 0.25 + r() * 0.5;
    const g = T.sheetGeom(s), lx = (u - 0.5) * g.w, ly = (v - 0.5) * g.h;
    const target = [g.x + lx * Math.cos(g.r) - ly * Math.sin(g.r), g.y + lx * Math.sin(g.r) + ly * Math.cos(g.r)];
    game.rounds.push({ sheet: s, target, guess: null, m: null, pts: 0 });
    cropCanvas.hidden = false;
    $('gameSummary').hidden = true;
    $('gameShare').hidden = true;
    drawCrop(s, u, v);
    $('gameTitle').textContent = `${game.challenge ? 'Предизвик' : 'Погоди ја населбата'} · ${game.round}/${ROUNDS}`;
    $('gameText').textContent = 'Каде е ова парче од цртежот? Допри на картата за да ставиш игла (можеш да ја поместиш), па „Погоди!“.';
    syncGuessButton();
    startTimer();
    T.animateTo(T.fitAll());
    T.requestRender();
  }
  function syncGuessButton() {
    const b = $('gameNext');
    b.textContent = game.pending ? 'Погоди!' : 'Прескокни';
    b.classList.toggle('primary', !!game.pending);
  }

  // Optional round timer: when it runs out, a placed pin counts; without one the round scores 0.
  let timerId = 0;
  function startTimer() {
    clearInterval(timerId);
    const el = $('gameTimer');
    if (!game.timer) { el.hidden = true; return; }
    const ends = performance.now() + game.timer * 1000;
    const tick = () => {
      if (!game || game.state !== 'guess') { clearInterval(timerId); el.hidden = true; return; }
      const left = Math.max(0, Math.ceil((ends - performance.now()) / 1000));
      el.hidden = false;
      el.textContent = `⏱ ${left}`;
      el.classList.toggle('low', left <= 10);
      if (left <= 0) { clearInterval(timerId); reveal(game.pending); }
    };
    tick();
    timerId = setInterval(tick, 250);
  }

  function score(m) { return Math.round(1000 * Math.exp(-m / 800)); }
  function fmtDist(m) { return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`; }
  const distM = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * T.metersPerUnit(T.yToLat(b[1]));

  function fitPoints(pts, minW = 0, minH = 0) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const w = Math.max(Math.max(...xs) - Math.min(...xs), minW, 1), h = Math.max(Math.max(...ys) - Math.min(...ys), minH, 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    T.animateTo({ cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      scale: Math.min((vw - 80) / w, (vh - 360) / h), rot: 0 });
  }

  function reveal(guess) {
    clearInterval(timerId);
    $('gameTimer').hidden = true;
    const rd = game.rounds[game.round - 1];
    rd.guess = guess || null;
    rd.m = guess ? distM(guess, rd.target) : null;
    rd.pts = guess ? score(rd.m) : 0;
    game.total += rd.pts;
    game.pending = null;
    game.state = 'result';
    fun.hideSheets = false;
    T.select(rd.sheet);
    const name = rd.sheet.name;
    $('gameText').textContent = guess
      ? `${name}: промаши за ${fmtDist(rd.m)} → ${rd.pts} поени.` + (rd.m < 150 ? ' Право на адреса! 🎯' : rd.m < 600 ? ' Блиску!' : '')
      : `Тоа беше ${name}. 0 поени.`;
    $('gameNext').textContent = game.round < ROUNDS ? 'Следна' : 'Резултат';
    $('gameNext').classList.add('primary');
    const g = T.sheetGeom(rd.sheet);
    fitPoints(guess ? [rd.target, guess] : [rd.target], g.w, g.h);
  }

  function gameOver() {
    game.state = 'over';
    fun.hideSheets = false;
    const st = loadStats();
    st.games++; st.last = game.total;
    if (game.total > st.best) { st.best = game.total; st.bestDate = Date.now(); }
    localStorage.setItem(STATS_KEY, JSON.stringify(st));
    showStats();
    const max = ROUNDS * 1000, t = game.total;
    const verdict = t >= max * 0.8 ? 'Вистински таксист! 🚕' : t >= max * 0.5 ? 'Добро ги знаеш маалата.'
      : t >= max * 0.2 ? 'Уште малку возење и ќе ги знаеш.' : 'Следниот пат земи такси 😄';
    $('gameTitle').textContent = `Резултат: ${t} / ${max}`;
    let text = `${verdict} Најдобар резултат: ${st.best}.`;
    if (game.challenge != null) {
      const c = game.challenge;
      text = (t > c ? `Го победи предизвикот (${c})! 🏆 ` : t === c ? `Нерешено со предизвикот (${c}). ` : `Предизвикот (${c}) остана непобеден. `) + text;
    }
    $('gameText').textContent = text;
    // the five rounds as a list; the map shows all of them (numbered pins)
    const list = $('gameSummary');
    list.replaceChildren(...game.rounds.map((rd, i) => {
      const li = mk('li');
      li.append(mk('span', 'n', String(i + 1)), mk('span', 'nm', rd.sheet.name),
        mk('span', 'd', rd.guess ? fmtDist(rd.m) : '—'), mk('span', 'p', String(rd.pts)));
      return li;
    }));
    list.hidden = false;
    cropCanvas.hidden = true;
    $('gameShare').hidden = false;
    $('gameNext').textContent = 'Играј пак';
    T.select(null);
    fitPoints(game.rounds.flatMap(rd => rd.guess ? [rd.target, rd.guess] : [rd.target]));
  }
  function endGame() {
    if (!game) return;
    clearInterval(timerId);
    $('gameTimer').hidden = true;
    T.prefs.base = game.prevBase;
    game = null;
    fun.hideSheets = false;
    panel.classList.add('hidden');
    document.body.classList.remove('game-on');
    T.requestRender();
  }

  // Challenge a friend: a link with the same seed (same five pieces), the timer and your score.
  function challengeLink() {
    const u = new URL(location.href);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) u.searchParams.delete(k);
    u.searchParams.set('pogodi', game.seed);
    u.searchParams.set('rez', String(game.total));
    if (game.timer) u.searchParams.set('t', String(game.timer));
    return u.toString();
  }
  $('gameShare').onclick = async () => {
    if (!game) return;
    const url = challengeLink(), title = `Лудо Такси: погоди ја населбата. Мој резултат: ${game.total}. Можеш подобро?`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, text: title, url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); T.toast('Линкот за предизвик е копиран'); }
    catch { prompt('Копирај го линкот:', url); }
  };
  // Opening a challenge link starts that game straight away (and tidies the address)
  {
    const q = new URLSearchParams(location.search), seed = q.get('pogodi');
    if (seed && /^[a-z0-9]{1,16}$/i.test(seed)) {
      const rez = q.get('rez'), t = +q.get('t') || 0;
      for (const k of ['pogodi', 'rez', 't']) q.delete(k);
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
      setTimeout(() => startGame({ seed, challenge: rez != null && /^\d+$/.test(rez) ? +rez : null, timer: t > 0 ? Math.min(t, 600) : 0 }), 300);
    }
  }

  $('gameNext').onclick = () => {
    if (!game) return;
    if (game.state === 'guess') reveal(game.pending);   // „Погоди!“ with a pin, „Прескокни“ without
    else if (game.state === 'result') { if (game.round < ROUNDS) nextRound(); else gameOver(); }
    else { endGame(); startGame(); }
  };
  $('gameClose').onclick = endGame;
  fun.actions.game = () => startGame();
  fun.actions.escape = () => { if (!game) return false; endGame(); return true; };
  fun.actions.enter = () => { if (!game) return false; $('gameNext').click(); return true; };
  fun.onTap = (x, y) => {
    if (!game || game.state !== 'guess') return false;  // after a round the map can be explored
    game.pending = T.screenToWorld(x, y);              // place or move the pin; „Погоди!“ confirms
    syncGuessButton();
    T.requestRender();
    return true;
  };

  // Pins: the pin you placed (dark), where it really is (red), a dashed line between; numbered at the end
  fun.afterRender.push(ctx => {
    if (!game) return;
    ctx.save();
    if (game.state === 'guess' && game.pending) pin(ctx, ...T.worldToScreen(...game.pending), '#2a2622');
    const shown = game.state === 'result' ? [game.rounds[game.round - 1]] : game.state === 'over' ? game.rounds : [];
    shown.forEach(rd => {
      const [tx, ty] = T.worldToScreen(...rd.target);
      if (rd.guess) {
        const [gx, gy] = T.worldToScreen(...rd.guess);
        ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = T.night ? '#f2c66d' : '#2a2622';
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
        pin(ctx, gx, gy, '#2a2622');
      }
      pin(ctx, tx, ty, '#c8372d', game.state === 'over' ? String(game.rounds.indexOf(rd) + 1) : '');
    });
    ctx.restore();
  });
  function pin(ctx, x, y, color, label = '') {
    ctx.beginPath(); ctx.arc(x, y, label ? 11 : 9, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (label) { ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 0.5); }
  }

  // Timer setting (About dialog)
  $('timerToggle').checked = localStorage.getItem(TIMER_KEY) === '1';
  $('timerToggle').onchange = e => localStorage.setItem(TIMER_KEY, e.target.checked ? '1' : '0');

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

  // ---------- 2. The little taxi on flights ----------
  // When the map flies to or from a sheet, a small taxi (like the one in the logo) drives along the flight:
  // the camera follows it, with a slight swerve, then it parks with a bounce and a puff and fades away.
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // same easing as the map flight
  const PARK_MS = 900, FADE_MS = 300;
  const TAXI_SIZE = 2;                                   // drawn at 2× the 46 × 30 px outline below
  let trip = null;
  fun.onFlight = a => {
    if (!a || !T.prefs.taxi || game) { trip = null; return; }
    const dx = a.to.cx - a.from.cx, dy = a.to.cy - a.from.cy, len = Math.hypot(dx, dy);
    if (len * Math.max(a.from.scale, a.to.scale) < 40) { trip = null; return; }   // hardly moves: no taxi
    trip = { a, dx, dy, len, side: Math.random() < .5 ? -1 : 1, lastPos: null, heading: Math.atan2(dy, dx) };
    T.requestRender();
  };
  const tripWorld = (tr, e) => {                         // the flight's centre line plus a gentle sideways arc
    const { a, dx, dy, len, side } = tr, arc = Math.sin(Math.PI * e) * len * 0.08 * side;
    return [a.from.cx + dx * e - dy / len * arc, a.from.cy + dy * e + dx / len * arc];
  };
  fun.afterRender.push((ctx, now) => {
    if (!trip) return;
    const { a } = trip, t = (now - a.t0) / a.ms;
    if (t < 1 && T.anim !== a) { trip = null; return; }   // the flight was interrupted (drag, another flight)
    const e = ease(Math.min(1, Math.max(0, t)));
    const [x, y] = T.worldToScreen(...tripWorld(trip, e));
    if (trip.lastPos && t < 1) {
      const mx = x - trip.lastPos[0], my = y - trip.lastPos[1];
      if (Math.hypot(mx, my) > 0.5) trip.heading = Math.atan2(my, mx);
    }
    trip.lastPos = [x, y];
    const parked = Math.max(0, now - a.t0 - a.ms);
    if (parked > PARK_MS + FADE_MS) { trip = null; T.requestRender(); return; }
    const alpha = parked > PARK_MS ? 1 - (parked - PARK_MS) / FADE_MS : Math.min(1, t * 6);
    const bounce = parked > 0 && parked < 400 ? Math.sin(parked / 400 * Math.PI * 2) * 2.5 * TAXI_SIZE * (1 - parked / 400) : 0;
    drawTaxi(ctx, x, y - bounce, trip.heading, alpha, t < 1 ? now : 0, parked);
    T.requestRender();
  });
  function drawTaxi(ctx, x, y, heading, alpha, driving, parked) {
    const left = Math.cos(heading) < 0;
    let tilt = left ? heading - Math.PI : heading;       // nose up / down a little with the direction of travel
    tilt = Math.atan2(Math.sin(tilt), Math.cos(tilt));
    tilt = Math.max(-0.45, Math.min(0.45, tilt));
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(TAXI_SIZE, TAXI_SIZE);
    if (left) ctx.scale(-1, 1);
    const ink = '#2a2622';
    if (T.night) {                                        // headlight beam
      const g = ctx.createLinearGradient(22, 0, 90, 0);
      g.addColorStop(0, 'rgba(255,230,150,.55)'); g.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(22, -5); ctx.lineTo(90, -22); ctx.lineTo(90, 14); ctx.closePath(); ctx.fill();
    }
    if (parked > 0 && parked < 700) {                     // puff of exhaust behind
      const p = parked / 700;
      ctx.fillStyle = `rgba(150,150,150,${0.5 * (1 - p)})`;
      for (const [ox, oy, r] of [[-28, 0, 4], [-34, -4, 5], [-41, -2, 6]]) {
        ctx.beginPath(); ctx.arc(ox - p * 10, oy - p * 6, r * (0.6 + p), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.lineJoin = 'round';
    ctx.fillStyle = '#f7c600';                            // body
    ctx.beginPath();
    ctx.moveTo(-22, 4); ctx.lineTo(-22, -6); ctx.quadraticCurveTo(-22, -10, -17, -10);
    ctx.lineTo(-11, -10); ctx.lineTo(-7, -18); ctx.lineTo(8, -18); ctx.lineTo(13, -10);
    ctx.lineTo(19, -10); ctx.quadraticCurveTo(23, -9, 23, -4); ctx.lineTo(23, 4); ctx.closePath();
    ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();
    ctx.fillStyle = T.night ? '#ffe9a8' : '#bfe3f2';      // windows (lit inside at night)
    ctx.beginPath(); ctx.moveTo(-9, -11); ctx.lineTo(-6, -16); ctx.lineTo(0, -16); ctx.lineTo(0, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -11); ctx.lineTo(2, -16); ctx.lineTo(7, -16); ctx.lineTo(10.5, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ink;                                  // chequered stripe
    for (let i = 0; i < 9; i++) if (i % 2 === 0) ctx.fillRect(-18 + i * 4, -4, 4, 3);
    ctx.fillStyle = T.night ? '#fff6c2' : '#fff';         // roof sign
    ctx.fillRect(-5, -23, 10, 5); ctx.strokeRect(-5, -23, 10, 5);
    ctx.fillStyle = '#ffd94a';                            // headlight
    ctx.beginPath(); ctx.arc(21, -5, 2, 0, Math.PI * 2); ctx.fill();
    const spin = driving ? driving / 60 : 0;              // wheels, turning while driving
    for (const wx of [-12, 13]) {
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(wx, 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(spin) * 3, 4 + Math.sin(spin) * 3); ctx.lineTo(wx - Math.cos(spin) * 3, 4 - Math.sin(spin) * 3); ctx.stroke();
    }
    ctx.restore();
  }

  $('rideBtn').onclick = ride;
  $('gameBtn').onclick = () => startGame();
})();

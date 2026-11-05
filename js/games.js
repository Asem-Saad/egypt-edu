/* Reusable game types. Each one is fed by lesson data:  GAMES[type](el, mission, done(mistakes))  */
const GAMES = {};
let keyHandler = null;               // one active keyboard handler per screen
document.addEventListener('keydown', e => { if (keyHandler && !e.ctrlKey && !e.altKey && !e.metaKey) keyHandler(e); });
const onKeys = fn => { keyHandler = fn; };
let timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };
let dragCleanup = null;              // an unfinished drag is cancelled when the screen changes
function clearGame() { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = []; keyHandler = null; hush(); if (dragCleanup) dragCleanup(); }
const keyNum = e => +toLatinDigits(e.key);   // number keys work with Latin (1) and Arabic (١) digits
const forMode = list => list.filter(x => !(young() ? x.expert : x.young));
const hash32 = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const stableOrder = (arr, seed) => [...arr].sort((a, b) => hash32(seed + a) - hash32(seed + b));   // same order every time for a question
const hdrH = () => { const t = $('.top'); return t && getComputedStyle(t).position === 'sticky' ? t.offsetHeight : 0; };
const scrollToEl = (node, block = 'start') => {
  if (!node) return;
  const r = node.getBoundingClientRect(), h = hdrH();
  const top = block === 'center' ? r.top + scrollY - (innerHeight - h - r.height) / 2 - h : r.top + scrollY - h - 8;
  const target = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight)), start = scrollY;
  window.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  setTimeout(() => { if (Math.abs(scrollY - start) < 2 && Math.abs(target - start) > 2) window.scrollTo(0, target); }, 500);   // smooth scroll not supported → jump
};
const mapBox = html => `<div class="mapbox">${html}</div>`;
/* questions with answer choices: read [explanation] → «أجب عن السؤال التالي» → question → ١: … ٢: … ٣: …
   (answers keep a fixed order per question, so the spoken numbers match the screen and each sentence has a recording) */
const numbered = opts => opts.map((o, k) => AR_NUM(k + 1) + ': ' + o).join('، ');
const askSpeech = (explain, q, opts) => [explain, fem('أجب عن السؤال التالي:'), q, numbered(opts)].filter(Boolean).join(' ');
const optRows = (opts, attr = o => `data-o="${esc(o)}"`, label = o => o) =>
  `<div class="qopts">${opts.map((o, k) => `<div class="optrow"><span class="num" aria-hidden="true">${AR_NUM(k + 1)}</span><button class="opt" ${attr(o)}>${label(o)}</button></div>`).join('')}</div>`;
/* number keys 1..n press the matching answer button inside `box` */
const keysFor = box => onKeys(e => { const n = keyNum(e), b = $$('.opt', box)[n - 1]; if (b && !b.disabled) { e.preventDefault(); b.click(); } });
const mapInfoOpts = p => stableOrder([p.ans, ...p.w], p.q);
const mapInfoSpeech = p => askSpeech(p.name + '. ' + p.info + '.', p.q, mapInfoOpts(p));
function centerMapBox(el) {   // on phones the map is wider than the screen: start in the middle
  const b = $('.mapbox', el); if (b && b.scrollWidth > b.clientWidth) b.scrollLeft = (getComputedStyle(b).direction === 'rtl' ? -1 : 1) * (b.scrollWidth - b.clientWidth) / 2;
}

/* ---------- flip cards ---------- */
GAMES.cards = (el, m, done) => {
  const C = forMode(m.cards);
  el.innerHTML = `${guide(m.guide || 'اضغط على كل بطاقة لتقلبها وتكتشف السر!')}
    <div class="bar"><div class="grow"></div><div class="pill">🃏 <span id="cnt">٠</span>/${AR_NUM(C.length)}</div></div>
    <div class="cards">${C.map((c, i) => `<button class="flip" data-i="${i}" aria-label="${esc(c.f)}"><div class="in"><div class="f"><div class="em">${c.em}</div>${c.f}</div><div class="b">${c.b}</div></div></button>`).join('')}</div>`;
  const seen = new Set();
  $$('.flip', el).forEach(b => b.onclick = () => {
    b.classList.toggle('on');
    if (b.classList.contains('on')) say(C[b.dataset.i].f + '. ' + C[b.dataset.i].b);
    if (!seen.has(b.dataset.i)) {
      seen.add(b.dataset.i); beep('ok'); $('#cnt').textContent = AR_NUM(seen.size);
      if (seen.size === C.length) later(() => done(0), 900);
    }
  });
};

/* ---------- sort into zones: drag, tap-tap, or keyboard numbers ---------- */
GAMES.sort = (el, m, done) => {
  const items = forMode(m.items.map(a => Array.isArray(a) ? { t: a[0], z: a[1], expert: a[2] === 'x', young: a[2] === 'y' } : a));
  el.innerHTML = `${guide(m.guide || yx('اسحب كل بطاقة إلى مكانها الصحيح — أو اضغط البطاقة ثم المكان.', 'اسحب البطاقات أو اضغطها ثم اضغط المكان. على الكمبيوتر: Tab للاختيار ثم رقم المكان.'))}
    <div class="tray" id="tray"></div><div id="zones"></div>`;
  const tray = $('#tray', el), zbox = $('#zones', el), zones = m.zones;
  zbox.className = 'zones ' + (m.layout || (zones.length === 3 ? 'cols3' : 'cols2'));
  zbox.innerHTML = (m.layout === 'compass' ? `<div class="c">${m.center || '🗺️ الوطن العربي'}</div>` : '') +
    zones.map((z, i) => `<button class="zone" data-z="${z.id}" style="grid-area:${z.area || 'auto'}"><h4>${z.label}<span class="key">${i + 1}</span></h4><div class="got"></div></button>`).join('');
  tray.innerHTML = shuffle(items).map(it => `<button class="chip" data-z="${it.z}">${it.t}</button>`).join('');
  let sel = null, left = items.length, mistakes = 0, lastDrop = 0;
  const select = c => { if (sel) sel.classList.remove('sel'); sel = c; if (c) { c.classList.add('sel'); beep('tap'); } };
  function place(chip, zoneEl) {
    if (!chip || !zoneEl) return;
    if (chip.dataset.z === zoneEl.dataset.z) {
      chip.classList.remove('sel'); chip.classList.add('ok'); chip.disabled = true;
      zoneEl.querySelector('.got').appendChild(chip); beep('ok'); addXP(1); sel = null;
      const f = m.facts && m.facts[chip.textContent]; if (f) { toast(f, 3800); }
      if (--left === 0) later(() => done(mistakes), 400);
      else { const nxt = tray.querySelector('.chip'); nxt && nxt.focus({ preventScroll: true }); }
    } else {
      mistakes++; select(null); chip.classList.add('bad'); beep('bad');
      later(() => chip.classList.remove('bad'), 400);
      const h = m.hints && m.hints[chip.textContent];
      if (young()) toast(h || 'حاول مرة أخرى! 💪');
    }
  }
  $$('.chip', tray).forEach(c => {
    c.onclick = () => { if (c._dragged) return; select(sel === c ? null : c); };
    c.onpointerdown = e => {
      if (c.disabled || e.button > 0) return;
      const sx = e.clientX, sy = e.clientY; let ghost = null, hot = null;
      const mv = ev => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        if (!ghost) { ghost = c.cloneNode(true); ghost.classList.add('ghost'); document.body.appendChild(ghost); select(c); }
        ghost.style.left = (ev.clientX - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (ev.clientY - ghost.offsetHeight / 2) + 'px';
        const z = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.zone');
        if (hot !== z) { hot && hot.classList.remove('hot'); hot = z; hot && hot.classList.add('hot'); }
      };
      const stop = () => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
        if (ghost) ghost.remove(); hot && hot.classList.remove('hot'); dragCleanup = null;
      };
      const up = () => {
        const dragged = !!ghost, target = hot; stop();
        if (dragged) { c._dragged = true; lastDrop = Date.now(); setTimeout(() => c._dragged = false, 60); if (target) place(c, target); else select(null); }
      };
      const cancel = () => { const dragged = !!ghost; stop(); if (dragged) select(null); };
      dragCleanup = stop;
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
    };
  });
  $$('.zone', zbox).forEach(z => z.onclick = () => {
    if (Date.now() - lastDrop < 500) return;     // the click that follows a drop is not a new tap
    if (sel) place(sel, z); else toast('اختر بطاقة أولاً ثم اضغط على المكان الصحيح');
  });
  onKeys(e => { const n = keyNum(e); if (sel && n >= 1 && n <= zones.length) { e.preventDefault(); place(sel, $$('.zone', zbox)[n - 1]); } });
};

/* ---------- match term ↔ meaning ---------- */
GAMES.match = (el, m, done) => {
  let pairs = shuffle(m.pairs);
  if (young()) pairs = pairs.slice(0, m.youngCount || 4);
  el.innerHTML = `${guide(m.guide || 'اضغط على الكلمة، ثم اضغط على معناها الصحيح.')}
    <div class="match"><div class="col" id="terms">${shuffle(pairs).map(p => `<button data-k="${esc(p[0])}">${p[0]}</button>`).join('')}</div>
    <div class="col" id="defs">${shuffle(pairs).map(p => `<button class="def" data-k="${esc(p[0])}">${p[1]}</button>`).join('')}</div></div>`;
  let sel = null, left = pairs.length, mistakes = 0;
  $$('#terms button', el).forEach(b => b.onclick = () => { $$('#terms .sel', el).forEach(x => x.classList.remove('sel')); sel = b; b.classList.add('sel'); beep('tap'); say(b.textContent); });
  $$('#defs button', el).forEach(b => b.onclick = () => {
    if (!sel) { toast('اختر الكلمة أولاً (العمود الأيمن)'); return; }
    if (b.dataset.k === sel.dataset.k) {
      [b, sel].forEach(x => { x.classList.remove('sel'); x.classList.add('ok'); x.disabled = true; });
      beep('ok'); addXP(1); sel = null; if (--left === 0) later(() => done(mistakes), 500);
    } else { mistakes++; b.classList.add('bad'); beep('bad'); later(() => b.classList.remove('bad'), 400); }
  });
};

/* ---------- find on the real map (countries or places) ---------- */
GAMES.mapFind = (el, m, done) => {
  let targets = forMode(m.targets);
  targets = shuffle(targets).slice(0, young() ? (m.youngRounds || 6) : (m.rounds || targets.length));
  const isPlace = !!targets[0].p;
  el.innerHTML = `${guide(m.guide || 'اقرأ السؤال ثم اضغط على المكان الصحيح في الخريطة.')}
    <div class="bar"><div class="grow"></div><div class="pill">🎯 <span id="sc">٠</span>/${AR_NUM(targets.length)}</div></div>
    <div class="prompt sticky-q" id="pr"></div>
    ${mapBox(renderMap({ tapCountries: !isPlace, labels: isPlace ? (young() ? 'arab' : 'none') : 'none', points: isPlace ? shuffle(forMode(m.targets)) : null }))}
    <p class="note" id="fact"></p>`;
  const svg = $('svg.rmap', el); keyActivate(svg); centerMapBox(el);
  later(() => scrollToEl($('#pr', el)), 900);   // show the question with the whole map under it
  let i = 0, mistakes = 0, tries = 0, busy = false;
  const ask = () => {
    if (i >= targets.length) return later(() => done(mistakes), 500);
    const t = targets[i]; tries = 0; busy = false;
    const q = isPlace ? `أين ${t.name}؟` : (t.q || `أين ${MAP.arab[t.k].ar}؟`);
    $('#pr', el).innerHTML = q + ' ' + sayBtn(q); if (S.autoSay && young()) say(q);
  };
  svg.addEventListener('click', e => {
    const hit = e.target.closest(isPlace ? '.pt' : '[data-k]'); if (!hit || busy || i >= targets.length) return;
    const t = targets[i], key = isPlace ? hit.dataset.p : hit.dataset.k, want = isPlace ? t.p : t.k;
    const shape = isPlace ? $(`.pt[data-p="${want}"]`, svg) : $(`path[data-k="${want}"]`, svg);
    if (key === want) {
      busy = true; beep('ok'); addXP(2); shape.classList.remove('hint'); shape.classList.add('ok'); $$(`.hit[data-k="${want}"]`, svg).forEach(h => h.classList.add('ok'));
      if (isPlace) { const pu = hit.querySelector('.pulse'); pu && pu.remove(); hit.setAttribute('aria-label', t.name); }
      $('#fact', el).textContent = '✅ ' + (t.fact || (isPlace ? t.name : MAP.arab[want].ar));
      if (!isPlace) later(() => shape.classList.remove('ok'), 1400);
      $('#sc', el).textContent = AR_NUM(++i); later(ask, 900);
    } else {
      mistakes++; tries++; beep('bad');
      const wrong = isPlace ? hit : $(`path[data-k="${key}"]`, svg);
      if (!isPlace && wrong) { wrong.classList.add('no'); later(() => wrong.classList.remove('no'), 700); toast('هذه ' + MAP.arab[key].ar); say('هذه ' + MAP.arab[key].ar); }
      if (isPlace) { const n = targets.concat(m.targets).find(x => x.p === key); const said = 'هذه ' + (n ? n.name : 'مكان آخر'); toast(said); say(said); }
      if (tries >= (young() ? 1 : 2)) { shape.classList.remove('hint'); void shape.getBoundingClientRect(); shape.classList.add('hint'); }
    }
  });
  ask();
};

/* ---------- explore map points, answer a question at each ---------- */
GAMES.mapInfo = (el, m, done) => {
  const P = forMode(m.points), solved = new Set(); let mistakes = 0;
  el.innerHTML = `${guide(m.guide || 'اضغط على كل نقطة في الخريطة واكتشف سرّها، ثم أجب عن السؤال!')}
    <div class="bar"><div class="grow"></div><div class="pill">📍 <span id="sc">٠</span>/${AR_NUM(P.length)}</div></div>
    ${mapBox(renderMap({ labels: m.labels || 'arab', points: P, pointNames: m.pointNames, lines: m.mapLines }))}
    <div class="panel" id="card"><b>${fem('👆 اختر نقطة على الخريطة')}</b></div>`;
  const svg = $('svg.rmap', el); keyActivate(svg); centerMapBox(el);
  const open = p => {
    const card = $('#card', el);
    const done1 = solved.has(p.p), speech = done1 ? p.name + '. ' + p.info + '.' : mapInfoSpeech(p);
    card.innerHTML = `<div class="bar"><h3 class="grow">${p.em || '📍'} ${p.name}</h3>${sayBtn(speech)}</div><p>${p.info}</p>
      ${done1 ? `<p>✅ <b>${p.ans}</b></p>` : `<p class="note">${fem('أجب عن السؤال التالي:')}</p><b>${p.q}</b>${optRows(mapInfoOpts(p))}`}
      ${p.more && !young() ? `<p class="note">💡 ${p.more}</p>` : ''}`;
    if (S.autoSay && young()) say(speech);
    keysFor(card);
    $$('.opt', card).forEach(b => b.onclick = () => {
      if (b.textContent === p.ans) {
        b.classList.add('ok'); beep('ok'); addXP(2); solved.add(p.p); $('#sc', el).textContent = AR_NUM(solved.size);
        const g = $(`.pt[data-p="${p.p}"]`, svg); g.classList.add('ok'); const pu = g.querySelector('.pulse'); pu && pu.remove();
        $$('.opt', card).forEach(x => x.disabled = true);
        if (solved.size === P.length) later(() => done(mistakes), 700);
        else later(() => scrollToEl($('.mapbox', el)), 1300);   // back up to the map for the next point
      } else { mistakes++; b.classList.add('no'); beep('bad'); b.disabled = true; }
    });
    later(() => scrollToEl(card, 'center'), 60);   // bring the explanation and question into view
  };
  svg.addEventListener('click', e => { const g = e.target.closest('.pt'); if (g) open(P.find(x => x.p === g.dataset.p)); });
};

/* ---------- choose all correct options ---------- */
const pickOpts = m => [...forMode(m.options)].sort((a, b) => hash32(m.prompt + a.t) - hash32(m.prompt + b.t));
const pickSpeech = m => { const o = pickOpts(m), need = o.filter(x => x.ok).length;
  return [m.prompt + '.', fem(`اختر ${AR_NUM(need)} إجابات صحيحة ثم اضغط تحقق.`), numbered(o.map(x => x.t))].join(' '); };
GAMES.pick = (el, m, done) => {
  const opts = [...forMode(m.options)].sort((a, b) => hash32(m.prompt + a.t) - hash32(m.prompt + b.t));   // fixed order
  const need = opts.filter(o => o.ok).length;
  el.innerHTML = `${guide(m.guide)}
    <div class="scene" id="scene">${m.scene || ''}</div>
    <div class="prompt">${m.prompt} ${sayBtn(pickSpeech(m))}</div>
    <p class="note" style="text-align:center">${fem(`اختر ${AR_NUM(need)} إجابات صحيحة ثم اضغط «تحقق»`)}</p>
    <div class="picks">${opts.map((o, i) => `<button class="pick" data-i="${i}" aria-pressed="false"><span class="box"></span><span class="pnum">${AR_NUM(i + 1)}</span>${o.t}</button>`).join('')}</div>
    <p style="text-align:center"><button class="btn go" id="chk">تحقق ✔</button></p>`;
  if (S.autoSay && young()) say(pickSpeech(m));
  onKeys(e => { const n = keyNum(e), b = $$('.pick', el)[n - 1]; if (b) { e.preventDefault(); b.click(); } if (e.key === 'Enter' && document.activeElement === document.body) $('#chk', el).click(); });
  let mistakes = 0;
  $$('.pick', el).forEach(b => b.onclick = () => { if (b.classList.contains('ok')) return; b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); beep('tap'); });
  $('#chk', el).onclick = () => {
    let good = 0, bad = 0;
    $$('.pick', el).forEach(b => {
      const o = opts[b.dataset.i], on = b.classList.contains('on');
      b.classList.remove('no', 'miss');
      if (on && o.ok) { b.classList.add('ok'); good++; }
      else if (on && !o.ok) { b.classList.add('no'); bad++; b.classList.remove('on'); }
      else if (!on && o.ok && young() && mistakes > 0) b.classList.add('miss');
    });
    if (bad) { mistakes += bad; beep('bad'); toast(yx('بعض الاختيارات غير صحيحة — جرّب مرة أخرى!', `${AR_NUM(bad)} اختيار غير صحيح`)); return; }
    if (good < need) { mistakes++; beep('bad'); toast(`صحيح! لكن بقي ${AR_NUM(need - good)}`); return; }
    $('#chk', el).disabled = true; $$('.pick', el).forEach(b => b.disabled = true);
    beep('ok'); addXP(need); if (m.win) $('#scene', el).innerHTML = m.win;
    later(() => done(mistakes), 900);
  };
};

/* ---------- quiz (timed in expert mode) ---------- */
const quizSpeech = q => askSpeech('', q.q, stableOrder([q.a, ...q.w], q.q));
GAMES.quiz = (el, m, done) => {
  let Q = shuffle(forMode(m.questions));
  if (m.limit) Q = Q.slice(0, young() ? m.limit[0] : m.limit[1]);
  const T = young() ? 0 : (m.time || 20); let i = 0, score = 0;
  function show() {
    if (i >= Q.length) {
      const pct = score / Q.length, key = m.qid;
      S.quizBest[key] = Math.max(S.quizBest[key] || 0, Math.round(pct * 100)); save();
      if (pct >= .6) return done(Q.length - score, `${AR_NUM(score)} من ${AR_NUM(Q.length)}`);
      el.innerHTML = `<div class="panel" style="text-align:center"><div class="big">💪</div><h2>${AR_NUM(score)} من ${AR_NUM(Q.length)}</h2><p>${fem('تحتاج ٦٠٪ للفوز — راجع البطاقات وجرّب مرة أخرى!')}</p><button class="btn" id="again">${fem('حاول مجدداً')}</button></div>`;
      $('#again', el).onclick = () => GAMES.quiz(el, m, done); return;
    }
    const q = Q[i], opts = stableOrder([q.a, ...q.w], q.q); let left = T, locked = false, tick;
    el.innerHTML = `<div class="bar"><div class="grow"></div><div class="pill">${AR_NUM(i + 1)}/${AR_NUM(Q.length)}</div><div class="pill">✅ ${AR_NUM(score)}</div></div>
      <div class="panel">${T ? '<div class="timer"><i id="tb" style="width:100%"></i></div>' : ''}
      <div class="bar"><div class="q grow">${q.q}</div>${sayBtn(quizSpeech(q))}</div>
      <div class="qopts">${opts.map((o, k) => `<div class="optrow"><span class="num" aria-hidden="true">${AR_NUM(k + 1)}</span><button class="opt" data-o="${esc(o)}">${o}</button></div>`).join('')}</div>
      <p class="note" id="why">${fem(young() ? 'خذ وقتك 😊' : '⏱️ ' + AR_NUM(T) + ' ثانية — اضغط ١ أو ٢ أو ٣ للإجابة السريعة')}</p></div>`;
    if (S.autoSay && young()) say(quizSpeech(q));
    const btns = $$('.opt', el);
    const pick = b => {
      if (locked) return; locked = true; clearInterval(tick);
      const ok = b && b.dataset.o === q.a;
      if (ok) { b.classList.add('ok'); score++; beep('ok'); addXP(2); }
      else {
        b && b.classList.add('no'); beep('bad'); btns.find(x => x.dataset.o === q.a).classList.add('ok');
        S.wrong[q.q] = (S.wrong[q.q] || 0) + 1; save();
      }
      btns.forEach(x => x.disabled = true);
      if (q.why || !ok) $('#why', el).innerHTML = (ok ? '💡 ' : '✅ الإجابة: <b>' + q.a + '</b>. ') + (q.why || '');
      later(() => { i++; show(); }, ok && !q.why ? 800 : 2200);
    };
    btns.forEach(b => b.onclick = () => pick(b));
    onKeys(e => { const n = keyNum(e); if (n >= 1 && n <= btns.length) pick(btns[n - 1]); });
    if (T) tick = every(() => {
      left -= .2; const tb = $('#tb', el);
      if (tb) { tb.style.width = Math.max(0, left / T * 100) + '%'; if (left < T / 3) tb.style.background = 'var(--red)'; }
      if (left <= 0) { toast('⏰ انتهى الوقت!'); pick(null); }
    }, 200);
  }
  show();
};

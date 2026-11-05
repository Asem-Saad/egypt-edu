/* Core: state, sound, voice, helpers. Everything is plain JS so it runs offline from any static host. */
window.LESSONS = [];
const KEY = ME ? ACC.progressKey(ME.id) : 'arabTrip.guest';   // progress per child (see account.js)
const S = { mode: 'young', xp: 0, done: {}, sound: true, autoSay: true, wrong: {}, quizBest: {} };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} if (ME) CLOUD.queuePush(ME.id); }   // device first, then online

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const young = () => S.mode === 'young';
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
const AR_NUM = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function addXP(n) { S.xp += n; const x = $('#xp'); if (x) x.textContent = AR_NUM(S.xp); save(); }

/* ---- sound effects, generated (no audio files) ---- */
let ac;
function beep(type) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'ok' ? [660, 880] : type === 'win' ? [523, 659, 784, 1046] : type === 'tap' ? [520] : [220, 180];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .11;
      o.type = type === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(type === 'tap' ? .06 : .15, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .2);
    });
  } catch (e) {}
}

/* ---- Arabic voice-over ----
   1) a pre-recorded natural Egyptian voice (audio/m = Shakir for boy companions, audio/f = Salma for girl companions),
      listed in js/data/voice.js and made by tools/make_voice.py;
   2) the device's own Arabic voice for anything not recorded (e.g. a sentence with the child's name). */
let arVoice = null, curAudio = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang));
  arVoice = vs.find(v => /EG/i.test(v.lang) && /natural|online/i.test(v.name)) || vs.find(v => /EG/i.test(v.lang)) ||
            vs.find(v => /natural|online/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
const voiceText = t => String(t).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const voiceKey = t => { let h = 2166136261; for (const c of voiceText(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };
const hasRecording = t => !!(window.VOICE && window.VOICE[voiceKey(t)]);
const canSay = () => !!(window.VOICE || arVoice);
window.__voiceLog = null;   // QA only: a Set that collects every sentence the app can speak
function deviceSay(text, force) {
  if (!('speechSynthesis' in window)) return;
  if (!arVoice) { if (force) toast('لا يوجد صوت عربي على هذا الجهاز'); return; }
  const u = new SpeechSynthesisUtterance(voiceText(text).replace(/\.{3,}|…+/g, ' ... '));
  u.voice = arVoice; u.lang = arVoice.lang; u.rate = young() ? .9 : 1;
  speechSynthesis.speak(u);
}
function say(text, force) {
  if (window.__voiceLog) window.__voiceLog.add(voiceText(text));
  if (!S.sound && !force) return;   // 🔇 also mutes the voice (🔈 buttons still work)
  hush();
  if (hasRecording(text)) {
    const a = curAudio = new Audio(`audio/${compGirl() ? 'f' : 'm'}/${voiceKey(text)}.mp3`);
    a.onended = a.onerror = () => { if (curAudio === a) curAudio = null; };   // speaking() turns false when it finishes
    a.play().catch(() => { if (curAudio === a) curAudio = null; deviceSay(text, force); });
    return;
  }
  deviceSay(text, force);
}
/* is the voice still talking? (recording playing, or the device voice speaking) */
function speaking() {
  return !!curAudio || ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending));
}
/* run fn once the voice has finished (and a short pause), so nothing cuts a sentence off; gives up after `max` ms */
function whenQuiet(fn, pause = 500, max = 25000) {
  const t0 = Date.now();
  const tick = () => {
    if (speaking() && Date.now() - t0 < max) return later(tick, 150);
    later(fn, pause);
  };
  tick();
}
function hush() {
  if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function sayBtn(text) { if (window.__voiceLog) window.__voiceLog.add(voiceText(text)); return `<button class="say" data-say="${esc(text)}" aria-label="استمع">🔈</button>`; }
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.stopPropagation(); say(b.dataset.say, true); } });

/* ---- feedback ---- */
function toast(msg, ms = 2400) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = fem(msg);
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function confetti() {
  const c = ['#f4c26b', '#3aa7d8', '#3dbb7a', '#ef5b5b', '#7b5cff'];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement('div'); d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw'; d.style.background = c[i % 5];
    d.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    document.body.appendChild(d); setTimeout(() => d.remove(), 4000);
  }
}
function guide(text) {
  text = fem(text);
  return `<div class="guide"><div class="face">${MARWAN(52)}</div><div class="txt">${text}</div>${sayBtn(text)}</div>`;
}
/* young/expert text helper: pick(['for young','for expert']) */
const yx = (a, b) => young() ? a : b;

/* Address girls in the feminine: rewrite the common masculine words in instructions and messages. */
const FEM = [['اضغطها', 'اضغطيها'], ['اضغط', 'اضغطي'], ['اسحب', 'اسحبي'], ['اختر', 'اختاري'], ['ضع', 'ضعي'], ['حرّك', 'حرّكي'],
  ['جرّب', 'جرّبي'], ['أجب', 'أجيبي'], ['اكتب', 'اكتبي'], ['اقرأ', 'اقرئي'], ['اكتشف', 'اكتشفي'], ['وتكتشف', 'وتكتشفي'], ['راجع', 'راجعي'],
  ['حاول', 'حاولي'], ['ساعدنا', 'ساعدينا'], ['أنت', 'أنتِ'], ['مستعد', 'مستعدة'], ['بطل', 'بطلة'], ['تستطيع', 'تستطيعين'],
  ['تحتاج', 'تحتاجين'], ['يمكنك', 'يمكنكِ'], ['خذ', 'خذي'], ['المهندس', 'المهندسة'], ['تحبها', 'تحبينها'], ['لتجمع', 'لتجمعي'],
  ['لتهزمه', 'لتهزميه'], ['اصعد', 'اصعدي'], ['احسب', 'احسبي'], ['شاهد', 'شاهدي'], ['وشاهد', 'وشاهدي'], ['اختبر', 'اختبري'], ['أكملت', 'أكملتِ']]
  .map(([m, f]) => [new RegExp(`(^|[^\u0600-\u06FF])([وف]?)${m}(?![\u0600-\u06FF])`, 'g'), `$1$2${f}`]);   // also «و» / «ف» + word
const isGirl = () => !!(ME && ME.gender === 'girl');
const fem = s => isGirl() ? FEM.reduce((t, [re, f]) => t.replace(re, f), String(s)) : s;

/* ---- real map renderer ---- */
function renderMap(o = {}) {
  const M = window.MAP;
  const lbl = o.labels || 'none'; // 'none' | 'arab' | 'all'
  let s = `<svg class="rmap" viewBox="0 0 ${M.w} ${M.h}" role="img" aria-label="خريطة الوطن العربي">`;
  s += M.other.map(c => `<path class="oth" d="${c.d}"/>`).join('');
  for (const [k, c] of Object.entries(M.arab))
    s += `<path class="arab ${c.wing}" data-k="${k}" d="${c.d}" ${o.tapCountries ? `tabindex="0" role="button" aria-label="${c.ar}"` : ''}><title>${lbl === 'none' ? '' : c.ar}</title></path>`;
  for (const [k, c] of Object.entries(M.arab)) if (c.small)
    s += `<circle class="hit" data-k="${k}" cx="${c.c[0]}" cy="${c.c[1]}" r="${o.tapCountries ? 13 : 7}" ${o.tapCountries ? '' : 'style="pointer-events:none"'}/>`;
  if (o.lines) {
    const L = M.lines;
    s += `<line class="gline" x1="0" x2="${M.w}" y1="${L.equator}" y2="${L.equator}"/><text class="sea" x="8" y="${L.equator - 6}" text-anchor="end">دائرة الاستواء</text>`;
    s += `<line class="gline" x1="${L.greenwich}" x2="${L.greenwich}" y1="0" y2="${M.h}"/><text class="sea" x="${L.greenwich + 5}" y="${M.h - 10}" text-anchor="end">خط جرينتش</text>`;
    s += `<rect x="${L.lon17w}" y="${L.lat37}" width="${L.lon60 - L.lon17w}" height="${L.lat2s - L.lat37}" fill="none" stroke="#7b5cff" stroke-width="2" stroke-dasharray="10 6"/>`;
  }
  if (lbl !== 'none') {
    for (const [k, c] of Object.entries(M.arab)) s += `<text class="lbl" x="${c.c[0]}" y="${c.c[1]}" text-anchor="middle">${c.ar}</text>`;
    if (lbl === 'all') for (const c of M.other) if (c.ar && c.c) s += `<text class="olbl" x="${c.c[0]}" y="${c.c[1]}" text-anchor="middle">${c.ar}</text>`;
  }
  if (o.seas !== false) s += `<text class="sea" x="446" y="112" text-anchor="middle">البحر المتوسط</text>` +
    `<text class="sea" x="24" y="440" text-anchor="middle" transform="rotate(-90 24 440)">المحيط الأطلنطي</text>` +
    `<text class="sea" x="892" y="640" text-anchor="middle">المحيط الهندي</text>` +
    `<text class="sea" x="992" y="405" text-anchor="start">بحر العرب</text>` +
    `<text class="sea" x="693" y="292" text-anchor="middle" font-size="11" transform="rotate(58 693 292)">البحر الأحمر</text>` +
    `<text class="sea" x="846" y="196" text-anchor="middle" font-size="10" transform="rotate(-30 846 196)">الخليج العربي</text>`;
  if (o.points) for (const p of o.points) {
    const [x, y] = M.places[p.p];
    s += `<g class="pt" data-p="${p.p}" tabindex="0" role="button" aria-label="${o.pointNames ? p.name : 'نقطة'}"><circle class="pulse" cx="${x}" cy="${y}" r="9"/><circle class="dot" cx="${x}" cy="${y}" r="12"/>${o.pointNames ? `<text class="lbl" x="${x}" y="${y - 18}" text-anchor="middle">${p.name}</text>` : ''}</g>`;
  }
  return s + '</svg>';
}
/* make SVG <g>/<path> reachable by Enter/Space too */
function keyActivate(root) {
  root.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[tabindex]') && !e.target.matches('button')) {
      e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
}

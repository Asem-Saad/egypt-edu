/* One-off games that need their own scene. */

/* Lesson 3: climb the mountain — every 150 m up, 1°C colder */
function climbAsk(b, h) {
  const ans = b - h / 150;
  const opts = stableOrder([...new Set([ans, ans + 3, ans - 2, b])].slice(0, 3).map(String), 'climb' + b + h).map(Number);
  const q = `إذا كانت الحرارة عند سطح البحر ${AR_NUM(b)}°، فكم تكون على ارتفاع ${AR_NUM(h)} متر؟`;
  return { q, opts, speech: askSpeech('', q, opts.map(o => AR_NUM(o) + '°')) };
}
GAMES.climb = (el, m, done) => {
  const BASE = 24, TOP = 3000;
  el.innerHTML = `${guide(yx('حرّك الشريط لنتسلق الجبل معاً 🎒 وشاهد ميزان الحرارة! كلما صعدنا ١٥٠ متراً تنخفض الحرارة درجة واحدة.', 'كل ١٥٠ م ارتفاعاً = −١°م. اصعد للقمة أولاً، ثم احسب.'))}
    <div class="climb">
      <svg viewBox="0 0 300 220" aria-hidden="true">
        <path d="M0,220 L150,20 L300,220Z" fill="#9b7b55" stroke="#2b2350" stroke-width="3"/>
        <path id="snow" d="M150,20 L118,62 L134,56 L150,66 L166,56 L182,62Z" fill="#fff" opacity="0" style="transition:opacity .4s"/>
        <text x="8" y="214" font-size="12">مستوى سطح البحر</text>
        <g id="climber" style="transition:transform .2s">${MARWAN(24, 'x="2" y="184"')}</g>
      </svg>
      <div><div class="thermo" id="th">🌡️ ${AR_NUM(BASE)}°</div>
        <p style="text-align:center">الارتفاع: <b id="hh">٠</b> متر</p>
        <input type="range" id="rng" dir="ltr" min="0" max="${TOP}" step="150" value="0" aria-label="الارتفاع بالمتر">
        <p class="note" style="text-align:center">⬅️ أسفل الجبل · القمة ➡️</p>
        <p class="note">مثل قمم جبال لبنان التي تغطيها الثلوج ❄️</p></div>
    </div><div id="qbox"></div>`;
  const rng = $('#rng', el); let reached = false;
  rng.oninput = () => {
    const h = +rng.value, t = BASE - h / 150, f = h / TOP;
    $('#hh', el).textContent = AR_NUM(h); $('#th', el).textContent = '🌡️ ' + AR_NUM(t) + '°' + (t <= 4 ? ' ❄️' : '');
    $('#climber', el).setAttribute('transform', `translate(${f * 136} ${-f * 186})`);
    $('#snow', el).setAttribute('opacity', t <= 6 ? 1 : 0); beep('tap');
    if (h >= TOP && !reached) { reached = true; beep('win'); toast('🏔️ وصلنا للقمة! الحرارة انخفضت ٢٠ درجة'); later(quiz, 1200); }
  };
  const rounds = young() ? [[24, 300], [30, 1500], [24, 3000]] : [[27, 750], [30, 2250], [18, 1800], [24, 2700]];
  let r = 0, mistakes = 0;
  function quiz() {
    if (r >= rounds.length) return done(mistakes);
    const [b, h] = rounds[r], ans = b - h / 150;
    const { q, opts, speech } = climbAsk(b, h);
    $('#qbox', el).innerHTML = `<div class="panel"><div class="bar"><div class="q grow">${q}</div>${sayBtn(speech)}</div>${optRows(opts, o => `data-v="${o}"`, o => AR_NUM(o) + '°')}<p class="note" id="hint"></p></div>`;
    if (S.autoSay && young()) say(speech);
    keysFor($('#qbox', el));
    $$('#qbox .opt', el).forEach(btn => btn.onclick = () => {
      if (+btn.dataset.v === ans) { $$('#qbox .opt', el).forEach(x => x.disabled = true); btn.classList.add('ok'); beep('ok'); addXP(3); r++; later(quiz, 900); }
      else { mistakes++; btn.classList.add('no'); btn.disabled = true; beep('bad'); $('#hint', el).textContent = `💡 ${AR_NUM(h)} ÷ ١٥٠ = ${AR_NUM(h / 150)} درجات أقل`; }
    });
    $('#qbox', el).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

/* Lesson 4: turn a polluted city green */
function cityAsk(t) {
  const q = `كيف نعالج: ${t.t}؟`, opts = stableOrder([t.fix, ...t.w], q);
  return { q, opts, speech: askSpeech('', q, opts) };
}
GAMES.city = (el, m, done) => {
  const T = m.tiles; let fixed = 0, mistakes = 0;
  el.innerHTML = `${guide(m.guide)}
    <p><b>مقياس التلوث</b></p><div class="meter"><i id="mt" style="width:100%"></i></div>
    <div class="city" style="margin-top:12px">${T.map((t, i) => `<button class="tile" data-i="${i}"><div class="em">${t.em}</div><div>${t.t}</div></button>`).join('')}</div>
    <div id="cq"></div>`;
  $$('.tile', el).forEach(b => b.onclick = () => {
    const t = T[b.dataset.i]; if (b.classList.contains('fixed')) return;
    $$('.tile', el).forEach(x => x.style.outline = ''); b.style.outline = '4px solid var(--purple)';
    const { q, opts, speech } = cityAsk(t);
    $('#cq', el).innerHTML = `<div class="panel"><div class="bar"><div class="q grow">${q}</div>${sayBtn(speech)}</div>${optRows(opts)}</div>`;
    if (S.autoSay && young()) say(speech);
    keysFor($('#cq', el));
    $$('#cq .opt', el).forEach(o => o.onclick = () => {
      if (o.textContent === t.fix) {
        beep('ok'); addXP(2); b.classList.add('fixed'); b.style.outline = '';
        b.innerHTML = `<div class="em">${t.good}</div><div>${t.fix}</div>`; $('#cq', el).innerHTML = '';
        $('#mt', el).style.width = (100 - (++fixed / T.length) * 100) + '%';
        if (fixed === T.length) later(() => done(mistakes), 700);
      } else { mistakes++; o.classList.add('no'); o.disabled = true; beep('bad'); }
    });
    $('#cq', el).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
};

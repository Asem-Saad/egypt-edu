/* App shell: header, routing, home, lesson map, mission screen, unit boss, parent page.
   Signed out: #welcome #signin #signup #teacher-signup #forgot. Parent: #login (pick child) #register #edit #parents #home #l1 #l1-<mission> #boss.
   Teacher: #teacher. Admin: #admin (plus everything a parent has). */
const app = $('#app');
const NAMES = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'];
const starsOf = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);
const missionKey = (l, m) => `${l}.${m}`;
const lessonStars = L => L.missions.reduce((a, m) => a + (S.done[missionKey(L.id, m.id)] || 0), 0);
const lessonDone = L => L.missions.filter(m => S.done[missionKey(L.id, m.id)]).length;

function header() {
  const lf = $('#logo-face'); if (lf && !lf.firstChild) lf.innerHTML = MARWAN(30);
  $('#xp').textContent = AR_NUM(S.xp);
  $('#snd').textContent = S.sound ? '🔊' : '🔇';
  $('#m-young').setAttribute('aria-pressed', young()); $('#m-old').setAttribute('aria-pressed', !young());
  const top = $('.top'); document.documentElement.style.setProperty('--hdr', (getComputedStyle(top).position === 'sticky' ? top.offsetHeight : 0) + 'px');
  const who = $('#who'), role = CLOUD.role, staff = CLOUD.user && role === 'teacher';
  const playing = !!(CLOUD.user && ME);              // a child counts only inside a signed-in account
  who.hidden = !(playing || staff);
  if (playing) who.innerHTML = `👤 ${esc(firstName())}`; else if (staff) who.innerHTML = `👩‍🏫 ${esc(((CLOUD.profile || {}).full_name || '').split(' ')[0] || 'المعلّم')}`;
  $$('.top .mode, .top .pill:not(.who):not(.out), #snd').forEach(x => x.hidden = !playing);
  $('#out').hidden = !CLOUD.user;
}
$('#who').onclick = () => go(ME ? '#parents' : '#teacher');
/* logout menu: switch child (child leaves) or sign the account out — progress is saved online first */
async function leave(kind) {
  const menu = $('#outmenu'); menu.hidden = true; $('#out').setAttribute('aria-expanded', 'false');
  clearGame(); toast('⏳ جارٍ حفظ التقدم…', 4000);
  if (kind === 'child') {
    let ok = true;
    if (ME) { try { ok = navigator.onLine ? await CLOUD.pushProgress(ME.id) : false; } catch (e) { ok = false; } }
    toast(ok ? 'تم حفظ التقدم ✔' : 'تم حفظ التقدم على هذا الجهاز — سيتزامن عند الاتصال بالإنترنت', 2500);
    ACC.logout(); return setTimeout(() => restart('#login'), 600);
  }
  const unsaved = await CLOUD.signOut();
  toast(unsaved ? 'لا يوجد إنترنت — بقي التقدم محفوظاً على هذا الجهاز وسيتزامن عند الدخول مرة أخرى' : 'تم حفظ التقدم وتسجيل الخروج ✔', 2500);
  setTimeout(() => restart('#welcome'), 700);
}
$('#out').onclick = e => {
  e.stopPropagation();
  const menu = $('#outmenu'), open = menu.hidden;
  menu.innerHTML = (ME ? `<button role="menuitem" data-k="child">🔄 تبديل الطفل <span class="note">(يُحفظ التقدم)</span></button>` : '') +
    `<button role="menuitem" data-k="account">🚪 تسجيل الخروج من الحساب</button>`;
  menu.hidden = !open; $('#out').setAttribute('aria-expanded', String(open));
  $$('button', menu).forEach(b => b.onclick = () => leave(b.dataset.k));
};
document.addEventListener('click', e => { if (!e.target.closest('#outmenu, #out')) { $('#outmenu').hidden = true; $('#out').setAttribute('aria-expanded', 'false'); } });
$('#m-young').onclick = () => { S.mode = 'young'; save(); route(); };
$('#m-old').onclick = () => { S.mode = 'old'; save(); route(); };
$('#snd').onclick = () => { S.sound = !S.sound; if (!S.sound) hush(); save(); header(); };
$('#home').onclick = () => { go('#home'); };

const go = h => { if (location.hash === h) route(); else location.hash = h; };
addEventListener('hashchange', route);

function route() {
  clearGame(); header();
  const h = location.hash.slice(1);
  if (!CLOUD.user) {                                  // nobody signed in on this device
    if (h === 'signin') return signinPage();
    if (h === 'signup') return signupPage('parent');
    if (h === 'teacher-signup') return signupPage('teacher');
    if (h === 'forgot') return forgotPage();
    return welcomePage();
  }
  if (h === 'newpass') return newPassPage();
  const role = CLOUD.role;
  if (role === 'teacher') return teacherPage();       // teachers see their classes
  if (h === 'admin') return adminPage();
  if (h === 'teacher' && role === 'admin') return teacherPage();
  if (h === 'register') return parentGate(() => registerPage(false));
  if (h === 'parents') return parentGate(parent);
  if (!ME) return loginPage();                        // signed-in parent: which child is playing?
  if (h === 'edit') return parentGate(() => registerPage(true));
  if (h === 'login') return loginPage();
  const lm = h.match(/^l(\d+)(?:-([a-z0-9]+))?$/);
  if (lm && lm[2]) return mission(+lm[1], lm[2]);
  if (lm) return lesson(+lm[1]);
  if (h === 'boss') return boss();
  if (h === 'parents') return parent();
  home();
}
const backBtn = (h, label = 'رجوع') => `<button class="btn alt" onclick="go('${h}')">→ ${label}</button>`;

/* ---------- home ---------- */
function home() {
  const total = LESSONS.reduce((a, L) => a + L.missions.length, 0), done = LESSONS.reduce((a, L) => a + lessonDone(L), 0);
  app.innerHTML = `
    <h1>أهلاً يا ${esc(firstName())}! 👋</h1>
    <p class="sub">رحلة في وحدة «وطننا العربي» — أنجزت ${AR_NUM(done)} من ${AR_NUM(total)} مهمة</p>
    ${guide(young() ? `أنا ${esc(compName())}، ${compGirl() ? 'رفيقتك' : 'رفيقك'} في الرحلة! اختر درساً لنبدأ. كل مهمة تعطيك حتى ٣ نجوم.` : 'وضع الخبير: أسئلة «بم تفسر؟» ومؤقت وكل التفاصيل. هل تستطيع جمع كل النجوم؟')}
    <div class="journey">
      ${LESSONS.map(L => {
        const d = lessonDone(L), n = L.missions.length;
        return `<button class="lesson" onclick="go('#l${L.id}')">
          <span class="tag ${d === n ? 'live' : ''}">${d === n ? 'مكتمل ✔' : AR_NUM(d) + '/' + AR_NUM(n) + ' مهام'}</span>
          <div class="em">${L.em}</div><h3>الدرس ${NAMES[L.id]}</h3><div>${L.title}</div>
          <div class="note">⭐ ${AR_NUM(lessonStars(L))} / ${AR_NUM(n * 3)}</div>
          <div class="prog"><i style="width:${d / n * 100}%"></i></div></button>`;
      }).join('')}
      <button class="lesson boss" onclick="go('#boss')"><span class="tag">التحدي الكبير</span><div class="em">🐉</div><h3>وحش الوحدة</h3><div>أسئلة من الدروس الأربعة</div><div>${S.done['boss'] ? starsOf(S.done['boss']) : fem('هل أنت مستعد؟')}</div></button>
    </div>
    <p class="note" style="margin-top:24px;text-align:center"><a href="#parents">👪 منطقة ولي الأمر</a> • <a href="#login">🔄 تبديل الطفل</a></p>`;
}

/* ---------- lesson ---------- */
function lesson(id) {
  const L = LESSONS.find(l => l.id === id); if (!L) return home();
  const next = L.missions.find(m => !S.done[missionKey(id, m.id)]);
  app.innerHTML = `<div class="bar">${backBtn('#home', 'الرئيسية')}<div class="grow"></div><div class="pill">⭐ ${AR_NUM(lessonStars(L))}/${AR_NUM(L.missions.length * 3)}</div></div>
    <h2>${L.em} الدرس ${NAMES[id]}: ${L.title}</h2>
    ${guide(next ? `المهمة التالية: <b>${next.em} ${next.t}</b>. يمكنك أيضاً اختيار أي مهمة تحبها!` : 'أكملت كل مهام هذا الدرس! 🎉 جرّب وضع الخبير أو وحش الوحدة.')}
    <div class="missions">${L.missions.map((m, i) => {
      const st = S.done[missionKey(id, m.id)] || 0;
      return `<button class="mission ${st ? 'done' : ''}" onclick="go('#l${id}-${m.id}')" ${next === m ? 'style="outline:4px solid var(--purple)"' : ''}>
        <div class="em">${m.em}</div><h3>${AR_NUM(i + 1)}. ${m.t}</h3><div class="note">${m.d}</div><div class="stars">${starsOf(st)}</div></button>`;
    }).join('')}</div>`;
}

/* ---------- mission ---------- */
function mission(lid, mid) {
  const L = LESSONS.find(l => l.id === lid), m = L && L.missions.find(x => x.id === mid);
  if (!m) return lesson(lid);
  app.innerHTML = `<div class="bar">${backBtn('#l' + lid, 'المهام')}<h2 class="grow" style="margin:0 8px">${m.em} ${m.t}</h2></div><div id="game"></div>`;
  let ended = false;   // a game reports its end once, even after a double tap
  // when a game ends, let the voice finish its sentence first, then show the result and give the stars
  GAMES[m.type]($('#game'), m, (mistakes, score) => { if (ended) return; ended = true; whenQuiet(() => finish(missionKey(lid, mid), mistakes, score, L, m)); });
}
function finish(key, mistakes, score, L, m) {
  const st = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1, prev = S.done[key] || 0;
  S.done[key] = Math.max(prev, st); const xp = prev ? 5 : 10 * st; addXP(xp); save();
  beep('win'); confetti();
  const idx = L ? L.missions.indexOf(m) : -1, nxt = L && L.missions[idx + 1];
  const msg = fem(st === 3 ? 'ممتاز! بدون أي خطأ!' : st === 2 ? `أحسنت يا ${firstName()}!` : 'جيد! جرّب مرة أخرى لتجمع ٣ نجوم');
  const spoken = fem(st === 3 ? 'ممتاز! بدون أي خطأ!' : st === 2 ? 'أحسنت!' : 'جيد! جرّب مرة أخرى لتجمع ٣ نجوم');   // no child name, so it has a recorded voice
  const p = document.createElement('div'); p.className = 'panel'; p.style.textAlign = 'center';
  p.innerHTML = `<div class="big">${st === 3 ? '🏆' : '🏅'}</div><h2>${esc(msg)}</h2>${score ? `<p>النتيجة: ${score}</p>` : ''}
    <div style="font-size:2rem">${starsOf(st)}</div><p>+${AR_NUM(xp)} ⭐</p>
    <div class="bar" style="justify-content:center">
      ${nxt ? `<button class="btn go" onclick="go('#l${L.id}-${nxt.id}')">المهمة التالية: ${nxt.em} ${nxt.t} ←</button>` : ''}
      <button class="btn alt" onclick="go('${L ? '#l' + L.id : '#home'}')">${L ? 'كل المهام' : 'الرئيسية'}</button>
      <button class="btn alt" onclick="route()">🔁 أعد المحاولة</button></div>`;
  const g = $('#game'); g.innerHTML = ''; g.appendChild(p); say(spoken);
  p.scrollIntoView({ behavior: 'smooth' }); p.querySelector('button').focus({ preventScroll: true });
}

/* ---------- unit boss: mixed quiz from all lessons ---------- */
function boss() {
  const questions = LESSONS.flatMap(L => L.missions.filter(m => m.type === 'quiz').flatMap(m => m.questions));
  app.innerHTML = `<div class="bar">${backBtn('#home', 'الرئيسية')}<h2 class="grow" style="margin:0 8px">🐉 وحش الوحدة</h2></div>
    ${guide('الوحش يسأل من الدروس الأربعة! أجب صح على ٦٠٪ على الأقل لتهزمه.')}<div id="game"></div>`;
  let ended = false;
  GAMES.quiz($('#game'), { qid: 'boss', questions, limit: [10, 16], time: 15 }, (mis, score) => { if (ended) return; ended = true; whenQuiet(() => finish('boss', mis > 3 ? 3 : mis, score, null, null)); });
}

/* ---------- parent page ---------- */
function parent() {
  const missed = Object.entries(S.wrong).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!ME) { app.innerHTML = `<div class="bar">${backBtn('#login', 'رجوع')}<h2 class="grow" style="margin:0 8px">👪 منطقة ولي الأمر</h2></div><div id="acct"></div>`; return accountPanel($('#acct')); }
  app.innerHTML = `<div class="bar">${backBtn('#home', 'الرئيسية')}<h2 class="grow" style="margin:0 8px">👪 منطقة ولي الأمر</h2></div>
    <div id="acct"></div>
    <h3>📊 تفاصيل الطفل الذي يلعب الآن</h3>
    <div class="panel profile"><div class="face">${MARWAN(64)}</div><div class="grow">
      <h3>${esc(ME.name)}</h3>
      <dl class="facts"><dt>العمر</dt><dd>${AR_NUM(ME.age)} ${ME.age <= 10 ? 'سنوات' : 'سنة'}</dd><dt>النوع</dt><dd>${ME.gender === 'boy' ? 'ولد' : 'بنت'}</dd>
        <dt>المدرسة</dt><dd>${esc(ME.school)}</dd><dt>الصف</dt><dd>${esc(ME.grade)}</dd>
        <dt>${compGirl() ? 'الرفيقة' : 'الرفيق'}</dt><dd>${esc(compName())}</dd><dt>الرقم السري</dt><dd class="ltr">${esc(ME.pin || '')}</dd></dl>
      <div class="bar"><button class="btn alt" onclick="go('#edit')">✏️ تعديل البيانات</button>
        <button class="btn alt" id="switch">🔄 تبديل الطفل</button></div>
      <p class="note">التقدم يُحفظ على هذا الجهاز ويتزامن مع حسابك على الإنترنت.</p></div></div>
    <div class="panel"><h3>التقدم</h3><table class="stats"><tr><th>الدرس</th><th>المهام</th><th>النجوم</th><th>أفضل نتيجة في الاختبار</th></tr>
      ${LESSONS.map(L => `<tr><td>${L.em} ${L.title}</td><td>${AR_NUM(lessonDone(L))}/${AR_NUM(L.missions.length)}</td><td>${AR_NUM(lessonStars(L))}/${AR_NUM(L.missions.length * 3)}</td><td>${S.quizBest['l' + L.id] != null ? AR_NUM(S.quizBest['l' + L.id]) + '٪' : '—'}</td></tr>`).join('')}
      <tr><td>🐉 وحش الوحدة</td><td colspan="2">${S.done.boss ? starsOf(S.done.boss) : '—'}</td><td>${S.quizBest.boss != null ? AR_NUM(S.quizBest.boss) + '٪' : '—'}</td></tr></table>
      <p>مجموع النقاط: ⭐ ${AR_NUM(S.xp)}</p></div>
    <div class="panel"><h3>أسئلة تحتاج مراجعة</h3>
      ${missed.length ? `<table class="stats"><tr><th>السؤال</th><th>مرات الخطأ</th></tr>${missed.map(([q, n]) => `<tr><td>${q}</td><td>${AR_NUM(n)}</td></tr>`).join('')}</table>` : '<p class="note">لا توجد أخطاء مسجلة بعد 👍</p>'}</div>
    <div class="panel"><h3>الإعدادات</h3>
      <p><label><input type="checkbox" id="auto" ${S.autoSay ? 'checked' : ''}> قراءة الأسئلة بصوت عالٍ تلقائياً (لوضع المستكشف)</label></p>
      <p class="note">الصوت: ${window.VOICE && Object.keys(VOICE).length ? '✅ صوت مصري طبيعي مسجّل (' + AR_NUM(Object.keys(VOICE).length) + ' جملة)' : (arVoice ? '✅ صوت الجهاز (' + esc(arVoice.name) + ')' : '❌ لا يوجد صوت عربي')}</p>

      <button class="btn alt" id="reset">🗑️ مسح التقدم والبدء من جديد</button></div>`;
  $('#auto').onchange = e => { S.autoSay = e.target.checked; save(); };
  $('#switch').onclick = () => leave('child');
  accountPanel($('#acct'));
  $('#reset').onclick = () => {
    const b = $('#reset');
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '⚠️ اضغط مرة أخرى للتأكيد — سيُمسح كل التقدم'; b.style.background = 'var(--red)'; b.style.color = '#fff'; return; }
    Object.assign(S, { xp: 0, done: {}, wrong: {}, quizBest: {} }); save(); CLOUD.pushProgress(ME.id); toast('تم مسح التقدم'); go('#home');
  };
}

CLOUD.boot().catch(() => {}).finally(route);   // finish an email-link sign-in first, then show the screen
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
/* Desktop app (Mac launcher): tell it this window is still open, so it can quit on its own after the child closes the page. */
if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
  const ping = () => fetch('__alive', { cache: 'no-store' }).then(r => r.headers.get('X-Arab-Trip')).catch(() => null);
  ping().then(app => { if (app) setInterval(ping, 20000); });
}

/* Screens for adults: parent gate + account panel, teacher (#teacher), admin (#admin). */

/* summary of a child's saved progress (used by parent, teacher and admin views) */
function summarize(state) {
  const st = state || {}, done = st.done || {};
  const lessons = LESSONS.map(L => {
    const n = L.missions.length, ds = L.missions.map(m => done[`${L.id}.${m.id}`] || 0);
    return { id: L.id, em: L.em, title: L.title, n, done: ds.filter(Boolean).length, stars: ds.reduce((a, b) => a + b, 0), quiz: (st.quizBest || {})['l' + L.id] };
  });
  const total = lessons.reduce((a, l) => a + l.n, 0), finished = lessons.reduce((a, l) => a + l.done, 0);
  return { lessons, total, finished, xp: st.xp || 0, boss: done.boss || 0, bossBest: (st.quizBest || {}).boss, wrong: st.wrong || {} };
}
const pct = v => v == null ? '—' : AR_NUM(v) + '٪';
const when = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }); };

/* ---------- parent gate: the account password again, so children can't open the parent area ---------- */
function parentGate(next) {
  if (CLOUD.parentUnlocked()) return next();
  app.innerHTML = `<div class="bar">${backBtn(ME ? '#home' : '#login', 'رجوع')}<h2 class="grow" style="margin:0 8px">👪 منطقة ولي الأمر</h2></div>
    <form class="panel form narrow" id="gf" novalidate>
      <p>اكتب كلمة مرور حساب ولي الأمر (<span class="ltr" style="display:inline-block">${esc(CLOUD.user ? CLOUD.user.email : '')}</span>) للمتابعة.</p>
      ${field('f-pass', 'كلمة المرور', 'class="ltr" type="password" autocomplete="current-password"')}
      <p class="err" id="e-form" role="alert"></p>
      <button class="btn go" type="submit">فتح ←</button></form>`;
  $('#f-pass').focus();
  $('#gf').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#gf button[type=submit]'); busy(btn, true);
    try { await CLOUD.checkPassword($('#f-pass').value); next(); }
    catch (err) { busy(btn, false); $('#e-form').textContent = CLOUD.errText(err); beep('bad'); }
  };
}

/* ---------- parent account panel: all children, classes, sign out ---------- */
async function accountPanel(box) {
  if (navigator.onLine && !box.dataset.fresh) { box.dataset.fresh = '1'; try { await CLOUD.refreshProfile(); } catch (e) {} }
  const kids = ACC.list().filter(c => !ACC.isLocalOnly(c)), prof = CLOUD.profile || {};
  box.innerHTML = `<div class="panel"><div class="bar"><h3 class="grow">👨‍👩‍👧 الحساب: ${esc(prof.full_name || '')}</h3>
      <span class="note ltr">${esc(CLOUD.user ? CLOUD.user.email : '')}</span></div>
      <div id="kidsbox"><p class="note">⏳ جارٍ تحميل الأطفال…</p></div>
      <div class="bar" style="margin-top:10px"><button class="btn" onclick="go('#register')">➕ إضافة طفل</button>
        ${CLOUD.role === 'admin' ? `<button class="btn alt" onclick="go('#admin')">🛠️ لوحة الإدارة</button>` : ''}
        <button class="btn alt" id="signout">🚪 تسجيل الخروج من الحساب</button></div>
      <p class="note">بعد تسجيل الخروج يحتاج هذا الجهاز إلى الدخول بالبريد وكلمة المرور مرة أخرى.</p></div>`;
  $('#signout').onclick = () => leave('account');
  let prog = {}; try { prog = navigator.onLine ? await CLOUD.childrenProgress() : {}; } catch (e) {}
  const rows = await Promise.all(kids.map(async k => {
    let classes = []; try { classes = navigator.onLine ? await CLOUD.childClasses(k.id) : []; } catch (e) {}
    const localState = (() => { try { return JSON.parse(ACC.get(ACC.progressKey(k.id)) || 'null'); } catch (e) { return null; } })();
    const sm = summarize(CLOUD.merge(localState, prog[k.id] && prog[k.id].state));
    return `<div class="kidrow" data-id="${k.id}">
      <div class="kidhead">${avatar(k.compAv || k.avatar, 40)}<div class="grow"><b>${esc(k.name)}</b><div class="note">${esc(k.grade)} • الرقم السري: <span class="ltr">${esc(k.pin)}</span> • رفيق: ${esc(k.compName || '')}</div></div>
        <div class="pill">⭐ ${AR_NUM(sm.xp)}</div><div class="pill">${AR_NUM(sm.finished)}/${AR_NUM(sm.total)} مهمة</div></div>
      <div class="classes">${classes.length ? classes.map(c => `<span class="badge">🏫 ${esc(c.name)} <button class="linkbtn" data-leave="${c.id}" aria-label="خروج من الفصل">✕</button></span>`).join('') : '<span class="note">غير منضم لأي فصل</span>'}</div>
      <form class="bar joinf" novalidate><input class="ltr code" maxlength="8" placeholder="كود الفصل" aria-label="كود الفصل من المعلّم">
        <button class="btn alt" type="submit">🏫 انضمام لفصل</button>
        <button class="btn alt" type="button" data-play>▶ العب باسمه</button>
        <button class="btn alt" type="button" data-del>🗑️ حذف</button></form>
    </div>`;
  }));
  const kb = $('#kidsbox', box); if (!kb) return;
  kb.innerHTML = rows.length ? rows.join('') : '<p class="note">لا يوجد أطفال بعد.</p>';
  $$('.kidrow', kb).forEach(r => {
    const id = r.dataset.id;
    $('.joinf', r).onsubmit = async e => {
      e.preventDefault(); const code = $('.code', r).value.trim();
      if (!code) return toast('اكتب كود الفصل الذي أعطاك إياه المعلّم');
      try { const name = await CLOUD.joinClass(code, id); if (!name) toast('لا يوجد فصل بهذا الكود — تأكد منه'); else { toast('تم الانضمام إلى «' + name + '» ✔'); accountPanel(box); } }
      catch (err) { toast(CLOUD.errText(err)); }
    };
    $$('[data-leave]', r).forEach(b => b.onclick = async () => { try { await CLOUD.leaveClass(b.dataset.leave, id); accountPanel(box); } catch (err) { toast(CLOUD.errText(err)); } });
    $('[data-play]', r).onclick = () => { ACC.login(id); restart('#home'); };
    const del = $('[data-del]', r);
    del.onclick = async () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = '⚠️ اضغط مرة أخرى للحذف النهائي'; del.style.background = 'var(--red)'; del.style.color = '#fff'; return; }
      try { await CLOUD.removeChild(id); toast('تم حذف الطفل وكل بياناته'); restart('#parents'); } catch (err) { toast(CLOUD.errText(err)); }
    };
  });
}

/* ---------- teacher ---------- */
function teacherPending() {
  app.innerHTML = `<div class="panel narrow" style="text-align:center"><div class="big">⏳</div>
    <h2>حساب المعلّم بانتظار الموافقة</h2>
    <p>ستتم مراجعة طلبك قريباً. بعد موافقة الإدارة يمكنك إنشاء فصول ومتابعة نتائج طلابك.</p>
    <div class="bar" style="justify-content:center"><button class="btn go" id="recheck">🔄 تحقّق الآن</button>
      <button class="btn alt" id="signout">🚪 تسجيل الخروج</button></div></div>`;
  $('#recheck').onclick = async () => { await CLOUD.refreshProfile(); route(); if (!(CLOUD.profile || {}).approved) toast('لم تتم الموافقة بعد'); };
  $('#signout').onclick = () => leave('account');
}
async function teacherPage() {
  const prof = CLOUD.profile || {};
  if (!prof.approved && prof.role !== 'admin') return teacherPending();
  app.innerHTML = `<div class="bar"><h2 class="grow" style="margin:0">👩‍🏫 أهلاً ${esc((prof.full_name || '').split(' ')[0])}</h2>
      ${prof.role === 'admin' ? `<button class="btn alt" onclick="go('#admin')">🛠️ الإدارة</button>` : ''}
      <button class="btn alt" id="signout">🚪 خروج</button></div>
    <div class="panel"><h3>➕ فصل جديد</h3>
      <form class="bar" id="cf" novalidate><input id="f-cname" class="grow" maxlength="60" placeholder="مثال: الصف الخامس — فصل ٢" aria-label="اسم الفصل">
        <button class="btn go" type="submit">إنشاء</button></form>
      <p class="note">يحصل كل فصل على كود. أعطِ الكود لأولياء الأمور ليضيفوا أبناءهم من «منطقة ولي الأمر».</p></div>
    <div id="classes"><p class="note">⏳ جارٍ التحميل…</p></div>`;
  $('#signout').onclick = () => leave('account');
  $('#cf').onsubmit = async e => {
    e.preventDefault(); const name = $('#f-cname').value.trim(); if (!name) return toast('اكتب اسم الفصل');
    try { await CLOUD.createClass(name); toast('تم إنشاء الفصل ✔'); teacherPage(); } catch (err) { toast(CLOUD.errText(err)); }
  };
  let classes = [];
  try { classes = await CLOUD.myClasses(); } catch (err) { $('#classes').innerHTML = `<p class="err">${CLOUD.errText(err)}</p>`; return; }
  if (!classes.length) { $('#classes').innerHTML = '<p class="note">لا توجد فصول بعد — أنشئ فصلك الأول.</p>'; return; }
  $('#classes').innerHTML = classes.map(k => `<div class="panel" data-k="${k.id}"><div class="bar"><h3 class="grow">🏫 ${esc(k.name)}</h3>
      <span class="codebox">الكود: <b class="ltr">${esc(k.join_code)}</b></span><button class="btn alt" data-copy="${esc(k.join_code)}">📋 نسخ</button></div>
      <div class="report"><p class="note">⏳ جارٍ تحميل النتائج…</p></div>
      <div class="bar"><button class="btn alt" data-refresh>🔄 تحديث</button><div class="grow"></div><button class="btn alt" data-delk>🗑️ حذف الفصل</button></div></div>`).join('');
  $$('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => toast('تم نسخ الكود ✔'), () => toast(b.dataset.copy)); });
  for (const k of classes) {
    const box = $(`[data-k="${k.id}"]`);
    $('[data-refresh]', box).onclick = () => loadReport(k, box);
    const d = $('[data-delk]', box);
    d.onclick = async () => {
      if (!d.dataset.sure) { d.dataset.sure = '1'; d.textContent = '⚠️ اضغط مرة أخرى لحذف الفصل'; d.style.background = 'var(--red)'; d.style.color = '#fff'; return; }
      try { await CLOUD.deleteClass(k.id); teacherPage(); } catch (err) { toast(CLOUD.errText(err)); }
    };
    loadReport(k, box);
  }
}
async function loadReport(k, box) {
  const rep = $('.report', box);
  let kids = [];
  try { kids = await CLOUD.classReport(k.id); } catch (err) { rep.innerHTML = `<p class="err">${CLOUD.errText(err)}</p>`; return; }
  if (!kids.length) { rep.innerHTML = `<p class="note">لم ينضم أي طالب بعد. أعطِ أولياء الأمور الكود <b class="ltr">${esc(k.join_code)}</b>.</p>`; return; }
  const sums = kids.map(c => Object.assign({ c }, summarize(c.state)));
  const missed = {};
  sums.forEach(s => Object.entries(s.wrong).forEach(([q, n]) => missed[q] = (missed[q] || 0) + n));
  const top = Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 8);
  rep.innerHTML = `<div class="tablewrap"><table class="stats">
      <tr><th>الطالب</th>${LESSONS.map(L => `<th title="${esc(L.title)}">${L.em} د${AR_NUM(L.id)}</th>`).join('')}<th>🐉</th><th>⭐</th><th>آخر نشاط</th><th></th></tr>
      ${sums.sort((a, b) => b.xp - a.xp).map(s => `<tr><td><b>${esc(s.c.name)}</b><div class="note">${esc(s.c.grade || '')}</div></td>
        ${s.lessons.map(l => `<td>${AR_NUM(l.done)}/${AR_NUM(l.n)}<div class="note">اختبار ${pct(l.quiz)}</div></td>`).join('')}
        <td>${s.boss ? '⭐'.repeat(s.boss) : '—'}<div class="note">${pct(s.bossBest)}</div></td><td>${AR_NUM(s.xp)}</td><td>${when(s.c.updated)}</td>
        <td><button class="linkbtn" data-rm="${s.c.id}" aria-label="إزالة من الفصل">إزالة</button></td></tr>`).join('')}
    </table></div>
    <h4>❗ أكثر الأسئلة خطأً في الفصل</h4>
    ${top.length ? `<ol class="missed">${top.map(([q, n]) => `<li>${esc(q)} <span class="badge">${AR_NUM(n)}</span></li>`).join('')}</ol>` : '<p class="note">لا توجد أخطاء مسجلة بعد.</p>'}`;
  $$('[data-rm]', rep).forEach(b => b.onclick = async () => {
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'تأكيد الإزالة؟'; return; }
    try { await CLOUD.removeFromClass(k.id, b.dataset.rm); loadReport(k, box); } catch (err) { toast(CLOUD.errText(err)); }
  });
}

/* ---------- admin ---------- */
async function adminPage() {
  if (CLOUD.role !== 'admin') return go('#home');
  app.innerHTML = `<div class="bar">${backBtn(ME ? '#home' : '#login', 'رجوع')}<h2 class="grow" style="margin:0 8px">🛠️ لوحة الإدارة</h2>
      <button class="btn alt" onclick="go('#teacher')">👩‍🏫 فصولي</button></div>
    <div class="panel" id="counts"><p class="note">⏳</p></div>
    <div class="panel"><h3>👩‍🏫 حسابات المعلّمين</h3><div id="tlist"><p class="note">⏳ جارٍ التحميل…</p></div></div>`;
  try {
    const c = await CLOUD.adminCounts();
    $('#counts').innerHTML = `<div class="bar"><span class="pill">👪 أولياء أمور: ${AR_NUM(c.parents)}</span><span class="pill">🧒 أطفال: ${AR_NUM(c.children)}</span>
      <span class="pill">👩‍🏫 معلّمون: ${AR_NUM(c.teachers)}</span><span class="pill">🏫 فصول: ${AR_NUM(c.classes)}</span></div>`;
  } catch (err) { $('#counts').innerHTML = `<p class="err">${CLOUD.errText(err)}</p>`; }
  let list = [];
  try { list = await CLOUD.teachers(); } catch (err) { $('#tlist').innerHTML = `<p class="err">${CLOUD.errText(err)}</p>`; return; }
  $('#tlist').innerHTML = list.length ? `<div class="tablewrap"><table class="stats"><tr><th>الاسم</th><th>المدرسة</th><th>البريد</th><th>التسجيل</th><th>الحالة</th><th></th></tr>
    ${list.map(t => `<tr><td>${esc(t.full_name)}</td><td>${esc(t.school)}</td><td class="ltr">${esc(t.email)}</td><td>${when(t.created_at)}</td>
      <td>${t.approved ? '✅ موافَق' : '⏳ ينتظر'}</td>
      <td><button class="btn ${t.approved ? 'alt' : 'go'}" data-t="${t.id}" data-ok="${!t.approved}">${t.approved ? 'إلغاء الموافقة' : 'موافقة'}</button></td></tr>`).join('')}</table></div>`
    : '<p class="note">لا توجد حسابات معلّمين بعد.</p>';
  $$('[data-t]').forEach(b => b.onclick = async () => { try { await CLOUD.approveTeacher(b.dataset.t, b.dataset.ok === 'true'); adminPage(); } catch (err) { toast(CLOUD.errText(err)); } });
}

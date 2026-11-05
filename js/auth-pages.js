/* Account screens: #welcome, #signin, #signup (parent), #teacher-signup, #forgot, #newpass,
   #login (which child is playing), #register (add a child), #edit (edit the playing child). */
const restart = h => { location.hash = h; location.reload(); };
const busy = (btn, on, text) => { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = text || '⏳ لحظة…'; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; };
const field = (id, label, attrs = '', help = '') =>
  `<div class="field"><label for="${id}">${label}</label><input id="${id}" ${attrs} aria-describedby="e-${id.slice(2)}">${help ? `<span class="note">${help}</span>` : ''}<span class="err" id="e-${id.slice(2)}"></span></div>`;
function showErrors(errs, keys) {
  keys.forEach(k => { const e = $('#e-' + k); if (e) e.textContent = errs[k] || ''; const f = $('#f-' + k); f && f.setAttribute('aria-invalid', !!errs[k]); });
  const first = keys.find(k => errs[k]);
  if (first) { beep('bad'); const f = $('#f-' + first); if (f) { f.focus(); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return true; }
  return false;
}
const clearOnInput = form => $$('input, select', form).forEach(f => f.addEventListener('input', () => { const e = $('#e-' + f.id.slice(2)); if (e) e.textContent = ''; f.removeAttribute('aria-invalid'); }));
const offlineNote = () => navigator.onLine ? '' : '<p class="err">⚠️ لا يوجد اتصال بالإنترنت — تسجيل الدخول وإنشاء الحساب يحتاجان إلى الإنترنت.</p>';

/* ---------- welcome (nobody signed in) ---------- */
function welcomePage() {
  app.innerHTML = `<div class="hero">
      <div class="hero-face">${avatar('b1', 120)}</div>
      <div><h1>أهلاً بك في رحلة «وطننا العربي»! 👋</h1>
        <p class="sub">أنا مروان، زميلك في المدرسة. يدخل ولي الأمر مرة واحدة على هذا الجهاز، وبعدها يختار كل طفل اسمه ويبدأ الرحلة.</p>
        <div class="bar"><button class="btn go" onclick="go('#signin')">🔑 تسجيل الدخول</button>
          <button class="btn" onclick="go('#signup')">📝 حساب جديد لولي الأمر</button></div>
        <p class="note" style="margin-top:14px">👩‍🏫 أنت معلّم أو معلّمة؟ <a href="#teacher-signup">أنشئ حساب معلّم</a> لمتابعة نتائج فصلك.</p></div></div>`;
}

/* ---------- sign in ---------- */
function signinPage() {
  app.innerHTML = `<div class="bar">${backBtn('#welcome', 'رجوع')}<h2 class="grow" style="margin:0 8px">🔑 تسجيل الدخول</h2></div>
    <form class="panel form narrow" id="sf" novalidate>${offlineNote()}
      <p class="note">لولي الأمر أو المعلّم. الأطفال يختارون أسماءهم بعد ذلك.</p>
      ${field('f-email', 'البريد الإلكتروني', 'class="ltr" type="email" autocomplete="email" placeholder="name@example.com"')}
      ${field('f-pass', 'كلمة المرور', 'class="ltr" type="password" autocomplete="current-password"')}
      <p class="err" id="e-form" role="alert"></p>
      <div class="bar"><button class="btn go" type="submit">دخول ←</button><a href="#forgot">نسيت كلمة المرور؟</a></div>
      <p class="note">ليس لديك حساب؟ <a href="#signup">أنشئ حساباً جديداً</a></p></form>`;
  clearOnInput($('#sf'));
  $('#sf').onsubmit = async e => {
    e.preventDefault();
    const email = $('#f-email').value.trim(), pass = $('#f-pass').value, errs = {};
    if (!isEmail(email)) errs.email = 'اكتب البريد الإلكتروني بشكل صحيح';
    if (!pass) errs.pass = 'اكتب كلمة المرور';
    if (showErrors(errs, ['email', 'pass'])) return;
    const btn = $('#sf button[type=submit]'); busy(btn, true, '⏳ جارٍ الدخول…');
    try { await CLOUD.signIn(email, pass); restart(CLOUD.role === 'teacher' ? '#teacher' : '#login'); }
    catch (err) { busy(btn, false); $('#e-form').textContent = CLOUD.errText(err); beep('bad'); }
  };
}

/* ---------- create an account (parent or teacher) ---------- */
function signupPage(role) {
  const teacher = role === 'teacher';
  app.innerHTML = `<div class="bar">${backBtn('#welcome', 'رجوع')}<h2 class="grow" style="margin:0 8px">${teacher ? '👩‍🏫 حساب معلّم جديد' : '📝 حساب جديد لولي الأمر'}</h2></div>
    <form class="panel form narrow" id="uf" novalidate>${offlineNote()}
      <p class="note">${teacher ? 'بعد إنشاء الحساب تراجعه الإدارة وتوافق عليه، ثم يمكنك إنشاء فصول ومتابعة نتائج طلابك.' : 'حساب واحد لولي الأمر يكفي لكل الأبناء. بعد إنشاء الحساب تضيف أطفالك.'}</p>
      ${field('f-name', teacher ? 'الاسم بالكامل (باللغة العربية)' : 'اسم ولي الأمر بالكامل (باللغة العربية)', 'autocomplete="name" placeholder="مثال: أحمد محمد علي"')}
      ${teacher ? field('f-school', 'اسم المدرسة (باللغة العربية)', 'placeholder="مثال: مدرسة النصر الابتدائية"')
                : field('f-phone', 'رقم الهاتف', 'class="ltr" type="tel" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx"')}
      ${field('f-email', 'البريد الإلكتروني', 'class="ltr" type="email" autocomplete="email" placeholder="name@example.com"')}
      <div class="row2">
        ${field('f-pass', 'كلمة المرور', 'class="ltr" type="password" autocomplete="new-password"', '٨ أحرف على الأقل')}
        ${field('f-pass2', 'تأكيد كلمة المرور', 'class="ltr" type="password" autocomplete="new-password"')}
      </div>
      <label class="consent"><input type="checkbox" id="f-consent">
        <span>${teacher ? 'أؤكد أنني معلّم/ة، وأوافق على حفظ بياناتي (الاسم، المدرسة، البريد) لاستخدامها في الرحلة.'
                        : 'أوافق على حفظ بياناتي وبيانات أطفالي (الاسم، العمر، الصف، المدرسة، التقدم في الدروس) لاستخدامها في الرحلة وفي متابعة المعلّم إذا انضم الطفل لفصل. يمكنني تعديلها أو حذفها في أي وقت.'}</span></label>
      <span class="err" id="e-consent"></span>
      <p class="err" id="e-form" role="alert"></p>
      <button class="btn go" type="submit">إنشاء الحساب ←</button>
      <p class="note">لديك حساب بالفعل؟ <a href="#signin">تسجيل الدخول</a></p></form>`;
  clearOnInput($('#uf'));
  $('#uf').onsubmit = async e => {
    e.preventDefault();
    const v = id => ($(id) ? $(id).value.trim() : ''), errs = {};
    const name = v('#f-name').replace(/\s+/g, ' '), email = v('#f-email'), pass = $('#f-pass').value, phone = normPhone(v('#f-phone')), school = v('#f-school').replace(/\s+/g, ' ');
    if (!name) errs.name = 'اكتب الاسم بالكامل';
    else if (!isArabicName(name)) errs.name = /[a-zA-Z]/.test(name) ? 'اكتب الاسم بالحروف العربية' : 'اكتب الاسم بالكامل (الاسم الأول واسم الأب على الأقل)';
    if (teacher) { if (!school) errs.school = 'اكتب اسم المدرسة'; else if (!isArabicText(school)) errs.school = 'اكتب اسم المدرسة بالحروف العربية'; }
    else if (!isEgPhone(phone)) errs.phone = 'رقم الموبايل المصري ١١ رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015';
    if (!isEmail(email)) errs.email = 'البريد الإلكتروني غير صحيح — مثال: name@example.com';
    if (pass.length < 8) errs.pass = 'كلمة المرور ٨ أحرف على الأقل';
    else if ($('#f-pass2').value !== pass) errs.pass2 = 'كلمتا المرور غير متطابقتين';
    if (!$('#f-consent').checked) errs.consent = 'يجب الموافقة لإنشاء الحساب';
    if (showErrors(errs, ['name', 'school', 'phone', 'email', 'pass', 'pass2', 'consent'])) return;
    const btn = $('#uf button[type=submit]'); busy(btn, true, '⏳ جارٍ إنشاء الحساب…');
    try {
      const r = await CLOUD.signUp({ email, password: pass, role: teacher ? 'teacher' : 'parent', fullName: name, phone, school });
      if (r.needsConfirm) return confirmSent(email);
      restart(teacher ? '#teacher' : '#register');
    } catch (err) { busy(btn, false); $('#e-form').textContent = CLOUD.errText(err); beep('bad'); }
  };
}
function confirmSent(email) {
  app.innerHTML = `<div class="panel narrow" style="text-align:center"><div class="big">📧</div>
    <h2>تم إنشاء الحساب — بقيت خطوة واحدة</h2>
    <p>أرسلنا رسالة إلى <b class="ltr" style="display:inline-block">${esc(email)}</b>. افتحها واضغط رابط التأكيد، ثم عد هنا واضغط «تسجيل الدخول».</p>
    <p class="note">لم تصل الرسالة؟ انظر في مجلد الرسائل غير المرغوب فيها (Spam).</p>
    <button class="btn go" onclick="go('#signin')">🔑 تسجيل الدخول</button></div>`;
}

/* ---------- password reset ---------- */
function forgotPage() {
  app.innerHTML = `<div class="bar">${backBtn('#signin', 'رجوع')}<h2 class="grow" style="margin:0 8px">🔒 نسيت كلمة المرور</h2></div>
    <form class="panel form narrow" id="ff" novalidate>
      ${field('f-email', 'البريد الإلكتروني للحساب', 'class="ltr" type="email" autocomplete="email"')}
      <p class="err" id="e-form" role="alert"></p>
      <button class="btn go" type="submit">أرسل رابط تغيير كلمة المرور</button></form>`;
  $('#ff').onsubmit = async e => {
    e.preventDefault();
    const email = $('#f-email').value.trim();
    if (showErrors(isEmail(email) ? {} : { email: 'اكتب البريد الإلكتروني بشكل صحيح' }, ['email'])) return;
    try { await CLOUD.resetPassword(email); app.innerHTML = `<div class="panel narrow" style="text-align:center"><div class="big">📧</div><h2>أرسلنا رابطاً إلى بريدك</h2><p>افتح الرسالة واضغط الرابط لاختيار كلمة مرور جديدة.</p></div>`; }
    catch (err) { $('#e-form').textContent = CLOUD.errText(err); }
  };
}
function newPassPage() {
  app.innerHTML = `<form class="panel form narrow" id="nf" novalidate><h2>🔒 كلمة مرور جديدة</h2>
      ${field('f-pass', 'كلمة المرور الجديدة', 'class="ltr" type="password" autocomplete="new-password"', '٨ أحرف على الأقل')}
      <p class="err" id="e-form" role="alert"></p><button class="btn go" type="submit">حفظ</button></form>`;
  $('#nf').onsubmit = async e => {
    e.preventDefault();
    const pass = $('#f-pass').value;
    if (showErrors(pass.length >= 8 ? {} : { pass: 'كلمة المرور ٨ أحرف على الأقل' }, ['pass'])) return;
    try { await CLOUD.setNewPassword(pass); toast('تم تغيير كلمة المرور ✔'); restart('#login'); }
    catch (err) { $('#e-form').textContent = CLOUD.errText(err); }
  };
}

/* ---------- which child is playing? ---------- */
function wireLocalFactory(local) {
  return function wireLocal() {
  const up = $('#up-local');
    if (up) up.onclick = async () => { busy(up, true); try { const n = await CLOUD.uploadLocalChildren(); toast(`تمت إضافة ${AR_NUM(n)} إلى حسابك ✔`); restart('#login'); } catch (err) { busy(up, false); toast(CLOUD.errText(err)); } };
    const drop = $('#drop-local');
    if (drop) drop.onclick = () => {
      if (!drop.dataset.sure) { drop.dataset.sure = '1'; drop.textContent = '⚠️ اضغط مرة أخرى للحذف'; return; }
      local.forEach(c => ACC.remove(c.id)); toast('تم الحذف'); restart('#login');
    };
  };
}

function loginPage() {
  const kids = ACC.list(), online = kids.filter(c => !ACC.isLocalOnly(c)), local = kids.filter(c => ACC.isLocalOnly(c));
  const wireLocal = wireLocalFactory(local);
  const head = `<div class="bar">${ME ? backBtn('#home', 'الرئيسية') : ''}<h2 class="grow" style="margin:0 8px">👀 من سيلعب الآن؟</h2>
    <button class="btn alt" onclick="go('#parents')">👪 ولي الأمر</button></div>`;
  const localNote = local.length ? `<div class="panel"><b>📱 ${local.length === 1 ? 'يوجد طفل واحد مسجّل' : 'يوجد ' + AR_NUM(local.length) + ' أطفال مسجّلين'} على هذا الجهاز فقط من قبل.</b>
      <p class="note">${local.map(c => esc(c.name)).join('، ')} — ${local.length === 1 ? 'أضِفه إلى حسابك ليُحفظ تقدمه على الإنترنت، أو احذفه إذا كان للتجربة فقط.' : 'أضِفهم إلى حسابك ليُحفظ تقدمهم على الإنترنت، أو احذفهم إذا كانوا للتجربة فقط.'}</p>
      <div class="bar"><button class="btn" id="up-local">⬆️ ${local.length === 1 ? 'أضِفه' : 'أضِفهم'} إلى حسابي</button><button class="btn alt" id="drop-local">🗑️ ${local.length === 1 ? 'احذفه' : 'احذفهم'} من هذا الجهاز</button></div></div>` : '';
  if (!online.length) {
    app.innerHTML = `${head}${localNote}<div class="panel" style="text-align:center"><div class="big">🧒</div><h2>لا يوجد أطفال في الحساب بعد</h2>
      <p class="sub">أضف طفلك الأول ليبدأ الرحلة.</p><button class="btn go" onclick="go('#register')">➕ إضافة طفل</button></div>`;
    wireLocal(); return;
  }
  app.innerHTML = `${head}<p class="sub">اختر اسمك ثم اكتب الرقم السري الخاص بك</p>${localNote}
    <div class="kids">${online.map(k => `<button class="kid" data-id="${k.id}">${avatar(k.compAv || k.avatar, 64)}<b>${esc(childFirst(k))}</b><span class="note">${esc(k.grade)}</span></button>`).join('')}
      <button class="kid add" onclick="go('#register')"><span class="plus">＋</span><b>إضافة طفل</b></button></div>
    <div id="pin"></div>`;
  $$('.kid[data-id]').forEach(b => b.onclick = () => askPin(kids.find(k => k.id === b.dataset.id)));
  wireLocal();
}
function askPin(k) {
  $$('.kid').forEach(x => x.classList.toggle('sel', x.dataset.id === k.id));
  const box = $('#pin');
  box.innerHTML = `<form class="panel form" id="pinf" novalidate>
      <h3>أهلاً يا ${esc(childFirst(k))}! 🔒</h3>
      <div class="field"><label for="pin-in">اكتب رقمك السري (٤ أرقام)</label>
        <input id="pin-in" class="ltr pin" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="••••" aria-describedby="pin-err">
        <span class="err" id="pin-err" role="alert"></span></div>
      <div class="bar"><button class="btn go" type="submit">دخول ←</button><span class="note">نسيته؟ اسأل ولي الأمر 😊</span></div></form>`;
  const inp = $('#pin-in'); inp.focus();
  $('#pinf').onsubmit = async e => {
    e.preventDefault();
    if (toLatinDigits(inp.value) === String(k.pin || '')) {
      ACC.login(k.id);
      if (navigator.onLine) { try { await CLOUD.pullProgress(k.id); } catch (err) {} }
      restart('#home');
    } else { beep('bad'); $('#pin-err').textContent = 'الرقم غير صحيح — حاول مرة أخرى'; inp.select(); }
  };
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- add / edit a child (done by the parent) ---------- */
const fullChildName = first => (first.trim().replace(/\s+/g, ' ') + (parentName() ? ' ' + parentName() : '')).slice(0, 80);
function registerPage(edit) {
  if (edit && !ME) return go('#login');
  const p = edit ? ME : { gender: '' };
  const pAv = edit ? avId(ME.compAv || ME.avatar) : '', pName = edit ? (ME.compName || '') : '';
  const ages = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  app.innerHTML = `<div class="bar">${backBtn(edit ? '#parents' : '#login', 'رجوع')}<h2 class="grow" style="margin:0 8px">${edit ? '✏️ تعديل بيانات الطفل' : '➕ إضافة طفل'}</h2></div>
    <form class="panel form" id="reg" novalidate>${offlineNote()}
      <p class="note">👪 يملأ ولي الأمر هذه البيانات. تُحفظ في حسابك ويراها فقط أنت ومعلّم الفصل الذي ينضم إليه الطفل.</p>
      <div class="field"><label for="f-name">الاسم الأول للطفل (باللغة العربية)</label>
        <input id="f-name" autocomplete="off" placeholder="مثال: يوسف" value="${esc(edit ? childFirst(p) : '')}" aria-describedby="e-name">
        <span class="note" id="fullname-note"></span><span class="err" id="e-name"></span></div>
      <div class="row2">
        <div class="field"><label for="f-age">العمر</label>
          <select id="f-age" aria-describedby="e-age"><option value="">اختر العمر</option>${ages.map(a => `<option value="${a}" ${p.age == a ? 'selected' : ''}>${AR_NUM(a)} ${a <= 10 ? 'سنوات' : 'سنة'}</option>`).join('')}</select><span class="err" id="e-age"></span></div>
        <div class="field"><label for="f-grade">الصف الدراسي</label>
          <select id="f-grade" aria-describedby="e-grade"><option value="">اختر الصف</option>${GRADES.map(g => `<option ${p.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select><span class="err" id="e-grade"></span></div>
      </div>
      <fieldset class="field"><legend>النوع</legend>
        <div class="choices">
          <label class="choice"><input type="radio" name="gender" id="f-boy" value="boy" ${p.gender === 'boy' ? 'checked' : ''}><span class="gico">👦</span><b>ولد</b></label>
          <label class="choice"><input type="radio" name="gender" id="f-girl" value="girl" ${p.gender === 'girl' ? 'checked' : ''}><span class="gico">👧</span><b>بنت</b></label>
        </div><span class="err" id="e-gender"></span></fieldset>
      <fieldset class="field comp" id="comp" hidden><legend id="comp-legend"></legend>
        <p class="note" id="comp-note"></p>
        <div class="choices" id="comp-avs"></div>
        <div class="field"><span class="lbl" id="comp-name-label"></span>
          <div class="namechips" id="comp-names" role="radiogroup"></div></div>
        <div class="comp-preview" id="comp-preview" aria-live="polite"></div>
      </fieldset>
      <div class="field"><label for="f-school">اسم المدرسة (باللغة العربية)</label>
        <input id="f-school" placeholder="مثال: مدرسة النصر الابتدائية" value="${esc(p.school || '')}" aria-describedby="e-school"><span class="err" id="e-school"></span></div>
      <div class="field"><label for="f-pin">الرقم السري للطفل (٤ أرقام)</label>
        <input id="f-pin" class="ltr pin" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(p.pin || '')}" aria-describedby="e-pin">
        <span class="note">يكتبه الطفل ليدخل باسمه على هذا الجهاز. اختر رقماً سهلاً يتذكره.</span><span class="err" id="e-pin"></span></div>
      <p class="err" id="e-form" role="alert"></p>
      <button class="btn go" type="submit">${edit ? 'حفظ التعديلات ✔' : 'إضافة الطفل ←'}</button>
    </form>`;
  /* companion picker: boys pick a boy character, girls a girl character, each with an Egyptian name */
  let cAv = pAv, cName = pName;
  const drawComp = () => {
    const g = ($('input[name=gender]:checked') || {}).value;
    $('#comp').hidden = !g; if (!g) return;
    const girl = g === 'girl', ids = Object.keys(AVATARS).filter(id => isGirlAv(id) === girl), names = girl ? GIRL_NAMES : BOY_NAMES;
    if (!ids.includes(cAv)) cAv = ids[0];
    if (!names.includes(cName)) cName = names[0];
    $('#comp-legend').textContent = girl ? '👭 اختاري رفيقتك في الرحلة' : '👬 اختر رفيقك في الرحلة';
    $('#comp-note').textContent = girl ? 'رفيقتك ستشرح لك وتساعدك في كل الألعاب، وتتكلم بصوت بنت.' : 'رفيقك سيشرح لك ويساعدك في كل الألعاب، ويتكلم بصوت ولد.';
    $('#comp-name-label').textContent = girl ? 'اختاري اسمها' : 'اختر اسمه';
    $('#comp-avs').innerHTML = ids.map(id => `<label class="choice"><input type="radio" name="cav" value="${id}" ${id === cAv ? 'checked' : ''}>${avatar(id, 60)}</label>`).join('');
    $('#comp-names').innerHTML = names.map(n => `<button type="button" class="chip namechip ${n === cName ? 'sel' : ''}" role="radio" aria-checked="${n === cName}" data-n="${n}">${n}</button>`).join('');
    $('#comp-preview').innerHTML = `${avatar(cAv, 44)}<span>${girl ? 'رفيقتك' : 'رفيقك'}: <b>${cName}</b></span>`;
    $$('input[name=cav]').forEach(r => r.onchange = () => { cAv = r.value; beep('tap'); drawComp(); });
    $$('.namechip').forEach(b => b.onclick = () => { cName = b.dataset.n; beep('tap'); drawComp(); });
  };
  drawComp();
  $$('input[name=gender]').forEach(r => r.onchange = () => { $('#e-gender').textContent = ''; drawComp(); });
  clearOnInput($('#reg'));
  const showFull = () => { const f = $('#f-name').value.trim().replace(/\s+/g, ' '); $('#fullname-note').textContent = f ? 'الاسم الكامل: ' + fullChildName(f) : (parentName() ? 'سيُكمَل الاسم تلقائياً باسم ولي الأمر: ' + parentName() : ''); };
  $('#f-name').addEventListener('input', showFull); showFull();
  $('#reg').onsubmit = async e => {
    e.preventDefault();
    const v = id => $(id).value.trim(), errs = {};
    const name = v('#f-name').replace(/\s+/g, ' '), school = v('#f-school').replace(/\s+/g, ' '), pin = toLatinDigits(v('#f-pin'));
    const gender = ($('input[name=gender]:checked') || {}).value;
    if (!name) errs.name = 'اكتب الاسم الأول للطفل';
    else if (!isArabicFirstName(name)) errs.name = /[a-zA-Z]/.test(name) ? 'اكتب الاسم بالحروف العربية' : 'اكتب الاسم الأول فقط (كلمة أو كلمتان مثل «عبد الرحمن»)';
    if (!v('#f-age')) errs.age = 'اختر العمر';
    if (!v('#f-grade')) errs.grade = 'اختر الصف الدراسي';
    if (!gender) errs.gender = 'اختر ولد أو بنت';
    if (!school) errs.school = 'اكتب اسم المدرسة'; else if (!isArabicText(school)) errs.school = 'اكتب اسم المدرسة بالحروف العربية';
    if (!/^\d{4}$/.test(pin)) errs.pin = 'اكتب ٤ أرقام';
    if (showErrors(errs, ['name', 'age', 'grade', 'gender', 'school', 'pin'])) return;
    const rec = { name: fullChildName(name), age: +v('#f-age'), grade: v('#f-grade'), gender, compAv: cAv, compName: cName, avatar: cAv, school, pin };
    const btn = $('#reg button[type=submit]'); busy(btn, true, '⏳ جارٍ الحفظ…');
    try {
      if (edit) { rec.id = ME.id; await CLOUD.updateChild(rec); restart('#parents'); return; }
      const kid = await CLOUD.addChild(rec);
      ACC.set(ACC.progressKey(kid.id), JSON.stringify({ mode: rec.age <= 11 ? 'young' : 'old' }));
      ACC.login(kid.id); restart('#home');
    } catch (err) { busy(btn, false); $('#e-form').textContent = CLOUD.errText(err); beep('bad'); }
  };
}

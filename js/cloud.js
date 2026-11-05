/* Online accounts and progress (Supabase).
   - Parents and teachers sign in with email + password (session kept on the device).
   - Children are picked on a signed-in device with their own 4-digit code.
   - Progress is saved on the device first, then synced online (works offline, catches up later).
   The publishable key below is meant to be public; the database's row-level rules decide what each user can see. */
const SB_URL = 'https://hghkegnshlwmjmhvzcce.supabase.co';
const SB_KEY = 'sb_publishable_VhXnp605qVHyv_ulSduPbQ_hdSVpUav';
const AUTH_KEY = 'arabTrip.auth';
const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY } })
  : null;

const CLOUD = (() => {
  const readJSON = k => { try { return JSON.parse(ACC.get(k) || 'null'); } catch (e) { return null; } };
  const cachedSession = readJSON(AUTH_KEY);
  let user = cachedSession && cachedSession.user ? cachedSession.user : null;
  let profile = readJSON('arabTrip.profile');
  if (profile && user && profile.id !== user.id) profile = null;
  const pushTimers = {};
  if (sb) sb.auth.onAuthStateChange((event, session) => {      // keep in step with the server (token refresh, sign-out elsewhere)
    if (session && session.user) user = session.user;
    else if (event === 'SIGNED_OUT') user = null;
  });

  const fromRow = r => ({ id: r.id, name: r.full_name, age: r.age, gender: r.gender, grade: r.grade, school: r.school,
    compAv: r.comp_av, compName: r.comp_name, avatar: r.comp_av, pin: r.pin });
  const toRow = c => ({ full_name: c.name, age: c.age, gender: c.gender, grade: c.grade, school: c.school,
    comp_av: c.compAv, comp_name: c.compName, pin: c.pin });

  /* merge two progress states: keep the best of both (stars, points, scores), local settings win */
  function merge(local, remote) {
    const out = Object.assign({}, remote || {}, local || {});
    const maxMap = (a, b) => { const m = Object.assign({}, b || {}); for (const [k, v] of Object.entries(a || {})) m[k] = Math.max(v || 0, m[k] || 0); return m; };
    out.xp = Math.max((local && local.xp) || 0, (remote && remote.xp) || 0);
    out.done = maxMap(local && local.done, remote && remote.done);
    out.quizBest = maxMap(local && local.quizBest, remote && remote.quizBest);
    out.wrong = maxMap(local && local.wrong, remote && remote.wrong);
    return out;
  }
  const errText = e => {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e || '');
    if (/Invalid login credentials/i.test(m)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    if (/Email not confirmed/i.test(m)) return 'لم يتم تأكيد البريد الإلكتروني بعد — افتح الرسالة التي وصلتك واضغط رابط التأكيد';
    if (/already registered|already been registered|User already/i.test(m)) return 'هذا البريد مسجّل بالفعل — استخدم «تسجيل الدخول»';
    if (/Password should be|at least/i.test(m)) return 'كلمة المرور قصيرة — ٨ أحرف على الأقل';
    if (/rate limit|too many/i.test(m)) return 'محاولات كثيرة — انتظر قليلاً ثم حاول مرة أخرى';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'لا يوجد اتصال بالإنترنت — تأكد من الاتصال ثم حاول مرة أخرى';
    if (/not_your_child/.test(m)) return 'هذا الطفل غير مسجّل في حسابك';
    if (/not_an_approved_teacher/.test(m)) return 'حساب المعلّم بانتظار موافقة الإدارة';
    return 'حدث خطأ: ' + m;
  };

  return {
    ready: !!sb,
    get user() { return user; },
    get profile() { return profile; },
    get role() { return profile ? profile.role : (user ? (user.user_metadata && user.user_metadata.role === 'teacher' ? 'teacher' : 'parent') : null); },
    errText, merge,

    /* called once before the first screen: finishes an email-link sign-in if the page was opened from one */
    async boot() {
      if (!sb) return;
      const fromLink = /access_token=|error_description=|type=signup|type=recovery/.test(location.hash) || /[?&]code=/.test(location.search);
      if (fromLink) {
        const recovery = /type=recovery/.test(location.hash);
        const { data } = await sb.auth.getSession();
        history.replaceState(null, '', location.pathname + (recovery ? '#newpass' : '#welcome'));
        if (data && data.session) { user = data.session.user; await this.refreshProfile(); await this.syncChildren(); }
        return;
      }
      if (user && navigator.onLine) {               // refresh in the background; the screen shows cached data first
        this.refreshProfile().then(changed => { if (changed) route(); }).catch(() => {});
        this.syncChildren().then(changed => { if (changed) restart(location.hash || '#home'); }).catch(() => {});
        if (ME) this.pullProgress(ME.id).catch(() => {});
      }
      addEventListener('online', () => { if (ME && ACC.get('arabTrip.dirty.' + ME.id)) this.pushProgress(ME.id); });
    },

    async refreshProfile() {
      if (!sb || !user) return false;
      const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error || !data) return false;
      const changed = JSON.stringify(data) !== JSON.stringify(profile);
      profile = data; ACC.set('arabTrip.profile', JSON.stringify(data));
      return changed;
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      user = data.user; await this.refreshProfile(); await this.syncChildren();
      return data;
    },
    async signUp({ email, password, role, fullName, phone, school }) {
      const { data, error } = await sb.auth.signUp({ email, password, options: {
        data: { role, full_name: fullName, phone: phone || '', school: school || '', consent: 'true' },
        emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (data.session) { user = data.user; await this.refreshProfile(); }
      return { needsConfirm: !data.session, data };
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
    },
    async setNewPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    },
    /* the parent area asks for the account password again (so children can't open it) */
    async checkPassword(password) {
      const { error } = await sb.auth.signInWithPassword({ email: user.email, password });
      if (error) throw error;
      sessionStorage.setItem('arabTrip.parentOK', String(Date.now()));
    },
    parentUnlocked() { const t = +sessionStorage.getItem('arabTrip.parentOK') || 0; return Date.now() - t < 15 * 60 * 1000; },
    /* save every child's progress online now; returns the ids that could NOT be saved (offline) */
    async saveAllProgress() {
      const left = [];
      for (const c of ACC.list().filter(x => !ACC.isLocalOnly(x))) {
        if (!ACC.get(ACC.progressKey(c.id))) continue;
        clearTimeout(pushTimers[c.id]);
        let ok = false; try { ok = await this.pushProgress(c.id); } catch (e) {}
        if (!ok) left.push(c.id);
      }
      return left;
    },
    async signOut() {
      const unsaved = await this.saveAllProgress();          // progress goes online before leaving
      try { if (sb) await sb.auth.signOut(); } catch (e) {}
      ACC.list().forEach(c => { if (!unsaved.includes(c.id)) { ACC.del(ACC.progressKey(c.id)); ACC.del('arabTrip.dirty.' + c.id); } });
      ['arabTrip.profiles', 'arabTrip.current', 'arabTrip.profile', AUTH_KEY].forEach(k => ACC.del(k));
      sessionStorage.removeItem('arabTrip.parentOK');
      user = null; profile = null;
      return unsaved.length;
    },

    /* ---- children (the parent's own) ---- */
    async syncChildren() {
      if (!sb || !user) return false;
      const { data, error } = await sb.from('children').select('*').eq('parent_id', user.id).order('created_at');
      if (error) return false;
      const fresh = data.map(fromRow), before = JSON.stringify(ACC.list().filter(c => !ACC.isLocalOnly(c)));
      const localOnly = ACC.list().filter(c => ACC.isLocalOnly(c));       // made on this device before online accounts
      ACC.setList(fresh.concat(localOnly));
      if (ACC.currentId() && !ACC.list().some(c => c.id === ACC.currentId())) ACC.logout();
      return before !== JSON.stringify(fresh);
    },
    async addChild(c) {
      const { data, error } = await sb.from('children').insert(Object.assign({ parent_id: user.id }, toRow(c))).select().single();
      if (error) throw error;
      const kid = fromRow(data); ACC.setList(ACC.list().concat(kid));
      return kid;
    },
    async updateChild(c) {
      const { data, error } = await sb.from('children').update(toRow(c)).eq('id', c.id).select().single();
      if (error) throw error;
      ACC.setList(ACC.list().map(x => x.id === c.id ? fromRow(data) : x));
    },
    async removeChild(id) {
      if (!ACC.isLocalOnly({ id })) { const { error } = await sb.from('children').delete().eq('id', id); if (error) throw error; }
      ACC.remove(id);
    },
    /* move children registered on this device only (before online accounts) into the parent's account */
    async uploadLocalChildren() {
      let n = 0;
      for (const c of ACC.list().filter(x => ACC.isLocalOnly(x))) {
        const kid = await this.addChild(Object.assign({}, c, { pin: c.pin || String(c.phone || '0000').slice(-4), compAv: avId(c.compAv || c.avatar), compName: c.compName || (isGirlAv(c.compAv || c.avatar) ? 'مريم' : 'مروان') }));
        const old = ACC.get(ACC.progressKey(c.id));
        if (old) { ACC.set(ACC.progressKey(kid.id), old); await this.pushProgress(kid.id); }
        ACC.remove(c.id); n++;
      }
      return n;
    },

    /* ---- progress ---- */
    queuePush(childId) {
      if (!sb || !user || !childId || ACC.isLocalOnly({ id: childId })) return;
      ACC.set('arabTrip.dirty.' + childId, '1');
      clearTimeout(pushTimers[childId]);
      pushTimers[childId] = setTimeout(() => this.pushProgress(childId), 1500);
    },
    async pushProgress(childId) {
      if (!sb || !user || !navigator.onLine) return false;
      let state; try { state = JSON.parse(ACC.get(ACC.progressKey(childId)) || '{}'); } catch (e) { state = {}; }
      const { error } = await sb.from('progress').upsert({ child_id: childId, state, updated_at: new Date().toISOString() });
      if (!error) ACC.del('arabTrip.dirty.' + childId);
      return !error;
    },
    async pullProgress(childId) {
      if (!sb || !user) return;
      const { data, error } = await sb.from('progress').select('state').eq('child_id', childId).maybeSingle();
      if (error) return;
      let local; try { local = JSON.parse(ACC.get(ACC.progressKey(childId)) || '{}'); } catch (e) { local = {}; }
      const merged = merge(local, data && data.state);
      ACC.set(ACC.progressKey(childId), JSON.stringify(merged));
      if (ME && ME.id === childId) { Object.assign(S, merged); header(); }
      if (!data || JSON.stringify(merged) !== JSON.stringify(data.state)) await this.pushProgress(childId);
    },
    async childrenProgress() {        // parent area: progress of all the parent's children
      const ids = ACC.list().filter(c => !ACC.isLocalOnly(c)).map(c => c.id);
      if (!ids.length) return {};
      const { data } = await sb.from('progress').select('child_id,state,updated_at').in('child_id', ids);
      return Object.fromEntries((data || []).map(r => [r.child_id, r]));
    },

    /* ---- classes ---- */
    async joinClass(code, childId) {
      const { data, error } = await sb.rpc('join_class', { p_code: code, p_child: childId });
      if (error) throw error;
      return data;   // class name, or null when the code doesn't exist
    },
    async childClasses(childId) {
      const { data } = await sb.from('class_members').select('class_id, classes(name, join_code)').eq('child_id', childId);
      return (data || []).map(r => ({ id: r.class_id, name: r.classes && r.classes.name, code: r.classes && r.classes.join_code }));
    },
    async leaveClass(classId, childId) {
      const { error } = await sb.from('class_members').delete().eq('class_id', classId).eq('child_id', childId);
      if (error) throw error;
    },
    async myClasses() {
      const { data, error } = await sb.from('classes').select('*').eq('teacher_id', user.id).order('created_at');
      if (error) throw error;
      return data;
    },
    async createClass(name) {
      const { data, error } = await sb.rpc('create_class', { p_name: name });
      if (error) throw error;
      return data;
    },
    async deleteClass(id) {
      const { error } = await sb.from('classes').delete().eq('id', id);
      if (error) throw error;
    },
    async classReport(classId) {
      const { data, error } = await sb.from('class_members')
        .select('child_id, joined_at, children(full_name, grade, age, gender, progress(state, updated_at))').eq('class_id', classId);
      if (error) throw error;
      return (data || []).map(r => {
        const c = r.children || {}, p = Array.isArray(c.progress) ? c.progress[0] : c.progress;
        return { id: r.child_id, name: c.full_name, grade: c.grade, age: c.age, state: (p && p.state) || {}, updated: p && p.updated_at };
      });
    },
    async removeFromClass(classId, childId) { return this.leaveClass(classId, childId); },

    /* ---- admin ---- */
    async teachers() {
      const { data, error } = await sb.from('profiles').select('id,email,full_name,school,approved,created_at').eq('role', 'teacher').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    async approveTeacher(id, ok) {
      const { error } = await sb.rpc('approve_teacher', { p_user: id, p_ok: ok });
      if (error) throw error;
    },
    async adminCounts() {
      const count = async (t, f) => { let q = sb.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); const { count: n } = await q; return n || 0; };
      return { parents: await count('profiles', q => q.eq('role', 'parent')), teachers: await count('profiles', q => q.eq('role', 'teacher')),
               children: await count('children'), classes: await count('classes') };
    },
  };
})();

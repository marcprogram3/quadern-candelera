/*
 * Sessió i desament a Supabase.
 *
 * - Només poden entrar els usuaris que l'administrador ha donat d'alta.
 *   El professor escriu el seu usuari («mpuig») i internament es converteix
 *   en mpuig@candelera.local (vegeu js/config.js).
 * - El primer cop, el professor ha de canviar la contrasenya inicial.
 * - Les notes es desen a la taula «notebooks» uns instants després de cada
 *   canvi. La columna «version» detecta si una altra finestra o ordinador
 *   ha desat entremig, per no perdre canvis sense avisar.
 * - La sessió viu a sessionStorage: es tanca en tancar el navegador, cosa
 *   important en ordinadors compartits de l'institut.
 */
const Auth = (() => {
  const NOTICE_KEY = 'candelera_notice';
  const SAVE_DELAY = 800;

  let client = null;
  let user = null;
  let profile = null;
  let version = 0;

  // Estat del desament
  let pending = null, dirty = false, timer = 0, inflight = null;
  let status = 'saved';
  const statusListeners = [];

  const configured = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  const libraryLoaded = () => typeof window.supabase?.createClient === 'function';

  function sb() {
    client ??= window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // no fem servir enllaços màgics ni OAuth
        // La sessió és per pestanya (sessionStorage), així que no cal coordinar
        // pestanyes amb navigator.locks; a més, aquest bloqueig retardava l'arrencada uns 5 s.
        lock: (name, timeout, fn) => fn(),
      },
    });
    return client;
  }

  function toEmail(username) {
    const u = String(username || '').trim().toLowerCase();
    return u.includes('@') ? u : `${u}@${CONFIG.usernameDomain}`;
  }

  /** Error de Supabase → missatge entenedor en català. */
  function friendly(error, fallback) {
    if (!error) return fallback;
    if (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message || '')) {
      return 'No hi ha connexió amb el servidor. Comproveu la connexió a internet.';
    }
    if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message || '')) {
      return 'L’usuari o la contrasenya no són correctes.';
    }
    if (error.code === 'same_password') return 'La contrasenya nova ha de ser diferent de l’actual.';
    if (error.code === 'weak_password') return 'La contrasenya és massa feble. Feu-la més llarga o més variada.';
    if (error.code === 'over_request_rate_limit' || error.status === 429) return 'Massa intents seguits. Espereu uns minuts i torneu-ho a provar.';
    return fallback;
  }

  async function loadProfile() {
    const { data } = await sb().from('profiles').select('username, full_name').eq('id', user.id).maybeSingle();
    const fallback = user.email.split('@')[0];
    profile = data || { username: fallback, full_name: fallback };
  }

  // ---- Sessió ----
  async function login(username, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email: toEmail(username), password });
    if (error) throw new Error(friendly(error, 'No s’ha pogut iniciar la sessió.'));
    user = data.user;
    await loadProfile();
    watchIdle();
  }

  /** Recupera la sessió en recarregar la pàgina. Retorna cert si n'hi ha. */
  async function restoreSession() {
    const { data } = await sb().auth.getSession();
    if (!data.session) return false;
    // La sessió guardada pot ser d'un usuari que l'administrador ja ha donat de
    // baixa: es comprova amb el servidor abans de fer-la servir.
    const { data: checked, error } = await sb().auth.getUser();
    if (error && [401, 403, 404].includes(error.status)) {
      await sb().auth.signOut({ scope: 'local' }).catch(() => {});
      return false;
    }
    if (error) throw new Error(friendly(error, 'No s’ha pogut comprovar la sessió.'));
    user = checked.user;
    await loadProfile();
    watchIdle();
    return true;
  }

  async function logout(reason = '') {
    await flushNow();
    await sb().auth.signOut().catch(() => {});
    if (reason) sessionStorage.setItem(NOTICE_KEY, reason);
    location.reload();
  }

  function takeNotice() {
    const msg = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return msg;
  }

  // ---- Contrasenya ----
  /** Cert si el professor encara té la contrasenya inicial que li va donar l'administrador. */
  const mustChangePassword = () => !user?.user_metadata?.password_changed;

  async function changePassword(newPassword, currentPassword = null) {
    if (currentPassword != null) {
      // Es comprova la contrasenya actual abans de canviar-la.
      const { error } = await sb().auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (error?.code === 'invalid_credentials') throw new Error('La contrasenya actual no és correcta.');
      if (error) throw new Error(friendly(error, 'No s’ha pogut comprovar la contrasenya actual.'));
    }
    const { data, error } = await sb().auth.updateUser({ password: newPassword, data: { password_changed: true } });
    if (error) throw new Error(friendly(error, 'No s’ha pogut canviar la contrasenya.'));
    user = data.user;
  }

  // ---- Quadern ----
  /** Retorna les dades del professor, o null si encara no en té (primer accés). */
  async function loadNotebook() {
    const { data, error } = await sb().from('notebooks').select('data, version').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error(friendly(error, 'No s’han pogut carregar les notes.'));
    if (!data) return null;
    version = data.version;
    return data.data;
  }

  async function createNotebook(initial) {
    const { error } = await sb().from('notebooks').insert({ user_id: user.id, data: initial, version: 1 });
    // Ja existia (p. ex. creat des d'una altra pestanya): es carrega el que hi ha.
    if (error?.code === '23505') return (await loadNotebook()) ?? initial;
    // L'usuari de la sessió ja no existeix (s'ha donat de baixa): cal tornar a entrar.
    if (error?.code === '23503') {
      await logout('La sessió ja no era vàlida perquè l’usuari s’ha donat de baixa o s’ha tornat a crear. Torneu a entrar.');
      return new Promise(() => {}); // la pàgina es recarrega
    }
    if (error) throw new Error(friendly(error, 'No s’ha pogut crear el quadern.'));
    version = 1;
    return initial;
  }

  // ---- Desament automàtic ----
  function setStatus(s) {
    status = s;
    statusListeners.forEach(fn => fn(s));
  }

  /** Demana desar l'estat. Es desa uns instants després, agrupant canvis seguits. */
  function persist(state) {
    if (!user) return;
    pending = state;
    dirty = true;
    setStatus('pending');
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
  }

  function flush() {
    if (inflight || !dirty) return inflight;
    inflight = (async () => {
      dirty = false;
      setStatus('saving');
      const { data, error } = await sb().from('notebooks')
        .update({ data: pending, version: version + 1, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('version', version)
        .select('version');
      inflight = null;
      if (error) {
        dirty = true;
        setStatus('error');
        timer = setTimeout(flush, 5000); // es torna a provar sol
        return;
      }
      if (!data.length) { setStatus('conflict'); conflict(); return; }
      version = data[0].version;
      if (dirty) flush(); else setStatus('saved');
    })();
    return inflight;
  }

  async function flushNow() {
    clearTimeout(timer);
    for (let i = 0; i < 5 && (dirty || inflight) && status !== 'conflict'; i++) {
      await (inflight || flush());
    }
  }

  /** Una altra finestra o ordinador ha desat entremig: el professor tria quina versió es queda. */
  function conflict() {
    UI.modal({
      title: 'Canvis des d’un altre lloc',
      body: `<p>Aquest quadern s’ha modificat des d’una altra finestra o un altre ordinador mentre el teníeu obert aquí.</p>
             <p>Podeu carregar la versió més recent (es perdran els canvis d’aquesta finestra des de l’últim desament) o desar aquesta versió per sobre de l’altra.</p>`,
      actions: [
        { label: 'Desa aquesta versió', onClick: () => { overwrite(); } },
        { label: 'Carrega la més recent', primary: true, onClick: () => { location.reload(); } },
      ],
    });
  }

  async function overwrite() {
    const { data } = await sb().from('notebooks').select('version').eq('user_id', user.id).single();
    version = data.version;
    dirty = true;
    flush();
  }

  // Avís si es tanca la pestanya amb canvis per desar.
  addEventListener('beforeunload', e => {
    if (dirty || inflight) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---- Bloqueig per inactivitat ----
  let lastActivity = Date.now(), idleTimer = 0;
  function watchIdle() {
    if (idleTimer) return;
    const touch = () => { lastActivity = Date.now(); };
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(ev => addEventListener(ev, touch, { passive: true }));
    idleTimer = setInterval(() => {
      if (Date.now() - lastActivity > CONFIG.idleMinutes * 60000) {
        logout(`La sessió s’ha tancat després de ${CONFIG.idleMinutes} minuts sense activitat.`);
      }
    }, 30000);
  }

  return {
    configured, libraryLoaded, login, restoreSession, logout, takeNotice,
    mustChangePassword, changePassword, loadNotebook, createNotebook, persist, flushNow,
    onStatus: fn => { statusListeners.push(fn); fn(status); },
    get account() { return profile ? { name: profile.full_name, username: profile.username } : null; },
  };
})();

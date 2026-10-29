/*
 * Estructura general de l'app: menú lateral, barra superior, tema i
 * navegació entre pàgines. Cada pàgina viu al seu fitxer de js/pages/ i
 * s'hi registra amb Pages.nom = { render(), mount(el) }.
 */
const Pages = {};

const App = (() => {
  const NAV = [
    ['grid', '▦', 'Graella de notes'],
    ['students', '☰', 'Alumnes'],
    ['analytics', '◔', 'Gràfics de classe'],
    ['settings', '⚙', 'Configuració'],
    ['transfer', '⇄', 'Importar / Exportar'],
  ];
  const THEME_KEY = 'candelera_theme';
  const esc = UI.esc;
  let search = '';

  // ---- Tema clar / fosc ----
  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function isDark() {
    const t = storedTheme();
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme() {
    const t = storedTheme();
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }
  function toggleTheme() {
    try { localStorage.setItem(THEME_KEY, isDark() ? 'light' : 'dark'); } catch (e) { /* sense preferència desada */ }
    render();
  }

  // ---- Pintat ----
  function backupNote() {
    const last = Store.ui().lastBackup;
    if (!last) return 'Encara no heu fet cap còpia de seguretat.';
    const days = Math.floor((Date.now() - new Date(last)) / 86400000);
    return days === 0 ? 'Darrera còpia: avui.' : `Darrera còpia: fa ${days} ${days === 1 ? 'dia' : 'dies'}.`;
  }

  function render() {
    applyTheme();
    const ui = Store.ui(), course = Store.course(), term = Store.term();
    const state = Store.get();
    const user = Auth.account;
    document.title = 'Quadern de notes · Institut Candelera';
    const app = document.getElementById('app');
    app.className = 'app';
    app.innerHTML = `
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-logo" src="LogoCandelera.png" alt="Logo de l’Institut Candelera">
          <div><strong>Institut Candelera</strong><small>L’Ametlla de Mar</small></div>
        </div>
        <div class="nav-label">Espai docent</div>
        <nav class="nav">${NAV.map(([id, icon, label]) => `
          <button class="${ui.page === id ? 'active' : ''}" data-page="${id}" ${ui.page === id ? 'aria-current="page"' : ''}>
            <span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span>
          </button>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <div class="privacy">
            <strong>Còpia pròpia</strong>
            Les notes es desen soles al servidor. ${backupNote()}
            <button class="linkbtn" id="quickBackup">Descarrega una còpia ↓</button>
          </div>
          <div class="user">
            <span class="user-avatar">${UI.initials(user?.name || '?')}</span>
            <span class="user-name">${esc(user?.name || '')}<small>${esc(user?.username || '')} · Curs ${UI.schoolYear()}</small></span>
            <button class="iconbtn small" id="passwordBtn" title="Canvia la contrasenya" aria-label="Canvia la contrasenya">🔑</button>
            <button class="iconbtn small" id="logoutBtn" title="Tanca la sessió" aria-label="Tanca la sessió">⏻</button>
          </div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="context">
            <small>${esc(course.name)}${ui.group ? ` · Grup ${esc(ui.group)}` : ''}</small>
            <strong>${esc(term?.name || 'Sense trimestres')}</strong>
          </div>
          <div class="selects">
            <select id="courseSelect" aria-label="Matèria i curs">${state.courses.map(c =>
              `<option value="${c.id}" ${c.id === course.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            <select id="groupSelect" aria-label="Grup">${course.groups.map(g =>
              `<option value="${esc(g)}" ${g === ui.group ? 'selected' : ''}>Grup ${esc(g)}</option>`).join('')}</select>
            <select id="termSelect" aria-label="Trimestre">${course.terms.map(t =>
              `<option value="${t.id}" ${t.id === term?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
          </div>
          <span class="save-status" id="saveStatus" role="status"></span>
          <div class="topbar-buttons">
            <button class="iconbtn" id="themeBtn" title="${isDark() ? 'Mode clar' : 'Mode fosc'}" aria-label="Canvia entre mode clar i fosc">${isDark() ? '☼' : '☾'}</button>
            <button class="iconbtn mobile-only" id="logoutMobile" title="Tanca la sessió" aria-label="Tanca la sessió">⏻</button>
          </div>
        </header>
        <section class="content" id="content"></section>
      </main>`;
    bindShell();
    showSaveStatus(saveStatus);
    renderPage();
  }

  // ---- Indicador de desament ----
  let saveStatus = 'saved';
  const SAVE_LABELS = {
    saved: ['✓ Desat', 'ok'],
    pending: ['Desant…', ''],
    saving: ['Desant…', ''],
    error: ['Sense connexió: es tornarà a provar', 'error'],
    conflict: ['Canvis des d’un altre lloc', 'error'],
  };
  function showSaveStatus(s) {
    saveStatus = s;
    const el = document.getElementById('saveStatus');
    if (!el) return;
    const [text, cls] = SAVE_LABELS[s] || SAVE_LABELS.saved;
    el.textContent = text;
    el.className = `save-status ${cls}`;
  }

  function bindShell() {
    const ui = Store.ui();
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
    document.getElementById('courseSelect').onchange = e => {
      ui.courseId = e.target.value; ui.group = null; ui.termId = null;
      Store.ensureUi(); Store.save(); search = ''; render();
    };
    document.getElementById('groupSelect').onchange = e => { ui.group = e.target.value; Store.save(); render(); };
    document.getElementById('termSelect').onchange = e => { ui.termId = e.target.value; Store.save(); render(); };
    document.getElementById('themeBtn').onclick = toggleTheme;
    document.getElementById('quickBackup').onclick = () => { Transfer.exportJSON(); render(); };
    document.getElementById('logoutBtn').onclick = () => Auth.logout();
    document.getElementById('passwordBtn').onclick = Login.changePasswordModal;
    document.getElementById('logoutMobile').onclick = () => Auth.logout();
  }

  function renderPage() {
    Charts.destroyAll();
    const page = Pages[Store.ui().page] || Pages.grid;
    // Contenidor nou a cada pintat: així no s'acumulen escoltadors d'esdeveniments.
    const old = document.getElementById('content');
    const content = old.cloneNode(false);
    old.replaceWith(content);
    content.innerHTML = page.render();
    page.mount?.(content);
  }

  /**
   * Torna a pintar la pàgina (o tota l'app si full és cert) i retorna el focus
   * al camp que l'usuari tenia actiu, o al camp focusKey si s'indica.
   */
  function rerenderKeepingFocus({ full = false, focusKey = null } = {}) {
    setTimeout(() => {
      const key = focusKey || document.activeElement?.dataset?.key;
      const y = window.scrollY;
      if (full) render(); else renderPage();
      window.scrollTo(0, y);
      const el = key && document.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (el) { el.focus(); if (focusKey) el.select?.(); }
    }, 0);
  }

  function go(page) {
    Store.ui().page = page;
    Store.save();
    search = '';
    render();
    window.scrollTo(0, 0);
  }

  /** Entra a l'app amb les dades del professor ja carregades. */
  function start(data) {
    Store.init(data);
    render();
  }

  async function boot() {
    applyTheme();
    // Si l'usuari no ha triat tema, se segueix el del sistema en directe.
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!storedTheme() && Auth.account) render();
    });
    if (!Auth.configured() || !Auth.libraryLoaded()) return Login.show('setup');
    Auth.onStatus(showSaveStatus);
    try {
      if (await Auth.restoreSession()) return await Login.next();
    } catch (e) {
      return Login.show('login', e.message);
    }
    Login.show('login');
  }

  return {
    boot, start, render, renderPage, rerenderKeepingFocus, go, isDark,
    get search() { return search; },
    set search(v) { search = v; },
  };
})();

/*
 * Pantalla d'inici de sessió.
 *
 * Passos:
 *   login     usuari i contrasenya (només usuaris donats d'alta per l'administrador)
 *   password  el primer cop, canvi obligatori de la contrasenya inicial
 *   welcome   el primer cop, com comença el quadern (de zero, exemple o còpia)
 *   setup     falta configurar Supabase (js/config.js) o no hi ha connexió
 */
const Login = (() => {
  const esc = UI.esc;
  let notice = '';

  function passwordField(id, label, autocomplete) {
    return `
      <div class="formfield">
        <label for="${id}">${label}</label>
        <div class="password">
          <input id="${id}" class="field" type="password" autocomplete="${autocomplete}" required>
          <button type="button" class="show-pass" data-show="${id}" aria-label="Mostra la contrasenya">Mostra</button>
        </div>
      </div>`;
  }

  const forms = {
    login: () => `
      <form id="authForm" novalidate>
        <h2>Inicia la sessió</h2>
        <p class="login-sub">Entreu amb l’usuari i la contrasenya que us ha donat l’administrador.</p>
        <div class="formfield"><label for="username">Usuari</label>
          <input id="username" class="field" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="p. ex. mpuig"></div>
        ${passwordField('password', 'Contrasenya', 'current-password')}
        <div class="form-error" role="alert"></div>
        <button class="btn primary big" type="submit">Entra</button>
        <div class="login-links"><button type="button" class="linkbtn" id="forgot">He oblidat la contrasenya</button></div>
      </form>`,

    password: () => `
      <form id="authForm" novalidate>
        <h2>Hola, ${esc(Auth.account?.name || '')}!</h2>
        <p class="login-sub">És el primer cop que entreu. Trieu una contrasenya personal: a partir d’ara només la sabreu vosaltres.</p>
        ${passwordField('password', 'Contrasenya nova (mínim 8 caràcters)', 'new-password')}
        ${passwordField('password2', 'Repetiu la contrasenya', 'new-password')}
        <div class="form-error" role="alert"></div>
        <button class="btn primary big" type="submit">Desa i continua</button>
      </form>`,

    welcome: () => `
      <form id="authForm" novalidate>
        <h2>El vostre quadern</h2>
        <p class="login-sub">Com voleu començar? Ho podreu canviar més endavant des de Configuració i Importar / Exportar.</p>
        <fieldset class="start-options"><legend>Començar…</legend>
          <label class="start-option"><input type="radio" name="start" value="empty" checked>
            <span><b>De zero</b><small>Una matèria buida per configurar amb els vostres grups i activitats.</small></span></label>
          <label class="start-option"><input type="radio" name="start" value="demo">
            <span><b>Amb dades d’exemple</b><small>Alumnes i notes inventats, per provar l’app.</small></span></label>
          <label class="start-option"><input type="radio" name="start" value="backup">
            <span><b>Amb una còpia de seguretat</b><small>Un fitxer .json descarregat abans des d’Importar / Exportar.</small></span></label>
        </fieldset>
        <input type="file" id="backupFile" accept=".json,application/json" hidden>
        <div class="form-error" role="alert"></div>
        <button class="btn primary big" type="submit">Comença</button>
      </form>`,

    setup: () => `
      <div>
        <h2>Falta la configuració</h2>
        ${!Auth.configured()
          ? `<p class="login-sub">Cal indicar les dades del projecte de Supabase al fitxer <code>js/config.js</code> (vegeu <code>GUIA-ADMIN.md</code>).</p>`
          : `<p class="login-sub">No s’ha pogut carregar la connexió amb el servidor. Comproveu la connexió a internet i torneu-ho a provar.</p>
             <button class="btn primary big" onclick="location.reload()">Torna-ho a provar</button>`}
      </div>`,
  };

  function show(step = 'login', message = '') {
    notice = message || Auth.takeNotice?.() || '';
    document.title = 'Inicia la sessió · Institut Candelera';
    const app = document.getElementById('app');
    // El fons (amb el logo a la cantonada) el posa el CSS: horitzontal o vertical segons la pantalla.
    app.className = 'login';
    app.innerHTML = `
      <section class="login-panel">
        <header class="login-title">
          <p class="login-eyebrow">Institut Candelera · L’Ametlla de Mar</p>
          <h1>Quadern de notes</h1>
        </header>
        <div class="login-card">
          ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
          ${forms[step]()}
        </div>
        <p class="login-foot">Accés reservat al professorat de l’Institut Candelera.</p>
      </section>`;
    bind(app, step);
    app.querySelector('#authForm input:not([type=radio])')?.focus();
  }

  function bind(root, step) {
    root.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
      const input = root.querySelector('#' + b.dataset.show);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      b.textContent = visible ? 'Mostra' : 'Amaga';
    });
    root.querySelector('#forgot')?.addEventListener('click', () => UI.modal({
      title: 'Heu oblidat la contrasenya?',
      body: '<p>Demaneu a l’administrador del quadern que us la restableixi. Us en donarà una de provisional i, en entrar, en podreu triar una de nova.</p>',
    }));
    const form = root.querySelector('#authForm');
    form?.addEventListener('submit', e => { e.preventDefault(); submit(form, step); });
  }

  async function submit(form, step) {
    const val = id => form.querySelector('#' + id)?.value ?? '';
    const error = msg => { form.querySelector('.form-error').textContent = msg; };
    const button = form.querySelector('button[type=submit]');
    const label = button.textContent;
    const busy = text => { button.disabled = true; button.textContent = text; };

    try {
      if (step === 'login') {
        if (!val('username').trim() || !val('password')) return error('Escriviu l’usuari i la contrasenya.');
        busy('Entrant…');
        await Auth.login(val('username'), val('password'));
        await next();
      } else if (step === 'password') {
        if (val('password').length < 8) return error('La contrasenya ha de tenir com a mínim 8 caràcters.');
        if (val('password') !== val('password2')) return error('Les contrasenyes no coincideixen.');
        busy('Desant…');
        await Auth.changePassword(val('password'));
        await next();
      } else if (step === 'welcome') {
        const start = form.querySelector('input[name=start]:checked').value;
        const initial = start === 'demo' ? Seed.create() : start === 'empty' ? Store.empty() : await pickBackup(form);
        if (!initial) return;
        busy('Preparant el quadern…');
        App.start(await Auth.createNotebook(initial));
      }
    } catch (e) {
      error(e.message || 'Hi ha hagut un error. Torneu-ho a provar.');
      button.disabled = false;
      button.textContent = label;
    }
  }

  /** Demana el fitxer de còpia de seguretat i el valida. */
  function pickBackup(form) {
    return new Promise(resolve => {
      const input = form.querySelector('#backupFile');
      input.onchange = () => {
        const file = input.files[0];
        input.value = '';
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => {
          let data = null;
          try { data = JSON.parse(reader.result); } catch (e) { /* no és JSON */ }
          if (!Store.isValid(data)) {
            form.querySelector('.form-error').textContent = 'Aquest fitxer no és una còpia de seguretat vàlida.';
            return resolve(null);
          }
          resolve(data);
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  /** Després d'entrar: canvi de contrasenya si cal, després el quadern. */
  async function next() {
    if (Auth.mustChangePassword()) return show('password');
    const data = await Auth.loadNotebook();
    if (data) App.start(data);
    else show('welcome');
  }

  /** Canvi de contrasenya des de dins l'app. */
  function changePasswordModal() {
    const m = UI.modal({
      title: 'Canvia la contrasenya',
      body: `${passwordField('cpCurrent', 'Contrasenya actual', 'current-password')}
             ${passwordField('cpNew', 'Contrasenya nova (mínim 8 caràcters)', 'new-password')}
             ${passwordField('cpNew2', 'Repetiu la contrasenya nova', 'new-password')}`,
      actions: [
        { label: 'Cancel·la' },
        {
          label: 'Desa', primary: true, onClick: () => {
            const v = id => m.body.querySelector('#' + id).value;
            if (v('cpNew').length < 8) { UI.toast('La contrasenya nova ha de tenir com a mínim 8 caràcters.', true); return false; }
            if (v('cpNew') !== v('cpNew2')) { UI.toast('Les contrasenyes noves no coincideixen.', true); return false; }
            Auth.changePassword(v('cpNew'), v('cpCurrent'))
              .then(() => UI.toast('Contrasenya canviada.'))
              .catch(e => UI.toast(e.message, true));
          },
        },
      ],
    });
    m.body.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
      const input = m.body.querySelector('#' + b.dataset.show);
      input.type = input.type === 'text' ? 'password' : 'text';
      b.textContent = input.type === 'text' ? 'Amaga' : 'Mostra';
    });
    m.body.querySelectorAll('.formfield').forEach(f => { f.style.marginBottom = '12px'; });
  }

  return { show, next, changePasswordModal };
})();

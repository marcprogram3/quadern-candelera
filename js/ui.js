/*
 * Utilitats d'interfície compartides: escapament d'HTML, avisos, finestres
 * modals i descàrregues de fitxers.
 */
const UI = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer = 0;
  function toast(message, isError = false) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.textContent = message;
    document.body.append(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), isError ? 4500 : 3000);
  }

  /**
   * Finestra modal.
   * actions: [{ label, primary?, danger?, onClick? }] — si onClick retorna false, la finestra no es tanca.
   * Retorna { el, body, close }.
   */
  let closeCurrent = null;

  function modal({ title, subtitle = '', body = '', actions = [{ label: 'Tanca' }], wide = false, headerExtra = '', onClose = null }) {
    closeCurrent?.(); // només una finestra oberta alhora
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `
      <section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-head">
          <div><h2>${esc(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
          <div class="modal-head-actions">${headerExtra}<button class="iconbtn" data-close aria-label="Tanca">×</button></div>
        </header>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<footer class="modal-foot">${actions.map((a, i) =>
          `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger push-left' : ''}" data-action-index="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
      </section>`;
    document.body.append(back);
    document.body.classList.add('modal-open');

    const onKey = e => { if (e.key === 'Escape') close(); };
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (closeCurrent === close) closeCurrent = null;
      back.remove();
      if (!closeCurrent) document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
      onClose?.();
    }
    closeCurrent = close;
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    back.querySelector('[data-close]').onclick = close;
    back.querySelectorAll('[data-action-index]').forEach(btn => {
      btn.onclick = () => {
        const action = actions[Number(btn.dataset.actionIndex)];
        if (action.onClick?.() === false) return;
        close();
      };
    });
    back.querySelector('input:not([type=checkbox]), textarea, select')?.focus();
    return { el: back, body: back.querySelector('.modal-body'), close };
  }

  /** Demana un text amb una finestra petita. Retorna una promesa amb el text o null. */
  function ask({ title, label, value = '', placeholder = '', confirmLabel = 'Desa' }) {
    return new Promise(resolve => {
      let answered = false;
      const m = modal({
        title,
        body: `<div class="formfield"><label for="askInput">${esc(label)}</label><input id="askInput" class="field" value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`,
        actions: [
          { label: 'Cancel·la' },
          { label: confirmLabel, primary: true, onClick: () => { answered = true; resolve(m.body.querySelector('#askInput').value.trim() || null); } },
        ],
        onClose: () => { if (!answered) resolve(null); },
      });
      const input = m.body.querySelector('#askInput');
      input.select();
      input.addEventListener('keydown', e => { if (e.key === 'Enter') m.el.querySelector('.btn.primary').click(); });
    });
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function download(filename, text, mime) {
    downloadBlob(filename, new Blob([text], { type: mime }));
  }

  /** CSV amb punt i coma i BOM, perquè l'Excel en català l'obri bé. */
  function downloadCSV(filename, rows) {
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    download(filename, '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const slug = s => Store.normalizeName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function schoolYear(date = new Date()) {
    const y = date.getFullYear();
    return date.getMonth() >= 7 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
  }

  function initials(name) {
    return name.split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  }

  /** Nota calculada amb color, asterisc si és provisional i explicació al tooltip. */
  function gradeBadge(result, course, { strong = false } = {}) {
    if (!result || result.grade == null) {
      return `<span class="calc-val ${result?.provisional ? 'prov' : ''}" title="${result?.provisional ? 'Pendent de notes' : 'Sense notes'}">—</span>`;
    }
    const text = Calc.format(result.grade, course.settings.precision);
    const tips = [result.provisional ? 'Provisional: hi ha activitats pendents' : 'Definitiva'];
    if (result.adjustment) tips.push(`Inclou ajust d’actitud ${result.adjustment > 0 ? '+' : ''}${Calc.format(result.adjustment, 2)}`);
    return `<span class="calc-val ${Calc.band(result.grade)} ${result.provisional ? 'prov' : ''} ${strong ? 'strong' : ''}" title="${tips.join(' · ')}">${text}${result.provisional ? '<sup>*</sup>' : ''}</span>`;
  }

  return { esc, toast, modal, ask, download, downloadBlob, downloadCSV, today, slug, schoolYear, initials, gradeBadge };
})();

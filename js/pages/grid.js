/*
 * Graella de notes: la pantalla principal.
 *
 * Quan es desa una nota no es torna a pintar tota la pàgina: només
 * s'actualitzen les notes calculades de la fila, les mitjanes del peu i els
 * indicadors. Així el focus i el desplaçament es mantenen mentre s'introdueixen notes.
 *
 * Teclat: Enter o ↓ baixa a la fila següent (com a l'Excel), Maj+Enter o ↑ puja,
 * ← → canvien de columna, Tab avança, Esc desfà la casella.
 * També es pot enganxar un bloc de cel·les copiat de l'Excel.
 */
Pages.grid = (() => {
  const esc = UI.esc;

  /** Activitats visibles del trimestre, en l'ordre de les columnes. */
  function columns(term) {
    return term.sas.filter(sa => sa.activities.length).flatMap(sa => sa.activities.map(a => ({ a, sa })));
  }

  function usedCes(course, term) {
    return course.ces.filter(ce => term.sas.some(sa => sa.activities.some(a => a.ce === ce.id)));
  }

  function pendingCount(course, term, students) {
    const acts = columns(term).map(x => x.a);
    return students.reduce((n, s) => n + acts.filter(a => (course.grades[s.id]?.[a.id] ?? '') === '').length, 0);
  }

  function kpisHtml(course, term, students) {
    const results = students.map(s => Calc.termResult(course, s.id, term).grade);
    const graded = results.filter(g => g != null);
    const avg = Calc.mean(graded);
    const passed = graded.filter(g => g >= course.settings.pass).length;
    const risk = students.filter((s, i) => (results[i] != null && results[i] < course.settings.pass) || Calc.hasDrop(course, s.id)).length;
    const pending = pendingCount(course, term, students);
    return `
      <div class="kpi"><div class="label">Mitjana del grup</div><b>${Calc.format(avg, course.settings.precision)}<em> / 10</em></b></div>
      <div class="kpi"><div class="label">Aprovats</div><b>${graded.length ? Math.round(passed / graded.length * 100) + '%' : '—'}<em> ${passed} de ${graded.length}</em></b></div>
      <div class="kpi ${risk ? 'warn' : ''}"><div class="label">Alumnes en risc</div><b>${risk}<em> ${risk === 1 ? 'alumne' : 'alumnes'}</em></b></div>
      <div class="kpi"><div class="label">Notes pendents</div><b>${pending}<em> caselles buides</em></b></div>`;
  }

  function render() {
    const course = Store.course(), term = Store.term();
    if (!term) return emptyPage('Aquesta matèria encara no té trimestres', 'Afegiu-los a Configuració.');
    const students = Store.groupStudents(course, Store.ui().group);
    const cols = columns(term);
    return `
      <div class="pagehead">
        <div>
          <div class="eyebrow">${esc(course.name)} · Grup ${esc(Store.ui().group)}</div>
          <h1>Graella de notes</h1>
          <p class="subline">${students.length} alumnes · ${cols.length} activitats · Les caselles buides queden pendents: no compten com a zero.</p>
        </div>
        <div class="actions">
          <button class="btn" id="printGrid">Imprimeix / PDF</button>
          <button class="btn primary" id="exportGrid">⇩ Exporta a Excel</button>
        </div>
      </div>
      <div class="kpis" id="gridKpis">${kpisHtml(course, term, students)}</div>
      <section class="panel">
        <div class="panelhead">
          <div>
            <h2>${esc(term.name)}</h2>
            <p>Escriviu una nota (7,5) o un nivell (e, n, s, na → AE, AN, AS, NA). Es desa sol.</p>
          </div>
          <div class="toolbar">
            <input id="gridSearch" class="search" type="search" placeholder="Cerca un alumne…" value="${esc(App.search)}" aria-label="Cerca un alumne">
            <button class="btn" id="fillComments">Omple comentaris suggerits</button>
          </div>
        </div>
        <div id="gridTable"></div>
        <div class="tablefoot">
          <div class="legend">
            <span><i class="dot b-low"></i>&lt; 5</span><span><i class="dot b-mid"></i>5–6</span><span><i class="dot b-ok"></i>6–7</span>
            <span><i class="dot b-good"></i>7–9</span><span><i class="dot b-top"></i>≥ 9</span><span><i class="dot b-ex"></i>Exempt</span>
          </div>
          <span><b>NP</b> no presentat (compta 0) · <b>EX</b> exempt (no compta) · <b>*</b> nota provisional</span>
        </div>
      </section>`;
  }

  function emptyPage(title, text) {
    return `<div class="pagehead"><div><h1>Graella de notes</h1></div></div><div class="panel"><div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div></div>`;
  }

  function tableHtml(course, term, students) {
    const sas = term.sas.filter(sa => sa.activities.length);
    if (!sas.length) {
      return `<div class="empty"><strong>Aquest trimestre encara no té activitats</strong>Afegiu situacions d’aprenentatge i activitats a <button class="linkbtn" data-goto="settings">Configuració</button>.</div>`;
    }
    if (!students.length) {
      return `<div class="empty"><strong>No hi ha alumnes per mostrar</strong>${App.search ? 'Cap alumne coincideix amb la cerca.' : 'Afegiu alumnes des de la pàgina Alumnes.'}</div>`;
    }
    const ces = usedCes(course, term);
    const saShares = Calc.shares(sas);
    let col = 0;

    const head1 = sas.map((sa, i) =>
      `<th class="sa-head" colspan="${sa.activities.length + 1}">${esc(sa.name)} <span class="weight-tag">${Math.round(saShares[i])}%</span></th>`).join('');
    const head2 = sas.map(sa => {
      const shares = Calc.shares(sa.activities);
      return sa.activities.map((a, i) => `
        <th class="act-head">
          <div class="act-name" title="${esc(a.name)}">${esc(a.name)}</div>
          <div class="act-meta">
            <span class="ce-chip">${esc(Store.ceCode(course, a.ce))}</span>
            <span class="weight-tag" title="Pes dins la SA">${Math.round(shares[i])}%</span>
            <span class="type-tag" title="${a.type === 'qual' ? 'Qualitativa' : 'Numèrica'}">${a.type === 'qual' ? 'AE–NA' : '0–10'}</span>
          </div>
          <button class="col-fill" data-fill="${a.id}" title="Omple tota la columna" aria-label="Omple la columna ${esc(a.name)}">⋯</button>
        </th>`).join('') + `<th class="calc-head">Nota ${esc(sa.name)}</th>`;
    }).join('');

    const rows = students.map((s, r) => {
      col = 0;
      const cells = sas.map(sa => sa.activities.map(a => {
        const v = course.grades[s.id]?.[a.id] ?? '';
        return `<td class="cell"><input class="grade ${Calc.valueBand(v)} ${a.type}" data-row="${r}" data-col="${col++}" data-sid="${s.id}" data-aid="${a.id}"
          value="${esc(Calc.formatValue(v))}" autocomplete="off" spellcheck="false" aria-label="${esc(s.name)}, ${esc(a.name)}"></td>`;
      }).join('') + `<td class="calc" data-calc="sa:${sa.id}"></td>`).join('');
      return `<tr data-sid="${s.id}">
        <td class="col-student"><button class="student-link" data-detail="${s.id}"><span class="initial">${UI.initials(s.name)}</span><span>${esc(s.name)}</span></button></td>
        ${cells}
        <td class="calc term" data-calc="term"></td>
        ${ces.map(ce => `<td class="calc" data-calc="ce:${ce.id}"></td>`).join('')}
        <td class="follow" data-follow="attitude"></td>
        <td class="follow" data-follow="comment"></td>
      </tr>`;
    }).join('');

    const foot = sas.map(sa => sa.activities.map(a => `<td data-avg="act:${a.id}"></td>`).join('') + `<td data-avg="sa:${sa.id}"></td>`).join('');

    return `
      <div class="grid-wrap">
        <table class="gradegrid">
          <thead>
            <tr><th class="col-student" rowspan="2">Alumne</th>${head1}
              <th class="sum-head" colspan="${1 + ces.length}">Resultats del trimestre</th>
              <th class="sum-head" colspan="2">Seguiment</th></tr>
            <tr>${head2}
              <th class="calc-head strong">Nota trimestre</th>
              ${ces.map(ce => `<th class="calc-head" title="${esc(ce.name || 'Competència específica')}">${esc(ce.code)}</th>`).join('')}
              <th class="calc-head">Actitud</th><th class="calc-head">Comentari</th></tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td class="col-student">Mitjana del grup</td>${foot}
            <td data-avg="term"></td>${ces.map(ce => `<td data-avg="ce:${ce.id}"></td>`).join('')}<td></td><td></td></tr></tfoot>
        </table>
      </div>`;
  }

  // ---- Actualització de les notes calculades ----
  function compute(course, term, studentId, key) {
    if (key === 'term') return Calc.termResult(course, studentId, term);
    const [kind, id] = key.split(':');
    if (kind === 'sa') return Calc.saResult(course, studentId, term.sas.find(sa => sa.id === id));
    if (kind === 'ce') return Calc.ceResult(course, studentId, id, term.id);
    return null;
  }

  function refreshRow(tr, course, term) {
    const student = course.students.find(s => s.id === tr.dataset.sid);
    tr.querySelectorAll('[data-calc]').forEach(td => {
      td.innerHTML = UI.gradeBadge(compute(course, term, student.id, td.dataset.calc), course, { strong: td.dataset.calc === 'term' });
    });
    const tags = student.attitude?.[term.id] || [];
    const labels = course.settings.attitudeLabels.filter(l => tags.includes(l.id));
    tr.querySelector('[data-follow="attitude"]').innerHTML = `<button class="follow-btn" data-edit="${student.id}" title="Edita l’actitud">${
      labels.length ? labels.map(l => `<span class="tag ${l.adjust < 0 ? 'neg' : l.adjust > 0 ? 'pos' : ''}">${esc(l.text)}</span>`).join('') : '<span class="muted">＋</span>'}</button>`;
    const comment = student.comments?.[term.id] || '';
    const suggestion = comment ? '' : Calc.suggestComment(course.settings.commentBank, Calc.termResult(course, student.id, term).grade);
    tr.querySelector('[data-follow="comment"]').innerHTML = `<button class="follow-btn comment" data-edit="${student.id}" title="${esc(comment || (suggestion ? 'Suggeriment: ' + suggestion : 'Afegeix un comentari'))}">${
      comment ? esc(comment) : suggestion ? `<span class="muted suggested">${esc(suggestion)}</span>` : '<span class="muted">＋</span>'}</button>`;
  }

  function refreshFooter(root, course, term, students) {
    root.querySelectorAll('[data-avg]').forEach(td => {
      const key = td.dataset.avg;
      let avg;
      if (key.startsWith('act:')) {
        const act = Store.findActivity(course, key.slice(4));
        avg = Calc.mean(students.map(s => {
          const n = Calc.gradeOf(course, s.id, act);
          return n === 'EX' ? null : n;
        }));
      } else {
        avg = Calc.mean(students.map(s => compute(course, term, s.id, key)?.grade));
      }
      td.innerHTML = avg == null ? '' : `<span class="calc-val ${Calc.band(avg)}">${Calc.format(avg, course.settings.precision)}</span>`;
    });
  }

  function refreshAll(root) {
    const course = Store.course(), term = Store.term();
    const students = Store.groupStudents(course, Store.ui().group, App.search);
    root.querySelectorAll('tbody tr[data-sid]').forEach(tr => refreshRow(tr, course, term));
    refreshFooter(root, course, term, students);
    document.getElementById('gridKpis').innerHTML = kpisHtml(course, term, Store.groupStudents(course, Store.ui().group));
  }

  // ---- Edició de notes ----
  const cellAt = (root, r, c) => root.querySelector(`input.grade[data-row="${r}"][data-col="${c}"]`);

  /** Desa el text d'una casella. Retorna true si era vàlid. */
  function commit(input, text = input.value, { quiet = false } = {}) {
    const course = Store.course();
    const activity = Store.findActivity(course, input.dataset.aid);
    const stored = course.grades[input.dataset.sid]?.[input.dataset.aid] ?? '';
    const parsed = Calc.parseInput(text, activity.type);
    if (!parsed.ok) {
      if (!quiet) UI.toast(parsed.error, true);
      input.value = Calc.formatValue(stored);
      input.classList.add('invalid');
      setTimeout(() => input.classList.remove('invalid'), 900);
      return false;
    }
    input.value = Calc.formatValue(parsed.value);
    input.className = `grade ${Calc.valueBand(parsed.value)} ${activity.type}`;
    if (parsed.value !== stored) {
      Store.setGrade(course, input.dataset.sid, input.dataset.aid, parsed.value);
      Store.save();
    }
    return true;
  }

  function caretAtStart(input) { return input.selectionStart === 0 && (input.selectionEnd === 0 || input.selectionEnd === input.value.length); }
  function caretAtEnd(input) { return input.selectionEnd === input.value.length && (input.selectionStart === input.value.length || input.selectionStart === 0); }

  function onKeydown(e, root) {
    const input = e.target.closest('input.grade');
    if (!input) return;
    const r = Number(input.dataset.row), c = Number(input.dataset.col);
    let target;
    if (e.key === 'Enter') target = cellAt(root, e.shiftKey ? r - 1 : r + 1, c);
    else if (e.key === 'ArrowDown') target = cellAt(root, r + 1, c);
    else if (e.key === 'ArrowUp') target = cellAt(root, r - 1, c);
    else if (e.key === 'ArrowRight' && caretAtEnd(input)) target = cellAt(root, r, c + 1);
    else if (e.key === 'ArrowLeft' && caretAtStart(input)) target = cellAt(root, r, c - 1);
    else if (e.key === 'Escape') {
      const stored = Store.course().grades[input.dataset.sid]?.[input.dataset.aid] ?? '';
      input.value = Calc.formatValue(stored);
      input.select();
      e.stopPropagation();
      return;
    } else return;
    e.preventDefault();
    // Es desa abans de moure's, sense dependre de l'esdeveniment change del navegador.
    const stored = Store.course().grades[input.dataset.sid]?.[input.dataset.aid] ?? '';
    if (input.value !== Calc.formatValue(stored)) {
      commit(input);
      refreshAll(root);
    }
    target?.focus();
  }

  /** Enganxar un bloc copiat de l'Excel: s'omple cap avall i cap a la dreta. */
  function onPaste(e, root) {
    const input = e.target.closest('input.grade');
    const text = e.clipboardData?.getData('text') ?? '';
    if (!input || !/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
    const r0 = Number(input.dataset.row), c0 = Number(input.dataset.col);
    let ok = 0, bad = 0;
    rows.forEach((cells, i) => cells.forEach((value, j) => {
      const target = cellAt(root, r0 + i, c0 + j);
      if (!target) return;
      commit(target, value, { quiet: true }) ? ok++ : bad++;
    }));
    refreshAll(root);
    UI.toast(bad ? `${ok} notes enganxades; ${bad} no eren vàlides i s’han descartat.` : `${ok} notes enganxades.`, bad > 0);
  }

  function fillColumn(activityId) {
    const course = Store.course();
    const act = Store.findActivity(course, activityId);
    const students = Store.groupStudents(course, Store.ui().group, App.search);
    const m = UI.modal({
      title: 'Omple la columna',
      subtitle: `${esc(act.name)} · ${act.type === 'qual' ? 'qualitativa (AE, AN, AS, NA)' : 'numèrica (0–10)'} · ${students.length} alumnes visibles`,
      body: `
        <div class="formgrid">
          <div class="formfield"><label for="fillValue">Nota o nivell</label><input id="fillValue" class="field" placeholder="${act.type === 'qual' ? 'AE, AN, AS, NA, NP, EX' : '7,5 · NP · EX'}"></div>
          <div class="formfield"><label>Abast</label><label class="check"><input type="checkbox" id="fillEmpty" checked> Només les caselles buides</label></div>
        </div>
        <p class="hint">Per esborrar tota la columna, deixeu la nota en blanc i desmarqueu «Només les caselles buides».</p>`,
      actions: [
        { label: 'Cancel·la' },
        {
          label: 'Aplica', primary: true, onClick: () => {
            const parsed = Calc.parseInput(m.body.querySelector('#fillValue').value, act.type);
            if (!parsed.ok) { UI.toast(parsed.error, true); return false; }
            const onlyEmpty = m.body.querySelector('#fillEmpty').checked;
            let n = 0;
            students.forEach(s => {
              if (onlyEmpty && (course.grades[s.id]?.[act.id] ?? '') !== '') return;
              Store.setGrade(course, s.id, act.id, parsed.value);
              n++;
            });
            Store.save();
            App.renderPage();
            UI.toast(`Columna actualitzada: ${n} ${n === 1 ? 'alumne' : 'alumnes'}.`);
          },
        },
      ],
    });
  }

  function drawTable() {
    const course = Store.course(), term = Store.term();
    const holder = document.getElementById('gridTable');
    holder.innerHTML = tableHtml(course, term, Store.groupStudents(course, Store.ui().group, App.search));
    if (holder.querySelector('.gradegrid')) refreshAll(holder);
  }

  function mount(root) {
    if (!Store.term()) return;
    drawTable();
    const holder = root.querySelector('#gridTable');

    holder.addEventListener('change', e => {
      if (!e.target.matches('input.grade')) return;
      commit(e.target);
      refreshAll(holder);
    });
    holder.addEventListener('keydown', e => onKeydown(e, holder));
    holder.addEventListener('paste', e => onPaste(e, holder));
    // En entrar a una casella se selecciona el contingut, com en un full de càlcul.
    holder.addEventListener('focusin', e => { if (e.target.matches('input.grade')) requestAnimationFrame(() => e.target.select()); });
    holder.addEventListener('click', e => {
      const detail = e.target.closest('[data-detail]');
      if (detail) return Detail.open(detail.dataset.detail);
      const edit = e.target.closest('[data-edit]');
      if (edit) return StudentForm.open(edit.dataset.edit, () => App.renderPage());
      const fill = e.target.closest('[data-fill]');
      if (fill) return fillColumn(fill.dataset.fill);
      const go = e.target.closest('[data-goto]');
      if (go) App.go(go.dataset.goto);
    });

    root.querySelector('#gridSearch').addEventListener('input', e => { App.search = e.target.value; drawTable(); });
    root.querySelector('#fillComments').onclick = StudentForm.fillSuggested;
    root.querySelector('#printGrid').onclick = () => window.print();
    root.querySelector('#exportGrid').onclick = () => Transfer.exportWorkbook();
  }

  return { render, mount };
})();

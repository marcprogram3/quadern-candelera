/*
 * Pàgina d'alumnes i formulari d'edició (nom, grup, actitud i comentari del trimestre).
 */
const StudentForm = (() => {
  const esc = UI.esc;

  /** Obre el formulari. Sense id, crea un alumne nou. onSaved es crida després de desar. */
  function open(studentId, onSaved) {
    const course = Store.course(), term = Store.term();
    const student = studentId ? course.students.find(s => s.id === studentId) : null;
    const tags = (term && student?.attitude?.[term.id]) || [];
    const grade = student && term ? Calc.termResult(course, student.id, term).grade : null;
    const suggestion = Calc.suggestComment(course.settings.commentBank, grade);
    const adjustOn = course.settings.attitudeAdjust;

    const m = UI.modal({
      title: student ? student.name : 'Afegeix un alumne',
      subtitle: student && term ? `${esc(term.name)} · nota ${Calc.format(grade, course.settings.precision)}` : '',
      body: `
        <div class="formgrid">
          <div class="formfield"><label for="stName">Nom i cognoms</label><input id="stName" class="field" value="${esc(student?.name || '')}"></div>
          <div class="formfield"><label for="stGroup">Grup</label><select id="stGroup" class="field">${course.groups.map(g =>
            `<option ${g === (student?.group || Store.ui().group) ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
          ${student && term ? `
          <div class="formfield full">
            <label>Actitud · ${esc(term.name)}</label>
            <div class="tag-picker">${course.settings.attitudeLabels.map(l => `
              <label class="tag-option ${l.adjust < 0 ? 'neg' : l.adjust > 0 ? 'pos' : ''}">
                <input type="checkbox" value="${l.id}" ${tags.includes(l.id) ? 'checked' : ''}>
                ${esc(l.text)}${adjustOn && l.adjust ? ` <small>${l.adjust > 0 ? '+' : ''}${Calc.format(l.adjust, 2)}</small>` : ''}
              </label>`).join('')}</div>
            <p class="hint">${adjustOn ? 'L’ajust d’actitud està activat: aquestes etiquetes modifiquen la nota del trimestre.' : 'Les etiquetes no modifiquen la nota (es pot activar a Configuració).'}</p>
          </div>
          <div class="formfield full">
            <label for="stComment">Comentari · ${esc(term.name)}</label>
            <textarea id="stComment" class="field" rows="3" placeholder="${esc(suggestion || 'Comentari per a l’informe')}">${esc(student.comments?.[term.id] || '')}</textarea>
            ${suggestion ? `<button class="linkbtn" type="button" id="useSuggestion">Insereix el suggeriment: «${esc(suggestion)}»</button>` : ''}
          </div>` : ''}
        </div>`,
      actions: [
        ...(student ? [{ label: 'Elimina l’alumne', danger: true, onClick: () => remove(student, onSaved) }] : []),
        { label: 'Cancel·la' },
        { label: student ? 'Desa' : 'Afegeix', primary: true, onClick: () => save(m, student, onSaved) },
      ],
    });
    m.body.querySelector('#useSuggestion')?.addEventListener('click', () => { m.body.querySelector('#stComment').value = suggestion; });
  }

  function save(m, student, onSaved) {
    const course = Store.course(), term = Store.term();
    const name = m.body.querySelector('#stName').value.trim();
    if (!name) { UI.toast('Escriviu el nom de l’alumne.', true); return false; }
    const group = m.body.querySelector('#stGroup').value;
    if (student) {
      student.name = name;
      student.group = group;
      if (term) {
        student.attitude ??= {};
        student.comments ??= {};
        student.attitude[term.id] = [...m.body.querySelectorAll('.tag-picker input:checked')].map(x => x.value);
        student.comments[term.id] = m.body.querySelector('#stComment').value.trim();
      }
    } else {
      course.students.push({ id: Store.uid('stu'), name, group, attitude: {}, comments: {} });
    }
    Store.save();
    UI.toast(student ? 'Canvis desats.' : `${name} s’ha afegit al grup ${group}.`);
    onSaved?.();
  }

  function remove(student, onSaved) {
    if (!confirm(`Voleu eliminar ${student.name} i totes les seves notes? No es pot desfer.`)) return false;
    const course = Store.course();
    course.students = course.students.filter(s => s.id !== student.id);
    delete course.grades[student.id];
    Store.save();
    UI.toast('Alumne eliminat.');
    onSaved?.();
  }

  /** Desa el comentari suggerit als alumnes visibles amb nota i sense comentari. */
  function fillSuggested() {
    const course = Store.course(), term = Store.term();
    if (!term) return;
    let n = 0;
    Store.groupStudents(course, Store.ui().group, App.search).forEach(s => {
      const grade = Calc.termResult(course, s.id, term).grade;
      if (s.comments?.[term.id] || grade == null) return;
      s.comments ??= {};
      s.comments[term.id] = Calc.suggestComment(course.settings.commentBank, grade);
      n++;
    });
    Store.save();
    App.renderPage();
    UI.toast(n ? `S’han desat ${n} comentaris suggerits. Podeu editar-los clicant-hi a sobre.` : 'Tots els alumnes amb nota ja tenen comentari.');
  }

  return { open, fillSuggested };
})();

Pages.students = (() => {
  const esc = UI.esc;

  function rowsHtml(course, term, students) {
    if (!students.length) {
      return `<tr><td colspan="6"><div class="empty"><strong>No hi ha alumnes</strong>${App.search ? 'Cap alumne coincideix amb la cerca.' : 'Afegiu-ne un o importeu una llista.'}</div></td></tr>`;
    }
    return students.map(s => {
      const termRes = term ? Calc.termResult(course, s.id, term) : null;
      const courseRes = Calc.courseResult(course, s.id);
      const tags = course.settings.attitudeLabels.filter(l => (s.attitude?.[term?.id] || []).includes(l.id));
      const comment = s.comments?.[term?.id] || '';
      const suggestion = comment ? '' : Calc.suggestComment(course.settings.commentBank, termRes?.grade);
      const acts = term ? term.sas.flatMap(sa => sa.activities) : [];
      const values = acts.map(a => course.grades[s.id]?.[a.id] ?? '');
      const pending = values.filter(v => v === '').length, np = values.filter(v => v === 'NP').length;
      return `<tr>
        <td><button class="student-link" data-detail="${s.id}"><span class="initial">${UI.initials(s.name)}</span><span>${esc(s.name)}</span></button></td>
        <td>${UI.gradeBadge(termRes, course, { strong: true })}</td>
        <td>${UI.gradeBadge(courseRes, course)}</td>
        <td><div class="tags">${tags.map(l => `<span class="tag ${l.adjust < 0 ? 'neg' : l.adjust > 0 ? 'pos' : ''}">${esc(l.text)}</span>`).join('') || '<span class="muted">—</span>'}</div></td>
        <td class="comment-cell">${comment ? esc(comment) : suggestion ? `<span class="muted suggested" title="Suggeriment automàtic">${esc(suggestion)}</span>` : '<span class="muted">—</span>'}</td>
        <td class="nowrap">${pending ? `<span class="badge warn">${pending} pendents</span>` : ''} ${np ? `<span class="badge risk">${np} NP</span>` : ''}
          <button class="iconbtn small" data-edit="${s.id}" title="Edita" aria-label="Edita ${esc(s.name)}">✎</button></td>
      </tr>`;
    }).join('');
  }

  function render() {
    const course = Store.course(), term = Store.term(), group = Store.ui().group;
    const students = Store.groupStudents(course, group, App.search);
    return `
      <div class="pagehead">
        <div>
          <div class="eyebrow">${esc(course.name)} · Grup ${esc(group)}</div>
          <h1>Alumnes</h1>
          <p class="subline">${Store.groupStudents(course, group).length} alumnes al grup · Cliqueu un nom per veure’n la fitxa i els gràfics.</p>
        </div>
        <div class="actions">
          <button class="btn" data-goto="transfer">Importa una llista</button>
          <button class="btn primary" id="addStudent">＋ Afegeix alumne</button>
        </div>
      </div>
      <section class="panel">
        <div class="panelhead">
          <div><h2>Grup ${esc(group)} · ${esc(term?.name || '')}</h2><p>Els comentaris en gris són suggeriments automàtics segons la nota; encara no s’han desat.</p></div>
          <div class="toolbar">
            <input class="search" id="studentSearch" type="search" value="${esc(App.search)}" placeholder="Cerca per nom…" aria-label="Cerca per nom">
            <button class="btn" id="fillComments">Omple comentaris suggerits</button>
          </div>
        </div>
        <div class="table-scroll">
          <table class="list">
            <thead><tr><th>Alumne</th><th>Nota trimestre</th><th>Nota curs</th><th>Actitud</th><th>Comentari</th><th>Seguiment</th></tr></thead>
            <tbody id="studentRows">${rowsHtml(course, term, students)}</tbody>
          </table>
        </div>
      </section>`;
  }

  function mount(root) {
    const refresh = () => App.renderPage();
    root.querySelector('#addStudent').onclick = () => StudentForm.open(null, refresh);
    root.querySelector('#fillComments').onclick = StudentForm.fillSuggested;
    root.querySelector('#studentSearch').addEventListener('input', e => {
      App.search = e.target.value;
      root.querySelector('#studentRows').innerHTML = rowsHtml(Store.course(), Store.term(), Store.groupStudents(Store.course(), Store.ui().group, App.search));
    });
    root.addEventListener('click', e => {
      const detail = e.target.closest('[data-detail]');
      if (detail) return Detail.open(detail.dataset.detail);
      const edit = e.target.closest('[data-edit]');
      if (edit) return StudentForm.open(edit.dataset.edit, refresh);
      const go = e.target.closest('[data-goto]');
      if (go) App.go(go.dataset.goto);
    });
  }

  return { render, mount };
})();

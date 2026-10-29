/*
 * Fitxa de l'alumne: resum, gràfics de progrés i navegació ràpida
 * entre els alumnes del grup (botons o fletxes ← →).
 */
const Detail = (() => {
  const esc = UI.esc;

  function groupMean(course, students, fn) {
    return Calc.mean(students.map(fn));
  }

  function open(studentId) {
    const course = Store.course(), term = Store.term();
    const student = course.students.find(s => s.id === studentId);
    if (!student) return;
    const group = Store.groupStudents(course, student.group);
    const index = group.findIndex(s => s.id === student.id);

    const termRes = term ? Calc.termResult(course, student.id, term) : null;
    const courseRes = Calc.courseResult(course, student.id);
    const lvl = Calc.level(courseRes.grade, course.settings.thresholds);
    const acts = term ? term.sas.flatMap(sa => sa.activities) : [];
    const values = acts.map(a => course.grades[student.id]?.[a.id] ?? '');
    const tags = course.settings.attitudeLabels.filter(l => (student.attitude?.[term?.id] || []).includes(l.id));
    const comment = student.comments?.[term?.id] || '';
    const suggestion = Calc.suggestComment(course.settings.commentBank, termRes?.grade);

    const chartBox = (id, title, text) => `
      <div class="chart-card">
        <div class="chart-title"><div><h3>${title}</h3><p>${text}</p></div>
          <button class="btn small" data-png="${id}" title="Descarrega com a PNG">PNG ↓</button></div>
        <div class="chart"><canvas id="${id}"></canvas></div>
      </div>`;

    const m = UI.modal({
      title: student.name,
      subtitle: `${esc(course.name)} · Grup ${esc(student.group)} · ${index + 1} de ${group.length}`,
      wide: true,
      headerExtra: `<button class="btn small" id="detailPrint">Imprimeix / PDF</button><button class="btn small" id="detailEdit">Edita</button>`,
      actions: [],
      body: `
        <div class="detail-stats">
          <div class="detail-stat"><small>Nota ${esc(term?.name || 'trimestre')}</small><b>${UI.gradeBadge(termRes, course, { strong: true })}</b></div>
          <div class="detail-stat"><small>Nota del curs (fins ara)</small><b>${UI.gradeBadge(courseRes, course, { strong: true })}</b></div>
          <div class="detail-stat"><small>Nivell del curs</small><b class="level ${lvl ? 'lv-' + lvl.toLowerCase() : ''}">${lvl || '—'}</b></div>
          <div class="detail-stat"><small>Aquest trimestre</small><b class="small">${values.filter(v => v === '').length} pendents · ${values.filter(v => v === 'NP').length} NP</b></div>
        </div>
        <div class="detail-notes">
          <div><small>Actitud</small><div class="tags">${tags.map(l => `<span class="tag ${l.adjust < 0 ? 'neg' : l.adjust > 0 ? 'pos' : ''}">${esc(l.text)}</span>`).join('') || '<span class="muted">Sense etiquetes</span>'}</div></div>
          <div><small>Comentari</small><p>${comment ? esc(comment) : suggestion ? `<span class="muted suggested">Suggeriment: ${esc(suggestion)}</span>` : '<span class="muted">Sense comentari</span>'}</p></div>
        </div>
        <div class="detail-charts">
          ${chartBox('stEvolution', 'Evolució per situació d’aprenentatge', 'Nota de cada SA comparada amb la mitjana del grup')}
          ${chartBox('stProfile', 'Perfil competencial', 'Nota de cada competència (tot el curs) i mitjana del grup')}
          ${chartBox('stActivities', `Activitats · ${esc(term?.name || '')}`, 'Nota de cada activitat i mitjana del grup')}
          ${chartBox('stTerms', 'Notes per trimestre', 'Alumne i mitjana del grup')}
        </div>
        <div class="detail-nav">
          <button class="btn" id="prevStudent" ${group.length < 2 ? 'disabled' : ''}>← Anterior</button>
          <span class="muted">Fletxes ← → per canviar d’alumne</span>
          <button class="btn" id="nextStudent" ${group.length < 2 ? 'disabled' : ''}>Següent →</button>
        </div>`,
      onClose: () => document.removeEventListener('keydown', onKey),
    });

    const goTo = offset => open(group[(index + offset + group.length) % group.length].id);
    function onKey(e) {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
    }
    document.addEventListener('keydown', onKey);
    m.el.querySelector('#prevStudent').onclick = () => goTo(-1);
    m.el.querySelector('#nextStudent').onclick = () => goTo(1);
    m.el.querySelector('#detailPrint').onclick = () => window.print();
    m.el.querySelector('#detailEdit').onclick = () => StudentForm.open(student.id, () => App.renderPage());
    m.el.querySelectorAll('[data-png]').forEach(b => {
      b.onclick = () => Charts.downloadPNG(b.dataset.png, `${UI.slug(student.name)}-${b.dataset.png.slice(2).toLowerCase()}-${UI.today()}.png`);
    });

    // Gràfics
    const timeline = Calc.saTimeline(course, student.id);
    Charts.line('stEvolution', timeline.map(x => course.terms.length > 1 ? `${x.sa.name} (${x.term.name.split(' ')[0]})` : x.sa.name), [
      { label: student.name, data: timeline.map(x => x.result.grade) },
      { label: 'Mitjana del grup', data: timeline.map(x => groupMean(course, group, s => Calc.saResult(course, s.id, x.sa).grade)), dashed: true },
    ]);
    const ces = course.ces.filter(ce => Store.activities(course).some(x => x.activity.ce === ce.id));
    Charts.radar('stProfile', ces.map(ce => ce.code), [
      { label: student.name, data: ces.map(ce => Calc.ceResult(course, student.id, ce.id).grade) },
      { label: 'Mitjana del grup', data: ces.map(ce => groupMean(course, group, s => Calc.ceResult(course, s.id, ce.id).grade)), dashed: true },
    ]);
    const numOrNull = n => (n === 'EX' ? null : n);
    Charts.bar('stActivities', acts.map(a => a.name), [
      { label: student.name, data: acts.map(a => numOrNull(Calc.gradeOf(course, student.id, a))) },
      { label: 'Mitjana del grup', data: acts.map(a => groupMean(course, group, s => numOrNull(Calc.gradeOf(course, s.id, a)))) },
    ], { horizontal: acts.length > 6 });
    Charts.bar('stTerms', course.terms.map(t => t.name), [
      { label: student.name, data: course.terms.map(t => Calc.termResult(course, student.id, t).grade) },
      { label: 'Mitjana del grup', data: course.terms.map(t => groupMean(course, group, s => Calc.termResult(course, s.id, t).grade)) },
    ]);
  }

  return { open };
})();

/*
 * Gràfics de classe: indicadors, distribució de notes, nivells per
 * competència, evolució, comparació entre grups i alumnes en risc.
 */
Pages.analytics = (() => {
  const esc = UI.esc;
  const CHARTS = [
    ['chHist', 'Distribució de notes', 'Nombre d’alumnes per franja de nota del trimestre'],
    ['chLevels', 'Nivells per competència', 'Alumnes a cada nivell (AE, AN, AS, NA) aquest trimestre'],
    ['chTrend', 'Evolució del grup', 'Mitjana de cada SA al llarg del curs, comparada amb tots els grups'],
    ['chGroups', 'Comparació entre grups', 'Mitjana de la nota del trimestre a cada grup'],
    ['chActivities', 'Mitjana per activitat', 'Ajuda a detectar quina activitat ha anat pitjor'],
  ];

  /** Alumnes que necessiten seguiment, amb els motius. */
  function riskList(course, term, students) {
    return students.map(s => {
      const grade = term ? Calc.termResult(course, s.id, term).grade : null;
      const reasons = [];
      if (grade != null && grade < course.settings.pass) reasons.push('Nota per sota de ' + Calc.format(course.settings.pass, 0));
      if (Calc.hasDrop(course, s.id)) reasons.push('Baixada de més d’1 punt entre SA');
      const np = term ? term.sas.flatMap(sa => sa.activities).filter(a => course.grades[s.id]?.[a.id] === 'NP').length : 0;
      if (np >= 2) reasons.push(`${np} activitats no presentades`);
      return { s, grade, reasons };
    }).filter(x => x.reasons.length).sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99));
  }

  function render() {
    const course = Store.course(), term = Store.term(), group = Store.ui().group;
    const students = Store.groupStudents(course, group);
    const grades = term ? students.map(s => Calc.termResult(course, s.id, term).grade).filter(g => g != null) : [];
    const avg = Calc.mean(grades);
    const passed = grades.filter(g => g >= course.settings.pass).length;
    const risk = riskList(course, term, students);
    const dist = Calc.LEVELS.map(lv => [lv, grades.filter(g => Calc.level(g, course.settings.thresholds) === lv).length]);

    return `
      <div class="pagehead">
        <div>
          <div class="eyebrow">${esc(course.name)} · Grup ${esc(group)}</div>
          <h1>Gràfics de classe</h1>
          <p class="subline">${esc(term?.name || '')} · ${students.length} alumnes · Passeu el ratolí per sobre dels gràfics per veure els valors exactes.</p>
        </div>
        <div class="actions">
          <button class="btn" id="printAnalytics">Imprimeix / PDF</button>
          <button class="btn primary" id="downloadAll">Descarrega tots els gràfics</button>
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="label">Mitjana del grup</div><b>${Calc.format(avg, course.settings.precision)}<em> / 10</em></b></div>
        <div class="kpi"><div class="label">Aprovats</div><b>${grades.length ? Math.round(passed / grades.length * 100) + '%' : '—'}<em> ${passed} de ${grades.length}</em></b></div>
        <div class="kpi ${risk.length ? 'warn' : ''}"><div class="label">Necessiten seguiment</div><b>${risk.length}<em> ${risk.length === 1 ? 'alumne' : 'alumnes'}</em></b></div>
        <div class="kpi"><div class="label">Nivells del grup</div><div class="level-strip">${dist.map(([lv, n]) =>
          `<span class="lv-${lv.toLowerCase()}" title="${lv}: ${n} alumnes">${lv} <b>${n}</b></span>`).join('')}</div></div>
      </div>
      <div class="analytics-grid">
        ${CHARTS.map(([id, title, text], i) => `
          <section class="panel chart-card ${i === CHARTS.length - 1 ? 'span-2' : ''}">
            <div class="chart-title"><div><h3>${title}</h3><p>${text}</p></div>
              <button class="btn small" data-png="${id}" title="Descarrega com a PNG">PNG ↓</button></div>
            <div class="chart ${i === CHARTS.length - 1 ? 'tall' : ''}"><canvas id="${id}"></canvas></div>
          </section>`).join('')}
      </div>
      <section class="panel" style="margin-top:16px">
        <div class="panelhead"><div><h2>Alumnes que necessiten seguiment</h2>
          <p>Nota del trimestre per sota de l’aprovat, baixada de més d’un punt entre SA consecutives o dues o més activitats no presentades.</p></div></div>
        <div class="table-scroll"><table class="list">
          <thead><tr><th>Alumne</th><th>Nota trimestre</th><th>Motius</th></tr></thead>
          <tbody>${risk.length ? risk.map(x => `<tr>
            <td><button class="student-link" data-detail="${x.s.id}"><span class="initial">${UI.initials(x.s.name)}</span><span>${esc(x.s.name)}</span></button></td>
            <td>${term ? UI.gradeBadge(Calc.termResult(course, x.s.id, term), course, { strong: true }) : '—'}</td>
            <td><div class="tags">${x.reasons.map(r => `<span class="tag neg">${esc(r)}</span>`).join('')}</div></td></tr>`).join('')
            : `<tr><td colspan="3"><div class="empty"><strong>Cap alerta</strong>Cap alumne del grup compleix els criteris de risc.</div></td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  function draw() {
    const course = Store.course(), term = Store.term(), group = Store.ui().group;
    if (!term) return;
    const students = Store.groupStudents(course, group);
    const termGrade = s => Calc.termResult(course, s.id, term).grade;

    // Distribució
    const bins = [[0, 5, '0–5'], [5, 6, '5–6'], [6, 7, '6–7'], [7, 8, '7–8'], [8, 9, '8–9'], [9, 10.01, '9–10']];
    const grades = students.map(termGrade).filter(g => g != null);
    const bandColors = ['--b-low-fg', '--b-mid-fg', '--b-ok-fg', '--b-good-fg', '--b-good-fg', '--b-top-fg']
      .map(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim());
    Charts.bar('chHist', bins.map(b => b[2]), [{ label: 'Alumnes', data: bins.map(([lo, hi]) => grades.filter(g => g >= lo && g < hi).length), colors: bandColors }], { scale10: false, count: true });

    // Nivells per competència
    const ces = course.ces.filter(ce => term.sas.some(sa => sa.activities.some(a => a.ce === ce.id)));
    const levelData = { AE: [], AN: [], AS: [], NA: [] };
    ces.forEach(ce => {
      const counts = { AE: 0, AN: 0, AS: 0, NA: 0 };
      students.forEach(s => {
        const lv = Calc.level(Calc.ceResult(course, s.id, ce.id, term.id).grade, course.settings.thresholds);
        if (lv) counts[lv]++;
      });
      Calc.LEVELS.forEach(lv => levelData[lv].push(counts[lv]));
    });
    Charts.levels('chLevels', ces.map(ce => ce.code), levelData);

    // Evolució al llarg del curs
    const sas = course.terms.flatMap(t => t.sas.filter(sa => sa.activities.length).map(sa => ({ t, sa })));
    const allStudents = course.students;
    Charts.line('chTrend', sas.map(x => course.terms.length > 1 ? `${x.sa.name} (${x.t.name.split(' ')[0]})` : x.sa.name), [
      { label: `Grup ${group}`, data: sas.map(x => Calc.mean(students.map(s => Calc.saResult(course, s.id, x.sa).grade))) },
      ...(course.groups.length > 1 ? [{ label: 'Tots els grups', data: sas.map(x => Calc.mean(allStudents.map(s => Calc.saResult(course, s.id, x.sa).grade))), dashed: true }] : []),
    ]);

    // Comparació entre grups
    const c = Charts.colors();
    Charts.bar('chGroups', course.groups.map(g => `Grup ${g}`), [{
      label: 'Mitjana',
      data: course.groups.map(g => Calc.mean(Store.groupStudents(course, g).map(termGrade))),
      colors: course.groups.map(g => (g === group ? c.series[0] : c.series[3])),
    }]);

    // Mitjana per activitat
    const acts = term.sas.flatMap(sa => sa.activities);
    Charts.bar('chActivities', acts.map(a => a.name), [{
      label: 'Mitjana',
      data: acts.map(a => Calc.mean(students.map(s => { const n = Calc.gradeOf(course, s.id, a); return n === 'EX' ? null : n; }))),
    }], { horizontal: acts.length > 8 });
  }

  function mount(root) {
    draw();
    root.querySelector('#printAnalytics').onclick = () => window.print();
    const fileName = id => `${UI.slug(Store.course().name)}-grup-${UI.slug(Store.ui().group)}-${id.slice(2).toLowerCase()}-${UI.today()}.png`;
    root.querySelector('#downloadAll').onclick = () => {
      CHARTS.forEach(([id], i) => setTimeout(() => Charts.downloadPNG(id, fileName(id)), i * 400));
    };
    root.addEventListener('click', e => {
      const png = e.target.closest('[data-png]');
      if (png) return Charts.downloadPNG(png.dataset.png, fileName(png.dataset.png));
      const detail = e.target.closest('[data-detail]');
      if (detail) Detail.open(detail.dataset.detail);
    });
  }

  return { render, mount };
})();

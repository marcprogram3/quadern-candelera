/*
 * Importar i exportar: còpia de seguretat (JSON), Excel complet, resum per
 * passar a Esfer@ i importació de llistes o notes des d'Excel o CSV.
 */
const Transfer = (() => {
  const esc = UI.esc;
  const hasXLSX = () => typeof window.XLSX !== 'undefined';
  const r = (n, course) => (n == null ? '' : Number(n.toFixed(course.settings.precision)));

  // ---- Còpia de seguretat ----
  function exportJSON() {
    const state = Store.get();
    state.ui.lastBackup = new Date().toISOString();
    Store.save();
    UI.download(`quadern-notes-copia-${UI.today()}.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    UI.toast('Còpia de seguretat descarregada. Guardeu-la en un lloc segur.');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { data = null; }
      if (!Store.isValid(data)) return UI.toast('Aquest fitxer no és una còpia de seguretat vàlida. No s’ha canviat res.', true);
      if (!confirm('La còpia substituirà totes les vostres dades actuals (matèries, alumnes i notes). Voleu continuar?')) return;
      Store.replace(data);
      App.render();
      UI.toast('Còpia restaurada.');
    };
    reader.readAsText(file);
  }

  // ---- Exportació ----
  function termSheet(course, term, students) {
    const sas = term.sas.filter(sa => sa.activities.length);
    const acts = sas.flatMap(sa => sa.activities);
    const ces = course.ces.filter(ce => acts.some(a => a.ce === ce.id));
    const header = ['Alumne', 'Grup',
      ...sas.flatMap(sa => {
        const shares = Calc.shares(sa.activities);
        return sa.activities.map((a, i) => `${a.name} (${Store.ceCode(course, a.ce)} · ${Math.round(shares[i])}%)`);
      }),
      ...sas.map(sa => `Nota ${sa.name}`), 'Nota trimestre', ...ces.map(ce => ce.code), 'Actitud', 'Comentari'];
    const rows = students.map(s => {
      const tags = course.settings.attitudeLabels.filter(l => (s.attitude?.[term.id] || []).includes(l.id)).map(l => l.text);
      return [s.name, s.group,
        ...acts.map(a => course.grades[s.id]?.[a.id] ?? ''),
        ...sas.map(sa => r(Calc.saResult(course, s.id, sa).grade, course)),
        r(Calc.termResult(course, s.id, term).grade, course),
        ...ces.map(ce => r(Calc.ceResult(course, s.id, ce.id, term.id).grade, course)),
        tags.join(', '), s.comments?.[term.id] || ''];
    });
    return [header, ...rows];
  }

  function summarySheet(course, students) {
    const th = course.settings.thresholds;
    return [
      ['Alumne', 'Grup', ...course.terms.map(t => t.name), 'Nota del curs', 'Nivell', 'Estat'],
      ...students.map(s => {
        const res = Calc.courseResult(course, s.id);
        return [s.name, s.group, ...course.terms.map(t => r(Calc.termResult(course, s.id, t).grade, course)),
          r(res.grade, course), Calc.level(res.grade, th) || '', res.provisional ? 'Provisional' : 'Definitiva'];
      }),
    ];
  }

  function esferaSheet(course, term, students) {
    const th = course.settings.thresholds;
    const ces = course.ces.filter(ce => term.sas.some(sa => sa.activities.some(a => a.ce === ce.id)));
    return [
      ['Alumne', 'Grup', `Nota ${term.name}`, 'Nivell', ...ces.map(ce => `${ce.code} (nivell)`), 'Comentari'],
      ...students.map(s => {
        const g = Calc.termResult(course, s.id, term).grade;
        return [s.name, s.group, r(g, course), Calc.level(g, th) || '',
          ...ces.map(ce => Calc.level(Calc.ceResult(course, s.id, ce.id, term.id).grade, th) || ''),
          s.comments?.[term.id] || Calc.suggestComment(course.settings.commentBank, g)];
      }),
    ];
  }

  function addSheet(wb, name, rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map((h, i) => ({ wch: i === 0 ? 24 : Math.min(40, Math.max(8, String(h).length + 2)) }));
    // Els noms de full no poden passar de 31 caràcters ni contenir alguns símbols.
    XLSX.utils.book_append_sheet(wb, ws, name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31));
  }

  /** Excel amb un full per trimestre i un resum del curs, per al grup seleccionat. */
  function exportWorkbook() {
    const course = Store.course(), group = Store.ui().group;
    const students = Store.groupStudents(course, group);
    const base = `${UI.slug(course.name)}-grup-${UI.slug(group)}-${UI.today()}`;
    if (!hasXLSX()) {
      const term = Store.term();
      UI.downloadCSV(`${base}.csv`, termSheet(course, term, students));
      return UI.toast('No s’ha pogut carregar la biblioteca d’Excel (cal connexió). S’ha exportat un CSV del trimestre actual.', true);
    }
    const wb = XLSX.utils.book_new();
    course.terms.filter(t => t.sas.some(sa => sa.activities.length)).forEach(t => addSheet(wb, t.name, termSheet(course, t, students)));
    addSheet(wb, 'Resum del curs', summarySheet(course, students));
    XLSX.writeFile(wb, `${base}.xlsx`);
    UI.toast('Excel exportat.');
  }

  function exportEsfera(asCSV = false) {
    const course = Store.course(), term = Store.term(), group = Store.ui().group;
    if (!term) return;
    const rows = esferaSheet(course, term, Store.groupStudents(course, group));
    const base = `esfera-${UI.slug(course.name)}-grup-${UI.slug(group)}-${UI.slug(term.name)}`;
    if (asCSV || !hasXLSX()) {
      UI.downloadCSV(`${base}.csv`, rows);
    } else {
      const wb = XLSX.utils.book_new();
      addSheet(wb, `Esfera ${term.name}`, rows);
      XLSX.writeFile(wb, `${base}.xlsx`);
    }
    UI.toast('Resum per a Esfer@ exportat.');
  }

  // ---- Importació des d'Excel o CSV ----
  function parseCSV(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/);
    const first = lines[0] || '';
    const delimiter = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    return lines.filter(l => l.trim()).map(line => {
      const out = []; let cur = '', quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = !quoted;
        else if (ch === delimiter && !quoted) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    });
  }

  function readSpreadsheet(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    if (ext === 'csv' || ext === 'txt') {
      reader.onload = () => openMapping([{ name: file.name, rows: parseCSV(String(reader.result)) }]);
      reader.readAsText(file);
      return;
    }
    if (!hasXLSX()) return UI.toast('Per llegir fitxers Excel cal connexió a internet. També podeu desar el full com a CSV.', true);
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        openMapping(wb.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true }) })));
      } catch (e) {
        UI.toast('No s’ha pogut llegir aquest fitxer d’Excel.', true);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const isText = v => typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v.replace(',', '.')));

  /** Primera fila que sembla una capçalera (com a mínim dues cel·les amb text). */
  function guessHeaderRow(rows) {
    const i = rows.findIndex(row => row.filter(isText).length >= 2);
    return i < 0 ? 0 : i;
  }

  /**
   * Primera fila de dades: la primera després de la capçalera amb la columna
   * del nom plena. Així se salten les files de criteri i pes (CE4, 0,1…).
   */
  function guessDataRow(rows, header) {
    const head = rows[header] || [];
    let nameCol = head.findIndex(h => /alumn|nom|cognom/.test(Store.normalizeName(h)));
    if (nameCol < 0) nameCol = head.findIndex(isText);
    if (nameCol < 0) return header + 1;
    const i = rows.findIndex((row, idx) => idx > header && isText(row[nameCol]));
    return i < 0 ? header + 1 : i;
  }

  function openMapping(sheets) {
    const course = Store.course();
    const acts = Store.activities(course);
    const firstHeader = guessHeaderRow(sheets[0].rows);
    const st = { sheet: 0, header: firstHeader, data: guessDataRow(sheets[0].rows, firstHeader), map: {} };

    const width = rows => rows.reduce((w, row) => Math.max(w, row.length), 0);
    const headers = () => {
      const rows = sheets[st.sheet].rows;
      return Array.from({ length: width(rows) }, (_, c) => {
        const parts = rows.slice(st.header, Math.max(st.header + 1, st.data)).map(row => String(row[c] ?? '').trim()).filter(Boolean);
        return parts.join(' · ') || `Columna ${c + 1}`;
      });
    };

    function autoMap() {
      st.map = {};
      const used = new Set();
      headers().forEach((h, c) => {
        const n = Store.normalizeName(h);
        let target = '';
        if (/alumn|nom|cognom/.test(n) && !used.has('name')) target = 'name';
        else if (/^grup/.test(n) && !used.has('group')) target = 'group';
        else {
          const match = acts.find(x => !used.has(x.activity.id) && n.startsWith(Store.normalizeName(x.activity.name)));
          if (match) target = match.activity.id;
        }
        if (target) { st.map[c] = target; used.add(target); }
      });
    }

    function body() {
      const rows = sheets[st.sheet].rows;
      const hs = headers();
      const sample = rows.slice(st.data, st.data + 2);
      const options = sel => `
        <option value="">— No importar —</option>
        <option value="name" ${sel === 'name' ? 'selected' : ''}>Nom de l’alumne</option>
        <option value="group" ${sel === 'group' ? 'selected' : ''}>Grup</option>
        ${course.terms.map(t => `<optgroup label="${esc(t.name)}">${t.sas.flatMap(sa => sa.activities.map(a =>
          `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(sa.name)} · ${esc(a.name)}</option>`)).join('')}</optgroup>`).join('')}`;
      return `
        <div class="field-row import-controls">
          ${sheets.length > 1 ? `<label class="inline">Full <select class="field" id="imSheet">${sheets.map((s, i) => `<option value="${i}" ${i === st.sheet ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
          <label class="inline">Capçalera a la fila <input class="field xs" type="number" min="1" id="imHeader" value="${st.header + 1}"></label>
          <label class="inline">Les dades comencen a la fila <input class="field xs" type="number" min="1" id="imData" value="${st.data + 1}"></label>
        </div>
        <p class="hint">Si la capçalera ocupa diverses files (nom, criteri i pes), indiqueu la primera i on comencen les dades: s’ajuntaran. Les caselles buides no esborren notes existents.</p>
        <div class="table-scroll"><table class="list map-table">
          <thead><tr><th>Columna del fitxer</th><th>Exemple</th><th>Importa com a</th></tr></thead>
          <tbody>${hs.map((h, c) => `<tr>
            <td>${esc(h)}</td>
            <td class="muted">${sample.map(row => esc(row[c] ?? '')).filter(Boolean).join(' · ') || '—'}</td>
            <td><select class="field" data-col="${c}">${options(st.map[c] || '')}</select></td></tr>`).join('')}</tbody>
        </table></div>`;
    }

    const m = UI.modal({
      title: 'Importa des d’Excel o CSV',
      subtitle: `Dades cap a «${esc(course.name)}». Alumnes nous: grup de la columna «Grup» o, si no n’hi ha, el grup ${esc(Store.ui().group)}.`,
      wide: true,
      body: '',
      actions: [{ label: 'Cancel·la' }, { label: 'Importa', primary: true, onClick: () => runImport(sheets[st.sheet].rows, st) }],
    });

    function redraw() { m.body.innerHTML = body(); }
    m.body.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'imSheet') {
        st.sheet = Number(el.value);
        st.header = guessHeaderRow(sheets[st.sheet].rows);
        st.data = guessDataRow(sheets[st.sheet].rows, st.header);
        autoMap();
      }
      else if (el.id === 'imHeader') { st.header = Math.max(0, Number(el.value) - 1); st.data = guessDataRow(sheets[st.sheet].rows, st.header); autoMap(); }
      else if (el.id === 'imData') { st.data = Math.max(st.header + 1, Number(el.value) - 1); autoMap(); }
      else if (el.dataset.col) {
        const c = Number(el.dataset.col);
        if (el.value) {
          // Cada destinació només es pot assignar a una columna.
          Object.keys(st.map).forEach(k => { if (st.map[k] === el.value) delete st.map[k]; });
          st.map[c] = el.value;
        } else delete st.map[c];
      }
      redraw();
    });
    autoMap();
    redraw();
  }

  function runImport(rows, st) {
    const course = Store.course();
    const entries = Object.entries(st.map).map(([c, target]) => [Number(c), target]);
    const nameCol = entries.find(([, t]) => t === 'name')?.[0];
    if (nameCol == null) { UI.toast('Indiqueu quina columna conté el nom de l’alumne.', true); return false; }
    const groupCol = entries.find(([, t]) => t === 'group')?.[0];
    const actCols = entries.filter(([, t]) => t !== 'name' && t !== 'group');

    let created = 0, updated = 0, grades = 0, invalid = 0;
    const newGroups = new Set();
    rows.slice(st.data).forEach(row => {
      const name = String(row[nameCol] ?? '').trim();
      if (!name) return;
      const group = groupCol != null ? String(row[groupCol] ?? '').trim() : '';
      let student = course.students.find(s => Store.normalizeName(s.name) === Store.normalizeName(name));
      if (!student) {
        const g = group || Store.ui().group;
        if (!course.groups.includes(g)) { course.groups.push(g); newGroups.add(g); }
        student = { id: Store.uid('stu'), name, group: g, attitude: {}, comments: {} };
        course.students.push(student);
        created++;
      } else updated++;
      actCols.forEach(([c, actId]) => {
        const raw = row[c];
        if (raw === '' || raw == null) return;
        const act = Store.findActivity(course, actId);
        const parsed = Calc.parseInput(String(raw), act.type);
        if (parsed.ok) { Store.setGrade(course, student.id, actId, parsed.value); grades++; }
        else invalid++;
      });
    });
    Store.save();
    App.render();
    const parts = [`${created} alumnes nous`, `${updated} actualitzats`, `${grades} notes importades`];
    if (invalid) parts.push(`${invalid} notes no vàlides descartades`);
    if (newGroups.size) parts.push(`grups creats: ${[...newGroups].join(', ')}`);
    UI.toast(parts.join(' · ') + '.', invalid > 0);
  }

  return { exportJSON, importJSON, exportWorkbook, exportEsfera, readSpreadsheet };
})();

Pages.transfer = (() => {
  const esc = UI.esc;

  function render() {
    const course = Store.course(), term = Store.term(), group = Store.ui().group;
    return `
      <div class="pagehead">
        <div>
          <div class="eyebrow">${esc(course.name)} · Grup ${esc(group)}</div>
          <h1>Importar / Exportar</h1>
          <p class="subline">Els fitxers que importeu o exporteu es processen dins del navegador.</p>
        </div>
      </div>
      <div class="notice">Les notes es desen soles al servidor del centre i hi podeu accedir des de qualsevol ordinador. Tot i així, convé descarregar de tant en tant una còpia pròpia.</div>
      <div class="cards">
        <section class="panel card">
          <h3>Còpia de seguretat</h3>
          <p>Totes les matèries, alumnes, notes i configuració en un sol fitxer. <b>El fitxer no està xifrat:</b> guardeu-lo en un lloc segur (per exemple, el Drive de l’institut).</p>
          <div class="actions">
            <button class="btn primary" id="backup">Descarrega la còpia</button>
            <label class="btn" for="restoreFile">Restaura una còpia</label>
            <input id="restoreFile" type="file" accept=".json,application/json" hidden>
          </div>
        </section>
        <section class="panel card">
          <h3>Exportar notes</h3>
          <p>Excel del grup ${esc(group)} amb un full per trimestre i el resum del curs.</p>
          <div class="actions"><button class="btn primary" id="exportXlsx">Excel complet</button></div>
          <h3 class="mt">Resum per a Esfer@</h3>
          <p>Nota de ${esc(term?.name || 'el trimestre')}, nivell, nivells per competència i comentari, per passar-ho fàcilment.</p>
          <div class="actions"><button class="btn" id="esferaXlsx">Excel</button><button class="btn" id="esferaCsv">CSV</button></div>
        </section>
        <section class="panel card">
          <h3>Importar des d’Excel o CSV</h3>
          <p>Una llista d’alumnes o un full de notes. Després podreu triar a quina activitat va cada columna.</p>
          <div class="actions">
            <label class="btn primary" for="sheetFile">Tria un fitxer…</label>
            <input id="sheetFile" type="file" accept=".xlsx,.xls,.ods,.csv,.txt" hidden>
          </div>
        </section>
        <section class="panel card">
          <h3>Dades d’exemple</h3>
          <p>Torna a carregar les dades fictícies de demostració. S’esborrarà tot el que hi hagi ara.</p>
          <div class="actions"><button class="btn danger" id="restoreDemo">Restaura les dades d’exemple</button></div>
        </section>
      </div>`;
  }

  function mount(root) {
    root.querySelector('#backup').onclick = () => { Transfer.exportJSON(); App.render(); };
    root.querySelector('#restoreFile').onchange = e => { if (e.target.files[0]) Transfer.importJSON(e.target.files[0]); e.target.value = ''; };
    root.querySelector('#exportXlsx').onclick = Transfer.exportWorkbook;
    root.querySelector('#esferaXlsx').onclick = () => Transfer.exportEsfera(false);
    root.querySelector('#esferaCsv').onclick = () => Transfer.exportEsfera(true);
    root.querySelector('#sheetFile').onchange = e => { if (e.target.files[0]) Transfer.readSpreadsheet(e.target.files[0]); e.target.value = ''; };
    root.querySelector('#restoreDemo').onclick = () => {
      if (!confirm('S’esborraran totes les dades actuals i es carregaran les d’exemple. Voleu continuar? (Feu abans una còpia si en necessiteu.)')) return;
      Store.replace(Seed.create());
      App.search = '';
      App.render();
      UI.toast('Dades d’exemple restaurades.');
    };
  }

  return { render, mount };
})();

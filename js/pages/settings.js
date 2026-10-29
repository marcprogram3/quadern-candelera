/*
 * Configuració de la matèria seleccionada: grups, competències, trimestres,
 * situacions d'aprenentatge i activitats, qualificació, actitud i comentaris.
 *
 * Tots els camps es desen en sortir-ne. Els pesos són relatius: no cal que
 * sumin 100, l'app mostra al costat el percentatge efectiu.
 */
Pages.settings = (() => {
  const esc = UI.esc;
  const pct = n => `${Math.round(n)}%`;

  function section(title, text, body, extra = '') {
    return `<section class="panel ${extra}"><div class="panelhead"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}</div></div><div class="setting">${body}</div></section>`;
  }

  function structureHtml(course, term) {
    if (!term) return '<p class="muted">Afegiu primer un trimestre.</p>';
    const saShares = Calc.shares(term.sas);
    const ceOptions = sel => course.ces.map(ce => `<option value="${ce.id}" ${ce.id === sel ? 'selected' : ''}>${esc(ce.code)}</option>`).join('');
    return term.sas.map((sa, i) => {
      const shares = Calc.shares(sa.activities);
      return `
        <div class="sa-card">
          <div class="sa-card-head">
            <input class="field sa-name" data-field="saName" data-id="${sa.id}" data-key="saName:${sa.id}" value="${esc(sa.name)}" aria-label="Nom de la SA">
            <label class="inline">Pes <input class="field xs" type="number" min="0" step="any" data-field="saWeight" data-id="${sa.id}" data-key="saWeight:${sa.id}" value="${sa.weight}"></label>
            <span class="share" title="Percentatge efectiu dins el trimestre">${pct(saShares[i])} del trimestre</span>
            <button class="btn small danger" data-action="deleteSa" data-id="${sa.id}">Elimina la SA</button>
          </div>
          <div class="table-scroll">
            <table class="mini">
              <thead><tr><th>Activitat</th><th>Competència</th><th>Pes</th><th>% a la SA</th><th>Tipus</th><th></th></tr></thead>
              <tbody>${sa.activities.map((a, j) => `
                <tr>
                  <td><input class="field" data-field="actName" data-id="${a.id}" data-key="actName:${a.id}" value="${esc(a.name)}" aria-label="Nom de l’activitat"></td>
                  <td><select class="field" data-field="actCe" data-id="${a.id}" data-key="actCe:${a.id}" aria-label="Competència">${ceOptions(a.ce)}</select></td>
                  <td><input class="field xs" type="number" min="0" step="any" data-field="actWeight" data-id="${a.id}" data-key="actWeight:${a.id}" value="${a.weight}" aria-label="Pes"></td>
                  <td class="share">${pct(shares[j])}</td>
                  <td><select class="field" data-field="actType" data-id="${a.id}" data-key="actType:${a.id}" aria-label="Tipus">
                    <option value="qual" ${a.type === 'qual' ? 'selected' : ''}>Qualitativa (AE–NA)</option>
                    <option value="num" ${a.type === 'num' ? 'selected' : ''}>Numèrica (0–10)</option></select></td>
                  <td><button class="iconbtn small danger" data-action="deleteAct" data-id="${a.id}" title="Elimina l’activitat" aria-label="Elimina ${esc(a.name)}">×</button></td>
                </tr>`).join('') || '<tr><td colspan="6" class="muted">Encara no hi ha activitats.</td></tr>'}
              </tbody>
            </table>
          </div>
          <button class="btn small" data-action="addAct" data-id="${sa.id}">＋ Activitat</button>
        </div>`;
    }).join('') + `<button class="btn" data-action="addSa">＋ Situació d’aprenentatge</button>`;
  }

  function render() {
    const course = Store.course(), term = Store.term(), s = course.settings;
    const termShares = Calc.shares(course.terms);
    return `
      <div class="pagehead">
        <div>
          <div class="eyebrow">${esc(course.name)}</div>
          <h1>Configuració</h1>
          <p class="subline">Els canvis es desen sols en sortir de cada camp. Els pesos són relatius: l’app calcula el percentatge efectiu.</p>
        </div>
      </div>
      <div class="settings-grid">
        ${section('Matèria i curs', 'Cada matèria té els seus alumnes, activitats i notes.', `
          <div class="formfield"><label for="courseName">Nom</label>
            <input id="courseName" class="field" data-field="courseName" data-key="courseName" value="${esc(course.name)}"></div>
          <div class="row-actions">
            <button class="btn" data-action="newCourse">＋ Nova matèria</button>
            <button class="btn danger" data-action="deleteCourse">Elimina aquesta matèria</button>
          </div>`)}

        ${section('Grups', '', `
          ${course.groups.map(g => `
            <div class="edit-row">
              <input class="field" data-field="groupName" data-id="${esc(g)}" data-key="group:${esc(g)}" value="${esc(g)}" aria-label="Nom del grup">
              <span class="muted">${course.students.filter(st => st.group === g).length} alumnes</span>
              <button class="iconbtn small danger" data-action="deleteGroup" data-id="${esc(g)}" title="Elimina el grup" aria-label="Elimina el grup ${esc(g)}">×</button>
            </div>`).join('')}
          <button class="btn small" data-action="addGroup">＋ Grup</button>`)}

        ${section('Competències específiques', 'El codi és el que es mostra a la graella; la descripció és opcional.', `
          ${course.ces.map(ce => `
            <div class="edit-row">
              <input class="field xs" data-field="ceCode" data-id="${ce.id}" data-key="ceCode:${ce.id}" value="${esc(ce.code)}" aria-label="Codi">
              <input class="field" data-field="ceName" data-id="${ce.id}" data-key="ceName:${ce.id}" value="${esc(ce.name)}" placeholder="Descripció (opcional)" aria-label="Descripció">
              <button class="iconbtn small danger" data-action="deleteCe" data-id="${ce.id}" title="Elimina" aria-label="Elimina ${esc(ce.code)}">×</button>
            </div>`).join('')}
          <button class="btn small" data-action="addCe">＋ Competència</button>`)}

        ${section('Trimestres', 'Pes de cada trimestre a la nota final del curs.', `
          ${course.terms.map((t, i) => `
            <div class="edit-row">
              <input class="field" data-field="termName" data-id="${t.id}" data-key="termName:${t.id}" value="${esc(t.name)}" aria-label="Nom del trimestre">
              <label class="inline">Pes <input class="field xs" type="number" min="0" step="any" data-field="termWeight" data-id="${t.id}" data-key="termWeight:${t.id}" value="${t.weight}"></label>
              <span class="share">${pct(termShares[i])}</span>
              <button class="iconbtn small danger" data-action="deleteTerm" data-id="${t.id}" title="Elimina" aria-label="Elimina ${esc(t.name)}">×</button>
            </div>`).join('')}
          <button class="btn small" data-action="addTerm">＋ Trimestre</button>`)}

        ${section(`Situacions d’aprenentatge i activitats · ${esc(term?.name || '')}`, 'Canvieu de trimestre amb el selector de dalt.', structureHtml(course, term), 'span-2')}

        ${section('Qualificació', '', `
          <div class="formfield"><label>Conversió dels nivells a nota</label>
            <div class="field-row">${Calc.LEVELS.map(lv => `<label class="inline">${lv}
              <input class="field xs" type="number" min="0" max="10" step="0.1" data-field="conv" data-id="${lv}" data-key="conv:${lv}" value="${s.conversions[lv]}"></label>`).join('')}</div>
            <p class="hint">Valor que s’utilitza per calcular les mitjanes quan una activitat es qualifica amb AE, AN, AS o NA.</p></div>
          <div class="formfield"><label>Llindars dels nivells</label>
            <div class="field-row">${['AE', 'AN', 'AS'].map(lv => `<label class="inline">${lv} a partir de
              <input class="field xs" type="number" min="0" max="10" step="0.1" data-field="thr" data-id="${lv}" data-key="thr:${lv}" value="${s.thresholds[lv]}"></label>`).join('')}</div>
            <p class="hint">Per convertir una nota numèrica en nivell (fitxa, gràfics i exportació). Per sota d’AS és NA.</p></div>
          <div class="field-row">
            <label class="inline">Aprovat a partir de <input class="field xs" type="number" min="0" max="10" step="0.5" data-field="pass" data-key="pass" value="${s.pass}"></label>
            <label class="inline">Decimals <select class="field xs" data-field="precision" data-key="precision">${[0, 1, 2].map(n => `<option ${n === s.precision ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>`)}

        ${section('Actitud', 'Etiquetes per a cada alumne i trimestre. Opcionalment poden ajustar la nota del trimestre.', `
          <label class="check"><input type="checkbox" data-field="attitudeAdjust" ${s.attitudeAdjust ? 'checked' : ''}> Aplica l’ajust a la nota del trimestre</label>
          ${s.attitudeLabels.map(l => `
            <div class="edit-row">
              <input class="field" data-field="attText" data-id="${l.id}" data-key="attText:${l.id}" value="${esc(l.text)}" aria-label="Etiqueta">
              <label class="inline">Ajust <input class="field xs" type="number" step="0.05" data-field="attAdjust" data-id="${l.id}" data-key="attAdjust:${l.id}" value="${l.adjust}"></label>
              <button class="iconbtn small danger" data-action="deleteAtt" data-id="${l.id}" title="Elimina" aria-label="Elimina ${esc(l.text)}">×</button>
            </div>`).join('')}
          <button class="btn small" data-action="addAtt">＋ Etiqueta</button>`)}

        ${section('Banc de comentaris', 'Es proposa el comentari amb la nota mínima més alta que l’alumne superi.', `
          ${s.commentBank.map((c, i) => `
            <div class="edit-row">
              <label class="inline">≥ <input class="field xs" type="number" min="0" max="10" step="0.5" data-field="cbMin" data-id="${i}" data-key="cbMin:${i}" value="${c.min}"></label>
              <input class="field" data-field="cbText" data-id="${i}" data-key="cbText:${i}" value="${esc(c.text)}" aria-label="Comentari">
              <button class="iconbtn small danger" data-action="deleteCb" data-id="${i}" title="Elimina" aria-label="Elimina el comentari">×</button>
            </div>`).join('')}
          <button class="btn small" data-action="addCb">＋ Comentari</button>`)}
      </div>`;
  }

  // ---- Canvis en camps ----
  const num = (v, min = 0, max = Infinity) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? Calc.clamp(n, min, max) : null;
  };

  function findSa(course, id) {
    for (const t of course.terms) { const sa = t.sas.find(x => x.id === id); if (sa) return { term: t, sa }; }
    return {};
  }

  function onChange(e) {
    const el = e.target, field = el.dataset.field, id = el.dataset.id;
    if (!field) return;
    const course = Store.course(), s = course.settings;
    const value = el.type === 'checkbox' ? el.checked : el.value.trim();
    let full = false;

    switch (field) {
      case 'courseName': if (value) course.name = value; full = true; break;
      case 'groupName': {
        if (!value || value === id) break;
        if (course.groups.includes(value)) { UI.toast('Ja hi ha un grup amb aquest nom.', true); break; }
        course.groups = course.groups.map(g => (g === id ? value : g));
        course.students.forEach(st => { if (st.group === id) st.group = value; });
        if (Store.ui().group === id) Store.ui().group = value;
        el.dataset.key = `group:${value}`;
        full = true;
        break;
      }
      case 'ceCode': if (value) course.ces.find(c => c.id === id).code = value; break;
      case 'ceName': course.ces.find(c => c.id === id).name = value; break;
      case 'termName': if (value) course.terms.find(t => t.id === id).name = value; full = true; break;
      case 'termWeight': course.terms.find(t => t.id === id).weight = num(value) ?? 1; break;
      case 'saName': if (value) findSa(course, id).sa.name = value; break;
      case 'saWeight': findSa(course, id).sa.weight = num(value) ?? 1; break;
      case 'actName': if (value) Store.findActivity(course, id).name = value; break;
      case 'actCe': Store.findActivity(course, id).ce = value; break;
      case 'actWeight': Store.findActivity(course, id).weight = num(value) ?? 1; break;
      case 'actType': changeType(course, Store.findActivity(course, id), value); break;
      case 'conv': s.conversions[id] = num(value, 0, 10) ?? s.conversions[id]; break;
      case 'thr': {
        const next = { ...s.thresholds, [id]: num(value, 0, 10) ?? s.thresholds[id] };
        if (!(next.AE > next.AN && next.AN > next.AS)) { UI.toast('Els llindars han d’anar de més a menys: AE > AN > AS.', true); break; }
        s.thresholds = next;
        break;
      }
      case 'pass': s.pass = num(value, 0, 10) ?? s.pass; break;
      case 'precision': s.precision = Number(value); break;
      case 'attitudeAdjust': s.attitudeAdjust = value; break;
      case 'attText': if (value) s.attitudeLabels.find(l => l.id === id).text = value; break;
      case 'attAdjust': s.attitudeLabels.find(l => l.id === id).adjust = num(value, -10, 10) ?? 0; break;
      case 'cbMin': s.commentBank[id].min = num(value, 0, 10) ?? 0; break;
      case 'cbText': s.commentBank[id].text = value; break;
    }
    Store.save();
    App.rerenderKeepingFocus({ full });
  }

  /** En canviar el tipus d'una activitat, es converteixen les notes que ja té. */
  function changeType(course, activity, type) {
    const holders = course.students.filter(st => {
      const v = course.grades[st.id]?.[activity.id];
      return v !== undefined && v !== '' && v !== 'NP' && v !== 'EX';
    });
    if (holders.length && !confirm(type === 'num'
      ? `Hi ha ${holders.length} notes posades. Els nivells es convertiran en números segons la taula de conversió (AE = ${course.settings.conversions.AE}…). Voleu continuar?`
      : `Hi ha ${holders.length} notes posades. Els números es convertiran en nivells segons els llindars (AE a partir de ${course.settings.thresholds.AE}…). Voleu continuar?`)) return;
    holders.forEach(st => {
      course.grades[st.id][activity.id] = Calc.convertValue(course.grades[st.id][activity.id], type, course.settings);
    });
    activity.type = type;
  }

  // ---- Botons ----
  function removeGrades(course, activityIds) {
    Object.values(course.grades).forEach(g => activityIds.forEach(id => delete g[id]));
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const course = Store.course(), s = course.settings, id = btn.dataset.id;
    const term = Store.term();
    let focusKey = null, full = false;

    switch (btn.dataset.action) {
      case 'newCourse': return newCourse();
      case 'deleteCourse': {
        const state = Store.get();
        if (state.courses.length < 2) return UI.toast('Ha de quedar com a mínim una matèria.', true);
        if (!confirm(`Voleu eliminar «${course.name}» amb tots els seus alumnes i notes? No es pot desfer.`)) return;
        state.courses = state.courses.filter(c => c.id !== course.id);
        Store.ensureUi();
        full = true;
        break;
      }
      case 'addGroup': {
        const name = await UI.ask({ title: 'Nou grup', label: 'Nom del grup', placeholder: 'Ex.: D' });
        if (!name) return;
        if (course.groups.includes(name)) return UI.toast('Ja hi ha un grup amb aquest nom.', true);
        course.groups.push(name);
        full = true;
        break;
      }
      case 'deleteGroup': {
        if (course.groups.length < 2) return UI.toast('Ha de quedar com a mínim un grup.', true);
        const count = course.students.filter(st => st.group === id).length;
        const other = course.groups.find(g => g !== id);
        if (count && !confirm(`El grup ${id} té ${count} alumnes. Es mouran al grup ${other} amb les seves notes. Voleu continuar?`)) return;
        course.students.forEach(st => { if (st.group === id) st.group = other; });
        course.groups = course.groups.filter(g => g !== id);
        Store.ensureUi();
        full = true;
        break;
      }
      case 'addCe': {
        const ce = { id: Store.uid('ce'), code: `CE${course.ces.length + 1}`, name: '' };
        course.ces.push(ce);
        focusKey = `ceCode:${ce.id}`;
        break;
      }
      case 'deleteCe': {
        const used = Store.activities(course).filter(x => x.activity.ce === id).length;
        if (used) return UI.toast(`Aquesta competència s’utilitza en ${used} activitats. Canvieu-les primer.`, true);
        course.ces = course.ces.filter(c => c.id !== id);
        break;
      }
      case 'addTerm': {
        const t = { id: Store.uid('term'), name: `${course.terms.length + 1}r trimestre`, weight: 1, sas: [] };
        course.terms.push(t);
        Store.ui().termId = t.id;
        focusKey = `termName:${t.id}`;
        full = true;
        break;
      }
      case 'deleteTerm': {
        if (course.terms.length < 2) return UI.toast('Ha de quedar com a mínim un trimestre.', true);
        const t = course.terms.find(x => x.id === id);
        if (!confirm(`Voleu eliminar «${t.name}» amb totes les seves activitats i notes? No es pot desfer.`)) return;
        removeGrades(course, t.sas.flatMap(sa => sa.activities.map(a => a.id)));
        course.terms = course.terms.filter(x => x.id !== id);
        Store.ensureUi();
        full = true;
        break;
      }
      case 'addSa': {
        if (!term) return;
        const n = course.terms.flatMap(t => t.sas).length + 1;
        const sa = { id: Store.uid('sa'), name: `SA${n}`, weight: 1, activities: [] };
        term.sas.push(sa);
        focusKey = `saName:${sa.id}`;
        break;
      }
      case 'deleteSa': {
        const { term: t, sa } = findSa(course, id);
        if (sa.activities.length && !confirm(`Voleu eliminar ${sa.name} amb les seves ${sa.activities.length} activitats i notes? No es pot desfer.`)) return;
        removeGrades(course, sa.activities.map(a => a.id));
        t.sas = t.sas.filter(x => x.id !== id);
        break;
      }
      case 'addAct': {
        const { sa } = findSa(course, id);
        const a = { id: Store.uid('act'), name: 'Nova activitat', ce: course.ces[0]?.id ?? '', weight: 10, type: 'num' };
        sa.activities.push(a);
        focusKey = `actName:${a.id}`;
        break;
      }
      case 'deleteAct': {
        const a = Store.findActivity(course, id);
        const graded = course.students.filter(st => (course.grades[st.id]?.[id] ?? '') !== '').length;
        if (graded && !confirm(`L’activitat «${a.name}» té ${graded} notes posades. Voleu eliminar-la igualment?`)) return;
        removeGrades(course, [id]);
        course.terms.forEach(t => t.sas.forEach(sa => { sa.activities = sa.activities.filter(x => x.id !== id); }));
        break;
      }
      case 'addAtt': {
        const l = { id: Store.uid('att'), text: 'Nova etiqueta', adjust: 0 };
        s.attitudeLabels.push(l);
        focusKey = `attText:${l.id}`;
        break;
      }
      case 'deleteAtt':
        s.attitudeLabels = s.attitudeLabels.filter(l => l.id !== id);
        course.students.forEach(st => Object.values(st.attitude || {}).forEach(list => {
          const i = list.indexOf(id); if (i >= 0) list.splice(i, 1);
        }));
        break;
      case 'addCb':
        s.commentBank.push({ min: 0, text: '' });
        focusKey = `cbText:${s.commentBank.length - 1}`;
        break;
      case 'deleteCb':
        s.commentBank.splice(Number(id), 1);
        break;
      default: return;
    }
    Store.save();
    App.rerenderKeepingFocus({ full, focusKey });
  }

  function newCourse() {
    const current = Store.course();
    const m = UI.modal({
      title: 'Nova matèria',
      body: `
        <div class="formfield"><label for="ncName">Nom</label><input id="ncName" class="field" placeholder="Ex.: Llatí · 2n Batxillerat"></div>
        <label class="check"><input type="checkbox" id="ncCopy" checked> Copia l’estructura i la configuració de «${esc(current.name)}» (sense alumnes ni notes)</label>`,
      actions: [
        { label: 'Cancel·la' },
        {
          label: 'Crea', primary: true, onClick: () => {
            const name = m.body.querySelector('#ncName').value.trim();
            if (!name) { UI.toast('Escriviu un nom per a la matèria.', true); return false; }
            const course = Store.newCourse(name, m.body.querySelector('#ncCopy').checked ? current : null);
            Store.get().courses.push(course);
            Store.ui().courseId = course.id;
            Store.ensureUi();
            Store.save();
            App.render();
            UI.toast(`S’ha creat «${name}».`);
          },
        },
      ],
    });
  }

  function mount(root) {
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
  }

  return { render, mount };
})();

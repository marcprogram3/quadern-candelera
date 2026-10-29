/*
 * Dades de l'app i desament local.
 *
 * Tot l'estat d'un professor es desa com un sol document JSON a la taula
 * «notebooks» de Supabase (vegeu auth.js i supabase/setup.sql).
 *
 * Estructura:
 *   state.courses[]   una entrada per matèria i curs (p. ex. «Llatí · 4t ESO»)
 *     groups[]        noms dels grups (A, B, C…)
 *     ces[]           competències específiques { id, code, name }
 *     terms[]         trimestres { id, name, weight, sas[] }
 *       sas[]         situacions d'aprenentatge { id, name, weight, activities[] }
 *         activities  { id, name, ce, weight, type: 'qual' | 'num' }
 *     students[]      { id, name, group, attitude: {termId: [labelId]}, comments: {termId: text} }
 *     grades          { studentId: { activityId: valor } }
 *     settings        conversions, llindars, actitud, banc de comentaris…
 *   state.ui          matèria, grup, trimestre i pàgina seleccionats
 */
const Store = (() => {
  let state = null;

  const uid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  function defaultSettings() {
    return {
      conversions: { AE: 10, AN: 8, AS: 5.5, NA: 3 },
      thresholds: { AE: 9, AN: 7, AS: 5 },
      pass: 5,
      precision: 2,
      attitudeAdjust: false,
      attitudeLabels: [
        { id: uid('att'), text: 'Bona actitud (+)', adjust: 0.25 },
        { id: uid('att'), text: 'Participa activament', adjust: 0.25 },
        { id: uid('att'), text: 'Absències', adjust: -0.25 },
        { id: uid('att'), text: 'Falta treball', adjust: -0.5 },
      ],
      commentBank: [
        { min: 9, text: 'Excel·lent rendiment.' },
        { min: 7.5, text: 'Molt bon resultat.' },
        { min: 6.5, text: 'Resultat correcte.' },
        { min: 5, text: 'Resultats justos: cal mantenir l’esforç.' },
        { min: 0, text: 'Resultats insuficients: cal reforçar el treball.' },
      ],
    };
  }

  function isValid(d) {
    return Boolean(d && d.version === 2 && Array.isArray(d.courses) && d.courses.length > 0 && d.ui);
  }

  /** Carrega les dades desxifrades en iniciar sessió. */
  function init(data) {
    state = isValid(data) ? data : Seed.create();
    ensureUi();
  }

  /** Desa l'estat a Supabase (amb un petit retard per agrupar canvis; vegeu auth.js). */
  function save() {
    Auth.persist(state);
  }

  /** Estat inicial buit per a un compte nou que no vol dades d'exemple. */
  function empty() {
    const course = newCourse('Nova matèria');
    return { version: 2, courses: [course], ui: { courseId: course.id, page: 'settings', lastBackup: null } };
  }

  /** Substitueix totes les dades (restaurar còpia o dades d'exemple). */
  function replace(data) {
    state = data;
    ensureUi();
    save();
  }

  /** Garanteix que la selecció actual (matèria, grup, trimestre) existeix. */
  function ensureUi() {
    state.ui ??= {};
    const ui = state.ui;
    if (!state.courses.some(c => c.id === ui.courseId)) ui.courseId = state.courses[0].id;
    const c = course();
    if (!c.groups.includes(ui.group)) ui.group = c.groups[0] ?? '';
    if (!c.terms.some(t => t.id === ui.termId)) ui.termId = c.terms[0]?.id ?? '';
    ui.page ??= 'grid';
  }

  const get = () => state;
  const ui = () => state.ui;
  const course = () => state.courses.find(c => c.id === state.ui.courseId) || state.courses[0];
  const term = (c = course()) => c.terms.find(t => t.id === state.ui.termId) || c.terms[0] || null;

  const normalizeName = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /** Alumnes del grup seleccionat, ordenats i filtrats per la cerca. */
  function groupStudents(c = course(), group = state.ui.group, query = '') {
    const q = normalizeName(query);
    return c.students
      .filter(s => s.group === group && (!q || normalizeName(s.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ca'));
  }

  /** Totes les activitats del curs amb el seu trimestre i SA. */
  function activities(c = course()) {
    return c.terms.flatMap(t => t.sas.flatMap(sa => sa.activities.map(a => ({ activity: a, sa, term: t }))));
  }

  const findActivity = (c, id) => activities(c).find(x => x.activity.id === id)?.activity || null;
  const ceCode = (c, ceId) => c.ces.find(ce => ce.id === ceId)?.code ?? '—';

  function setGrade(c, studentId, activityId, value) {
    c.grades[studentId] ??= {};
    if (value === '') delete c.grades[studentId][activityId];
    else c.grades[studentId][activityId] = value;
  }

  function newCourse(name, template = null) {
    const c = {
      id: uid('course'),
      name,
      groups: template ? [...template.groups] : ['A'],
      ces: template ? template.ces.map(ce => ({ ...ce })) : ['CE1', 'CE2', 'CE3', 'CE4'].map(code => ({ id: uid('ce'), code, name: '' })),
      terms: [],
      students: [],
      grades: {},
      settings: template ? JSON.parse(JSON.stringify(template.settings)) : defaultSettings(),
    };
    if (template) {
      // Es copia l'estructura (trimestres, SA, activitats) però no els alumnes ni les notes.
      const ceMap = {};
      c.ces.forEach(ce => { const oldId = ce.id; ce.id = uid('ce'); ceMap[oldId] = ce.id; });
      c.terms = template.terms.map(t => ({
        id: uid('term'), name: t.name, weight: t.weight,
        sas: t.sas.map(sa => ({
          id: uid('sa'), name: sa.name, weight: sa.weight,
          activities: sa.activities.map(a => ({ ...a, id: uid('act'), ce: ceMap[a.ce] ?? a.ce })),
        })),
      }));
    } else {
      c.terms = ['1r trimestre', '2n trimestre', '3r trimestre'].map(n => ({ id: uid('term'), name: n, weight: 1, sas: [] }));
    }
    return c;
  }

  return {
    uid, defaultSettings, init, empty, save, replace, ensureUi, isValid, get, ui, course, term,
    groupStudents, activities, findActivity, ceCode, setGrade, newCourse, normalizeName,
  };
})();

/*
 * Dades d'exemple fictícies.
 *
 * Reprodueixen l'estructura de l'Excel de Llatí de 4t d'ESO (SA1 i SA2 del
 * 1r trimestre, amb les mateixes activitats, criteris i pesos), més un segon
 * curs per mostrar que cada matèria té les seves pròpies dades.
 * Els noms són inventats.
 */
const Seed = (() => {
  // Generador pseudoaleatori amb llavor fixa: les dades d'exemple són sempre les mateixes.
  function random(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const NAMES_4T = [
    'Ariadna Font', 'Biel Serra', 'Clàudia Prat', 'Dídac Vidal', 'Eulàlia Roca', 'Ferran Comas', 'Gisela Miró', 'Hèctor Soler',
    'Ivet Costa', 'Jan Puig', 'Laia Rius', 'Marcel Pons', 'Núria Casals', 'Ot Feliu',
    'Queralt Roig', 'Roc Torras', 'Sílvia Sala', 'Teo Amat', 'Uma Borràs', 'Víctor Ferrer',
  ];
  const NAMES_1B = ['Aina Bosch', 'Bru Camps', 'Carla Duran', 'David Esteve', 'Emma Gual', 'Guillem Mas', 'Irene Nadal', 'Joel Oliva', 'Mar Pujol', 'Pau Riera'];

  function activity(name, ce, weight, type) {
    return { id: Store.uid('act'), name, ce, weight, type };
  }

  function sa(name, weight, activities) {
    return { id: Store.uid('sa'), name, weight, activities };
  }

  /** Nota inventada a partir del nivell de l'alumne, arrodonida a 0,05. */
  function makeGrade(rand, ability, type, settings) {
    const n = Calc.clamp(ability + (rand() - 0.5) * 1.8, 1, 10);
    const rounded = Math.round(n * 20) / 20;
    return type === 'qual' ? Calc.level(rounded, settings.thresholds) : rounded;
  }

  function llati4t() {
    const settings = Store.defaultSettings();
    const ce = Object.fromEntries(['CE1', 'CE2', 'CE3', 'CE4'].map(code => [code, { id: Store.uid('ce'), code, name: '' }]));
    const c = {
      id: Store.uid('course'),
      name: 'Llatí · 4t ESO',
      groups: ['A', 'B', 'C'],
      ces: Object.values(ce),
      settings,
      students: [],
      grades: {},
      terms: [
        {
          id: Store.uid('term'), name: '1r trimestre', weight: 1, sas: [
            sa('SA1', 1, [
              activity('Traducció I', ce.CE4.id, 10, 'qual'),
              activity('Test de vocabulari', ce.CE2.id, 10, 'qual'),
              activity('Expressió escrita', ce.CE1.id, 10, 'qual'),
              activity('Prova escrita', ce.CE2.id, 20, 'num'),
            ]),
            sa('SA2', 1, [
              activity('Traducció II', ce.CE4.id, 10, 'qual'),
              activity('Test de vocabulari II', ce.CE2.id, 10, 'qual'),
              activity('WhatsApp', ce.CE4.id, 10, 'num'),
              activity('Prova escrita II', ce.CE2.id, 10, 'num'),
            ]),
          ],
        },
        {
          id: Store.uid('term'), name: '2n trimestre', weight: 1, sas: [
            sa('SA3', 1, [
              activity('Traducció III', ce.CE4.id, 10, 'qual'),
              activity('Test de vocabulari III', ce.CE2.id, 10, 'qual'),
              activity('Comprensió oral', ce.CE3.id, 10, 'num'),
              activity('Prova escrita III', ce.CE2.id, 20, 'num'),
            ]),
            sa('SA4', 1, [
              activity('Traducció IV', ce.CE4.id, 10, 'qual'),
              activity('Expressió escrita II', ce.CE1.id, 10, 'qual'),
              activity('Projecte de cultura', ce.CE3.id, 20, 'num'),
              activity('Prova escrita IV', ce.CE2.id, 20, 'num'),
            ]),
          ],
        },
        {
          id: Store.uid('term'), name: '3r trimestre', weight: 1, sas: [
            sa('SA5', 1, [
              activity('Traducció V', ce.CE4.id, 10, 'qual'),
              activity('Test de vocabulari V', ce.CE2.id, 10, 'qual'),
              activity('Comprensió oral II', ce.CE3.id, 10, 'num'),
              activity('Prova escrita V', ce.CE2.id, 20, 'num'),
            ]),
            sa('SA6', 1, [
              activity('Traducció VI', ce.CE4.id, 10, 'qual'),
              activity('Prova escrita VI', ce.CE2.id, 20, 'num'),
            ]),
          ],
        },
      ],
    };

    const rand = random(2026);
    const [t1, t2, t3] = c.terms;
    const labels = Object.fromEntries(settings.attitudeLabels.map(l => [l.text, l.id]));

    NAMES_4T.forEach((name, i) => {
      const student = {
        id: Store.uid('stu'), name,
        group: i < 8 ? 'A' : i < 14 ? 'B' : 'C',
        attitude: {}, comments: {},
      };
      c.students.push(student);
      const grades = c.grades[student.id] = {};
      const ability = 4.2 + rand() * 5.6;

      // 1r i 2n trimestre complets; al 3r només s'han corregit les dues primeres activitats.
      [t1, t2, t3].forEach((term, ti) => term.sas.forEach((s, si) => s.activities.forEach((a, ai) => {
        if (ti === 2 && (si > 0 || ai > 1)) return;
        const trend = ti * 0.3 * (rand() - 0.3);
        grades[a.id] = makeGrade(rand, ability + trend, a.type, settings);
      })));

      student.attitude[t1.id] = ability > 7.5 ? [labels['Bona actitud (+)']] : [];
      student.attitude[t2.id] = ability > 8.5 ? [labels['Participa activament']] : [];
    });

    // Casos particulars, com els de l'Excel original.
    const [, , absent, , , , , lazy, , , , , adapted] = c.students;
    const sa2 = t1.sas[1].activities;
    const set = (student, act, value) => Store.setGrade(c, student.id, act.id, value);
    set(absent, sa2[0], ''); set(absent, sa2[1], '');                     // absències: activitats sense fer
    absent.attitude[t1.id] = [labels['Absències']];
    set(lazy, sa2[0], 'NP'); set(lazy, sa2[1], 'NP'); set(lazy, sa2[2], 'NP');
    lazy.attitude[t1.id] = [labels['Falta treball'], labels['Absències']];
    set(adapted, t1.sas[0].activities[2], 'EX');                          // exempt per adaptació
    return c;
  }

  function llati1b() {
    const settings = Store.defaultSettings();
    const ce = Object.fromEntries(['CE1', 'CE2', 'CE3', 'CE4'].map(code => [code, { id: Store.uid('ce'), code, name: '' }]));
    const c = {
      id: Store.uid('course'),
      name: 'Llatí · 1r Batxillerat',
      groups: ['Únic'],
      ces: Object.values(ce),
      settings,
      students: [],
      grades: {},
      terms: [
        {
          id: Store.uid('term'), name: '1r trimestre', weight: 1, sas: [
            sa('SA1', 1, [
              activity('Traducció', ce.CE1.id, 20, 'qual'),
              activity('Morfologia', ce.CE2.id, 20, 'num'),
              activity('Comentari cultural', ce.CE4.id, 20, 'qual'),
              activity('Prova escrita', ce.CE2.id, 40, 'num'),
            ]),
            sa('SA2', 1, [
              activity('Traducció II', ce.CE1.id, 30, 'qual'),
              activity('Exposició oral', ce.CE3.id, 20, 'num'),
              activity('Prova escrita II', ce.CE2.id, 50, 'num'),
            ]),
          ],
        },
        { id: Store.uid('term'), name: '2n trimestre', weight: 1, sas: [] },
        { id: Store.uid('term'), name: '3r trimestre', weight: 1, sas: [] },
      ],
    };
    const rand = random(1717);
    NAMES_1B.forEach(name => {
      const student = { id: Store.uid('stu'), name, group: 'Únic', attitude: {}, comments: {} };
      c.students.push(student);
      c.grades[student.id] = {};
      const ability = 5 + rand() * 4.8;
      c.terms[0].sas.forEach((s, si) => s.activities.forEach(a => {
        // La prova escrita II encara no s'ha fet: queda pendent.
        if (si === 1 && a.name === 'Prova escrita II') return;
        c.grades[student.id][a.id] = makeGrade(rand, ability, a.type, settings);
      }));
    });
    return c;
  }

  function create() {
    const courses = [llati4t(), llati1b()];
    return {
      version: 2,
      courses,
      ui: { courseId: courses[0].id, group: 'A', termId: courses[0].terms[0].id, page: 'grid', lastBackup: null },
    };
  }

  return { create };
})();

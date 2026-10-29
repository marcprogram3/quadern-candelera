/*
 * Càlcul de notes.
 *
 * Funcions pures: reben un curs (estructura + notes) i retornen resultats.
 * No toquen ni la pantalla ni l'emmagatzematge, de manera que es podran
 * reutilitzar tal qual el dia que l'app tingui servidor.
 *
 * Valors possibles d'una nota guardada:
 *   ''            pendent: encara no compta i el resultat queda provisional
 *   0–10          nota numèrica
 *   AE/AN/AS/NA   nivell qualitatiu (es converteix segons la configuració)
 *   'NP'          no presentat: compta com un 0
 *   'EX'          exempt: no compta mai i el pes es reparteix entre la resta
 */
const Calc = (() => {
  const LEVELS = ['AE', 'AN', 'AS', 'NA'];
  const ALIASES = { E: 'AE', N: 'AN', S: 'AS', EXEMPT: 'EX', EXEMPTA: 'EX' };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  /** Interpreta el que escriu el professor en una casella. */
  function parseInput(text, type) {
    const raw = String(text ?? '').trim();
    if (raw === '' || raw === '-' || raw === '—' || raw === '·') return { ok: true, value: '' };
    const upper = raw.toUpperCase().replace(/\s+/g, '');
    const code = ALIASES[upper] || upper;
    if (code === 'NP' || code === 'EX') return { ok: true, value: code };
    if (LEVELS.includes(code)) {
      if (type === 'num') return { ok: false, error: 'Aquesta activitat és numèrica: escriviu una nota de 0 a 10, NP o EX.' };
      return { ok: true, value: code };
    }
    if (type === 'qual') {
      return { ok: false, error: 'Aquesta activitat és qualitativa: escriviu AE, AN, AS o NA (o bé e, n, s, na), NP o EX.' };
    }
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 10) return { ok: false, error: 'La nota ha de ser un número entre 0 i 10, NP o EX.' };
    return { ok: true, value: Math.round(n * 100) / 100 };
  }

  /** Converteix una nota guardada a número. Retorna null si és pendent i 'EX' si no compta. */
  function toNumber(value, conversions) {
    if (value === '' || value == null) return null;
    if (value === 'EX') return 'EX';
    if (value === 'NP') return 0;
    if (LEVELS.includes(value)) return Number(conversions[value]) || 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Mitjana ponderada.
   * items: [{ weight, value, provisional? }] on value és un número, null (pendent) o 'EX'.
   * Retorna { grade, provisional }. Els pesos són relatius: no cal que sumin 100.
   */
  function weightedMean(items) {
    let sum = 0, total = 0, provisional = false;
    for (const item of items) {
      const weight = Math.max(0, Number(item.weight) || 0);
      if (item.value === 'EX' || weight === 0) continue;
      if (item.value == null) { provisional = true; continue; }
      sum += item.value * weight;
      total += weight;
      if (item.provisional) provisional = true;
    }
    return { grade: total ? sum / total : null, provisional };
  }

  /** Converteix un resultat intermedi en un element per a una mitjana superior. */
  function asItem(weight, result) {
    let value = result.grade;
    // Sense nota i sense res pendent vol dir que no hi ha res a comptar (tot exempt o buit).
    if (value == null) value = result.provisional ? null : 'EX';
    return { weight, value, provisional: result.provisional };
  }

  function gradeOf(course, studentId, activity) {
    return toNumber(course.grades[studentId]?.[activity.id] ?? '', course.settings.conversions);
  }

  function saResult(course, studentId, sa) {
    return weightedMean(sa.activities.map(a => ({ weight: a.weight, value: gradeOf(course, studentId, a) })));
  }

  function attitudeAdjustment(course, studentId, termId) {
    const student = course.students.find(s => s.id === studentId);
    const tags = student?.attitude?.[termId] || [];
    return course.settings.attitudeLabels
      .filter(label => tags.includes(label.id))
      .reduce((sum, label) => sum + (Number(label.adjust) || 0), 0);
  }

  function termResult(course, studentId, term) {
    const result = weightedMean(term.sas.map(sa => asItem(sa.weight, saResult(course, studentId, sa))));
    if (result.grade != null && course.settings.attitudeAdjust) {
      result.adjustment = attitudeAdjustment(course, studentId, term.id);
      result.grade = clamp(result.grade + result.adjustment, 0, 10);
    }
    return result;
  }

  function courseResult(course, studentId) {
    return weightedMean(course.terms.map(t => asItem(t.weight, termResult(course, studentId, t))));
  }

  /** Nota d'una competència específica. Amb termId = null, compta tot el curs. */
  function ceResult(course, studentId, ceId, termId = null) {
    const items = [];
    for (const term of course.terms) {
      if (termId && term.id !== termId) continue;
      for (const sa of term.sas) {
        for (const a of sa.activities) {
          if (a.ce === ceId) items.push({ weight: a.weight, value: gradeOf(course, studentId, a) });
        }
      }
    }
    return weightedMean(items);
  }

  /** Notes de totes les SA del curs, en ordre cronològic. */
  function saTimeline(course, studentId) {
    return course.terms.flatMap(term => term.sas
      .filter(sa => sa.activities.length)
      .map(sa => ({ term, sa, result: saResult(course, studentId, sa) })));
  }

  /** Cert si l'alumne ha baixat més d'un punt d'una SA a la següent. */
  function hasDrop(course, studentId) {
    const grades = saTimeline(course, studentId).map(x => x.result.grade).filter(g => g != null);
    return grades.some((g, i) => i > 0 && grades[i - 1] - g > 1);
  }

  function level(n, thresholds) {
    if (n == null) return null;
    if (n >= thresholds.AE) return 'AE';
    if (n >= thresholds.AN) return 'AN';
    if (n >= thresholds.AS) return 'AS';
    return 'NA';
  }

  /** Classe de color segons la nota: vermell < 5, taronja 5–6, groc 6–7, verd clar 7–9, verd ≥ 9. */
  function band(n) {
    if (n == null) return '';
    if (n < 5) return 'b-low';
    if (n < 6) return 'b-mid';
    if (n < 7) return 'b-ok';
    if (n < 9) return 'b-good';
    return 'b-top';
  }

  /** Classe de color per a un valor guardat (número, nivell o codi especial). */
  function valueBand(value) {
    if (value === '' || value == null) return 'is-empty';
    if (value === 'EX') return 'b-ex';
    if (value === 'NP' || value === 'NA') return 'b-low';
    if (value === 'AS') return 'b-mid';
    if (value === 'AN') return 'b-good';
    if (value === 'AE') return 'b-top';
    return band(Number(value));
  }

  /** Percentatge efectiu de cada element segons els pesos relatius. */
  function shares(items) {
    const total = items.reduce((s, x) => s + Math.max(0, Number(x.weight) || 0), 0);
    return items.map(x => (total ? Math.max(0, Number(x.weight) || 0) / total * 100 : 0));
  }

  function mean(values) {
    const xs = values.filter(v => v != null && Number.isFinite(v));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }

  function suggestComment(bank, grade) {
    if (grade == null) return '';
    const sorted = [...bank].sort((a, b) => b.min - a.min);
    return (sorted.find(c => grade >= c.min) || sorted[sorted.length - 1])?.text || '';
  }

  /** Format català: coma decimal. */
  function format(n, precision = 2) {
    if (n == null || !Number.isFinite(n)) return '—';
    return n.toFixed(precision).replace('.', ',');
  }

  /** Com es mostra dins d'una casella un valor guardat. */
  function formatValue(value) {
    if (value === '' || value == null) return '';
    return typeof value === 'number' ? String(value).replace('.', ',') : value;
  }

  /** Converteix una nota guardada quan una activitat canvia de tipus. */
  function convertValue(value, toType, settings) {
    if (value === '' || value === 'NP' || value === 'EX') return value;
    if (toType === 'num' && LEVELS.includes(value)) return Number(settings.conversions[value]) || 0;
    if (toType === 'qual' && typeof value === 'number') return level(value, settings.thresholds);
    return value;
  }

  return {
    LEVELS, parseInput, toNumber, weightedMean, gradeOf, saResult, termResult, courseResult,
    ceResult, saTimeline, hasDrop, attitudeAdjustment, level, band, valueBand, shares, mean,
    suggestComment, format, formatValue, convertValue, clamp,
  };
})();

/*
 * Gràfics (Chart.js).
 *
 * Els colors surten de les variables CSS, de manera que els gràfics
 * s'adapten automàticament al mode clar i fosc.
 */
const Charts = (() => {
  const live = new Map();

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const available = () => typeof window.Chart !== 'undefined';

  function colors() {
    return {
      series: [css('--c1'), css('--c2'), css('--c3'), css('--c4')],
      levels: { AE: css('--lv-ae'), AN: css('--lv-an'), AS: css('--lv-as'), NA: css('--lv-na') },
      text: css('--muted'),
      ink: css('--ink'),
      grid: css('--line'),
      surface: css('--surface'),
    };
  }

  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
  const tooltipNumber = v => (v == null ? 'pendent' : Calc.format(v, 2));

  function destroy(id) {
    live.get(id)?.destroy();
    live.delete(id);
  }

  function destroyAll() {
    live.forEach(chart => chart.destroy());
    live.clear();
  }

  function draw(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroy(id);
    if (!available()) {
      canvas.closest('.chart')?.classList.add('offline');
      return;
    }
    live.set(id, new Chart(canvas, config));
  }

  function baseOptions({ scale10 = true, legend = false, stacked = false, horizontal = false, count = false } = {}) {
    const c = colors();
    const valueAxis = {
      beginAtZero: true,
      max: scale10 ? 10 : undefined,
      stacked,
      ticks: { color: c.text, font: { size: 10 }, precision: 0 },
      grid: { color: c.grid },
      border: { display: false },
    };
    const categoryAxis = {
      stacked,
      ticks: { color: c.text, font: { size: 10 }, autoSkip: false, maxRotation: 40 },
      grid: { display: false },
      border: { color: c.grid },
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: legend, position: 'bottom', labels: { color: c.ink, boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed[horizontal ? 'x' : 'y'] ?? ctx.parsed.r ?? ctx.raw;
              return ` ${ctx.dataset.label}: ${count ? v : tooltipNumber(v)}`;
            },
          },
        },
      },
      scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
    };
  }

  /** Línia: series = [{ label, data, dashed? }]. */
  function line(id, labels, series) {
    const c = colors();
    draw(id, {
      type: 'line',
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label, data: s.data,
          borderColor: c.series[i % 4], backgroundColor: alpha(c.series[i % 4], 0.12),
          borderWidth: 2.5, borderDash: s.dashed ? [6, 5] : [], pointRadius: 3.5, pointHoverRadius: 5,
          tension: 0.3, spanGaps: true, fill: series.length === 1,
        })),
      },
      options: baseOptions({ legend: series.length > 1 }),
    });
  }

  /** Barres: series = [{ label, data, colors? }]. */
  function bar(id, labels, series, opts = {}) {
    const c = colors();
    draw(id, {
      type: 'bar',
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label, data: s.data,
          backgroundColor: s.colors || c.series[i % 4],
          borderRadius: 5, maxBarThickness: 46,
        })),
      },
      options: baseOptions({ legend: series.length > 1, ...opts }),
    });
  }

  /** Barres apilades amb nivells AE/AN/AS/NA. data: { AE: [], AN: [], AS: [], NA: [] } */
  function levels(id, labels, data) {
    const c = colors();
    draw(id, {
      type: 'bar',
      data: {
        labels,
        datasets: ['NA', 'AS', 'AN', 'AE'].map(lv => ({
          label: lv, data: data[lv], backgroundColor: c.levels[lv], borderRadius: 3, maxBarThickness: 46,
        })),
      },
      options: baseOptions({ scale10: false, legend: true, stacked: true, count: true }),
    });
  }

  /** Radar del perfil competencial. Amb menys de 3 competències es mostra com a barres. */
  function radar(id, labels, series) {
    if (labels.length < 3) return bar(id, labels, series);
    const c = colors();
    draw(id, {
      type: 'radar',
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label, data: s.data,
          borderColor: c.series[i % 4], backgroundColor: alpha(c.series[i % 4], i === 0 ? 0.22 : 0.06),
          borderWidth: 2, borderDash: s.dashed ? [6, 5] : [], pointRadius: 3,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
        plugins: {
          legend: { position: 'bottom', labels: { color: c.ink, boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${tooltipNumber(ctx.raw)}` } },
        },
        scales: {
          r: {
            min: 0, max: 10,
            ticks: { stepSize: 2, color: c.text, backdropColor: 'transparent', font: { size: 9 } },
            grid: { color: c.grid }, angleLines: { color: c.grid },
            pointLabels: { color: c.ink, font: { size: 11, weight: '600' } },
          },
        },
      },
    });
  }

  /** Descarrega un gràfic com a PNG, amb fons opac perquè es llegeixi bé fora de l'app. */
  function downloadPNG(id, filename) {
    const canvas = document.getElementById(id);
    if (!canvas || !live.has(id)) { UI.toast('Aquest gràfic encara no està disponible.', true); return; }
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = colors().surface || '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    out.toBlob(blob => UI.downloadBlob(filename, blob), 'image/png');
  }

  return { available, colors, line, bar, levels, radar, destroy, destroyAll, downloadPNG };
})();

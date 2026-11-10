/* BatStat test suites. Numbers are recomputed here from the raw sample data, independently of
   js/app.js, and compared with what the dashboard shows. If the app's math drifts, these fail. */

/* ---------- Reference calculations (kept separate from the app on purpose) ---------- */
const D = window.BATSTAT_DATA;
const T = D.thresholds;
const LATEST = D.regularTerms[D.regularTerms.length - 1];
const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const termRows = (ay, sem) => D.records.filter(r => r.ay === ay && r.sem === sem && r.college === 'CICS' && r.dept === 'IT');
const defaultRows = () => termRows(LATEST.ay, LATEST.sem);
const rated = rows => rows.filter(r => r.responses >= T.minResponses);
const seteOf = r => (r.responses >= T.minResponses ? mean(r.ratings) : null);
const passOf = r => (r.passed / r.enrolled) * 100;
const weightedSete = rows => {
  const list = rated(rows);
  const n = sum(list, r => r.responses);
  return n ? sum(list, r => mean(r.ratings) * r.responses) / n : null;
};
function issuesOf(r) {
  const out = [];
  const sete = seteOf(r);
  const lowPass = passOf(r) < T.pass;
  if (sete !== null && sete < T.sete && lowPass) out.push('critical');
  else if (lowPass) out.push('warning');
  else if (sete !== null && sete < T.sete) out.push('warning');
  if ((r.midtermFail / r.enrolled) * 100 >= T.midtermClass) out.push('warning');
  if (r.responses < T.minResponses || (r.responses / r.enrolled) * 100 < T.response) out.push('caution');
  if (r.inc >= 3 && (r.inc / r.enrolled) * 100 >= T.incClass) out.push('caution');
  if (r.lateDays > 0) out.push('caution');
  return out;
}
const num = s => parseFloat(String(s).replace(/,/g, ''));
const TABS = ['overview', 'actions', 'classes', 'faculty', 'students', 'sete'];

/* ======================================================================== */
suite('Sample data integrity', () => {
  test('every record has a unique id', () => {
    const ids = new Set(D.records.map(r => r.id));
    expect(ids.size, 'unique ids').toBe(D.records.length);
  });
  test('final grades add up to enrollment in every class', () => {
    const bad = D.records.filter(r => r.passed + r.failed + r.inc + r.dropped !== r.enrolled);
    expect(bad.length, `classes that do not add up (${bad.slice(0, 3).map(r => r.id).join(', ')})`).toBe(0);
  });
  test('counts are whole, non-negative and within enrollment', () => {
    const bad = D.records.filter(r => ['enrolled', 'responses', 'passed', 'failed', 'inc', 'dropped', 'midtermFail', 'midtermRecovered', 'lateDays']
      .some(k => !Number.isInteger(r[k]) || r[k] < 0) || r.responses > r.enrolled || r.midtermFail > r.enrolled);
    expect(bad.length, 'invalid counts').toBe(0);
  });
  test('SETE ratings stay on the 1–5 scale for all four dimensions', () => {
    const bad = D.records.filter(r => r.ratings.length !== D.dimensions.length || r.ratings.some(v => v < 1 || v > 5));
    expect(bad.length, 'out-of-scale ratings').toBe(0);
  });
  test('average grades follow the Philippine scale (1.00 best, 3.00 lowest pass)', () => {
    const bad = D.records.filter(r => r.avgGrade < 1 || r.avgGrade > 3);
    expect(bad.length, 'grades outside 1.00–3.00').toBe(0);
  });
  test('midterm recovery is consistent with final results', () => {
    // Students failing at midterm who did not recover cannot outnumber those who did not pass.
    const bad = D.records.filter(r => r.midtermRecovered > r.midtermFail ||
      r.midtermFail - r.midtermRecovered > r.enrolled - r.passed);
    expect(bad.length, 'inconsistent recovery').toBe(0);
  });
  test('every term has program classes, including both summers', () => {
    D.semesters.forEach(t => expect(termRows(t.ay, t.sem).length, `${t.ay} sem ${t.sem}`).toBeGreaterThan(0));
  });
  test('every program faculty member has a profile', () => {
    const names = new Set(D.records.filter(r => r.dept === 'IT' && !r.service).map(r => r.faculty));
    names.forEach(n => expect(Boolean(D.faculty[n]), `profile for ${n}`).toBeTruthy());
  });
  test('every record has a known course type', () => {
    const bad = D.records.filter(r => !D.courseTypes.includes(r.category));
    expect(bad.length, 'unknown course types').toBe(0);
  });
});

/* ======================================================================== */
suite('Part III requirements (Overview)', () => {
  test('primary user is the Program Chair, locked to BS IT', async () => {
    const a = await openApp();
    expect(a.text('#rolePill'), 'role pill').toContain('Program Chair');
    expect(a.$('#fCollege').closest('select'), 'college is not a dropdown').toBe(null);
    expect(a.text('#fDept'), 'department').toBe('Information Technology');
  });
  test('five KPI cards', async () => {
    const a = await openApp();
    expect(a.$$('#kpis .kpi').length, 'KPI cards').toBe(5);
    expect(a.$$('#kpis .kpi-label').map(x => x.textContent).join(' | '))
      .toBe('Average SETE rating | SETE response rate | Pass rate | Failing grades at midterm | Grades submitted on time');
  });
  test('three data visualizations render', async () => {
    const a = await openApp();
    expect(a.$$('#scatter svg .dot').length, 'scatter dots').toBeGreaterThan(10);
    expect(a.$$('#trend .mini svg path.line').length, 'line chart paths (4 panels x 2 lines)').toBe(8);
    expect(a.$$('#bars .bar-row').length, 'bar rows').toBeAtLeast(8);
  });
  test('two interactive features: filters and drill-down', async () => {
    const a = await openApp();
    expect(a.$$('#filters select').length, 'filter dropdowns').toBe(2);
    expect(a.$$('#kpis button.kpi').length + a.$$('#bars button.bar-row').length + a.$$('#scatter .clickable').length, 'drill-down targets').toBeGreaterThan(20);
  });
  test('an alert mechanism with levels and a count', async () => {
    const a = await openApp();
    expect(a.$$('#alertsList .alert').length, 'alerts shown').toBeGreaterThan(0);
    expect(a.$$('#alertsList .status').length, 'alert level chips').toBeGreaterThan(0);
    expect(a.$('.side-nav .nav-badge').hidden, 'nav badge hidden').toBe(false);
  });
  test('component labels 1–13 match the design notes', async () => {
    const a = await openApp();
    await a.click('#labelsBtn');
    const tags = [...new Set(a.$$('.note-tag').filter(t => t.offsetParent).map(t => Number(t.textContent)))].sort((x, y) => x - y);
    expect(tags.join(','), 'visible labels').toBe('1,2,3,4,5,6,7,8,9,10,11,12,13');
    expect(a.$$('#notes .component-list li').length, 'design notes entries').toBe(13);
  });
});

/* ======================================================================== */
suite('KPI calculations', () => {
  test('Average SETE rating is response-weighted', async () => {
    const a = await openApp();
    expect(num(a.$$('#kpis .kpi-value')[0].firstChild.textContent), 'SETE').toBeCloseTo(Number(weightedSete(defaultRows()).toFixed(2)));
  });
  test('SETE response rate', async () => {
    const a = await openApp();
    const rows = defaultRows();
    expect(num(a.$$('#kpis .kpi-value')[1].textContent), 'response %').toBe(Math.round(sum(rows, r => r.responses) / sum(rows, r => r.enrolled) * 100));
  });
  test('Pass rate', async () => {
    const a = await openApp();
    const rows = defaultRows();
    expect(num(a.$$('#kpis .kpi-value')[2].textContent), 'pass %').toBe(Math.round(sum(rows, r => r.passed) / sum(rows, r => r.enrolled) * 100));
  });
  test('Failing grades at midterm (count and share)', async () => {
    const a = await openApp();
    const rows = defaultRows();
    const count = sum(rows, r => r.midtermFail);
    expect(num(a.$$('#kpis .kpi-value')[3].firstChild.textContent), 'midterm count').toBe(count);
    expect(a.$$('#kpis .kpi-value')[3].textContent, 'midterm share').toContain(`${(count / sum(rows, r => r.enrolled) * 100).toFixed(1)}%`);
  });
  test('Grades submitted on time', async () => {
    const a = await openApp();
    const rows = defaultRows();
    expect(num(a.$$('#kpis .kpi-value')[4].textContent), 'on-time %').toBe(Math.round(rows.filter(r => r.lateDays === 0).length / rows.length * 100));
  });
  test('KPIs recalculate for another term', async () => {
    const a = await openApp();
    await a.select('#fAy', '2023-2024');
    await a.select('#fSem', 1);
    const rows = termRows('2023-2024', 1);
    expect(num(a.$$('#kpis .kpi-value')[2].textContent), 'pass % 1st Sem 23-24').toBe(Math.round(sum(rows, r => r.passed) / sum(rows, r => r.enrolled) * 100));
    expect(a.$$('#kpis .kpi-delta')[0].textContent, 'first term has no comparison').toContain('First term');
  });
});

/* ======================================================================== */
suite('Alerts and action items', () => {
  test('open alert count matches the alert rules', async () => {
    const a = await openApp();
    const flagged = defaultRows().filter(r => issuesOf(r).length);
    const critical = flagged.filter(r => issuesOf(r).includes('critical'));
    expect(a.text('#alertsSub'), 'alerts subtitle').toBe(`${flagged.length} open, ${critical.length} critical`);
    expect(a.text('.side-nav .nav-badge'), 'nav badge').toBe(String(flagged.length));
  });
  test('alerts are ordered most serious first', async () => {
    const a = await openApp();
    const rank = { critical: 3, warning: 2, caution: 1 };
    const levels = a.$$('#alertsList .alert').map(li => ['critical', 'warning', 'caution'].find(l => li.classList.contains(l)));
    levels.slice(1).forEach((l, i) => expect(rank[l], 'order').toBeAtMost(rank[levels[i]]));
  });
  test('marking an alert reviewed moves it to the Reviewed list', async () => {
    const a = await openApp();
    const first = a.text('#alertsList .alert-title');
    const before = Number(a.text('.side-nav .nav-badge'));
    await a.click('#alertsList .icon-btn');
    expect(Number(a.text('.side-nav .nav-badge')), 'badge').toBe(before - 1);
    await a.go('actions');
    await a.click(a.$$('#actionTools .seg')[0].querySelectorAll('button')[1]);
    expect(a.text('#actionsBody .action-card h3'), 'reviewed card').toBe(first);
    await a.click(a.$('#actionsBody .action-card .action-foot button:last-child'));
    expect(Number(a.text('.side-nav .nav-badge')), 'badge after reopen').toBe(before);
  });
  test('action level filter shows only that level', async () => {
    const a = await openApp({ hash: 'actions' });
    await a.click(a.$$('#actionTools .seg')[1].querySelectorAll('button')[2]); // Warning
    const cards = a.$$('#actionsBody .action-card');
    expect(cards.length, 'warning cards').toBeGreaterThan(0);
    cards.forEach(c => expect(Boolean(c.querySelector('.action-head .status.warning')), 'card level').toBeTruthy());
  });
  test('each flagged class gives a reason and a next step', async () => {
    const a = await openApp({ hash: 'actions' });
    a.$$('#actionsBody .issues li').forEach(li => {
      expect(li.querySelectorAll('p').length, 'reason + next step').toBe(2);
    });
  });
});

/* ======================================================================== */
suite('Filters (interactive feature 1)', () => {
  test('semester options follow the academic year, including Summer 1 and 2', async () => {
    const a = await openApp();
    expect(a.$$('#fSem option').map(o => o.textContent).join(', ')).toBe('1st Semester, 2nd Semester, Summer 1, Summer 2');
    expect(a.$$('#fAy option').length, 'academic years').toBe(3);
  });
  test('every component updates together', async () => {
    const a = await openApp();
    const snap = () => [a.text('#kpis'), a.text('#alertsSub'), a.$$('#scatter .dot').length, a.text('#bars')].join('|');
    const before = snap();
    await a.select('#fAy', '2024-2025');
    await a.select('#fSem', 1);
    expect(snap() === before, 'dashboard unchanged').toBe(false);
    expect(a.text('#contextLine'), 'context line').toContain('1st Sem, AY 2024–2025');
  });
  test('summer terms compare with the same summer and explain the trend chart', async () => {
    const a = await openApp();
    await a.select('#fAy', '2024-2025');
    await a.select('#fSem', 3);
    expect(a.$('#trendNote').hidden, 'trend note hidden').toBe(false);
    expect(a.$$('#kpis .kpi-delta')[2].textContent, 'comparison term').toMatch(/Summer 1|No change/);
  });
  test('Reset restores the default term', async () => {
    const a = await openApp();
    await a.select('#fAy', '2023-2024');
    await a.click('#resetBtn');
    expect(a.$('#fAy').value, 'year').toBe(LATEST.ay);
    expect(a.$('#fSem').value, 'semester').toBe(String(LATEST.sem));
  });
  test('the filter applies on every page', async () => {
    const a = await openApp();
    await a.select('#fAy', '2023-2024');
    for (const tab of TABS) {
      await a.go(tab);
      expect(a.text('#contextLine'), `context on ${tab}`).toContain('2023–2024');
    }
  });
});

/* ======================================================================== */
suite('Drill-down (interactive feature 2)', () => {
  test('KPI card opens the class list sorted by that measure', async () => {
    const a = await openApp();
    await a.click(a.$$('#kpis .kpi')[2]);
    expect(a.w.location.hash, 'page').toBe('#classes');
    expect(a.text('th[aria-sort]'), 'sorted column').toBe('Pass rate');
  });
  test('bar opens that course\'s classes, and the chip clears it', async () => {
    const a = await openApp();
    const code = a.text('#bars .bar-row b');
    await a.click('#bars .bar-row');
    expect(a.text('#courseChip'), 'chip').toBe(`Course: ${code}`);
    a.$$('#classesBody tbody tr').forEach(tr => expect(tr.textContent, 'row course').toContain(code));
    await a.click('#courseChip');
    expect(a.$('#courseChip').hidden, 'chip hidden').toBe(true);
  });
  test('scatter dot opens the class details panel', async () => {
    const a = await openApp();
    await a.click(a.$('#scatter .clickable'));
    expect(a.$('#drawer').open, 'panel open').toBe(true);
    expect(a.$$('#drawerBody h3').map(h => h.textContent).join(','), 'sections').toContain('Final grades');
  });
  test('alert opens the class details panel with its issues', async () => {
    const a = await openApp();
    await a.click('#alertsList .alert-main');
    expect(a.$('#drawer').open, 'panel open').toBe(true);
    expect(a.text('#drawerBody'), 'issue text').toContain('Why this was flagged');
  });
  test('details panel closes with the close button, restoring focus', async () => {
    const a = await openApp();
    const trigger = a.$('#alertsList .alert-main');
    trigger.focus();
    await a.click(trigger);
    await a.click('#drawer [data-close]');
    expect(a.$('#drawer').open, 'panel open').toBe(false);
    expect(a.d.activeElement === trigger, 'focus returned').toBe(true);
  });
  test('trend chart switches to a table and back', async () => {
    const a = await openApp();
    await a.click('#trendToggle');
    expect(a.$$('#trendTable tbody tr').length, 'table rows').toBe(D.regularTerms.length);
    await a.click('#trendToggle');
    expect(a.$('#trend').hidden, 'charts hidden').toBe(false);
  });
  test('bar chart expands to all courses', async () => {
    const a = await openApp();
    const courses = new Set(defaultRows().map(r => r.code)).size;
    await a.click('#bars .bars-more');
    expect(a.$$('#bars .bar-row').length, 'bars').toBe(courses);
  });
});

/* ======================================================================== */
suite('Classes page', () => {
  test('lists every class of the term', async () => {
    const a = await openApp({ hash: 'classes' });
    expect(a.$$('#classesBody tbody tr').length, 'rows').toBe(defaultRows().length);
  });
  test('search, flagged-only and year filters narrow the list', async () => {
    const a = await openApp({ hash: 'classes' });
    const all = a.$$('#classesBody tbody tr').length;
    const s = a.$('#search');
    s.value = 'Faculty E'; s.dispatchEvent(new Event('input')); await wait(80);
    a.$$('#classesBody tbody tr').forEach(tr => expect(tr.textContent, 'search hit').toContain('Faculty E'));
    s.value = ''; s.dispatchEvent(new Event('input')); await wait(80);
    await a.click('#flaggedBtn');
    expect(a.$$('#classesBody tbody tr').length, 'flagged rows').toBe(defaultRows().filter(r => issuesOf(r).length).length);
    await a.click('#flaggedBtn');
    await a.click(a.$$('#yearLevels button')[1]);
    expect(a.$$('#classesBody tbody tr').length, '1st-year rows').toBe(defaultRows().filter(r => r.year === 1).length);
    expect(all, 'all rows').toBe(defaultRows().length);
  });
  test('columns sort both ways', async () => {
    const a = await openApp({ hash: 'classes' });
    const passCol = () => a.$$('#classesBody td[data-label="Pass rate"]').map(td => num(td.textContent));
    const sorted = (list, dir) => list.every((v, i) => i === 0 || (dir > 0 ? v >= list[i - 1] : v <= list[i - 1]));
    await a.click(a.$$('#classesBody .sort-btn')[5]);
    expect(sorted(passCol(), -1), 'descending after first click').toBe(true);
    await a.click(a.$$('#classesBody .sort-btn')[5]);
    expect(sorted(passCol(), 1), 'ascending after second click').toBe(true);
  });
  test('section planning flags full and under-filled sections', async () => {
    const a = await openApp({ hash: 'classes' });
    const full = defaultRows().filter(r => r.enrolled >= r.capacity).length;
    expect(a.$$('#planning .plan-group')[0].querySelectorAll('li').length, 'open-a-section items').toBe(full);
  });
});

/* ======================================================================== */
suite('Faculty page', () => {
  test('lists only program faculty, not service teachers', async () => {
    const a = await openApp({ hash: 'faculty' });
    const names = new Set(defaultRows().filter(r => !r.service).map(r => r.faculty));
    expect(a.$$('#facultyBody tbody tr').length, 'faculty rows').toBe(names.size);
    expect(a.text('#facultyBody').includes('Service '), 'service faculty listed').toBe(false);
  });
  test('teaching load adds program units and other units', async () => {
    const a = await openApp({ hash: 'faculty' });
    a.$$('#facultyBody tbody tr').forEach(tr => {
      const name = tr.querySelector('.class-cell b').textContent;
      const units = sum(defaultRows().filter(r => r.faculty === name), r => r.units) + D.faculty[name].otherUnits;
      expect(num(tr.querySelector('td[data-label="Units"]').textContent), `${name} units`).toBe(units);
    });
  });
  test('faculty panel shows load, SETE, grades and classes', async () => {
    const a = await openApp({ hash: 'faculty' });
    await a.click('#facultyBody tbody tr');
    expect(a.$$('#drawerBody .stat').length, 'stats').toBe(6);
    await a.click('#drawerBody .mini-classes button');
    expect(a.text('#drawerTitle'), 'class panel').toContain('·');
  });
});

/* ======================================================================== */
suite('Student outcomes page', () => {
  test('outcome KPIs match the raw data', async () => {
    const a = await openApp({ hash: 'students' });
    const rows = defaultRows();
    const enrolled = sum(rows, r => r.enrolled);
    const values = a.$$('#studentKpis .kpi-value').map(v => v.firstChild.textContent);
    const blocks = new Map();
    rows.filter(r => !/^NSTP/.test(r.code)).forEach(r => blocks.set(r.section, Math.max(blocks.get(r.section) || 0, r.enrolled)));
    expect(num(values[0]), 'students').toBe([...blocks.values()].reduce((x, y) => x + y, 0));
    expect(num(values[1]), 'average grade').toBeCloseTo(Number((sum(rows, r => r.avgGrade * r.enrolled) / enrolled).toFixed(2)));
    expect(num(values[2]), 'INC').toBe(sum(rows, r => r.inc));
    expect(num(values[3]), 'dropped').toBe(sum(rows, r => r.dropped));
    expect(num(values[4]), 'recovery %').toBe(Math.round(sum(rows, r => r.midtermRecovered) / sum(rows, r => r.midtermFail) * 100));
  });
  test('year-level outcome bars show one row per year', async () => {
    const a = await openApp({ hash: 'students' });
    expect(a.$$('#yearOutcomes .outcome-bar').length, 'bars').toBe(new Set(defaultRows().map(r => r.year)).size);
  });
  test('gateway courses meet the watch rule', async () => {
    const a = await openApp({ hash: 'students' });
    const items = a.$$('#gateway .gateway-item');
    expect(items.length, 'gateway courses').toBeGreaterThan(0);
    items.forEach(li => {
      const pcts = (li.textContent.match(/offerings: ([^(]+)/)[1].match(/\d+/g) || []).map(Number);
      expect(pcts.filter(p => p < T.gatewayWatch).length, 'offerings below the watch line').toBeAtLeast(2);
    });
  });
  test('KPI cards and rows drill into classes', async () => {
    const a = await openApp({ hash: 'students' });
    await a.click(a.$$('#studentKpis .kpi')[2]);
    expect(a.$$('#drawerBody .ranked li').length, 'ranked classes').toBeGreaterThan(0);
    a.$('#drawer').close();
    await a.click(a.$$('.type-table tr.row')[1]);
    expect(a.text('#courseChip'), 'type chip').toContain('Type:');
    await a.go('students');
    await a.key(a.$$('.pipeline-table tr.row')[0], 'Enter');
    expect(a.$('#yearLevels [aria-pressed="true"]').textContent, 'year filter').toBe('1st year');
  });
});

/* ======================================================================== */
suite('SETE results page', () => {
  test('dimension scores match the weighted data', async () => {
    const a = await openApp({ hash: 'sete' });
    const rows = rated(defaultRows());
    const n = sum(rows, r => r.responses);
    a.$$('#seteDims .dim-row').forEach((row, d) => {
      expect(num(row.querySelector('b').textContent), D.dimensions[d]).toBeCloseTo(Number((sum(rows, r => r.ratings[d] * r.responses) / n).toFixed(2)));
    });
  });
  test('comment themes and course table render', async () => {
    const a = await openApp({ hash: 'sete' });
    expect(a.$$('#seteThemes .themes li').length, 'themes').toBeAtLeast(6);
    expect(a.$$('#seteCourses tbody tr').length, 'courses').toBe(new Set(defaultRows().map(r => r.code)).size);
    await a.click('#seteCourses tbody tr');
    expect(a.w.location.hash, 'drill to classes').toBe('#classes');
  });
});

/* ======================================================================== */
suite('Privacy and access', () => {
  test('SETE is hidden for classes under 5 responses', async () => {
    const a = await openApp({ hash: 'classes' });
    const few = defaultRows().filter(r => r.responses < T.minResponses);
    expect(few.length, 'sample has a low-response class').toBeGreaterThan(0);
    const s = a.$('#search'); s.value = few[0].section; s.dispatchEvent(new Event('input')); await wait(80);
    const row = a.$$('#classesBody tbody tr').find(tr => tr.textContent.includes(few[0].code));
    expect(row.querySelector('td[data-label="SETE"]').textContent, 'SETE cell').toBe('Hidden');
  });
  test('low-response classes are left out of the scatter plot', async () => {
    const a = await openApp();
    expect(a.$$('#scatter .dot').length, 'dots').toBe(rated(defaultRows()).length);
  });
  test('other departments never appear in class lists', async () => {
    const a = await openApp({ hash: 'classes' });
    expect(a.$$('#classesBody tbody tr').some(tr => /\bCS-\d/.test(tr.textContent)), 'CS sections listed').toBe(false);
  });
  test('comments appear only as grouped themes', async () => {
    const a = await openApp({ hash: 'sete' });
    expect(a.text('#seteThemes'), 'note').toContain('Original comments are not shown');
  });
  test('confidentiality notice is on every page', async () => {
    const a = await openApp();
    for (const tab of TABS) {
      await a.go(tab);
      expect(a.$('.privacy').offsetParent !== null, `notice on ${tab}`).toBe(true);
    }
  });
});

/* ======================================================================== */
suite('Accessibility', () => {
  test('every button and link has an accessible name', async () => {
    const a = await openApp();
    for (const tab of TABS) {
      await a.go(tab);
      const nameless = a.$$('button, a[href]').filter(el => el.offsetParent !== null &&
        !(el.getAttribute('aria-label') || el.textContent.trim() || el.title || el.querySelector('img[alt]:not([alt=""])')));
      expect(nameless.length, `nameless controls on ${tab}`).toBe(0);
    }
  });
  test('every image has alt text', async () => {
    const a = await openApp();
    expect(a.$$('img:not([alt])').length, 'images without alt').toBe(0);
  });
  test('clickable rows are keyboard reachable and labeled', async () => {
    const a = await openApp();
    for (const tab of TABS) {
      await a.go(tab);
      const rows = a.$$('tr.row');
      rows.forEach(tr => {
        expect(tr.getAttribute('tabindex'), `row tabindex on ${tab}`).toBe('0');
        expect(Boolean(tr.getAttribute('aria-label')), `row label on ${tab}`).toBe(true);
      });
    }
  });
  test('Enter on a class row opens its details', async () => {
    const a = await openApp({ hash: 'classes' });
    await a.key(a.$('#classesBody tbody tr'), 'Enter');
    expect(a.$('#drawer').open, 'panel open').toBe(true);
  });
  test('the current page is marked for assistive tech', async () => {
    const a = await openApp({ hash: 'faculty' });
    expect(a.$('.side-nav [aria-current="page"]').getAttribute('data-nav'), 'current nav').toBe('faculty');
  });
});

/* ======================================================================== */
suite('Responsive layout', () => {
  const widths = [320, 390, 768, 1024, 1440, 1920];
  widths.forEach(width => test(`no sideways scrolling at ${width}px on any page`, async () => {
    const a = await openApp({ width });
    for (const tab of TABS) {
      await a.go(tab);
      const doc = a.d.documentElement;
      expect(doc.scrollWidth, `page width on ${tab}`).toBeAtMost(doc.clientWidth + 1);
      a.$$('.table-wrap').filter(t => t.offsetParent && !t.closest('[hidden]')).forEach(t =>
        expect(t.scrollWidth, `table width on ${tab}`).toBeAtMost(t.clientWidth + 1));
    }
  }));
  test('phones get the bottom tab bar, desktops get the sidebar', async () => {
    const phone = await openApp({ width: 390 });
    expect(getComputedStyle(phone.$('.tabbar')).display, 'tab bar on phone').toBe('grid');
    expect(getComputedStyle(phone.$('.sidebar')).display, 'sidebar on phone').toBe('none');
    const desk = await openApp({ width: 1440 });
    expect(getComputedStyle(desk.$('.tabbar')).display, 'tab bar on desktop').toBe('none');
  });
  test('filter bar pins on desktop and scrolls away on phones', async () => {
    const desk = await openApp({ width: 1440 });
    expect(getComputedStyle(desk.$('#filters')).position, 'desktop').toBe('sticky');
    const phone = await openApp({ width: 390 });
    expect(getComputedStyle(phone.$('#filters')).position, 'phone').toBe('static');
  });
  test('charts redraw to fit after a resize', async () => {
    const a = await openApp({ width: 1440 });
    const svgWidth = () => Number(a.$('#scatter svg').getAttribute('width'));
    const before = svgWidth();
    // At 800px the layout drops to one column, so the chart's box changes size; wait for the redraw.
    a.frame.style.width = '800px';
    // Wait on painted frames, not just time: resize observers run as part of painting a frame,
    // and headless browsers paint only when a frame is requested.
    const nextFrame = () => new Promise(r => a.w.requestAnimationFrame(() => r()));
    for (let i = 0; i < 30 && svgWidth() !== a.$('#scatter').clientWidth; i++) { await nextFrame(); await wait(100); }
    expect(a.$('#scatter').clientWidth === before, 'container width changed').toBe(false);
    expect(svgWidth(), 'scatter redrawn to its new container width').toBe(a.$('#scatter').clientWidth);
  });
});

/* ======================================================================== */
suite('Stability', () => {
  test('every term on every page renders without script errors', async () => {
    const a = await openApp();
    for (const t of D.semesters) {
      await a.select('#fAy', t.ay);
      await a.select('#fSem', t.sem);
      for (const tab of TABS) await a.go(tab);
    }
    expect(a.errors.join(' / '), 'script errors').toBe('');
  });
  test('unknown page addresses fall back to the Overview', async () => {
    const a = await openApp({ hash: 'nope' });
    expect(a.$('[data-view="overview"]').hidden, 'overview hidden').toBe(false);
  });
});

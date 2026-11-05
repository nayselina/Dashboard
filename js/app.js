/* BatStat dashboard: renders every component from one filtered slice of records. */
(function () {
  const DATA = window.BATSTAT_DATA;
  const T = DATA.thresholds;
  const USER = DATA.user;
  const LATEST = DATA.regularTerms[DATA.regularTerms.length - 1];
  const DEFAULTS = { ay: LATEST.ay, sem: LATEST.sem, college: USER.college, dept: USER.dept };

  const TABS = {
    overview: { title: ['Teaching and learning.', 'One clear view.'], sub: () => `Portal grades and SETE results, linked for ${scopeName()}.` },
    actions: { title: ['Action items'], sub: () => 'Classes that need your follow-up, with the reason and a suggested next step.' },
    classes: { title: ['Classes'], sub: () => 'Check section performance and grade submission, and plan which sections to open or merge.' },
    faculty: { title: ['Faculty'], sub: () => 'Balance teaching loads and plan mentoring for your program.' },
    sete: { title: ['SETE results'], sub: () => 'See what students report by dimension, course and theme.' }
  };

  const state = {
    ...DEFAULTS,
    tab: 'overview',
    course: null,
    search: '',
    flagged: false,
    sort: { key: 'level', dir: -1 },
    actionLevel: 'all',
    actionStatus: 'open',
    yearLevel: 'all',
    barsAll: false,
    trendTable: false
  };

  const YEAR_NAMES = { 1: '1st year', 2: '2nd year', 3: '3rd year', 4: '4th year' };

  /* ---------- DOM helpers ---------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function build(node, props, children) {
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.setAttribute('class', v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    children.flat().forEach(c => {
      if (c !== null && c !== undefined && c !== false) node.append(c);
    });
    return node;
  }
  const h = (tag, props, ...children) => build(document.createElement(tag), props, children);
  const s = (tag, props, ...children) =>
    build(document.createElementNS('http://www.w3.org/2000/svg', tag), props, children);
  const icon = name => s('svg', { class: 'icon', 'aria-hidden': 'true' }, s('use', { href: `#i-${name}` }));

  /* ---------- Metrics ---------- */
  const sum = (rows, fn) => rows.reduce((a, r) => a + fn(r), 0);
  const rated = rows => rows.filter(r => r.responses >= T.minResponses);
  const avg = list => list.reduce((a, b) => a + b, 0) / list.length;
  const seteOf = r => (r.responses >= T.minResponses ? avg(r.ratings) : null);
  const passOf = r => (r.passed / r.enrolled) * 100;
  const responseOf = r => (r.responses / r.enrolled) * 100;
  const midtermShare = r => (r.midtermFail / r.enrolled) * 100;

  function weightedDim(rows, d) {
    const list = rated(rows);
    const n = sum(list, r => r.responses);
    return n ? sum(list, r => r.ratings[d] * r.responses) / n : null;
  }
  function weightedSete(rows) {
    const list = rated(rows);
    const n = sum(list, r => r.responses);
    return n ? sum(list, r => avg(r.ratings) * r.responses) / n : null;
  }
  const pct = (a, b) => (b ? (a / b) * 100 : 0);

  function metrics(rows) {
    const enrolled = sum(rows, r => r.enrolled);
    const atRisk = sum(rows, r => r.midtermFail);
    return {
      sete: weightedSete(rows),
      response: pct(sum(rows, r => r.responses), enrolled),
      pass: pct(sum(rows, r => r.passed), enrolled),
      atRisk,
      atRiskShare: pct(atRisk, enrolled),
      onTime: pct(rows.filter(r => r.lateDays === 0).length, rows.length),
      enrolled,
      count: rows.length
    };
  }

  const inScope = () => state.college === USER.college && state.dept === USER.dept;

  function matchesOrg(r) {
    if (r.college !== state.college) return false;
    return state.dept === 'ALL' || r.dept === state.dept;
  }
  const rowsFor = (ay, sem) => DATA.records.filter(r => r.ay === ay && r.sem === sem && matchesOrg(r));
  const currentRows = () => rowsFor(state.ay, state.sem);
  const SEM_NAMES = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer 1', 4: 'Summer 2' };
  const isSummer = () => state.sem >= 3;
  const currentTerm = () => ({ ay: state.ay, sem: state.sem });
  // Like is compared with like: semesters with semesters, each summer with the same summer.
  const comparableTerms = () => (isSummer() ? DATA.semesters.filter(x => x.sem === state.sem) : DATA.regularTerms);
  const comparableIndex = () => comparableTerms().findIndex(x => x.ay === state.ay && x.sem === state.sem);
  const previousTerm = () => {
    const i = comparableIndex();
    return i > 0 ? comparableTerms()[i - 1] : null;
  };
  const trendIndex = () => DATA.regularTerms.findIndex(x => x.ay === state.ay && x.sem === state.sem);
  const semLabel = (x, long) => {
    const short = x.sem >= 3 ? SEM_NAMES[x.sem] : `${x.sem === 1 ? '1st' : '2nd'} Sem`;
    const yrs = x.ay.split('-');
    return long ? `${short}, AY ${x.ay.replace('-', '–')}` : `${short} ${yrs[0].slice(2)}–${yrs[1].slice(2)}`;
  };

  /* ---------- Alert logic ---------- */
  const LEVELS = {
    critical: { rank: 3, label: 'Critical', icon: 'alert' },
    warning: { rank: 2, label: 'Warning', icon: 'warn' },
    caution: { rank: 1, label: 'Caution', icon: 'info' },
    good: { rank: 0, label: 'On track', icon: 'check' }
  };

  function weakestDim(r) {
    let low = 0;
    r.ratings.forEach((v, i) => { if (v < r.ratings[low]) low = i; });
    return DATA.dimensions[low];
  }

  function zone(r) {
    const sete = seteOf(r);
    const lowPass = passOf(r) < T.pass;
    if (sete === null) return lowPass ? 'student' : 'ok';
    if (sete < T.sete) return lowPass ? 'priority' : 'teaching';
    return lowPass ? 'student' : 'ok';
  }

  function assess(r) {
    const issues = [];
    const sete = seteOf(r);
    const z = zone(r);
    if (z === 'priority') issues.push({ level: 'critical', title: 'Priority review', why: `SETE ${sete.toFixed(2)} and pass rate ${Math.round(passOf(r))}% are both below target.`, next: `Review the course with the faculty member, starting with ${weakestDim(r).toLowerCase()}. Plan remedial sessions for students at risk.` });
    if (z === 'student') issues.push({ level: 'warning', title: 'Low pass rate', why: `Pass rate is ${Math.round(passOf(r))}% while SETE is at target.`, next: 'Look beyond teaching first: check prerequisites and section size, and consider remedial sessions.' });
    if (z === 'teaching') issues.push({ level: 'warning', title: 'Teaching support', why: `SETE is ${sete.toFixed(2)} while the pass rate is at target.`, next: `Offer mentoring or peer observation focused on ${weakestDim(r).toLowerCase()}.` });
    if (midtermShare(r) >= T.midtermClass) issues.push({ level: 'warning', title: 'Midterm risk', why: `${r.midtermFail} of ${r.enrolled} students failed at midterm.`, next: 'Refer these students for advising and academic support.' });
    if (r.responses < T.minResponses) issues.push({ level: 'caution', title: 'Too few responses', why: `Only ${r.responses} of ${r.enrolled} students responded, so the score is hidden.`, next: 'Encourage participation next term. Do not draw conclusions from this class.' });
    else if (responseOf(r) < T.response) issues.push({ level: 'caution', title: 'Low response', why: `Only ${Math.round(responseOf(r))}% of students responded (${r.responses} of ${r.enrolled}).`, next: 'Read this score with caution and encourage participation next term.' });
    if (r.lateDays > 0) issues.push({ level: 'caution', title: 'Late grades', why: `Grades were submitted ${r.lateDays} day${r.lateDays > 1 ? 's' : ''} after the deadline.`, next: 'Check whether the faculty member needs help with the submission schedule.' });
    // A chair cannot mentor or schedule another department's faculty, only raise it with them.
    if (r.service) {
      issues.filter(i => ['Priority review', 'Teaching support', 'Late grades'].includes(i.title)).forEach(i => {
        i.next = "Another department teaches this course, so raise this with that department's chair.";
      });
    }
    return issues.sort((a, b) => LEVELS[b.level].rank - LEVELS[a.level].rank);
  }
  const levelOf = r => {
    const issues = assess(r);
    return issues.length ? issues[0].level : 'good';
  };

  const chip = (level, label) => h('span', { class: `status ${level}` }, icon(LEVELS[level].icon), label || LEVELS[level].label);

  // Classes with at least one issue, most serious first.
  function flaggedClasses() {
    return currentRows()
      .map(r => ({ r, issues: assess(r) }))
      .filter(x => x.issues.length)
      .sort((a, b) => LEVELS[b.issues[0].level].rank - LEVELS[a.issues[0].level].rank || passOf(a.r) - passOf(b.r));
  }

  /* ---------- Reviewed alerts (per-viewer convenience) ---------- */
  const REVIEW_KEY = 'batstat.reviewed';
  let reviewed = new Set();
  try { reviewed = new Set(JSON.parse(localStorage.getItem(REVIEW_KEY)) || []); } catch (e) { /* storage unavailable */ }
  function saveReviewed() {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify([...reviewed])); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- Tooltip ---------- */
  const tip = $('#tip');
  function showTip(x, y, title, lines) {
    tip.replaceChildren(
      h('p', { class: 'tip-title' }, title),
      ...lines.map(l => h('p', { class: 'tip-row' },
        l.key ? h('span', { class: `tip-key ${l.key}` }) : null,
        h('b', {}, l.value), h('span', {}, l.label)))
    );
    tip.hidden = false;
    const rect = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - 8, Math.max(8, x + 14));
    const top = y - rect.height - 12 < 8 ? y + 16 : y - rect.height - 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- Filters ---------- */
  function fillSelect(sel, options, value) {
    sel.replaceChildren(...options.map(o => h('option', { value: o.value }, o.label)));
    sel.value = String(value);
  }
  function renderFilters() {
    const years = [...new Set(DATA.semesters.map(x => x.ay))].reverse();
    fillSelect($('#fAy'), years.map(y => ({ value: y, label: y.replace('-', '–') })), state.ay);
    const sems = DATA.semesters.filter(x => x.ay === state.ay).map(x => x.sem);
    fillSelect($('#fSem'), sems.map(n => ({ value: n, label: SEM_NAMES[n] })), state.sem);
    // A chair's college and department come from the account, so these two are fixed.
    const college = DATA.colleges.find(c => c.id === USER.college);
    $('#fCollege').textContent = college.name;
    $('#fDept').textContent = college.departments.find(d => d.id === USER.dept).name;
  }

  /* ---------- Header + context ---------- */
  function scopeName() {
    const college = DATA.colleges.find(c => c.id === state.college);
    if (state.dept === 'ALL') return `all ${college.id} departments`;
    return college.departments.find(d => d.id === state.dept).name;
  }
  function renderContext() {
    const sel = currentTerm();
    const tab = TABS[state.tab];
    $('#hero').classList.toggle('compact', state.tab !== 'overview');
    $('#heroTitle').replaceChildren(tab.title[0], ...(tab.title[1] ? [h('br'), h('em', {}, tab.title[1])] : []));
    $('#heroSub').textContent = tab.sub();
    const line = $('#contextLine');
    line.replaceChildren(
      h('span', { class: 'sample-tag' }, 'Sample data'),
      h('span', {}, `${semLabel(sel, true)} · ${scopeName()}`),
      !inScope() ? h('span', { class: 'scope-note' }, icon('lock'), 'Outside your program: aggregates only') : ''
    );
  }

  /* ---------- KPI cards ---------- */
  const KPI = [
    {
      key: 'sete', sort: 'sete', sortDir: 1, label: 'Average SETE rating', target: 'Target: 3.50 or higher', up: true,
      value: m => (m.sete === null ? '–' : m.sete.toFixed(2)), unit: 'of 5', series: m => m.sete,
      status: m => (m.sete === null ? 'caution' : m.sete >= T.sete ? 'good' : m.sete >= T.sete - .25 ? 'warning' : 'critical'),
      delta: d => `${Math.abs(d).toFixed(2)} pts`
    },
    {
      key: 'response', sort: 'response', sortDir: 1, label: 'SETE response rate', target: 'Target: 50% or higher', up: true,
      value: m => `${Math.round(m.response)}%`, series: m => m.response,
      status: m => (m.response >= T.response ? 'good' : m.response >= T.response - 10 ? 'warning' : 'critical'),
      delta: d => `${Math.abs(d).toFixed(1)} pts`
    },
    {
      key: 'pass', sort: 'pass', sortDir: 1, label: 'Pass rate', target: 'Target: 75% or higher', up: true,
      value: m => `${Math.round(m.pass)}%`, series: m => m.pass,
      status: m => (m.pass >= T.pass ? 'good' : m.pass >= T.pass - 10 ? 'warning' : 'critical'),
      delta: d => `${Math.abs(d).toFixed(1)} pts`
    },
    {
      key: 'atRiskShare', sort: 'midterm', sortDir: -1, label: 'Failing grades at midterm', target: 'Target: under 15% of class enrollments', up: false,
      value: m => m.atRisk.toLocaleString(), unit: m => `${m.atRiskShare.toFixed(1)}% of class enrollments`, series: m => m.atRiskShare,
      status: m => (m.atRiskShare < T.atRiskShare ? 'good' : m.atRiskShare < T.atRiskShare + 10 ? 'warning' : 'critical'),
      delta: d => `${Math.abs(d).toFixed(1)} pts`
    },
    {
      key: 'onTime', sort: 'grades', sortDir: -1, label: 'Grades submitted on time', target: 'Target: 90% or higher', up: true,
      value: m => `${Math.round(m.onTime)}%`, unit: m => `of ${m.count} classes`, series: m => m.onTime,
      status: m => (m.onTime >= T.onTime ? 'good' : m.onTime >= T.onTime - 15 ? 'warning' : 'critical'),
      delta: d => `${Math.abs(d).toFixed(1)} pts`
    }
  ];

  function sparkline(values, activeIdx) {
    const W = 64, H = 24, pad = 3;
    const nums = values.filter(v => v !== null);
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const x = i => pad + (i * (W - pad * 2)) / (values.length - 1);
    const y = v => (hi === lo ? H / 2 : H - pad - ((v - lo) * (H - pad * 2)) / (hi - lo));
    const path = values.map((v, i) => (v === null ? '' : `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join('');
    return s('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' },
      s('path', { d: path, class: 'spark-line' }),
      values[activeIdx] !== null ? s('circle', { cx: x(activeIdx), cy: y(values[activeIdx]), r: 3, class: 'spark-dot' }) : null);
  }

  function renderKpis() {
    const idx = comparableIndex();
    const history = comparableTerms().map(x => metrics(rowsFor(x.ay, x.sem)));
    const m = history[idx];
    const prev = idx > 0 ? history[idx - 1] : null;
    const prevSem = previousTerm();
    $('#kpis').replaceChildren(...KPI.map((k, i) => {
      const status = k.status(m);
      const unit = typeof k.unit === 'function' ? k.unit(m) : k.unit;
      let delta = h('p', { class: 'kpi-delta' }, 'First term on record');
      if (prev && k.series(prev) !== null && k.series(m) !== null) {
        const d = k.series(m) - k.series(prev);
        const flat = Math.abs(d) < .05;
        const better = k.up ? d > 0 : d < 0;
        delta = h('p', { class: `kpi-delta ${flat ? '' : better ? 'better' : 'worse'}` },
          flat ? null : icon(d > 0 ? 'up' : 'down'),
          flat ? `No change vs ${semLabel(prevSem)}` : `${k.delta(d)} vs ${semLabel(prevSem)}`);
      }
      const body = [
        h('div', { class: 'kpi-top' }, h('p', { class: 'kpi-label' }, k.label), sparkline(history.map(k.series), idx)),
        h('p', { class: 'kpi-value' }, k.value(m), unit ? h('small', {}, unit) : null),
        chip(status),
        delta,
        h('p', { class: 'kpi-target' }, k.target)
      ];
      if (!inScope()) return h('article', { class: 'kpi', 'data-note': i + 3 }, body);
      return h('button', {
        type: 'button', class: 'kpi', 'data-note': i + 3,
        title: 'Sort the class list by this measure',
        onclick: () => {
          state.sort = { key: k.sort, dir: k.sortDir };
          state.course = null; state.search = ''; state.flagged = false; state.yearLevel = 'all';
          $('#search').value = '';
          goTab('classes');
        }
      }, body);
    }));
    addLabels();
  }

  /* ---------- Alerts ---------- */
  const RESTRICTED = `Class and faculty details are available only for your assigned program (${USER.short}). Select Information Technology to see them.`;

  function lockMessage(text) {
    return h('div', { class: 'locked' }, icon('lock'), h('p', {}, text));
  }

  function renderAlerts() {
    const list = $('#alertsList');
    const sub = $('#alertsSub');
    if (!inScope()) {
      sub.textContent = 'Restricted for this selection';
      list.replaceChildren(lockMessage(RESTRICTED));
      return;
    }
    const flagged = flaggedClasses();
    const open = flagged.filter(x => !reviewed.has(x.r.id));
    const critical = open.filter(x => x.issues[0].level === 'critical').length;

    sub.textContent = open.length
      ? `${open.length} open${critical ? `, ${critical} critical` : ''}`
      : (flagged.length ? 'All alerts reviewed' : 'No alerts this term');

    const LIMIT = 4;
    const items = open.slice(0, LIMIT).map(({ r, issues }) => {
      const top = issues[0];
      return h('li', { class: `alert ${top.level}` },
        h('button', { type: 'button', class: 'alert-main', onclick: e => openDrawer(r, e.currentTarget) },
          h('span', { class: 'alert-line' }, chip(top.level), h('span', { class: 'alert-kind' }, top.title)),
          h('span', { class: 'alert-title' }, `${r.code} · ${r.section}`),
          h('span', { class: 'alert-why' }, top.why + (issues.length > 1 ? ` +${issues.length - 1} more` : ''))),
        h('button', {
          type: 'button', class: 'icon-btn', title: 'Mark as reviewed',
          'aria-label': `Mark ${r.code} ${r.section} as reviewed`,
          onclick: () => { reviewed.add(r.id); saveReviewed(); renderAlerts(); renderBadges(); }
        }, icon('check')));
    });

    list.replaceChildren(
      items.length ? h('ul', { class: 'alert-list' }, items)
        : h('div', { class: 'locked calm' }, icon('check'), h('p', {}, 'No open alerts for this selection.')),
      h('div', { class: 'alert-foot' }, h('a', { class: 'link-btn', href: '#actions' },
        open.length > LIMIT ? `See all ${open.length} action items` : 'Go to action items'))
    );
  }

  function renderBadges() {
    const count = inScope() ? flaggedClasses().filter(x => !reviewed.has(x.r.id)).length : 0;
    $$('.nav-badge').forEach(b => {
      b.hidden = count === 0;
      b.textContent = count;
    });
  }

  /* ---------- Action items page ---------- */
  function segmented(options, value, onPick, label) {
    return h('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map(o => h('button', {
      type: 'button', class: 'btn ghost small', 'aria-pressed': String(o.value === value),
      onclick: () => onPick(o.value)
    }, o.label)));
  }

  function renderActions() {
    const body = $('#actionsBody');
    const tools = $('#actionTools');
    tools.hidden = !inScope();
    if (!inScope()) {
      $('#actionsSub').textContent = 'Restricted for this selection';
      body.replaceChildren(lockMessage(RESTRICTED));
      return;
    }
    const all = flaggedClasses();
    const openCount = all.filter(x => !reviewed.has(x.r.id)).length;
    $('#actionsSub').textContent = `${openCount} open, ${all.length - openCount} reviewed. Each class appears once, with all of its issues.`;

    const byStatus = all.filter(x => reviewed.has(x.r.id) === (state.actionStatus === 'reviewed'));
    const levelCount = l => byStatus.filter(x => x.issues[0].level === l).length;
    tools.replaceChildren(
      segmented([{ value: 'open', label: 'Open' }, { value: 'reviewed', label: 'Reviewed' }], state.actionStatus,
        v => { state.actionStatus = v; renderActions(); }, 'Filter by status'),
      segmented([
        { value: 'all', label: `All ${byStatus.length}` },
        { value: 'critical', label: `Critical ${levelCount('critical')}` },
        { value: 'warning', label: `Warning ${levelCount('warning')}` },
        { value: 'caution', label: `Caution ${levelCount('caution')}` }
      ], state.actionLevel, v => { state.actionLevel = v; renderActions(); }, 'Filter by level'));

    const shown = byStatus.filter(x => state.actionLevel === 'all' || x.issues[0].level === state.actionLevel);
    if (!shown.length) {
      body.replaceChildren(h('div', { class: 'locked calm' }, icon('check'), h('p', {}, 'Nothing to show for these filters.')));
      return;
    }
    body.replaceChildren(h('ul', { class: 'action-list' }, shown.map(({ r, issues }) => {
      const done = reviewed.has(r.id);
      return h('li', { class: 'action-card' },
        h('div', { class: 'action-head' },
          h('div', {}, h('h3', {}, `${r.code} · ${r.section}`), h('p', { class: 'card-sub' }, `${r.title} · ${r.faculty}`)),
          chip(issues[0].level)),
        h('ul', { class: 'issues' }, issues.map(i => h('li', {},
          h('p', {}, h('b', {}, `${i.title}. `), i.why), h('p', { class: 'next' }, i.next)))),
        h('div', { class: 'action-foot' },
          h('button', { type: 'button', class: 'btn ghost small', onclick: e => openDrawer(r, e.currentTarget) }, 'View details'),
          h('button', {
            type: 'button', class: 'btn ghost small',
            onclick: () => {
              if (done) reviewed.delete(r.id); else reviewed.add(r.id);
              saveReviewed(); renderActions(); renderBadges();
            }
          }, done ? 'Reopen' : 'Mark reviewed')));
    })));
  }

  /* ---------- Legends ---------- */
  function legend(target, items) {
    target.replaceChildren(...items.map(i => h('span', { class: 'legend-item' }, h('i', { class: `key ${i.key}` }), i.label)));
  }

  /* ---------- Visualization 1: scatter ---------- */
  const ZONE_LABEL = { priority: 'Priority review', teaching: 'Teaching support', student: 'Student support', ok: 'On track' };

  function renderScatter() {
    const box = $('#scatter');
    const width = box.clientWidth;
    if (!width) return;
    const height = width < 480 ? 300 : 330;
    const m = { t: 12, r: 14, b: 44, l: 44 };
    const rows = currentRows();
    const plotted = rows.filter(r => seteOf(r) !== null);
    const scoped = inScope();
    $('#scatterSub').textContent = `SETE rating against pass rate.${scoped ? ' Select a dot for details.' : ''}`;

    const xMin = Math.min(2.5, ...plotted.map(seteOf).map(v => Math.floor(v * 2) / 2));
    const yMin = Math.min(40, ...plotted.map(passOf).map(v => Math.floor(v / 10) * 10));
    const x = v => m.l + ((v - xMin) / (5 - xMin)) * (width - m.l - m.r);
    const y = v => height - m.b - ((v - yMin) / (100 - yMin)) * (height - m.t - m.b);

    const svg = s('svg', {
      width, height, viewBox: `0 0 ${width} ${height}`, role: 'group',
      'aria-label': `Scatter plot of ${plotted.length} classes by SETE rating and pass rate`
    });

    for (let v = xMin; v <= 5; v += .5) {
      svg.append(s('line', { x1: x(v), x2: x(v), y1: m.t, y2: height - m.b, class: 'grid' }));
      svg.append(s('text', { x: x(v), y: height - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, v.toFixed(1)));
    }
    for (let v = yMin; v <= 100; v += 20) {
      svg.append(s('line', { x1: m.l, x2: width - m.r, y1: y(v), y2: y(v), class: 'grid' }));
      svg.append(s('text', { x: m.l - 8, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, `${v}%`));
    }
    svg.append(s('line', { x1: x(T.sete), x2: x(T.sete), y1: m.t, y2: height - m.b, class: 'target-line' }));
    svg.append(s('line', { x1: m.l, x2: width - m.r, y1: y(T.pass), y2: y(T.pass), class: 'target-line' }));

    svg.append(s('text', { x: x(xMin) + 6, y: height - m.b - 8, class: 'zone-label' }, 'Priority review'));
    svg.append(s('text', { x: width - m.r - 6, y: height - m.b - 8, class: 'zone-label', 'text-anchor': 'end' }, 'Student support'));
    svg.append(s('text', { x: x(xMin) + 6, y: m.t + 14, class: 'zone-label' }, 'Teaching support'));
    svg.append(s('text', { x: width - m.r - 6, y: m.t + 14, class: 'zone-label', 'text-anchor': 'end' }, 'On track'));

    svg.append(s('text', { x: m.l + (width - m.l - m.r) / 2, y: height - 6, class: 'axis-title', 'text-anchor': 'middle' }, 'SETE rating (of 5)'));
    svg.append(s('text', { x: 12, y: m.t + (height - m.t - m.b) / 2, class: 'axis-title', 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + (height - m.t - m.b) / 2})` }, 'Pass rate'));

    plotted.forEach(r => {
      const sete = seteOf(r), pass = passOf(r), z = zone(r);
      const cx = x(sete), cy = y(pass);
      const flagged = z !== 'ok';
      const lowResp = responseOf(r) < T.response;
      const lines = scoped
        ? [{ value: sete.toFixed(2), label: 'SETE rating' }, { value: `${Math.round(pass)}%`, label: 'Pass rate' }, { value: `${Math.round(responseOf(r))}%`, label: 'Responded' }, { value: ZONE_LABEL[z], label: '' }]
        : [{ value: sete.toFixed(2), label: 'SETE rating' }, { value: `${Math.round(pass)}%`, label: 'Pass rate' }];
      const title = scoped ? `${r.code} · ${r.section}` : 'Class details restricted';
      const g = s('g', {
        class: `dot-group${scoped ? ' clickable' : ''}`,
        tabindex: scoped ? 0 : null,
        role: scoped ? 'button' : 'img',
        'aria-label': `${scoped ? `${r.code} section ${r.section}` : 'Class'}: SETE ${sete.toFixed(2)}, pass rate ${Math.round(pass)}%, ${ZONE_LABEL[z]}`,
        onpointermove: e => showTip(e.clientX, e.clientY, title, lines),
        onpointerleave: hideTip,
        onfocus: () => { const b = g.getBoundingClientRect(); showTip(b.left, b.top, title, lines); },
        onblur: hideTip,
        onclick: scoped ? () => { hideTip(); openDrawer(r, g); } : null,
        onkeydown: scoped ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(r, g); } } : null
      },
      s('circle', { cx, cy, r: 14, class: 'hit' }),
      s('circle', { cx, cy, r: 5.5, class: `dot ${flagged ? 'alert-mark' : 'ok-mark'}${lowResp ? ' hollow' : ''}` }));
      svg.append(g);
    });

    box.replaceChildren(svg);
    const hidden = rows.length - plotted.length;
    $('#scatterNote').textContent = hidden
      ? `${hidden} class${hidden > 1 ? 'es' : ''} not plotted: fewer than ${T.minResponses} SETE responses.`
      : (scoped ? 'Target lines: SETE 3.50 and pass rate 75%.' : 'Class and faculty details are hidden outside your program.');
    legend($('#scatterLegend'), [
      { key: 'dot-alert', label: 'Below a target' },
      { key: 'dot-ok', label: 'On track' },
      { key: 'dot-hollow', label: 'Under 50% responded' }
    ]);
  }

  /* ---------- Visualization 2: small-multiple lines ---------- */
  function benchName() { return state.dept === 'ALL' ? 'All colleges' : `${state.college} average`; }

  function trendData() {
    return DATA.dimensions.map((name, d) => ({
      name,
      current: weightedDim(currentRows(), d),
      program: DATA.regularTerms.map(x => weightedDim(rowsFor(x.ay, x.sem), d)),
      bench: DATA.regularTerms.map(x => {
        const list = DATA.records.filter(r => r.ay === x.ay && r.sem === x.sem &&
          (state.dept === 'ALL' || r.college === state.college));
        return weightedDim(list, d);
      })
    }));
  }

  function renderTrend() {
    const data = trendData();
    const sel = trendIndex();
    $('#trendNote').textContent = isSummer()
      ? `Charts show regular semesters only, because a summer term has just one course. The numbers above each chart are for ${SEM_NAMES[state.sem]}.`
      : '';
    $('#trendNote').hidden = !isSummer();
    const program = state.dept === 'ALL' ? `All ${state.college}` : DATA.colleges.find(c => c.id === state.college).departments.find(d => d.id === state.dept).short;
    legend($('#trendLegend'), [{ key: 'line-main', label: program }, { key: 'line-ref', label: benchName() }]);

    const box = $('#trend');
    const tableBox = $('#trendTable');
    box.hidden = state.trendTable;
    tableBox.hidden = !state.trendTable;
    $('#trendToggle').textContent = state.trendTable ? 'View charts' : 'View table';
    $('#trendToggle').setAttribute('aria-pressed', String(state.trendTable));

    if (state.trendTable) {
      tableBox.replaceChildren(h('table', { class: 'plain numeric' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Semester'), data.map(t => h('th', {}, t.name)))),
        h('tbody', {}, DATA.regularTerms.map((x, i) => h('tr', { class: i === sel ? 'current' : null },
          h('td', {}, semLabel(x)),
          data.map(t => h('td', {}, `${t.program[i].toFixed(2)} (${t.bench[i].toFixed(2)})`)))))));
      tableBox.prepend(h('p', { class: 'chart-note' }, `Each cell shows ${program}, then ${benchName()} in parentheses.`));
      return;
    }

    box.replaceChildren(...data.map(t => {
      const panel = h('figure', { class: 'mini' },
        h('figcaption', {}, h('span', {}, t.name), h('b', {}, t.current === null ? '–' : t.current.toFixed(2))),
        h('div', { class: 'mini-chart' }));
      return panel;
    }));
    // One y-scale shared by all panels, snapped to half points, so panels compare fairly.
    const allValues = data.flatMap(t => [...t.program, ...t.bench]);
    const lo = Math.floor(Math.min(...allValues) * 2) / 2;
    const hi = Math.min(5, Math.ceil(Math.max(...allValues) * 2) / 2);
    // Panels must be in the DOM before they can be measured.
    const crosshairs = [];
    const panels = $$('#trend .mini-chart');
    data.forEach((t, di) => {
      const holder = panels[di];
      const width = holder.clientWidth || 160;
      const height = 150;
      const m = { t: 8, r: 8, b: 20, l: 28 };
      const n = DATA.regularTerms.length;
      const x = i => m.l + (i * (width - m.l - m.r)) / (n - 1);
      const y = v => height - m.b - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (height - m.t - m.b);
      const line = vals => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');

      const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${t.name}: ${t.program.map((v, i) => `${semLabel(DATA.regularTerms[i])} ${v.toFixed(2)}`).join(', ')}` });
      [lo, (lo + hi) / 2, hi].forEach(v => {
        svg.append(s('line', { x1: m.l, x2: width - m.r, y1: y(v), y2: y(v), class: 'grid' }));
        svg.append(s('text', { x: m.l - 6, y: y(v) + 3.5, class: 'tick', 'text-anchor': 'end' }, v.toFixed(1)));
      });
      svg.append(s('text', { x: m.l, y: height - 5, class: 'tick' }, semLabel(DATA.regularTerms[0]).replace(' Sem', '')));
      svg.append(s('text', { x: width - m.r, y: height - 5, class: 'tick', 'text-anchor': 'end' }, semLabel(DATA.regularTerms[n - 1]).replace(' Sem', '')));
      svg.append(s('path', { d: line(t.bench), class: 'line ref' }));
      svg.append(s('path', { d: line(t.program), class: 'line main' }));
      if (sel >= 0) svg.append(s('circle', { cx: x(sel), cy: y(t.program[sel]), r: 4.5, class: 'line-dot' }));

      const cross = s('line', { y1: m.t, y2: height - m.b, class: 'cross', visibility: 'hidden' });
      svg.append(cross);
      crosshairs.push({ cross, x });

      const overlay = s('rect', { x: m.l - 8, y: 0, width: width - m.l - m.r + 16, height: height - m.b + 4, class: 'overlay' });
      const move = e => {
        const b = svg.getBoundingClientRect();
        const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - b.left - m.l) / (width - m.l - m.r)) * (n - 1))));
        crosshairs.forEach(c => { c.cross.setAttribute('x1', c.x(i)); c.cross.setAttribute('x2', c.x(i)); c.cross.setAttribute('visibility', 'visible'); });
        showTip(e.clientX, e.clientY, `${t.name} · ${semLabel(DATA.regularTerms[i])}`, [
          { key: 'line-main', value: t.program[i].toFixed(2), label: program },
          { key: 'line-ref', value: t.bench[i].toFixed(2), label: benchName() }
        ]);
      };
      overlay.addEventListener('pointermove', move);
      overlay.addEventListener('pointerdown', move);
      overlay.addEventListener('pointerleave', () => {
        crosshairs.forEach(c => c.cross.setAttribute('visibility', 'hidden'));
        hideTip();
      });
      svg.append(overlay);
      holder.replaceChildren(svg);
    });
  }

  /* ---------- Visualization 3: bars ---------- */
  function renderBars() {
    const groups = new Map();
    currentRows().forEach(r => {
      if (!groups.has(r.code)) groups.set(r.code, { code: r.code, title: r.title, enrolled: 0, passed: 0, sections: 0 });
      const g = groups.get(r.code);
      g.enrolled += r.enrolled; g.passed += r.passed; g.sections += 1;
    });
    const list = [...groups.values()].map(g => ({ ...g, pass: pct(g.passed, g.enrolled) })).sort((a, b) => a.pass - b.pass);
    const box = $('#bars');
    const scoped = inScope();
    $('#barsSub').textContent = `Lowest first.${scoped ? ' Select a course to open its classes.' : ''}`;
    const LIMIT = 8;
    const shown = state.barsAll ? list : list.slice(0, LIMIT);
    box.replaceChildren(...shown.map(g => {
      const below = g.pass < T.pass;
      const content = [
        h('span', { class: 'bar-label' }, h('b', {}, g.code), h('span', {}, g.title)),
        h('span', { class: 'bar-track' },
          h('span', { class: `bar-fill ${below ? 'alert-mark' : 'ok-mark'}`, style: `width:${g.pass.toFixed(1)}%` }),
          h('span', { class: 'bar-target', style: `left:${T.pass}%` })),
        h('span', { class: 'bar-value' }, below ? icon('warn') : null, `${Math.round(g.pass)}%`)
      ];
      const lines = [{ value: `${Math.round(g.pass)}%`, label: 'Pass rate' }, { value: `${g.passed} of ${g.enrolled}`, label: `students, ${g.sections} section${g.sections > 1 ? 's' : ''}` }];
      const handlers = {
        onpointermove: e => showTip(e.clientX, e.clientY, `${g.code} ${g.title}`, lines),
        onpointerleave: hideTip
      };
      if (!scoped) return h('div', { class: 'bar-row', ...handlers }, content);
      return h('button', {
        type: 'button',
        class: 'bar-row',
        ...handlers,
        onclick: () => {
          hideTip();
          openCourse(g.code);
        }
      }, content);
    }));
    if (list.length > LIMIT) {
      box.append(h('button', {
        type: 'button', class: 'link-btn bars-more',
        onclick: () => { state.barsAll = !state.barsAll; renderBars(); }
      }, state.barsAll ? 'Show lowest 8' : `Show all ${list.length} courses`));
    }
    legend($('#barsLegend'), [
      { key: 'bar-alert', label: 'Below 75% target' },
      { key: 'bar-ok', label: 'At or above target' },
      { key: 'tick-target', label: '75% target' }
    ]);
  }

  function openCourse(code) {
    state.course = code;
    state.search = '';
    state.flagged = false;
    state.yearLevel = 'all';
    $('#search').value = '';
    goTab('classes');
  }

  /* ---------- Section planning ---------- */
  const fillOf = r => (r.enrolled / r.capacity) * 100;

  function renderPlanning() {
    const box = $('#planning');
    const rows = currentRows();
    $('#planningSub').textContent = isSummer()
      ? 'Based on enrollment against a capacity of 45 students per section.'
      : 'Based on enrollment against section capacity: 45 students, or 30 for smaller NSTP components.';
    const full = rows.filter(r => fillOf(r) >= 100).sort((a, b) => fillOf(b) - fillOf(a));
    // A block takes its courses together, so low enrollment is a decision about the whole block.
    const blocks = new Map();
    rows.filter(r => fillOf(r) < T.fillLow).forEach(r => {
      if (!blocks.has(r.section)) blocks.set(r.section, []);
      blocks.get(r.section).push(r);
    });
    const item = (title, detail, advice) => h('li', {},
      h('b', {}, title), h('span', {}, detail), h('span', { class: 'next' }, advice));
    const blockAdvice = list => {
      const r = list[0];
      const others = rows.filter(x => x.code === r.code && x.section !== r.section);
      if (!others.length) return 'No other section offers these courses. Check whether they must still run.';
      const fits = others.find(x => x.enrolled + r.enrolled <= x.capacity);
      if (fits) return `Could merge with ${fits.section}: ${fits.enrolled + r.enrolled} of ${fits.capacity} students combined.`;
      const other = others[0];
      return `Merging with ${other.section} would exceed capacity (${other.enrolled + r.enrolled} of ${other.capacity}). Consider rebalancing students between the sections instead.`;
    };
    const lowItems = [...blocks.entries()].map(([section, list]) => {
      const size = Math.round(avg(list.map(r => r.enrolled)));
      return item(section, `About ${size} of ${list[0].capacity} students in ${list.length} course${list.length > 1 ? 's' : ''}`, blockAdvice(list));
    });
    const fullItems = full.map(r => item(`${r.code} · ${r.section}`,
      `${r.enrolled} of ${r.capacity} students (${Math.round(fillOf(r))}%)`,
      `Full or over capacity. Check demand for ${r.code} next term.`));
    const group = (title, items, empty) => h('div', { class: 'plan-group' },
      h('h3', {}, title),
      items.length ? h('ul', { class: 'plan-list' }, items) : h('p', { class: 'chart-note' }, empty));
    box.replaceChildren(h('div', { class: 'plan-grid' },
      group('Consider opening a section', fullItems, 'No section is at capacity.'),
      group('Low enrollment', lowItems, `No section is below ${T.fillLow}% full.`)));
  }

  /* ---------- Faculty page ---------- */
  function facultySummary() {
    const groups = new Map();
    // Service courses belong to other departments, so their faculty are not the chair's to assign.
    currentRows().filter(r => !r.service).forEach(r => {
      if (!groups.has(r.faculty)) groups.set(r.faculty, []);
      groups.get(r.faculty).push(r);
    });
    const prev = previousTerm();
    return [...groups.entries()].map(([name, rows]) => {
      // Other teaching and admin units are regular-semester loads.
      const profile = isSummer() ? { ...DATA.faculty[name], otherUnits: 0 } : DATA.faculty[name];
      const programUnits = sum(rows, r => r.units);
      const enrolled = sum(rows, r => r.enrolled);
      const dims = DATA.dimensions.map((_, d) => weightedDim(rows, d));
      const known = dims.filter(v => v !== null);
      const prevRows = prev ? rowsFor(prev.ay, prev.sem).filter(r => r.faculty === name) : [];
      const f = {
        name, profile, rows, programUnits,
        units: programUnits + profile.otherUnits,
        preps: new Set(rows.map(r => r.code)).size,
        sete: weightedSete(rows),
        prevSete: prevRows.length ? weightedSete(prevRows) : null,
        response: pct(sum(rows, r => r.responses), enrolled),
        pass: pct(sum(rows, r => r.passed), enrolled),
        dims,
        weakest: known.length ? DATA.dimensions[dims.indexOf(Math.min(...known))] : null
      };
      f.support = facultySupport(f);
      return f;
    }).sort((a, b) => supportRank(b) - supportRank(a) || (a.sete || 0) - (b.sete || 0));
  }

  function facultySupport(f) {
    const out = [];
    if (f.sete !== null && f.sete < T.sete) {
      out.push({ level: 'warning', label: 'Offer mentoring', text: `SETE is ${f.sete.toFixed(2)}. Consider mentoring or peer observation focused on ${f.weakest.toLowerCase()}.` });
    }
    if (f.pass < T.pass && (f.sete === null || f.sete >= T.sete)) {
      out.push({ level: 'warning', label: 'Check class support', text: `Pass rate is ${Math.round(f.pass)}% while SETE is at target. Check prerequisites and remedial options with the faculty member.` });
    }
    if (f.response < T.response) {
      out.push({ level: 'caution', label: 'Low response', text: `Only ${Math.round(f.response)}% of students responded, so read the score with caution. Encourage participation next term.` });
    }
    if (!isSummer() && f.units > T.loadMax) {
      out.push({ level: 'warning', label: 'Review load', text: `${f.units} units is above the ${T.loadMax}-unit limit. Consider moving a class next term.` });
    }
    if (!isSummer() && f.units <= T.loadRoom) {
      out.push({ level: 'caution', label: 'Has room', text: `${f.units} units leaves room for another class next term, if the specialization fits.` });
    }
    // A mentor needs a trustworthy score, healthy class results and time to spare.
    if (!isSummer() && f.sete !== null && f.sete >= T.mentorSete && f.units <= T.loadMax && f.pass >= T.pass && f.response >= T.response) {
      out.push({ level: 'good', label: 'Possible mentor', text: `SETE is ${f.sete.toFixed(2)} with a ${Math.round(f.pass)}% pass rate and a manageable load. Consider inviting them to mentor a colleague.` });
    }
    return out;
  }
  const supportRank = f => f.support.filter(x => x.level === 'warning').length;

  function renderFaculty() {
    const body = $('#facultyBody');
    const summary = $('#facultySummary');
    summary.hidden = !inScope();
    if (!inScope()) {
      $('#facultySub').textContent = 'Restricted for this selection';
      body.replaceChildren(lockMessage(RESTRICTED));
      return;
    }
    const list = facultySummary();
    const has = label => list.filter(f => f.support.some(x => x.label === label)).length;
    const programClasses = currentRows().filter(r => !r.service).length;
    $('#facultySub').textContent = isSummer()
      ? 'Units cover summer classes only, and the regular load limit does not apply. Select a row for details.'
      : `Load limit: ${T.loadMax} units, including teaching outside ${USER.short} and admin designations. Faculty from other departments who teach general and service courses are not listed. Select a row for details.`;
    const tile = (label, value, note) => h('article', { class: 'tile-stat' }, h('span', {}, label), h('b', {}, String(value)), h('small', {}, note));
    const seteAverage = weightedSete(currentRows());
    summary.classList.toggle('three', isSummer());
    summary.replaceChildren(...(isSummer()
      ? [
        tile('Teaching this term', list.length, `${programClasses} classes`),
        tile('Mentoring suggested', has('Offer mentoring'), `SETE below ${T.sete.toFixed(2)}`),
        tile('Average SETE', seteAverage === null ? '–' : seteAverage.toFixed(2), 'This summer term')
      ]
      : [
        tile('Teaching this term', list.length, `${programClasses} classes`),
        tile('Above the load limit', has('Review load'), `Over ${T.loadMax} units`),
        tile('Room for another class', has('Has room'), `${T.loadRoom} units or fewer`),
        tile('Mentoring suggested', has('Offer mentoring'), `SETE below ${T.sete.toFixed(2)}`)
      ]));

    const cell = (label, cls, ...content) => h('td', { 'data-label': label, class: cls }, ...content);
    const head = ['Faculty', 'Classes', 'Units', 'SETE', 'Responded', 'Pass rate', 'Weakest dimension', 'Suggested support'];
    const numeric = ['Units', 'SETE', 'Responded', 'Pass rate'];
    const rows = list.map(f => {
      const tr = h('tr', {
        tabindex: 0, class: 'row', 'aria-label': `Open details for ${f.name}`,
        onclick: () => openFaculty(f, tr),
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFaculty(f, tr); } }
      },
      cell('Faculty', 'class-cell', h('b', {}, f.name), h('span', {}, `${f.profile.rank} · ${f.profile.status}`)),
      cell('Classes', null, `${f.rows.length} class${f.rows.length > 1 ? 'es' : ''}`, h('small', {}, ` ${f.preps} prep${f.preps > 1 ? 's' : ''}`)),
      cell('Units', `num${f.units > T.loadMax ? ' below' : ''}`, String(f.units)),
      cell('SETE', `num${f.sete !== null && f.sete < T.sete ? ' below' : ''}`, f.sete === null ? h('span', { class: 'muted' }, 'Hidden') : f.sete.toFixed(2)),
      cell('Responded', `num${f.response < T.response ? ' below' : ''}`, `${Math.round(f.response)}%`),
      cell('Pass rate', `num${f.pass < T.pass ? ' below' : ''}`, `${Math.round(f.pass)}%`),
      cell('Weakest dimension', null, f.weakest || '–'),
      cell('Suggested support', 'support-cell', f.support.length
        ? h('span', { class: 'chips' }, f.support.map(x => chip(x.level, x.label)))
        : h('span', { class: 'muted' }, 'None needed')));
      return tr;
    });
    body.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'classes faculty-table' },
      h('thead', {}, h('tr', {}, head.map(t => h('th', { scope: 'col', class: numeric.includes(t) ? 'num' : null }, h('span', { class: 'th-label' }, t))))),
      h('tbody', {}, rows))),
    h('p', { class: 'caveat table-caveat' }, icon('info'), 'SETE reflects student perceptions. Use these suggestions to start a conversation, and do not use them alone for personnel decisions.'));
  }

  function openFaculty(f, from) {
    lastFocus = from || null;
    $('#drawerTitle').textContent = f.name;
    $('#drawerSub').textContent = [f.profile.rank, f.profile.status, f.profile.specialization, f.profile.designation].filter(Boolean).join(' · ');
    const peers = currentRows();
    $('#drawerBody').replaceChildren(
      h('div', { class: 'stats' },
        statBox('Teaching load', `${f.units} units`, `${f.programUnits} in ${USER.short}, ${f.profile.otherUnits} other`, f.units > T.loadMax),
        statBox('SETE', f.sete === null ? 'Hidden' : f.sete.toFixed(2), f.sete !== null && f.prevSete !== null ? `${f.prevSete.toFixed(2)} in ${semLabel(previousTerm())}` : 'of 5', f.sete !== null && f.sete < T.sete),
        statBox('Responded', `${Math.round(f.response)}%`, 'across all classes', f.response < T.response),
        statBox('Pass rate', `${Math.round(f.pass)}%`, 'across all classes', f.pass < T.pass)),
      h('section', {}, h('h3', {}, 'Suggested support'),
        f.support.length
          ? h('ul', { class: 'issues' }, f.support.map(x => h('li', {}, chip(x.level, x.label), h('p', {}, x.text))))
          : h('p', { class: 'calm-line' }, icon('check'), 'No action suggested this term.')),
      h('section', {}, h('h3', {}, 'SETE by dimension'),
        f.sete === null
          ? h('div', { class: 'locked' }, icon('lock'), h('p', {}, `Hidden: no class reached the minimum of ${T.minResponses} responses.`))
          : [h('p', { class: 'chart-note' }, 'The tick on each bar marks the program average.'), dimBars(f.dims, peers)]),
      h('section', {}, h('h3', {}, `Classes this term (${f.rows.length})`),
        h('ul', { class: 'mini-classes' }, f.rows.map(r => h('li', {}, h('button', {
          type: 'button', onclick: () => openDrawer(r, from)
        }, h('span', {}, h('b', {}, `${r.code} · ${r.section}`), h('small', {}, r.title)), chip(levelOf(r))))))),
      h('p', { class: 'caveat' }, icon('info'), 'SETE reflects student perceptions. Read it with grades, peer observation and self-assessment, and do not use it alone for personnel decisions.'));
    showDrawer();
  }

  /* ---------- SETE results page ---------- */
  function renderSete() {
    const scoped = inScope();
    $('#seteTop').hidden = !scoped;
    $('#seteCoursesCard').hidden = !scoped;
    const locked = $('#seteLocked');
    locked.hidden = scoped;
    if (!scoped) {
      locked.replaceChildren(h('section', { class: 'card' }, lockMessage('Course-level SETE results are available only for your assigned program (BS IT). Overview shows the aggregates for this selection.')));
      return;
    }
    const rows = currentRows();
    const prev = previousTerm();
    const prevRows = prev ? rowsFor(prev.ay, prev.sem) : [];
    const collegeRows = DATA.records.filter(r => r.ay === state.ay && r.sem === state.sem && r.college === state.college);
    const dims = DATA.dimensions.map((name, d) => ({
      name,
      value: weightedDim(rows, d),
      prev: prev ? weightedDim(prevRows, d) : null,
      college: weightedDim(collegeRows, d)
    }));
    const weakest = dims.reduce((a, b) => (b.value < a.value ? b : a));
    const strongest = dims.reduce((a, b) => (b.value > a.value ? b : a));
    $('#seteDimSub').textContent = `Strongest: ${strongest.name.toLowerCase()}. Weakest: ${weakest.name.toLowerCase()}.`;

    $('#seteDims').replaceChildren(
      h('div', { class: 'dims' }, dims.map(x => h('div', { class: 'dim-row sete-dim' },
        h('span', { class: 'dim-name' }, x.name),
        h('span', { class: 'bar-track' },
          h('span', { class: `bar-fill ${x.value < T.sete ? 'alert-mark' : 'ok-mark'}`, style: `width:${(x.value / 5) * 100}%` }),
          h('span', { class: 'bar-target peer', style: `left:${(x.college / 5) * 100}%` })),
        h('b', {}, x.value.toFixed(2)),
        h('small', { class: `dim-change ${x.prev === null ? '' : x.value - x.prev >= 0 ? 'better' : 'worse'}` },
          x.prev === null ? 'First term' : `${x.value - x.prev >= 0 ? '+' : '−'}${Math.abs(x.value - x.prev).toFixed(2)}`)))),
      h('p', { class: 'chart-note' }, `The tick marks the ${state.college} average. The last column shows the change from ${prev ? semLabel(prev) : 'the previous term'}.`));

    const tally = tone => {
      const map = new Map();
      rated(rows).forEach(r => r.themes.filter(t => t.tone === tone).forEach(t => map.set(t.label, (map.get(t.label) || 0) + t.count)));
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    const themeGroup = (title, tone, iconName) => h('div', {},
      h('h3', { class: 'theme-title' }, title),
      h('ul', { class: 'themes' }, tally(tone).map(([label, count]) => h('li', { class: tone }, icon(iconName), h('span', {}, label), h('b', {}, `${count} mentions`)))));
    $('#seteThemes').replaceChildren(
      themeGroup('Areas to improve', 'concern', 'info'),
      themeGroup('Strengths', 'strength', 'check'),
      h('p', { class: 'chart-note' }, 'Grouped from written comments across classes with at least 5 responses. Original comments are not shown.'));

    const groups = new Map();
    rows.forEach(r => {
      if (!groups.has(r.code)) groups.set(r.code, []);
      groups.get(r.code).push(r);
    });
    const scoreCell = v => h('td', { class: `num${v !== null && v < T.sete ? ' below' : ''}` }, v === null ? h('span', { class: 'muted' }, 'Hidden') : v.toFixed(2));
    const courseRows = [...groups.entries()]
      .map(([code, list]) => ({ code, list, overall: weightedSete(list), title: `${list[0].title} · ${YEAR_NAMES[list[0].year]}` }))
      .sort((a, b) => (a.overall === null) - (b.overall === null) || a.overall - b.overall);
    $('#seteCourses').replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'plain sete-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Course'), h('th', { class: 'num' }, 'Responded'), h('th', { class: 'num' }, 'Overall'),
        DATA.dimensions.map(d => h('th', { class: 'num' }, d)))),
      h('tbody', {}, courseRows.map(c => {
        const enrolled = sum(c.list, r => r.enrolled);
        const responses = sum(c.list, r => r.responses);
        const rate = pct(responses, enrolled);
        const tr = h('tr', {
          class: 'row', tabindex: 0, 'aria-label': `Open classes for ${c.code}`,
          onclick: () => openCourse(c.code),
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCourse(c.code); } }
        },
        h('td', { class: 'class-cell' }, h('b', {}, c.code), h('span', {}, c.title)),
        h('td', { class: `num${rate < T.response ? ' below' : ''}` }, `${Math.round(rate)}%`, h('small', {}, ` ${responses}/${enrolled}`)),
        scoreCell(c.overall),
        DATA.dimensions.map((_, d) => scoreCell(weightedDim(c.list, d))));
        return tr;
      })))));
  }

  /* ---------- Class table ---------- */
  const COLUMNS = [
    { key: 'code', label: 'Class', get: r => r.code },
    { key: 'faculty', label: 'Faculty', get: r => r.faculty },
    { key: 'enrolled', label: 'Enrolled', num: true, get: r => fillOf(r) },
    { key: 'sete', label: 'SETE', num: true, get: r => seteOf(r) },
    { key: 'response', label: 'Responded', num: true, get: r => responseOf(r) },
    { key: 'pass', label: 'Pass rate', num: true, get: r => passOf(r) },
    { key: 'midterm', label: 'Midterm fails', num: true, get: r => midtermShare(r) },
    { key: 'grades', label: 'Grades', get: r => r.lateDays },
    { key: 'level', label: 'Status', get: r => LEVELS[levelOf(r)].rank }
  ];

  function tableRows() {
    const q = state.search.trim().toLowerCase();
    const col = COLUMNS.find(c => c.key === state.sort.key);
    return currentRows()
      .filter(r => !state.course || r.code === state.course)
      .filter(r => state.yearLevel === 'all' || r.year === state.yearLevel)
      .filter(r => !state.flagged || levelOf(r) !== 'good')
      .filter(r => !q || `${r.code} ${r.title} ${r.section} ${r.faculty}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = col.get(a), bv = col.get(b);
        if (av === null) return 1;
        if (bv === null) return -1;
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
        return cmp * state.sort.dir || passOf(a) - passOf(b);
      });
  }

  function renderTable() {
    const body = $('#classesBody');
    const tools = $('#tableTools');
    const chipBtn = $('#courseChip');
    tools.hidden = !inScope();
    $('#planningCard').hidden = !inScope();
    if (!inScope()) {
      $('#classesSub').textContent = 'Restricted for this selection';
      body.replaceChildren(lockMessage(RESTRICTED));
      return;
    }
    renderPlanning();
    chipBtn.hidden = !state.course;
    if (state.course) chipBtn.replaceChildren(`Course: ${state.course}`, icon('close'));
    $('#flaggedBtn').setAttribute('aria-pressed', String(state.flagged));
    const years = [...new Set(currentRows().map(r => r.year))].sort();
    $('#yearLevels').replaceChildren(segmented(
      [{ value: 'all', label: 'All years' }, ...years.map(y => ({ value: y, label: YEAR_NAMES[y] }))],
      state.yearLevel, v => { state.yearLevel = v; renderTable(); }, 'Filter by year level'));

    const rows = tableRows();
    $('#classesSub').textContent = `${rows.length} of ${currentRows().length} classes shown. Select a row for details.`;
    if (!rows.length) {
      body.replaceChildren(h('div', { class: 'locked calm' }, icon('search'), h('p', {}, 'No classes match. Clear the search or filters to see more.')));
      return;
    }

    const head = h('tr', {}, COLUMNS.map(c => {
      const active = state.sort.key === c.key;
      return h('th', {
        scope: 'col', class: c.num ? 'num' : null,
        'aria-sort': active ? (state.sort.dir === 1 ? 'ascending' : 'descending') : null
      }, h('button', {
        type: 'button', class: `sort-btn${active ? ' active' : ''}`,
        onclick: () => {
          state.sort = active ? { key: c.key, dir: -state.sort.dir } : { key: c.key, dir: c.num || c.key === 'level' ? -1 : 1 };
          renderTable();
        }
      }, c.label, active ? icon(state.sort.dir === 1 ? 'up' : 'down') : null));
    }));

    const cell = (label, cls, ...content) => h('td', { 'data-label': label, class: cls }, ...content);
    const tbody = rows.map(r => {
      const sete = seteOf(r);
      const lowResp = responseOf(r) < T.response;
      const tr = h('tr', {
        tabindex: 0, class: 'row',
        'aria-label': `Open details for ${r.code} section ${r.section}`,
        onclick: () => openDrawer(r, tr),
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(r, tr); } }
      },
      cell('Class', 'class-cell', h('b', {}, `${r.code} · ${r.section}`), h('span', {}, `${r.title} · ${YEAR_NAMES[r.year]} · ${r.units} units`)),
      cell('Faculty', null, r.faculty),
      cell('Enrolled', `num${fillOf(r) >= 100 || fillOf(r) < T.fillLow ? ' below' : ''}`, `${r.enrolled}`, h('small', {}, ` /${r.capacity}`)),
      cell('SETE', `num${sete !== null && sete < T.sete ? ' below' : ''}`, sete === null ? h('span', { class: 'muted' }, 'Hidden') : sete.toFixed(2)),
      cell('Responded', `num${lowResp ? ' below' : ''}`, `${Math.round(responseOf(r))}%`, h('small', {}, ` ${r.responses}/${r.enrolled}`)),
      cell('Pass rate', `num${passOf(r) < T.pass ? ' below' : ''}`, `${Math.round(passOf(r))}%`),
      cell('Midterm fails', `num${midtermShare(r) >= T.midtermClass ? ' below' : ''}`, String(r.midtermFail)),
      cell('Grades', r.lateDays ? 'below' : null, r.lateDays ? `${r.lateDays} day${r.lateDays > 1 ? 's' : ''} late` : 'On time'),
      cell('Status', null, chip(levelOf(r))));
      return tr;
    });
    body.replaceChildren(h('div', { class: 'table-wrap' },
      h('table', { class: 'classes' }, h('thead', {}, head), h('tbody', {}, tbody))));
  }

  /* ---------- Class details panel ---------- */
  let lastFocus = null;

  function showDrawer() {
    addLabels();
    const dlg = $('#drawer');
    // The faculty panel can open a class panel while already showing.
    if (!dlg.open) dlg.showModal();
    $('#drawerBody').scrollTop = 0;
  }

  const statBox = (label, value, note, bad) => h('div', { class: `stat${bad ? ' below' : ''}` }, h('span', {}, label), h('b', {}, value), h('small', {}, note));

  function dimBars(values, peers) {
    return h('div', { class: 'dims' }, DATA.dimensions.map((name, d) => {
      const peer = weightedDim(peers, d);
      const v = values[d];
      return h('div', { class: 'dim-row' },
        h('span', { class: 'dim-name' }, name),
        h('span', { class: 'bar-track' },
          h('span', { class: `bar-fill ${v < T.sete ? 'alert-mark' : 'ok-mark'}`, style: `width:${(v / 5) * 100}%` }),
          h('span', { class: 'bar-target peer', style: `left:${(peer / 5) * 100}%`, title: `Program average ${peer.toFixed(2)}` })),
        h('b', {}, v.toFixed(2)));
    }));
  }

  function openDrawer(r, from) {
    lastFocus = from || null;
    const sete = seteOf(r);
    const issues = assess(r);
    const peers = rowsFor(r.ay, r.sem);
    $('#drawerTitle').textContent = `${r.code} · ${r.section}`;
    $('#drawerSub').textContent = `${r.title} · ${YEAR_NAMES[r.year]} · ${r.units} units · ${r.faculty} · ${semLabel(r, true)}`;

    const dims = sete === null
      ? h('div', { class: 'locked' }, icon('lock'), h('p', {}, `Hidden to protect student anonymity: only ${r.responses} of ${r.enrolled} students responded, below the minimum of ${T.minResponses}.`))
      : dimBars(r.ratings, peers);

    const themes = sete !== null && r.themes.length
      ? h('section', {}, h('h3', {}, 'Comment themes'),
        h('ul', { class: 'themes' }, r.themes.map(t => h('li', { class: t.tone },
          icon(t.tone === 'strength' ? 'check' : 'info'), h('span', {}, t.label), h('b', {}, `${t.count} mentions`)))),
        h('p', { class: 'chart-note' }, 'Grouped into themes. Original comments are not shown, so students cannot be identified from their wording.'))
      : null;

    const actions = issues.length
      ? h('section', {}, h('h3', {}, 'Why this was flagged, and what to do'),
        h('ul', { class: 'issues' }, issues.map(i => h('li', {},
          chip(i.level), h('p', {}, h('b', {}, `${i.title}. `), i.why), h('p', { class: 'next' }, i.next)))))
      : h('section', {}, h('h3', {}, 'Status'), h('p', { class: 'calm-line' }, icon('check'), 'This class meets every target.'));

    // The same course and section in earlier terms shows whether a concern is new or recurring.
    const termIndex = x => DATA.semesters.findIndex(t => t.ay === x.ay && t.sem === x.sem);
    const past = DATA.records
      .filter(x => x.dept === r.dept && x.code === r.code && x.section === r.section && termIndex(x) < termIndex(r))
      .sort((a, b) => termIndex(b) - termIndex(a))
      .slice(0, 3);
    const belowBefore = past.filter(x => passOf(x) < T.pass || (seteOf(x) !== null && seteOf(x) < T.sete)).length;
    const history = past.length
      ? h('section', {}, h('h3', {}, 'Previous offerings'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'plain numeric' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Term'), h('th', {}, 'SETE'), h('th', {}, 'Responded'), h('th', {}, 'Pass rate'))),
          h('tbody', {}, past.map(x => h('tr', {},
            h('td', {}, semLabel(x)),
            h('td', {}, seteOf(x) === null ? 'Hidden' : seteOf(x).toFixed(2)),
            h('td', {}, `${Math.round(responseOf(x))}%`),
            h('td', {}, `${Math.round(passOf(x))}%`)))))),
        h('p', { class: 'chart-note' }, belowBefore
          ? `Below a target in ${belowBefore} of the last ${past.length} offering${past.length > 1 ? 's' : ''}.`
          : `At target in the last ${past.length} offering${past.length > 1 ? 's' : ''}.`))
      : null;

    const grades = h('section', {}, h('h3', {}, 'Final grades'),
      h('div', { class: 'grade-grid' },
        [['Passed', r.passed], ['Failed', r.failed], ['Incomplete', r.inc], ['Dropped', r.dropped]]
          .map(([label, value]) => h('div', {}, h('b', {}, String(value)), h('span', {}, label)))),
      h('p', { class: 'chart-note' }, `Average grade ${r.avgGrade.toFixed(2)}, where 1.00 is the highest and 3.00 is the lowest passing grade. Grades submitted ${r.lateDays ? `${r.lateDays} day${r.lateDays > 1 ? 's' : ''} late` : 'on time'}.`));

    $('#drawerBody').replaceChildren(
      h('div', { class: 'stats' },
        statBox('SETE', sete === null ? 'Hidden' : sete.toFixed(2), 'of 5', sete !== null && sete < T.sete),
        statBox('Responded', `${Math.round(responseOf(r))}%`, `${r.responses} of ${r.enrolled}`, responseOf(r) < T.response),
        statBox('Pass rate', `${Math.round(passOf(r))}%`, `${r.passed} of ${r.enrolled}`, passOf(r) < T.pass),
        statBox('Midterm fails', String(r.midtermFail), `${Math.round(midtermShare(r))}% of class`, midtermShare(r) >= T.midtermClass)),
      actions,
      grades,
      history,
      h('section', {}, h('h3', {}, 'SETE by dimension'),
        sete !== null ? h('p', { class: 'chart-note' }, 'The tick on each bar marks the program average.') : null,
        dims),
      themes,
      h('p', { class: 'caveat' }, icon('info'), 'SETE reflects student perceptions. Read it with grades, peer observation and self-assessment, and do not use it alone for personnel decisions.')
    );
    showDrawer();
  }

  /* ---------- Component labels ---------- */
  function addLabels() {
    $$('[data-note]').forEach(node => {
      if (node.querySelector(':scope > .note-tag')) return;
      const n = node.getAttribute('data-note');
      // A <button> KPI card can't contain another button, so its tag is a plain marker.
      if (node.tagName === 'BUTTON') {
        node.prepend(h('span', { class: 'note-tag', 'aria-hidden': 'true' }, n));
        return;
      }
      node.prepend(h('button', {
        type: 'button', class: 'note-tag', 'aria-label': `Read design note ${n}`,
        onclick: e => { e.stopPropagation(); openNotes(n); }
      }, n));
    });
  }
  function openNotes(n) {
    const dlg = $('#notes');
    if ($('#drawer').open) $('#drawer').close();
    dlg.showModal();
    $$('#notes .component-list li').forEach(li => li.classList.remove('hit-note'));
    if (n) {
      const item = $(`#note-${n}`);
      item.classList.add('hit-note');
      item.scrollIntoView({ block: 'center' });
    } else {
      $('#notes .sheet-body').scrollTop = 0;
    }
  }

  /* ---------- Tabs ---------- */
  const tabFromHash = () => {
    const id = location.hash.slice(1);
    return Object.prototype.hasOwnProperty.call(TABS, id) ? id : 'overview';
  };

  function showTab() {
    const next = tabFromHash();
    const changed = next !== state.tab;
    // A course filter belongs to one trip to the Classes page.
    if (changed && state.tab === 'classes') state.course = null;
    state.tab = next;
    $$('[data-view]').forEach(v => { v.hidden = v.getAttribute('data-view') !== next; });
    $$('[data-nav]').forEach(a => {
      const on = a.getAttribute('data-nav') === next;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = next === 'overview' ? 'BatStat Dashboard' : `${TABS[next].title[0]} · BatStat`;
    hideTip();
    renderContext();
    renderView();
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function goTab(id) {
    if (location.hash === `#${id}`) showTab();
    else location.hash = id;
  }

  /* ---------- Render + events ---------- */
  function renderCharts() {
    if (state.tab !== 'overview') return;
    renderScatter();
    renderTrend();
  }

  function renderView() {
    if (state.tab === 'overview') {
      renderKpis();
      renderAlerts();
      renderBars();
      renderCharts();
    } else if (state.tab === 'actions') renderActions();
    else if (state.tab === 'classes') renderTable();
    else if (state.tab === 'faculty') renderFaculty();
    else if (state.tab === 'sete') renderSete();
    addLabels();
  }

  function renderAll() {
    renderFilters();
    renderContext();
    renderBadges();
    renderView();
  }

  function onFilter(key, value) {
    state[key] = value;
    state.course = null;
    state.barsAll = false;
    state.yearLevel = 'all';
    renderAll();
  }

  $('#fAy').addEventListener('change', e => onFilter('ay', e.target.value));
  $('#fSem').addEventListener('change', e => onFilter('sem', Number(e.target.value)));
  $('#resetBtn').addEventListener('click', () => {
    Object.assign(state, DEFAULTS, { course: null, search: '', flagged: false, actionLevel: 'all', actionStatus: 'open', yearLevel: 'all', barsAll: false, sort: { key: 'level', dir: -1 } });
    $('#search').value = '';
    renderAll();
  });
  $('#labelsBtn').addEventListener('click', e => {
    const on = document.body.classList.toggle('show-labels');
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.textContent = on ? 'Hide component labels' : 'Show component labels';
    // Labels describe the one-page dashboard, so show them there.
    if (on) goTab('overview');
  });
  window.addEventListener('hashchange', showTab);
  $('#trendToggle').addEventListener('click', () => { state.trendTable = !state.trendTable; renderTrend(); });
  $('#search').addEventListener('input', e => { state.search = e.target.value; renderTable(); });
  $('#flaggedBtn').addEventListener('click', () => { state.flagged = !state.flagged; renderTable(); });
  $('#courseChip').addEventListener('click', () => { state.course = null; renderTable(); });

  $$('[data-open-notes]').forEach(b => b.addEventListener('click', () => openNotes()));
  $$('dialog').forEach(dlg => {
    dlg.addEventListener('click', e => {
      // A click on the backdrop lands on the dialog element itself.
      if (e.target === dlg) dlg.close();
    });
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => {
      if (lastFocus && document.contains(lastFocus) && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    });
  });

  let resizeTimer;
  let lastWidth = 0;
  new ResizeObserver(entries => {
    const w = entries[0].contentRect.width;
    if (Math.abs(w - lastWidth) < 1) return;
    lastWidth = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCharts, 80);
  }).observe($('.main'));

  renderFilters();
  renderBadges();
  showTab();
})();

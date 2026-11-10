/* BatStat test runner: a tiny, dependency-free harness.
   Each test gets a freshly loaded copy of the dashboard in an iframe, so tests never share state.
   Results render on the page, and a plain-text summary lands in #report for headless runs. */
(function () {
  const suites = [];
  let current = null;

  window.suite = (name, fn) => {
    current = { name, tests: [] };
    suites.push(current);
    fn();
    current = null;
  };
  window.test = (name, fn) => current.tests.push({ name, fn });

  /* ---------- Assertions ---------- */
  class AssertionError extends Error {}
  const fmt = v => (typeof v === 'string' ? JSON.stringify(v) : String(v));
  window.expect = (actual, label) => {
    const fail = msg => { throw new AssertionError(`${label ? label + ': ' : ''}${msg}`); };
    return {
      toBe: v => { if (actual !== v) fail(`expected ${fmt(v)}, got ${fmt(actual)}`); },
      toEqual: v => { if (JSON.stringify(actual) !== JSON.stringify(v)) fail(`expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`); },
      toBeTruthy: () => { if (!actual) fail(`expected a truthy value, got ${fmt(actual)}`); },
      toBeFalsy: () => { if (actual) fail(`expected a falsy value, got ${fmt(actual)}`); },
      toBeGreaterThan: v => { if (!(actual > v)) fail(`expected > ${v}, got ${fmt(actual)}`); },
      toBeAtLeast: v => { if (!(actual >= v)) fail(`expected >= ${v}, got ${fmt(actual)}`); },
      toBeAtMost: v => { if (!(actual <= v)) fail(`expected <= ${v}, got ${fmt(actual)}`); },
      toBeBetween: (lo, hi) => { if (!(actual >= lo && actual <= hi)) fail(`expected between ${lo} and ${hi}, got ${fmt(actual)}`); },
      toContain: v => { if (!String(actual).includes(v)) fail(`expected to contain ${fmt(v)}, got ${fmt(actual)}`); },
      toMatch: re => { if (!re.test(String(actual))) fail(`expected to match ${re}, got ${fmt(actual)}`); },
      toBeCloseTo: (v, tol = 0.005) => { if (Math.abs(actual - v) > tol) fail(`expected ~${v} (±${tol}), got ${fmt(actual)}`); }
    };
  };

  /* ---------- Fixtures ---------- */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.wait = wait;
  const stage = () => document.getElementById('stage');

  // Load the dashboard at a given width and hash. Returns helpers bound to that copy of the app.
  window.openApp = async ({ width = 1400, height = 900, hash = 'overview' } = {}) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = `width:${width}px;height:${height}px`;
    frame.title = 'Dashboard under test';
    const loaded = new Promise(r => frame.addEventListener('load', r, { once: true }));
    frame.src = `../index.html#${hash}`;
    stage().replaceChildren(frame);
    await loaded;
    const w = frame.contentWindow, d = frame.contentDocument;
    const errors = [];
    w.addEventListener('error', e => errors.push(e.message));
    // Reviewed alerts persist per browser; tests start from a clean slate.
    try { w.localStorage.removeItem('batstat.reviewed'); } catch (e) { /* storage unavailable */ }
    await wait(250);
    const app = {
      w, d, frame, errors,
      $: s => d.querySelector(s),
      $$: s => [...d.querySelectorAll(s)],
      text: s => (d.querySelector(s)?.textContent || '').trim(),
      data: w.BATSTAT_DATA,
      async go(tab) { w.location.hash = tab; await wait(120); },
      async select(sel, value) {
        const el = d.querySelector(sel);
        el.value = String(value);
        el.dispatchEvent(new Event('change'));
        await wait(120);
      },
      async click(target) {
        const el = typeof target === 'string' ? d.querySelector(target) : target;
        if (!el) throw new AssertionError(`nothing to click: ${target}`);
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await wait(120);
      },
      async key(el, key) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        await wait(120);
      },
      async reload() { localStorageReset(w); w.location.reload(); await wait(400); }
    };
    return app;
  };
  function localStorageReset(w) { try { w.localStorage.removeItem('batstat.reviewed'); } catch (e) { /* ignore */ } }

  /* ---------- Run + report ---------- */
  function row(status, suiteName, name, detail) {
    const li = document.createElement('li');
    li.className = status;
    li.innerHTML = `<span class="badge">${status === 'pass' ? 'PASS' : 'FAIL'}</span><span class="name"></span><span class="detail"></span>`;
    li.querySelector('.name').textContent = `${suiteName} › ${name}`;
    li.querySelector('.detail').textContent = detail || '';
    return li;
  }

  window.runAll = async () => {
    const list = document.getElementById('results');
    const summary = document.getElementById('summary');
    const report = [];
    let pass = 0, fail = 0;
    const started = performance.now();

    // A file:// page cannot read a file:// iframe in normal browsers; explain instead of failing oddly.
    if (location.protocol === 'file:' && !navigator.webdriver) {
      try {
        const probe = await openApp({ width: 400 });
        probe.d.body; // throws when blocked
      } catch (e) {
        summary.textContent = 'Open this page through the local server, e.g. http://localhost/dashboard/tests/ (browsers block file:// frames), or run tests/run-tests.sh.';
        summary.className = 'summary fail';
        return;
      }
    }

    for (const s of suites) {
      const head = document.createElement('li');
      head.className = 'suite';
      head.textContent = s.name;
      list.append(head);
      for (const t of s.tests) {
        try {
          await t.fn();
          pass++;
          list.append(row('pass', s.name, t.name));
          report.push(`PASS  ${s.name} › ${t.name}`);
        } catch (e) {
          fail++;
          const msg = e instanceof AssertionError ? e.message : `${e.name}: ${e.message}`;
          list.append(row('fail', s.name, t.name, msg));
          report.push(`FAIL  ${s.name} › ${t.name}\n      ${msg}`);
        }
        summary.textContent = `${pass} passed, ${fail} failed…`;
      }
    }
    stage().replaceChildren();
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    summary.textContent = `${pass} passed, ${fail} failed, ${pass + fail} tests in ${secs}s`;
    summary.className = `summary ${fail ? 'fail' : 'pass'}`;
    document.getElementById('report').textContent =
      `${report.join('\n')}\n\nRESULT: ${pass} passed, ${fail} failed, ${pass + fail} total`;
    document.title = fail ? `FAIL ${fail} · BatStat tests` : `PASS ${pass} · BatStat tests`;
  };
})();

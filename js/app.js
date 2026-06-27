/* =============================================================================
 * app.js  —  UI orchestration, rendering and PDF export
 * ========================================================================== */
(function () {
  'use strict';

  const state = { boy: null, girl: null, results: null, fromJd: null };

  /* ---------------- helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fix = (n, d = 2) => Number(n).toFixed(d);

  function chip(label, cls) { return `<span class="chip ${cls || ''}">${esc(label)}</span>`; }
  function gauge(label, val, max, cls) {
    const pct = Math.round((val / max) * 100);
    const c = cls || (pct >= 60 ? 'good' : pct >= 42 ? 'mid' : 'bad');
    return `<div class="gauge"><div class="lbl"><span>${esc(label)}</span><span>${val}/${max}</span></div>
      <div class="bar"><div class="fill ${c}" style="width:${pct}%"></div></div></div>`;
  }
  function gaugePct(label, pct, cls) {
    const c = cls || (pct >= 60 ? 'good' : pct >= 42 ? 'mid' : 'bad');
    return `<div class="gauge"><div class="lbl"><span>${esc(label)}</span><span>${pct}%</span></div>
      <div class="bar"><div class="fill ${c}" style="width:${pct}%"></div></div></div>`;
  }
  function degStr(deg) {
    const d = Math.floor(deg); const m = Math.floor((deg - d) * 60);
    return `${d}°${String(m).padStart(2, '0')}'`;
  }
  function nowDMY() {
    const d = new Date();
    const mon = Dasha.MONTHS ? Dasha.MONTHS[d.getMonth()] : (d.getMonth() + 1);
    return `${d.getDate()} ${mon} ${d.getFullYear()}`;
  }

  /* ---------------- tabs ---------------- */
  function setTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) setTab(btn.dataset.tab);
  });

  /* ---------------- input ---------------- */
  function readInput(prefix) {
    const v = (id) => parseFloat($(prefix + id).value);
    return {
      name: $(prefix + 'name').value || (prefix === 'b_' ? 'Groom' : 'Bride'),
      place: $(prefix + 'place').value,
      y: v('y'), m: v('m'), d: v('d'),
      hour: v('h'), min: v('min'), sec: 0,
      tzOffsetHours: v('tz'), lat: v('lat'), lonEast: v('lon'),
    };
  }

  $('loadSample').addEventListener('click', () => {
    const set = (id, val) => ($(id).value = val);
    set('b_name', 'Arjun'); set('b_y', 1990); set('b_m', 6); set('b_d', 15);
    set('b_h', 10); set('b_min', 30); set('b_tz', 5.5); set('b_lat', 19.07); set('b_lon', 72.87); set('b_place', 'Mumbai, India');
    set('g_name', 'Priya'); set('g_y', 1993); set('g_m', 11); set('g_d', 22);
    set('g_h', 14); set('g_min', 15); set('g_tz', 5.5); set('g_lat', 28.61); set('g_lon', 77.21); set('g_place', 'New Delhi, India');
  });

  /* ---------------- mode (Couple / Individual) ---------------- */
  state.mode = 'couple';
  state.who = 'boy';
  function applyModeUI() {
    const boyFs = document.querySelector('fieldset.boy');
    const girlFs = document.querySelector('fieldset.girl');
    const whoSeg = $('whoSeg');
    if (state.mode === 'couple') {
      if (whoSeg) whoSeg.style.display = 'none';
      [boyFs, girlFs].forEach((f) => { if (f) { f.disabled = false; f.classList.remove('fs-disabled'); } });
    } else {
      if (whoSeg) whoSeg.style.display = '';
      const boyActive = state.who === 'boy';
      if (boyFs) { boyFs.disabled = !boyActive; boyFs.classList.toggle('fs-disabled', !boyActive); }
      if (girlFs) { girlFs.disabled = boyActive; girlFs.classList.toggle('fs-disabled', boyActive); }
    }
    document.querySelectorAll('#modeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    document.querySelectorAll('#whoSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.who === state.who));
  }
  const _modeSeg = $('modeSeg');
  if (_modeSeg) _modeSeg.addEventListener('click', (e) => { const b = e.target.closest('.seg-btn'); if (!b) return; state.mode = b.dataset.mode; applyModeUI(); });
  const _whoSeg = $('whoSeg');
  if (_whoSeg) _whoSeg.addEventListener('click', (e) => { const b = e.target.closest('.seg-btn'); if (!b) return; state.who = b.dataset.who; applyModeUI(); });
  applyModeUI();

  $('matchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      generate();
    } catch (err) {
      alert('Calculation error: ' + err.message);
      console.error(err);
    }
    if (state.results) setTab('charts');
  });

  /* ---------------- generate ---------------- */
  function generate() {
    const today = new Date();
    state.fromJd = Astro.julianDay(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate(), 0);
    state.fcFromJd = state.fromJd; state.fcYears = 20;
    if (state.mode === 'individual') { generateIndividual(); return; }

    const bi = readInput('b_'); const gi = readInput('g_');
    const boy = Astro.buildChart(bi); boy.meta = bi;
    const girl = Astro.buildChart(gi); girl.meta = gi;
    state.boy = boy; state.girl = girl;

    const r = {};
    r.koota = Koota.fullMatch(boy, girl);
    r.kuja = (typeof KujaDosha !== 'undefined') ? KujaDosha.couple(boy, girl) : null;
    r.bphs = BPHS.coupleAssessment(boy, girl);
    r.kp = KP.coupleAssessment(boy, girl);
    r.health = Health.compatibility(boy, girl);
    r.window = Timeline.coupleMarriageWindow(boy, girl, state.fromJd);
    r.kpTiming = { boy: Timeline.kpMarriageWindow(boy, state.fromJd, 20), girl: Timeline.kpMarriageWindow(girl, state.fromJd, 20) };
    r.forecast = Timeline.relationshipForecast(boy, girl, state.fromJd, 20);
    r.bhavaB = BPHS.analyzeAll(boy);
    r.bhavaG = BPHS.analyzeAll(girl);
    r.kpB = KP.assess(boy); r.kpG = KP.assess(girl);
    r.transitB = Transit.summary(boy, state.fromJd, 20);
    r.transitG = Transit.summary(girl, state.fromJd, 20);
    r.sarvashtaka = Sarvashtaka.coupleAnalysis(boy, girl);
    r.progeny = Progeny.couple(boy, girl, state.fromJd, 20);
    r.strengthSeries = Timeline.strengthSeries(boy, girl, state.fromJd, 20, 3);
    r.strengthDual = Timeline.strengthSeriesDual(boy, girl, state.fromJd, 20, 3);
    state.results = r;

    const safeRender = (fn, name) => { try { fn(); } catch(e) { console.warn(name + ' render error:', e); } };
    safeRender(renderSummary, 'Summary');
    safeRender(renderCharts, 'Charts');
    safeRender(renderBhava, 'Bhava');
    safeRender(renderBPHS, 'BPHS');
    safeRender(renderKP, 'KP');
    safeRender(renderKoota, 'Koota');
    safeRender(renderKuja, 'Kuja');
    safeRender(renderTiming, 'Timing');
    safeRender(renderForecast, 'Forecast');
    safeRender(renderTransit, 'Transit');
    safeRender(renderHealth, 'Health');
    safeRender(renderSarvashtaka, 'Sarvashtaka');
    safeRender(renderProgeny, 'Progeny');
    safeRender(renderReport, 'Report');
  }

  /* ================= INDIVIDUAL (single-person) analysis ================= */
  function generateIndividual() {
    const who = state.who;
    const gender = who === 'boy' ? 'male' : 'female';
    const input = readInput(who === 'boy' ? 'b_' : 'g_');
    const chart = Astro.buildChart(input); chart.meta = input;
    state.boy = who === 'boy' ? chart : null;
    state.girl = who === 'girl' ? chart : null;
    state.subject = chart; state.subjectGender = gender;
    state.subjectRole = who === 'boy' ? 'Groom' : 'Bride';
    const name = `${input.name} (${state.subjectRole})`;

    const r = { individual: true, who, gender, chart, name };
    r.bphsRows = BPHS.analyzeAll(chart);
    r.bphsIndex = BPHS.marriageIndex(chart, gender);
    r.kp = KP.assess(chart);
    r.health = Health.screen(chart);
    r.kuja = KujaDosha.analyze(chart);
    r.separation = Separation.analyze(chart, gender);
    r.window = Timeline.marriageWindow(chart, gender, state.fromJd);
    r.kpTiming = Timeline.kpMarriageWindow(chart, state.fromJd, 20);
    r.single = Timeline.strengthSeriesSingle(chart, gender, state.fromJd, 20, 3);
    r.transit = Transit.summary(chart, state.fromJd, 20);
    r.progeny = Progeny.analyze(chart, gender, state.fromJd, 20);
    state.results = r;

    const SR = (fn, n) => { try { fn(); } catch (e) { console.warn(n + ' (indiv) render error:', e); } };
    SR(renderSummaryIndividual, 'Summary');
    SR(() => { $('tab-charts').innerHTML = `<div class="card"><h2>${esc(name)} — D1 / D9 / KP Charts</h2>${header(chart)}${ChartDraw.renderTriple(chart, input.name)}</div><div class="card"><h2>Planetary Positions</h2>${header(chart)}${planetTable(chart)}</div><div class="card"><h3>How to read this</h3><p class="small muted">Sidereal (Lahiri) Rāśi positions; KP chart uses Placidus + ${esc(chart.kp.ayanamsaName)} ayanamsa.</p></div>`; }, 'Charts');
    SR(renderBhavaIndividual, 'Bhava');
    SR(renderBPHSIndividual, 'BPHS');
    SR(renderKPIndividual, 'KP');
    SR(() => { $('tab-koota').innerHTML = `<div class="card"><h2>Koota Matching</h2><div class="callout">Koota (Guna Milan) compares <b>two</b> charts, so it is not applicable to an individual analysis. The native's Moon is shown for reference.</div><div class="kv"><span>Moon</span><span>${chart.planets.Moon.signName} — ${chart.planets.Moon.nak} (pada ${chart.planets.Moon.pada})</span></div></div>`; }, 'Koota');
    SR(renderKujaIndividual, 'Kuja');
    SR(renderTimingIndividual, 'Timing');
    SR(renderForecastIndividual, 'Forecast');
    SR(() => { $('tab-transit').innerHTML = `<div class="card"><h2>Gochara (Transit) Outlook — ${esc(name)}</h2>${header(chart)}${transitTable(r.transit)}</div>`; }, 'Transit');
    SR(renderHealthIndividual, 'Health');
    SR(renderSavIndividual, 'Sarvashtaka');
    SR(renderProgenyIndividual, 'Progeny');
    SR(renderReportIndividual, 'Report');
  }

  function renderSummaryIndividual() {
    const r = state.results; const idx = r.bphsIndex.index; const v = BPHS.verdict(idx);
    const near = (r.window && r.window.nearest) ? `${Dasha.fmtDMY(r.window.nearest.startJd)} – ${Dasha.fmtDMY(r.window.nearest.endJd)}` : '—';
    $('summaryCard').style.display = 'block';
    $('summaryContent').innerHTML = `
      <div class="grid-3">
        <div class="card" style="margin:0;text-align:center">
          <div class="big-score">${idx}<small>/100</small></div>
          <div style="margin-top:8px">${chip(v.label, v.cls)}</div>
          <div class="muted small" style="margin-top:6px">${esc(r.name)} — individual marriage prospects (BPHS)</div>
        </div>
        <div class="card" style="margin:0">
          ${gaugePct('KP marriage promise', r.kp.promise.confidence)}
          ${gaugePct('Health (overall)', r.health.overall)}
          ${gaugePct('Kuja Dosha (net)', r.kuja.netIntensity, r.kuja.netIntensity >= 22 ? 'bad' : (r.kuja.netIntensity >= 12 ? 'mid' : 'good'))}
        </div>
        <div class="card" style="margin:0">
          ${gaugePct('Separation / Divorce risk', r.separation.overallRisk, r.separation.overallRisk >= 50 ? 'bad' : (r.separation.overallRisk >= 30 ? 'mid' : 'good'))}
          <div class="kv"><span>Nearest marriage window</span><span>${near}</span></div>
        </div>
      </div>
      <p class="muted small">Individual analysis — the partner is not considered. Use the tabs for the native's house study,
        BPHS &amp; KP marriage prospects, dasha/transit timing, Kuja dosha, separation promise and health.</p>`;
  }

  function renderBhavaIndividual() {
    const r = state.results; const chart = r.chart;
    let cards = '';
    for (let h = 1; h <= 12; h++) {
      const it = BhavaIndications.interpretHouse(h, chart);
      const vv = BPHS.verdict(it.score);
      cards += `<div class="card bhava-house-card">
        <div class="bhava-house-header"><h3>${esc(it.houseName)}</h3><div>${chip(vv.label, vv.cls)} <span class="muted small">${it.score}/100</span></div></div>
        <div class="bhava-domain"><b>${esc(it.domain)}</b></div>
        <div class="bhava-what-indicates"><p class="small muted" style="margin:6px 0 4px"><b>What this house indicates:</b></p><ul class="small muted">${it.generalIndicates.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
        <div class="bhava-sign-info"><span class="bhava-sign-badge">${esc(it.signName)}</span><span class="muted small">Lord: <b>${it.lord}</b> in H${it.lordHouse} (${esc(it.lordDignity)})</span></div>
        <div class="bhava-chars">${it.characteristics.map((c) => `<p class="small bhava-char-item">• ${esc(c)}</p>`).join('')}</div>
      </div>`;
    }
    $('tab-bhava').innerHTML = `<div class="card"><h2>House-by-House Significations — ${esc(r.name)}</h2>${header(chart)}<div class="kv"><span>Lagna</span><span>${chart.ascendant.signName} (${degStr(chart.ascendant.degInSign)})</span></div></div>${cards}`;
  }

  function renderBPHSIndividual() {
    const r = state.results; const chart = r.chart; const mi = r.bphsIndex; const gender = r.gender;
    let cards = '';
    [7, 2, 11, 5, 8, 4, 12, 1, 9].forEach((h) => { cards += bphsHouseCard(r.name, bphsHouseDetail(chart, h, gender), h); });
    const v = BPHS.verdict(mi.index);
    $('tab-bphs').innerHTML = `
      <div class="card"><h2>BPHS Marriage Assessment — ${esc(r.name)}</h2>${header(chart)}
        <div style="margin:8px 0">${chip(v.label, v.cls)} &nbsp; Marriage index <b>${mi.index}/100</b></div>
        ${gaugePct('Marriage index', mi.index)}
        <div class="kv"><span>${gender === 'female' ? 'Jupiter (husband kāraka)' : 'Venus (love kāraka)'} dignity</span><span><b>${esc(gender === 'female' ? mi.jupiterDignity.label : mi.venusDignity.label)}</b></span></div>
        <div class="kv"><span>7th-house afflictions</span><span>${mi.seventhAfflictions} planet(s)</span></div>
      </div>
      <div class="card"><h3>House-by-house (marriage-relevant), chart-specific</h3>${cards}</div>`;
  }

  function renderKPIndividual() {
    const r = state.results; const b = r.kp; const chart = r.chart;
    $('tab-kp').innerHTML = `
      <div class="card"><h2>KP Assessment — ${esc(r.name)}</h2>
        <div class="callout small">Placidus house system + <b>${esc(chart.kp.ayanamsaName)}</b> ayanamsa.</div>
        <div class="kv"><span>7th cusp sub-lord</span><span><b>${b.promise.subLord}</b></span></div>
        <div class="kv"><span>Signifies houses</span><span>${b.promise.sigHouses.join(', ')}</span></div>
        <div class="kv"><span>Marriage houses (2/7/11)</span><span>${b.promise.matched.join(', ') || 'none'}</span></div>
        <div style="margin-top:8px">${chip(b.verdict.label, b.verdict.cls)} — ${b.promise.confidence}%</div>
        <h3>Marriage significators</h3><p class="small">${b.significators.slice(0, 6).map((s) => `${s.planet} (${s.strength})`).join(', ')}</p>
      </div>
      <div class="card"><h3>Cuspal sub-lords (2,7,11,5,8)</h3>${kpCuspTable(b)}</div>`;
  }

  function renderKujaIndividual() {
    const r = state.results;
    $('tab-kuja').innerHTML = `
      <div class="card"><h2>Kuja (Maṅgala) Dosha — ${esc(r.name)}</h2>
        <p class="small muted">Manglik = Mars in the 1st, 2nd, 4th, 7th, 8th or 12th from Lagna, Moon or Venus (D1). Cancellations (Bhaṅga) reduce the effective dosha.</p></div>
      <div class="grid-2">${kujaPartnerCard(r.name, r.kuja)}</div>`;
  }

  function renderTimingIndividual() {
    const r = state.results; const w = r.window;
    let rows = '';
    (w.topByScore || []).forEach((t) => { rows += `<tr><td>${Dasha.fmtDMY(t.startJd)} – ${Dasha.fmtDMY(t.endJd)}</td><td>${t.md}/${t.ad}/${t.pd}</td><td class="num">${fix(t.score, 1)}</td></tr>`; });
    const near = (w.nearest) ? `${Dasha.fmtDMY(w.nearest.startJd)} – ${Dasha.fmtDMY(w.nearest.endJd)}` : '—';
    const pa = promiseAssessment(r.chart, r.gender);
    let html = `
      <div class="card"><h2>Is Marriage Promised? — ${esc(r.name)}</h2>
        <p class="small muted">Timing is shown only if marriage is promised. The native is assessed by <b>KP</b> (7th cusp sub-lord signifying 2/7/11)
          and <b>Parāśara</b> (7th house, its lord and the Venus/Jupiter kāraka).</p>
      </div>
      <div class="grid-2">${promiseCard(pa, r.name)}</div>`;
    if (!pa.promised) {
      html += `<div class="callout"><b>Timing withheld.</b> Marriage is not clearly promised for ${esc(r.name)} by KP or Parāśara,
        so predictive timing is not shown. Review the BPHS &amp; KP Assessment tabs; a qualified astrologer should confirm.</div>`;
      $('tab-timing').innerHTML = html;
      return;
    }
    html += `
      <div class="card"><h2>Marriage Timing — ${esc(r.name)}</h2>
        <div class="big-score" style="font-size:24px">${near}</div>
        <p class="small muted">Nearest favourable marriage window from the native's Vimśottari dasha + supportive transits.</p></div>
      <div class="card"><h3>Strongest marriage periods (next 20 years)</h3>
        <table><thead><tr><th>Window</th><th>MD/AD/PD</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h2 style="margin:6px 2px">KP-System Marriage Timing</h2>
      <div class="grid-2">${kpTimingCard(r.kpTiming, r.name)}</div>
      <div class="callout small">KP method: marriage fructifies in the conjoined <b>Daśā–Bhukti–Antara</b> of significators of houses
        <b>2, 7 &amp; 11</b>. Rows where all three lords are marriage significators are marked ✔ (strongest).</div>`;
    $('tab-timing').innerHTML = html;
  }

  function renderForecastIndividual() {
    const r = state.results;
    const ser = (r.single && r.single.series) || [];
    const avg = (k) => ser.length ? Math.round(ser.reduce((a, s) => a + s[k], 0) / ser.length) : 0;
    const fromJd = state.fcFromJd || state.fromJd; const yrs = state.fcYears || 20;
    const startISO = Dasha.fmtISO(fromJd); const todayISO = Dasha.fmtISO(state.fromJd);
    const isDefault = startISO === todayISO && yrs === 20;
    const s = r.separation;
    const facts = (arr, title) => arr.length ? `<p class="small" style="margin:4px 0"><b>${title}:</b></p>${arr.map((f) => `<p class="small bhava-char-item">• ${esc(f)}</p>`).join('')}` : `<p class="small muted">${title}: no significant indication.</p>`;
    $('tab-forecast').innerHTML = `
      <div class="card no-print"><h2>Forecast Timeframe (Backtesting)</h2>
        <p class="small muted">Default is today + 20 years; pick a different start date to backtest.</p>
        <div class="row-3" style="max-width:560px;align-items:end">
          <div><label>Start date</label><input type="date" id="fcStart" value="${startISO}" /></div>
          <div><label>Years</label><input type="number" id="fcYears" min="1" max="60" value="${yrs}" /></div>
          <div><button class="btn" id="fcUpdate" type="button">Update</button></div>
        </div>
        <div class="small" style="margin-top:6px">${isDefault ? '<span class="chip good">Default timeframe</span>' : `<span class="chip mid">Custom / backtest</span> <span class="muted">from ${Dasha.fmtDMY(fromJd)} for ${yrs} years</span> &nbsp;<span class="preset-link" id="fcReset">Reset</span>`}</div>
      </div>
      <div class="card"><h2>Marriage Commitment Over ${yrs} Years — ${esc(r.name)}</h2>
        <p class="small muted">The native's marriage commitment over time by <span class="kp-val">KP</span> and <span class="par-val">Parāśara</span>
          significators of the running dasha lords (scaled by planetary strength). Red bands mark separation/divorce/widowhood
          trigger windows (separative dasha + adverse transit).</p>
        ${ChartDraw.singleCommitment(ser, { name: r.name })}
        <div class="grid-2" style="margin-top:8px">
          <div class="card" style="margin:0"><div class="kv"><span>KP commitment (avg)</span><span><span class="kp-val">${avg('kp')}</span>/100</span></div></div>
          <div class="card" style="margin:0"><div class="kv"><span>Parāśara commitment (avg)</span><span><span class="par-val">${avg('par')}</span>/100</span></div></div>
        </div>
      </div>
      <div class="card"><h2>Promise of Separation / Divorce / Widowhood</h2>
        <div style="margin:4px 0 8px">${chip(s.verdict.label, s.verdict.cls)} <span class="muted small">overall risk ${s.overallRisk}/100</span></div>
        ${gaugePct('Separation risk', s.separation)}${gaugePct('Divorce risk', s.divorce)}${gaugePct('Widowhood / spouse-longevity caution', s.widowhood)}
        ${facts(s.d1Factors, 'D1 (Rāśi) indicators')}${facts(s.d9Factors, 'D9 (Navāṁśa) indicators')}${facts(s.kpFactors, 'KP indicators')}
      </div>`;
    const upd = $('fcUpdate'); if (upd) upd.addEventListener('click', updateForecastTimeframe);
    const rst = $('fcReset'); if (rst) rst.addEventListener('click', () => {
      state.fcFromJd = state.fromJd; state.fcYears = 20;
      r.single = Timeline.strengthSeriesSingle(r.chart, r.gender, state.fromJd, 20, 3);
      renderForecastIndividual();
    });
  }

  function renderHealthIndividual() {
    const r = state.results; const h = r.health;
    $('tab-health').innerHTML = `
      <div class="card"><h2>Health Screener — ${esc(r.name)}</h2>
        <p class="small muted">Astrological wellness indicators from the native's chart (not a medical diagnosis).</p></div>
      <div class="grid-2">${healthCard(r.name, h)}</div>`;
  }

  function renderSavIndividual() {
    const r = state.results; const chart = r.chart;
    const hs = Sarvashtaka.houseSAV(chart); const ma = Sarvashtaka.marriageAnalysis(chart);
    let mrows = '';
    [7, 2, 11, 5, 8].forEach((h) => { const d = ma.marriageStrength[h]; mrows += `<tr><td><b>H${h}</b></td><td>${d.signName}</td><td class="num">${d.bindus}</td><td>${chip(d.quality.label, d.quality.cls)}</td></tr>`; });
    let head = '<th>Planet</th>'; for (let h = 1; h <= 12; h++) head += `<th class="num">H${h}</th>`; head += '<th class="num">Tot</th>';
    let grows = '';
    Sarvashtaka.PLANETS_7.forEach((p) => { const row = hs.houseBavs[p]; const tot = row.reduce((a, b) => a + b, 0); grows += '<tr><td><b>' + p + '</b></td>' + row.map((v) => `<td class="num ${v >= 5 ? 'pass' : (v <= 2 ? 'fail' : '')}">${v}</td>`).join('') + `<td class="num"><b>${tot}</b></td></tr>`; });
    grows += '<tr style="border-top:2px solid var(--border)"><td><b>SAV</b></td>' + hs.houses.map((h) => `<td class="num ${h.bindus >= 28 ? 'pass' : (h.bindus < 25 ? 'fail' : '')}"><b>${h.bindus}</b></td>`).join('') + `<td class="num"><b>${hs.total}</b></td></tr>`;
    $('tab-sarvashtaka').innerHTML = `
      <div class="card"><h2>Sarvashtakavarga — ${esc(r.name)}</h2><div class="kv"><span>Total SAV bindus</span><span><b>${hs.total}</b></span></div>
        <h3>Marriage houses</h3><table><thead><tr><th>House</th><th>Sign</th><th class="num">Bindus</th><th>Quality</th></tr></thead><tbody>${mrows}</tbody></table></div>
      <div class="card"><h3>Bhinnashtakavarga (BAV) grid</h3><table class="bav-table"><thead><tr>${head}</tr></thead><tbody>${grows}</tbody></table></div>`;
  }

  function renderReportIndividual() {
    const r = state.results; const chart = r.chart;
    const idx = r.bphsIndex.index; const v = BPHS.verdict(idx);
    const grab = (id) => { const el = $('tab-' + id); return el ? el.innerHTML : ''; };
    const section = (t, id) => `<div class="report-section"><h2 class="report-section-title">${esc(t)}</h2>${grab(id)}</div>`;
    const near = (r.window && r.window.nearest) ? `${Dasha.fmtDMY(r.window.nearest.startJd)} – ${Dasha.fmtDMY(r.window.nearest.endJd)}` : '—';
    $('report-content').innerHTML = `
      <div class="card report-cover">
        <h2 style="text-align:center">Individual Marriage Analysis</h2>
        <p class="small muted" style="text-align:center">${esc(r.name)} — generated ${nowDMY()}</p>
        <div style="text-align:center;margin:10px 0"><span class="big-score">${idx}<small>/100</small></span><br/>${chip(v.label, v.cls)}</div>
        <table>
          <tr><th>Module</th><th>Result</th></tr>
          <tr><td>BPHS marriage index</td><td>${idx}/100 — ${v.label}</td></tr>
          <tr><td>KP marriage promise</td><td>${r.kp.promise.confidence}% — ${r.kp.verdict.label}</td></tr>
          <tr><td>Kuja Dosha (net)</td><td>${r.kuja.netIntensity}/100 — ${r.kuja.level.label}</td></tr>
          <tr><td>Separation / Divorce risk</td><td>${r.separation.overallRisk}/100 — ${r.separation.verdict.label}</td></tr>
          <tr><td>Health (overall)</td><td>${r.health.overall}/100</td></tr>
          <tr><td>Nearest marriage window</td><td>${near}</td></tr>
        </table>
        <div class="card" style="margin-top:14px"><h3>Birth Data</h3>${header(chart)}</div>
        <p class="dev-credit" style="margin-top:10px">Developed by <b>Dr. Anil Sabaji</b> &nbsp;•&nbsp; Email: anilsabaji@gmail.com</p>
      </div>
      ${section('1 · Charts (D1 / D9 / KP)', 'charts')}
      ${section('2 · House Significations', 'bhava')}
      ${section('3 · BPHS Assessment', 'bphs')}
      ${section('4 · KP Assessment', 'kp')}
      ${section('5 · Kuja (Maṅgala) Dosha', 'kuja')}
      ${section('6 · Marriage Timing', 'timing')}
      ${section('7 · Commitment &amp; Separation Forecast', 'forecast')}
      ${section('8 · Transits (Gochara)', 'transit')}
      ${section('9 · Health', 'health')}
      ${section('10 · Sarvashtakavarga', 'sarvashtaka')}
      ${section('11 · Progeny (Santāna)', 'progeny')}
      <p class="footer-note">For educational &amp; decision-support purposes only. Sidereal (Lahiri) calculations — Build v5.17</p>
      <p class="dev-credit footer-credit">By <b>Dr. Anil Sabaji</b>, Email: anilsabaji@gmail.com</p>`;
  }

  function overallScore() {
    const r = state.results;
    // weighted overall: koota 30%, bphs 20%, kp 20%, health 15%, timing readiness 15%
    const kootaPct = Math.round((r.koota.ashtakoota.total / 36) * 100);
    const v = kootaPct * 0.3 + r.bphs.combined * 0.2 + r.kp.combined * 0.2 + r.health.score * 0.15 +
      Math.min(98, Math.round(r.window.peak.joint * 12 + 40)) * 0.15;
    return Math.round(v);
  }
  function overallVerdict(s) {
    if (s >= 72) return { label: 'Highly Recommended Match', cls: 'good' };
    if (s >= 58) return { label: 'Recommended Match', cls: 'good' };
    if (s >= 45) return { label: 'Workable with Awareness', cls: 'mid' };
    return { label: 'Caution Advised', cls: 'bad' };
  }

  /* ---------------- summary ---------------- */
  function renderSummary() {
    const r = state.results;
    const s = overallScore(); const ov = overallVerdict(s);
    $('summaryCard').style.display = 'block';
    $('summaryContent').innerHTML = `
      <div class="grid-3">
        <div class="card" style="margin:0;text-align:center">
          <div class="big-score">${s}<small>/100</small></div>
          <div style="margin-top:8px">${chip(ov.label, ov.cls)}</div>
          <div class="muted small" style="margin-top:6px">Composite of Koota, BPHS, KP, Health &amp; Timing</div>
        </div>
        <div class="card" style="margin:0">
          ${gauge('Ashtakoota (Guna Milan)', r.koota.ashtakoota.total, 36)}
          ${gaugePct('Dashakoota (Porutham)', r.koota.dashakoota.percent)}
          ${gaugePct('BPHS marriage index', r.bphs.combined)}
        </div>
        <div class="card" style="margin:0">
          ${gaugePct('KP promise confidence', r.kp.combined)}
          ${gaugePct('Health compatibility', r.health.score)}
          ${gaugePct('Sarvashtakavarga (SAV)', r.sarvashtaka.score)}
          <div class="kv"><span>Nearest marriage window</span><span>${esc(r.window.nearestRange)}</span></div>
        </div>
      </div>
      ${r.koota.ashtakoota.doshas.length ? `<div class="callout warn"><b>Dosha alerts:</b> ${r.koota.ashtakoota.doshas.join(', ')} — see the Koota tab for remedial context.</div>` : ''}
      <p class="muted small">Use the tabs above for the full house-by-house study, KP cuspal analysis, dasha/transit forecast and the printable report.</p>
    `;
  }

  /* ---------------- charts ---------------- */
  function planetTable(chart) {
    let rows = '';
    Astro.PLANETS.forEach((p) => {
      const pl = chart.planets[p];
      rows += `<tr>
        <td><b>${p}</b>${pl.retro ? ' <span class="muted">(R)</span>' : ''}</td>
        <td>${pl.signName} ${degStr(pl.degInSign)}</td>
        <td class="num">${pl.house}</td>
        <td>${pl.nak} (${pl.pada})</td>
        <td>${pl.nakLord}</td>
        <td>${pl.subLord}</td>
      </tr>`;
    });
    const a = chart.ascendant;
    return `
      <div class="kv"><span>Ascendant (Lagna)</span><span>${a.signName} ${degStr(a.degInSign)} — ${a.nak} (${a.pada})</span></div>
      <div class="kv"><span>Moon</span><span>${chart.planets.Moon.signName} — ${chart.planets.Moon.nak} pada ${chart.planets.Moon.pada}</span></div>
      <div class="kv"><span>Ayanāṁśa (Lahiri)</span><span>${fix(chart.ayanamsa, 3)}°</span></div>
      <table><thead><tr><th>Planet</th><th>Sidereal Position</th><th class="num">House</th><th>Nakshatra (Pada)</th><th>Star Lord</th><th>Sub Lord</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }
  function header(chart) {
    const m = chart.meta;
    const mon = (typeof Dasha !== 'undefined' && Dasha.MONTHS) ? Dasha.MONTHS[m.m - 1] : m.m;
    return `<div class="muted small">${esc(m.name)} — ${m.d} ${mon} ${m.y}, ${String(m.hour).padStart(2,'0')}:${String(m.min).padStart(2,'0')} (TZ ${m.tzOffsetHours}h), ${esc(m.place)} [${fix(m.lat)}, ${fix(m.lonEast)}]</div>`;
  }
  function renderCharts() {
    const b = state.boy, g = state.girl;
    $('tab-charts').innerHTML = `
      <div class="card">
        <h2>Visual Charts — D1 Rāśi, D9 Navāṁśa, KP Placidus</h2>
        <p class="small muted">South-Indian style box charts. Lagna sign is highlighted. As = Ascendant. ᴿ = Retrograde.</p>
      </div>
      <div class="card">
        <h3>Groom Charts</h3>${header(b)}
        ${typeof ChartDraw !== 'undefined' ? ChartDraw.renderTriple(b, b.meta.name) : '<p class="muted">Chart renderer not loaded.</p>'}
      </div>
      <div class="card">
        <h3>Bride Charts</h3>${header(g)}
        ${typeof ChartDraw !== 'undefined' ? ChartDraw.renderTriple(g, g.meta.name) : '<p class="muted">Chart renderer not loaded.</p>'}
      </div>
      <div class="card">
        <h2>Planetary Positions — Groom</h2>${header(b)}${planetTable(b)}
      </div>
      <div class="card">
        <h2>Planetary Positions — Bride</h2>${header(g)}${planetTable(g)}
      </div>
      <div class="card"><h3>How to read this</h3><p class="small muted">Positions are sidereal (Lahiri). D1 uses Whole-Sign houses from the Lagna (BPHS frame). D9 (Navāṁśa) shows the 9th-harmonic divisional chart, critical for marriage assessment. KP chart places planets by Porphyry/Placidus cusp houses with house numbers (H1–H12) marked. "Star Lord" and "Sub Lord" are the Vimśottari nakshatra lord and KP sub-lord. (R) / ᴿ marks retrograde motion.</p></div>`;
  }

  /* ---------------- bhava ---------------- */
  function bhavaTable(rows) {
    let out = '';
    rows.forEach((r) => {
      const v = BPHS.verdict(r.score);
      out += `<tr>
        <td><b>${r.house}</b></td>
        <td>${esc(r.significationName)}<div class="muted small">${esc(r.themes)}</div></td>
        <td>${r.signName}</td>
        <td>${r.lord} <span class="muted small">(H${r.lordHouse}, ${esc(r.lordDignity)})</span></td>
        <td>${r.occupants.length ? r.occupants.join(', ') : '—'}</td>
        <td>${r.aspects.length ? r.aspects.join(', ') : '—'}</td>
        <td>${chip(v.label, v.cls)} <span class="muted small">${r.score}</span></td>
      </tr>`;
    });
    return `<table><thead><tr><th>Bhāva</th><th>Signification</th><th>Sign</th><th>Lord</th><th>Occupants</th><th>Aspected by</th><th>Strength</th></tr></thead><tbody>${out}</tbody></table>`;
  }

  function renderBhavaHouseCard(comp, boyName, girlName) {
    const b = comp.boy, g = comp.girl;
    return `
      <div class="card bhava-house-card">
        <div class="bhava-house-header">
          <h3>${esc(comp.houseName)}</h3>
          <div>${chip(comp.verdict.label, comp.verdict.cls)} <span class="muted small">${comp.compatibility}%</span></div>
        </div>
        <div class="bhava-domain"><b>${esc(comp.domain)}</b></div>
        <div class="bhava-what-indicates">
          <p class="small muted" style="margin:6px 0 4px"><b>What this house indicates:</b></p>
          <ul class="small muted">${comp.generalIndicates.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
          <p class="small" style="margin:4px 0; color:var(--accent-4)"><b>Marriage relevance:</b> ${esc(comp.marriageRelevance)}</p>
        </div>
        <div class="bhava-compare-grid">
          <div class="bhava-col bhava-col-boy">
            <div class="bhava-col-title boy-title">${esc(boyName)} (Groom)</div>
            <div class="bhava-sign-info">
              <span class="bhava-sign-badge">${esc(b.signName)}</span>
              <span class="muted small">Lord: <b>${b.lord}</b> in H${b.lordHouse} (${esc(b.lordDignity)})</span>
            </div>
            <div class="bhava-score-row">${gaugePct('Strength', b.score)}</div>
            <div class="bhava-chars">
              <p class="small" style="margin:4px 0"><b>Characteristics &amp; Indications:</b></p>
              ${b.characteristics.map((c) => `<p class="small bhava-char-item">• ${esc(c)}</p>`).join('')}
            </div>
          </div>
          <div class="bhava-col bhava-col-girl">
            <div class="bhava-col-title girl-title">${esc(girlName)} (Bride)</div>
            <div class="bhava-sign-info">
              <span class="bhava-sign-badge">${esc(g.signName)}</span>
              <span class="muted small">Lord: <b>${g.lord}</b> in H${g.lordHouse} (${esc(g.lordDignity)})</span>
            </div>
            <div class="bhava-score-row">${gaugePct('Strength', g.score)}</div>
            <div class="bhava-chars">
              <p class="small" style="margin:4px 0"><b>Characteristics &amp; Indications:</b></p>
              ${g.characteristics.map((c) => `<p class="small bhava-char-item">• ${esc(c)}</p>`).join('')}
            </div>
          </div>
        </div>
        <div class="bhava-result">
          <h3>Compatibility Result</h3>
          ${gaugePct('House ' + comp.houseNum + ' compatibility', comp.compatibility)}
          <div class="bhava-factors">
            ${comp.factors.map((f) => `<p class="small">• ${esc(f)}</p>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function renderBhava() {
    const comparison = BhavaIndications.compareAll(state.boy, state.girl);
    const boyName = state.boy.meta.name;
    const girlName = state.girl.meta.name;

    let houseCards = '';
    comparison.houses.forEach((comp) => {
      houseCards += renderBhavaHouseCard(comp, boyName, girlName);
    });

    $('tab-bhava').innerHTML = `
      <div class="card">
        <h2>House-by-House Matching — Side by Side</h2>
        <p class="small muted">Each of the 12 Bhāvas (houses) studied for both partners: what the house indicates,
          the characteristics/physical features/mentality it reveals for each person, shown side by side with
          the compatibility result.</p>
        <div style="margin:10px 0">
          ${gaugePct('Overall house-by-house compatibility', comparison.averageCompat)}
        </div>
        <div class="grid-2" style="margin-top:8px">
          <div class="kv"><span>Groom Lagna</span><span>${state.boy.ascendant.signName} (${degStr(state.boy.ascendant.degInSign)})</span></div>
          <div class="kv"><span>Bride Lagna</span><span>${state.girl.ascendant.signName} (${degStr(state.girl.ascendant.degInSign)})</span></div>
        </div>
      </div>
      ${houseCards}
      <div class="callout small">Each house comparison evaluates: elemental harmony of the signs, friendship between
        the lords, strength balance, benefic/malefic occupants, and Jupiter/Venus aspect blessings.
        Houses 7, 2, 11, 5 and 8 are most critical for marriage.</div>`;
  }
  /* ---------------- BPHS ---------------- */
  function marriageHouseMini(mi) {
    const cells = [['7th (Spouse)', mi.seventh], ['2nd (Family)', mi.second], ['11th (Fulfilment)', mi.eleventh], ['5th (Romance)', mi.fifth], ['8th (Intimacy)', mi.eighth]];
    return cells.map(([lbl, h]) => `<div class="kv"><span>${lbl}</span><span>${h.score}/100 — lord ${h.lord} in H${h.lordHouse}</span></div>`).join('');
  }

  function bphsHouseDetail(chart, houseNum, gender) {
    const s = BPHS.bhavaStrength(houseNum, chart);
    const v = BPHS.verdict(s.score);
    const karaka = gender === 'female' ? 'Jupiter' : 'Venus';

    // Build specific interpretation based on actual chart placements
    const interp = [];

    // Lord interpretation
    const lordDig = BPHS.dignity(s.lord, chart);
    if (lordDig.score >= 4) interp.push(`${s.lord} (lord) is ${lordDig.label} — strongly empowers this house's significations.`);
    else if (lordDig.score >= 2) interp.push(`${s.lord} (lord) in ${lordDig.label} — good support for this house.`);
    else if (lordDig.score <= -1) interp.push(`${s.lord} (lord) is ${lordDig.label} — weakens this house; remedial measures beneficial.`);
    else interp.push(`${s.lord} (lord) is in a ${lordDig.label} — neutral influence.`);

    // Lord placement
    if ([1, 4, 7, 10].includes(s.lordHouse)) interp.push(`Lord placed in kendra (H${s.lordHouse}) — gives strength and stability to this bhāva.`);
    else if ([5, 9].includes(s.lordHouse)) interp.push(`Lord placed in trikona (H${s.lordHouse}) — auspicious; dharmic support.`);
    else if ([6, 8, 12].includes(s.lordHouse)) interp.push(`Lord placed in dusthana (H${s.lordHouse}) — struggles and challenges in this area.`);
    else if (s.lordHouse === houseNum) interp.push(`Lord in own house — highly fortified; person strongly experiences this house's themes.`);

    // Occupants — specific readings
    if (s.occupants.length > 0) {
      s.occupants.forEach((p) => {
        const pDig = BPHS.dignity(p, chart);
        const retro = chart.planets[p].retro ? ' (retrograde — karmic, intensified)' : '';
        if (BPHS.NAT_BENEFIC.includes(p)) {
          interp.push(`${p}${retro} occupies this house (${pDig.label}) — benefic presence enhances positive outcomes.`);
        } else {
          interp.push(`${p}${retro} occupies this house (${pDig.label}) — malefic presence creates pressure; transforms through challenges.`);
        }
      });
    } else {
      interp.push('No planets occupy this house — results depend entirely on the lord\'s condition and aspects received.');
    }

    // Aspects — specific
    if (s.aspects.length > 0) {
      s.aspects.forEach((p) => {
        if (BPHS.NAT_BENEFIC.includes(p)) {
          interp.push(`${p} aspects this house — protective, enhancing influence.`);
        } else {
          interp.push(`${p} aspects this house — adds intensity and challenge.`);
        }
      });
    }

    // Marriage-karaka connection
    if (houseNum === 7) {
      const karakaPl = chart.planets[karaka];
      const karakaDig = BPHS.dignity(karaka, chart);
      interp.push(`Marriage kāraka ${karaka} is in ${karakaPl.signName} (H${karakaPl.house}, ${karakaDig.label}) — ${karakaDig.score >= 2 ? 'supports marital happiness' : 'needs attention for relationship fulfilment'}.`);
    }

    return { ...s, verdict: v, interp };
  }

  function bphsHouseCard(label, detail, houseNum) {
    const houseName = BPHS.BHAVA_SIGNIFICATIONS[houseNum] ? BPHS.BHAVA_SIGNIFICATIONS[houseNum].name : 'House ' + houseNum;
    return `
      <div class="kv"><span><b>H${houseNum}</b> ${esc(houseName)}</span><span>${chip(detail.verdict.label, detail.verdict.cls)} ${detail.score}/100</span></div>
      <div class="small" style="margin:4px 0 4px 8px; padding-left:10px; border-left:2px solid var(--border)">
        <div class="muted">Sign: <b>${detail.signName}</b> | Lord: <b>${detail.lord}</b> (H${detail.lordHouse}, ${esc(detail.lordDignity)}) | Occupants: ${detail.occupants.length ? detail.occupants.join(', ') : '—'} | Aspects: ${detail.aspects.length ? detail.aspects.join(', ') : '—'}</div>
        ${detail.interp.map((i) => `<p class="small" style="margin:2px 0">• ${esc(i)}</p>`).join('')}
      </div>`;
  }

  function renderBPHS() {
    const r = state.results; const b = r.bphs;
    const boy = state.boy, girl = state.girl;

    // Generate specific house assessments for all 12 houses
    const marriageHouses = [7, 2, 11, 5, 8, 4, 12, 1, 9];
    const boyDetails = marriageHouses.map((h) => bphsHouseDetail(boy, h, 'male'));
    const girlDetails = marriageHouses.map((h) => bphsHouseDetail(girl, h, 'female'));

    let boyHouseCards = '', girlHouseCards = '';
    marriageHouses.forEach((h, idx) => {
      boyHouseCards += bphsHouseCard('Groom', boyDetails[idx], h);
      girlHouseCards += bphsHouseCard('Bride', girlDetails[idx], h);
    });

    $('tab-bphs').innerHTML = `
      <div class="card">
        <h2>BPHS Marriage Assessment — Specific Results</h2>
        <p class="small muted">Chart-specific assessment of each marriage-relevant house for both partners, based on their actual planetary placements, lordships, and aspects.</p>
        <div style="margin:10px 0">${chip(b.verdict.label, b.verdict.cls)} &nbsp; Combined index <b>${b.combined}/100</b></div>
        <div class="grid-2">
          <div>${gaugePct(boy.meta.name + ' (Groom) marriage index', b.boy.index)}</div>
          <div>${gaugePct(girl.meta.name + ' (Bride) marriage index', b.girl.index)}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>${esc(boy.meta.name)} (Groom) — House-by-House Assessment</h3>
          ${header(boy)}
          <div class="kv" style="margin-bottom:8px"><span>Lagna</span><span>${boy.ascendant.signName}</span></div>
          ${boyHouseCards}
          <div style="margin-top:12px">
            <div class="kv"><span>Venus (love kāraka) dignity</span><span><b>${esc(b.boy.venusDignity.label)}</b></span></div>
            <div class="kv"><span>Jupiter (wisdom) dignity</span><span>${esc(b.boy.jupiterDignity.label)}</span></div>
            <div class="kv"><span>7th-house malefic afflictions</span><span>${b.boy.seventhAfflictions} planet(s)</span></div>
          </div>
        </div>
        <div class="card">
          <h3>${esc(girl.meta.name)} (Bride) — House-by-House Assessment</h3>
          ${header(girl)}
          <div class="kv" style="margin-bottom:8px"><span>Lagna</span><span>${girl.ascendant.signName}</span></div>
          ${girlHouseCards}
          <div style="margin-top:12px">
            <div class="kv"><span>Jupiter (husband kāraka) dignity</span><span><b>${esc(b.girl.jupiterDignity.label)}</b></span></div>
            <div class="kv"><span>Venus (love) dignity</span><span>${esc(b.girl.venusDignity.label)}</span></div>
            <div class="kv"><span>7th-house malefic afflictions</span><span>${b.girl.seventhAfflictions} planet(s)</span></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Combined Interpretation</h3>
        ${b.notes.map((n) => `<p class="small">• ${esc(n)}</p>`).join('')}
      </div>

      <div class="callout small">This assessment reads each house <b>specifically from the chart</b> — the sign on the cusp,
        the lord's dignity and placement, actual occupant planets and their condition, and aspects received.
        Houses 7 (marriage), 2 (family life), 11 (wish-fulfilment), 5 (romance/children) and 8 (marital intimacy)
        are the primary indicators; houses 4 (home happiness), 12 (bed pleasures), 1 (self) and 9 (fortune/dharma)
        also contribute.</div>`;
  }

  /* ---------------- KP ---------------- */
  function kpCuspTable(assess) {
    let rows = '';
    assess.cusps.forEach((c) => {
      rows += `<tr><td><b>${c.house}</b></td><td>${c.sign} ${fix(c.deg)}°</td><td>${c.nakLord}</td><td><b>${c.subLord}</b></td><td>${c.subSubLord}</td><td>${c.subSignifies.join(', ')}</td></tr>`;
    });
    return `<table><thead><tr><th>Cusp</th><th>Sign</th><th>Star Lord</th><th>Sub Lord</th><th>Sub-Sub</th><th>Sub signifies houses</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderKP() {
    const r = state.results;
    const b = r.kpB, g = r.kpG;
    $('tab-kp').innerHTML = `
      <div class="card">
        <h2>KP (Krishnamurti Paddhati) Assessment</h2>
        <div class="callout small">Computed with the <b>Placidus</b> house system and the <b>${esc(state.boy.kp.ayanamsaName)}</b> ayanamsa
          for the Groom and <b>${esc(state.girl.kp.ayanamsaName)}</b> for the Bride (KP-Old is used for births before the year 2000).</div>
        <div style="margin:6px 0">${chip(r.kp.verdict.label, r.kp.verdict.cls)} &nbsp; Combined confidence <b>${r.kp.combined}%</b></div>
        ${r.kp.notes.map((n) => `<p class="small">• ${esc(n)}</p>`).join('')}
      </div>
      <div class="grid-2">
        <div class="card"><h3>Groom — 7th cusp &amp; promise</h3>
          <div class="kv"><span>7th cusp sub-lord</span><span><b>${b.promise.subLord}</b></span></div>
          <div class="kv"><span>Signifies houses</span><span>${b.promise.sigHouses.join(', ')}</span></div>
          <div class="kv"><span>Marriage houses (2/7/11)</span><span>${b.promise.matched.join(', ') || 'none'}</span></div>
          <div style="margin-top:8px">${chip(b.verdict.label, b.verdict.cls)} — ${b.promise.confidence}%</div>
          <h3>Marriage significators</h3>
          <p class="small">${b.significators.slice(0,6).map((s)=>`${s.planet} (${s.strength})`).join(', ')}</p>
        </div>
        <div class="card"><h3>Bride — 7th cusp &amp; promise</h3>
          <div class="kv"><span>7th cusp sub-lord</span><span><b>${g.promise.subLord}</b></span></div>
          <div class="kv"><span>Signifies houses</span><span>${g.promise.sigHouses.join(', ')}</span></div>
          <div class="kv"><span>Marriage houses (2/7/11)</span><span>${g.promise.matched.join(', ') || 'none'}</span></div>
          <div style="margin-top:8px">${chip(g.verdict.label, g.verdict.cls)} — ${g.promise.confidence}%</div>
          <h3>Marriage significators</h3>
          <p class="small">${g.significators.slice(0,6).map((s)=>`${s.planet} (${s.strength})`).join(', ')}</p>
        </div>
      </div>
      <div class="card"><h3>Groom — Cuspal sub-lords (2,7,11,5,8)</h3>${kpCuspTable(b)}</div>
      <div class="card"><h3>Bride — Cuspal sub-lords (2,7,11,5,8)</h3>${kpCuspTable(g)}</div>`;
  }

  /* ---------------- Kuja (Maṅgala) Dosha ---------------- */
  function kujaPartnerCard(name, k) {
    const reasons = k.reasons && k.reasons.length
      ? `<h3>Cancellation (Bhaṅga) factors</h3>${k.reasons.map((rz) => `<p class="small bhava-char-item">• ${esc(rz)}</p>`).join('')}`
      : (k.present ? '<p class="small muted">No cancellation factors found — dosha stands.</p>' : '');
    return `<div class="card" style="margin:0">
      <h3>${esc(name)}</h3>
      <div style="margin:4px 0 8px">${chip(k.level.label, k.level.cls)}</div>
      <div class="kv"><span>Mars placement</span><span>${k.marsSign} (House ${k.marsHouse})</span></div>
      <div class="kv"><span>Manglik from</span><span>${k.present ? esc(k.fromText) : 'None of Lagna / Moon / Venus'}</span></div>
      <div class="kv"><span>Raw intensity</span><span>${k.intensity}/100</span></div>
      <div class="kv"><span>Cancellation (Bhaṅga)</span><span>${k.reductionPct}% reduced</span></div>
      <div class="kv"><span>Net (effective) dosha</span><span><b>${k.netIntensity}/100</b></span></div>
      ${gaugePct('Effective Kuja Dosha', k.netIntensity, k.netIntensity >= 22 ? 'bad' : (k.netIntensity >= 12 ? 'mid' : 'good'))}
      ${reasons}
    </div>`;
  }
  function renderKuja() {
    const r = state.results;
    const ku = r.kuja;
    if (!ku) { $('tab-kuja').innerHTML = '<div class="card"><div class="placeholder">No Kuja data.</div></div>'; return; }
    $('tab-kuja').innerHTML = `
      <div class="card">
        <h2>Kuja (Maṅgala / Mangal) Dosha — D1 Analysis &amp; Cancellation</h2>
        <div style="margin:6px 0">${chip(ku.verdict.label, ku.verdict.cls)} &nbsp; Match score <b>${ku.score}/100</b></div>
        ${gaugePct('Kuja Dosha compatibility', ku.score)}
        <p class="small">${esc(ku.note)}</p>
        <p class="small muted">Manglik = Mars in the 1st, 2nd, 4th, 7th, 8th or 12th house counted from the Lagna,
          the Moon, or Venus (D1 / Rāśi chart). The dosha can cause discord, delay or separation, but is
          frequently <b>cancelled (Bhaṅga)</b> by Mars's own sign / exaltation, specific sign-in-house placements,
          or Jupiter/Venus influence on Mars.</p>
      </div>
      <div class="grid-2">
        ${kujaPartnerCard(state.boy.meta.name + ' (Groom)', ku.boy)}
        ${kujaPartnerCard(state.girl.meta.name + ' (Bride)', ku.girl)}
      </div>
      <div class="callout small"><b>Matching rule:</b> if <i>both</i> partners are Manglik the dosha is mutually
        cancelled (a recommended pairing for Manglik natives); if only one is Manglik and the dosha is not cancelled
        in their own chart, classical texts advise caution or remedies. This module already feeds the <b>net</b>
        (post-cancellation) Kuja Dosha into the separation/divorce risk and the 20-year strength forecast.</div>`;
  }

  /* ---------------- Koota ---------------- */
  function renderKoota() {
    const r = state.results; const k = r.koota;
    let aRows = '';
    k.ashtakoota.items.forEach((i) => {
      aRows += `<tr><td><b>${esc(i.key)}</b></td><td class="num">${i.score}</td><td class="num">${i.max}</td><td>${esc(i.note)}</td></tr>`;
    });
    let dRows = '';
    k.dashakoota.items.forEach((i) => {
      dRows += `<tr><td><b>${esc(i.key)}</b></td><td>${i.pass ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>'}</td><td>${esc(i.detail)}</td></tr>`;
    });
    $('tab-koota').innerHTML = `
      <div class="card">
        <h2>Koota Matching</h2>
        <div class="kv"><span>Groom Moon</span><span>${k.boyMoon.sign} — ${k.boyMoon.nak} (pada ${k.boyMoon.pada})</span></div>
        <div class="kv"><span>Bride Moon</span><span>${k.girlMoon.sign} — ${k.girlMoon.nak} (pada ${k.girlMoon.pada})</span></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Ashtakoota (Guna Milan) — ${k.ashtakoota.total}/36 ${chip(k.ashtakoota.verdict.label, k.ashtakoota.verdict.cls)}</h3>
          ${gauge('Total Gunas', k.ashtakoota.total, 36)}
          <table><thead><tr><th>Koota</th><th class="num">Score</th><th class="num">Max</th><th>Detail</th></tr></thead><tbody>${aRows}</tbody></table>
          ${k.ashtakoota.doshas.length ? `<div class="callout warn small"><b>Doshas:</b> ${k.ashtakoota.doshas.join(', ')}</div>` : '<div class="callout small">No major Ashtakoota dosha detected.</div>'}
        </div>
        <div class="card">
          <h3>Dashakoota (Dasa Porutham) — ${k.dashakoota.passCount}/10 ${chip(k.dashakoota.verdict.label, k.dashakoota.verdict.cls)}</h3>
          ${gauge('Poruthams passed', k.dashakoota.passCount, 10)}
          <table><thead><tr><th>Porutham</th><th>Result</th><th>Detail</th></tr></thead><tbody>${dRows}</tbody></table>
        </div>
      </div>
      <div class="callout small">Conventional guidance: Ashtakoota ≥ 18/36 is considered acceptable, ≥ 24 good.
        Nāḍī and Bhakūṭa doshas may be mitigated by other strong factors (same Rāśi-lord, planetary
        cancellation), which a qualified astrologer should confirm.</div>`;
  }

  /* ---------------- Timing ---------------- */
  function kpTimingCard(kt, label) {
    const n = kt && kt.nearest;
    const near = n ? `${Dasha.fmtDMY(n.startJd)} – ${Dasha.fmtDMY(n.endJd)}` : '—';
    const rows = (kt && kt.top ? kt.top : []).map((wn) => `<tr><td>${Dasha.fmtDMY(wn.startJd)} – ${Dasha.fmtDMY(wn.endJd)}</td><td>${wn.md}/${wn.ad}/${wn.pd}${wn.allSig ? ' <span class="chip good" style="padding:0 5px">✔</span>' : ''}</td><td class="num">${fix(wn.score, 1)}</td></tr>`).join('');
    const sig = (kt && kt.sigList ? kt.sigList : []).map((s) => `${s.planet} (${s.strength})`).join(', ');
    return `<div class="card">
      <h3>${label} — KP timing</h3>
      <div class="big-score" style="font-size:20px">${near}</div>
      <div class="kv"><span>Dasha (MD/AD/PD)</span><span>${n ? `${n.md}/${n.ad}/${n.pd}` : '—'}</span></div>
      <div class="kv"><span>7th cusp sub-lord</span><span><b>${kt ? kt.cuspSub : '—'}</b></span></div>
      <p class="small"><b>Significators of 2/7/11:</b> ${sig || '—'}</p>
      <table><thead><tr><th>Window</th><th>D/B/A lords</th><th class="num">Score</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted small">No clear KP marriage period in range.</td></tr>'}</tbody></table>
    </div>`;
  }

  /* Assess whether marriage is PROMISED in a chart by KP and Parāśara, with rationale. */
  function promiseAssessment(chart, gender) {
    // ---- KP: 7th cusp sub-lord must signify 2/7/11 ----
    const kpA = KP.assess(chart);
    const p = kpA.promise;
    const kpPromised = (p.matched && p.matched.length > 0) && p.confidence >= 30;
    const kpR = [];
    kpR.push(`7th cusp sub-lord <b>${p.subLord}</b> signifies houses [${p.sigHouses.join(', ')}].`);
    if (p.matched && p.matched.length) kpR.push(`It signifies marriage house(s) [${p.matched.join(', ')}] — 2 (family addition), 7 (spouse), 11 (union of desire) → <b>marriage promised</b>.`);
    else kpR.push(`It does <b>not</b> signify 2/7/11 → KP does not directly promise marriage.`);
    if (p.denials && p.denials.length) kpR.push(`It also signifies [${p.denials.join(', ')}] (1 self / 6 separation / 10 against the 7th) — works against union.`);
    kpR.push(`KP promise confidence ${p.confidence}%.`);

    // ---- Parāśara: 7th house, its lord, and the kāraka ----
    const mi = BPHS.marriageIndex(chart, gender);
    const sev = mi.seventh;
    const karakaName = gender === 'female' ? 'Jupiter' : 'Venus';
    const karakaDg = gender === 'female' ? mi.jupiterDignity : mi.venusDignity;
    const parPromised = mi.index >= 40 && sev.score >= 35;
    const parR = [];
    parR.push(`7th house (spouse) strength ${sev.score}/100 — lord ${sev.lord} in H${sev.lordHouse} (${sev.lordDignity}).`);
    parR.push(`${karakaName} (marriage kāraka) is ${karakaDg.label}.`);
    if (mi.seventhAfflictions) parR.push(`${mi.seventhAfflictions} malefic affliction(s) to the 7th — delay/obstacles to marriage.`);
    else parR.push('7th house free of direct malefic occupation — supportive.');
    parR.push(`Composite BPHS marriage index ${mi.index}/100 → ${parPromised ? 'marriage promised' : 'promise is weak / needs effort'}.`);

    const promised = kpPromised || parPromised;
    let verdict;
    if (kpPromised && parPromised) verdict = { label: 'Marriage Promised (KP & Parāśara)', cls: 'good' };
    else if (promised) verdict = { label: 'Marriage Promised (qualified — one system)', cls: 'mid' };
    else verdict = { label: 'Marriage Not Clearly Promised', cls: 'bad' };

    // ---- derivation breakdowns (for transparency in UI + report) ----
    const kpRaw = (p.matched ? p.matched.length : 0) * 25 - (p.denials ? p.denials.length : 0) * 12 + 25;
    const kpMath = { sigHouses: p.sigHouses, matched: p.matched || [], denials: p.denials || [], raw: kpRaw, value: p.confidence };

    const W = BPHS.MARRIAGE_HOUSES;
    const parRows = []; let weighted = 0, totalW = 0;
    Object.keys(W).sort((a, b) => W[b] - W[a]).forEach((h) => {
      const bs = BPHS.bhavaStrength(parseInt(h, 10), chart);
      weighted += bs.score * W[h]; totalW += W[h];
      parRows.push({ house: h, w: W[h], score: bs.score, contrib: Math.round(bs.score * W[h] * 10) / 10 });
    });
    const baseAvg = Math.round((weighted / totalW) * 10) / 10;
    const karakaAdd = Math.round(karakaDg.score * 2 * 10) / 10;
    const afflictSub = mi.seventhAfflictions * 3;
    const parMath = { rows: parRows, baseAvg, karakaName, karakaDg, karakaAdd, afflictions: mi.seventhAfflictions, afflictSub, index: mi.index };

    return { promised, kpPromised, parPromised, verdict, confidence: p.confidence, index: mi.index, kpR, parR, kpMath, parMath };
  }

  function promiseCard(pa, label) {
    const km = pa.kpMath, pm = pa.parMath;
    const parTableRows = pm.rows.map((r) => `<tr><td>H${r.house}</td><td class="num">${r.w}</td><td class="num">${r.score}</td><td class="num">${r.contrib}</td></tr>`).join('');
    return `<div class="card">
      <h3>${esc(label)} — Marriage Promise</h3>
      <div style="margin:4px 0">${chip(pa.verdict.label, pa.verdict.cls)}</div>
      <div class="kv"><span>KP (7th cusp sub-lord)</span><span><b>${pa.kpPromised ? 'Promised' : 'Not promised'}</b> · ${pa.confidence}%</span></div>
      <div class="kv"><span>Parāśara (7th house &amp; kāraka)</span><span><b>${pa.parPromised ? 'Promised' : 'Weak'}</b> · index ${pa.index}/100</span></div>

      <p class="small" style="margin:8px 0 2px"><b>KP rationale</b></p>${pa.kpR.map((x) => `<p class="small bhava-char-item">• ${x}</p>`).join('')}
      <p class="small" style="margin:6px 0 2px"><b>How the KP % is derived</b></p>
      <p class="small bhava-char-item">• Sub-lord signifies [${km.sigHouses.join(', ')}] — matched 2/7/11 = [${km.matched.join(', ') || 'none'}] (${km.matched.length}); denial 1/6/10 = [${km.denials.join(', ') || 'none'}] (${km.denials.length}).</p>
      <p class="small bhava-char-item">• ${km.matched.length}×25 + 25 (base) − ${km.denials.length}×12 = ${km.raw} → clamped to <b>${km.value}%</b>.</p>

      <p class="small" style="margin:8px 0 2px"><b>Parāśara rationale</b></p>${pa.parR.map((x) => `<p class="small bhava-char-item">• ${esc(x)}</p>`).join('')}
      <p class="small" style="margin:6px 0 2px"><b>How the BPHS index is derived</b></p>
      <table class="small"><thead><tr><th>House</th><th class="num">Weight</th><th class="num">Strength</th><th class="num">Contribution</th></tr></thead>
        <tbody>${parTableRows}</tbody></table>
      <p class="small bhava-char-item">• Weighted average = <b>${pm.baseAvg}</b>; ${esc(pm.karakaName)} kāraka (${esc(pm.karakaDg.label)}) → ${pm.karakaAdd >= 0 ? '+' : ''}${pm.karakaAdd}; 7th-house afflictions ${pm.afflictions} → −${pm.afflictSub}.</p>
      <p class="small bhava-char-item">• ${pm.baseAvg} ${pm.karakaAdd >= 0 ? '+ ' + pm.karakaAdd : '− ' + Math.abs(pm.karakaAdd)} − ${pm.afflictSub} → clamped to <b>${pm.index}/100</b>.</p>
    </div>`;
  }
  function notPromisedNote(label) {
    return `<div class="card"><h3>${esc(label)} — Timing withheld</h3>
      <div class="callout">Marriage is not clearly promised for ${esc(label)} by KP or Parāśara, so predictive timing is not shown.
        Review the BPHS &amp; KP Assessment tabs; a qualified astrologer should confirm before relying on timing.</div></div>`;
  }

  function renderTiming() {
    const r = state.results; const w = r.window;
    function topList(person, label) {
      let rows = '';
      person.topByScore.forEach((t) => {
        rows += `<tr><td>${Dasha.fmtDMY(t.startJd)} – ${Dasha.fmtDMY(t.endJd)}</td><td>${t.md}/${t.ad}/${t.pd}</td><td class="num">${fix(t.score,1)}</td></tr>`;
      });
      return `<div class="card"><h3>${label} — strongest marriage periods</h3>
        <table><thead><tr><th>Window</th><th>MD/AD/PD</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    const fmtWin = (n) => n ? `${Dasha.fmtDMY(n.startJd)} – ${Dasha.fmtDMY(n.endJd)}` : '—';
    const period = (n) => n ? `${n.md}/${n.ad}/${n.pd}` : '—';
    function parTimingCard(pw, label, who) {
      return `<div class="card">
        <h3>${label} — own chart (Parāśara)</h3>
        <div class="big-score" style="font-size:20px">${fmtWin(pw.nearest)}</div>
        <div class="kv"><span>Dasha (MD/AD/PD)</span><span>${period(pw.nearest)}</span></div>
        <p class="small muted">Nearest favourable marriage window from the ${who}'s own Vimśottari dasha + transits.</p>
      </div>`;
    }

    const paB = promiseAssessment(state.boy, 'male');
    const paG = promiseAssessment(state.girl, 'female');

    let html = `
      <div class="card">
        <h2>Is Marriage Promised?</h2>
        <p class="small muted">Per classical principle, <b>timing is meaningful only when marriage is promised</b> in the chart.
          Each partner is first assessed by <b>KP</b> (7th cusp sub-lord signifying 2/7/11) and <b>Parāśara</b>
          (7th house, its lord and the Venus/Jupiter kāraka). Possible timing is shown below only for a partner whose marriage is promised.</p>
      </div>
      <div class="grid-2">${promiseCard(paB, 'Groom (Boy)')}${promiseCard(paG, 'Bride (Girl)')}</div>`;

    if (!paB.promised && !paG.promised) {
      html += `<div class="callout"><b>Timing withheld.</b> Marriage is not clearly promised for either partner by KP or Parāśara,
        so predictive timing is not shown. Please review the BPHS &amp; KP Assessment tabs; remedies or re-evaluation by a qualified
        astrologer are advised before considering timing.</div>`;
      $('tab-timing').innerHTML = html;
      return;
    }

    // Joint window — only when BOTH partners are promised
    if (paB.promised && paG.promised) {
      html += `
      <div class="card">
        <h2>Nearest Marriage Timing</h2>
        <div class="big-score" style="font-size:26px">${esc(w.nearestRange)}</div>
        <p class="small muted"><b>Joint window</b> — earliest season where both partners' Dasha readiness and supportive transits coincide.</p>
        <div class="kv"><span>Groom running Dasha then</span><span>${w.boyDasha ? `${w.boyDasha.md.lord}/${w.boyDasha.ad?w.boyDasha.ad.lord:'-'}/${w.boyDasha.pd?w.boyDasha.pd.lord:'-'}` : '-'}</span></div>
        <div class="kv"><span>Bride running Dasha then</span><span>${w.girlDasha ? `${w.girlDasha.md.lord}/${w.girlDasha.ad?w.girlDasha.ad.lord:'-'}/${w.girlDasha.pd?w.girlDasha.pd.lord:'-'}` : '-'}</span></div>
      </div>`;
    } else {
      html += `<div class="callout small">Joint marriage window is shown only when marriage is promised for <b>both</b> partners.</div>`;
    }

    html += `<h2 style="margin:6px 2px">Individual Marriage Timing (Parāśara)</h2>
      <div class="grid-2">
        ${paB.promised ? parTimingCard(w.boy, 'Groom (Boy)', 'groom') : notPromisedNote('Groom (Boy)')}
        ${paG.promised ? parTimingCard(w.girl, 'Bride (Girl)', 'bride') : notPromisedNote('Bride (Girl)')}
      </div>

      <div class="callout"><b>Note —</b> The <b>Muhūrta (electional date &amp; time) for the marriage should be fixed on the basis of the Girl's (Bride's) chart.</b>
        Her Janma Rāśi / Nakṣatra, Candra-bala and Tārā-bala, and the avoidance of afflictions to her 7th/8th houses take precedence
        when choosing the wedding day and lagna. The groom's chart is supportive/secondary for muhūrta selection.</div>

      <h2 style="margin:6px 2px">KP-System Marriage Timing</h2>
      <div class="grid-2">
        ${paB.promised ? kpTimingCard(r.kpTiming.boy, 'Groom (Boy)') : notPromisedNote('Groom (Boy)')}
        ${paG.promised ? kpTimingCard(r.kpTiming.girl, 'Bride (Girl)') : notPromisedNote('Bride (Girl)')}
      </div>
      <div class="callout small">KP method: marriage fructifies in the conjoined <b>Daśā–Bhukti–Antara</b> of planets that are
        significators of houses <b>2, 7 &amp; 11</b>. Rows where the Daśā, Bhukti and Antara lords are <i>all</i> marriage
        significators are marked ✔ (strongest).</div>

      <div class="grid-2">
        ${paB.promised ? topList(w.boy, 'Groom') : ''}
        ${paG.promised ? topList(w.girl, 'Bride') : ''}
      </div>
      <div class="callout small">Timing blends Vimśottari MD/AD/PD favourability (7th/2nd/11th/5th lords, the
        Venus/Jupiter kāraka and KP 2-7-11 significators) with Jupiter/Saturn transit triggers. Treat the
        window as a season of opportunity, not an exact date.</div>`;

    $('tab-timing').innerHTML = html;
  }

  /* ---------------- Forecast ---------------- */
  function updateForecastTimeframe() {
    const r = state.results;
    if (!r) return;
    const ds = $('fcStart') ? $('fcStart').value : '';
    let yrs = $('fcYears') ? parseInt($('fcYears').value, 10) : 20;
    if (!yrs || yrs < 1) yrs = 20;
    yrs = Math.min(60, yrs);
    let fromJd = state.fromJd;
    if (ds) {
      const parts = ds.split('-').map(Number);
      if (parts.length === 3 && parts[0]) fromJd = Astro.julianDay(parts[0], parts[1], parts[2], 0);
    }
    state.fcFromJd = fromJd;
    state.fcYears = yrs;
    if (r.individual) {
      try { r.single = Timeline.strengthSeriesSingle(r.chart, r.gender, fromJd, yrs, 3); } catch (e) { console.error('single recompute error', e); }
      renderForecastIndividual();
      return;
    }
    try {
      r.strengthDual = Timeline.strengthSeriesDual(state.boy, state.girl, fromJd, yrs, 3);
      r.forecast = Timeline.relationshipForecast(state.boy, state.girl, fromJd, yrs);
    } catch (e) { console.error('forecast recompute error', e); }
    renderForecast();
  }

  function renderForecast() {
    const r = state.results;
    const dual = r.strengthDual ? r.strengthDual.series : [];
    const avg = (k) => dual.length ? Math.round(dual.reduce((a, s) => a + s[k], 0) / dual.length) : 0;
    const kpSpan = (v) => `<span class="kp-val">${v}</span>`;
    const parSpan = (v) => `<span class="par-val">${v}</span>`;
    const fromJd = state.fcFromJd || state.fromJd;
    const yrs = state.fcYears || 20;
    const startISO = Dasha.fmtISO(fromJd);
    const todayISO = Dasha.fmtISO(state.fromJd);
    const isDefault = startISO === todayISO && yrs === 20;

    let rows = '';
    r.forecast.forEach((f) => {
      const trig = f.sepTrig ? ' <span class="sep-flag" title="Separation/divorce/widowhood trigger: separative dasha + adverse transit">⚠</span>' : '';
      rows += `<tr class="band-${f.band.cls}${f.sepTrig ? ' sep-row' : ''}">
        <td>${f.start} – ${f.end}${trig}</td>
        <td class="small">${f.boyDasha}</td>
        <td class="small">${f.girlDasha}</td>
        <td class="num">${kpSpan(f.boyKP != null ? f.boyKP : '-')}/${parSpan(f.boyPar != null ? f.boyPar : '-')}</td>
        <td class="num">${kpSpan(f.girlKP != null ? f.girlKP : '-')}/${parSpan(f.girlPar != null ? f.girlPar : '-')}</td>
        <td class="num"><b>${kpSpan(f.combinedKP != null ? f.combinedKP : '-')}/${parSpan(f.combinedPar != null ? f.combinedPar : '-')}</b></td>
        <td>${chip(f.band.label, f.band.cls)}</td>
        <td class="small muted">${esc(f.transitNote)}</td>
      </tr>`;
    });

    const sepData = r.strengthDual && r.strengthDual.separation ? r.strengthDual.separation : null;
    const sepCard = (name, s) => {
      if (!s) return '';
      const facts = (arr, title) => arr.length ? `<p class="small" style="margin:4px 0"><b>${title}:</b></p>${arr.map((f) => `<p class="small bhava-char-item">• ${esc(f)}</p>`).join('')}` : `<p class="small muted">${title}: no significant indication.</p>`;
      return `<div class="card" style="margin:0">
        <h3>${esc(name)} — Separation / Divorce / Widowhood Promise</h3>
        <div style="margin:4px 0 8px">${chip(s.verdict.label, s.verdict.cls)} <span class="muted small">overall risk ${s.overallRisk}/100</span></div>
        ${gaugePct('Separation risk', s.separation)}
        ${gaugePct('Divorce risk', s.divorce)}
        ${gaugePct('Widowhood / spouse-longevity caution', s.widowhood)}
        ${facts(s.d1Factors, 'D1 (Rāśi) indicators')}
        ${facts(s.d9Factors, 'D9 (Navāṁśa) indicators')}
        ${facts(s.kpFactors, 'KP indicators')}
      </div>`;
    };

    $('tab-forecast').innerHTML = `
      <div class="card no-print">
        <h2>Forecast Timeframe (Backtesting)</h2>
        <p class="small muted">Default is <b>today + 20 years</b>. To backtest, pick a different start date (e.g., a past date)
          and the number of years, then click Update.</p>
        <div class="row-3" style="max-width:560px;align-items:end">
          <div><label>Start date</label><input type="date" id="fcStart" value="${startISO}" /></div>
          <div><label>Years</label><input type="number" id="fcYears" min="1" max="60" value="${yrs}" /></div>
          <div><button class="btn" id="fcUpdate" type="button">Update Forecast</button></div>
        </div>
        <div class="small" style="margin-top:6px">${isDefault ? '<span class="chip good">Default timeframe</span>' : `<span class="chip mid">Custom / backtest</span> <span class="muted">from ${Dasha.fmtDMY(fromJd)} for ${yrs} years</span>`}
          ${!isDefault ? ' &nbsp;<span class="preset-link" id="fcReset">Reset to default</span>' : ''}</div>
      </div>
      <div class="card">
        <h2>Relationship Strength Over ${yrs} Years — Commitment Graph</h2>
        <p class="small muted">Time runs left → right along the centre line. <b style="color:#4dc9ff">${esc(state.boy.meta.name)} (Groom)</b>'s
          commitment is drawn <b>above</b> the centre line; <b style="color:#ff7eb3">${esc(state.girl.meta.name)} (Bride)</b>'s is drawn <b>below</b>.
          Each partner has <b>two values in two colours</b> — <span class="kp-val">KP significators</span> and
          <span class="par-val">Parāśara significators</span> of the running dasha lords — each scaled by the planet's
          strength (direction, speed, declination, exaltation, debilitation &amp; its cancellation, combustion).
          The band forms a "pipe": wide where commitment is strong, narrow where it weakens.</p>
        ${typeof ChartDraw !== 'undefined' && dual.length ? ChartDraw.relationshipPipeDual(dual, { boyName: state.boy.meta.name, girlName: state.girl.meta.name }) : ''}
        <div class="grid-2" style="margin-top:10px">
          <div class="card" style="margin:0">
            <h3>${esc(state.boy.meta.name)} (Groom) — ${yrs}-yr average</h3>
            <div class="kv"><span>KP commitment</span><span>${kpSpan(avg('boyKP'))}/100</span></div>
            <div class="kv"><span>Parāśara commitment</span><span>${parSpan(avg('boyPar'))}/100</span></div>
          </div>
          <div class="card" style="margin:0">
            <h3>${esc(state.girl.meta.name)} (Bride) — ${yrs}-yr average</h3>
            <div class="kv"><span>KP commitment</span><span>${kpSpan(avg('girlKP'))}/100</span></div>
            <div class="kv"><span>Parāśara commitment</span><span>${parSpan(avg('girlPar'))}/100</span></div>
          </div>
        </div>
        <div class="legend-line">
          <span class="dot" style="background:#f5b301"></span><span class="kp-val">KP value</span> &nbsp;&nbsp;
          <span class="dot" style="background:#2bbf6a"></span><span class="par-val">Parāśara value</span> &nbsp;&nbsp;
          <span class="dot" style="background:#4dc9ff"></span>Groom (above) &nbsp;&nbsp;
          <span class="dot" style="background:#ff7eb3"></span>Bride (below)
        </div>
      </div>
      <div class="card">
        <h2>${yrs}-Year Relationship Strength &amp; Weakness Forecast</h2>
        <p class="small muted">Period-by-period (Mahādaśā / Antardaśā / Pratyantardaśā) outlook. Each cell shows two
          strength values: <span class="kp-val">KP</span> / <span class="par-val">Parāśara</span> (0–100), derived from the
          houses the running dasha lords signify, scaled by planetary strength.</p>
        <table><thead><tr>
          <th>Period</th><th>Groom MD/AD/PD</th><th>Bride MD/AD/PD</th>
          <th class="num">Groom <span class="kp-val">KP</span>/<span class="par-val">Par</span></th>
          <th class="num">Bride <span class="kp-val">KP</span>/<span class="par-val">Par</span></th>
          <th class="num">Combined <span class="kp-val">KP</span>/<span class="par-val">Par</span></th>
          <th>Band</th><th>Key transit</th>
        </tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="legend-line"><span class="dot good"></span>Strong/Supportive &nbsp; <span class="dot mid"></span>Mixed &nbsp; <span class="dot bad"></span>Testing/Strained</div>
      </div>
      <div class="callout small"><b>Two methods, two colours:</b> the <span class="kp-val">KP</span> value reads the dasha lord's
        <i>nakshatra/sub-lord significators</i> of houses 2-7-11 (vs 1-6-10-12); the <span class="par-val">Parāśara</span> value reads its
        <i>house lordship &amp; occupancy</i> of 7-2-11-5 (vs 6-8-12). Both are multiplied by the planet's computed strength
        (Cheṣṭā/retrograde, speed, declination, exaltation, Neecha-Bhanga-aware debilitation, combustion). Where the two lines
        diverge, the two systems disagree on that period's promise — a cue for closer manual judgement.</div>

      <div class="card">
        <h2>Promise of Separation / Divorce / Widowhood</h2>
        <p class="small muted">Structural risk read from the <b>D1, D9 and KP</b> charts. This <b>lowers the strength index more
          sharply</b> in periods where a separative dasha lord runs <i>and</i> transits simultaneously trigger it — shown as
          <span style="color:#ff4d4d;font-weight:700">red trigger windows</span> on the graph above and a ⚠ on the affected rows.</p>
        <div class="grid-2">
          ${sepCard(state.boy.meta.name + ' (Groom)', sepData ? sepData.boy : null)}
          ${sepCard(state.girl.meta.name + ' (Bride)', sepData ? sepData.girl : null)}
        </div>
        <div class="callout small">These are classical <i>indications</i>, not certainties — many are mitigated by benefic
          aspects, strong 7th lord, Neecha Bhanga, or favourable D9. Treat high-risk windows as periods needing conscious
          effort, counselling and patience, and always confirm with a qualified astrologer.</div>
      </div>`;

    const upd = $('fcUpdate');
    if (upd) upd.addEventListener('click', updateForecastTimeframe);
    const rst = $('fcReset');
    if (rst) rst.addEventListener('click', () => {
      state.fcFromJd = state.fromJd; state.fcYears = 20;
      const r2 = state.results;
      r2.strengthDual = Timeline.strengthSeriesDual(state.boy, state.girl, state.fromJd, 20, 3);
      r2.forecast = Timeline.relationshipForecast(state.boy, state.girl, state.fromJd, 20);
      renderForecast();
    });
  }

  /* ---------------- Transit ---------------- */
  function transitTable(rows) {
    let out = '';
    rows.forEach((t) => {
      const cls = t.eval.score >= 3 ? 'good' : t.eval.score <= -1 ? 'bad' : 'mid';
      out += `<tr><td>${t.date}</td><td>${t.jupiter}</td><td>${t.saturn}</td><td>${t.rahu}</td><td>${chip(t.eval.score, cls)}</td><td class="small muted">${esc(t.eval.triggers.slice(0,2).join('; ') || '—')}</td></tr>`;
    });
    return `<table><thead><tr><th>Date</th><th>Jupiter (H from Moon)</th><th>Saturn (H from Moon)</th><th>Rahu</th><th>Score</th><th>Triggers</th></tr></thead><tbody>${out}</tbody></table>`;
  }
  function renderTransit() {
    const r = state.results;
    $('tab-transit').innerHTML = `
      <div class="card"><h2>Gochara (Transit) Outlook — Groom</h2>${header(state.boy)}${transitTable(r.transitB)}</div>
      <div class="card"><h2>Gochara (Transit) Outlook — Bride</h2>${header(state.girl)}${transitTable(r.transitG)}</div>
      <div class="callout small">"H from Moon" = the house counted from the natal Moon sign that the planet
        is transiting. Jupiter over the 7th/2nd/11th from Moon and over the natal 7th sign are classic
        marriage activators; Saturn's Sade-Sati (12-1-2 from Moon) marks emotionally demanding seasons.</div>`;
  }

  /* ---------------- Health ---------------- */
  function healthCard(name, h) {
    return `<div class="card"><h3>${esc(name)}</h3>
      ${gaugePct('Vitality (Lagna)', h.vitality)}
      ${gaugePct('Immunity (6th)', h.immunity)}
      ${gaugePct('Chronic resilience (8th)', h.chronic)}
      ${gaugePct('Mind / emotional (Moon)', h.mind)}
      <div class="kv"><span>Overall</span><span><b>${h.overall}/100</b></span></div>
      <div class="kv"><span>Dosha leaning (Moon)</span><span>${h.moonDosha}</span></div>
      <div class="kv"><span>Constitution (Lagna)</span><span>${h.lagnaDosha}</span></div>
      ${h.flags.length ? `<h3>Screening notes</h3>${h.flags.map((f)=>`<p class="small">• ${esc(f)}</p>`).join('')}` : '<p class="small muted">No major affliction flags.</p>'}
    </div>`;
  }
  function renderHealth() {
    const r = state.results; const h = r.health;
    $('tab-health').innerHTML = `
      <div class="card">
        <h2>Health Compatibility Screener</h2>
        <div style="margin:6px 0">${chip(h.verdict.label, h.verdict.cls)} &nbsp; Index <b>${h.score}/100</b></div>
        ${gaugePct('Combined health compatibility', h.score)}
        <h3>Comparative notes</h3>${h.notes.map((n)=>`<p class="small">• ${esc(n)}</p>`).join('')}
      </div>
      <div class="grid-2">${healthCard(state.boy.meta.name + ' (Groom)', h.boy)}${healthCard(state.girl.meta.name + ' (Bride)', h.girl)}</div>
      <div class="callout small">This screener interprets the Lagna lord, 6th, 8th, 12th houses and the Moon for
        each partner, plus the Āyurvedic dosha leaning, then compares the two profiles. It is an astrological
        wellness indicator only — not a medical diagnosis.</div>`;
  }

  /* ---------------- Manual ---------------- */
  $('tab-manual').innerHTML = `<div class="card">${Manual.html()}</div>`;

  /* ---------------- Sarvashtakavarga ---------------- */
  function renderSarvashtaka() {
    const r = state.results;
    const sa = r.sarvashtaka;

    // Full SAV table (all 12 houses, boy vs girl)
    let compRows = '';
    sa.comparison.forEach((c) => {
      const cls = c.harmony.cls;
      compRows += `<tr class="band-${cls}">
        <td><b>${c.house}</b></td>
        <td class="num">${c.boyBindus}</td>
        <td class="num">${c.girlBindus}</td>
        <td class="num">${c.avg}</td>
        <td>${chip(c.harmony.label, c.harmony.cls)}</td>
      </tr>`;
    });

    // Marriage houses detail
    let marriageRows = '';
    sa.marriageComparison.forEach((m) => {
      marriageRows += `<tr>
        <td><b>H${m.house}</b> <span class="muted small">(${esc(Sarvashtaka.coupleAnalysis === undefined ? '' : houseLabel2(m.house))})</span></td>
        <td>${esc(m.signBoy)}</td>
        <td class="num">${m.boyBindus} ${chip(m.boyQuality.label, m.boyQuality.cls)}</td>
        <td>${esc(m.signGirl)}</td>
        <td class="num">${m.girlBindus} ${chip(m.girlQuality.label, m.girlQuality.cls)}</td>
        <td class="num"><b>${m.avg}</b></td>
      </tr>`;
    });

    // BAV grid for boy (7 planets x 12 houses)
    function bavGrid(data, name) {
      let header = '<th>' + name + '</th>';
      for (let h = 1; h <= 12; h++) header += `<th class="num">H${h}</th>`;
      header += '<th class="num">Total</th>';
      let rows = '';
      Sarvashtaka.PLANETS_7.forEach((p) => {
        const bavRow = data.houseBavs[p];
        const total = bavRow.reduce((s, v) => s + v, 0);
        rows += '<tr><td><b>' + p + '</b></td>';
        bavRow.forEach((v) => {
          const cls = v >= 5 ? 'pass' : v <= 2 ? 'fail' : '';
          rows += `<td class="num ${cls}">${v}</td>`;
        });
        rows += `<td class="num"><b>${total}</b></td></tr>`;
      });
      // SAV totals row
      rows += '<tr style="border-top:2px solid var(--border)"><td><b>SAV</b></td>';
      data.houses.forEach((h) => {
        const cls = h.bindus >= 28 ? 'pass' : h.bindus < 25 ? 'fail' : '';
        rows += `<td class="num ${cls}"><b>${h.bindus}</b></td>`;
      });
      rows += `<td class="num"><b>${data.total}</b></td></tr>`;
      return `<table class="bav-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    $('tab-sarvashtaka').innerHTML = `
      <div class="card">
        <h2>Sarvashtakavarga (SAV) Analysis</h2>
        <div style="margin:6px 0">${chip(sa.verdict.label, sa.verdict.cls)} &nbsp; Compatibility Score <b>${sa.score}/100</b></div>
        ${gaugePct('SAV Marriage Compatibility', sa.score)}
        <div class="grid-2" style="margin-top:12px">
          <div class="kv"><span>Groom total SAV bindus</span><span><b>${sa.boy.houseSAV.total}</b></span></div>
          <div class="kv"><span>Bride total SAV bindus</span><span><b>${sa.girl.houseSAV.total}</b></span></div>
        </div>
      </div>

      <div class="card">
        <h3>Marriage Houses — SAV Comparison</h3>
        <p class="small muted">Houses 7 (spouse), 2 (family), 11 (gains), 5 (romance) and 8 (intimacy) evaluated.
          Bindus ≥ 28 = Strong, 25–27 = Moderate, &lt; 25 = Weak.</p>
        <table>
          <thead><tr><th>House</th><th>Boy Sign</th><th class="num">Boy Bindus</th><th>Girl Sign</th><th class="num">Girl Bindus</th><th class="num">Avg</th></tr></thead>
          <tbody>${marriageRows}</tbody>
        </table>
      </div>

      <div class="card">
        <h3>Full House-by-House SAV Comparison</h3>
        <table>
          <thead><tr><th>House</th><th class="num">Boy Bindus</th><th class="num">Girl Bindus</th><th class="num">Average</th><th>Harmony</th></tr></thead>
          <tbody>${compRows}</tbody>
        </table>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Groom — Bhinnashtakavarga (BAV) Grid</h3>
          <p class="small muted">Bindus per planet per house. Green ≥ 5 (strong), Red ≤ 2 (weak).</p>
          ${bavGrid(sa.boy.houseSAV, 'Planet')}
        </div>
        <div class="card">
          <h3>Bride — Bhinnashtakavarga (BAV) Grid</h3>
          <p class="small muted">Bindus per planet per house. Green ≥ 5 (strong), Red ≤ 2 (weak).</p>
          ${bavGrid(sa.girl.houseSAV, 'Planet')}
        </div>
      </div>

      <div class="card">
        <h3>Interpretation &amp; Notes</h3>
        ${sa.notes.map((n) => `<p class="small">• ${esc(n)}</p>`).join('')}
      </div>

      <div class="callout small">
        <b>About Sarvashtakavarga:</b> The Ashtakavarga system (BPHS Ch. 66–72) assigns benefic points (bindus)
        from each of the 7 planets and the Lagna to every sign. The SAV is the aggregate — signs with more bindus
        indicate stronger results for that life area. For marriage, high bindus in the 7th house (marriage), 2nd
        (family), 11th (fulfilment), 5th (romance/children), and Venus's BAV in the 7th are especially significant.
      </div>`;
  }

  function houseLabel2(h) {
    const labels = { 2: 'Family/Wealth', 5: 'Romance/Children', 7: 'Marriage/Spouse', 8: 'Intimacy/Longevity', 11: 'Fulfilment/Gains' };
    return labels[h] || '';
  }

  /* ---------------- Progeny (Santāna) ---------------- */
  function progSphutaCard(s) {
    const cls = s.strong ? 'good' : (s.score >= 40 ? 'mid' : 'bad');
    const title = s.kind === 'Beeja' ? 'Beeja Sphuṭa (Male — “Seed” / potency)' : 'Kṣetra Sphuṭa (Female — “Field” / fertility)';
    return `<div class="card" style="margin:0">
      <h3>${title}</h3>
      ${gaugePct(s.kind + ' strength', s.score, cls)}
      <div class="kv"><span>Falls in rāśi</span><span><b>${s.signName}</b> (${degStr(s.degInSign)}) — ${s.isOddRasi ? 'odd' : 'even'} sign</span></div>
      <div class="kv"><span>Navāṁśa</span><span>${s.navSignName} — ${s.isOddNav ? 'odd' : 'even'}</span></div>
      <div class="kv"><span>Dispositor / Jupiter</span><span>${s.dispositorDignity.label} / ${s.jupiterDignity.label}</span></div>
      ${s.notes.map((n) => `<p class="small bhava-char-item">• ${esc(n)}</p>`).join('')}
    </div>`;
  }
  function progParasharaBlock(par) {
    const dv = (d) => `<tr><td><b>${d.varga}</b></td><td>${d.fifthSignName}</td><td>${d.occupants.join(', ') || '—'}</td><td>${d.fifthLord} (${esc(d.lordDignity.label)})</td><td class="num">${d.score}</td></tr>`;
    const fr = par.factors.map((f) => `<p class="small bhava-char-item">• ${esc(f)}</p>`).join('');
    return `<div class="card">
      <h3>Parāśara — 5th House (Putra Bhāva) across D1 · D9 · D7</h3>
      <div style="margin:4px 0">${chip(par.verdict.label, par.verdict.cls)} <span class="muted small">${par.score}/100</span></div>
      ${gaugePct('Parāśara progeny strength', par.score)}
      <table><thead><tr><th>Chart</th><th>5th sign</th><th>Occupants</th><th>5th lord (dignity)</th><th class="num">Score</th></tr></thead>
        <tbody>${dv(par.d1)}${dv(par.d9)}${dv(par.d7)}</tbody></table>
      <div class="kv"><span>Putra-kāraka Jupiter</span><span>${esc(par.jupiterDignity.label)}, in H${par.jupiterHouse}${par.jupiterAfflictors.length ? ' — afflicted by ' + par.jupiterAfflictors.join(', ') : ''}</span></div>
      <div class="kv"><span>5th lord (${par.fifthLord}) placement</span><span>H${par.fifthLordHouse}</span></div>
      <div class="kv"><span>9th house (lineage / santati)</span><span>${par.ninth.score}/100</span></div>
      <div style="margin-top:6px">${fr}</div>
    </div>`;
  }
  function progKpBlock(k) {
    const fr = k.factors.map((f) => `<p class="small bhava-char-item">• ${f}</p>`).join(''); // factors carry intentional <b> markup
    const sig = k.significators.slice(0, 6).map((s) => `${s.planet} (${s.strength})`).join(', ');
    return `<div class="card">
      <h3>KP — 5th Cusp Sub-Lord (must signify 2 / 5 / 11)</h3>
      <div style="margin:4px 0">${chip(k.verdict.label, k.verdict.cls)} — ${k.confidence}%</div>
      ${gaugePct('KP progeny confidence', k.confidence)}
      <div class="kv"><span>5th cusp sub-lord</span><span><b>${k.subLord}</b></span></div>
      <div class="kv"><span>Signifies houses</span><span>${k.sigHouses.join(', ')}</span></div>
      <div class="kv"><span>Progeny houses (2/5/11) matched</span><span>${k.matched.join(', ') || 'none'}</span></div>
      <p class="small"><b>Progeny significators (2/5/11):</b> ${sig || '—'}</p>
      <div style="margin-top:6px">${fr}</div>
    </div>`;
  }
  function progTimingTable(t) {
    const rows = (t.top || []).map((w) => `<tr><td>${Dasha.fmtDMY(w.startJd)} – ${Dasha.fmtDMY(w.endJd)}</td><td>${w.md}/${w.ad}/${w.pd}</td><td class="num">${fix(w.score, 1)}</td><td class="small muted">${esc((w.transitNotes || []).join('; ')) || '—'}</td></tr>`).join('');
    return `<table><thead><tr><th>Window</th><th>MD/AD/PD</th><th class="num">Score</th><th>Transit support</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted small">No clear progeny-significator window found in range.</td></tr>'}</tbody></table>`;
  }
  function progPersonSection(an, name) {
    const t = an.timing;
    const near = t.nearest ? `${Dasha.fmtDMY(t.nearest.startJd)} – ${Dasha.fmtDMY(t.nearest.endJd)}` : '—';
    return `
      <div class="card"><h2>${esc(name)} — Progeny Detail</h2>
        <div style="margin:4px 0">${chip(an.verdict.label, an.verdict.cls)} <span class="muted small">progeny index ${an.index}/100</span></div>
        <div class="grid-2">${progSphutaCard(an.sphuta)}
          <div class="card" style="margin:0">
            <h3>Timing — Daśā + Transit</h3>
            <div class="kv"><span>Nearest favourable window</span><span>${near}</span></div>
            <div class="kv"><span>Period (MD/AD/PD)</span><span>${t.nearest ? `${t.nearest.md}/${t.nearest.ad}/${t.nearest.pd}` : '—'}</span></div>
            ${t.nearest && (t.nearest.transitNotes || []).length ? `<p class="small muted">Transit: ${esc(t.nearest.transitNotes.join('; '))}</p>` : ''}
            <p class="small muted">Childbirth fructifies in the daśā/bhukti of progeny significators (5th lord, Jupiter, KP 2/5/11 significators), reinforced by Jupiter transiting the 5th.</p>
          </div>
        </div>
      </div>
      ${progParasharaBlock(an.par)}
      ${progKpBlock(an.kp)}
      <div class="card"><h3>${esc(name)} — Strongest progeny windows (next 20 years)</h3>${progTimingTable(t)}</div>`;
  }

  function renderProgeny() {
    const r = state.results; const p = r.progeny; const b = state.boy, g = state.girl;
    const v = p.verdict;
    const near = p.combinedNearest ? `${Dasha.fmtDMY(p.combinedNearest.startJd)} – ${Dasha.fmtDMY(p.combinedNearest.endJd)} (${p.combinedNearest.md}/${p.combinedNearest.ad}/${p.combinedNearest.pd})` : '—';
    $('tab-progeny').innerHTML = `
      <div class="card">
        <h2>Progeny (Santāna) Analysis — ${esc(b.meta.name)} &amp; ${esc(g.meta.name)}</h2>
        <div class="grid-3">
          <div class="card" style="margin:0;text-align:center">
            <div class="big-score">${p.index}<small>/100</small></div>
            <div style="margin-top:8px">${chip(v.label, v.cls)}</div>
            <div class="muted small" style="margin-top:6px">Combined Parāśara + KP + Beeja/Kṣetra</div>
          </div>
          <div class="card" style="margin:0">
            ${gaugePct('Husband — Parāśara', p.boy.par.score)}
            ${gaugePct('Wife — Parāśara', p.girl.par.score)}
            ${gaugePct('Beeja / Kṣetra pair', p.pairSphuta)}
          </div>
          <div class="card" style="margin:0">
            ${gaugePct('Husband — KP', p.boy.kp.confidence)}
            ${gaugePct('Wife — KP', p.girl.kp.confidence)}
            <div class="kv"><span>Likely first-child window</span><span>${near}</span></div>
          </div>
        </div>
        ${p.notes.map((n) => `<p class="small bhava-char-item">• ${esc(n)}</p>`).join('')}
        <p class="muted small">Progeny is judged from the 5th house (Putra Bhāva) in D1, D9 and D7 (Saptāṁśa), the putra-kāraka Jupiter,
          the KP 5th cusp sub-lord, and the Beeja (husband) / Kṣetra (wife) Sphuṭas. Timing comes from the Vimśottari daśā of
          progeny significators with Jupiter's transit support.</p>
      </div>
      <div class="card"><h2>Charts used — Husband (D1 · D9 · D7 · KP)</h2>${header(b)}${ChartDraw.renderQuad(b, b.meta.name)}</div>
      <div class="card"><h2>Charts used — Wife (D1 · D9 · D7 · KP)</h2>${header(g)}${ChartDraw.renderQuad(g, g.meta.name)}</div>
      ${progPersonSection(p.boy, b.meta.name + ' (Husband)')}
      ${progPersonSection(p.girl, g.meta.name + ' (Wife)')}`;
  }

  function renderProgenyIndividual() {
    const r = state.results; const p = r.progeny; const chart = r.chart;
    const v = p.verdict; const t = p.timing;
    const near = t.nearest ? `${Dasha.fmtDMY(t.nearest.startJd)} – ${Dasha.fmtDMY(t.nearest.endJd)}` : '—';
    const sphLabel = p.gender === 'female' ? 'Kṣetra' : 'Beeja';
    $('tab-progeny').innerHTML = `
      <div class="card">
        <h2>Progeny (Santāna) Analysis — ${esc(r.name)}</h2>
        <div class="grid-3">
          <div class="card" style="margin:0;text-align:center">
            <div class="big-score">${p.index}<small>/100</small></div>
            <div style="margin-top:8px">${chip(v.label, v.cls)}</div>
            <div class="muted small" style="margin-top:6px">Parāśara + KP + ${sphLabel} Sphuṭa</div>
          </div>
          <div class="card" style="margin:0">
            ${gaugePct('Parāśara 5th-house', p.par.score)}
            ${gaugePct('KP 5th sub-lord', p.kp.confidence)}
            ${gaugePct(sphLabel + ' Sphuṭa', p.sphuta.score)}
          </div>
          <div class="card" style="margin:0">
            <div class="kv"><span>Nearest favourable window</span><span>${near}</span></div>
            <div class="kv"><span>Period (MD/AD/PD)</span><span>${t.nearest ? `${t.nearest.md}/${t.nearest.ad}/${t.nearest.pd}` : '—'}</span></div>
          </div>
        </div>
        <p class="muted small">Individual progeny prospects — the partner is not considered. The ${p.gender === 'female' ? 'Kṣetra (female fertility)' : 'Beeja (male potency)'} Sphuṭa is used for this native.</p>
      </div>
      <div class="card"><h2>Charts used — D1 · D9 · D7 · KP</h2>${header(chart)}${ChartDraw.renderQuad(chart, chart.meta.name)}</div>
      ${progPersonSection(p, r.name)}`;
  }

  /* ---------------- Report (PDF) ---------------- */
  function renderReport() {
    const r = state.results;
    const s = overallScore(); const ov = overallVerdict(s);
    const b = state.boy, g = state.girl;
    const node = $('report-content');

    // Pull the fully-rendered content from each analysis tab so the report
    // contains EVERY page of analysis. renderReport runs last, so all tab
    // panels are already populated.
    const grab = (id) => {
      const el = $('tab-' + id);
      return el ? el.innerHTML : '';
    };
    const section = (title, id) => `
      <div class="report-section">
        <h2 class="report-section-title">${esc(title)}</h2>
        ${grab(id)}
      </div>`;

    node.innerHTML = `
      <div class="card report-cover">
        <h2 style="text-align:center">Marriage Compatibility Report</h2>
        <p class="small muted" style="text-align:center">${esc(b.meta.name)} &amp; ${esc(g.meta.name)} — generated ${nowDMY()}</p>
        <div style="text-align:center;margin:10px 0">
          <span class="big-score">${s}<small>/100</small></span><br/>${chip(ov.label, ov.cls)}
        </div>
        <table>
          <tr><th>Module</th><th>Result</th></tr>
          <tr><td>Ashtakoota (Guna Milan)</td><td>${r.koota.ashtakoota.total}/36 — ${r.koota.ashtakoota.verdict.label}</td></tr>
          <tr><td>Dashakoota (Porutham)</td><td>${r.koota.dashakoota.passCount}/10 — ${r.koota.dashakoota.verdict.label}</td></tr>
          <tr><td>BPHS marriage index</td><td>${r.bphs.combined}/100 — ${r.bphs.verdict.label}</td></tr>
          <tr><td>KP promise confidence</td><td>${r.kp.combined}% — ${r.kp.verdict.label}</td></tr>
          <tr><td>Health compatibility</td><td>${r.health.score}/100 — ${r.health.verdict.label}</td></tr>
          <tr><td>Sarvashtakavarga (SAV)</td><td>${r.sarvashtaka.score}/100 — ${r.sarvashtaka.verdict.label}</td></tr>
          <tr><td>Nearest marriage window</td><td>${esc(r.window.nearestRange)}</td></tr>
          ${r.koota.ashtakoota.doshas.length ? `<tr><td>Dosha alerts</td><td>${r.koota.ashtakoota.doshas.join(', ')}</td></tr>` : ''}
        </table>
        <div class="card" style="margin-top:14px"><h3>Birth Data</h3>${header(b)}${header(g)}</div>
        <p class="small muted" style="margin-top:10px">This report contains the complete analysis: visual charts (D1/D9/KP),
          house-by-house matching, BPHS &amp; KP assessments, Koota matching, marriage timing, the 20-year forecast,
          transits, health compatibility and Sarvashtakavarga.</p>
        <p class="dev-credit" style="margin-top:10px">Developed by <b>Dr. Anil Sabaji</b> &nbsp;•&nbsp; Email: anilsabaji@gmail.com</p>
      </div>

      ${section('1 · Charts (D1, D9, KP)', 'charts')}
      ${section('2 · House-by-House Matching (Bhāva)', 'bhava')}
      ${section('3 · BPHS Assessment', 'bphs')}
      ${section('4 · KP Assessment', 'kp')}
      ${section('5 · Koota Matching (Ashtakoota & Dashakoota)', 'koota')}
      ${section('5b · Kuja (Maṅgala) Dosha & Cancellation', 'kuja')}
      ${section('6 · Marriage Timing', 'timing')}
      ${section('7 · 20-Year Relationship Forecast', 'forecast')}
      ${section('8 · Transits (Gochara)', 'transit')}
      ${section('9 · Health Compatibility', 'health')}
      ${section('10 · Sarvashtakavarga (SAV)', 'sarvashtaka')}
      ${section('11 · Progeny (Santāna)', 'progeny')}

      <p class="footer-note">For educational &amp; decision-support purposes only. Sidereal (Lahiri) calculations — Build v5.17</p>
      <p class="dev-credit footer-credit">Developed by <b>Dr. Anil Sabaji</b> &nbsp;•&nbsp; Email: anilsabaji@gmail.com</p>
    `;
  }
  function tableFromAshta(a) {
    return `<table><thead><tr><th>Koota</th><th class="num">Score</th><th class="num">Max</th><th>Detail</th></tr></thead><tbody>${a.items.map((i)=>`<tr><td>${esc(i.key)}</td><td class="num">${i.score}</td><td class="num">${i.max}</td><td>${esc(i.note)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num"><b>${a.total}</b></td><td class="num"><b>36</b></td><td></td></tr></tbody></table>`;
  }
  function tableFromDasha(d) {
    return `<table><thead><tr><th>Porutham</th><th>Result</th><th>Detail</th></tr></thead><tbody>${d.items.map((i)=>`<tr><td>${esc(i.key)}</td><td>${i.pass?'PASS':'FAIL'}</td><td>${esc(i.detail)}</td></tr>`).join('')}</tbody></table>`;
  }
  function forecastMini(f) {
    return `<table><thead><tr><th>Period</th><th class="num">Combined</th><th>Band</th></tr></thead><tbody>${f.slice(0,10).map((x)=>`<tr><td>${x.start} – ${x.end}</td><td class="num">${x.combined}</td><td>${x.band.label}</td></tr>`).join('')}</tbody></table>`;
  }

  /* Mode-aware report naming/titles. In Individual mode one of state.boy/girl
     is null, so derive everything from state.results / state.subject. */
  function reportInfo() {
    const r = state.results || {};
    if (r.individual) {
      const subj = (r.name || (state.subject && state.subject.meta && state.subject.meta.name) || 'Individual');
      return {
        individual: true,
        fileBase: `Marriage-Report-${(state.subject && state.subject.meta ? state.subject.meta.name : 'Individual')}`.replace(/\s+/g, '_'),
        title: `Individual Marriage Report — ${esc(subj)}`,
        subtitle: esc(subj),
      };
    }
    const b = state.boy && state.boy.meta ? state.boy.meta.name : 'Groom';
    const g = state.girl && state.girl.meta ? state.girl.meta.name : 'Bride';
    return {
      individual: false,
      fileBase: `Marriage-Report-${b}-${g}`.replace(/\s+/g, '_'),
      title: `Marriage Compatibility Report — ${esc(b)} & ${esc(g)}`,
      subtitle: `${esc(b)} &amp; ${esc(g)}`,
    };
  }

  /* Cache the stylesheet so report export & print are standalone and reliable. */
  let _reportCss = null;
  async function getReportCss() {
    if (_reportCss != null) return _reportCss;
    try { const res = await fetch('css/styles.css?v=30'); _reportCss = res.ok ? await res.text() : ''; }
    catch (e) { _reportCss = ''; }
    return _reportCss;
  }

  /* Build a FULLY self-contained report document (CSS inlined, light printable
     theme baked in). Used by both "Download HTML" and the print pipeline so the
     output can never be blank / white-on-white. */
  function buildReportDoc(css, opts) {
    const info = reportInfo();
    const reportHtml = $('report-content').innerHTML;
    const dateStr = nowDMY();
    const pdfMode = !!(opts && opts.pdf);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${info.title}</title>
<style>
${css}
/* ---- standalone, light, printable theme so nothing is ever blank ---- */
html, body { background:#ffffff !important; }
body { color:#1a1a1a !important; padding: 24px; max-width: 1000px; margin: 0 auto; }
body * { color:#1a1a1a; }
.tab-panel, #report-content { display: block !important; }
.report-meta { color:#555 !important; font-size: 12px; margin-bottom: 18px; text-align:center; }
.card, .chart-box, fieldset, .callout, .bhava-col, .bhava-result, .bhava-what-indicates {
  background:#fff !important; border-color:#ccc !important; box-shadow:none !important; }
.card::before, fieldset::after { display:none !important; }
h1, h2, h3, .big-score, .card h2 {
  -webkit-text-fill-color: initial !important; background:none !important; color:#5b3fb0 !important; }
.report-section-title {
  background:#5b3fb0 !important; color:#fff !important; -webkit-text-fill-color:#fff !important;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.muted, .small.muted, .footer-note { color:#555 !important; }
table { width:100% !important; max-width:100% !important; table-layout:fixed; font-size:9px; }
th, td { word-break:break-word; overflow-wrap:anywhere; white-space:normal; padding:3px 4px; border-color:#ccc; }
th { color:#333 !important; background:#f0f0f0 !important; }
/* ---- keep everything within the page width (applies on screen, print & html2canvas raster) ---- */
#report-content, .card, .report-section, .report-cover, .bhava-house-card,
.chart-box, .grid-2, .grid-3, .bhava-compare-grid,
.pdf-render #report-content, .pdf-render .card, .pdf-render .report-section, .pdf-render .bhava-house-card,
.pdf-render .grid-2, .pdf-render .grid-3, .pdf-render .bhava-compare-grid { min-width:0 !important; max-width:100% !important; overflow:visible !important; }
/* ---- solid, fixed-height strength bars (html2canvas drops %-height + var() gradients) ---- */
.gauge .bar, .pdf-render .gauge .bar { height:12px !important; background:#eaeaea !important; border:1px solid #bbb !important; border-radius:8px; overflow:hidden; box-shadow:none !important; }
.gauge .fill, .pdf-render .gauge .fill { height:12px !important; min-height:12px !important; border-radius:8px; box-shadow:none !important; background:#5b3fb0 !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
.gauge .fill.good, .pdf-render .gauge .fill.good { background:#13a05a !important; }
.gauge .fill.mid,  .pdf-render .gauge .fill.mid  { background:#e0a400 !important; }
.gauge .fill.bad,  .pdf-render .gauge .fill.bad  { background:#cc3b34 !important; }
.chart-triple, .pdf-render .chart-triple { display:grid !important; grid-template-columns: repeat(3, minmax(0,1fr)) !important; gap:6px !important; }
.chart-box, .pdf-render .chart-box { min-width:0 !important; }
svg, .chart-svg, .pipe-svg, .pdf-render svg, .pdf-render .chart-svg, .pdf-render .pipe-svg { width:100% !important; max-width:100% !important; height:auto !important; display:block; }
.bav-table { table-layout:fixed !important; width:100% !important; font-size:7px !important; }
.bav-table th, .bav-table td { padding:1px 2px !important; }
.chart-svg .chart-planet { fill:#111 !important; } .chart-svg .chart-sign { fill:#0a7a52 !important; }
.chart-svg .chart-title { fill:#5b3fb0 !important; }
.chip { border:1px solid #999 !important; background:#f3f3f3 !important; }
.gauge .fill, .report-section-title, .bhava-sign-badge { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
@page { size: A4 portrait; margin: 12mm; }
@media print {
  /* Fit the printable area exactly and centre via the symmetric @page margins. */
  html, body { width:100% !important; max-width:100% !important; margin:0 auto !important; padding:0 !important; }
  #report-content { width:100% !important; max-width:100% !important; margin:0 auto !important; }
  .card, .report-section, .report-cover, .bhava-house-card {
    margin-left:auto !important; margin-right:auto !important; max-width:100% !important; }
  .chart-triple { justify-content:center !important; }
  .report-section { page-break-before: always; }
  .report-cover { page-break-after: always; }
}
${pdfMode ? '/* PDF raster mode: no body padding (margins come from html2pdf); fill width so html2canvas output is symmetric & centred. */ body{padding:0 !important;margin:0 !important;max-width:100% !important;width:100% !important;} #report-content{width:100% !important;max-width:100% !important;margin:0 !important;}' : ''}
</style>
</head>
<body class="pdf-render">
<header class="app-header" style="border-radius:14px;margin-bottom:18px;background:#fff">
  <h1><span class="om">&#x0950;</span> Vedic Marriage Matching Report</h1>
  <p>${info.subtitle}</p>
  <p class="dev-credit">By <b>Dr. Anil Sabaji</b>, Email: <a href="mailto:anilsabaji@gmail.com">anilsabaji@gmail.com</a></p>
</header>
<div class="report-meta">Generated ${esc(dateStr)} — Vedic Marriage Matching Module (BPHS &amp; KP)</div>
<div id="report-content">${reportHtml}</div>
<p class="footer-note" style="text-align:center;margin-top:24px;opacity:.7;font-size:11.5px">
  For educational &amp; decision-support purposes only. Sidereal (Lahiri) calculations. Build v5.17
</p>
<p class="dev-credit footer-credit">By <b>Dr. Anil Sabaji</b>, Email: anilsabaji@gmail.com</p>
</body>
</html>`;
  }

  /* Print the report from an isolated hidden iframe with the CSS inlined. This
     avoids the fragile @media-print / body-class interactions that produced
     blank pages, and prints ONLY the report. */
  async function printReportNow() {
    const css = await getReportCss();
    const doc = buildReportDoc(css);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const idoc = win.document;
    idoc.open(); idoc.write(doc); idoc.close();
    let done = false;
    const fire = () => {
      if (done) return; done = true;
      try { win.focus(); win.print(); } catch (e) { console.error('print error', e); }
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
    };
    // CSS is inlined and all charts are inline SVG, so layout is ready quickly.
    iframe.onload = () => setTimeout(fire, 300);
    setTimeout(fire, 700); // fallback in case onload doesn't fire
  }

  /* Render the PDF from a fixed-width (A4-proportioned) offscreen iframe of the
     self-contained report, with symmetric html2pdf margins. This guarantees the
     output is centred and fits the page width (no left/right overflow). */
  async function downloadPdfNow() {
    const name = `${reportInfo().fileBase}.pdf`;
    if (!window.html2pdf) { printReportNow(); return; }
    const css = await getReportCss();
    const doc = buildReportDoc(css, { pdf: true });
    const iframe = document.createElement('iframe');
    // 794px ≈ A4 width at 96dpi → keeps the capture in portrait proportions.
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;background:#fff;';
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow.document;
    idoc.open(); idoc.write(doc); idoc.close();
    let started = false;
    const cleanup = () => { setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 400); };
    const run = () => {
      if (started) return; started = true;
      window.html2pdf().set({
        margin: 10, filename: name, // uniform 10mm margins on all sides → centred
        image: { type: 'png' }, // PNG keeps text crisp (JPEG can blur/garble small text)
        html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, letterRendering: true, width: 794, windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // avoid slicing through these elements (mid-line slices cause missing/garbled text)
        pagebreak: { mode: ['css', 'legacy'], before: '.report-section', avoid: ['tr', '.gauge', '.kv', '.chip', '.bhava-house-card', '.chart-box', 'h2', 'h3', 'svg'] },
      }).from(idoc.body).save().then(cleanup).catch((e) => { console.error('PDF error', e); cleanup(); printReportNow(); });
    };
    iframe.onload = () => setTimeout(run, 350);
    setTimeout(run, 800); // fallback if onload doesn't fire
  }

  $('printReport').addEventListener('click', () => {
    if (!state.results) { alert('Please generate a report first (Tab 1).'); return; }
    try { printReportNow(); }
    catch (e) { console.error(e); window.print(); }
  });
  $('downloadPdf').addEventListener('click', () => {
    if (!state.results) { alert('Please generate a report first (Tab 1).'); return; }
    try { downloadPdfNow(); }
    catch (e) { console.error('PDF error', e); printReportNow(); }
  });

  $('downloadHtml').addEventListener('click', async () => {
    if (!state.results) { alert('Please generate a report first (Tab 1).'); return; }
    const css = await getReportCss();
    const doc = buildReportDoc(css);
    const fileName = `${reportInfo().fileBase}.html`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------------- GeoCity autocomplete initialization ---------------- */
  if (typeof GeoCity !== 'undefined') {
    GeoCity.attach('b_place', 'b_lat', 'b_lon', 'b_tz');
    GeoCity.attach('g_place', 'g_lat', 'g_lon', 'g_tz');
  }
})();

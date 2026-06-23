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
    const bi = readInput('b_'); const gi = readInput('g_');
    const boy = Astro.buildChart(bi); boy.meta = bi;
    const girl = Astro.buildChart(gi); girl.meta = gi;
    state.boy = boy; state.girl = girl;

    const today = new Date();
    state.fromJd = Astro.julianDay(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate(), 0);

    const r = {};
    r.koota = Koota.fullMatch(boy, girl);
    r.bphs = BPHS.coupleAssessment(boy, girl);
    r.kp = KP.coupleAssessment(boy, girl);
    r.health = Health.compatibility(boy, girl);
    r.window = Timeline.coupleMarriageWindow(boy, girl, state.fromJd);
    r.forecast = Timeline.relationshipForecast(boy, girl, state.fromJd, 20);
    r.bhavaB = BPHS.analyzeAll(boy);
    r.bhavaG = BPHS.analyzeAll(girl);
    r.kpB = KP.assess(boy); r.kpG = KP.assess(girl);
    r.transitB = Transit.summary(boy, state.fromJd, 20);
    r.transitG = Transit.summary(girl, state.fromJd, 20);
    r.sarvashtaka = Sarvashtaka.coupleAnalysis(boy, girl);
    state.results = r;

    const safeRender = (fn, name) => { try { fn(); } catch(e) { console.warn(name + ' render error:', e); } };
    safeRender(renderSummary, 'Summary');
    safeRender(renderCharts, 'Charts');
    safeRender(renderBhava, 'Bhava');
    safeRender(renderBPHS, 'BPHS');
    safeRender(renderKP, 'KP');
    safeRender(renderKoota, 'Koota');
    safeRender(renderTiming, 'Timing');
    safeRender(renderForecast, 'Forecast');
    safeRender(renderTransit, 'Transit');
    safeRender(renderHealth, 'Health');
    safeRender(renderSarvashtaka, 'Sarvashtaka');
    safeRender(renderReport, 'Report');
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
    return `<div class="muted small">${esc(m.name)} — ${m.d}/${m.m}/${m.y}, ${String(m.hour).padStart(2,'0')}:${String(m.min).padStart(2,'0')} (TZ ${m.tzOffsetHours}h), ${esc(m.place)} [${fix(m.lat)}, ${fix(m.lonEast)}]</div>`;
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
  function renderBPHS() {
    const r = state.results; const b = r.bphs;
    $('tab-bphs').innerHTML = `
      <div class="card">
        <h2>BPHS Marriage Assessment</h2>
        <div style="margin:6px 0">${chip(b.verdict.label, b.verdict.cls)} &nbsp; Combined index <b>${b.combined}/100</b></div>
        ${gaugePct('Groom marriage index', b.boy.index)}
        ${gaugePct('Bride marriage index', b.girl.index)}
      </div>
      <div class="grid-2">
        <div class="card"><h3>Groom — key marriage houses</h3>${marriageHouseMini(b.boy)}
          <div class="kv"><span>Venus (kāraka) dignity</span><span>${esc(b.boy.venusDignity.label)}</span></div>
          <div class="kv"><span>Jupiter dignity</span><span>${esc(b.boy.jupiterDignity.label)}</span></div>
          <div class="kv"><span>7th-house afflictions</span><span>${b.boy.seventhAfflictions}</span></div>
        </div>
        <div class="card"><h3>Bride — key marriage houses</h3>${marriageHouseMini(b.girl)}
          <div class="kv"><span>Jupiter (kāraka) dignity</span><span>${esc(b.girl.jupiterDignity.label)}</span></div>
          <div class="kv"><span>Venus dignity</span><span>${esc(b.girl.venusDignity.label)}</span></div>
          <div class="kv"><span>7th-house afflictions</span><span>${b.girl.seventhAfflictions}</span></div>
        </div>
      </div>
      <div class="card"><h3>Interpretation</h3>${b.notes.map((n) => `<p class="small">• ${esc(n)}</p>`).join('')}</div>`;
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
  function renderTiming() {
    const r = state.results; const w = r.window;
    function topList(person, label) {
      let rows = '';
      person.topByScore.forEach((t) => {
        rows += `<tr><td>${Dasha.fmtYM(t.startJd)} – ${Dasha.fmtYM(t.endJd)}</td><td>${t.md}/${t.ad}/${t.pd}</td><td class="num">${fix(t.score,1)}</td></tr>`;
      });
      return `<div class="card"><h3>${label} — strongest marriage periods</h3>
        <table><thead><tr><th>Window</th><th>MD/AD/PD</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    $('tab-timing').innerHTML = `
      <div class="card">
        <h2>Nearest Marriage Timing</h2>
        <div class="big-score" style="font-size:26px">${esc(w.nearestRange)}</div>
        <p class="small muted">Earliest window where both partners' Dasha readiness and supportive transits coincide.</p>
        <div class="kv"><span>Groom running Dasha then</span><span>${w.boyDasha ? `${w.boyDasha.md.lord}/${w.boyDasha.ad?w.boyDasha.ad.lord:'-'}/${w.boyDasha.pd?w.boyDasha.pd.lord:'-'}` : '-'}</span></div>
        <div class="kv"><span>Bride running Dasha then</span><span>${w.girlDasha ? `${w.girlDasha.md.lord}/${w.girlDasha.ad?w.girlDasha.ad.lord:'-'}/${w.girlDasha.pd?w.girlDasha.pd.lord:'-'}` : '-'}</span></div>
      </div>
      <div class="grid-2">
        ${topList(w.boy, 'Groom')}
        ${topList(w.girl, 'Bride')}
      </div>
      <div class="callout small">Timing blends Vimśottari MD/AD/PD favourability (7th/2nd/11th/5th lords, the
        Venus/Jupiter kāraka and KP 2-7-11 significators) with Jupiter/Saturn transit triggers. Treat the
        window as a season of opportunity, not an exact date.</div>`;
  }

  /* ---------------- Forecast ---------------- */
  function renderForecast() {
    const r = state.results;
    let rows = '';
    r.forecast.forEach((f) => {
      rows += `<tr class="band-${f.band.cls}">
        <td>${f.start} – ${f.end}</td>
        <td class="small">${f.boyDasha}</td>
        <td class="small">${f.girlDasha}</td>
        <td class="num">${f.boyStrength}</td>
        <td class="num">${f.girlStrength}</td>
        <td class="num"><b>${f.combined}</b></td>
        <td>${chip(f.band.label, f.band.cls)}</td>
        <td class="small muted">${esc(f.transitNote)}</td>
      </tr>`;
    });
    $('tab-forecast').innerHTML = `
      <div class="card">
        <h2>20-Year Relationship Strength &amp; Weakness Forecast</h2>
        <p class="small muted">Period-by-period (Mahādaśā / Antardaśā / Pratyantardaśā) outlook for the union,
          combining both partners' dasha favourability with concurrent planetary transits. Strength on 0–100.</p>
        <table><thead><tr><th>Period</th><th>Groom MD/AD/PD</th><th>Bride MD/AD/PD</th><th class="num">Groom</th><th class="num">Bride</th><th class="num">Combined</th><th>Band</th><th>Key transit</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="legend-line"><span class="dot good"></span>Strong/Supportive &nbsp; <span class="dot mid"></span>Mixed &nbsp; <span class="dot bad"></span>Testing/Strained</div>
      </div>
      <div class="callout small">Phases marked <i>Testing</i> indicate periods needing extra communication, patience
        and shared effort (often Saturn/Rahu activations or 6/8/12-lord sub-periods); <i>Strong</i> phases favour
        harmony, milestones (children, property) and renewal of the bond.</div>`;
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

  /* ---------------- Report (PDF) ---------------- */
  function renderReport() {
    const r = state.results;
    const s = overallScore(); const ov = overallVerdict(s);
    const b = state.boy, g = state.girl;
    const node = $('report-content');
    node.innerHTML = `
      <div class="card">
        <h2 style="text-align:center">Marriage Compatibility Report</h2>
        <p class="small muted" style="text-align:center">${esc(b.meta.name)} &amp; ${esc(g.meta.name)} — generated ${new Date().toLocaleDateString()}</p>
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
      </div>
      <div class="card"><h3>Birth Data</h3>${header(b)}${header(g)}</div>
      <div class="card"><h3>Groom — Planetary Positions</h3>${planetTable(b)}</div>
      <div class="card"><h3>Bride — Planetary Positions</h3>${planetTable(g)}</div>
      <div class="card"><h3>Ashtakoota Detail</h3>${tableFromAshta(r.koota.ashtakoota)}</div>
      <div class="card"><h3>Dashakoota Detail</h3>${tableFromDasha(r.koota.dashakoota)}</div>
      <div class="card"><h3>BPHS Interpretation</h3>${r.bphs.notes.map((n)=>`<p class="small">• ${esc(n)}</p>`).join('')}</div>
      <div class="card"><h3>KP Interpretation</h3>${r.kp.notes.map((n)=>`<p class="small">• ${esc(n)}</p>`).join('')}</div>
      <div class="card"><h3>Marriage Timing &amp; Forecast (next periods)</h3>${forecastMini(r.forecast)}</div>
      <div class="card"><h3>Health Compatibility</h3>${r.health.notes.map((n)=>`<p class="small">• ${esc(n)}</p>`).join('')}</div>
      <p class="footer-note">For educational &amp; decision-support purposes only.</p>
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

  $('printReport').addEventListener('click', () => {
    if (!state.results) { alert('Please generate a report first (Tab 1).'); return; }
    window.print();
  });
  $('downloadPdf').addEventListener('click', () => {
    if (!state.results) { alert('Please generate a report first (Tab 1).'); return; }
    const el = $('report-content');
    if (window.html2pdf) {
      const name = `Marriage-Report-${state.boy.meta.name}-${state.girl.meta.name}.pdf`.replace(/\s+/g, '_');
      window.html2pdf().set({
        margin: 10, filename: name,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(el).save();
    } else {
      window.print();
    }
  });

  /* ---------------- GeoCity autocomplete initialization ---------------- */
  if (typeof GeoCity !== 'undefined') {
    GeoCity.attach('b_place', 'b_lat', 'b_lon', 'b_tz');
    GeoCity.attach('g_place', 'g_lat', 'g_lon', 'g_tz');
  }
})();

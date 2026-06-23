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
      setTab('charts');
    } catch (err) {
      alert('Calculation error: ' + err.message);
      console.error(err);
    }
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
    state.results = r;

    renderSummary();
    renderCharts();
    renderBhava();
    renderBPHS();
    renderKP();
    renderKoota();
    renderTiming();
    renderForecast();
    renderTransit();
    renderHealth();
    renderReport();
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
      <div class="grid-2">
        <div class="card"><h2>Groom — Rāśi / Planetary Chart</h2>${header(b)}${planetTable(b)}</div>
        <div class="card"><h2>Bride — Rāśi / Planetary Chart</h2>${header(g)}${planetTable(g)}</div>
      </div>
      <div class="card"><h3>How to read this</h3><p class="small muted">Positions are sidereal (Lahiri). "House" uses the Whole-Sign system from the Lagna (BPHS frame). "Star Lord" and "Sub Lord" are the Vimśottari nakshatra lord and KP sub-lord. (R) marks retrograde motion; Rahu/Ketu are always retrograde.</p></div>`;
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
  function renderBhava() {
    const r = state.results;
    $('tab-bhava').innerHTML = `
      <div class="card">
        <h2>Bhāva (House) Significations — Groom</h2>${header(state.boy)}
        ${bhavaTable(r.bhavaB)}
      </div>
      <div class="card">
        <h2>Bhāva (House) Significations — Bride</h2>${header(state.girl)}
        ${bhavaTable(r.bhavaG)}
      </div>
      <div class="callout small">Each Bhāva's strength (0–100) blends the dignity and placement of its lord,
        the benefic/malefic occupants and aspects. Houses 7 (spouse), 2 (family), 11 (fulfilment),
        5 (romance/progeny) and 8 (intimacy/longevity) carry the most weight for marriage.</div>`;
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
})();

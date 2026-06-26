/* =============================================================================
 * timeline.js  —  Marriage timing & 20-year relationship strength forecast
 *
 * Combines the Vimshottari Dasha engine (dasha.js) with the transit engine
 * (transit.js) and the natal significators (bphs.js / kp.js) to:
 *   1. Estimate the NEAREST favourable marriage window for each partner and
 *      for the couple (intersection of both being ripe).
 *   2. Produce a period-by-period (MD/AD/PD) relationship strength & weakness
 *      forecast for the next 20 years, also weighing planetary transits.
 * ========================================================================== */

const Timeline = (function () {
  'use strict';

  // marriage-promoting planets for a chart: 7th/2nd/11th lords, Venus, Jupiter,
  // and KP marriage significators
  function marriagePlanets(chart, gender) {
    const lagna = chart.ascendant.sign;
    const lords = {
      seventh: Astro.RASHI_LORD[(lagna + 6) % 12],
      second: Astro.RASHI_LORD[(lagna + 1) % 12],
      eleventh: Astro.RASHI_LORD[(lagna + 10) % 12],
      fifth: Astro.RASHI_LORD[(lagna + 4) % 12],
    };
    const karaka = gender === 'female' ? 'Jupiter' : 'Venus';
    const weights = {};
    const add = (p, w) => { if (p) weights[p] = (weights[p] || 0) + w; };
    add(lords.seventh, 3);
    add(lords.second, 1.5);
    add(lords.eleventh, 1.5);
    add(lords.fifth, 1);
    add(karaka, 2);
    add('Venus', 1); // Venus always relevant to love
    // KP significators of 2,7,11
    try {
      KP.marriageSignificators(chart).forEach((s) => add(s.planet, Math.min(2, s.strength * 0.5)));
    } catch (e) { /* ignore */ }
    return { lords, karaka, weights };
  }

  // separative / stressful planets: 6th,8th,12th lords, malefics in 7th
  function stressPlanets(chart) {
    const lagna = chart.ascendant.sign;
    const w = {};
    const add = (p, x) => { if (p) w[p] = (w[p] || 0) + x; };
    add(Astro.RASHI_LORD[(lagna + 5) % 12], 1.2); // 6th
    add(Astro.RASHI_LORD[(lagna + 7) % 12], 1.5); // 8th
    add(Astro.RASHI_LORD[(lagna + 11) % 12], 1.0); // 12th
    return w;
  }

  function periodFavorability(chart, mp, sp, period) {
    // weight MD heavily, AD next, PD least
    const wMD = 0.5, wAD = 0.35, wPD = 0.15;
    const f = (lord) => (mp.weights[lord] || 0) - (sp[lord] || 0) * 0.8;
    let val = f(period.md) * wMD + f(period.lord) * wAD;
    // PD: average over the PDs (use representative best/worst handled elsewhere)
    return val;
  }

  // NEAREST marriage window for an individual
  function marriageWindow(chart, gender, fromJd) {
    const mp = marriagePlanets(chart, gender);
    const sp = stressPlanets(chart);
    const { periods } = Dasha.expandWindow(chart, fromJd, 20);
    const scored = [];
    periods.forEach((p) => {
      let base = periodFavorability(chart, mp, sp, p);
      // PD level scan for a sharper trigger window
      p.pds.forEach((pd) => {
        const pdScore = (mp.weights[pd.lord] || 0) - (sp[pd.lord] || 0) * 0.5;
        const mid = (Math.max(pd.startJd, fromJd) + pd.endJd) / 2;
        const tr = Transit.evaluate(chart, mid).score;
        const total = base * 0.6 + pdScore * 0.25 + tr * 0.15;
        scored.push({
          md: p.md, ad: p.lord, pd: pd.lord,
          startJd: Math.max(pd.startJd, fromJd), endJd: pd.endJd,
          score: total, transit: tr,
        });
      });
    });
    scored.sort((a, b) => b.score - a.score);
    // nearest: among the top-quartile scores, the earliest
    const threshold = scored.length ? scored[Math.floor(scored.length * 0.2)].score : 0;
    const strong = scored.filter((s) => s.score >= threshold && s.score > 0);
    strong.sort((a, b) => a.startJd - b.startJd);
    const nearest = strong[0] || scored[0];
    return { mp, sp, scored, nearest, topByScore: scored.slice(0, 6) };
  }

  /* ====================================================================
   * KP-system marriage timing.
   * In KP, marriage fructifies in the conjoined period (Daśā–Bhukti–Antara)
   * of planets that are significators of houses 2, 7 and 11. The Antara (PD)
   * and Bhukti (AD) lords must be marriage significators; the Daśā (MD) lord
   * adds weight. Transit agreement (Jupiter/Sun activating the 7th) refines it.
   * ================================================================== */
  function kpMarriageWindow(chart, fromJd, years) {
    years = years || 20;
    const targets = [2, 7, 11];
    const sigStrength = {};
    Astro.PLANETS.forEach((p) => { sigStrength[p] = (function () { try { return KP.significatorStrength(p, chart, targets); } catch (e) { return 0; } })(); });
    const { periods } = Dasha.expandWindow(chart, fromJd, years);
    const wins = [];
    periods.forEach((p) => {
      (p.pds || []).forEach((pd) => {
        const sMd = sigStrength[p.md] || 0, sAd = sigStrength[p.lord] || 0, sPd = sigStrength[pd.lord] || 0;
        if (sAd <= 0 && sPd <= 0) return; // neither Bhukti nor Antara signifies marriage → skip
        const mid = (Math.max(pd.startJd, fromJd) + pd.endJd) / 2;
        const allSig = sMd > 0 && sAd > 0 && sPd > 0;
        const dba = sMd * 1.0 + sAd * 1.8 + sPd * 1.4;
        let tr = 0; try { tr = Transit.evaluate(chart, mid).score; } catch (e) { tr = 0; }
        const total = dba * 3 + tr + (allSig ? 4 : 0);
        wins.push({
          startJd: Math.max(pd.startJd, fromJd), endJd: pd.endJd,
          md: p.md, ad: p.lord, pd: pd.lord, allSig,
          score: Math.round(total * 10) / 10, transit: tr,
        });
      });
    });
    wins.sort((a, b) => b.score - a.score);
    const chrono = wins.slice().sort((a, b) => a.startJd - b.startJd);
    const nearest = chrono.find((w) => w.score >= 4 && w.endJd >= fromJd) || chrono[0] || null;
    let sigList = [], cuspSub = '-';
    try {
      sigList = KP.marriageSignificators(chart).slice(0, 8).map((s) => ({ planet: s.planet, strength: s.strength }));
      cuspSub = KP.cuspSubLord(7, chart).subLord;
    } catch (e) { /* ignore */ }
    return { nearest, top: wins.slice(0, 6), sigList, cuspSub, sigStrength };
  }

  // Couple nearest window: where both individual scores are high & overlapping
  function coupleMarriageWindow(boyChart, girlChart, fromJd) {
    const b = marriageWindow(boyChart, 'male', fromJd);
    const g = marriageWindow(girlChart, 'female', fromJd);

    // sample every ~month over 12 years, compute joint readiness
    const samples = [];
    const stepDays = 30;
    const span = 12 * Dasha.YEAR_DAYS;
    for (let jd = fromJd; jd <= fromJd + span; jd += stepDays) {
      const bs = scoreAt(boyChart, 'male', b.mp, b.sp, jd);
      const gs = scoreAt(girlChart, 'female', g.mp, g.sp, jd);
      const joint = Math.min(bs, gs) * 0.6 + ((bs + gs) / 2) * 0.4;
      samples.push({ jd, bs, gs, joint });
    }
    // find peak joint window
    let peak = samples[0];
    samples.forEach((s) => { if (s.joint > peak.joint) peak = s; });
    // earliest sample within 85% of peak
    const cut = peak.joint * 0.85;
    const cand = samples.filter((s) => s.joint >= cut && s.joint > 0);
    const nearest = cand.length ? cand[0] : peak;
    const run = Dasha.runningAt(boyChart, nearest.jd);
    const runG = Dasha.runningAt(girlChart, nearest.jd);
    return {
      boy: b, girl: g, samples, peak, nearest,
      nearestDate: Dasha.fmtYM(nearest.jd),
      nearestRange: `${Dasha.fmtYM(nearest.jd)} – ${Dasha.fmtYM(nearest.jd + 270)}`,
      boyDasha: run, girlDasha: runG,
    };
  }

  function scoreAt(chart, gender, mp, sp, jd) {
    const r = Dasha.runningAt(chart, jd);
    if (!r || !r.ad) return 0;
    const f = (lord) => (mp.weights[lord] || 0) - (sp[lord] || 0) * 0.8;
    let val = f(r.md.lord) * 0.45 + f(r.ad.lord) * 0.35 + (r.pd ? f(r.pd.lord) * 0.2 : 0);
    val += Transit.evaluate(chart, jd).score * 0.25;
    return val;
  }

  /* ====================================================================
   * Dual-method significator weights for marriage commitment:
   *   (A) Parāśara — house lordship + occupancy of 7/2/11/5 (positive) and
   *       6/8/12 (negative) + the Venus/Jupiter kāraka.
   *   (B) KP — significator houses (star/occupancy/ownership) of 2/7/11
   *       (positive) vs 1/6/10/12 (negative).
   * Each dasha lord's contribution is scaled by its planetary strength.
   * ================================================================== */
  function parasharaWeights(chart, gender) {
    const lagna = chart.ascendant.sign;
    const lordOf = (h) => Astro.RASHI_LORD[(lagna + h - 1) % 12];
    const pos = { 7: 3.0, 2: 1.6, 11: 1.6, 5: 1.0 };
    const neg = { 6: 1.2, 8: 1.4, 12: 1.0 };
    const w = {};
    const add = (p, x) => { if (p) w[p] = (w[p] || 0) + x; };
    for (let h = 1; h <= 12; h++) {
      const L = lordOf(h);
      if (pos[h]) add(L, pos[h]);
      if (neg[h]) add(L, -neg[h]);
    }
    Astro.PLANETS.forEach((p) => {
      const hh = chart.planets[p].house;
      if (pos[hh]) add(p, 0.6 * pos[hh]);
      if (neg[hh]) add(p, -0.6 * neg[hh]);
    });
    add(gender === 'female' ? 'Jupiter' : 'Venus', 2.0);
    add('Venus', 0.5);
    return w;
  }

  function kpWeights(chart, gender) {
    const pos = { 7: 3.0, 2: 1.6, 11: 1.6, 5: 1.0 };
    const neg = { 6: 1.2, 1: 0.8, 10: 1.0, 12: 1.0 };
    const w = {};
    Astro.PLANETS.forEach((p) => {
      let v = 0; let sig = [];
      try { sig = KP.significatorHouses(p, chart); } catch (e) { sig = []; }
      sig.forEach((h) => { if (pos[h]) v += pos[h]; if (neg[h]) v -= neg[h]; });
      w[p] = v;
    });
    const k = gender === 'female' ? 'Jupiter' : 'Venus';
    w[k] = (w[k] || 0) + 1.5;
    return w;
  }

  function clampDual(v) { return Math.max(5, Math.min(98, Math.round(50 + v * 8))); }

  function strengthMult(strengthMap, lord) {
    return strengthMap && strengthMap[lord] ? strengthMap[lord].mult : 1;
  }

  // Commitment (KP & Parāśara) at a given jd, scaled by planetary strength.
  // `sep` (optional) is the Separation.analyze() result for this chart; when a
  // separative dasha lord is running AND transits are adverse, an extra penalty
  // is applied (more weightage to a triggered separation/divorce/widowhood).
  function commitmentAt(chart, parW, kpW, strengthMap, jd, mdList, sep) {
    const r = Dasha.runningAt(chart, jd, mdList);
    if (!r || !r.ad) return { kp: 5, par: 5, run: r, sepPenalty: 0, triggered: false };
    const g = (W, lord, wt) => (W[lord] || 0) * wt * strengthMult(strengthMap, lord);
    let par = g(parW, r.md.lord, 0.5) + g(parW, r.ad.lord, 0.35) + (r.pd ? g(parW, r.pd.lord, 0.15) : 0);
    let kp = g(kpW, r.md.lord, 0.5) + g(kpW, r.ad.lord, 0.35) + (r.pd ? g(kpW, r.pd.lord, 0.15) : 0);

    let sepPen = 0; let triggered = false;
    if (sep) {
      const sp = sep.separativePlanets || {};
      // dasha activation of separative significators (MD/AD/PD weighted)
      const act = (sp[r.md.lord] || 0) * 0.5 + (sp[r.ad.lord] || 0) * 0.35 + (r.pd ? (sp[r.pd.lord] || 0) * 0.15 : 0);
      // transit adversity (Sade Sati, Saturn/Rahu/Mars on 7th etc.)
      const ev = Transit.evaluate(chart, jd);
      const adverse = Math.max(0, -ev.score);
      // structural baseline drag from the promised risk
      const baseDrag = (sep.overallRisk / 100) * 0.9;
      let trig = act;
      if (trig > 0 && adverse > 0) { trig *= (1 + Math.min(1.6, adverse * 0.5)); triggered = true; } // MORE weightage when dasha + transit both fire
      sepPen = baseDrag * 0.5 + trig * 1.5;
    }
    return { kp: clampDual(kp - sepPen), par: clampDual(par - sepPen), run: r, sepPenalty: Math.round(sepPen * 100) / 100, triggered };
  }

  // Dual-method commitment series for both partners over `years`.
  function strengthSeriesDual(boyChart, girlChart, fromJd, years, stepMonths) {
    years = years || 20; stepMonths = stepMonths || 3;
    const bPar = parasharaWeights(boyChart, 'male'), bKp = kpWeights(boyChart, 'male');
    const gPar = parasharaWeights(girlChart, 'female'), gKp = kpWeights(girlChart, 'female');
    const bSM = (typeof PlanetStrength !== 'undefined') ? PlanetStrength.map(boyChart) : {};
    const gSM = (typeof PlanetStrength !== 'undefined') ? PlanetStrength.map(girlChart) : {};
    const bSep = (typeof Separation !== 'undefined') ? Separation.analyze(boyChart, 'male') : null;
    const gSep = (typeof Separation !== 'undefined') ? Separation.analyze(girlChart, 'female') : null;
    const bMd = Dasha.mahadashas(boyChart, years + 130);
    const gMd = Dasha.mahadashas(girlChart, years + 130);
    const series = [];
    const totalM = years * 12; const MONTH = 30.436875;
    for (let m = 0; m <= totalM; m += stepMonths) {
      const jd = fromJd + m * MONTH;
      const b = commitmentAt(boyChart, bPar, bKp, bSM, jd, bMd, bSep);
      const g = commitmentAt(girlChart, gPar, gKp, gSM, jd, gMd, gSep);
      const d = Dasha.jdToDate(jd);
      series.push({
        jd, m, year: d.getUTCFullYear(), label: Dasha.fmtYM(jd),
        boyKP: b.kp, boyPar: b.par, girlKP: g.kp, girlPar: g.par,
        sepBoy: b.sepPenalty, sepGirl: g.sepPenalty,
        sepTrig: !!(b.triggered || g.triggered),
      });
    }
    return { series, strength: { boy: bSM, girl: gSM }, separation: { boy: bSep, girl: gSep },
      weights: { boyPar: bPar, boyKp: bKp, girlPar: gPar, girlKp: gKp } };
  }

  // Single-person dual commitment series (KP & Parāśara) with separation triggers.
  function strengthSeriesSingle(chart, gender, fromJd, years, stepMonths) {
    years = years || 20; stepMonths = stepMonths || 3;
    const par = parasharaWeights(chart, gender), kp = kpWeights(chart, gender);
    const sm = (typeof PlanetStrength !== 'undefined') ? PlanetStrength.map(chart) : {};
    const sep = (typeof Separation !== 'undefined') ? Separation.analyze(chart, gender) : null;
    const md = Dasha.mahadashas(chart, years + 130);
    const series = [];
    const totalM = years * 12; const MONTH = 30.436875;
    for (let m = 0; m <= totalM; m += stepMonths) {
      const jd = fromJd + m * MONTH;
      const c = commitmentAt(chart, par, kp, sm, jd, md, sep);
      const d = Dasha.jdToDate(jd);
      series.push({ jd, m, year: d.getUTCFullYear(), label: Dasha.fmtYM(jd), kp: c.kp, par: c.par, sep: c.sepPenalty, sepTrig: c.triggered });
    }
    return { series, strength: sm, separation: sep };
  }

  // Evenly-sampled commitment-strength time series for both partners.
  // Returns array of { jd, m (months from start), year (calendar), label,
  // boy (0-100), girl (0-100) } sampled every `stepMonths`.
  function strengthSeries(boyChart, girlChart, fromJd, years, stepMonths) {
    years = years || 20;
    stepMonths = stepMonths || 3;
    const bmp = marriagePlanets(boyChart, 'male');
    const bsp = stressPlanets(boyChart);
    const gmp = marriagePlanets(girlChart, 'female');
    const gsp = stressPlanets(girlChart);
    const bMd = Dasha.mahadashas(boyChart, years + 130);
    const gMd = Dasha.mahadashas(girlChart, years + 130);
    const series = [];
    const totalMonths = years * 12;
    const MONTH = 30.436875;
    for (let m = 0; m <= totalMonths; m += stepMonths) {
      const jd = fromJd + m * MONTH;
      const boy = clamp(scoreAtMd(boyChart, bmp, bsp, jd, bMd));
      const girl = clamp(scoreAtMd(girlChart, gmp, gsp, jd, gMd));
      const d = Dasha.jdToDate(jd);
      series.push({
        jd, m,
        year: d.getUTCFullYear(),
        label: Dasha.fmtYM(jd),
        boy, girl,
      });
    }
    return series;
  }

  // scoreAt variant that reuses a precomputed Mahadasha list (faster for series)
  function scoreAtMd(chart, mp, sp, jd, mdList) {
    const r = Dasha.runningAt(chart, jd, mdList);
    if (!r || !r.ad) return 0;
    const f = (lord) => (mp.weights[lord] || 0) - (sp[lord] || 0) * 0.8;
    let val = f(r.md.lord) * 0.45 + f(r.ad.lord) * 0.35 + (r.pd ? f(r.pd.lord) * 0.2 : 0);
    val += Transit.evaluate(chart, jd).score * 0.25;
    return val;
  }

  // 20-year relationship strength / weakness forecast (period rows)
  function relationshipForecast(boyChart, girlChart, fromJd, years) {
    years = years || 20;
    const bmp = marriagePlanets(boyChart, 'male');
    const bsp = stressPlanets(boyChart);
    const gmp = marriagePlanets(girlChart, 'female');
    const gsp = stressPlanets(girlChart);
    // dual-method weights + planetary strength maps
    const bPar = parasharaWeights(boyChart, 'male'), bKp = kpWeights(boyChart, 'male');
    const gPar = parasharaWeights(girlChart, 'female'), gKp = kpWeights(girlChart, 'female');
    const bSM = (typeof PlanetStrength !== 'undefined') ? PlanetStrength.map(boyChart) : {};
    const gSM = (typeof PlanetStrength !== 'undefined') ? PlanetStrength.map(girlChart) : {};
    const bSep = (typeof Separation !== 'undefined') ? Separation.analyze(boyChart, 'male') : null;
    const gSep = (typeof Separation !== 'undefined') ? Separation.analyze(girlChart, 'female') : null;

    // Drive the timeline off the BOY's AD periods (a stable cadence), and for
    // each, sample mid-point for both partners + transits.
    const win = Dasha.expandWindow(boyChart, fromJd, years);
    const bMd = win.mds;
    const gMd = Dasha.mahadashas(girlChart, years + 130);
    const rows = [];
    win.periods.forEach((p) => {
      const mid = (Math.max(p.startJd, fromJd) + p.endJd) / 2;
      const bScore = clamp(scoreAt(boyChart, 'male', bmp, bsp, mid));
      const gScore = clamp(scoreAt(girlChart, 'female', gmp, gsp, mid));
      const bC = commitmentAt(boyChart, bPar, bKp, bSM, mid, bMd, bSep);
      const gC = commitmentAt(girlChart, gPar, gKp, gSM, mid, gMd, gSep);
      const bRun = Dasha.runningAt(boyChart, mid, bMd);
      const gRun = Dasha.runningAt(girlChart, mid, gMd);
      const bT = Transit.evaluate(boyChart, mid);
      const gT = Transit.evaluate(girlChart, mid);
      const combined = Math.round((bScore + gScore) / 2);
      rows.push({
        start: Dasha.fmtYM(Math.max(p.startJd, fromJd)),
        end: Dasha.fmtYM(p.endJd),
        startJd: Math.max(p.startJd, fromJd),
        boyDasha: bRun ? `${bRun.md.lord}/${bRun.ad ? bRun.ad.lord : '-'}/${bRun.pd ? bRun.pd.lord : '-'}` : '-',
        girlDasha: gRun ? `${gRun.md.lord}/${gRun.ad ? gRun.ad.lord : '-'}/${gRun.pd ? gRun.pd.lord : '-'}` : '-',
        boyStrength: bScore,
        girlStrength: gScore,
        combined,
        band: band(combined),
        transitNote: mergeTriggers(bT, gT),
        boyKP: bC.kp, boyPar: bC.par, girlKP: gC.kp, girlPar: gC.par,
        combinedKP: Math.round((bC.kp + gC.kp) / 2),
        combinedPar: Math.round((bC.par + gC.par) / 2),
        sepTrig: !!(bC.triggered || gC.triggered),
        sepPenalty: Math.round(Math.max(bC.sepPenalty, gC.sepPenalty) * 100) / 100,
      });
    });
    return rows;
  }

  function clamp(v) {
    // map roughly [-4 .. +6] into 0..100
    let pct = Math.round(((v + 4) / 10) * 100);
    return Math.max(5, Math.min(98, pct));
  }
  function band(score) {
    if (score >= 70) return { label: 'Strong', cls: 'good' };
    if (score >= 55) return { label: 'Supportive', cls: 'good' };
    if (score >= 42) return { label: 'Mixed', cls: 'mid' };
    if (score >= 30) return { label: 'Testing', cls: 'bad' };
    return { label: 'Strained', cls: 'bad' };
  }
  function mergeTriggers(bT, gT) {
    const all = [];
    bT.triggers.slice(0, 1).forEach((t) => all.push('B: ' + t));
    gT.triggers.slice(0, 1).forEach((t) => all.push('G: ' + t));
    return all.join(' | ') || 'Routine transits';
  }

  return {
    marriagePlanets, stressPlanets, marriageWindow, kpMarriageWindow,
    coupleMarriageWindow, relationshipForecast, strengthSeries, strengthSeriesDual, strengthSeriesSingle,
    parasharaWeights, kpWeights, commitmentAt, scoreAt, band, clamp,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Timeline;

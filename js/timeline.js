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

  // 20-year relationship strength / weakness forecast (period rows)
  function relationshipForecast(boyChart, girlChart, fromJd, years) {
    years = years || 20;
    const bmp = marriagePlanets(boyChart, 'male');
    const bsp = stressPlanets(boyChart);
    const gmp = marriagePlanets(girlChart, 'female');
    const gsp = stressPlanets(girlChart);

    // Drive the timeline off the BOY's AD periods (a stable cadence), and for
    // each, sample mid-point for both partners + transits.
    const { periods } = Dasha.expandWindow(boyChart, fromJd, years);
    const rows = [];
    periods.forEach((p) => {
      const mid = (Math.max(p.startJd, fromJd) + p.endJd) / 2;
      const bScore = clamp(scoreAt(boyChart, 'male', bmp, bsp, mid));
      const gScore = clamp(scoreAt(girlChart, 'female', gmp, gsp, mid));
      const bRun = Dasha.runningAt(boyChart, mid);
      const gRun = Dasha.runningAt(girlChart, mid);
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
    marriagePlanets, stressPlanets, marriageWindow,
    coupleMarriageWindow, relationshipForecast, scoreAt, band, clamp,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Timeline;

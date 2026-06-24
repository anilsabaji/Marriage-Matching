/* =============================================================================
 * dasha.js  —  Vimshottari Dasha engine
 *
 * Computes Mahadasha (MD), Antardasha (AD) and Pratyantardasha (PD) periods
 * with real calendar dates, derived from the Moon's longitude at birth.
 * Total cycle = 120 years. Used for timing of marriage and for the 20-year
 * relationship strength forecast.
 * ========================================================================== */

const Dasha = (function () {
  'use strict';

  const YEAR_DAYS = 365.2425;

  function order(startLord) {
    const i = Astro.DASHA_ORDER.indexOf(startLord);
    const seq = [];
    for (let k = 0; k < 9; k++) seq.push(Astro.DASHA_ORDER[(i + k) % 9]);
    return seq;
  }

  function jdToDate(jd) {
    // Convert JD to Gregorian date (UT)
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let A = z;
    if (z >= 2299161) {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      A = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + f;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return new Date(Date.UTC(year, month - 1, Math.floor(day)));
  }

  function addDays(jd, days) {
    return jd + days;
  }

  // birth Moon -> balance of first dasha
  function birthBalance(moonLon) {
    const nak = Math.floor(moonLon / Astro.NAK_SPAN);
    const lord = Astro.NAK[nak % 27].lord;
    const into = moonLon - nak * Astro.NAK_SPAN;
    const fraction = into / Astro.NAK_SPAN; // elapsed fraction of nakshatra
    const total = Astro.DASHA_YEARS[lord];
    const elapsed = total * fraction;
    const balance = total - elapsed;
    return { lord, balance, elapsedYears: elapsed, fraction };
  }

  // Build MD list spanning from birth for `spanYears`
  function mahadashas(chart, spanYears) {
    const bb = birthBalance(chart.planets.Moon.lon);
    const seq = order(bb.lord);
    let jd = chart.jd;
    const list = [];
    // first (partial) MD
    let firstDur = bb.balance * YEAR_DAYS;
    list.push({ lord: bb.lord, startJd: jd, endJd: jd + firstDur, years: bb.balance });
    jd += firstDur;
    let idx = 1;
    const endTarget = chart.jd + spanYears * YEAR_DAYS + 130 * YEAR_DAYS; // generous
    while (jd < endTarget) {
      const lord = seq[idx % 9];
      const dur = Astro.DASHA_YEARS[lord] * YEAR_DAYS;
      list.push({ lord, startJd: jd, endJd: jd + dur, years: Astro.DASHA_YEARS[lord] });
      jd += dur;
      idx++;
    }
    return list;
  }

  function antardashas(md) {
    const seq = order(md.lord);
    const totalDays = md.endJd - md.startJd;
    const mdYears = Astro.DASHA_YEARS[md.lord];
    let jd = md.startJd;
    const list = [];
    seq.forEach((lord) => {
      const frac = Astro.DASHA_YEARS[lord] / 120;
      const dur = frac * (mdYears * YEAR_DAYS);
      // for the first (partial) MD, scale proportionally so ADs fit the actual span
      list.push({ mdLord: md.lord, lord, startJd: jd, endJd: jd + dur });
      jd += dur;
    });
    // normalise to fit actual MD span (handles partial first MD)
    const built = jd - md.startJd;
    const scale = totalDays / built;
    let cursor = md.startJd;
    list.forEach((ad) => {
      const d = (ad.endJd - ad.startJd) * scale;
      ad.startJd = cursor;
      ad.endJd = cursor + d;
      cursor += d;
    });
    return list;
  }

  function pratyantardashas(ad) {
    const seq = order(ad.lord);
    const totalDays = ad.endJd - ad.startJd;
    let jd = ad.startJd;
    const list = [];
    seq.forEach((lord) => {
      const frac = Astro.DASHA_YEARS[lord] / 120;
      const dur = frac * totalDays;
      list.push({ mdLord: ad.mdLord, adLord: ad.lord, lord, startJd: jd, endJd: jd + dur });
      jd += dur;
    });
    return list;
  }

  // Find the running MD/AD/PD at a given jd
  function runningAt(chart, jd, mdList) {
    const mds = mdList || mahadashas(chart, 130);
    const md = mds.find((m) => jd >= m.startJd && jd < m.endJd);
    if (!md) return null;
    const ad = antardashas(md).find((a) => jd >= a.startJd && jd < a.endJd);
    if (!ad) return { md, ad: null, pd: null };
    const pd = pratyantardashas(ad).find((p) => jd >= p.startJd && jd < p.endJd);
    return { md, ad, pd };
  }

  // Full expansion for next `spanYears` from a reference jd (e.g., today),
  // returning AD-level periods (with PD nested) that overlap the window.
  function expandWindow(chart, fromJd, spanYears) {
    const toJd = fromJd + spanYears * YEAR_DAYS;
    const mds = mahadashas(chart, spanYears + 130);
    const periods = [];
    mds.forEach((md) => {
      if (md.endJd < fromJd || md.startJd > toJd) return;
      antardashas(md).forEach((ad) => {
        if (ad.endJd < fromJd || ad.startJd > toJd) return;
        const pds = pratyantardashas(ad).filter((pd) => pd.endJd >= fromJd && pd.startJd <= toJd);
        periods.push({ md: md.lord, ...ad, pds });
      });
    });
    return { periods, mds, fromJd, toJd };
  }

  function fmt(jd) {
    const d = jdToDate(jd);
    return d.toISOString().slice(0, 10);
  }
  function fmtYM(jd) {
    const d = jdToDate(jd);
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Date-Month-Year, e.g. "24 Jun 2026"
  function fmtDMY(jd) {
    const d = jdToDate(jd);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  // ISO yyyy-mm-dd (needed for <input type="date"> values)
  function fmtISO(jd) {
    const d = jdToDate(jd);
    return d.toISOString().slice(0, 10);
  }

  return {
    YEAR_DAYS, order, jdToDate, addDays, birthBalance,
    mahadashas, antardashas, pratyantardashas, runningAt, expandWindow,
    fmt, fmtYM, fmtDMY, fmtISO, MONTHS,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Dasha;

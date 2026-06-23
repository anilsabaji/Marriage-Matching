/* =============================================================================
 * transit.js  —  Gochara (transit) engine
 *
 * Computes sidereal transit positions of the slow, event-defining planets
 * (Jupiter, Saturn, Rahu, Ketu — plus Mars for activation) at any future
 * Julian Day, and evaluates classic marriage / relationship transit triggers:
 *   - Jupiter transiting the 7th, 2nd or 11th from natal Moon / Lagna
 *   - Saturn / Rahu afflicting the 7th (stress, delay, friction)
 *   - Sade Sati (Saturn over 12th-1st-2nd from Moon)
 * ========================================================================== */

const Transit = (function () {
  'use strict';

  const SLOW = ['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars'];

  function positionsAt(jd) {
    const d = Astro.dayNumber(jd);
    const ayan = Astro.lahiriAyanamsa(jd);
    const out = {};
    SLOW.forEach((p) => {
      const sid = Astro.norm360(Astro.tropicalLon(p, d) - ayan);
      out[p] = { lon: sid, sign: Math.floor(sid / 30), signName: Astro.RASHIS[Math.floor(sid / 30)] };
    });
    return out;
  }

  // house occupied by a transiting sign relative to a reference sign (1-12)
  function houseFrom(refSign, transitSign) {
    return ((transitSign - refSign + 12) % 12) + 1;
  }

  // Evaluate marriage-relevant transit triggers for a chart at jd
  function evaluate(chart, jd) {
    const pos = positionsAt(jd);
    const moonSign = chart.planets.Moon.sign;
    const lagnaSign = chart.ascendant.sign;
    const seventhLord = Astro.RASHI_LORD[(lagnaSign + 6) % 12];

    const triggers = [];
    let score = 0;

    // Jupiter — primary marriage karaka transit
    const jupHfromMoon = houseFrom(moonSign, pos.Jupiter.sign);
    const jupHfromLagna = houseFrom(lagnaSign, pos.Jupiter.sign);
    if ([7, 2, 11, 5].includes(jupHfromMoon)) {
      score += 3; triggers.push(`Jupiter transits ${jupHfromMoon}th from Moon (favourable for union)`);
    }
    if ([7, 1, 5].includes(jupHfromLagna)) {
      score += 2; triggers.push(`Jupiter transits ${jupHfromLagna}th from Lagna`);
    }

    // Saturn — maturity / delay / commitment
    const satHfromMoon = houseFrom(moonSign, pos.Saturn.sign);
    if ([7, 11].includes(satHfromMoon)) {
      score += 1; triggers.push(`Saturn ${satHfromMoon}th from Moon (commitment, but slow)`);
    }
    if ([12, 1, 2].includes(satHfromMoon)) {
      score -= 2; triggers.push(`Sade Sati phase (Saturn ${satHfromMoon}th from Moon) — emotional pressure`);
    }
    if (satHfromMoon === 7) {
      score -= 1; triggers.push('Saturn over 7th from Moon — tests partnership patience');
    }

    // Rahu/Ketu over 7th axis — unconventional / turbulence
    const rahuH = houseFrom(lagnaSign, pos.Rahu.sign);
    if (rahuH === 7 || rahuH === 1) {
      score -= 1; triggers.push(`Rahu on the 1/7 axis (H${rahuH}) — unconventional pulls`);
    }

    // Mars over 7th — passion / friction activator
    const marsH = houseFrom(moonSign, pos.Mars.sign);
    if (marsH === 7) { triggers.push('Mars over 7th from Moon — activation / heat'); }

    // Jupiter or Saturn transiting the natal 7th sign (whole-sign 7th)
    const seventhSign = (lagnaSign + 6) % 12;
    if (pos.Jupiter.sign === seventhSign) { score += 2; triggers.push('Jupiter transiting the natal 7th house'); }
    if (pos.Saturn.sign === seventhSign) { score += 1; triggers.push('Saturn transiting the natal 7th house (maturing)'); }

    return { jd, pos, score, triggers, jupHfromMoon, satHfromMoon, seventhLord };
  }

  // Year-by-year transit summary table for the next `years`
  function summary(chart, fromJd, years) {
    const rows = [];
    for (let y = 0; y <= years; y++) {
      const jd = fromJd + y * Dasha.YEAR_DAYS;
      const pos = positionsAt(jd);
      const moonSign = chart.planets.Moon.sign;
      rows.push({
        date: Dasha.fmtYM(jd),
        jupiter: `${pos.Jupiter.signName} (${houseFrom(moonSign, pos.Jupiter.sign)}H)`,
        saturn: `${pos.Saturn.signName} (${houseFrom(moonSign, pos.Saturn.sign)}H)`,
        rahu: pos.Rahu.signName,
        eval: evaluate(chart, jd),
      });
    }
    return rows;
  }

  return { SLOW, positionsAt, houseFrom, evaluate, summary };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Transit;

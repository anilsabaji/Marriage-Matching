/* =============================================================================
 * sarvashtaka.js  —  Sarvashtakavarga (SAV) engine
 *
 * Implements the Ashtakavarga system as described in BPHS. For each of the
 * 7 planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn) an individual
 * Bhinnashtakavarga (BAV) table is built showing benefic dots (bindus) in
 * each of the 12 signs. Summing all 7 BAV tables gives the Sarvashtakavarga
 * (SAV) — a total of 337 bindus distributed across 12 signs.
 *
 * For marriage matching this module:
 *   1. Computes the SAV for both partners.
 *   2. Evaluates the strength of marriage-significant houses (7th, 2nd, 11th,
 *      5th, 8th) by their SAV bindus count.
 *   3. Compares both partners' SAV profiles for compatibility — houses where
 *      both have high bindus indicate shared strength areas; where both are
 *      low, shared vulnerabilities.
 * ========================================================================== */

const Sarvashtaka = (function () {
  'use strict';

  /* ======================================================================
   * BAV Tables — benefic contribution rules from BPHS Ch. 66–72
   *
   * Each planet contributes a bindu (1) in certain houses counted from each
   * of the 7 planets and the Lagna. The lookup is:
   *   BAV_RULES[planet][contributor] = array of house numbers (1-12) where
   *   the contributor gives a bindu TO that planet.
   * ==================================================================== */

  const BAV_RULES = {
    Sun: {
      Sun:     [1, 2, 4, 7, 8, 9, 10, 11],
      Moon:    [3, 6, 7, 8, 10, 11],
      Mars:    [1, 2, 4, 7, 8, 9, 10, 11],
      Mercury: [3, 5, 6, 9, 10, 11, 12],
      Jupiter: [5, 6, 9, 11],
      Venus:   [6, 7, 12],
      Saturn:  [1, 2, 4, 7, 8, 9, 10, 11],
      Lagna:   [3, 4, 6, 10, 11, 12],
    },
    Moon: {
      Sun:     [3, 6, 7, 8, 10, 11],
      Moon:    [1, 3, 6, 7, 10, 11],
      Mars:    [2, 3, 5, 6, 9, 10, 11],
      Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
      Jupiter: [1, 4, 7, 8, 10, 11, 12],
      Venus:   [3, 4, 5, 7, 9, 10, 11],
      Saturn:  [3, 5, 6, 11],
      Lagna:   [3, 6, 10, 11],
    },
    Mars: {
      Sun:     [3, 5, 6, 10, 11],
      Moon:    [3, 6, 11],
      Mars:    [1, 2, 4, 7, 8, 10, 11],
      Mercury: [3, 5, 6, 11],
      Jupiter: [6, 10, 11, 12],
      Venus:   [6, 8, 11, 12],
      Saturn:  [1, 4, 7, 8, 9, 10, 11],
      Lagna:   [1, 3, 6, 10, 11],
    },
    Mercury: {
      Sun:     [5, 6, 9, 11, 12],
      Moon:    [2, 4, 6, 8, 10, 11],
      Mars:    [1, 2, 4, 7, 8, 9, 10, 11],
      Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
      Jupiter: [6, 8, 11, 12],
      Venus:   [1, 2, 3, 4, 5, 8, 9, 11],
      Saturn:  [1, 2, 4, 7, 8, 9, 10, 11],
      Lagna:   [1, 2, 4, 6, 8, 10, 11],
    },
    Jupiter: {
      Sun:     [1, 2, 3, 4, 7, 8, 9, 10, 11],
      Moon:    [2, 5, 7, 9, 11],
      Mars:    [1, 2, 4, 7, 8, 10, 11],
      Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
      Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
      Venus:   [2, 5, 6, 9, 10, 11],
      Saturn:  [3, 5, 6, 12],
      Lagna:   [1, 2, 4, 5, 6, 7, 9, 10, 11],
    },
    Venus: {
      Sun:     [8, 11, 12],
      Moon:    [1, 2, 3, 4, 5, 8, 9, 11, 12],
      Mars:    [3, 5, 6, 9, 11, 12],
      Mercury: [3, 5, 6, 9, 11],
      Jupiter: [5, 8, 9, 10, 11],
      Venus:   [1, 2, 3, 4, 5, 8, 9, 10, 11],
      Saturn:  [3, 4, 5, 8, 9, 10, 11],
      Lagna:   [1, 2, 3, 4, 5, 8, 9, 11],
    },
    Saturn: {
      Sun:     [1, 2, 4, 7, 8, 10, 11],
      Moon:    [3, 6, 11],
      Mars:    [3, 5, 6, 10, 11, 12],
      Mercury: [6, 8, 9, 10, 11, 12],
      Jupiter: [5, 6, 11, 12],
      Venus:   [6, 11, 12],
      Saturn:  [3, 5, 6, 11],
      Lagna:   [1, 3, 4, 6, 10, 11],
    },
  };

  const PLANETS_7 = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  /* ======================================================================
   * Compute Bhinnashtakavarga (BAV) for one planet in a chart
   * Returns an array of 12 values (bindu count per sign, index 0 = Aries)
   * ==================================================================== */
  function computeBAV(planet, chart) {
    const bindus = new Array(12).fill(0);
    const rules = BAV_RULES[planet];
    if (!rules) return bindus;

    // For each contributor (7 planets + Lagna)
    const contributors = [...PLANETS_7, 'Lagna'];
    contributors.forEach((contrib) => {
      const houses = rules[contrib];
      if (!houses) return;
      // Find the sign position of the contributor
      let contribSign;
      if (contrib === 'Lagna') {
        contribSign = chart.ascendant.sign;
      } else {
        contribSign = chart.planets[contrib].sign;
      }
      // For each house number in the rule, compute the target sign
      houses.forEach((h) => {
        const targetSign = (contribSign + h - 1) % 12;
        bindus[targetSign] += 1;
      });
    });

    return bindus;
  }

  /* ======================================================================
   * Compute SAV (sum of all 7 BAVs) — total bindus per sign
   * ==================================================================== */
  function computeSAV(chart) {
    const sav = new Array(12).fill(0);
    const bavs = {};
    PLANETS_7.forEach((planet) => {
      const bav = computeBAV(planet, chart);
      bavs[planet] = bav;
      for (let i = 0; i < 12; i++) sav[i] += bav[i];
    });
    const total = sav.reduce((s, v) => s + v, 0);
    return { sav, bavs, total };
  }

  /* ======================================================================
   * House-wise SAV (from Lagna)
   * Converts sign-based SAV to house-based (H1 = lagna sign, etc.)
   * ==================================================================== */
  function houseSAV(chart) {
    const { sav, bavs, total } = computeSAV(chart);
    const lagnaSign = chart.ascendant.sign;
    const houses = [];
    for (let h = 1; h <= 12; h++) {
      const sign = (lagnaSign + h - 1) % 12;
      houses.push({
        house: h,
        sign,
        signName: Astro.RASHIS[sign],
        bindus: sav[sign],
      });
    }
    // house-wise BAV per planet
    const houseBavs = {};
    PLANETS_7.forEach((p) => {
      houseBavs[p] = [];
      for (let h = 1; h <= 12; h++) {
        const sign = (lagnaSign + h - 1) % 12;
        houseBavs[p].push(bavs[p][sign]);
      }
    });
    return { houses, houseBavs, total, sav, bavs };
  }

  /* ======================================================================
   * Marriage-focused SAV analysis
   * ==================================================================== */
  const MARRIAGE_HOUSES = [7, 2, 11, 5, 8];
  const GOOD_THRESHOLD = 28; // SAV bindu >= 28 in a sign is strong
  const WEAK_THRESHOLD = 25; // < 25 is weak

  function marriageAnalysis(chart) {
    const hs = houseSAV(chart);
    const marriageStrength = {};
    let totalMarriage = 0;
    MARRIAGE_HOUSES.forEach((h) => {
      const data = hs.houses[h - 1];
      let quality;
      if (data.bindus >= GOOD_THRESHOLD) quality = { label: 'Strong', cls: 'good' };
      else if (data.bindus >= WEAK_THRESHOLD) quality = { label: 'Moderate', cls: 'mid' };
      else quality = { label: 'Weak', cls: 'bad' };
      marriageStrength[h] = { ...data, quality };
      totalMarriage += data.bindus;
    });
    const avgMarriage = Math.round(totalMarriage / MARRIAGE_HOUSES.length);
    return { houseSAV: hs, marriageStrength, totalMarriage, avgMarriage };
  }

  /* ======================================================================
   * Couple SAV compatibility
   * ==================================================================== */
  function coupleAnalysis(boyChart, girlChart) {
    const boy = marriageAnalysis(boyChart);
    const girl = marriageAnalysis(girlChart);

    // House-by-house comparison
    const comparison = [];
    for (let h = 1; h <= 12; h++) {
      const bData = boy.houseSAV.houses[h - 1];
      const gData = girl.houseSAV.houses[h - 1];
      const avg = Math.round((bData.bindus + gData.bindus) / 2);
      let harmony;
      if (bData.bindus >= GOOD_THRESHOLD && gData.bindus >= GOOD_THRESHOLD) {
        harmony = { label: 'Both Strong', cls: 'good' };
      } else if (bData.bindus < WEAK_THRESHOLD && gData.bindus < WEAK_THRESHOLD) {
        harmony = { label: 'Both Weak', cls: 'bad' };
      } else if (avg >= 27) {
        harmony = { label: 'Supportive', cls: 'good' };
      } else if (avg >= 24) {
        harmony = { label: 'Average', cls: 'mid' };
      } else {
        harmony = { label: 'Needs Work', cls: 'bad' };
      }
      comparison.push({ house: h, boyBindus: bData.bindus, girlBindus: gData.bindus, avg, harmony });
    }

    // Marriage houses focus
    const marriageComparison = [];
    const notes = [];
    let score = 50;
    MARRIAGE_HOUSES.forEach((h) => {
      const bm = boy.marriageStrength[h];
      const gm = girl.marriageStrength[h];
      const avg = Math.round((bm.bindus + gm.bindus) / 2);
      marriageComparison.push({
        house: h, signBoy: bm.signName, signGirl: gm.signName,
        boyBindus: bm.bindus, girlBindus: gm.bindus, avg,
        boyQuality: bm.quality, girlQuality: gm.quality,
      });

      if (bm.bindus >= GOOD_THRESHOLD && gm.bindus >= GOOD_THRESHOLD) {
        score += 5;
        notes.push(`House ${h}: Both strong (${bm.bindus} & ${gm.bindus} bindus) — excellent support for ${houseLabel(h)}.`);
      } else if (bm.bindus < WEAK_THRESHOLD && gm.bindus < WEAK_THRESHOLD) {
        score -= 5;
        notes.push(`House ${h}: Both below threshold (${bm.bindus} & ${gm.bindus}) — ${houseLabel(h)} needs conscious attention.`);
      } else {
        score += 2;
      }
    });

    // Venus BAV in 7th house (specific marriage indicator)
    const bVenus7 = boy.houseSAV.houseBavs.Venus[6]; // 0-indexed, house 7
    const gVenus7 = girl.houseSAV.houseBavs.Venus[6];
    if (bVenus7 >= 5 && gVenus7 >= 5) {
      score += 6; notes.push(`Venus BAV in 7th house: strong for both (${bVenus7} & ${gVenus7}) — excellent for marital happiness.`);
    } else if (bVenus7 <= 2 || gVenus7 <= 2) {
      score -= 3; notes.push(`Venus BAV in 7th house: weak for one/both (${bVenus7} & ${gVenus7}) — romance area needs nurturing.`);
    }

    // Jupiter BAV in 2nd and 11th
    const bJup2 = boy.houseSAV.houseBavs.Jupiter[1];
    const gJup2 = girl.houseSAV.houseBavs.Jupiter[1];
    const bJup11 = boy.houseSAV.houseBavs.Jupiter[10];
    const gJup11 = girl.houseSAV.houseBavs.Jupiter[10];
    if (bJup2 + gJup2 >= 8) {
      score += 3; notes.push(`Jupiter BAV in 2nd house: combined ${bJup2 + gJup2} — family harmony supported.`);
    }
    if (bJup11 + gJup11 >= 8) {
      score += 3; notes.push(`Jupiter BAV in 11th house: combined ${bJup11 + gJup11} — wish-fulfilment blessed.`);
    }

    // Total SAV comparison
    const totalDiff = Math.abs(boy.houseSAV.total - girl.houseSAV.total);
    if (totalDiff <= 10) {
      score += 4; notes.push(`Total SAV balanced (Boy: ${boy.houseSAV.total}, Girl: ${girl.houseSAV.total}) — energetically compatible.`);
    } else if (totalDiff > 30) {
      score -= 3; notes.push(`Total SAV imbalanced (Boy: ${boy.houseSAV.total}, Girl: ${girl.houseSAV.total}) — one partner significantly stronger.`);
    }

    score = Math.max(5, Math.min(98, Math.round(score)));

    let verdict;
    if (score >= 70) verdict = { label: 'SAV: Highly Compatible', cls: 'good' };
    else if (score >= 55) verdict = { label: 'SAV: Compatible', cls: 'good' };
    else if (score >= 40) verdict = { label: 'SAV: Average', cls: 'mid' };
    else verdict = { label: 'SAV: Below Average', cls: 'bad' };

    return {
      boy, girl, comparison, marriageComparison,
      score, verdict, notes,
      bVenus7, gVenus7, bJup2, gJup2, bJup11, gJup11,
    };
  }

  function houseLabel(h) {
    const labels = { 2: 'family/wealth', 5: 'romance/children', 7: 'marriage/spouse', 8: 'intimacy/longevity', 11: 'fulfilment/gains' };
    return labels[h] || `house ${h}`;
  }

  return {
    BAV_RULES, PLANETS_7, MARRIAGE_HOUSES,
    computeBAV, computeSAV, houseSAV,
    marriageAnalysis, coupleAnalysis,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Sarvashtaka;

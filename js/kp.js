/* =============================================================================
 * kp.js  —  Krishnamurti Paddhati (KP) marriage analysis
 *
 * KP judges events by the SUB-LORD of the relevant cusp. For marriage the
 * primary cusp is the 7th; the 2nd (family addition) and 11th (fulfilment of
 * desire / permanent friendship) are supporting. A marriage is promised when
 * the sub-lord of the 7th cusp is a significator of houses 2, 7 or 11.
 *
 * Significators of a house (4-step KP rule):
 *   1. Planets in the star (nakshatra) of the occupant(s) of the house
 *   2. Occupants of the house
 *   3. Planets in the star of the owner of the house (cusp sign lord)
 *   4. Owner of the house
 * Planets conjunct Rahu/Ketu also signify what the node signifies.
 * ========================================================================== */

const KP = (function () {
  'use strict';

  // Build star-lord -> planets map and occupant maps for a chart
  function buildMaps(chart) {
    const occByHouse = {};
    for (let h = 1; h <= 12; h++) occByHouse[h] = [];
    Astro.PLANETS.forEach((p) => {
      occByHouse[chart.planets[p].kpHouse].push(p);
    });
    // sign lord of each cusp (house owner)
    const ownerByHouse = {};
    chart.cusps.forEach((c) => {
      ownerByHouse[c.house] = Astro.RASHI_LORD[c.sign];
    });
    return { occByHouse, ownerByHouse };
  }

  // houses a given planet "owns" (its signs appear on which cusps)
  function ownedHouses(planet, chart) {
    const res = [];
    chart.cusps.forEach((c) => {
      if (Astro.RASHI_LORD[c.sign] === planet) res.push(c.house);
    });
    return res;
  }

  // planets located in the nakshatra (star) ruled by `lord`
  function planetsInStarOf(lord, chart) {
    return Astro.PLANETS.filter((p) => chart.planets[p].nakLord === lord);
  }

  // Significator houses for a planet (the houses it signifies in KP)
  function significatorHouses(planet, chart) {
    const houses = new Set();
    const p = chart.planets[planet];
    // (b) house it occupies
    houses.add(p.kpHouse);
    // (a) it is in the star of the occupant of some house -> signifies that house
    const starLord = p.nakLord;
    // houses occupied by the star lord
    if (chart.planets[starLord]) houses.add(chart.planets[starLord].kpHouse);
    // (d) houses it owns
    ownedHouses(planet, chart).forEach((h) => houses.add(h));
    // (c) houses owned by its star lord
    ownedHouses(starLord, chart).forEach((h) => houses.add(h));
    return [...houses].sort((a, b) => a - b);
  }

  // Strength tier of a planet as significator (star lord placement dominates in KP)
  function significatorStrength(planet, chart, targetHouses) {
    const p = chart.planets[planet];
    const starLord = p.nakLord;
    const starHouse = chart.planets[starLord] ? chart.planets[starLord].kpHouse : null;
    let tier = 0; // higher = stronger
    if (targetHouses.includes(starHouse)) tier += 3; // in star of occupant of target house — strongest
    if (targetHouses.includes(p.kpHouse)) tier += 2; // occupant of target house
    const owned = ownedHouses(starLord, chart);
    if (owned.some((h) => targetHouses.includes(h))) tier += 1;
    const ownedSelf = ownedHouses(planet, chart);
    if (ownedSelf.some((h) => targetHouses.includes(h))) tier += 1;
    return tier;
  }

  function cuspSubLord(houseNum, chart) {
    return chart.cusps[houseNum - 1];
  }

  // Is marriage promised? sub-lord of 7th cusp must signify 2/7/11
  function marriagePromise(chart) {
    const cusp7 = cuspSubLord(7, chart);
    const subLord = cusp7.subLord;
    const sigHouses = significatorHouses(subLord, chart);
    const promiseHouses = [2, 7, 11];
    const matched = sigHouses.filter((h) => promiseHouses.includes(h));
    const denialHouses = [1, 6, 10]; // 1 (single/self), 6 (separation/litigation), 10 (against 7th)
    const denials = sigHouses.filter((h) => denialHouses.includes(h));
    let promised = matched.length > 0;
    // refine: if sub-lord signifies more denial than promise, weaken
    let confidence = matched.length * 25 - denials.length * 12 + 25;
    confidence = Math.max(5, Math.min(98, confidence));
    return { subLord, sigHouses, matched, denials, promised, confidence, cusp7 };
  }

  // Planets that are strong significators of the marriage houses (2,7,11)
  function marriageSignificators(chart) {
    const targets = [2, 7, 11];
    const list = Astro.PLANETS.map((p) => ({
      planet: p,
      houses: significatorHouses(p, chart),
      strength: significatorStrength(p, chart, targets),
    })).filter((x) => x.strength > 0);
    list.sort((a, b) => b.strength - a.strength);
    return list;
  }

  // Negative/separative significators (6,10,12 from love angle, plus 1)
  function separativeSignificators(chart) {
    const targets = [1, 6, 10];
    return Astro.PLANETS.map((p) => ({
      planet: p,
      strength: significatorStrength(p, chart, targets),
    })).filter((x) => x.strength > 1);
  }

  function assess(chart) {
    const maps = buildMaps(chart);
    const promise = marriagePromise(chart);
    const sigs = marriageSignificators(chart);
    const seps = separativeSignificators(chart);

    // cusp table for 2,7,11
    const cusps = [2, 7, 11, 5, 8].map((h) => {
      const c = cuspSubLord(h, chart);
      return {
        house: h,
        sign: c.signName,
        deg: c.degInSign,
        nakLord: c.nakLord,
        subLord: c.subLord,
        subSubLord: c.subSubLord,
        subSignifies: significatorHouses(c.subLord, chart),
      };
    });

    let verdict;
    if (promise.confidence >= 65) verdict = { label: 'Marriage Strongly Promised', cls: 'good' };
    else if (promise.confidence >= 45) verdict = { label: 'Marriage Promised', cls: 'good' };
    else if (promise.confidence >= 30) verdict = { label: 'Marriage Indicated with Effort', cls: 'mid' };
    else verdict = { label: 'Weak / Delayed Indication', cls: 'bad' };

    return { promise, significators: sigs, separative: seps, cusps, verdict, maps };
  }

  // Couple-level KP synthesis
  function coupleAssessment(boyChart, girlChart) {
    const b = assess(boyChart);
    const g = assess(girlChart);
    const combined = Math.round((b.promise.confidence + g.promise.confidence) / 2);
    const notes = [];
    notes.push(
      `Boy 7th cusp sub-lord ${b.promise.subLord} signifies houses [${b.promise.sigHouses.join(', ')}] ` +
      `— marriage houses matched: [${b.promise.matched.join(', ') || 'none'}].`
    );
    notes.push(
      `Girl 7th cusp sub-lord ${g.promise.subLord} signifies houses [${g.promise.sigHouses.join(', ')}] ` +
      `— marriage houses matched: [${g.promise.matched.join(', ') || 'none'}].`
    );
    // shared significators (planets that promote marriage in both)
    const bSet = new Set(b.significators.map((s) => s.planet));
    const shared = g.significators.filter((s) => bSet.has(s.planet)).map((s) => s.planet);
    if (shared.length) {
      notes.push(`Common marriage significators in both charts: ${shared.join(', ')} — a positive linking factor.`);
    }
    let verdict;
    if (combined >= 60) verdict = { label: 'KP: Favourable Union', cls: 'good' };
    else if (combined >= 40) verdict = { label: 'KP: Workable Union', cls: 'mid' };
    else verdict = { label: 'KP: Needs Careful Timing', cls: 'bad' };

    return { boy: b, girl: g, combined, verdict, notes };
  }

  return {
    buildMaps, ownedHouses, planetsInStarOf, significatorHouses,
    significatorStrength, marriagePromise, marriageSignificators,
    separativeSignificators, assess, coupleAssessment, cuspSubLord,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KP;

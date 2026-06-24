/* =============================================================================
 * separation.js  —  Promise of Separation / Divorce / Widowhood
 *
 * Reads the chart for structural indicators of marital break (separation,
 * divorce) and loss of spouse (widowhood) across THREE views:
 *   - D1 (Rāśi): 7th lord in dusthāna, malefics in 7th/2nd, Maṅgala dosha,
 *     affliction of the kāraka (Venus / Jupiter), 8th-from-7th affliction.
 *   - D9 (Navāṁśa): malefics in navāṁśa 7th, Venus navāṁśa dignity.
 *   - KP: 7th cusp sub-lord signifying 6/12 (separation) or 1/10 (against
 *     union); planets that are KP significators of 6/8/12.
 *
 * It also returns a weighted map of "separative planets" — planets whose
 * dasha periods can TRIGGER the promised event. The relationship-strength
 * engine penalises commitment more heavily when such a dasha lord is running
 * AND transits are simultaneously adverse.
 * ========================================================================== */

const Separation = (function () {
  'use strict';

  const MAL = ['Mars', 'Saturn', 'Rahu', 'Ketu', 'Sun'];
  const REAL = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

  function aspectsHouse(planet, fromHouse, targetHouse) {
    return Astro.aspectsHouses(planet).some((a) => (((fromHouse - 1 + a - 1) % 12) + 1) === targetHouse);
  }

  // malefics conjunct or aspecting a given planet
  function afflictorsOfPlanet(target, chart) {
    const th = chart.planets[target].house;
    const res = [];
    ['Mars', 'Saturn', 'Rahu', 'Ketu'].forEach((m) => {
      if (m === target) return;
      const mh = chart.planets[m].house;
      if (mh === th) res.push(m);
      else if (aspectsHouse(m, mh, th)) res.push(m);
    });
    return res;
  }

  // Maṅgala (Kuja) Dosha: Mars in 1/2/4/7/8/12 from Lagna, Moon or Venus
  function mangalDosha(chart) {
    const marsSign = chart.planets.Mars.sign;
    const refs = { Lagna: chart.ascendant.sign, Moon: chart.planets.Moon.sign, Venus: chart.planets.Venus.sign };
    const doshaHouses = [1, 2, 4, 7, 8, 12];
    const hit = [];
    for (const k in refs) {
      const h = ((marsSign - refs[k] + 12) % 12) + 1;
      if (doshaHouses.includes(h)) hit.push(`${k} (${h}H)`);
    }
    return hit.length ? hit.join(', ') : null;
  }

  function navMap(chart) {
    const m = { lagna: ChartDraw.navamsaSign(chart.ascendant.lon) };
    Astro.PLANETS.forEach((p) => { m[p] = ChartDraw.navamsaSign(chart.planets[p].lon); });
    return m;
  }

  function analyze(chart, gender) {
    const lagna = chart.ascendant.sign;
    const lordOf = (h) => Astro.RASHI_LORD[(lagna + h - 1) % 12];
    const sep = {};
    const add = (p, x) => { if (p && REAL.includes(p)) sep[p] = (sep[p] || 0) + x; };
    const d1 = [], d9 = [], kp = [];
    let sepScore = 0, divScore = 0, widScore = 0;

    const seventhL = lordOf(7), sixthL = lordOf(6), eighthL = lordOf(8), twelfthL = lordOf(12);

    /* ---------- D1 (Rāśi) ---------- */
    const sl = chart.planets[seventhL];
    if ([6, 8, 12].includes(sl.house)) {
      d1.push(`7th lord ${seventhL} placed in dusthāna (H${sl.house}) — undermines partnership stability.`);
      add(seventhL, 1.0); sepScore += 18; divScore += 14;
    }
    // malefics in 7th
    const occ7 = Astro.PLANETS.filter((p) => chart.planets[p].house === 7);
    occ7.forEach((p) => {
      if (MAL.includes(p)) {
        const w = p === 'Mars' ? 1.2 : (p === 'Saturn' ? 1.0 : (p === 'Rahu' || p === 'Ketu' ? 0.9 : 0.7));
        add(p, w);
        d1.push(`${p} occupies the 7th house — ${p === 'Mars' ? 'friction/anger' : p === 'Saturn' ? 'coldness/distance' : p === 'Rahu' ? 'unconventional pulls/deception' : p === 'Ketu' ? 'detachment' : 'ego clashes'} in marriage.`);
        sepScore += 12;
        if (p === 'Mars' || p === 'Rahu') divScore += 12;
        if (p === 'Saturn' || p === 'Sun') widScore += 8;
      }
    });
    // 6/8/12 lords are inherently separative (their dashas can trigger)
    add(sixthL, 0.8); add(twelfthL, 0.7); add(eighthL, 0.9);
    // 7th lord conjunct/aspected by 6/8/12 lord
    [sixthL, eighthL, twelfthL].forEach((dl) => {
      if (!dl || dl === seventhL) return;
      const dh = chart.planets[dl].house;
      if (dh === sl.house) { d1.push(`7th lord ${seventhL} conjunct ${dl} (dusthāna lord) — separative link.`); sepScore += 6; }
      else if (aspectsHouse(dl, dh, sl.house)) { d1.push(`7th lord ${seventhL} aspected by ${dl} (dusthāna lord).`); sepScore += 4; }
    });
    // Venus (kāraka) affliction
    const vA = afflictorsOfPlanet('Venus', chart);
    if (vA.length) { vA.forEach((p) => add(p, 0.6)); d1.push(`Venus (marriage kāraka) afflicted by ${vA.join(', ')} — love/harmony under strain.`); divScore += 10; sepScore += 8; }
    if (gender === 'female') {
      const jA = afflictorsOfPlanet('Jupiter', chart);
      if (jA.length) { jA.forEach((p) => add(p, 0.5)); d1.push(`Jupiter (husband kāraka) afflicted by ${jA.join(', ')}.`); widScore += 8; }
    }
    // Maṅgala (Kuja) Dosha — with cancellation (Bhaṅga) from D1
    if (typeof KujaDosha !== 'undefined') {
      const kj = KujaDosha.analyze(chart);
      if (kj.present && kj.netIntensity >= 12) {
        add('Mars', 0.5 + (kj.netIntensity / 100) * 1.0);
        d1.push(`Maṅgala (Kuja) Dosha — Mars ${kj.fromText} (net intensity ${kj.netIntensity}/100${kj.reductionPct ? `, reduced ${kj.reductionPct}% by Bhaṅga` : ''}) — discord/aggression risk.`);
        divScore += Math.round(kj.netIntensity * 0.2); sepScore += Math.round(kj.netIntensity * 0.14);
      } else if (kj.present) {
        d1.push(`Maṅgala (Kuja) Dosha present but cancelled (Bhaṅga): ${kj.reasons.slice(0, 2).join('; ') || 'low intensity'} — minimal marital impact.`);
      }
    } else {
      const md = mangalDosha(chart);
      if (md) { d1.push(`Maṅgala (Kuja) Dosha — Mars in ${md} — discord/aggression risk.`); add('Mars', 0.8); divScore += 12; sepScore += 8; }
    }
    // 8th-from-7th (= 2nd house) affliction → longevity of spouse
    const occ2 = Astro.PLANETS.filter((p) => chart.planets[p].house === 2);
    const mal2 = occ2.filter((p) => MAL.includes(p));
    if (mal2.length) { d1.push(`Malefic(s) ${mal2.join(', ')} in the 2nd (8th-from-7th, spouse longevity) — health/longevity caution for spouse.`); mal2.forEach((p) => add(p, 0.5)); widScore += 10; }

    /* ---------- D9 (Navāṁśa) ---------- */
    const nav = navMap(chart);
    const nav7 = (nav.lagna + 6) % 12;
    Astro.PLANETS.forEach((p) => {
      if (nav[p] === nav7 && MAL.includes(p)) {
        d9.push(`${p} in the Navāṁśa 7th — afflicts the inner/dharmic marriage (D9).`);
        add(p, 0.7); sepScore += 8;
        if (p === 'Mars' || p === 'Rahu') divScore += 8;
        if (p === 'Saturn') widScore += 6;
      }
    });
    if (Astro.DEBIL.Venus === nav.Venus) { d9.push('Venus debilitated in Navāṁśa — weakened marital significator.'); divScore += 8; sepScore += 5; }
    if (Astro.EXALT.Venus === nav.Venus) { d9.push('Venus exalted in Navāṁśa — protective for marriage (mitigates).'); divScore = Math.max(0, divScore - 6); }

    /* ---------- KP ---------- */
    try {
      const promise = KP.marriagePromise(chart);
      const subSig = KP.significatorHouses(promise.subLord, chart);
      if (subSig.includes(6)) { kp.push(`7th cusp sub-lord ${promise.subLord} signifies the 6th — separation / legal disputes promised.`); add(promise.subLord, 1.0); sepScore += 14; divScore += 14; }
      if (subSig.includes(12)) { kp.push(`7th cusp sub-lord ${promise.subLord} signifies the 12th — separation / life apart / bed-loss.`); add(promise.subLord, 0.9); sepScore += 12; }
      if (subSig.includes(1) || subSig.includes(10)) { kp.push(`7th cusp sub-lord ${promise.subLord} signifies ${subSig.includes(1) ? 'the 1st (self over union)' : 'the 10th (against the 7th)'} — works against togetherness.`); add(promise.subLord, 0.6); sepScore += 8; }
      // planets that are KP significators of 6/8/12 → separative triggers
      Astro.PLANETS.forEach((p) => {
        const sig = KP.significatorHouses(p, chart);
        let s = 0;
        if (sig.includes(6)) s += 0.5;
        if (sig.includes(12)) s += 0.4;
        if (sig.includes(8)) { s += 0.4; widScore += 2; }
        if (s > 0) add(p, s);
      });
    } catch (e) { /* KP unavailable */ }

    sepScore = Math.min(100, sepScore);
    divScore = Math.min(100, divScore);
    widScore = Math.min(100, widScore);
    const overallRisk = Math.min(100, Math.round(sepScore * 0.4 + divScore * 0.4 + widScore * 0.2));

    let verdict;
    if (overallRisk >= 60) verdict = { label: 'High Separation Risk', cls: 'bad' };
    else if (overallRisk >= 38) verdict = { label: 'Moderate Risk', cls: 'mid' };
    else if (overallRisk >= 20) verdict = { label: 'Mild Indications', cls: 'mid' };
    else verdict = { label: 'Low Risk', cls: 'good' };

    return {
      separativePlanets: sep,
      d1Factors: d1, d9Factors: d9, kpFactors: kp,
      separation: sepScore, divorce: divScore, widowhood: widScore,
      overallRisk, verdict, nav,
    };
  }

  // Couple-level (max of the two charts drives caution)
  function couple(boyChart, girlChart) {
    const b = analyze(boyChart, 'male');
    const g = analyze(girlChart, 'female');
    const combined = Math.round(Math.max(b.overallRisk, g.overallRisk) * 0.6 + ((b.overallRisk + g.overallRisk) / 2) * 0.4);
    return { boy: b, girl: g, combined };
  }

  return { analyze, couple, mangalDosha, afflictorsOfPlanet };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Separation;

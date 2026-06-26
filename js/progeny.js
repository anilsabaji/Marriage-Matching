/* =============================================================================
 * progeny.js  —  Santāna (Progeny / Children) analysis
 *
 * Judges the promise, denial, quality and TIMING of childbirth using:
 *   1. Parāśara (BPHS): the 5th house (Putra Bhāva) across D1 (Rāśi), D9
 *      (Navāṁśa) and D7 (Saptāṁśa, the prime varga for progeny), the 5th
 *      lord, the putra-kāraka Jupiter, plus the 9th house (santati / lineage).
 *   2. KP: the SUB-LORD of the 5th cusp must signify houses 2, 5 or 11 for
 *      progeny to be promised; signification of 1, 4 or 10 denies/obstructs.
 *      The 11th cusp sub-lord (fulfilment) is supporting.
 *   3. Beeja Sphuṭa (male "seed" potency = Sun + Venus + Jupiter) and
 *      Kṣetra Sphuṭa (female "field" fertility = Moon + Mars + Jupiter).
 *      Beeja is strong in an ODD rāśi & ODD navāṁśa; Kṣetra in an EVEN rāśi
 *      & EVEN navāṁśa, with a strong dispositor and Jupiter.
 *
 * TIMING: childbirth fructifies in the Daśā / Antardaśā / Pratyantardaśā of
 * planets that are progeny significators (5th lord, Jupiter, occupants of the
 * 5th, KP significators of 2/5/11), reinforced when Jupiter transits the 5th
 * (from Lagna or Moon) or the 5th lord's sign.
 * ========================================================================== */

const Progeny = (function () {
  'use strict';

  const BENEFIC = ['Jupiter', 'Venus', 'Mercury', 'Moon'];
  const MALEFIC = ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function aspectsHouse(planet, fromHouse, targetHouse) {
    return Astro.aspectsHouses(planet).some((a) => (((fromHouse - 1 + a - 1) % 12) + 1) === targetHouse);
  }

  // malefics conjunct or aspecting a given planet (by whole-sign house)
  function afflictorsOf(target, chart) {
    const th = chart.planets[target].house;
    const res = [];
    ['Mars', 'Saturn', 'Rahu', 'Ketu', 'Sun'].forEach((m) => {
      if (m === target) return;
      const mh = chart.planets[m].house;
      if (mh === th) res.push(m);
      else if (aspectsHouse(m, mh, th)) res.push(m);
    });
    return res;
  }
  function beneficsOnPlanet(target, chart) {
    const th = chart.planets[target].house;
    const res = [];
    ['Jupiter', 'Venus', 'Mercury'].forEach((b) => {
      if (b === target) return;
      const bh = chart.planets[b].house;
      if (bh === th) res.push(b);
      else if (aspectsHouse(b, bh, th)) res.push(b);
    });
    return res;
  }

  // dignity score of a planet given an arbitrary sign (for varga dignity)
  function dignityInSign(planet, sign) {
    if (Astro.EXALT[planet] === sign) return { label: 'Exalted', score: 5 };
    if (Astro.DEBIL[planet] === sign) return { label: 'Debilitated', score: -3 };
    if ((Astro.OWN[planet] || []).includes(sign)) return { label: 'Own sign', score: 4 };
    const lord = Astro.RASHI_LORD[sign];
    const rel = Astro.relation(planet, lord);
    if (rel === 'friend' || rel === 'self') return { label: 'Friendly sign', score: 2 };
    if (rel === 'enemy') return { label: 'Enemy sign', score: -1 };
    return { label: 'Neutral sign', score: 1 };
  }

  /* ---------------------------------------------------------------------
   * Beeja & Kṣetra Sphuṭa
   * ------------------------------------------------------------------- */
  function sphutaCommon(lon, favourOdd) {
    const sign = Math.floor(lon / 30);
    const signName = Astro.RASHIS[sign];
    const navSign = (typeof ChartDraw !== 'undefined') ? ChartDraw.navamsaSign(lon) : sign;
    const isOddRasi = (sign % 2 === 0);   // signIndex even => 1-based odd sign
    const isOddNav = (navSign % 2 === 0);
    const rasiFav = favourOdd ? isOddRasi : !isOddRasi;
    const navFav = favourOdd ? isOddNav : !isOddNav;
    const lord = Astro.RASHI_LORD[sign];
    return { lon, sign, signName, degInSign: lon - sign * 30, navSign, navSignName: Astro.RASHIS[navSign], isOddRasi, isOddNav, rasiFav, navFav, lord };
  }

  function beejaSphuta(chart) {
    // Male potency = Sun + Venus + Jupiter
    const lon = Astro.norm360(chart.planets.Sun.lon + chart.planets.Venus.lon + chart.planets.Jupiter.lon);
    const s = sphutaCommon(lon, true); // favours ODD
    const dg = dignityInSign(s.lord, s.sign);
    const jupDg = (typeof BPHS !== 'undefined') ? BPHS.dignity('Jupiter', chart) : { label: '—', score: 1 };
    let score = 40;
    if (s.rasiFav) score += 24; else score -= 8;
    if (s.navFav) score += 18; else score -= 6;
    score += dg.score * 2.2 + jupDg.score * 2.2;
    score = clamp(Math.round(score), 5, 98);
    const notes = [
      `Beeja Sphuṭa (Sun+Venus+Jupiter) falls in ${s.signName} ${s.isOddRasi ? '(odd rāśi ✔ — virile)' : '(even rāśi ✘ — weak for seed)'}, navāṁśa ${s.navSignName} ${s.isOddNav ? '(odd ✔)' : '(even ✘)'}.`,
      `Dispositor ${s.lord} is ${dg.label}; putra-kāraka Jupiter is ${jupDg.label}.`,
    ];
    return { kind: 'Beeja', forGender: 'male', ...s, dispositorDignity: dg, jupiterDignity: jupDg, score, strong: score >= 55, notes };
  }

  function kshetraSphuta(chart) {
    // Female fertility = Moon + Mars + Jupiter
    const lon = Astro.norm360(chart.planets.Moon.lon + chart.planets.Mars.lon + chart.planets.Jupiter.lon);
    const s = sphutaCommon(lon, false); // favours EVEN
    const dg = dignityInSign(s.lord, s.sign);
    const jupDg = (typeof BPHS !== 'undefined') ? BPHS.dignity('Jupiter', chart) : { label: '—', score: 1 };
    let score = 40;
    if (s.rasiFav) score += 24; else score -= 8;
    if (s.navFav) score += 18; else score -= 6;
    score += dg.score * 2.2 + jupDg.score * 2.2;
    score = clamp(Math.round(score), 5, 98);
    const notes = [
      `Kṣetra Sphuṭa (Moon+Mars+Jupiter) falls in ${s.signName} ${!s.isOddRasi ? '(even rāśi ✔ — fertile)' : '(odd rāśi ✘ — weak field)'}, navāṁśa ${s.navSignName} ${!s.isOddNav ? '(even ✔)' : '(odd ✘)'}.`,
      `Dispositor ${s.lord} is ${dg.label}; putra-kāraka Jupiter is ${jupDg.label}.`,
    ];
    return { kind: 'Kshetra', forGender: 'female', ...s, dispositorDignity: dg, jupiterDignity: jupDg, score, strong: score >= 55, notes };
  }

  /* ---------------------------------------------------------------------
   * Divisional 5th-house evaluator (works for D1/D9/D7 via a sign-mapper)
   * mapFn(lon) -> sign index in that varga. For D1 mapFn is identity-by-sign.
   * ------------------------------------------------------------------- */
  function divisionalFifth(chart, mapFn, label) {
    const lagnaSign = mapFn(chart.ascendant.lon);
    const fifthSign = (lagnaSign + 4) % 12;
    const pos = {};
    Astro.PLANETS.forEach((p) => { pos[p] = mapFn(chart.planets[p].lon); });
    const occ = Astro.PLANETS.filter((p) => pos[p] === fifthSign);
    // aspects within the varga (whole-sign graha drishti)
    const asp = [];
    Astro.PLANETS.forEach((p) => {
      const fromHouse = ((pos[p] - lagnaSign + 12) % 12) + 1;
      if (aspectsHouse(p, fromHouse, 5)) asp.push(p);
    });
    let score = 50;
    const factors = [];
    occ.forEach((o) => {
      if (BENEFIC.includes(o)) { score += 7; factors.push(`benefic ${o} in 5th`); }
      else { score -= 6; factors.push(`malefic ${o} in 5th`); }
      score += dignityInSign(o, fifthSign).score * 1.4;
    });
    if (occ.includes('Jupiter')) { score += 8; factors.push('Jupiter (putra-kāraka) in the 5th — strong blessing'); }
    asp.forEach((a) => { if (BENEFIC.includes(a)) score += 3; else score -= 2.5; });
    if (asp.length) factors.push(`aspected by ${asp.join(', ')}`);
    // lord of the 5th sign & its varga dignity
    const fifthLord = Astro.RASHI_LORD[fifthSign];
    const lordVargaSign = pos[fifthLord];
    const lordDg = dignityInSign(fifthLord, lordVargaSign);
    score += lordDg.score * 2;
    factors.push(`${label} 5th lord ${fifthLord} is ${lordDg.label}`);
    score = clamp(Math.round(score), 5, 98);
    return { varga: label, lagnaSign, fifthSign, fifthSignName: Astro.RASHIS[fifthSign], occupants: occ, aspects: asp, fifthLord, lordDignity: lordDg, score, factors };
  }

  /* ---------------------------------------------------------------------
   * Parāśara (BPHS) progeny assessment
   * ------------------------------------------------------------------- */
  function parashara(chart, gender) {
    const idn = (lon) => Math.floor(lon / 30); // D1 sign mapper
    const d1 = divisionalFifth(chart, idn, 'D1');
    const d9 = divisionalFifth(chart, ChartDraw.navamsaSign, 'D9');
    const d7 = divisionalFifth(chart, ChartDraw.saptamsaSign, 'D7');

    // putra-karaka Jupiter
    const jupDg = BPHS.dignity('Jupiter', chart);
    const jupAffl = afflictorsOf('Jupiter', chart);
    const jupBen = beneficsOnPlanet('Jupiter', chart);
    const jupHouse = chart.planets.Jupiter.house;

    // 5th lord (D1) placement
    const lagna = chart.ascendant.sign;
    const fifthLordD1 = Astro.RASHI_LORD[(lagna + 4) % 12];
    const flHouse = chart.planets[fifthLordD1].house;

    // 9th house = lineage / santati (5th from 5th)
    const ninth = BPHS.bhavaStrength(9, chart);

    const factors = [];
    let score = Math.round(d1.score * 0.34 + d7.score * 0.40 + d9.score * 0.26);

    // Jupiter modifiers
    score += jupDg.score * 1.6;
    if (jupAffl.length) { score -= 6; factors.push(`Putra-kāraka Jupiter afflicted by ${jupAffl.join(', ')}.`); }
    if (jupBen.length) { score += 5; factors.push(`Jupiter supported by ${jupBen.join(', ')}.`); }
    // 5th lord in dusthana weakens; in kendra/trikona strengthens
    if ([6, 8, 12].includes(flHouse)) { score -= 8; factors.push(`5th lord ${fifthLordD1} in dusthāna (H${flHouse}) — obstacles / delay to progeny.`); }
    else if ([1, 4, 5, 7, 9, 10].includes(flHouse)) { score += 5; factors.push(`5th lord ${fifthLordD1} well placed (H${flHouse}).`); }

    // malefics in 5th of D1 (Putra Bhava) without benefic relief
    const fifthOcc = BPHS.occupants(5, chart);
    const fifthMal = fifthOcc.filter((p) => MALEFIC.includes(p));
    const fifthBen = fifthOcc.filter((p) => BENEFIC.includes(p));
    if (fifthMal.length && !fifthBen.length) { score -= 7; factors.push(`Malefic(s) ${fifthMal.join(', ')} in the 5th (Rāśi) — denial/delay/abortive tendency unless aspected by benefics.`); }
    if (fifthBen.length) { factors.push(`Benefic(s) ${fifthBen.join(', ')} grace the 5th house.`); }

    // santati / 9th support
    score += (ninth.score - 50) * 0.10;

    score = clamp(Math.round(score), 5, 98);
    factors.unshift(`5th-house strength — D1 ${d1.score}, D9 ${d9.score}, D7 ${d7.score} (Saptāṁśa weighted highest for progeny).`);

    return {
      d1, d9, d7,
      fifthLord: fifthLordD1, fifthLordHouse: flHouse,
      jupiterDignity: jupDg, jupiterHouse: jupHouse, jupiterAfflictors: jupAffl, jupiterBenefics: jupBen,
      ninth, score, factors,
      verdict: BPHS.verdict(score),
    };
  }

  /* ---------------------------------------------------------------------
   * KP progeny assessment — 5th cusp sub-lord must signify 2/5/11
   * ------------------------------------------------------------------- */
  function kp(chart) {
    const cusp5 = KP.cuspSubLord(5, chart);
    const subLord = cusp5.subLord;
    const sigHouses = KP.significatorHouses(subLord, chart);
    const promiseHouses = [2, 5, 11];
    const denialHouses = [1, 4, 10]; // self/no-addition, 12th-from-5th (loss), 6th-from-5th
    const matched = sigHouses.filter((h) => promiseHouses.includes(h));
    const denials = sigHouses.filter((h) => denialHouses.includes(h));
    const lossOf5 = sigHouses.includes(12); // 12th = expenditure/loss

    // 11th cusp sub-lord (fulfilment) support
    const cusp11 = KP.cuspSubLord(11, chart);
    const sig11 = KP.significatorHouses(cusp11.subLord, chart);
    const support11 = sig11.some((h) => promiseHouses.includes(h));

    let confidence = matched.length * 25 - denials.length * 12 + 25;
    if (support11) confidence += 8;
    if (lossOf5) confidence -= 6;
    confidence = clamp(confidence, 5, 98);

    // significators of the progeny houses (2,5,11), ranked
    const targets = [2, 5, 11];
    const significators = Astro.PLANETS.map((p) => ({
      planet: p,
      houses: KP.significatorHouses(p, chart),
      strength: KP.significatorStrength(p, chart, targets),
    })).filter((x) => x.strength > 0).sort((a, b) => b.strength - a.strength);

    const factors = [];
    factors.push(`5th cusp sub-lord <b>${subLord}</b> signifies houses [${sigHouses.join(', ')}].`);
    factors.push(matched.length ? `Promising houses matched: [${matched.join(', ')}] — progeny supported.` : 'No promising house (2/5/11) signified by the 5th sub-lord — progeny not directly promised by KP.');
    if (denials.length) factors.push(`Obstructive houses signified: [${denials.join(', ')}] — delay / denial pressure.`);
    if (lossOf5) factors.push('5th sub-lord also signifies the 12th — risk of loss / miscarriage; medical care advised.');
    factors.push(support11 ? `11th cusp sub-lord ${cusp11.subLord} supports fulfilment of the desire for children.` : `11th cusp sub-lord ${cusp11.subLord} does not strongly support the 5th — fulfilment needs effort.`);

    let verdict;
    if (confidence >= 65) verdict = { label: 'Progeny Strongly Promised (KP)', cls: 'good' };
    else if (confidence >= 45) verdict = { label: 'Progeny Promised (KP)', cls: 'good' };
    else if (confidence >= 30) verdict = { label: 'Progeny with Effort / Delay (KP)', cls: 'mid' };
    else verdict = { label: 'Progeny Weak / Denied (KP)', cls: 'bad' };

    return { cusp5, subLord, sigHouses, matched, denials, lossOf5, support11, confidence, significators, factors, verdict };
  }

  /* ---------------------------------------------------------------------
   * Progeny significator planets (for timing) with weights
   * ------------------------------------------------------------------- */
  function significatorWeights(chart, par, kpRes) {
    const w = {};
    const add = (p, x) => { if (p) w[p] = (w[p] || 0) + x; };
    // Parāśara: Jupiter (kāraka), 5th lord, occupants of D1 5th
    add('Jupiter', 1.2);
    add(par.fifthLord, 1.0);
    BPHS.occupants(5, chart).forEach((p) => add(p, BENEFIC.includes(p) ? 0.8 : 0.4));
    // planets aspecting the 5th
    par.d1.aspects.forEach((p) => add(p, 0.3));
    // KP significators of 2/5/11 (tiered)
    kpRes.significators.forEach((s) => add(s.planet, 0.25 * s.strength));
    add(kpRes.subLord, 0.8);
    // node dispositor effect: Rahu/Ketu carry their sign-lord's promise (light)
    return w;
  }

  // Jupiter transit support for childbirth at a given jd (from Lagna & Moon)
  function transitSupport(chart, jd) {
    const pos = Transit.positionsAt(jd);
    const lagnaSign = chart.ascendant.sign;
    const moonSign = chart.planets.Moon.sign;
    const fifthLordSign = chart.planets[Astro.RASHI_LORD[(lagnaSign + 4) % 12]].sign;
    let s = 0; const notes = [];
    const jupFromLagna = Transit.houseFrom(lagnaSign, pos.Jupiter.sign);
    const jupFromMoon = Transit.houseFrom(moonSign, pos.Jupiter.sign);
    if ([5, 9, 1].includes(jupFromLagna)) { s += 2; notes.push(`Jupiter transits ${ordinal(jupFromLagna)} from Lagna`); }
    if ([5, 9].includes(jupFromMoon)) { s += 1.5; notes.push(`Jupiter transits ${ordinal(jupFromMoon)} from Moon`); }
    if (pos.Jupiter.sign === fifthLordSign) { s += 1.2; notes.push("Jupiter transits the 5th-lord's sign"); }
    // Saturn maturity over 5th can also time (slower, lesser)
    const satFromLagna = Transit.houseFrom(lagnaSign, pos.Saturn.sign);
    if (satFromLagna === 5) { s += 0.6; notes.push('Saturn matures the 5th house'); }
    return { score: s, notes };
  }

  /* ---------------------------------------------------------------------
   * TIMING — scan dasha (AD/PD) windows + transit for progeny fructification
   * Returns nearest window + top windows in the span.
   * ------------------------------------------------------------------- */
  function timing(chart, par, kpRes, fromJd, years) {
    const weights = significatorWeights(chart, par, kpRes);
    const span = Dasha.expandWindow(chart, fromJd, years || 20);
    const wins = [];
    span.periods.forEach((ad) => {
      (ad.pds || []).forEach((pd) => {
        const mid = (Math.max(pd.startJd, fromJd) + pd.endJd) / 2;
        const wMd = weights[ad.md] || 0;
        const wAd = weights[ad.lord] || 0;
        const wPd = weights[pd.lord] || 0;
        const dashaScore = wMd * 1.0 + wAd * 1.6 + wPd * 1.1;
        if (dashaScore <= 0) return;
        const tr = transitSupport(chart, mid);
        const total = dashaScore * 3 + tr.score;
        wins.push({
          startJd: pd.startJd, endJd: pd.endJd, md: ad.md, ad: ad.lord, pd: pd.lord,
          dashaScore: +dashaScore.toFixed(2), transitScore: +tr.score.toFixed(2),
          score: +total.toFixed(2), transitNotes: tr.notes,
        });
      });
    });
    wins.sort((a, b) => b.score - a.score);
    // nearest meaningful window in chronological order
    const chrono = wins.slice().sort((a, b) => a.startJd - b.startJd);
    const nearest = chrono.find((w) => w.score >= 3 && w.endJd >= fromJd) || chrono[0] || null;
    return { nearest, top: wins.slice(0, 6), weights };
  }

  /* ---------------------------------------------------------------------
   * Combine into an overall progeny index + verdict
   * ------------------------------------------------------------------- */
  function combine(parScore, kpConf, sphutaScore) {
    // Parāśara 45%, KP 35%, Sphuṭa 20%
    return clamp(Math.round(parScore * 0.45 + kpConf * 0.35 + sphutaScore * 0.20), 3, 98);
  }
  function overallVerdict(idx) {
    if (idx >= 65) return { label: 'Progeny Strongly Promised', cls: 'good' };
    if (idx >= 50) return { label: 'Progeny Promised', cls: 'good' };
    if (idx >= 36) return { label: 'Progeny with Delay / Effort', cls: 'mid' };
    if (idx >= 24) return { label: 'Progeny Difficult — Remedies Advised', cls: 'bad' };
    return { label: 'Progeny Largely Denied', cls: 'bad' };
  }

  /* ---------------------------------------------------------------------
   * Individual analysis (single chart)
   * ------------------------------------------------------------------- */
  function analyze(chart, gender, fromJd, years) {
    const par = parashara(chart, gender);
    const kpRes = kp(chart);
    const sphuta = gender === 'female' ? kshetraSphuta(chart) : beejaSphuta(chart);
    const index = combine(par.score, kpRes.confidence, sphuta.score);
    const verdict = overallVerdict(index);
    const t = timing(chart, par, kpRes, fromJd || chart.jd, years || 20);
    return { individual: true, gender, par, kp: kpRes, sphuta, index, verdict, timing: t };
  }

  /* ---------------------------------------------------------------------
   * Couple analysis — male Beeja + female Kṣetra; both 5th houses; combined
   * promise; timing primarily from the wife's chart (and the husband's).
   * ------------------------------------------------------------------- */
  function couple(boyChart, girlChart, fromJd, years) {
    const boy = analyze(boyChart, 'male', fromJd, years);
    const girl = analyze(girlChart, 'female', fromJd, years);
    const beeja = boy.sphuta;   // male seed
    const kshetra = girl.sphuta; // female field
    // combined index: both partners' promise + the Beeja/Kṣetra pair
    const pairSphuta = Math.round((beeja.score + kshetra.score) / 2);
    const index = clamp(Math.round(
      ((boy.par.score + girl.par.score) / 2) * 0.42 +
      ((boy.kp.confidence + girl.kp.confidence) / 2) * 0.33 +
      pairSphuta * 0.25
    ), 3, 98);
    const verdict = overallVerdict(index);

    const notes = [];
    notes.push(`Husband's Beeja Sphuṭa strength ${beeja.score}/100 (${beeja.strong ? 'potent' : 'weak'}); Wife's Kṣetra Sphuṭa strength ${kshetra.score}/100 (${kshetra.strong ? 'fertile' : 'weak'}).`);
    if (!beeja.strong && !kshetra.strong) notes.push('Both Beeja and Kṣetra are weak — medical support / remedies strongly advised for conception.');
    else if (!beeja.strong) notes.push('Beeja (male) weak while Kṣetra (female) is supportive — focus on the husband\'s vitality / Jupiter remedies.');
    else if (!kshetra.strong) notes.push('Kṣetra (female) weak while Beeja (male) is supportive — care for the wife\'s reproductive health.');
    else notes.push('Both Beeja and Kṣetra are well disposed — natural conception is favourably indicated.');

    // combined nearest window: earliest window where BOTH partners score well,
    // else fall back to the wife's nearest (childbirth timed from the mother).
    let combinedNearest = null;
    const bTop = boy.timing.top, gTop = girl.timing.top;
    if (girl.timing.nearest && boy.timing.nearest) {
      // pick the later of the two nearest starts as the realistic joint window
      combinedNearest = (girl.timing.nearest.startJd >= boy.timing.nearest.startJd) ? girl.timing.nearest : boy.timing.nearest;
    } else {
      combinedNearest = girl.timing.nearest || boy.timing.nearest;
    }

    return { individual: false, boy, girl, beeja, kshetra, pairSphuta, index, verdict, notes, combinedNearest };
  }

  return {
    analyze, couple, parashara, kp, beejaSphuta, kshetraSphuta,
    divisionalFifth, timing, significatorWeights, transitSupport,
    combine, overallVerdict, ordinal,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Progeny;

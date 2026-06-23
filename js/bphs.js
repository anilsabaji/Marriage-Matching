/* =============================================================================
 * bphs.js  —  Brihat Parashara Hora Shastra (BPHS) Bhava analysis
 *
 * Tabulates the significations of all 12 Bhavas for a chart, computes a
 * strength score per bhava (placement, lordship dignity, occupants, aspects),
 * and produces a marriage-focused assessment from the 7th, 2nd, 11th, 5th and
 * 8th houses plus the karaka Venus (for males) / Jupiter (for females).
 * ========================================================================== */

const BPHS = (function () {
  'use strict';

  const BHAVA_SIGNIFICATIONS = {
    1: { name: 'Tanu (Self)', themes: 'Body, personality, vitality, overall constitution, general disposition, head' },
    2: { name: 'Dhana (Wealth/Family)', themes: 'Family, accumulated wealth, speech, food, early married/family life (kutumba), face' },
    3: { name: 'Sahaja (Siblings)', themes: 'Courage, siblings, communication, short journeys, initiative, hands' },
    4: { name: 'Sukha (Happiness)', themes: 'Home, mother, domestic comfort, property, vehicles, emotional foundation, heart' },
    5: { name: 'Putra (Progeny)', themes: 'Children, romance, intelligence, love affairs, purva-punya, creativity, stomach' },
    6: { name: 'Ari (Adversity)', themes: 'Disease, debts, enemies, conflicts, service, daily health, intestines' },
    7: { name: 'Yuvati / Kalatra (Spouse)', themes: 'Marriage, spouse, partnerships, sexual union, public dealings — the prime house of marriage' },
    8: { name: 'Ayur / Randhra (Longevity)', themes: 'Longevity, chronic ailments, in-laws wealth, transformation, marital intimacy & secrets, sudden events' },
    9: { name: 'Dharma (Fortune)', themes: 'Luck, dharma, father, higher wisdom, long journeys, blessings on marriage' },
    10: { name: 'Karma (Career)', themes: 'Profession, status, public life, authority, karma' },
    11: { name: 'Labha (Gains)', themes: 'Gains, fulfilment of desires, friends, elder siblings — fructification of marriage prospects' },
    12: { name: 'Vyaya (Loss/Liberation)', themes: 'Expenditure, bed-pleasures (shayya-sukha), foreign lands, losses, moksha, isolation' },
  };

  // houses central to marriage and their weight in the marriage index
  const MARRIAGE_HOUSES = { 7: 3.0, 2: 1.5, 11: 1.5, 5: 1.0, 8: 1.0, 12: 0.8, 4: 0.6 };

  function dignity(planet, chart) {
    const p = chart.planets[planet];
    if (!p) return { label: 'n/a', score: 0 };
    const sign = p.sign;
    if (Astro.EXALT[planet] === sign) return { label: 'Exalted', score: 5 };
    if (Astro.DEBIL[planet] === sign) return { label: 'Debilitated', score: -3 };
    if ((Astro.OWN[planet] || []).includes(sign)) return { label: 'Own sign', score: 4 };
    const lord = Astro.RASHI_LORD[sign];
    const rel = Astro.relation(planet, lord);
    if (rel === 'friend' || rel === 'self') return { label: 'Friendly sign', score: 2 };
    if (rel === 'enemy') return { label: 'Enemy sign', score: -1 };
    return { label: 'Neutral sign', score: 1 };
  }

  // which planets occupy a given house number
  function occupants(house, chart) {
    return Astro.PLANETS.filter((p) => chart.planets[p].house === house);
  }

  // which planets aspect a given house (graha drishti, whole sign)
  function aspectingPlanets(house, chart) {
    const res = [];
    Astro.PLANETS.forEach((p) => {
      const from = chart.planets[p].house;
      Astro.aspectsHouses(p).forEach((a) => {
        const target = ((from - 1 + a - 1) % 12) + 1;
        if (target === house) res.push(p);
      });
    });
    return res;
  }

  // benefic / malefic nature (natural)
  const NAT_BENEFIC = ['Jupiter', 'Venus', 'Mercury', 'Moon'];
  const NAT_MALEFIC = ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'];

  function bhavaStrength(house, chart) {
    const sign = (chart.ascendant.sign + house - 1) % 12;
    const lord = Astro.RASHI_LORD[sign];
    const lordPlanet = chart.planets[lord];
    let score = 50; // baseline (percent-like)
    const factors = [];

    // 1. dignity of the lord
    const dg = dignity(lord, chart);
    score += dg.score * 4;
    factors.push(`${house}th lord ${lord} is ${dg.label}`);

    // 2. lord placement house quality (kendra/trikona good, dusthana weak)
    const lh = lordPlanet.house;
    if ([1, 4, 7, 10].includes(lh)) { score += 6; factors.push(`lord in kendra (H${lh})`); }
    if ([1, 5, 9].includes(lh)) { score += 6; factors.push(`lord in trikona (H${lh})`); }
    if ([6, 8, 12].includes(lh)) { score -= 10; factors.push(`lord in dusthana (H${lh})`); }

    // 3. occupants
    const occ = occupants(house, chart);
    occ.forEach((o) => {
      if (NAT_BENEFIC.includes(o)) { score += 5; factors.push(`benefic ${o} present`); }
      else { score -= 4; factors.push(`malefic ${o} present`); }
      const od = dignity(o, chart);
      score += od.score * 1.5;
    });

    // 4. aspects
    const asp = aspectingPlanets(house, chart);
    asp.forEach((a) => {
      if (NAT_BENEFIC.includes(a)) { score += 3; }
      else { score -= 2; }
    });
    if (asp.length) factors.push(`aspected by ${asp.join(', ')}`);

    // 5. retrograde lord adds unpredictability (mild)
    if (lordPlanet.retro) { score -= 2; factors.push(`${lord} retrograde`); }

    score = Math.max(2, Math.min(98, Math.round(score)));
    return { house, sign, signName: Astro.RASHIS[sign], lord, lordHouse: lh,
      lordDignity: dg.label, occupants: occ, aspects: asp, score, factors };
  }

  function analyzeAll(chart) {
    const rows = [];
    for (let h = 1; h <= 12; h++) {
      const s = bhavaStrength(h, chart);
      rows.push({
        ...s,
        significationName: BHAVA_SIGNIFICATIONS[h].name,
        themes: BHAVA_SIGNIFICATIONS[h].themes,
      });
    }
    return rows;
  }

  // Marriage-specific index for an individual chart (0-100)
  function marriageIndex(chart, gender) {
    const rows = analyzeAll(chart);
    let weighted = 0, totalW = 0;
    Object.keys(MARRIAGE_HOUSES).forEach((h) => {
      const w = MARRIAGE_HOUSES[h];
      const r = rows[parseInt(h, 10) - 1];
      weighted += r.score * w;
      totalW += w;
    });
    let base = weighted / totalW;

    // karaka: Venus for marriage (and for males primarily), Jupiter for females
    const venus = dignity('Venus', chart);
    const jup = dignity('Jupiter', chart);
    const karaka = gender === 'female' ? jup : venus;
    base += karaka.score * 2;

    // 7th lord & Venus afflicted by Mars/Saturn/Rahu in 7th?
    const seventhOcc = occupants(7, chart);
    let afflict = 0;
    ['Mars', 'Saturn', 'Rahu', 'Ketu', 'Sun'].forEach((m) => {
      if (seventhOcc.includes(m)) afflict += 1;
    });
    base -= afflict * 3;

    base = Math.max(5, Math.min(98, Math.round(base)));

    return {
      index: base,
      seventh: rows[6],
      second: rows[1],
      eleventh: rows[10],
      fifth: rows[4],
      eighth: rows[7],
      twelfth: rows[11],
      venusDignity: venus,
      jupiterDignity: jup,
      seventhAfflictions: afflict,
      karakaUsed: gender === 'female' ? 'Jupiter' : 'Venus',
    };
  }

  function verdict(score) {
    if (score >= 75) return { label: 'Very Strong', cls: 'good' };
    if (score >= 60) return { label: 'Strong', cls: 'good' };
    if (score >= 45) return { label: 'Moderate', cls: 'mid' };
    if (score >= 30) return { label: 'Weak', cls: 'bad' };
    return { label: 'Challenged', cls: 'bad' };
  }

  // Combined BPHS compatibility view of the couple
  function coupleAssessment(boyChart, girlChart) {
    const b = marriageIndex(boyChart, 'male');
    const g = marriageIndex(girlChart, 'female');
    const combined = Math.round((b.index + g.index) / 2);
    const notes = [];

    // 7th lord placement harmony
    notes.push(
      `Boy's 7th house strength ${b.seventh.score}/100 (lord ${b.seventh.lord} in H${b.seventh.lordHouse}); ` +
      `Girl's 7th house strength ${g.seventh.score}/100 (lord ${g.seventh.lord} in H${g.seventh.lordHouse}).`
    );
    if (b.seventhAfflictions || g.seventhAfflictions) {
      notes.push(
        `Affliction to the 7th house detected (boy:${b.seventhAfflictions}, girl:${g.seventhAfflictions}) — ` +
        `indicates need for patience, possible delays or adjustment in marital matters.`
      );
    }
    notes.push(
      `Karaka dignity — Venus (love/spouse): boy ${b.venusDignity.label}, girl ${g.venusDignity.label}; ` +
      `Jupiter (wisdom/husband): boy ${b.jupiterDignity.label}, girl ${g.jupiterDignity.label}.`
    );

    return { boy: b, girl: g, combined, verdict: verdict(combined), notes };
  }

  return {
    BHAVA_SIGNIFICATIONS, MARRIAGE_HOUSES, NAT_BENEFIC, NAT_MALEFIC,
    dignity, occupants, aspectingPlanets, bhavaStrength,
    analyzeAll, marriageIndex, coupleAssessment, verdict,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BPHS;

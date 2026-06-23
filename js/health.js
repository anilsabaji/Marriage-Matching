/* =============================================================================
 * health.js  —  Health Compatibility Screener
 *
 * An integrated Jyotish health screener (the "Health screener" referenced for
 * this module) adapted to assess the HEALTH COMPATIBILITY of the two partners.
 *
 * For each chart it screens:
 *   - 1st house / Lagna lord  -> constitution & vitality
 *   - 6th house / lord        -> disease, acute illness, immunity
 *   - 8th house / lord        -> chronic / longevity / accidents
 *   - 12th house              -> hospitalisation, sleep, drains
 *   - Moon (mind), Sun (vitality), Mars (blood/energy), Saturn (chronic)
 *   - Ayurvedic dosha (Vata/Pitta/Kapha) leaning from sign elements & Moon nak
 * Then it compares the two to flag complementary vs clashing health profiles
 * and a combined Health Compatibility Index (0-100).
 * ========================================================================== */

const Health = (function () {
  'use strict';

  const DUSTHANA = [6, 8, 12];

  // Ayurvedic dosha leaning of a sign (by element + nature)
  // fire->Pitta, earth->Vata/Kapha, air->Vata, water->Kapha
  function signDosha(sign) {
    const el = Astro.RASHI_ELEMENT[sign];
    if (el === 0) return 'Pitta';
    if (el === 2) return 'Vata';
    if (el === 3) return 'Kapha';
    // earth signs mixed; Taurus/Cap Kapha-leaning, Virgo Vata
    if (sign === 5) return 'Vata';
    return 'Kapha';
  }

  // Nadi from Moon's nakshatra also maps to dosha: Adi=Vata, Madhya=Pitta, Antya=Kapha
  function nadiDosha(nadi) {
    return nadi === 'Adi' ? 'Vata' : nadi === 'Madhya' ? 'Pitta' : 'Kapha';
  }

  function screen(chart) {
    const lagna = chart.ascendant.sign;
    const lagnaLord = Astro.RASHI_LORD[lagna];
    const sixthLord = Astro.RASHI_LORD[(lagna + 5) % 12];
    const eighthLord = Astro.RASHI_LORD[(lagna + 7) % 12];
    const twelfthLord = Astro.RASHI_LORD[(lagna + 11) % 12];

    const flags = [];
    let vitality = 60;

    // Lagna lord dignity & placement
    const lagnaLordPl = chart.planets[lagnaLord];
    if (DUSTHANA.includes(lagnaLordPl.house)) { vitality -= 10; flags.push(`Lagna lord ${lagnaLord} in dusthana H${lagnaLordPl.house} — guard vitality`); }
    if (Astro.EXALT[lagnaLord] === lagnaLordPl.sign) { vitality += 10; flags.push(`Lagna lord ${lagnaLord} exalted — robust constitution`); }
    if (Astro.DEBIL[lagnaLord] === lagnaLordPl.sign) { vitality -= 8; flags.push(`Lagna lord ${lagnaLord} debilitated — lower reserve`); }

    // malefics in lagna / 1st
    const firstOcc = Astro.PLANETS.filter((p) => chart.planets[p].house === 1);
    firstOcc.forEach((p) => {
      if (['Mars', 'Saturn', 'Rahu', 'Ketu'].includes(p)) { vitality -= 4; flags.push(`${p} in 1st — affects body/temperament`); }
    });

    // 6th house: occupants & lord
    const sixthOcc = Astro.PLANETS.filter((p) => chart.planets[p].house === 6);
    let immunity = 60;
    if (['Mars', 'Saturn', 'Sun', 'Mercury'].includes(sixthLord)) immunity += 6; // strong 6th lord resists disease
    sixthOcc.forEach((p) => {
      if (['Mars', 'Saturn', 'Rahu', 'Ketu', 'Sun'].includes(p)) { immunity += 4; }
      else { immunity -= 4; flags.push(`Benefic ${p} in 6th — can lower disease resistance`); }
    });

    // 8th house: chronic/longevity
    let chronic = 65; // higher = fewer chronic concerns
    const eighthOcc = Astro.PLANETS.filter((p) => chart.planets[p].house === 8);
    eighthOcc.forEach((p) => {
      if (['Saturn', 'Rahu', 'Ketu', 'Mars'].includes(p)) { chronic -= 8; flags.push(`${p} in 8th — chronic/longevity caution`); }
      else { chronic -= 3; }
    });
    if (chart.planets.Saturn.house === 8) chronic -= 4;

    // Moon affliction -> mental/emotional health
    let mind = 62;
    const moon = chart.planets.Moon;
    const moonAspBy = Astro.PLANETS.filter((p) => {
      const from = chart.planets[p].house;
      return Astro.aspectsHouses(p).some((a) => (((from - 1 + a - 1) % 12) + 1) === moon.house);
    });
    if (moonAspBy.includes('Saturn')) { mind -= 8; flags.push('Saturn afflicts Moon — tendency to low mood / worry'); }
    if (moonAspBy.includes('Mars')) { mind -= 5; flags.push('Mars afflicts Moon — irritability / heat'); }
    if (moonAspBy.includes('Rahu')) { mind -= 6; flags.push('Rahu afflicts Moon — anxiety / restlessness'); }
    if (moonAspBy.includes('Jupiter')) { mind += 8; }
    // Kemadruma-like: Moon with no planets in 2nd/12th from it (isolation)
    const around = Astro.PLANETS.filter((p) => p !== 'Moon').some((p) => {
      const h = chart.planets[p].house;
      return h === ((moon.house % 12) + 1) || h === (((moon.house + 10) % 12) + 1);
    });
    if (!around) { mind -= 6; flags.push('Moon relatively unsupported (Kemadruma-like) — needs emotional anchoring'); }

    vitality = clamp(vitality); immunity = clamp(immunity); chronic = clamp(chronic); mind = clamp(mind);

    // dosha profile
    const lagnaDosha = signDosha(lagna);
    const moonDosha = nadiDosha(Astro.NAK[moon.nakIdx].nadi);
    const sunDosha = signDosha(chart.planets.Sun.sign);

    const overall = Math.round(vitality * 0.3 + immunity * 0.25 + chronic * 0.25 + mind * 0.2);

    return {
      vitality, immunity, chronic, mind, overall,
      lagnaLord, sixthLord, eighthLord, twelfthLord,
      lagnaDosha, moonDosha, sunDosha,
      flags,
    };
  }

  function clamp(v) { return Math.max(8, Math.min(96, Math.round(v))); }

  // Compatibility between the two health profiles
  function compatibility(boyChart, girlChart) {
    const b = screen(boyChart);
    const g = screen(girlChart);
    const notes = [];
    let score = 60;

    // 1. Both should not be simultaneously weak in vitality/chronic
    if (b.vitality < 45 && g.vitality < 45) { score -= 10; notes.push('Both partners show lower vitality — prioritise lifestyle, diet & preventive care together.'); }
    else { score += 6; }
    if (b.chronic < 45 && g.chronic < 45) { score -= 8; notes.push('Both carry chronic-care indicators (8th house) — joint long-term health planning advised.'); }

    // 2. Mental/emotional compatibility (Moon)
    const mindAvg = (b.mind + g.mind) / 2;
    if (mindAvg >= 60) { score += 8; notes.push('Emotionally steady pairing — Moon profiles are mutually supportive.'); }
    else if (mindAvg < 45) { score -= 6; notes.push('Both benefit from emotional support routines; one steady partner should anchor the other.'); }

    // 3. Dosha complementarity (Ayurvedic) — same dosha can amplify imbalance
    const doshaPairs = [];
    function doshaCompat(d1, d2) {
      if (d1 === d2) return { v: -3, t: `Both ${d1}-leaning — same imbalance can amplify; balance with opposite-quality diet & routine.` };
      return { v: 4, t: `${d1} & ${d2} doshas — complementary, naturally balancing.` };
    }
    const dc = doshaCompat(b.moonDosha, g.moonDosha);
    score += dc.v; notes.push('Constitution: ' + dc.t);

    // 4. 6th/8th lord cross — if boy's 6th lord = girl's 8th lord etc (shared vulnerability) — light touch
    if (b.sixthLord === g.eighthLord || g.sixthLord === b.eighthLord) {
      score -= 3; notes.push('Cross 6th/8th lordship link — be mindful of shared health stress triggers.');
    }

    // 5. complementary strengths
    if ((b.immunity >= 60 && g.immunity < 50) || (g.immunity >= 60 && b.immunity < 50)) {
      score += 4; notes.push('One partner has stronger immunity — naturally caretaking dynamic.');
    }

    score = clamp(score);
    let verdict;
    if (score >= 70) verdict = { label: 'Health-Compatible', cls: 'good' };
    else if (score >= 50) verdict = { label: 'Moderately Compatible', cls: 'mid' };
    else verdict = { label: 'Needs Health Care Focus', cls: 'bad' };

    return { boy: b, girl: g, score, verdict, notes };
  }

  return { signDosha, nadiDosha, screen, compatibility };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Health;

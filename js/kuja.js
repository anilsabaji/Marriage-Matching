/* =============================================================================
 * kuja.js  —  Maṅgala (Kuja / Mangal) Dosha analysis & cancellation
 *
 * Based on the D1 (Rāśi) chart. A person is "Manglik" when Mars occupies the
 * 1st, 2nd, 4th, 7th, 8th or 12th house counted from the Lagna, the Moon, or
 * Venus. The dosha harms marriage (discord, delay, separation, even harm to
 * the spouse) — but classical texts list many CANCELLATIONS (Bhanga):
 *   - Mars in its own sign (Aries/Scorpio), exaltation (Capricorn) or
 *     Mūlatrikoṇa (Aries);
 *   - specific sign-in-house placements (e.g. Mars in Gemini/Virgo in the 2nd,
 *     in Taurus/Libra in the 12th, in Capricorn in the 7th, etc.);
 *   - Jupiter or Venus conjoining or aspecting Mars;
 *   - Moon conjunct Mars; Saturn aspecting Mars (restraint);
 *   - debilitated (weak) Mars.
 * At the couple level, if BOTH partners are Manglik the dosha is mutually
 * cancelled; if only one is, caution / remedies are advised.
 * ========================================================================== */

const KujaDosha = (function () {
  'use strict';

  const DOSHA_HOUSES = [1, 2, 4, 7, 8, 12];
  const HOUSE_WT = { 1: 18, 2: 14, 4: 18, 7: 25, 8: 25, 12: 14 };

  // Sign-in-house classical cancellations (house number -> sign indices)
  const SIGN_CANCEL = {
    1: [0],        // Mars in Aries (own) in 1st
    2: [2, 5],     // Gemini / Virgo (Mercury) in 2nd
    4: [0, 7],     // Aries / Scorpio (own) in 4th
    7: [9, 3],     // Capricorn (exalted) / Cancer in 7th
    8: [8, 11],    // Sagittarius / Pisces (Jupiter) in 8th
    12: [1, 6],    // Taurus / Libra (Venus) in 12th
  };

  function houseFrom(refSign, sign) { return ((sign - refSign + 12) % 12) + 1; }
  function aspects(planet, fromHouse, targetHouse) {
    return Astro.aspectsHouses(planet).some((a) => (((fromHouse - 1 + a - 1) % 12) + 1) === targetHouse);
  }

  function analyze(chart) {
    const mars = chart.planets.Mars;
    const ms = mars.sign;
    const refs = { Lagna: chart.ascendant.sign, Moon: chart.planets.Moon.sign, Venus: chart.planets.Venus.sign };

    const hits = [];
    let intensity = 0;
    for (const k in refs) {
      const h = houseFrom(refs[k], ms);
      if (DOSHA_HOUSES.includes(h)) { hits.push({ ref: k, house: h }); intensity += HOUSE_WT[h]; }
    }
    intensity = Math.min(100, intensity);
    const present = hits.length > 0;
    const fromText = hits.map((h) => `${ordinal(h.house)} from ${h.ref}`).join(', ');

    const reasons = [];
    let reduction = 0;
    if (present) {
      if ((Astro.OWN.Mars || []).includes(ms)) { reasons.push(`Mars in its own sign (${Astro.RASHIS[ms]})`); reduction = Math.max(reduction, 0.9); }
      if (Astro.EXALT.Mars === ms) { reasons.push('Mars exalted in Capricorn'); reduction = Math.max(reduction, 1.0); }
      hits.forEach((h) => {
        if ((SIGN_CANCEL[h.house] || []).includes(ms)) {
          reasons.push(`Mars in ${Astro.RASHIS[ms]} in the ${ordinal(h.house)} house — classical cancellation`);
          reduction = Math.max(reduction, 0.85);
        }
      });
      ['Jupiter', 'Venus'].forEach((b) => {
        const bp = chart.planets[b];
        if (!bp) return;
        if (bp.house === mars.house) { reasons.push(`${b} conjunct Mars`); reduction = Math.max(reduction, 0.8); }
        else if (aspects(b, bp.house, mars.house)) { reasons.push(`${b} aspects Mars`); reduction = Math.max(reduction, 0.7); }
      });
      if (chart.planets.Moon.house === mars.house) { reasons.push('Moon conjunct Mars'); reduction = Math.max(reduction, 0.45); }
      const sa = chart.planets.Saturn;
      if (sa && aspects('Saturn', sa.house, mars.house)) { reasons.push('Saturn aspects Mars (restraint)'); reduction = Math.max(reduction, 0.4); }
      if (Astro.DEBIL.Mars === ms) { reasons.push('Mars debilitated (too weak to fully inflict)'); reduction = Math.max(reduction, 0.5); }
    }

    const netIntensity = Math.round(intensity * (1 - reduction));
    const cancelled = present && netIntensity < 12;

    let level;
    if (!present) level = { label: 'No Kuja Dosha', cls: 'good' };
    else if (cancelled) level = { label: 'Kuja Dosha Cancelled (Bhaṅga)', cls: 'good' };
    else if (netIntensity >= 45) level = { label: 'Strong Kuja Dosha', cls: 'bad' };
    else if (netIntensity >= 22) level = { label: 'Moderate Kuja Dosha', cls: 'mid' };
    else level = { label: 'Mild Kuja Dosha', cls: 'mid' };

    return {
      present, intensity, netIntensity, cancelled,
      reductionPct: Math.round(reduction * 100),
      reasons, hits, fromText, level,
      marsSign: Astro.RASHIS[ms],
      marsHouse: mars.house,
    };
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function couple(boyChart, girlChart) {
    const kb = analyze(boyChart);
    const kg = analyze(girlChart);
    const bActive = kb.present && kb.netIntensity >= 12;
    const gActive = kg.present && kg.netIntensity >= 12;
    let score, verdict, note;
    if (!bActive && !gActive) {
      score = 90;
      verdict = { label: 'Compatible — no active Kuja Dosha', cls: 'good' };
      note = 'Neither chart carries an active Maṅgala dosha (absent or cancelled by Bhaṅga). No Manglik obstacle.';
    } else if (bActive && gActive) {
      score = 80;
      verdict = { label: 'Mutual Kuja Dosha — cancels out', cls: 'good' };
      note = 'Both partners are Manglik; classically the dosha is mutually neutralised — a recommended pairing for Manglik natives.';
    } else {
      score = 36;
      verdict = { label: 'Kuja Dosha Mismatch — caution', cls: 'bad' };
      const who = bActive ? 'Groom' : 'Bride';
      note = `Only the ${who} carries an active Maṅgala dosha while the partner does not. Classical texts advise caution — pairing with another Manglik, or remedies (e.g. Kumbha Vivaha, Hanuman/Mangal propitiation) before marriage.`;
    }
    return { boy: kb, girl: kg, score, verdict, note, bActive, gActive };
  }

  return { analyze, couple, DOSHA_HOUSES, ordinal };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KujaDosha;

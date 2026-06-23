/* =============================================================================
 * planet-strength.js  —  Planetary strength (Bala) engine
 *
 * Computes a strength MULTIPLIER (~0.4 .. 1.6) for each planet, considering:
 *   - Exaltation / Own sign / Friendly / Neutral / Enemy / Debilitation
 *   - Neecha Bhanga (debilitation cancellation) with classical conditions
 *   - Direction (retrograde — Cheṣṭā strength)
 *   - Speed (fast / slow / stationary relative to mean daily motion)
 *   - Combustion (proximity to the Sun)
 *   - Declination (Āyana-style minor directional factor)
 *
 * This multiplier scales how strongly a dasha lord delivers the results of the
 * houses it signifies (used by the relationship-strength prediction for both
 * the Parāśara and KP methods).
 * ========================================================================== */

const PlanetStrength = (function () {
  'use strict';

  // Approximate geocentric mean daily motion (degrees/day)
  const MEAN_SPEED = {
    Sun: 0.9856, Moon: 13.176, Mars: 0.524, Mercury: 1.383,
    Jupiter: 0.0831, Venus: 1.200, Saturn: 0.0335, Rahu: 0.0529, Ketu: 0.0529,
  };

  // Combustion orbs (degrees from the Sun)
  const COMBUST = { Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15 };

  const TRUE_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  // Which planet is exalted in a given sign (for Neecha Bhanga checks)
  function exaltedRulerOfSign(sign) {
    for (const p of TRUE_PLANETS) {
      if (Astro.EXALT[p] === sign) return p;
    }
    return null;
  }

  function houseFromMoon(chart, sign) {
    return ((sign - chart.planets.Moon.sign + 12) % 12) + 1;
  }
  function isKendra(h) { return h === 1 || h === 4 || h === 7 || h === 10; }

  // Neecha Bhanga (debilitation cancellation). Returns array of reasons or false.
  function neechaBhanga(planet, chart) {
    const p = chart.planets[planet];
    if (Astro.DEBIL[planet] !== p.sign) return false; // not debilitated
    const reasons = [];
    const dispositor = Astro.RASHI_LORD[p.sign];
    const dp = chart.planets[dispositor];
    if (dp) {
      if (isKendra(dp.house)) reasons.push(`dispositor ${dispositor} in a kendra from Lagna`);
      if (isKendra(houseFromMoon(chart, dp.sign))) reasons.push(`dispositor ${dispositor} in a kendra from Moon`);
      if (Astro.EXALT[dispositor] === dp.sign) reasons.push(`dispositor ${dispositor} is exalted`);
      // conjunct or aspected by dispositor
      if (dp.house === p.house) reasons.push('conjunct its dispositor');
      else {
        const aspd = Astro.aspectsHouses(dispositor).some((a) => (((dp.house - 1 + a - 1) % 12) + 1) === p.house);
        if (aspd) reasons.push('aspected by its dispositor');
      }
    }
    const er = exaltedRulerOfSign(p.sign);
    if (er && chart.planets[er]) {
      const erp = chart.planets[er];
      if (isKendra(erp.house) || isKendra(houseFromMoon(chart, erp.sign))) {
        reasons.push(`${er} (exalted in this sign) is in a kendra`);
      }
    }
    return reasons.length ? reasons : false;
  }

  // Declination (assuming ~0 ecliptic latitude): δ = asin(sinε · sinλ_tropical)
  function declination(planet, chart) {
    const eps = Astro.obliquity(Astro.dayNumber(chart.jd));
    const lam = chart.planets[planet].tropical;
    return Astro.asin ? Astro.asin(Astro.sin(eps) * Astro.sin(lam))
      : Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(lam * Math.PI / 180)) * 180 / Math.PI;
  }

  function strength(planet, chart) {
    const p = chart.planets[planet];
    const isNode = planet === 'Rahu' || planet === 'Ketu';
    let mult = 1.0;
    const factors = [];
    let dignity = 'Neutral';
    let neecha = false;

    // --- Dignity (exalt / own / friend / enemy / debil + neecha bhanga) ---
    if (Astro.EXALT[planet] === p.sign) { mult += 0.40; dignity = 'Exalted'; factors.push('Exalted +0.40'); }
    else if ((Astro.OWN[planet] || []).includes(p.sign)) { mult += 0.25; dignity = 'Own sign'; factors.push('Own sign +0.25'); }
    else if (Astro.DEBIL[planet] === p.sign) {
      neecha = neechaBhanga(planet, chart);
      if (neecha) { mult += 0.20; dignity = 'Debilitated (Neecha Bhanga)'; factors.push('Debilitation cancelled (Neecha Bhanga) +0.20'); }
      else { mult -= 0.40; dignity = 'Debilitated'; factors.push('Debilitated -0.40'); }
    } else {
      const rel = Astro.relation(planet, Astro.RASHI_LORD[p.sign]);
      if (rel === 'friend' || rel === 'self') { mult += 0.10; dignity = 'Friendly sign'; factors.push('Friendly sign +0.10'); }
      else if (rel === 'enemy') { mult -= 0.12; dignity = 'Enemy sign'; factors.push('Enemy sign -0.12'); }
      else { dignity = 'Neutral sign'; }
    }

    // --- Direction (retrograde — Cheṣṭā bala) ---
    if (p.retro && !isNode) { mult += 0.15; factors.push('Retrograde (Cheṣṭā) +0.15'); }

    // --- Speed (relative to mean daily motion) ---
    const mean = MEAN_SPEED[planet] || 1;
    const ratio = Math.abs(p.speed) / mean;
    if (!isNode) {
      if (ratio > 1.2) { mult += 0.08; factors.push('Fast motion +0.08'); }
      else if (ratio < 0.5) { mult -= 0.05; factors.push('Slow / near-stationary -0.05'); }
    }

    // --- Combustion ---
    let combust = false;
    if (!isNode && planet !== 'Sun') {
      let d = Math.abs(p.lon - chart.planets.Sun.lon);
      if (d > 180) d = 360 - d;
      if (d < (COMBUST[planet] || 8)) { combust = true; mult -= 0.20; factors.push('Combust (close to Sun) -0.20'); }
    }

    // --- Declination (minor directional factor) ---
    let decl = 0;
    if (!isNode) {
      decl = declination(planet, chart);
      const df = (Math.abs(decl) / 23.44) * 0.05;
      mult += df;
      if (df > 0.02) factors.push(`Declination ${decl.toFixed(1)}° +${df.toFixed(2)}`);
    }

    mult = Math.max(0.4, Math.min(1.6, mult));

    return {
      planet,
      mult: Math.round(mult * 100) / 100,
      dignity,
      retro: !!p.retro,
      combust,
      neechaBhanga: neecha,
      declination: Math.round(decl * 10) / 10,
      speed: Math.round(p.speed * 1000) / 1000,
      speedRatio: Math.round(ratio * 100) / 100,
      factors,
    };
  }

  function map(chart) {
    const m = {};
    Astro.PLANETS.forEach((p) => { m[p] = strength(p, chart); });
    return m;
  }

  return { strength, map, neechaBhanga, declination, MEAN_SPEED, COMBUST };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PlanetStrength;

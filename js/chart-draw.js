/* =============================================================================
 * chart-draw.js  —  SVG chart diagram renderer
 *
 * Draws South-Indian style box charts:
 *   - D1 (Rasi chart) — whole-sign houses from Lagna
 *   - D9 (Navamsa chart) — divisional chart
 *   - KP Placidus chart — using Porphyry/Placidus cusps from astro-core
 *
 * Each chart is rendered as an inline SVG element.
 * ========================================================================== */

const ChartDraw = (function () {
  'use strict';

  // South Indian box layout: fixed sign positions
  // Box grid 4x4 with center empty. Signs map to box positions:
  // Top row:    Pisces(11), Aries(0), Taurus(1), Gemini(2)
  // Right col:  Cancer(3), Leo(4)
  // Bottom row: Libra(6), Virgo(5), Leo(4)... standard SI layout
  //
  // Standard South Indian layout (sign index -> grid position):
  // Row 0: [11, 0, 1, 2]
  // Row 1: [10, -, -, 3]
  // Row 2: [9,  -, -, 4]
  // Row 3: [8,  7, 6, 5]

  const SI_GRID = [
    [11, 0, 1, 2],
    [10, -1, -1, 3],
    [9, -1, -1, 4],
    [8, 7, 6, 5],
  ];

  // Get grid position (row, col) for a sign index (0=Aries..11=Pisces)
  const SIGN_POS = {};
  SI_GRID.forEach((row, r) => {
    row.forEach((sign, c) => {
      if (sign >= 0) SIGN_POS[sign] = { r, c };
    });
  });

  const SIGN_ABBR = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];
  const PLANET_ABBR = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke', Ascendant: 'As' };

  function svgChart(title, signContents, lagnaSign, size) {
    size = size || 280;
    const cellW = size / 4;
    const cellH = size / 4;
    let svg = `<svg viewBox="0 0 ${size} ${size + 24}" width="${size}" height="${size + 24}" xmlns="http://www.w3.org/2000/svg" class="chart-svg">`;

    // Title
    svg += `<text x="${size / 2}" y="14" text-anchor="middle" class="chart-title">${escSvg(title)}</text>`;
    const offy = 22;

    // Draw grid lines
    svg += `<rect x="0" y="${offy}" width="${size}" height="${size}" fill="none" stroke="#3a4070" stroke-width="1"/>`;
    for (let i = 1; i < 4; i++) {
      svg += `<line x1="${i * cellW}" y1="${offy}" x2="${i * cellW}" y2="${size + offy}" stroke="#3a4070" stroke-width="0.5"/>`;
      svg += `<line x1="0" y1="${i * cellH + offy}" x2="${size}" y2="${i * cellH + offy}" stroke="#3a4070" stroke-width="0.5"/>`;
    }

    // Center box (empty — draw border)
    svg += `<rect x="${cellW}" y="${cellH + offy}" width="${cellW * 2}" height="${cellH * 2}" fill="#0d1028" stroke="#3a4070" stroke-width="0.5"/>`;

    // Fill each cell
    for (let sign = 0; sign < 12; sign++) {
      const pos = SIGN_POS[sign];
      const x = pos.c * cellW;
      const y = pos.r * cellH + offy;

      // Highlight lagna sign
      if (sign === lagnaSign) {
        svg += `<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" fill="rgba(123,92,255,.12)" rx="2"/>`;
      }

      // Sign label (top-left, small)
      svg += `<text x="${x + 3}" y="${y + 11}" class="chart-sign">${SIGN_ABBR[sign]}</text>`;

      // Planets in this sign
      const content = signContents[sign] || [];
      const lines = [];
      // Split into lines of max 3 planets
      for (let i = 0; i < content.length; i += 3) {
        lines.push(content.slice(i, i + 3).join(' '));
      }
      lines.forEach((line, li) => {
        const ty = y + 24 + li * 13;
        svg += `<text x="${x + cellW / 2}" y="${ty}" text-anchor="middle" class="chart-planet">${escSvg(line)}</text>`;
      });
    }

    svg += '</svg>';
    return svg;
  }

  function escSvg(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ======================================================================
   * D1 — Rasi chart (whole sign from Lagna)
   * ==================================================================== */
  function d1Chart(chart, label) {
    const signContents = {};
    for (let i = 0; i < 12; i++) signContents[i] = [];

    // Lagna marker
    signContents[chart.ascendant.sign].push('As');

    // Planets
    Astro.PLANETS.forEach((p) => {
      const pl = chart.planets[p];
      let lbl = PLANET_ABBR[p] || p.substring(0, 2);
      if (pl.retro && p !== 'Rahu' && p !== 'Ketu') lbl += 'ᴿ';
      signContents[pl.sign].push(lbl);
    });

    return svgChart(label || 'D1 Rāśi', signContents, chart.ascendant.sign);
  }

  /* ======================================================================
   * D9 — Navamsa chart
   * Navamsa sign = pada-based division. Each nakshatra pada maps to a
   * specific navamsa sign. Formula: for a planet at sidereal longitude L,
   * navamsa sign = floor(L / (360/108)) % 12 — which equals
   * the starting navamsa for the rashi + offset within the 3°20' division.
   *
   * Simpler formula: navamsaSign = (signIndex * 9 + floor(degInSign / 3.3333)) % 12
   * But the classical method uses the starting sign per rashi:
   * Fire signs start from Aries, Earth from Capricorn, Air from Libra, Water from Cancer.
   * ==================================================================== */
  const NAV_START = [0, 9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3]; // per sign

  function navamsaSign(sidLon) {
    const sign = Math.floor(sidLon / 30);
    const deg = sidLon - sign * 30;
    const pada = Math.floor(deg / (30 / 9)); // 0..8 (9 divisions of 3°20')
    return (NAV_START[sign] + pada) % 12;
  }

  function d9Chart(chart, label) {
    const signContents = {};
    for (let i = 0; i < 12; i++) signContents[i] = [];

    // Navamsa Lagna
    const navLagna = navamsaSign(chart.ascendant.lon);
    signContents[navLagna].push('As');

    // Planets
    Astro.PLANETS.forEach((p) => {
      const pl = chart.planets[p];
      const ns = navamsaSign(pl.lon);
      let lbl = PLANET_ABBR[p] || p.substring(0, 2);
      if (pl.retro && p !== 'Rahu' && p !== 'Ketu') lbl += 'ᴿ';
      signContents[ns].push(lbl);
    });

    return svgChart(label || 'D9 Navāṁśa', signContents, navLagna);
  }

  /* ======================================================================
   * KP Placidus chart — uses the KP cusp data from astro-core
   * Planets placed by KP house (from Porphyry cusps).
   * We label each house box with the cusp sign + degree.
   * ==================================================================== */
  function kpChart(chart, label) {
    // For KP chart, we map houses 1-12 into the SI grid by rotating so that
    // house 1 occupies the lagna sign position (same visual as D1 but house-labeled)
    const signContents = {};
    for (let i = 0; i < 12; i++) signContents[i] = [];

    // In SI chart, positions are fixed by sign. For KP we show the cusp sign
    // occupying its natural position and put house numbers + planets there.
    // Simpler approach: use the cusp sign as the cell, place planets by kpHouse.

    const cusps = chart.cusps;
    cusps.forEach((c, idx) => {
      const h = idx + 1;
      // Mark house number in the cell of the cusp sign
      if (!signContents[c.sign]) signContents[c.sign] = [];
      // Don't double-add if two cusps fall in same sign
      if (!signContents[c.sign].includes('H' + h)) {
        signContents[c.sign].unshift('H' + h);
      }
    });

    // Planets by kpHouse -> cusp sign of that house
    Astro.PLANETS.forEach((p) => {
      const pl = chart.planets[p];
      const houseIdx = pl.kpHouse - 1;
      const cuspSign = cusps[houseIdx].sign;
      let lbl = PLANET_ABBR[p] || p.substring(0, 2);
      if (pl.retro && p !== 'Rahu' && p !== 'Ketu') lbl += 'ᴿ';
      signContents[cuspSign].push(lbl);
    });

    return svgChart(label || 'KP (Placidus)', signContents, chart.ascendant.sign);
  }

  /* ======================================================================
   * Render all 3 charts side by side for a given chart object
   * ==================================================================== */
  function renderTriple(chart, nameLabel) {
    return `
      <div class="chart-triple">
        <div class="chart-box">${d1Chart(chart, nameLabel + ' — D1 Rāśi')}</div>
        <div class="chart-box">${d9Chart(chart, nameLabel + ' — D9 Navāṁśa')}</div>
        <div class="chart-box">${kpChart(chart, nameLabel + ' — KP Placidus')}</div>
      </div>`;
  }

  return { svgChart, d1Chart, d9Chart, kpChart, navamsaSign, renderTriple, SIGN_ABBR, PLANET_ABBR, SI_GRID, SIGN_POS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ChartDraw;

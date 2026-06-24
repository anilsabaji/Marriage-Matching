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

    const cusps = chart.kp.cusps;
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
      const pl = chart.kp.planets[p];
      const houseIdx = pl.kpHouse - 1;
      const cuspSign = cusps[houseIdx].sign;
      let lbl = PLANET_ABBR[p] || p.substring(0, 2);
      if (pl.retro && p !== 'Rahu' && p !== 'Ketu') lbl += 'ᴿ';
      signContents[cuspSign].push(lbl);
    });

    return svgChart(label || 'KP (Placidus)', signContents, chart.kp.ascendant.sign);
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

  /* ======================================================================
   * Relationship strength "pipe" graph
   * Center line = time axis. Boy's commitment plotted ABOVE the center,
   * Girl's BELOW. The band between the two lines forms a hollow pipe of
   * varying diameter. Colour indicates whose commitment leads at each time.
   * series: [{ jd, m, year, label, boy(0-100), girl(0-100) }]
   * ==================================================================== */
  function relationshipPipe(series, opts) {
    opts = opts || {};
    const boyName = escSvg(opts.boyName || 'Groom');
    const girlName = escSvg(opts.girlName || 'Bride');
    const W = 1000, H = 400;
    const padL = 54, padR = 18, padT = 30, padB = 52;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const cy = padT + plotH / 2;
    const maxAmp = plotH / 2 - 6;
    const n = series.length;
    if (n < 2) return '<div class="muted small">Not enough data to plot.</div>';

    const totalM = series[n - 1].m || 1;
    const xOfM = (m) => padL + (m / totalM) * plotW;
    const x = (i) => xOfM(series[i].m);
    const boyY = (v) => cy - (v / 100) * maxAmp;
    const girlY = (v) => cy + (v / 100) * maxAmp;

    const boyPts = series.map((s, i) => `${x(i).toFixed(1)},${boyY(s.boy).toFixed(1)}`).join(' ');
    const girlPts = series.map((s, i) => `${x(i).toFixed(1)},${girlY(s.girl).toFixed(1)}`).join(' ');

    // filled areas (center to each line)
    const boyArea = `${padL},${cy} ${boyPts} ${x(n - 1).toFixed(1)},${cy}`;
    const girlArea = `${padL},${cy} ${girlPts} ${x(n - 1).toFixed(1)},${cy}`;

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" class="pipe-svg" xmlns="http://www.w3.org/2000/svg">`;

    // defs gradients
    svg += `<defs>
      <linearGradient id="boyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4dc9ff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#4dc9ff" stop-opacity="0.08"/>
      </linearGradient>
      <linearGradient id="girlGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#ff7eb3" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ff7eb3" stop-opacity="0.08"/>
      </linearGradient>
    </defs>`;

    // background grid lines (horizontal strength guides)
    [0.5, 1].forEach((f) => {
      const yUp = cy - f * maxAmp, yDn = cy + f * maxAmp;
      svg += `<line x1="${padL}" y1="${yUp.toFixed(1)}" x2="${padL + plotW}" y2="${yUp.toFixed(1)}" stroke="#2a3060" stroke-width="0.5" stroke-dasharray="3 4"/>`;
      svg += `<line x1="${padL}" y1="${yDn.toFixed(1)}" x2="${padL + plotW}" y2="${yDn.toFixed(1)}" stroke="#2a3060" stroke-width="0.5" stroke-dasharray="3 4"/>`;
    });

    // year gridlines + labels along the bottom and ticks on center line
    const baseYear = series[0].year;
    const years = Math.round(totalM / 12);
    const stepYear = years > 12 ? 2 : 1;
    for (let yr = 0; yr <= years; yr += stepYear) {
      const xm = xOfM(yr * 12);
      svg += `<line x1="${xm.toFixed(1)}" y1="${padT}" x2="${xm.toFixed(1)}" y2="${padT + plotH}" stroke="#222845" stroke-width="0.5"/>`;
      svg += `<text x="${xm.toFixed(1)}" y="${(padT + plotH + 18).toFixed(1)}" text-anchor="middle" class="pipe-axis">${baseYear + yr}</text>`;
      svg += `<text x="${xm.toFixed(1)}" y="${(padT + plotH + 32).toFixed(1)}" text-anchor="middle" class="pipe-axis-sub">+${yr}y</text>`;
    }

    // filled pipe areas
    svg += `<polygon points="${boyArea}" fill="url(#boyGrad)" stroke="none"/>`;
    svg += `<polygon points="${girlArea}" fill="url(#girlGrad)" stroke="none"/>`;

    // boy & girl outline lines
    svg += `<polyline points="${boyPts}" fill="none" stroke="#4dc9ff" stroke-width="2.4" stroke-linejoin="round"/>`;
    svg += `<polyline points="${girlPts}" fill="none" stroke="#ff7eb3" stroke-width="2.4" stroke-linejoin="round"/>`;

    // center time line (drawn over fills)
    svg += `<line x1="${padL}" y1="${cy}" x2="${padL + plotW}" y2="${cy}" stroke="#e7e9ee" stroke-width="1.5"/>`;

    // dominance dots on the center line at each year: who leads that year
    for (let yr = 0; yr <= years; yr += 1) {
      const m = yr * 12;
      // find nearest sample
      let near = series[0];
      for (let i = 0; i < n; i++) { if (Math.abs(series[i].m - m) < Math.abs(near.m - m)) near = series[i]; }
      const lead = near.boy >= near.girl ? '#4dc9ff' : '#ff7eb3';
      const xm = xOfM(m);
      svg += `<circle cx="${xm.toFixed(1)}" cy="${cy}" r="2.6" fill="${lead}"/>`;
    }

    // axis side labels
    svg += `<text x="${padL - 8}" y="${(padT + 12).toFixed(1)}" text-anchor="end" class="pipe-side boy-side">${boyName} ▲</text>`;
    svg += `<text x="${padL - 8}" y="${(padT + plotH).toFixed(1)}" text-anchor="end" class="pipe-side girl-side">${girlName} ▼</text>`;
    svg += `<text x="${padL - 8}" y="${(cy + 3).toFixed(1)}" text-anchor="end" class="pipe-axis-sub">weak</text>`;
    svg += `<text x="${padL - 8}" y="${(padT - 6).toFixed(1)}" text-anchor="end" class="pipe-axis-sub">strong</text>`;

    svg += '</svg>';
    return svg;
  }

  return { svgChart, d1Chart, d9Chart, kpChart, navamsaSign, renderTriple, relationshipPipe, relationshipPipeDual, SIGN_ABBR, PLANET_ABBR, SI_GRID, SIGN_POS };

  /* ======================================================================
   * Dual-method relationship pipe: two values per partner in two colours
   *   KP (amber) and Parāśara (green). Groom above the centre, Bride below.
   * series: [{ m, year, boyKP, boyPar, girlKP, girlPar }]
   * ==================================================================== */
  function relationshipPipeDual(series, opts) {
    opts = opts || {};
    const boyName = escSvg(opts.boyName || 'Groom');
    const girlName = escSvg(opts.girlName || 'Bride');
    const KPc = '#f5b301', PARc = '#2bbf6a';
    const W = 1040, H = 440, padL = 60, padR = 20, padT = 38, padB = 58;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const cy = padT + plotH / 2, maxAmp = plotH / 2 - 6;
    const n = series.length;
    if (n < 2) return '<div class="muted small">Not enough data to plot.</div>';
    const totalM = series[n - 1].m || 1;
    const xOfM = (m) => padL + (m / totalM) * plotW;
    const x = (i) => xOfM(series[i].m);
    const up = (v) => cy - (v / 100) * maxAmp;
    const dn = (v) => cy + (v / 100) * maxAmp;
    const line = (key, dir) => series.map((s, i) => `${x(i).toFixed(1)},${(dir === 'up' ? up(s[key]) : dn(s[key])).toFixed(1)}`).join(' ');
    const boyAvg = series.map((s, i) => `${x(i).toFixed(1)},${up((s.boyKP + s.boyPar) / 2).toFixed(1)}`).join(' ');
    const girlAvg = series.map((s, i) => `${x(i).toFixed(1)},${dn((s.girlKP + s.girlPar) / 2).toFixed(1)}`).join(' ');
    const boyArea = `${padL},${cy} ${boyAvg} ${x(n - 1).toFixed(1)},${cy}`;
    const girlArea = `${padL},${cy} ${girlAvg} ${x(n - 1).toFixed(1)},${cy}`;

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" class="pipe-svg" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>
      <linearGradient id="boyGradD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4dc9ff" stop-opacity="0.28"/><stop offset="100%" stop-color="#4dc9ff" stop-opacity="0.04"/></linearGradient>
      <linearGradient id="girlGradD" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#ff7eb3" stop-opacity="0.28"/><stop offset="100%" stop-color="#ff7eb3" stop-opacity="0.04"/></linearGradient>
    </defs>`;
    // strength guides
    [0.5, 1].forEach((f) => {
      const yu = cy - f * maxAmp, yd = cy + f * maxAmp;
      svg += `<line x1="${padL}" y1="${yu.toFixed(1)}" x2="${padL + plotW}" y2="${yu.toFixed(1)}" stroke="#2a3060" stroke-width="0.5" stroke-dasharray="3 4"/>`;
      svg += `<line x1="${padL}" y1="${yd.toFixed(1)}" x2="${padL + plotW}" y2="${yd.toFixed(1)}" stroke="#2a3060" stroke-width="0.5" stroke-dasharray="3 4"/>`;
    });
    // year gridlines + labels
    const baseYear = series[0].year, years = Math.round(totalM / 12), stepY = years > 12 ? 2 : 1;
    for (let yr = 0; yr <= years; yr += stepY) {
      const xm = xOfM(yr * 12);
      svg += `<line x1="${xm.toFixed(1)}" y1="${padT}" x2="${xm.toFixed(1)}" y2="${padT + plotH}" stroke="#222845" stroke-width="0.5"/>`;
      svg += `<text x="${xm.toFixed(1)}" y="${(padT + plotH + 18).toFixed(1)}" text-anchor="middle" class="pipe-axis">${baseYear + yr}</text>`;
      svg += `<text x="${xm.toFixed(1)}" y="${(padT + plotH + 32).toFixed(1)}" text-anchor="middle" class="pipe-axis-sub">+${yr}y</text>`;
    }
    // fills
    svg += `<polygon points="${boyArea}" fill="url(#boyGradD)"/>`;
    svg += `<polygon points="${girlArea}" fill="url(#girlGradD)"/>`;
    // lines (Parāśara first, then KP on top)
    svg += `<polyline points="${line('boyPar', 'up')}" fill="none" stroke="${PARc}" stroke-width="2" stroke-linejoin="round"/>`;
    svg += `<polyline points="${line('boyKP', 'up')}" fill="none" stroke="${KPc}" stroke-width="2" stroke-linejoin="round"/>`;
    svg += `<polyline points="${line('girlPar', 'down')}" fill="none" stroke="${PARc}" stroke-width="2" stroke-linejoin="round"/>`;
    svg += `<polyline points="${line('girlKP', 'down')}" fill="none" stroke="${KPc}" stroke-width="2" stroke-linejoin="round"/>`;
    // centre time line
    svg += `<line x1="${padL}" y1="${cy}" x2="${padL + plotW}" y2="${cy}" stroke="#e7e9ee" stroke-width="1.5"/>`;
    // separation/divorce/widowhood trigger windows (red) on the centre line
    let runStart = null;
    for (let i = 0; i < n; i++) {
      const hot = series[i].sepTrig || (((series[i].sepBoy || 0) + (series[i].sepGirl || 0)) / 2 > 1.2);
      if (hot && runStart === null) runStart = i;
      if ((!hot || i === n - 1) && runStart !== null) {
        const x1 = x(runStart), x2 = x(hot ? i : i - 1);
        svg += `<rect x="${x1.toFixed(1)}" y="${(cy - 3.5).toFixed(1)}" width="${Math.max(2.5, x2 - x1).toFixed(1)}" height="7" rx="2" fill="#ff4d4d" opacity="0.85"><title>Separation / divorce / widowhood trigger window</title></rect>`;
        runStart = null;
      }
    }
    // side labels
    svg += `<text x="${padL - 8}" y="${(padT + 12).toFixed(1)}" text-anchor="end" class="pipe-side boy-side">${boyName} ▲</text>`;
    svg += `<text x="${padL - 8}" y="${(padT + plotH).toFixed(1)}" text-anchor="end" class="pipe-side girl-side">${girlName} ▼</text>`;
    svg += `<text x="${padL - 8}" y="${(cy + 3).toFixed(1)}" text-anchor="end" class="pipe-axis-sub">weak</text>`;
    // in-graph legend
    svg += `<rect x="${padL + 4}" y="${padT - 4}" width="11" height="11" rx="2" fill="${KPc}"/><text x="${padL + 19}" y="${padT + 5}" class="pipe-axis">KP</text>`;
    svg += `<rect x="${padL + 52}" y="${padT - 4}" width="11" height="11" rx="2" fill="${PARc}"/><text x="${padL + 67}" y="${padT + 5}" class="pipe-axis">Parāśara</text>`;
    svg += `<rect x="${padL + 138}" y="${padT - 4}" width="11" height="11" rx="2" fill="#ff4d4d"/><text x="${padL + 153}" y="${padT + 5}" class="pipe-axis">Separation trigger</text>`;
    svg += '</svg>';
    return svg;
  }
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ChartDraw;

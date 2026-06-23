/* =============================================================================
 * astro-core.js  —  Astronomical & Vedic core engine
 * Marriage Matching Module
 *
 * Implements a self-contained planetary ephemeris (Paul Schlyter low-precision
 * method with major perturbation terms), Lahiri ayanamsa, sidereal conversion,
 * ascendant computation, and the core Vedic reference tables (rashis,
 * nakshatras, lords, koota attributes) and chart-building utilities including
 * KP nakshatra sub-lord (Vimshottari) subdivision.
 *
 * Accuracy: planetary longitudes ~1-2 arcmin, Moon ~2-5 arcmin. This is
 * "indicative" grade — excellent for nakshatra/rashi level work but cusp
 * boundaries can carry small error. See the Technical Manual tab.
 * ========================================================================== */

const Astro = (function () {
  'use strict';

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  /* ---------- angle helpers ---------- */
  const sin = (d) => Math.sin(d * DEG);
  const cos = (d) => Math.cos(d * DEG);
  const tan = (d) => Math.tan(d * DEG);
  const asin = (x) => Math.asin(x) * RAD;
  const atan2 = (y, x) => Math.atan2(y, x) * RAD;

  function norm360(x) {
    x = x % 360;
    return x < 0 ? x + 360 : x;
  }
  function norm180(x) {
    x = norm360(x);
    return x > 180 ? x - 360 : x;
  }

  /* ---------- Julian Day ---------- *
   * Accepts a JS Date treated as UTC instant.
   */
  function julianDay(year, month, day, hourUT) {
    // hourUT decimal hours
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    const jd =
      Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day +
      B -
      1524.5 +
      hourUT / 24;
    return jd;
  }

  // Schlyter day number: days since 2000 Jan 0.0 TT (= JD 2451543.5)
  function dayNumber(jd) {
    return jd - 2451543.5;
  }

  /* ---------- Lahiri ayanamsa ----------
   * Reference epoch J2000 (JD 2451545.0) Lahiri ~ 23.853°.
   * Precession rate ~ 50.2876"/yr = 0.0139688°/yr.
   */
  function lahiriAyanamsa(jd) {
    const t = (jd - 2451545.0) / 365.25; // years from J2000
    return 23.853 + 0.0139688 * t;
  }

  function obliquity(d) {
    return 23.4393 - 3.563e-7 * d; // degrees
  }

  /* =========================================================================
   * Planetary elements (Schlyter). d = day number.
   * Each returns geocentric ecliptic longitude (tropical), latitude, distance.
   * ====================================================================== */

  function solveE(M, e) {
    // M degrees, e eccentricity. Returns eccentric anomaly E in degrees.
    let E = M + e * RAD * sin(M) * (1 + e * cos(M));
    for (let i = 0; i < 8; i++) {
      const dE = (E - e * RAD * sin(E) - M) / (1 - e * cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-7) break;
    }
    return E;
  }

  function sunPos(d) {
    const w = 282.9404 + 4.70935e-5 * d;
    const e = 0.016709 - 1.151e-9 * d;
    const M = norm360(356.047 + 0.9856002585 * d);
    const E = solveE(M, e);
    const xv = cos(E) - e;
    const yv = Math.sqrt(1 - e * e) * sin(E);
    const v = atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    const lon = norm360(v + w);
    return { lon, lat: 0, r, Ms: M, ws: w, Ls: norm360(M + w) };
  }

  function planetElements(name, d) {
    switch (name) {
      case 'Moon':
        return {
          N: 125.1228 - 0.0529538083 * d,
          i: 5.1454,
          w: 318.0634 + 0.1643573223 * d,
          a: 60.2666,
          e: 0.0549,
          M: 115.3654 + 13.0649929509 * d,
        };
      case 'Mercury':
        return {
          N: 48.3313 + 3.24587e-5 * d,
          i: 7.0047 + 5.0e-8 * d,
          w: 29.1241 + 1.01444e-5 * d,
          a: 0.387098,
          e: 0.205635 + 5.59e-10 * d,
          M: 168.6562 + 4.0923344368 * d,
        };
      case 'Venus':
        return {
          N: 76.6799 + 2.4659e-5 * d,
          i: 3.3946 + 2.75e-8 * d,
          w: 54.891 + 1.38374e-5 * d,
          a: 0.72333,
          e: 0.006773 - 1.302e-9 * d,
          M: 48.0052 + 1.6021302244 * d,
        };
      case 'Mars':
        return {
          N: 49.5574 + 2.11081e-5 * d,
          i: 1.8497 - 1.78e-8 * d,
          w: 286.5016 + 2.92961e-5 * d,
          a: 1.523688,
          e: 0.093405 + 2.516e-9 * d,
          M: 18.6021 + 0.5240207766 * d,
        };
      case 'Jupiter':
        return {
          N: 100.4542 + 2.76854e-5 * d,
          i: 1.303 - 1.557e-7 * d,
          w: 273.8777 + 1.64505e-5 * d,
          a: 5.20256,
          e: 0.048498 + 4.469e-9 * d,
          M: 19.895 + 0.0830853001 * d,
        };
      case 'Saturn':
        return {
          N: 113.6634 + 2.3898e-5 * d,
          i: 2.4886 - 1.081e-7 * d,
          w: 339.3939 + 2.97661e-5 * d,
          a: 9.55475,
          e: 0.055546 - 9.499e-9 * d,
          M: 316.967 + 0.0334442282 * d,
        };
      default:
        throw new Error('unknown planet ' + name);
    }
  }

  function heliocentric(el) {
    const M = norm360(el.M);
    const E = solveE(M, el.e);
    const xv = el.a * (cos(E) - el.e);
    const yv = el.a * (Math.sqrt(1 - el.e * el.e) * sin(E));
    const v = atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    const vw = v + el.w;
    const xh = r * (cos(el.N) * cos(vw) - sin(el.N) * sin(vw) * cos(el.i));
    const yh = r * (sin(el.N) * cos(vw) + cos(el.N) * sin(vw) * cos(el.i));
    const zh = r * (sin(vw) * sin(el.i));
    return { xh, yh, zh, r, v, M, vw };
  }

  function moonPos(d) {
    const el = planetElements('Moon', d);
    const h = heliocentric(el);
    let lon = atan2(h.yh, h.xh);
    let lat = atan2(h.zh, Math.sqrt(h.xh * h.xh + h.yh * h.yh));

    // perturbations
    const sun = sunPos(d);
    const Ms = sun.Ms;
    const Mm = norm360(el.M);
    const Nm = el.N;
    const ws = sun.ws;
    const Lm = norm360(Nm + el.w + Mm); // Moon mean longitude
    const Ls = norm360(Ms + ws); // Sun mean longitude
    const D = norm360(Lm - Ls); // mean elongation
    const F = norm360(Lm - Nm); // argument of latitude

    lon +=
      -1.274 * sin(Mm - 2 * D) +
      0.658 * sin(2 * D) -
      0.186 * sin(Ms) -
      0.059 * sin(2 * Mm - 2 * D) -
      0.057 * sin(Mm - 2 * D + Ms) +
      0.053 * sin(Mm + 2 * D) +
      0.046 * sin(2 * D - Ms) +
      0.041 * sin(Mm - Ms) -
      0.035 * sin(D) -
      0.031 * sin(Mm + Ms) -
      0.015 * sin(2 * F - 2 * D) +
      0.011 * sin(Mm - 4 * D);
    lat +=
      -0.173 * sin(F - 2 * D) -
      0.055 * sin(Mm - F - 2 * D) -
      0.046 * sin(Mm + F - 2 * D) +
      0.033 * sin(F + 2 * D) +
      0.017 * sin(2 * Mm + F);

    return { lon: norm360(lon), lat, r: h.r };
  }

  function outerPlanetPos(name, d) {
    const el = planetElements(name, d);
    const h = heliocentric(el);
    const sun = sunPos(d);
    const xs = sun.r * cos(sun.lon);
    const ys = sun.r * sin(sun.lon);
    const xg = h.xh + xs;
    const yg = h.yh + ys;
    const zg = h.zh;
    let lon = atan2(yg, xg);
    const lat = atan2(zg, Math.sqrt(xg * xg + yg * yg));

    // Jupiter & Saturn mutual perturbations (longitude, degrees)
    if (name === 'Jupiter' || name === 'Saturn') {
      const Mj = norm360(planetElements('Jupiter', d).M);
      const Msa = norm360(planetElements('Saturn', d).M);
      if (name === 'Jupiter') {
        lon +=
          -0.332 * sin(2 * Mj - 5 * Msa - 67.6) -
          0.056 * sin(2 * Mj - 2 * Msa + 21) +
          0.042 * sin(3 * Mj - 5 * Msa + 21) -
          0.036 * sin(Mj - 2 * Msa) +
          0.022 * cos(Mj - Msa) +
          0.023 * sin(2 * Mj - 3 * Msa + 52) -
          0.016 * sin(Mj - 5 * Msa - 69);
      } else {
        lon +=
          0.812 * sin(2 * Mj - 5 * Msa - 67.6) -
          0.229 * cos(2 * Mj - 4 * Msa - 2) +
          0.119 * sin(Mj - 2 * Msa - 3) +
          0.046 * sin(2 * Mj - 6 * Msa - 69) +
          0.014 * sin(Mj - 3 * Msa + 32);
      }
    }
    return { lon: norm360(lon), lat, r: h.r };
  }

  // Mean lunar node (Rahu), retrograde
  function rahuPos(d) {
    const N = 125.1228 - 0.0529538083 * d;
    return { lon: norm360(N), lat: 0, r: 0 };
  }

  /* Tropical geocentric longitude for a body at day number d */
  function tropicalLon(body, d) {
    switch (body) {
      case 'Sun':
        return sunPos(d).lon;
      case 'Moon':
        return moonPos(d).lon;
      case 'Rahu':
        return rahuPos(d).lon;
      case 'Ketu':
        return norm360(rahuPos(d).lon + 180);
      default:
        return outerPlanetPos(body, d).lon;
    }
  }

  /* =========================================================================
   * Ascendant (tropical) from JD(UT), geographic lat & east-longitude.
   * ====================================================================== */
  function gmst(jd) {
    const d = jd - 2451545.0;
    const T = d / 36525;
    let g =
      280.46061837 +
      360.98564736629 * d +
      0.000387933 * T * T -
      (T * T * T) / 38710000;
    return norm360(g);
  }

  function ascendantTropical(jd, latDeg, lonEastDeg) {
    const ramc = norm360(gmst(jd) + lonEastDeg); // local sidereal time in deg
    const eps = obliquity(dayNumber(jd));
    const ramcR = ramc * DEG;
    const epsR = eps * DEG;
    const latR = latDeg * DEG;
    let asc =
      Math.atan2(
        Math.cos(ramcR),
        -(Math.sin(ramcR) * Math.cos(epsR) + Math.tan(latR) * Math.sin(epsR))
      ) * RAD;
    return norm360(asc);
  }

  // Placidus-like intermediate cusps would be heavy; KP commonly uses Placidus.
  // We provide MC and a Porphyry house system for cusp longitudes (good enough
  // for sub-lord cusp work at the indicative level). Returns 12 cusp longitudes
  // (tropical).
  function porphyryCusps(jd, latDeg, lonEastDeg) {
    const asc = ascendantTropical(jd, latDeg, lonEastDeg);
    const ramc = norm360(gmst(jd) + lonEastDeg);
    const eps = obliquity(dayNumber(jd));
    // MC: ecliptic longitude where RA = RAMC
    let mc = atan2(sin(ramc), cos(ramc) * cos(eps));
    mc = norm360(mc);
    // ensure mc is in the 10th-from-asc hemisphere
    const cusps = new Array(12).fill(0);
    cusps[0] = asc; // 1st
    cusps[9] = mc; // 10th
    cusps[6] = norm360(asc + 180); // 7th
    cusps[3] = norm360(mc + 180); // 4th
    // Porphyry: trisect the arcs
    const arc1 = norm360(cusps[9] - cusps[6]); // from 7th to 10th (asc..mc quadrant arc)
    // quadrant from Asc(1) to MC(10) going backward... use standard porphyry:
    const q1 = norm360(cusps[3] - cusps[0]); // 1st to 4th
    const q2 = norm360(cusps[6] - cusps[3]); // 4th to 7th
    const q3 = norm360(cusps[9] - cusps[6]); // 7th to 10th
    const q4 = norm360(cusps[0] - cusps[9]); // 10th to 1st
    cusps[1] = norm360(cusps[0] + q1 / 3);
    cusps[2] = norm360(cusps[0] + (2 * q1) / 3);
    cusps[4] = norm360(cusps[3] + q2 / 3);
    cusps[5] = norm360(cusps[3] + (2 * q2) / 3);
    cusps[7] = norm360(cusps[6] + q3 / 3);
    cusps[8] = norm360(cusps[6] + (2 * q3) / 3);
    cusps[10] = norm360(cusps[9] + q4 / 3);
    cusps[11] = norm360(cusps[9] + (2 * q4) / 3);
    return { cusps, mc, asc };
  }

  /* =========================================================================
   * Vedic reference tables
   * ====================================================================== */

  const RASHIS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
  ];
  const RASHI_SK = [
    'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
    'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
  ];
  const RASHI_LORD = [
    'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
    'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
  ];
  // element: 0 fire,1 earth,2 air,3 water (by sign index)
  const RASHI_ELEMENT = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
  // quality 0 movable(chara),1 fixed(sthira),2 dual(dwiswabhava)
  const RASHI_QUALITY = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2];

  // 27 Nakshatras with attributes
  // lord = Vimshottari lord; yoni animal; gana; nadi; gender of yoni; varna (by group not used here)
  const NAK = [
    { name: 'Ashwini', lord: 'Ketu', yoni: 'Horse', yg: 'M', gana: 'Deva', nadi: 'Adi' },
    { name: 'Bharani', lord: 'Venus', yoni: 'Elephant', yg: 'M', gana: 'Manushya', nadi: 'Madhya' },
    { name: 'Krittika', lord: 'Sun', yoni: 'Sheep', yg: 'F', gana: 'Rakshasa', nadi: 'Antya' },
    { name: 'Rohini', lord: 'Moon', yoni: 'Serpent', yg: 'M', gana: 'Manushya', nadi: 'Antya' },
    { name: 'Mrigashira', lord: 'Mars', yoni: 'Serpent', yg: 'F', gana: 'Deva', nadi: 'Madhya' },
    { name: 'Ardra', lord: 'Rahu', yoni: 'Dog', yg: 'F', gana: 'Manushya', nadi: 'Adi' },
    { name: 'Punarvasu', lord: 'Jupiter', yoni: 'Cat', yg: 'F', gana: 'Deva', nadi: 'Adi' },
    { name: 'Pushya', lord: 'Saturn', yoni: 'Sheep', yg: 'M', gana: 'Deva', nadi: 'Madhya' },
    { name: 'Ashlesha', lord: 'Mercury', yoni: 'Cat', yg: 'M', gana: 'Rakshasa', nadi: 'Antya' },
    { name: 'Magha', lord: 'Ketu', yoni: 'Rat', yg: 'M', gana: 'Rakshasa', nadi: 'Antya' },
    { name: 'Purva Phalguni', lord: 'Venus', yoni: 'Rat', yg: 'F', gana: 'Manushya', nadi: 'Madhya' },
    { name: 'Uttara Phalguni', lord: 'Sun', yoni: 'Cow', yg: 'M', gana: 'Manushya', nadi: 'Adi' },
    { name: 'Hasta', lord: 'Moon', yoni: 'Buffalo', yg: 'F', gana: 'Deva', nadi: 'Adi' },
    { name: 'Chitra', lord: 'Mars', yoni: 'Tiger', yg: 'F', gana: 'Rakshasa', nadi: 'Madhya' },
    { name: 'Swati', lord: 'Rahu', yoni: 'Buffalo', yg: 'M', gana: 'Deva', nadi: 'Antya' },
    { name: 'Vishakha', lord: 'Jupiter', yoni: 'Tiger', yg: 'M', gana: 'Rakshasa', nadi: 'Antya' },
    { name: 'Anuradha', lord: 'Saturn', yoni: 'Deer', yg: 'F', gana: 'Deva', nadi: 'Madhya' },
    { name: 'Jyeshtha', lord: 'Mercury', yoni: 'Deer', yg: 'M', gana: 'Rakshasa', nadi: 'Adi' },
    { name: 'Mula', lord: 'Ketu', yoni: 'Dog', yg: 'M', gana: 'Rakshasa', nadi: 'Adi' },
    { name: 'Purva Ashadha', lord: 'Venus', yoni: 'Monkey', yg: 'M', gana: 'Manushya', nadi: 'Madhya' },
    { name: 'Uttara Ashadha', lord: 'Sun', yoni: 'Mongoose', yg: 'M', gana: 'Manushya', nadi: 'Antya' },
    { name: 'Shravana', lord: 'Moon', yoni: 'Monkey', yg: 'F', gana: 'Deva', nadi: 'Antya' },
    { name: 'Dhanishta', lord: 'Mars', yoni: 'Lion', yg: 'F', gana: 'Rakshasa', nadi: 'Madhya' },
    { name: 'Shatabhisha', lord: 'Rahu', yoni: 'Horse', yg: 'F', gana: 'Rakshasa', nadi: 'Adi' },
    { name: 'Purva Bhadrapada', lord: 'Jupiter', yoni: 'Lion', yg: 'M', gana: 'Manushya', nadi: 'Adi' },
    { name: 'Uttara Bhadrapada', lord: 'Saturn', yoni: 'Cow', yg: 'F', gana: 'Manushya', nadi: 'Madhya' },
    { name: 'Revati', lord: 'Mercury', yoni: 'Elephant', yg: 'F', gana: 'Deva', nadi: 'Antya' },
  ];

  // Vimshottari dasha years
  const DASHA_YEARS = {
    Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
    Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
  };
  const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];

  const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const PLANET_SYM = {
    Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
    Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke', Ascendant: 'As',
  };

  // Natural friendship: friend/neutral/enemy
  const FRIENDSHIP = {
    Sun: { friend: ['Moon', 'Mars', 'Jupiter'], enemy: ['Venus', 'Saturn'], neutral: ['Mercury'] },
    Moon: { friend: ['Sun', 'Mercury'], enemy: [], neutral: ['Mars', 'Jupiter', 'Venus', 'Saturn'] },
    Mars: { friend: ['Sun', 'Moon', 'Jupiter'], enemy: ['Mercury'], neutral: ['Venus', 'Saturn'] },
    Mercury: { friend: ['Sun', 'Venus'], enemy: ['Moon'], neutral: ['Mars', 'Jupiter', 'Saturn'] },
    Jupiter: { friend: ['Sun', 'Moon', 'Mars'], enemy: ['Mercury', 'Venus'], neutral: ['Saturn'] },
    Venus: { friend: ['Mercury', 'Saturn'], enemy: ['Sun', 'Moon'], neutral: ['Mars', 'Jupiter'] },
    Saturn: { friend: ['Mercury', 'Venus'], enemy: ['Sun', 'Moon', 'Mars'], neutral: ['Jupiter'] },
    Rahu: { friend: ['Venus', 'Saturn', 'Mercury'], enemy: ['Sun', 'Moon', 'Mars'], neutral: ['Jupiter'] },
    Ketu: { friend: ['Mars', 'Venus', 'Saturn'], enemy: ['Sun', 'Moon'], neutral: ['Mercury', 'Jupiter'] },
  };

  function relation(a, b) {
    if (a === b) return 'self';
    const f = FRIENDSHIP[a];
    if (!f) return 'neutral';
    if (f.friend.includes(b)) return 'friend';
    if (f.enemy.includes(b)) return 'enemy';
    return 'neutral';
  }

  // exaltation/debilitation (sign index of deep exaltation)
  const EXALT = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 1, Ketu: 7 };
  const DEBIL = { Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0, Rahu: 7, Ketu: 1 };
  // own signs
  const OWN = {
    Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11],
    Venus: [1, 6], Saturn: [9, 10], Rahu: [], Ketu: [],
  };

  // graha aspects (special): Mars 4,7,8 ; Jupiter 5,7,9 ; Saturn 3,7,10 ; rest 7
  function aspectsHouses(planet) {
    switch (planet) {
      case 'Mars': return [4, 7, 8];
      case 'Jupiter': return [5, 7, 9];
      case 'Saturn': return [3, 7, 10];
      case 'Rahu':
      case 'Ketu': return [5, 7, 9]; // commonly used Rahu/Ketu aspects
      default: return [7];
    }
  }

  /* =========================================================================
   * KP: nakshatra sub-lord (Vimshottari subdivision)
   * Given sidereal longitude -> {nak index, nakLord, sub lord, subSub lord}
   * ====================================================================== */
  const NAK_SPAN = 360 / 27; // 13.33333

  function vimshottariStartIndex(lord) {
    return DASHA_ORDER.indexOf(lord);
  }

  function subLordChain(sidLon) {
    const nakIdx = Math.floor(sidLon / NAK_SPAN) % 27;
    const nak = NAK[nakIdx];
    const into = sidLon - nakIdx * NAK_SPAN; // 0..13.333
    // sub division: start at nak lord, proportions = dashaYears/120 * NAK_SPAN
    let start = vimshottariStartIndex(nak.lord);
    let acc = 0;
    let subLord = nak.lord;
    let subStart = 0;
    let subSpan = 0;
    for (let k = 0; k < 9; k++) {
      const lord = DASHA_ORDER[(start + k) % 9];
      const span = (DASHA_YEARS[lord] / 120) * NAK_SPAN;
      if (into < acc + span || k === 8) {
        subLord = lord;
        subStart = acc;
        subSpan = span;
        break;
      }
      acc += span;
    }
    // sub-sub
    const intoSub = into - subStart;
    let s2 = vimshottariStartIndex(subLord);
    let acc2 = 0;
    let subSub = subLord;
    for (let k = 0; k < 9; k++) {
      const lord = DASHA_ORDER[(s2 + k) % 9];
      const span = (DASHA_YEARS[lord] / 120) * subSpan;
      if (intoSub < acc2 + span || k === 8) {
        subSub = lord;
        break;
      }
      acc2 += span;
    }
    return { nakIdx, nak: nak.name, nakLord: nak.lord, subLord, subSubLord: subSub };
  }

  /* =========================================================================
   * Build a full chart
   * input: {y,m,d,hour,min,sec, tzOffsetHours, lat, lonEast}
   * Local time -> UT by subtracting tz offset (east positive).
   * ====================================================================== */
  function buildChart(input) {
    const hourLocal = input.hour + input.min / 60 + (input.sec || 0) / 3600;
    const hourUT = hourLocal - input.tzOffsetHours;
    // handle day rollover via JD which accepts fractional/negative hours fine
    const jd = julianDay(input.y, input.m, input.d, hourUT);
    const d = dayNumber(jd);
    const ayan = lahiriAyanamsa(jd);

    const planets = {};
    PLANETS.forEach((p) => {
      const tlon = tropicalLon(p, d);
      const tlonNext = tropicalLon(p, d + 1);
      let sid = norm360(tlon - ayan);
      let speed = norm180(tlonNext - tlon); // deg/day
      let retro = false;
      if (p === 'Rahu' || p === 'Ketu') retro = true; // mean node retrograde
      else if (p !== 'Sun' && p !== 'Moon') retro = speed < 0;
      const sign = Math.floor(sid / 30);
      const degInSign = sid - sign * 30;
      const chain = subLordChain(sid);
      const nakIdx = chain.nakIdx;
      const pada = Math.floor((sid - nakIdx * NAK_SPAN) / (NAK_SPAN / 4)) + 1;
      planets[p] = {
        name: p,
        lon: sid,
        tropical: tlon,
        sign,
        signName: RASHIS[sign],
        degInSign,
        retro,
        speed,
        nakIdx,
        nak: NAK[nakIdx].name,
        nakLord: NAK[nakIdx].lord,
        pada,
        subLord: chain.subLord,
        subSubLord: chain.subSubLord,
      };
    });

    // Ascendant
    const ascT = ascendantTropical(jd, input.lat, input.lonEast);
    const ascSid = norm360(ascT - ayan);
    const ascSign = Math.floor(ascSid / 30);
    const ascChain = subLordChain(ascSid);
    const ascNak = ascChain.nakIdx;
    const ascendant = {
      name: 'Ascendant',
      lon: ascSid,
      tropical: ascT,
      sign: ascSign,
      signName: RASHIS[ascSign],
      degInSign: ascSid - ascSign * 30,
      nakIdx: ascNak,
      nak: NAK[ascNak].name,
      nakLord: NAK[ascNak].lord,
      pada: Math.floor((ascSid - ascNak * NAK_SPAN) / (NAK_SPAN / 4)) + 1,
      subLord: ascChain.subLord,
      subSubLord: ascChain.subSubLord,
    };

    // House assignment (Whole Sign from ascendant sign) — primary BPHS frame
    PLANETS.forEach((p) => {
      planets[p].house = ((planets[p].sign - ascSign + 12) % 12) + 1;
    });

    // KP cusps (Porphyry approximation)
    const cuspData = porphyryCusps(jd, input.lat, input.lonEast);
    const cusps = cuspData.cusps.map((c, idx) => {
      const sid = norm360(c - ayan);
      const sign = Math.floor(sid / 30);
      const chain = subLordChain(sid);
      return {
        house: idx + 1,
        lon: sid,
        sign,
        signName: RASHIS[sign],
        degInSign: sid - sign * 30,
        nak: chain.nak,
        nakLord: chain.nakLord,
        subLord: chain.subLord,
        subSubLord: chain.subSubLord,
      };
    });

    // KP house placement of planets by cusp ranges
    function houseFromCusps(sid) {
      for (let h = 0; h < 12; h++) {
        const start = cusps[h].lon;
        const end = cusps[(h + 1) % 12].lon;
        let span = norm360(end - start);
        let off = norm360(sid - start);
        if (off < span) return h + 1;
      }
      return 1;
    }
    PLANETS.forEach((p) => {
      planets[p].kpHouse = houseFromCusps(planets[p].lon);
    });

    return {
      input,
      jd,
      ayanamsa: ayan,
      planets,
      ascendant,
      cusps,
      mc: cuspData.mc,
      moonNakIdx: planets.Moon.nakIdx,
      moonSign: planets.Moon.sign,
    };
  }

  return {
    DEG, RAD, sin, cos, tan, norm360, norm180,
    julianDay, dayNumber, lahiriAyanamsa, obliquity,
    tropicalLon, sunPos, moonPos, outerPlanetPos, rahuPos,
    ascendantTropical, gmst, porphyryCusps,
    buildChart, subLordChain,
    RASHIS, RASHI_SK, RASHI_LORD, RASHI_ELEMENT, RASHI_QUALITY,
    NAK, NAK_SPAN, DASHA_YEARS, DASHA_ORDER, PLANETS, PLANET_SYM,
    FRIENDSHIP, relation, EXALT, DEBIL, OWN, aspectsHouses,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Astro;

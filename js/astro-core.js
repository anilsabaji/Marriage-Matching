/**
 * AstroCore - Core Astronomical Calculation Engine
 * Implements simplified astronomical algorithms for Vedic Astrology
 */
const AstroCore = (function() {
    'use strict';

    // ===== Constants =====
    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;
    const J2000 = 2451545.0; // Julian Day for J2000.0 epoch (Jan 1, 2000 12:00 TT)

    // 27 Nakshatras with their spans (each 13d 20m = 13.3333 degrees)
    const NAKSHATRAS = [
        'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
        'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
        'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
        'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha',
        'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
        'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
    ];

    // 12 Rashis (Zodiac Signs)
    const RASHIS = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];

    // Rashi Lords
    const RASHI_LORDS = [
        'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
        'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'
    ];

    // Nakshatra Lords (Vimshottari Dasha sequence)
    const NAKSHATRA_LORDS = [
        'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
        'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
        'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'
    ];

    // Vimshottari Dasha periods in years
    const DASHA_YEARS = {
        'Ketu': 7, 'Venus': 20, 'Sun': 6, 'Moon': 10, 'Mars': 7,
        'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17
    };

    // Dasha sequence
    const DASHA_SEQUENCE = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];

    // ===== Julian Day Calculation =====
    function dateToJD(year, month, day, hour, minute, second, tzOffset) {
        // Convert local time to UT
        var totalHours = hour + minute / 60.0 + second / 3600.0 - tzOffset;
        var dayFraction = totalHours / 24.0;

        // Adjust date if time conversion crosses day boundary
        var adjDay = day + dayFraction;

        if (month <= 2) {
            year -= 1;
            month += 12;
        }

        var A = Math.floor(year / 100);
        var B = 2 - A + Math.floor(A / 4);

        var JD = Math.floor(365.25 * (year + 4716)) +
                 Math.floor(30.6001 * (month + 1)) +
                 adjDay + B - 1524.5;

        return JD;
    }

    function jdToDate(jd) {
        var z = Math.floor(jd + 0.5);
        var f = jd + 0.5 - z;
        var A;
        if (z < 2299161) {
            A = z;
        } else {
            var alpha = Math.floor((z - 1867216.25) / 36524.25);
            A = z + 1 + alpha - Math.floor(alpha / 4);
        }
        var B = A + 1524;
        var C = Math.floor((B - 122.1) / 365.25);
        var D = Math.floor(365.25 * C);
        var E = Math.floor((B - D) / 30.6001);

        var day = B - D - Math.floor(30.6001 * E) + f;
        var month = (E < 14) ? E - 1 : E - 13;
        var year = (month > 2) ? C - 4716 : C - 4715;

        var dayInt = Math.floor(day);
        var remainder = (day - dayInt) * 24;
        var hour = Math.floor(remainder);
        var min = Math.floor((remainder - hour) * 60);

        return { year: year, month: month, day: dayInt, hour: hour, minute: min };
    }

    // ===== Ayanamsa Calculation (Lahiri/Chitrapaksha) =====
    function calculateAyanamsa(jd) {
        // Lahiri Ayanamsa: based on the position of the vernal equinox relative to the
        // fixed star Spica (Chitra). Approximation formula.
        var T = (jd - J2000) / 36525.0; // Julian centuries from J2000
        // Lahiri ayanamsa approximation
        var ayanamsa = 23.856111 + 0.0137222 * (T * 100 + 0.0);
        // More refined: based on IAU precession
        ayanamsa = 23.85 + (50.27 / 3600) * ((jd - 2451545.0) / 365.25);
        return ayanamsa;
    }

    // ===== Normalize angle to 0-360 =====
    function normalize(degrees) {
        var result = degrees % 360;
        if (result < 0) result += 360;
        return result;
    }

    // ===== Planetary Position Calculations =====
    // Simplified orbital elements for planets at J2000.0 with rates per century

    var planetElements = {
        Sun: {
            L0: 280.46646, L1: 36000.76983,
            M0: 357.52911, M1: 35999.05029,
            e0: 0.016708634, e1: -0.000042037,
            w0: 282.93735, w1: 1.7195
        },
        Moon: {
            L0: 218.3165, L1: 481267.8813,
            M0: 134.9634, M1: 477198.8676,
            D0: 297.8502, D1: 445267.1115,
            F0: 93.2720, F1: 483202.0175
        },
        Mars: {
            L0: 355.433, L1: 19140.2993,
            a: 1.523679, e0: 0.093405, e1: 0.000090,
            I0: 1.849726, I1: -0.000601,
            w0: 336.060, w1: 1.0841,
            N0: 49.558, N1: 0.7720,
            M0: 19.373, M1: 19139.8585
        },
        Mercury: {
            L0: 252.251, L1: 149472.6746,
            a: 0.387098, e0: 0.205635, e1: -0.000023,
            I0: 7.004986, I1: 0.001882,
            w0: 29.125, w1: 1.7528,
            N0: 48.331, N1: 1.1862,
            M0: 174.795, M1: 149472.5153
        },
        Jupiter: {
            L0: 34.351, L1: 3034.9057,
            a: 5.202561, e0: 0.048498, e1: 0.000163,
            I0: 1.303267, I1: -0.001979,
            w0: 14.331, w1: 1.6126,
            N0: 100.464, N1: 1.0210,
            M0: 20.020, M1: 3033.6879
        },
        Venus: {
            L0: 181.979, L1: 58517.8157,
            a: 0.723330, e0: 0.006773, e1: -0.000048,
            I0: 3.394676, I1: 0.001010,
            w0: 55.186, w1: 1.3972,
            N0: 76.680, N1: 0.9011,
            M0: 50.416, M1: 58517.8039
        },
        Saturn: {
            L0: 50.077, L1: 1222.1138,
            a: 9.554747, e0: 0.055546, e1: -0.000346,
            I0: 2.488879, I1: 0.002564,
            w0: 93.057, w1: 1.9638,
            N0: 113.665, N1: 0.8770,
            M0: 317.021, M1: 1221.5515
        }
    };

    function calculateSunLongitude(jd) {
        var T = (jd - J2000) / 36525.0;
        var el = planetElements.Sun;

        var L = normalize(el.L0 + el.L1 * T);
        var M = normalize(el.M0 + el.M1 * T);
        var e = el.e0 + el.e1 * T;

        // Equation of center
        var Mrad = M * DEG_TO_RAD;
        var C = (1.9146 - 0.004817 * T) * Math.sin(Mrad)
              + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
              + 0.00029 * Math.sin(3 * Mrad);

        var sunLong = normalize(L + C);
        return sunLong;
    }

    function calculateMoonLongitude(jd) {
        var T = (jd - J2000) / 36525.0;
        var el = planetElements.Moon;

        var Lp = normalize(el.L0 + el.L1 * T);
        var M = normalize(el.M0 + el.M1 * T) * DEG_TO_RAD;
        var D = normalize(el.D0 + el.D1 * T) * DEG_TO_RAD;
        var F = normalize(el.F0 + el.F1 * T) * DEG_TO_RAD;
        var Ms = normalize(planetElements.Sun.M0 + planetElements.Sun.M1 * T) * DEG_TO_RAD;

        // Principal perturbations
        var dL = 6.289 * Math.sin(M)
                + 1.274 * Math.sin(2 * D - M)
                + 0.658 * Math.sin(2 * D)
                + 0.214 * Math.sin(2 * M)
                - 0.186 * Math.sin(Ms)
                - 0.114 * Math.sin(2 * F)
                + 0.059 * Math.sin(2 * D - 2 * M)
                + 0.057 * Math.sin(2 * D - Ms - M)
                + 0.053 * Math.sin(2 * D + M)
                + 0.046 * Math.sin(2 * D - Ms)
                - 0.041 * Math.sin(Ms - M)
                - 0.035 * Math.sin(D)
                - 0.030 * Math.sin(Ms + M);

        var moonLong = normalize(Lp + dL);
        return moonLong;
    }

    function calculatePlanetLongitude(planet, jd) {
        if (planet === 'Sun') return calculateSunLongitude(jd);
        if (planet === 'Moon') return calculateMoonLongitude(jd);
        if (planet === 'Rahu' || planet === 'Ketu') return calculateNodes(jd, planet);

        var T = (jd - J2000) / 36525.0;
        var el = planetElements[planet];
        if (!el) return 0;

        var M = normalize(el.M0 + el.M1 * T) * DEG_TO_RAD;
        var e = el.e0 + (el.e1 || 0) * T;

        // Solve Kepler's equation (iterative)
        var E = M;
        for (var i = 0; i < 10; i++) {
            E = M + e * Math.sin(E);
        }

        // True anomaly
        var v = 2 * Math.atan2(
            Math.sqrt(1 + e) * Math.sin(E / 2),
            Math.sqrt(1 - e) * Math.cos(E / 2)
        );

        // Heliocentric longitude (simplified)
        var w = normalize(el.w0 + el.w1 * T) * DEG_TO_RAD;
        var N = normalize(el.N0 + el.N1 * T) * DEG_TO_RAD;
        var I = (el.I0 + el.I1 * T) * DEG_TO_RAD;

        // Heliocentric ecliptic longitude
        var helioLong = v + w;

        // Convert to geocentric (simplified - adds Sun's longitude as approximation)
        // For a more accurate result, we would compute proper geometric transformations
        var sunLong = calculateSunLongitude(jd) * DEG_TO_RAD;

        var a = el.a;
        // Simplified geocentric longitude using elongation approximation
        var r = a * (1 - e * Math.cos(E)); // Distance from Sun in AU

        // Compute heliocentric rectangular coordinates
        var xh = r * (Math.cos(N) * Math.cos(helioLong) - Math.sin(N) * Math.sin(helioLong) * Math.cos(I));
        var yh = r * (Math.sin(N) * Math.cos(helioLong) + Math.cos(N) * Math.sin(helioLong) * Math.cos(I));

        // Sun's rectangular coordinates (Earth at origin)
        var Rs = 1.0; // Earth-Sun distance approximation
        var xs = Rs * Math.cos(sunLong);
        var ys = Rs * Math.sin(sunLong);

        // Geocentric rectangular
        var xg = xh + xs;
        var yg = yh + ys;

        // Geocentric ecliptic longitude
        var geoLong = normalize(Math.atan2(yg, xg) * RAD_TO_DEG);

        return geoLong;
    }

    function calculateNodes(jd, node) {
        // Mean lunar node (Rahu - ascending node)
        var T = (jd - J2000) / 36525.0;
        var rahu = normalize(125.0445 - 1934.1363 * T + 0.0021 * T * T);
        if (node === 'Rahu') return rahu;
        return normalize(rahu + 180); // Ketu is opposite
    }

    // ===== Calculate all planetary positions =====
    function calculateAllPlanets(jd) {
        var planets = {};
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        var ayanamsa = calculateAyanamsa(jd);

        planetNames.forEach(function(name) {
            var tropical = calculatePlanetLongitude(name, jd);
            var sidereal = normalize(tropical - ayanamsa);
            var rashiIndex = Math.floor(sidereal / 30);
            var nakshatraIndex = Math.floor(sidereal / (360 / 27));
            var pada = Math.floor((sidereal % (360 / 27)) / (360 / 108)) + 1;
            var degInRashi = sidereal % 30;

            planets[name] = {
                tropical: tropical,
                sidereal: sidereal,
                rashi: RASHIS[rashiIndex],
                rashiIndex: rashiIndex,
                rashiLord: RASHI_LORDS[rashiIndex],
                nakshatra: NAKSHATRAS[nakshatraIndex],
                nakshatraIndex: nakshatraIndex,
                nakshatraLord: NAKSHATRA_LORDS[nakshatraIndex],
                pada: pada,
                degreeInRashi: degInRashi,
                isRetrograde: false // Simplified - would need velocity calc for accuracy
            };
        });

        return planets;
    }

    // ===== House/Bhava Cusp Calculation (Placidus) =====
    function calculateHouseCusps(jd, latitude, longitude) {
        var T = (jd - J2000) / 36525.0;

        // Calculate Local Sidereal Time
        var GMST = normalize(280.46061837 + 360.98564736629 * (jd - J2000)
                           + 0.000387933 * T * T);
        var LST = normalize(GMST + longitude);

        var ayanamsa = calculateAyanamsa(jd);
        var latRad = latitude * DEG_TO_RAD;

        // Ascendant calculation
        var LSTrad = LST * DEG_TO_RAD;
        var obliquity = (23.4393 - 0.013 * T) * DEG_TO_RAD;

        var tanAsc = Math.cos(LSTrad) /
                     (-Math.sin(LSTrad) * Math.cos(obliquity) - Math.tan(latRad) * Math.sin(obliquity));
        var asc = Math.atan(tanAsc) * RAD_TO_DEG;

        // Adjust quadrant
        if (Math.cos(LSTrad) < 0) asc += 180;
        if (asc < 0) asc += 360;
        asc = normalize(asc);

        // MC (Midheaven)
        var MC = Math.atan2(Math.sin(LSTrad), Math.cos(LSTrad) * Math.cos(obliquity)) * RAD_TO_DEG;
        MC = normalize(MC);

        // Sidereal ascendant and MC
        var sidAsc = normalize(asc - ayanamsa);
        var sidMC = normalize(MC - ayanamsa);

        // Simplified Placidus houses (equal division for intermediate cusps)
        // Full Placidus requires iterative solution; using semi-arc method approximation
        var cusps = [];
        cusps[0] = sidAsc; // 1st house (Ascendant)

        // Approximate intermediate cusps using trisection of semi-arcs
        // For simplicity, use equal house system as base with Placidus-like adjustments
        for (var i = 1; i < 12; i++) {
            if (i === 9) {
                cusps[i] = sidMC; // 10th house = MC
            } else if (i === 3) {
                cusps[i] = normalize(sidMC + 180); // IC (4th house)
            } else if (i === 6) {
                cusps[i] = normalize(sidAsc + 180); // 7th house (Descendant)
            } else {
                cusps[i] = normalize(sidAsc + (i * 30));
            }
        }

        // Sort houses properly
        var houses = [];
        for (var h = 0; h < 12; h++) {
            var cuspDeg = cusps[h];
            var rashiIdx = Math.floor(cuspDeg / 30);
            houses.push({
                house: h + 1,
                cusp: cuspDeg,
                rashi: RASHIS[rashiIdx],
                rashiIndex: rashiIdx,
                lord: RASHI_LORDS[rashiIdx]
            });
        }

        return {
            ascendant: sidAsc,
            mc: sidMC,
            houses: houses,
            lst: LST
        };
    }

    // ===== Determine which house a planet occupies =====
    function getPlanetHouse(planetDeg, houses) {
        for (var i = 0; i < 12; i++) {
            var start = houses[i].cusp;
            var end = (i < 11) ? houses[i + 1].cusp : houses[0].cusp;

            if (end < start) { // Wraps around 360
                if (planetDeg >= start || planetDeg < end) return i + 1;
            } else {
                if (planetDeg >= start && planetDeg < end) return i + 1;
            }
        }
        return 1; // Default to 1st house
    }

    // ===== Calculate Full Chart =====
    function calculateChart(year, month, day, hour, minute, second, latitude, longitude, timezone) {
        var jd = dateToJD(year, month, day, hour, minute, second, timezone);
        var ayanamsa = calculateAyanamsa(jd);
        var planets = calculateAllPlanets(jd);
        var houseCusps = calculateHouseCusps(jd, latitude, longitude);

        // Assign houses to planets
        var planetNames = Object.keys(planets);
        planetNames.forEach(function(name) {
            planets[name].house = getPlanetHouse(planets[name].sidereal, houseCusps.houses);
        });

        return {
            jd: jd,
            ayanamsa: ayanamsa,
            planets: planets,
            houses: houseCusps,
            birthData: {
                year: year, month: month, day: day,
                hour: hour, minute: minute, second: second,
                latitude: latitude, longitude: longitude, timezone: timezone
            }
        };
    }

    // ===== Vimshottari Dasha Calculation =====
    function calculateDasha(moonLongitude, birthJD) {
        var nakshatraSpan = 360 / 27;
        var nakshatraIndex = Math.floor(moonLongitude / nakshatraSpan);
        var posInNakshatra = moonLongitude % nakshatraSpan;
        var fractionElapsed = posInNakshatra / nakshatraSpan;

        var startLord = NAKSHATRA_LORDS[nakshatraIndex];
        var startIdx = DASHA_SEQUENCE.indexOf(startLord);

        // Balance of first dasha
        var totalYears = DASHA_YEARS[startLord];
        var balanceYears = totalYears * (1 - fractionElapsed);

        var dashas = [];
        var currentJD = birthJD;

        for (var i = 0; i < 9; i++) {
            var idx = (startIdx + i) % 9;
            var lord = DASHA_SEQUENCE[idx];
            var years = (i === 0) ? balanceYears : DASHA_YEARS[lord];
            var endJD = currentJD + years * 365.25;

            var startDate = jdToDate(currentJD);
            var endDate = jdToDate(endJD);

            dashas.push({
                lord: lord,
                years: years,
                startJD: currentJD,
                endJD: endJD,
                startDate: startDate,
                endDate: endDate
            });

            currentJD = endJD;
        }

        return dashas;
    }

    // ===== Calculate Antardasha within a Dasha =====
    function calculateAntardasha(dasha) {
        var antardashas = [];
        var startIdx = DASHA_SEQUENCE.indexOf(dasha.lord);
        var totalDays = (dasha.endJD - dasha.startJD);
        var totalDashaYears = DASHA_YEARS[dasha.lord];
        var currentJD = dasha.startJD;

        for (var i = 0; i < 9; i++) {
            var idx = (startIdx + i) % 9;
            var lord = DASHA_SEQUENCE[idx];
            var proportion = DASHA_YEARS[lord] / 120; // Total cycle is 120 years
            var days = totalDays * proportion;
            var endJD = currentJD + days;

            antardashas.push({
                lord: lord,
                dashaLord: dasha.lord,
                startJD: currentJD,
                endJD: endJD,
                startDate: jdToDate(currentJD),
                endDate: jdToDate(endJD),
                days: days
            });

            currentJD = endJD;
        }

        return antardashas;
    }

    // ===== Calculate Pratyantardasha =====
    function calculatePratyantardasha(antardasha) {
        var pratyantar = [];
        var startIdx = DASHA_SEQUENCE.indexOf(antardasha.lord);
        var totalDays = antardasha.days;
        var currentJD = antardasha.startJD;

        for (var i = 0; i < 9; i++) {
            var idx = (startIdx + i) % 9;
            var lord = DASHA_SEQUENCE[idx];
            var proportion = DASHA_YEARS[lord] / 120;
            var days = totalDays * proportion;
            var endJD = currentJD + days;

            pratyantar.push({
                lord: lord,
                startJD: currentJD,
                endJD: endJD,
                startDate: jdToDate(currentJD),
                endDate: jdToDate(endJD),
                days: days
            });

            currentJD = endJD;
        }

        return pratyantar;
    }

    // ===== Public API =====
    return {
        // Constants
        NAKSHATRAS: NAKSHATRAS,
        RASHIS: RASHIS,
        RASHI_LORDS: RASHI_LORDS,
        NAKSHATRA_LORDS: NAKSHATRA_LORDS,
        DASHA_YEARS: DASHA_YEARS,
        DASHA_SEQUENCE: DASHA_SEQUENCE,

        // Core calculations
        dateToJD: dateToJD,
        jdToDate: jdToDate,
        calculateAyanamsa: calculateAyanamsa,
        calculateAllPlanets: calculateAllPlanets,
        calculateHouseCusps: calculateHouseCusps,
        calculateChart: calculateChart,
        calculateSunLongitude: calculateSunLongitude,
        calculateMoonLongitude: calculateMoonLongitude,
        calculatePlanetLongitude: calculatePlanetLongitude,

        // Dasha
        calculateDasha: calculateDasha,
        calculateAntardasha: calculateAntardasha,
        calculatePratyantardasha: calculatePratyantardasha,

        // Utilities
        normalize: normalize,
        getPlanetHouse: getPlanetHouse,
        DEG_TO_RAD: DEG_TO_RAD,
        RAD_TO_DEG: RAD_TO_DEG
    };
})();

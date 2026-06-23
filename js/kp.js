/**
 * KP.js - Krishnamurti Paddhati (KP) System Analysis
 * Implements sub-lord theory, 249 sub-divisions, significators,
 * ruling planets, and marriage promise assessment
 */
var KP = (function() {
    'use strict';

    // ===== KP Sub-Lord Table =====
    // The zodiac is divided into 249 sub-divisions based on Vimshottari Dasha proportions.
    // Each Nakshatra (13d 20m) is divided into 9 subs proportional to dasha years.

    var DASHA_SEQUENCE = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
    var DASHA_YEARS = { 'Ketu': 7, 'Venus': 20, 'Sun': 6, 'Moon': 10, 'Mars': 7, 'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17 };
    var TOTAL_DASHA_YEARS = 120;

    var NAKSHATRAS = AstroCore.NAKSHATRAS;
    var RASHIS = AstroCore.RASHIS;
    var RASHI_LORDS = AstroCore.RASHI_LORDS;
    var NAKSHATRA_LORDS = AstroCore.NAKSHATRA_LORDS;

    // Build the 249 sub-lord table
    // Each nakshatra (13.3333 degrees) is divided into 9 subs
    var subLordTable = null;

    function buildSubLordTable() {
        if (subLordTable) return subLordTable;

        subLordTable = [];
        var subNum = 1;

        for (var n = 0; n < 27; n++) {
            var nakshatraStart = n * (360 / 27);
            var nakshatraSpan = 360 / 27; // 13.3333 degrees
            var starLord = NAKSHATRA_LORDS[n];
            var starLordIdx = DASHA_SEQUENCE.indexOf(starLord);

            var currentPos = nakshatraStart;

            for (var s = 0; s < 9; s++) {
                var subIdx = (starLordIdx + s) % 9;
                var subLord = DASHA_SEQUENCE[subIdx];
                var subSpan = (DASHA_YEARS[subLord] / TOTAL_DASHA_YEARS) * nakshatraSpan;
                var subEnd = currentPos + subSpan;

                var rashiIdx = Math.floor(currentPos / 30);

                subLordTable.push({
                    number: subNum,
                    startDeg: currentPos,
                    endDeg: subEnd,
                    signLord: RASHI_LORDS[rashiIdx],
                    starLord: starLord,
                    subLord: subLord,
                    nakshatra: NAKSHATRAS[n],
                    rashi: RASHIS[rashiIdx]
                });

                currentPos = subEnd;
                subNum++;
            }
        }

        return subLordTable;
    }

    // ===== Get Sub-Lord for a given degree =====
    function getSubLord(degree) {
        var table = buildSubLordTable();
        var normDeg = AstroCore.normalize(degree);

        for (var i = 0; i < table.length; i++) {
            var entry = table[i];
            if (normDeg >= entry.startDeg && normDeg < entry.endDeg) {
                return entry;
            }
        }
        // Edge case: last entry wraps around
        return table[table.length - 1];
    }

    // ===== Get Cusp Sub-Lord Details for All 12 Houses =====
    function getCuspSubLords(chart) {
        var cusps = [];
        var houses = chart.houses.houses;

        for (var i = 0; i < 12; i++) {
            var cuspDeg = houses[i].cusp;
            var subLordInfo = getSubLord(cuspDeg);
            var rashiIdx = Math.floor(cuspDeg / 30);

            cusps.push({
                house: i + 1,
                cuspDegree: cuspDeg,
                signOnCusp: RASHIS[rashiIdx],
                signLord: RASHI_LORDS[rashiIdx],
                starLord: subLordInfo.starLord,
                subLord: subLordInfo.subLord,
                subNumber: subLordInfo.number
            });
        }

        return cusps;
    }

    // ===== KP Significators Calculation =====
    // A planet signifies houses through:
    // 1. Occupancy: The house it occupies (strongest)
    // 2. Ownership: The houses it owns/lords
    // 3. Star-lordship: Planets in its star signify what it signifies
    function calculateSignificators(chart) {
        var planets = chart.planets;
        var houses = chart.houses.houses;
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        var significators = {};

        // Initialize
        planetNames.forEach(function(name) {
            significators[name] = {
                occupies: planets[name].house,
                owns: [],
                starLordOf: [],
                significatesHouses: []
            };
        });

        // Ownership: which houses does each planet lord?
        for (var h = 0; h < 12; h++) {
            var lord = houses[h].lord;
            if (significators[lord]) {
                significators[lord].owns.push(h + 1);
            }
        }

        // Star-lordship: planets in a star lord's nakshatra signify that lord's houses
        planetNames.forEach(function(name) {
            var nakshatraLord = planets[name].nakshatraLord;
            if (significators[nakshatraLord]) {
                significators[nakshatraLord].starLordOf.push(name);
            }
        });

        // Compile significations for each planet
        planetNames.forEach(function(name) {
            var sig = significators[name];
            var housesSignified = [];

            // House occupied (Level 1 - strongest)
            housesSignified.push(sig.occupies);

            // Houses owned (Level 2)
            sig.owns.forEach(function(h) {
                if (housesSignified.indexOf(h) === -1) housesSignified.push(h);
            });

            // Through star-lordship (Level 3): planets in this planet's star
            // signify the same houses this planet signifies
            sig.significatesHouses = housesSignified.sort(function(a, b) { return a - b; });
        });

        return significators;
    }

    // ===== Marriage Promise Analysis (KP) =====
    // Marriage is promised if the sub-lord of the 7th cusp signifies houses 2, 7, or 11
    function analyzeMarriagePromise(chart) {
        var cusps = getCuspSubLords(chart);
        var significators = calculateSignificators(chart);
        var planets = chart.planets;

        // 7th cusp sub-lord
        var cusp7 = cusps[6]; // 7th house (0-indexed)
        var subLord7 = cusp7.subLord;
        var subLord7Sig = significators[subLord7];

        // Check if 7th cusp sub-lord signifies 2, 7, or 11
        var marriageHouses = [2, 7, 11];
        var negativeHouses = [1, 6, 10, 12]; // Houses that deny marriage

        var positiveSignification = [];
        var negativeSignification = [];

        if (subLord7Sig) {
            subLord7Sig.significatesHouses.forEach(function(h) {
                if (marriageHouses.indexOf(h) !== -1) positiveSignification.push(h);
                if (negativeHouses.indexOf(h) !== -1) negativeSignification.push(h);
            });
        }

        var marriagePromised = positiveSignification.length > 0 && positiveSignification.length >= negativeSignification.length;

        // Find planets that are significators of 2, 7, 11
        var marriageSignificators = [];
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        planetNames.forEach(function(name) {
            var sig = significators[name];
            var relevantHouses = [];
            sig.significatesHouses.forEach(function(h) {
                if (marriageHouses.indexOf(h) !== -1) relevantHouses.push(h);
            });
            if (relevantHouses.length > 0) {
                marriageSignificators.push({
                    planet: name,
                    houses: relevantHouses,
                    strength: relevantHouses.length
                });
            }
        });

        // Sort by strength
        marriageSignificators.sort(function(a, b) { return b.strength - a.strength; });

        return {
            cusp7SubLord: subLord7,
            cusp7StarLord: cusp7.starLord,
            cusp7SignLord: cusp7.signLord,
            positiveSignification: positiveSignification,
            negativeSignification: negativeSignification,
            marriagePromised: marriagePromised,
            marriageSignificators: marriageSignificators,
            verdict: marriagePromised ?
                'Marriage is PROMISED. 7th cusp sub-lord ' + subLord7 + ' signifies houses ' + positiveSignification.join(', ') + '.' :
                'Marriage promise is WEAK. 7th cusp sub-lord ' + subLord7 + ' does not strongly signify marriage houses (2, 7, 11).'
        };
    }

    // ===== Ruling Planets Analysis =====
    // Ruling planets at the moment of judgment/query are significant in KP
    function getRulingPlanets(chart) {
        var planets = chart.planets;
        var houses = chart.houses;

        // Ruling planets are derived from:
        // 1. Ascendant sign lord
        // 2. Ascendant star lord
        // 3. Moon sign lord
        // 4. Moon star lord
        // 5. Day lord

        var ascDeg = houses.ascendant;
        var ascSubInfo = getSubLord(ascDeg);

        var moonDeg = planets.Moon.sidereal;
        var moonSubInfo = getSubLord(moonDeg);

        // Day lord based on Julian Day
        var dayNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
        var dayIndex = Math.floor(chart.jd + 1.5) % 7;
        var dayLord = dayNames[dayIndex];

        var rulingPlanets = [
            { role: 'Ascendant Sign Lord', planet: ascSubInfo.signLord },
            { role: 'Ascendant Star Lord', planet: ascSubInfo.starLord },
            { role: 'Moon Sign Lord', planet: planets.Moon.rashiLord },
            { role: 'Moon Star Lord', planet: planets.Moon.nakshatraLord },
            { role: 'Day Lord', planet: dayLord }
        ];

        // Count frequencies to find strongest ruling planets
        var frequency = {};
        rulingPlanets.forEach(function(rp) {
            frequency[rp.planet] = (frequency[rp.planet] || 0) + 1;
        });

        var sorted = Object.keys(frequency).sort(function(a, b) { return frequency[b] - frequency[a]; });

        return {
            details: rulingPlanets,
            frequency: frequency,
            strongest: sorted,
            interpretation: 'Strongest ruling planets are ' + sorted.slice(0, 3).join(', ') +
                '. Dasha/Antardasha of these planets will activate marriage events.'
        };
    }

    // ===== KP-Based Marriage Assessment for Both Charts =====
    function assessMarriageKP(boyChart, girlChart) {
        var boyPromise = analyzeMarriagePromise(boyChart);
        var girlPromise = analyzeMarriagePromise(girlChart);
        var boyRuling = getRulingPlanets(boyChart);
        var girlRuling = getRulingPlanets(girlChart);
        var boySignificators = calculateSignificators(boyChart);
        var girlSignificators = calculateSignificators(girlChart);

        // Overall KP Assessment
        var kpScore = 0;
        if (boyPromise.marriagePromised) kpScore += 40;
        if (girlPromise.marriagePromised) kpScore += 40;

        // Bonus for strong significators
        if (boyPromise.positiveSignification.length >= 2) kpScore += 10;
        if (girlPromise.positiveSignification.length >= 2) kpScore += 10;

        kpScore = Math.min(100, kpScore);

        var verdict = '';
        if (kpScore >= 80) verdict = 'Excellent KP indicators. Marriage is strongly promised for both charts.';
        else if (kpScore >= 60) verdict = 'Good KP indicators. Marriage is promised with favorable conditions.';
        else if (kpScore >= 40) verdict = 'Moderate KP indicators. Marriage is possible but may face delays.';
        else verdict = 'Weak KP indicators. Marriage may face significant obstacles or delays.';

        return {
            boyPromise: boyPromise,
            girlPromise: girlPromise,
            boyRuling: boyRuling,
            girlRuling: girlRuling,
            boySignificators: boySignificators,
            girlSignificators: girlSignificators,
            kpScore: kpScore,
            verdict: verdict
        };
    }

    // ===== Significator Analysis for Houses 2, 7, 11 =====
    function getMarriageHouseSignificators(chart) {
        var significators = calculateSignificators(chart);
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
        var result = { 2: [], 7: [], 11: [] };

        planetNames.forEach(function(name) {
            var sig = significators[name];
            [2, 7, 11].forEach(function(h) {
                if (sig.significatesHouses.indexOf(h) !== -1) {
                    result[h].push({
                        planet: name,
                        through: sig.occupies === h ? 'Occupancy' : (sig.owns.indexOf(h) !== -1 ? 'Ownership' : 'Star-lordship')
                    });
                }
            });
        });

        return result;
    }

    // ===== Public API =====
    return {
        buildSubLordTable: buildSubLordTable,
        getSubLord: getSubLord,
        getCuspSubLords: getCuspSubLords,
        calculateSignificators: calculateSignificators,
        analyzeMarriagePromise: analyzeMarriagePromise,
        getRulingPlanets: getRulingPlanets,
        assessMarriageKP: assessMarriageKP,
        getMarriageHouseSignificators: getMarriageHouseSignificators
    };
})();

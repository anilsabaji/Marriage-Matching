/**
 * Transit.js - Planetary Transit Analysis Engine
 * Provides approximate planetary transit positions for future dates,
 * transit aspects to natal positions, and specific transit analyses
 * (Saturn, Jupiter, Rahu-Ketu) for marriage timing.
 */
var Transit = (function() {
    'use strict';

    // Approximate mean daily motions in degrees (sidereal)
    var MEAN_DAILY_MOTION = {
        Sun: 0.9856,
        Moon: 13.1764,
        Mars: 0.5240,
        Mercury: 1.3833,
        Jupiter: 0.0831,
        Venus: 1.6021,
        Saturn: 0.0335,
        Rahu: -0.0530,   // Retrograde motion
        Ketu: -0.0530    // Retrograde motion (opposite to Rahu)
    };

    // Approximate orbital period in days
    var ORBITAL_PERIODS = {
        Sun: 365.25,
        Moon: 27.32,
        Mars: 687,
        Mercury: 88,
        Jupiter: 4332.59,
        Venus: 224.7,
        Saturn: 10759.22,
        Rahu: 6793.5,
        Ketu: 6793.5
    };

    // Aspect orbs (how many degrees of tolerance)
    var ASPECT_ORB = 10; // degrees

    // Aspect definitions: angle and name
    var ASPECTS = [
        { angle: 0, name: 'Conjunction', symbol: '0', strength: 1.0 },
        { angle: 180, name: 'Opposition', symbol: '180', strength: 0.9 },
        { angle: 120, name: 'Trine', symbol: '120', strength: 0.8 },
        { angle: 90, name: 'Square', symbol: '90', strength: 0.7 },
        { angle: 60, name: 'Sextile', symbol: '60', strength: 0.6 }
    ];

    /**
     * Calculate approximate transit position of a planet on a given future JD.
     * Uses the natal position as a starting point and applies mean daily motion.
     * For better accuracy on longer timescales, uses AstroCore's full calculation.
     */
    function getTransitPosition(planet, targetJD) {
        // Use AstroCore's calculation for accurate position
        var ayanamsa = AstroCore.calculateAyanamsa(targetJD);
        var tropical = AstroCore.calculatePlanetLongitude(planet, targetJD);
        var sidereal = AstroCore.normalize(tropical - ayanamsa);
        return sidereal;
    }

    /**
     * Get all transit planet positions for a given JD
     */
    function getAllTransitPositions(targetJD) {
        var positions = {};
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        planetNames.forEach(function(name) {
            var sidereal = getTransitPosition(name, targetJD);
            var rashiIndex = Math.floor(sidereal / 30);
            positions[name] = {
                sidereal: sidereal,
                rashi: AstroCore.RASHIS[rashiIndex],
                rashiIndex: rashiIndex,
                rashiLord: AstroCore.RASHI_LORDS[rashiIndex]
            };
        });

        return positions;
    }

    /**
     * Calculate the angular difference between two degrees (0-180)
     */
    function angularDifference(deg1, deg2) {
        var diff = Math.abs(AstroCore.normalize(deg1) - AstroCore.normalize(deg2));
        if (diff > 180) diff = 360 - diff;
        return diff;
    }

    /**
     * Check if a transit planet forms an aspect with a natal position.
     * Returns the aspect details if within orb, null otherwise.
     */
    function checkAspect(transitDeg, natalDeg, orb) {
        orb = orb || ASPECT_ORB;
        var diff = angularDifference(transitDeg, natalDeg);

        for (var i = 0; i < ASPECTS.length; i++) {
            var aspect = ASPECTS[i];
            if (Math.abs(diff - aspect.angle) <= orb) {
                return {
                    type: aspect.name,
                    angle: aspect.angle,
                    exactness: Math.abs(diff - aspect.angle),
                    strength: aspect.strength * (1 - Math.abs(diff - aspect.angle) / orb)
                };
            }
        }
        return null;
    }

    /**
     * Get all transit aspects to natal chart at a given date
     */
    function getTransitAspects(natalChart, targetJD) {
        var transitPositions = getAllTransitPositions(targetJD);
        var aspects = [];
        var transitPlanets = ['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars', 'Venus', 'Sun'];
        var natalPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        transitPlanets.forEach(function(tp) {
            var tDeg = transitPositions[tp].sidereal;
            natalPlanets.forEach(function(np) {
                var nDeg = natalChart.planets[np].sidereal;
                var aspect = checkAspect(tDeg, nDeg, 8);
                if (aspect) {
                    aspects.push({
                        transitPlanet: tp,
                        natalPlanet: np,
                        transitDeg: tDeg,
                        natalDeg: nDeg,
                        aspect: aspect
                    });
                }
            });
        });

        return aspects;
    }

    /**
     * Saturn Transit Analysis - Sade Sati and 7th house transit
     * Sade Sati: Saturn transits through the 12th, 1st, and 2nd from natal Moon
     */
    function analyzeSaturnTransit(natalChart, targetJD) {
        var saturnPos = getTransitPosition('Saturn', targetJD);
        var moonRashiIndex = natalChart.planets.Moon.rashiIndex;
        var saturnRashiIndex = Math.floor(saturnPos / 30);

        // House of Saturn from Moon (Moon sign = 1st)
        var houseFromMoon = ((saturnRashiIndex - moonRashiIndex + 12) % 12) + 1;

        // Sade Sati phases
        var sadeSati = {
            active: false,
            phase: ''
        };
        if (houseFromMoon === 12) {
            sadeSati = { active: true, phase: 'Rising (12th from Moon) - Beginning of Sade Sati' };
        } else if (houseFromMoon === 1) {
            sadeSati = { active: true, phase: 'Peak (Over Moon) - Middle of Sade Sati' };
        } else if (houseFromMoon === 2) {
            sadeSati = { active: true, phase: 'Setting (2nd from Moon) - End of Sade Sati' };
        }

        // Saturn transit over 7th house
        var seventhHouseRashi = natalChart.houses.houses[6].rashiIndex;
        var transitOver7th = (saturnRashiIndex === seventhHouseRashi);

        // Saturn aspecting 7th house (Saturn's special aspects: 3rd, 7th, 10th from itself)
        var saturnHouse = ((saturnRashiIndex - natalChart.houses.houses[0].rashiIndex + 12) % 12) + 1;
        var saturnAspects7th = false;
        var aspect7Houses = [
            ((saturnHouse - 1 + 2) % 12) + 1,  // 3rd from Saturn
            ((saturnHouse - 1 + 6) % 12) + 1,  // 7th from Saturn
            ((saturnHouse - 1 + 9) % 12) + 1   // 10th from Saturn
        ];
        if (aspect7Houses.indexOf(7) !== -1 || saturnHouse === 7) {
            saturnAspects7th = true;
        }

        return {
            saturnPosition: saturnPos,
            saturnRashi: AstroCore.RASHIS[saturnRashiIndex],
            houseFromMoon: houseFromMoon,
            sadeSati: sadeSati,
            transitOver7th: transitOver7th,
            saturnAspects7th: saturnAspects7th,
            influencesMarriage: transitOver7th || saturnAspects7th
        };
    }

    /**
     * Jupiter Transit Analysis - Transit over 7th, aspects to Venus/7th lord
     */
    function analyzeJupiterTransit(natalChart, targetJD) {
        var jupiterPos = getTransitPosition('Jupiter', targetJD);
        var jupiterRashiIndex = Math.floor(jupiterPos / 30);

        // 7th house sign
        var seventhHouseRashi = natalChart.houses.houses[6].rashiIndex;
        var transitOver7th = (jupiterRashiIndex === seventhHouseRashi);

        // Jupiter aspects (5th, 7th, 9th from itself)
        var ascRashiIndex = natalChart.houses.houses[0].rashiIndex;
        var jupiterHouse = ((jupiterRashiIndex - ascRashiIndex + 12) % 12) + 1;
        var jupiterAspectHouses = [
            jupiterHouse,
            ((jupiterHouse - 1 + 4) % 12) + 1,  // 5th
            ((jupiterHouse - 1 + 6) % 12) + 1,  // 7th
            ((jupiterHouse - 1 + 8) % 12) + 1   // 9th
        ];
        var aspects7th = jupiterAspectHouses.indexOf(7) !== -1;

        // Aspect to Venus
        var venusDeg = natalChart.planets.Venus.sidereal;
        var aspectToVenus = checkAspect(jupiterPos, venusDeg, 10);

        // Aspect to 7th lord
        var lord7 = natalChart.houses.houses[6].lord;
        var lord7Deg = natalChart.planets[lord7].sidereal;
        var aspectTo7thLord = checkAspect(jupiterPos, lord7Deg, 10);

        // Check aspects to 2nd and 11th house cusps
        var aspects2nd = (jupiterAspectHouses.indexOf(2) !== -1);
        var aspects11th = (jupiterAspectHouses.indexOf(11) !== -1);

        return {
            jupiterPosition: jupiterPos,
            jupiterRashi: AstroCore.RASHIS[jupiterRashiIndex],
            jupiterHouse: jupiterHouse,
            transitOver7th: transitOver7th,
            aspects7th: aspects7th,
            aspectToVenus: aspectToVenus,
            aspectTo7thLord: aspectTo7thLord,
            aspects2nd: aspects2nd,
            aspects11th: aspects11th,
            influencesMarriage: transitOver7th || aspects7th || aspectToVenus !== null || aspectTo7thLord !== null
        };
    }

    /**
     * Rahu-Ketu Transit Axis Analysis relative to 1-7 axis
     */
    function analyzeRahuKetuTransit(natalChart, targetJD) {
        var rahuPos = getTransitPosition('Rahu', targetJD);
        var ketuPos = AstroCore.normalize(rahuPos + 180);
        var rahuRashiIndex = Math.floor(rahuPos / 30);
        var ketuRashiIndex = Math.floor(ketuPos / 30);

        var ascRashiIndex = natalChart.houses.houses[0].rashiIndex;
        var seventhRashiIndex = natalChart.houses.houses[6].rashiIndex;

        // Check if Rahu-Ketu axis aligns with 1-7 axis
        var rahuIn1st = (rahuRashiIndex === ascRashiIndex);
        var rahuIn7th = (rahuRashiIndex === seventhRashiIndex);
        var ketuIn1st = (ketuRashiIndex === ascRashiIndex);
        var ketuIn7th = (ketuRashiIndex === seventhRashiIndex);

        var axisActivated = rahuIn1st || rahuIn7th || ketuIn1st || ketuIn7th;

        // Check if transit Rahu/Ketu aspects natal Venus
        var venusDeg = natalChart.planets.Venus.sidereal;
        var rahuAspectVenus = checkAspect(rahuPos, venusDeg, 8);
        var ketuAspectVenus = checkAspect(ketuPos, venusDeg, 8);

        return {
            rahuPosition: rahuPos,
            ketuPosition: ketuPos,
            rahuRashi: AstroCore.RASHIS[rahuRashiIndex],
            ketuRashi: AstroCore.RASHIS[ketuRashiIndex],
            rahuIn1st: rahuIn1st,
            rahuIn7th: rahuIn7th,
            ketuIn1st: ketuIn1st,
            ketuIn7th: ketuIn7th,
            axisActivated: axisActivated,
            rahuAspectVenus: rahuAspectVenus,
            ketuAspectVenus: ketuAspectVenus,
            influencesMarriage: axisActivated || rahuAspectVenus !== null || ketuAspectVenus !== null
        };
    }

    /**
     * Double Transit Theory: Both Jupiter and Saturn should influence
     * marriage houses (2, 7, 11) simultaneously for marriage to occur.
     */
    function analyzeDoubleTransit(natalChart, targetJD) {
        var jupiter = analyzeJupiterTransit(natalChart, targetJD);
        var saturn = analyzeSaturnTransit(natalChart, targetJD);

        var jupiterInfluences = [];
        var saturnInfluences = [];

        // Determine which marriage houses Jupiter influences
        var jupiterAspectHouses = [
            jupiter.jupiterHouse,
            ((jupiter.jupiterHouse - 1 + 4) % 12) + 1,
            ((jupiter.jupiterHouse - 1 + 6) % 12) + 1,
            ((jupiter.jupiterHouse - 1 + 8) % 12) + 1
        ];
        [2, 7, 11].forEach(function(h) {
            if (jupiterAspectHouses.indexOf(h) !== -1) jupiterInfluences.push(h);
        });

        // Determine which marriage houses Saturn influences
        var saturnPos = getTransitPosition('Saturn', targetJD);
        var saturnRashiIndex = Math.floor(saturnPos / 30);
        var ascRashiIndex = natalChart.houses.houses[0].rashiIndex;
        var saturnHouse = ((saturnRashiIndex - ascRashiIndex + 12) % 12) + 1;
        var saturnAspectHouses = [
            saturnHouse,
            ((saturnHouse - 1 + 2) % 12) + 1,   // 3rd
            ((saturnHouse - 1 + 6) % 12) + 1,   // 7th
            ((saturnHouse - 1 + 9) % 12) + 1    // 10th
        ];
        [2, 7, 11].forEach(function(h) {
            if (saturnAspectHouses.indexOf(h) !== -1) saturnInfluences.push(h);
        });

        var doubleTransitActive = jupiterInfluences.length > 0 && saturnInfluences.length > 0;

        // Check overlap in influenced houses
        var commonHouses = [];
        jupiterInfluences.forEach(function(h) {
            if (saturnInfluences.indexOf(h) !== -1) commonHouses.push(h);
        });

        return {
            jupiterInfluences: jupiterInfluences,
            saturnInfluences: saturnInfluences,
            commonHouses: commonHouses,
            doubleTransitActive: doubleTransitActive,
            strength: doubleTransitActive ?
                (commonHouses.length > 0 ? 'Strong' : 'Moderate') : 'Weak',
            interpretation: doubleTransitActive ?
                'Double transit is ACTIVE. Jupiter influences house(s) ' + jupiterInfluences.join(', ') +
                ' and Saturn influences house(s) ' + saturnInfluences.join(', ') + '.' +
                (commonHouses.length > 0 ? ' Both confirm house(s) ' + commonHouses.join(', ') + '.' : '') :
                'Double transit is NOT active. Both Jupiter and Saturn must simultaneously influence marriage houses (2, 7, 11) for event to manifest.'
        };
    }

    /**
     * Comprehensive transit score for marriage timing.
     * Combines all transit analyses into a single score (0-10).
     */
    function getTransitMarriageScore(natalChart, targetJD) {
        var score = 0;
        var factors = [];

        var jupiter = analyzeJupiterTransit(natalChart, targetJD);
        var saturn = analyzeSaturnTransit(natalChart, targetJD);
        var rahuKetu = analyzeRahuKetuTransit(natalChart, targetJD);
        var doubleTransit = analyzeDoubleTransit(natalChart, targetJD);

        // Jupiter transiting/aspecting 7th house
        if (jupiter.transitOver7th) { score += 2; factors.push('Jupiter transits 7th house'); }
        else if (jupiter.aspects7th) { score += 1.5; factors.push('Jupiter aspects 7th house'); }

        // Jupiter aspecting Venus or 7th lord
        if (jupiter.aspectToVenus) { score += 1.5; factors.push('Jupiter aspects natal Venus'); }
        if (jupiter.aspectTo7thLord) { score += 1.5; factors.push('Jupiter aspects 7th lord'); }

        // Jupiter on 2nd or 11th
        if (jupiter.aspects2nd) { score += 1; factors.push('Jupiter influences 2nd house'); }
        if (jupiter.aspects11th) { score += 1; factors.push('Jupiter influences 11th house'); }

        // Double transit
        if (doubleTransit.doubleTransitActive) {
            score += 2;
            factors.push('Double transit active (Jupiter + Saturn on marriage houses)');
        }

        // Saturn aspects 7th (can be delaying but also triggering)
        if (saturn.transitOver7th) {
            score += 0.5; // Saturn on 7th can trigger marriage with delay
            factors.push('Saturn transits 7th (triggering but with delay)');
        }

        // Sade Sati (generally reduces, but not always for marriage)
        if (saturn.sadeSati.active) {
            score -= 1;
            factors.push('Sade Sati active (' + saturn.sadeSati.phase + ')');
        }

        // Rahu-Ketu on 1-7 axis (karmic, can trigger sudden events)
        if (rahuKetu.axisActivated) {
            score += 1;
            factors.push('Rahu-Ketu axis on 1st/7th houses');
        }

        score = Math.max(0, Math.min(10, score));

        return {
            score: score,
            factors: factors,
            jupiter: jupiter,
            saturn: saturn,
            rahuKetu: rahuKetu,
            doubleTransit: doubleTransit
        };
    }

    /**
     * Get transit analysis summary for a specific date range.
     * Returns the transit score at the midpoint of the range.
     */
    function getTransitSummaryForPeriod(natalChart, startJD, endJD) {
        // Analyze at midpoint for Antardasha-level periods
        var midJD = (startJD + endJD) / 2;
        return getTransitMarriageScore(natalChart, midJD);
    }

    /**
     * Get combined Dasha + Transit score for a period
     */
    function getCombinedScore(dashaScore, transitScore) {
        // Dasha contributes 60%, transit contributes 40%
        var combined = (dashaScore * 0.6) + (transitScore * 0.4);
        return Math.max(-10, Math.min(10, combined));
    }

    /**
     * Get interpretive text for transit conditions
     */
    function getTransitInterpretation(transitResult) {
        var text = '';
        if (transitResult.score >= 6) {
            text = 'Transit conditions are highly supportive of marriage. ';
        } else if (transitResult.score >= 3) {
            text = 'Transit conditions are moderately supportive. ';
        } else if (transitResult.score >= 1) {
            text = 'Transit conditions show mild support. ';
        } else {
            text = 'Transit conditions are not particularly favorable. ';
        }

        if (transitResult.factors.length > 0) {
            text += 'Key factors: ' + transitResult.factors.join('; ') + '.';
        }

        return text;
    }

    // ===== Public API =====
    return {
        getTransitPosition: getTransitPosition,
        getAllTransitPositions: getAllTransitPositions,
        checkAspect: checkAspect,
        getTransitAspects: getTransitAspects,
        analyzeSaturnTransit: analyzeSaturnTransit,
        analyzeJupiterTransit: analyzeJupiterTransit,
        analyzeRahuKetuTransit: analyzeRahuKetuTransit,
        analyzeDoubleTransit: analyzeDoubleTransit,
        getTransitMarriageScore: getTransitMarriageScore,
        getTransitSummaryForPeriod: getTransitSummaryForPeriod,
        getCombinedScore: getCombinedScore,
        getTransitInterpretation: getTransitInterpretation,
        ASPECTS: ASPECTS
    };
})();

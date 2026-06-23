/**
 * Dasha.js - Marriage Timeline Prediction using Vimshottari Dasha
 * Builds on AstroCore's Dasha calculations to predict marriage windows
 * by identifying periods where 7th house significators are active
 */
var DashaTimeline = (function() {
    'use strict';

    var DASHA_SEQUENCE = AstroCore.DASHA_SEQUENCE;
    var DASHA_YEARS = AstroCore.DASHA_YEARS;

    // Marriage-relevant houses: 2 (family), 7 (spouse), 11 (fulfillment of desires)
    var MARRIAGE_HOUSES = [2, 7, 11];
    // Negative/delaying houses for marriage
    var NEGATIVE_HOUSES = [6, 8, 12];

    /**
     * Get the full Dasha sequence for a chart (all 9 Mahadashas from birth)
     */
    function getFullDashaSequence(chart) {
        var moonLong = chart.planets.Moon.sidereal;
        var birthJD = chart.jd;
        return AstroCore.calculateDasha(moonLong, birthJD);
    }

    /**
     * Get Antardasha periods for a given Mahadasha
     */
    function getAntardashas(dasha) {
        return AstroCore.calculateAntardasha(dasha);
    }

    /**
     * Get Pratyantardasha periods for a given Antardasha
     */
    function getPratyantardashas(antardasha) {
        return AstroCore.calculatePratyantardasha(antardasha);
    }

    /**
     * Get KP significators for marriage houses (2, 7, 11)
     * Returns a set of planets that are significators of these houses
     */
    function getMarriageSignificatorPlanets(chart) {
        var sigData = KP.getMarriageHouseSignificators(chart);
        var planets = {};

        MARRIAGE_HOUSES.forEach(function(h) {
            sigData[h].forEach(function(entry) {
                if (!planets[entry.planet]) {
                    planets[entry.planet] = { houses: [], strength: 0 };
                }
                planets[entry.planet].houses.push(h);
                planets[entry.planet].strength += 1;
            });
        });

        return planets;
    }

    /**
     * Get planets that signify negative houses (6, 8, 12) for marriage
     */
    function getNegativeSignificatorPlanets(chart) {
        var significators = KP.calculateSignificators(chart);
        var planets = {};
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        planetNames.forEach(function(name) {
            var sig = significators[name];
            var negHouses = [];
            sig.significatesHouses.forEach(function(h) {
                if (NEGATIVE_HOUSES.indexOf(h) !== -1) {
                    negHouses.push(h);
                }
            });
            if (negHouses.length > 0) {
                planets[name] = { houses: negHouses, strength: negHouses.length };
            }
        });

        return planets;
    }

    /**
     * Score a Dasha-Antardasha-Pratyantardasha period for marriage potential.
     * Returns a score from -10 to +10.
     * Positive = favorable for marriage, Negative = unfavorable.
     */
    function scorePeriodForMarriage(dashaLord, antarLord, pratyantarLord, marriageSignificators, negativeSignificators) {
        var score = 0;
        var reasons = [];

        // Score Mahadasha lord
        if (marriageSignificators[dashaLord]) {
            var md = marriageSignificators[dashaLord];
            score += md.strength * 2;
            reasons.push(dashaLord + ' Mahadasha signifies house(s) ' + md.houses.join(','));
        }
        if (negativeSignificators[dashaLord]) {
            score -= negativeSignificators[dashaLord].strength;
            reasons.push(dashaLord + ' Mahadasha also signifies negative house(s) ' + negativeSignificators[dashaLord].houses.join(','));
        }

        // Score Antardasha lord (more weight than Mahadasha for timing)
        if (marriageSignificators[antarLord]) {
            var ad = marriageSignificators[antarLord];
            score += ad.strength * 2.5;
            reasons.push(antarLord + ' Antardasha signifies house(s) ' + ad.houses.join(','));
        }
        if (negativeSignificators[antarLord]) {
            score -= negativeSignificators[antarLord].strength * 1.5;
            reasons.push(antarLord + ' Antardasha also signifies negative house(s) ' + negativeSignificators[antarLord].houses.join(','));
        }

        // Score Pratyantardasha lord (most precise timing)
        if (pratyantarLord) {
            if (marriageSignificators[pratyantarLord]) {
                var pd = marriageSignificators[pratyantarLord];
                score += pd.strength * 3;
                reasons.push(pratyantarLord + ' Pratyantardasha signifies house(s) ' + pd.houses.join(','));
            }
            if (negativeSignificators[pratyantarLord]) {
                score -= negativeSignificators[pratyantarLord].strength * 2;
            }
        }

        // Venus as natural marriage karaka - bonus
        if (dashaLord === 'Venus' || antarLord === 'Venus' || pratyantarLord === 'Venus') {
            score += 1;
            reasons.push('Venus (marriage karaka) is active in this period');
        }

        // Jupiter as natural benefic for marriage - bonus
        if (dashaLord === 'Jupiter' || antarLord === 'Jupiter' || pratyantarLord === 'Jupiter') {
            score += 0.5;
        }

        return {
            score: Math.max(-10, Math.min(10, score)),
            reasons: reasons
        };
    }

    /**
     * Determine period strength rating from a score
     */
    function getStrengthRating(score) {
        if (score >= 7) return { rating: 'strong', label: 'Strongly Favorable', cssClass: 'strength-strong' };
        if (score >= 4) return { rating: 'moderate', label: 'Moderately Favorable', cssClass: 'strength-moderate' };
        if (score >= 1) return { rating: 'mild', label: 'Mildly Favorable', cssClass: 'strength-mild' };
        if (score >= -2) return { rating: 'neutral', label: 'Neutral', cssClass: 'strength-neutral' };
        if (score >= -5) return { rating: 'challenging', label: 'Challenging', cssClass: 'strength-challenging' };
        return { rating: 'difficult', label: 'Difficult', cssClass: 'strength-difficult' };
    }

    /**
     * Find the currently running Dasha-Antardasha-Pratyantardasha
     */
    function getCurrentPeriod(chart, nowJD) {
        var dashas = getFullDashaSequence(chart);
        var currentDasha = null;
        var currentAntar = null;
        var currentPratyantar = null;

        for (var i = 0; i < dashas.length; i++) {
            if (nowJD >= dashas[i].startJD && nowJD < dashas[i].endJD) {
                currentDasha = dashas[i];
                break;
            }
        }

        if (!currentDasha) return null;

        var antars = getAntardashas(currentDasha);
        for (var j = 0; j < antars.length; j++) {
            if (nowJD >= antars[j].startJD && nowJD < antars[j].endJD) {
                currentAntar = antars[j];
                break;
            }
        }

        if (!currentAntar) return { dasha: currentDasha, antardasha: null, pratyantardasha: null };

        var pratyantars = getPratyantardashas(currentAntar);
        for (var k = 0; k < pratyantars.length; k++) {
            if (nowJD >= pratyantars[k].startJD && nowJD < pratyantars[k].endJD) {
                currentPratyantar = pratyantars[k];
                break;
            }
        }

        return {
            dasha: currentDasha,
            antardasha: currentAntar,
            pratyantardasha: currentPratyantar
        };
    }

    /**
     * Find the nearest marriage window from the current date.
     * Scans upcoming Antardasha and Pratyantardasha periods that
     * have strong marriage signification.
     */
    function findNearestMarriageWindow(chart, fromJD, yearsAhead) {
        yearsAhead = yearsAhead || 10;
        var endJD = fromJD + yearsAhead * 365.25;

        var marriageSig = getMarriageSignificatorPlanets(chart);
        var negativeSig = getNegativeSignificatorPlanets(chart);
        var dashas = getFullDashaSequence(chart);

        var windows = [];

        for (var i = 0; i < dashas.length; i++) {
            var dasha = dashas[i];
            // Skip dashas that are entirely before now or entirely after our window
            if (dasha.endJD < fromJD) continue;
            if (dasha.startJD > endJD) break;

            var antars = getAntardashas(dasha);
            for (var j = 0; j < antars.length; j++) {
                var antar = antars[j];
                if (antar.endJD < fromJD) continue;
                if (antar.startJD > endJD) break;

                // Score at Antardasha level first
                var adScore = scorePeriodForMarriage(dasha.lord, antar.lord, null, marriageSig, negativeSig);

                if (adScore.score >= 3) {
                    // This Antardasha is favorable - find best Pratyantardasha within it
                    var pratyantars = getPratyantardashas(antar);
                    for (var k = 0; k < pratyantars.length; k++) {
                        var pratyantar = pratyantars[k];
                        if (pratyantar.endJD < fromJD) continue;
                        if (pratyantar.startJD > endJD) break;

                        var pdScore = scorePeriodForMarriage(dasha.lord, antar.lord, pratyantar.lord, marriageSig, negativeSig);
                        if (pdScore.score >= 5) {
                            windows.push({
                                dasha: dasha.lord,
                                antardasha: antar.lord,
                                pratyantardasha: pratyantar.lord,
                                startJD: Math.max(pratyantar.startJD, fromJD),
                                endJD: pratyantar.endJD,
                                startDate: AstroCore.jdToDate(Math.max(pratyantar.startJD, fromJD)),
                                endDate: AstroCore.jdToDate(pratyantar.endJD),
                                score: pdScore.score,
                                strength: getStrengthRating(pdScore.score),
                                reasons: pdScore.reasons
                            });
                        }
                    }
                }
            }
        }

        // Sort by score descending, then by start date
        windows.sort(function(a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return a.startJD - b.startJD;
        });

        return windows;
    }

    /**
     * Generate a 20-year forecast showing relationship strength/weakness
     * at each Dasha-Antardasha period level.
     */
    function generate20YearForecast(chart, fromJD) {
        var endJD = fromJD + 20 * 365.25;
        var marriageSig = getMarriageSignificatorPlanets(chart);
        var negativeSig = getNegativeSignificatorPlanets(chart);
        var dashas = getFullDashaSequence(chart);

        var forecast = [];

        for (var i = 0; i < dashas.length; i++) {
            var dasha = dashas[i];
            if (dasha.endJD < fromJD) continue;
            if (dasha.startJD > endJD) break;

            var antars = getAntardashas(dasha);
            for (var j = 0; j < antars.length; j++) {
                var antar = antars[j];
                if (antar.endJD < fromJD) continue;
                if (antar.startJD > endJD) break;

                var adScore = scorePeriodForMarriage(dasha.lord, antar.lord, null, marriageSig, negativeSig);
                var strength = getStrengthRating(adScore.score);

                var effectiveStart = Math.max(antar.startJD, fromJD);
                var effectiveEnd = Math.min(antar.endJD, endJD);

                // Get Pratyantardasha breakdown for finer detail
                var pratyantarBreakdown = [];
                var pratyantars = getPratyantardashas(antar);
                for (var k = 0; k < pratyantars.length; k++) {
                    var pd = pratyantars[k];
                    if (pd.endJD < fromJD) continue;
                    if (pd.startJD > endJD) break;

                    var pdScore = scorePeriodForMarriage(dasha.lord, antar.lord, pd.lord, marriageSig, negativeSig);
                    var pdStrength = getStrengthRating(pdScore.score);
                    pratyantarBreakdown.push({
                        lord: pd.lord,
                        startJD: Math.max(pd.startJD, fromJD),
                        endJD: Math.min(pd.endJD, endJD),
                        startDate: AstroCore.jdToDate(Math.max(pd.startJD, fromJD)),
                        endDate: AstroCore.jdToDate(Math.min(pd.endJD, endJD)),
                        score: pdScore.score,
                        strength: pdStrength,
                        reasons: pdScore.reasons
                    });
                }

                forecast.push({
                    dashaLord: dasha.lord,
                    antarLord: antar.lord,
                    startJD: effectiveStart,
                    endJD: effectiveEnd,
                    startDate: AstroCore.jdToDate(effectiveStart),
                    endDate: AstroCore.jdToDate(effectiveEnd),
                    score: adScore.score,
                    strength: strength,
                    reasons: adScore.reasons,
                    pratyantardasha: pratyantarBreakdown
                });
            }
        }

        return forecast;
    }

    /**
     * Find overlapping favorable periods between two charts
     */
    function findOverlappingWindows(boyWindows, girlWindows) {
        var overlaps = [];

        for (var i = 0; i < boyWindows.length; i++) {
            var bw = boyWindows[i];
            for (var j = 0; j < girlWindows.length; j++) {
                var gw = girlWindows[j];
                // Check overlap
                var overlapStart = Math.max(bw.startJD, gw.startJD);
                var overlapEnd = Math.min(bw.endJD, gw.endJD);

                if (overlapStart < overlapEnd) {
                    overlaps.push({
                        startJD: overlapStart,
                        endJD: overlapEnd,
                        startDate: AstroCore.jdToDate(overlapStart),
                        endDate: AstroCore.jdToDate(overlapEnd),
                        boyPeriod: bw.dasha + '-' + bw.antardasha + '-' + bw.pratyantardasha,
                        girlPeriod: gw.dasha + '-' + gw.antardasha + '-' + gw.pratyantardasha,
                        combinedScore: (bw.score + gw.score) / 2,
                        boyScore: bw.score,
                        girlScore: gw.score
                    });
                }
            }
        }

        // Sort by combined score
        overlaps.sort(function(a, b) { return b.combinedScore - a.combinedScore; });

        return overlaps;
    }

    /**
     * Get the current JD for "now"
     */
    function getNowJD() {
        var now = new Date();
        return AstroCore.dateToJD(
            now.getFullYear(), now.getMonth() + 1, now.getDate(),
            now.getHours(), now.getMinutes(), now.getSeconds(),
            -now.getTimezoneOffset() / 60
        );
    }

    /**
     * Format a date object from jdToDate into a readable string
     */
    function formatDate(dateObj) {
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return dateObj.day + ' ' + months[dateObj.month - 1] + ' ' + dateObj.year;
    }

    /**
     * Get interpretation text for a marriage period
     */
    function getInterpretation(dashaLord, antarLord, pratyantarLord, score, marriageSig) {
        var text = '';

        if (score >= 7) {
            text = 'Highly favorable period for marriage. ';
        } else if (score >= 4) {
            text = 'Moderately favorable period. ';
        } else if (score >= 1) {
            text = 'Mildly supportive period. ';
        } else if (score >= -2) {
            text = 'Neutral period with no strong indications. ';
        } else if (score >= -5) {
            text = 'Challenging period - delays or obstacles likely. ';
        } else {
            text = 'Difficult period - not recommended for marriage. ';
        }

        // Add specific reasoning
        if (marriageSig[dashaLord]) {
            text += dashaLord + ' (MD) connects to marriage house(s) ' + marriageSig[dashaLord].houses.join(', ') + '. ';
        }
        if (marriageSig[antarLord]) {
            text += antarLord + ' (AD) connects to house(s) ' + marriageSig[antarLord].houses.join(', ') + '. ';
        }
        if (pratyantarLord && marriageSig[pratyantarLord]) {
            text += pratyantarLord + ' (PD) activates house(s) ' + marriageSig[pratyantarLord].houses.join(', ') + '.';
        }

        return text;
    }

    // ===== Public API =====
    return {
        getFullDashaSequence: getFullDashaSequence,
        getAntardashas: getAntardashas,
        getPratyantardashas: getPratyantardashas,
        getMarriageSignificatorPlanets: getMarriageSignificatorPlanets,
        getNegativeSignificatorPlanets: getNegativeSignificatorPlanets,
        scorePeriodForMarriage: scorePeriodForMarriage,
        getStrengthRating: getStrengthRating,
        getCurrentPeriod: getCurrentPeriod,
        findNearestMarriageWindow: findNearestMarriageWindow,
        generate20YearForecast: generate20YearForecast,
        findOverlappingWindows: findOverlappingWindows,
        getNowJD: getNowJD,
        formatDate: formatDate,
        getInterpretation: getInterpretation
    };
})();

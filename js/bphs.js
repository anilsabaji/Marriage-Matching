/**
 * BPHS.js - Brihat Parashara Hora Shastra Analysis
 * Implements house significations, planet-in-house analysis,
 * house lordship analysis, and marriage-relevant yogas
 */
var BPHS = (function() {
    'use strict';

    // ===== House Significations per BPHS =====
    var HOUSE_SIGNIFICATIONS = {
        1: {
            name: 'Lagna (Ascendant)',
            keywords: ['Self', 'Personality', 'Health', 'Physical appearance', 'Vitality', 'Temperament'],
            marriage: 'Indicates the native\'s personality and how they present in relationships. Strong 1st lord supports a healthy marriage.'
        },
        2: {
            name: 'Dhana (Wealth)',
            keywords: ['Wealth', 'Family', 'Speech', 'Food habits', 'Face', 'Right eye'],
            marriage: 'Represents family life after marriage (kutumba). A strong 2nd house ensures harmonious family relations and financial stability in marriage.'
        },
        3: {
            name: 'Sahaja (Siblings)',
            keywords: ['Siblings', 'Courage', 'Communication', 'Short journeys', 'Efforts', 'Neighbors'],
            marriage: 'Shows courage and communication in relationships. Good 3rd house supports healthy dialogue between partners.'
        },
        4: {
            name: 'Sukha (Happiness)',
            keywords: ['Mother', 'Property', 'Happiness', 'Education', 'Vehicles', 'Domestic peace'],
            marriage: 'Indicates domestic happiness and comfort in married life. Strong 4th house gives a peaceful home environment.'
        },
        5: {
            name: 'Putra (Children)',
            keywords: ['Children', 'Intelligence', 'Romance', 'Creativity', 'Past merit', 'Speculation'],
            marriage: 'Represents romance, love affairs, and children. Critical for assessing romantic compatibility and progeny.'
        },
        6: {
            name: 'Ripu (Enemies)',
            keywords: ['Enemies', 'Disease', 'Debt', 'Service', 'Obstacles', 'Maternal uncle'],
            marriage: 'Indicates obstacles and conflicts in marriage. Afflictions here can cause disputes and separation tendencies.'
        },
        7: {
            name: 'Kalatra (Spouse)',
            keywords: ['Spouse', 'Marriage', 'Partnerships', 'Business', 'Foreign travel', 'Public dealings'],
            marriage: 'The primary house of marriage and spouse. Its lord, occupants, and aspects determine marriage quality, timing, and partner characteristics.'
        },
        8: {
            name: 'Ayu (Longevity)',
            keywords: ['Longevity', 'Transformation', 'Occult', 'Inheritance', 'Sudden events', 'Mangalya'],
            marriage: 'Represents mangalya (marital longevity), in-laws\' wealth, and transformative experiences in marriage. 8th from 7th is the 2nd house.'
        },
        9: {
            name: 'Dharma (Fortune)',
            keywords: ['Fortune', 'Dharma', 'Father', 'Guru', 'Long journeys', 'Higher learning'],
            marriage: 'Indicates fortune and dharmic alignment in marriage. 9th house strength shows blessings and spiritual compatibility.'
        },
        10: {
            name: 'Karma (Career)',
            keywords: ['Career', 'Status', 'Authority', 'Government', 'Father', 'Public image'],
            marriage: 'Shows how marriage affects career and social standing. Connections between 7th and 10th indicate marriage through profession.'
        },
        11: {
            name: 'Labha (Gains)',
            keywords: ['Gains', 'Friends', 'Desires', 'Income', 'Elder siblings', 'Fulfillment'],
            marriage: 'Represents fulfillment of desires including marriage. 11th house activation is essential for marriage materialization.'
        },
        12: {
            name: 'Vyaya (Losses)',
            keywords: ['Losses', 'Moksha', 'Foreign lands', 'Bed pleasures', 'Expenditure', 'Isolation'],
            marriage: 'Represents bed pleasures (sexual compatibility) and losses. Strong 12th with benefics gives good conjugal life.'
        }
    };

    // ===== Planet Effects in Each House (Marriage Context) =====
    var PLANET_IN_HOUSE_MARRIAGE = {
        Sun: {
            1: 'Strong personality; may dominate in relationships. Leadership qualities attract partners.',
            2: 'Authoritative in family matters. Government or paternal wealth supports married life.',
            3: 'Courageous and expressive. May have ego-driven communication issues.',
            4: 'Desire for a grand home. May have differences with mother-in-law.',
            5: 'Romantic and creative. May have issues with ego in love affairs.',
            6: 'Can overcome marital obstacles through authority. Health consciousness.',
            7: 'Spouse may be authoritative or from a respectable family. Late marriage possible.',
            8: 'Challenges to marital longevity. Transformation through marriage.',
            9: 'Dharmic approach to marriage. Father supportive of union.',
            10: 'Career-oriented; may delay marriage for profession. Status through marriage.',
            11: 'Gains through marriage. Influential social circle supports married life.',
            12: 'Expenses through marriage. Spouse may be from foreign land.'
        },
        Moon: {
            1: 'Emotional and nurturing partner. Attractive personality draws relationships.',
            2: 'Emotional about family and finances. Fluctuating family income.',
            3: 'Emotionally expressive. Good communication with partner.',
            4: 'Deep attachment to home and mother. Domestic happiness through emotional connection.',
            5: 'Romantic and emotionally creative. Strong desire for children.',
            6: 'Emotional health issues. May attract dependent partners.',
            7: 'Spouse is caring and emotional. Marriage brings emotional fulfillment.',
            8: 'Emotional upheavals in marriage. Deep psychological bond with spouse.',
            9: 'Emotional connection to spirituality. Mother-like care in marriage.',
            10: 'Public image enhanced through marriage. Career fluctuations after marriage.',
            11: 'Emotional gains through marriage. Many friends support marital life.',
            12: 'Expenses on comforts. Good bed pleasures. Emotional isolation possible.'
        },
        Mars: {
            1: 'Manglik dosha. Aggressive and passionate. Strong physical drive in marriage.',
            2: 'Harsh speech may cause family discord. Financial aggression.',
            3: 'Courageous and adventurous partner. Sibling-like dynamic with spouse.',
            4: 'Disputes about property. May have a fiery domestic environment.',
            5: 'Passionate romance. May have issues with children or impulsive love.',
            6: 'Overcomes enemies and debts. Competitive nature in relationships.',
            7: 'Manglik dosha (strongest). Passionate but potentially conflictual marriage.',
            8: 'Manglik dosha. Danger to marital longevity. Intense transformations.',
            9: 'Aggressive about beliefs. Father may oppose marriage.',
            10: 'Career-driven; may neglect marriage. Professional success through energy.',
            11: 'Gains through courage and initiative. Marriage desires fulfilled through effort.',
            12: 'Expenses through aggression. Passionate bed pleasures. Foreign connections.'
        },
        Mercury: {
            1: 'Communicative and youthful personality. Attracts intellectual partners.',
            2: 'Good family communication. Wealth through intellect and trade.',
            3: 'Excellent communication skills. Writing/media connections in marriage.',
            4: 'Intellectual home environment. Education supports domestic happiness.',
            5: 'Intelligent approach to romance. Good for children\'s education.',
            6: 'Analytical approach to problems. Overcomes obstacles through intellect.',
            7: 'Spouse is communicative and intellectual. Business partnerships successful.',
            8: 'Research-oriented. May overanalyze marriage issues.',
            9: 'Philosophical communication. Academic pursuits enhance marriage.',
            10: 'Career in communication/trade. Professional networking aids marriage.',
            11: 'Gains through communication and networking. Intellectual friend circle.',
            12: 'May overthink losses. Writing/calculation work in isolation.'
        },
        Jupiter: {
            1: 'Wise and generous personality. Attracts good marriage prospects.',
            2: 'Wealth and wise speech. Strong family values support marriage.',
            3: 'Wise counsel to siblings. Good-natured communication.',
            4: 'Great domestic happiness. Education and wisdom in the home.',
            5: 'Excellent for children and romance. Wise love and creative intelligence.',
            6: 'Overcomes obstacles through wisdom. Health and debt management through knowledge.',
            7: 'Excellent for marriage. Wise and dharmic spouse. Happy partnership.',
            8: 'Long life. Spiritual transformation through marriage.',
            9: 'Highly auspicious. Dharmic marriage with spiritual growth.',
            10: 'Success and status. Marriage brings career advancement.',
            11: 'Great gains and fulfillment. All desires including marriage are realized.',
            12: 'Spiritual liberation. Generous spending. Good conjugal relations.'
        },
        Venus: {
            1: 'Attractive and charming. Natural ability to attract relationships.',
            2: 'Wealth and luxury. Beautiful speech and family harmony.',
            3: 'Artistic communication. Younger siblings may help in marriage matters.',
            4: 'Beautiful home and vehicles. Great domestic comfort and luxury.',
            5: 'Excellent for romance and love. Creative and romantic personality.',
            6: 'May attract problematic relationships initially. Overcomes through charm.',
            7: 'Best placement for marriage. Beautiful, loving, and compatible spouse.',
            8: 'Intense sexual bond. Wealth through marriage. Transformative love.',
            9: 'Fortunate in love. Marriage brings spiritual and material growth.',
            10: 'Career in arts/luxury. Marriage enhances public image.',
            11: 'All desires fulfilled including marriage. Gains through spouse.',
            12: 'Excellent bed pleasures. Luxury expenses. Foreign pleasures.'
        },
        Saturn: {
            1: 'Serious and mature personality. Delayed marriage but lasting commitment.',
            2: 'Financial restrictions early. Serious family values. Steady growth.',
            3: 'Disciplined efforts. May have strained sibling relations.',
            4: 'Delayed domestic happiness. Property matters take time.',
            5: 'Delayed romance and children. Serious approach to love.',
            6: 'Good for overcoming enemies and disease. Service-oriented.',
            7: 'Delayed marriage. Older or mature spouse. Commitment-oriented union.',
            8: 'Long life. Chronic issues in marriage. Deep karmic bond.',
            9: 'Delayed fortune. Structured approach to dharma and beliefs.',
            10: 'Excellent for career. Hard-working. Marriage may suffer due to work.',
            11: 'Steady gains over time. Desires fulfilled through patience.',
            12: 'Isolation and spiritual growth. Expenses on long-term investments.'
        },
        Rahu: {
            1: 'Unconventional personality. Attracts unusual marriage situations.',
            2: 'Obsession with wealth. Unconventional family dynamics.',
            3: 'Bold and daring communication. Breaks traditional boundaries.',
            4: 'Restlessness at home. Foreign property or unusual living.',
            5: 'Unconventional romance. May have affairs or unusual love stories.',
            6: 'Powerful over enemies. May attract unusual health issues.',
            7: 'Unconventional marriage. Spouse may be from different culture/background.',
            8: 'Intense transformations. Interest in occult. Sudden changes in marriage.',
            9: 'Unconventional beliefs. Foreign connections in marriage.',
            10: 'Ambitious career. Sudden rise. Marriage affected by ambition.',
            11: 'Great gains through unconventional means. Desires fulfilled unexpectedly.',
            12: 'Foreign settlement. Unusual expenses. Karmic patterns in marriage.'
        },
        Ketu: {
            1: 'Spiritual and detached personality. May lack interest in worldly marriage.',
            2: 'Detachment from family wealth. Spiritual speech.',
            3: 'Courageous but detached. Past life skills in communication.',
            4: 'Detachment from home comforts. Spiritual environment.',
            5: 'Detachment from romance. Past life children karmas.',
            6: 'Good for overcoming enemies spiritually. Unusual health patterns.',
            7: 'Detachment in marriage. Spiritual partner. Past life marital karma.',
            8: 'Deep spiritual transformation. Mystical experiences in marriage.',
            9: 'Natural spiritual inclination. Guru-like approach to marriage.',
            10: 'Detachment from career ambitions. Service-oriented work.',
            11: 'Spiritual gains. Detachment from material desires.',
            12: 'Excellent for moksha. Final liberation. Minimal worldly attachment.'
        }
    };

    // ===== Marriage-Relevant Yogas =====
    function findMarriageYogas(chart) {
        var yogas = [];
        var planets = chart.planets;
        var houses = chart.houses.houses;

        // Helper: get lord of a house
        function getHouseLord(houseNum) {
            return houses[houseNum - 1].lord;
        }

        // Helper: get house of a planet
        function getPlanetHouse(planetName) {
            return planets[planetName].house;
        }

        // Helper: check if two planets are in same house
        function inSameHouse(p1, p2) {
            return getPlanetHouse(p1) === getPlanetHouse(p2);
        }

        // 1. Kalatra Yoga - 7th lord well placed
        var lord7 = getHouseLord(7);
        var lord7House = getPlanetHouse(lord7);
        if (lord7House === 1 || lord7House === 2 || lord7House === 4 || lord7House === 5 ||
            lord7House === 7 || lord7House === 9 || lord7House === 10 || lord7House === 11) {
            yogas.push({
                name: 'Kalatra Yoga',
                description: '7th lord ' + lord7 + ' is well placed in house ' + lord7House + '. Indicates a good spouse and happy marriage.',
                strength: 'Positive',
                score: 8
            });
        }

        // 2. Venus in own sign or exalted
        var venusRashi = planets.Venus.rashiIndex;
        if (venusRashi === 1 || venusRashi === 6 || venusRashi === 11) {  // Taurus, Libra, Pisces (exalted)
            yogas.push({
                name: 'Shukra Bala Yoga',
                description: 'Venus is strong in ' + planets.Venus.rashi + '. Indicates love, luxury, and marital happiness.',
                strength: 'Positive',
                score: 9
            });
        }

        // 3. Jupiter aspecting 7th house
        var jupiterHouse = getPlanetHouse('Jupiter');
        var jupiterAspects7 = (jupiterHouse === 1 || jupiterHouse === 3 || jupiterHouse === 5 ||
                               jupiterHouse === 7 || jupiterHouse === 9 || jupiterHouse === 11);
        if (jupiterAspects7) {
            yogas.push({
                name: 'Guru Drishti on 7th',
                description: 'Jupiter aspects the 7th house from house ' + jupiterHouse + '. Blesses marriage with wisdom and dharma.',
                strength: 'Positive',
                score: 7
            });
        }

        // 4. Venus-Jupiter conjunction or mutual aspect
        if (inSameHouse('Venus', 'Jupiter')) {
            yogas.push({
                name: 'Venus-Jupiter Conjunction',
                description: 'Venus and Jupiter together in house ' + getPlanetHouse('Venus') + '. Excellent for marriage and happiness.',
                strength: 'Positive',
                score: 9
            });
        }

        // 5. 7th lord in 6th, 8th, or 12th (Kalatra Dosha)
        if (lord7House === 6 || lord7House === 8 || lord7House === 12) {
            yogas.push({
                name: 'Kalatra Dosha',
                description: '7th lord ' + lord7 + ' is in dusthana house ' + lord7House + '. May indicate challenges in marriage.',
                strength: 'Negative',
                score: -6
            });
        }

        // 6. Manglik Dosha check
        var marsHouse = getPlanetHouse('Mars');
        if (marsHouse === 1 || marsHouse === 4 || marsHouse === 7 || marsHouse === 8 || marsHouse === 12) {
            var cancellation = false;
            // Check cancellations
            if (marsHouse === 1 && houses[0].rashiIndex === 0) cancellation = true; // Mars in Aries ascendant
            if (marsHouse === 4 && houses[3].rashiIndex === 3) cancellation = true; // Mars in own sign 4th
            if (marsHouse === 7 && houses[6].rashiIndex === 0) cancellation = true; // Mars in Aries 7th
            if (marsHouse === 8 && houses[7].rashiIndex === 7) cancellation = true; // Mars in Scorpio 8th

            if (!cancellation) {
                yogas.push({
                    name: 'Manglik Dosha',
                    description: 'Mars in house ' + marsHouse + ' creates Manglik Dosha. Partner should also be Manglik or have cancellation.',
                    strength: 'Negative',
                    score: -5
                });
            } else {
                yogas.push({
                    name: 'Manglik Dosha (Cancelled)',
                    description: 'Mars in house ' + marsHouse + ' but dosha is cancelled due to sign placement.',
                    strength: 'Neutral',
                    score: 0
                });
            }
        }

        // 7. 2nd lord and 11th lord connection (family and gains through marriage)
        var lord2 = getHouseLord(2);
        var lord11 = getHouseLord(11);
        if (inSameHouse(lord2, lord11) || getPlanetHouse(lord2) === 11 || getPlanetHouse(lord11) === 2) {
            yogas.push({
                name: 'Dhana-Labha Yoga',
                description: '2nd lord (' + lord2 + ') and 11th lord (' + lord11 + ') are connected. Wealth and gains through marriage.',
                strength: 'Positive',
                score: 6
            });
        }

        // 8. Saturn aspecting 7th (delay but stability)
        var saturnHouse = getPlanetHouse('Saturn');
        var saturnAspects7 = (saturnHouse === 1 || saturnHouse === 4 || saturnHouse === 5 || saturnHouse === 7);
        if (saturnAspects7) {
            yogas.push({
                name: 'Saturn Aspect on 7th',
                description: 'Saturn aspects 7th house from house ' + saturnHouse + '. May delay marriage but gives stability once married.',
                strength: 'Mixed',
                score: -2
            });
        }

        // 9. Rahu in 7th (unconventional marriage)
        if (getPlanetHouse('Rahu') === 7) {
            yogas.push({
                name: 'Rahu in 7th',
                description: 'Rahu in 7th house indicates unconventional or inter-cultural marriage. Deception possible.',
                strength: 'Mixed',
                score: -3
            });
        }

        // 10. 5th-7th lord connection (love marriage)
        var lord5 = getHouseLord(5);
        if (inSameHouse(lord5, lord7) || getPlanetHouse(lord5) === 7 || getPlanetHouse(lord7) === 5) {
            yogas.push({
                name: 'Love Marriage Yoga',
                description: '5th lord (' + lord5 + ') and 7th lord (' + lord7 + ') are connected. Strong indication of love marriage.',
                strength: 'Positive',
                score: 7
            });
        }

        // 11. Benefics in 7th house
        var beneficsIn7 = [];
        ['Jupiter', 'Venus', 'Mercury', 'Moon'].forEach(function(p) {
            if (getPlanetHouse(p) === 7) beneficsIn7.push(p);
        });
        if (beneficsIn7.length > 0) {
            yogas.push({
                name: 'Benefics in 7th House',
                description: beneficsIn7.join(', ') + ' in 7th house. Blesses marriage with harmony and happiness.',
                strength: 'Positive',
                score: 6
            });
        }

        // 12. Malefics in 7th house (excluding Mars which is handled by Manglik)
        var maleficsIn7 = [];
        ['Saturn', 'Rahu', 'Ketu', 'Sun'].forEach(function(p) {
            if (getPlanetHouse(p) === 7) maleficsIn7.push(p);
        });
        if (maleficsIn7.length > 0 && getPlanetHouse('Mars') !== 7) {
            yogas.push({
                name: 'Malefics in 7th House',
                description: maleficsIn7.join(', ') + ' in 7th house. May cause difficulties and delays in marriage.',
                strength: 'Negative',
                score: -4
            });
        }

        return yogas;
    }

    // ===== House Lord Placement Analysis =====
    function analyzeHouseLords(chart) {
        var analysis = [];
        var houses = chart.houses.houses;
        var planets = chart.planets;

        for (var h = 1; h <= 12; h++) {
            var lord = houses[h - 1].lord;
            var lordHouse = planets[lord].house;
            var lordRashi = planets[lord].rashi;
            var lordNakshatra = planets[lord].nakshatra;

            var marriageRelevance = '';
            if (h === 7) {
                marriageRelevance = 'CRITICAL: 7th lord placement directly determines marriage quality. ';
                if (lordHouse === 1) marriageRelevance += 'Spouse devoted to native.';
                else if (lordHouse === 2) marriageRelevance += 'Marriage brings family wealth.';
                else if (lordHouse === 4) marriageRelevance += 'Domestic happiness through marriage.';
                else if (lordHouse === 5) marriageRelevance += 'Love marriage or romantic partner.';
                else if (lordHouse === 9) marriageRelevance += 'Fortunate marriage, dharmic partner.';
                else if (lordHouse === 10) marriageRelevance += 'Marriage through profession.';
                else if (lordHouse === 11) marriageRelevance += 'Marriage fulfills desires.';
                else if (lordHouse === 6) marriageRelevance += 'Conflicts and opposition in marriage.';
                else if (lordHouse === 8) marriageRelevance += 'Challenges to marital longevity.';
                else if (lordHouse === 12) marriageRelevance += 'Expenses through marriage; foreign connection.';
            } else if (h === 2 || h === 11) {
                marriageRelevance = 'Supporting house for marriage materialization. Lord in house ' + lordHouse + '.';
            } else if (h === 5) {
                marriageRelevance = 'Romance house. Lord in house ' + lordHouse + ' shows romance patterns.';
            }

            analysis.push({
                house: h,
                houseName: HOUSE_SIGNIFICATIONS[h].name,
                lord: lord,
                lordHouse: lordHouse,
                lordRashi: lordRashi,
                lordNakshatra: lordNakshatra,
                marriageRelevance: marriageRelevance
            });
        }

        return analysis;
    }

    // ===== Overall BPHS Compatibility Assessment =====
    function assessCompatibility(boyChart, girlChart) {
        var boyYogas = findMarriageYogas(boyChart);
        var girlYogas = findMarriageYogas(girlChart);

        var boyScore = 0;
        var girlScore = 0;

        boyYogas.forEach(function(y) { boyScore += y.score; });
        girlYogas.forEach(function(y) { girlScore += y.score; });

        // Normalize to percentage (max possible ~40, min possible ~-20)
        var boyPct = Math.max(0, Math.min(100, ((boyScore + 20) / 60) * 100));
        var girlPct = Math.max(0, Math.min(100, ((girlScore + 20) / 60) * 100));
        var overallPct = (boyPct + girlPct) / 2;

        // Cross-chart analysis
        var crossFactors = [];

        // Check if boy's 7th lord aspects girl's ascendant lord and vice versa
        var boy7Lord = boyChart.houses.houses[6].lord;
        var girl7Lord = girlChart.houses.houses[6].lord;

        if (boy7Lord === girl7Lord) {
            crossFactors.push({ factor: 'Same 7th house lord', effect: 'Strong karmic marriage bond.', score: 5 });
        }

        // Check Rashi exchange or mutual aspects of 7th lords
        var boy7LordHouse = boyChart.planets[boy7Lord].house;
        var girl7LordHouse = girlChart.planets[girl7Lord].house;

        if (boy7LordHouse === 7 || girl7LordHouse === 7) {
            crossFactors.push({ factor: '7th lord in own house', effect: 'Strong marriage promise.', score: 4 });
        }

        // Venus compatibility
        var boyVenusRashi = boyChart.planets.Venus.rashiIndex;
        var girlVenusRashi = girlChart.planets.Venus.rashiIndex;
        if (boyVenusRashi === girlVenusRashi) {
            crossFactors.push({ factor: 'Venus in same sign', effect: 'Similar romantic values and love expression.', score: 4 });
        }

        var crossScore = 0;
        crossFactors.forEach(function(f) { crossScore += f.score; });
        overallPct = Math.min(100, overallPct + crossScore);

        var verdict = '';
        if (overallPct >= 75) verdict = 'Excellent marriage compatibility. Strong BPHS indicators for a happy and lasting union.';
        else if (overallPct >= 60) verdict = 'Good marriage compatibility. Positive indicators outweigh challenges.';
        else if (overallPct >= 45) verdict = 'Moderate compatibility. Some challenges need attention but marriage can work with effort.';
        else if (overallPct >= 30) verdict = 'Below average compatibility. Significant challenges indicated. Remedies recommended.';
        else verdict = 'Challenging compatibility. Major obstacles indicated. Thorough analysis and remedies strongly recommended.';

        return {
            boyYogas: boyYogas,
            girlYogas: girlYogas,
            boyScore: boyPct.toFixed(1),
            girlScore: girlPct.toFixed(1),
            overallScore: overallPct.toFixed(1),
            crossFactors: crossFactors,
            verdict: verdict
        };
    }

    // ===== Planet-in-House Analysis for Marriage =====
    function getPlanetHouseAnalysis(chart) {
        var analysis = [];
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        planetNames.forEach(function(name) {
            var house = chart.planets[name].house;
            var effect = PLANET_IN_HOUSE_MARRIAGE[name][house] || 'General influence on house ' + house + '.';
            analysis.push({
                planet: name,
                house: house,
                rashi: chart.planets[name].rashi,
                effect: effect
            });
        });

        return analysis;
    }

    // ===== Public API =====
    return {
        HOUSE_SIGNIFICATIONS: HOUSE_SIGNIFICATIONS,
        PLANET_IN_HOUSE_MARRIAGE: PLANET_IN_HOUSE_MARRIAGE,
        findMarriageYogas: findMarriageYogas,
        analyzeHouseLords: analyzeHouseLords,
        assessCompatibility: assessCompatibility,
        getPlanetHouseAnalysis: getPlanetHouseAnalysis
    };
})();

/* =============================================================================
 * bhava-indications.js  —  Detailed house-by-house indications
 *
 * For each of the 12 Bhavas, provides:
 *   1. What the house generally indicates (characteristics, physical features,
 *      mentality, life areas).
 *   2. Sign-based & planet-based interpretations used to derive a textual
 *      description of a person's traits from their specific chart.
 *   3. A compatibility function that compares two charts house-by-house and
 *      returns a verdict per house.
 * ========================================================================== */

const BhavaIndications = (function () {
  'use strict';

  /* ======================================================================
   * WHAT EACH HOUSE INDICATES (general significations + marriage context)
   * ==================================================================== */
  const HOUSE_DATA = {
    1: {
      name: '1st House (Lagna / Tanu Bhāva)',
      domain: 'Self, Personality & Physical Appearance',
      indicates: [
        'Physical build, complexion, overall attractiveness',
        'General temperament and disposition',
        'Self-confidence and outward personality',
        'Health constitution and vitality',
        'First impression one makes on others',
        'How the person approaches life and relationships',
      ],
      marriage: 'Indicates overall personality compatibility — how the two people appear, behave, and present to each other daily.',
    },
    2: {
      name: '2nd House (Dhana / Kutumba Bhāva)',
      domain: 'Family, Wealth, Speech & Values',
      indicates: [
        'Family background and upbringing',
        'Manner of speech — soft, harsh, eloquent, reserved',
        'Accumulated wealth and earning ability',
        'Food habits and dietary preferences',
        'Face and facial features',
        'Values, truthfulness, and family loyalty',
      ],
      marriage: 'Critical for married life — shows family harmony (kutumba sthana), financial stability, communication style between spouses, and how they nourish each other.',
    },
    3: {
      name: '3rd House (Sahaja / Parākrama Bhāva)',
      domain: 'Courage, Communication & Effort',
      indicates: [
        'Courage, willpower and initiative',
        'Siblings and relationship with them',
        'Communication skills — writing, media, expression',
        'Short travels and daily movements',
        'Hobbies, interests, creative pursuits',
        'Mental strength and determination',
      ],
      marriage: 'Shows how actively each partner pursues goals, supports each other, and communicates desires and needs.',
    },
    4: {
      name: '4th House (Sukha / Mātru Bhāva)',
      domain: 'Home, Comfort, Mother & Emotions',
      indicates: [
        'Domestic happiness and home environment',
        'Relationship with mother and maternal influences',
        'Emotional security and inner peace',
        'Property, vehicles, material comforts',
        'Educational attainment',
        'Heart and chest region (physical)',
      ],
      marriage: 'Reveals domestic harmony — whether the couple will have a happy home, emotional bonding, and mutual comfort in daily life.',
    },
    5: {
      name: '5th House (Putra / Suta Bhāva)',
      domain: 'Romance, Children, Intelligence & Creativity',
      indicates: [
        'Romance, love affairs, and attraction style',
        'Children and fertility',
        'Intelligence and wisdom',
        'Creative expression and artistic talent',
        'Past-life merit (pūrva-punya)',
        'Speculative ability and decision-making',
      ],
      marriage: 'Core house for romantic love, mutual attraction, and progeny — shows how the couple expresses love and their prospects for children.',
    },
    6: {
      name: '6th House (Ari / Ripu Bhāva)',
      domain: 'Conflicts, Health Issues & Daily Routine',
      indicates: [
        'Tendency toward disputes and litigation',
        'Daily health issues and disease patterns',
        'Debts and financial liabilities',
        'Work ethic and service mentality',
        'Enemies, competitors, obstacles',
        'Digestive health and immunity',
      ],
      marriage: 'Indicates potential areas of conflict, health challenges during married life, and how each partner handles disagreements and obstacles.',
    },
    7: {
      name: '7th House (Kalatra / Yuvati Bhāva)',
      domain: 'Spouse, Marriage & Partnership',
      indicates: [
        'Nature and appearance of the spouse',
        'Quality and longevity of marriage',
        'Business partnerships and public dealings',
        'Sexual compatibility and intimacy',
        'Social grace and diplomatic ability',
        'Desire for companionship',
      ],
      marriage: 'THE prime house of marriage — directly shows what kind of partner is destined, the quality of the marital bond, and sexual harmony.',
    },
    8: {
      name: '8th House (Āyur / Randhra Bhāva)',
      domain: 'Longevity, Transformation & Secrets',
      indicates: [
        'Longevity and manner of death (health crises)',
        'Chronic health conditions',
        'In-laws and their wealth/support',
        'Hidden matters, secrets, occult interests',
        'Sudden upheavals and transformations',
        'Marital intimacy (bed pleasures) and depth of bond',
      ],
      marriage: 'Reveals hidden dynamics — in-law issues, financial surprises, the depth (or turbulence) of intimacy, and longevity of the union.',
    },
    9: {
      name: '9th House (Dharma / Bhāgya Bhāva)',
      domain: 'Fortune, Dharma, Father & Higher Wisdom',
      indicates: [
        'Luck and divine blessings on the union',
        'Righteousness, ethics, and moral compass',
        'Father and relationship with him',
        'Long-distance travel',
        'Higher education, philosophy, spiritual inclination',
        'Guru/teacher influence',
      ],
      marriage: 'Shows how fortune and dharmic alignment bless the marriage — shared spiritual values, luck factor, and support from elders/father.',
    },
    10: {
      name: '10th House (Karma / Rājya Bhāva)',
      domain: 'Career, Status & Public Image',
      indicates: [
        'Career and professional achievement',
        'Public reputation and social standing',
        'Authority, leadership, ambition',
        'Relationship with authority figures',
        'Karma and life purpose',
        'Knees and skeletal structure (physical)',
      ],
      marriage: 'Indicates how career and ambition interact with married life — whether partners support or compete with each other professionally, and their social standing as a couple.',
    },
    11: {
      name: '11th House (Lābha / Āya Bhāva)',
      domain: 'Gains, Desires, Friends & Fulfilment',
      indicates: [
        'Fulfilment of desires and aspirations',
        'Income and gains from profession',
        'Social network, friends, communities',
        'Elder siblings',
        'Opportunities and windfalls',
        'Collective / group activities',
      ],
      marriage: 'The house of wish-fulfilment — indicates whether the couple\'s desires (including the desire for marriage itself) will be realised, and their social support network.',
    },
    12: {
      name: '12th House (Vyaya / Moksha Bhāva)',
      domain: 'Expenditure, Bed Pleasures & Spirituality',
      indicates: [
        'Expenditure patterns and financial losses',
        'Bed pleasures (shayya-sukha) and physical intimacy',
        'Foreign travel and life abroad',
        'Hospitals, isolation, confinement',
        'Spiritual liberation and detachment',
        'Sleep quality and subconscious patterns',
      ],
      marriage: 'Reveals physical intimacy satisfaction (bed pleasures), financial drain potential, and whether one or both partners may live abroad or face periods of separation.',
    },
  };

  /* ======================================================================
   * SIGN-BASED PERSONALITY TRAITS (concise per-sign descriptions)
   * ==================================================================== */
  const SIGN_TRAITS = {
    Aries:       { physique: 'Athletic, medium height, sharp features', temperament: 'Bold, assertive, impatient, pioneering', element: 'Fire — energetic and action-oriented' },
    Taurus:      { physique: 'Sturdy, attractive, well-proportioned', temperament: 'Steady, patient, pleasure-loving, stubborn', element: 'Earth — grounded and sensual' },
    Gemini:      { physique: 'Slim, youthful look, expressive eyes', temperament: 'Intellectual, communicative, versatile, restless', element: 'Air — curious and adaptable' },
    Cancer:      { physique: 'Round face, soft features, nurturing aura', temperament: 'Emotional, caring, moody, protective', element: 'Water — sensitive and intuitive' },
    Leo:         { physique: 'Tall/broad, dignified bearing, prominent hair', temperament: 'Confident, generous, proud, dramatic', element: 'Fire — charismatic and leadership-oriented' },
    Virgo:       { physique: 'Delicate, youthful, neat appearance', temperament: 'Analytical, service-minded, critical, perfectionist', element: 'Earth — practical and detail-focused' },
    Libra:       { physique: 'Graceful, well-proportioned, attractive', temperament: 'Diplomatic, relationship-oriented, indecisive, aesthetic', element: 'Air — social and harmony-seeking' },
    Scorpio:     { physique: 'Intense eyes, magnetic presence, compact build', temperament: 'Passionate, secretive, determined, transformative', element: 'Water — deep and penetrating' },
    Sagittarius: { physique: 'Tall, athletic, cheerful countenance', temperament: 'Optimistic, philosophical, adventurous, blunt', element: 'Fire — expansive and freedom-loving' },
    Capricorn:   { physique: 'Lean, bony structure, serious face', temperament: 'Ambitious, disciplined, reserved, pragmatic', element: 'Earth — structured and goal-driven' },
    Aquarius:    { physique: 'Tall, unconventional look, pleasant face', temperament: 'Humanitarian, independent, eccentric, intellectual', element: 'Air — progressive and detached' },
    Pisces:      { physique: 'Soft features, dreamy eyes, gentle build', temperament: 'Compassionate, imaginative, escapist, spiritual', element: 'Water — empathetic and transcendent' },
  };

  /* ======================================================================
   * PLANET-IN-HOUSE INFLUENCES (how occupants modify house characteristics)
   * ==================================================================== */
  const PLANET_INFLUENCE = {
    Sun:     { pos: 'confidence, authority, leadership quality', neg: 'ego issues, domineering tendency' },
    Moon:    { pos: 'emotional depth, nurturing nature, sensitivity', neg: 'mood swings, over-attachment' },
    Mars:    { pos: 'courage, energy, passion, drive', neg: 'aggression, impatience, conflict tendency' },
    Mercury: { pos: 'intelligence, communication skill, adaptability', neg: 'nervousness, overthinking, fickleness' },
    Jupiter: { pos: 'wisdom, generosity, optimism, good fortune', neg: 'overindulgence, over-confidence' },
    Venus:   { pos: 'beauty, charm, artistic taste, romantic nature', neg: 'excessive pleasure-seeking, vanity' },
    Saturn:  { pos: 'discipline, responsibility, endurance, maturity', neg: 'delays, pessimism, coldness, restriction' },
    Rahu:    { pos: 'ambition, unconventional thinking, worldly drive', neg: 'obsession, deception, dissatisfaction' },
    Ketu:    { pos: 'spiritual insight, detachment, past-life wisdom', neg: 'confusion, isolation, disinterest' },
  };

  /* ======================================================================
   * GENERATE INTERPRETATION for one house of one chart
   * ==================================================================== */
  function interpretHouse(houseNum, chart) {
    const hd = HOUSE_DATA[houseNum];
    const sign = (chart.ascendant.sign + houseNum - 1) % 12;
    const signName = Astro.RASHIS[sign];
    const signT = SIGN_TRAITS[signName];
    const lord = Astro.RASHI_LORD[sign];
    const lordPl = chart.planets[lord];
    const occ = BPHS.occupants(houseNum, chart);
    const asp = BPHS.aspectingPlanets(houseNum, chart);
    const strength = BPHS.bhavaStrength(houseNum, chart);

    const characteristics = [];
    // Sign-based
    characteristics.push(`${signName} rising in this house: ${signT.physique}; ${signT.temperament}`);
    characteristics.push(`Elemental nature: ${signT.element}`);

    // Lord-based
    const lordDig = BPHS.dignity(lord, chart);
    let lordNote = `House lord ${lord} is placed in House ${lordPl.house} (${lordDig.label})`;
    if (lordPl.house === houseNum) lordNote += ' — strengthens this house\'s significations';
    if ([6, 8, 12].includes(lordPl.house)) lordNote += ' — weakens this house (lord in dusthana)';
    if ([1, 4, 7, 10].includes(lordPl.house)) lordNote += ' — well-placed in kendra';
    characteristics.push(lordNote);

    // Occupants
    if (occ.length > 0) {
      occ.forEach((p) => {
        const inf = PLANET_INFLUENCE[p];
        const pRetro = chart.planets[p].retro ? ' (retrograde — intensified/internalized)' : '';
        characteristics.push(`${p} present${pRetro}: brings ${inf.pos}; watch for ${inf.neg}`);
      });
    } else {
      characteristics.push('No planets occupy this house — significations depend primarily on the lord');
    }

    // Aspects
    if (asp.length > 0) {
      asp.forEach((p) => {
        const inf = PLANET_INFLUENCE[p];
        const isBenefic = BPHS.NAT_BENEFIC.includes(p);
        characteristics.push(`Aspected by ${p} (${isBenefic ? 'benefic' : 'malefic'}): adds ${isBenefic ? inf.pos : inf.pos + '; caution on ' + inf.neg}`);
      });
    }

    return {
      houseNum,
      houseName: hd.name,
      domain: hd.domain,
      generalIndicates: hd.indicates,
      marriageRelevance: hd.marriage,
      signName,
      lord,
      lordHouse: lordPl.house,
      lordDignity: lordDig.label,
      occupants: occ,
      aspects: asp,
      characteristics,
      score: strength.score,
    };
  }

  /* ======================================================================
   * COMPARE TWO CHARTS — house by house
   * For each house, generate boy/girl interpretations, then derive a
   * compatibility result.
   * ==================================================================== */
  function compareHouse(houseNum, boyChart, girlChart) {
    const boy = interpretHouse(houseNum, boyChart);
    const girl = interpretHouse(houseNum, girlChart);
    const hd = HOUSE_DATA[houseNum];

    // Compatibility logic
    const factors = [];
    let compat = 50;

    // 1. Sign compatibility (same element = harmonious, opposite = challenging)
    const bEl = Astro.RASHI_ELEMENT[boy.signName ? Astro.RASHIS.indexOf(boy.signName) : 0];
    const gEl = Astro.RASHI_ELEMENT[girl.signName ? Astro.RASHIS.indexOf(girl.signName) : 0];
    if (bEl === gEl) { compat += 12; factors.push('Same element — natural affinity and understanding'); }
    else if ((bEl === 0 && gEl === 2) || (bEl === 2 && gEl === 0)) { compat += 8; factors.push('Fire-Air combination — stimulating and expansive'); }
    else if ((bEl === 1 && gEl === 3) || (bEl === 3 && gEl === 1)) { compat += 8; factors.push('Earth-Water combination — nurturing and productive'); }
    else if ((bEl === 0 && gEl === 3) || (bEl === 3 && gEl === 0)) { compat -= 5; factors.push('Fire-Water — can be steamy but also volatile'); }
    else if ((bEl === 1 && gEl === 2) || (bEl === 2 && gEl === 1)) { compat -= 3; factors.push('Earth-Air — different priorities; needs adjustment'); }
    else { compat += 3; factors.push('Different but not opposing elements'); }

    // 2. Lord relationship
    if (boy.lord === girl.lord) { compat += 10; factors.push(`Same lord (${boy.lord}) — shared planetary energy brings alignment`); }
    else {
      const rel = Astro.relation(boy.lord, girl.lord);
      if (rel === 'friend') { compat += 7; factors.push(`Lords are friends (${boy.lord} & ${girl.lord}) — harmonious`); }
      else if (rel === 'enemy') { compat -= 6; factors.push(`Lords are enemies (${boy.lord} & ${girl.lord}) — friction possible`); }
      else { compat += 2; factors.push(`Lords are neutral (${boy.lord} & ${girl.lord})`); }
    }

    // 3. Strength balance — both strong is best; one weak can be carried; both weak is concern
    const avgStr = (boy.score + girl.score) / 2;
    if (avgStr >= 65) { compat += 8; factors.push('Both partners show strength in this area'); }
    else if (avgStr >= 50) { compat += 3; factors.push('Adequate strength; one partner may need to support the other'); }
    else { compat -= 5; factors.push('Both show weakness here — area needs conscious attention'); }

    // 4. Malefic occupants in BOTH (mutual difficulty)
    const bMal = boy.occupants.filter((p) => BPHS.NAT_MALEFIC.includes(p)).length;
    const gMal = girl.occupants.filter((p) => BPHS.NAT_MALEFIC.includes(p)).length;
    if (bMal > 0 && gMal > 0) { compat -= 6; factors.push('Malefics in this house for both — shared challenge'); }
    else if (bMal > 0 || gMal > 0) { compat -= 2; factors.push('Malefic presence for one partner — manageable'); }
    else if (boy.occupants.some((p) => BPHS.NAT_BENEFIC.includes(p)) && girl.occupants.some((p) => BPHS.NAT_BENEFIC.includes(p))) {
      compat += 5; factors.push('Benefics in this house for both — mutually supportive');
    }

    // 5. Jupiter/Venus aspect (marriage-karaka blessing)
    const bJupAsp = boy.aspects.includes('Jupiter') || boy.aspects.includes('Venus');
    const gJupAsp = girl.aspects.includes('Jupiter') || girl.aspects.includes('Venus');
    if (bJupAsp && gJupAsp) { compat += 5; factors.push('Benefic aspects (Jupiter/Venus) for both — strong blessing'); }
    else if (bJupAsp || gJupAsp) { compat += 2; }

    compat = Math.max(5, Math.min(98, Math.round(compat)));

    let verdict;
    if (compat >= 70) verdict = { label: 'Excellent', cls: 'good' };
    else if (compat >= 55) verdict = { label: 'Good', cls: 'good' };
    else if (compat >= 40) verdict = { label: 'Mixed', cls: 'mid' };
    else verdict = { label: 'Challenging', cls: 'bad' };

    return {
      houseNum,
      houseName: hd.name,
      domain: hd.domain,
      generalIndicates: hd.indicates,
      marriageRelevance: hd.marriage,
      boy, girl,
      compatibility: compat,
      verdict,
      factors,
    };
  }

  function compareAll(boyChart, girlChart) {
    const results = [];
    for (let h = 1; h <= 12; h++) {
      results.push(compareHouse(h, boyChart, girlChart));
    }
    const avg = Math.round(results.reduce((s, r) => s + r.compatibility, 0) / 12);
    return { houses: results, averageCompat: avg };
  }

  return {
    HOUSE_DATA, SIGN_TRAITS, PLANET_INFLUENCE,
    interpretHouse, compareHouse, compareAll,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BhavaIndications;

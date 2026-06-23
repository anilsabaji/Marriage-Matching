/* =============================================================================
 * koota.js  —  Koota / Guna Milan matching
 *
 * Provides:
 *   (A) Ashtakoota (North-Indian Guna Milan) — 8 kootas, max 36 points
 *   (B) Dashakoota / Dasa Porutham (South-Indian) — 10 poruthams
 *
 * All computations use the Moon's sidereal Nakshatra and Rashi of each partner.
 * Boy = groom (vara), Girl = bride (vadhu/kanya).
 * ========================================================================== */

const Koota = (function () {
  'use strict';

  // Yoni animals index order
  const YONI_ANIMALS = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat',
    'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];
  const YONI_IDX = {};
  YONI_ANIMALS.forEach((a, i) => (YONI_IDX[a] = i));

  // 14x14 Yoni compatibility matrix (0-4). 4=same, 0=mortal-enemy pairs.
  const YONI_MATRIX = [
    [4, 2, 2, 3, 2, 2, 2, 3, 0, 1, 3, 2, 2, 1],
    [2, 4, 3, 3, 2, 2, 2, 2, 3, 2, 2, 3, 2, 0],
    [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
    [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
    [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
    [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 2],
    [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
    [3, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 2],
    [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 2],
    [1, 2, 1, 2, 1, 1, 2, 0, 1, 4, 2, 1, 2, 2],
    [3, 2, 2, 2, 0, 3, 2, 3, 2, 2, 4, 2, 2, 2],
    [2, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 2, 3],
    [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 2, 4, 2],
    [1, 0, 1, 2, 1, 2, 2, 2, 2, 2, 2, 3, 2, 4],
  ];

  // ---- Varna ----
  // Brahmin>Kshatriya>Vaishya>Shudra ranked 4..1, derived from sign element.
  function varnaOfSign(sign) {
    const el = Astro.RASHI_ELEMENT[sign]; // 0 fire,1 earth,2 air,3 water
    if (el === 3) return { name: 'Brahmin', rank: 4 };
    if (el === 0) return { name: 'Kshatriya', rank: 3 };
    if (el === 1) return { name: 'Vaishya', rank: 2 };
    return { name: 'Shudra', rank: 1 };
  }
  function varnaKoota(boySign, girlSign) {
    const b = varnaOfSign(boySign), g = varnaOfSign(girlSign);
    const score = b.rank >= g.rank ? 1 : 0;
    return { max: 1, score, boy: b.name, girl: g.name,
      note: score ? `Groom varna (${b.name}) ≥ bride varna (${g.name})` :
        `Groom varna (${b.name}) below bride (${g.name}) — 0 points` };
  }

  // ---- Vashya ----
  function vashyaGroup(sign, deg) {
    switch (sign) {
      case 0: case 1: return 'Chatushpada';
      case 2: case 5: case 6: case 10: return 'Nara';
      case 3: case 11: return 'Jalachara';
      case 4: return 'Vanachara';
      case 7: return 'Keeta';
      case 8: return deg < 15 ? 'Nara' : 'Chatushpada';
      case 9: return deg < 15 ? 'Chatushpada' : 'Jalachara';
      default: return 'Nara';
    }
  }
  const VASHYA_PAIR = {
    'Chatushpada|Chatushpada': 2, 'Nara|Nara': 2, 'Jalachara|Jalachara': 2,
    'Vanachara|Vanachara': 2, 'Keeta|Keeta': 2,
    'Nara|Jalachara': 1, 'Nara|Chatushpada': 1, 'Nara|Keeta': 1, 'Nara|Vanachara': 0,
    'Chatushpada|Jalachara': 1, 'Chatushpada|Vanachara': 0, 'Chatushpada|Keeta': 1,
    'Jalachara|Vanachara': 1, 'Jalachara|Keeta': 0.5, 'Vanachara|Keeta': 1,
  };
  function vashyaKoota(boy, girl) {
    const gB = vashyaGroup(boy.sign, boy.degInSign);
    const gG = vashyaGroup(girl.sign, girl.degInSign);
    let key = `${gB}|${gG}`;
    let score = VASHYA_PAIR[key];
    if (score === undefined) score = VASHYA_PAIR[`${gG}|${gB}`];
    if (score === undefined) score = 0;
    return { max: 2, score, boy: gB, girl: gG, note: `${gB} (groom) vs ${gG} (bride)` };
  }

  // ---- Tara / Dina ----
  function taraRemainder(fromNak, toNak) {
    const count = ((toNak - fromNak + 27) % 27) + 1;
    let r = count % 9;
    if (r === 0) r = 9;
    return r;
  }
  function taraKoota(boyNak, girlNak) {
    const r1 = taraRemainder(girlNak, boyNak); // girl to boy
    const r2 = taraRemainder(boyNak, girlNak); // boy to girl
    const bad = [3, 5, 7];
    const ok1 = !bad.includes(r1);
    const ok2 = !bad.includes(r2);
    const score = (ok1 ? 1.5 : 0) + (ok2 ? 1.5 : 0);
    return { max: 3, score, r1, r2, note: `Tara remainders ${r1}/${r2} (bad if 3,5,7)` };
  }

  // ---- Yoni ----
  function yoniKoota(boyNak, girlNak) {
    const bA = Astro.NAK[boyNak].yoni, gA = Astro.NAK[girlNak].yoni;
    const score = YONI_MATRIX[YONI_IDX[bA]][YONI_IDX[gA]];
    return { max: 4, score, boy: bA, girl: gA, note: `${bA} (groom) & ${gA} (bride)` };
  }

  // ---- Graha Maitri / Rasyadhipathi ----
  function grahaMaitriKoota(boySign, girlSign) {
    const lB = Astro.RASHI_LORD[boySign], lG = Astro.RASHI_LORD[girlSign];
    let score;
    if (lB === lG) score = 5;
    else {
      const rA = Astro.relation(lB, lG), rB = Astro.relation(lG, lB);
      const pair = [rA, rB].sort().join('|');
      if (pair === 'friend|friend') score = 5;
      else if (pair === 'friend|neutral') score = 4;
      else if (pair === 'neutral|neutral') score = 3;
      else if (pair === 'enemy|friend') score = 1;
      else if (pair === 'enemy|neutral') score = 0.5;
      else if (pair === 'enemy|enemy') score = 0;
      else score = 3;
    }
    return { max: 5, score, boy: lB, girl: lG, note: `Lords ${lB} (groom) & ${lG} (bride)` };
  }

  // ---- Gana ----
  const GANA_IDX = { Deva: 0, Manushya: 1, Rakshasa: 2 };
  const GANA_TABLE = [
    [6, 5, 1],
    [6, 6, 0],
    [6, 6, 6],
  ];
  function ganaKoota(boyNak, girlNak) {
    const gB = Astro.NAK[boyNak].gana, gG = Astro.NAK[girlNak].gana;
    const score = GANA_TABLE[GANA_IDX[gB]][GANA_IDX[gG]];
    return { max: 6, score, boy: gB, girl: gG, note: `${gB} (groom) & ${gG} (bride)` };
  }

  // ---- Bhakoot / Rasi ----
  function bhakootKoota(boySign, girlSign) {
    const c1 = ((girlSign - boySign + 12) % 12) + 1;
    const c2 = ((boySign - girlSign + 12) % 12) + 1;
    const set = [c1, c2].sort((a, b) => a - b).join('-');
    const bad = ['2-12', '6-8', '5-9'];
    const score = bad.includes(set) ? 0 : 7;
    return { max: 7, score, pair: `${c1}/${c2}`,
      note: score ? 'Favourable Rashi axis' : `Bhakoot dosha (${set}) — afflicted axis` };
  }

  // ---- Nadi ----
  function nadiKoota(boyNak, girlNak) {
    const nB = Astro.NAK[boyNak].nadi, nG = Astro.NAK[girlNak].nadi;
    const score = nB === nG ? 0 : 8;
    return { max: 8, score, boy: nB, girl: nG,
      note: score ? 'Different Nadi — excellent (no Nadi dosha)' : `Same Nadi (${nB}) — Nadi dosha` };
  }

  // ===== Ashtakoota aggregate =====
  function ashtakoota(boy, girl) {
    const varna = varnaKoota(boy.sign, girl.sign);
    const vashya = vashyaKoota(boy, girl);
    const tara = taraKoota(boy.nakIdx, girl.nakIdx);
    const yoni = yoniKoota(boy.nakIdx, girl.nakIdx);
    const maitri = grahaMaitriKoota(boy.sign, girl.sign);
    const gana = ganaKoota(boy.nakIdx, girl.nakIdx);
    const bhakoot = bhakootKoota(boy.sign, girl.sign);
    const nadi = nadiKoota(boy.nakIdx, girl.nakIdx);
    const items = [
      { key: 'Varna', ...varna },
      { key: 'Vashya', ...vashya },
      { key: 'Tara (Dina)', ...tara },
      { key: 'Yoni', ...yoni },
      { key: 'Graha Maitri', ...maitri },
      { key: 'Gana', ...gana },
      { key: 'Bhakoot', ...bhakoot },
      { key: 'Nadi', ...nadi },
    ];
    const total = items.reduce((s, i) => s + i.score, 0);
    const maxTotal = 36;
    let verdict;
    if (total >= 28) verdict = { label: 'Excellent Match', cls: 'good' };
    else if (total >= 24) verdict = { label: 'Very Good Match', cls: 'good' };
    else if (total >= 18) verdict = { label: 'Acceptable Match', cls: 'mid' };
    else verdict = { label: 'Below Recommended', cls: 'bad' };
    // dosha flags
    const doshas = [];
    if (nadi.score === 0) doshas.push('Nadi Dosha');
    if (bhakoot.score === 0) doshas.push('Bhakoot Dosha');
    if (gana.score <= 1) doshas.push('Gana Dosha');
    return { items, total, maxTotal, percent: Math.round((total / maxTotal) * 100), verdict, doshas };
  }

  // ===== Dashakoota / Dasa Porutham =====
  const RAJJU_GROUPS = {
    Pada: [0, 8, 9, 17, 18, 26],
    Kati: [1, 7, 10, 16, 19, 25],
    Nabhi: [2, 6, 11, 15, 20, 24],
    Kantha: [3, 5, 12, 14, 21, 23],
    Siro: [4, 13, 22],
  };
  function rajjuOf(nak) {
    for (const k in RAJJU_GROUPS) if (RAJJU_GROUPS[k].includes(nak)) return k;
    return '?';
  }
  const VEDHA_PAIRS = [
    [0, 17], [1, 16], [2, 15], [3, 14], [4, 22], [5, 21], [6, 20],
    [7, 19], [8, 18], [9, 26], [10, 25], [11, 24], [12, 23],
  ];
  function isVedha(a, b) {
    return VEDHA_PAIRS.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
  }
  function mahendra(boyNak, girlNak) {
    // count from bride to groom
    const count = ((boyNak - girlNak + 27) % 27) + 1;
    const good = [4, 7, 10, 13, 16, 19, 22, 25];
    return good.includes(count);
  }
  function streeDeergha(boyNak, girlNak) {
    const count = ((boyNak - girlNak + 27) % 27) + 1; // bride -> groom
    return count > 9; // groom's star well ahead of bride's
  }

  function dashakoota(boy, girl) {
    const tara = taraKoota(boy.nakIdx, girl.nakIdx);
    const gana = ganaKoota(boy.nakIdx, girl.nakIdx);
    const yoni = yoniKoota(boy.nakIdx, girl.nakIdx);
    const bhakoot = bhakootKoota(boy.sign, girl.sign);
    const maitri = grahaMaitriKoota(boy.sign, girl.sign);
    const vashya = vashyaKoota(boy, girl);
    const rB = rajjuOf(boy.nakIdx), rG = rajjuOf(girl.nakIdx);
    const vedha = isVedha(boy.nakIdx, girl.nakIdx);
    const mahendraOk = mahendra(boy.nakIdx, girl.nakIdx);
    const streeOk = streeDeergha(boy.nakIdx, girl.nakIdx);

    const items = [
      { key: 'Dina (Nakshatra)', pass: tara.score >= 1.5, detail: `Tara remainders ${tara.r1}/${tara.r2}` },
      { key: 'Gana', pass: gana.score >= 5, detail: `${gana.boy} & ${gana.girl} (${gana.score}/6)` },
      { key: 'Mahendra', pass: mahendraOk, detail: mahendraOk ? 'Count from bride to groom is auspicious' : 'Count not in auspicious set' },
      { key: 'Stree Deergha', pass: streeOk, detail: streeOk ? 'Groom star well ahead of bride (>9)' : 'Insufficient separation (≤9)' },
      { key: 'Yoni', pass: yoni.score >= 2, detail: `${yoni.boy} & ${yoni.girl} (${yoni.score}/4)` },
      { key: 'Rasi (Bhakoot)', pass: bhakoot.score === 7, detail: bhakoot.note },
      { key: 'Rasyadhipathi', pass: maitri.score >= 3, detail: `Lords ${maitri.boy} & ${maitri.girl} (${maitri.score}/5)` },
      { key: 'Vasya', pass: vashya.score >= 1, detail: vashya.note },
      { key: 'Rajju', pass: rB !== rG, detail: rB === rG ? `Same Rajju (${rB}) — dosha` : `${rB} (groom) & ${rG} (bride) — safe` },
      { key: 'Vedha', pass: !vedha, detail: vedha ? 'Vedha (mutual obstruction) present' : 'No Vedha — clear' },
    ];
    const passCount = items.filter((i) => i.pass).length;
    let verdict;
    if (passCount >= 8) verdict = { label: 'Highly Compatible', cls: 'good' };
    else if (passCount >= 6) verdict = { label: 'Compatible', cls: 'good' };
    else if (passCount >= 4) verdict = { label: 'Average', cls: 'mid' };
    else verdict = { label: 'Poor', cls: 'bad' };
    return { items, passCount, maxTotal: 10, percent: passCount * 10, verdict,
      rajjuBoy: rB, rajjuGirl: rG };
  }

  function fullMatch(boyChart, girlChart) {
    const boy = boyChart.planets.Moon;
    const girl = girlChart.planets.Moon;
    const ashta = ashtakoota(boy, girl);
    const dasha = dashakoota(boy, girl);
    return {
      boyMoon: { sign: boy.signName, nak: boy.nak, pada: boy.pada },
      girlMoon: { sign: girl.signName, nak: girl.nak, pada: girl.pada },
      ashtakoota: ashta,
      dashakoota: dasha,
    };
  }

  return {
    YONI_ANIMALS, YONI_MATRIX, varnaOfSign, vashyaGroup, rajjuOf,
    ashtakoota, dashakoota, fullMatch,
    varnaKoota, vashyaKoota, taraKoota, yoniKoota, grahaMaitriKoota,
    ganaKoota, bhakootKoota, nadiKoota,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Koota;

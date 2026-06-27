/* =============================================================================
 * manual.js  —  Technical Manual content
 *
 * Returns the full HTML for the in-app Technical Manual tab: methodology,
 * formulae, data sources, scoring logic, accuracy notes and references for
 * every engine in the module.
 * ========================================================================== */

const Manual = (function () {
  'use strict';

  function html() {
    return `
    <div class="manual">
      <h2>Technical Manual</h2>
      <p class="muted">Version 1.0 — Marriage Matching Module. This manual documents
      every calculation the module performs so an astrologer or engineer can audit,
      reproduce and extend the results.</p>

      <div class="callout">
        <strong>Scope &amp; disclaimer.</strong> This is a decision-support / educational
        tool implementing classical Jyotish algorithms (BPHS &amp; KP) on a self-contained
        JavaScript ephemeris. It is <em>indicative</em>, not a substitute for a qualified
        astrologer, nor for medical, legal or relationship counselling.
      </div>

      <h3>1. Astronomical Engine (<code>astro-core.js</code>)</h3>
      <ul>
        <li><b>Ephemeris:</b> Paul Schlyter's low-precision method with major periodic
          perturbation terms for the Moon and the Jupiter–Saturn mutual terms. Bodies:
          Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn and the mean lunar node
          (Rahu); Ketu = Rahu + 180°.</li>
        <li><b>Accuracy:</b> planetary geocentric longitudes ≈ 1–2 arc-minutes; Moon
          ≈ 2–5 arc-minutes over 1900–2100. This is ample for Rāśi, Nakṣatra and Pada
          determination; cuspal sub-lord boundaries can carry small error.</li>
        <li><b>Time:</b> local civil time is converted to UT using the supplied time-zone
          offset, then to Julian Day (JD). All internal angles are sidereal.</li>
        <li><b>Ayanāṁśa:</b> Lahiri (Chitrapaksha). Reference J2000 = 23.853°,
          precession rate 50.2876″/yr (0.0139688°/yr). Sidereal = Tropical − Ayanāṁśa.</li>
        <li><b>Ascendant:</b> from Local Sidereal Time (GMST + east-longitude), the
          obliquity of the ecliptic and the geographic latitude via the standard
          ascendant equation, then reduced to sidereal.</li>
        <li><b>Houses:</b> BPHS analysis uses the <b>Whole-Sign</b> system (the sign of
          the Ascendant is the 1st house). KP uses the <b>Placidus</b> house system with
          the <b>KP (Krishnamurti) ayanamsa</b> — <b>KP-Old</b> for births before the year
          2000 and <b>KP-New</b> from 2000 onward — so the KP chart, cusps and sub-lords
          are computed on their own (slightly different) zodiac, while the Rāśi/BPHS and
          Koota work stays on Lahiri (Chitrapakṣa).</li>
      </ul>

      <h3>2. KP Sub-lord Subdivision</h3>
      <p>Each Nakṣatra (13°20′) is subdivided into nine <em>sub</em>-spans in the
      Vimśottari order starting from the Nakṣatra lord, each span proportional to the
      planet's dasha years / 120. The same proportion is applied again for the
      <em>sub-sub</em> lord. This yields the Star-lord → Sub-lord → Sub-sub-lord chain
      used throughout KP.</p>

      <h3>3. BPHS Bhāva Analysis (<code>bphs.js</code>)</h3>
      <p>For each of the 12 Bhāvas the module tabulates the sign, the house lord, the
      lord's dignity and placement, occupant planets, and aspecting planets
      (graha-dṛṣṭi: Mars 4/7/8, Jupiter 5/7/9, Saturn 3/7/10, others 7). A
      0–100 <b>strength score</b> is built from:</p>
      <ul>
        <li>Lord dignity: Exalted +5, Own +4, Friendly +2, Neutral +1, Enemy −1, Debilitated −3 (×4 weight).</li>
        <li>Lord placement: Kendra/Trikoṇa bonus; Dusthāna (6/8/12) penalty.</li>
        <li>Occupants: natural benefics raise, malefics lower the score; dignity modifies.</li>
        <li>Aspects and retrogression adjustments.</li>
      </ul>
      <p>The <b>marriage index</b> weights houses 7 (×3), 2 &amp; 11 (×1.5), 5 &amp; 8 (×1),
      12 (×0.8), 4 (×0.6), then adjusts for the kāraka (Venus for the groom, Jupiter for
      the bride) and for malefic afflictions to the 7th.</p>
      <p><b>D9 (Navāṁśa) confirmation.</b> The marriage index also folds in a bounded Navāṁśa
      adjustment (−12…+14): the <b>D9 dignity of the 7th lord and of the kāraka</b>, a
      <b>Vargottama</b> bonus when the 7th lord or kāraka holds the same sign in D1 and D9
      (a strong confirmation of marriage), and benefics (+) / malefics (−) tenanting the
      <b>navāṁśa 7th</b>. The per-partner D9 factors and the exact adjustment are shown on the
      BPHS Assessment tab.</p>

      <h3>4. KP Marriage Analysis (<code>kp.js</code>)</h3>
      <p>Marriage is judged from the <b>sub-lord of the 7th cusp</b>. It is "promised"
      when that sub-lord is a significator of houses <b>2, 7 or 11</b>; houses 1, 6 and
      10 act against it. Significators are found with the classical 4-step rule:</p>
      <ol>
        <li>Planets in the star of the occupant(s) of the house (strongest);</li>
        <li>Occupants of the house;</li>
        <li>Planets in the star of the house owner;</li>
        <li>The house owner.</li>
      </ol>
      <p>A confidence score is derived from promise-house matches minus denial-house links.</p>

      <h3>4b. Marriage Promise Scoring (Tab 8)</h3>
      <p>Tab 8 first decides whether marriage is <b>promised</b> before showing any timing. Two
      independent scores are computed and their derivation is printed on screen and in the report.</p>
      <p><b>KP confidence %</b> — from the significator houses of the 7th cusp sub-lord:</p>
      <ul>
        <li><code>matched</code> = sub-lord's significator houses ∩ {2, 7, 11} (family / spouse / union).</li>
        <li><code>denials</code> = significator houses ∩ {1, 6, 10} (self / separation / against the 7th).</li>
        <li><code>confidence = matched×25 − denials×12 + 25</code>, clamped to 5–98%.</li>
        <li>KP counts as <em>promised</em> when there is a 2/7/11 match <b>and</b> confidence ≥ 30%.</li>
      </ul>
      <p><b>BPHS marriage index /100</b> — a weighted blend of the marriage houses' strengths:</p>
      <ul>
        <li>Each house strength starts at 50 and is adjusted by lord dignity (×4), lord placement
            (Kendra/Trikoṇa +6, Dusthāna −10), occupants (benefic +5 / malefic −4, ± dignity), aspects
            (benefic +3 / malefic −2) and a retrograde-lord penalty; clamped 2–98.</li>
        <li>Weighted average using 7→3.0, 2→1.5, 11→1.5, 5→1.0, 8→1.0, 12→0.8, 4→0.6.</li>
        <li>Then <code>+ kāraka dignity ×2</code> (Venus for the groom, Jupiter for the bride) and
            <code>− 3 × (malefics in the 7th)</code>; clamped 5–98.</li>
        <li>Parāśara counts as <em>promised</em> when index ≥ 40 and the 7th-house strength ≥ 35.</li>
      </ul>
      <p>These are transparent, rule-based heuristics that encode classical principles — indicative,
      not statistical probabilities. The per-house contributions and the arithmetic for both scores are
      shown in each partner's promise card.</p>

      <h3>5. Koota / Guna Milan (<code>koota.js</code>)</h3>
      <p><b>Ashtakoota (max 36):</b> Varṇa (1), Vaśya (2), Tārā/Dina (3), Yoni (4),
      Graha Maitri (5), Gaṇa (6), Bhakūṭa (7), Nāḍī (8). Each is computed from the
      partners' Moon Nakṣatra / Rāśi:</p>
      <ul>
        <li><b>Varṇa</b> from sign element (water=Brahmin … air=Shudra); 1 point if groom ≥ bride.</li>
        <li><b>Vaśya</b> from sign mobility group (Chatuṣpada/Nara/Jalachara/Vanachara/Keeta).</li>
        <li><b>Tārā</b> from the 9-fold count between stars (3rd/5th/7th remainders are inauspicious).</li>
        <li><b>Yoni</b> from a 14×14 animal-compatibility matrix (4 = same, 0 = mortal enemies).</li>
        <li><b>Graha Maitri</b> from natural friendship of the Rāśi lords.</li>
        <li><b>Gaṇa</b> from Deva/Manuṣya/Rakṣasa temperament table.</li>
        <li><b>Bhakūṭa</b> from the Moon-sign axis; 2/12, 6/8, 5/9 axes incur dosha.</li>
        <li><b>Nāḍī</b> Adi/Madhya/Antya; same Nāḍī = Nāḍī dosha (0/8).</li>
      </ul>
      <p><b>Dashakoota / Dasa Porutham (10):</b> Dina, Gaṇa, Mahendra, Stree-Deergha,
      Yoni, Rāśi (Bhakūṭa), Rāśyādhipati (Graha Maitri), Vaśya, Rajju and Vedha — each
      scored pass/fail; Rajju (same body-part group) and Vedha (mutual obstruction
      pairs) are treated as the critical doshas.</p>

      <h3>6. Vimśottari Daśā (<code>dasha.js</code>)</h3>
      <p>The 120-year Vimśottari sequence is anchored to the Moon's longitude at birth.
      The balance of the first Mahādaśā = remaining fraction of the birth Nakṣatra ×
      the lord's dasha years. Antardaśā and Pratyantardaśā are nested proportionally
      (lord-years / 120). All periods are stamped with real Gregorian dates.</p>

      <h3>7. Transits / Gochara (<code>transit.js</code>)</h3>
      <p>Sidereal positions of Jupiter, Saturn, Rahu/Ketu and Mars are projected forward.
      Marriage-positive triggers include Jupiter transiting the 7th/2nd/11th/5th from the
      natal Moon and Jupiter/Saturn over the natal 7th sign. Stress triggers include
      Saturn's Sade-Sati phase (12th–1st–2nd from Moon), Saturn over the 7th, and the
      Rahu/Ketu transit of the 1/7 axis.</p>

      <h3>8. Marriage Timing &amp; 20-Year Forecast (<code>timeline.js</code>)</h3>
      <p>Each chart's marriage-promoting planets (7th/2nd/11th/5th lords, the kāraka,
      and KP significators of 2/7/11) are weighted against its stress planets (6th/8th/
      12th lords). A running MD/AD/PD favourability is combined with the transit score.
      The <b>nearest couple window</b> is the earliest time (sampled monthly) at which
      both partners' readiness is jointly high. The <b>20-year forecast</b> reports the
      relationship strength band for each successive period, blending both partners'
      dasha favourability with concurrent transits.</p>
      <p><b>Timing scan from age 21.</b> Marriage timing (Tab 8) is scanned from each native's
      <b>age 21</b> (birth + 21 years), not from today. The earliest favourable window from that point
      is the predicted marriage period: for charts older than 21 it lands in the past (used to
      <b>back-test</b> against the actual marriage); for younger charts it is a future date.</p>
      <p><b>Dual-method commitment strength.</b> The 20-year commitment graph plots two
      independently-computed values per partner: a <b>KP</b> value (from the running dasha
      lords' nakṣatra/sub-lord significators of houses 2-7-11 vs 1-6-10-12) and a
      <b>Parāśara</b> value (from those lords' house lordship &amp; occupancy of 7-2-11-5
      vs 6-8-12). Each lord's contribution is scaled by a <b>planetary strength multiplier</b>
      (<code>planet-strength.js</code>) built from direction (retrograde/Cheṣṭā), speed
      (fast/slow vs mean motion), declination, exaltation/own/friend/enemy dignity,
      debilitation <i>and its cancellation</i> (Neecha Bhanga), and combustion. The two
      values are shown in two colours (KP = amber, Parāśara = green), both as numbers and
      as lines on the graph; divergence between them flags periods where the two systems
      disagree.</p>

      <h3>8b. Separation / Divorce / Widowhood Promise (<code>separation.js</code>)</h3>
      <p>This promise is read from three views: <b>D1</b> (7th lord in
      dusthāna, malefics in the 7th/2nd, Maṅgala dosha, affliction of the Venus/Jupiter
      kāraka, 8th-from-7th affliction), <b>D9</b> (malefics in the navāṁśa 7th, Venus
      navāṁśa dignity) and <b>KP</b> (7th cusp sub-lord signifying 6/12 = separation, or
      1/10 = against union; planets that are KP significators of 6/8/12). It yields
      separation, divorce and widowhood risk sub-scores and a weighted map of
      "separative planets." In the 20-year forecast the relationship strength is
      <b>reduced more sharply</b> when one of these separative planets runs in the
      Mahā/Antar/Pratyantar daśā <i>and</i> transits are simultaneously adverse
      (Sade Sati, Saturn/Rahu/Mars on the 7th, etc.) — these "trigger windows" are
      marked red on the commitment graph and flagged with ⚠ in the period table.</p>
      <p><b>Severe divorce combination (×3).</b> When <b>Sun and Ketu are both in the 7th</b>, conjoined
      with or aspected by <b>Mars (or another malefic)</b>, with <b>no benefic Jupiter aspect</b> on the
      7th, and the <b>Lagna lord is caught on the Rāhu–Ketu axis</b> (conjunct a node), the Parāśara
      divorce risk is amplified about <b>three-fold</b> (and floored to the High band) — an unprotected,
      nodally-derailed 7th house.</p>

      <h3>9. Health Compatibility Screener (<code>health.js</code>)</h3>
      <p>For each partner the screener evaluates the Lagna lord (vitality), the 6th
      (immunity/acute disease), the 8th (chronic/longevity), the 12th (drains) and the
      Moon (mind), and derives an Āyurvedic dosha leaning (Vāta/Pitta/Kapha) from sign
      elements and the Moon's Nāḍī. The two profiles are then compared for shared
      vulnerabilities, emotional steadiness and dosha complementarity to yield a
      Health-Compatibility Index.</p>

      <h3>10. PDF Report</h3>
      <p>The PDF tab composes a single consolidated report and uses the browser's print
      pipeline (and, when available, the bundled html-to-PDF helper) so it can be saved
      as a PDF or printed directly. Use the "Open print dialog" button on that tab.</p>

      <h3>11. Sarvashtakavarga (SAV)</h3>
      <p>The Ashtakavarga system (BPHS chapters 66–72) quantifies planetary strength
      house-by-house. For each of the 7 planets, an 8-fold contribution rule (from
      7 planets + Lagna) assigns <em>bindus</em> (benefic points) to each of the 12
      signs. Summing all 7 individual tables (Bhinnashtakavarga / BAV) yields the
      <b>Sarvashtakavarga (SAV)</b> — typically totalling ~337 bindus across the zodiac.</p>
      <ul>
        <li><b>Marriage houses scored:</b> 7th (spouse), 2nd (family), 11th (fulfilment),
            5th (romance/children), 8th (intimacy/longevity).</li>
        <li><b>Thresholds:</b> SAV ≥ 28 in a house = Strong; 25–27 = Moderate; &lt; 25 = Weak.</li>
        <li><b>Special indicators:</b> Venus BAV in the 7th (marital happiness), Jupiter BAV
            in the 2nd and 11th (family harmony &amp; wish-fulfilment).</li>
        <li><b>Couple comparison:</b> balanced total SAV (difference ≤ 10) indicates energetic
            compatibility; both strong in the same marriage houses is highly favourable.</li>
      </ul>

      <h3>12. Progeny / Santāna Analysis (<code>progeny.js</code>)</h3>
      <p>The promise, denial and <b>timing of childbirth</b> are judged from three
      independent methods, then combined into a 0–100 progeny index:</p>
      <ul>
        <li><b>Parāśara (45%).</b> The 5th house (Putra Bhāva) is assessed in <b>D1</b>
            (Rāśi), <b>D9</b> (Navāṁśa) and <b>D7</b> (Saptāṁśa — the prime varga for
            children, weighted highest), together with the putra-kāraka <b>Jupiter</b>
            (dignity, afflictions, benefic support), the 5th lord's placement and the
            9th house (lineage / santati). Saptāṁśa division: each sign is split into 7
            parts of 4°17′; odd signs count from the same sign, even signs from the 7th.</li>
        <li><b>KP (35%).</b> Progeny is "promised" when the <b>sub-lord of the 5th cusp</b>
            is a significator of houses <b>2, 5 or 11</b>; signification of 1, 4 or 10
            denies/obstructs and the 12th warns of loss. The 11th cusp sub-lord
            (fulfilment of desire) is supporting.</li>
        <li><b>Beeja &amp; Kṣetra Sphuṭa (20%).</b> The <b>Beeja Sphuṭa</b> (male "seed" =
            Sun + Venus + Jupiter longitudes) should fall in an <b>odd</b> rāśi and odd
            navāṁśa with a strong dispositor &amp; Jupiter; the <b>Kṣetra Sphuṭa</b>
            (female "field" = Moon + Mars + Jupiter) should fall in an <b>even</b> rāśi and
            even navāṁśa. In couple mode the husband's Beeja is paired with the wife's
            Kṣetra.</li>
      </ul>
      <p><b>Timing.</b> Childbirth fructifies in the Vimśottari Mahā/Antar/Pratyantar
      daśā of progeny significators (the 5th lord, Jupiter, occupants of the 5th, and KP
      significators of 2/5/11), reinforced when Jupiter transits the 5th from the Lagna
      or Moon, or the 5th-lord's sign. The module ranks the strongest windows over the
      next 20 years and reports the nearest favourable period; in couple mode it also
      gives a likely first-child window. Available for both <b>Couple</b> and
      <b>Individual</b> analysis.</p>

      <h3>13. References</h3>
      <ul>
        <li>Maharṣi Parāśara — <i>Bṛhat Parāśara Horā Śāstra</i> (BPHS).</li>
        <li>K. S. Krishnamurti — <i>Krishnamurti Paddhati</i> (Readers 1–6).</li>
        <li>B. V. Raman — <i>Muhurta</i> &amp; <i>Hindu Predictive Astrology</i> (Guna Milan).</li>
        <li>Paul Schlyter — <i>Computing planetary positions</i> (ephemeris algorithm).</li>
        <li>Jean Meeus — <i>Astronomical Algorithms</i> (JD, sidereal time, ascendant).</li>
      </ul>
    </div>`;
  }

  return { html };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Manual;

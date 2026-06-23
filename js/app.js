/**
 * App.js - Main Application Controller
 * Handles tab switching, form handling, and orchestration of calculations
 */
(function() {
    'use strict';

    // Application state
    var appState = {
        boyChart: null,
        girlChart: null,
        boyName: '',
        girlName: '',
        calculated: false
    };

    // ===== Tab Navigation =====
    function initTabs() {
        var tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tabId = this.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
    }

    function switchTab(tabId) {
        // Remove active from all buttons and panels
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-panel').forEach(function(panel) {
            panel.classList.remove('active');
        });

        // Activate selected
        var btn = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
        var panel = document.getElementById('tab-' + tabId);

        if (btn) btn.classList.add('active');
        if (panel) panel.classList.add('active');
    }

    // ===== Form Handling =====
    function initForm() {
        var form = document.getElementById('birth-details-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                handleFormSubmit();
            });
        }
    }

    function handleFormSubmit() {
        var statusEl = document.getElementById('input-status');

        try {
            // Get boy's details
            var boyName = document.getElementById('boy-name').value.trim();
            var boyDob = document.getElementById('boy-dob').value;
            var boyTob = document.getElementById('boy-tob').value;
            var boyLat = parseFloat(document.getElementById('boy-lat').value);
            var boyLng = parseFloat(document.getElementById('boy-lng').value);
            var boyTz = parseFloat(document.getElementById('boy-tz').value);

            // Get girl's details
            var girlName = document.getElementById('girl-name').value.trim();
            var girlDob = document.getElementById('girl-dob').value;
            var girlTob = document.getElementById('girl-tob').value;
            var girlLat = parseFloat(document.getElementById('girl-lat').value);
            var girlLng = parseFloat(document.getElementById('girl-lng').value);
            var girlTz = parseFloat(document.getElementById('girl-tz').value);

            // Parse dates and times
            var boyDateParts = boyDob.split('-');
            var boyTimeParts = boyTob.split(':');
            var girlDateParts = girlDob.split('-');
            var girlTimeParts = girlTob.split(':');

            // Calculate charts
            appState.boyChart = AstroCore.calculateChart(
                parseInt(boyDateParts[0]), parseInt(boyDateParts[1]), parseInt(boyDateParts[2]),
                parseInt(boyTimeParts[0]), parseInt(boyTimeParts[1]), parseInt(boyTimeParts[2] || 0),
                boyLat, boyLng, boyTz
            );

            appState.girlChart = AstroCore.calculateChart(
                parseInt(girlDateParts[0]), parseInt(girlDateParts[1]), parseInt(girlDateParts[2]),
                parseInt(girlTimeParts[0]), parseInt(girlTimeParts[1]), parseInt(girlTimeParts[2] || 0),
                girlLat, girlLng, girlTz
            );

            appState.boyName = boyName;
            appState.girlName = girlName;
            appState.calculated = true;

            // Render results
            renderBhavaAnalysis();
            renderBPHSAssessment();
            renderKPAssessment();
            renderTimelinePlaceholder();
            renderForecastPlaceholder();
            renderHealthPlaceholder();
            renderAshtakootaPlaceholder();
            renderDashakootaPlaceholder();

            // Enable PDF button
            var pdfBtn = document.getElementById('generate-pdf');
            if (pdfBtn) pdfBtn.disabled = false;
            var pdfStatus = document.getElementById('pdf-status');
            if (pdfStatus) pdfStatus.textContent = 'Calculations complete. Click the button to generate PDF.';

            // Show success
            showStatus(statusEl, 'success', 'Charts calculated successfully! Navigate to other tabs to see the analysis.');

        } catch (error) {
            showStatus(statusEl, 'error', 'Error calculating charts: ' + error.message);
            console.error('Calculation error:', error);
        }
    }

    function showStatus(el, type, message) {
        if (!el) return;
        el.className = 'status-message ' + type;
        el.textContent = message;
    }

    // ===== Utility Functions =====
    function formatDegree(deg) {
        var d = Math.floor(deg);
        var m = Math.floor((deg - d) * 60);
        var s = Math.floor(((deg - d) * 60 - m) * 60);
        return d + '\u00B0 ' + m + "' " + s + '"';
    }

    function getPlanetsInHouse(chart, houseNum) {
        var result = [];
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
        planetNames.forEach(function(name) {
            if (chart.planets[name].house === houseNum) result.push(name);
        });
        return result.length > 0 ? result.join(', ') : '-';
    }

    function getAspectsOnHouse(chart, houseNum) {
        // Vedic aspects: each planet aspects the 7th house from itself
        // Mars also aspects 4th and 8th; Jupiter 5th and 9th; Saturn 3rd and 10th
        var aspects = [];
        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

        planetNames.forEach(function(name) {
            var pH = chart.planets[name].house;
            var aspectedHouses = [];
            // All planets aspect 7th from themselves
            aspectedHouses.push(((pH - 1 + 6) % 12) + 1);
            // Special aspects
            if (name === 'Mars') {
                aspectedHouses.push(((pH - 1 + 3) % 12) + 1); // 4th
                aspectedHouses.push(((pH - 1 + 7) % 12) + 1); // 8th
            } else if (name === 'Jupiter') {
                aspectedHouses.push(((pH - 1 + 4) % 12) + 1); // 5th
                aspectedHouses.push(((pH - 1 + 8) % 12) + 1); // 9th
            } else if (name === 'Saturn') {
                aspectedHouses.push(((pH - 1 + 2) % 12) + 1); // 3rd
                aspectedHouses.push(((pH - 1 + 9) % 12) + 1); // 10th
            }
            if (aspectedHouses.indexOf(houseNum) !== -1) {
                aspects.push(name);
            }
        });
        return aspects.length > 0 ? aspects.join(', ') : '-';
    }

    // ===== Render Bhava/House Analysis (Comprehensive) =====
    function renderBhavaAnalysis() {
        var container = document.getElementById('bhava-content');
        if (!container) return;

        var html = '';

        // Planetary Positions - Side by Side
        html += '<h3>Planetary Positions</h3>';
        html += '<div class="form-row">';
        html += '<div class="form-section"><h3>Boy (' + appState.boyName + ')</h3>';
        html += renderPlanetTable(appState.boyChart);
        html += '</div>';
        html += '<div class="form-section"><h3>Girl (' + appState.girlName + ')</h3>';
        html += renderPlanetTable(appState.girlChart);
        html += '</div></div>';

        // Comprehensive House Analysis - Side by Side
        html += '<h3 class="mt-3">Comprehensive House Analysis (Side by Side)</h3>';
        html += renderComprehensiveHouseTable();

        container.innerHTML = html;
    }

    function renderPlanetTable(chart) {
        var html = '<table class="data-table">';
        html += '<thead><tr><th>Planet</th><th>Longitude</th><th>Rashi</th><th>Nakshatra</th><th>Pada</th><th>House</th><th>Lord</th></tr></thead>';
        html += '<tbody>';

        var planetNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
        planetNames.forEach(function(name) {
            var p = chart.planets[name];
            html += '<tr>';
            html += '<td><strong>' + name + '</strong></td>';
            html += '<td>' + formatDegree(p.sidereal) + '</td>';
            html += '<td>' + p.rashi + '</td>';
            html += '<td>' + p.nakshatra + '</td>';
            html += '<td>' + p.pada + '</td>';
            html += '<td>' + p.house + '</td>';
            html += '<td>' + p.rashiLord + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function renderComprehensiveHouseTable() {
        var boyChart = appState.boyChart;
        var girlChart = appState.girlChart;

        // Get KP cusp sub-lords
        var boyCusps = KP.getCuspSubLords(boyChart);
        var girlCusps = KP.getCuspSubLords(girlChart);

        var html = '<table class="data-table">';
        html += '<thead><tr>';
        html += '<th>House</th>';
        html += '<th colspan="6" style="text-align:center;background:#3b0764;">Boy (' + appState.boyName + ')</th>';
        html += '<th colspan="6" style="text-align:center;background:#1e3a5f;">Girl (' + appState.girlName + ')</th>';
        html += '</tr>';
        html += '<tr>';
        html += '<th>#</th>';
        // Boy columns
        html += '<th>Sign</th><th>Cusp</th><th>Lord</th><th>Star Lord</th><th>Planets</th><th>Aspects</th>';
        // Girl columns
        html += '<th>Sign</th><th>Cusp</th><th>Lord</th><th>Star Lord</th><th>Planets</th><th>Aspects</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        for (var i = 0; i < 12; i++) {
            var bh = boyChart.houses.houses[i];
            var gh = girlChart.houses.houses[i];
            var bc = boyCusps[i];
            var gc = girlCusps[i];

            html += '<tr>';
            html += '<td><strong>' + (i + 1) + '</strong></td>';
            // Boy
            html += '<td>' + bh.rashi + '</td>';
            html += '<td>' + formatDegree(bh.cusp) + '</td>';
            html += '<td>' + bh.lord + '</td>';
            html += '<td>' + bc.starLord + '</td>';
            html += '<td>' + getPlanetsInHouse(boyChart, i + 1) + '</td>';
            html += '<td>' + getAspectsOnHouse(boyChart, i + 1) + '</td>';
            // Girl
            html += '<td>' + gh.rashi + '</td>';
            html += '<td>' + formatDegree(gh.cusp) + '</td>';
            html += '<td>' + gh.lord + '</td>';
            html += '<td>' + gc.starLord + '</td>';
            html += '<td>' + getPlanetsInHouse(girlChart, i + 1) + '</td>';
            html += '<td>' + getAspectsOnHouse(girlChart, i + 1) + '</td>';
            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    // ===== Placeholder renderers for features to be implemented in later FEATs =====
    function renderBPHSAssessment() {
        var container = document.getElementById('bphs-content');
        if (!container) return;

        var html = '';
        var compatibility = BPHS.assessCompatibility(appState.boyChart, appState.girlChart);

        // Overall Score
        html += '<div class="result-grid">';
        html += '<div class="result-card"><h4>Boy BPHS Score</h4><div class="value">' + compatibility.boyScore + '%</div></div>';
        html += '<div class="result-card"><h4>Girl BPHS Score</h4><div class="value">' + compatibility.girlScore + '%</div></div>';
        html += '<div class="result-card"><h4>Overall Compatibility</h4><div class="value">' + compatibility.overallScore + '%</div></div>';
        html += '</div>';

        // Score Bar
        html += '<div class="score-label"><span>BPHS Compatibility</span><span>' + compatibility.overallScore + '%</span></div>';
        html += '<div class="score-bar"><div class="score-bar-fill" style="width:' + compatibility.overallScore + '%"></div></div>';
        html += '<p class="mt-2"><strong>Verdict:</strong> ' + compatibility.verdict + '</p>';

        // House Significations Table
        html += '<h3 class="mt-3">House Significations (BPHS)</h3>';
        html += '<table class="data-table">';
        html += '<thead><tr><th>House</th><th>Name</th><th>Keywords</th><th>Marriage Significance</th></tr></thead>';
        html += '<tbody>';
        for (var h = 1; h <= 12; h++) {
            var sig = BPHS.HOUSE_SIGNIFICATIONS[h];
            html += '<tr>';
            html += '<td><strong>' + h + '</strong></td>';
            html += '<td>' + sig.name + '</td>';
            html += '<td>' + sig.keywords.join(', ') + '</td>';
            html += '<td>' + sig.marriage + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';

        // Planet-House Analysis
        html += '<h3 class="mt-3">Planet-in-House Analysis (Boy - ' + appState.boyName + ')</h3>';
        html += renderPlanetHouseAnalysis(appState.boyChart);
        html += '<h3 class="mt-3">Planet-in-House Analysis (Girl - ' + appState.girlName + ')</h3>';
        html += renderPlanetHouseAnalysis(appState.girlChart);

        // House Lord Placement
        html += '<h3 class="mt-3">House Lord Placement Analysis</h3>';
        html += '<div class="form-row">';
        html += '<div class="form-section"><h3>Boy (' + appState.boyName + ')</h3>';
        html += renderHouseLordTable(appState.boyChart);
        html += '</div>';
        html += '<div class="form-section"><h3>Girl (' + appState.girlName + ')</h3>';
        html += renderHouseLordTable(appState.girlChart);
        html += '</div></div>';

        // Marriage Yogas
        html += '<h3 class="mt-3">Marriage-Relevant Yogas (Boy)</h3>';
        html += renderYogaTable(compatibility.boyYogas);
        html += '<h3 class="mt-3">Marriage-Relevant Yogas (Girl)</h3>';
        html += renderYogaTable(compatibility.girlYogas);

        // Cross-Chart Factors
        if (compatibility.crossFactors.length > 0) {
            html += '<h3 class="mt-3">Cross-Chart Compatibility Factors</h3>';
            html += '<table class="data-table">';
            html += '<thead><tr><th>Factor</th><th>Effect</th><th>Score</th></tr></thead>';
            html += '<tbody>';
            compatibility.crossFactors.forEach(function(f) {
                html += '<tr><td><strong>' + f.factor + '</strong></td><td>' + f.effect + '</td><td>' + (f.score > 0 ? '+' : '') + f.score + '</td></tr>';
            });
            html += '</tbody></table>';
        }

        container.innerHTML = html;
    }

    function renderPlanetHouseAnalysis(chart) {
        var analysis = BPHS.getPlanetHouseAnalysis(chart);
        var html = '<table class="data-table">';
        html += '<thead><tr><th>Planet</th><th>House</th><th>Rashi</th><th>Marriage Effect</th></tr></thead>';
        html += '<tbody>';
        analysis.forEach(function(a) {
            html += '<tr>';
            html += '<td><strong>' + a.planet + '</strong></td>';
            html += '<td>' + a.house + '</td>';
            html += '<td>' + a.rashi + '</td>';
            html += '<td>' + a.effect + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderHouseLordTable(chart) {
        var analysis = BPHS.analyzeHouseLords(chart);
        var html = '<table class="data-table">';
        html += '<thead><tr><th>House</th><th>Lord</th><th>In House</th><th>In Rashi</th><th>Marriage Relevance</th></tr></thead>';
        html += '<tbody>';
        analysis.forEach(function(a) {
            html += '<tr>';
            html += '<td>' + a.house + '</td>';
            html += '<td><strong>' + a.lord + '</strong></td>';
            html += '<td>' + a.lordHouse + '</td>';
            html += '<td>' + a.lordRashi + '</td>';
            html += '<td>' + a.marriageRelevance + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderYogaTable(yogas) {
        if (yogas.length === 0) return '<p>No specific marriage yogas found.</p>';
        var html = '<table class="data-table">';
        html += '<thead><tr><th>Yoga</th><th>Description</th><th>Strength</th><th>Score</th></tr></thead>';
        html += '<tbody>';
        yogas.forEach(function(y) {
            var cls = y.strength === 'Positive' ? 'text-success' : (y.strength === 'Negative' ? 'text-error' : 'text-warning');
            html += '<tr>';
            html += '<td><strong>' + y.name + '</strong></td>';
            html += '<td>' + y.description + '</td>';
            html += '<td class="' + cls + '">' + y.strength + '</td>';
            html += '<td>' + (y.score > 0 ? '+' : '') + y.score + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderKPAssessment() {
        var container = document.getElementById('kp-content');
        if (!container) return;

        var html = '';
        var assessment = KP.assessMarriageKP(appState.boyChart, appState.girlChart);

        // KP Score
        html += '<div class="result-grid">';
        html += '<div class="result-card"><h4>KP Marriage Score</h4><div class="value">' + assessment.kpScore + '%</div></div>';
        html += '<div class="result-card"><h4>Boy Promise</h4><div class="value">' + (assessment.boyPromise.marriagePromised ? 'Yes' : 'Weak') + '</div></div>';
        html += '<div class="result-card"><h4>Girl Promise</h4><div class="value">' + (assessment.girlPromise.marriagePromised ? 'Yes' : 'Weak') + '</div></div>';
        html += '</div>';

        html += '<div class="score-label"><span>KP Marriage Assessment</span><span>' + assessment.kpScore + '%</span></div>';
        html += '<div class="score-bar"><div class="score-bar-fill" style="width:' + assessment.kpScore + '%"></div></div>';
        html += '<p class="mt-2"><strong>Verdict:</strong> ' + assessment.verdict + '</p>';

        // Cusp Sub-Lord Table for Boy
        html += '<h3 class="mt-3">Cusp Sub-Lord Table (Boy - ' + appState.boyName + ')</h3>';
        html += renderCuspSubLordTable(appState.boyChart);

        // Cusp Sub-Lord Table for Girl
        html += '<h3 class="mt-3">Cusp Sub-Lord Table (Girl - ' + appState.girlName + ')</h3>';
        html += renderCuspSubLordTable(appState.girlChart);

        // 7th Cusp Analysis
        html += '<h3 class="mt-3">7th Cusp Sub-Lord Analysis</h3>';
        html += '<div class="form-row">';
        html += '<div class="form-section"><h3>Boy</h3>';
        html += '<p><strong>7th Cusp Sign Lord:</strong> ' + assessment.boyPromise.cusp7SignLord + '</p>';
        html += '<p><strong>7th Cusp Star Lord:</strong> ' + assessment.boyPromise.cusp7StarLord + '</p>';
        html += '<p><strong>7th Cusp Sub Lord:</strong> ' + assessment.boyPromise.cusp7SubLord + '</p>';
        html += '<p class="mt-1"><strong>Positive Signification (2,7,11):</strong> ' + (assessment.boyPromise.positiveSignification.length > 0 ? 'Houses ' + assessment.boyPromise.positiveSignification.join(', ') : 'None') + '</p>';
        html += '<p><strong>Negative Signification (1,6,10,12):</strong> ' + (assessment.boyPromise.negativeSignification.length > 0 ? 'Houses ' + assessment.boyPromise.negativeSignification.join(', ') : 'None') + '</p>';
        html += '<p class="mt-1"><strong>' + assessment.boyPromise.verdict + '</strong></p>';
        html += '</div>';
        html += '<div class="form-section"><h3>Girl</h3>';
        html += '<p><strong>7th Cusp Sign Lord:</strong> ' + assessment.girlPromise.cusp7SignLord + '</p>';
        html += '<p><strong>7th Cusp Star Lord:</strong> ' + assessment.girlPromise.cusp7StarLord + '</p>';
        html += '<p><strong>7th Cusp Sub Lord:</strong> ' + assessment.girlPromise.cusp7SubLord + '</p>';
        html += '<p class="mt-1"><strong>Positive Signification (2,7,11):</strong> ' + (assessment.girlPromise.positiveSignification.length > 0 ? 'Houses ' + assessment.girlPromise.positiveSignification.join(', ') : 'None') + '</p>';
        html += '<p><strong>Negative Signification (1,6,10,12):</strong> ' + (assessment.girlPromise.negativeSignification.length > 0 ? 'Houses ' + assessment.girlPromise.negativeSignification.join(', ') : 'None') + '</p>';
        html += '<p class="mt-1"><strong>' + assessment.girlPromise.verdict + '</strong></p>';
        html += '</div></div>';

        // Significator Analysis for Houses 2, 7, 11
        html += '<h3 class="mt-3">Significator Analysis for Marriage Houses (2, 7, 11)</h3>';
        html += '<div class="form-row">';
        html += '<div class="form-section"><h3>Boy</h3>';
        html += renderSignificatorTable(KP.getMarriageHouseSignificators(appState.boyChart));
        html += '</div>';
        html += '<div class="form-section"><h3>Girl</h3>';
        html += renderSignificatorTable(KP.getMarriageHouseSignificators(appState.girlChart));
        html += '</div></div>';

        // Marriage Significators (strongest planets)
        html += '<h3 class="mt-3">Strongest Marriage Significators</h3>';
        html += '<div class="form-row">';
        html += '<div class="form-section"><h3>Boy</h3>';
        html += renderMarriageSignificators(assessment.boyPromise.marriageSignificators);
        html += '</div>';
        html += '<div class="form-section"><h3>Girl</h3>';
        html += renderMarriageSignificators(assessment.girlPromise.marriageSignificators);
        html += '</div></div>';

        // Ruling Planets
        html += '<h3 class="mt-3">Ruling Planets at Birth</h3>';
        html += '<div class="form-row">';
        html += '<div class="form-section"><h3>Boy</h3>';
        html += renderRulingPlanets(assessment.boyRuling);
        html += '</div>';
        html += '<div class="form-section"><h3>Girl</h3>';
        html += renderRulingPlanets(assessment.girlRuling);
        html += '</div></div>';

        container.innerHTML = html;
    }

    function renderCuspSubLordTable(chart) {
        var cusps = KP.getCuspSubLords(chart);
        var html = '<table class="data-table">';
        html += '<thead><tr><th>House</th><th>Cusp Degree</th><th>Sign</th><th>Sign Lord</th><th>Star Lord</th><th>Sub Lord</th></tr></thead>';
        html += '<tbody>';
        cusps.forEach(function(c) {
            html += '<tr>';
            html += '<td><strong>' + c.house + '</strong></td>';
            html += '<td>' + formatDegree(c.cuspDegree) + '</td>';
            html += '<td>' + c.signOnCusp + '</td>';
            html += '<td>' + c.signLord + '</td>';
            html += '<td>' + c.starLord + '</td>';
            html += '<td><strong>' + c.subLord + '</strong></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderSignificatorTable(sigData) {
        var html = '<table class="data-table">';
        html += '<thead><tr><th>House</th><th>Significators</th><th>Through</th></tr></thead>';
        html += '<tbody>';
        [2, 7, 11].forEach(function(h) {
            var planets = sigData[h];
            if (planets.length > 0) {
                planets.forEach(function(p, idx) {
                    html += '<tr>';
                    if (idx === 0) html += '<td rowspan="' + planets.length + '"><strong>' + h + '</strong></td>';
                    html += '<td>' + p.planet + '</td>';
                    html += '<td>' + p.through + '</td>';
                    html += '</tr>';
                });
            } else {
                html += '<tr><td><strong>' + h + '</strong></td><td colspan="2">No strong significators</td></tr>';
            }
        });
        html += '</tbody></table>';
        return html;
    }

    function renderMarriageSignificators(significators) {
        if (significators.length === 0) return '<p>No strong marriage significators found.</p>';
        var html = '<table class="data-table">';
        html += '<thead><tr><th>Planet</th><th>Signifies Houses</th><th>Strength</th></tr></thead>';
        html += '<tbody>';
        significators.forEach(function(s) {
            html += '<tr>';
            html += '<td><strong>' + s.planet + '</strong></td>';
            html += '<td>' + s.houses.join(', ') + '</td>';
            html += '<td>' + s.strength + '/3</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderRulingPlanets(ruling) {
        var html = '<table class="data-table">';
        html += '<thead><tr><th>Role</th><th>Planet</th></tr></thead>';
        html += '<tbody>';
        ruling.details.forEach(function(rp) {
            html += '<tr><td>' + rp.role + '</td><td><strong>' + rp.planet + '</strong></td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="mt-1"><strong>Interpretation:</strong> ' + ruling.interpretation + '</p>';
        return html;
    }

    function renderTimelinePlaceholder() {
        var container = document.getElementById('timeline-content');
        if (!container) return;
        container.innerHTML = '<div class="result-card"><h4>Marriage Timeline Analysis</h4>' +
            '<p>Dasha data computed. Marriage timeline prediction will be rendered here.</p></div>';
    }

    function renderForecastPlaceholder() {
        var container = document.getElementById('forecast-content');
        if (!container) return;
        container.innerHTML = '<div class="result-card"><h4>20-Year Forecast</h4>' +
            '<p>Dasha, Antardasha, and Pratyantardasha data computed. Forecast will be rendered here.</p></div>';
    }

    function renderHealthPlaceholder() {
        var container = document.getElementById('health-content');
        if (!container) return;
        container.innerHTML = '<div class="result-card"><h4>Health Compatibility</h4>' +
            '<p>Chart data available. Health compatibility assessment will be rendered here.</p></div>';
    }

    function renderAshtakootaPlaceholder() {
        var container = document.getElementById('ashtakoota-content');
        if (!container) return;
        var boyMoon = appState.boyChart.planets.Moon;
        var girlMoon = appState.girlChart.planets.Moon;
        container.innerHTML = '<div class="result-card"><h4>Ashtakoota Matching</h4>' +
            '<p>Moon positions calculated. Ashtakoota scores will be rendered here.</p>' +
            '<p class="mt-1">Boy Moon: ' + boyMoon.nakshatra + ' (Pada ' + boyMoon.pada + ') in ' + boyMoon.rashi + '</p>' +
            '<p>Girl Moon: ' + girlMoon.nakshatra + ' (Pada ' + girlMoon.pada + ') in ' + girlMoon.rashi + '</p>' +
            '</div>';
    }

    function renderDashakootaPlaceholder() {
        var container = document.getElementById('dashakoota-content');
        if (!container) return;
        container.innerHTML = '<div class="result-card"><h4>Dashakoota Matching</h4>' +
            '<p>Moon positions calculated. Dashakoota scores will be rendered here.</p></div>';
    }

    // ===== PDF Generation =====
    function initPDF() {
        var btn = document.getElementById('generate-pdf');
        if (btn) {
            btn.addEventListener('click', function() {
                generatePDF();
            });
        }
    }

    function generatePDF() {
        if (!appState.calculated) return;

        var pdfStatus = document.getElementById('pdf-status');
        if (pdfStatus) pdfStatus.textContent = 'Generating PDF... please wait.';

        // Create a temporary container with all content
        var content = document.createElement('div');
        content.innerHTML = '<h1 style="text-align:center;color:#4c1d95;">Marriage Matching Report</h1>';
        content.innerHTML += '<p style="text-align:center;">Boy: ' + appState.boyName + ' | Girl: ' + appState.girlName + '</p>';
        content.innerHTML += '<hr>';
        content.innerHTML += document.getElementById('bhava-content').innerHTML;

        var opt = {
            margin: 10,
            filename: 'marriage-matching-report.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(content).save().then(function() {
                if (pdfStatus) pdfStatus.textContent = 'PDF generated successfully!';
            });
        } else {
            if (pdfStatus) pdfStatus.textContent = 'PDF library not loaded. Please check your internet connection.';
        }
    }

    // ===== Initialize Application =====
    function init() {
        initTabs();
        initForm();
        initPDF();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

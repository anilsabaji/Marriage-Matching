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
            renderBPHSPlaceholder();
            renderKPPlaceholder();
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

    // ===== Render Bhava/House Analysis =====
    function renderBhavaAnalysis() {
        var container = document.getElementById('bhava-content');
        if (!container) return;

        var html = '';

        // Boy's Chart
        html += '<h3>Boy (' + appState.boyName + ') - Planetary Positions</h3>';
        html += renderPlanetTable(appState.boyChart);
        html += '<h3 class="mt-3">Boy - House Cusps</h3>';
        html += renderHouseTable(appState.boyChart);

        // Girl's Chart
        html += '<h3 class="mt-3">Girl (' + appState.girlName + ') - Planetary Positions</h3>';
        html += renderPlanetTable(appState.girlChart);
        html += '<h3 class="mt-3">Girl - House Cusps</h3>';
        html += renderHouseTable(appState.girlChart);

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

    function renderHouseTable(chart) {
        var html = '<table class="data-table">';
        html += '<thead><tr><th>House</th><th>Cusp</th><th>Rashi</th><th>Lord</th></tr></thead>';
        html += '<tbody>';

        chart.houses.houses.forEach(function(h) {
            html += '<tr>';
            html += '<td>' + h.house + '</td>';
            html += '<td>' + formatDegree(h.cusp) + '</td>';
            html += '<td>' + h.rashi + '</td>';
            html += '<td>' + h.lord + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function formatDegree(deg) {
        var d = Math.floor(deg);
        var m = Math.floor((deg - d) * 60);
        var s = Math.floor(((deg - d) * 60 - m) * 60);
        return d + '\u00B0 ' + m + "' " + s + '"';
    }

    // ===== Placeholder renderers for features to be implemented in later FEATs =====
    function renderBPHSPlaceholder() {
        var container = document.getElementById('bphs-content');
        if (!container) return;
        container.innerHTML = '<div class="result-card"><h4>BPHS Analysis</h4>' +
            '<p>Planetary positions calculated. BPHS house signification assessment will be rendered here.</p>' +
            '<p class="mt-1">Ascendant Lord (Boy): ' + appState.boyChart.houses.houses[0].lord + '</p>' +
            '<p>Ascendant Lord (Girl): ' + appState.girlChart.houses.houses[0].lord + '</p>' +
            '<p>7th House Lord (Boy): ' + appState.boyChart.houses.houses[6].lord + '</p>' +
            '<p>7th House Lord (Girl): ' + appState.girlChart.houses.houses[6].lord + '</p>' +
            '</div>';
    }

    function renderKPPlaceholder() {
        var container = document.getElementById('kp-content');
        if (!container) return;
        container.innerHTML = '<div class="result-card"><h4>KP System Analysis</h4>' +
            '<p>Chart data available. KP sub-lord analysis will be rendered here.</p>' +
            '<p class="mt-1">Ayanamsa used: ' + appState.boyChart.ayanamsa.toFixed(4) + ' (Lahiri)</p></div>';
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

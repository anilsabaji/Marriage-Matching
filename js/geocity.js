/* =============================================================================
 * geocity.js  —  City autocomplete & coordinate fetch
 *
 * Uses OpenStreetMap Nominatim (free, no API key) to search cities as the
 * user types. On selection, auto-fills latitude, longitude and timezone offset.
 * Timezone is estimated from longitude (15° per hour) — accurate enough for
 * most practical use. For India specifically we hardcode IST +5.5.
 * ========================================================================== */

const GeoCity = (function () {
  'use strict';

  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  let debounceTimer = null;

  // Estimate TZ offset from longitude (and known country codes)
  function estimateTZ(lat, lon, countryCode) {
    // India special case
    if (countryCode === 'in' || countryCode === 'IN') return 5.5;
    // Nepal
    if (countryCode === 'np' || countryCode === 'NP') return 5.75;
    // Sri Lanka
    if (countryCode === 'lk' || countryCode === 'LK') return 5.5;
    // General: round to nearest 0.5
    const raw = lon / 15;
    return Math.round(raw * 2) / 2;
  }

  async function searchCity(query) {
    if (!query || query.length < 2) return [];
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&featuretype=city`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((item) => ({
        display: item.display_name,
        name: buildName(item),
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        country: (item.address && item.address.country_code) || '',
        tz: estimateTZ(parseFloat(item.lat), parseFloat(item.lon), item.address && item.address.country_code),
      }));
    } catch (e) {
      console.warn('GeoCity fetch error:', e);
      return [];
    }
  }

  function buildName(item) {
    const a = item.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || '';
    const state = a.state || '';
    const country = a.country || '';
    const parts = [city, state, country].filter(Boolean);
    return parts.join(', ');
  }

  // Attach autocomplete to a place input and linked lat/lon/tz fields
  function attach(placeId, latId, lonId, tzId) {
    const input = document.getElementById(placeId);
    if (!input) return;

    // Create dropdown container
    const wrapper = document.createElement('div');
    wrapper.className = 'geo-autocomplete-wrap';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'geo-dropdown';
    dropdown.style.display = 'none';
    wrapper.appendChild(dropdown);

    let results = [];

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const val = input.value.trim();
      if (val.length < 2) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = '<div class="geo-item geo-loading">Searching...</div>';
      dropdown.style.display = 'block';
      debounceTimer = setTimeout(async () => {
        results = await searchCity(val);
        if (results.length === 0) {
          dropdown.innerHTML = '<div class="geo-item geo-loading">No results found. Try a different spelling.</div>';
          return;
        }
        dropdown.innerHTML = results.map((r, i) =>
          `<div class="geo-item" data-idx="${i}">${escHtml(r.name)}<span class="geo-coords">${r.lat.toFixed(2)}, ${r.lon.toFixed(2)} (TZ ${r.tz >= 0 ? '+' : ''}${r.tz})</span></div>`
        ).join('');
        dropdown.style.display = 'block';
      }, 350);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.geo-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx, 10);
      const r = results[idx];
      if (!r) return;
      input.value = r.name;
      document.getElementById(latId).value = r.lat.toFixed(4);
      document.getElementById(lonId).value = r.lon.toFixed(4);
      document.getElementById(tzId).value = r.tz;
      dropdown.style.display = 'none';
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) dropdown.style.display = 'none';
    });

    // Close on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dropdown.style.display = 'none';
    });
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { searchCity, estimateTZ, attach };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GeoCity;

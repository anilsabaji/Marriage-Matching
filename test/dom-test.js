/* Headless DOM smoke test for the Marriage Matching module.
 * Loads index.html + all scripts via jsdom, fills the form, submits, and
 * verifies every tab renders without error and contains expected content. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const scripts = ['astro-core', 'bphs', 'bhava-indications', 'kp', 'koota', 'dasha', 'transit', 'planet-strength', 'chart-draw', 'kuja', 'separation', 'timeline', 'health', 'sarvashtaka', 'progeny', 'geocity', 'manual', 'app']
  .map((n) => fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'));

// strip the <script src> tags so jsdom doesn't try to fetch; we inject manually
const htmlNoScripts = html.replace(/<script[^>]*src=[^>]*><\/script>/g, '');

const dom = new JSDOM(htmlNoScripts, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
window.scrollTo = () => {};
window.alert = (m) => console.log('ALERT:', m);
window.print = () => console.log('print() called');

// inject scripts in order into the window context
const vm = require('vm');
const ctx = dom.getInternalVMContext();
scripts.forEach((src, i) => {
  try { vm.runInContext(src, ctx); } catch (e) { console.error('Script load error in', i, e); process.exit(1); }
});

const errors = [];
window.addEventListener && window.addEventListener('error', (e) => errors.push(e.message));

// submit the form
const form = window.document.getElementById('matchForm');
const evt = new window.Event('submit', { bubbles: true, cancelable: true });
try {
  form.dispatchEvent(evt);
} catch (e) {
  console.error('Submit handler threw:', e);
  process.exit(1);
}

// verify tabs populated
const checks = [
  ['tab-charts', 'D1'],
  ['tab-bhava', 'House-by-House Matching'],
  ['tab-bphs', 'BPHS Marriage Assessment'],
  ['tab-kp', '7th cusp sub-lord'],
  ['tab-koota', 'Ashtakoota'],
  ['tab-kuja', 'Kuja (Maṅgala'],
  ['tab-timing', 'Nearest Marriage Timing'],
  ['tab-forecast', '20-Year Relationship'],
  ['tab-transit', 'Gochara'],
  ['tab-health', 'Health Compatibility Screener'],
  ['tab-sarvashtaka', 'Sarvashtakavarga'],
  ['tab-progeny', 'Progeny (Santāna) Analysis'],
  ['tab-manual', 'Technical Manual'],
  ['report-content', 'Marriage Compatibility Report'],
  ['summaryContent', '/100'],
];
let ok = true;
checks.forEach(([id, needle]) => {
  const el = window.document.getElementById(id);
  const txt = el ? el.innerHTML : '';
  const pass = txt && txt.includes(needle);
  if (!pass) { ok = false; console.log('FAIL', id, '— missing:', needle, '(len', txt.length, ')'); }
  else console.log('OK  ', id, '(', txt.length, 'chars)');
});

if (errors.length) { console.log('JS errors:', errors); ok = false; }
console.log(ok ? '\nALL DOM CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);

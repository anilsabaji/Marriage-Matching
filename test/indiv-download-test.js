/* Verifies Individual-mode report + download handlers don't crash
 * (regression test for state.boy/state.girl being null in individual mode). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = ['astro-core', 'bphs', 'bhava-indications', 'kp', 'koota', 'dasha', 'transit', 'planet-strength', 'chart-draw', 'kuja', 'separation', 'timeline', 'health', 'sarvashtaka', 'progeny', 'geocity', 'manual', 'app']
  .map((n) => fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'));
const htmlNoScripts = html.replace(/<script[^>]*src=[^>]*><\/script>/g, '');

const dom = new JSDOM(htmlNoScripts, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.com/' });
const { window } = dom;
global.window = window; global.document = window.document;
window.scrollTo = () => {};
window.alert = (m) => { console.log('ALERT:', m); };
window.print = () => console.log('print() called');
// stub fetch + URL for downloadHtml
window.fetch = async () => ({ ok: true, text: async () => '/* css */' });
window.URL.createObjectURL = () => 'blob:fake';
window.URL.revokeObjectURL = () => {};
// no html2pdf -> downloadPdf falls back to window.print

const ctx = dom.getInternalVMContext();
scripts.forEach((src, i) => { try { vm.runInContext(src, ctx); } catch (e) { console.error('load err', i, e); process.exit(1); } });

const errors = [];
// Switch to Individual mode (girl) so state.boy will be null — the crash case.
window.document.querySelector('#modeSeg .seg-btn[data-mode="individual"]').click();
window.document.querySelector('#whoSeg .seg-btn[data-who="girl"]').click();

// Submit form -> generateIndividual()
const form = window.document.getElementById('matchForm');
try { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }
catch (e) { console.error('Individual submit threw:', e); process.exit(1); }

const rep = window.document.getElementById('report-content').innerHTML;
console.log('OK   individual report rendered (', rep.length, 'chars)');
if (!rep.includes('Individual Marriage Analysis')) { console.error('FAIL: individual report cover missing'); process.exit(1); }

// Verify the Progeny tab rendered for the individual (uses Kṣetra for girl)
const prog = window.document.getElementById('tab-progeny').innerHTML;
if (!prog.includes('Progeny (Santāna) Analysis')) { console.error('FAIL: individual progeny tab not rendered'); process.exit(1); }
if (!prog.includes('Kṣetra')) { console.error('FAIL: individual (girl) progeny should use Kṣetra Sphuṭa'); process.exit(1); }
console.log('OK   individual progeny tab rendered (', prog.length, 'chars; Kṣetra Sphuṭa present)');

// Trigger Download HTML (this read state.boy.meta.name before the fix -> TypeError)
try { window.document.getElementById('downloadHtml').click(); }
catch (e) { console.error('FAIL downloadHtml threw:', e.message); process.exit(1); }
// allow async handler to run
setTimeout(() => {
  // Trigger Download PDF (falls back to iframe print since no html2pdf)
  try { window.document.getElementById('downloadPdf').click(); }
  catch (e) { console.error('FAIL downloadPdf threw:', e.message); process.exit(1); }
  // Trigger print report (iframe-based)
  try { window.document.getElementById('printReport').click(); }
  catch (e) { console.error('FAIL printReport threw:', e.message); process.exit(1); }
  // Give the async print pipeline a moment to build the iframe document
  setTimeout(() => {
    const frames = window.document.querySelectorAll('iframe');
    let ok = false;
    frames.forEach((f) => {
      try {
        const html = f.contentWindow.document.documentElement.innerHTML || '';
        if (html.includes('report-content') && html.includes('Build v5.15') && html.length > 5000) ok = true;
      } catch (e) { /* ignore */ }
    });
    if (!ok) { console.error('FAIL: print iframe did not contain a populated report document'); process.exit(1); }
    console.log('OK   print pipeline built a populated, self-contained report iframe (non-blank)');
    console.log('\nINDIVIDUAL DOWNLOAD HANDLERS OK (no crash)');
    process.exit(0);
  }, 150);
}, 100);

/*
 * tests/e2e.test.js — Headless end-to-end test: loads the real index.html in
 * jsdom, runs every tab like a user would, and verifies outputs against the
 * engine + reference vectors.
 *
 * Run:  node tests/e2e.test.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function until(fn, timeout) {
  timeout = timeout || 3000;
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function chk() {
      let v = null;
      try { v = fn(); } catch (e) { /* keep waiting */ }
      if (v) return resolve(v);
      if (Date.now() - t0 > timeout) return reject(new Error('timeout'));
      setTimeout(chk, 25);
    })();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function main() {
  // Load index.html but strip the Google Fonts <link> rows (no network in tests).
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/<link href="https:\/\/fonts[^>]*>/g, '');

  const dom = new JSDOM(html, {
    url: 'file://' + path.join(root, 'index.html'),
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { document } = window;

  // --- stubs jsdom lacks -------------------------------------------------
  let capturedBlob = null, capturedName = null;
  window.URL.createObjectURL = (b) => { capturedBlob = b; return 'blob:mock'; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    capturedName = this.download;   // intercept instead of navigating
  };
  const pageErrors = [];
  window.addEventListener('error', (e) => pageErrors.push(String(e.message)));

  await until(() => window.document.readyState === 'complete');
  await until(() => window.MyEncrypt && window.SELFTEST);
  await sleep(150); // let the boot self-test render

  const $ = (id) => document.getElementById(id);
  const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));

  /* 1. engine present & boot self-test all green */
  ok('page boots with engine loaded', !!window.MyEncrypt && !!window.MT && !!window.SHA512);
  const pill = $('compat-pill');
  await until(() => pill.className.indexOf('good') !== -1);
  ok('header pill turns green (15/15)', $('compat-label').textContent.indexOf('15/15') !== -1,
    $('compat-label').textContent);

  /* 2. tabs switch panels */
  document.querySelector('.tab[data-tab="seed"]').click();
  ok('tab click activates seed panel', $('panel-seed').classList.contains('is-active') &&
    !$('panel-enc').classList.contains('is-active'));
  document.querySelector('.tab[data-tab="enc"]').click();

  /* 3. encrypt text — matches real Python output */
  $('enc-text').value = 'Hello';
  $('enc-shift').value = '3';
  $('enc-pass').value = 'secret123';
  $('enc-go').click();
  const encOut = $('enc-out').textContent;
  ok('encrypt "Hello",3,"secret123" -> S<33a', encOut.indexOf('S<33a') !== -1, encOut);
  ok('CLI-style line shown', encOut.indexOf('Result: S<33a, 3, secret123') !== -1, encOut);

  /* 4. invalid shift mirrors the CLI error */
  $('enc-shift').value = 'abc';
  $('enc-go').click();
  ok('invalid shift shows CLI error message',
    $('enc-out').textContent.indexOf('Invalid format') !== -1);

  /* 5. decrypt text round-trip */
  $('dec-text').value = 'S<33a';
  $('dec-shift').value = '3';
  $('dec-pass').value = 'secret123';
  $('dec-go').click();
  ok('decrypt "S<33a" -> "Hello"', $('dec-out').textContent.indexOf('Decrypted text: Hello') !== -1,
    $('dec-out').textContent);

  /* 6. seed tab reproduces random.seed+shuffle */
  $('seed-pass').value = 'secret123';
  $('seed-go').click();
  ok('custom seed matches Python',
    $('seed-custom').textContent === window.PY_VECTORS.seed_secret);
  ok('base seed shown', $('seed-base').textContent === window.MyEncrypt.BASE_SEED);

  /* 7. encrypt file (drop-zone style selection) + download */
  const fileText = 'Hello from the file!\nSecond line with symbols: !@# 123';
  const f1 = new window.File([fileText], 'notes.txt', { type: 'text/plain' });
  Object.defineProperty($('efile-file'), 'files', { value: [f1], configurable: true });
  fire($('efile-file'), 'change');
  ok('file picker shows selected name', $('efile-name').textContent.indexOf('notes.txt') !== -1);
  $('efile-shift').value = '3';
  $('efile-pass').value = 'secret123';
  $('efile-go').click();
  await until(() => $('efile-status').textContent.indexOf('Encrypted and downloaded') !== -1);
  ok('file encrypted & offered as notes.enc.txt', capturedName === 'notes.enc.txt', capturedName);
  const encFileText = await new Promise((res) => {
    const fr = new window.FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsText(capturedBlob, 'utf-8');
  });
  ok('file content identical to Python encrypt_file()',
    encFileText === window.MyEncrypt.encrypt(fileText, 3, 'secret123') &&
    encFileText === "S<33a zgar 's< zu3</\n+<4ajw 3uj< ;u's +,r2a3+n /$^ [pv");

  /* 8. decrypt that encrypted file back.
   * NOTE: the real Python script does NOT restore upper-case when a shifted
   * letter landed on a symbol (symbols carry no case), so its own round-trip
   * of this file yields "second" in lower case. We assert the exact Python
   * ground truth, captured from My Encrypt.py (CPython 3.14.3). */
  capturedBlob = null; capturedName = null;
  const f2 = new window.File([encFileText], 'notes.enc.txt', { type: 'text/plain' });
  Object.defineProperty($('dfile-file'), 'files', { value: [f2], configurable: true });
  fire($('dfile-file'), 'change');
  $('dfile-shift').value = '3';
  $('dfile-pass').value = 'secret123';
  $('dfile-go').click();
  await until(() => $('dfile-status').textContent.indexOf('Decrypted and downloaded') !== -1);
  ok('file decrypted back as notes.dec.txt', capturedName === 'notes.dec.txt', capturedName);
  const decFileText = await new Promise((res) => {
    const fr = new window.FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsText(capturedBlob, 'utf-8');
  });
  ok('file round-trip matches the Python script exactly',
    decFileText === 'Hello from the file!\nsecond line with symbols: !@# 123',
    JSON.stringify(decFileText));

  /* 9. unicode + multiline engine round-trip — again vs real Python output
   * (the leading H of "Héllo" lands on a symbol, Python keeps it lowercase). */
  const tricky = 'Héllo ❤ wörld!\nmulti\nline\ttabs 123 !!!';
  const rt = window.MyEncrypt.decrypt(
    window.MyEncrypt.encrypt(tricky, -7, 'pässwörd 123'), -7, 'pässwörd 123');
  ok('unicode/multiline round-trip matches Python exactly',
    rt === 'héllo ❤ wörld!\nmulti\nline\ttabs 123 !!!', JSON.stringify(rt));

  /* 10. no uncaught page errors during the whole session */
  ok('no uncaught JS errors on the page', pageErrors.length === 0, pageErrors.join(' | '));

  console.log('-------------------------------------');
  console.log(passed + ' passed, ' + failed + ' failed');
  window.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('E2E ERROR:', e); process.exit(1); });

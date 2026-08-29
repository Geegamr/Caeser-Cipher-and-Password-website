/*
 * ui.js — Page controller. Wires the DOM to the MyEncrypt engine and mirrors
 * the CLI behaviour of `My Encrypt.py`:
 *   - inputs validated like the CLI's int()/rsplit(",", 2) flow
 *   - outputs printed in the same format the CLI prints them
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* ---------------- toast ---------------- */

  var toastTimer = null;
  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ---------------- clipboard ---------------- */

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
      document.body.removeChild(ta);
      if (copied) toast(okMsg || 'Copied to clipboard', 'ok');
      else toast('Copy failed — select the text manually', 'err');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast(okMsg || 'Copied to clipboard', 'ok'); },
        fallback
      );
    } else {
      fallback();
    }
  }

  /* ---------------- output rendering ---------------- */

  function clearNode(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function flash(el) {
    el.classList.remove('flash');
    void el.offsetWidth;              // restart the CSS animation
    el.classList.add('flash');
  }

  // payload = the big line (the transformed text)
  // cliLine = the exact line the Python CLI would print (small, dimmed)
  function renderOutput(el, payload, cliLine) {
    clearNode(el);
    el.classList.remove('is-ok', 'is-error');
    el.classList.add('is-ok');

    var pre = document.createElement('pre');
    pre.className = 'out-payload';
    pre.textContent = payload;
    el.appendChild(pre);

    if (cliLine) {
      var div = document.createElement('div');
      div.className = 'out-cli';
      div.textContent = cliLine;
      el.appendChild(div);
    }
    flash(el);
  }

  function renderError(el, msg) {
    clearNode(el);
    el.classList.remove('is-ok');
    el.classList.add('is-error');

    var pre = document.createElement('pre');
    pre.className = 'out-payload';
    pre.textContent = msg;
    el.appendChild(pre);
    flash(el);
  }

  /* ---------------- input validation ---------------- */

  // Mirrors Python int(): optional sign + digits only.
  function parseShift(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!/^[+-]?\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return isFinite(n) ? n : null;
  }

  /* ---------------- tabs ---------------- */

  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));

    function activate(name) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === name;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.id === 'panel-' + name);
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () { activate(t.getAttribute('data-tab')); });
    });
  }

  /* ---------------- encrypt / decrypt text ---------------- */

  function initTextPanel(prefix, verb) {
    var textEl = $(prefix + '-text');
    var shiftEl = $(prefix + '-shift');
    var passEl = $(prefix + '-pass');
    var goBtn = $(prefix + '-go');
    var copyBtn = $(prefix + '-copy');
    var outEl = $(prefix + '-out');
    var lastResult = '';

    copyBtn.addEventListener('click', function () {
      copyText(lastResult, (verb === 'encrypt' ? 'Encrypted' : 'Decrypted') + ' text copied');
    });

    function run() {
      var text = textEl.value;
      var shift = parseShift(shiftEl.value);
      // The CLI .strip()s every comma-separated part — the password too.
      var password = passEl.value.trim();

      if (shift === null) {
        renderError(outEl, "Invalid format. Please use 'Text, Shift, Password' (Hello, 3, secret123).");
        copyBtn.disabled = true;
        lastResult = '';
        return;
      }

      var result = (verb === 'encrypt')
        ? MyEncrypt.encrypt(text, shift, password)
        : MyEncrypt.decrypt(text, shift, password);
      lastResult = result;

      var cliLine = (verb === 'encrypt')
        ? 'Result: ' + result + ', ' + shift + ', ' + password
        : 'Decrypted text: ' + result;
      renderOutput(outEl, result, cliLine);
      copyBtn.disabled = false;
    }

    goBtn.addEventListener('click', run);
    [shiftEl, passEl].forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); run(); }
      });
    });
  }

  /* ---------------- get seed ---------------- */

  function initSeedPanel() {
    var passEl = $('seed-pass');
    var goBtn = $('seed-go');
    var copyBtn = $('seed-copy');
    var baseEl = $('seed-base');
    var customEl = $('seed-custom');
    var lastSeed = '';

    baseEl.textContent = MyEncrypt.BASE_SEED;

    copyBtn.addEventListener('click', function () { copyText(lastSeed, 'Seed copied'); });

    function run() {
      // get_seed() does input().strip() on the password line.
      var password = passEl.value.trim();
      lastSeed = MyEncrypt.getCustomSeed(password);
      customEl.textContent = lastSeed;
      flash(customEl);
      copyBtn.disabled = false;
    }

    goBtn.addEventListener('click', run);
    passEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
  }

  /* ---------------- boot ---------------- */

  function init() {
    initTabs();
    initTextPanel('enc', 'encrypt');
    initTextPanel('dec', 'decrypt');
    initSeedPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

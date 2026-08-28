/*
 * ui.js — Page controller. Wires the DOM to the MyEncrypt engine and mirrors
 * the CLI behaviour of `My Encrypt.py`:
 *   - inputs validated like the CLI's int()/rsplit(",", 2) flow
 *   - outputs printed in the same format the CLI prints them
 *   - file tabs transform UTF-8 text and download the result (the browser
 *     cannot overwrite a file in place — your original file is never touched)
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

  /* ---------------- encrypt / decrypt file ---------------- */

  // notes.txt     -> notes.enc.txt   (encrypt)
  // notes.enc.txt -> notes.dec.txt   (decrypt)
  function derivedName(originalName, verb) {
    var base = originalName.replace(/\.enc\.txt$/i, '');
    base = base.replace(/\.[^.]*$/, '');
    return base + '.' + (verb === 'encrypt' ? 'enc' : 'dec') + '.txt';
  }

  function initFilePanel(prefix, verb) {
    var input = $(prefix + '-file');
    var drop = $(prefix + '-drop');
    var nameEl = $(prefix + '-name');
    var goBtn = $(prefix + '-go');
    var outEl = $(prefix + '-status');
    var file = null;

    function setFile(f) {
      if (!f) return;
      file = f;
      nameEl.textContent = f.name + '  (' + f.size + ' bytes)';
      drop.classList.add('has-file');
    }

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) setFile(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.remove('drag');
      });
    });
    drop.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) setFile(dt.files[0]);
    });

    goBtn.addEventListener('click', function () {
      if (!file) {
        renderError(outEl, 'Choose a file first — drop it above or click to browse.');
        return;
      }
      var shift = parseShift($(prefix + '-shift').value);
      var password = $(prefix + '-pass').value.trim();
      if (shift === null) {
        renderError(outEl, "Invalid format. Please use 'File Path, Shift, Password' (notes.txt, 3, secret123).");
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () {
        renderError(outEl, 'Could not read the file: ' + file.name);
      };
      reader.onload = function () {
        var content = String(reader.result);
        if (content.indexOf('\uFFFD') !== -1) {
          renderError(outEl, 'This does not look like valid UTF-8 text. The Python script would fail here too (UnicodeDecodeError).');
          return;
        }
        var result = (verb === 'encrypt')
          ? MyEncrypt.encrypt(content, shift, password)
          : MyEncrypt.decrypt(content, shift, password);

        var outName = derivedName(file.name, verb);
        var blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = outName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

        renderOutput(
          outEl,
          (verb === 'encrypt' ? 'Encrypted and downloaded: ' : 'Decrypted and downloaded: ') + outName,
          'Saved with shift=' + shift + ', password=' + password + '.  (' + result.length + ' chars)'
        );
      };
      reader.readAsText(file, 'utf-8');
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

  /* ---------------- self-test + compatibility pill ---------------- */

  function runChecks() {
    var list = $('selftest-results');
    var pill = $('compat-pill');
    var label = $('compat-label');
    if (!list || typeof SELFTEST === 'undefined') return;

    var results = SELFTEST.run();
    clearNode(list);

    var pass = 0;
    results.forEach(function (r) {
      if (r.pass) pass++;
      var li = document.createElement('li');
      li.className = 'item ' + (r.pass ? 'pass' : 'fail');
      if (!r.pass) li.title = 'expected: ' + r.expected + '\nactual:   ' + r.actual;

      var mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = r.pass ? '\u2713' : '\u2717';
      li.appendChild(mark);

      var name = document.createElement('span');
      name.textContent = r.name;
      li.appendChild(name);

      list.appendChild(li);
    });

    if (pill && label) {
      pill.classList.remove('busy', 'good', 'bad');
      if (pass === results.length) {
        pill.classList.add('good');
        label.textContent = 'Python-compatible \u2713 ' + pass + '/' + results.length;
      } else {
        pill.classList.add('bad');
        label.textContent = 'Compatibility FAILED ' + pass + '/' + results.length;
      }
    }
  }

  /* ---------------- boot ---------------- */

  function init() {
    initTabs();
    initTextPanel('enc', 'encrypt');
    initTextPanel('dec', 'decrypt');
    initFilePanel('efile', 'encrypt');
    initFilePanel('dfile', 'decrypt');
    initSeedPanel();

    var again = $('selftest-btn');
    if (again) again.addEventListener('click', runChecks);
    runChecks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

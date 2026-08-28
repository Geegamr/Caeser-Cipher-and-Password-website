/*
 * selftest.js — Re-validates the JS port against reference outputs that were
 * captured from the real `My Encrypt.py` running on CPython 3.14.3 and stored
 * in `vectors.js`. Runs automatically on page load and on demand.
 */
(function (global) {
  'use strict';

  function runSelfTest() {
    var V = (typeof global.PY_VECTORS === 'object') ? global.PY_VECTORS : {};
    var results = [];

    function check(name, actual, expected) {
      var pass = actual === expected;
      results.push({ name: name, actual: actual, expected: expected, pass: pass });
    }

    var BASE_SEED = MyEncrypt.BASE_SEED;

    check('alphabet length (66)', BASE_SEED.length, 66);
    check('SHA-512("secret123")', SHA512.hex('secret123'), V.sha512_secret);
    check('SHA-512("")', SHA512.hex(''), V.sha512_empty);

    check('seed("secret123")', MyEncrypt.getCustomSeed('secret123'), V.seed_secret);
    check('seed("")', MyEncrypt.getCustomSeed(''), V.seed_empty);
    check('seed("p\u00e4ssw\u00f6rd 123")', MyEncrypt.getCustomSeed('p\u00e4ssw\u00f6rd 123'), V.seed_unicode);

    check('encrypt("Hello",3,"secret123")', MyEncrypt.encrypt('Hello', 3, 'secret123'), V.enc_hello);
    check('decrypt("S<33a",3,"secret123")', MyEncrypt.decrypt('S<33a', 3, 'secret123'), V.dec_hello);
    check('encrypt("Hello, World! 123 ABC",7,"P@ssw0rd")', MyEncrypt.encrypt('Hello, World! 123 ABC', 7, 'P@ssw0rd'), V.enc_case);
    check('encrypt("Hello",-3,"secret123")', MyEncrypt.encrypt('Hello', -3, 'secret123'), V.enc_neg);
    check('decrypt("Hello",-3,"secret123")', MyEncrypt.decrypt('Hello', -3, 'secret123'), V.dec_neg);
    check('encrypt("Hello",80,"secret123")', MyEncrypt.encrypt('Hello', 80, 'secret123'), V.enc_big);
    check('encrypt("HELLO",3,"secret123")', MyEncrypt.encrypt('HELLO', 3, 'secret123'), V.enc_upper);
    check('encrypt(unicode,3,"pw")', MyEncrypt.encrypt('h\u00e9llo \u2764 world', 3, 'pw'), V.enc_unicode);
    check('roundtrip BASE_SEED (shift 13)',
      MyEncrypt.decrypt(MyEncrypt.encrypt(BASE_SEED, 13, 'test'), 13, 'test'), V.roundtrip);

    return results;
  }

  global.SELFTEST = { run: runSelfTest };
})(typeof window !== 'undefined' ? window : globalThis);
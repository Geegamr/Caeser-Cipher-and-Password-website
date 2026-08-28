/*
 * encrypt.js — Faithful JavaScript port of `My Encrypt.py`.
 *
 * Behaviour documented/intended to match the Python script exactly, so any text
 * encrypted by the Python CLI can be decrypted here (and vice-versa):
 *
 *   - BASE_SEED is the same 66-char alphabet.
 *   - getCustomSeed() reproduces random.shuffle(seed_list) after
 *     random.seed(password) using CPython's MT19937 seeding and shuffle.
 *   - encrypt()/decrypt() replicate the character-wise Caesar shift with
 *     case-only-on-output, floor-modulo handling of shift, and passthrough of
 *     any character outside the alphabet.
 */
(function (global) {
  'use strict';

  var BASE_SEED = "abcdefghijklmnopqrstuvwxyz1234567890!@#$%^&*()_+-=~`[]{}|;:',.<>/?";

  function modulo(a, m) {
    // Python-style floor modulo (handles negative and oversize shifts).
    return ((a % m) + m) % m;
  }

  // Mirrors get_custom_seed(password): returns the 66-char shuffled alphabet.
  function getCustomSeed(password) {
    var seedList = Array.from(BASE_SEED);
    var mt = MT.seedFromString(String(password));
    MT.shuffle(mt, seedList);
    return seedList.join('');
  }

  function buildIndex(seed) {
    var index = {};
    for (var i = 0; i < seed.length; i++) index[seed[i]] = i;
    return index;
  }

  // Mirrors encrypt(): returns encrypted text.
  function encrypt(text, shift, password) {
    var seed = getCustomSeed(password);
    var seedLen = seed.length;
    var index = buildIndex(seed);
    var out = '';
    for (var k = 0; k < text.length; k++) {
      var char = text[k];
      var lower = char.toLowerCase();
      var i = index[lower];
      if (i !== undefined) {
        var c = seed[modulo(i + shift, seedLen)];
        // Python: c.upper() if char.isupper() else c
        out += (char !== char.toLowerCase() && char === char.toUpperCase()) ? c.toUpperCase() : c;
      } else {
        out += char;
      }
    }
    return out;
  }

  // Mirrors decrypt(): returns decrypted text.
  function decrypt(text, shift, password) {
    var seed = getCustomSeed(password);
    var seedLen = seed.length;
    var index = buildIndex(seed);
    var out = '';
    for (var k = 0; k < text.length; k++) {
      var char = text[k];
      var lower = char.toLowerCase();
      var i = index[lower];
      if (i !== undefined) {
        var c = seed[modulo(i - shift, seedLen)];
        out += (char !== char.toLowerCase() && char === char.toUpperCase()) ? c.toUpperCase() : c;
      } else {
        out += char;
      }
    }
    return out;
  }

  global.MyEncrypt = {
    BASE_SEED: BASE_SEED,
    getCustomSeed: getCustomSeed,
    encrypt: encrypt,
    decrypt: decrypt
  };
})(typeof window !== 'undefined' ? window : globalThis);
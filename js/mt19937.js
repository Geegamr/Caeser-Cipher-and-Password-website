/*
 * mt19937.js — Mersenne Twister (MT19937) + CPython-compatible seeding/shuffle.
 *
 * Replicates, in JavaScript, the exact stream produced by Python's `random`
 * module for string seeds across CPython 3.7 - 3.14:
 *
 *   1. seed_int = int.from_bytes(password_utf8 + sha512(password_utf8), 'big')
 *   2. split into little-endian 32-bit words (init_by_array key)
 *   3. init_by_array(seed, keywords)  (standard MT19937)
 *   4. random.shuffle() semantics via getrandbits() rejection sampling
 *
 * Verified against CPython 3.14.3 (`My Encrypt.py`) in the project self-test.
 */
(function (global) {
  'use strict';

  var N = 624, M = 397;
  var MATRIX_A = 0x9908b0df;
  var UPPER_MASK = 0x80000000;
  var LOWER_MASK = 0x7fffffff;

  function MT19937() {
    this.mt = new Uint32Array(N);
    this.index = N;
  }

  MT19937.prototype.init_genrand = function (s) {
    var mt = this.mt;
    mt[0] = s >>> 0;
    for (var i = 1; i < N; i++) {
      mt[i] = (Math.imul(1812433253, (mt[i - 1] ^ (mt[i - 1] >>> 30))) + i) >>> 0;
    }
    this.index = N;
  };

  MT19937.prototype.init_by_array = function (initKey, keyLength) {
    var mt = this.mt;
    this.init_genrand(19650218);
    var i = 1, j = 0, k;
    k = (N > keyLength) ? N : keyLength;
    for (; k; k--) {
      mt[i] = ((mt[i] ^ Math.imul((mt[i - 1] ^ (mt[i - 1] >>> 30)), 1664525)) + initKey[j] + j) >>> 0;
      i++; j++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      if (j >= keyLength) j = 0;
    }
    for (k = N - 1; k; k--) {
      mt[i] = ((mt[i] ^ Math.imul((mt[i - 1] ^ (mt[i - 1] >>> 30)), 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
    }
    mt[0] = 0x80000000 >>> 0;
  };

  MT19937.prototype.next_uint32 = function () {
    var mt = this.mt;
    if (this.index >= N) {
      for (var i = 0; i < N; i++) {
        var y = (mt[i] & UPPER_MASK) | (mt[(i + 1) % N] & LOWER_MASK);
        mt[i] = mt[(i + M) % N] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      this.index = 0;
    }
    var z = mt[this.index++];
    z ^= z >>> 11;
    z ^= (z << 7) & 0x9d2c5680;
    z ^= (z << 15) & 0xefc60000;
    z ^= z >>> 18;
    return z >>> 0;
  };

  // seedFromString: reproduce CPython str/bytes seed -> seeded MT19937.
  function seedFromString(password) {
    var bytes = SHA512.utf8ToBytes(password);                       // UTF-8 bytes
    var digest = SHA512.bytes(bytes);                               // 64 sha512 bytes
    var words = [];
    // Combined big integer: utf8_password || sha512(password), then split into
    // little-endian 32-bit words (identical to _PyLong_AsByteArray LITTLE_ENDIAN).
    var n = 0n;
    for (var i = 0; i < bytes.length; i++) n = (n << 8n) | BigInt(bytes[i]);
    for (var j = 0; j < digest.length; j++) n = (n << 8n) | BigInt(digest[j]);

    var bits = (bytes.length + digest.length) * 8;
    var keyused = bits === 0 ? 1 : Math.floor((bits - 1) / 32) + 1;
    for (var k = 0; k < keyused; k++) {
      words.push(Number((n >> (32n * BigInt(k))) & 0xffffffffn) >>> 0);
    }
    var mt = new MT19937();
    mt.init_by_array(words, words.length);
    return mt;
  }

  // Random helpers mirroring random.py's inner methods.
  function getrandbits(mt, k) {
    if (k <= 0) return 0;
    var words = Math.ceil(k / 32);
    var result = 0n;
    for (var i = 0; i < words; i++) {
      result |= BigInt(mt.next_uint32()) << (32n * BigInt(i));
    }
    var excess = words * 32 - k;
    if (excess) result >>= BigInt(excess);
    return Number(result);
  }

  function bit_length(x) {
    var r = 0;
    while (x > 0) { x = Math.floor(x / 2); r++; }
    return r;
  }

  // Python _randbelow_with_getrandbits(n): returns int in [0, n),
  // rejection-sampling top bits (k = n.bit_length(), NOT (n-1).bit_length()).
  function _randbelow(mt, n) {
    if (n <= 1) return 0;
    var k = bit_length(n);
    var r = getrandbits(mt, k);
    while (r >= n) r = getrandbits(mt, k);
    return r;
  }

  // Python random.shuffle(x) -> in-place shuffle using x[i], x[j] swap.
  function shuffle(mt, seq) {
    var n = seq.length;
    for (var i = n - 1; i > 0; i--) {
      var j = _randbelow(mt, i + 1);
      var t = seq[i]; seq[i] = seq[j]; seq[j] = t;
    }
    return seq;
  }

  global.MT = {
    MT19937: MT19937,
    seedFromString: seedFromString,
    getrandbits: getrandbits,
    shuffle: shuffle
  };
})(typeof window !== 'undefined' ? window : globalThis);
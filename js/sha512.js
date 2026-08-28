/*
 * sha512.js — Pure-JavaScript SHA-512 implementation.
 *
 * Used to reproduce CPython's `random.seed()` exactly:
 *   seed_int = int.from_bytes(password_utf8 + sha512(password_utf8), 'big')
 *
 * Works offline and from file:// (no network, no crypto.subtle).
 */
(function (global) {
  'use strict';

  var MASK64 = (1n << 64n) - 1n;

  // Round constants K[0..79]: first 64 bits of cube roots of first 80 primes.
  var K = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
    0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
    0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
    0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
    0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
    0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
    0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
    0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
    0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
    0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
    0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
  ];

  var H0 = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
  ];
function rotR(x, n) {
    return (x >> BigInt(n)) | ((x << BigInt(64 - n)) & MASK64);
  }

  function sha512Bytes(bytes) {
    // bytes: array-like of integers 0..255
    var dataLen = bytes.length;
    var totalBits = dataLen * 8;

    // Padding: append 0x80, then zeros until (dataLen + 1 + padLen) % 128 === 112,
    // then 16 bytes of the 128-bit big-endian message length.
    var padLen = (112 - ((dataLen + 1) % 128) + 128) % 128;
    var bufLen = dataLen + 1 + padLen + 16;

    var buf = new Uint8Array(bufLen);
    buf.set(bytes, 0);
    buf[dataLen] = 0x80;

    var totalBitsBI = BigInt(totalBits);
    var low = totalBitsBI & 0xffffffffn;
    var high = (totalBitsBI >> 32n) & 0xffffffffn;
    var p = bufLen - 8;
    for (var i = 0; i < 4; i++) buf[p + i] = Number((high >> BigInt(24 - i * 8)) & 0xffn);
    for (var i = 0; i < 4; i++) buf[p + 4 + i] = Number((low >> BigInt(24 - i * 8)) & 0xffn);

    var h = H0.slice();
    var w = new Array(80);

    for (var off = 0; off < bufLen; off += 128) {
      for (var i = 0; i < 16; i++) {
        var v = 0n;
        for (var j = 0; j < 8; j++) v = (v << 8n) | BigInt(buf[off + i * 8 + j]);
        w[i] = v & MASK64;
      }
      for (var wi = 16; wi < 80; wi++) {
        var s0 = rotR(w[wi - 15], 1) ^ rotR(w[wi - 15], 8) ^ (w[wi - 15] >> 7n);
        var s1 = rotR(w[wi - 2], 19) ^ rotR(w[wi - 2], 61) ^ (w[wi - 2] >> 6n);
        w[wi] = (w[wi - 16] + s0 + w[wi - 7] + s1) & MASK64;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3],
          e = h[4], f = h[5], g = h[6], hh = h[7];

      for (var r = 0; r < 80; r++) {
        var S1 = rotR(e, 14) ^ rotR(e, 18) ^ rotR(e, 41);
        var ch = (e & f) ^ ((~e & MASK64) & g);
        var t1 = (hh + S1 + ch + K[r] + w[r]) & MASK64;
        var S0 = rotR(a, 28) ^ rotR(a, 34) ^ rotR(a, 39);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) & MASK64;
        hh = g; g = f; f = e; e = (d + t1) & MASK64;
        d = c; c = b; b = a; a = (t1 + t2) & MASK64;
      }

      h[0] = (h[0] + a) & MASK64; h[1] = (h[1] + b) & MASK64;
      h[2] = (h[2] + c) & MASK64; h[3] = (h[3] + d) & MASK64;
      h[4] = (h[4] + e) & MASK64; h[5] = (h[5] + f) & MASK64;
      h[6] = (h[6] + g) & MASK64; h[7] = (h[7] + hh) & MASK64;
    }

    var out = new Uint8Array(64);
    for (var k = 0; k < 8; k++)
      for (var kk = 0; kk < 8; kk++)
        out[k * 8 + kk] = Number((h[k] >> BigInt(56 - kk * 8)) & 0xffn);
    return out;
  }

  function utf8ToBytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], i = 0;
    while (i < str.length) {
      var code = str.codePointAt(i);
      i += code > 0xffff ? 2 : 1;
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return new Uint8Array(out);
  }

  function toHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return hex;
  }

  global.SHA512 = {
    utf8ToBytes: utf8ToBytes,
    bytes: sha512Bytes,
    hex: function (str) { return toHex(sha512Bytes(utf8ToBytes(str))); },
    toString: toHex
  };
})(typeof window !== 'undefined' ? window : globalThis);
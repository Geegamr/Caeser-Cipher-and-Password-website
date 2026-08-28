/*
 * tests/run-selftest.js — Node harness for the client-side selftest.
 * Run from the site folder:  node tests/run-selftest.js
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');

global.window = globalThis;            // vectors.js writes to window.PY_VECTORS
global.globalThis = globalThis;

require(path.join(root, 'js', 'vectors.js'));
require(path.join(root, 'js', 'sha512.js'));
require(path.join(root, 'js', 'mt19937.js'));
require(path.join(root, 'js', 'encrypt.js'));
require(path.join(root, 'js', 'selftest.js'));

const results = global.SELFTEST.run();
let pass = 0, fail = 0;
for (const r of results) {
  if (r.pass) {
    pass++;
    console.log('PASS  ' + r.name);
  } else {
    fail++;
    console.log('FAIL  ' + r.name);
    console.log('      expected: ' + JSON.stringify(r.expected));
    console.log('      actual  : ' + JSON.stringify(r.actual));
  }
}
console.log('-------------------------------------');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
# My Encrypt

A **HTML + CSS + JavaScript** port of [`My Encrypt.py`](../My%20Encrypt.py) —
the password-seeded substitution cipher — as a static website you can host free on
**GitHub Pages**.

> **Everything is cross-compatible:** text encrypted by the Python script can be
> decrypted by this site with the same *shift* + *password*, and vice-versa.

## ✨ Features

| Python CLI menu | Website tab | Notes |
|---|---|---|
| `[1]` Encrypt text | 🔒 **Encrypt Text** | Same output format: `Result: <text>, <shift>, <password>` |
| `[2]` Decrypt text | 🔓 **Decrypt Text** | Prints `Decrypted text: ...` like the CLI |
| `[3]` Encrypt a text file | 📄 **Encrypt File** | Drag & drop, downloads `name.enc.txt` |
| `[4]` Decrypt a text file | 📁 **Decrypt File** | Downloads `name.dec.txt` |
| `[5]` Get seed from password | 🧬 **Get Seed** | Shows base seed + password seed |

Extras: copy-to-clipboard buttons, drag-and-drop file zones, mobile-friendly
dark UI, **100% client-side** (no servers, works offline from `file://`).

## 🚀 Quick start

No build step, no dependencies:

- **Locally** — just open `index.html` in any browser, or serve the folder:
  ```
  python -m http.server 8000
  # → http://localhost:8000
  ```
- **On the web** — see *Deploying to GitHub Pages* below.

## 🧠 How the cipher works

1. `BASE_SEED` is a 66-character alphabet:
   `abcdefghijklmnopqrstuvwxyz1234567890!@#$%^&*()_+-=~`[]{}|;:',.<>/?`
2. The password is turned into a deterministic **shuffled alphabet** — exactly
   what `random.seed(password)` + `random.shuffle()` produce in CPython:
   `seed_int = int.from_bytes(utf8(pw) + sha512(utf8(pw)), "big")` → MT19937
   `init_by_array` → Fisher–Yates shuffle.
3. Each character found in the seed is shifted by `shift` positions within that
   alphabet (floor modulo, so negative/huge shifts work). Uppercase in → uppercase
   out. **Any character not in the seed** (space, newline, `é`, emoji…) passes
   through untouched — same as the Python script.

Example (shift `3`, password `secret123`):

```
Hello  →  S<33a
```

Decrypt `S<33a` with the same shift + password in *either* tool and you get
`Hello` back.

## 🔄 Working with the Python CLI

Because both implementations share the exact key stream:

1. Encrypt on the site: `Hello`, shift `3`, password `secret123` → `S<33a`
2. In the Python CLI choose `[2]` and type: `S<33a, 3, secret123` → `Hello`

…and the reverse direction works identically.

### About file encryption

The Python CLI overwrites your file **in place**. A browser is not allowed to
write to your disk, so the site instead **downloads** a converted copy
(`notes.txt` → `notes.enc.txt`, `notes.enc.txt` → `notes.dec.txt`). Your
original file is never modified — strictly safer than the CLI. The *contents*
are byte-for-byte what `encrypt_file()` / `decrypt_file()` would produce.

## 📁 Project structure

```
my-encrypt-site/
├── index.html            # single-page app (5 tabs)
├── css/style.css         # dark "cipher terminal" theme, no frameworks
├── js/
│   ├── sha512.js         # pure-JS SHA-512 (no crypto.subtle → works offline)
│   ├── mt19937.js        # Mersenne Twister + CPython seeding/shuffle
│   ├── encrypt.js        # the cipher engine (port of My Encrypt.py)
│   ├── vectors.js        # reference outputs captured from the real script (tests only)
│   ├── selftest.js       # validates the engine against vectors (tests only)
│   └── ui.js             # page controller
└── tests/
    ├── run-selftest.js   # Node harness: node tests/run-selftest.js
    └── e2e.test.js       # headless browser test (jsdom), optional
```

## ✅ Verifying compatibility

```bash
node tests/run-selftest.js     # 15 checks against real Python outputs
```

The engine checks are dev-time only: run `node tests/run-selftest.js`
(15 checks against real Python outputs) or the headless browser test
`node tests/e2e.test.js` (needs `npm install jsdom` in `tests/`).

Reference vectors were generated with **CPython 3.14.3**; the seeding algorithm
used by `random.seed(str)` is unchanged from Python 3.7 through 3.14, so output
matches any modern Python.

## 🌍 Deploying to GitHub Pages

1. Create a new repository on GitHub (e.g. `my-encrypt-site`), **public**.
2. From this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/my-encrypt-site.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages →** under *Build and deployment*, set
   **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)** → Save.
4. Wait ~1 minute, then open:
   `https://<your-username>.github.io/my-encrypt-site/`

Done — the site is live, HTTPS, free, and updates whenever you `git push`.

## ⚠️ Security note

This is a **classical substitution cipher with a password-derived alphabet** —
great for learning, puzzles, and obfuscation, but **not** cryptographically
secure. Don't use it for genuinely sensitive data.

## 📜 License

Do whatever you like. The cipher design comes from `My Encrypt.py`.

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("app.js");
const html = read("index.html");
const serviceWorker = read("sw.js");

assert.match(app, /const DB_NAME = "mexican-spanish-flashcards-db";/);
assert.match(app, /const DB_VERSION = 2;/);
assert.match(app, /const TS_FSRS_VERSION = "ts-fsrs@5\.4\.1";/);
assert.match(app, /elements\.previous\.addEventListener/);
assert.match(app, /elements\.next\.addEventListener/);
assert.match(app, /saveCardProgress\(card\.card_id, result\.card\)/);

for (const label of ["Again", "Hard", "Good", "Easy", "Previous", "Next", "Start practice"]) {
  assert.ok(html.includes(label), `${label} control must remain in the UI`);
}
for (const asset of ["styles.css", "core.js", "app.js", "manifest.webmanifest", "data/conjugations.js", "vendor/ts-fsrs-5.4.1.umd.js", "icons/icon-192.png", "icons/icon-512.png"]) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
  assert.ok(serviceWorker.includes(`"./${asset}"`), `${asset} must be represented in the offline cache`);
}
assert.match(serviceWorker, /const CACHE_NAME = "conjuflow-v2";/);

console.log("Static app and PWA regression checks passed.");

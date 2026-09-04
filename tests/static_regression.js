"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("app.js");
const core = read("core.js");
const html = read("index.html");
const styles = read("styles.css");
const serviceWorker = read("sw.js");

const regularityMarkup = html.match(/<select id="regularitySelect">([\s\S]*?)<\/select>/)?.[1] || "";
const regularityOptions = [...regularityMarkup.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(match => [match[1], match[2]]);
assert.deepEqual(regularityOptions, [["all", "Todos"], ["regular", "Regulares"], ["irregular", "Irregulares"]]);
assert.equal(html.includes("Frequency range"), false);
assert.equal(html.includes("rankSelect"), false);
assert.equal(app.includes("rankSelect"), false);
assert.equal(app.includes("saved.rank"), false);
assert.equal(app.includes("filters.rank"), false);
assert.equal(core.includes("filters.rank"), false);
assert.equal(core.includes("rank_corpus"), true);
assert.equal(core.includes("raw.patterns"), false);
assert.equal(core.includes("card.patterns"), false);
assert.equal(core.includes("flatMap(card => card.patterns)"), false);
assert.match(core, /card\.pattern === filters\.pattern/);

assert.match(app, /const DB_NAME = "conjuflow-db";/);
assert.match(app, /const DB_VERSION = 1;/);
assert.match(app, /const PROGRESS_STORE = "cardProgress";/);
assert.equal(app.includes("mexican-spanish-flashcards-db"), false);
assert.equal(app.includes("deckProgress"), false);
assert.match(app, /const TS_FSRS_VERSION = "ts-fsrs@5\.4\.1";/);
assert.match(app, /elements\.previous\.addEventListener/);
assert.match(app, /elements\.next\.addEventListener/);
assert.match(app, /saveCardProgress\(card\.card_id, result\.card\)/);
assert.match(app, /setFiltersCollapsed\(true\);/);

for (const label of ["Again", "Hard", "Good", "Easy", "Previous", "Next", "Start practice"]) {
  assert.ok(html.includes(label), `${label} control must remain in the UI`);
}
for (const asset of ["styles.css", "core.js", "app.js", "manifest.webmanifest", "data/conjugations.js", "vendor/ts-fsrs-5.4.1.umd.js", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"]) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
  assert.ok(serviceWorker.includes(`"./${asset}"`), `${asset} must be represented in the offline cache`);
}
assert.match(app, /\["imperativo", "Imperativo"\]/);
assert.equal(app.includes("imperativo_afirmativo"), false);
assert.equal(app.includes("imperativo_negativo"), false);
assert.equal(core.includes("imperativo_afirmativo"), false);
assert.equal(core.includes("imperativo_negativo"), false);
assert.match(serviceWorker, /const CACHE_NAME = "conjuflow-v7";/);
assert.match(serviceWorker, /key\.startsWith\("conjuflow-"\) && key !== CACHE_NAME/);
assert.ok(html.includes('<img class="brand-mark" src="icons/icon.svg"'));
assert.ok(html.includes("Mexican Spanish verb practice"));
assert.ok(html.includes("[hidden] { display: none !important; }"));
assert.equal(html.includes("Choose your filters"), false);
assert.equal(html.includes("Then start a practice session."), false);
assert.match(styles, /--primary: #164e63;/);
assert.match(styles, /--teal: #0f766e;/);
assert.ok(styles.includes(".toolbar.is-collapsed h2 { display: none; }"));
assert.ok(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr));"));
assert.ok(styles.includes("height: 520px;"));
assert.ok(styles.includes("height: 470px;"));
assert.ok(styles.includes("grid-template-columns: repeat(2, 1fr);"));
assert.ok(styles.includes("overflow: auto;"));
assert.equal(styles.includes("linear-gradient"), false);
assert.equal(styles.includes("backdrop-filter"), false);

console.log("Static app and PWA regression checks passed.");

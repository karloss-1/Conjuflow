"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const nodes = new Map();
function node() {
  return { value: "all", hidden: false, textContent: "", classList: { toggle() {} }, setAttribute() {}, replaceChildren() {}, append() {}, addEventListener() {} };
}
const sandbox = {
  console, setTimeout, clearTimeout, Date,
  window: { FSRS: require("../vendor/ts-fsrs-5.4.1.umd.js") },
  document: {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
    querySelectorAll() { return []; }, createElement: node
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "data/conjugations.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "core.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/init\(\);\s*$/, ""), sandbox);
const run = code => vm.runInContext(code, sandbox);
run(`
  let selected = CONTENT.cards.slice(0, 2);
  filteredCards = () => selected;
  updateMatchPreview = () => {};
  scheduleNextDueCheck = () => {};
  saveCardProgress = async (cardId, fsrs) => { progressByCard.set(cardId, { fsrs }); };
`);
(async () => {
  run("render()");
  assert.equal(nodes.get("sessionProgress").hidden, true);
  run("startPractice()");
  assert.equal(nodes.get("progressBar").max, 2);
  assert.equal(nodes.get("progressBar").value, 0);
  run("navigate(1); reveal(); navigate(-1)");
  assert.equal(nodes.get("progressBar").value, 0, "navigation and reveal never count as reviews");
  run("reveal()");
  await run("grade(3)");
  assert.equal(nodes.get("progressBar").value, 1);
  assert.equal(nodes.get("progressBar").max, 2, "the denominator stays fixed after rating");
  run("reveal()");
  await run("grade(3)");
  assert.equal(nodes.get("progressBar").value, 2);
  assert.match(nodes.get("progress").textContent, /2 of 2 reviewed.*Round complete/);
  run("refreshDueSession(); render()");
  assert.equal(nodes.get("progressBar").value, 2, "completion remains visible while waiting");
  run("for (const record of progressByCard.values()) record.fsrs.due = new Date(0); refreshDueSession(); render()");
  assert.match(nodes.get("progress").textContent, /Review round 2 · 0 of 2 reviewed/);
  run("reveal(); saveCardProgress = async () => { throw new Error('simulated save failure'); }");
  sandbox.console = { ...console, error() {} };
  await run("grade(3)");
  assert.equal(nodes.get("progressBar").value, 0, "a failed save must not advance progress");
  run("selected = []; startPractice()");
  assert.equal(nodes.get("sessionProgress").hidden, true, "no meaningless zero-card bar");
  run("selected = CONTENT.cards.slice(0, 1); startPractice()");
  assert.match(nodes.get("progress").textContent, /^0 of 1 reviewed/);
  console.log("Session progress checks passed: navigation, rating, completion, repeat rounds, failed saves, and restart.");
})().catch(error => { console.error(error); process.exitCode = 1; });

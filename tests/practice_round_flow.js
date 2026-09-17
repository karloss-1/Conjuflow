"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const nodes = new Map();
let timerCallback = null;
function node() {
  return { value: "all", hidden: false, textContent: "", classList: { toggle() {}, contains() { return false; } }, setAttribute() {}, replaceChildren() {}, append() {}, addEventListener() {} };
}
const sandbox = {
  console,
  Date,
  setTimeout(callback) { timerCallback = callback; return 1; },
  clearTimeout() { timerCallback = null; },
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
  let selected = CONTENT.cards.slice(0, 24);
  filteredCards = () => selected;
  updateMatchPreview = () => {};
  saveCardProgress = async (cardId, fsrs) => { progressByCard.set(cardId, { fsrs }); };
  elements.roundSize.value = "10";
`);

(async () => {
  run("startPractice()");
  assert.equal(run("session.queue.length"), 10);
  const originalContext = run("JSON.stringify(session.filters)");
  for (let index = 0; index < 10; index += 1) {
    run("reveal()");
    await run("grade(3)");
  }

  assert.equal(nodes.get("emptyTitle").textContent, "Round complete");
  assert.equal(nodes.get("emptyMessage").textContent, "10 cards practiced");
  assert.equal(nodes.get("practiceMoreButton").textContent, "Practice 10 more");
  assert.equal(nodes.get("practiceMoreButton").hidden, false);
  assert.equal(typeof timerCallback, "function", "round completion must arm the next-due timer");

  run("practiceMore()");
  assert.equal(run("session.queue.length"), 10);
  assert.equal(run("JSON.stringify(session.filters)"), originalContext, "Practice More must preserve the active context");
  for (let index = 0; index < 10; index += 1) {
    run("reveal()");
    await run("grade(3)");
  }
  assert.equal(nodes.get("practiceMoreButton").textContent, "Practice 4 more");
  assert.equal(nodes.get("practiceMoreButton").hidden, false);
  assert.equal(typeof timerCallback, "function", "completing Practice More must re-arm the next-due timer");

  run("progressByCard.values().next().value.fsrs.due = new Date(0)");
  timerCallback();
  assert.equal(run("session.queue.length"), 1, "the due card must reactivate automatically");
  assert.equal(run("session.mode"), "automatic");
  assert.equal(run("JSON.stringify(session.filters)"), originalContext, "automatic review must preserve the active context");
  assert.equal(run("session.queue.includes(selected[23].card_id)"), false, "automatic review must not add an unrelated New card");
  console.log("Practice flow checks passed: dynamic continuation, persistent context, due timer reactivation, and no New-card refill.");
})().catch(error => { console.error(error); process.exitCode = 1; });

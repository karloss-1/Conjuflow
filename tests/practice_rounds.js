"use strict";

const assert = require("node:assert/strict");
const core = require("../core.js");

const card = (id, rank = id) => ({ card_id: `card-${id}`, rank_corpus: Number(rank) });
const candidate = (id, availability = "new", fsrsState = "new", dueAt = 0, rank = id) => ({
  card: card(id, rank), availability, fsrsState, dueAt
});

const seventy = Array.from({ length: 70 }, (_, index) => candidate(index + 1));
assert.equal(core.selectPracticeRound(seventy, "10").length, 10);
assert.equal(core.selectPracticeRound(seventy, "20").length, 20);
assert.equal(core.selectPracticeRound(seventy, "all").length, 70);
assert.equal(core.selectPracticeRound(seventy.slice(0, 9), "10").length, 9);

const sevenAvailable = [...seventy.slice(0, 7), candidate(8, "scheduled", "review", 100), candidate(9, "scheduled", "learning", 50)];
assert.equal(core.selectPracticeRound(sevenAvailable, "10").length, 7);
assert.deepEqual(core.selectPracticeRound(sevenAvailable, "10").map(item => item.card.card_id), [
  "card-1", "card-2", "card-3", "card-4", "card-5", "card-6", "card-7"
]);

const priority = [
  candidate(40, "new", "new", 0, 1),
  candidate(30, "due", "review", 30, 1),
  candidate(20, "due", "relearning", 20, 99),
  candidate(10, "due", "learning", 10, 100)
];
assert.deepEqual(core.selectPracticeRound(priority, "all").map(item => item.card.card_id), [
  "card-10", "card-20", "card-30", "card-40"
]);

const introduced = new Set(["card-1", "card-2"]);
assert.deepEqual(
  core.selectPracticeRound([candidate(1), candidate(2), candidate(3), candidate(4)], "10", introduced).map(item => item.card.card_id),
  ["card-3", "card-4", "card-1", "card-2"],
  "unseen New cards must precede previously introduced untouched New cards"
);

assert.equal(core.normalizeRoundLimit("bogus"), 10);
assert.equal(core.normalizeRoundLimit("all"), Infinity);
console.log("Practice round checks passed: limits, scheduled exclusion, FSRS priority, and stable New-card continuation.");

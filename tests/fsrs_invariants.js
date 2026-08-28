"use strict";

const assert = require("node:assert/strict");
const FSRS = require("../vendor/ts-fsrs-5.4.1.umd.js");

const scheduler = FSRS.fsrs();
const records = new Map();

function schedulerCard(cardId) {
  const state = records.get(cardId) || FSRS.createEmptyCard(new Date());
  return {
    ...state,
    due: new Date(state.due),
    last_review: state.last_review ? new Date(state.last_review) : undefined
  };
}

function grade(cardId, rating, when) {
  const result = scheduler.next(schedulerCard(cardId), when, rating).card;
  records.set(cardId, result);
  return result;
}

const now = new Date();
const present = grade("tener__presente_indicativo", FSRS.Rating.Good, now);
assert.equal(records.size, 1);
assert.equal(records.has("tener__preterito"), false, "grading present must not create preterite progress");

const beforeFilterChange = JSON.stringify(records.get("tener__presente_indicativo"));
const simulatedFilterResults = ["tener__presente_indicativo"];
assert.equal(records.get(simulatedFilterResults[0]), present, "another filter must resolve the same stored object");
assert.equal(JSON.stringify(records.get("tener__presente_indicativo")), beforeFilterChange);

const preterite = grade("tener__preterito", FSRS.Rating.Easy, new Date(now.getTime() + 1));
assert.equal(records.size, 2);
assert.notEqual(records.get("tener__presente_indicativo"), preterite);
assert.equal(JSON.stringify(records.get("tener__presente_indicativo")), beforeFilterChange, "grading preterite must not mutate present");

assert.ok(new Date(present.due).getTime() > now.getTime());
assert.ok(new Date(preterite.due).getTime() > now.getTime());
assert.equal([...records.values()].filter(state => new Date(state.due).getTime() <= now.getTime()).length, 0, "studied cards with future due dates must not be treated as due");

assert.notEqual("quedar__presente_indicativo", "quedarse__presente_indicativo");
console.log("FSRS identity checks passed.");

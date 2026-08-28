"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const core = require(path.join(__dirname, "..", "core.js"));

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "data", "conjugations.js"), "utf8"), context);
const content = core.normalizeContent(context.window.CONJUGATION_CONTENT);
const cards = content.cards;

const base = { regularity: "all", ending: "all", pattern: "all", pronominal: "all", rank: "all" };
const select = filters => core.filterCards(cards, { ...base, ...filters });
const expectSome = (name, filters) => assert.ok(select(filters).length > 0, `${name} should have matches`);

expectSome("Presente + Irregulares", { tense: "presente_indicativo", regularity: "irregular" });
expectSome("Presente + e→ie", { tense: "presente_indicativo", pattern: "e→ie" });
expectSome("Pretérito + Irregulares", { tense: "preterito", regularity: "irregular" });
expectSome("Pretérito + -gar", { tense: "preterito", pattern: "-gar" });
expectSome("Futuro + Irregulares", { tense: "futuro", regularity: "irregular" });
expectSome("Subjuntivo + yo-zco", { tense: "presente_subjuntivo", pattern: "yo-zco" });
expectSome("Imperativo afirmativo + Pronominales", { tense: "imperativo_afirmativo", pronominal: "sí" });
expectSome("Imperativo negativo + Pronominales", { tense: "imperativo_negativo", pronominal: "sí" });
expectSome("Solo -IR", { tense: "presente_indicativo", ending: "ir" });
assert.ok(select({ tense: "presente_indicativo", rank: "50" }).every(card => card.rank_corpus <= 50));
assert.equal(select({ tense: "futuro", ending: "ar", pattern: "yo-zco", pronominal: "sí", rank: "50" }).length, 0);

assert.equal(new Set(cards.map(card => card.card_id)).size, cards.length, "card_id values must be unique");
assert.notEqual(cards.find(card => card.card_id === "tener__preterito").card_id, cards.find(card => card.card_id === "tener__presente_indicativo").card_id);
assert.ok(cards.some(card => card.verbo === "quedarse"));
assert.ok(cards.some(card => card.verbo === "quedar"));
assert.ok(cards.filter(card => !card.applicable).every(card => !select({ tense: card.tiempo_id }).includes(card)));

for (const tense of ["imperativo_afirmativo", "imperativo_negativo"]) {
  for (const card of select({ tense, pronominal: "sí" })) {
    const rows = core.paradigmRows(card);
    assert.deepEqual(rows.map(([pronoun]) => pronoun), ["tú", "usted", "nosotros", "ustedes"]);
    assert.ok(rows.every(([, form]) => form));
  }
}

const multiPattern = cards.find(card => card.patterns.length > 1);
for (const pattern of multiPattern.patterns) assert.ok(select({ tense: multiPattern.tiempo_id, pattern }).some(card => card.card_id === multiPattern.card_id));

console.log(`Dataset checks passed: ${cards.length} cards, ${new Set(cards.map(card => card.verbo)).size} verbs.`);

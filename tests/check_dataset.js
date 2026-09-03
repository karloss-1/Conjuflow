"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const core = require(path.join(__dirname, "..", "core.js"));

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "data", "conjugations.js"), "utf8"), context);
const rawContent = context.window.CONJUGATION_CONTENT;
const content = core.normalizeContent(rawContent);
const cards = content.cards;

const base = { regularity: "all", ending: "all", pattern: "all", pronominal: "all" };
const select = filters => core.filterCards(cards, { ...base, ...filters });
const expectSome = (name, filters) => assert.ok(select(filters).length > 0, `${name} should have matches`);

expectSome("Presente + Irregulares", { tense: "presente_indicativo", regularity: "irregular" });
expectSome("Presente + e→ie", { tense: "presente_indicativo", pattern: "e→ie" });
expectSome("Pretérito + Irregulares", { tense: "preterito", regularity: "irregular" });
expectSome("Pretérito + cambio ortográfico", { tense: "preterito", pattern: "cambio ortográfico" });
expectSome("Futuro + Irregulares", { tense: "futuro", regularity: "irregular" });
expectSome("Presente + yo→-zco", { tense: "presente_indicativo", pattern: "yo→-zco" });
expectSome("Imperativo + Pronominales", { tense: "imperativo", pronominal: "sí" });
expectSome("Solo -IR", { tense: "presente_indicativo", ending: "ir" });
const orthographicCards = cards.filter(card => card.applicable && card.pattern === "cambio ortográfico");
assert.ok(orthographicCards.length > 0);
for (const card of orthographicCards) {
  assert.ok(select({ tense: card.tiempo_id, regularity: "irregular" }).includes(card), "orthographic cards must be included under Irregulares");
  assert.equal(select({ tense: card.tiempo_id, regularity: "regular" }).includes(card), false);
}

assert.equal(rawContent.source, "Conjugaciones_Final_170_verbos_1360_tarjetas_patron_exclusivo.csv");
assert.equal(cards.length, 1360);
assert.equal(new Set(cards.map(card => card.verbo)).size, 170);
assert.equal(new Set(cards.map(card => card.card_id)).size, cards.length, "card_id values must be unique");
const cardsPerVerb = new Map();
for (const card of cards) cardsPerVerb.set(card.verbo, (cardsPerVerb.get(card.verbo) || 0) + 1);
assert.ok([...cardsPerVerb.values()].every(count => count === 8), "every final verb must have eight cards");
assert.ok(rawContent.cards.every(card => typeof card.pattern === "string" && card.pattern && !card.pattern.includes(";")), "every generated card must have one exclusive pattern");
assert.equal(rawContent.cards.filter(card => card.rank_corpus === null).length, 24, "blank corpus ranks must remain null");
assert.ok(rawContent.cards.every(card => !("patterns" in card)), "multi-pattern arrays must not appear in generated cards");
assert.ok(rawContent.cards.every(card => !("patrones_tarjeta" in card)), "CSV-only pattern fields must not leak into generated cards");
assert.notEqual(cards.find(card => card.card_id === "tener__preterito").card_id, cards.find(card => card.card_id === "tener__presente_indicativo").card_id);
assert.ok(cards.some(card => card.verbo === "quedarse"));
assert.ok(cards.some(card => card.verbo === "quedar"));
assert.ok(cards.filter(card => !card.applicable).every(card => !select({ tense: card.tiempo_id }).includes(card)));

assert.equal(cards.some(card => ["imperativo_afirmativo", "imperativo_negativo"].includes(card.tiempo_id)), false);
assert.equal(cards.filter(card => card.tiempo_id === "imperativo").length, 170);
for (const card of select({ tense: "imperativo" })) {
  const rows = core.paradigmRows(card);
  assert.deepEqual(rows.map(([pronoun]) => pronoun), ["tú", "usted", "nosotros", "ustedes"]);
  assert.ok(rows.every(([, form]) => form.includes(" / ")), "imperative forms must keep affirmative and negative together");
}

const exclusiveCases = new Map([
  ["tener__presente_indicativo", "muy irregular"],
  ["venir__presente_indicativo", "muy irregular"],
  ["decir__presente_indicativo", "muy irregular"],
  ["empezar__presente_subjuntivo", "e→ie"],
  ["jugar__imperativo", "u→ue"],
  ["conocer__imperativo", "-cer→-zc-"],
  ["conducir__imperativo", "-ucir→-uzc-"]
]);
for (const [cardId, pattern] of exclusiveCases) {
  const card = cards.find(candidate => candidate.card_id === cardId);
  assert.equal(card.pattern, pattern, `${cardId} must use the CSV's exclusive pattern`);
  assert.ok(select({ tense: card.tiempo_id, pattern }).includes(card));
  for (const otherPattern of new Set(cards.filter(candidate => candidate.tiempo_id === card.tiempo_id).map(candidate => candidate.pattern))) {
    if (otherPattern !== pattern) assert.equal(select({ tense: card.tiempo_id, pattern: otherPattern }).includes(card), false);
  }
}

const leerPreterite = cards.find(card => card.card_id === "leer__preterito");
const leerImperfectSubjunctive = cards.find(card => card.card_id === "leer__imperfecto_subjuntivo");
assert.equal(leerPreterite.pattern, "i→y");
assert.equal(leerImperfectSubjunctive.pattern, "i→y");

console.log(`Dataset checks passed: ${cards.length} cards, ${new Set(cards.map(card => card.verbo)).size} verbs.`);

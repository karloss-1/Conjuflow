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
expectSome("Imperativo afirmativo + Pronominales", { tense: "imperativo_afirmativo", pronominal: "sí" });
expectSome("Imperativo negativo + Pronominales", { tense: "imperativo_negativo", pronominal: "sí" });
expectSome("Solo -IR", { tense: "presente_indicativo", ending: "ir" });
const orthographicCards = cards.filter(card => card.applicable && card.regularidad_tarjeta === "ortografico");
assert.ok(orthographicCards.length > 0);
for (const card of orthographicCards) {
  assert.ok(select({ tense: card.tiempo_id, regularity: "irregular" }).includes(card), "orthographic cards must be included under Irregulares");
  assert.equal(select({ tense: card.tiempo_id, regularity: "regular" }).includes(card), false);
}

assert.equal(rawContent.source, "Conjugaciones_Piloto_61_verbos_549_tarjetas_patterns_contextuales.csv");
assert.equal(cards.length, 549);
assert.equal(new Set(cards.map(card => card.verbo)).size, 61);
assert.equal(new Set(cards.map(card => card.card_id)).size, cards.length, "card_id values must be unique");
const cardsPerVerb = new Map();
for (const card of cards) cardsPerVerb.set(card.verbo, (cardsPerVerb.get(card.verbo) || 0) + 1);
assert.ok([...cardsPerVerb.values()].every(count => count === 9), "every pilot verb must have nine cards");
assert.ok(rawContent.cards.every(card => Array.isArray(card.patterns)), "generated patterns must always be arrays");
assert.ok(rawContent.cards.some(card => card.patterns.length === 0), "an empty CSV cell must generate []");
assert.ok(rawContent.cards.every(card => !("patrones_tarjeta" in card)), "CSV-only pattern fields must not leak into generated cards");
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

const leerPreterite = cards.find(card => card.card_id === "leer__preterito");
const leerImperfectSubjunctive = cards.find(card => card.card_id === "leer__imperfecto_subjuntivo");
assert.ok(leerPreterite.patterns.includes("i→y"));
assert.ok(leerImperfectSubjunctive.patterns.includes("i→y"));

console.log(`Dataset checks passed: ${cards.length} cards, ${new Set(cards.map(card => card.verbo)).size} verbs.`);

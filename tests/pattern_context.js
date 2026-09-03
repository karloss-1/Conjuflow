"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require(path.join(__dirname, "..", "core.js"));

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "data", "conjugations.js"), "utf8"), context);
const cards = core.normalizeContent(context.window.CONJUGATION_CONTENT).cards;
const base = { tense: "presente_indicativo", regularity: "all", ending: "all", pattern: "all", pronominal: "all" };
const filters = values => ({ ...base, ...values });
const patterns = values => core.availablePatterns(cards, filters(values));
const selected = values => core.filterCards(cards, filters(values));

const expectedPatternLabels = {
  "regular": "Regular",
  "e→ie": "e → ie",
  "o→ue": "o → ue",
  "e→i": "e → i",
  "u→ue": "u → ue",
  "o→u": "o → u",
  "yo→-go": "yo → -go",
  "yo→-zco": "yo → -zco",
  "yo irregular": "Irregular yo",
  "e→i (3.ª persona)": "e → i (3rd person)",
  "o→u (3.ª persona)": "o → u (3rd person)",
  "e→ie/e→i (-ir)": "e → ie / e → i (-ir)",
  "o→ue/o→u (-ir)": "o → ue / o → u (-ir)",
  "cambio ortográfico": "Spelling change",
  "-uir→y": "-uir → y",
  "i→y": "i → y",
  "raíz en j": "J-stem",
  "raíz irregular": "Irregular stem",
  "-cer→-zc-": "-cer → -zc-",
  "-ucir→-uzc-": "-ucir → -uzc-",
  "muy irregular": "Highly irregular",
  "no aplicable": "Not applicable"
};
for (const [value, label] of Object.entries(expectedPatternLabels)) assert.equal(core.patternLabel(value), label);

assert.notDeepEqual(patterns({ tense: "presente_indicativo" }), patterns({ tense: "futuro" }), "tense must change Pattern options");
assert.deepEqual(patterns({ tense: "futuro", regularity: "regular" }), ["regular"], "regular cards must expose their exclusive Pattern");
assert.deepEqual(patterns({ tense: "futuro", regularity: "irregular" }), ["raíz irregular"]);

const presentIrregularEr = patterns({ regularity: "irregular", ending: "er" });
const presentIrregularIr = patterns({ regularity: "irregular", ending: "ir" });
assert.equal(presentIrregularEr.includes("e→i"), false, "-ER must exclude the -IR e→i family");
assert.equal(presentIrregularIr.includes("e→i"), true, "-IR must include e→i");

const preteriteNonPronominal = patterns({ tense: "preterito", pronominal: "no" });
const preteritePronominal = patterns({ tense: "preterito", pronominal: "sí" });
assert.equal(preteriteNonPronominal.includes("i→y"), true);
assert.equal(preteritePronominal.includes("i→y"), false, "pronominal filtering must remove unavailable patterns");

assert.equal(patterns({ tense: "preterito", regularity: "irregular" }).includes("cambio ortográfico"), true, "orthographic cards must contribute Pattern options under Irregulares");
assert.deepEqual(
  core.availablePatterns(cards, { ...filters({ tense: "preterito" }), rank: "1" }),
  patterns({ tense: "preterito" }),
  "legacy Frequency values must not affect Pattern options"
);
assert.deepEqual(
  core.filterCards(cards, { ...filters({ tense: "preterito" }), rank: "1" }).map(card => card.card_id),
  selected({ tense: "preterito" }).map(card => card.card_id),
  "legacy Frequency values must not affect final card filtering"
);

assert.deepEqual(
  patterns({ regularity: "irregular", ending: "ir", pattern: "does-not-exist" }),
  patterns({ regularity: "irregular", ending: "ir", pattern: "e→i" }),
  "Pattern must not filter its own available options"
);

assert.deepEqual(patterns({ regularity: "regular" }), ["regular"]);
assert.equal(patterns({ regularity: "irregular", ending: "er" }).includes("e→i"), false, "patterns excluded by other filters must stay hidden");

const pedir = selected({ regularity: "irregular", ending: "ir", pattern: "e→i" });
assert.ok(pedir.some(card => card.card_id === "pedir__presente_indicativo"));
const leerPreterite = selected({ tense: "preterito", pattern: "i→y" });
assert.ok(leerPreterite.some(card => card.card_id === "leer__preterito"));
const leerImperfectSubjunctive = selected({ tense: "imperfecto_subjuntivo", pattern: "i→y" });
assert.ok(leerImperfectSubjunctive.some(card => card.card_id === "leer__imperfecto_subjuntivo"));

const imperativePatterns = patterns({ tense: "imperativo" });
assert.ok(imperativePatterns.length > 0, "Imperativo must expose contextual Pattern options");
assert.ok(imperativePatterns.includes("cambio ortográfico"));
assert.deepEqual(Array.from(selected({ tense: "imperativo", pattern: "u→ue" }), card => card.card_id), ["jugar__imperativo"]);
assert.equal(Array.from(selected({ tense: "imperativo", pattern: "-cer→-zc-" }), card => card.card_id).includes("conocer__imperativo"), true);
assert.deepEqual(Array.from(selected({ tense: "imperativo", pattern: "-ucir→-uzc-" }), card => card.card_id), ["conducir__imperativo"]);

assert.equal(core.resolvePatternSelection(presentIrregularIr, "e→i"), "e→i", "a still-valid Pattern must be preserved");
assert.equal(core.resolvePatternSelection(presentIrregularEr, "e→i"), "all", "an invalid Pattern must reset to all");
assert.equal(core.resolvePatternSelection(presentIrregularIr, "pretérito_fuerte"), "all", "an obsolete saved Pattern must reset safely");

const obsoletePatterns = ["pretérito_fuerte", "pretérito_irregular", "imperativo_tú_irregular", "altamente_irregular", "-car", "-gar", "-zar", "pronominal", "futuro_irregular"];
const datasetPatterns = new Set(cards.map(card => card.pattern));
assert.ok(obsoletePatterns.every(pattern => !datasetPatterns.has(pattern)));
assert.deepEqual([...datasetPatterns].sort(), Object.keys(expectedPatternLabels).sort(), "visible labels must cover exactly the categories present in the CSV");
assert.ok(cards.every(card => typeof card.pattern === "string" && card.pattern && !card.pattern.includes(";")));

console.log("Contextual Pattern checks passed.");

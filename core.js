(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ConjuFlowCore = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IMPERATIVE_IDS = new Set(["imperativo"]);
  const PATTERN_LABELS = {
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

  function patternLabel(value) {
    return PATTERN_LABELS[value] || value.replaceAll("_", " ");
  }

  function normalizeContent(content) {
    if (!content || !Array.isArray(content.cards)) throw new Error("Invalid conjugation dataset.");
    const seen = new Set();
    const cards = content.cards.map(raw => {
      if (!raw.card_id || seen.has(raw.card_id)) throw new Error(`Invalid or duplicate card_id: ${raw.card_id || "(empty)"}`);
      if (typeof raw.pattern !== "string" || !raw.pattern.trim() || raw.pattern.includes(";")) {
        throw new Error(`Invalid exclusive pattern for ${raw.card_id}`);
      }
      seen.add(raw.card_id);
      const rank = raw.rank_corpus === null || raw.rank_corpus === "" ? null : Number(raw.rank_corpus);
      if (rank !== null && !Number.isFinite(rank)) throw new Error(`Invalid rank_corpus for ${raw.card_id}`);
      return {
        ...raw,
        rank_corpus: rank,
        pattern: raw.pattern.trim(),
        applicable: raw.aplicable === true || raw.aplicable === "sí"
      };
    });
    return { ...content, cards };
  }

  function matchesBaseFilters(card, filters) {
    return card.applicable &&
      card.tiempo_id === filters.tense &&
      (filters.regularity === "all" ||
        (filters.regularity === "regular" && card.regularidad_tarjeta === "regular") ||
        (filters.regularity === "irregular" && card.regularidad_tarjeta !== "regular")) &&
      (filters.ending === "all" || card.terminacion === filters.ending) &&
      (filters.pronominal === "all" || card.pronominal === filters.pronominal);
  }

  function filterCards(cards, filters) {
    return cards.filter(card =>
      matchesBaseFilters(card, filters) &&
      (filters.pattern === "all" || card.pattern === filters.pattern)
    );
  }

  function availablePatterns(cards, filters) {
    return [...new Set(cards.filter(card => matchesBaseFilters(card, filters)).map(card => card.pattern))]
      .sort((a, b) => patternLabel(a).localeCompare(patternLabel(b), "es"));
  }

  function resolvePatternSelection(patterns, preferred) {
    return patterns.includes(preferred) ? preferred : "all";
  }

  function isImperative(card) {
    return IMPERATIVE_IDS.has(card.tiempo_id);
  }

  function paradigmRows(card) {
    const rows = isImperative(card)
      ? [["tú", card.tu], ["usted", card.el_ella_usted], ["nosotros", card.nosotros], ["ustedes", card.ellos_ellas_ustedes]]
      : [["yo", card.yo], ["tú", card.tu], ["él / ella / usted", card.el_ella_usted], ["nosotros", card.nosotros], ["ellos / ellas / ustedes", card.ellos_ellas_ustedes]];
    return rows.filter(([, value]) => String(value || "").trim());
  }

  return { normalizeContent, matchesBaseFilters, filterCards, availablePatterns, resolvePatternSelection, patternLabel, isImperative, paradigmRows };
}));

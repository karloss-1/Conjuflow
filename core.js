(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ConjuFlowCore = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IMPERATIVE_IDS = new Set(["imperativo_afirmativo", "imperativo_negativo"]);
  const PATTERN_LABELS = {
    "e→ie": "e → ie",
    "o→ue": "o → ue",
    "e→i": "e → i",
    "u→ue": "u → ue",
    "o→u": "o → u",
    "yo→-go": "yo → -go",
    "yo→-zco": "yo → -zco",
    "yo irregular": "Yo irregular",
    "e→i (3.ª persona)": "e → i (3rd person)",
    "o→u (3.ª persona)": "o → u (3rd person)",
    "e→ie/e→i (-ir)": "e → ie / e → i (-ir)",
    "o→ue/o→u (-ir)": "o → ue / o → u (-ir)",
    "cambio ortográfico": "Cambio ortográfico",
    "i→y": "i → y",
    "raíz en j": "Raíz en j",
    "raíz irregular": "Raíz irregular",
    "muy irregular": "Muy irregular"
  };

  function patternLabel(value) {
    return PATTERN_LABELS[value] || value.replaceAll("_", " ");
  }

  function normalizeContent(content) {
    if (!content || !Array.isArray(content.cards)) throw new Error("Invalid conjugation dataset.");
    const seen = new Set();
    const cards = content.cards.map(raw => {
      if (!raw.card_id || seen.has(raw.card_id)) throw new Error(`Invalid or duplicate card_id: ${raw.card_id || "(empty)"}`);
      if (!Array.isArray(raw.patterns)) throw new Error(`Invalid patterns array for ${raw.card_id}`);
      seen.add(raw.card_id);
      return {
        ...raw,
        rank_corpus: Number(raw.rank_corpus),
        patterns: raw.patterns.map(value => String(value).trim()).filter(Boolean),
        applicable: raw.aplicable === true || raw.aplicable === "sí"
      };
    });
    return { ...content, cards };
  }

  function matchesBaseFilters(card, filters) {
    const maxRank = filters.rank === "all" ? Infinity : Number(filters.rank);
    return card.applicable &&
      card.tiempo_id === filters.tense &&
      (filters.regularity === "all" || card.regularidad_tarjeta === filters.regularity) &&
      (filters.ending === "all" || card.terminacion === filters.ending) &&
      (filters.pronominal === "all" || card.pronominal === filters.pronominal) &&
      card.rank_corpus <= maxRank;
  }

  function filterCards(cards, filters) {
    return cards.filter(card =>
      matchesBaseFilters(card, filters) &&
      (filters.pattern === "all" || card.patterns.includes(filters.pattern))
    );
  }

  function availablePatterns(cards, filters) {
    return [...new Set(cards.filter(card => matchesBaseFilters(card, filters)).flatMap(card => card.patterns).filter(Boolean))]
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

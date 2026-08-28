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
    "yo-go": "yo-go",
    "yo-zco": "yo-zco",
    "yo_irregular": "primera persona irregular",
    "pretérito_fuerte": "pretérito fuerte",
    "pretérito_3a_e→i": "pretérito: cambio e → i en tercera persona",
    "pretérito_3a_o→u": "pretérito: cambio o → u en tercera persona",
    "futuro_irregular": "futuro irregular",
    "imperativo_tú_irregular": "imperativo tú irregular",
    "-car": "-car",
    "-gar": "-gar",
    "-zar": "-zar",
    "-guir": "-guir",
    "pronominal": "pronominal",
    "altamente_irregular": "altamente irregular",
    "pretérito_irregular": "pretérito irregular",
    "imperfecto_irregular": "imperfecto irregular",
    "regular": "regular"
  };

  function patternLabel(value) {
    return PATTERN_LABELS[value] || value.replaceAll("_", " ");
  }

  function normalizeContent(content) {
    if (!content || !Array.isArray(content.cards)) throw new Error("Invalid conjugation dataset.");
    const seen = new Set();
    const cards = content.cards.map(raw => {
      if (!raw.card_id || seen.has(raw.card_id)) throw new Error(`Invalid or duplicate card_id: ${raw.card_id || "(empty)"}`);
      seen.add(raw.card_id);
      return {
        ...raw,
        rank_corpus: Number(raw.rank_corpus),
        patterns: Array.isArray(raw.patterns) ? raw.patterns.filter(Boolean) : String(raw.patrones || "").split(";").filter(Boolean),
        applicable: raw.aplicable === true || raw.aplicable === "sí"
      };
    });
    return { ...content, cards };
  }

  function filterCards(cards, filters) {
    const maxRank = filters.rank === "all" ? Infinity : Number(filters.rank);
    return cards.filter(card =>
      card.applicable &&
      card.tiempo_id === filters.tense &&
      (filters.regularity === "all" || card.regularidad_tarjeta === filters.regularity) &&
      (filters.ending === "all" || card.terminacion === filters.ending) &&
      (filters.pattern === "all" || card.patterns.includes(filters.pattern)) &&
      (filters.pronominal === "all" || card.pronominal === filters.pronominal) &&
      card.rank_corpus <= maxRank
    );
  }

  function availablePatterns(cards, tense) {
    return [...new Set(cards.filter(card => card.applicable && card.tiempo_id === tense).flatMap(card => card.patterns))]
      .sort((a, b) => patternLabel(a).localeCompare(patternLabel(b), "es"));
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

  return { normalizeContent, filterCards, availablePatterns, patternLabel, isImperative, paradigmRows };
}));

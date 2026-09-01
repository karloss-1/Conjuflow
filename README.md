# ConjuFlow

Static, local-first conjugation practice app based on the original Mexican Spanish Flashcards code. It keeps `ts-fsrs@5.4.1`, IndexedDB persistence, the four FSRS ratings, keyboard navigation, and offline PWA support.

## Files

- `Conjugaciones_Piloto_61_verbos_549_tarjetas_patterns_contextuales.csv`: editable source of truth.
- `data/conjugations.js`: generated browser data; do not edit it by hand.
- `scripts/csv_to_js.py`: CSV → JavaScript converter and validation.
- `app.js`: IndexedDB, FSRS adapter, sessions, rendering, and controls.
- `core.js`: pure filtering and paradigm helpers.
- `vendor/ts-fsrs-5.4.1.umd.js`: unchanged scheduler used by the original app.

## Update the dataset

From the project directory:

```bash
python3 scripts/csv_to_js.py Conjugaciones_Piloto_61_verbos_549_tarjetas_patterns_contextuales.csv data/conjugations.js
node tests/check_dataset.js
node tests/pattern_context.js
node tests/fsrs_invariants.js
python3 tests/converter_checks.py
node tests/static_regression.js
```

For the optional browser smoke test (when Playwright is installed):

```bash
node tests/browser_smoke.js
```

Commit both the CSV and regenerated `data/conjugations.js` to GitHub. GitHub Pages can serve the directory directly; no build step, backend, or runtime package manager is required.

## Contextual Pattern filter

`Pattern` is calculated dynamically from the cards that survive the active Tense, Regularity, Ending, and Pronominal type filters. Pattern does not filter its own options. If no surviving card has a pattern, the selector is disabled; if a saved or selected pattern stops being compatible, it safely returns to `all`.

## Storage migration

The app keeps the existing database name and version 2 schema. Progress remains in `cardProgress`, keyed by `cardId`; all 540 previous IDs are preserved and only the nine `leer` cards are new. Filter choices are stored separately in `localStorage` and never affect FSRS identity.

## Navigation behavior

Previous and Next only change the visible item inside the current session snapshot. They never write progress. Only Again, Hard, Good, and Easy call FSRS and save a review.

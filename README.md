# ConjuFlow

Static, local-first conjugation practice app based on the original Mexican Spanish Flashcards code. It keeps `ts-fsrs@5.4.1`, IndexedDB persistence, the four FSRS ratings, keyboard navigation, and offline PWA support.

## Files

- `Conjugaciones_Piloto_60_verbos_540_tarjetas.csv`: editable source of truth.
- `data/conjugations.js`: generated browser data; do not edit it by hand.
- `scripts/csv_to_js.py`: CSV → JavaScript converter and validation.
- `app.js`: IndexedDB, FSRS adapter, sessions, rendering, and controls.
- `core.js`: pure filtering and paradigm helpers.
- `vendor/ts-fsrs-5.4.1.umd.js`: unchanged scheduler used by the original app.

## Update the dataset

From the project directory:

```bash
python3 scripts/csv_to_js.py Conjugaciones_Piloto_60_verbos_540_tarjetas.csv data/conjugations.js
node tests/check_dataset.js
node tests/fsrs_invariants.js
```

For the optional browser smoke test (when Playwright is installed):

```bash
node tests/browser_smoke.js
```

Commit both the CSV and regenerated `data/conjugations.js` to GitHub. GitHub Pages can serve the directory directly; no build step, backend, or runtime package manager is required.

## Storage migration

The app keeps the original database name and raises its version from 1 to 2. On first launch it removes the obsolete `deckProgress` store and creates `cardProgress`, keyed by `cardId`. Old deck progress is intentionally not imported. Filter choices are stored separately in `localStorage` and never affect FSRS identity.

## Navigation behavior

Previous and Next only change the visible item inside the current session snapshot. They never write progress. Only Again, Hard, Good, and Easy call FSRS and save a review.

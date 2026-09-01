#!/usr/bin/env python3
"""Regression checks for the contextual-pattern CSV importer."""

from __future__ import annotations

import csv
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Conjugaciones_Piloto_61_verbos_549_tarjetas_patterns_contextuales.csv"
SCRIPT = ROOT / "scripts" / "csv_to_js.py"

spec = importlib.util.spec_from_file_location("csv_to_js", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)

with SOURCE.open("r", encoding="utf-8-sig", newline="") as handle:
    rows = list(csv.DictReader(handle))

assert "patrones_tarjeta" in module.REQUIRED_COLUMNS
assert "patrones" not in module.REQUIRED_COLUMNS

with tempfile.TemporaryDirectory() as directory:
    destination = Path(directory) / "conjugations.js"
    module.convert(SOURCE, destination)
    text = destination.read_text(encoding="utf-8")
    payload = json.loads(text.removeprefix("window.CONJUGATION_CONTENT = ").removesuffix(";\n"))

assert len(payload["cards"]) == 549
assert all(isinstance(card["patterns"], list) for card in payload["cards"])
assert any(not row["patrones_tarjeta"] and card["patterns"] == [] for row, card in zip(rows, payload["cards"]))
assert all("patrones_tarjeta" not in card and "patrones" not in card for card in payload["cards"])
assert next(card for card in payload["cards"] if card["card_id"] == "tener__presente_indicativo")["patterns"] == ["e→ie", "yo→-go"]

print("CSV importer checks passed.")

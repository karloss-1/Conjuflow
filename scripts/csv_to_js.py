#!/usr/bin/env python3
"""Convert the editable ConjuFlow CSV into a browser-ready JavaScript data file."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

REQUIRED_COLUMNS = {
    "card_id", "rank_corpus", "verbo", "verbo_base", "tiempo_id", "tiempo",
    "regularidad_tarjeta", "terminacion", "pronominal", "patrones", "aplicable",
    "yo", "tu", "el_ella_usted", "nosotros", "ellos_ellas_ustedes", "nota",
}


def convert(source: Path, destination: Path) -> None:
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED_COLUMNS.difference(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"Missing required columns: {', '.join(sorted(missing))}")
        rows = list(reader)

    card_ids = [row["card_id"].strip() for row in rows]
    if not all(card_ids) or len(card_ids) != len(set(card_ids)):
        raise SystemExit("Every card_id must be present and unique.")

    cards = []
    for row in rows:
        try:
            rank = int(row["rank_corpus"])
        except ValueError as error:
            raise SystemExit(f"Invalid rank_corpus for {row['card_id']}: {row['rank_corpus']}") from error
        card = {key: row[key].strip() for key in REQUIRED_COLUMNS if key not in {"rank_corpus", "patrones"}}
        card["rank_corpus"] = rank
        card["patterns"] = [value for value in row["patrones"].split(";") if value]
        cards.append(card)

    payload = {"version": 1, "source": source.name, "cards": cards}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        "window.CONJUGATION_CONTENT = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(cards)} cards to {destination}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Master CSV file")
    parser.add_argument("destination", type=Path, help="Generated conjugations.js file")
    args = parser.parse_args()
    convert(args.source, args.destination)


if __name__ == "__main__":
    main()

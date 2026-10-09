"""Sposta il Listino dal suo progetto Supabase allo schema `listino` del progetto MyFinance.

1. Genera lo script SQL (legge soltanto dal vecchio progetto):

       python3 supabase/migrate_to_myfinance.py

   scrive supabase/migration/listino_to_myfinance.sql (dati personali: e' in .gitignore).
2. Incollalo nel SQL Editor del progetto MyFinance ed eseguilo. Crea lo schema `listino`
   (supabase/listino_schema.sql), inserisce i dati con gli stessi id, riallinea le sequenze
   e solo alla fine crea i trigger. Rieseguirlo non duplica nulla.
3. Project Settings -> API -> "Exposed schemas": aggiungi `listino`.
4. Controlla che i due progetti abbiano gli stessi dati, riga per riga:

       python3 supabase/migrate_to_myfinance.py --verify

Solo libreria standard. Le chiavi publishable sono lette da assets/config.js: quella del
vecchio progetto dalla versione di `main`, quella di MyFinance dalla versione corrente.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / "supabase" / "listino_schema.sql"
OUTPUT_FILE = ROOT / "supabase" / "migration" / "listino_to_myfinance.sql"
SOURCE_URL = "https://jbpdyxztnljbfowrnsih.supabase.co"
DATA_MARKER = "-- @@DATI@@"
# ordine delle chiavi esterne: prima chi e' referenziato
TABLES = ["retailers", "categories", "product_vocabulary", "listino_prezzi_raw"]
PAGE_SIZE = 1000


def read_config(text: str) -> dict[str, str]:
    values = dict(re.findall(r'(\w+):\s*"([^"]*)"', text))
    return {"url": values.get("supabaseUrl", "").rstrip("/"), "key": values.get("supabaseKey", "")}


def source_config(key: str | None) -> dict[str, str]:
    if not key:
        main_config = subprocess.run(
            ["git", "-C", str(ROOT), "show", "main:assets/config.js"], capture_output=True, text=True, check=True
        ).stdout
        key = read_config(main_config)["key"]
    return {"url": SOURCE_URL, "key": key, "schema": "public"}


def target_config() -> dict[str, str]:
    config = read_config((ROOT / "assets" / "config.js").read_text(encoding="utf-8"))
    if config["url"] == SOURCE_URL:
        sys.exit("assets/config.js punta ancora al vecchio progetto: aggiornalo a MyFinance prima di --verify.")
    return {**config, "schema": "listino"}


def fetch_table(config: dict[str, str], table: str) -> list[dict]:
    rows: list[dict] = []
    while True:
        request = urllib.request.Request(
            f"{config['url']}/rest/v1/{table}?select=*&order=id",
            headers={
                "apikey": config["key"],
                "Authorization": f"Bearer {config['key']}",
                "Accept-Profile": config["schema"],
                "Range": f"{len(rows)}-{len(rows) + PAGE_SIZE - 1}",
            },
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            page = json.load(response)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows


def sql_literal(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def insert_statement(table: str, rows: list[dict]) -> str:
    if not rows:
        return f"-- {table}: nessuna riga\n"
    columns = list(rows[0])
    values = ",\n".join("  (" + ", ".join(sql_literal(row[column]) for column in columns) + ")" for row in rows)
    return (
        f"-- {table}: {len(rows)} righe\n"
        f"insert into listino.{table} ({', '.join(columns)})\n"
        f"overriding system value values\n{values}\n"
        f"on conflict (id) do nothing;\n"
        f"select setval(pg_get_serial_sequence('listino.{table}', 'id'), "
        f"(select coalesce(max(id), 1) from listino.{table}));\n"
    )


def build_migration(data: dict[str, list[dict]]) -> str:
    schema = SCHEMA_FILE.read_text(encoding="utf-8")
    if schema.count(DATA_MARKER) != 1:
        sys.exit(f"{SCHEMA_FILE.name}: manca il segnaposto {DATA_MARKER}")
    before, after = schema.split(DATA_MARKER)
    counts = ", ".join(f"{table} {len(rows)}" for table, rows in data.items())
    header = (
        f"-- Migrazione Listino -> MyFinance (schema `listino`), generata il {datetime.now():%Y-%m-%d %H:%M}\n"
        f"-- Righe: {counts}\n"
        "-- Da eseguire nel SQL Editor del progetto MyFinance. Rieseguirlo non duplica nulla.\n\n"
        "begin;\n\n"
    )
    inserts = "\n".join(insert_statement(table, data[table]) for table in TABLES)
    return header + before + DATA_MARKER + "\n\n" + inserts + "\n" + after + "\ncommit;\n"


def fingerprint(rows: list[dict]) -> str:
    return hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest()[:16]


def verify() -> int:
    source, target = source_config(None), target_config()
    failed = False
    for table in TABLES:
        old_rows, new_rows = fetch_table(source, table), fetch_table(target, table)
        same = fingerprint(old_rows) == fingerprint(new_rows)
        failed |= not same
        print(f"{table:20s} vecchio {len(old_rows):4d}  MyFinance {len(new_rows):4d}  {'uguali' if same else 'DIVERSI'}")
    print("Tutto uguale: si puo' pubblicare il sito." if not failed else "Ci sono differenze: non pubblicare ancora.")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verify", action="store_true", help="Confronta i dati dei due progetti.")
    parser.add_argument("--source-key", help="Chiave del vecchio progetto (default: assets/config.js di main).")
    args = parser.parse_args()
    if args.verify:
        return verify()

    source = source_config(args.source_key)
    data = {table: fetch_table(source, table) for table in TABLES}
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(build_migration(data), encoding="utf-8")
    for table, rows in data.items():
        print(f"{table:20s} {len(rows):4d} righe")
    print(f"Scritto {OUTPUT_FILE.relative_to(ROOT)}: incollalo nel SQL Editor di MyFinance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

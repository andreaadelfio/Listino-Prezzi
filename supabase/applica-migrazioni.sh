#!/usr/bin/env bash
# Applica al database di SUPABASE_DB_URL, in ordine, i file di supabase/migrations/ non ancora
# applicati. Ogni file va in una transazione sola, insieme alla riga che lo segna come applicato
# in public.migrazioni. Uso: supabase/applica-migrazioni.sh <repository>
# Lo stesso file sta in MyBody, MyFinance e portafogli-web: se cambia, va copiato in tutti e tre.
set -euo pipefail
repo="${1:?manca il nome del repository}"
cartella="$(dirname "$0")/migrations"
: "${SUPABASE_DB_URL:?manca SUPABASE_DB_URL}"
db() { psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

db -c "set client_min_messages = warning; create table if not exists public.migrazioni (repo text, file text, applicato_il timestamptz not null default now(), primary key (repo, file))"
applicati="$(db -At -c "select file from public.migrazioni where repo = '$repo'")"

for percorso in "$cartella"/*.sql; do
  [ -e "$percorso" ] || continue
  file="$(basename "$percorso")"
  # Il nome finisce dentro l'SQL qui sotto: solo lettere, cifre, punto, trattino e trattino basso.
  [[ "$file" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "::error::Nome di file non valido: $file"; exit 1; }
  if grep -qxF "$file" <<<"$applicati"; then echo "Già applicato: $file"; continue; fi
  if grep -Eiqw 'drop|delete|update|truncate' "$percorso" && ! grep -qix -- '-- approvato da Andrea' "$percorso"; then
    echo "::error::Fermo: $file contiene comandi che cancellano o cambiano dati:"
    grep -Einw 'drop|delete|update|truncate' "$percorso"
    echo "Se va bene così, aggiungi al file la riga: -- approvato da Andrea"
    exit 1
  fi
  echo "Applico: $file"
  db --single-transaction -f "$percorso" \
    -c "insert into public.migrazioni (repo, file) values ('$repo', '$file')"
done

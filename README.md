# Listino Prezzi

Piccola web app statica per gestire un listino prezzi con persistenza su Supabase.

## Struttura

- `index.html`: shell principale dell'interfaccia.
- `assets/app.js`: logica applicativa del frontend.
- `assets/app/`: moduli di supporto (`constants`, `groups`, `store`, `utils`).
- `assets/styles.css`: stile dell'interfaccia.
- `assets/config.js`: configurazione client Supabase.
- `service-worker.js`: cache dell'app shell per uso rapido/offline.
- `supabase/schema.sql`: schema database.

## Avvio locale

Server statico rapido:

```bash
make dev
```

Oppure:

```bash
python3 -m http.server 8003 --bind 127.0.0.1
```

Poi apri `http://127.0.0.1:8003/index.html`.

## Note utili

- L'app si aspetta `window.APP_CONFIG` definito in `assets/config.js`.
- Il service worker cachea solo asset locali dell'app shell.
- Se cambi file frontend e vedi asset vecchi, conviene aggiornare la versione cache del service worker.

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

## Inserimento da foto etichetta

Il form di inserimento ora include un pulsante camera accanto al `+`.

Flusso:

1. Selezioni o scatti una foto dell'etichetta.
2. Il frontend invia l'immagine a una Supabase Edge Function.
3. La funzione usa OpenAI Vision per estrarre `prodotto`, `prezzo`, `Store` e `categoria`.
4. Il form viene precompilato, ma il salvataggio resta manuale.

### Configurazione

In `assets/config.js` e' gia' presente:

- `labelAiEndpoint`: endpoint della Edge Function
- `labelAiMaxFileSizeMb`: limite client per la dimensione immagine

### Deploy backend

Pubblica la funzione:

```bash
npx supabase functions deploy extract-price-label
```

Imposta il secret OpenAI:

```bash
npx supabase secrets set OPENAI_API_KEY=la_tua_chiave
```

Modello opzionale:

```bash
npx supabase secrets set LABEL_EXTRACTION_MODEL=gpt-5-mini
```

### Setup completo Supabase + OpenAI

Guida estesa:

1. Verifica di avere `Node.js 20+`.
2. Avvia la CLI con `npx supabase --help`.
3. Fai login con `npx supabase login`.
4. Recupera il project ref con `npx supabase projects list`.
5. Collega la cartella locale con `npx supabase link --project-ref IL_TUO_PROJECT_REF`.
6. Crea una chiave OpenAI da `https://platform.openai.com/api-keys`.
7. Salvala nei secret con `npx supabase secrets set OPENAI_API_KEY=...`.
8. Esegui il deploy con `npx supabase functions deploy extract-price-label`.

La guida dettagliata e' in [supabase/functions/README.md](/home/andrea-adelfio/Dropbox/Progetti/Python/portafogli-web/supabase/functions/README.md:1).

# Listino Prezzi Raw

App minimale pensata per:

- essere ospitata su GitHub Pages
- leggere e scrivere dati su Supabase
- rispettare la struttura del foglio `Listino Prezzi raw`
- permettere l'inserimento di nuovi retailer e nuove righe dal telefono
- funzionare senza login

## Architettura

- Frontend statico: `index.html` + `assets/`
- Backend dati: Supabase Postgres
- Nessun server Flask

## Struttura dati

Tabelle principali:

- `retailers`
- `listino_prezzi_raw`

View di supporto:

- `listino_prezzi_raw_excel`

La view ricostruisce la forma "simile a Excel" con:

- `prodotto`
- `rivenditore`
- `prod_riv`
- `categoria`
- `prezzo`

## File utili

- `index.html`: UI
- `assets/config.js`: configurazione Supabase
- `assets/app.js`: logica app
- `supabase/schema.sql`: schema DB + RLS
- `supabase/seed.sql`: seed generato dal file Excel
- `scripts/generate_seed_sql.py`: rigenera `seed.sql` dal workbook

## Cose da fare su Supabase

1. Apri SQL Editor del progetto.
2. Esegui `supabase/schema.sql`.
3. Esegui `supabase/seed.sql`.
4. Fine: l'app puo leggere e scrivere senza autenticazione.

## Avvio locale

```bash
cd /home/andrea-adelfio/Dropbox/Progetti/Python/portafogli-web
python3 -m http.server 8080
```

Poi apri:

`http://127.0.0.1:8080`

## Deploy GitHub Pages

Puoi pubblicare direttamente il contenuto della cartella su GitHub Pages.
Il frontend e statico e usa Supabase dal browser.

## Modalita pubblica

Lo schema attuale apre lettura e scrittura anche al ruolo `anon`.
Questo vuol dire che chiunque abbia l'URL del sito puo inserire, modificare ed eliminare dati nel database.

Va bene per una fase iniziale o personale, ma non e una configurazione sicura per un'app pubblica.

## Nota sulla configurazione

In `assets/config.js` ho impostato:

- `supabaseUrl`: inferito dal project ref `jbpdyxztnljbfowrnsih`
- `supabaseKey`: la publishable key che hai fornito

Se il dominio API reale fosse diverso, basta aggiornare `assets/config.js`.

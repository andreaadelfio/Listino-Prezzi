# Listino Prezzi

Piccola web app statica per gestire un listino prezzi con persistenza su Supabase.

## Struttura

- `index.html`: shell principale dell'interfaccia.
- `assets/app.js`: logica applicativa del frontend.
- `assets/app/`: moduli di supporto (`constants`, `groups`, `store`, `utils`).
- `assets/styles.css`: stile dell'interfaccia.
- `assets/config.js`: configurazione client Supabase.
- `service-worker.js`: cache dell'app shell per uso rapido/offline.
- `supabase/listino_schema.sql`: schema database (schema `listino` nel progetto Supabase di MyFinance).
- `supabase/schema.sql`: schema storico del vecchio progetto Supabase dedicato al Listino.
- `supabase/migrate_to_myfinance.py`: migrazione dal vecchio progetto a MyFinance.

## Database

Dal 2026-10 le tabelle stanno nello schema `listino` del progetto Supabase di **MyFinance**
(in vista dell'unione dei due siti); il client usa `db: { schema: "listino" }`.

Migrazione dal vecchio progetto (una volta sola):

1. `python3 supabase/migrate_to_myfinance.py`: legge i dati dal vecchio progetto (solo lettura) e
   scrive `supabase/migration/listino_to_myfinance.sql` (ignorato da git: contiene i dati).
2. Nel progetto MyFinance: SQL Editor, incolla il file ed eseguilo. Crea lo schema, inserisce i dati
   con gli stessi id, riallinea le sequenze e solo alla fine crea i trigger. Rieseguirlo non duplica nulla.
3. Project Settings -> API -> "Exposed schemas": aggiungi `listino`.
4. Pubblica la Edge Function nel progetto MyFinance con il suo secret (vedi `supabase/functions/README.md`).
5. `python3 supabase/migrate_to_myfinance.py --verify`: confronta i dati dei due progetti riga per riga.
6. Solo allora unisci questo ramo in `main` e pubblica (`make git`).

Le policy sono rimaste aperte come prima (chiunque abbia l'URL del sito legge e scrive): da chiudere
con il login.

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

Anteprima per il telefono (senza cache, si ricarica da sola quando salvi un file):

```bash
make dev_mob
```

Apre `http://127.0.0.1:8002/mobile` (il sito nella cornice del Motorola edge 50 neo, 412×915) e
stampa l'indirizzo da aprire sul telefono vero, sulla stessa rete Wi-Fi.

## Note utili

- L'app si aspetta `window.APP_CONFIG` definito in `assets/config.js`.
- Il service worker cachea solo asset locali dell'app shell.
- Se cambi file frontend e vedi asset vecchi, conviene aggiornare la versione cache del service worker.

## Inserimento da foto etichetta

Il pulsante fotocamera del form (scatto o foto gia' fatta, lo chiede Android) legge la foto di
un'etichetta di prezzo con **Gemini**:

1. Scatti o scegli la foto (il sito la rimpicciolisce a ~1,5 MB).
2. Il sito la manda alla Edge Function `extract-price-label`, insieme ai nomi di categorie e Store
   gia' nel listino (Gemini sceglie fra quelli).
3. La funzione restituisce `product`, `price` (es. `1,49€` o `12,38€/kg`), `storeName`, `categoryName`.
4. Il form viene precompilato, ma il salvataggio resta manuale.

Lo stesso pulsante legge anche gli **scontrini** (lo capisce Gemini): si apre una finestrella con i
prezzi aggiornati (vecchio → nuovo), i prodotti nuovi e le righe non usate con il motivo. Si
aggiorna solo un prodotto gia' presente in quello Store con la stessa unita' di prezzo (€ con €,
€/kg con €/kg). Ogni proposta si corregge nella sua riga (aggiornata: il prezzo; nuova: nome,
prezzo e categoria), il cestino la toglie, il + ne aggiunge una; "Salva" scrive quelle con nome e prezzo.
La regola sta in `assets/app/receipt.js` (test: `make test`).

`assets/config.js` ha l'indirizzo della funzione (`labelAiEndpoint`) e il limite della foto
(`labelAiMaxFileSizeMb`). Pubblicazione e secret: [supabase/functions/README.md](supabase/functions/README.md).

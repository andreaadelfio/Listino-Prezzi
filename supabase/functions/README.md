# Supabase Edge Functions

## `extract-price-label`

Riceve una foto (campo `image`, multipart) e, facoltativi, i nomi gia' nel listino: `categorie`,
`store` e `prodotti` (JSON). Gemini capisce da solo se e' un'etichetta o uno scontrino.

Etichetta (il sito riempie il form):

```json
{ "tipo": "etichetta", "product": "Yogurt greco Pam", "price": "5,60€/kg", "storeName": "Pam", "categoryName": "Latte e derivati" }
```

Scontrino (il sito mostra la finestrella da confermare; vedi `assets/app/receipt.js`):

```json
{ "tipo": "scontrino", "storeName": "Lidl", "righe": [
  { "testo": "MOZZ.FIOR.LATTE", "prodotto": "Mozzarella", "esistente": true, "price": "1,29€", "categoryName": "" }
] }
```

Per lo scontrino `prodotto` e' il nome esatto di un prodotto gia' nel listino quando e' lo stesso
articolo; il prezzo e' quello di un pezzo senza sconti; sconti, cauzione, totali e sacchetti non sono righe.

### Modelli e secret

- `GEMINI_API_KEY`: la chiave Gemini. E' la stessa di MyBody, che sta nello stesso progetto
  Supabase (MyFinance, `fvhzmkvqizfnbgxexdgu`): i secret valgono per tutte le funzioni del progetto,
  quindi non va impostata di nuovo.
- Modelli: prima `gemini-flash-latest` (abbina meglio le righe abbreviate degli scontrini), poi
  `gemini-3.6-flash`, `gemini-3.5-flash-lite` e `gemini-3.1-flash-lite` se il precedente ha finito
  la quota, e' sovraccarico o non risponde; in tutto al massimo 55 secondi (il sito ne aspetta 60).
  I nomi stanno in `MODELLI` nella funzione.

### Pubblicazione

```bash
npx supabase functions deploy extract-price-label --project-ref fvhzmkvqizfnbgxexdgu --no-verify-jwt
```

Il sito la chiama con la sola chiave publishable nell'header `apikey`, per questo `--no-verify-jwt`.
Ogni volta che cambia la risposta va pubblicata insieme al sito.

Serve aver fatto una volta `npx supabase login` (Node.js 20+). Test con Deno e Gemini finti: `make test`.

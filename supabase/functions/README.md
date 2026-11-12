# Supabase Edge Functions

## `extract-price-label`

Riceve la foto di un'etichetta di prezzo (campo `image`, multipart) e, facoltativi, i nomi di
categorie e Store gia' nel listino (`categorie`, `store`, in JSON). La legge con **Gemini** e
risponde:

```json
{ "product": "Yogurt greco Pam", "price": "5,60€/kg", "storeName": "Pam", "categoryName": "Latte e derivati" }
```

Il prezzo segue il formato del listino. Gemini legge prezzo della confezione (senza cauzione, es.
Statiegeld), quantita' con unita' e l'eventuale prezzo al kg/litro stampato; la funzione
(`prezzoDaListino`) ne ricava:

- `3,96€/l` o `9,96€/kg`: quello stampato, oppure calcolato da prezzo e peso/volume
  (es. 1,98 € per 500 ml);
- `4,99€/36pz` per le confezioni a pezzi;
- `1,50€` se peso e volume non ci sono.

Il nome del prodotto viene in italiano anche se l'etichetta e' in un'altra lingua.

### Modelli e secret

- `GEMINI_API_KEY`: la chiave Gemini. E' la stessa di MyBody, che sta nello stesso progetto
  Supabase (MyFinance, `fvhzmkvqizfnbgxexdgu`): i secret valgono per tutte le funzioni del progetto,
  quindi non va impostata di nuovo.
- Facoltativi, condivisi con MyBody: `GEMINI_MODEL` (primo modello, predefinito
  `gemini-3.5-flash-lite`) e `GEMINI_RISERVA` (modelli di riserva separati da virgole, predefinito
  `gemini-flash-latest`), provati se il primo ha finito la quota, e' sovraccarico o non risponde.

### Pubblicazione

```bash
npx supabase functions deploy extract-price-label --project-ref fvhzmkvqizfnbgxexdgu --no-verify-jwt
```

Il sito la chiama con la sola chiave publishable nell'header `apikey`, per questo `--no-verify-jwt`.
Va pubblicata insieme al sito: il sito vecchio si aspettava il testo grezzo dell'OCR (`notes`),
quello nuovo i campi qui sopra.

Serve aver fatto una volta `npx supabase login` (Node.js 20+).

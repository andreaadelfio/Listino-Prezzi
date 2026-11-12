# Supabase Edge Functions

## `extract-price-label`

Riceve la foto di un'etichetta di prezzo (campo `image`, multipart) e, facoltativi, i nomi di
categorie e Store gia' nel listino (`categorie`, `store`, in JSON). La legge con **Gemini** e
risponde:

```json
{ "product": "Yogurt greco Pam", "price": "5,60€/kg", "storeName": "Pam", "categoryName": "Latte e derivati" }
```

Il prezzo e' quello al kg o al litro se l'etichetta lo riporta, altrimenti quello della confezione.

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

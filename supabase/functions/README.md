# Supabase Edge Functions

## `extract-price-label`

Questa funzione riceve una foto dell'etichetta dal frontend, la invia a OpenAI tramite la `Responses API` e restituisce un JSON con:

- `product`
- `price`
- `storeName`
- `categoryName`
- `confidence`
- `notes`

## Prerequisiti

- Devi avere un progetto Supabase gia' creato.
- Devi avere accesso al dashboard del progetto.
- Ti serve una chiave OpenAI API, da salvare nei secret Supabase.

## 1. Installare Supabase CLI

Metodo consigliato per questo progetto: eseguire la CLI con `npx`.

Requisito:

- `Node.js 20` o superiore

Verifica:

```bash
node -v
```

Uso rapido senza installazione globale:

```bash
npx supabase --help
```

Se vuoi aggiungerla al progetto come dipendenza di sviluppo:

```bash
npm install --save-dev supabase
```

Poi i comandi diventano:

```bash
npx supabase login
```

Nota importante:

- La documentazione Supabase indica che `npm install -g supabase` non e' supportato.

## 2. Collegare questa cartella al tuo progetto Supabase

Fai login:

```bash
npx supabase login
```

Visualizza i progetti disponibili e copia il `project ref` corretto:

```bash
npx supabase projects list
```

Collega il repository locale al progetto remoto:

```bash
npx supabase link --project-ref jbpdyxztnljbfowrnsih
```

Se vuoi controllare che il file della function sia nel posto giusto, deve esistere questo percorso:

```text
supabase/functions/extract-price-label/index.ts
```

## 3. Ottenere una OpenAI API key

Apri la pagina ufficiale delle API key OpenAI:

- https://platform.openai.com/api-keys

Procedura:

1. Accedi con il tuo account OpenAI.
2. Apri la sezione `API keys`.
3. Crea una nuova chiave.
4. Copiala subito e conservala in un posto sicuro.

Importante:

- Non inserirla in `assets/app.js` o `assets/config.js`.
- Non committarla nel repository.
- In questo progetto va salvata solo come secret Supabase.

Se vuoi provarla localmente nel terminale, puoi anche esportarla come variabile ambiente:

```bash
export OPENAI_API_KEY="la_tua_chiave"
```

## 4. Salvare la chiave OpenAI nei secret Supabase

Una volta ottenuta la chiave, salvala nel progetto Supabase:

```bash
npx supabase secrets set OPENAI_API_KEY=la_tua_chiave
```

Puoi anche impostare il modello usato dalla function.

Default consigliato per questo flusso:

```bash
npx supabase secrets set LABEL_EXTRACTION_MODEL=gpt-5-mini
```

Se vuoi piu' accuratezza e accetti costi maggiori:

```bash
npx supabase secrets set LABEL_EXTRACTION_MODEL=gpt-5.5
```

## 5. Pubblicare la function nel progetto

Deploy della sola function foto-etichetta:

```bash
npx supabase functions deploy extract-price-label
```

Se il progetto non e' gia' linkato, puoi anche specificare il project ref direttamente:

```bash
npx supabase functions deploy extract-price-label --project-ref jbpdyxztnljbfowrnsih
```

## 6. Verificare che sia online

L'endpoint finale sara' di questo tipo:

```text
https://<project_ref>.supabase.co/functions/v1/extract-price-label
```

Nel tuo progetto frontend questo endpoint e' gia' configurato in `assets/config.js`.

## 7. Flusso completo consigliato

1. Verifica di avere `Node.js 20+`.
2. Esegui `npx supabase login`.
3. Esegui `npx supabase projects list`.
4. Esegui `npx supabase link --project-ref ...`.
5. Crea la chiave OpenAI da `https://platform.openai.com/api-keys`.
6. Salva il secret con `npx supabase secrets set OPENAI_API_KEY=...`.
7. Esegui `npx supabase functions deploy extract-price-label`.
8. Prova il pulsante camera nell'app.

## Riferimenti ufficiali

- Supabase CLI install: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase Edge Functions deploy: https://supabase.com/docs/guides/functions/deploy
- Supabase Edge Functions overview: https://supabase.com/docs/guides/functions
- OpenAI quickstart API key: https://developers.openai.com/api/docs/quickstart
- OpenAI API keys dashboard: https://platform.openai.com/api-keys
```

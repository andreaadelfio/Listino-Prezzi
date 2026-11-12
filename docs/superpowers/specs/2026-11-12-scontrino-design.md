# Prezzi da foto dello scontrino

## Perché

Andrea fotografa lo scontrino della spesa (in Italia, prodotti in italiano) e il listino si aggiorna
da solo: prezzi nuovi per i prodotti che ha già, righe nuove per quelli che non ha. Oggi ogni
prezzo va ricopiato a mano o fotografato etichetta per etichetta.

## Obiettivi

- Una foto dello scontrino propone gli aggiornamenti e le aggiunte; niente viene scritto prima che
  Andrea li abbia visti e confermati in una finestrella.
- Si aggiornano solo i prodotti con informazioni complete e sicure (vedi "Quando una riga e'
  sicura").
- Funziona sul telefono (412×915) e sul PC.

## Non obiettivi

- Storico dei prezzi (il listino ha un prezzo per prodotto e Store, come oggi).
- Creare Store nuovi dallo scontrino: lo Store deve esistere gia'.
- Correggere nomi o prezzi dentro la finestrella: si tolgono le righe sbagliate e si sistemano
  poi con il form, come oggi.
- Scontrini stranieri (non vietati, ma non curati).

## Da evitare (sarebbe un fallimento anche se "funziona")

- Sovrascrivere un prezzo al kg o al litro con il prezzo di una confezione, o viceversa.
- Scrivere qualcosa senza la conferma di Andrea.
- Un pulsante o un flusso in piu' da imparare per fare la stessa cosa.

## Approcci considerati

- **A. Gemini legge e abbina, il codice controlla** (scelto da Andrea). Una sola chiamata: Gemini
  riceve la foto e i nomi dei prodotti, degli Store e delle categorie; per ogni riga dice a quale
  prodotto esistente corrisponde (o che e' nuovo), prezzo, quantita' e unita'. Il codice decide se
  la riga e' sicura. Veloce, regge le abbreviazioni ("MOZZ.FIOR.LATTE").
- B. Gemini trascrive, il sito abbina confrontando le parole: prevedibile ma sbaglia con le
  abbreviazioni ("PASS.POM." contro "Passata di pomodoro").
- C. Due chiamate (trascrivi, poi abbina): poco meglio di A, ma lenta e costa il doppio.

## Come funziona

### Un solo pulsante fotocamera (scelta mia)

Il pulsante fotocamera che c'e' gia' vale per etichette e scontrini: Gemini capisce da solo cosa
e' la foto. Etichetta: come oggi, riempie il form. Scontrino: apre la finestrella.

### Funzione `extract-price-label` (stessa funzione, scelta mia)

- In piu' riceve `prodotti`: i nomi dei prodotti dell'owner (JSON, come `categorie` e `store`).
- Lo schema di Gemini aggiunge `tipo` ("etichetta" | "scontrino"), il nome dello Store e
  `righe`: per ogni prodotto dello scontrino `testo` (com'e' scritto), `prodotto` (il nome
  esistente esatto, o un nome nuovo breve in italiano), `esistente` (si'/no), `prezzo` (unitario:
  per "2 x 1,29" e' 1,29), `quantita`, `unita`, `prezzo_unitario` (al kg/l se stampato, es. roba
  pesata "0,532 kg x 2,49 €/kg"), `categoria`.
- Sconti, cauzione, totali, sacchetti e righe che non sono prodotti non vanno in `righe`. Il prezzo
  e' quello di listino, senza lo sconto (scelta mia: le promozioni passano, il listino resta).
- Il prezzo in formato listino lo calcola `prezzoDaListino`, come per l'etichetta.
- Risposta per lo scontrino: `{ tipo: "scontrino", storeName, righe: [{ testo, prodotto,
  esistente, price, categoryName }] }`. Per l'etichetta resta quella di oggi, con `tipo:
  "etichetta"` in piu'.

### Quando una riga e' sicura (nel sito, che ha le righe del listino)

Lo Store e' quello letto dallo scontrino, abbinato a uno Store esistente. Se non si riconosce, la
finestrella chiede di sceglierlo fra quelli esistenti (senza Store non si salva).

Per ogni riga letta:

- **Aggiornata**: il prodotto esiste gia' in quello Store, il prezzo nuovo ha la stessa unita' di
  quello vecchio (€ con €, €/kg con €/kg, €/l con €/l, €/36pz con €/36pz) ed e' diverso.
- **Nuova**: il prodotto non e' nel listino, oppure c'e' ma non in quello Store. Prezzo non vuoto.
  Categoria: quella del prodotto se esiste gia', altrimenti quella proposta da Gemini (solo fra le
  esistenti).
- **Non usata**, con il motivo: prezzo uguale, unita' diversa (es. "hai 3,96€/l, lo scontrino dice
  1,98€"), prezzo non letto.

### La finestrella

Una finestra sopra il listino (`<dialog>`, a tutta altezza sul telefono), da controllare a occhio:

```
Scontrino Lidl                              ×
Aggiornati (3)
 ☑ Mozzarella            1,19€  →  1,29€
 ☑ Banane            1,69€/kg  →  1,79€/kg
 ☑ Latte intero          1,05€  →  1,09€
Nuovi (2)
 ☑ Passata di pomodoro   0,89€   🍅 Verdura
 ☑ Biscotti al cacao     2,15€   🍪 Biscotti
Non usati (2)
   Succo ananas    hai 3,96€/l, scontrino 1,98€
   Pane            prezzo uguale
                       [ Annulla ]  [ Salva 5 ]
```

Tutte le righe aggiornate e nuove partono spuntate; Andrea toglie quelle sbagliate. "Salva"
scrive solo le spuntate (update per le aggiornate, insert per le nuove, come il form) e poi
ricarica il listino. Il vocabolario si aggiorna da solo (trigger del database).

### Casi limite (scelte mie)

- Nomi confrontati senza maiuscole e spazi in piu'. Se Gemini dice "esistente" ma il nome non c'e'
  nella lista, la riga diventa **Nuova** (Andrea la vede e la toglie se e' un doppione).
- Se in uno Store ci sono due righe dello stesso prodotto, si aggiorna la piu' recente.
- Lo stesso prodotto due volte sullo scontrino: una riga sola, con il primo prezzo.
- Tempi: uno scontrino lungo richiede piu' lettura, e se e' etichetta o scontrino lo dice Gemini
  nella stessa risposta: il sito aspetta 60 secondi e la funzione 25 a modello, per tutte e due.

## Lasciato a chi costruisce

- Struttura del codice nel sito (funzioni piccole accanto a quelle della foto etichetta) e stile
  della finestrella con le classi che ci sono gia'.
- Messaggi d'errore (scontrino illeggibile, nessuna riga utile).
- Prove: `prezzoDaListino` e la regola "riga sicura" con piccoli test; la finestrella provata nel
  preview con risposte finte di Gemini, poi con una foto vera.

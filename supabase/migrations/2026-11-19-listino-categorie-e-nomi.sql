-- Listino di Andrea, 19/11: categorie e nomi piu' chiari, Store giusti per i prodotti Conad e Pam,
-- doppioni, marca e formato. Chiesto da Andrea in chat il 19/11 ("ok categorie, e fai la colonna formato",
-- "ok aggiungi anche formato e marca", e le risposte sulle voci incerte).
-- Ogni riga cambia solo se ha ancora nome, categoria e Store di oggi, e marca o formato vuoti: la
-- migrazione si puo' rieseguire e non tocca righe cambiate nel frattempo. Le colonne formato e marca
-- le crea 2026-11-19-colonne-formato-marca.sql, che viene prima.
-- Alimentari resta senza prodotti (Patate al rosmarino vanno in Surgelati): il trigger la toglie.
-- Tabella prima/dopo: caccia-bug-2026-11-16/Listino-formato-marca-19-11.md (note dell'Orchestratore).

insert into listino.categories (owner, name, icon) values ('Andrea', 'Salute e farmacia', '💊')
  on conflict (owner, name) do nothing;
insert into listino.retailers (owner, name) values ('Andrea', 'Conad')
  on conflict (owner, name) do nothing;
update listino.listino_prezzi_raw set prodotto = 'Ali di tacchino'
  where id = 3 and owner = 'Andrea' and prodotto = 'Ali Tacchino' and category_id = 10 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 5, marca = 'Coccolino'
  where id = 4 and owner = 'Andrea' and prodotto = 'Ammorbidente Coccolino' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Lenor'
  where id = 6 and owner = 'Andrea' and prodotto = 'Ammorbidente Lenor' and category_id = 5 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Bacon vegetale'
  where id = 317 and owner = 'Andrea' and prodotto = 'Bacon veg' and category_id = 10 and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Felce Azzurra'
  where id = 10 and owner = 'Andrea' and prodotto = 'Bagnodoccia Felce Azzurra' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Vidal'
  where id = 212 and owner = 'Andrea' and prodotto = 'Bagnoschiuma Vidal al Cacao' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Bicarbonato da cucina', category_id = 4
  where id = 15 and owner = 'Andrea' and prodotto = 'Bicarbonato' and category_id = 3 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Biscotti frollini al cacao', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 16 and owner = 'Andrea' and prodotto = 'Biscotti Frollini cacao Conad' and category_id = 50 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Balocco'
  where id = 17 and owner = 'Andrea' and prodotto = 'Biscotti frollini integrali Balocco' and category_id = 50 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Biscotti Grancereale classici'
  where id = 18 and owner = 'Andrea' and prodotto = 'Biscotti grancereale classico' and category_id = 50 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Biscotti grancereali', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 19 and owner = 'Andrea' and prodotto = 'Biscotti grancereali Conad' and category_id = 50 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Biscotti Molinetti', formato = '800 g'
  where id = 20 and owner = 'Andrea' and prodotto = 'Biscotti Molinetti 800g' and category_id = 50 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set prodotto = 'Biscotti Pan di Stelle pacco piccolo'
  where id = 235 and owner = 'Andrea' and prodotto = 'Biscotti pacco piccolo pan di stelle' and category_id = 50 and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Balocco'
  where id = 21 and owner = 'Andrea' and prodotto = 'Biscotti Pastefrolle Balocco' and category_id = 50 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Brillantante Winni''s', marca = 'Winni''s'
  where id = 23 and owner = 'Andrea' and prodotto = 'Brillantante Winni''S' and category_id = 5 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 3
  where id = 28 and owner = 'Andrea' and prodotto = 'Buste biodegradabili' and category_id = 4 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Caffè in cialde', category_id = 17
  where id = 232 and owner = 'Andrea' and prodotto = 'Caffè cialde' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 17, marca = 'Lavazza'
  where id = 30 and owner = 'Andrea' and prodotto = 'Caffè Lavazza' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 17, marca = 'Segafreddo'
  where id = 214 and owner = 'Andrea' and prodotto = 'Caffè Segafreddo Intermezzo' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Caffè solubile', category_id = 17, retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 31 and owner = 'Andrea' and prodotto = 'Caffè sol. conad' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Quarto di cappone'
  where id = 32 and owner = 'Andrea' and prodotto = 'Cappone quarto' and category_id = 10 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 54
  where id = 315 and owner = 'Andrea' and prodotto = 'Caramelle gola' and category_id is null and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Petto di pollo intero'
  where id = 41 and owner = 'Andrea' and prodotto = 'Carne petto di pollo intero' and category_id = 10 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 12
  where id = 44 and owner = 'Andrea' and prodotto = 'Castagne' and category_id = 15 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Cereali Extra al cioccolato al latte Kellogg''s', marca = 'Kellogg''s'
  where id = 45 and owner = 'Andrea' and prodotto = 'Cereali extra cioc al latte Kellogs' and category_id = 16 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Cioccolato fondente alle nocciole', category_id = 54
  where id = 288 and owner = 'Andrea' and prodotto = 'Cioccolata fondente nocciole' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Colla Attak', marca = 'Attak'
  where id = 208 and owner = 'Andrea' and prodotto = 'Colla attack' and category_id = 3 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 4
  where id = 299 and owner = 'Andrea' and prodotto = 'Colorante rosso' and category_id is null and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Curalavastoviglie Winni''s', marca = 'Winni''s'
  where id = 54 and owner = 'Andrea' and prodotto = 'Curalavastoviglie Winni''S' and category_id = 5 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'AZ'
  where id = 55 and owner = 'Andrea' and prodotto = 'Dentifricio AZ' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Colgate'
  where id = 56 and owner = 'Andrea' and prodotto = 'Dentifricio Colgate' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Mentadent'
  where id = 57 and owner = 'Andrea' and prodotto = 'Dentifricio Mentadent' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Deodorante per ambienti spray', category_id = 5
  where id = 58 and owner = 'Andrea' and prodotto = 'Deodorante ambienti spray' and category_id = 2 and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Borotalco'
  where id = 297 and owner = 'Andrea' and prodotto = 'Deodorante Borotalco' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Deodorante per ambienti elettrico Glade', category_id = 5, marca = 'Glade'
  where id = 59 and owner = 'Andrea' and prodotto = 'Deodorante elettrico Glade' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Dessert mousse proteica Müller', marca = 'Müller'
  where id = 61 and owner = 'Andrea' and prodotto = 'Dessert mousse proteico Muller' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Dessert proteico Müller', marca = 'Müller'
  where id = 62 and owner = 'Andrea' and prodotto = 'Dessert proteico Muller' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Detergente pavimenti'
  where id = 242 and owner = 'Andrea' and prodotto = 'Detergente Pavimento' and category_id = 5 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Doccino WC', category_id = 5
  where id = 270 and owner = 'Andrea' and prodotto = 'Doccino wc' and category_id = 3 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 14
  where id = 319 and owner = 'Andrea' and prodotto = 'Formaggio fresco' and category_id = 4 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Pasta fusilli', category_id = 11
  where id = 72 and owner = 'Andrea' and prodotto = 'Fusilli' and category_id = 9 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Pasta fusilli Molisana', marca = 'Molisana'
  where id = 73 and owner = 'Andrea' and prodotto = 'Fusilli Molisana' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Guanciale stagionato'
  where id = 75 and owner = 'Andrea' and prodotto = 'Guanciale Stagionato' and category_id = 53 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 55
  where id = 314 and owner = 'Andrea' and prodotto = 'Gyoza surgelati' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Insalata contadina in busta', formato = '200 g'
  where id = 76 and owner = 'Andrea' and prodotto = 'Insalata contadina in busta 200g' and category_id = 9 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set marca = 'Kinder'
  where id = 260 and owner = 'Andrea' and prodotto = 'Kinder Fette al latte' and category_id = 54 and retailer_id = 22 and marca is null;
update listino.listino_prezzi_raw set marca = 'Kinder'
  where id = 259 and owner = 'Andrea' and prodotto = 'Kinder Pinguì' and category_id = 54 and retailer_id = 22 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Latte d''avena Barista', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 77 and owner = 'Andrea' and prodotto = 'Latte d''avena Barista Conad' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Latte intero', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 79 and owner = 'Andrea' and prodotto = 'Latte intero Conad' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Bevanda vegetale Alpro Plant Protein', formato = '1 l', marca = 'Alpro'
  where id = 234 and owner = 'Andrea' and prodotto = 'Latte vegetale bevanda Alpro Plant Protein 50g (1L)' and category_id = 14 and retailer_id = 6 and formato is null and marca is null;
update listino.listino_prezzi_raw set category_id = 4
  where id = 255 and owner = 'Andrea' and prodotto = 'Lievito fresco' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4
  where id = 301 and owner = 'Andrea' and prodotto = 'Lievito per dolci' and category_id = 9 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Maionese Calvè', category_id = 4, marca = 'Calvè'
  where id = 84 and owner = 'Andrea' and prodotto = 'Maionese Calve''' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 54
  where id = 96 and owner = 'Andrea' and prodotto = 'Merenda crostatina al cacao' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Miele millefiori', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 97 and owner = 'Andrea' and prodotto = 'Miele millefiori Conad' and category_id = 49 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Mozzarella A.Q.', formato = '3 x 100 g'
  where id = 98 and owner = 'Andrea' and prodotto = 'Mozzarella A.Q. 3x100g' and category_id = 14 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set prodotto = 'Mozzarella Granarolo', formato = '3 x 100 g', marca = 'Granarolo'
  where id = 99 and owner = 'Andrea' and prodotto = 'Mozzarella Granarolo 3x100g' and category_id = 14 and retailer_id = 6 and formato is null and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Mozzarella Mondo Natura', marca = 'Mondo Natura'
  where id = 100 and owner = 'Andrea' and prodotto = 'Mozzarella mondo natura' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Mozzarella Santa Lucia', marca = 'Santa Lucia'
  where id = 101 and owner = 'Andrea' and prodotto = 'Mozzarella S.Lucia' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Nesquik'
  where id = 306 and owner = 'Andrea' and prodotto = 'Nesquik Snack' and category_id = 54 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 49
  where id = 289 and owner = 'Andrea' and prodotto = 'Nocciolata' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 49
  where id = 283 and owner = 'Andrea' and prodotto = 'Nutella' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4
  where id = 103 and owner = 'Andrea' and prodotto = 'Olio di cocco' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4
  where id = 104 and owner = 'Andrea' and prodotto = 'Olio di semi di girasole' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4
  where id = 105 and owner = 'Andrea' and prodotto = 'Olio di semi di mais' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4
  where id = 273 and owner = 'Andrea' and prodotto = 'Olio evo' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4, marca = 'Coricelli'
  where id = 106 and owner = 'Andrea' and prodotto = 'Olio evo Coricelli' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 4, marca = 'Monini'
  where id = 107 and owner = 'Andrea' and prodotto = 'Olio evo Monini' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 4, marca = 'Primadonna'
  where id = 294 and owner = 'Andrea' and prodotto = 'Olio evo Primadonna' and category_id = 7 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Pane bauletto Mulino Bianco', marca = 'Mulino Bianco'
  where id = 110 and owner = 'Andrea' and prodotto = 'Pane bauletto mulino bianco' and category_id = 13 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Panna da cucina', marca = 'Aldi'
  where id = 332 and owner = 'Andrea' and prodotto = 'Panna cucina aldi' and category_id = 14 and retailer_id = 22 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Panna da cucina', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), marca = 'Conad'
  where id = 111 and owner = 'Andrea' and prodotto = 'Panna cucina Conad' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Panna da cucina', retailer_id = 27, marca = 'Pam'
  where id = 112 and owner = 'Andrea' and prodotto = 'Panna cucina Pam' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Panni spugna', category_id = 5, formato = '5 pz'
  where id = 113 and owner = 'Andrea' and prodotto = 'Panni spugna 5Pz' and category_id = 4 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set marca = 'Swiffer'
  where id = 307 and owner = 'Andrea' and prodotto = 'Panni Swiffer' and category_id = 5 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Mutti'
  where id = 296 and owner = 'Andrea' and prodotto = 'Passata Mutti' and category_id = 4 and retailer_id = 25 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Passata', marca = 'REWE Bio'
  where id = 310 and owner = 'Andrea' and prodotto = 'Passata Rewe Bio' and category_id = 4 and retailer_id = 25 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Passata rustica', formato = '690 g'
  where id = 114 and owner = 'Andrea' and prodotto = 'Passata rustica 690g' and category_id = 4 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set prodotto = 'Passata rustica Cirio', marca = 'Cirio'
  where id = 115 and owner = 'Andrea' and prodotto = 'Passata Rustica Cirio' and category_id = 4 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Pasta Barilla', formato = '500 g', marca = 'Barilla'
  where id = 116 and owner = 'Andrea' and prodotto = 'Pasta Barilla 500g' and category_id = 11 and retailer_id = 6 and formato is null and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Pasta Barilla', formato = '500 g', marca = 'Barilla'
  where id = 311 and owner = 'Andrea' and prodotto = 'Pasta Barilla 500g' and category_id = 11 and retailer_id = 25 and formato is null and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Pasta', retailer_id = (select id from listino.retailers where owner = 'Andrea' and name = 'Conad'), formato = '500 g', marca = 'Conad'
  where id = 118 and owner = 'Andrea' and prodotto = 'Pasta Conad 500g' and category_id = 11 and retailer_id = 6 and formato is null and marca is null;
update listino.listino_prezzi_raw set category_id = 4
  where id = 219 and owner = 'Andrea' and prodotto = 'Pasta concentrata di soia' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Liguori'
  where id = 119 and owner = 'Andrea' and prodotto = 'Pasta elicoidali Liguori' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'De Cecco'
  where id = 120 and owner = 'Andrea' and prodotto = 'Pasta fusilli De Cecco' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Liguori'
  where id = 121 and owner = 'Andrea' and prodotto = 'Pasta fusilli Liguori' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Voiello'
  where id = 122 and owner = 'Andrea' and prodotto = 'Pasta fusilli Voiello' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Liguori'
  where id = 123 and owner = 'Andrea' and prodotto = 'Pasta linguine Liguori' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Voiello'
  where id = 124 and owner = 'Andrea' and prodotto = 'Pasta mezze penne rigate Voiello' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'De Cecco'
  where id = 125 and owner = 'Andrea' and prodotto = 'Pasta penne rigate De Cecco' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Buitoni'
  where id = 201 and owner = 'Andrea' and prodotto = 'Pasta sfoglia Buitoni' and category_id = 4 and retailer_id = 22 and marca is null;
update listino.listino_prezzi_raw set marca = 'Barilla'
  where id = 295 and owner = 'Andrea' and prodotto = 'Pasta spaghetti Barilla' and category_id = 11 and retailer_id = 25 and marca is null;
update listino.listino_prezzi_raw set marca = 'Liguori'
  where id = 126 and owner = 'Andrea' and prodotto = 'Pasta tofe Liguori' and category_id = 11 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 55
  where id = 327 and owner = 'Andrea' and prodotto = 'Patate al rosmarino' and category_id = 7 and retailer_id = 22;
update listino.listino_prezzi_raw set category_id = 55
  where id = 323 and owner = 'Andrea' and prodotto = 'Patate surgelate' and category_id = 9 and retailer_id = 22;
update listino.listino_prezzi_raw set category_id = (select id from listino.categories where owner = 'Andrea' and name = 'Salute e farmacia')
  where id = 316 and owner = 'Andrea' and prodotto = 'Patch' and category_id is null and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Peperoni rossi'
  where id = 133 and owner = 'Andrea' and prodotto = 'Peperoni Rossi' and category_id = 9 and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Rana'
  where id = 136 and owner = 'Andrea' and prodotto = 'Pesto genovese fresco Rana' and category_id = 4 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Pesto genovese Mondo Natura', marca = 'Mondo Natura'
  where id = 137 and owner = 'Andrea' and prodotto = 'Pesto genovese mondo natura' and category_id = 4 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 55
  where id = 138 and owner = 'Andrea' and prodotto = 'Piselli finissimi' and category_id = 9 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Anche di pollo'
  where id = 139 and owner = 'Andrea' and prodotto = 'Pollo anche' and category_id = 10 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Sovracosce di pollo'
  where id = 142 and owner = 'Andrea' and prodotto = 'Pollo sovracosce' and category_id = 10 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = (select id from listino.categories where owner = 'Andrea' and name = 'Salute e farmacia')
  where id = 321 and owner = 'Andrea' and prodotto = 'Propoli spray' and category_id is null and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Salmone affumicato norvegese'
  where id = 148 and owner = 'Andrea' and prodotto = 'Salmone Affumicato Norvegese' and category_id = 8 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 12
  where id = 320 and owner = 'Andrea' and prodotto = 'Semi di zucca' and category_id = 9 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Sgrassatore bagno Biff agli agrumi', marca = 'Biff'
  where id = 241 and owner = 'Andrea' and prodotto = 'Sgrassatore biff Bad Total zitrus' and category_id = 5 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Head & Shoulders'
  where id = 152 and owner = 'Andrea' and prodotto = 'Shampoo Head & Shoulders' and category_id = 2 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Spätzle di spinaci'
  where id = 293 and owner = 'Andrea' and prodotto = 'Spatzle di spinaci' and category_id = 11 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Spugne cucina', formato = '3 pz'
  where id = 154 and owner = 'Andrea' and prodotto = 'Spugne cucina 3pz' and category_id = 5 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set category_id = 5
  where id = 271 and owner = 'Andrea' and prodotto = 'Straccio' and category_id is null and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Succo d''arancia Santal', marca = 'Santal'
  where id = 155 and owner = 'Andrea' and prodotto = 'Succo arancia Santal' and category_id = 17 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Succo di limone', category_id = 4
  where id = 156 and owner = 'Andrea' and prodotto = 'Succo di Limone' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Tabs lavastoviglie Winni''s', marca = 'Winni''s'
  where id = 157 and owner = 'Andrea' and prodotto = 'Tabs lavastoviglie Winni''S' and category_id = 5 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Tè Earl Grey Twinings', marca = 'Twinings'
  where id = 158 and owner = 'Andrea' and prodotto = 'Te'' earl grey Twinings' and category_id = 17 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Tè verde'
  where id = 159 and owner = 'Andrea' and prodotto = 'Te'' verde' and category_id = 17 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Tè verde Lipton', marca = 'Lipton'
  where id = 160 and owner = 'Andrea' and prodotto = 'Te'' verde Lipton' and category_id = 17 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Tè verde Twinings', marca = 'Twinings'
  where id = 161 and owner = 'Andrea' and prodotto = 'Te'' verde Twinings' and category_id = 17 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set category_id = 3
  where id = 298 and owner = 'Andrea' and prodotto = 'Teglia' and category_id is null and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Nostromo'
  where id = 162 and owner = 'Andrea' and prodotto = 'Tonno Nostromo' and category_id = 8 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set marca = 'Rio Mare'
  where id = 215 and owner = 'Andrea' and prodotto = 'Tonno Riomare' and category_id = 8 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Uova grandi', formato = '4 pz'
  where id = 164 and owner = 'Andrea' and prodotto = 'Uova grandi 4 pz' and category_id = 6 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set prodotto = 'Uova medie', formato = '10 pz'
  where id = 166 and owner = 'Andrea' and prodotto = 'Uova medie 10pz' and category_id = 6 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set prodotto = 'Uva Canicattì'
  where id = 168 and owner = 'Andrea' and prodotto = 'Uva canicatti' and category_id = 15 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 51
  where id = 171 and owner = 'Andrea' and prodotto = 'Vino bianco' and category_id = 17 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 51
  where id = 172 and owner = 'Andrea' and prodotto = 'Vino rosso' and category_id = 17 and retailer_id = 6;
update listino.listino_prezzi_raw set marca = 'Fage'
  where id = 173 and owner = 'Andrea' and prodotto = 'Yogurt Fage 5% grassi' and category_id = 14 and retailer_id = 6 and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Yogurt greco', formato = '170 g'
  where id = 175 and owner = 'Andrea' and prodotto = 'Yogurt greco 170g' and category_id = 14 and retailer_id = 6 and formato is null;
update listino.listino_prezzi_raw set prodotto = 'Yogurt greco', retailer_id = 27, formato = '500 g', marca = 'Pam'
  where id = 176 and owner = 'Andrea' and prodotto = 'Yogurt greco Pam 500g' and category_id = 14 and retailer_id = 6 and formato is null and marca is null;
update listino.listino_prezzi_raw set prodotto = 'Zucca lunga'
  where id = 180 and owner = 'Andrea' and prodotto = 'Zucca Lunga' and category_id = 9 and retailer_id = 6;
update listino.listino_prezzi_raw set category_id = 4
  where id = 181 and owner = 'Andrea' and prodotto = 'Zucchero' and category_id = 7 and retailer_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Zucchine nere'
  where id = 183 and owner = 'Andrea' and prodotto = 'Zucchine Nere' and category_id = 9 and retailer_id = 6;
delete from listino.listino_prezzi_raw
  where id = 27 and owner = 'Andrea' and prodotto = 'Buste biodegradabili' and prezzo = '1.19€/15pz' and retailer_id = 6;
delete from listino.listino_prezzi_raw
  where id = 51 and owner = 'Andrea' and prodotto = 'Clementine' and prezzo = '2.99€' and retailer_id = 6;

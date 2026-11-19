-- Listino di Andrea, 19/11: categorie piu' adatte e nomi piu' chiari, chiesto da Andrea ("controlla
-- che le altre righe siano associate in maniera sensata con le categorie ... e se i loro nomi sono un
-- po' insensati, aggiustali"). Solo categorie che esistono gia' per Andrea; nessuna marca o peso
-- inventati; i nomi presenti in piu' Store (che raggruppano il prodotto) non si toccano.
-- Ogni update vale solo se la riga ha ancora nome e categoria di oggi: e' rieseguibile e non tocca
-- righe cambiate nel frattempo. Nessuna categoria resta vuota (il trigger la cancellerebbe).
-- Tabella prima/dopo: caccia-bug-2026-11-16/Listino-categorie-19-11.md (note dell'Orchestratore).

update listino.listino_prezzi_raw set prodotto = 'Pasta fusilli', category_id = 11
  where id = 72 and owner = 'Andrea' and prodotto = 'Fusilli' and category_id = 9;
update listino.listino_prezzi_raw set category_id = 4
  where id = 301 and owner = 'Andrea' and prodotto = 'Lievito per dolci' and category_id = 9;
update listino.listino_prezzi_raw set category_id = 12
  where id = 320 and owner = 'Andrea' and prodotto = 'Semi di zucca' and category_id = 9;
update listino.listino_prezzi_raw set category_id = 55
  where id = 323 and owner = 'Andrea' and prodotto = 'Patate surgelate' and category_id = 9;
update listino.listino_prezzi_raw set category_id = 55
  where id = 314 and owner = 'Andrea' and prodotto = 'Gyoza surgelati' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 15
  where id = 51 and owner = 'Andrea' and prodotto = 'Clementine' and category_id = 9;
update listino.listino_prezzi_raw set category_id = 3
  where id = 28 and owner = 'Andrea' and prodotto = 'Buste biodegradabili' and category_id = 4;
update listino.listino_prezzi_raw set prodotto = 'Panni spugna 5 pz', category_id = 5
  where id = 113 and owner = 'Andrea' and prodotto = 'Panni spugna 5Pz' and category_id = 4;
update listino.listino_prezzi_raw set category_id = 14
  where id = 319 and owner = 'Andrea' and prodotto = 'Formaggio fresco' and category_id = 4;
update listino.listino_prezzi_raw set prodotto = 'Caffè in cialde', category_id = 17
  where id = 232 and owner = 'Andrea' and prodotto = 'Caffè cialde' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 17
  where id = 30 and owner = 'Andrea' and prodotto = 'Caffè Lavazza' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 17
  where id = 214 and owner = 'Andrea' and prodotto = 'Caffè Segafreddo Intermezzo' and category_id = 7;
update listino.listino_prezzi_raw set prodotto = 'Caffè solubile Conad', category_id = 17
  where id = 31 and owner = 'Andrea' and prodotto = 'Caffè sol. conad' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 103 and owner = 'Andrea' and prodotto = 'Olio di cocco' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 104 and owner = 'Andrea' and prodotto = 'Olio di semi di girasole' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 105 and owner = 'Andrea' and prodotto = 'Olio di semi di mais' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 273 and owner = 'Andrea' and prodotto = 'Olio evo' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 106 and owner = 'Andrea' and prodotto = 'Olio evo Coricelli' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 107 and owner = 'Andrea' and prodotto = 'Olio evo Monini' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 294 and owner = 'Andrea' and prodotto = 'Olio evo Primadonna' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 181 and owner = 'Andrea' and prodotto = 'Zucchero' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 255 and owner = 'Andrea' and prodotto = 'Lievito fresco' and category_id = 7;
update listino.listino_prezzi_raw set prodotto = 'Succo di limone', category_id = 4
  where id = 156 and owner = 'Andrea' and prodotto = 'Succo di Limone' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 4
  where id = 219 and owner = 'Andrea' and prodotto = 'Pasta concentrata di soia' and category_id = 7;
update listino.listino_prezzi_raw set prodotto = 'Maionese Calvè', category_id = 4
  where id = 84 and owner = 'Andrea' and prodotto = 'Maionese Calve''' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 49
  where id = 283 and owner = 'Andrea' and prodotto = 'Nutella' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 49
  where id = 289 and owner = 'Andrea' and prodotto = 'Nocciolata' and category_id = 7;
update listino.listino_prezzi_raw set prodotto = 'Cioccolato fondente alle nocciole', category_id = 54
  where id = 288 and owner = 'Andrea' and prodotto = 'Cioccolata fondente nocciole' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 54
  where id = 96 and owner = 'Andrea' and prodotto = 'Merenda crostatina al cacao' and category_id = 7;
update listino.listino_prezzi_raw set category_id = 51
  where id = 171 and owner = 'Andrea' and prodotto = 'Vino bianco' and category_id = 17;
update listino.listino_prezzi_raw set category_id = 51
  where id = 172 and owner = 'Andrea' and prodotto = 'Vino rosso' and category_id = 17;
update listino.listino_prezzi_raw set category_id = 5
  where id = 4 and owner = 'Andrea' and prodotto = 'Ammorbidente Coccolino' and category_id = 2;
update listino.listino_prezzi_raw set prodotto = 'Deodorante per ambienti spray', category_id = 5
  where id = 58 and owner = 'Andrea' and prodotto = 'Deodorante ambienti spray' and category_id = 2;
update listino.listino_prezzi_raw set prodotto = 'Deodorante per ambienti elettrico Glade', category_id = 5
  where id = 59 and owner = 'Andrea' and prodotto = 'Deodorante elettrico Glade' and category_id = 2;
update listino.listino_prezzi_raw set prodotto = 'Doccino WC', category_id = 5
  where id = 270 and owner = 'Andrea' and prodotto = 'Doccino wc' and category_id = 3;
update listino.listino_prezzi_raw set category_id = 12
  where id = 44 and owner = 'Andrea' and prodotto = 'Castagne' and category_id = 15;
update listino.listino_prezzi_raw set category_id = 54
  where id = 315 and owner = 'Andrea' and prodotto = 'Caramelle gola' and category_id is null;
update listino.listino_prezzi_raw set category_id = 4
  where id = 299 and owner = 'Andrea' and prodotto = 'Colorante rosso' and category_id is null;
update listino.listino_prezzi_raw set category_id = 5
  where id = 271 and owner = 'Andrea' and prodotto = 'Straccio' and category_id is null;
update listino.listino_prezzi_raw set category_id = 3
  where id = 298 and owner = 'Andrea' and prodotto = 'Teglia' and category_id is null;
update listino.listino_prezzi_raw set prodotto = 'Ali di tacchino'
  where id = 3 and owner = 'Andrea' and prodotto = 'Ali Tacchino' and category_id = 10;
update listino.listino_prezzi_raw set prodotto = 'Bacon vegetale'
  where id = 317 and owner = 'Andrea' and prodotto = 'Bacon veg' and category_id = 10;
update listino.listino_prezzi_raw set prodotto = 'Biscotti frollini al cacao Conad'
  where id = 16 and owner = 'Andrea' and prodotto = 'Biscotti Frollini cacao Conad' and category_id = 50;
update listino.listino_prezzi_raw set prodotto = 'Biscotti Grancereale classici'
  where id = 18 and owner = 'Andrea' and prodotto = 'Biscotti grancereale classico' and category_id = 50;
update listino.listino_prezzi_raw set prodotto = 'Biscotti Pan di Stelle pacco piccolo'
  where id = 235 and owner = 'Andrea' and prodotto = 'Biscotti pacco piccolo pan di stelle' and category_id = 50;
update listino.listino_prezzi_raw set prodotto = 'Brillantante Winni''s'
  where id = 23 and owner = 'Andrea' and prodotto = 'Brillantante Winni''S' and category_id = 5;
update listino.listino_prezzi_raw set prodotto = 'Curalavastoviglie Winni''s'
  where id = 54 and owner = 'Andrea' and prodotto = 'Curalavastoviglie Winni''S' and category_id = 5;
update listino.listino_prezzi_raw set prodotto = 'Tabs lavastoviglie Winni''s'
  where id = 157 and owner = 'Andrea' and prodotto = 'Tabs lavastoviglie Winni''S' and category_id = 5;
update listino.listino_prezzi_raw set prodotto = 'Quarto di cappone'
  where id = 32 and owner = 'Andrea' and prodotto = 'Cappone quarto' and category_id = 10;
update listino.listino_prezzi_raw set prodotto = 'Petto di pollo intero'
  where id = 41 and owner = 'Andrea' and prodotto = 'Carne petto di pollo intero' and category_id = 10;
update listino.listino_prezzi_raw set prodotto = 'Anche di pollo'
  where id = 139 and owner = 'Andrea' and prodotto = 'Pollo anche' and category_id = 10;
update listino.listino_prezzi_raw set prodotto = 'Sovracosce di pollo'
  where id = 142 and owner = 'Andrea' and prodotto = 'Pollo sovracosce' and category_id = 10;
update listino.listino_prezzi_raw set prodotto = 'Cereali Extra al cioccolato al latte Kellogg''s'
  where id = 45 and owner = 'Andrea' and prodotto = 'Cereali extra cioc al latte Kellogs' and category_id = 16;
update listino.listino_prezzi_raw set prodotto = 'Dessert mousse proteica Müller'
  where id = 61 and owner = 'Andrea' and prodotto = 'Dessert mousse proteico Muller' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Dessert proteico Müller'
  where id = 62 and owner = 'Andrea' and prodotto = 'Dessert proteico Muller' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Detergente pavimenti'
  where id = 242 and owner = 'Andrea' and prodotto = 'Detergente Pavimento' and category_id = 5;
update listino.listino_prezzi_raw set prodotto = 'Pasta fusilli Molisana'
  where id = 73 and owner = 'Andrea' and prodotto = 'Fusilli Molisana' and category_id = 11;
update listino.listino_prezzi_raw set prodotto = 'Guanciale stagionato'
  where id = 75 and owner = 'Andrea' and prodotto = 'Guanciale Stagionato' and category_id = 53;
update listino.listino_prezzi_raw set prodotto = 'Bevanda vegetale Alpro Plant Protein 1 l'
  where id = 234 and owner = 'Andrea' and prodotto = 'Latte vegetale bevanda Alpro Plant Protein 50g (1L)' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Tè Earl Grey Twinings'
  where id = 158 and owner = 'Andrea' and prodotto = 'Te'' earl grey Twinings' and category_id = 17;
update listino.listino_prezzi_raw set prodotto = 'Tè verde'
  where id = 159 and owner = 'Andrea' and prodotto = 'Te'' verde' and category_id = 17;
update listino.listino_prezzi_raw set prodotto = 'Tè verde Lipton'
  where id = 160 and owner = 'Andrea' and prodotto = 'Te'' verde Lipton' and category_id = 17;
update listino.listino_prezzi_raw set prodotto = 'Tè verde Twinings'
  where id = 161 and owner = 'Andrea' and prodotto = 'Te'' verde Twinings' and category_id = 17;
update listino.listino_prezzi_raw set prodotto = 'Mozzarella Mondo Natura'
  where id = 100 and owner = 'Andrea' and prodotto = 'Mozzarella mondo natura' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Pesto genovese Mondo Natura'
  where id = 137 and owner = 'Andrea' and prodotto = 'Pesto genovese mondo natura' and category_id = 4;
update listino.listino_prezzi_raw set prodotto = 'Mozzarella Santa Lucia'
  where id = 101 and owner = 'Andrea' and prodotto = 'Mozzarella S.Lucia' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Pane bauletto Mulino Bianco'
  where id = 110 and owner = 'Andrea' and prodotto = 'Pane bauletto mulino bianco' and category_id = 13;
update listino.listino_prezzi_raw set prodotto = 'Panna da cucina Aldi'
  where id = 332 and owner = 'Andrea' and prodotto = 'Panna cucina aldi' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Panna da cucina Conad'
  where id = 111 and owner = 'Andrea' and prodotto = 'Panna cucina Conad' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Panna da cucina Pam'
  where id = 112 and owner = 'Andrea' and prodotto = 'Panna cucina Pam' and category_id = 14;
update listino.listino_prezzi_raw set prodotto = 'Passata rustica Cirio'
  where id = 115 and owner = 'Andrea' and prodotto = 'Passata Rustica Cirio' and category_id = 4;
update listino.listino_prezzi_raw set prodotto = 'Spätzle di spinaci'
  where id = 293 and owner = 'Andrea' and prodotto = 'Spatzle di spinaci' and category_id = 11;
update listino.listino_prezzi_raw set prodotto = 'Peperoni rossi'
  where id = 133 and owner = 'Andrea' and prodotto = 'Peperoni Rossi' and category_id = 9;
update listino.listino_prezzi_raw set prodotto = 'Salmone affumicato norvegese'
  where id = 148 and owner = 'Andrea' and prodotto = 'Salmone Affumicato Norvegese' and category_id = 8;
update listino.listino_prezzi_raw set prodotto = 'Sgrassatore bagno Biff agli agrumi'
  where id = 241 and owner = 'Andrea' and prodotto = 'Sgrassatore biff Bad Total zitrus' and category_id = 5;
update listino.listino_prezzi_raw set prodotto = 'Succo d''arancia Santal'
  where id = 155 and owner = 'Andrea' and prodotto = 'Succo arancia Santal' and category_id = 17;
update listino.listino_prezzi_raw set prodotto = 'Uova medie 10 pz'
  where id = 166 and owner = 'Andrea' and prodotto = 'Uova medie 10pz' and category_id = 6;
update listino.listino_prezzi_raw set prodotto = 'Uva Canicattì'
  where id = 168 and owner = 'Andrea' and prodotto = 'Uva canicatti' and category_id = 15;
update listino.listino_prezzi_raw set prodotto = 'Zucca lunga'
  where id = 180 and owner = 'Andrea' and prodotto = 'Zucca Lunga' and category_id = 9;
update listino.listino_prezzi_raw set prodotto = 'Zucchine nere'
  where id = 183 and owner = 'Andrea' and prodotto = 'Zucchine Nere' and category_id = 9;
update listino.listino_prezzi_raw set prodotto = 'Colla Attak'
  where id = 208 and owner = 'Andrea' and prodotto = 'Colla attack' and category_id = 3;

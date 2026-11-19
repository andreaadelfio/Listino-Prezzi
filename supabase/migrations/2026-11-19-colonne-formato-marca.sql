-- Listino: colonne formato (contenuto della confezione, es. "500 g", "1 l", "10 pz") e marca, chieste
-- da Andrea il 19/11 ("ok categorie, e fai la colonna formato", "ok aggiungi anche formato e marca").
-- Solo colonne nuove e vuote: nessun dato cambia. Viene prima di 2026-11-19-listino-categorie-e-nomi.sql,
-- che le riempie dai nomi; il sito le legge, quindi questa deve arrivare insieme al sito.
alter table listino.listino_prezzi_raw
  add column if not exists formato text,
  add column if not exists marca text;

-- Categoria "Surgelati" di Andrea (id 55), creata dal telefono scrivendo "❄️ Surgelati".
-- "❄️" sono due caratteri (❄ + U+FE0F): il sito metteva nell'icona solo il primo e lasciava U+FE0F,
-- invisibile, davanti al nome ("️ Surgelati"), che cosi' finiva in cima a ogni elenco.
-- Il codice e' corretto (extractEmojiAndName in assets/app/utils.js); qui si sistema solo quella riga.
-- Rieseguibile: se il nome e' gia' giusto non cambia niente.
update listino.categories
set name = 'Surgelati', icon = '❄️'
where id = 55
  and owner = 'Andrea'
  and name = E'️ Surgelati';

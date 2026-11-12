// Legge la foto di un'etichetta di prezzo con Gemini e restituisce i campi del form:
// {product, price, storeName, categoryName}. Il sito li mette nel form, il salvataggio resta manuale.
//
// Richiesta: POST multipart con "image" (la foto) e, facoltativi, "categorie" e "store" (JSON con i
// nomi gia' presenti nel listino, cosi' Gemini sceglie fra quelli invece di inventarne di nuovi).
//
// Secret: GEMINI_API_KEY (lo stesso di MyBody, che sta nello stesso progetto Supabase); facoltativi
// GEMINI_MODEL e GEMINI_RISERVA, come in MyBody.

declare const Deno: { serve: (h: (r: Request) => Promise<Response>) => void; env: { get: (k: string) => string | undefined } };

// Come MyBody: prima Flash-Lite (veloce), poi il Flash piu' recente se il primo non risponde
const MODELLO_PREDEFINITO = "gemini-3.5-flash-lite";
const RISERVA_PREDEFINITA = "gemini-flash-latest";
// Il sito aspetta 30 secondi in tutto: 12 a modello
const TEMPO_GEMINI = 12 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SCHEMA_RISPOSTA = {
  type: "object",
  properties: {
    prodotto: { type: "string", description: "nome breve del prodotto come lo scriverebbe una persona in una lista della spesa, con la marca solo se conta (es. 'Yogurt greco Pam'); vuoto se non si legge" },
    prezzo: { type: "string", description: "prezzo nel formato '1,49€' o '12,38€/kg' (unita': kg, l, pz...). Se l'etichetta ha il prezzo al kg o al litro usa quello, altrimenti il prezzo della confezione. Vuoto se non si legge" },
    store: { type: "string", description: "il negozio, se si capisce dall'etichetta; preferisci uno dei nomi dati. Vuoto se non si capisce" },
    categoria: { type: "string", description: "una delle categorie date, quella piu' adatta al prodotto; vuoto se nessuna va bene" }
  },
  required: ["prodotto", "prezzo", "store", "categoria"]
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

function base64(byte: Uint8Array) {
  let testo = "";
  for (let i = 0; i < byte.length; i += 0x8000) testo += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(testo);
}

function nomi(valore: FormDataEntryValue | null) {
  try {
    const lista = JSON.parse(String(valore || "[]"));
    return Array.isArray(lista) ? lista.map(String).filter(Boolean).slice(0, 200) : [];
  } catch {
    return [];
  }
}

// Il primo modello che risponde; quota finita, modello ritirato, sovraccarico o lentezza: il prossimo
async function chiediAGemini(richiesta: string) {
  const modelli = [Deno.env.get("GEMINI_MODEL") || MODELLO_PREDEFINITO,
    ...(Deno.env.get("GEMINI_RISERVA") || RISERVA_PREDEFINITA).split(",").map((m) => m.trim()).filter(Boolean)];
  const errori: string[] = [];
  for (const modello of modelli) {
    let gemini: Response;
    try {
      gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": Deno.env.get("GEMINI_API_KEY") || "", "Content-Type": "application/json" },
        body: richiesta,
        signal: AbortSignal.timeout(TEMPO_GEMINI)
      });
    } catch (errore) {
      errori.push(`${modello}: ${(errore as Error).name === "TimeoutError" ? "nessuna risposta in tempo" : "rete"}`);
      continue;
    }
    const risposta = await gemini.json().catch(() => ({}));
    if (gemini.ok) return risposta;
    errori.push(`${modello}: ${gemini.status} ${gemini.status === 429 ? "quota finita" : (risposta?.error?.message || "").slice(0, 200)}`);
    if (![404, 429, 500, 503, 504].includes(gemini.status)) break;
  }
  throw new Error(`Gemini non disponibile (${errori.join("; ")})`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo non supportato." }, 405);
  }
  if (!Deno.env.get("GEMINI_API_KEY")) {
    return jsonResponse({ error: "Configurazione mancante: GEMINI_API_KEY non trovata nei secret Supabase." }, 500);
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return jsonResponse({ error: "Immagine mancante." }, 400);
    }
    if (!String(image.type || "").startsWith("image/")) {
      return jsonResponse({ error: "Formato immagine non supportato." }, 400);
    }

    const categorie = nomi(formData.get("categorie"));
    const store = nomi(formData.get("store"));
    const istruzioni = [
      "E' la foto di un'etichetta di prezzo (scaffale o prodotto) in un supermercato. Leggi i dati per un listino prezzi personale.",
      categorie.length ? `Categorie possibili: ${categorie.join(", ")}.` : "",
      store.length ? `Negozi gia' nel listino: ${store.join(", ")}.` : ""
    ].filter(Boolean).join("\n");

    const risposta = await chiediAGemini(JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: image.type, data: base64(new Uint8Array(await image.arrayBuffer())) } },
        { text: istruzioni }
      ] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA_RISPOSTA, temperature: 0 }
    }));
    const letto = JSON.parse(risposta.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

    return jsonResponse({
      product: String(letto.prodotto || "").trim(),
      price: String(letto.prezzo || "").replace(/\s+/g, "").trim(),
      storeName: String(letto.store || "").trim(),
      categoryName: String(letto.categoria || "").trim()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore inatteso durante l'analisi.";
    return jsonResponse({ error: message }, 502);
  }
});

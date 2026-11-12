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
    prodotto: { type: "string", description: "nome breve del prodotto in italiano (traduci se l'etichetta e' in un'altra lingua) come lo scriverebbe una persona in una lista della spesa, con la marca solo se conta (es. 'Yogurt greco Pam', 'Succo ananas e mango'); vuoto se non si legge" },
    prezzo: { type: "number", description: "il prezzo grande della confezione in euro, senza cauzione o vuoto a rendere (Statiegeld, Pfand); 0 se non si legge" },
    quantita: { type: "number", description: "peso, volume o numero di pezzi della confezione come scritto sull'etichetta (es. 500 per '500ml'); 0 se non c'e'" },
    unita: { type: "string", enum: ["g", "kg", "ml", "cl", "l", "pz", "nessuna"], description: "l'unita' della quantita ('nessuna' se non c'e')" },
    prezzo_unitario: { type: "number", description: "il prezzo al kg o al litro se e' stampato sull'etichetta (es. 3.96 per '1 L = 3.96'); 0 se non c'e'" },
    store: { type: "string", description: "il negozio, se si capisce dall'etichetta; preferisci uno dei nomi dati. Vuoto se non si capisce" },
    categoria: { type: "string", description: "una delle categorie date, quella piu' adatta al prodotto; vuoto se nessuna va bene" }
  },
  required: ["prodotto", "prezzo", "quantita", "unita", "prezzo_unitario", "store", "categoria"]
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

// Il prezzo come nel listino: al kg o al litro se si conosce peso o volume (quello stampato, se
// c'e', altrimenti calcolato), "4,99€/36pz" per le confezioni a pezzi, altrimenti quello della confezione
const IN_KG_O_L: Record<string, [number, string]> = { g: [1000, "kg"], kg: [1, "kg"], ml: [1000, "l"], cl: [100, "l"], l: [1, "l"] };
const euro = (valore: number) => valore.toFixed(2).replace(".", ",");

export function prezzoDaListino(prezzo: number, quantita: number, unita: string, prezzoUnitario: number) {
  const misura = IN_KG_O_L[unita];
  if (misura && prezzoUnitario > 0) return `${euro(prezzoUnitario)}€/${misura[1]}`;
  if (misura && prezzo > 0 && quantita > 0) return `${euro(prezzo * misura[0] / quantita)}€/${misura[1]}`;
  if (prezzo > 0 && unita === "pz" && quantita > 1) return `${euro(prezzo)}€/${quantita}pz`;
  return prezzo > 0 ? `${euro(prezzo)}€` : "";
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
      price: prezzoDaListino(Number(letto.prezzo) || 0, Number(letto.quantita) || 0, String(letto.unita || ""), Number(letto.prezzo_unitario) || 0),
      storeName: String(letto.store || "").trim(),
      categoryName: String(letto.categoria || "").trim()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore inatteso durante l'analisi.";
    return jsonResponse({ error: message }, 502);
  }
});

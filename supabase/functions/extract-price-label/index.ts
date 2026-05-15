const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type LabelExtractionResult = {
  product: string;
  price: string;
  storeName: string;
  categoryName: string;
  confidence: number;
  notes: string;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers || {})
    }
  });
}

function normalizeStringArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 200);
  } catch {
    return [];
  }
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildExtractionPrompt(owner: string, stores: string[], categories: string[]) {
  const storesContext = stores.length
    ? `Store gia' presenti per questo owner: ${stores.join(", ")}.`
    : "Nessuno Store storico disponibile.";
  const categoriesContext = categories.length
    ? `Categorie gia' presenti per questo owner: ${categories.join(", ")}.`
    : "Nessuna categoria storica disponibile.";

  return [
    `Owner corrente: ${owner || "non specificato"}.`,
    storesContext,
    categoriesContext,
    "Leggi la foto di un'etichetta prezzo o cartellino scaffale di supermercato.",
    "Estrai solo i dati realmente visibili o altamente probabili.",
    "Se un campo non e' leggibile, restituisci stringa vuota.",
    "Per price usa il formato piu' utile per il listino, ad esempio 1,89 EUR/kg, 2,49 EUR/L, 0,99 EUR.",
    "Per storeName e categoryName preferisci i valori gia' presenti nello storico se coincidono chiaramente con la foto.",
    "Non inventare quantita', promozioni o dettagli non leggibili."
  ].join("\n");
}

function sanitizeExtractionResult(value: unknown): LabelExtractionResult {
  const objectValue = (value && typeof value === "object") ? value as Record<string, unknown> : {};
  const confidenceValue = Number(objectValue.confidence);

  return {
    product: String(objectValue.product || "").trim(),
    price: String(objectValue.price || "").trim(),
    storeName: String(objectValue.storeName || "").trim(),
    categoryName: String(objectValue.categoryName || "").trim(),
    confidence: Number.isFinite(confidenceValue)
      ? Math.min(Math.max(confidenceValue, 0), 1)
      : 0,
    notes: String(objectValue.notes || "").trim()
  };
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];

    for (const contentItem of content) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text.trim();
      }
    }
  }

  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo non supportato." }, { status: 405 });
  }

  // Usiamo OCR_SPACE_API_KEY per l'elaborazione OCR; non richiediamo piu' OPENAI_API_KEY.

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const owner = String(formData.get("owner") || "").trim();
    const stores = normalizeStringArray(formData.get("stores_json"));
    const categories = normalizeStringArray(formData.get("categories_json"));

    if (!(image instanceof File)) {
      return jsonResponse({ error: "Immagine mancante." }, { status: 400 });
    }

    if (!String(image.type || "").startsWith("image/")) {
      return jsonResponse({ error: "Formato immagine non supportato." }, { status: 400 });
    }

    const imageBytes = new Uint8Array(await image.arrayBuffer());
    // Preferiamo usare un servizio OCR esterno (ocr.space) per evitare l'uso di OpenAI.
    const ocrApiKey = Deno.env.get("OCR_SPACE_API_KEY");
    if (!ocrApiKey) {
      return jsonResponse({ error: "OCR_SPACE_API_KEY non configurata nei secret Supabase." }, { status: 500 });
    }

    // Inviamo l'immagine come multipart/form-data a OCR.space
    const form = new FormData();
    form.append("apikey", ocrApiKey);
    form.append("language", "ita");
    form.append("isOverlayRequired", "false");
    form.append("file", new Blob([imageBytes], { type: image.type }), "image.jpg");

    console.log("[extract-price-label] Invio richiesta OCR.space", { size: imageBytes.length });

    const ocrController = new AbortController();
    const ocrTimeoutMs = 25000; // timeout per OCR.space (25s)
    const ocrTimeout = setTimeout(() => ocrController.abort(), ocrTimeoutMs);

    let ocrResponse: Response;
    try {
      ocrResponse = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: form,
        signal: ocrController.signal
      });
    } catch (err) {
      clearTimeout(ocrTimeout);
      console.log("[extract-price-label] Errore fetch OCR.space", { err: String(err) });
      if (err && (err as Error).name === 'AbortError') {
        return jsonResponse({ error: "Timeout richiesta OCR (25s)." }, { status: 504 });
      }
      return jsonResponse({ error: "Errore nella richiesta OCR." }, { status: 502 });
    }

    clearTimeout(ocrTimeout);

    let ocrPayload: any = null;
    try {
      ocrPayload = await ocrResponse.json();
    } catch (parseErr) {
      console.log("[extract-price-label] Impossibile parseare risposta OCR", { parseErr: String(parseErr) });
      ocrPayload = null;
    }

    if (!ocrResponse.ok || !ocrPayload) {
      console.log("[extract-price-label] OCR.space risponde con errore", { status: ocrResponse.status, payload: ocrPayload });
      return jsonResponse({ error: "Errore OCR esterno." }, { status: 502 });
    }

    const parsedText = Array.isArray(ocrPayload?.ParsedResults) && ocrPayload.ParsedResults[0]
      ? String(ocrPayload.ParsedResults[0].ParsedText || "").trim()
      : "";

    // Estrapolazioni euristiche dal testo OCR: prezzo, prodotto, store
    let product = "";
    let price = "";
    let storeName = "";

    if (parsedText) {
      const lines = parsedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length) {
        // probabile store nel top del documento
        storeName = lines[0];

        // cerchiamo la prima occorrenza di un prezzo (es. 1,99 o 10.50)
        const priceRegex = /\b(\d{1,3}(?:[.,]\d{2}))(?:\s?€|\s?EUR)?\b/;
        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(priceRegex);
          if (match) {
            price = match[1].replace(',', '.');
            // proviamo a prendere la descrizione prodotto dalla stessa riga o dalla riga precedente
            const candidateLine = lines[i].replace(match[0], '').trim();
            if (candidateLine) {
              product = candidateLine;
            } else if (i > 0) {
              product = lines[i - 1];
            }
            break;
          }
        }

        // fallback: se nessun prezzo trovato, proviamo a cercare numeri con 2 decimali
        if (!price) {
          const fallbackRegex = /\b(\d+[.,]\d{2})\b/;
          for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(fallbackRegex);
            if (m) {
              price = m[1].replace(',', '.');
              product = lines[i].replace(m[0], '').trim() || (i > 0 ? lines[i - 1] : "");
              break;
            }
          }
        }
      }
    }

    const parsedResult = sanitizeExtractionResult({
      product: product || "",
      price: price || "",
      storeName: storeName || "",
      categoryName: "",
      confidence: 0,
      notes: parsedText || ""
    });

    return jsonResponse(parsedResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore inatteso durante l'analisi.";
    return jsonResponse({ error: message }, { status: 500 });
  }
});

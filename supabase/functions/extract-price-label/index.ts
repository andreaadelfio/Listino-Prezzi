const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type LabelExtractionResult = {
  product: string;
  price: string;
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
    categoryName: String(objectValue.categoryName || "").trim(),
    confidence: Number.isFinite(confidenceValue)
      ? Math.min(Math.max(confidenceValue, 0), 1)
      : 0,
    notes: String(objectValue.notes || "").trim()
  };
}

function normalizePriceValue(value: string) {
  if (!value) return "";
  
  // Rimuovi valuta e simboli
  let cleaned = value.replace(/€|EUR/gi, "").trim();
  
  // Gestione separatore: se c'è uno spazio tra cifre, o una virgola, converti in punto
  // Es: "1 49" -> "1.49", "1,49" -> "1.49"
  cleaned = cleaned.replace(/(\d+)[\s.,]+(\d+)/, "$1.$2");
  
  // Se dopo la pulizia abbiamo qualcosa che sembra un numero (es "1.49" o "1")
  const numericMatch = cleaned.match(/\d+(?:\.\d+)?/);
  if (numericMatch) {
    const num = parseFloat(numericMatch[0]);
    if (!isNaN(num)) {
      return num.toFixed(2);
    }
  }
  return cleaned;
}

function cleanProductText(line: string, priceMatch: string) {
  return line
    .replace(priceMatch, "")
    .replace(/€|EUR/gi, "")
    .replace(/\b(kg|g|ml|l|lt|ltr|pz|pezzi|x|\*)\b/gi, "")
    .replace(/[\s\-–_]{2,}/g, " ")
    .replace(/[^\p{L}\p{N} ,.'\/]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

function isNoiseLine(line: string) {
  if (!line || line.length < 2) {
    return true;
  }

  const normalized = line.toLowerCase();
  
  // Se la riga ha troppi simboli rispetto alle lettere/numeri, è quasi certamente errore OCR
  const alphanumeric = line.replace(/[^\p{L}\p{N}]/gu, "");
  if (line.length > 4 && (alphanumeric.length / line.length) < 0.4) {
    return true;
  }

  // Righe con troppi slash o caratteri ripetuti (tipico rumore da codici a barre o riflessi)
  if (/(.)\1{3,}/.test(line) || (line.match(/\//g) || []).length > 3) {
    return true;
  }

  return Boolean(
    normalized.match(/^\d{1,2}[\/:]\d{1,2}(?:[\/:]\d{2,4})?$/)
    || normalized.match(/^totale\b/)
    || normalized.match(/^iva\b/)
    || normalized.match(/^sconto\b/)
    || normalized.match(/^quantita\b/)
    || normalized.match(/^prezzo\b/)
    || normalized.match(/^euro\b/)
    || normalized.match(/^tel\b/) 
    || normalized.match(/^codice\b/)
    || normalized.match(/^data\b/)
    || normalized.match(/^scadenza\b/)
  );
}

function extractLabelData(parsedText: string) {
  const lines = parsedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Regex migliorata: cerca un numero, un separatore (punto, virgola o spazio) e 2 decimali
  const priceRegex = /\d{1,3}[.,\s]\s?\d{2}/;
  let product = "";
  let price = "";
  let bestPriceIndex = -1;

  if (lines.length) {
    // 1. Cerca il prezzo più probabile
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isNoiseLine(line)) continue;

      const match = line.match(priceRegex);
      if (match) {
        price = normalizePriceValue(match[0]);
        bestPriceIndex = i;
        
        // Prova a estrarre il prodotto dalla stessa riga
        const cleaned = cleanProductText(line, match[0]);
        if (cleaned.length > 3) {
          product = cleaned;
          break; // Abbiamo tutto
        }
      }
    }

    // 2. Se abbiamo il prezzo ma non il prodotto, guarda le righe vicine
    if (price && !product && bestPriceIndex !== -1) {
      // Di solito il nome del prodotto è SOPRA il prezzo
      const prev = lines[bestPriceIndex - 1];
      if (prev && !isNoiseLine(prev) && prev.length > 2) {
        product = prev;
      } else {
        // Altrimenti prova SOTTO
        const next = lines[bestPriceIndex + 1];
        if (next && !isNoiseLine(next) && next.length > 2) {
          product = next;
        }
      }
    }

    // 3. Fallback estremo: se non abbiamo nulla, prendi la riga più lunga non "rumore"
    if (!product && !price) {
      const validLines = lines
        .filter(l => !isNoiseLine(l) && l.length > 2)
        .sort((a, b) => b.length - a.length);
      
      if (validLines.length > 0) {
        // Accetta come prodotto solo se contiene almeno 3 lettere consecutive (evita codici/simboli)
        if (/[a-zA-Z\u00C0-\u017F]{3,}/.test(validLines[0])) {
          product = validLines[0];
        }
      }
    }
  }

  return {
    product: product.trim(),
    price: price.trim(),
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
      return jsonResponse({ error: "Configurazione mancante: OCR_SPACE_API_KEY non trovata nei secret Supabase." }, { status: 500 });
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

    if (!ocrResponse.ok || !ocrPayload || ocrPayload.IsErroredOnProcessing === true) {
      const errorMsg = ocrPayload?.ErrorMessage?.[0] || "Errore durante l'elaborazione dell'immagine (OCR).";
      console.error("[extract-price-label] OCR.space Error:", { status: ocrResponse.status, payload: ocrPayload });
      return jsonResponse({ error: errorMsg }, { status: 502 });
    }

    const parsedText = Array.isArray(ocrPayload?.ParsedResults) && ocrPayload.ParsedResults[0]
      ? String(ocrPayload.ParsedResults[0].ParsedText || "").trim()
      : "";

    console.log("[extract-price-label] OCR Output:", parsedText);

    const { product, price } = extractLabelData(parsedText);

    const parsedResult = sanitizeExtractionResult({
      product: product || "",
      price: price || "",
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

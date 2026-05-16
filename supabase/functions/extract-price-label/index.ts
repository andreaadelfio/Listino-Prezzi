const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type LabelExtractionResult = {
  // Ora restituisce solo il testo grezzo letto dall'OCR
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

function sanitizeExtractionResult(value: unknown): LabelExtractionResult {
  const objectValue = (value && typeof value === "object") ? value as Record<string, unknown> : {};
  // La Edge Function restituisce solo le note (il testo grezzo)
  return {
    notes: String(objectValue.notes || "").trim()
  };
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
    form.append("scale", "true");
    form.append("OCREngine", "2");

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
    console.log('[extract-price-label] ocrPayload:', ocrPayload);
    if (!ocrResponse.ok || !ocrPayload || ocrPayload.IsErroredOnProcessing === true) {
      const errorMsg = ocrPayload?.ErrorMessage?.[0] || "Errore durante l'elaborazione dell'immagine (OCR).";
      console.error("[extract-price-label] OCR.space Error:", { status: ocrResponse.status, payload: ocrPayload });
      return jsonResponse({ error: errorMsg }, { status: 502 });
    }

    const parsedText = Array.isArray(ocrPayload?.ParsedResults) && ocrPayload.ParsedResults[0]
      ? String(ocrPayload.ParsedResults[0].ParsedText || "").trim()
      : "";

    console.log("[extract-price-label] OCR Output:", parsedText);

    const parsedResult = sanitizeExtractionResult({
      notes: parsedText || ""
    });

    return jsonResponse(parsedResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore inatteso durante l'analisi.";
    return jsonResponse({ error: message }, { status: 500 });
  }
});

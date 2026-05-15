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

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return jsonResponse({ error: "OPENAI_API_KEY non configurata nei secret Supabase." }, { status: 500 });
  }

  const model = Deno.env.get("LABEL_EXTRACTION_MODEL") || "gpt-5-mini";

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
    const imageDataUrl = `data:${image.type};base64,${encodeBase64(imageBytes)}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Sei un estrattore affidabile di etichette prezzo per un listino supermercato. Rispondi solo con JSON compatibile con lo schema richiesto."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildExtractionPrompt(owner, stores, categories)
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "high"
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            strict: true,
            name: "price_label_extraction",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                product: { type: "string" },
                price: { type: "string" },
                storeName: { type: "string" },
                categoryName: { type: "string" },
                confidence: { type: "number" },
                notes: { type: "string" }
              },
              required: ["product", "price", "storeName", "categoryName", "confidence", "notes"]
            }
          }
        }
      })
    });

    const openAiPayload = await openAiResponse.json();
    if (!openAiResponse.ok) {
      let apiError = "OpenAI error";
      if (openAiPayload && typeof openAiPayload === "object") {
        const errorValue = (openAiPayload as Record<string, unknown>).error;
        if (errorValue && typeof errorValue === "object" && "message" in errorValue) {
          apiError = String((errorValue as Record<string, unknown>).message || apiError);
        }
      }
      return jsonResponse({ error: apiError }, { status: 502 });
    }

    const outputText = extractOutputText(openAiPayload as Record<string, unknown>);
    if (!outputText) {
      return jsonResponse({ error: "Risposta AI vuota." }, { status: 502 });
    }

    const parsedResult = sanitizeExtractionResult(JSON.parse(outputText));
    return jsonResponse(parsedResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore inatteso durante l'analisi.";
    return jsonResponse({ error: message }, { status: 500 });
  }
});

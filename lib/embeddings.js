const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

async function embedText(apiKey, text, { taskType = "RETRIEVAL_DOCUMENT", title = "" } = {}) {
  const body = {
    model: `models/${EMBEDDING_MODEL}`,
    content: {
      parts: [{ text: String(text).slice(0, 8000) }],
    },
    taskType,
    outputDimensionality: OUTPUT_DIMENSIONALITY,
  };

  if (title && taskType === "RETRIEVAL_DOCUMENT") {
    body.title = title;
  }

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      }
    );
  } catch {
    throw new Error("Gemini Embedding API 연결에 실패했습니다.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || "임베딩 생성에 실패했습니다.";
    throw new Error(message);
  }

  const values = data?.embedding?.values;
  if (!Array.isArray(values) || !values.length) {
    throw new Error("임베딩 응답이 비어 있습니다.");
  }

  return values;
}

async function embedBatch(apiKey, items, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const embedding = await embedText(apiKey, item.text, {
      taskType: item.taskType || "RETRIEVAL_DOCUMENT",
      title: item.title || "",
    });
    results.push(embedding);
    if (onProgress) onProgress(i + 1, items.length);
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return results;
}

module.exports = {
  EMBEDDING_MODEL,
  OUTPUT_DIMENSIONALITY,
  embedText,
  embedBatch,
};

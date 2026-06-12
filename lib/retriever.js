const fs = require("fs");
const path = require("path");
const { embedText } = require("./embeddings");
const { keywordScore, enrichResult } = require("./query-utils");

const INDEX_PATH = path.join(__dirname, "..", "data", "index.json");

let cachedIndex = null;

function loadIndex() {
  if (cachedIndex) return cachedIndex;

  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error("문서 인덱스가 없습니다. npm run index-docs 를 먼저 실행하세요.");
  }

  const raw = fs.readFileSync(INDEX_PATH, "utf8");
  cachedIndex = JSON.parse(raw);
  return cachedIndex;
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rankChunks(chunks, queryEmbedding, query, topK = 8) {
  const scored = chunks.map((chunk) => {
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    const kwScore = keywordScore(query, chunk.content);
    const score = vectorScore * 0.7 + kwScore * 0.3;

    return enrichResult({
      docId: chunk.docId,
      fileName: chunk.fileName,
      title: chunk.title,
      page: chunk.page,
      section: chunk.section,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: Number(score.toFixed(4)),
      vectorScore: Number(vectorScore.toFixed(4)),
    }, query);
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((item) => item.score > 0.08);
}

function rankChunksKeywordOnly(chunks, query, topK = 8) {
  const scored = chunks.map((chunk) =>
    enrichResult({
      docId: chunk.docId,
      fileName: chunk.fileName,
      title: chunk.title,
      page: chunk.page,
      section: chunk.section,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: Number(keywordScore(query, chunk.content).toFixed(4)),
      vectorScore: 0,
    }, query)
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((item) => item.score >= 0.25);
}

function hasEmbeddings(chunks) {
  return chunks.some((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length);
}

async function retrieve(apiKey, query, { topK = 8 } = {}) {
  const index = loadIndex();
  const chunks = index.chunks || [];

  if (!hasEmbeddings(chunks)) {
    return {
      query,
      totalChunks: chunks.length,
      mode: "keyword",
      results: rankChunksKeywordOnly(chunks, query, topK),
    };
  }

  const queryEmbedding = await embedText(apiKey, query, {
    taskType: "RETRIEVAL_QUERY",
  });

  const results = rankChunks(chunks, queryEmbedding, query, topK);

  return {
    query,
    totalChunks: chunks.length,
    mode: "hybrid",
    results,
  };
}

function clearIndexCache() {
  cachedIndex = null;
}

module.exports = {
  INDEX_PATH,
  loadIndex,
  cosineSimilarity,
  rankChunks,
  rankChunksKeywordOnly,
  hasEmbeddings,
  retrieve,
  clearIndexCache,
};

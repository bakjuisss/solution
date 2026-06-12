const fs = require("fs");
const path = require("path");
const { embedText } = require("./embeddings");
const { keywordScore, enrichResult } = require("./query-utils");

const INDEX_PATH = path.join(__dirname, "..", "data", "index.json");
const NB114_INDEX_PATH = path.join(__dirname, "..", "data", "nb114-index.json");

let cachedIndex = null;
let cachedNb114Index = null;

function loadIndexFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadIndex() {
  if (cachedIndex) return cachedIndex;

  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error("문서 인덱스가 없습니다. npm run index-docs 를 먼저 실행하세요.");
  }

  cachedIndex = loadIndexFile(INDEX_PATH);
  return cachedIndex;
}

function loadNb114Index() {
  if (cachedNb114Index !== null) return cachedNb114Index;
  cachedNb114Index = loadIndexFile(NB114_INDEX_PATH);
  return cachedNb114Index;
}

function getAllChunks() {
  const manual = loadIndex().chunks || [];
  const nb114Index = loadNb114Index();
  const nb114 = nb114Index?.chunks || [];

  return [
    ...manual.map((chunk) => ({ ...chunk, sourceType: chunk.sourceType || "manual" })),
    ...nb114.map((chunk) => ({ ...chunk, sourceType: "nb114" })),
  ];
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

function chunkSearchText(chunk) {
  return [chunk.title, chunk.fileName, chunk.content, chunk.solution, chunk.customer]
    .filter(Boolean)
    .join("\n");
}

function toResult(chunk, query, score, vectorScore = 0) {
  return enrichResult({
    docId: chunk.docId,
    fileName: chunk.fileName,
    title: chunk.title,
    page: chunk.page,
    section: chunk.section,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    sourceType: chunk.sourceType || "manual",
    inquiryId: chunk.inquiryId || null,
    solution: chunk.solution || null,
    customer: chunk.customer || null,
    inquiryDate: chunk.inquiryDate || null,
    score: Number(score.toFixed(4)),
    vectorScore: Number(vectorScore.toFixed(4)),
  }, query);
}

function rankChunks(chunks, queryEmbedding, query, topK = 8) {
  const scored = chunks.map((chunk) => {
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    const kwScore = keywordScore(query, chunkSearchText(chunk));
    const score = vectorScore * 0.7 + kwScore * 0.3;
    return toResult(chunk, query, score, vectorScore);
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((item) => item.score > 0.08);
}

function rankChunksKeywordOnly(chunks, query, topK = 8) {
  const scored = chunks.map((chunk) =>
    toResult(chunk, query, keywordScore(query, chunkSearchText(chunk)), 0)
  );

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((item) => item.score >= 0.15);
}

function hasEmbeddings(chunks) {
  return chunks.some((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length);
}

async function retrieve(apiKey, query, { topK = 8 } = {}) {
  const chunks = getAllChunks();

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
  cachedNb114Index = null;
}

module.exports = {
  INDEX_PATH,
  NB114_INDEX_PATH,
  loadIndex,
  loadNb114Index,
  getAllChunks,
  cosineSimilarity,
  rankChunks,
  rankChunksKeywordOnly,
  hasEmbeddings,
  retrieve,
  clearIndexCache,
};

const { retrieve } = require("../lib/retriever");
const { setCorsHeaders, handlePreflight } = require("../lib/gemini");

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  setCorsHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다.", code: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다.", code: "CONFIG_ERROR" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "잘못된 JSON 요청입니다.", code: "INVALID_JSON" });
    }
  }

  const query = String(body?.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "검색어를 입력해 주세요.", code: "MISSING_QUERY" });
  }

  if (query.length > 200) {
    return res.status(400).json({ error: "검색어는 200자 이하로 입력해 주세요.", code: "QUERY_TOO_LONG" });
  }

  try {
    const topK = Math.min(Math.max(Number(body?.topK) || 10, 5), 20);
    const { results, totalChunks } = await retrieve(apiKey, query, { topK });

    return res.status(200).json({
      query,
      totalChunks,
      results: results.map((item) => ({
        fileName: item.fileName,
        title: item.title,
        page: item.page,
        section: item.section,
        excerpt: item.excerpt,
        content: item.content,
        score: item.score,
        vectorScore: item.vectorScore,
        keywordScore: item.keywordScore,
      })),
    });
  } catch (err) {
    const message = err.message || "검색 처리 중 오류가 발생했습니다.";
    const isIndexError = /인덱스/.test(message);
    return res.status(isIndexError ? 503 : 500).json({
      error: message,
      code: isIndexError ? "INDEX_NOT_FOUND" : "INTERNAL_ERROR",
    });
  }
};

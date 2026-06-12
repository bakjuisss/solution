const { retrieve } = require("../lib/retriever");
const { generateAnswer, setCorsHeaders, handlePreflight } = require("../lib/gemini");

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

  const question = String(body?.question || "").trim();
  if (!question) {
    return res.status(400).json({ error: "질문을 입력해 주세요.", code: "MISSING_QUESTION" });
  }

  if (question.length > 500) {
    return res.status(400).json({ error: "질문은 500자 이하로 입력해 주세요.", code: "QUESTION_TOO_LONG" });
  }

  try {
    const topK = Math.min(Math.max(Number(body?.topK) || 6, 3), 10);
    const { results } = await retrieve(apiKey, question, { topK });

    if (!results.length) {
      return res.status(200).json({
        answer: "제공된 문서에서 해당 정보를 찾을 수 없습니다.",
        sources: [],
        query: question,
      });
    }

    const answerResult = await generateAnswer(apiKey, question, results);
    if (!answerResult.ok) {
      const { status, body: errBody } = answerResult.error;
      return res.status(status).json(errBody);
    }

    const sources = results.map((item) => ({
      fileName: item.fileName,
      title: item.title,
      page: item.page,
      section: item.section,
      excerpt: item.excerpt,
      score: item.score,
    }));

    return res.status(200).json({
      answer: answerResult.answer,
      sources,
      query: question,
    });
  } catch (err) {
    const message = err.message || "질문 처리 중 오류가 발생했습니다.";
    const isIndexError = /인덱스/.test(message);
    return res.status(isIndexError ? 503 : 500).json({
      error: message,
      code: isIndexError ? "INDEX_NOT_FOUND" : "INTERNAL_ERROR",
    });
  }
};

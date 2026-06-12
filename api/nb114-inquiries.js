const fs = require("fs");
const path = require("path");
const { setCorsHeaders, handlePreflight } = require("../lib/gemini");
const { keywordScore } = require("../lib/query-utils");
const { loadNb114Index } = require("../lib/retriever");

const INQUIRIES_PATH = path.join(__dirname, "..", "data", "nb114", "inquiries.json");
const SAMPLE_PATH = path.join(__dirname, "..", "data", "nb114", "sample-inquiries.json");

function loadInquiries() {
  const sourcePath = fs.existsSync(INQUIRIES_PATH) ? INQUIRIES_PATH : SAMPLE_PATH;
  if (!fs.existsSync(sourcePath)) return [];

  const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  return raw.inquiries || [];
}

function searchInquiries(inquiries, query, { solution = "", limit = 20 } = {}) {
  const solutionFilter = String(solution || "").trim().toLowerCase();
  const queryText = String(query || "").trim();

  const scored = inquiries
    .filter((item) => {
      if (!solutionFilter) return true;
      return String(item.solution || "").toLowerCase().includes(solutionFilter);
    })
    .map((item) => {
      const text = [
        item.title,
        item.question,
        item.response,
        item.solution,
        item.customer,
        item.category,
        (item.tags || []).join(" "),
      ].join("\n");

      const score = queryText ? keywordScore(queryText, text) : 1;
      return { ...item, score: Number(score.toFixed(4)) };
    })
    .filter((item) => !queryText || item.score >= 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  setCorsHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다.", code: "METHOD_NOT_ALLOWED" });
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
  const solution = String(body?.solution || "").trim();
  const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 50);
  const id = String(body?.id || "").trim();

  try {
    const inquiries = loadInquiries();
    const nb114Index = loadNb114Index();

    if (id) {
      const found = inquiries.find((item) => item.id === id);
      if (!found) {
        return res.status(404).json({ error: "해당 문의를 찾을 수 없습니다.", code: "NOT_FOUND" });
      }
      return res.status(200).json({ inquiry: found });
    }

    const results = searchInquiries(inquiries, query, { solution, limit });

    return res.status(200).json({
      query,
      solution: solution || null,
      total: inquiries.length,
      indexedChunks: nb114Index?.chunkCount || 0,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "문의 이력 조회 중 오류가 발생했습니다.",
      code: "INTERNAL_ERROR",
    });
  }
};

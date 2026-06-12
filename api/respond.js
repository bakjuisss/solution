const { retrieve } = require("../lib/retriever");
const { generateStructuredResponse, setCorsHeaders, handlePreflight } = require("../lib/gemini");
const { filterResultsForContext, toSourcePayload } = require("../lib/query-utils");

function buildSearchQuery(mode, body) {
  const solution = String(body.solution || "").trim();
  const environment = String(body.environment || "").trim();

  if (mode === "incident") {
    const symptom = String(body.symptom || "").trim();
    const impact = String(body.impact || "").trim();
    return [solution, symptom, environment, impact, "장애 트러블슈팅 문제해결 조치"].filter(Boolean).join(" ");
  }

  const content = String(body.content || "").trim();
  const request = String(body.request || "").trim();
  return [solution, content, environment, request, "민원 응대 고객 안내"].filter(Boolean).join(" ");
}

function normalizeInput(mode, body) {
  if (mode === "incident") {
    return {
      solution: String(body.solution || "").trim(),
      symptom: String(body.symptom || "").trim(),
      environment: String(body.environment || "").trim(),
      impact: String(body.impact || "").trim(),
    };
  }

  return {
    solution: String(body.solution || "").trim(),
    content: String(body.content || "").trim(),
    environment: String(body.environment || "").trim(),
    request: String(body.request || "").trim(),
  };
}

function validateInput(mode, input) {
  if (mode === "incident") {
    if (!input.symptom) return "증상을 입력해 주세요.";
    if (input.symptom.length > 500) return "증상은 500자 이하로 입력해 주세요.";
    return null;
  }

  if (!input.content) return "민원 내용을 입력해 주세요.";
  if (input.content.length > 500) return "민원 내용은 500자 이하로 입력해 주세요.";
  return null;
}

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

  const mode = String(body?.mode || "").trim();
  if (mode !== "incident" && mode !== "complaint") {
    return res.status(400).json({
      error: "mode는 incident 또는 complaint 이어야 합니다.",
      code: "INVALID_MODE",
    });
  }

  const input = normalizeInput(mode, body);
  const validationError = validateInput(mode, input);
  if (validationError) {
    return res.status(400).json({ error: validationError, code: "VALIDATION_ERROR" });
  }

  try {
    const searchQuery = buildSearchQuery(mode, body);
    const topK = Math.min(Math.max(Number(body?.topK) || 8, 4), 12);
    const { results, mode: searchMode } = await retrieve(apiKey, searchQuery, { topK });
    const contextResults = filterResultsForContext(results, searchQuery, { maxCount: 5 });

    if (!contextResults.length) {
      return res.status(200).json({
        mode,
        input,
        response: {
          summary: "제공된 문서에서 관련 정보를 찾을 수 없습니다.",
          docNotFound: true,
          ...(mode === "incident"
            ? {
                severity: "medium",
                possibleCauses: [],
                checklist: [],
                actions: [],
                escalation: "문서 근거 없음 — 담당자 확인 필요",
                customerNote: "현재 문서 기준으로 안내 가능한 조치가 없습니다. 담당 엔지니어 확인이 필요합니다.",
              }
            : {
                understanding: "문서에서 해당 민원 유형을 확인하지 못했습니다.",
                responseScript: "접수해 주셔서 감사합니다. 관련 메뉴얼 확인 후 담당 부서에서 회신드리겠습니다.",
                internalActions: ["관련 메뉴얼·Runbook 추가 확인", "담당자 에스컬레이션"],
                escalation: "문서 근거 없음 — 상급자/담당 부서 이관",
                followUp: "확인 후 고객에게 회신 일정 안내",
              }),
        },
        sources: [],
        searchMode,
      });
    }

    const answerResult = await generateStructuredResponse(apiKey, mode, input, contextResults);
    if (!answerResult.ok) {
      const { status, body: errBody } = answerResult.error;
      return res.status(status).json(errBody);
    }

    const sources = contextResults.slice(0, 3).map(toSourcePayload);

    return res.status(200).json({
      mode,
      input,
      response: answerResult.response,
      sources,
      searchMode,
    });
  } catch (err) {
    const message = err.message || "대응안 생성 중 오류가 발생했습니다.";
    const isIndexError = /인덱스/.test(message);
    return res.status(isIndexError ? 503 : 500).json({
      error: message,
      code: isIndexError ? "INDEX_NOT_FOUND" : "INTERNAL_ERROR",
    });
  }
};

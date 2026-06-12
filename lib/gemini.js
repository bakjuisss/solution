const MODEL = "gemini-2.5-flash-lite";

function parseGeminiError(status, geminiData) {
  const message = geminiData?.error?.message || "Gemini API 호출에 실패했습니다.";
  const isRateLimit =
    status === 429 ||
    /quota exceeded|rate limit|resource_exhausted/i.test(message);

  if (isRateLimit) {
    const match = message.match(/retry in ([\d.]+)s/i);
    const retryAfterSeconds = match ? Math.ceil(parseFloat(match[1])) : 60;

    return {
      status: 429,
      body: {
        error: `AI 사용 한도에 도달했습니다. 약 ${retryAfterSeconds}초 후에 다시 시도해 주세요.`,
        code: "RATE_LIMIT",
        retryAfterSeconds,
      },
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 502,
    body: { error: message, code: "API_ERROR" },
  };
}

async function parseResponseJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function buildContextBlock(chunks) {
  if (!chunks.length) return "(관련 문서 없음)";

  return chunks
    .map((chunk, i) => {
      const meta = [
        `[출처 ${i + 1}]`,
        `파일: ${chunk.fileName}`,
        chunk.page ? `페이지: ${chunk.page}` : null,
        chunk.section ? `섹션: ${chunk.section}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return `${meta}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

async function generateAnswer(apiKey, question, chunks) {
  const context = buildContextBlock(chunks);

  const systemInstruction = `당신은 플랜티넷 보안 솔루션 메뉴얼 전문 어시스턴트입니다.
제공된 문서 컨텍스트만을 근거로 답변하세요.
문서에 없는 내용은 추측하지 말고 "제공된 문서에서 해당 정보를 찾을 수 없습니다"라고 답하세요.
답변은 한국어로 작성하고, 가능하면 파일명과 페이지를 언급하세요.`;

  const prompt = `다음은 솔루션 메뉴얼에서 검색된 관련 구간입니다.

${context}

---

사용자 질문: ${question}

위 문서만 근거로 명확하고 실용적인 답변을 작성하세요.`;

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );
  } catch {
    return {
      ok: false,
      error: {
        status: 502,
        body: {
          error: "Gemini API 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          code: "NETWORK_ERROR",
        },
      },
    };
  }

  const geminiData = await parseResponseJson(geminiRes);

  if (!geminiRes.ok) {
    const message =
      geminiData?.error?.message ||
      (geminiData._raw ? String(geminiData._raw).slice(0, 200) : "Gemini API 호출에 실패했습니다.");
    return { ok: false, error: parseGeminiError(geminiRes.status, { error: { message } }) };
  }

  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return {
      ok: false,
      error: {
        status: 502,
        body: { error: "AI 응답이 비어 있습니다.", code: "EMPTY_RESPONSE" },
      },
    };
  }

  return { ok: true, answer: text.trim() };
}

function parseGeminiJson(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI 응답을 파싱할 수 없습니다.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

const INCIDENT_SCHEMA = `{
  "summary": "증상 한 줄 요약",
  "severity": "low|medium|high|critical",
  "possibleCauses": ["가능 원인 1", "가능 원인 2"],
  "checklist": ["확인 항목 1", "확인 항목 2"],
  "actions": ["조치 방법 1", "조치 방법 2"],
  "escalation": "2차/3차 에스컬레이션 조건 (문서 근거)",
  "customerNote": "고객에게 안내할 요약 문구",
  "docNotFound": false
}`;

const COMPLAINT_SCHEMA = `{
  "summary": "민원 한 줄 요약",
  "understanding": "고객 상황·요구 이해",
  "responseScript": "고객에게 전달할 응대 멘트 (정중한 한국어)",
  "internalActions": ["내부 조치 1", "내부 조치 2"],
  "escalation": "상급자/관련 부서 에스컬레이션 조건",
  "followUp": "후속 안내·확인 사항",
  "docNotFound": false
}`;

function buildIncidentPrompt(context, input) {
  return `다음은 솔루션 메뉴얼·장애 대응 문서에서 검색된 관련 구간입니다.

${context}

---

[장애 접수 정보]
- 솔루션: ${input.solution || "(미입력)"}
- 증상: ${input.symptom}
- 고객 환경: ${input.environment || "(미입력)"}
- 영향 범위: ${input.impact || "(미입력)"}

위 문서만 근거로 장애 대응 방안을 작성하세요.
문서에 근거가 없으면 docNotFound를 true로 하고, 각 필드에 "문서에서 확인되지 않음"을 명시하세요.
반드시 아래 JSON 형식만 출력하세요.
${INCIDENT_SCHEMA}`;
}

function buildComplaintPrompt(context, input) {
  return `다음은 솔루션 메뉴얼·민원 응대 문서에서 검색된 관련 구간입니다.

${context}

---

[민원 접수 정보]
- 솔루션: ${input.solution || "(미입력)"}
- 민원 내용: ${input.content}
- 고객 환경: ${input.environment || "(미입력)"}
- 고객 요청: ${input.request || "(미입력)"}

위 문서만 근거로 민원 대응 방안을 작성하세요.
고객 응대 멘트(responseScript)와 내부 조치(internalActions)를 분리하세요.
문서에 근거가 없으면 docNotFound를 true로 하세요.
반드시 아래 JSON 형식만 출력하세요.
${COMPLAINT_SCHEMA}`;
}

async function generateStructuredResponse(apiKey, mode, input, chunks) {
  const context = buildContextBlock(chunks);
  const isIncident = mode === "incident";

  const systemInstruction = isIncident
    ? `당신은 플랜티넷 보안 솔루션 장애 대응 전문가입니다.
제공된 메뉴얼·Runbook만 근거로 증상→원인→확인→조치→에스컬레이션 순서로 대응안을 작성하세요.
문서에 없는 내용은 추측하지 마세요.`
    : `당신은 플랜티넷 보안 솔루션 민원 응대 전문가입니다.
제공된 메뉴얼·응대 가이드만 근거로 고객 응대 멘트와 내부 조치를 분리해 작성하세요.
문서에 없는 내용은 추측하지 마세요.`;

  const prompt = isIncident
    ? buildIncidentPrompt(context, input)
    : buildComplaintPrompt(context, input);

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );
  } catch {
    return {
      ok: false,
      error: {
        status: 502,
        body: {
          error: "Gemini API 연결에 실패했습니다.",
          code: "NETWORK_ERROR",
        },
      },
    };
  }

  const geminiData = await parseResponseJson(geminiRes);

  if (!geminiRes.ok) {
    const message =
      geminiData?.error?.message ||
      (geminiData._raw ? String(geminiData._raw).slice(0, 200) : "Gemini API 호출에 실패했습니다.");
    return { ok: false, error: parseGeminiError(geminiRes.status, { error: { message } }) };
  }

  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return {
      ok: false,
      error: {
        status: 502,
        body: { error: "AI 응답이 비어 있습니다.", code: "EMPTY_RESPONSE" },
      },
    };
  }

  try {
    const parsed = parseGeminiJson(text);
    return { ok: true, response: parsed };
  } catch (err) {
    return {
      ok: false,
      error: {
        status: 502,
        body: {
          error: err.message || "AI 응답을 파싱할 수 없습니다.",
          code: "PARSE_ERROR",
        },
      },
    };
  }
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handlePreflight(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = {
  MODEL,
  parseGeminiError,
  parseGeminiJson,
  buildContextBlock,
  generateAnswer,
  generateStructuredResponse,
  setCorsHeaders,
  handlePreflight,
};

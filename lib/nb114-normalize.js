function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeInquiry(raw, index = 0) {
  const item = raw && typeof raw === "object" ? raw : {};
  const id = String(pick(item, ["id", "inquiryId", "ticketId", "ticket_id", "no", "seq"]) || `NB-${index + 1}`);
  const question = String(pick(item, ["question", "inquiry", "content", "body", "title", "subject"])).trim();
  const response = String(pick(item, ["response", "answer", "reply", "responseText", "answerText"])).trim();

  return {
    id,
    date: String(pick(item, ["date", "createdAt", "created_at", "registeredAt", "regDate"])).trim(),
    solution: String(pick(item, ["solution", "product", "productName", "service"])).trim(),
    category: String(pick(item, ["category", "type", "inquiryType", "kind"])).trim(),
    title: String(pick(item, ["title", "subject", "summary"]) || question.slice(0, 80)).trim(),
    question,
    response,
    status: String(pick(item, ["status", "state", "progress"])).trim(),
    customer: String(pick(item, ["customer", "client", "organization", "orgName", "company"])).trim(),
    tags: normalizeTags(item.tags || item.tag || item.keywords),
  };
}

function extractInquiryList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.data,
    payload.items,
    payload.results,
    payload.list,
    payload.inquiries,
    payload.records,
    payload.rows,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && Array.isArray(candidate.items)) return candidate.items;
    if (candidate && Array.isArray(candidate.list)) return candidate.list;
  }

  return [];
}

function normalizeInquiries(payload) {
  const list = extractInquiryList(payload);
  return list
    .map((item, index) => normalizeInquiry(item, index))
    .filter((item) => item.question || item.response || item.title);
}

function inquiryToText(inquiry) {
  const lines = [
    inquiry.title ? `제목: ${inquiry.title}` : null,
    inquiry.solution ? `솔루션: ${inquiry.solution}` : null,
    inquiry.category ? `유형: ${inquiry.category}` : null,
    inquiry.customer ? `고객: ${inquiry.customer}` : null,
    inquiry.date ? `일자: ${inquiry.date}` : null,
    inquiry.status ? `상태: ${inquiry.status}` : null,
    inquiry.tags?.length ? `태그: ${inquiry.tags.join(", ")}` : null,
    inquiry.question ? `문의: ${inquiry.question}` : null,
    inquiry.response ? `응대: ${inquiry.response}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

module.exports = {
  normalizeInquiry,
  normalizeInquiries,
  extractInquiryList,
  inquiryToText,
};

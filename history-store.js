const HISTORY_KEY = "solution-qa-history";
const MAX_RECORDS = 200;

function loadAll() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(records) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function summarize(record) {
  if (record.title) return record.title;

  const input = record.input || {};
  if (record.type === "incident") {
    return String(input.symptom || "장애").slice(0, 80);
  }
  if (record.type === "complaint") {
    return String(input.content || "민원").slice(0, 80);
  }
  return String(input.question || "질문").slice(0, 80);
}

function addRecord({ type, input, response, searchMode }) {
  const record = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    type,
    title: "",
    input: input || {},
    response: response || {},
    searchMode: searchMode || null,
  };
  record.title = summarize(record);

  const records = loadAll();
  records.unshift(record);
  saveAll(records);
  return record;
}

function listRecords({ type = "", query = "", limit = 50 } = {}) {
  const q = String(query).trim().toLowerCase();
  let records = loadAll();

  if (type) {
    records = records.filter((r) => r.type === type);
  }

  if (q) {
    records = records.filter((r) => {
      const hay = [
        r.title,
        JSON.stringify(r.input),
        JSON.stringify(r.response),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return records.slice(0, limit);
}

function getRecord(id) {
  return loadAll().find((r) => r.id === id) || null;
}

function deleteRecord(id) {
  const next = loadAll().filter((r) => r.id !== id);
  saveAll(next);
  return next.length;
}

function clearAll() {
  localStorage.removeItem(HISTORY_KEY);
}

function exportJson() {
  return JSON.stringify(loadAll(), null, 2);
}

function importJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("배열 형식의 JSON이어야 합니다.");

  const valid = parsed.filter((r) => r && r.type && r.input);
  const merged = [...valid, ...loadAll()];
  const seen = new Set();
  const deduped = [];

  for (const item of merged) {
    const key = item.id || `${item.createdAt}-${item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      id: item.id || makeId(),
      createdAt: item.createdAt || new Date().toISOString(),
      type: item.type,
      title: item.title || summarize(item),
      input: item.input,
      response: item.response || {},
      searchMode: item.searchMode || null,
    });
  }

  saveAll(deduped);
  return deduped.length;
}

window.HistoryStore = {
  addRecord,
  listRecords,
  getRecord,
  deleteRecord,
  clearAll,
  exportJson,
  importJson,
  loadAll,
};

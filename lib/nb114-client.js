const { normalizeInquiries } = require("./nb114-normalize");

const DEFAULT_BASE_URL = "https://nb114.co.kr";
const DEFAULT_LIST_PATH = "/api/inquiries";

function ensureHttpsBaseUrl(rawUrl) {
  const input = String(rawUrl || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;

  if (/^http:\/\//i.test(input)) {
    console.warn("[nb114] NB114_BASE_URL은 HTTPS만 지원합니다. http:// 를 https:// 로 변경합니다.");
    return input.replace(/^http:\/\//i, "https://");
  }

  if (/^https:\/\//i.test(input)) {
    return input.replace(/\/+$/, "");
  }

  if (/^\/\//.test(input)) {
    return `https:${input.replace(/\/+$/, "")}`;
  }

  return `https://${input.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function getNb114Config() {
  const baseUrl = ensureHttpsBaseUrl(process.env.NB114_BASE_URL);
  const listPath = String(process.env.NB114_LIST_PATH || DEFAULT_LIST_PATH).trim() || DEFAULT_LIST_PATH;
  const token = String(process.env.NB114_API_TOKEN || "").trim();
  const authHeader = String(process.env.NB114_AUTH_HEADER || "Authorization").trim();
  const authScheme = String(process.env.NB114_AUTH_SCHEME || "Bearer").trim();

  return {
    baseUrl,
    listPath: listPath.startsWith("/") ? listPath : `/${listPath}`,
    token,
    authHeader,
    authScheme,
    pageParam: process.env.NB114_PAGE_PARAM || "page",
    limitParam: process.env.NB114_LIMIT_PARAM || "limit",
    defaultLimit: Number(process.env.NB114_FETCH_LIMIT || 200),
  };
}

function buildAuthHeaders(config) {
  const headers = {
    Accept: "application/json",
  };

  if (config.token) {
    headers[config.authHeader] = config.authScheme
      ? `${config.authScheme} ${config.token}`.trim()
      : config.token;
  }

  return headers;
}

function buildListUrl(config, { page = 1, limit } = {}) {
  const url = new URL(`${config.baseUrl}${config.listPath}`);
  url.searchParams.set(config.pageParam, String(page));
  url.searchParams.set(config.limitParam, String(limit || config.defaultLimit));
  return url;
}

async function fetchInquiryPage(config, { page = 1, limit } = {}) {
  const url = buildListUrl(config, { page, limit });

  if (url.protocol !== "https:") {
    throw new Error("nb114 API는 HTTPS만 지원합니다. NB114_BASE_URL을 https:// 로 설정하세요.");
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: buildAuthHeaders(config),
    });
  } catch (err) {
    throw new Error(`nb114 API 연결 실패 (${url.origin}): ${err.message}`);
  }

  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`nb114 API 응답이 JSON이 아닙니다. (${res.status})`);
  }

  if (!res.ok) {
    const message = payload?.message || payload?.error || text.slice(0, 200);
    throw new Error(`nb114 API 오류 (${res.status}): ${message}`);
  }

  return normalizeInquiries(payload);
}

async function fetchAllInquiries(options = {}) {
  const config = getNb114Config();

  if (!config.token && !options.allowNoToken) {
    throw new Error("NB114_API_TOKEN이 설정되지 않았습니다.");
  }

  const maxPages = Number(options.maxPages || process.env.NB114_MAX_PAGES || 5);
  const limit = Number(options.limit || config.defaultLimit);
  const merged = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchInquiryPage(config, { page, limit });
    if (!batch.length) break;

    for (const item of batch) {
      const key = item.id || `${item.title}:${item.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    if (batch.length < limit) break;
  }

  return merged;
}

function isNb114Configured() {
  return Boolean(String(process.env.NB114_API_TOKEN || "").trim());
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_LIST_PATH,
  ensureHttpsBaseUrl,
  getNb114Config,
  fetchAllInquiries,
  fetchInquiryPage,
  isNb114Configured,
};

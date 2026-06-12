const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { loadEnv } = require("../lib/env");
const { isNb114Configured } = require("../lib/nb114-client");

const ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "data", "docs");
const INDEX_PATH = path.join(ROOT, "data", "index.json");
const NB114_INDEX_PATH = path.join(ROOT, "data", "nb114-index.json");
const SUPPORTED = new Set([".pdf", ".docx", ".html", ".htm", ".txt", ".md"]);

function hasDocuments(dir = DOCS_DIR) {
  if (!fs.existsSync(dir)) return false;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (hasDocuments(fullPath)) return true;
      continue;
    }
    if (SUPPORTED.has(path.extname(entry.name).toLowerCase())) return true;
  }

  return false;
}

function runNode(scriptName, args = "") {
  execSync(`node "${path.join(__dirname, scriptName)}" ${args}`.trim(), {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });
}

function main() {
  loadEnv(ROOT);

  if (hasDocuments()) {
    const useEmbed = Boolean(process.env.GEMINI_API_KEY);
    console.log(`[build] 문서 인덱싱 (${useEmbed ? "임베딩 포함" : "키워드 전용"})`);
    runNode("index-docs.js", useEmbed ? "" : "--no-embed");
  } else if (fs.existsSync(INDEX_PATH)) {
    console.log("[build] data/docs 없음 — 커밋된 index.json 사용");
  } else {
    console.error("[build] data/docs 문서와 data/index.json 이 모두 없습니다.");
    process.exit(1);
  }

  try {
    if (isNb114Configured()) {
      console.log("[build] nb114 API 동기화 (HTTPS: https://nb114.co.kr)");
      runNode("sync-nb114.js");
    } else {
      console.log("[build] nb114 샘플/기존 inquiries.json 동기화");
      runNode("sync-nb114.js");
    }

    const useEmbed = Boolean(process.env.GEMINI_API_KEY);
    runNode("index-nb114.js", useEmbed ? "" : "--no-embed");
  } catch (err) {
    if (fs.existsSync(NB114_INDEX_PATH)) {
      console.log("[build] nb114 인덱싱 실패 — 기존 nb114-index.json 사용");
    } else {
      console.warn("[build] nb114 인덱싱 실패:", err.message || err);
    }
  }
}

main();

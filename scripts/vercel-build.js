const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "data", "docs");
const INDEX_PATH = path.join(ROOT, "data", "index.json");
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

function main() {
  if (!hasDocuments()) {
    if (!fs.existsSync(INDEX_PATH)) {
      console.error("[build] data/docs 문서와 data/index.json 이 모두 없습니다.");
      process.exit(1);
    }
    console.log("[build] data/docs 에 문서 없음 — 커밋된 index.json 사용");
    return;
  }

  const indexScript = path.join(__dirname, "index-docs.js");
  const useEmbed = Boolean(process.env.GEMINI_API_KEY);
  const args = useEmbed ? [] : ["--no-embed"];

  console.log(
    `[build] ${useEmbed ? "임베딩 포함" : "키워드 전용"} 인덱싱 시작`
  );
  execSync(`node "${indexScript}" ${args.join(" ")}`.trim(), {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });
}

main();

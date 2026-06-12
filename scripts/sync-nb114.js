const fs = require("fs");
const path = require("path");
const { loadEnv } = require("../lib/env");
const { normalizeInquiries, normalizeInquiry } = require("../lib/nb114-normalize");
const { fetchAllInquiries, isNb114Configured } = require("../lib/nb114-client");

const ROOT = path.join(__dirname, "..");
const NB114_DIR = path.join(ROOT, "data", "nb114");
const OUTPUT_PATH = path.join(NB114_DIR, "inquiries.json");
const SAMPLE_PATH = path.join(NB114_DIR, "sample-inquiries.json");

function parseCsv(text) {
  const lines = String(text)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)/g) || [];
    const values = cols.map((col) => col.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

function readImportFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, "utf8");

  if (ext === ".csv") {
    return normalizeInquiries(parseCsv(raw));
  }

  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return normalizeInquiries(parsed);
  if (Array.isArray(parsed.inquiries)) {
    return parsed.inquiries.map((item, index) => normalizeInquiry(item, index));
  }
  return normalizeInquiries(parsed);
}

function writeOutput(inquiries, source) {
  if (!fs.existsSync(NB114_DIR)) {
    fs.mkdirSync(NB114_DIR, { recursive: true });
  }

  const payload = {
    version: 1,
    source,
    syncedAt: new Date().toISOString(),
    count: inquiries.length,
    inquiries,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`저장: ${OUTPUT_PATH} (${inquiries.length}건, source=${source})`);
}

async function main() {
  loadEnv(ROOT);

  const importArgIndex = process.argv.indexOf("--import");
  const useSample = process.argv.includes("--sample");

  if (importArgIndex !== -1) {
    const importPath = process.argv[importArgIndex + 1];
    if (!importPath) {
      console.error("사용법: node scripts/sync-nb114.js --import path/to/file.json|file.csv");
      process.exit(1);
    }
    const absPath = path.isAbsolute(importPath) ? importPath : path.join(process.cwd(), importPath);
    const inquiries = readImportFile(absPath);
    writeOutput(inquiries, "import");
    return;
  }

  if (isNb114Configured()) {
    console.log("nb114 API 동기화 (HTTPS 전용: https://nb114.co.kr)");
    const inquiries = await fetchAllInquiries();
    writeOutput(inquiries, "api");
    return;
  }

  if (useSample || fs.existsSync(SAMPLE_PATH)) {
    console.log("NB114_API_TOKEN 없음 — sample-inquiries.json 사용");
    const sample = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));
    const inquiries = (sample.inquiries || []).map((item, index) => normalizeInquiry(item, index));
    writeOutput(inquiries, "sample");
    return;
  }

  console.error("동기화할 nb114 데이터가 없습니다.");
  console.error("  API: .env에 NB114_API_TOKEN 설정 (NB114_BASE_URL=https://nb114.co.kr)");
  console.error("  수동: node scripts/sync-nb114.js --import export.json");
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

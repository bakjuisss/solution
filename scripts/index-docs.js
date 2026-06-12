const fs = require("fs");
const path = require("path");
const { parseDocument, getSupportedExtensions } = require("../lib/parsers");
const { splitIntoChunks } = require("../lib/chunker");
const { embedBatch, EMBEDDING_MODEL, OUTPUT_DIMENSIONALITY } = require("../lib/embeddings");

const ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "data", "docs");
const INDEX_PATH = path.join(ROOT, "data", "index.json");

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  const supported = new Set(getSupportedExtensions());

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (supported.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  loadEnv();

  const noEmbed = process.argv.includes("--no-embed");
  const apiKey = process.env.GEMINI_API_KEY;

  if (!noEmbed && !apiKey) {
    console.error("GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하거나 --no-embed 옵션을 사용하세요.");
    process.exit(1);
  }

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const files = collectFiles(DOCS_DIR);
  if (!files.length) {
    console.error(`문서가 없습니다. ${DOCS_DIR} 에 메뉴얼 파일을 넣어 주세요.`);
    process.exit(1);
  }

  console.log(`인덱싱 시작: ${files.length}개 파일`);
  const allChunks = [];
  const failures = [];

  for (const filePath of files) {
    const rel = path.relative(DOCS_DIR, filePath);
    try {
      const doc = await parseDocument(filePath);
      let docChunkCount = 0;

      for (const section of doc.sections) {
        const text = String(section.text || "").trim();
        if (!text) continue;

        const chunks = splitIntoChunks(text);
        for (const chunk of chunks) {
          allChunks.push({
            docId: doc.docId,
            fileName: doc.fileName,
            title: doc.title,
            page: section.page ?? null,
            section: section.section ?? null,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
          });
          docChunkCount += 1;
        }
      }

      console.log(`  ✓ ${rel} — ${docChunkCount}개 청크`);
    } catch (err) {
      failures.push({ file: rel, error: err.message });
      console.error(`  ✗ ${rel} — ${err.message}`);
    }
  }

  if (!allChunks.length) {
    console.error("인덱싱할 텍스트 청크가 없습니다.");
    process.exit(1);
  }

  let indexedChunks = allChunks;

  if (noEmbed) {
    console.log("\n임베딩 생략 (--no-embed): 키워드 검색 모드로 인덱스를 생성합니다.");
  } else {
    console.log(`\n임베딩 생성 중... (모델: ${EMBEDDING_MODEL}, 차원: ${OUTPUT_DIMENSIONALITY})`);

    const embeddings = await embedBatch(
      apiKey,
      allChunks.map((chunk) => ({
        text: chunk.content,
        title: chunk.title,
        taskType: "RETRIEVAL_DOCUMENT",
      })),
      {
        onProgress: (done, total) => {
          process.stdout.write(`\r  진행: ${done}/${total}`);
        },
      }
    );

    process.stdout.write("\n");

    indexedChunks = allChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));
  }

  const index = {
    version: 1,
    createdAt: new Date().toISOString(),
    embeddingModel: EMBEDDING_MODEL,
    outputDimensionality: OUTPUT_DIMENSIONALITY,
    documentCount: files.length - failures.length,
    chunkCount: indexedChunks.length,
    chunks: indexedChunks,
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  const sizeMb = (fs.statSync(INDEX_PATH).size / (1024 * 1024)).toFixed(2);

  console.log(`\n완료: ${INDEX_PATH}`);
  console.log(`  문서: ${index.documentCount}개`);
  console.log(`  청크: ${index.chunkCount}개`);
  console.log(`  파일 크기: ${sizeMb} MB`);

  if (failures.length) {
    console.log(`  실패: ${failures.length}개`);
    process.exit(1);
  }

  console.log("\n[Vercel 배포 안내]");
  console.log("  웹 검색은 data/docs PDF가 아니라 data/index.json 만 사용합니다.");
  console.log("  아래를 실행한 뒤 Vercel이 재배포되면 검색에 반영됩니다:");
  console.log("    git add data/index.json");
  console.log('    git commit -m "문서 인덱스 갱신"');
  console.log("    git push origin main");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

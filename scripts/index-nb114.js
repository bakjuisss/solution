const fs = require("fs");
const path = require("path");
const { loadEnv } = require("../lib/env");
const { inquiryToText } = require("../lib/nb114-normalize");
const { splitIntoChunks } = require("../lib/chunker");
const { embedBatch, EMBEDDING_MODEL, OUTPUT_DIMENSIONALITY } = require("../lib/embeddings");

const ROOT = path.join(__dirname, "..");
const INQUIRIES_PATH = path.join(ROOT, "data", "nb114", "inquiries.json");
const SAMPLE_PATH = path.join(ROOT, "data", "nb114", "sample-inquiries.json");
const INDEX_PATH = path.join(ROOT, "data", "nb114-index.json");

function loadInquiries() {
  const sourcePath = fs.existsSync(INQUIRIES_PATH) ? INQUIRIES_PATH : SAMPLE_PATH;
  if (!fs.existsSync(sourcePath)) {
    throw new Error("nb114 문의 데이터가 없습니다. npm run sync-nb114 를 먼저 실행하세요.");
  }

  const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  return raw.inquiries || [];
}

async function main() {
  loadEnv(ROOT);

  const noEmbed = process.argv.includes("--no-embed");
  const apiKey = process.env.GEMINI_API_KEY;
  const inquiries = loadInquiries();

  if (!inquiries.length) {
    console.error("인덱싱할 nb114 문의가 없습니다.");
    process.exit(1);
  }

  const allChunks = [];

  for (const inquiry of inquiries) {
    const text = inquiryToText(inquiry);
    const chunks = splitIntoChunks(text, { chunkSize: 700, overlap: 80 });
    const fileName = `nb114 #${inquiry.id}`;

    for (const chunk of chunks) {
      allChunks.push({
        docId: `nb114:${inquiry.id}`,
        fileName,
        title: inquiry.title || fileName,
        page: null,
        section: inquiry.category || null,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        sourceType: "nb114",
        inquiryId: inquiry.id,
        solution: inquiry.solution || null,
        customer: inquiry.customer || null,
        inquiryDate: inquiry.date || null,
      });
    }

    console.log(`  ✓ ${inquiry.id} — ${chunks.length}개 청크`);
  }

  let indexedChunks = allChunks;

  if (noEmbed || !apiKey) {
    console.log("\n임베딩 생략: nb114 키워드 검색 모드");
  } else {
    console.log(`\n임베딩 생성 중... (${allChunks.length}청크)`);
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
    indexedChunks = allChunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] }));
  }

  const index = {
    version: 1,
    createdAt: new Date().toISOString(),
    embeddingModel: EMBEDDING_MODEL,
    outputDimensionality: OUTPUT_DIMENSIONALITY,
    sourceType: "nb114",
    inquiryCount: inquiries.length,
    chunkCount: indexedChunks.length,
    chunks: indexedChunks,
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  console.log(`\n완료: ${INDEX_PATH}`);
  console.log(`  문의: ${inquiries.length}건`);
  console.log(`  청크: ${indexedChunks.length}개`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

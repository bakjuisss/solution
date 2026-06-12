const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { splitIntoChunks } = require("../lib/chunker");
const { parseDocument } = require("../lib/parsers");
const { rankChunksKeywordOnly } = require("../lib/retriever");
const { filterResultsForContext, keywordScore } = require("../lib/query-utils");

const SAMPLE = path.join(__dirname, "..", "data", "docs", "sample-pcguard-guide.md");
const INDEX_PATH = path.join(__dirname, "..", "data", "index.json");

async function main() {
  console.log("로컬 검증 시작...\n");

  const doc = await parseDocument(SAMPLE);
  assert.ok(doc.sections.length > 0, "문서 섹션이 비어 있음");
  console.log(`✓ 파서: ${doc.fileName} (${doc.sections[0].text.length}자)`);

  const chunks = splitIntoChunks(doc.sections[0].text);
  assert.ok(chunks.length >= 1, "청크가 생성되지 않음");
  console.log(`✓ 청킹: ${chunks.length}개 청크`);

  const indexed = chunks.map((chunk, i) => ({
    docId: doc.docId,
    fileName: doc.fileName,
    title: doc.title,
    page: null,
    section: "설치 가이드",
    chunkIndex: i,
    content: chunk.content,
  }));

  const installResults = rankChunksKeywordOnly(indexed, "PCGuard 설치 절차", 3);
  assert.ok(installResults.length > 0, "설치 검색 결과 없음");
  assert.ok(
    installResults[0].content.includes("PCGuardSetup.exe"),
    "설치 청크가 상위에 없음"
  );
  console.log(`✓ 키워드 검색(설치): ${installResults.length}건, top score=${installResults[0].score}`);

  const licenseResults = rankChunksKeywordOnly(indexed, "라이선스 등록", 3);
  assert.ok(licenseResults.length > 0, "라이선스 검색 결과 없음");
  assert.ok(keywordScore("라이선스 등록", licenseResults[0].content) > 0);
  console.log(`✓ 키워드 검색(라이선스): ${licenseResults.length}건`);

  const missResults = rankChunksKeywordOnly(indexed, "존재하지않는내용xyz", 3);
  assert.equal(missResults.length, 0, "무관한 검색에 결과가 나옴");
  console.log("✓ 무관 검색: 결과 없음 (정상)");

  if (fs.existsSync(INDEX_PATH)) {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    const guardianResults = rankChunksKeywordOnly(index.chunks, "보호자", 5);
    assert.ok(guardianResults.length > 0, "인덱스에서 '보호자' 검색 결과 없음");
    const context = filterResultsForContext(guardianResults, "보호자", {
      maxCount: 4,
      keywordOnly: true,
    });
    assert.ok(context.length > 0, "보호자 컨텍스트 필터 결과 없음");
    console.log(
      `✓ PDF 인덱스(보호자): ${guardianResults.length}건, 문서 ${index.documentCount}개`
    );
  }

  console.log("\n모든 로컬 검증 통과");
}

main().catch((err) => {
  console.error("검증 실패:", err.message);
  process.exit(1);
});

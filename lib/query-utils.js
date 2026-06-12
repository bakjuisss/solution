const STOP_WORDS = new Set([
  "알려주세요",
  "알려",
  "주세요",
  "해주세요",
  "무엇",
  "어떻게",
  "인가요",
  "있나요",
  "되나요",
  "해요",
  "인지",
  "대해",
  "관해",
  "문의",
]);

function tokenizeQuery(query) {
  const text = String(query)
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return [];

  const rawWords = text.split(" ").filter(Boolean);
  const terms = new Set();

  for (const word of rawWords) {
    const stem = word.replace(/(을|를|이|가|은|는|에|의|로|와|과|도|만|요|까|서)$/u, "");
    if (stem.length >= 2 && !STOP_WORDS.has(stem)) terms.add(stem);
    if (word.length >= 2 && !STOP_WORDS.has(word)) terms.add(word);
  }

  for (let i = 0; i < rawWords.length - 1; i += 1) {
    const a = rawWords[i].replace(/(을|를)$/u, "");
    const b = rawWords[i + 1].replace(/(을|를)$/u, "");
    if (a.length >= 2 && b.length >= 2) {
      terms.add(`${a} ${b}`);
    }
  }

  return [...terms];
}

function keywordScore(query, text) {
  const terms = tokenizeQuery(query);
  if (!terms.length) return 0;

  const lowerText = String(text).toLowerCase();
  let hits = 0;
  let weight = 0;

  for (const term of terms) {
    const w = term.includes(" ") ? 2.5 : 1;
    weight += w;
    if (lowerText.includes(term)) hits += w;
  }

  return weight ? hits / weight : 0;
}

function extractRelevantExcerpt(content, query, maxLen = 280) {
  const text = String(content || "");
  if (!text) return "";

  const terms = tokenizeQuery(query).filter((t) => !t.includes(" "));
  let bestIndex = -1;

  for (const term of terms) {
    const idx = text.toLowerCase().indexOf(term);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) {
    return text.slice(0, maxLen);
  }

  const start = Math.max(0, bestIndex - 60);
  const end = Math.min(text.length, start + maxLen);
  let excerpt = text.slice(start, end).trim();

  if (start > 0) excerpt = `…${excerpt}`;
  if (end < text.length) excerpt = `${excerpt}…`;

  return excerpt;
}

function enrichResult(result, query) {
  return {
    ...result,
    excerpt: extractRelevantExcerpt(result.content, query),
    keywordScore: Number(keywordScore(query, result.content).toFixed(4)),
  };
}

function filterResultsForContext(results, query, { maxCount = 4 } = {}) {
  if (!results.length) return [];

  const enriched = results
    .map((item) => enrichResult(item, query))
    .sort((a, b) => b.score - a.score);

  const topScore = enriched[0].score;
  const minScore = Math.max(topScore * 0.55, 0.35);

  const filtered = enriched.filter((item) => item.score >= minScore);

  const deduped = [];
  const seen = new Set();

  for (const item of filtered) {
    const key = `${item.fileName}:${item.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= maxCount) break;
  }

  return deduped.length ? deduped : enriched.slice(0, 1);
}

function pickSourcesFromAnswer(answer, contextChunks, allResults) {
  const answerText = String(answer || "");
  const picked = [];
  const seen = new Set();

  function add(item) {
    if (!item) return;
    const key = `${item.fileName}:${item.chunkIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(item);
  }

  const indexMatches = answerText.matchAll(/출처\s*(\d+)/g);
  for (const match of indexMatches) {
    const idx = Number(match[1]) - 1;
    add(contextChunks[idx]);
  }

  const fileMatches = answerText.matchAll(/([A-Za-z0-9._-가-힣]+\.(?:md|pdf|docx|html|htm|txt))/gi);
  for (const match of fileMatches) {
    const fileName = match[1];
    const found = allResults.find((r) => r.fileName === fileName);
    add(found);
  }

  if (!picked.length) {
    return allResults.slice(0, Math.min(2, allResults.length));
  }

  return picked;
}

function toSourcePayload(item) {
  return {
    fileName: item.fileName,
    title: item.title,
    page: item.page,
    section: item.section,
    excerpt: item.excerpt,
    score: item.score,
  };
}

module.exports = {
  tokenizeQuery,
  keywordScore,
  extractRelevantExcerpt,
  enrichResult,
  filterResultsForContext,
  pickSourcesFromAnswer,
  toSourcePayload,
};

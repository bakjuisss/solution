const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function splitIntoChunks(text, options = {}) {
  const chunkSize = options.chunkSize || CHUNK_SIZE;
  const overlap = options.overlap || CHUNK_OVERLAP;
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("。"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      if (breakAt > chunkSize * 0.4) {
        end = start + breakAt + 1;
      }
    }

    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({ content, chunkIndex });
      chunkIndex += 1;
    }

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  splitIntoChunks,
};

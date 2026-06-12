const fs = require("fs");
const path = require("path");

const index = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "index.json"), "utf8")
);

const docs = [...new Set(index.chunks.map((c) => c.fileName))];
const guardian = index.chunks.filter((c) => c.content.includes("보호자")).length;

process.stdout.write(
  JSON.stringify(
    {
      documentCount: index.documentCount,
      chunkCount: index.chunkCount,
      docs,
      guardianChunks: guardian,
      hasEmbeddings: index.chunks.some(
        (c) => Array.isArray(c.embedding) && c.embedding.length
      ),
    },
    null,
    2
  )
);

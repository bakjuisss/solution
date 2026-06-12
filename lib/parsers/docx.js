const fs = require("fs/promises");
const mammoth = require("mammoth");

async function parseDocx(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = String(result.value || "").trim();

  return {
    title: filePath.split(/[/\\]/).pop(),
    sections: [{ page: null, section: null, text }],
  };
}

module.exports = { parseDocx };

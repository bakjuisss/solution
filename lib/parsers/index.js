const path = require("path");
const { parseText } = require("./text");
const { parseHtml } = require("./html");
const { parseDocx } = require("./docx");
const { parsePdf } = require("./pdf");

const EXT_HANDLERS = {
  ".txt": parseText,
  ".md": parseText,
  ".html": parseHtml,
  ".htm": parseHtml,
  ".docx": parseDocx,
  ".pdf": parsePdf,
};

function getSupportedExtensions() {
  return Object.keys(EXT_HANDLERS);
}

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const handler = EXT_HANDLERS[ext];

  if (!handler) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
  }

  const parsed = await handler(filePath);
  const fileName = path.basename(filePath);

  return {
    docId: fileName,
    fileName,
    title: parsed.title || fileName,
    sections: parsed.sections || [],
  };
}

module.exports = {
  getSupportedExtensions,
  parseDocument,
};

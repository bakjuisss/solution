const fs = require("fs/promises");
const pdfParse = require("pdf-parse");

async function parsePdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const fullText = String(data.text || "").trim();
  const pageCount = data.numpages || 1;

  if (!fullText) {
    return {
      title: filePath.split(/[/\\]/).pop(),
      sections: [],
    };
  }

  const approxPageLength = Math.max(Math.ceil(fullText.length / pageCount), 1);
  const sections = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const start = (page - 1) * approxPageLength;
    const end = page === pageCount ? fullText.length : page * approxPageLength;
    const text = fullText.slice(start, end).trim();
    if (text) {
      sections.push({ page, section: `Page ${page}`, text });
    }
  }

  if (!sections.length) {
    sections.push({ page: 1, section: null, text: fullText });
  }

  return {
    title: filePath.split(/[/\\]/).pop(),
    sections,
  };
}

module.exports = { parsePdf };

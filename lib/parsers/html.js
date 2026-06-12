const fs = require("fs/promises");
const cheerio = require("cheerio");

async function parseHtml(filePath) {
  const html = await fs.readFile(filePath, "utf8");
  const $ = cheerio.load(html);

  $("script, style, nav, footer, noscript").remove();

  const title = $("title").first().text().trim() || filePath.split(/[/\\]/).pop();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return {
    title,
    sections: [{ page: null, section: title, text: bodyText }],
  };
}

module.exports = { parseHtml };

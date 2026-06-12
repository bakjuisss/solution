const fs = require("fs/promises");

async function parseText(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return {
    title: filePath.split(/[/\\]/).pop(),
    sections: [{ page: null, section: null, text: content }],
  };
}

module.exports = { parseText };

const fs = require("fs");
const path = require("path");

// 🔧 Change this to your target folder (e.g., src or Assets)
const ROOT_DIR = path.join(__dirname, "src/Assets/Banks");

// Toggle this:
// true  → overwrite original files
// false → create *.clean.svg files
const OVERWRITE = true;

// Regex cleaners
const removeNamespaces = (content) =>
  content.replace(/\s+xmlns:[a-zA-Z0-9]+="[^"]*"/g, "");

const removeMetadata = (content) =>
  content.replace(/<metadata[\s\S]*?<\/metadata>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<defs[^>]*>\s*<\/defs>/g, "");

const cleanSVG = (filePath) => {
  let content = fs.readFileSync(filePath, "utf8");

  const cleaned = removeMetadata(removeNamespaces(content));

  const outputPath = OVERWRITE
    ? filePath
    : filePath.replace(".svg", ".clean.svg");

  fs.writeFileSync(outputPath, cleaned, "utf8");

  console.log(`✔ Cleaned: ${filePath}`);
};

const walkDir = (dir) => {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith(".svg")) {
      cleanSVG(fullPath);
    }
  });
};

// 🚀 Run
console.log("Cleaning SVG files...\n");
walkDir(ROOT_DIR);
console.log("\nDone!");
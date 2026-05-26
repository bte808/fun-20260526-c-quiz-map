import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { completeAnalysis } from "../src/quiz-map.js";
import { sampleConceptMap, sampleQuizCsv } from "../src/sample-data.js";

const root = new URL("..", import.meta.url);
const requiredFiles = [
  "index.html",
  "styles.css",
  "src/app.js",
  "src/quiz-map.js",
  "src/sample-data.js",
  "README.md",
  "LICENSE"
];

for (const file of requiredFiles) {
  const path = join(root.pathname, file);
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const source = await readFile(new URL("../src/quiz-map.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const sample = await readFile(new URL("../src/sample-data.js", import.meta.url), "utf8");

for (const [name, content] of Object.entries({ index, readme, css, source, app, sample })) {
  if (/\/Users\/|OPENAI_API_KEY|ghp_|node_modules/.test(content)) {
    throw new Error(`Forbidden local/private marker found in ${name}`);
  }
}

if (!index.includes('type="module" src="./src/app.js"')) {
  throw new Error("index.html does not load the app module");
}

if (!readme.includes("Nature Communications") || !readme.includes("example data")) {
  throw new Error("README needs inspiration and sample-data caveats");
}

if (!css.includes("@media (max-width: 560px)")) {
  throw new Error("Mobile layout media query is missing");
}

const analysis = completeAnalysis(sampleConceptMap, sampleQuizCsv);
if (analysis.concepts.length < 6 || analysis.prompts.length < 3) {
  throw new Error("Sample analysis is too thin");
}

if (analysis.markdown.includes("NaN")) {
  throw new Error("Markdown report includes NaN");
}

console.log("Static check passed");
console.log(analysis.summary);

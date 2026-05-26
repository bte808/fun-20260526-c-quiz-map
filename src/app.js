import { sampleConceptMap, sampleQuizCsv } from "./sample-data.js";
import {
  completeAnalysis,
  formatDelta,
  formatPercent
} from "./quiz-map.js";

const statusColors = {
  secure: "#2f8f83",
  steady: "#6b8f2f",
  fragile: "#d89b22",
  urgent: "#d85c4a",
  blocked: "#8b5fbf",
  untested: "#7a8691"
};

const elements = {
  form: document.querySelector("#quiz-form"),
  conceptMap: document.querySelector("#concept-map"),
  quizResults: document.querySelector("#quiz-results"),
  sampleButton: document.querySelector("#sample-button"),
  resetButton: document.querySelector("#reset-button"),
  copyButton: document.querySelector("#copy-button"),
  downloadButton: document.querySelector("#download-button"),
  summary: document.querySelector("#run-summary"),
  statusGrid: document.querySelector("#status-grid"),
  svg: document.querySelector("#knowledge-map"),
  priorityList: document.querySelector("#priority-list"),
  promptList: document.querySelector("#prompt-list"),
  tableBody: document.querySelector("#concept-table"),
  warnings: document.querySelector("#warnings"),
  copyBuffer: document.querySelector("#copy-buffer")
};

let latestAnalysis = null;

elements.conceptMap.value = sampleConceptMap;
elements.quizResults.value = sampleQuizCsv;
runAnalysis();

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runAnalysis();
});

elements.sampleButton.addEventListener("click", () => {
  elements.conceptMap.value = sampleConceptMap;
  elements.quizResults.value = sampleQuizCsv;
  runAnalysis();
});

elements.resetButton.addEventListener("click", () => {
  elements.conceptMap.value = "";
  elements.quizResults.value = "";
  runAnalysis();
});

elements.copyButton.addEventListener("click", async () => {
  if (!latestAnalysis) return;
  try {
    await navigator.clipboard.writeText(latestAnalysis.markdown);
    setActionLabel(elements.copyButton, "Copied");
  } catch {
    elements.copyBuffer.value = latestAnalysis.markdown;
    elements.copyBuffer.hidden = false;
    elements.copyBuffer.select();
    setActionLabel(elements.copyButton, "Selected");
  }
});

elements.downloadButton.addEventListener("click", () => {
  if (!latestAnalysis) return;
  const blob = new Blob([JSON.stringify(latestAnalysis, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quiz-map-report.json";
  link.click();
  URL.revokeObjectURL(url);
  setActionLabel(elements.downloadButton, "Saved");
});

function runAnalysis() {
  latestAnalysis = completeAnalysis(
    elements.conceptMap.value,
    elements.quizResults.value
  );
  render(latestAnalysis);
}

function render(analysis) {
  elements.summary.textContent = analysis.summary;
  renderStats(analysis);
  renderMap(analysis);
  renderPriorities(analysis);
  renderPrompts(analysis);
  renderTable(analysis);
  renderWarnings(analysis);
}

function renderStats(analysis) {
  const urgent = analysis.concepts.filter((item) => item.status === "urgent").length;
  const fragile = analysis.concepts.filter((item) => item.status === "fragile").length;
  const blocked = analysis.concepts.filter((item) => item.status === "blocked").length;
  const secure = analysis.concepts.filter((item) => item.status === "secure").length;
  const stats = [
    ["Concepts", String(analysis.concepts.length)],
    ["Quiz tags", String(analysis.quizItemCount)],
    ["Needs work", String(urgent + fragile + blocked)],
    ["Secure", String(secure)]
  ];
  elements.statusGrid.replaceChildren(
    ...stats.map(([label, value]) => {
      const node = document.createElement("div");
      node.className = "stat";
      node.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      return node;
    })
  );
}

function renderMap(analysis) {
  elements.svg.replaceChildren();
  const concepts = analysis.concepts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!concepts.length) {
    return;
  }

  const positions = layoutConcepts(concepts);
  const defs = svgElement("defs");
  defs.appendChild(
    svgElement("marker", {
      id: "arrow",
      markerWidth: 10,
      markerHeight: 10,
      refX: 7,
      refY: 3,
      orient: "auto",
      markerUnits: "strokeWidth"
    })
  );
  defs.querySelector("marker").appendChild(
    svgElement("path", { d: "M0,0 L0,6 L8,3 z", fill: "#8a948f" })
  );
  elements.svg.appendChild(defs);

  for (const concept of concepts) {
    const target = positions.get(concept.key);
    for (const prereqName of concept.prerequisites) {
      const source = positions.get(prereqName.toLowerCase());
      if (!source || !target) continue;
      elements.svg.appendChild(
        svgElement("line", {
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          class: "edge",
          "marker-end": "url(#arrow)"
        })
      );
    }
  }

  for (const concept of concepts) {
    const point = positions.get(concept.key);
    const group = svgElement("g", { class: "node-group" });
    const color = statusColors[concept.status] ?? statusColors.untested;
    group.appendChild(
      svgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 34,
        fill: color,
        class: "node-dot"
      })
    );
    group.appendChild(
      svgText(point.x, point.y + 5, concept.name.split(" ")[0], "node-label")
    );
    group.appendChild(
      svgText(
        point.x,
        point.y + 58,
        `${concept.status} ${formatPercent(concept.currentScore)}`,
        "node-score"
      )
    );
    elements.svg.appendChild(group);
  }
}

function renderPriorities(analysis) {
  const list = analysis.concepts
    .filter((concept) => concept.status !== "secure")
    .slice(0, 5);
  if (!list.length) {
    elements.priorityList.innerHTML =
      '<p class="empty-state">No priority concepts in this sample.</p>';
    return;
  }

  elements.priorityList.replaceChildren(
    ...list.map((concept) => {
      const item = document.createElement("article");
      item.className = "priority-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(concept.name)}</strong>
          <span>${escapeHtml(concept.status)} · risk ${Math.round(
            concept.riskIndex * 100
          )}</span>
        </div>
        <p>${escapeHtml(concept.riskNote)}</p>
        <div class="bar" aria-label="Current mastery">
          <span style="width:${masteryWidth(concept.currentScore)}"></span>
        </div>
      `;
      return item;
    })
  );
}

function renderPrompts(analysis) {
  if (!analysis.prompts.length) {
    elements.promptList.innerHTML =
      '<li class="empty-state">Add quiz rows to generate recall prompts.</li>';
    return;
  }
  elements.promptList.replaceChildren(
    ...analysis.prompts.map((prompt) => {
      const item = document.createElement("li");
      item.textContent = prompt;
      return item;
    })
  );
}

function renderTable(analysis) {
  elements.tableBody.replaceChildren(
    ...analysis.concepts.map((concept) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(concept.name)}</td>
        <td><span class="status-pill" data-status="${escapeHtml(
          concept.status
        )}">${escapeHtml(concept.status)}</span></td>
        <td>${formatPercent(concept.currentScore)}</td>
        <td>${formatDelta(concept.delta)}</td>
        <td>${concept.attempts}</td>
        <td>${escapeHtml(concept.riskNote)}</td>
      `;
      return row;
    })
  );
}

function renderWarnings(analysis) {
  if (!analysis.warnings.length) {
    elements.warnings.innerHTML = "";
    return;
  }
  elements.warnings.replaceChildren(
    ...analysis.warnings.map((warning) => {
      const item = document.createElement("p");
      item.textContent = warning;
      return item;
    })
  );
}

function layoutConcepts(concepts) {
  const byKey = new Map(concepts.map((concept) => [concept.key, concept]));
  const memo = new Map();
  const levelOf = (concept) => {
    if (memo.has(concept.key)) return memo.get(concept.key);
    const prereqLevels = concept.prerequisites
      .map((name) => byKey.get(name.toLowerCase()))
      .filter(Boolean)
      .map(levelOf);
    const level = prereqLevels.length ? Math.max(...prereqLevels) + 1 : 0;
    memo.set(concept.key, Math.min(level, 4));
    return memo.get(concept.key);
  };

  const buckets = new Map();
  concepts.forEach((concept) => {
    const level = levelOf(concept);
    if (!buckets.has(level)) buckets.set(level, []);
    buckets.get(level).push(concept);
  });

  const levels = [...buckets.keys()].sort((a, b) => a - b);
  const positions = new Map();
  levels.forEach((level, levelIndex) => {
    const bucket = buckets.get(level);
    const x = 110 + levelIndex * (660 / Math.max(1, levels.length - 1 || 1));
    bucket.forEach((concept, index) => {
      const y = 92 + index * (316 / Math.max(1, bucket.length - 1 || 1));
      positions.set(concept.key, { x, y });
    });
  });
  return positions;
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function svgText(x, y, content, className) {
  const text = svgElement("text", {
    x,
    y,
    class: className,
    "text-anchor": "middle"
  });
  text.textContent = content;
  return text;
}

function masteryWidth(value) {
  return Number.isFinite(value) ? `${Math.max(6, Math.round(value * 100))}%` : "6%";
}

function setActionLabel(button, temporaryLabel) {
  const original = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = original;
  button.textContent = temporaryLabel;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

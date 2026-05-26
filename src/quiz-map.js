const CORRECT_VALUES = new Set(["correct", "right", "true", "yes", "y", "1", "ok"]);
const WRONG_VALUES = new Set(["wrong", "incorrect", "false", "no", "n", "0", "miss", "missed"]);
const CURRENT_STAGES = new Set(["post", "current", "final", "review", "after"]);
const BASELINE_STAGES = new Set(["pre", "baseline", "before"]);

export function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseConceptMap(text) {
  const warnings = [];
  const conceptByKey = new Map();
  const order = [];

  String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      const name = normalizeName(parts[0]);
      if (!name) {
        warnings.push(`Line ${index + 1} has no concept name.`);
        return;
      }
      const key = name.toLowerCase();
      const prerequisites = splitList(parts[1] ?? "");
      const note = normalizeName(parts[2] ?? "");

      if (conceptByKey.has(key)) {
        warnings.push(`Duplicate concept ignored: ${name}.`);
        return;
      }

      conceptByKey.set(key, { name, prerequisites, note, source: "listed" });
      order.push(key);
    });

  for (const key of [...order]) {
    const concept = conceptByKey.get(key);
    for (const prereqName of concept.prerequisites) {
      const prereqKey = prereqName.toLowerCase();
      if (!conceptByKey.has(prereqKey)) {
        conceptByKey.set(prereqKey, {
          name: prereqName,
          prerequisites: [],
          note: "Added because another concept named it as a prerequisite.",
          source: "implied"
        });
        order.unshift(prereqKey);
        warnings.push(`Added implied prerequisite concept: ${prereqName}.`);
      }
    }
  }

  return {
    concepts: order.map((key) => conceptByKey.get(key)),
    warnings
  };
}

export function parseQuizCsv(text) {
  const rows = parseCsv(text);
  const warnings = [];
  if (rows.length === 0) {
    return { items: [], warnings: ["Quiz CSV is empty."] };
  }

  const headers = rows[0].map((header) => normalizeName(header).toLowerCase());
  const aliases = {
    question: ["question", "prompt", "item", "id"],
    concept: ["concept", "concepts", "tag", "tags"],
    stage: ["stage", "phase", "time"],
    result: ["result", "correct", "score", "answer"],
    confidence: ["confidence", "conf"],
    note: ["note", "notes", "reason"]
  };
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([name, names]) => [
      name,
      headers.findIndex((header) => names.includes(header))
    ])
  );

  if (columns.concept === -1) {
    warnings.push("Quiz CSV needs a concept column.");
  }
  if (columns.result === -1) {
    warnings.push("Quiz CSV needs a result column.");
  }
  if (warnings.length) {
    return { items: [], warnings };
  }

  const items = rows.slice(1).flatMap((row, rowIndex) => {
    if (row.every((cell) => !normalizeName(cell))) {
      return [];
    }

    const concepts = splitList(row[columns.concept] ?? "");
    if (concepts.length === 0) {
      warnings.push(`Quiz row ${rowIndex + 2} has no concept tag.`);
      return [];
    }

    const result = parseResult(row[columns.result]);
    if (Number.isNaN(result.score)) {
      warnings.push(`Quiz row ${rowIndex + 2} has an unknown result value.`);
      return [];
    }

    const confidence = clampNumber(row[columns.confidence], 1, 5, 3);
    const question =
      normalizeName(row[columns.question]) || `Question ${rowIndex + 1}`;
    const stage = normalizeName(row[columns.stage] || "current").toLowerCase();
    const note = normalizeName(row[columns.note]);

    return concepts.map((concept) => ({
      question,
      concept,
      conceptKey: concept.toLowerCase(),
      stage,
      score: result.score,
      isCorrect: result.score >= 0.5,
      confidence,
      note,
      rowNumber: rowIndex + 2
    }));
  });

  return { items, warnings };
}

export function analyzeQuizMap(conceptText, quizText) {
  const parsedConcepts = parseConceptMap(conceptText);
  const parsedQuiz = parseQuizCsv(quizText);
  const warnings = [...parsedConcepts.warnings, ...parsedQuiz.warnings];
  const conceptByKey = new Map(
    parsedConcepts.concepts.map((concept) => [concept.name.toLowerCase(), { ...concept }])
  );

  for (const item of parsedQuiz.items) {
    if (!conceptByKey.has(item.conceptKey)) {
      conceptByKey.set(item.conceptKey, {
        name: item.concept,
        prerequisites: [],
        note: "Added from quiz data because it was not listed in the concept map.",
        source: "quiz"
      });
      warnings.push(`Added quiz-only concept: ${item.concept}.`);
    }
  }

  const concepts = [...conceptByKey.entries()].map(([key, concept]) => {
    const items = parsedQuiz.items.filter((item) => item.conceptKey === key);
    const currentItems = pickCurrentItems(items);
    const baselineItems = items.filter((item) => BASELINE_STAGES.has(item.stage));
    const currentScore = average(currentItems.map((item) => item.score));
    const baselineScore = average(baselineItems.map((item) => item.score));
    const highConfidenceMisses = currentItems.filter(
      (item) => item.score < 0.5 && item.confidence >= 4
    );

    return {
      ...concept,
      key,
      items,
      currentItems,
      baselineItems,
      attempts: items.length,
      currentScore,
      baselineScore,
      delta:
        Number.isFinite(currentScore) && Number.isFinite(baselineScore)
          ? currentScore - baselineScore
          : null,
      averageConfidence: average(currentItems.map((item) => item.confidence)),
      highConfidenceMisses,
      status: statusForScore(currentScore),
      riskIndex: 0,
      prerequisiteRisks: [],
      riskNote: ""
    };
  });

  const analysisByKey = new Map(concepts.map((concept) => [concept.key, concept]));

  for (const concept of concepts) {
    const prereqRisks = concept.prerequisites
      .map((name) => analysisByKey.get(name.toLowerCase()))
      .filter(Boolean)
      .filter((prereq) => !Number.isFinite(prereq.currentScore) || prereq.currentScore < 0.65);
    const masteryGap = Number.isFinite(concept.currentScore)
      ? 1 - concept.currentScore
      : 0.65;
    const prereqDrag = average(
      prereqRisks.map((prereq) =>
        Number.isFinite(prereq.currentScore) ? 0.65 - prereq.currentScore : 0.35
      )
    );
    const missPenalty = Math.min(0.18, concept.highConfidenceMisses.length * 0.08);
    concept.prerequisiteRisks = prereqRisks.map((item) => item.name);
    concept.riskIndex = clamp(
      masteryGap * 0.75 + (Number.isFinite(prereqDrag) ? prereqDrag * 0.65 : 0) + missPenalty,
      0,
      1
    );
    concept.status =
      concept.status === "secure" && concept.prerequisiteRisks.length
        ? "blocked"
        : concept.status;
    concept.riskNote = buildRiskNote(concept);
  }

  concepts.sort((a, b) => {
    if (b.riskIndex !== a.riskIndex) return b.riskIndex - a.riskIndex;
    return a.name.localeCompare(b.name);
  });

  const prompts = buildPrompts(concepts);
  const summary = buildSummary(concepts, parsedQuiz.items);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    concepts,
    prompts,
    warnings,
    quizItemCount: parsedQuiz.items.length,
    markdown: ""
  };
}

export function buildMarkdownReport(analysis) {
  const lines = [
    "# Quiz Map Review Report",
    "",
    analysis.summary,
    "",
    "This is a local study aid. It does not verify textbook truth, grade a course officially, or replace the original learning materials.",
    "",
    "## Priority Concepts",
    "",
    "| Concept | Status | Current | Delta | Risk note |",
    "| --- | --- | ---: | ---: | --- |"
  ];

  for (const concept of analysis.concepts.slice(0, 8)) {
    lines.push(
      `| ${escapePipes(concept.name)} | ${concept.status} | ${formatPercent(
        concept.currentScore
      )} | ${formatDelta(concept.delta)} | ${escapePipes(concept.riskNote)} |`
    );
  }

  lines.push("", "## Recall Prompts", "");
  analysis.prompts.forEach((prompt, index) => {
    lines.push(`${index + 1}. ${prompt}`);
  });

  if (analysis.warnings.length) {
    lines.push("", "## Input Warnings", "");
    analysis.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  return lines.join("\n");
}

export function completeAnalysis(conceptText, quizText) {
  const analysis = analyzeQuizMap(conceptText, quizText);
  analysis.markdown = buildMarkdownReport(analysis);
  return analysis;
}

export function statusForScore(score) {
  if (!Number.isFinite(score)) return "untested";
  if (score >= 0.82) return "secure";
  if (score >= 0.62) return "steady";
  if (score >= 0.42) return "fragile";
  return "urgent";
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "n/a";
}

export function formatDelta(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 100)} pts`;
}

function buildSummary(concepts, items) {
  const tested = concepts.filter((concept) => concept.attempts > 0).length;
  const urgent = concepts.filter((concept) => concept.status === "urgent").length;
  const fragile = concepts.filter((concept) => concept.status === "fragile").length;
  const confidentMisses = concepts.reduce(
    (total, concept) => total + concept.highConfidenceMisses.length,
    0
  );
  return `${tested}/${concepts.length} concepts tested from ${items.length} tagged quiz checks. ${urgent} urgent, ${fragile} fragile, ${confidentMisses} high-confidence misses.`;
}

function buildRiskNote(concept) {
  const bits = [];
  if (!Number.isFinite(concept.currentScore)) {
    bits.push("no quiz evidence yet");
  } else if (concept.currentScore < 0.42) {
    bits.push("low current mastery");
  } else if (concept.currentScore < 0.62) {
    bits.push("needs another retrieval pass");
  }
  if (concept.highConfidenceMisses.length) {
    bits.push(`${concept.highConfidenceMisses.length} confident miss`);
  }
  if (concept.prerequisiteRisks.length) {
    bits.push(`prereq risk: ${concept.prerequisiteRisks.join(", ")}`);
  }
  if (bits.length === 0) {
    bits.push("stable on this sample");
  }
  return bits.join("; ");
}

function buildPrompts(concepts) {
  const prompts = [];
  const topRisks = concepts
    .filter((concept) => concept.status !== "secure")
    .slice(0, 4);

  for (const concept of topRisks) {
    if (concept.prerequisiteRisks.length) {
      prompts.push(
        `Before reviewing ${concept.name}, repair ${concept.prerequisiteRisks.join(
          " and "
        )}; explain how it supports ${concept.name}.`
      );
    } else {
      prompts.push(
        `Teach back ${concept.name} in 90 seconds, then write one new example and one near-miss example.`
      );
    }
  }

  const confidentMiss = concepts.flatMap((concept) =>
    concept.highConfidenceMisses.map((item) => ({ concept: concept.name, item }))
  )[0];
  if (confidentMiss) {
    prompts.push(
      `For ${confidentMiss.concept}, compare the confident wrong answer on "${confidentMiss.item.question}" with the rule that would have prevented it.`
    );
  }

  const untested = concepts.find((concept) => concept.status === "untested");
  if (untested) {
    prompts.push(`Add one diagnostic question for ${untested.name}; untested concepts should not look mastered.`);
  }

  return [...new Set(prompts)].slice(0, 6);
}

function pickCurrentItems(items) {
  const current = items.filter((item) => CURRENT_STAGES.has(item.stage));
  return current.length ? current : items;
}

function splitList(value) {
  return String(value ?? "")
    .split(/[;,+]/)
    .map(normalizeName)
    .filter(Boolean);
}

function parseResult(value) {
  const raw = normalizeName(value).toLowerCase();
  if (CORRECT_VALUES.has(raw)) return { score: 1 };
  if (WRONG_VALUES.has(raw)) return { score: 0 };
  if (raw.endsWith("%")) {
    const numeric = Number.parseFloat(raw.slice(0, -1));
    return { score: Number.isFinite(numeric) ? clamp(numeric / 100, 0, 1) : Number.NaN };
  }
  const numeric = Number.parseFloat(raw);
  if (Number.isFinite(numeric)) {
    return { score: clamp(numeric, 0, 1) };
  }
  return { score: Number.NaN };
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? clamp(numeric, min, max) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return Number.NaN;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const input = String(text ?? "").replace(/\r\n/g, "\n");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => normalizeName(value)));
}

function escapePipes(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

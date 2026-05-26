import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleConceptMap, sampleQuizCsv } from "../src/sample-data.js";
import {
  completeAnalysis,
  parseConceptMap,
  parseQuizCsv,
  statusForScore
} from "../src/quiz-map.js";

test("parses listed concepts and prerequisites", () => {
  const parsed = parseConceptMap(sampleConceptMap);
  assert.equal(parsed.concepts.length, 8);
  const validity = parsed.concepts.find((concept) => concept.name === "Validity");
  assert.deepEqual(validity.prerequisites, ["Operational definition", "Reliability"]);
  assert.deepEqual(parsed.warnings, []);
});

test("parses quiz rows with semicolon concept tags", () => {
  const parsed = parseQuizCsv(sampleQuizCsv);
  assert.equal(parsed.items.length, 13);
  assert.equal(parsed.warnings.length, 0);
  const validityRows = parsed.items.filter((item) => item.concept === "Validity");
  assert.equal(validityRows.length, 2);
});

test("builds a review analysis without fabricated certainty", () => {
  const analysis = completeAnalysis(sampleConceptMap, sampleQuizCsv);
  assert.match(analysis.summary, /high-confidence misses/);
  assert.ok(analysis.concepts.some((concept) => concept.name === "Sampling bias"));
  assert.ok(analysis.prompts.length >= 3);
  assert.match(analysis.markdown, /does not verify textbook truth/);
  assert.doesNotMatch(analysis.markdown, /NaN/);
});

test("status thresholds are stable", () => {
  assert.equal(statusForScore(0.9), "secure");
  assert.equal(statusForScore(0.7), "steady");
  assert.equal(statusForScore(0.5), "fragile");
  assert.equal(statusForScore(0.2), "urgent");
  assert.equal(statusForScore(Number.NaN), "untested");
});

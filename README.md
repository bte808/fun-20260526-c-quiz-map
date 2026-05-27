# Quiz Map

Quiz Map is a small local study tool that turns tagged quiz results into a
concept mastery map, prerequisite risk list, and active-recall prompts. It runs
entirely in the browser with static HTML, CSS, and JavaScript.

## What It Does

Paste two plain-text inputs:

- A course concept map: one concept per line, with optional prerequisites.
- A quiz-results CSV: one row per question, tagged with the concept it tested.

The app then creates:

- A color-coded SVG knowledge map.
- A priority list for concepts that need review.
- A prerequisite-risk note when a later concept depends on a weak earlier one.
- Recall prompts for teach-back, near-miss examples, and confident mistakes.
- Per-concept next review actions so the map turns into a short study checklist.
- A copyable Markdown report and downloadable JSON report.

## Good Study And Research Uses

Quiz Map is useful after a short diagnostic quiz, lab-methods check, reading
group quiz, exam review session, or teaching-assistant office hour. It helps
turn "I got 7/12" into "I missed sampling bias twice, and that weakness affects
how I reason about validity."

This is deliberately not an authority engine. It does not grade a course
officially, verify textbook truth, infer hidden knowledge, or generate citations.
If you use formulas, course concepts, or research methods in your own input,
check them against your textbook, lecture notes, paper, or instructor feedback.
The built-in rows are example data only.

## Why It Is Interesting

Recent education and knowledge-tool discussions keep pointing toward structured
maps rather than flat scores. The inspiration for this prototype came from:

- Nature Communications work on conceptual knowledge maps derived from short
  multiple-choice quizzes:
  <https://www.nature.com/articles/s41467-026-69746-w>
- Dartmouth coverage of mapping student knowledge with short quizzes:
  <https://www.miragenews.com/new-tool-maps-student-knowledge-with-short-1643037/>
- The recent "graphs that teach" framing in Understand Anything:
  <https://github.com/Lum1104/Understand-Anything>

Quiz Map borrows only the idea of using quiz traces and concept structure. It
does not copy code, datasets, quiz questions, paper text, UI design, or claims
from those sources.

## Run Locally

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 5179
```

Then open <http://localhost:5179/>.

For repository checks:

```bash
npm test
npm run check
```

## Input Formats

Concept map:

```text
Research question | | Focuses the study scope
Variables | Research question | Names what changes or is measured
Operational definition | Variables | Makes abstract variables observable
Reliability | Operational definition | Checks consistency of a measure
Validity | Operational definition, Reliability | Checks whether the measure fits the idea
```

Quiz CSV:

```csv
question,concept,stage,result,confidence,note
Q1: Identify the scope,Research question,pre,correct,3,Scope was visible
Q2: Pick an observable measure,Operational definition,post,wrong,4,Confused construct with instrument
Q3: Link consistency and fit,Validity; Reliability,post,correct,3,Validity depends on more than agreement
```

`result` accepts `correct`, `wrong`, `true`, `false`, `1`, `0`, or a numeric
score from `0` to `1`. `confidence` is a 1-5 self-rating. Multi-concept quiz
items use semicolons in the concept column.

## Core Workflow

1. Load the default sample to see the shape of the tool.
2. Replace the concept map with your current chapter, unit, or methods topic.
3. Paste quiz rows from a short self-check.
4. Press Analyze.
5. Review the highest-risk concepts first.
6. Use the next review actions as a short checklist before another quiz pass.
7. Copy the Markdown report into a study log or export JSON for later tracking.

## Later Extensions

- Import from a learning-management-system CSV export.
- Compare multiple quiz dates.
- Add optional per-concept target thresholds.
- Export the SVG map as an image.
- Add a printable one-page review sheet.

## License

MIT

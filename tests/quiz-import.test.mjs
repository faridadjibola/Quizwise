import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseQuizImport, validateImportRows } from "../src/lib/quiz-import.mjs";

const sample = new URL("../public/sample-quizzes.csv", import.meta.url);

test("parses the sample CSV into ten valid quiz questions", async () => {
  const preview = await parseQuizImport("sample.csv", await readFile(sample));
  assert.equal(preview.summary.questionCount, 10);
  assert.equal(preview.summary.validCount, 10);
  assert.equal(preview.summary.errorCount, 0);
  assert.equal(preview.summary.quizCount, 1);
  assert.equal(preview.rows[5].data.type, "TRUE_FALSE");
});

test("reports row numbers and a clear message when a correct answer is missing", () => {
  const preview = validateImportRows([
    {
      rowNumber: 7,
      data: {
        quiz_title: "Science",
        category: "Science",
        difficulty: "Easy",
        question: "Which planet is red?",
        type: "MCQ",
        option_a: "Venus",
        option_b: "Mars",
        correct: "",
      },
    },
  ]);
  assert.ok(preview.rows[0].errors.includes("correct answer missing"));
  assert.equal(preview.rows[0].rowNumber, 7);
});

test("requires consistent category and difficulty for questions in one quiz", () => {
  const base = {
    quiz_title: "Science",
    category: "Science",
    difficulty: "Easy",
    question: "Which planet is red?",
    type: "MCQ",
    option_a: "Venus",
    option_b: "Mars",
    correct: "Mars",
  };
  const preview = validateImportRows([
    { rowNumber: 2, data: base },
    { rowNumber: 3, data: { ...base, category: "Space" } },
  ]);
  assert.equal(preview.summary.errorCount, 1);
  assert.ok(preview.rows[1].errors[0].includes("must be consistent"));
});

test("rejects a correct answer that does not match an option", () => {
  const preview = validateImportRows([
    {
      quiz_title: "Science",
      category: "Science",
      difficulty: "Easy",
      question: "Which planet is red?",
      type: "MCQ",
      option_a: "Venus",
      option_b: "Earth",
      correct: "Mars",
    },
  ]);
  assert.ok(preview.rows[0].errors.includes("correct answer must match one of the options"));
});

test("accepts multi-select answers separated by a pipe", () => {
  const preview = validateImportRows([
    {
      quiz_title: "Science",
      category: "Science",
      difficulty: "Hard",
      question: "Which are planets?",
      type: "MULTI_SELECT",
      option_a: "Mars",
      option_b: "Venus",
      option_c: "Moon",
      correct: "Mars|Venus",
    },
  ]);
  assert.equal(preview.summary.validCount, 1);
  assert.equal(preview.rows[0].data.type, "MULTI_SELECT");
});

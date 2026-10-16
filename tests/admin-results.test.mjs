import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSummarizeAttempts } from "../src/lib/admin-results.mjs";

const attempts = [
  { id: "1", quiz_id: "quiz-a", student_id: "student-1", score: 90, passed: true, started_at: "2026-10-14T09:30:00Z", profiles: { full_name: "Ari Lee", email: "ari@example.com" } },
  { id: "2", quiz_id: "quiz-a", student_id: "student-2", score: 40, passed: false, started_at: "2026-10-15T10:00:00Z", profiles: { full_name: "Sam Doe", email: "sam@example.com" } },
  { id: "3", quiz_id: "quiz-b", student_id: "student-1", score: null, passed: null, started_at: "2026-10-15T12:00:00Z", profiles: { full_name: "Ari Lee", email: "ari@example.com" } },
];

test("filters attempts by student name, email, or ID without case sensitivity", () => {
  assert.deepEqual(filterAndSummarizeAttempts(attempts, { student: "ARI" }).shown.map((x) => x.id), ["1", "3"]);
  assert.deepEqual(filterAndSummarizeAttempts(attempts, { student: "student-2" }).shown.map((x) => x.id), ["2"]);
});

test("combines quiz, outcome, and inclusive date filters", () => {
  const result = filterAndSummarizeAttempts(attempts, {
    quizId: "quiz-a",
    outcome: "passed",
    from: "2026-10-14",
    to: "2026-10-14",
  });
  assert.deepEqual(result.shown.map((x) => x.id), ["1"]);
});

test("summarizes completed attempts and excludes in-progress attempts", () => {
  const result = filterAndSummarizeAttempts(attempts);
  assert.equal(result.average, "65.0");
  assert.equal(result.passRate, "50%");
  assert.equal(result.shown.length, 3);
});

test("returns empty summaries when no attempts match", () => {
  const result = filterAndSummarizeAttempts(attempts, { quizId: "missing" });
  assert.deepEqual(result.shown, []);
  assert.equal(result.average, "—");
  assert.equal(result.passRate, "—");
});
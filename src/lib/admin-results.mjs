export function filterAndSummarizeAttempts(rows, filters = {}) {
  const query = (filters.student || "").trim().toLowerCase();
  const shown = rows.filter((attempt) => {
    if (filters.quizId && attempt.quiz_id !== filters.quizId) return false;
    if (query) {
      const studentText = `${attempt.student_id || ""} ${attempt.profiles?.full_name || ""} ${attempt.profiles?.email || ""}`.toLowerCase();
      if (!studentText.includes(query)) return false;
    }
    if (filters.from && attempt.started_at < `${filters.from}T00:00:00`) return false;
    if (filters.to && attempt.started_at > `${filters.to}T23:59:59`) return false;
    if (filters.outcome === "passed" && attempt.passed !== true) return false;
    if (filters.outcome === "failed" && attempt.passed !== false) return false;
    if (filters.outcome === "pending" && attempt.score != null) return false;
    return true;
  });
  const completed = shown.filter((attempt) => attempt.score != null);
  const passed = completed.filter((attempt) => attempt.passed === true).length;
  return {
    shown,
    average: completed.length
      ? (completed.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / completed.length).toFixed(1)
      : "—",
    passRate: completed.length ? `${Math.round((passed / completed.length) * 100)}%` : "—",
  };
}
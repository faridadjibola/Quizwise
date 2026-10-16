export type AdminAttempt = {
  id: string;
  quiz_id: string;
  student_id: string;
  score: number | null;
  passed: boolean | null;
  started_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};
export type AttemptFilters = {
  quizId?: string;
  student?: string;
  from?: string;
  to?: string;
  outcome?: "all" | "passed" | "failed" | "pending";
};
export function filterAndSummarizeAttempts<T extends AdminAttempt>(
  rows: T[],
  filters?: AttemptFilters,
): { shown: T[]; average: string; passRate: string };
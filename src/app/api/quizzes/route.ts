import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  search: z.string().trim().max(200).default(""),
  category: z.string().trim().max(100).default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  sort: z.enum(["newest", "popular"]).default("newest"),
});

type ListedQuiz = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  estimated_minutes: number;
  time_limit_minutes: number;
  created_at: string;
  quiz_questions: { count: number }[];
  attempts_count: number;
  best_score: number | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      search: url.searchParams.get("search") ?? "",
      category: url.searchParams.get("category") ?? "",
      difficulty: url.searchParams.get("difficulty") || undefined,
      sort: url.searchParams.get("sort") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quiz filters." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = await createClient();
    const { data, error } = await db
      .from("quizzes")
      .select(
        "id,title,description,category,difficulty,estimated_minutes,time_limit_minutes,created_at,quiz_questions(count)",
      )
      .eq("is_published", true)
      .eq("status", "PUBLISHED")
      .or(`publish_at.is.null,publish_at.lte.${now}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const quizzes = (data ?? []) as Omit<ListedQuiz, "attempts_count" | "best_score">[];
    const ids = quizzes.map((quiz) => quiz.id);
    const attemptsCount = new Map<string, number>();
    const bestScores = new Map<string, number>();

    if (ids.length) {
      const admin = createAdminClient();
      const { data: attempts, error: attemptsError } = await admin
        .from("attempts")
        .select("quiz_id")
        .in("quiz_id", ids);
      if (attemptsError) throw attemptsError;

      for (const attempt of attempts ?? []) {
        attemptsCount.set(attempt.quiz_id, (attemptsCount.get(attempt.quiz_id) ?? 0) + 1);
      }

      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError) throw authError;

      if (user) {
        const { data: scores, error: scoresError } = await db
          .from("attempts")
          .select("quiz_id,score")
          .eq("student_id", user.id)
          .in("quiz_id", ids)
          .in("status", ["submitted", "timed_out"])
          .not("score", "is", null);
        if (scoresError) throw scoresError;

        for (const attempt of scores ?? []) {
          const score = Number(attempt.score);
          bestScores.set(
            attempt.quiz_id,
            Math.max(bestScores.get(attempt.quiz_id) ?? Number.NEGATIVE_INFINITY, score),
          );
        }
      }
    }

    const normalizedSearch = parsed.data.search.toLocaleLowerCase();
    let results: ListedQuiz[] = quizzes
      .filter((quiz) => {
        const matchesSearch =
          !normalizedSearch ||
          `${quiz.title} ${quiz.description} ${quiz.category}`
            .toLocaleLowerCase()
            .includes(normalizedSearch);
        const matchesCategory =
          !parsed.data.category || quiz.category === parsed.data.category;
        const matchesDifficulty =
          !parsed.data.difficulty || quiz.difficulty === parsed.data.difficulty;
        return matchesSearch && matchesCategory && matchesDifficulty;
      })
      .map((quiz) => ({
        ...quiz,
        attempts_count: attemptsCount.get(quiz.id) ?? 0,
        best_score: bestScores.get(quiz.id) ?? null,
      }));

    if (parsed.data.sort === "popular") {
      results = results.sort(
        (a, b) =>
          b.attempts_count - a.attempts_count ||
          Date.parse(b.created_at) - Date.parse(a.created_at),
      );
    }

    return NextResponse.json({
      quizzes: results,
      categories: [...new Set(quizzes.map((quiz) => quiz.category))].sort((a, b) =>
        a.localeCompare(b),
      ),
      totalPublished: quizzes.length,
    });
  } catch (error) {
    console.error("Quiz list request failed", error);
    return NextResponse.json({ error: "Could not load quizzes." }, { status: 500 });
  }
}

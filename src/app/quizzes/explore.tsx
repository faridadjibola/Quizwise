"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Quiz = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  estimated_minutes: number;
  time_limit_minutes: number;
  quiz_questions: { count: number }[];
  best_score: number | null;
};

type QuizResponse = {
  quizzes: Quiz[];
  categories: string[];
  totalPublished: number;
};

const difficultyStyles: Record<Quiz["difficulty"], string> = {
  easy: "bg-emerald-50 text-emerald-800",
  medium: "bg-amber-50 text-amber-800",
  hard: "bg-rose-50 text-rose-800",
};

export default function ExploreQuizzes({
  initialSearch,
  initialCategory,
  initialDifficulty,
  initialSort,
}: {
  initialSearch: string;
  initialCategory: string;
  initialDifficulty: string;
  initialSort: "newest" | "popular";
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [sort, setSort] = useState(initialSort);
  const [data, setData] = useState<QuizResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      if (difficulty) params.set("difficulty", difficulty);
      if (sort !== "newest") params.set("sort", sort);

      const query = params.toString();
      router.replace(`/quizzes${query ? `?${query}` : ""}`, { scroll: false });

      try {
        const response = await fetch(`/api/quizzes${query ? `?${query}` : ""}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as QuizResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load quizzes.");
        setData(body);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load quizzes.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, category, difficulty, sort, retryCount, router]);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setDifficulty("");
    setSort("newest");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex justify-between">
          <Link href="/" className="text-xl font-bold">
            Quizwise
          </Link>
          <nav aria-label="Main navigation" className="flex gap-5">
            <Link href="/history">My results</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>

        <section className="mt-14" aria-labelledby="explore-heading">
          <p className="text-sm uppercase tracking-widest text-teal-700">
            Practice at your pace
          </p>
          <h1 id="explore-heading" className="mt-2 text-4xl font-semibold">
            Explore quizzes
          </h1>

          <form
            className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,auto))]"
            onSubmit={(event) => event.preventDefault()}
          >
            <div>
              <label className="sr-only" htmlFor="quiz-search">
                Search quizzes
              </label>
              <input
                id="quiz-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search quizzes..."
                className="w-full rounded-xl border bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="quiz-category">
                Filter by category
              </label>
              <select
                id="quiz-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <option value="">All categories</option>
                {(data?.categories ?? []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="sr-only" htmlFor="quiz-difficulty">
                Filter by difficulty
              </label>
              <select
                id="quiz-difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
                className="w-full rounded-xl border bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <option value="">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="sr-only" htmlFor="quiz-sort">
                Sort quizzes
              </label>
              <select
                id="quiz-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as "newest" | "popular")}
                className="w-full rounded-xl border bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <option value="newest">Newest</option>
                <option value="popular">Popular</option>
              </select>
            </div>
          </form>

          <div className="mt-8" aria-live="polite" aria-busy={loading}>
            {loading ? (
              <div
                className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
                aria-label="Loading quizzes"
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="h-56 animate-pulse rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="mt-5 h-6 w-3/4 rounded bg-slate-200" />
                    <div className="mt-4 h-4 w-full rounded bg-slate-100" />
                    <div className="mt-8 h-9 w-28 rounded-xl bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div role="alert" className="rounded-2xl bg-white p-8 text-rose-800">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryCount((current) => current + 1)}
                  className="mt-4 rounded-xl border border-rose-200 px-4 py-2"
                >
                  Try again
                </button>
              </div>
            ) : data?.totalPublished === 0 ? (
              <p className="rounded-2xl bg-white p-8 text-slate-600">
                No quizzes yet. Check back soon.
              </p>
            ) : !data?.quizzes.length ? (
              <div className="rounded-2xl bg-white p-8 text-slate-600">
                <p>No matches</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {data.quizzes.map((quiz) => (
                  <article
                    key={quiz.id}
                    className="flex flex-col rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-teal-700">{quiz.category}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${difficultyStyles[quiz.difficulty]}`}
                      >
                        {quiz.difficulty}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold">{quiz.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {quiz.description}
                    </p>
                    <p className="mt-5 text-xs text-slate-500">
                      {quiz.quiz_questions[0]?.count ?? 0} questions
                      {" · "}
                      {quiz.estimated_minutes} min
                      {" · "}
                      {quiz.time_limit_minutes} min limit
                    </p>
                    {quiz.best_score !== null && (
                      <p className="mt-2 text-sm font-medium text-teal-800">
                        Your best: {quiz.best_score}%
                      </p>
                    )}
                    <Link
                      href={`/quiz/${quiz.id}`}
                      className="mt-5 inline-block self-start rounded-xl bg-teal-700 px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      Start quiz
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

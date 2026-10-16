import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function History() {
  const { user } = await requireRole("student");
  const db = await createClient();
  const { data, error } = await db
    .from("attempts")
    .select("id,score,passed,started_at,status,quizzes(title,category)")
    .eq("student_id", user.id)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("History load failed", error.message);
    throw new Error("Could not load your quiz history.");
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/quizzes" className="text-teal-700">
        &larr; Quizzes
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Your results</h1>
      <div className="mt-6 space-y-3">
        {(data ?? []).map((attempt) => {
          const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
          return (
            <article
              key={attempt.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5"
            >
              <div>
                <h2 className="font-semibold">{quiz?.title ?? "Quiz"}</h2>
                <p className="text-sm text-slate-500">
                  {new Date(attempt.started_at).toLocaleString()} &middot; {attempt.status}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={attempt.passed ? "text-emerald-700" : "text-rose-700"}>
                  {attempt.score == null ? "In progress" : `${attempt.score}%`}
                </span>
                {(attempt.status === "submitted" || attempt.status === "timed_out") && (
                  <Link href={`/result/${attempt.id}`} className="text-sm text-teal-700">
                    Review &rarr;
                  </Link>
                )}
              </div>
            </article>
          );
        })}
        {!data?.length && (
          <p className="rounded-2xl bg-white p-6 text-slate-500">
            You haven&apos;t taken a quiz yet.
          </p>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type JoinedQuestion = {
  id: string;
  text: string;
  correct_answer: string;
  explanation: string;
};

type AnswerRow = {
  question_id: string;
  answer: string | null;
  is_correct: boolean | null;
  questions: JoinedQuestion | JoinedQuestion[] | null;
};

export const dynamic = "force-dynamic";

export default async function Result({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireRole("student");
  const db = createAdminClient();
  const { data: attempt, error: attemptError } = await db
    .from("attempts")
    .select("id,quiz_id,student_id,started_at,submitted_at,score,passed,status")
    .eq("id", id)
    .eq("student_id", user.id)
    .in("status", ["submitted", "timed_out"])
    .maybeSingle();

  if (attemptError) {
    console.error("Result lookup failed", attemptError.message);
    throw new Error("Could not load this quiz result.");
  }
  if (!attempt?.submitted_at) notFound();

  const [{ data: quiz, error: quizError }, { data: answers, error: answersError }] =
    await Promise.all([
      db.from("quizzes").select("title").eq("id", attempt.quiz_id).maybeSingle(),
      db
        .from("attempt_answers")
        .select("question_id,answer,is_correct,questions(id,text,correct_answer,explanation)")
        .eq("attempt_id", attempt.id),
    ]);

  if (quizError || answersError) {
    console.error("Result details lookup failed", quizError?.message ?? answersError?.message);
    throw new Error("Could not load this quiz result.");
  }

  const review = ((answers ?? []) as AnswerRow[]).flatMap((row) => {
    const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    return question
      ? [
          {
            id: row.question_id,
            text: question.text,
            answer: row.answer,
            correctAnswer: question.correct_answer,
            explanation: question.explanation,
            isCorrect: row.is_correct ?? false,
          },
        ]
      : [];
  });
  const elapsed = Math.max(
    0,
    Math.floor((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 60_000),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/quizzes" className="text-teal-700">
        &larr; Quizzes
      </Link>
      <section className="mt-6 rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-widest text-slate-500">Quiz complete</p>
        <h1 className="mt-2 text-4xl font-semibold">{attempt.score ?? 0}%</h1>
        <p className={`mt-2 font-medium ${attempt.passed ? "text-emerald-700" : "text-rose-700"}`}>
          {attempt.passed ? "Passed" : "Not passed"}
        </p>
        <p className="mt-2 text-slate-500">{quiz?.title ?? "Quiz"}</p>
        <p className="mt-1 text-slate-500">
          {attempt.status === "timed_out" ? "Time expired" : `Time taken: ${elapsed} min`}
        </p>
      </section>
      <h2 className="mt-8 text-xl font-semibold">Review answers</h2>
      <div className="mt-4 space-y-4">
        {review.map((question, index) => (
          <section key={question.id} className="rounded-2xl bg-white p-6">
            <p className="text-xs text-slate-500">Question {index + 1}</p>
            <h3 className="mt-2 font-semibold">{question.text}</h3>
            <p className="mt-4">
              Your answer:{" "}
              <strong className={question.isCorrect ? "text-emerald-700" : "text-rose-700"}>
                {question.answer || "No answer"}
              </strong>
            </p>
            <p>
              Correct answer: <strong>{question.correctAnswer}</strong>
            </p>
            <p className="mt-3 text-slate-600">{question.explanation}</p>
          </section>
        ))}
      </div>
      <Link href="/history" className="mt-8 inline-block text-teal-700">
        See your history &rarr;
      </Link>
    </main>
  );
}

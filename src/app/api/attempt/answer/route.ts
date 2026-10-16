import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/api-auth";

const schema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: z.string().max(1000).nullable(),
  flagged: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid answer." }, { status: 400 });
    }

    const context = await requireActiveStudent();
    if ("response" in context) return context.response;

    const { user, db } = context;
    const { attemptId, questionId, answer, flagged } = parsed.data;
    const { data: attempt, error: attemptError } = await db
      .from("attempts")
      .select("id,status,student_id,quiz_id,started_at,quizzes(time_limit_minutes)")
      .eq("id", attemptId)
      .single();

    if (attemptError || attempt?.student_id !== user.id || attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Attempt is unavailable." }, { status: 403 });
    }

    const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
    const deadline =
      new Date(attempt.started_at).getTime() + Number(quiz?.time_limit_minutes) * 60_000;
    if (!quiz || Date.now() >= deadline) {
      return NextResponse.json({ error: "The time limit for this attempt has expired." }, { status: 409 });
    }

    const { data: assignment, error: assignmentError } = await db
      .from("quiz_questions")
      .select("question_id")
      .eq("quiz_id", attempt.quiz_id)
      .eq("question_id", questionId)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) {
      return NextResponse.json({ error: "Question is not part of this quiz." }, { status: 400 });
    }

    const { error: saveError } = await db.from("attempt_answers").upsert({
      attempt_id: attemptId,
      question_id: questionId,
      answer,
      flagged,
      answered_at: new Date().toISOString(),
    });
    if (saveError) throw saveError;

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Answer save failed", error);
    return NextResponse.json({ error: "Could not save your answer." }, { status: 500 });
  }
}

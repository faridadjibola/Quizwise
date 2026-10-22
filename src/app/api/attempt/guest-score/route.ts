import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  quizId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().max(1000).nullable(),
      flagged: z.boolean().default(false),
    }),
  ).max(500),
});

type QuizQuestion = {
  id: string;
  correct_answer: string;
  explanation: string;
  text: string;
  options: string[];
};

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quiz answers." }, { status: 400 });
    }

    const db = createAdminClient();
    const now = new Date().toISOString();
    const { data: quiz, error: quizError } = await db
      .from("quizzes")
      .select("id,pass_mark")
      .eq("id", parsed.data.quizId)
      .eq("is_published", true)
      .eq("status", "PUBLISHED")
      .or(`publish_at.is.null,publish_at.lte.${now}`)
      .maybeSingle();
    if (quizError) throw quizError;
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found or unpublished." }, { status: 404 });
    }

    const { data: rows, error: questionsError } = await db
      .from("quiz_questions")
      .select("points,questions(id,correct_answer,explanation,text,options)")
      .eq("quiz_id", quiz.id);
    if (questionsError) throw questionsError;
    if (!rows?.length) {
      return NextResponse.json({ error: "This quiz has no questions." }, { status: 409 });
    }

    const answers = new Map<string, { answer: string | null; flagged: boolean }>();
    const questionById = new Map(
      rows.map((row) => {
        const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
        return [question.id, question as QuizQuestion];
      }),
    );
    for (const item of parsed.data.answers) {
      if (answers.has(item.questionId)) {
        return NextResponse.json({ error: "Duplicate answers are not allowed." }, { status: 400 });
      }
      const question = questionById.get(item.questionId);
      if (!question || (item.answer !== null && !question.options.includes(item.answer))) {
        return NextResponse.json({ error: "An answer is invalid for this quiz." }, { status: 400 });
      }
      answers.set(item.questionId, { answer: item.answer, flagged: item.flagged });
    }

    let points = 0;
    let totalPoints = 0;
    for (const row of rows) {
      const question = (Array.isArray(row.questions) ? row.questions[0] : row.questions) as QuizQuestion;
      const submitted = answers.get(question.id);
      const answer = submitted?.answer ?? null;
      const isCorrect = answer === question.correct_answer;
      totalPoints += Number(row.points);
      if (isCorrect) points += Number(row.points);
    }

    const score = Math.round((points / totalPoints) * 10000) / 100;
    return NextResponse.json({
      score,
      passed: score >= Number(quiz.pass_mark),
    });
  } catch (error) {
    console.error("Guest quiz scoring failed", error);
    return NextResponse.json({ error: "Could not calculate your quiz score." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/api-auth";

const schema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().max(1000).nullable(),
      flagged: z.boolean().default(false),
    }),
  ).max(500).optional(),
});

type QuizQuestion = {
  id: string;
  correct_answer: string;
  explanation: string;
  text: string;
  options: string[];
};

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid attempt." }, { status: 400 });
    }

    const context = await requireActiveStudent();
    if ("response" in context) return context.response;

    const { user, db } = context;
    const { data: attempt, error: attemptError } = await db
      .from("attempts")
      .select("id,student_id,quiz_id,status,started_at,quizzes(pass_mark,time_limit_minutes)")
      .eq("id", parsed.data.attemptId)
      .single();

    if (attemptError || attempt?.student_id !== user.id) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Attempt was already submitted." }, { status: 409 });
    }

    const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
    if (!quiz) {
      return NextResponse.json({ error: "Quiz is unavailable." }, { status: 404 });
    }

    const { data: rows, error: questionsError } = await db
      .from("quiz_questions")
      .select("points,questions(id,correct_answer,explanation,text,options)")
      .eq("quiz_id", attempt.quiz_id);
    if (questionsError) throw questionsError;
    if (!rows?.length) {
      return NextResponse.json({ error: "This quiz has no questions." }, { status: 409 });
    }

    const answersByQuestion = new Map<
      string,
      { answer: string | null; flagged: boolean }
    >();
    if (parsed.data.answers) {
      const assignedQuestions = new Map(
        rows.map((row) => {
          const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
          return [question.id, question.options as string[]];
        }),
      );
      for (const answer of parsed.data.answers) {
        const options = assignedQuestions.get(answer.questionId);
        if (!options || (answer.answer !== null && !options.includes(answer.answer))) {
          return NextResponse.json({ error: "An answer is invalid for this quiz." }, { status: 400 });
        }
        if (answersByQuestion.has(answer.questionId)) {
          return NextResponse.json({ error: "Duplicate answers are not allowed." }, { status: 400 });
        }
        answersByQuestion.set(answer.questionId, {
          answer: answer.answer,
          flagged: answer.flagged,
        });
      }
    } else {
      const { data: answers, error: answersError } = await db
        .from("attempt_answers")
        .select("question_id,answer,flagged")
        .eq("attempt_id", attempt.id);
      if (answersError) throw answersError;
      for (const answer of answers ?? []) {
        answersByQuestion.set(answer.question_id, {
          answer: answer.answer,
          flagged: answer.flagged,
        });
      }
    }
    let points = 0;
    let total = 0;
    const review = rows.map((row) => {
      const question = (Array.isArray(row.questions) ? row.questions[0] : row.questions) as QuizQuestion;
      const submittedAnswer = answersByQuestion.get(question.id);
      const answer = submittedAnswer?.answer ?? null;
      const isCorrect = answer === question.correct_answer;
      total += Number(row.points);
      if (isCorrect) points += Number(row.points);

      return {
        questionId: question.id,
        text: question.text,
        options: question.options,
        answer,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        isCorrect,
        flagged: submittedAnswer?.flagged ?? false,
      };
    });

    const score = Math.round((points / total) * 10000) / 100;
    const timedOut =
      Date.now() - new Date(attempt.started_at).getTime() >= Number(quiz.time_limit_minutes) * 60_000;
    const status = timedOut ? "timed_out" : "submitted";
    const submittedAt = new Date().toISOString();
    const correctAnswers = review.map((item) => ({
      attempt_id: attempt.id,
      question_id: item.questionId,
      answer: item.answer,
      is_correct: item.isCorrect,
      flagged: item.flagged,
      answered_at: submittedAt,
    }));
    const { error: persistAnswersError } = await db.from("attempt_answers").upsert(correctAnswers);
    if (persistAnswersError) throw persistAnswersError;

    const { data: updatedAttempt, error: updateError } = await db
      .from("attempts")
      .update({
        submitted_at: submittedAt,
        score,
        total_points: total,
        passed: score >= Number(quiz.pass_mark),
        status,
      })
      .eq("id", attempt.id)
      .eq("status", "in_progress")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedAttempt) {
      return NextResponse.json({ error: "Attempt was already submitted." }, { status: 409 });
    }

    return NextResponse.json({
      attemptId: attempt.id,
      score,
      totalPoints: total,
      passed: score >= Number(quiz.pass_mark),
      status,
      startedAt: attempt.started_at,
      submittedAt,
      review,
    });
  } catch (error) {
    console.error("Score submission failed", error);
    return NextResponse.json(
      { error: "Could not submit the quiz. Please retry." },
      { status: 500 },
    );
  }
}

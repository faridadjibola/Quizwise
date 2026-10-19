import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImportRows } from "@/lib/quiz-import.mjs";

const requestSchema = z.object({
  rows: z.array(z.object({ rowNumber: z.number().int().positive(), data: z.record(z.string(), z.string()) })).min(1).max(1000),
});

type ImportedQuestion = {
  quiz_title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  type: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT";
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  explanation: string;
};

export async function POST(request: Request) {
  let db: ReturnType<typeof createAdminClient> | undefined;
  const createdQuizIds: string[] = [];
  const createdQuestionIds: string[] = [];

  try {
    const context = await requireAdminApi();
    if ("response" in context) return context.response;
    db = context.db;

    const body = requestSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: "Provide valid preview rows to import." }, { status: 400 });
    }

    const preview = validateImportRows(body.data.rows);
    if (preview.summary.errorCount || !preview.summary.validCount) {
      return NextResponse.json(
        { error: "Fix or skip invalid rows before importing.", preview },
        { status: 400 },
      );
    }

    const questions = preview.rows.map((row) => row.data as ImportedQuestion);
    const groups = new Map<string, ImportedQuestion[]>();
    for (const question of questions) {
      const key = question.quiz_title.trim().toLocaleLowerCase();
      const group = groups.get(key) ?? [];
      group.push(question);
      groups.set(key, group);
    }

    const insertedQuizzes: { id: string; title: string; questionCount: number }[] = [];
    for (const group of groups.values()) {
      const first = group[0];
      const { data: quiz, error: quizError } = await db
        .from("quizzes")
        .insert({
          title: first.quiz_title.trim(),
          description: `Imported quiz with ${group.length} questions.`,
          category: first.category.trim(),
          difficulty: first.difficulty,
          estimated_minutes: Math.max(1, Math.ceil(group.length * 1.5)),
          time_limit_minutes: Math.max(5, Math.ceil(group.length * 1.5)),
          pass_mark: 60,
          attempts_allowed: 3,
          shuffle_questions: false,
          shuffle_options: false,
          is_published: false,
          status: "DRAFT",
          publish_at: null,
          created_by: context.user.id,
        })
        .select("id,title")
        .single();
      if (quizError) throw quizError;
      createdQuizIds.push(quiz.id);

      const { error: draftError } = await db
        .from("quizzes")
        .update({ is_published: false, status: "DRAFT", publish_at: null })
        .eq("id", quiz.id);
      if (draftError) throw draftError;

      const questionRows = group.map((question) => {
        const options =
          question.type === "TRUE_FALSE"
            ? ["True", "False"]
            : [question.option_a, question.option_b, question.option_c, question.option_d].filter(Boolean);
        return {
          text: question.question,
          type:
            question.type === "TRUE_FALSE"
              ? "true_false"
              : question.type === "MULTI_SELECT"
                ? "multi_select"
                : "multiple_choice",
          options,
          correct_answer: question.correct,
          explanation: question.explanation,
          difficulty: question.difficulty,
          category: question.category.trim(),
          created_by: context.user.id,
        };
      });
      const { data: insertedQuestions, error: questionError } = await db
        .from("questions")
        .insert(questionRows)
        .select("id");
      if (questionError) throw questionError;
      createdQuestionIds.push(...(insertedQuestions ?? []).map((question) => question.id));

      const assignments = (insertedQuestions ?? []).map((question, index) => ({
        quiz_id: quiz.id,
        question_id: question.id,
        position: index,
        points: 1,
      }));
      const { error: assignmentError } = await db.from("quiz_questions").insert(assignments);
      if (assignmentError) throw assignmentError;

      insertedQuizzes.push({
        id: quiz.id,
        title: quiz.title,
        questionCount: group.length,
      });
    }

    return NextResponse.json({ imported: insertedQuizzes }, { status: 201 });
  } catch (error) {
    if (db) {
      if (createdQuizIds.length) {
        const { error: rollbackError } = await db.from("quizzes").delete().in("id", createdQuizIds);
        if (rollbackError) console.error("Quiz import rollback failed", rollbackError);
      }
      if (createdQuestionIds.length) {
        const { error: rollbackError } = await db.from("questions").delete().in("id", createdQuestionIds);
        if (rollbackError) console.error("Question import rollback failed", rollbackError);
      }
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Quiz import failed", error);
    return NextResponse.json({ error: "Could not import the quiz rows." }, { status: 500 });
  }
}

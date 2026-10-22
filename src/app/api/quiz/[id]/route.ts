import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const now = new Date().toISOString();
    const { data: quiz, error } = await createAdminClient()
      .from("quizzes")
      .select(
        "id,title,description,category,difficulty,estimated_minutes,time_limit_minutes,pass_mark,shuffle_questions,shuffle_options,quiz_questions(position,points,questions(id,text,image_path,type,options))",
      )
      .eq("id", id)
      .eq("is_published", true)
      .eq("status", "PUBLISHED")
      .or(`publish_at.is.null,publish_at.lte.${now}`)
      .single();

    if (error || !quiz) {
      if (error) console.error("Quiz fetch failed", error.message);
      return NextResponse.json({ error: "Quiz not found or unpublished." }, { status: 404 });
    }

    let items = (
      quiz.quiz_questions as unknown as {
        position: number;
        points: number;
        questions: { id: string; text: string; image_path: string | null; type: string; options: string[] };
      }[]
    )
      .map((item) => ({ ...item.questions, position: item.position, points: item.points }))
      .sort((a, b) => a.position - b.position);

    if (quiz.shuffle_questions) items = items.sort(() => Math.random() - 0.5);
    if (quiz.shuffle_options) {
      items = items.map((question) => ({
        ...question,
        options: [...question.options].sort(() => Math.random() - 0.5),
      }));
    }

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        difficulty: quiz.difficulty,
        estimated_minutes: quiz.estimated_minutes,
        time_limit_minutes: quiz.time_limit_minutes,
        pass_mark: quiz.pass_mark,
      },
      questions: items,
    });
  } catch (error) {
    console.error("Quiz endpoint failed", error);
    return NextResponse.json({ error: "Could not load quiz." }, { status: 500 });
  }
}

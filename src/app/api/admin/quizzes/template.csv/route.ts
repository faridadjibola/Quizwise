import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";

const template = [
  "quiz_title,category,difficulty,question,type,option_a,option_b,option_c,option_d,correct,explanation",
  'Everyday Science,Science,Easy,"Which planet is known as the Red Planet?",MCQ,Venus,Mars,Jupiter,Mercury,Mars,"Iron oxide gives Mars its reddish appearance."',
].join("\r\n");

export async function GET() {
  try {
    const context = await requireAdminApi();
    if ("response" in context) return context.response;
    return new NextResponse(template, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="quiz-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Quiz template download failed", error);
    return NextResponse.json({ error: "Could not download the template." }, { status: 500 });
  }
}

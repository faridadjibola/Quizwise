import { NextResponse } from "next/server";
import { MAX_IMPORT_BYTES, parseQuizImport } from "@/lib/quiz-import.mjs";
import { requireAdminApi } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await requireAdminApi();
    if ("response" in context) return context.response;

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMPORT_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "File exceeds the 5 MB upload limit." }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a quiz file to upload." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "File exceeds the 5 MB upload limit." }, { status: 413 });
    }

    const preview = await parseQuizImport(
      file.name,
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unsupported file type.")) {
      return NextResponse.json({ error: error.message }, { status: 415 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("does not contain a worksheet") ||
        error.message.includes("not valid JSON") ||
        error.message.includes("must contain an array") ||
        error.message.includes("contains no quiz question") ||
        error.message.includes("question limit") ||
        error.message.includes("zip") ||
        error.message.includes("file signature"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Quiz upload preview failed", error);
    return NextResponse.json({ error: "Could not read the quiz file." }, { status: 500 });
  }
}

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import QuizUpload from "./upload";

export default async function QuizUploadPage() {
  await requireRole("admin");

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/admin/quizzes" className="text-teal-700">
        &larr; Quiz management
      </Link>
      <h1 className="my-6 text-3xl font-semibold">Upload quizzes</h1>
      <p className="mb-6 max-w-3xl text-slate-600">
        Upload CSV, XLSX, or JSON quiz rows. Preview and fix or skip invalid questions before
        importing them as drafts. Nothing is saved during preview.
      </p>
      <QuizUpload />
    </main>
  );
}

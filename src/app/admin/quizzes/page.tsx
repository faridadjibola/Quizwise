import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { QuizManager } from "../managers";

export default async function Page() {
  await requireRole("admin");

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/admin" className="text-teal-700">
        &larr; Dashboard
      </Link>
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Quizzes</h1>
        <Link
          href="/admin/quizzes/upload"
          className="rounded-xl bg-teal-700 px-4 py-3 font-medium text-white"
        >
          Upload quizzes
        </Link>
      </div>
      <QuizManager />
    </main>
  );
}

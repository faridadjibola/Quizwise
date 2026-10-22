import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">403 · Access denied</p>
        <h1 className="mt-4 text-3xl font-semibold">Admins only</h1>
        <p className="mt-3 text-slate-600">
          This area is available to active Quizwise administrators. If you think you should have access, contact an administrator.
        </p>
        <Link
          href="/quizzes"
          className="mt-6 inline-block rounded-full bg-teal-700 px-5 py-3 font-medium text-white"
        >
          Back to quizzes
        </Link>
      </section>
    </main>
  );
}

import Link from "next/link";
import { AccountMenu } from "../account-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/admin" className="text-xl font-bold">
          Quizwise <span className="text-sm font-normal text-slate-500">/ Admin</span>
        </Link>
        <nav aria-label="Admin navigation" className="flex items-center gap-5">
          <Link href="/quizzes" className="text-sm text-teal-700">Student view</Link>
          <AccountMenu />
        </nav>
      </header>
      {children}
    </>
  );
}

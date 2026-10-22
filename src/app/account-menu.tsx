"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./providers";
import { GoogleSignInButton } from "./google-sign-in";

export function AccountMenu() {
  const { user, loading, error: authError, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logout();
      router.replace("/quizzes");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <span className="text-sm text-slate-500" aria-live="polite">Loading account…</span>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-end gap-1">
        <GoogleSignInButton onLogin={() => router.refresh()} width={180} />
        <Link href={`/login?next=${encodeURIComponent(pathname || "/quizzes")}`} className="text-xs text-teal-700">
          Other sign-in options
        </Link>
        {authError && <span role="status" className="text-xs text-amber-800">{authError}</span>}
      </div>
    );
  }

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={28}
            height={28}
            unoptimized
            className="size-7 rounded-full"
          />
        ) : (
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-36 truncate text-sm font-medium">{user.name}</span>
      </summary>
      <nav
        aria-label="Account"
        className="absolute right-0 z-20 mt-2 min-w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
      >
        <p className="truncate px-3 py-2 text-xs text-slate-500">{user.email}</p>
        <Link href="/history" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
          My results
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
            Admin
          </Link>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void signOut()}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
        {error && <p role="alert" className="px-3 py-2 text-xs text-red-700">{error}</p>}
      </nav>
    </details>
  );
}

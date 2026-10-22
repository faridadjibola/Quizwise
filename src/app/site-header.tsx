"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { useAuth } from "./providers";

const headerLinkClass =
  "inline-flex h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-900 active:bg-teal-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 4);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const authActions = user ? (
    <AccountMenu />
  ) : loading ? (
    <span aria-live="polite" className="text-sm text-slate-500">Loading account…</span>
  ) : (
    <>
      <Link href="/login" className={secondaryButtonClass}>Sign in</Link>
      <Link href="/signup" className={primaryButtonClass}>Create account</Link>
    </>
  );

  return (
    <header
      className={`sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur transition-shadow ${
        scrolled ? "shadow-sm" : "shadow-none"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 rounded-lg text-xl font-bold tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          onClick={() => setMenuOpen(false)}
        >
          Quizwise
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          <Link href="/quizzes" className={headerLinkClass}>Quizzes</Link>
          <Link href="/#how-it-works" className={headerLinkClass}>How it works</Link>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {authActions}
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-lg text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 md:hidden"
        >
          {menuOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            <Link href="/quizzes" className={headerLinkClass} onClick={() => setMenuOpen(false)}>
              Quizzes
            </Link>
            <Link href="/#how-it-works" className={headerLinkClass} onClick={() => setMenuOpen(false)}>
              How it works
            </Link>
            {user ? (
              <div className="border-t border-slate-200 pt-3">
                <AccountMenu />
              </div>
            ) : loading ? (
              <p aria-live="polite" className="px-3 py-2 text-sm text-slate-500">Loading account…</p>
            ) : (
              <div className="mt-2 grid gap-2 border-t border-slate-200 pt-4">
                <Link
                  href="/login"
                  className={`${secondaryButtonClass} w-full`}
                  onClick={() => setMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className={`${primaryButtonClass} w-full`}
                  onClick={() => setMenuOpen(false)}
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

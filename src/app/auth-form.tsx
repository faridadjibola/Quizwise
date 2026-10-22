"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "./google-sign-in";
import { useAuth } from "./providers";
import type { AuthUser } from "@/lib/auth-user";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();
  const returnTo = (role?: AuthUser["role"]) => {
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
      return next;
    }
    return role === "admin" ? "/admin" : "/quizzes";
  };

  function finishSignIn(user?: AuthUser | null) {
    router.replace(returnTo(user?.role));
    router.refresh();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!email.includes("@") || password.length < 8) {
      setError("Enter a valid email and a password with at least 8 characters.");
      setBusy(false);
      return;
    }

    try {
      const supabase = createClient();
      if (mode === "signup") {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: String(form.get("name") || "").trim() } },
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          setError("Check your email to confirm your account, then sign in.");
        } else {
          await refreshUser();
          router.push("/quizzes");
        }
        return;
      }

      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (!result.data.user) {
        setError("Unable to verify your account. Please try signing in again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", result.data.user.id)
        .single();
      if (profileError || !profile) {
        console.error("Profile lookup failed", profileError?.message);
        setError("Unable to load your account profile. Please try again.");
      } else if (!profile.is_active) {
        setError("Your account is inactive. Please contact an administrator.");
      } else {
        const currentUser = await refreshUser();
        finishSignIn(currentUser);
      }
    } catch (cause) {
      console.error("Authentication failed", cause);
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <Link href="/" className="text-lg font-bold">
          Quizwise
        </Link>
        <h1 className="mt-10 text-3xl font-semibold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-slate-500">
          {mode === "login"
            ? "Sign in to continue your learning."
            : "Join to practice and track your progress."}
        </p>
        <div className="mt-6">
          <GoogleSignInButton onLogin={finishSignIn} />
          <p className="mt-5 text-center text-sm text-slate-500">or continue with email</p>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <label className="block text-sm">
              Full name
              <input
                name="name"
                required
                className="mt-1 w-full rounded-xl border p-3"
                autoComplete="name"
              />
            </label>
          )}
          <label className="block text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-xl border p-3"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border p-3"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full rounded-xl bg-teal-700 p-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        {mode === "login" && <Reset />}
        <p className="mt-6 text-sm text-slate-500">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <Link
            className="font-medium text-teal-700"
            href={mode === "login" ? "/signup" : "/login"}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}

function Reset() {
  const [message, setMessage] = useState("");

  async function reset() {
    const email = prompt("Enter your account email");
    if (!email) return;

    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/login`,
      });
      if (error) throw error;
      setMessage("If the email exists, a password reset link has been sent.");
    } catch (cause) {
      console.error("Password reset request failed", cause);
      setMessage(cause instanceof Error ? cause.message : "Could not send a password reset email.");
    }
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={reset} className="text-sm text-teal-700">
        Forgot password?
      </button>
      {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
    </div>
  );
}

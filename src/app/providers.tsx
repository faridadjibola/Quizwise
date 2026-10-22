"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import type { AuthUser } from "@/lib/auth-user";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string;
  login: (credential: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshUser = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (response.status === 401) {
      setUser(null);
      return null;
    }
    if (!response.ok) throw new Error(await readError(response, "Could not verify your session."));

    const body = (await response.json()) as { user: AuthUser };
    setUser(body.user);
    return body.user;
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) {
          throw new Error(await readError(response, "Could not verify your session."));
        }
        const body = (await response.json()) as { user: AuthUser };
        return body.user;
      })
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not verify your session.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const login = useCallback(async (credential: string) => {
    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!response.ok) throw new Error(await readError(response, "Google sign-in failed."));

    const body = (await response.json()) as { user: AuthUser };
    setError("");
    setUser(body.user);
    return body.user;
  }, []);

  const logout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error(await readError(response, "Could not sign out."));
    setUser(null);
    setError("");
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refreshUser }),
    [user, loading, error, login, logout, refreshUser],
  );

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "google-client-id-not-configured";
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

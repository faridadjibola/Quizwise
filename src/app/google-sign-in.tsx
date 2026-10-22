"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import type { AuthUser } from "@/lib/auth-user";
import { useAuth } from "./providers";

export function GoogleSignInButton({
  onLogin,
  width = 280,
}: {
  onLogin?: (user: AuthUser) => void;
  width?: number;
}) {
  const { login } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <p className="text-sm text-slate-600">
        Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable it.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div aria-busy={busy}>
        <GoogleLogin
          onSuccess={async (response) => {
            if (!response.credential) {
              setMessage("Google did not return a sign-in credential. Please try again.");
              return;
            }
            setBusy(true);
            setMessage("");
            try {
              const user = await login(response.credential);
              onLogin?.(user);
            } catch (cause) {
              setMessage(cause instanceof Error ? cause.message : "Google sign-in failed. Please retry.");
            } finally {
              setBusy(false);
            }
          }}
          onError={() =>
            setMessage("Sign-in was cancelled or interrupted. Check popup settings and try again.")
          }
          text="continue_with"
          shape="pill"
          theme="outline"
          width={String(width)}
        />
      </div>
      {busy && <p role="status" className="text-sm text-slate-600">Signing in…</p>}
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </div>
  );
}

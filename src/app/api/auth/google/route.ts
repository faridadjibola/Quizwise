import { NextResponse } from "next/server";
import { z } from "zod";
import { toAuthUser } from "@/lib/auth-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  credential: z.string().trim().min(1).max(8192),
});

const noStore = { "Cache-Control": "no-store" };

function stringClaim(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: noStore });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A Google credential is required." }, { status: 400, headers: noStore });
  }

  try {
    const auth = await createClient();
    const { data, error } = await auth.auth.signInWithIdToken({
      provider: "google",
      token: parsed.data.credential,
    });

    if (error || !data.user) {
      if (error) console.error("Google authentication failed", error.message);
      return NextResponse.json({ error: "Google sign-in could not be verified." }, { status: 401, headers: noStore });
    }

    const identity = data.user.identities?.find((item) => item.provider === "google");
    const emailVerified = identity?.identity_data?.email_verified === true;
    const googleId = stringClaim(identity?.identity_data?.sub) ?? identity?.id ?? null;
    const email = stringClaim(data.user.email);

    if (!identity || !emailVerified || !googleId || !email) {
      await auth.auth.signOut();
      return NextResponse.json({ error: "A verified Google account is required." }, { status: 401, headers: noStore });
    }

    const metadata = data.user.user_metadata;
    const name =
      stringClaim(metadata.full_name) ??
      stringClaim(metadata.name) ??
      email;
    const avatarUrl =
      stringClaim(metadata.avatar_url) ??
      stringClaim(metadata.picture);
    const adminEmails = new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((item) => item.trim().toLocaleLowerCase())
        .filter(Boolean),
    );

    const db = createAdminClient();
    const profileUpdate = {
      id: data.user.id,
      google_id: googleId,
      email,
      full_name: name,
      avatar_url: avatarUrl,
      last_login_at: new Date().toISOString(),
      ...(adminEmails.has(email.toLocaleLowerCase()) ? { role: "admin" as const } : {}),
    };
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .upsert(profileUpdate, { onConflict: "id" })
      .select("id,google_id,email,full_name,avatar_url,role,is_active")
      .single();

    if (profileError || !profile) {
      if (profileError) console.error("Google profile sync failed", profileError.message);
      await auth.auth.signOut();
      return NextResponse.json({ error: "Your account profile could not be loaded." }, { status: 500, headers: noStore });
    }
    if (!profile.is_active) {
      await auth.auth.signOut();
      return NextResponse.json({ error: "Your account is inactive. Please contact an administrator." }, { status: 403, headers: noStore });
    }

    return NextResponse.json({ user: toAuthUser(profile) }, { headers: noStore });
  } catch (error) {
    console.error("Google sign-in request failed", error);
    return NextResponse.json({ error: "Google sign-in is temporarily unavailable." }, { status: 500, headers: noStore });
  }
}

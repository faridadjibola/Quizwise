import { NextResponse } from "next/server";
import { toAuthUser } from "@/lib/auth-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const auth = await createClient();
    const { data, error } = await auth.auth.getUser();
    if (error) {
      console.error("Auth session lookup failed", error.message);
      return NextResponse.json(
        { error: "Unable to verify your session." },
        { status: error.status === 401 ? 401 : 503, headers: noStore },
      );
    }
    if (!data.user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStore });
    }

    const db = createAdminClient();
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,email,full_name,role,is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: "Active account required." }, { status: 403, headers: noStore });
    }

    const adminEmails = new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((item) => item.trim().toLocaleLowerCase())
        .filter(Boolean),
    );
    if (
      adminEmails.has(profile.email.toLocaleLowerCase()) &&
      profile.role !== "admin"
    ) {
      const { data: promoted, error: promotionError } = await db
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", profile.id)
        .select("id,email,full_name,role,is_active")
        .single();
      if (promotionError) throw promotionError;
      return NextResponse.json({ user: toAuthUser(promoted) }, { headers: noStore });
    }

    return NextResponse.json({ user: toAuthUser(profile) }, { headers: noStore });
  } catch (error) {
    console.error("Current user lookup failed", error);
    return NextResponse.json({ error: "Could not load your account." }, { status: 500, headers: noStore });
  }
}

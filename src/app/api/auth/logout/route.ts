import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const auth = await createClient();
    const { error } = await auth.auth.signOut();
    if (error) throw error;

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Sign-out failed", error);
    return NextResponse.json(
      { error: "Could not sign out. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function currentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) console.error("Auth lookup failed", error.message);
  return user;
}

export async function requireRole(role: "admin" | "student") {
  const user = await currentUser();
  if (!user) {
    const destination = role === "admin" ? "/admin" : "/history";
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_active,full_name")
    .eq("id", user.id)
    .single();

  if (error || !profile?.is_active) {
    console.error("Profile lookup failed or account inactive", error?.message);
    redirect("/login");
  }
  if (profile.role !== role) {
    redirect(role === "admin" ? "/forbidden?required=admin" : "/admin");
  }
  return { user, profile };
}

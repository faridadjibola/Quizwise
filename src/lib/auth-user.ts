export type AuthUser = {
  id: string;
  googleId: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "student";
  isActive: boolean;
};

type Profile = {
  id: string;
  google_id?: string | null;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: "admin" | "student";
  is_active: boolean;
};

export function toAuthUser(profile: Profile): AuthUser {
  return {
    id: profile.id,
    googleId: profile.google_id ?? null,
    email: profile.email,
    name: profile.full_name,
    avatarUrl: profile.avatar_url ?? null,
    role: profile.role,
    isActive: profile.is_active,
  };
}

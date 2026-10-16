import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function requireActiveStudent(){
  const auth=await createClient();
  const {data:{user},error:authError}=await auth.auth.getUser();
  if(authError||!user)return {response:NextResponse.json({error:"Sign in required."},{status:401})};

  const db=createAdminClient();
  const {data:profile,error}=await db.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
  if(error)throw error;
  if(!profile?.is_active||profile.role!=="student")return {response:NextResponse.json({error:"An active student account is required."},{status:403})};

  return {user,db};
}
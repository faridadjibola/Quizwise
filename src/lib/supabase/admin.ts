import { createClient as makeClient } from "@supabase/supabase-js";
export function createAdminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase service role environment variable is missing");return makeClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})}

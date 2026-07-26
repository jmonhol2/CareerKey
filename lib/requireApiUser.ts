import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type AuthenticatedUserResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

export async function requireApiUser(req: Request): Promise<AuthenticatedUserResult> {
  const authorization = req.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!accessToken) {
    return {
      user: null,
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }),
    };
  }

  return { user, error: null };
}

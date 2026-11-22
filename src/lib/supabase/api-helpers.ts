import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      data: null,
      error: { code, message },
    },
    { status }
  );
}

export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      unauthorizedResponse: apiError("UNAUTHORIZED", "Please sign in first.", 401),
    };
  }

  return { supabase, user, unauthorizedResponse: null };
}

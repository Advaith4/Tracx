import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "UNAUTHORIZED", message: "Please sign in first." },
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const { data: existing, error: fetchError } = await supabase
    .from("tracking_configs")
    .select("id, metric_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Tracking metric not found." },
      },
      { status: 404 }
    );
  }

  if (existing.metric_type !== "custom") {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "FORBIDDEN",
          message: "Default metrics can be disabled, not deleted.",
        },
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("tracking_configs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "DELETE_FAILED",
          message: "Couldn't delete custom metric.",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { id }, error: null });
}

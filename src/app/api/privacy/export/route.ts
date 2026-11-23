import { NextResponse } from "next/server";
import { exportUserHealthData } from "@/features/privacy/service";
import { apiError, requireApiUser } from "@/lib/supabase/api-helpers";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (!user) return unauthorizedResponse;

  try {
    const bundle = await exportUserHealthData(
      supabase,
      user.id,
      user.email ?? null
    );
    const dateStamp = bundle.exportedAt.slice(0, 10);

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="tracx-health-export-${dateStamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to prepare your data export.";
    return apiError("EXPORT_FAILED", message, 500);
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      const schemaMissing =
        error.code === "PGRST205" ||
        error.message.toLowerCase().includes("could not find the table");

      return NextResponse.json(
        {
          data: {
            supabaseReachable: true,
            schemaApplied: !schemaMissing,
            status: schemaMissing ? "migration_pending" : "query_error",
          },
          error: schemaMissing
            ? null
            : {
                code: error.code ?? "SUPABASE_ERROR",
                message: "Unable to verify database table access.",
              },
        },
        { status: schemaMissing ? 200 : 503 }
      );
    }

    return NextResponse.json({
      data: {
        supabaseReachable: true,
        schemaApplied: true,
        status: "ok",
      },
      error: null,
    });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "HEALTH_CHECK_FAILED",
          message: "Supabase connection check failed.",
        },
      },
      { status: 500 }
    );
  }
}

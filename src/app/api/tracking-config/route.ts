import { NextResponse } from "next/server";
import {
  createCustomMetricSchema,
  updateTrackingConfigSchema,
} from "@/features/tracking-config/schemas";
import {
  ensureAndListTrackingConfigs,
  sortTrackingConfigs,
} from "@/features/tracking-config/service";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function GET() {
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

  try {
    const configs = await ensureAndListTrackingConfigs(supabase, user.id);
    return NextResponse.json({ data: configs, error: null });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "FETCH_FAILED",
          message: "Couldn't load tracking configuration.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = createCustomMetricSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message ??
            "The submitted custom metric is invalid.",
        },
      },
      { status: 400 }
    );
  }

  const values = parsed.data;
  const { data, error } = await supabase
    .from("tracking_configs")
    .insert({
      user_id: user.id,
      metric_type: "custom",
      custom_label: values.custom_label,
      enabled: true,
      unit: values.unit,
      show_on_dashboard: values.show_on_dashboard,
      include_in_reports: values.include_in_reports,
      schedule: values.schedule as unknown as Json,
      provider_targets: (values.provider_targets ?? null) as Json | null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "CREATE_FAILED",
          message: "Couldn't create custom tracking metric.",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PUT(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = updateTrackingConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message ??
            "The submitted configuration is invalid.",
        },
      },
      { status: 400 }
    );
  }

  const values = parsed.data;
  const { data, error } = await supabase
    .from("tracking_configs")
    .update({
      custom_label: values.custom_label ?? null,
      enabled: values.enabled,
      unit: values.unit,
      show_on_dashboard: values.show_on_dashboard,
      include_in_reports: values.include_in_reports,
      schedule: values.schedule as unknown as Json,
      provider_targets: (values.provider_targets ?? null) as Json | null,
    })
    .eq("id", values.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "UPDATE_FAILED",
          message: "Couldn't save tracking configuration.",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: sortTrackingConfigs([data])[0],
    error: null,
  });
}

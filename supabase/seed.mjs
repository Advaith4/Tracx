/**
 * Idempotent development seed script for Tracx.
 * Usage:
 *   npm run seed
 *   node supabase/seed.mjs --email user@example.com
 *   node supabase/seed.mjs --reset
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found. Configure Supabase credentials first.");
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function parseArgs(argv) {
  let email = null;
  let reset = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) {
      email = argv[i + 1].trim().toLowerCase();
      i += 1;
    } else if (argv[i] === "--reset") {
      reset = true;
    }
  }
  return { email, reset };
}

function getLocalDateStr(date, timeZone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function makeIsoForDay(daysAgo, hhmm, timeZone = "Asia/Kolkata") {
  const baseDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const dateStr = getLocalDateStr(baseDate, timeZone);
  const offset = timeZone === "Asia/Kolkata" ? "+05:30" : "Z";
  return new Date(`${dateStr}T${hhmm}:00${offset}`).toISOString();
}

function computeStats(values) {
  if (values.length === 0) {
    return { count: 0, average: null, min: null, max: null, latest: null, change: null };
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    count: values.length,
    average: Number((sum / values.length).toFixed(1)),
    min: Math.min(...values),
    max: Math.max(...values),
    latest: values[values.length - 1],
    change:
      values.length >= 2
        ? Number((values[values.length - 1] - values[0]).toFixed(1))
        : null,
  };
}

async function main() {
  loadEnvLocal();
  const { email: targetEmail, reset } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersRes, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr || !usersRes?.users?.length) {
    throw new Error(
      usersErr?.message || "No authenticated users found. Sign up in the app first."
    );
  }

  const user = targetEmail
    ? usersRes.users.find((u) => u.email?.toLowerCase() === targetEmail)
    : usersRes.users[0];

  if (!user) {
    throw new Error(`No user found matching --email ${targetEmail}.`);
  }

  console.log(`Seeding sample data for ${user.email} (${user.id})...`);

  const timezone = "Asia/Kolkata";

  // 1. Update profile defaults gently if unset/UTC
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.from("profiles").upsert({
    id: user.id,
    display_name: existingProfile?.display_name || "Advaith G",
    timezone:
      !existingProfile?.timezone || existingProfile.timezone === "UTC"
        ? timezone
        : existingProfile.timezone,
    locale: existingProfile?.locale || "en",
    pregnancy_week: existingProfile?.pregnancy_week ?? 26,
    provider_name: existingProfile?.provider_name || "Dr. Meera Nair",
    provider_contact:
      existingProfile?.provider_contact || "City Women's Wellness Clinic",
    personal_notes:
      existingProfile?.personal_notes ||
      "Logging fasting and 1-hour post-meal blood glucose readings.",
  });

  const effectiveTz =
    !existingProfile?.timezone || existingProfile.timezone === "UTC"
      ? timezone
      : existingProfile.timezone;

  // 2. Ensure tracking configs exist (keep existing ones)
  let { data: configs } = await supabase
    .from("tracking_configs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!configs || configs.length === 0) {
    const starterConfigs = [
      {
        user_id: user.id,
        metric_type: "glucose",
        custom_label: null,
        enabled: true,
        unit: "mg/dL",
        show_on_dashboard: true,
        include_in_reports: true,
        schedule: {
          contexts: ["Fasting", "After breakfast", "After lunch", "After dinner"],
          slots: [
            { id: "fasting", context: "Fasting", time: "07:30", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: null },
            { id: "after-breakfast", context: "After breakfast", time: "09:30", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: 60 },
            { id: "after-lunch", context: "After lunch", time: "13:30", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: 60 },
            { id: "after-dinner", context: "After dinner", time: "20:30", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: 60 },
          ],
        },
      },
      {
        user_id: user.id,
        metric_type: "blood_pressure",
        custom_label: null,
        enabled: true,
        unit: "mmHg",
        show_on_dashboard: true,
        include_in_reports: true,
        schedule: {
          contexts: ["Morning"],
          slots: [
            { id: "bp-morning", context: "Morning", time: "08:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: null },
          ],
        },
      },
      {
        user_id: user.id,
        metric_type: "weight",
        custom_label: null,
        enabled: true,
        unit: "kg",
        show_on_dashboard: true,
        include_in_reports: true,
        schedule: {
          contexts: ["Morning"],
          slots: [
            { id: "weight-morning", context: "Morning", time: "07:45", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: null },
          ],
        },
      },
    ];
    const { data: insertedConfigs } = await supabase
      .from("tracking_configs")
      .insert(starterConfigs)
      .select("*");
    configs = insertedConfigs ?? [];
  }

  let heartRateConfig = configs.find(
    (c) => c.metric_type === "custom" && c.enabled
  );
  if (!heartRateConfig) {
    const { data: createdCustom } = await supabase
      .from("tracking_configs")
      .insert({
        user_id: user.id,
        metric_type: "custom",
        custom_label: "Heart Rate",
        enabled: true,
        unit: "bpm",
        show_on_dashboard: true,
        include_in_reports: true,
        schedule: {
          contexts: ["Daily"],
          slots: [
            { id: "hr-daily", context: "Daily", time: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], postMealMinutes: null },
          ],
        },
      })
      .select("*")
      .single();
    heartRateConfig = createdCustom;
  }

  // 3. Check if data already exists unless --reset
  const { count: existingGlucoseCount } = await supabase
    .from("glucose_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((existingGlucoseCount ?? 0) > 0 && !reset) {
    console.log(
      `User already has ${existingGlucoseCount} glucose records. Run "node supabase/seed.mjs --reset" to replace with fresh sample data.`
    );
    return;
  }

  if (reset) {
    await Promise.all([
      supabase.from("glucose_records").delete().eq("user_id", user.id),
      supabase.from("blood_pressure_records").delete().eq("user_id", user.id),
      supabase.from("weight_records").delete().eq("user_id", user.id),
      supabase.from("custom_metric_records").delete().eq("user_id", user.id),
      supabase.from("measurement_skips").delete().eq("user_id", user.id),
      supabase.from("daily_notes").delete().eq("user_id", user.id),
      supabase.from("notification_logs").delete().eq("user_id", user.id),
      supabase.from("reminders").delete().eq("user_id", user.id),
      supabase.from("weekly_reports").delete().eq("user_id", user.id),
    ]);
  }

  // 4. Generate 14 days of realistic measurement history ending today (day 0)
  const fastingSeries = [91, 89, 93, 90, 88, 92, 94, 89, 91, 87, 92, 90, 93, 91];
  const breakfastSeries = [122, 118, 126, 121, 116, 129, 124, 119, 125, 115, 128, 120, 127, 122];
  const lunchSeries = [127, 124, 132, 121, 135, 126, 129, 118, 131, 125, 128, 123, 130];
  const dinnerSeries = [119, 122, 115, 126, 118, 124, 121, 117, 128, 120, 116, 123, 119];
  const bpPairs = [
    [116, 74, 74], [118, 76, 72], [114, 72, 75], [120, 78, 76], [116, 74, 71],
    [115, 73, 73], [119, 75, 77], [113, 72, 70], [118, 76, 74], [117, 75, 72],
    [121, 77, 76], [115, 73, 73], [117, 74, 75], [116, 74, 72],
  ];
  const weightSeries = [
    64.2, 64.1, 64.1, 64.0, 64.0, 63.9, 63.9, 63.8, 63.8, 63.7, 63.7, 63.6, 63.5, 63.5,
  ];
  const hrSeries = [74, 72, 76, 73, 75, 71, 74, 73, 77, 72, 75, 74, 72];

  const glucoseRows = [];
  const bpRows = [];
  const weightRows = [];
  const customRows = [];

  for (let d = 0; d < 14; d++) {
    // Today (d === 0): Fasting & After breakfast recorded; leave After lunch due & After dinner upcoming
    glucoseRows.push({
      user_id: user.id,
      value: fastingSeries[d],
      unit: "mg/dL",
      measured_at: makeIsoForDay(d, "07:35", effectiveTz),
      meal_context: "fasting",
      timing: "unknown",
      elapsed_minutes: null,
      notes: d === 0 ? "Felt rested on waking" : null,
      source: d % 2 === 0 ? "voice" : "manual",
    });

    glucoseRows.push({
      user_id: user.id,
      value: breakfastSeries[d],
      unit: "mg/dL",
      measured_at: makeIsoForDay(d, "09:35", effectiveTz),
      meal_context: "breakfast",
      timing: "after",
      elapsed_minutes: 60,
      notes: d === 0 ? "Oats with chia seeds and berries" : d === 2 ? "Whole wheat toast & eggs" : null,
      source: d % 3 === 0 ? "voice" : "manual",
    });

    if (d >= 1) {
      glucoseRows.push({
        user_id: user.id,
        value: lunchSeries[d - 1],
        unit: "mg/dL",
        measured_at: makeIsoForDay(d, "13:35", effectiveTz),
        meal_context: "lunch",
        timing: "after",
        elapsed_minutes: 60,
        notes: d === 1 ? "Dal, brown rice & greens" : null,
        source: d % 2 === 1 ? "voice" : "manual",
      });

      if (d !== 3) {
        glucoseRows.push({
          user_id: user.id,
          value: dinnerSeries[d - 1],
          unit: "mg/dL",
          measured_at: makeIsoForDay(d, "20:35", effectiveTz),
          meal_context: "dinner",
          timing: "after",
          elapsed_minutes: 60,
          notes: d === 1 ? "20-minute evening walk before check" : null,
          source: "voice",
        });
      }
    }

    const [sys, dia, pulse] = bpPairs[d];
    bpRows.push({
      user_id: user.id,
      systolic: sys,
      diastolic: dia,
      pulse,
      measured_at: makeIsoForDay(d, "08:05", effectiveTz),
      notes: d === 0 ? "Measured seated after 5 mins rest" : null,
      source: d % 2 === 0 ? "manual" : "voice",
    });

    weightRows.push({
      user_id: user.id,
      value: weightSeries[d],
      unit: "kg",
      measured_at: makeIsoForDay(d, "07:48", effectiveTz),
      notes: null,
      source: "manual",
    });

    if (d >= 1 && heartRateConfig) {
      customRows.push({
        user_id: user.id,
        metric_config_id: heartRateConfig.id,
        value_numeric: hrSeries[d - 1],
        value_text: null,
        unit: "bpm",
        measured_at: makeIsoForDay(d, "09:05", effectiveTz),
        notes: "Resting morning pulse",
        source: "manual",
      });
    }
  }

  await supabase.from("glucose_records").insert(glucoseRows);
  await supabase.from("blood_pressure_records").insert(bpRows);
  await supabase.from("weight_records").insert(weightRows);
  if (customRows.length > 0) {
    await supabase.from("custom_metric_records").insert(customRows);
  }

  // 5. Seed past skipped measurement + daily notes
  const skipDate = getLocalDateStr(
    new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    effectiveTz
  );
  await supabase.from("measurement_skips").insert({
    user_id: user.id,
    metric_type: "glucose",
    scheduled_date: skipDate,
    context_label: "After dinner · 60m",
    reason: "Slept early after dinner",
  });

  const noteOffsets = [
    [0, "Felt well rested this morning; 20-minute walk after breakfast."],
    [1, "Balanced meals today; hydration stayed consistent around 2.5L."],
    [2, "Had light vegetable soup for dinner and checked reading 1h post-meal."],
    [4, "Clinic check-in went well; keeping morning walk routine steady."],
    [6, "Slept 8 hours; fasting number felt steady."],
  ];
  await supabase.from("daily_notes").upsert(
    noteOffsets.map(([daysAgo, content]) => ({
      user_id: user.id,
      note_date: getLocalDateStr(
        new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        effectiveTz
      ),
      content,
    })),
    { onConflict: "user_id,note_date" }
  );

  // 6. Seed reminders + notification logs
  const { data: createdReminders } = await supabase
    .from("reminders")
    .insert([
      {
        user_id: user.id,
        metric_type: "glucose",
        label: "Morning Fasting Glucose",
        scheduled_time: "07:30:00",
        timezone: effectiveTz,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        channel: "in_app",
        enabled: true,
        follow_up_minutes: 30,
        snooze_minutes: 15,
        quiet_hours_start: "22:30:00",
        quiet_hours_end: "06:30:00",
      },
      {
        user_id: user.id,
        metric_type: "blood_pressure",
        label: "Morning Blood Pressure",
        scheduled_time: "08:00:00",
        timezone: effectiveTz,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        channel: "in_app",
        enabled: true,
        follow_up_minutes: 45,
        snooze_minutes: 15,
        quiet_hours_start: "22:30:00",
        quiet_hours_end: "06:30:00",
      },
      {
        user_id: user.id,
        metric_type: "glucose",
        label: "After-Dinner Glucose",
        scheduled_time: "20:30:00",
        timezone: effectiveTz,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        channel: "in_app",
        enabled: true,
        follow_up_minutes: 30,
        snooze_minutes: 15,
        quiet_hours_start: "22:30:00",
        quiet_hours_end: "06:30:00",
      },
    ])
    .select("*");

  if (createdReminders?.length) {
    await supabase.from("notification_logs").insert([
      {
        user_id: user.id,
        reminder_id: createdReminders[2]?.id ?? createdReminders[0].id,
        scheduled_for: makeIsoForDay(0, "13:30", effectiveTz),
        sent_at: makeIsoForDay(0, "13:31", effectiveTz),
        read_at: null,
        channel: "in_app",
        status: "sent",
      },
      {
        user_id: user.id,
        reminder_id: createdReminders[0].id,
        scheduled_for: makeIsoForDay(0, "07:30", effectiveTz),
        sent_at: makeIsoForDay(0, "07:30", effectiveTz),
        read_at: makeIsoForDay(0, "07:36", effectiveTz),
        channel: "in_app",
        status: "sent",
      },
    ]);
  }

  // 7. Seed a complete Weekly Report covering the past 7 days
  const periodEnd = getLocalDateStr(new Date(), effectiveTz);
  const periodStart = getLocalDateStr(
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    effectiveTz
  );
  const emptyStats = computeStats([]);

  const weekFasting = fastingSeries.slice(0, 7).reverse();
  const weekBreakfast = breakfastSeries.slice(0, 7).reverse();
  const weekLunch = lunchSeries.slice(0, 6).reverse();
  const weekDinner = dinnerSeries.slice(0, 5).reverse();
  const weekSys = bpPairs.slice(0, 7).map((p) => p[0]).reverse();
  const weekDia = bpPairs.slice(0, 7).map((p) => p[1]).reverse();
  const weekPulse = bpPairs.slice(0, 7).map((p) => p[2]).reverse();
  const weekWeights = weightSeries.slice(0, 7).reverse();

  const reportStats = {
    periodStart,
    periodEnd,
    timezone: effectiveTz,
    overview: {
      totalScheduled: 49,
      totalRecorded: 43,
      totalSkipped: 1,
      missingCount: 5,
      completionPercent: 88,
    },
    glucose: {
      unit: "mg/dL",
      totalCount:
        weekFasting.length +
        weekBreakfast.length +
        weekLunch.length +
        weekDinner.length,
      contexts: [
        { key: "fasting", label: "Fasting", stats: computeStats(weekFasting) },
        { key: "beforeBreakfast", label: "Before Breakfast", stats: emptyStats },
        { key: "afterBreakfast", label: "After Breakfast", stats: computeStats(weekBreakfast) },
        { key: "beforeLunch", label: "Before Lunch", stats: emptyStats },
        { key: "afterLunch", label: "After Lunch", stats: computeStats(weekLunch) },
        { key: "beforeDinner", label: "Before Dinner", stats: emptyStats },
        { key: "afterDinner", label: "After Dinner", stats: computeStats(weekDinner) },
      ],
    },
    bloodPressure: {
      count: weekSys.length,
      systolic: computeStats(weekSys),
      diastolic: computeStats(weekDia),
      pulse: computeStats(weekPulse),
      readings: bpRows.slice(0, 7).map((r) => ({
        measuredAtLabel: r.measured_at.slice(0, 10),
        value: `${r.systolic}/${r.diastolic} mmHg`,
      })),
    },
    weight: {
      unit: "kg",
      stats: computeStats(weekWeights),
      readings: weightRows.slice(0, 7).map((r) => ({
        measuredAtLabel: r.measured_at.slice(0, 10),
        value: `${r.value} kg`,
      })),
    },
    notes: noteOffsets
      .filter(([daysAgo]) => daysAgo <= 6)
      .map(([daysAgo, content]) => ({
        noteDate: getLocalDateStr(
          new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          effectiveTz
        ),
        content,
      })),
    dataLimitations: [
      "Personal tracking summary compiled from self-recorded measurements.",
      "Before-meal glucose readings were not scheduled during this period.",
    ],
  };

  const narrative = {
    summaryParagraph: `Between ${periodStart} and ${periodEnd}, you logged 43 measurements across blood glucose, blood pressure, weight, and heart rate with 88% overall schedule adherence.`,
    observations: [
      `Fasting blood glucose averaged ${reportStats.glucose.contexts[0].stats.average} mg/dL (range ${reportStats.glucose.contexts[0].stats.min}–${reportStats.glucose.contexts[0].stats.max} mg/dL).`,
      `1-hour post-meal averages were ${reportStats.glucose.contexts[2].stats.average} mg/dL after breakfast, ${reportStats.glucose.contexts[4].stats.average} mg/dL after lunch, and ${reportStats.glucose.contexts[6].stats.average} mg/dL after dinner.`,
      `Morning blood pressure averaged ${reportStats.bloodPressure.systolic.average}/${reportStats.bloodPressure.diastolic.average} mmHg across ${reportStats.bloodPressure.count} readings.`,
      `Weight stayed steady between ${reportStats.weight.stats.min} kg and ${reportStats.weight.stats.max} kg.`,
    ],
    providerQuestions: [
      "Do my current fasting and 1-hour post-meal reading ranges align with the targets you recommended?",
      "Are there any additional meal timings or metrics I should track before my next visit?",
    ],
  };

  await supabase.from("weekly_reports").insert({
    user_id: user.id,
    period_start: periodStart,
    period_end: periodEnd,
    statistics: reportStats,
    summary: narrative.summaryParagraph,
    report_data: { narrative, usedAi: false },
    generated_at: new Date().toISOString(),
    status: "complete",
  });

  console.log(
    `Seeded successfully: ${glucoseRows.length} glucose, ${bpRows.length} BP, ${weightRows.length} weight, ${customRows.length} custom, ${noteOffsets.length} notes, ${createdReminders?.length ?? 0} reminders, 1 weekly report.`
  );
}

main().catch((err) => {
  console.error("Seed error:", err.message || err);
  process.exit(1);
});

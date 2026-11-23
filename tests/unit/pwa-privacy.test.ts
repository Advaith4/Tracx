import { describe, expect, it } from "vitest";
import {
  buildPrivacyExportPayload,
  accountDeleteSchema,
  sanitizePushSubscriptionForExport,
} from "@/features/privacy/service";
import { parseOfflineDrafts } from "@/lib/offline/draft-queue";

describe("PWA offline draft queue & privacy controls", () => {
  it("parses valid offline draft arrays and rejects corrupt entries", () => {
    const validRaw = JSON.stringify([
      {
        id: "draft-1",
        userId: "user-123",
        metricType: "glucose",
        endpoint: "/api/measurements/glucose",
        summary: "98 mg/dL (Fasting)",
        measuredAt: "2026-11-23T08:00:00.000Z",
        createdAt: "2026-11-23T08:00:05.000Z",
        payload: { value: 98, unit: "mg/dL" },
        status: "pending",
      },
      { invalid: true },
      null,
    ]);

    const parsed = parseOfflineDrafts(validRaw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].summary).toBe("98 mg/dL (Fasting)");
    expect(parseOfflineDrafts("{not json")).toEqual([]);
    expect(parseOfflineDrafts(null)).toEqual([]);
  });

  it("strips sensitive push encryption keys from privacy data exports", () => {
    const sub = {
      id: "sub-1",
      user_id: "user-123",
      endpoint: "https://fcm.googleapis.com/secret-token",
      p256dh: "secret-p256dh-key",
      auth: "secret-auth-key",
      device_label: "Mobile Safari",
      created_at: "2026-11-20T00:00:00.000Z",
      last_used_at: "2026-11-21T00:00:00.000Z",
      revoked_at: null,
    };

    const sanitized = sanitizePushSubscriptionForExport(sub);
    expect(sanitized).toEqual({
      id: "sub-1",
      device_label: "Mobile Safari",
      created_at: "2026-11-20T00:00:00.000Z",
      last_used_at: "2026-11-21T00:00:00.000Z",
      revoked_at: null,
    });
    expect("p256dh" in sanitized).toBe(false);
    expect("auth" in sanitized).toBe(false);
    expect("endpoint" in sanitized).toBe(false);

    const payload = buildPrivacyExportPayload({
      exportedAt: "2026-11-23T08:00:00.000Z",
      userId: "user-123",
      email: "user@example.com",
      profile: null,
      trackingConfigs: [],
      glucose: [],
      bloodPressure: [],
      weight: [],
      custom: [],
      skips: [],
      dailyNotes: [],
      reminders: [],
      notificationLogs: [],
      pushSubscriptions: [sub],
      weeklyReports: [],
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.account).toEqual({
      id: "user-123",
      email: "user@example.com",
    });
    expect(payload.pushSubscriptions).toHaveLength(1);
  });

  it("requires exact DELETE confirmation for account deletion", () => {
    expect(accountDeleteSchema.safeParse({ confirmation: "DELETE" }).success).toBe(
      true
    );
    expect(accountDeleteSchema.safeParse({ confirmation: "delete" }).success).toBe(
      false
    );
    expect(accountDeleteSchema.safeParse({ confirmation: "" }).success).toBe(
      false
    );
  });
});

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const userRequestTimestamps = new Map<string, number[]>();

export function checkAiRateLimit(
  userId: string,
  nowMs = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const existing = userRequestTimestamps.get(userId) ?? [];
  const recent = existing.filter((ts) => nowMs - ts < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((RATE_LIMIT_WINDOW_MS - (nowMs - oldest)) / 1000)
    );
    userRequestTimestamps.set(userId, recent);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(nowMs);
  userRequestTimestamps.set(userId, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

const URGENT_SYMPTOM_PATTERNS = [
  /\bchest pain\b/i,
  /\bshortness of breath\b/i,
  /\bcan'?t breathe\b/i,
  /\bsevere headache\b/i,
  /\bblurred vision\b/i,
  /\bbleeding\b/i,
  /\bfainting\b/i,
  /\bseizure\b/i,
  /\bemergency\b/i,
];

export function detectUrgentSymptomMention(text: string): boolean {
  return URGENT_SYMPTOM_PATTERNS.some((pattern) => pattern.test(text));
}

export const URGENT_CARE_GUIDANCE =
  "It sounds like you may be describing symptoms that deserve prompt attention from a medical professional. Tracx is a personal tracking tool and cannot evaluate symptoms—please contact your healthcare provider or seek urgent medical care right away if you feel unwell.";

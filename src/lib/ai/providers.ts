import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type SupportedAiProvider = "gemini" | "openai";

export interface ResolvedAiModel {
  configured: true;
  provider: SupportedAiProvider;
  modelId: string;
  model: LanguageModel;
}

export interface UnconfiguredAiModel {
  configured: false;
  reason: string;
}

const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
] as const;

const DEFAULT_OPENAI_MODELS = ["gpt-4o-mini"] as const;

function inferProvider(
  explicitProvider: string | undefined,
  apiKey: string
): SupportedAiProvider {
  const normalized = explicitProvider?.trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "gemini" || normalized === "google") return "gemini";

  if (apiKey.startsWith("sk-")) return "openai";
  return "gemini";
}

export function resolveAiModelCandidates():
  | {
      configured: true;
      provider: SupportedAiProvider;
      candidates: Array<{ modelId: string; model: LanguageModel }>;
    }
  | UnconfiguredAiModel {
  if (typeof window !== "undefined") {
    throw new Error("AI providers must only be accessed on the server.");
  }

  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      reason:
        "AI_PROVIDER_API_KEY is not configured in .env.local yet. You can still log all measurements manually.",
    };
  }

  const provider = inferProvider(process.env.AI_PROVIDER, apiKey);
  const overrideModel = process.env.AI_MODEL?.trim();

  if (provider === "openai") {
    const client = createOpenAI({ apiKey });
    const ids = overrideModel
      ? [overrideModel, ...DEFAULT_OPENAI_MODELS.filter((m) => m !== overrideModel)]
      : [...DEFAULT_OPENAI_MODELS];

    return {
      configured: true,
      provider,
      candidates: ids.map((modelId) => ({ modelId, model: client(modelId) })),
    };
  }

  const client = createGoogleGenerativeAI({ apiKey });
  const ids = overrideModel
    ? [overrideModel, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== overrideModel)]
    : [...DEFAULT_GEMINI_MODELS];

  return {
    configured: true,
    provider,
    candidates: ids.map((modelId) => ({ modelId, model: client(modelId) })),
  };
}

export function resolveAiModel(): ResolvedAiModel | UnconfiguredAiModel {
  const resolved = resolveAiModelCandidates();
  if (!resolved.configured) {
    return resolved;
  }

  const primary = resolved.candidates[0];
  return {
    configured: true,
    provider: resolved.provider,
    modelId: primary.modelId,
    model: primary.model,
  };
}

export async function runWithAiFallback<T>(
  candidates: Array<{ modelId: string; model: LanguageModel }>,
  runner: (model: LanguageModel, modelId: string) => Promise<T>
): Promise<{ result: T; modelId: string }> {
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await runner(candidate.model, candidate.modelId);
      return { result, modelId: candidate.modelId };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All configured AI models failed.");
}

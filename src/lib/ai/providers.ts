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

export function resolveAiModel(): ResolvedAiModel | UnconfiguredAiModel {
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
    const modelId = overrideModel || "gpt-4o-mini";
    const client = createOpenAI({ apiKey });
    return {
      configured: true,
      provider,
      modelId,
      model: client(modelId),
    };
  }

  const modelId = overrideModel || "gemini-2.5-flash";
  const client = createGoogleGenerativeAI({ apiKey });
  return {
    configured: true,
    provider,
    modelId,
    model: client(modelId),
  };
}

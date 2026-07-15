import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// Provider-agnostic. Ollama Cloud, Cerebras and Groq are all OpenAI-compatible,
// so they ride @ai-sdk/openai with a custom baseURL — no extra deps.
//   AI_PROVIDER = ollama (default) | cerebras | groq | openrouter | nvidia
//                 | cloudflare | anthropic | openai
//   AI_MODEL    = model id override (optional)
// If AI_PROVIDER is unset, the first provider with an API key wins, in the
// priority order below.
// ponytail: baseURLs hardcoded to the known cloud endpoints. If one moves,
// it's a one-line fix; not worth a per-provider *_BASE_URL env each.

type Provider = { keyEnv: string; model: string; make: (id: string) => LanguageModel };

const compatible = (baseURL: string, keyEnv: string) => (id: string) =>
  createOpenAI({ baseURL, apiKey: process.env[keyEnv] }).chat(id);

const PROVIDERS: Record<string, Provider> = {
  ollama: {
    keyEnv: "OLLAMA_API_KEY",
    model: "gpt-oss:120b",
    make: compatible("https://ollama.com/v1", "OLLAMA_API_KEY"),
  },
  cerebras: {
    keyEnv: "CEREBRAS_API_KEY",
    model: "gpt-oss-120b",
    make: compatible("https://api.cerebras.ai/v1", "CEREBRAS_API_KEY"),
  },
  groq: {
    keyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
    make: compatible("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
  },
  openrouter: {
    keyEnv: "OPENROUTER_API_KEY",
    // ponytail: :free models on OpenRouter share a pool and 429 under load.
    // Set AI_MODEL to a paid id (e.g. qwen/qwen3-coder) if that bites.
    model: "qwen/qwen3-coder:free",
    make: compatible("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
  },
  nvidia: {
    keyEnv: "NVIDIA_NIM_API_KEY",
    model: "qwen/qwen3-next-80b-a3b-instruct",
    make: compatible("https://integrate.api.nvidia.com/v1", "NVIDIA_NIM_API_KEY"),
  },
  cloudflare: {
    keyEnv: "CLOUDFLARE_API_TOKEN",
    model: "@cf/qwen/qwen2.5-coder-32b-instruct",
    // needs the account id in the path — hence not the static `compatible` helper
    make: (id) =>
      createOpenAI({
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        apiKey: process.env.CLOUDFLARE_API_TOKEN,
      }).chat(id),
  },
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    model: "claude-sonnet-5",
    make: (id) => anthropic(id),
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    model: "gpt-4o",
    make: (id) => openai(id),
  },
};

const PRIORITY = [
  "ollama",
  "cerebras",
  "groq",
  "openrouter",
  "nvidia",
  "cloudflare",
  "anthropic",
  "openai",
];

function pickProvider(): string {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced && PROVIDERS[forced]) return forced;
  return PRIORITY.find((p) => process.env[PROVIDERS[p].keyEnv]) ?? "ollama";
}

export function aiEnabled(): boolean {
  return PRIORITY.some((p) => process.env[PROVIDERS[p].keyEnv]);
}

export function getModel(): LanguageModel {
  const p = PROVIDERS[pickProvider()];
  return p.make(process.env.AI_MODEL ?? p.model);
}

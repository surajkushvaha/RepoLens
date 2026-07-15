import { generateText } from "ai";
import { getModel } from "./model";

export { aiEnabled } from "./model";

/**
 * Central AI entry point. Routes each product feature (summarize, ask, search)
 * to the model with a task-specific system prompt and structured context.
 *
 * The repo-ingestion / graph / RAG context that feeds these is built by later
 * slices. For now the LLM plumbing is real; the callers pass whatever context
 * they have. Each `notImplemented` marks a feature waiting on its slice.
 */

export async function complete(system: string, prompt: string): Promise<string> {
  const { text } = await generateText({ model: getModel(), system, prompt });
  return text;
}

// ponytail: agents live here as functions, not seven files of ceremony.
// Implement each when its slice lands (see deep-research-report.md agents).
export function notImplemented(feature: string): never {
  throw new Error(`${feature}: not implemented yet`);
}

import { generateText, streamText } from "ai";
import { getModel } from "./model";

export { aiEnabled } from "./model";

/**
 * Central AI entry point. Routes each product feature (summarize, ask,
 * architecture, readme) to the model with a task-specific system prompt and the
 * retrieved repo context.
 */

export async function complete(system: string, prompt: string): Promise<string> {
  const { text } = await generateText({ model: getModel(), system, prompt });
  return text;
}

export function streamComplete(system: string, prompt: string) {
  return streamText({ model: getModel(), system, prompt });
}

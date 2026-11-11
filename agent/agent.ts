// agent/agent.ts: Sets the agent to use the OpenRouter Qwen model, with its context size.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export default defineAgent({
  model: openrouter("qwen/qwen3.6-flash"),
  modelContextWindowTokens: 128_000,
});
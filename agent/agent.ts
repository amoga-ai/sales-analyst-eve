// Uses the company LocalAI model for Atomic Chat sessions and keeps OpenRouter for everything else.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";

const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const litellm = createOpenAICompatible({
  name: "litellm",
  baseURL: process.env.LITELLM_BASE_URL!,
  apiKey: process.env.LITELLM_API_KEY,
  transformRequestBody: (body) => ({ ...body, chat_template_kwargs: { enable_thinking: false } }),
});

export default defineAgent({
  model: defineDynamic((ctx) =>
    ctx.session.auth.initiator?.attributes.client === "atomic-chat"
      ? {
          model: litellm("qwen3.8-4b-q4"),
          modelContextWindowTokens: 32_768,
          modelOptions: { providerOptions: { litellm: { chat_template_kwargs: { enable_thinking: false } } } },
        }
      : { model: openrouter("qwen/qwen3.6-flash"), modelContextWindowTokens: 128_000 },
  ),
});
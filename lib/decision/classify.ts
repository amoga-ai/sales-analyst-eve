// Asks OpenRouter the sales-routing question for one message and returns the answer, the time taken, and tokens used.
const QUESTION = "Is this message about sales, revenue, orders, totals, KPIs, top sellers or product performance?";

export async function isSalesReview(message: string) {
  const start = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen/qwen3.6-flash",
      temperature: 0,
      max_tokens: 300,
      reasoning: { enabled: false },
      messages: [
        { role: "system", content: `Answer with exactly one word: yes or no. Question: ${QUESTION}` },
        { role: "user", content: message },
      ],
    }),
  });
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
  const answer = text.startsWith("yes") ? true : text.startsWith("no") ? false : null;
  return { answer, ms: Date.now() - start, tokens: data.usage?.total_tokens ?? 0 };
}
// Lets Atomic Chat talk to the Eve sales agent: one Eve session per chat, with approval prompts answered as yes or no in the chat.
import { defineChannel, GET, POST } from "eve/channels";
import { isSalesReview } from "../../lib/decision/classify";
type ChatPart = { type: string; text?: string };
type ChatMessage = { role: string; content: string | ChatPart[] };
type ChatRequest = { model?: string; stream?: boolean; messages?: ChatMessage[] };
type StreamRecord = {
  $eve?: string;
  progress?: { type: string; data: { delta: string } };
  facts?: { type: string; data?: { request?: { kind?: string; interactionId: string } } }[];
};
type Chat = { sessionId: string; cursor: number; pending?: string };

const MODEL_ID = "eve-sales-analyst";
// Keeps each chat's Eve session, keyed by the chat's first message. Resets when the app redeploys.
const chats = new Map<string, Chat>();
const eveUrl = (path: string) => new URL(path, "http://localhost:3000");

// Checks the Atomic Chat key sent as a Bearer token.
function authorized(request: Request): boolean {
  const key = process.env.ATOMIC_CHAT_KEY;
  return !!key && request.headers.get("authorization") === `Bearer ${key}`;
}

// Reads the text of one chat message, whether it is plain text or a list of parts.
function textOf(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

// Joins the chat history into one message for a new Eve session.
function transcript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role}: ${textOf(m.content)}`).join("\n\n");
}

// Creates a new Eve session with the first message and returns its ID.
async function createSession(request: Request, message: string): Promise<string> {
  const res = await fetch(eveUrl("/eve/v1/session"), {
    method: "POST",
    headers: { Authorization: request.headers.get("authorization") ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const { sessionId } = (await res.json()) as { sessionId: string };
  return sessionId;
}

// Sends a follow-up message or an approval answer to an existing Eve session.
async function postToSession(request: Request, sessionId: string, body: unknown): Promise<void> {
  const res = await fetch(eveUrl(`/eve/v1/session/${sessionId}`), {
    method: "POST",
    headers: { Authorization: request.headers.get("authorization") ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Eve rejected the message: ${res.status}`);
}

// Reads the session's stream from the saved line and yields reply text until the turn ends or asks for approval.
async function* readReply(request: Request, chat: Chat): AsyncGenerator<string> {
  const auth = request.headers.get("authorization") ?? "";
  for (; ;) {
    const res = await fetch(eveUrl(`/eve/v1/session/${chat.sessionId}/stream?startIndex=${chat.cursor}`), {
      headers: { Authorization: auth },
    });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (; ;) {
      const { value, done } = await reader.read();
      if (done) break; // Connection ended: reconnect from the saved line.
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const record = JSON.parse(line) as StreamRecord;
        if (record.$eve) {
          if (record.$eve === "stream.ended") return;
          continue; // Lease markers aren't session events.
        }
        chat.cursor += 1;
        if (record.progress?.type === "content.delta") yield record.progress.data.delta;
        for (const fact of record.facts ?? []) {
          if (fact.type === "interaction.opened" && fact.data?.request?.kind !== "sign-in") {
            chat.pending = fact.data!.request!.interactionId;
            yield "\n\nApproval needed: reply yes to approve or no to deny.";
            return;
          }
          if (fact.type === "turn.settled") return;
        }
      }
    }
  }
}

// Works out what the newest chat message means, sends it to Eve, and yields the reply.
async function* respond(request: Request, messages: ChatMessage[]): AsyncGenerator<string> {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => textOf(m.content));
  const latest = (userTexts.at(-1) ?? "").trim();
  const key = userTexts[0] ?? latest;
  const decision = await isSalesReview(latest);
  console.log("routing", JSON.stringify({ message: latest, ...decision }));

  let chat = chats.get(key);
  if (!chat) {
    const sessionId = await createSession(request, transcript(messages));
    chat = { sessionId, cursor: 0 };
    chats.set(key, chat);
  } else if (chat.pending) {
    const answer = latest.toLowerCase();
    const optionId = ["yes", "y", "approve"].includes(answer) ? "approve" : ["no", "n", "deny"].includes(answer) ? "deny" : null;
    if (!optionId) {
      yield "Please reply yes to approve or no to deny.";
      return;
    }
    const interactionId = chat.pending;
    chat.pending = undefined;
    await postToSession(request, chat.sessionId, { answers: [{ interactionId, optionId }] });
  } else {
    await postToSession(request, chat.sessionId, { message: latest });
  }
  yield* readReply(request, chat);
}

export default defineChannel({
  routes: [
    GET("/v1/models", async (request) => {
      if (!authorized(request)) return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });
      return Response.json({ object: "list", data: [{ id: MODEL_ID, object: "model", owned_by: "amoga" }] });
    }),
    POST("/v1/chat/completions", async (request) => {
      if (!authorized(request)) return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });
      const body = (await request.json()) as ChatRequest;
      const messages = body.messages ?? [];
      const id = `chatcmpl-${crypto.randomUUID()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = body.model ?? MODEL_ID;

      // Streams the reply to OpenBot. Sends the role chunk immediately and a keep-alive every 15 seconds, so the client doesn't drop the connection while Eve is slow.
      if (body.stream) {
        const encoder = new TextEncoder();
        const out = new ReadableStream({
          async start(controller) {
            const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            send({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] });
            const keepAlive = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15000);
            try {
              for await (const delta of respond(request, messages)) {
                send({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] });
              }
              send({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
            } catch (error) {
              send({ error: { message: String(error) } });
            } finally {
              clearInterval(keepAlive);
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(out, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      }

      let text = "";
      for await (const delta of respond(request, messages)) text += delta;
      return Response.json({
        id,
        object: "chat.completion",
        created,
        model,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      });
    }),
  ],
});
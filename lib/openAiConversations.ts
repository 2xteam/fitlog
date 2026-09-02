/**
 * OpenAI Conversations API + Responses API 연동 (SDK v6 네이티브).
 *
 * 공식 가이드: https://platform.openai.com/docs/guides/conversation-state
 * - `client.conversations.create()` 로 `conv_...` id 를 만든 뒤,
 *   이후 모든 턴에서 동일 id 를 `responses.create({ conversation })` 에 넘깁니다.
 * - 대화 아이템은 Conversation 에 귀속되며 30일 TTL 에 영향받지 않습니다.
 */
import OpenAI from "openai";
import type { ConversationItem } from "openai/resources/conversations/items";

export type ChatUiMessage = {
  _id: string;
  role: string;
  content: string;
  createdAt: string;
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  return new OpenAI({ apiKey });
}

/** conversations.create — 대화 객체 id(conv_...) 반환 */
export async function createOpenAiConversation(): Promise<string> {
  const client = getClient();
  const conv = await client.conversations.create();
  const id = conv.id?.trim();
  if (!id) throw new Error("OpenAI conversation id가 비어 있습니다.");
  return id;
}

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const t = b.type;
    if (t === "input_text" || t === "output_text" || t === "text") {
      if (typeof b.text === "string") parts.push(b.text);
    }
  }
  return parts.join("\n").trim();
}

function itemToUiMessage(item: ConversationItem): ChatUiMessage | null {
  if (!("role" in item)) return null;
  const msg = item as Extract<ConversationItem, { type: "message" }>;
  if (msg.type !== "message") return null;
  if (msg.role !== "user" && msg.role !== "assistant") return null;
  const id = msg.id ?? `msg-${Math.random().toString(36).slice(2)}`;
  const content = messageContentToString(msg.content);
  const createdAt = new Date().toISOString();
  return { _id: id, role: msg.role, content, createdAt };
}

/**
 * conversations.items.list — 페이지를 자동 순회하며 메시지만 반환합니다.
 */
export async function listConversationMessages(
  conversationId: string,
): Promise<ChatUiMessage[]> {
  const client = getClient();
  const out: ChatUiMessage[] = [];

  for await (const item of client.conversations.items.list(conversationId, {
    order: "asc",
    limit: 100,
  })) {
    const m = itemToUiMessage(item);
    if (m && m.content.length > 0) out.push(m);
  }

  return out;
}

export type ResponsesCreateUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type ResponsesCreateResult = {
  id: string;
  output_text: string;
  usage: ResponsesCreateUsage | null;
};

/**
 * responses.create — conversation 에 연결된 한 턴 응답을 생성합니다.
 * `input` 은 새 사용자 메시지만, `instructions` 에 RAG·정책을 넣어
 * 대화 아이템에는 순수 질문만 남깁니다.
 */
export async function createOpenAiResponse(params: {
  model: string;
  instructions: string;
  userMessage: string;
  conversation: string;
}): Promise<ResponsesCreateResult> {
  const client = getClient();

  const response = await client.responses.create({
    model: params.model,
    instructions: params.instructions,
    input: [{ role: "user", content: params.userMessage.trim() }],
    conversation: params.conversation,
    store: true,
  });

  const id = response.id ?? "";
  const output_text = response.output_text?.trim() ?? "";
  if (!id) throw new Error("OpenAI response id가 비어 있습니다.");
  if (!output_text) throw new Error("응답 본문이 비어 있습니다.");

  let usage: ResponsesCreateUsage | null = null;
  if (response.usage) {
    const u = response.usage;
    const input_tokens = u.input_tokens ?? 0;
    const output_tokens = u.output_tokens ?? 0;
    const total_tokens = u.total_tokens ?? input_tokens + output_tokens;
    if (input_tokens || output_tokens || total_tokens) {
      usage = { input_tokens, output_tokens, total_tokens };
    }
  }

  return { id, output_text, usage };
}

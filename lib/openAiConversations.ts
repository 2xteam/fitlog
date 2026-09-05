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

/**
 * 스트리밍 응답 — 토큰이 만들어지는 대로 흘려보낸다.
 *
 * 한 번에 받으면 사용자는 20~40초 동안 빈 화면을 본다. 응답이 길수록 더 기다린다.
 * 스트리밍은 그 시간을 없애지는 못하지만 **기다리는 성질을 바꾼다** — 답이 쌓이는
 * 것을 보면서 읽기 시작할 수 있다.
 *
 * `store: true`라 대화 아이템은 그대로 Conversation에 남는다. 이력 조회 방식은
 * 바뀌지 않는다.
 */
export type StreamEvent =
  | { type: "delta"; text: string }
  /** 모델이 되묻기를 택했다 — 답변 대신 선택지를 준다 */
  | { type: "ask"; callId: string; args: string }
  | {
      type: "done";
      id: string;
      text: string;
      usage: ResponsesCreateUsage | null;
    };

export async function* streamOpenAiResponse(params: {
  model: string;
  instructions: string;
  /** 사용자 메시지. 되묻기에 답하는 턴이면 비우고 `toolOutput`을 채운다 */
  userMessage?: string;
  conversation: string;
  tools?: unknown[];
  /** 앞 턴의 되묻기에 대한 사용자의 선택 */
  toolOutput?: { callId: string; output: string };
}): AsyncGenerator<StreamEvent> {
  const client = getClient();

  /*
    되묻기에 답하는 턴은 사용자 메시지가 아니라 `function_call_output`을 넣는다.
    앞 턴의 도구 호출은 conversation에 이미 저장돼 있어서 call_id로 이어붙는다.
  */
  const input = params.toolOutput
    ? [
        {
          type: "function_call_output" as const,
          call_id: params.toolOutput.callId,
          output: params.toolOutput.output,
        },
      ]
    : [{ role: "user" as const, content: (params.userMessage ?? "").trim() }];

  const stream = await client.responses.create({
    model: params.model,
    instructions: params.instructions,
    input: input as never,
    conversation: params.conversation,
    tools: (params.tools ?? []) as never,
    store: true,
    stream: true,
  });

  let full = "";
  let id = "";
  let usage: ResponsesCreateUsage | null = null;

  for await (const event of stream) {
    const e = event as unknown as Record<string, unknown>;

    if (e.type === "response.output_text.delta" && typeof e.delta === "string") {
      full += e.delta;
      yield { type: "delta", text: e.delta };
      continue;
    }

    // 도구 호출이 끝나면 인자가 다 모인다. 조각으로 흘려보낼 이유가 없어 한 번에 준다
    if (e.type === "response.output_item.done") {
      const item = e.item as Record<string, unknown> | undefined;
      if (item?.type === "function_call" && item.name === "ask_user") {
        yield {
          type: "ask",
          callId: String(item.call_id ?? ""),
          args: String(item.arguments ?? "{}"),
        };
      }
      continue;
    }

    // 완료 이벤트에서 id와 사용량을 챙긴다
    if (e.type === "response.completed" || e.type === "response.incomplete") {
      const r = e.response as Record<string, unknown> | undefined;
      if (r) {
        if (typeof r.id === "string") id = r.id;
        const u = r.usage as Record<string, number> | undefined;
        if (u) {
          const input_tokens = u.input_tokens ?? 0;
          const output_tokens = u.output_tokens ?? 0;
          const total_tokens = u.total_tokens ?? input_tokens + output_tokens;
          if (input_tokens || output_tokens || total_tokens) {
            usage = { input_tokens, output_tokens, total_tokens };
          }
        }
        // 델타를 놓쳤을 때를 대비해 최종 본문으로 보정한다
        const outText = r.output_text;
        if (typeof outText === "string" && outText.trim() && !full.trim()) {
          full = outText;
        }
      }
    }
  }

  yield { type: "done", id, text: full.trim(), usage };
}

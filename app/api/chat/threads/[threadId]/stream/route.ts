import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { buildChatInstructions, generateChatSubjectLine } from "@/lib/chatOpenAi";
import { isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { createOpenAiConversation, streamOpenAiResponse } from "@/lib/openAiConversations";
import { ChatThread, type ChatThreadDocument } from "@/models/ChatThread";
import { getUserModel } from "@/models/User";
import { deductTokens } from "@/lib/useToken";
import { buildBloodContext, buildMeasurementContext } from "@/lib/measurementContext";

/**
 * 상담 한 턴 — **스트리밍**.
 *
 * 기존 `POST /messages`는 응답이 다 만들어질 때까지 기다렸다가 한 번에 준다.
 * 그동안 화면은 비어 있고, 답이 길수록 더 오래 비어 있다.
 *
 * 여기서는 두 가지를 흘려보낸다.
 *
 *  1. **진행 단계**(`stage`) — 지어낸 문구가 아니라 서버가 실제로 하고 있는 일이다.
 *     기록을 읽는 데 몇 초, 참고 자료를 고르는 데 몇 초가 실제로 든다.
 *  2. **본문 조각**(`delta`) — 모델이 만드는 대로.
 *
 * 첫 글자까지 걸리는 시간은 줄지 않지만, 그 사이에 무엇을 하고 있는지 보이고
 * 그다음부터는 읽으면서 기다릴 수 있다.
 *
 * `/messages`는 그대로 둔다 — 이력 조회(GET)가 거기 있고, 스트리밍을 못 쓰는
 * 환경에서 되돌아갈 자리가 필요하다.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatThreadHydrated = HydratedDocument<ChatThreadDocument>;

async function assertThread(
  threadId: string,
  phone: string,
  userId: string,
): Promise<{ ok: true; thread: ChatThreadHydrated } | { ok: false; error: string; status: number }> {
  const p = normalizePhone(phone);
  if (!mongoose.isValidObjectId(threadId) || !p || !mongoose.isValidObjectId(userId)) {
    return { ok: false, error: "threadId, phone, userId가 필요합니다.", status: 400 };
  }

  await connectDB();
  const user = await getUserModel().findById(userId).exec();
  if (!user || user.phone !== p) {
    return { ok: false, error: "권한이 없습니다.", status: 403 };
  }

  const thread = (await ChatThread.findById(threadId).exec()) as ChatThreadHydrated | null;
  if (!thread || String(thread.userId) !== String(userId)) {
    return { ok: false, error: "대화를 찾을 수 없습니다.", status: 404 };
  }

  return { ok: true, thread };
}

export async function POST(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  if (!isOpenAiKeyConfigured()) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY가 필요합니다." }, { status: 503 });
  }

  const { threadId } = await ctx.params;
  let body: { phone?: string; userId?: string; text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "text가 필요합니다." }, { status: 400 });
  }

  const gate = await assertThread(threadId, phone, userId);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  const thread = gate.thread;

  const tokenResult = await deductTokens(userId, 1);
  if (!tokenResult.ok) {
    return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 402 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        let convId = (thread.openAiConversationId ?? "").trim();
        if (!convId) {
          send({ type: "stage", stage: "conversation" });
          convId = await createOpenAiConversation();
          thread.openAiConversationId = convId;
        }

        // 이 사용자의 실제 기록을 읽는다. 인바디와 피검사 둘 다 —
        // 겹쳐 봐야 보이는 것이 있다(근육량이 많으면 eGFR 해석이 달라지는 등).
        send({ type: "stage", stage: "records" });
        let measurementContext = "";
        try {
          const [inbody, blood] = await Promise.all([
            buildMeasurementContext(userId),
            buildBloodContext(userId).catch(() => ""),
          ]);
          measurementContext = [inbody, blood].filter(Boolean).join("\n\n");
        } catch {
          /* 기록을 못 읽어도 대화는 이어간다 */
        }

        // 질문에 맞는 참고 문서를 고른다 (카탈로그에서 생성된 청크)
        send({ type: "stage", stage: "knowledge" });
        const instructions = buildChatInstructions(text, measurementContext);

        send({ type: "stage", stage: "thinking" });

        let assistantText = "";
        let responseId = "";
        let usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null = null;

        for await (const ev of streamOpenAiResponse({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          instructions,
          userMessage: text,
          conversation: convId,
        })) {
          if (ev.type === "delta") {
            send({ type: "delta", text: ev.text });
          } else {
            assistantText = ev.text;
            responseId = ev.id;
            usage = ev.usage;
          }
        }

        if (!assistantText) throw new Error("응답 본문이 비어 있습니다.");

        if (usage) {
          thread.totalInputTokens = (thread.totalInputTokens ?? 0) + usage.input_tokens;
          thread.totalOutputTokens = (thread.totalOutputTokens ?? 0) + usage.output_tokens;
          thread.totalTokens = (thread.totalTokens ?? 0) + usage.total_tokens;
        }
        thread.updatedAt = new Date();

        // 제목은 본문을 다 보낸 뒤에 만든다 — 답을 읽는 동안 기다리지 않게
        let threadTitle: string | null = null;
        const currentTitle = (thread.title ?? "").trim();
        if (!currentTitle || currentTitle === "새 대화") {
          const subject = await generateChatSubjectLine(text);
          if (subject) {
            thread.title = subject;
            threadTitle = subject;
          }
        }

        await thread.save();

        send({
          type: "done",
          assistantText,
          openAiResponseId: responseId,
          threadTitle,
          usage: {
            lastTurn: usage,
            totalTokens: thread.totalTokens ?? 0,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 프록시가 SSE를 모아서 한 번에 보내면 스트리밍의 의미가 없어진다
      "X-Accel-Buffering": "no",
    },
  });
}

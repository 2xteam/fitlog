import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { requireConsents } from "@/lib/requireConsent";
import { generateChatSubjectLine, runChatTurn } from "@/lib/chatOpenAi";
import { isOpenAiKeyConfigured } from "@/lib/openaiKey";
import {
  createOpenAiConversation,
  listConversationMessages,
} from "@/lib/openAiConversations";
import { ChatThread, type ChatThreadDocument } from "@/models/ChatThread";
import { deductTokens } from "@/lib/useToken";
import { buildBloodContext, buildMeasurementContext } from "@/lib/measurementContext";

export const runtime = "nodejs";
// OpenAI 응답 지연 대비 (Vercel 기본값은 플랜에 따라 10~15초)
export const maxDuration = 60;

type ChatThreadHydrated = HydratedDocument<ChatThreadDocument>;

/**
 * 스레드가 **이 회원의 것**인지 본다.
 *
 * 소유자는 세션 토큰의 `viewer.uid` 다. 예전 화면이 보내는 `phone`·`userId` 는
 * 무시한다 — 전화번호는 쿠키에 평문으로 있어 누구나 맞출 수 있었다.
 * `chat_threads.userId` 는 ObjectId 라 문자열을 바꿔 넣는다. → lib/auth.ts
 */
async function assertThread(
  threadId: string,
  ownerUid: string,
): Promise<{ ok: true; thread: ChatThreadHydrated } | { ok: false; response: NextResponse }> {
  if (!mongoose.isValidObjectId(threadId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "threadId가 올바르지 않습니다." },
        { status: 400 },
      ),
    };
  }

  await connectDB();
  const thread = await ChatThread.findOne({
    _id: new mongoose.Types.ObjectId(threadId),
    userId: new mongoose.Types.ObjectId(ownerUid),
  }).exec();

  if (!thread) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "스레드를 찾을 수 없습니다." }, { status: 404 }),
    };
  }

  return { ok: true, thread };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  try {
    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY가 필요합니다." },
        { status: 503 },
      );
    }

    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;

    const { threadId } = await ctx.params;
    const gate = await assertThread(threadId, auth.viewer.uid);
    if (!gate.ok) return gate.response;

    const convId = (gate.thread.openAiConversationId ?? "").trim();

    if (!convId) {
      return NextResponse.json({
        ok: true,
        items: [] as unknown[],
        usage: {
          totalInputTokens: gate.thread.totalInputTokens ?? 0,
          totalOutputTokens: gate.thread.totalOutputTokens ?? 0,
          totalTokens: gate.thread.totalTokens ?? 0,
        },
      });
    }

    const items = await listConversationMessages(convId);

    return NextResponse.json({
      ok: true,
      items,
      usage: {
        totalInputTokens: gate.thread.totalInputTokens ?? 0,
        totalOutputTokens: gate.thread.totalOutputTokens ?? 0,
        totalTokens: gate.thread.totalTokens ?? 0,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  try {
    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY가 필요합니다." },
        { status: 503 },
      );
    }

    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const userId = auth.viewer.uid;

    /*
      분리 동의를 **서버에서** 본다. 이 턴은 사용자의 인바디·피검사 수치를
      OpenAI `instructions` 에 실어 보낸다(lib/measurementContext.ts) — 건강정보 처리와
      국외 이전 동의가 둘 다 있어야 한다. 없으면 412 → lib/requireConsent.ts
    */
    const consentDenied = await requireConsents(userId, ["health", "overseas"]);
    if (consentDenied) return consentDenied;

    const { threadId } = await ctx.params;
    let body: { text?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "text가 필요합니다." },
        { status: 400 },
      );
    }

    const gate = await assertThread(threadId, userId);
    if (!gate.ok) return gate.response;
    const thread = gate.thread;

    const tokenResult = await deductTokens(userId, 1);
    if (!tokenResult.ok) {
      return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 402 });
    }

    let convId = (thread.openAiConversationId ?? "").trim();
    if (!convId) {
      convId = await createOpenAiConversation();
      thread.openAiConversationId = convId;
    }

    // 상담이 일반론에 그치지 않도록 이 사용자의 최근 기록을 함께 넘긴다.
    // 인바디와 피검사를 둘 다 싣는다 — 겹쳐 봐야 보이는 것이 있다
    // (근육량이 많으면 크레아티닌·eGFR 해석이 달라지는 등).
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

    const { assistantText, openAiResponseId, usage } = await runChatTurn({
      userText: text,
      openAiConversationId: convId,
      measurementContext,
    });

    if (usage) {
      thread.totalInputTokens = (thread.totalInputTokens ?? 0) + usage.input_tokens;
      thread.totalOutputTokens = (thread.totalOutputTokens ?? 0) + usage.output_tokens;
      thread.totalTokens = (thread.totalTokens ?? 0) + usage.total_tokens;
    }

    thread.updatedAt = new Date();

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

    return NextResponse.json({
      ok: true,
      assistantText,
      openAiResponseId,
      threadTitle,
      usage: {
        lastTurn: usage,
        totalInputTokens: thread.totalInputTokens ?? 0,
        totalOutputTokens: thread.totalOutputTokens ?? 0,
        totalTokens: thread.totalTokens ?? 0,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

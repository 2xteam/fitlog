import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { generateChatSubjectLine, runChatTurn } from "@/lib/chatOpenAi";
import { isOpenAiKeyConfigured } from "@/lib/openaiKey";
import {
  createOpenAiConversation,
  listConversationMessages,
} from "@/lib/openAiConversations";
import { ChatThread, type ChatThreadDocument } from "@/models/ChatThread";
import { getUserModel } from "@/models/User";
import { deductTokens } from "@/lib/useToken";
import { buildMeasurementContext } from "@/lib/measurementContext";

export const runtime = "nodejs";
// OpenAI 응답 지연 대비 (Vercel 기본값은 플랜에 따라 10~15초)
export const maxDuration = 60;

type ChatThreadHydrated = HydratedDocument<ChatThreadDocument>;

async function assertThread(
  threadId: string,
  phone: string,
  userId: string,
): Promise<{ ok: true; thread: ChatThreadHydrated } | { ok: false; response: NextResponse }> {
  const p = normalizePhone(phone);
  if (!mongoose.isValidObjectId(threadId) || !p || !mongoose.isValidObjectId(userId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "threadId, phone, userId가 필요합니다." },
        { status: 400 },
      ),
    };
  }

  await connectDB();
  const user = await getUserModel().findById(userId).exec();
  if (!user || user.phone !== p) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 }),
    };
  }

  const thread = await ChatThread.findOne({
    _id: new mongoose.Types.ObjectId(threadId),
    userId: new mongoose.Types.ObjectId(userId),
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

    const { threadId } = await ctx.params;
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone") ?? "";
    const userId = url.searchParams.get("userId") ?? "";

    const gate = await assertThread(threadId, phone, userId);
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

    const { threadId } = await ctx.params;
    let body: { phone?: string; userId?: string; text?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = typeof body.phone === "string" ? body.phone : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "text가 필요합니다." },
        { status: 400 },
      );
    }

    const gate = await assertThread(threadId, phone, userId);
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

    // 상담이 일반론에 그치지 않도록 이 사용자의 최근 기록을 함께 넘긴다
    let measurementContext = "";
    try {
      measurementContext = await buildMeasurementContext(userId);
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

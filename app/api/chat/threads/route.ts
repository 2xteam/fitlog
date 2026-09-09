import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, serverError } from "@/lib/auth";
import { ChatThread } from "@/models/ChatThread";

export const runtime = "nodejs";

/**
 * 상담 스레드 목록·생성.
 *
 * 소유자는 **세션 토큰에서만** 읽는다(`viewer.uid`). 예전 화면이 보내는
 * `phone`·`userId` 는 무시한다 — 전화번호는 쿠키에 평문으로 있어 누구나 맞출 수 있었다.
 * `chat_threads.userId` 는 ObjectId 라 문자열 `uid` 를 바꿔 넣는다.
 * → lib/auth.ts
 */
export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const owner = new mongoose.Types.ObjectId(auth.viewer.uid);

    await connectDB();
    const items = await ChatThread.find({ userId: owner })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const owner = new mongoose.Types.ObjectId(auth.viewer.uid);

    let body: { title?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "새 대화";

    await connectDB();
    const doc = await ChatThread.create({ userId: owner, title });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { ChatThread } from "@/models/ChatThread";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    const userId = url.searchParams.get("userId") ?? "";

    if (!phone || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const items = await ChatThread.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: { phone?: string; userId?: string; title?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "새 대화";

    if (!phone || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const doc = await ChatThread.create({
      userId: new mongoose.Types.ObjectId(userId),
      title,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

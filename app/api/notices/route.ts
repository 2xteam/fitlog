import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getNoticeModel } from "@/models/Notice";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const Notice = getNoticeModel();
    const list = await Notice.find().sort({ pinned: -1, createdAt: -1 }).lean();
    return NextResponse.json({
      ok: true,
      notices: list.map((n) => ({
        id: String(n._id),
        title: n.title,
        content: n.content,
        pinned: n.pinned ?? false,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

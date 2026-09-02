import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";
import { getInquiryModel } from "@/models/Inquiry";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = normalizePhone(searchParams.get("phone") ?? "");
    const userId = searchParams.get("userId") ?? "";

    if (!phone || !userId) {
      return NextResponse.json(
        { ok: false, error: "phone과 userId가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const Inquiry = getInquiryModel();
    const list = await Inquiry.find({ userId, phone })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({
      ok: true,
      inquiries: list.map((d) => ({
        id: String(d._id),
        category: d.category,
        title: d.title,
        content: d.content,
        status: d.status,
        answer: d.answer ?? "",
        answeredAt: d.answeredAt ?? null,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: {
      phone?: string;
      userId?: string;
      category?: string;
      title?: string;
      content?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const userId = typeof body.userId === "string" ? body.userId : "";
    const category = typeof body.category === "string" ? body.category : "other";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!phone || !userId) {
      return NextResponse.json(
        { ok: false, error: "phone과 userId가 필요합니다." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "제목을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "내용을 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const Inquiry = getInquiryModel();
    const doc = await Inquiry.create({
      userId,
      phone,
      name: user.name,
      category,
      title,
      content,
    });

    return NextResponse.json({
      ok: true,
      inquiry: {
        id: String(doc._id),
        category: doc.category,
        title: doc.title,
        content: doc.content,
        status: doc.status,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

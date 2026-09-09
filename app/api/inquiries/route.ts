import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, serverError } from "@/lib/auth";
import { getInquiryModel } from "@/models/Inquiry";

export const runtime = "nodejs";

/**
 * 1:1 문의 목록·등록.
 *
 * 소유자는 **세션 토큰에서만** 읽는다(`viewer.uid`). 예전 화면이 보내는
 * `phone`·`userId` 는 무시한다. `inquiries.userId` 는 ObjectId 라 바꿔 넣는다.
 * 문의에 남기는 전화번호·이름도 본문이 아니라 회원 문서에서 가져온다.
 * → lib/auth.ts
 */
export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const owner = new mongoose.Types.ObjectId(auth.viewer.uid);

    await connectDB();
    const Inquiry = getInquiryModel();
    const list = await Inquiry.find({ userId: owner })
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
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;
    const owner = new mongoose.Types.ObjectId(viewer.uid);

    let body: {
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

    const category = typeof body.category === "string" ? body.category : "other";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

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
    const Inquiry = getInquiryModel();
    /*
      `phone`·`name` 은 스키마에서 필수다. 이메일로만 가입한 계정은 전화번호가
      없을 수 있어 이메일로 대신 채운다 — 관리자가 답할 때 연락처가 필요하다.
    */
    const doc = await Inquiry.create({
      userId: owner,
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
    return serverError(err);
  }
}

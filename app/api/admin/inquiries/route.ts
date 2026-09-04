import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminApiError, requireAdminSecret } from "@/lib/adminApi";
import { getInquiryModel } from "@/models/Inquiry";

export const runtime = "nodejs";

/**
 * 문의 관리 — 통합 admin(포털)이 서버끼리 부른다.
 * 응답 모양은 네 앱이 같다.
 */

type InquiryRow = {
  id: string;
  name: string;
  phone: string;
  category: string;
  title: string;
  content: string;
  status: string;
  answer: string;
  answeredAt: string | null;
  createdAt: string | null;
};

const iso = (d: unknown): string | null => (d instanceof Date ? d.toISOString() : null);

async function list(status: string): Promise<InquiryRow[]> {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const rows = await getInquiryModel()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()
    .exec();

  return rows.map((q) => ({
    id: String(q._id),
    name: q.name ?? "",
    phone: q.phone ?? "",
    category: q.category ?? "",
    title: q.title ?? "",
    content: q.content ?? "",
    status: q.status ?? "",
    answer: q.answer ?? "",
    answeredAt: iso(q.answeredAt),
    createdAt: iso(q.createdAt),
  }));
}

export async function GET(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const status = new URL(req.url).searchParams.get("status") ?? "";
    await connectDB();
    return NextResponse.json({ ok: true, inquiries: await list(status) });
  } catch (err) {
    return adminApiError(err);
  }
}

/**
 * 답변 달기.
 *
 * 답변을 쓰면 상태를 `answered`로 함께 올린다. 답변만 남고 상태가 `pending`으로
 * 남아 있으면, 문의함에서 답이 달린 것을 다시 처리하게 된다.
 */
export async function PATCH(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { id?: unknown; answer?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!id) return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });
    if (!answer) {
      return NextResponse.json({ ok: false, error: "답변 내용을 입력해 주세요." }, { status: 400 });
    }

    await connectDB();
    const hit = await getInquiryModel()
      .updateOne({ _id: id }, { $set: { answer, status: "answered", answeredAt: new Date() } })
      .exec();

    if (hit.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "문의를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, inquiries: await list("") });
  } catch (err) {
    return adminApiError(err);
  }
}

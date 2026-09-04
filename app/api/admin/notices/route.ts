import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminApiError, requireAdminSecret } from "@/lib/adminApi";
import { getNoticeModel } from "@/models/Notice";

export const runtime = "nodejs";

/**
 * 공지 관리 — 통합 admin(포털)이 서버끼리 부른다.
 *
 * 응답 모양은 **네 앱이 같다.** 포털이 앱마다 다른 스키마를 알지 않아도 되도록
 * 여기서 화면이 쓸 모양으로 바꿔서 내보낸다.
 */

type NoticeRow = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string | null;
};

const iso = (d: unknown): string | null => (d instanceof Date ? d.toISOString() : null);

async function list(): Promise<NoticeRow[]> {
  const rows = await getNoticeModel().find().sort({ pinned: -1, createdAt: -1 }).lean().exec();
  return rows.map((n) => ({
    id: String(n._id),
    title: n.title,
    content: n.content,
    pinned: Boolean(n.pinned),
    createdAt: iso(n.createdAt),
  }));
}

export async function GET(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    await connectDB();
    return NextResponse.json({ ok: true, notices: await list() });
  } catch (err) {
    return adminApiError(err);
  }
}

/** 공지 발행 */
export async function POST(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { title?: unknown; content?: unknown; pinned?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: "제목과 내용을 모두 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    await getNoticeModel().create({
      title,
      content,
      pinned: body.pinned === true,
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true, notices: await list() }, { status: 201 });
  } catch (err) {
    return adminApiError(err);
  }
}

/** 공지 고치기 — 보낸 항목만 바꾼다 */
export async function PATCH(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      id?: unknown;
      title?: unknown;
      content?: unknown;
      pinned?: unknown;
    };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });

    const set: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) set.title = body.title.trim();
    if (typeof body.content === "string" && body.content.trim()) set.content = body.content.trim();
    if (typeof body.pinned === "boolean") set.pinned = body.pinned;

    if (Object.keys(set).length === 0) {
      return NextResponse.json({ ok: false, error: "바꿀 내용이 없습니다." }, { status: 400 });
    }

    await connectDB();
    const hit = await getNoticeModel().updateOne({ _id: id }, { $set: set }).exec();
    if (hit.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "공지를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, notices: await list() });
  } catch (err) {
    return adminApiError(err);
  }
}

/** 공지 내리기 */
export async function DELETE(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });

    await connectDB();
    await getNoticeModel().deleteOne({ _id: id }).exec();

    return NextResponse.json({ ok: true, notices: await list() });
  } catch (err) {
    return adminApiError(err);
  }
}

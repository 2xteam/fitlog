import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { adminApiError, requireAdminSecret } from "@/lib/adminApi";

export const runtime = "nodejs";

/**
 * 이 앱의 요약 수치 — 통합 admin(포털)이 서버끼리 부른다.
 *
 * 응답은 `{ label, value }` 목록이다. 앱마다 세는 것이 다르지만 **모양은 같아서**
 * 포털은 무엇을 세는지 몰라도 표로 그릴 수 있다. 새 항목을 여기 추가하면
 * 포털을 고치지 않아도 화면에 나온다.
 *
 * 모델을 쓰지 않고 컬렉션을 직접 센다. 스키마를 알 필요가 없고,
 * 앱이 필드를 바꿔도 이 라우트는 깨지지 않는다.
 */

type Counter = {
  label: string;
  collection: string;
  /** 없으면 전체를 센다 */
  filter?: Record<string, unknown>;
};

const COUNTERS: Counter[] = [
  { label: "측정 기록", collection: "measurements" },
  { label: "AI 대화", collection: "chat_threads" },
  { label: "공지", collection: "notices" },
  { label: "문의 전체", collection: "inquiries" },
  { label: "답변 대기", collection: "inquiries", filter: { status: "pending" } },
];

export async function GET(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("DB 연결이 준비되지 않았습니다.");

    // 컬렉션이 아직 없을 수 있다(그 기능을 아무도 쓰지 않은 앱). 0으로 둔다
    const present = new Set((await db.listCollections().toArray()).map((c) => c.name));

    const stats = await Promise.all(
      COUNTERS.map(async ({ label, collection, filter }) => ({
        label,
        value: present.has(collection)
          ? await db.collection(collection).countDocuments(filter ?? {})
          : 0,
      })),
    );

    return NextResponse.json({
      ok: true,
      stats,
      dbName: db.databaseName,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return adminApiError(err);
  }
}

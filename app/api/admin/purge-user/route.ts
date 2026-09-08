import { NextResponse } from "next/server";
import { adminApiError, requireAdminSecret } from "@/lib/adminApi";
import { purgeUserData } from "@/lib/purgeUserData";

export const runtime = "nodejs";
/* 지울 것이 많은 사람이 있다. 기본값으로는 모자란다 */
export const maxDuration = 60;

/**
 * 포털의 정리 작업이 부른다 — 탈퇴한 지 6개월이 지난 사람의 **이 앱 데이터**를 지운다.
 *
 * 회원 문서는 포털이 지운다. 여기서는 이 앱 DB(와 R2 파일)만 치운다.
 * 인증은 통합 admin 과 같은 공유 비밀(`ADMIN_API_SECRET`) 하나다.
 *
 * 포털은 `id`(회원 Mongo _id)와 `userId`(2hbk 도메인 식별자)를 **둘 다** 보낸다.
 * 앱마다 참조하는 키가 달라서다. 이 앱은 `회원 Mongo _id` 를 쓴다.
 *
 * ⚠️ **되돌릴 수 없다.** 포털이 보관 기간을 다 센 뒤에만 부른다.
 * → myjane/app/api/cron/purge · my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export async function POST(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    let body: { id?: string; userId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const key = typeof body.id === "string" ? body.id.trim() : "";
    if (!key) {
      return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
    }

    const purged = await purgeUserData(key);
    return NextResponse.json({ ok: true, id: key, purged });
  } catch (err) {
    return adminApiError(err);
  }
}

import crypto from "node:crypto";
import { NextResponse } from "next/server";

/**
 * 통합 admin(`www.myjane.co.kr/admin`)에서 오는 서버 호출을 확인한다.
 *
 * 인증은 **공유 비밀 하나**다 — 다섯 배포가 `ADMIN_API_SECRET`을 같은 값으로 갖는다.
 * 브라우저가 이 라우트를 직접 부르는 일은 없다. 포털 서버만 부른다.
 *
 * 예전에는 소스에 박힌 PIN을 쿼리스트링으로 검사했다(`?pin=1956`).
 * 공개 저장소에 값이 있었고, URL이라 접근 로그에도 남았다. 그 방식은 버렸다.
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */

function readSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const value = auth.slice(7).trim();
  return value || null;
}

/** 권한이 없으면 응답을 돌려준다. 통과하면 `null`. */
export function requireAdminSecret(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected || expected.length < 16) {
    // 비밀이 설정되지 않았으면 **막는다.** 열어 두면 아무나 관리 API를 부른다
    return NextResponse.json(
      { ok: false, error: "ADMIN_API_SECRET이 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const given = readSecret(req);
  const deny = NextResponse.json(
    { ok: false, error: "관리자 권한이 필요합니다." },
    { status: 403 },
  );
  if (!given) return deny;

  // 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 거른다
  if (given.length !== expected.length) return deny;
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return deny;

  return null;
}

export function adminApiError(err: unknown) {
  const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

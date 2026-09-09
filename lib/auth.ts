import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserModel, type UserDocument } from "@/models/User";
import { verifySessionToken } from "@/lib/sessionToken";
import { readSessionTokenFromRequest } from "@/lib/sessionCookie";

/**
 * 서버에서 요청자를 확인한다.
 *
 * 쿠키 본문의 `id`·`phone` 은 클라이언트가 마음대로 쓸 수 있으므로 **믿지 않는다.**
 * 같은 쿠키 안의 `token`(포털이 HMAC 으로 서명)만 신뢰하고, 거기 담긴 `uid`
 * (통합 회원의 Mongo `_id`)로 회원을 찾는다.
 *
 * 이 앱의 기록은 회원 `_id` 를 소유자로 삼는다(`createdBy` · `userId`).
 * 라우트는 쿼리·본문에서 소유자를 읽지 않고 **`viewer.uid` 만** 쓴다.
 *
 * 원본은 2hbk/lib/auth.ts — 그쪽은 도메인 식별자(`users.userId`)로 찾는 것만 다르다.
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md
 */



export type Viewer = {
  /** 통합 회원 문서 */
  doc: UserDocument;
  /** 회원 Mongo `_id` 문자열 — 이 앱 기록의 소유자 키 */
  uid: string;
  /** 2hbk 도메인 식별자. 이 앱은 쓰지 않지만 토큰에 함께 있다 */
  userId: string;
};

export async function getViewer(req: Request): Promise<Viewer | null> {
  const claims = verifySessionToken(readSessionTokenFromRequest(req));
  if (!claims) return null;

  await connectDB();
  const User = getUserModel();
  const doc = await User.findById(claims.uid).exec();
  if (!doc) return null;

  /*
    탈퇴한 계정은 여기서 막는다. 탈퇴는 **여섯 서비스 공통**이라
    포털에서 닫으면 이 앱도 함께 닫혀야 한다. 쿠키는 30일짜리라
    포털에서 막는 것만으로는 남아 있는 세션이 계속 통한다.
    → myjane/lib/accountLifecycle.ts · 50-Plans/C 법적 페이지.md
  */
  if (doc.withdrawnAt) return null;

  /*
    세션 버전이 다르면 폐기된 토큰이다 (비밀번호 변경·탈퇴·모든 기기 로그아웃).
    `sv` 가 없는 옛 토큰은 아직 한 번도 올리지 않은 계정(0)에서만 통한다.
  */
  if ((claims.sv ?? 0) !== (doc.sessionVersion ?? 0)) return null;

  return { doc, uid: String(doc._id), userId: claims.u };
}

/** 로그인이 필요한 라우트에서 쓴다. 실패하면 401 응답을 돌려준다 */
export async function requireViewer(
  req: Request,
): Promise<{ viewer: Viewer } | { error: NextResponse }> {
  const viewer = await getViewer(req);
  if (!viewer) {
    return {
      error: NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }
  return { viewer };
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

export function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

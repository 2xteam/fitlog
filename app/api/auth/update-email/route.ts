import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 이메일 등록은 **포털에서만** 한다 (myjane /account/email). 2026-09-09 에 닫았다.
 * 이 라우트는 본문의 phone·userId 를 믿는 옛 방식이었고, 부르는 화면도 없다.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "이메일 등록은 myjane 계정에서 진행합니다. https://www.myjane.co.kr/account/email" },
    { status: 410 },
  );
}

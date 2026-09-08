import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 이 앱의 로컬 가입 라우트는 **닫혔다.**
 *
 * 가입은 포털(www.myjane.co.kr)에서만 받는다. 약관·개인정보 동의를 받고
 * 동의 시각을 남기는 곳이 포털 가입 라우트 한 곳뿐이라, 여기를 열어 두면
 * **동의를 거치지 않은 계정이 만들어진다.**
 *
 * 404 가 아니라 410 을 준다 — 없는 주소가 아니라 **일부러 없앤** 주소다.
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "가입은 myjane 포털에서만 할 수 있습니다. https://www.myjane.co.kr/signup 을 이용해 주세요.",
    },
    { status: 410 },
  );
}

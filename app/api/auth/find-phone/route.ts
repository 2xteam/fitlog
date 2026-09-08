import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 이 앱의 로컬 전화번호 찾기 라우트는 **닫혔다.**
 *
 * 계정 찾기·재설정은 포털(www.myjane.co.kr)에서만 한다. 메일을 보내는 자리가
 * 여러 곳이면 문구·쿨다운·계정 노출 대응이 갈린다. 실제로 갈려 있었다 —
 * 이 사본에는 재발송 쿨다운이 없었고, 계정이 없으면 404 로 **어떤 이메일이
 * 가입돼 있는지 알려줬다.**
 *
 * 404 가 아니라 410 을 준다 — 없는 주소가 아니라 **일부러 없앤** 주소다.
 * → myjane/app/api/auth/find-phone · my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "계정 찾기는 myjane 에서 진행합니다. https://www.myjane.co.kr/find-phone 을 이용해 주세요.",
    },
    { status: 410 },
  );
}

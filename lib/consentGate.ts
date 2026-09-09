"use client";

import { consentUrl } from "@/lib/portal";

/**
 * 서버가 **412** 로 "동의가 필요하다"고 하면 동의 화면으로 보낸다.
 *
 * 게이트는 서버에 있다(`lib/requireConsent.ts`). 화면은 그 응답을 알아보고
 * 사람을 옳은 자리로 데려다 놓는 일만 한다. 이걸 안 하면 "동의가 필요해요"
 * 라는 문장만 뜨고 **어디서 동의하는지 알 수 없다.**
 *
 * 여러 동의가 한꺼번에 필요하면 **첫 번째로 보내고 나머지를 `then` 으로 넘긴다.**
 * 포털이 하나 끝나면 다음 동의 화면으로 이어 주고, 다 끝나면 원래 자리로 돌려보낸다.
 * 예전에는 돌아와서 다음 게이트를 다시 만나 허용 화면이 두 번 나왔다 (2026-09-09 고침).
 * 세 동의는 서로 독립이라 한 화면에 몰아넣지는 않는다 → myjane/lib/consents.ts
 *
 * 돌려주는 값이 `true` 면 **이미 화면을 옮겼다.** 부르는 쪽은 거기서 멈춘다 —
 * 여러 파일을 도는 중이라면 나머지를 계속 시도할 이유가 없다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export function goConsentIfNeeded(json: unknown, backTo: string): boolean {
  const kinds =
    typeof json === "object" && json !== null && "needsConsent" in json
      ? (json as { needsConsent?: unknown }).needsConsent
      : null;
  if (!Array.isArray(kinds) || kinds.length === 0) return false;

  const valid = kinds.filter(
    (k): k is "health" | "overseas" | "guardian" => k === "health" || k === "overseas" || k === "guardian",
  );
  if (valid.length === 0) return false;

  window.location.href = consentUrl(valid[0], backTo, valid.slice(1));
  return true;
}

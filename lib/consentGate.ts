"use client";

import { consentUrl } from "@/lib/portal";

/**
 * 서버가 **412** 로 "동의가 필요하다"고 하면 동의 화면으로 보낸다.
 *
 * 게이트는 서버에 있다(`lib/requireConsent.ts`). 화면은 그 응답을 알아보고
 * 사람을 옳은 자리로 데려다 놓는 일만 한다. 이걸 안 하면 "동의가 필요해요"
 * 라는 문장만 뜨고 **어디서 동의하는지 알 수 없다.**
 *
 * 여러 동의가 한꺼번에 필요하면 **첫 번째로 보낸다.** 동의를 마치면 원래
 * 자리로 돌아오고, 거기서 다음 게이트를 다시 만난다. 세 동의는 서로 독립이라
 * 한 화면에 몰아넣지 않는다 → myjane/lib/consents.ts
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

  const first = kinds[0];
  if (first !== "health" && first !== "overseas" && first !== "guardian") return false;

  window.location.href = consentUrl(first, backTo);
  return true;
}

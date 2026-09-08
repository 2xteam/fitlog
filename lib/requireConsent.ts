import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";

/**
 * 분리 동의를 서버에서 확인한다.
 *
 * ⚠️ **화면에서만 막으면 안 된다.** 라우트를 직접 부르면 그대로 통과한다.
 * 동의는 여섯 앱이 공유하는 `users` 에 있으므로 여기서 직접 읽는다
 * → myjane/lib/consents.ts
 *
 * 통과하면 `null`. 막아야 하면 **412** 응답을 준다 — 400/403 과 구분되어야
 * 화면이 "동의 화면으로 보내라"를 알아챌 수 있다. 응답에 `needsConsent` 를
 * 실어 어느 동의가 필요한지 알려준다.
 *
 * ⚠️ **로그인을 막는 것이 아니다.** 이 기능만 막는다.
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export type ConsentKind = "health" | "overseas" | "guardian";

const FIELD: Record<ConsentKind, string> = {
  health: "healthDataAgreedAt",
  overseas: "overseasTransferAgreedAt",
  guardian: "guardianAgreedAt",
};

const LABEL: Record<ConsentKind, string> = {
  health: "건강정보 처리",
  overseas: "개인정보 국외 이전",
  guardian: "법정대리인",
};

/**
 * 필요한 동의가 모두 있는지 본다.
 *
 * `userId` 는 이 앱이 쓰는 회원 Mongo `_id` 문자열이다. 값이 없으면
 * **막지 않는다** — 로그인하지 않은 요청은 다른 검사에서 이미 걸러진다.
 * 여기서 겹쳐 막으면 원인이 헷갈리는 오류가 두 겹으로 난다.
 */
export async function requireConsents(
  userId: string | undefined,
  kinds: ConsentKind[],
): Promise<NextResponse | null> {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;

  await connectDB();
  const user = await getUserModel()
    .findById(userId, { healthDataAgreedAt: 1, overseasTransferAgreedAt: 1, guardianAgreedAt: 1 })
    .lean()
    .exec();
  if (!user) return null;

  const missing = kinds.filter((k) => !(user as Record<string, unknown>)[FIELD[k]]);
  if (missing.length === 0) return null;

  return NextResponse.json(
    {
      ok: false,
      needsConsent: missing,
      error: `${missing.map((k) => LABEL[k]).join(" · ")} 동의가 필요해요. 동의하지 않으셔도 다른 기능은 그대로 쓸 수 있습니다.`,
    },
    { status: 412 },
  );
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { signSessionToken } from "@/lib/sessionToken";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/** 2hbk 도메인 식별자 — 세션 서명 토큰이 이 값을 담는다 (myjane 로그인과 같은 규칙) */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 전화번호 + PIN 로그인 — **로컬 개발용.**
 *
 * 운영 도메인에서는 포털(`www.myjane.co.kr`)이 로그인을 맡는다. 다만 이 앱의 API 는
 * 쿠키 안의 **서명 토큰만** 믿으므로(lib/auth.ts) 여기서도 포털과 같은 형식의
 * 토큰을 발급해야 한다. 안 그러면 로컬 개발에서 모든 API 가 401 이다.
 * → myjane/app/api/auth/login/route.ts · 2hbk/app/api/auth/login/route.ts
 */

export async function POST(req: Request) {
  try {
    let body: { phone?: string; pin?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const phone = normalizePhone(phoneRaw);

    if (!phone || !pin) {
      return NextResponse.json(
        { ok: false, error: "phone과 pin이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const candidates = await User.find({ phone }).exec();
    const matches = [];
    for (const u of candidates) {
      // 이메일로만 가입한 계정은 PIN이 없다 → 이 경로로는 로그인하지 않는다
      if (!u.pin) continue;
      if (await bcrypt.compare(pin, u.pin)) {
        matches.push(u);
      }
    }

    if (matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: "전화번호 또는 PIN이 올바르지 않습니다." },
        { status: 401 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "같은 전화번호로 여러 계정이 있습니다. PIN을 계정별로 다르게 설정해 주세요.",
        },
        { status: 409 },
      );
    }

    const user = matches[0];

    /*
      탈퇴한 계정에는 세션을 내주지 않는다 — `getViewer` 도 같은 기준으로 막는다.
      되살리기는 포털에서만 한다. → lib/auth.ts
    */
    if (user.withdrawnAt) {
      return NextResponse.json(
        { ok: false, error: "탈퇴한 계정입니다. 포털에서 계정을 되살려 주세요." },
        { status: 403 },
      );
    }

    /*
      `userId` 가 없으면 지금 만들어 준다. 옛 계정(전화번호+PIN 가입)에는 없는데
      서명 토큰이 이 값을 담는다. myjane 로그인이 같은 방식으로 조용히 채운다.
    */
    if (!user.userId) user.userId = newUserId();
    user.lastLoginAt = new Date();
    await user.save();

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        name: user.name ?? "",
        hasEmail: Boolean(user.email),
      },
      token: signSessionToken(String(user._id), user.userId),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

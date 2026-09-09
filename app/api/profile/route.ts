import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";
import { requireViewer } from "@/lib/auth";

/**
 * 신체 프로필 조회·수정.
 *
 * 키·성별·출생연도는 세 앱이 공유하는 `users` 문서에 저장하되 FitLog에서만 쓴다.
 * 인바디 표준범위와 기초대사량이 성별·연령 기준이라 측정 기록 전에 반드시 필요하다.
 *
 * 누구의 프로필인지는 **세션 토큰으로만** 정한다(`viewer`). 예전 화면이 보내는
 * `?userId=`·본문 `userId` 는 무시한다 — 믿으면 남의 키·성별을 읽고 바꿀 수 있다.
 * → lib/auth.ts
 */
export const runtime = "nodejs";

const THIS_YEAR = new Date().getFullYear();

export async function GET(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;
  const user = auth.viewer.doc;

  const profile = {
    name: user.name,
    heightCm: user.heightCm ?? null,
    gender: user.gender ?? null,
    birthYear: user.birthYear ?? null,
  };

  return NextResponse.json({
    ok: true,
    profile,
    /** 측정 기록에 필요한 값이 모두 있는지 */
    complete: Boolean(profile.heightCm && profile.gender && profile.birthYear),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;
  const { viewer } = auth;

  let body: {
    heightCm?: number;
    gender?: string;
    birthYear?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const heightCm = Number(body.heightCm);
  if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) {
    return NextResponse.json({ ok: false, error: "키를 확인해 주세요." }, { status: 400 });
  }

  const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
  if (!gender) {
    return NextResponse.json({ ok: false, error: "성별을 선택해 주세요." }, { status: 400 });
  }

  const birthYear = Number(body.birthYear);
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > THIS_YEAR) {
    return NextResponse.json({ ok: false, error: "출생연도를 확인해 주세요." }, { status: 400 });
  }

  await connectDB();
  const user = await getUserModel().findByIdAndUpdate(
    viewer.uid,
    { $set: { heightCm, gender, birthYear } },
    { new: true },
  );
  if (!user) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    profile: { heightCm, gender, birthYear },
    complete: true,
  });
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getBloodTestModel } from "@/models/BloodTest";
import { validateBloodTest, type ResultLike } from "@/lib/blood";
import { requireViewer } from "@/lib/auth";

export const runtime = "nodejs";

/** KST 기준 YYYY-MM-DD */
function toDateKey(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * GET /api/blood?limit= — 내 기록 최신순 목록.
 *
 * 소유자는 **세션 토큰에서만** 읽는다(`viewer.uid`). 예전 화면이 보내는
 * `?userId=` 는 무시한다 — 값을 믿으면 남의 `_id` 로 남의 기록을 볼 수 있다.
 * → lib/auth.ts
 */
export async function GET(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;
  const { viewer } = auth;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  await connectDB();
  const rows = await getBloodTestModel()
    .find({ userId: viewer.uid })
    .sort({ testedAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ ok: true, tests: rows });
}

/**
 * POST /api/blood — 검토를 마친 결과지 저장.
 * 같은 날짜 기록이 있으면 교체한다 (인바디와 같은 규칙).
 * 본문의 `userId` 는 무시하고 세션의 회원으로 저장한다.
 */
export async function POST(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;
  const userId = auth.viewer.uid;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const testedAtRaw = String(body.testedAt ?? "").trim();
  const testedAt = testedAtRaw ? new Date(testedAtRaw.replace(" ", "T")) : null;
  if (!testedAt || Number.isNaN(testedAt.getTime())) {
    return NextResponse.json({ ok: false, error: "검사일시를 확인해 주세요." }, { status: 400 });
  }

  const results = Array.isArray(body.results) ? (body.results as ResultLike[]) : [];
  if (results.length === 0) {
    return NextResponse.json(
      { ok: false, error: "저장할 검사 항목이 없어요." },
      { status: 400 },
    );
  }

  const warnings = validateBloodTest(results);
  const testedDate = toDateKey(testedAt);

  await connectDB();
  const saved = await getBloodTestModel().findOneAndUpdate(
    { userId, testedDate },
    {
      $set: {
        userId,
        testedAt,
        testedDate,
        results,
        etc: Array.isArray(body.etc) ? body.etc : [],
        lab: body.lab ?? {},
        source: body.source === "manual" ? "manual" : "photo",
        imageUrl: body.imageUrl ?? null,
        note: body.note ?? null,
        extraction: {
          model: body.model ?? null,
          warnings: warnings.map((w) => w.message),
          editedByUser: Boolean(body.editedByUser),
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return NextResponse.json({ ok: true, test: saved, warnings });
}

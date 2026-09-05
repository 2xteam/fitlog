import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getBloodTestModel } from "@/models/BloodTest";
import { validateBloodTest, type ResultLike } from "@/lib/blood";

export const runtime = "nodejs";

/** KST 기준 YYYY-MM-DD */
function toDateKey(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** GET /api/blood?userId=&limit= — 최신순 목록 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  await connectDB();
  const rows = await getBloodTestModel()
    .find({ userId })
    .sort({ testedAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ ok: true, tests: rows });
}

/**
 * POST /api/blood — 검토를 마친 결과지 저장.
 * 같은 날짜 기록이 있으면 교체한다 (인바디와 같은 규칙).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
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

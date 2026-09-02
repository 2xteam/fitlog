import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getMeasurementModel } from "@/models/Measurement";
import { computeDerived, validateMeasurement } from "@/lib/inbody";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/** KST 기준 YYYY-MM-DD */
function toDateKey(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** GET /api/measurements?userId=&limit= — 최신순 목록 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  await connectDB();
  const rows = await getMeasurementModel()
    .find({ userId })
    .sort({ measuredAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ ok: true, measurements: rows });
}

/**
 * POST /api/measurements — 검토를 마친 측정 저장.
 * 같은 날짜 기록이 있으면 교체한다(하루 여러 번 측정은 조건 차이라 의미가 없다).
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

  const measuredAtRaw = String(body.measuredAt ?? "").trim();
  const measuredAt = measuredAtRaw ? new Date(measuredAtRaw.replace(" ", "T")) : null;
  if (!measuredAt || Number.isNaN(measuredAt.getTime())) {
    return NextResponse.json(
      { ok: false, error: "검사일시를 확인해 주세요." },
      { status: 400 },
    );
  }

  await connectDB();

  const user = await getUserModel().findById(userId).lean();
  const heightCm = user?.heightCm ?? null;

  const doc = (body.data ?? {}) as Record<string, never>;
  const composition = (doc.composition ?? {}) as Record<string, { value?: number }>;
  const muscleFat = (doc.muscleFat ?? {}) as Record<string, { value?: number }>;
  const obesity = (doc.obesity ?? {}) as Record<string, { value?: number }>;
  const research = (doc.research ?? {}) as Record<string, number>;

  const warnings = validateMeasurement({
    weight: composition.weight?.value ?? null,
    totalBodyWater: composition.totalBodyWater?.value ?? null,
    protein: composition.protein?.value ?? null,
    mineral: composition.mineral?.value ?? null,
    bodyFatMass: composition.bodyFatMass?.value ?? null,
    fatFreeMass: composition.fatFreeMass?.value ?? null,
    skeletalMuscleMass: muscleFat.skeletalMuscleMass?.value ?? null,
    bmi: obesity.bmi?.value ?? null,
    percentBodyFat: obesity.percentBodyFat?.value ?? null,
    heightCm,
  });

  const derived = computeDerived({
    heightCm,
    skeletalMuscleMass: muscleFat.skeletalMuscleMass?.value ?? null,
    waistCircumference: research.waistCircumference ?? null,
  });

  const measuredDate = toDateKey(measuredAt);

  const saved = await getMeasurementModel().findOneAndUpdate(
    { userId, measuredDate },
    {
      $set: {
        ...doc,
        userId,
        measuredAt,
        measuredDate,
        derived,
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

  return NextResponse.json({ ok: true, measurement: saved, warnings });
}

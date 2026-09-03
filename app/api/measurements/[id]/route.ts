import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getMeasurementModel } from "@/models/Measurement";
import { getUserModel } from "@/models/User";
import { computeDerived, validateMeasurement } from "@/lib/inbody";

/** 측정 1건 조회·수정·삭제 */
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }

  await connectDB();
  const row = await getMeasurementModel().findOne({ _id: id, userId }).lean();
  if (!row) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, measurement: row });
}

/** 클라이언트가 건드리면 안 되는 필드 */
const PROTECTED = [
  "_id",
  "userId",
  "measuredAt",
  "measuredDate",
  "derived",
  "extraction",
  "createdAt",
  "updatedAt",
  "__v",
];

/**
 * 중첩 객체를 `a.b.c` 형태의 $set 경로로 편다.
 *
 * 배열(`etc`, `impedance`)과 값이 없는 리프는 그대로 통째로 넣는다 —
 * 배열은 부분 교체가 의미 없고, 화면이 항상 전체 목록을 보내기 때문이다.
 */
function flatten(prefix: string, value: unknown, out: Record<string, unknown>) {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out[prefix] = value;
      return;
    }
    for (const [k, v] of entries) flatten(`${prefix}.${k}`, v, out);
    return;
  }
  out[prefix] = value;
}

/** `a.b.c` 경로 묶음을 문서에 얹어 검증용 최종 형태를 만든다 */
function applyPaths(
  doc: Record<string, unknown>,
  set: Record<string, unknown>,
): Record<string, unknown> {
  for (const [path, value] of Object.entries(set)) {
    const parts = path.split(".");
    let cur = doc;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const k = parts[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return doc;
}

/** KST 기준 YYYY-MM-DD */
function toDateKey(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * PATCH — 저장된 기록을 고친다.
 *
 * 저장(POST)은 날짜 기준 upsert라 날짜를 바꾸면 다른 기록을 덮어쓴다.
 * 수정은 **이 문서만** 건드려야 하므로 별도로 둔다.
 * 보내지 않은 필드는 그대로 두고, 검증·파생값만 다시 계산한다.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

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

  await connectDB();
  const current = await getMeasurementModel().findOne({ _id: id, userId }).lean();
  if (!current) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const set: Record<string, unknown> = {};

  // 검사일시 — 날짜가 바뀌면 같은 날 기록과 부딪히는지 먼저 본다
  if (body.measuredAt !== undefined) {
    const raw = String(body.measuredAt ?? "").trim();
    const measuredAt = raw ? new Date(raw.replace(" ", "T")) : null;
    if (!measuredAt || Number.isNaN(measuredAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "검사일시를 확인해 주세요." },
        { status: 400 },
      );
    }
    const measuredDate = toDateKey(measuredAt);
    if (measuredDate !== current.measuredDate) {
      const clash = await getMeasurementModel()
        .findOne({ userId, measuredDate, _id: { $ne: id } })
        .lean();
      if (clash) {
        return NextResponse.json(
          {
            ok: false,
            error: `${measuredDate} 기록이 이미 있어요. 날짜를 바꾸려면 그 기록을 먼저 지워주세요.`,
          },
          { status: 409 },
        );
      }
    }
    set.measuredAt = measuredAt;
    set.measuredDate = measuredDate;
  }

  // 수치 — **보낸 잎(leaf)만** 바꾼다.
  // 구획을 통째로 $set 하면 payload 에 없는 형제 필드가 통째로 지워진다.
  // (`{composition: {totalBodyWater: …}}` 하나로 체중·단백질이 날아간다)
  const data = (body.data ?? null) as Record<string, unknown> | null;
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (PROTECTED.includes(key)) continue;
      flatten(key, value, set);
    }
  }

  if (body.imageUrl !== undefined) set.imageUrl = body.imageUrl || null;
  if (body.note !== undefined) set.note = body.note || null;

  // 검증·파생값은 바뀐 값 기준으로 다시 계산한다
  const merged = applyPaths(
    structuredClone(current) as unknown as Record<string, unknown>,
    set,
  );
  const composition = (merged.composition ?? {}) as Record<string, { value?: number }>;
  const muscleFat = (merged.muscleFat ?? {}) as Record<string, { value?: number }>;
  const obesity = (merged.obesity ?? {}) as Record<string, { value?: number }>;
  const research = (merged.research ?? {}) as Record<string, number>;

  const user = await getUserModel().findById(userId).lean();
  const heightCm = user?.heightCm ?? null;

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

  set.derived = computeDerived({
    heightCm,
    skeletalMuscleMass: muscleFat.skeletalMuscleMass?.value ?? null,
    waistCircumference: research.waistCircumference ?? null,
  });

  set.extraction = {
    ...(current.extraction ?? {}),
    warnings: warnings.map((w) => w.message),
    editedByUser: true,
  };

  const saved = await getMeasurementModel()
    .findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true })
    .lean();

  return NextResponse.json({ ok: true, measurement: saved, warnings });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }

  await connectDB();
  const res = await getMeasurementModel().deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getWeightLogModel } from "@/models/WeightLog";

/**
 * 체중 기록.
 *
 * 인바디는 몇 달에 한 번이지만 체중계는 매일 잴 수 있어 컬렉션을 분리했다.
 * 하루 1건만 유지한다(같은 날 다시 기록하면 덮어쓴다).
 */
export const runtime = "nodejs";

/** KST 기준 YYYY-MM-DD */
function todayKey(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 400), 1000);

  await connectDB();
  const rows = await getWeightLogModel()
    .find({ userId })
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ ok: true, weights: rows });
}

export async function POST(req: Request) {
  let body: {
    userId?: string;
    date?: string;
    weightKg?: number;
    percentBodyFat?: number | null;
    memo?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const weightKg = Number(body.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 250) {
    return NextResponse.json({ ok: false, error: "체중을 확인해 주세요." }, { status: 400 });
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : todayKey();

  const pbf =
    body.percentBodyFat != null && Number.isFinite(Number(body.percentBodyFat))
      ? Number(body.percentBodyFat)
      : null;

  await connectDB();
  const saved = await getWeightLogModel().findOneAndUpdate(
    { userId, date },
    {
      $set: {
        userId,
        date,
        weightKg,
        percentBodyFat: pbf,
        memo: body.memo ?? null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return NextResponse.json({ ok: true, weight: saved });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  const date = url.searchParams.get("date")?.trim();
  if (!userId || !date) {
    return NextResponse.json(
      { ok: false, error: "userId와 date가 필요합니다." },
      { status: 400 },
    );
  }

  await connectDB();
  await getWeightLogModel().deleteOne({ userId, date });
  return NextResponse.json({ ok: true });
}

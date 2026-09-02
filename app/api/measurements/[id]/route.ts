import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getMeasurementModel } from "@/models/Measurement";

/** 측정 1건 조회·삭제 */
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

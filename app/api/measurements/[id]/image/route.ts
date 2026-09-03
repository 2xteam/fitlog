import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { connectDB } from "@/lib/db";
import { getMeasurementModel } from "@/models/Measurement";
import { getR2Bucket, getR2Client, getR2PublicUrl } from "@/lib/r2";
import { readMultipartImage } from "@/lib/readMultipartImage";

export const runtime = "nodejs";

/**
 * POST /api/measurements/:id/image — 결과지 원본을 나중에 붙인다.
 *
 * 추출 당시 R2 설정이 없었거나 업로드가 실패해 원본이 비어 있는 기록이 있다.
 * 값은 그대로 두고 사진만 채우려고 따로 둔다.
 * 본문 상한은 4MB(`readMultipartImage`) — 그 위는 Vercel이 함수에 닿기 전에 자른다.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const read = await readMultipartImage(req);
  if (!read.ok) return read.response;

  const userId = read.userId?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  await connectDB();
  const row = await getMeasurementModel().findOne({ _id: id, userId }).lean();
  if (!row) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  let imageUrl: string;
  try {
    const ext = read.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const key = `fitlog/${userId}/${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.${ext}`;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        Body: read.buffer,
        ContentType: read.mimeType,
      }),
    );
    imageUrl = `${getR2PublicUrl().replace(/\/$/, "")}/${key}`;
  } catch (e) {
    console.error("[measurements/image] R2", e);
    return NextResponse.json(
      { ok: false, error: "원본 보관에 실패했어요. R2 설정을 확인해 주세요." },
      { status: 502 },
    );
  }

  await getMeasurementModel().updateOne({ _id: id, userId }, { $set: { imageUrl } });

  return NextResponse.json({ ok: true, imageUrl });
}

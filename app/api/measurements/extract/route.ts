import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";
import { readMultipartImage } from "@/lib/readMultipartImage";
import { extractInBodyFromImage, VISION_MODEL } from "@/lib/inbodyVision";
import { validateMeasurement, computeDerived } from "@/lib/inbody";
import { isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Bucket, getR2Client, getR2PublicUrl } from "@/lib/r2";
import crypto from "node:crypto";

/**
 * 인바디 결과지 사진 → 구조화 데이터 추출.
 * 저장은 하지 않는다. 사용자가 검토·수정한 뒤 `/api/measurements`로 저장한다.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isOpenAiKeyConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OpenAI API 키가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const parsed = await readMultipartImage(req);
  if (!parsed.ok) return parsed.response;

  const { buffer, mimeType, userId } = parsed;

  // 키·성별·생년이 없으면 추출을 진행하지 않는다(표준범위·검증에 필요).
  let heightCm: number | null = null;
  if (userId) {
    await connectDB();
    const user = await getUserModel().findById(userId).lean();
    if (!user?.heightCm || !user?.gender || !user?.birthYear) {
      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_REQUIRED",
          message: "키·성별·출생연도를 먼저 입력해 주세요.",
        },
        { status: 428 },
      );
    }
    heightCm = user.heightCm;
  }

  let data;
  try {
    data = await extractInBodyFromImage(buffer, mimeType);
  } catch (e) {
    console.error("[measurements/extract]", e);
    return NextResponse.json(
      { ok: false, error: "결과지를 분석하지 못했습니다. 사진이 선명한지 확인해 주세요." },
      { status: 502 },
    );
  }

  // 정합성 검사 — 숫자 오인식을 검토 화면에서 잡아내기 위한 경고
  const warnings = validateMeasurement({
    weight: data.composition?.weight?.value ?? null,
    totalBodyWater: data.composition?.totalBodyWater?.value ?? null,
    protein: data.composition?.protein?.value ?? null,
    mineral: data.composition?.mineral?.value ?? null,
    bodyFatMass: data.composition?.bodyFatMass?.value ?? null,
    fatFreeMass: data.composition?.fatFreeMass?.value ?? null,
    skeletalMuscleMass: data.muscleFat?.skeletalMuscleMass?.value ?? null,
    bmi: data.obesity?.bmi?.value ?? null,
    percentBodyFat: data.obesity?.percentBodyFat?.value ?? null,
    heightCm: heightCm ?? data.profile?.heightCm ?? null,
  });

  const derived = computeDerived({
    heightCm: heightCm ?? data.profile?.heightCm ?? null,
    skeletalMuscleMass: data.muscleFat?.skeletalMuscleMass?.value ?? null,
    waistCircumference: data.research?.waistCircumference ?? null,
  });

  // 결과지 원본을 보관한다. 추출 오류를 나중에 확인하거나,
  // etc 항목을 정식 필드로 승격할 때 다시 뽑기 위해서다.
  let imageUrl: string | null = null;
  try {
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const key = `fitlog/${userId ?? "unknown"}/${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.${ext}`;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    imageUrl = `${getR2PublicUrl().replace(/\/$/, "")}/${key}`;
  } catch (e) {
    // 보관에 실패해도 추출 결과는 돌려준다
    console.error("[measurements/extract] R2", e);
  }

  return NextResponse.json({
    ok: true,
    data: { ...data, derived },
    warnings,
    imageUrl,
    model: VISION_MODEL,
  });
}

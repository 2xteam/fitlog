import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readMultipartImage } from "@/lib/readMultipartImage";
import { extractBloodTestFromImage, VISION_MODEL } from "@/lib/bloodVision";
import { attachCodes, validateBloodTest } from "@/lib/blood";
import { isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { describeR2Error, getR2Bucket, getR2Client, getR2PublicUrl } from "@/lib/r2";

/**
 * 피검사 결과지 사진 → 구조화 데이터 추출.
 * 저장은 하지 않는다. 사용자가 검토·수정한 뒤 `/api/blood`로 저장한다.
 *
 * 인바디와 달리 **프로필 게이트를 두지 않는다.** 인바디는 키·성별·나이가 없으면
 * 표준범위와 기초대사량 해석이 불가능해서 428로 막았지만, 피검사는 참고치가
 * 결과지에 인쇄되어 온다. 프로필이 없어도 기록 자체는 온전하다.
 * (나이·성별은 나중에 보정 맥락을 덧붙일 때만 쓴다.)
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

  let data;
  try {
    data = await extractBloodTestFromImage(buffer, mimeType);
  } catch (e) {
    console.error("[blood/extract]", e);
    return NextResponse.json(
      { ok: false, error: "결과지를 분석하지 못했습니다. 사진이 선명한지 확인해 주세요." },
      { status: 502 },
    );
  }

  // 카탈로그에 붙이고, 못 붙인 줄은 etc로 넘긴다 — 버리면 다시 못 살린다
  const { results, unmatched } = attachCodes(data.results ?? []);

  // 계산으로 확인되는 관계로 숫자 오인식을 잡는다
  const warnings = validateBloodTest(results);

  // 결과지 원본을 보관한다. 추출 오류를 나중에 확인하거나,
  // etc 항목을 정식 항목으로 승격할 때 다시 뽑기 위해서다.
  let imageUrl: string | null = null;
  let imageError: string | null = null;
  try {
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const key = `fitlog/blood/${userId ?? "unknown"}/${Date.now()}-${crypto
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
    // 보관에 실패해도 추출 결과는 돌려준다. 다만 조용히 넘어가지 않는다.
    console.error("[blood/extract] R2", e);
    imageError = `${describeR2Error(e)} 값은 그대로 저장돼요. 나중에 수정 화면에서 사진만 다시 붙일 수 있어요.`;
  }

  return NextResponse.json({
    ok: true,
    testedAt: data.testedAt,
    lab: data.lab,
    results,
    etc: unmatched.map((r) => ({
      label: r.name,
      value: r.value != null ? String(r.value) : null,
      unit: r.unit ?? null,
      refText: r.refText ?? null,
    })),
    warnings,
    imageUrl,
    imageError,
    model: VISION_MODEL,
  });
}

import { NextResponse } from "next/server";
import { normalizeRequestInstructions } from "@/lib/openaiInstructions";

/**
 * Vercel Functions는 요청 본문이 4.5MB를 넘으면 함수에 닿기도 전에
 * FUNCTION_PAYLOAD_TOO_LARGE로 잘린다. 그래서 서버 상한도 그 아래로 맞췄다.
 * 클라이언트는 업로드 전에 이미지를 축소한다(`lib/clientImageResize.ts`).
 */
const MAX_BYTES = 4 * 1024 * 1024;

export type ReadMultipartImageResult =
  | { ok: true; buffer: Buffer; mimeType: string; instructions?: string; userId?: string }
  | { ok: false; response: NextResponse };

export async function readMultipartImage(
  req: Request,
): Promise<ReadMultipartImageResult> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "multipart/form-data만 지원합니다." },
        { status: 415 },
      ),
    };
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "file 필드에 이미지를 첨부하세요." },
        { status: 400 },
      ),
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "이미지 파일만 업로드할 수 있습니다." },
        { status: 400 },
      ),
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "이미지 용량이 너무 큽니다. (최대 4MB) 사진 크기를 줄여서 다시 시도해 주세요.",
        },
        { status: 413 },
      ),
    };
  }

  const instructions = normalizeRequestInstructions(formData.get("instructions"));
  const userIdField = formData.get("userId");
  const userId = typeof userIdField === "string" ? userIdField.trim() : undefined;

  return {
    ok: true,
    buffer: Buffer.from(arrayBuffer),
    mimeType: file.type?.trim() || "image/jpeg",
    ...(instructions ? { instructions } : {}),
    ...(userId ? { userId } : {}),
  };
}

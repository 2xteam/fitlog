/**
 * 업로드 전 브라우저에서 이미지를 줄인다.
 *
 * 필요한 이유:
 * 1) Vercel Functions는 요청 본문이 4.5MB를 넘으면 함수에 닿기 전에
 *    FUNCTION_PAYLOAD_TOO_LARGE로 잘린다. 휴대폰 사진은 쉽게 넘는다.
 * 2) OpenAI Vision은 긴 변 2000px 이상에서 정확도 이득이 거의 없다.
 *    작게 보내면 업로드도 빠르고 토큰 비용도 줄어든다.
 */

/** Vision 입력으로 충분한 크기 */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.82;
/** 이 크기를 넘으면 업로드를 시도하지 않고 안내한다(플랫폼 한도 4.5MB 아래로 여유) */
export const UPLOAD_HARD_LIMIT_BYTES = 4 * 1024 * 1024;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * 이미지를 긴 변 2000px 이내 JPEG로 변환한다.
 * 변환할 수 없거나(디코딩 실패 등) 이득이 없으면 원본 File을 그대로 돌려준다.
 */
export async function shrinkImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    // EXIF 회전을 반영해 디코드한다(세로로 찍은 사진이 눕지 않도록).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return file;
    // 투명 영역이 검게 나오지 않도록 흰 배경을 깔고 그린다.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^/.]+$/i, "") || "image"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

/** 업로드 가능한 크기인지 확인. 불가하면 사용자에게 보여줄 메시지를 돌려준다. */
export function checkUploadSize(file: File): { ok: true } | { ok: false; error: string } {
  if (file.size <= UPLOAD_HARD_LIMIT_BYTES) return { ok: true };
  return {
    ok: false,
    error: `이미지 용량이 너무 큽니다. (${(file.size / (1024 * 1024)).toFixed(1)}MB) 사진 크기를 줄여서 다시 시도해 주세요.`,
  };
}

import { S3Client } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 환경변수가 설정되지 않았습니다. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY를 확인하세요.",
    );
  }

  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _client;
}

export function getR2Bucket(): string {
  return process.env.R2_BUCKET_NAME ?? "snapnote-uploads";
}

export function getR2PublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("R2_PUBLIC_URL 환경변수가 설정되지 않았습니다.");
  return url.replace(/\/+$/, "");
}

/**
 * R2 오류를 사용자에게 보여줄 한 줄로 바꾼다.
 *
 * 403이 가장 흔한데 원인이 둘로 갈린다 — 토큰이 그 버킷 범위가 아니거나,
 * 읽기 전용이거나. 어느 쪽이든 "설정을 확인하세요"로는 고칠 수 없어서
 * 무엇을 봐야 하는지까지 적는다. `npm run r2:check` 로 바로 확인할 수 있다.
 */
export function describeR2Error(e: unknown): string {
  const status =
    typeof e === "object" && e !== null && "$metadata" in e
      ? (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
  const bucket = process.env.R2_BUCKET_NAME ?? "(버킷 미설정)";

  if (status === 403) {
    return `원본 보관에 실패했어요. R2 토큰이 '${bucket}' 버킷에 쓸 수 없어요 (403). Cloudflare에서 이 버킷을 포함한 Object Read & Write 토큰인지 확인해 주세요.`;
  }
  if (status === 404) {
    return `원본 보관에 실패했어요. '${bucket}' 버킷을 찾을 수 없어요 (404).`;
  }
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return "원본 보관에 실패했어요. R2 환경 변수가 설정되지 않았어요.";
  }
  return `원본 보관에 실패했어요. R2 요청이 실패했습니다${status ? ` (${status})` : ""}.`;
}

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

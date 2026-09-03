/**
 * R2 설정 점검 — `npm run r2:check`
 *
 * 업로드가 실패해도 앱은 값만 저장하고 넘어가므로 원인이 잘 드러나지 않는다.
 * 이 스크립트는 실제로 PUT → 공개 URL GET → DELETE 까지 해보고 어디서 막히는지 알려준다.
 *
 * 자주 나오는 원인:
 *   - 토큰이 **다른 버킷 범위**로 만들어졌다 (HeadBucket 부터 403)
 *   - 토큰이 읽기 전용이다 (Head 는 되는데 Put 만 403)
 *   - R2_PUBLIC_URL 이 다른 버킷의 공개 도메인이다 (업로드는 되는데 GET 404)
 */
import fs from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ENV_FILE = process.argv[2] ?? ".env.local";

function readEnvFile(file) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile(ENV_FILE);
const env = { ...fileEnv, ...process.env };

const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error(`✗ 없는 환경 변수: ${missing.join(", ")}`);
  process.exit(1);
}

const bucket = env.R2_BUCKET_NAME;
const publicUrl = env.R2_PUBLIC_URL.replace(/\/+$/, "");

console.log(`계정   ${env.R2_ACCOUNT_ID.slice(0, 6)}…${env.R2_ACCOUNT_ID.slice(-4)}`);
console.log(`키     ${env.R2_ACCESS_KEY_ID.slice(0, 6)}…${env.R2_ACCESS_KEY_ID.slice(-4)}`);
console.log(`버킷   ${bucket}`);
console.log(`공개   ${publicUrl}`);
console.log("");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const key = `_healthcheck/${Date.now()}.txt`;
let putOk = false;

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`✓ 버킷 접근 (HeadBucket)`);
} catch (e) {
  const code = e?.$metadata?.httpStatusCode;
  console.error(`✗ 버킷 접근 실패 (${code ?? e.name})`);
  if (code === 403) {
    console.error(
      `  토큰이 '${bucket}' 버킷 범위가 아니거나 다른 계정의 토큰입니다.\n` +
        `  Cloudflare → R2 → Manage API tokens 에서 이 버킷을 포함한\n` +
        `  Object Read & Write 토큰을 새로 만들어 주세요.`,
    );
  }
  if (code === 404) console.error(`  '${bucket}' 버킷이 이 계정에 없습니다.`);
  process.exit(1);
}

try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: "fitlog r2 healthcheck",
      ContentType: "text/plain",
    }),
  );
  putOk = true;
  console.log(`✓ 업로드 (PutObject)`);
} catch (e) {
  const code = e?.$metadata?.httpStatusCode;
  console.error(`✗ 업로드 실패 (${code ?? e.name})`);
  if (code === 403) console.error(`  읽기 전용 토큰입니다. Object Read & Write 로 다시 만드세요.`);
  process.exit(1);
}

try {
  const res = await fetch(`${publicUrl}/${key}`);
  if (res.ok) {
    console.log(`✓ 공개 URL 확인 (${res.status})`);
  } else {
    console.error(`✗ 공개 URL 응답 ${res.status}`);
    console.error(
      `  R2_PUBLIC_URL 이 '${bucket}' 의 공개 도메인이 맞는지 확인하세요.\n` +
        `  (다른 버킷의 pub-….r2.dev 주소를 복사해 넣으면 업로드는 되고 조회만 실패합니다)\n` +
        `  R2 → ${bucket} → Settings → Public Development URL`,
    );
  }
} catch (e) {
  console.error(`✗ 공개 URL 요청 실패: ${e.message}`);
} finally {
  if (putOk) {
    await client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .then(() => console.log(`✓ 정리 완료 (${key})`))
      .catch(() => console.error(`! 점검 파일이 남았습니다: ${key}`));
  }
}

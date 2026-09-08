import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getR2Bucket, getR2Client, getR2PublicUrl } from "@/lib/r2";

/**
 * R2 에 올린 파일을 지운다 — **DB 에 적힌 공개 URL 을 역산해서.**
 *
 * ## 왜 URL 역산인가
 *
 * 접두사(`ListObjectsV2` + `Prefix`)로 쓸어 담는 편이 고아 파일까지 잡아서
 * 깔끔하지만, **키 규칙이 앱마다 달라서 쓸 수 없다.**
 *
 * ```
 * fitlog 인바디   fitlog/{userId}/…           사용자별  → 접두사 가능
 * fitlog 피검사   fitlog/blood/{userId}/…     사용자별  → 접두사 가능
 * SnapNote        {phone}/{noteId}/…          전화번호별. 번호가 없으면 파일명만
 * 2hbk            profiles/{uuid} · goals/{uuid}   사용자 정보가 **아예 없다**
 * ```
 *
 * 2hbk 키에는 누구 것인지가 남아 있지 않고, SnapNote 는 전화번호가 없는 계정이면
 * 버킷 루트에 파일명만으로 놓인다. 그래서 **DB 의 `imageUrl` 이 유일한 단서**다.
 * SnapNote 의 오답 항목 삭제가 이미 같은 방식을 쓴다.
 *
 * ## 한계 — 정직하게 적어 둔다
 *
 * **고아 파일은 못 지운다.** 올라갔지만 DB 행이 없는 파일(업로드 직후 실패,
 * 예전에 행만 지운 것)은 단서가 없어 남는다. fitlog 처럼 키가 사용자별인 앱은
 * 접두사로 쓸어 담는 방법을 나중에 더할 수 있지만, 2hbk 는 방법이 없다.
 * 그쪽을 정말 해결하려면 **업로드할 때 키에 사용자를 넣도록 바꿔야 한다.**
 *
 * ## 실패해도 멈추지 않는다
 *
 * 파일이 안 지워졌다고 DB 삭제를 멈추면 그 사람은 영영 폐기되지 않는다 —
 * 방침에 적은 6개월이 지켜지지 않는다. 실패는 로그로 남기고 계속한다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/** 공개 URL → 버킷 안의 키. 우리 버킷이 아니면 `null` */
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null;
  let base: string;
  try {
    base = getR2PublicUrl();
  } catch {
    return null; // R2 설정이 없는 배포
  }
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length).replace(/^\/+/, "");
  return key || null;
}

/**
 * 여러 파일을 한 번에 지운다. 지운 개수를 돌려준다.
 *
 * `DeleteObjects` 는 한 번에 1000개까지라 나눠 보낸다.
 */
export async function deleteR2Objects(urls: string[]): Promise<number> {
  const keys = Array.from(
    new Set(urls.map(keyFromPublicUrl).filter((k): k is string => Boolean(k))),
  );
  if (keys.length === 0) return 0;

  let removed = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    try {
      const res = await getR2Client().send(
        new DeleteObjectsCommand({
          Bucket: getR2Bucket(),
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      removed += chunk.length - (res.Errors?.length ?? 0);
      for (const e of res.Errors ?? []) {
        console.error(`[purge] R2 삭제 실패 ${e.Key} — ${e.Code} ${e.Message}`);
      }
    } catch (e) {
      /* 여기서 멈추면 그 사람은 영영 폐기되지 않는다. 남기고 계속한다 */
      console.error("[purge] R2 삭제 요청 실패", e);
    }
  }
  return removed;
}

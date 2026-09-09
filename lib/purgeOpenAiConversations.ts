import OpenAI from "openai";

/**
 * OpenAI 쪽에 남은 대화를 지운다.
 *
 * AI 상담의 대화 본문은 우리 DB 에 없고 **OpenAI Conversations 에만** 있다
 * (`chat_threads.openAiConversationId`). 탈퇴 폐기가 우리 쪽 스레드만 지우면
 * 방침의 "6개월 뒤 폐기" 가 OpenAI 측에는 미치지 않는다. 그래서 스레드를 지우기
 * **전에** 이 함수로 대화 삭제를 요청한다.
 *
 * 실패해도 던지지 않는다 — 여기서 멈추면 그 사람은 영영 폐기되지 않는다.
 * 지운 개수와 실패 개수를 돌려주고, 부르는 쪽이 결과에 적는다.
 *
 * 세 앱(fitlog · SnapWord · SnapNote)에 같은 파일이 있다.
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 7번
 */
export async function deleteOpenAiConversations(
  ids: Array<string | null | undefined>,
): Promise<{ deleted: number; failed: number; skipped: number }> {
  const targets = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))];
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || targets.length === 0) return { deleted: 0, failed: 0, skipped: targets.length };

  const client = new OpenAI({ apiKey });
  let deleted = 0;
  let failed = 0;
  for (const id of targets) {
    try {
      await client.conversations.delete(id);
      deleted += 1;
    } catch (err) {
      // 이미 없는 대화(404)는 지워진 것으로 본다
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        deleted += 1;
        continue;
      }
      failed += 1;
      console.error("[purge] OpenAI conversation delete failed", id, err instanceof Error ? err.message : err);
    }
  }
  return { deleted, failed, skipped: 0 };
}

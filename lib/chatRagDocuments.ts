/**
 * 채팅용 RAG 참고 문서. 키워드 매칭으로 관련 청크를 골라 프롬프트에 넣습니다.
 * 정책 청크는 항상 포함됩니다. 새 주제는 `CHAT_RAG_CHUNKS`에 항목을 추가하세요.
 *
 * ⚠️ **주제 청크는 여기 손으로 쓰지 않습니다.** 인바디는 `lib/inbodyRagChunks.ts`,
 * 피검사는 `lib/bloodRagChunks.ts`가 카탈로그에서 생성해 붙입니다.
 *
 * 예전에는 인바디 주제 5개를 손으로 썼는데, 그래서 갈라졌습니다 — `FIELDS`는 36개인데
 * 상담사는 4개만 알았고, 조언에 출처가 없었습니다. 화면과 상담사가 같은 질문에
 * 다르게 답하면 어느 쪽을 믿어야 할지 알 수 없습니다.
 *
 * 여기 남는 것은 **정책 청크와 앱 사용법**처럼 카탈로그에서 나올 수 없는 것뿐입니다.
 */

import { BLOOD_RAG_CHUNKS } from "@/lib/bloodRagChunks";
import { INBODY_RAG_CHUNKS } from "@/lib/inbodyRagChunks";

export type ChatRagChunk = {
  id: string;
  /** 사용자 문장에 부분 문자열로 포함되면 가중 */
  keywords: string[];
  body: string;
  /** 기본 0. 정책은 별도 항상 포함 */
  baseScore?: number;
};

const POLICY_ID = "policy_body_composition_only";

/** 정책·주제별 참고 본문 */
export const CHAT_RAG_CHUNKS: ChatRagChunk[] = [
  {
    id: POLICY_ID,
    keywords: [],
    baseScore: 0,
    body: `## FitLog 채팅 정책 (RAG)

이 채널은 **인바디·피검사 기록 해석과 생활 습관 상담**만 지원합니다.

1) 허용: 인바디 수치와 피검사 항목의 뜻과 읽는 법, 기록 사이의 변화 해석,
   체중·골격근량·체지방률 목표 잡기, 일반적인 운동·식사·수면·수분 습관 조언,
   앱 사용법(결과지 등록·수정·그래프 보기).
2) 비허용: 질병 진단, 약·보충제 처방, 특정 질환 치료법 안내, 극단적 단식·급격한 감량 유도,
   실시간 사실 조회(날씨·뉴스·주가), 타인 사칭.
   **피검사 수치로 병을 단정하지 않습니다.** 기준선을 넘었다는 것과 진료에서 확인할
   일이라는 것까지만 말합니다.
3) 건강 이상 신호(급격한 부종, 이유 없는 체중 급감, 통증 등)가 보이면 **진료를 권합니다.**
   숫자만 보고 병을 단정하지 않습니다.
4) 수치는 **사용자의 실제 기록**을 근거로 말합니다. 기록에 없는 값을 지어내지 않고,
   없으면 "그 항목은 기록에 없다"고 밝힙니다.
5) 운동·식습관·영양제를 권할 때는 **근거 등급(A~D)을 함께 말합니다.** 등급이 없는 조언은
   하지 않습니다. 영양제는 결핍이 확인된 항목에만 말하고 용량은 말하지 않습니다.`,
  },
  {
    id: "topic_app_usage",
    keywords: ["앱", "등록", "수정", "그래프", "사진", "결과지", "기록", "삭제", "원본"],
    body: `## 주제: FitLog 사용법

- 결과지 사진을 올리면 수치를 읽어 검토 화면을 거쳐 저장한다. 여러 장을 한 번에 올릴 수 있다.
- 결과지가 없는 날은 체중만 기록할 수 있다(같은 인바디 기록으로 저장된다).
- Inbody 화면에서 최근 상태(삼각 그래프) → 항목별 추이 → 등록된 결과지 순으로 본다.
- 잘못 읽힌 값은 기록 상세 → "이 기록 수정"에서 고친다. 원본 사진도 나중에 붙일 수 있다.`,
  },
];

function tokenizeForMatch(s: string): Set<string> {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (const m of lower.matchAll(/[\p{L}\p{N}]+/gu)) {
    const w = m[0];
    if (w.length >= 2) out.add(w);
  }
  return out;
}

function scoreChunk(userText: string, tokens: Set<string>, c: ChatRagChunk): number {
  let score = c.baseScore ?? 0;
  const lowerUser = userText.toLowerCase();
  for (const kw of c.keywords) {
    const k = kw.toLowerCase();
    if (k.length === 0) continue;
    if (lowerUser.includes(k)) score += 12;
    if (tokens.has(k)) score += 4;
  }
  if (c.id === POLICY_ID) return 9999;
  const bodyLower = c.body.toLowerCase();
  for (const t of tokens) {
    if (t.length >= 4 && bodyLower.includes(t)) score += 0.35;
  }
  return score;
}

/** 정책·사용법(손으로) + 인바디·피검사(카탈로그에서 생성) */
const ALL_CHUNKS: ChatRagChunk[] = [
  ...CHAT_RAG_CHUNKS,
  ...INBODY_RAG_CHUNKS,
  ...BLOOD_RAG_CHUNKS,
];

/** 사용자 질문에 맞춰 참고 문서 문자열을 만듭니다. 정책 청크는 항상 포함합니다. */
export function buildChatRagContext(userText: string, maxChars = 4200): string {
  const trimmed = userText.trim();
  const tokens = tokenizeForMatch(trimmed);
  const policy = ALL_CHUNKS.find((c) => c.id === POLICY_ID);
  const others = ALL_CHUNKS.filter((c) => c.id !== POLICY_ID);
  const ranked = others
    .map((c) => ({ c, s: scoreChunk(trimmed, tokens, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const blocks: string[] = [];
  if (policy) blocks.push(`### ${policy.id}\n${policy.body.trim()}`);
  let used = blocks.join("\n\n").length;
  const sep = "\n\n";
  for (const { c } of ranked) {
    const next = `### ${c.id}\n${c.body.trim()}`;
    if (used + sep.length + next.length > maxChars) break;
    blocks.push(next);
    used += sep.length + next.length;
  }
  return blocks.join("\n\n");
}

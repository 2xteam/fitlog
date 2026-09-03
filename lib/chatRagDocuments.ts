/**
 * 채팅용 RAG 참고 문서. 키워드 매칭으로 관련 청크를 골라 프롬프트에 넣습니다.
 * 정책 청크는 항상 포함됩니다. 새 주제는 `CHAT_RAG_CHUNKS`에 항목을 추가하세요.
 */

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

이 채널은 **체성분 기록 해석과 생활 습관 상담**만 지원합니다.

1) 허용: 인바디 수치의 뜻과 읽는 법, 기록 사이의 변화 해석, 체중·골격근량·체지방률 목표 잡기,
   일반적인 운동·식사·수면·수분 습관 조언, 앱 사용법(결과지 등록·수정·그래프 보기).
2) 비허용: 질병 진단, 약·보충제 처방, 특정 질환 치료법 안내, 극단적 단식·급격한 감량 유도,
   실시간 사실 조회(날씨·뉴스·주가), 타인 사칭.
3) 건강 이상 신호(급격한 부종, 이유 없는 체중 급감, 통증 등)가 보이면 **진료를 권합니다.**
   숫자만 보고 병을 단정하지 않습니다.
4) 수치는 **사용자의 실제 기록**을 근거로 말합니다. 기록에 없는 값을 지어내지 않고,
   없으면 "그 항목은 기록에 없다"고 밝힙니다.`,
  },
  {
    id: "topic_body_fat",
    keywords: ["체지방", "지방", "감량", "다이어트", "살", "복부", "내장지방", "체지방률"],
    body: `## 주제: 체지방

- 체지방률은 체지방량 ÷ 체중 × 100. 인바디 기준 적정은 보통 남 10~20%, 여 18~28%다.
- 감량 속도는 주당 체중의 0.5~1%가 무난하다. 그보다 빠르면 근육이 함께 준다.
- 부위만 골라 빼는 감량은 없다. 전체 열량 수지와 근력 운동을 함께 본다.
- 내장지방레벨(또는 내장지방단면적)이 높으면 허리둘레와 함께 본다.`,
  },
  {
    id: "topic_muscle",
    keywords: ["근육", "골격근", "근력", "웨이트", "단백질", "벌크", "근손실", "smi"],
    body: `## 주제: 골격근량

- 골격근량은 팔·다리·몸통 근육량의 합이다. 제지방량(체중 − 체지방량)보다 작다.
- 늘리려면 주 2~4회 근력 운동 + 체중 1kg당 단백질 1.2~1.6g가 흔한 권장선이다.
- 한 달에 0.5~1kg만 늘어도 빠른 편이다. 체중이 함께 늘 수 있다.
- SMI(골격근지수) = 사지근육량 ÷ 키(m)². 근감소 평가에 쓰인다.`,
  },
  {
    id: "topic_water",
    keywords: ["체수분", "부종", "수분", "세포외수분", "ecw", "붓", "짜게"],
    body: `## 주제: 체수분과 부종

- 세포외수분비(ECW/TBW)가 0.390을 넘으면 부종 경향으로 본다(기종마다 기준 표기가 다르다).
- 짠 음식·수면 부족·과한 운동 다음 날 일시적으로 오른다.
- 계속 높거나 한쪽만 높으면 진료를 권한다. 채팅에서 원인을 단정하지 않는다.`,
  },
  {
    id: "topic_bmr",
    keywords: ["기초대사량", "bmr", "칼로리", "열량", "식단", "섭취", "먹"],
    body: `## 주제: 기초대사량과 섭취

- 기초대사량은 가만히 있어도 쓰는 열량이다. 근육량이 늘면 함께 오른다.
- 감량 중이라도 기초대사량 아래로 먹는 식단은 권하지 않는다.
- 활동량을 곱한 값(대략 1.2~1.7배)이 하루 소비량의 대략치다.`,
  },
  {
    id: "topic_measure_condition",
    keywords: ["측정", "조건", "언제", "아침", "공복", "재는", "정확", "오차"],
    body: `## 주제: 측정 조건

같은 조건에서 재야 비교가 된다.

- 아침 공복, 화장실 다녀온 뒤, 운동 전이 가장 안정적이다.
- 식사·수분·운동 직후에는 체수분이 흔들려 체지방률이 1~2%p까지 달라 보인다.
- 하루에 여러 번 잰 값의 차이는 몸이 변한 게 아니라 조건 차이다.
  FitLog가 날짜당 1건만 두는 이유다.`,
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

/** 사용자 질문에 맞춰 참고 문서 문자열을 만듭니다. 정책 청크는 항상 포함합니다. */
export function buildChatRagContext(userText: string, maxChars = 4200): string {
  const trimmed = userText.trim();
  const tokens = tokenizeForMatch(trimmed);
  const policy = CHAT_RAG_CHUNKS.find((c) => c.id === POLICY_ID);
  const others = CHAT_RAG_CHUNKS.filter((c) => c.id !== POLICY_ID);
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

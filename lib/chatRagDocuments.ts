/**
 * 채팅용 RAG 참고 문서. 키워드 매칭으로 관련 청크를 골라 프롬프트에 넣습니다.
 * 정책 청크는 항상 포함됩니다. 새 학습 주제는 `CHAT_RAG_CHUNKS`에 항목을 추가하세요.
 */

export type ChatRagChunk = {
  id: string;
  /** 사용자 문장에 부분 문자열로 포함되면 가중 */
  keywords: string[];
  body: string;
  /** 기본 0. 정책은 별도 항상 포함 */
  baseScore?: number;
};

/** 정책·주제별 참고 본문 (모델이 따르는 학습 자료) */
export const CHAT_RAG_CHUNKS: ChatRagChunk[] = [
  {
    id: "policy_english_learning_only",
    keywords: [],
    baseScore: 0,
    body: `## SnapWord 채팅 정책 (RAG)

이 채널은 영어 학습만 지원합니다.

1) 허용: 단어·숙어·문법·발음·예문·오류 교정·비슷한 표현 비교·학습 팁·영작 피드백(학습 목적)·한영/영한 이해를 돕는 설명.
2) 비허용: 실제 날씨·뉴스·주가·스포츠 결과 등 사실 조회, 비학습 코드 작성·과제 정답 대행, 개인 심리 상담, 법률·의료 진단, 타인 사칭·유해 행위 안내.
3) 비학습 질문 처리: 요청한 "정답"이나 실시간 정보는 제공하지 않습니다. 대신 같은 주제로 영어로 말할 때 쓰는 표현·필수 어휘·자연스러운 예문·질문 패턴을 짧게 정리해 학습에 도움이 되게 답합니다. 한 문장으로 "이 채팅은 영어 학습용이라 실제 정보는 안내하지 않는다"고 범위를 밝힙니다.`,
  },
  {
    id: "topic_weather_smalltalk",
    keywords: [
      "날씨",
      "weather",
      "비가",
      "눈이",
      "맑",
      "흐리",
      "더위",
      "추위",
      "기온",
      "우산",
      "sunny",
      "rain",
      "snow",
      "cloud",
      "forecast",
    ],
    body: `## 주제: 날씨 (학습용으로만 답할 때)

실제 오늘 날씨를 알려주지 말고, 날씨를 영어로 묻고 답하는 연습을 제공합니다.

- How's the weather (today)? / What's the weather like?
- It's sunny / rainy / cloudy / windy / hot / cold.
- Do I need an umbrella? / It looks like it's going to rain.

예문 2~3개와 핵심 단어 5~8개를 한국어 짧은 해설과 함께 제시합니다.`,
  },
  {
    id: "topic_time_date",
    keywords: ["몇 시", "시간", "날짜", "어제", "내일", "what time", "clock", "calendar"],
    body: `## 주제: 시각·날짜 표현 (학습용)

실제 현재 시각을 알려주지 말고, 묻고 답하는 영어 패턴을 알려줍니다.

- What time is it? / It's ten past three.
- What's today's date? / What day is it today?

숫자·분 past/to, AM/PM 표기를 간단히 정리합니다.`,
  },
  {
    id: "topic_directions_places",
    keywords: ["길", "어디", "위치", "지도", "where", "direction", "lost", "way to"],
    body: `## 주제: 길 묻기·장소 (학습용)

실제 길 안내·지도 앱 대신 표현 학습만 합니다.

- Excuse me, how do I get to ...? / Is it far from here?
- Turn left / right, go straight, take the subway.

예문과 방향·교통 관련 단어를 제시합니다.`,
  },
  {
    id: "topic_apology_thanks",
    keywords: ["사과", "감사", "sorry", "thank", "apolog", "excuse me"],
    body: `## 주제: 사과·감사 (학습용)

I'm sorry / I apologize / Excuse me / Thank you / Thanks a lot / I appreciate it 의 뉘앙스 차이와 짧은 예문을 정리합니다.`,
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
  if (c.id === "policy_english_learning_only") return 9999;
  const bodyLower = c.body.toLowerCase();
  for (const t of tokens) {
    if (t.length >= 4 && bodyLower.includes(t)) score += 0.35;
  }
  return score;
}

/**
 * 사용자 질문에 맞춰 참고 문서 문자열을 만듭니다. 정책 청크는 항상 포함합니다.
 */
export function buildChatRagContext(userText: string, maxChars = 4200): string {
  const trimmed = userText.trim();
  const tokens = tokenizeForMatch(trimmed);
  const policy = CHAT_RAG_CHUNKS.find((c) => c.id === "policy_english_learning_only");
  const others = CHAT_RAG_CHUNKS.filter((c) => c.id !== "policy_english_learning_only");
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

export function wrapUserMessageWithRag(userText: string, ragContext: string): string {
  const q = userText.trim();
  if (!ragContext.trim()) return q;
  return [
    "아래 「참고 문서」는 이 서비스에서 검색된 학습용 자료입니다. 반드시 정책을 지키고, 참고 문서와 사용자 질문을 바탕으로 영어 학습에 도움이 되는 답변만 하세요.",
    "",
    "── 참고 문서 ──",
    ragContext,
    "",
    "── 사용자 질문 ──",
    q,
  ].join("\n");
}

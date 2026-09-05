/**
 * 되묻기 — 모델이 **정보가 부족할 때 사용자에게 선택지를 제시**하게 하는 도구.
 *
 * OpenAI API에는 이런 전용 기능이 없다. 함수 도구 호출로 만든다 —
 * 모델이 `ask_user`를 "부르면" 앱이 그 자리에 버튼을 그리고, 사용자가 고른 값을
 * 도구 결과로 되돌려주면 대화가 이어진다.
 *
 * 구조화 출력(JSON Schema)으로도 만들 수 있지만 그러면 응답 전체가 JSON이 되어
 * **스트리밍이 깨진다.** 도구 호출은 모델이 *답변* 아니면 *되묻기* 중 하나를
 * 고르는 방식이라, 답변 쪽은 지금처럼 글자가 쌓이는 걸 그대로 보여줄 수 있다.
 *
 * ────────────────────────────────────────────────────────────
 * 이 앱에서 되묻기가 실제로 필요한 자리
 *
 * 지식베이스에 "검사 조건을 모르면 해석을 단정하지 않는다"고 써 두었는데, 정작
 * 물어볼 방법이 없어서 일반론으로 답하고 있었다. 조건 하나에 해석이 뒤집힌다 —
 *
 *   중성지방 219  →  공복이었나?      아니면 그것만으로 높게 나온다
 *   CPK 높음      →  최근 운동했나?    했으면 며칠 쉬고 재검이 먼저다
 *   빌리루빈 높음  →  금식·과로했나?   그것만으로 오르내린다
 *
 * 반대로 **기록으로 이미 아는 것은 묻지 않는다.** 근육량은 인바디에 있으니
 * eGFR 해석에 필요해도 되물을 이유가 없다. 지침에 그렇게 못 박아 둔다.
 * ────────────────────────────────────────────────────────────
 */

export const ASK_USER_TOOL = {
  type: "function" as const,
  name: "ask_user",
  description:
    "답을 정확히 하려면 사용자만 알 수 있는 정보가 꼭 필요할 때 부른다. " +
    "선택지를 주어 한 번에 고르게 한다. 기록에 이미 있는 것은 묻지 않는다.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["question", "options"],
    properties: {
      question: {
        type: "string",
        description: "한 문장으로 된 질문. 해요체.",
      },
      options: {
        type: "array",
        description:
          "고를 수 있는 답 2~4개. 짧은 구절로. '잘 모르겠어요'처럼 빠져나갈 선택지를 하나 넣는다.",
        items: { type: "string" },
      },
    },
  },
} as const;

export type AskUserPayload = { question: string; options: string[] };

/** 도구 인자를 안전하게 읽는다. 모델이 이상한 걸 채워도 화면이 깨지면 안 된다 */
export function parseAskUser(rawArguments: string): AskUserPayload | null {
  try {
    const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
    const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .filter((o): o is string => typeof o === "string")
          .map((o) => o.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (!question || options.length < 2) return null;
    return { question, options };
  } catch {
    return null;
  }
}

/**
 * 지침에 붙일 되묻기 규칙.
 *
 * 도구만 주면 모델이 지나치게 자주 묻는다. "매번 되묻는 상담사"는 안 묻는 것보다
 * 나쁘다 — 한 번에 답을 못 얻으니까. 그래서 **언제 묻지 않는지**를 더 길게 쓴다.
 */
export const ASK_USER_POLICY = `[되묻기 — ask_user 도구]
사용자의 **자기 수치**에 대해 묻는데 아래 조건을 모르면, 답하기 전에 ask_user를
부릅니다. 조건에 따라 답이 뒤집히기 때문에 추측해서 답하면 틀린 안내가 됩니다.

- 중성지방·혈당이 높다 → 채혈 전 공복이었는지 (식후면 그것만으로 높게 나옵니다)
- CPK·AST가 높다 → 검사 며칠 전 격한 운동이나 근력운동을 했는지
- 빌리루빈이 높다 → 장시간 금식이나 과로가 있었는지
- BUN·혈색소·적혈구용적률이 높다 → 검사 전 물을 충분히 마셨는지
- 감량·증량 방법을 묻는다 → 지금 목표가 어느 쪽인지

**묻지 않습니다** (이때는 바로 답합니다):
- 항목이 무엇인지 묻는 일반 설명 ("ALT가 뭐예요?")
- 「사용자 기록」에 이미 있는 값 (키·성별·나이·인바디·피검사 수치)
- 사용자가 이미 말했거나, 앞 턴에서 물어본 것
- 조건과 무관하게 답이 같은 질문

**참고 문서에 조건별 설명이 있어도, 그 조건을 모르면 먼저 묻습니다.**
문서에 "운동 후면 오를 수 있다"고 적혀 있다고 해서 양쪽을 다 늘어놓지 마세요.
어느 쪽인지 물어서 **그 사람에게 해당하는 답만** 주는 편이 훨씬 쓸모 있습니다.

규칙:
- 한 번에 하나만. 연달아 되묻지 않습니다.
- 선택지는 2~4개, 짧게. 마지막에 "잘 모르겠어요"처럼 빠져나갈 길을 둡니다.
- "잘 모르겠어요"를 고르면 다시 묻지 말고 **조건별로 나눠** 설명합니다.
- 되물을 때는 본문을 함께 쓰지 않습니다. 도구만 부르고 기다립니다.`;

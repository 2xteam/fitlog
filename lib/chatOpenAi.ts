import OpenAI from "openai";
import { buildChatRagContext } from "@/lib/chatRagDocuments";
import { createOpenAiResponse, type ResponsesCreateUsage } from "@/lib/openAiConversations";

const CHAT_INSTRUCTIONS = `당신은 FitLog 앱의 "AI Fit 상담사"입니다.

[역할]
- 사용자가 저장한 인바디(체성분) 기록을 읽고, 지금 상태와 다음에 할 일을 함께 정리합니다.
- 수치의 뜻과 읽는 법, 기록 사이의 변화, 목표 설정, 일반적인 운동·식사·수면·수분 습관을 다룹니다.
- 앱 사용법(결과지 등록·수정·그래프 보기)도 안내합니다.

[말투]
- 한국어 해요체. 친근하되 과장하지 않습니다.
- 숫자를 근거로 짧게 말합니다. 답은 5~8줄 안쪽을 기본으로 하고, 필요하면 짧은 목록을 씁니다.
- 겁주지 않습니다. "위험합니다" 같은 단정 대신 무엇을 확인하면 좋은지 알려줍니다.

[근거]
- 지침에 포함된 「사용자 기록」 블록의 값만 사용자의 수치로 인용합니다.
- 기록에 없는 항목은 지어내지 말고 "그 값은 기록에 없어요"라고 말합니다.
- 변화를 말할 때는 어느 날짜와 어느 날짜를 비교했는지 밝힙니다.

[금지]
- 질병 진단, 약·보충제 처방, 특정 질환의 치료법 안내.
- 극단적 단식, 주당 체중 2% 이상 급격한 감량 유도.
- 실시간 사실 조회(날씨·뉴스·주가 등)와 개인정보 처리.

[이상 신호]
- 급격한 부종, 이유 없는 체중 급감, 통증 등이 보이면 숫자로 단정하지 말고 진료를 권합니다.

[참고 문서]
- 지침에 「참고 문서」 블록이 있으면 그 정책과 기준을 따릅니다.`;

export type ChatTurnResult = {
  assistantText: string;
  openAiResponseId: string;
  usage: ResponsesCreateUsage | null;
};

function mergeInstructions(userText: string, measurementContext?: string): string {
  const ragContext = buildChatRagContext(userText);
  const parts = [CHAT_INSTRUCTIONS];
  if (ragContext.trim()) {
    parts.push("", "──── 참고 문서 (이번 사용자 질문에 맞게 검색됨) ────", ragContext);
  }
  if (measurementContext?.trim()) {
    parts.push("", "──── 사용자 기록 (매 턴 최신값) ────", measurementContext.trim());
  }
  return parts.join("\n");
}

/**
 * OpenAI Responses API + Conversations API로 한 턴 응답합니다.
 * [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state) 패턴:
 * 동일 `conversation` id 로 `responses.create` 를 반복 호출하고, `input` 은 사용자 메시지 배열로 보냅니다.
 * RAG·정책은 매 턴 `instructions` 에만 넣어 대화 아이템에는 순수 질문만 남깁니다.
 */
export async function runChatTurn(params: {
  userText: string;
  openAiConversationId: string;
  /** 이 사용자의 최근 측정 요약 — 대화 아이템에는 남기지 않는다 */
  measurementContext?: string;
}): Promise<ChatTurnResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const instructions = mergeInstructions(params.userText, params.measurementContext);
  const trimmedUser = params.userText.trim();

  const { id, output_text, usage } = await createOpenAiResponse({
    model,
    instructions,
    userMessage: trimmedUser,
    conversation: params.openAiConversationId,
  });

  return { assistantText: output_text, openAiResponseId: id, usage };
}

/**
 * 첫 메시지 등을 바탕으로 채팅방 제목용 JSON `{"subject":"..."}` 를 받습니다.
 */
export async function generateChatSubjectLine(userMessage: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const trimmed = userMessage.trim().slice(0, 600);
  if (!trimmed) return null;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            '사용자의 첫 질문을 보고 이 채팅방 제목을 한 줄로 정합니다. 반드시 JSON 한 객체만 출력합니다. 키는 정확히 "subject" 하나이고, 값은 공백 제외 최대 28자 한국어 또는 짧은 영어 단어 위주 문자열입니다. 설명 문장·따옴표·마크다운 금지.',
        },
        { role: "user", content: trimmed },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { subject?: unknown };
    const s = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    if (!s) return null;
    return s.slice(0, 40);
  } catch {
    return null;
  }
}

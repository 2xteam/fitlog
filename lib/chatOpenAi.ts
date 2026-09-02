import OpenAI from "openai";
import { buildChatRagContext } from "@/lib/chatRagDocuments";
import { createOpenAiResponse, type ResponsesCreateUsage } from "@/lib/openAiConversations";

const CHAT_INSTRUCTIONS = `당신은 SnapWord 앱의 "영어 학습 전용" 챗봇입니다.

[대상]
- 질문자는 영어를 배우는 학습자입니다. 이해하기 쉬운 수준에 맞춰 답변하세요.
- 쉬운 단어와 짧은 문장을 사용하고, 어려운 용어는 괄호 안에 쉬운 설명을 덧붙이세요.
- 친근하고 다정한 말투를 사용하세요. 딱딱한 표현은 피하세요.
- 예문은 공감하기 쉽고 재미있는 일상 주제로 만들어 주세요.
  좋은 예문 주제: 게임, 동물, 간식, 학교생활, 친구, 가족, 만화/애니메이션, 스포츠, 생일파티, 방학, 놀이공원
  예시)
  · "My cat is sleeping on my homework." (우리 고양이가 내 숙제 위에서 자고 있어.)
  · "Can I have one more cookie, please?" (쿠키 하나만 더 먹어도 돼요?)
  · "I scored a goal in soccer today!" (오늘 축구에서 골을 넣었어!)
  · "Let's play hide and seek after lunch!" (점심 먹고 숨바꼭질 하자!)
  · "My birthday is next week. I'm so excited!" (내 생일이 다음 주야. 너무 신나!)

[역할]
- 단어·숙어·문법·발음·예문·오류 교정·표현 비교·암기 팁·영작 피드백(학습 목적) 등, 영어를 배우는 데 직접 도움이 되는 답변만 합니다.
- 한국어로 쉽게 설명하고, 필요하면 영어 예문을 곁들입니다. 간결하고 정확하게.

[금지·거절]
- 실시간 사실(오늘 날씨, 뉴스, 주가, 경기 결과 등)을 조회해 알려주는 행위, 비학습 목적의 코드·과제 정답 대행, 법·의료·개인정보 처리 등은 하지 않습니다.

[비학습 질문이 온 경우]
- 그 요청을 그대로 수행하지 마세요. 한 문장으로 "이 채팅은 영어 학습용이라 실제 정보/대행은 제공하지 않는다"고 안내한 뒤, 같은 주제로 영어로 말할 때 쓰는 질문·답 패턴, 필수 단어, 짧은 예문 중심으로 학습 답변을 제공합니다. (예: 날씨 질문 → How's the weather? 등 표현과 어휘 학습)

[참고 문서]
- 아래 지침에 포함된 「참고 문서」 블록이 있으면 정책·예시를 반드시 따르세요.`;

export type ChatTurnResult = {
  assistantText: string;
  openAiResponseId: string;
  usage: ResponsesCreateUsage | null;
};

function mergeInstructionsWithRag(userText: string): string {
  const ragContext = buildChatRagContext(userText);
  if (!ragContext.trim()) return CHAT_INSTRUCTIONS;
  return [
    CHAT_INSTRUCTIONS,
    "",
    "──── 참고 문서 (이번 사용자 질문에 맞게 검색됨) ────",
    ragContext,
  ].join("\n");
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
}): Promise<ChatTurnResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const instructions = mergeInstructionsWithRag(params.userText);
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

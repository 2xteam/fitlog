import OpenAI from "openai";

/**
 * 피검사 결과지 사진 → 구조화된 JSON.
 *
 * 인바디(`lib/inbodyVision.ts`)와 다른 점 —
 * 인바디는 기종별로 항목이 **정해져** 있어 스키마에 자리를 만들어 뒀다.
 * 피검사는 검사 패널을 고르는 것이라 회차마다 항목이 바뀐다.
 * 그래서 고정 스키마가 아니라 **결과 줄의 배열**로 받는다.
 *
 * 참고치는 반드시 원문(`refText`)까지 함께 받는다. "≤ 40", "Desirable < 200"
 * 처럼 숫자 두 개로 담기지 않는 모양이 흔하고, 나중에 화면을 다시 그릴 때
 * 그때 결과지가 무엇을 기준으로 삼았는지가 그 원문에 남아 있어야 한다.
 */

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";

export type ExtractedResult = {
  name: string;
  value: number | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: "H" | "L" | null;
  specimen: string | null;
};

export type ExtractedBloodTest = {
  testedAt: string | null;
  lab: { name: string | null; clinic: string | null; receiptNo: string | null };
  results: ExtractedResult[];
};

const SYSTEM_PROMPT = `너는 임상 검사(피검사) 결과지를 읽어 JSON으로 옮기는 도구다.

규칙:
1. 결과지에 **인쇄된 것만** 옮긴다. 계산하거나 추정하지 않는다.
2. 검사명은 결과지에 인쇄된 표기를 **그대로** 옮긴다. 번역하거나 줄이지 않는다.
   예) "AST (SGOT)", "TG (Triglyceride)", "25-OH Vit. D, Total", "r-GTP"
3. 결과값은 단위를 뗀 숫자만 넣는다. 숫자가 아니면 value는 null로 두고 refText에 원문을 남긴다.
4. 참고치는 두 가지를 모두 채운다.
   - refLow / refHigh: 숫자로 읽히는 경계만. 한쪽만 있으면 나머지는 null.
     "8.0 ~ 23.0" → low 8.0, high 23.0
     "≤ 40"       → low null, high 40
     "≥ 60.00"    → low 60, high null
     "M < 260"    → low null, high 260
   - refText: **참고치 칸에 인쇄된 문장을 통째로** 옮긴다. 줄이 여러 줄이면 " / "로 잇는다.
     예) "Desirable < 200 / Borderline high 200~239 / High ≥ 240"
     예) "정상 ≤ 5.6 / 당뇨 고위험군 5.7~6.4 / 당뇨 ≥ 6.5"
5. 판정 칸의 표시를 flag에 넣는다. 높음(▲H)은 "H", 낮음(▼L)은 "L", 표시가 없으면 null.
6. 검체 칸의 기호를 specimen에 그대로 넣는다. 보통 S, B, OT 중 하나다.
7. 한 항목이 여러 줄로 인쇄되어도(HbA1c-NGSP / -IFCC / -eAG) **각각 별개의 줄로** 넣는다.
8. 검체채취일시(또는 접수일시)를 testedAt에 "YYYY-MM-DD HH:mm"으로 옮긴다.
   시각이 없으면 "YYYY-MM-DD". 여러 날짜가 있으면 **검체채취일**을 우선한다.
9. 흐릿해서 확신이 없는 숫자는 추측하지 말고 null로 두는 편이 낫다.
10. 값이 없는 빈 줄은 넣지 않는다.

반드시 JSON만 출력한다.`;

const JSON_SHAPE = `{
  "testedAt": "YYYY-MM-DD HH:mm 또는 null",
  "lab": { "name": "검사기관명", "clinic": "의뢰 병원명", "receiptNo": "접수번호" },
  "results": [
    {
      "name": "결과지에 인쇄된 검사명 그대로",
      "value": 0,
      "unit": "mg/dL",
      "refLow": 0,
      "refHigh": 0,
      "refText": "참고치 칸 원문",
      "flag": "H | L | null",
      "specimen": "S | B | OT | null"
    }
  ]
}`;

export async function extractBloodTestFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractedBloodTest> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const res = await client.chat.completions.create({
    model: VISION_MODEL,
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `이 검사결과 보고서를 아래 JSON 형태로 옮겨줘. 표의 모든 줄을 빠짐없이 넣어줘.\n\n${JSON_SHAPE}`,
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<ExtractedBloodTest>;

  return {
    testedAt: parsed.testedAt ?? null,
    lab: {
      name: parsed.lab?.name ?? null,
      clinic: parsed.lab?.clinic ?? null,
      receiptNo: parsed.lab?.receiptNo ?? null,
    },
    results: Array.isArray(parsed.results) ? parsed.results : [],
  };
}

export { VISION_MODEL };

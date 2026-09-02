import OpenAI from "openai";

/**
 * 인바디 결과지 사진 → 구조화된 JSON.
 *
 * 기종(270 / 270S / 720 / 970 / 구형)마다 인쇄 항목이 달라서, 스키마에 없는 값은
 * 버리지 않고 `etc`에 label/value로 담게 한다. 숫자 오인식은 저장 전 검토 화면과
 * `validateMeasurement()`의 정합성 검사로 걸러낸다.
 */

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";

export type ExtractedMeasurement = {
  measuredAt: string | null; // "2026-07-04 10:47"
  device: { model: string | null; place: string | null; memberNo: string | null };
  profile: { heightCm: number | null; age: number | null; gender: string | null };
  composition: Record<string, { value: number | null; min: number | null; max: number | null }>;
  muscleFat: Record<string, { value: number | null; min: number | null; max: number | null }>;
  obesity: Record<string, { value: number | null; min: number | null; max: number | null }>;
  segmental: {
    lean: Record<string, { kg: number | null; percent: number | null; grade: string | null }>;
    fat: Record<string, { kg: number | null; percent: number | null; grade: string | null }>;
    ecwRatio: Record<string, { kg: number | null; percent: number | null; grade: string | null }>;
  };
  evaluation: Record<string, unknown>;
  control: Record<string, number | null>;
  research: Record<string, number | null>;
  impedance: Array<{ freqKHz: number | null; RA: number | null; LA: number | null; TR: number | null; RL: number | null; LL: number | null }>;
  etc: Array<{ label: string; value: string; unit: string | null }>;
};

const SYSTEM_PROMPT = `너는 인바디(InBody) 체성분 결과지를 읽어 JSON으로 옮기는 도구다.

규칙:
1. 결과지에 **인쇄된 숫자만** 옮긴다. 계산하거나 추정하지 않는다.
2. 값이 없는 항목은 null로 둔다. 억지로 채우지 않는다.
3. 괄호 안의 표준범위가 있으면 min/max에 함께 넣는다. 예) 45.3 (39.6~48.4)
4. 단위를 제거한 숫자만 넣는다. 예) "78.0 kg" → 78.0
5. 아래 스키마에 자리가 없는 항목은 **버리지 말고** etc 배열에 label/value/unit으로 담는다.
   (예: 운동소비열량 표, 영양평가 체크, QR 안내 등 수치성 정보)
6. 부위별 항목은 오른팔/왼팔/몸통/오른다리/왼다리 순서로 매핑한다.
   막대그래프만 있고 숫자가 없으면 kg/percent는 null, grade에 "표준이하"/"표준"/"표준이상"을 넣는다.
7. 체크박스 평가는 체크된 항목의 텍스트를 그대로 넣는다. 예) 비만평가 BMI "과체중"
8. 검사일시는 "YYYY-MM-DD HH:mm" 형식으로 옮긴다. 시각이 없으면 "YYYY-MM-DD".
9. 흐릿해서 확신이 없는 숫자는 추측하지 말고 null로 두는 편이 낫다.

반드시 JSON만 출력한다.`;

const JSON_SHAPE = `{
  "measuredAt": "YYYY-MM-DD HH:mm 또는 null",
  "device": { "model": "InBody270S 등", "place": "측정 장소", "memberNo": "회원번호" },
  "profile": { "heightCm": 0, "age": 0, "gender": "남성|여성" },
  "composition": {
    "totalBodyWater": {"value":0,"min":0,"max":0},
    "intracellularWater": {"value":0,"min":0,"max":0},
    "extracellularWater": {"value":0,"min":0,"max":0},
    "protein": {"value":0,"min":0,"max":0},
    "mineral": {"value":0,"min":0,"max":0},
    "boneMineral": {"value":0,"min":0,"max":0},
    "bodyFatMass": {"value":0,"min":0,"max":0},
    "softLeanMass": {"value":0,"min":0,"max":0},
    "fatFreeMass": {"value":0,"min":0,"max":0},
    "weight": {"value":0,"min":0,"max":0}
  },
  "muscleFat": { "skeletalMuscleMass": {"value":0,"min":0,"max":0} },
  "obesity": {
    "bmi": {"value":0,"min":0,"max":0},
    "percentBodyFat": {"value":0,"min":0,"max":0},
    "waistHipRatio": {"value":0,"min":0,"max":0}
  },
  "segmental": {
    "lean":     { "rightArm": {"kg":0,"percent":0,"grade":null}, "leftArm": {}, "trunk": {}, "rightLeg": {}, "leftLeg": {} },
    "fat":      { "rightArm": {"kg":0,"percent":0,"grade":null}, "leftArm": {}, "trunk": {}, "rightLeg": {}, "leftLeg": {} },
    "ecwRatio": { "rightArm": {"kg":null,"percent":0,"grade":null}, "leftArm": {}, "trunk": {}, "rightLeg": {}, "leftLeg": {} }
  },
  "evaluation": {
    "inbodyScore": 0,
    "phaseAngle": 0,
    "ecwRatio": 0,
    "balance": { "upperLeftRight": "균형|약한불균형|심한불균형", "lowerLeftRight": null, "upperLower": null },
    "obesityGrade": { "bmi": "표준|과체중|심한과체중", "bodyFat": "표준|경도비만|비만", "waistHipRatio": null },
    "nutrition": { "protein": "양호|부족", "mineral": null, "fat": "양호|부족|과다" },
    "strength": { "whole": null, "lower": null, "muscle": null },
    "health": { "bodyWater": null, "edema": null, "lifestyle": null }
  },
  "control": { "targetWeight": 0, "weightControl": 0, "fatControl": 0, "muscleControl": 0 },
  "research": {
    "bmr": 0, "bmrMin": 0, "bmrMax": 0, "obesityDegree": 0,
    "visceralFatLevel": 0, "visceralFatArea": 0, "waistCircumference": 0,
    "ffmi": 0, "fmi": 0, "recommendedCalories": 0,
    "bcm": 0, "bmc": 0, "armCircumference": 0, "armMuscleCircumference": 0,
    "bodyDevelopmentScore": 0
  },
  "impedance": [ { "freqKHz": 20, "RA": 0, "LA": 0, "TR": 0, "RL": 0, "LL": 0 } ],
  "etc": [ { "label": "항목명", "value": "값", "unit": "단위 또는 null" } ]
}`;

export async function extractInBodyFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractedMeasurement> {
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
            text: `이 인바디 결과지를 아래 JSON 형태로 옮겨줘. 없는 값은 null.\n\n${JSON_SHAPE}`,
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as ExtractedMeasurement;
}

export { VISION_MODEL };

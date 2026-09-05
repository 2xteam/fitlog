/**
 * 인바디 지식 → 채팅 RAG 청크. **손으로 쓰지 않고 생성한다.**
 *
 * 전에는 `chatRagDocuments.ts`에 손으로 쓴 5개가 있었고, 그래서 갈라져 있었다 —
 * `FIELDS`는 36개인데 상담사는 체지방·골격근·체수분·기초대사량 4개만 알았다.
 * 필드를 늘려도 상담사는 몰랐고, 조언에는 출처가 없었다.
 *
 * 지금은 `inbodyKnowledge` + `inbodyGuidance`에서 만든다. 카탈로그에 항목을 넣으면
 * 상담사도 그 자리에서 안다. → 피검사 쪽 `lib/bloodRagChunks.ts`와 같은 방식.
 */

import { FIELDS, GROUP_LABELS, groupOf, type FieldDef } from "@/lib/inbody";
import { INBODY_KNOWLEDGE, knowledgeOf } from "@/lib/inbodyKnowledge";
import { INBODY_GUIDANCE } from "@/lib/inbodyGuidance";
import { EVIDENCE_LABELS, KIND_LABELS } from "@/lib/evidence";

export type InbodyRagChunk = {
  id: string;
  keywords: string[];
  body: string;
};

function describe(f: FieldDef): string {
  const k = knowledgeOf(f.path);
  const lines: string[] = [`**${f.label}**${f.unit ? ` (${f.unit})` : ""}`];
  if (k?.explain) lines.push(`  · ${k.explain.replace(/\*\*/g, "")}`);

  if (k?.cutoff) {
    const c = k.cutoff;
    const parts: string[] = [];
    if (c.male || c.female) {
      if (c.male) parts.push(`남 ${fmtRange(c.male.low, c.male.high)}`);
      if (c.female) parts.push(`여 ${fmtRange(c.female.low, c.female.high)}`);
    } else {
      parts.push(fmtRange(c.low, c.high));
    }
    lines.push(`  · 기준: ${parts.join(" / ")} — ${c.label} (${c.source.name})`);
  }

  for (const a of k?.adjust ?? []) {
    const by = { age: "나이", sex: "성별", height: "키", method: "측정 방법", condition: "측정 조건" }[a.by];
    lines.push(`  · ${by}: ${a.note.replace(/\*\*/g, "")}`);
  }
  for (const c of k?.crossBlood ?? []) {
    lines.push(
      `  · 피검사 교차: 이 값이 ${c.when === "high" ? "높고" : "낮고"} ${c.bloodLabel}이 ${
        c.bloodWhen === "high" ? "높으면" : "낮으면"
      } — ${c.note.replace(/\*\*/g, "")}`,
    );
  }

  const g = INBODY_GUIDANCE.filter((x) => x.analyte === f.path);
  if (g.length > 0) {
    lines.push("  권고:");
    for (const x of g) {
      lines.push(
        `   · [${x.evidence} ${EVIDENCE_LABELS[x.evidence]}] ${KIND_LABELS[x.kind]} — ${x.headline}` +
          `${x.effect ? ` (${x.effect})` : ""} / 출처 ${x.source.name} ${x.source.year}`,
      );
    }
  }

  return lines.join("\n");
}

function fmtRange(low?: number | null, high?: number | null): string {
  if (low != null && high != null) return `${low}~${high}`;
  if (high != null) return `${high} 이하`;
  if (low != null) return `${low} 이상`;
  return "—";
}

const GROUP_KEYWORDS: Record<string, string[]> = {
  composition: ["체성분", "체수분", "단백질", "무기질", "제지방", "체지방량", "수분", "부종"],
  muscleFat: ["골격근", "근육", "근력", "웨이트", "벌크", "근손실"],
  obesity: ["비만", "체지방률", "bmi", "복부", "살", "다이어트", "감량"],
  evaluation: ["인바디점수", "위상각", "세포외수분비", "ecw", "점수", "붓"],
  control: ["체중조절", "목표", "적정체중", "얼마나"],
  research: ["기초대사량", "bmr", "칼로리", "열량", "내장지방", "허리둘레", "ffmi", "섭취", "먹"],
  derived: ["smi", "골격근지수", "근감소", "사코페니아", "허리키비율"],
};

function fieldKeywords(fields: FieldDef[]): string[] {
  const set = new Set<string>();
  for (const f of fields) {
    set.add(f.label.toLowerCase());
    const last = f.path.replace(/\.value$/, "").split(".").pop();
    if (last) set.add(last.toLowerCase());
  }
  return [...set];
}

/** 구획별 청크 — "골격근"이라고 물으면 그 구획 전체가 들어온다 */
function groupChunks(): InbodyRagChunk[] {
  return Object.keys(GROUP_LABELS)
    .map((key) => {
      const fields = FIELDS.filter((f) => groupOf(f.path) === key);
      if (fields.length === 0) return null;
      const body = [
        `## 인바디 · ${GROUP_LABELS[key]}`,
        "",
        ...fields.map(describe),
      ].join("\n\n");
      return {
        id: `inbody_${key}`,
        keywords: [...fieldKeywords(fields), ...(GROUP_KEYWORDS[key] ?? [])],
        body,
      };
    })
    .filter((c): c is InbodyRagChunk => c !== null);
}

/** 인바디를 읽을 때의 원칙 — 이걸 모르면 상담사가 과신한다 */
const HOW_TO_READ: InbodyRagChunk = {
  id: "inbody_how_to_read",
  keywords: [
    "인바디",
    "측정",
    "조건",
    "언제",
    "아침",
    "공복",
    "재는",
    "정확",
    "오차",
    "기계",
    "헬스장",
    "dxa",
  ],
  body: `## 인바디 수치를 읽는 원칙

**측정 방법이 곧 기준을 정한다.**
BIA(인바디)는 DXA와 값이 다르다. InBody 770 연구에서 전신 근육량을 DXA보다 2.28kg,
사지근육량을 1.97kg 높게 쟀다. 체지방률은 반대로 낮게 나온다(남 −4.2%p, 여 −2.8%p).
그래서 AWGS 2019 근감소증 기준도 방법마다 다르다 — 여성이 DXA 5.4, BIA 5.7 kg/m².
**인바디 값에는 BIA 기준을 쓴다.** DXA 기준을 갖다 대면 근감소를 놓친다.

**같은 조건에서 잰 값끼리만 견준다.**
BIA는 식사·수분·운동·시간대를 통제한 조건에서만 신뢰할 만하다. 아침 공복, 화장실
다녀온 뒤, 운동 전이 가장 안정적이다. 식사·수분·운동 직후에는 체지방률이 1~2%p까지
달라 보인다. 헬스장을 옮겨 기종이 바뀌면 그 지점에서 값이 튄다.

**절대값보다 추이를 본다.**
이 앱이 날짜당 1건만 두는 이유다 — 하루에 여러 번 잰 값의 차이는 몸이 변한 게 아니라
조건 차이다.

**체중만으로는 아무것도 말할 수 없다.**
같은 1kg이라도 근육인지 지방인지 물인지에 따라 뜻이 완전히 다르다. 체중 변화를 말할 때는
골격근량·체지방량을 함께 본다.

**인바디가 계산해 주는 값과 잰 값을 구분한다.**
기초대사량은 직접 잰 게 아니라 제지방량으로 계산한 추정치다. 인바디점수는 기종별 자체
산식이라 진료지침의 지표가 아니다. 내장지방도 CT로 잰 게 아니라 임피던스 추정값이다.`,
};

/** 근감소증 — 인바디 값이 가장 직접적으로 임상 기준에 닿는 자리 */
const SARCOPENIA: InbodyRagChunk = {
  id: "inbody_sarcopenia",
  keywords: ["근감소", "사코페니아", "smi", "골격근지수", "노화", "악력", "보행", "나이"],
  body: `## 근감소증 (AWGS 2019)

판정에 쓰는 값은 근육량(kg)이 아니라 **SMI(사지근육량 ÷ 키m²)** 다.

- BIA 기준: 남 7.0 / 여 5.7 kg/m² 미만이면 근육량이 적은 쪽
- DXA 기준: 남 7.0 / 여 5.4 kg/m² — **방법마다 다르다**

**근육량만으로는 근감소증이 아니다.** AWGS는 근육량 감소에 더해 근력 저하(악력) 또는
신체기능 저하(보행속도·5회 앉았다 일어서기)가 있어야 진단한다. 이 앱은 인바디에서 얻는
근육량만 알기 때문에 **진단하지 않는다.** 기준선 아래라는 것과, 진료에서 함께 볼 것이
있다는 것까지만 말한다.

대응은 저항운동이 1차다(AWGS 강한 권고). 단백질은 체중 1kg당 약 1.6g에서 추가 이득이
멈춘다(49개 연구·1,863명 메타회귀, BJSM 2018). 운동 없이 단백질만 늘리면 근육은 늘지 않는다.`,
};

export const INBODY_RAG_CHUNKS: InbodyRagChunk[] = [
  HOW_TO_READ,
  SARCOPENIA,
  ...groupChunks(),
];

/** 카탈로그에 설명이 없는 필드 — 개발 중 확인용 */
export function fieldsWithoutExplain(): string[] {
  const known = new Set(INBODY_KNOWLEDGE.map((k) => k.path));
  return FIELDS.filter((f) => !known.has(f.path)).map((f) => f.label);
}

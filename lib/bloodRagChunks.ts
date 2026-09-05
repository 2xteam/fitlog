/**
 * 피검사 지식 → 채팅 RAG 청크.
 *
 * ⚠️ 요약을 **손으로 쓰지 않는다.** 카탈로그(`bloodCatalog`)와 권고(`bloodGuidance`)에서
 * 생성한다.
 *
 * 손으로 쓴 요약은 반드시 갈라진다 — 항목을 추가하거나 지침이 바뀌어 등급을 고쳤을 때
 * 화면은 새 내용을 보여주는데 상담사는 옛말을 한다. 그러면 같은 앱이 같은 질문에
 * 두 가지로 답한다. 지식이 한 곳에 있어야 그런 일이 없다.
 *
 * 생성이라 새 항목을 카탈로그에 넣으면 **상담사도 그 자리에서 알게 된다.**
 */

import {
  ANALYTES,
  PANEL_LABELS,
  PANEL_ORDER,
  type Analyte,
  type PanelKey,
} from "@/lib/bloodCatalog";
import { EVIDENCE_LABELS, GUIDANCE, KIND_LABELS } from "@/lib/bloodGuidance";

export type BloodRagChunk = {
  id: string;
  keywords: string[];
  body: string;
};

/** 항목 하나를 상담사가 읽을 몇 줄로 */
function describe(a: Analyte): string {
  const lines: string[] = [`**${a.label}** (${a.unit})`];
  lines.push(`  · ${a.explain.replace(/\*\*/g, "")}`);

  if (a.typicalRef?.text) {
    lines.push(`  · 일반 기준: ${a.typicalRef.text}`);
  } else if (a.typicalRef?.low != null && a.typicalRef?.high != null) {
    lines.push(`  · 일반 참고구간: ${a.typicalRef.low} ~ ${a.typicalRef.high}`);
  } else if (a.typicalRef?.high != null) {
    lines.push(`  · 일반 참고구간: ${a.typicalRef.high} 이하`);
  } else if (a.typicalRef?.low != null) {
    lines.push(`  · 일반 참고구간: ${a.typicalRef.low} 이상`);
  }

  for (const d of a.decisionLimits ?? []) {
    lines.push(
      `  · 임상 결정치 ${d.at} ${d.dir === "above" ? "초과" : "미만"}: ${d.means} (${d.source.name})`,
    );
  }
  for (const adj of a.adjust ?? []) {
    const by = { age: "나이", sex: "성별", muscle: "근육량", bmi: "체격" }[adj.by];
    lines.push(`  · ${by} 영향: ${adj.note.replace(/\*\*/g, "")}`);
  }
  for (const c of a.crossInbody ?? []) {
    lines.push(
      `  · 인바디 교차: 이 값이 ${c.when === "high" ? "높고" : "낮고"} ${c.inbodyLabel}이 ${
        c.inbodyWhen === "high" ? "높으면" : "낮으면"
      } — ${c.note.replace(/\*\*/g, "")}`,
    );
  }

  return lines.join("\n");
}

/** 한 항목에 달린 권고를 등급과 함께 */
function guidanceLines(code: string): string[] {
  const rows = GUIDANCE.filter((g) => g.analyte === code);
  if (rows.length === 0) return [];
  return rows.map(
    (g) =>
      `  · [${g.evidence} ${EVIDENCE_LABELS[g.evidence]}] ${KIND_LABELS[g.kind]} — ${
        g.headline
      }${g.effect ? ` (${g.effect})` : ""} / 출처 ${g.source.name} ${g.source.year}`,
  );
}

/** 항목 이름·별칭을 검색 키워드로 */
function keywordsOf(analytes: Analyte[]): string[] {
  const set = new Set<string>();
  for (const a of analytes) {
    set.add(a.code.toLowerCase());
    set.add(a.label.toLowerCase());
    for (const al of a.aliases) set.add(al.toLowerCase());
  }
  return [...set];
}

const PANEL_EXTRA_KEYWORDS: Record<PanelKey, string[]> = {
  liver: ["간", "간수치", "간기능", "지방간", "술", "음주", "간효소"],
  lipid: ["콜레스테롤", "지질", "고지혈", "이상지질", "중성지방", "혈관", "오메가3", "어유"],
  glucose: ["혈당", "당뇨", "당화혈색소", "인슐린", "공복", "당뇨병전단계"],
  kidney: ["신장", "콩팥", "요산", "통풍", "신기능", "여과율", "단백뇨"],
  mineral: ["비타민", "비타민d", "칼슘", "마그네슘", "미네랄", "영양제", "보충제"],
  thyroid: ["갑상선", "호르몬", "피로", "체중변화"],
  cbc: ["빈혈", "혈색소", "적혈구", "백혈구", "혈소판", "철분", "빈혈수치"],
  muscle: ["근육", "근육통", "운동후", "근손상"],
};

/** 구획별 청크 — 사용자가 "간 수치"라고 물으면 간 항목 전체가 들어온다 */
function panelChunks(): BloodRagChunk[] {
  return PANEL_ORDER.map((panel) => {
    const analytes = ANALYTES.filter((a) => a.panel === panel);
    if (analytes.length === 0) return null;

    const body = [
      `## 피검사 · ${PANEL_LABELS[panel]}`,
      "",
      ...analytes.map((a) => {
        const g = guidanceLines(a.code);
        return [describe(a), ...(g.length ? ["  권고:", ...g] : [])].join("\n");
      }),
    ].join("\n\n");

    return {
      id: `blood_${panel}`,
      keywords: [...keywordsOf(analytes), ...PANEL_EXTRA_KEYWORDS[panel]],
      body,
    };
  }).filter((c): c is BloodRagChunk => c !== null);
}

/** 해석의 뼈대 — 이걸 모르면 상담사가 정확히 반대로 말한다 */
const CONCEPT_CHUNK: BloodRagChunk = {
  id: "blood_how_to_read",
  keywords: [
    "피검사",
    "혈액검사",
    "검사결과",
    "정상수치",
    "참고치",
    "참고구간",
    "기준치",
    "정상범위",
    "높아요",
    "낮아요",
    "재검",
  ],
  body: `## 피검사 수치를 읽는 원칙

**"정상수치"는 두 종류다. 섞으면 정확히 반대로 말하게 된다.**

1) 참고구간 — 건강한 사람들의 가운데 95%. 검사실·장비·나이·성별에 따라 달라진다.
   결과지에 인쇄된 값이 그때의 기준이다. 앱은 기록마다 이 값을 저장한다.
2) 임상 결정치 — 위험이 올라가는 선. 인구 분포와 무관하다.
   **나이가 많다고, 체격이 크다고 완화되지 않는다.** (LDL, 당화혈색소, 요산 목표 등)

→ "나이 있으시니 콜레스테롤 조금 높아도 괜찮다"는 틀린 말이다. 중년 이후 콜레스테롤
   분포는 올라가지만 치료 목표는 그래서 더 낮아진다.

**한 번의 값으로 판단하지 않는다.**
같은 항목이 두 번 이상 이어서 벗어날 때가 의미 있는 신호다. 특히 흔들리기 쉬운 항목 —
중성지방(식사), 혈당(공복 여부), CPK(운동), BUN·혈색소(수분 상태), 빌리루빈(금식·피로).

**검사 조건을 먼저 묻는다.**
공복이었는지, 며칠 전 격한 운동을 했는지, 물을 충분히 마셨는지에 따라 값이 달라진다.
조건을 모르면 해석을 단정하지 않는다.

**나이·성별·체격 보정이 있는 항목은 일부뿐이다.**
근거가 확인된 것 — TSH(나이), 크레아티닌·eGFR(성별·근육량), 혈색소·적혈구용적률(성별),
ALP(나이), 요산(성별), CPK(성별·근육량). 그 밖의 항목은 보정하지 않는다.`,
};

/** 근거 등급과 영양제 정책 — 상담사가 지침에 반하는 말을 하지 않게 */
const EVIDENCE_CHUNK: BloodRagChunk = {
  id: "blood_evidence_policy",
  keywords: [
    "영양제",
    "보충제",
    "먹으면",
    "복용",
    "추천",
    "근거",
    "효과",
    "오메가3",
    "비타민",
    "밀크씨슬",
    "철분",
    "약",
  ],
  body: `## 권고의 근거 등급과 영양제 정책

앱의 모든 권고에는 근거 등급이 붙어 있다. 조언할 때 **등급을 함께 말한다.**
  A 근거 강함 — 지침의 강한 권고 또는 일관된 무작위배정 시험
  B 근거 보통 — 지침의 조건부 권고 또는 메타분석
  C 근거 약함 — 흔히 하는 말이지만 시험에서 확인되지 않음
  D 권하지 않음 — 지침이 이득 없음으로 분류

**영양제는 결핍이 확인된 항목에만 말한다.**
수치가 조금 높거나 낮다는 이유로 영양제를 권하지 않는다. 용량·복용법은 절대 말하지 않고
진료를 권한다.

특히 조심할 것 —
· 일반 어유(오메가3) 보조제: 2026 ACC/AHA/NLA 지침에서 Class III(이득 없음).
  중성지방 낮추는 용도로 권하지 않는다. 심혈관 사건을 줄인 REDUCE-IT은 **처방약
  icosapent ethyl** 이야기이고, 일반 보조제에 옮겨 말하면 안 된다.
· 비타민D: 2024 내분비학회 지침은 건강한 성인에게 검사 자체를 권하지 않고, 특정 목표
  수치를 맞추라고도 하지 않는다. 결핍(20 ng/mL 미만)은 다르다.
· 간 영양제(밀크씨슬 등): 지방간 지침이 표준 치료로 권하지 않는다.
· 철분제: 빈혈이 있다고 바로 권하지 않는다. 원인 확인이 먼저다.

**근거를 물으면 출처를 말한다.** 앱 화면의 각 권고에서 "무엇을 근거로 한 말인가요?"를
누르면 연구 설계와 한계까지 볼 수 있다고 안내한다.`,
};

/** 인바디와 겹쳐야 보이는 것 — 이 앱만 할 수 있는 부분 */
const CROSS_CHUNK: BloodRagChunk = {
  id: "blood_inbody_cross",
  keywords: [
    "인바디",
    "체성분",
    "근육량",
    "골격근",
    "체지방",
    "내장지방",
    "체수분",
    "크레아티닌",
    "egfr",
    "사구체",
  ],
  body: `## 피검사 × 인바디 교차 해석

이 앱에는 같은 사람의 체성분 기록이 함께 있다. 두 기록을 겹치면 검사실이 인쇄할 수 없는
맥락이 나온다. **맥락 제시까지만 하고 원인을 단정하지 않는다.**

· 크레아티닌 높음 / eGFR 낮음 + 골격근량 많음
  → eGFR 추정식은 나이·성별만 보정하고 **근육량을 넣지 않는다.** 같은 조건이면 근육량이
    같다고 가정하기 때문에, 근육이 많으면 신장 기능이 실제보다 낮게 나올 수 있다.
    확인이 필요하면 근육량 영향을 덜 받는 시스타틴 C 검사가 있다고 안내한다(진료 판단).

· CPK 높음 + 근력운동 기록
  → 근육을 많이 쓰면 며칠간 올라간다. 검사 전 2~3일 쉬고 다시 재면 구분이 된다.

· ALT 높음 + 체지방률·내장지방 높음
  → 같은 방향을 가리킨다. 운동은 체중이 줄지 않아도 ALT를 낮춘 근거가 있다(A등급).

· 중성지방 높음 + 내장지방 높음
  → 같은 생활습관 축. 두 추이를 겹쳐 보자고 제안할 수 있다.

· 혈색소·적혈구용적률 높음 + 체수분 낮음
  → 탈수로 농축돼 보일 수 있다. 측정 조건 차이를 먼저 의심한다.`,
};

export const BLOOD_RAG_CHUNKS: BloodRagChunk[] = [
  CONCEPT_CHUNK,
  EVIDENCE_CHUNK,
  CROSS_CHUNK,
  ...panelChunks(),
];

/**
 * 근거 등급 — 인바디와 피검사가 **함께 쓴다.**
 *
 * 처음에는 피검사 쪽에만 있었다. 그랬더니 같은 앱에서 탭마다 태도가 달랐다 —
 * Blood는 조언마다 출처를 펼쳐 볼 수 있는데, Inbody는 "체중 1kg당 단백질 1.2~1.6g"을
 * 근거 없이 말했다. 신뢰를 올리려고 만든 장치가 오히려 인바디 쪽을 의심스럽게 만든다.
 * 그래서 타입을 여기로 끌어내고 두 카탈로그가 같은 규칙을 따르게 했다.
 *
 * ⚠️ **`evidence` 없이는 권고를 추가하지 않는다.**
 */

export type EvidenceGrade = "A" | "B" | "C" | "D";

export const EVIDENCE_LABELS: Record<EvidenceGrade, string> = {
  A: "근거 강함",
  B: "근거 보통",
  C: "근거 약함",
  D: "권하지 않음",
};

export const EVIDENCE_MEANING: Record<EvidenceGrade, string> = {
  A: "진료지침이 강하게 권하거나, 무작위배정 시험에서 일관되게 확인된 내용이에요.",
  B: "진료지침의 조건부 권고이거나, 여러 연구를 모은 메타분석 수준의 근거예요.",
  C: "흔히 하는 말이지만 시험에서는 확인되지 않았어요. 해로울 일은 없지만 기대만큼 듣지 않을 수 있어요.",
  D: "진료지침이 이득이 없다고 분류했어요. 권하지 않는 이유까지 함께 읽어보세요.",
};

export type Source = { name: string; year: number; url?: string };

export type GuidanceKind = "exercise" | "diet" | "supplement" | "clinic" | "measure";

export const KIND_LABELS: Record<GuidanceKind, string> = {
  exercise: "운동",
  diet: "식습관",
  supplement: "영양제",
  clinic: "진료",
  measure: "측정 방법",
};

export type Guidance = {
  /** 대상 항목. 피검사는 코드(`TG`), 인바디는 경로(`obesity.percentBodyFat.value`). "*"는 공통 */
  analyte: string;
  direction: "high" | "low";
  kind: GuidanceKind;
  headline: string;
  detail: string;
  /** 숫자로 말할 수 있는 효과. 있으면 화면에 그대로 보여준다 */
  effect?: string;
  evidence: EvidenceGrade;
  source: Source;
  /**
   * **펼쳐보기에 들어가는 내용.**
   * 이 조언이 어떤 데이터에서 나왔는지 — 연구 설계, 대상, 무엇이 측정됐는지,
   * 그리고 한계까지. 신뢰는 결론이 아니라 출처를 보여줄 때 생긴다.
   */
  basis: string;
};

const RANK: Record<EvidenceGrade, number> = { A: 0, B: 1, C: 2, D: 3 };

/**
 * 근거가 센 것부터. 등급 D는 **맨 뒤로 보내되 지우지 않는다** —
 * 사용자가 이미 들어봤을 조언에 대해 지침이 뭐라고 하는지 보여주는 자리다.
 */
export function sortByEvidence(items: Guidance[]): Guidance[] {
  return [...items].sort((a, b) => RANK[a.evidence] - RANK[b.evidence]);
}

export function pickGuidance(
  all: Guidance[],
  key: string,
  direction: "high" | "low",
): Guidance[] {
  return sortByEvidence(all.filter((g) => g.analyte === key && g.direction === direction));
}

/**
 * 인바디 결과지 필드 정의.
 *
 * 기종(270 / 270S / 720 / 970 / 구형)마다 인쇄되는 항목이 다르다.
 * 여기 정의된 항목은 정식 필드로 저장하고, 정의에 없는 항목은 `etc`에 담아
 * 화면에 그대로 나열한다. `etc`에 같은 label이 반복해서 쌓이면 정식 필드로
 * 승격하는 것을 검토한다.
 */

/** 값 + 표준범위. 결과지에 범위가 인쇄된 항목은 함께 저장한다. */
export type Measured = {
  value: number | null;
  min?: number | null;
  max?: number | null;
};

/** 부위별 항목 (팔/몸통/다리) */
export type SegmentKey =
  | "rightArm"
  | "leftArm"
  | "trunk"
  | "rightLeg"
  | "leftLeg";

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  rightArm: "오른팔",
  leftArm: "왼팔",
  trunk: "몸통",
  rightLeg: "오른다리",
  leftLeg: "왼다리",
};

/** 결과지에서 쓰는 등급 표기 */
export type Grade = "표준이하" | "표준" | "표준이상" | null;
export type BalanceGrade = "균형" | "약한불균형" | "심한불균형" | null;

/**
 * 화면·그래프에서 다룰 수 있는 수치 필드 카탈로그.
 * path는 measurement 문서 기준 경로다.
 */
export type FieldDef = {
  path: string;
  label: string;
  unit: string;
  /** 그래프 기본 노출 대상 */
  primary?: boolean;
  /** 값이 낮을수록 좋은 지표 (그래프 색상 판단용) */
  lowerIsBetter?: boolean;
};

export const FIELDS: FieldDef[] = [
  // 체성분분석
  { path: "composition.weight.value", label: "체중", unit: "kg", primary: true },
  { path: "composition.totalBodyWater.value", label: "체수분", unit: "L" },
  { path: "composition.intracellularWater.value", label: "세포내수분", unit: "L" },
  { path: "composition.extracellularWater.value", label: "세포외수분", unit: "L" },
  { path: "composition.protein.value", label: "단백질", unit: "kg" },
  { path: "composition.mineral.value", label: "무기질", unit: "kg" },
  { path: "composition.boneMineral.value", label: "골무기질", unit: "kg" },
  { path: "composition.bodyFatMass.value", label: "체지방량", unit: "kg", lowerIsBetter: true },
  { path: "composition.softLeanMass.value", label: "근육량", unit: "kg" },
  { path: "composition.fatFreeMass.value", label: "제지방량", unit: "kg" },

  // 골격근·지방분석
  { path: "muscleFat.skeletalMuscleMass.value", label: "골격근량", unit: "kg", primary: true },

  // 비만분석
  { path: "obesity.bmi.value", label: "BMI", unit: "kg/m²" },
  { path: "obesity.percentBodyFat.value", label: "체지방률", unit: "%", primary: true, lowerIsBetter: true },
  { path: "obesity.waistHipRatio.value", label: "복부지방률", unit: "", lowerIsBetter: true },

  // 평가
  { path: "evaluation.inbodyScore", label: "인바디점수", unit: "점" },
  { path: "evaluation.phaseAngle", label: "전신 위상각", unit: "°" },
  { path: "evaluation.ecwRatio", label: "세포외수분비", unit: "", lowerIsBetter: true },

  // 체중조절
  { path: "control.targetWeight", label: "적정체중", unit: "kg" },
  { path: "control.weightControl", label: "체중조절", unit: "kg" },
  { path: "control.fatControl", label: "지방조절", unit: "kg" },
  { path: "control.muscleControl", label: "근육조절", unit: "kg" },

  // 연구항목
  { path: "research.bmr", label: "기초대사량", unit: "kcal" },
  { path: "research.obesityDegree", label: "비만도", unit: "%", lowerIsBetter: true },
  { path: "research.visceralFatLevel", label: "내장지방레벨", unit: "", lowerIsBetter: true },
  { path: "research.visceralFatArea", label: "내장지방단면적", unit: "cm²", lowerIsBetter: true },
  { path: "research.waistCircumference", label: "허리둘레", unit: "cm", lowerIsBetter: true },
  { path: "research.ffmi", label: "FFMI", unit: "kg/m²" },
  { path: "research.fmi", label: "FMI", unit: "kg/m²", lowerIsBetter: true },
  { path: "research.recommendedCalories", label: "권장섭취열량", unit: "kcal" },
  { path: "research.bcm", label: "체세포량(BCM)", unit: "kg" },
  { path: "research.bmc", label: "골무기질량(BMC)", unit: "kg" },
  { path: "research.armCircumference", label: "상완위팔둘레(AC)", unit: "cm" },
  { path: "research.armMuscleCircumference", label: "상완근육둘레(AMC)", unit: "cm" },
  { path: "research.bodyDevelopmentScore", label: "신체발달점수", unit: "점" },

  // 앱이 계산하는 파생 지표
  { path: "derived.smi", label: "골격근지수(SMI)", unit: "kg/m²" },
  { path: "derived.waistToHeight", label: "허리/키 비율", unit: "", lowerIsBetter: true },
];

/** 그래프 기본 3종 */
export const PRIMARY_FIELDS = FIELDS.filter((f) => f.primary);

/**
 * 결과지의 분석 구획.
 *
 * 항목이 36개라 한 줄로 늘어놓으면 무엇을 보는지 알기 어렵다.
 * 경로의 첫 마디가 곧 구획이므로 따로 표시를 달지 않고 여기서 묶는다.
 */
export const GROUP_LABELS: Record<string, string> = {
  composition: "체성분분석",
  muscleFat: "골격근·지방분석",
  obesity: "비만분석",
  evaluation: "평가",
  control: "체중조절",
  research: "연구항목",
  derived: "계산 지표",
};

/** 결과지에 인쇄되지 않고 앱이 계산해 채우는 구획 */
export const DERIVED_GROUPS = ["derived"];

export function groupOf(path: string): string {
  return path.split(".")[0] ?? "";
}

export type FieldGroup = { key: string; label: string; fields: FieldDef[] };

/** 주어진 필드들을 구획 순서대로 묶는다. 빈 구획은 빼고 돌려준다. */
export function groupFields(fields: FieldDef[]): FieldGroup[] {
  const order = Object.keys(GROUP_LABELS);
  return order
    .map((key) => ({
      key,
      label: GROUP_LABELS[key] ?? key,
      fields: fields.filter((f) => groupOf(f.path) === key),
    }))
    .filter((g) => g.fields.length > 0);
}

export function findField(path: string): FieldDef | undefined {
  return FIELDS.find((f) => f.path === path);
}

/** 중첩 객체에서 경로로 값 꺼내기 */
export function pick(obj: unknown, path: string): number | null {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "number" ? cur : null;
}

/* ────────────────────────────────────────────────────────────
 * 추출값 검증
 *
 * 인바디 결과지는 내부적으로 계산이 맞아떨어진다. 이 관계를 이용하면
 * Vision이 숫자를 잘못 읽었을 때(8↔3 등) 잡아낼 수 있다.
 * ──────────────────────────────────────────────────────────── */

export type Warning = { field: string; message: string };

type CheckInput = {
  weight?: number | null;
  totalBodyWater?: number | null;
  protein?: number | null;
  mineral?: number | null;
  bodyFatMass?: number | null;
  fatFreeMass?: number | null;
  skeletalMuscleMass?: number | null;
  bmi?: number | null;
  percentBodyFat?: number | null;
  heightCm?: number | null;
};

const ok = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

export function validateMeasurement(v: CheckInput): Warning[] {
  const w: Warning[] = [];

  // 체수분 + 단백질 + 무기질 + 체지방 = 체중
  if (
    v.weight != null &&
    v.totalBodyWater != null &&
    v.protein != null &&
    v.mineral != null &&
    v.bodyFatMass != null
  ) {
    const sum = v.totalBodyWater + v.protein + v.mineral + v.bodyFatMass;
    if (!ok(sum, v.weight, 0.6)) {
      w.push({
        field: "composition.weight",
        message: `체수분+단백질+무기질+체지방 = ${sum.toFixed(1)}kg 인데 체중은 ${v.weight}kg 입니다. 숫자를 다시 확인해 주세요.`,
      });
    }
  }

  // BMI = 체중 / (키m)^2
  if (v.bmi != null && v.weight != null && v.heightCm != null && v.heightCm > 0) {
    const calc = v.weight / Math.pow(v.heightCm / 100, 2);
    if (!ok(calc, v.bmi, 0.4)) {
      w.push({
        field: "obesity.bmi",
        message: `키·체중으로 계산한 BMI는 ${calc.toFixed(1)} 인데 ${v.bmi} 로 읽혔습니다.`,
      });
    }
  }

  // 체지방률 = 체지방량 / 체중 * 100
  if (v.percentBodyFat != null && v.bodyFatMass != null && v.weight != null && v.weight > 0) {
    const calc = (v.bodyFatMass / v.weight) * 100;
    if (!ok(calc, v.percentBodyFat, 0.8)) {
      w.push({
        field: "obesity.percentBodyFat",
        message: `체지방량 기준 계산값은 ${calc.toFixed(1)}% 인데 ${v.percentBodyFat}% 로 읽혔습니다.`,
      });
    }
  }

  // 제지방량 = 체중 - 체지방량
  if (v.fatFreeMass != null && v.weight != null && v.bodyFatMass != null) {
    const calc = v.weight - v.bodyFatMass;
    if (!ok(calc, v.fatFreeMass, 0.6)) {
      w.push({
        field: "composition.fatFreeMass",
        message: `체중-체지방량 = ${calc.toFixed(1)}kg 인데 제지방량이 ${v.fatFreeMass}kg 로 읽혔습니다.`,
      });
    }
  }

  // 골격근량은 제지방량보다 클 수 없다
  if (v.skeletalMuscleMass != null && v.fatFreeMass != null && v.skeletalMuscleMass > v.fatFreeMass) {
    w.push({
      field: "muscleFat.skeletalMuscleMass",
      message: "골격근량이 제지방량보다 큽니다. 두 값을 확인해 주세요.",
    });
  }

  // 상식적인 범위
  if (v.percentBodyFat != null && (v.percentBodyFat < 1 || v.percentBodyFat > 60)) {
    w.push({ field: "obesity.percentBodyFat", message: "체지방률이 일반적인 범위를 벗어났습니다." });
  }
  if (v.weight != null && (v.weight < 20 || v.weight > 250)) {
    w.push({ field: "composition.weight", message: "체중이 일반적인 범위를 벗어났습니다." });
  }

  return w;
}

/** 키가 있으면 앱에서 추가로 계산하는 지표 */
export function computeDerived(input: {
  heightCm?: number | null;
  skeletalMuscleMass?: number | null;
  waistCircumference?: number | null;
}): { smi: number | null; waistToHeight: number | null } {
  const h = input.heightCm ? input.heightCm / 100 : null;
  return {
    smi:
      h && input.skeletalMuscleMass != null
        ? Number((input.skeletalMuscleMass / (h * h)).toFixed(2))
        : null,
    waistToHeight:
      input.heightCm && input.waistCircumference != null
        ? Number((input.waistCircumference / input.heightCm).toFixed(3))
        : null,
  };
}

/* ────────────────────────────────────────────────────────────
 * 적정 범위 (레이더 차트용)
 *
 * 결과지에 인쇄된 표준범위를 우선 쓰고, 없으면 키·성별로 계산한다.
 * 골격근량은 수치 범위가 인쇄되지 않는 기종이 많아,
 * 제지방량 표준범위에 현재 측정값의 (골격근/제지방) 비율을 적용해 환산한다.
 * ──────────────────────────────────────────────────────────── */

export type Range = { min: number; max: number; derived: boolean };

export type RadarAxis = {
  path: string;
  label: string;
  unit: string;
  /** 값이 낮을수록 좋은 지표 */
  lowerIsBetter?: boolean;
  value: number;
  range: Range;
  /** 적정 대비 위치 */
  status: "부족" | "적정" | "초과";
};

function printedRange(row: unknown, path: string): Range | null {
  const base = path.replace(/\.value$/, "");
  const min = pick(row, `${base}.min`);
  const max = pick(row, `${base}.max`);
  if (min == null || max == null || max <= min) return null;
  return { min, max, derived: false };
}

/** 레이더 3축(체중·골격근량·체지방률)을 만든다. 값이나 범위가 없는 축은 제외한다. */
export function buildRadarAxes(
  row: unknown,
  profile: { heightCm?: number | null; gender?: string | null },
): RadarAxis[] {
  const axes: RadarAxis[] = [];
  const h = profile.heightCm ? profile.heightCm / 100 : null;
  const isFemale = profile.gender === "female";

  const add = (
    path: string,
    label: string,
    unit: string,
    range: Range | null,
    lowerIsBetter?: boolean,
  ) => {
    const value = pick(row, path);
    if (value == null || !range) return;
    const status = value < range.min ? "부족" : value > range.max ? "초과" : "적정";
    axes.push({ path, label, unit, value, range, status, lowerIsBetter });
  };

  // 체중 — 없으면 BMI 18.5~23 으로 환산
  add(
    "composition.weight.value",
    "체중",
    "kg",
    printedRange(row, "composition.weight.value") ??
      (h ? { min: +(18.5 * h * h).toFixed(1), max: +(23 * h * h).toFixed(1), derived: true } : null),
  );

  // 골격근량 — 인쇄 범위가 없으면 제지방량 범위 × (골격근/제지방) 비율
  let smmRange = printedRange(row, "muscleFat.skeletalMuscleMass.value");
  if (!smmRange) {
    const ffmRange = printedRange(row, "composition.fatFreeMass.value");
    const smm = pick(row, "muscleFat.skeletalMuscleMass.value");
    const ffm = pick(row, "composition.fatFreeMass.value");
    if (ffmRange && smm != null && ffm != null && ffm > 0) {
      const ratio = smm / ffm;
      smmRange = {
        min: +(ffmRange.min * ratio).toFixed(1),
        max: +(ffmRange.max * ratio).toFixed(1),
        derived: true,
      };
    }
  }
  add("muscleFat.skeletalMuscleMass.value", "골격근량", "kg", smmRange);

  // 체지방률 — 없으면 인바디 기준(남 10~20 / 여 18~28)
  add(
    "obesity.percentBodyFat.value",
    "체지방률",
    "%",
    printedRange(row, "obesity.percentBodyFat.value") ??
      (isFemale
        ? { min: 18, max: 28, derived: true }
        : { min: 10, max: 20, derived: true }),
    true,
  );

  return axes;
}

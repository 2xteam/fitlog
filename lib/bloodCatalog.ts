/**
 * 피검사 항목 정의 — **지식**이다. 사용자 데이터가 아니라서 DB에 넣지 않는다.
 *
 * 채팅 RAG 청크(`lib/chatRagDocuments.ts`)와 같은 방식으로 코드에 두고,
 * 진료지침이 바뀌면 커밋으로 남긴다. 무엇을 근거로 바꿨는지가 이력에 남아야 한다.
 *
 * ────────────────────────────────────────────────────────────
 * 설계의 뼈대 — "정상수치"는 두 종류다
 *
 *  1. **참고구간**(reference interval)
 *     건강한 사람들을 모아 잰 값의 가운데 95%. 그 집단이 누구였느냐에 따라 달라져
 *     나이·성별·체격을 타고, 검사실과 장비마다 다르다.
 *     → 그래서 카탈로그에 고정하지 않고 **결과지에 인쇄된 값을 기록마다 저장한다.**
 *        여기 있는 `typicalRef`는 추출이 참고치를 놓쳤을 때만 쓰는 대비책이다.
 *
 *  2. **임상 결정치**(clinical decision limit)
 *     이 선을 넘으면 위험이 올라간다는 연구에서 나온 값. 인구 분포와 무관하다.
 *     → **나이가 많다고, 체격이 크다고 완화되지 않는다.** 카탈로그에 고정한다.
 *
 * 이 둘을 한 필드에 담으면 앱이 정확히 반대로 말하게 된다 —
 * "나이 있으시니 콜레스테롤 조금 높아도 괜찮아요". 중년 이후 콜레스테롤 *분포*가
 * 올라가는 건 맞지만, 치료 목표는 그래서 더 낮아진다.
 * ────────────────────────────────────────────────────────────
 */

export type PanelKey =
  | "liver"
  | "lipid"
  | "glucose"
  | "kidney"
  | "mineral"
  | "thyroid"
  | "cbc"
  | "muscle";

export const PANEL_LABELS: Record<PanelKey, string> = {
  liver: "간 기능",
  lipid: "지질",
  glucose: "혈당",
  kidney: "신장",
  mineral: "미네랄·비타민",
  thyroid: "갑상선",
  cbc: "혈액",
  muscle: "근육",
};

/** 구획을 보여주는 순서 */
export const PANEL_ORDER: PanelKey[] = [
  "liver",
  "lipid",
  "glucose",
  "kidney",
  "mineral",
  "thyroid",
  "cbc",
  "muscle",
];

/**
 * 참고치의 모양. 결과지에는 네 가지가 섞여 인쇄된다.
 *   between     8.0 ~ 23.0
 *   upper       ≤ 40
 *   lower       ≥ 60
 *   categorical Desirable <200 / Borderline 200~239 / High ≥240
 * 막대 그래프를 그리려면 이 구분이 필요하다.
 */
export type RefShape = "between" | "upper" | "lower" | "categorical";

export type Source = { name: string; year: number; url?: string };

export const SOURCES = {
  eone: { name: "이원의료재단 결과지 참고치", year: 2026 },
  kdaLipid: {
    name: "한국지질·동맥경화학회 이상지질혈증 진료지침",
    year: 2022,
    url: "https://lipid.or.kr/reference/guideline.php",
  },
  acr2020: {
    name: "ACR 통풍 진료지침",
    year: 2020,
    url: "https://pubmed.ncbi.nlm.nih.gov/32391934/",
  },
  endo2024: {
    name: "Endocrine Society · Vitamin D for the Prevention of Disease",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/38828931/",
  },
  accAha2026: { name: "ACC/AHA/NLA 이상지질혈증 지침", year: 2026 },
  reduceIt: {
    name: "REDUCE-IT (NEJM)",
    year: 2019,
    url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1812792",
  },
  cgh2016: {
    name: "Exercise-based Interventions for NAFLD (메타분석)",
    year: 2016,
    url: "https://www.cghjournal.org/article/S1542356516301495/pdf",
  },
  exNafld2021: {
    name: "Exercise without Weight Loss in NAFLD (메타분석)",
    year: 2021,
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8466505/",
  },
  tshAge: {
    name: "Interpreting Elevated TSH in Older Adults (NHANES III)",
    year: 2019,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6800731/",
  },
  egfrMuscle: {
    name: "Muscle mass and estimates of renal function",
    year: 2022,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9398222/",
  },
  refIntervals: {
    name: "Gender and age-specific reference intervals of biochemical analytes",
    year: 2021,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7956001/",
  },
} satisfies Record<string, Source>;

/** 참고구간이 나이·성별·체격을 타는 항목에만 붙인다. 없으면 보정하지 않는다. */
export type AdjustRule = {
  by: "age" | "sex" | "muscle" | "bmi";
  note: string;
  source: Source;
};

/** 임상 결정치. 참고구간과 섞지 않는다. */
export type DecisionLimit = {
  at: number;
  dir: "above" | "below";
  means: string;
  source: Source;
};

/**
 * 인바디 기록과 겹쳐야 보이는 맥락.
 * **맥락 제시까지만 한다.** 원인을 단정하지 않는다.
 */
export type CrossRule = {
  /** 이 피검사 값이 어느 쪽으로 벗어났을 때 */
  when: "high" | "low";
  /** 함께 볼 인바디 필드 (lib/inbody.ts 의 FIELDS path) */
  inbodyPath: string;
  inbodyLabel: string;
  /** 그 인바디 값이 어느 쪽일 때 규칙이 성립하는가 */
  inbodyWhen: "high" | "low";
  /**
   * 표준범위가 인쇄되지 않는 항목의 판단 기준.
   * 내장지방레벨처럼 결과지에 min/max 없이 숫자만 찍히는 항목이 있어서,
   * 이게 없으면 규칙이 영영 성립하지 않는다.
   */
  inbodyThreshold?: number;
  note: string;
  source?: Source;
};

export type Analyte = {
  code: string;
  label: string;
  /** Vision 추출 결과를 맞춰 붙이기 위한 표기 흔들림 */
  aliases: string[];
  unit: string;
  panel: PanelKey;
  specimen: "S" | "B" | "OT";
  refShape: RefShape;
  /** 값이 낮을수록 좋은 항목 (추이 그래프 색 판단) */
  lowerIsBetter?: boolean;
  /** 값이 높을수록 좋은 항목 (HDL·eGFR) */
  higherIsBetter?: boolean;
  decimals: number;
  /** 4축 요약에 올리는 대표 항목 */
  primary?: boolean;
  /** 추출이 참고치를 놓쳤을 때만 쓰는 대비값. 기록에 인쇄값이 있으면 그쪽이 이긴다 */
  typicalRef?: { low?: number; high?: number; text?: string };
  explain: string;
  adjust?: AdjustRule[];
  decisionLimits?: DecisionLimit[];
  crossInbody?: CrossRule[];
};

export const ANALYTES: Analyte[] = [
  /* ── 간 기능 ───────────────────────────────────────────── */
  {
    code: "ALT",
    label: "ALT (SGPT)",
    aliases: ["ALT", "SGPT", "ALT (SGPT)", "ALT(SGPT)"],
    unit: "U/L",
    panel: "liver",
    specimen: "S",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 0,
    primary: true,
    typicalRef: { high: 41 },
    explain:
      "간세포 안에 있는 효소예요. 간세포가 손상되면 혈액으로 새어 나와 수치가 올라가요. 간 항목 중에서 간에 가장 특이적이라 대표로 봐요.",
    adjust: [
      {
        by: "bmi",
        note: "체격·체지방과 상관이 있지만 기준을 올려 잡지는 않아요. 맥락으로만 봐요.",
        source: SOURCES.refIntervals,
      },
      { by: "sex", note: "남성이 조금 높은 편이에요.", source: SOURCES.refIntervals },
    ],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "research.visceralFatLevel",
        inbodyLabel: "내장지방레벨",
        inbodyWhen: "high",
        inbodyThreshold: 10,
        note: "두 기록이 같은 방향을 가리켜요. 체중을 줄이면 두 지표가 함께 움직이는 경우가 많아요.",
        source: SOURCES.cgh2016,
      },
      {
        when: "high",
        inbodyPath: "obesity.percentBodyFat.value",
        inbodyLabel: "체지방률",
        inbodyWhen: "high",
        note: "체지방이 함께 높아요. 운동은 체중이 줄지 않아도 ALT를 낮춘 연구가 있어요.",
        source: SOURCES.exNafld2021,
      },
    ],
  },
  {
    code: "AST",
    label: "AST (SGOT)",
    aliases: ["AST", "SGOT", "AST (SGOT)", "AST(SGOT)"],
    unit: "U/L",
    panel: "liver",
    specimen: "S",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 0,
    typicalRef: { high: 40 },
    explain:
      "간뿐 아니라 근육·심장에도 있는 효소예요. 그래서 AST만 오르고 ALT는 그대로면 간보다 근육 쪽을 먼저 생각해요.",
    crossInbody: [
      {
        when: "high",
        inbodyPath: "muscleFat.skeletalMuscleMass.value",
        inbodyLabel: "골격근량",
        inbodyWhen: "high",
        note: "AST는 근육에서도 나와요. 검사 전 격한 운동을 했다면 일시적으로 오를 수 있어요.",
      },
    ],
  },
  {
    code: "ALP",
    label: "Alkaline Phosphatase",
    aliases: ["ALP", "Alkaline Phosphatase", "ALP (Alkaline Phosphatase)"],
    unit: "U/L",
    panel: "liver",
    specimen: "S",
    refShape: "between",
    decimals: 0,
    typicalRef: { low: 30, high: 120 },
    explain: "담도와 뼈에서 나오는 효소예요. 담즙이 잘 흐르지 않거나 뼈 대사가 활발할 때 올라가요.",
    adjust: [
      {
        by: "age",
        note: "성장기에 크게 올랐다가 성인이 되며 안정돼요. 결과지도 '19세 이상' 기준을 따로 인쇄해요.",
        source: SOURCES.eone,
      },
    ],
  },
  {
    code: "GGT",
    label: "r-GTP",
    aliases: ["r-GTP", "GGT", "γ-GTP", "gamma-GTP", "r GTP"],
    unit: "U/L",
    panel: "liver",
    specimen: "S",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 0,
    typicalRef: { high: 55 },
    explain: "담도계 효소이면서 술과 약물에 민감하게 반응해요. 음주 습관을 볼 때 함께 봐요.",
    adjust: [
      { by: "sex", note: "남성이 뚜렷하게 높아요.", source: SOURCES.refIntervals },
      { by: "bmi", note: "체격과 상관이 있어요.", source: SOURCES.refIntervals },
    ],
  },
  {
    code: "TBIL",
    label: "Total Bilirubin",
    aliases: ["Total Bilirubin", "T.Bilirubin", "총빌리루빈", "Bilirubin,Total"],
    unit: "mg/dL",
    panel: "liver",
    specimen: "S",
    refShape: "upper",
    decimals: 2,
    typicalRef: { high: 1.2 },
    explain:
      "적혈구가 수명을 다하면 생기는 노란 색소예요. 간이 처리해 담즙으로 내보내요. 금식이나 피로에도 오르내려요.",
    adjust: [{ by: "sex", note: "남성이 조금 높아요.", source: SOURCES.refIntervals }],
  },
  {
    code: "ALB",
    label: "Albumin",
    aliases: ["Albumin", "알부민"],
    unit: "g/dL",
    panel: "liver",
    specimen: "S",
    refShape: "between",
    higherIsBetter: true,
    decimals: 2,
    typicalRef: { low: 3.5, high: 5.2 },
    explain: "간이 만드는 주된 단백질이에요. 영양 상태와 간 기능을 함께 반영해요.",
    adjust: [{ by: "sex", note: "성별 차이가 있어요.", source: SOURCES.refIntervals }],
  },
  {
    code: "TP",
    label: "Protein Total",
    aliases: ["Protein Total", "Total Protein", "총단백"],
    unit: "g/dL",
    panel: "liver",
    specimen: "S",
    refShape: "between",
    decimals: 2,
    typicalRef: { low: 6.6, high: 8.3 },
    explain: "혈액 속 단백질 전체예요. 알부민과 글로불린을 더한 값이라 둘을 같이 봐요.",
    adjust: [{ by: "age", note: "나이에 따라 분포가 달라져요.", source: SOURCES.refIntervals }],
  },
  {
    code: "LDH",
    label: "LDH",
    aliases: ["LDH", "Lactate Dehydrogenase", "LD"],
    unit: "U/L",
    panel: "liver",
    specimen: "S",
    refShape: "between",
    decimals: 0,
    typicalRef: { low: 140, high: 271 },
    explain:
      "거의 모든 세포에 있는 효소라 어디가 상했는지는 알려주지 않아요. 다른 항목과 같이 봐야 뜻이 생겨요.",
    adjust: [{ by: "age", note: "나이에 따라 분포가 달라져요.", source: SOURCES.refIntervals }],
  },

  /* ── 근육 ─────────────────────────────────────────────── */
  {
    code: "CPK",
    label: "CPK",
    aliases: ["CPK", "CK", "Creatine Kinase", "CPK (CK)"],
    unit: "U/L",
    panel: "muscle",
    specimen: "S",
    refShape: "upper",
    decimals: 0,
    typicalRef: { high: 260, text: "M < 260" },
    explain:
      "근육에 있는 효소예요. 근육을 많이 쓰면 올라가요. **검사 며칠 전 운동 여부를 모르면 해석할 수 없는** 대표 항목이에요.",
    adjust: [
      { by: "sex", note: "남성 기준이 따로 있어요(M < 260).", source: SOURCES.eone },
      {
        by: "muscle",
        note: "근육량에 비례하고, 격한 운동 뒤 며칠간 올라요.",
        source: SOURCES.refIntervals,
      },
    ],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "muscleFat.skeletalMuscleMass.value",
        inbodyLabel: "골격근량",
        inbodyWhen: "high",
        note: "근육량이 많으면 기본값이 높아요. 검사 전 2~3일 근력운동을 쉬고 다시 재보면 구분이 돼요.",
      },
    ],
  },

  /* ── 지질 ─────────────────────────────────────────────── */
  {
    code: "LDL",
    label: "Calculated LDL-C",
    aliases: ["Calculated LDL-C", "LDL-C", "LDL", "LDL Cholesterol", "LDL-콜레스테롤"],
    unit: "mg/dL",
    panel: "lipid",
    specimen: "S",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 0,
    primary: true,
    typicalRef: { high: 129 },
    explain:
      "혈관 벽에 쌓이는 쪽 콜레스테롤이에요. 지질 항목 중 심혈관 위험과 가장 직접 이어져요.",
    decisionLimits: [
      {
        at: 160,
        dir: "above",
        means: "높음. 위험인자와 함께 치료 여부를 상의할 구간이에요.",
        source: SOURCES.kdaLipid,
      },
      {
        at: 100,
        dir: "above",
        means:
          "당뇨병·경동맥질환 등이 있으면 이 선부터 치료 대상이에요. 위험도에 따라 목표가 달라져요.",
        source: SOURCES.kdaLipid,
      },
    ],
    adjust: [
      {
        by: "age",
        note:
          "나이가 들면 분포는 올라가지만 **목표치는 나이로 완화되지 않아요.** 위험도가 높을수록 목표가 낮아져요.",
        source: SOURCES.kdaLipid,
      },
    ],
  },
  {
    code: "TG",
    label: "Triglyceride",
    aliases: ["TG (Triglyceride)", "Triglyceride", "TG", "중성지방"],
    unit: "mg/dL",
    panel: "lipid",
    specimen: "S",
    refShape: "categorical",
    lowerIsBetter: true,
    decimals: 0,
    primary: true,
    typicalRef: { high: 150, text: "Normal < 150 / Borderline 150~199 / High 200~499" },
    explain:
      "음식에서 온 지방이 혈액에 떠 있는 형태예요. **직전 식사에 크게 좌우돼요** — 공복이 아니었다면 높게 나와요.",
    decisionLimits: [
      {
        at: 200,
        dir: "above",
        means: "국내 기준으로 이상지질혈증에 해당하는 구간이에요.",
        source: SOURCES.kdaLipid,
      },
      {
        at: 500,
        dir: "above",
        means: "매우 높음. 췌장염 위험이 올라가는 구간이라 진료가 필요해요.",
        source: SOURCES.kdaLipid,
      },
    ],
    adjust: [
      { by: "bmi", note: "체격·체지방과 상관이 있어요.", source: SOURCES.refIntervals },
      { by: "age", note: "나이에 따라 분포가 달라져요.", source: SOURCES.refIntervals },
    ],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "research.visceralFatLevel",
        inbodyLabel: "내장지방레벨",
        inbodyWhen: "high",
        inbodyThreshold: 10,
        note: "같은 생활습관 축에 있어요. 인바디 추이와 겹쳐 보면 변화가 함께 움직이는지 확인할 수 있어요.",
      },
    ],
  },
  {
    code: "HDL",
    label: "HDL-Cholesterol",
    aliases: ["HDL-Cholesterol", "HDL", "HDL 콜레스테롤"],
    unit: "mg/dL",
    panel: "lipid",
    specimen: "S",
    refShape: "lower",
    higherIsBetter: true,
    decimals: 1,
    typicalRef: { low: 40, text: "Low < 40 / High ≥ 60" },
    explain: "남는 콜레스테롤을 간으로 되돌리는 쪽이에요. 이 항목은 높은 쪽이 좋아요.",
    adjust: [
      { by: "sex", note: "여성이 높은 편이에요.", source: SOURCES.refIntervals },
      { by: "bmi", note: "체격과 상관이 있어요.", source: SOURCES.refIntervals },
    ],
  },
  {
    code: "TC",
    label: "Cholesterol, Total",
    aliases: ["Cholesterol,Total", "Cholesterol Total", "Total Cholesterol", "총콜레스테롤"],
    unit: "mg/dL",
    panel: "lipid",
    specimen: "S",
    refShape: "categorical",
    lowerIsBetter: true,
    decimals: 0,
    typicalRef: { high: 200, text: "Desirable < 200 / Borderline 200~239 / High ≥ 240" },
    explain:
      "HDL·LDL·중성지방을 모두 합친 값이에요. 총량만으로는 판단이 어려워 LDL과 HDL을 나눠서 봐요.",
    adjust: [{ by: "age", note: "나이에 따라 분포가 올라가요.", source: SOURCES.refIntervals }],
  },

  /* ── 혈당 ─────────────────────────────────────────────── */
  {
    code: "HBA1C",
    label: "HbA1c",
    aliases: ["HbA1c", "HbA1c-NGSP", "당화혈색소", "A1c"],
    unit: "%",
    panel: "glucose",
    specimen: "B",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 1,
    primary: true,
    typicalRef: { high: 5.6, text: "정상 ≤5.6 / 당뇨 고위험군 5.7~6.4 / 당뇨 ≥6.5" },
    explain:
      "지난 2~3개월 혈당의 평균을 반영해요. 하루 컨디션에 흔들리지 않아서 공복혈당보다 안정적이에요.",
    decisionLimits: [
      { at: 5.7, dir: "above", means: "당뇨병 전단계 구간이 시작돼요.", source: SOURCES.eone },
      { at: 6.5, dir: "above", means: "당뇨병 진단 기준에 해당해요. 진료가 필요해요.", source: SOURCES.eone },
    ],
    adjust: [
      {
        by: "age",
        note:
          "진단 기준은 나이로 바뀌지 않아요. 고령·동반질환 환자의 *치료* 목표를 조정하는 건 진료 영역이에요.",
        source: SOURCES.eone,
      },
    ],
  },
  {
    code: "GLU",
    label: "Glucose",
    aliases: ["Glucose (NaF)", "Glucose", "공복혈당", "혈당"],
    unit: "mg/dL",
    panel: "glucose",
    specimen: "OT",
    refShape: "between",
    lowerIsBetter: true,
    decimals: 0,
    typicalRef: { low: 70, high: 99 },
    explain:
      "채혈 시점의 혈당이에요. 공복 여부에 크게 좌우돼요. 한 번 높다고 해서 바로 뜻이 생기지는 않아요.",
    decisionLimits: [
      { at: 100, dir: "above", means: "공복혈당장애 구간이 시작돼요(100~125).", source: SOURCES.eone },
      { at: 126, dir: "above", means: "당뇨병 진단 기준에 해당해요. 진료가 필요해요.", source: SOURCES.eone },
    ],
    adjust: [{ by: "age", note: "나이에 따라 분포가 달라져요.", source: SOURCES.refIntervals }],
  },
  {
    code: "HBA1C_IFCC",
    label: "HbA1c-IFCC",
    aliases: ["HbA1c-IFCC", "IFCC"],
    unit: "mmol/mol",
    panel: "glucose",
    specimen: "B",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 0,
    typicalRef: { high: 38 },
    explain: "당화혈색소를 다른 단위로 표시한 값이에요. HbA1c와 같은 것을 가리켜요.",
  },
  {
    code: "HBA1C_EAG",
    label: "HbA1c-eAG",
    aliases: ["HbA1c-eAG", "eAG", "평균혈당"],
    unit: "mg/dL",
    panel: "glucose",
    specimen: "B",
    refShape: "upper",
    lowerIsBetter: true,
    decimals: 0,
    explain: "당화혈색소를 평균 혈당으로 환산한 값이에요. 새로 잰 값이 아니라 계산된 값이에요.",
  },

  /* ── 신장 ─────────────────────────────────────────────── */
  {
    code: "EGFR",
    label: "eGFR (IDMS-MDRD)",
    aliases: ["eGFR", "eGFR (IDMS-MDRD)", "사구체여과율", "GFR"],
    unit: "mL/min/1.73m²",
    panel: "kidney",
    specimen: "S",
    refShape: "lower",
    higherIsBetter: true,
    decimals: 2,
    primary: true,
    typicalRef: { low: 60 },
    explain:
      "신장이 피를 거르는 속도를 크레아티닌으로 **추정한** 값이에요. 직접 잰 게 아니라 계산이에요.",
    decisionLimits: [
      {
        at: 60,
        dir: "below",
        means: "이 선 아래가 3개월 이상 이어지면 만성 신장질환 평가 대상이에요. 진료에서 확인이 필요해요.",
        source: SOURCES.eone,
      },
    ],
    adjust: [
      {
        by: "age",
        note: "추정식이 나이를 이미 넣어 계산해요.",
        source: SOURCES.egfrMuscle,
      },
      {
        by: "muscle",
        note:
          "**추정식은 근육량을 넣지 않아요.** 같은 나이·성별이면 근육량이 같다고 가정하기 때문에, 근육이 많으면 신장 기능이 실제보다 낮게 나올 수 있어요.",
        source: SOURCES.egfrMuscle,
      },
    ],
    crossInbody: [
      {
        when: "low",
        inbodyPath: "muscleFat.skeletalMuscleMass.value",
        inbodyLabel: "골격근량",
        inbodyWhen: "high",
        note:
          "근육량이 많은 편이에요. 추정식은 근육량을 반영하지 않아 신장 기능을 실제보다 낮게 볼 수 있어요. 확인이 필요하면 근육량 영향을 덜 받는 시스타틴 C 검사가 있다는 점을 진료에서 물어보세요.",
        source: SOURCES.egfrMuscle,
      },
    ],
  },
  {
    code: "CRE",
    label: "Creatinine",
    aliases: ["Creatinine", "크레아티닌", "Cr"],
    unit: "mg/dL",
    panel: "kidney",
    specimen: "S",
    refShape: "between",
    decimals: 2,
    typicalRef: { low: 0.5, high: 1.2 },
    explain:
      "근육이 쓰이고 남은 찌꺼기예요. 신장이 걸러 내보내요. **근육이 많으면 기본값이 높아요.**",
    adjust: [
      { by: "sex", note: "남성이 높아요.", source: SOURCES.refIntervals },
      {
        by: "muscle",
        note: "근육량에 비례해요. 근육이 많은 사람은 신장이 멀쩡해도 높게 나올 수 있어요.",
        source: SOURCES.egfrMuscle,
      },
    ],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "muscleFat.skeletalMuscleMass.value",
        inbodyLabel: "골격근량",
        inbodyWhen: "high",
        note: "근육량이 많으면 크레아티닌이 높게 나와요. eGFR도 같이 보세요.",
        source: SOURCES.egfrMuscle,
      },
    ],
  },
  {
    code: "BUN",
    label: "BUN",
    aliases: ["BUN", "요소질소", "Urea Nitrogen"],
    unit: "mg/dL",
    panel: "kidney",
    specimen: "S",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 8, high: 23 },
    explain:
      "단백질이 분해되고 남은 질소예요. 신장 기능뿐 아니라 **탈수와 단백질 섭취량**에도 흔들려요.",
    adjust: [
      { by: "age", note: "나이에 따라 분포가 달라져요.", source: SOURCES.refIntervals },
      { by: "sex", note: "성별 차이가 있어요.", source: SOURCES.refIntervals },
    ],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "composition.totalBodyWater.value",
        inbodyLabel: "체수분",
        inbodyWhen: "low",
        note: "체수분이 낮아요. 탈수 상태에서 재면 BUN이 올라갈 수 있어요.",
      },
    ],
  },
  {
    code: "UA",
    label: "Uric acid",
    aliases: ["Uric acid", "요산", "Uric Acid"],
    unit: "mg/dL",
    panel: "kidney",
    specimen: "S",
    refShape: "between",
    lowerIsBetter: true,
    decimals: 2,
    typicalRef: { low: 3.5, high: 7.2 },
    explain:
      "퓨린이 분해되고 남은 물질이에요. 너무 높으면 관절에 결정으로 쌓여 통풍이 생길 수 있어요.",
    decisionLimits: [
      {
        at: 6.0,
        dir: "above",
        means:
          "통풍으로 치료 중인 사람의 목표는 6.0 미만이에요. 통풍이 없다면 이 값 자체가 치료 기준은 아니에요.",
        source: SOURCES.acr2020,
      },
    ],
    adjust: [
      {
        by: "sex",
        note: "남성이 높고, 여성은 폐경 후 올라가요. 결과지 참고치도 성별로 나뉘어요.",
        source: SOURCES.refIntervals,
      },
    ],
  },

  /* ── 미네랄·비타민 ────────────────────────────────────── */
  {
    code: "VITD",
    label: "25-OH Vit. D, Total",
    aliases: ["25-OH Vit. D, Total", "25-OH Vitamin D", "비타민D", "Vitamin D"],
    unit: "ng/mL",
    panel: "mineral",
    specimen: "S",
    refShape: "categorical",
    higherIsBetter: true,
    decimals: 2,
    typicalRef: {
      low: 30,
      text: "결핍 < 20 / 부족 20~30 / 충분 30~100 / 과다 > 100",
    },
    explain:
      "햇빛을 받아 피부에서 만들어지고 음식으로도 들어와요. 뼈 대사에 쓰여요. 실내 생활이 길면 낮게 나오는 경우가 흔해요.",
    decisionLimits: [
      {
        at: 20,
        dir: "below",
        means: "결핍 구간이에요. 보충을 상의할 대상이에요.",
        source: SOURCES.endo2024,
      },
    ],
    adjust: [
      {
        by: "age",
        note:
          "2024년 지침은 건강한 성인에게 이 검사를 일상적으로 하는 것 자체를 권하지 않아요. 목표 수치를 정할 근거가 충분하지 않다고 봤어요.",
        source: SOURCES.endo2024,
      },
    ],
  },
  {
    code: "CA",
    label: "Calcium",
    aliases: ["Calcium", "칼슘", "Ca"],
    unit: "mg/dL",
    panel: "mineral",
    specimen: "S",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 8.8, high: 10.6 },
    explain: "뼈와 근육·신경에 쓰이는 미네랄이에요. 혈중 농도는 좁게 유지돼요.",
    adjust: [
      { by: "age", note: "나이에 따라 분포가 달라져요.", source: SOURCES.refIntervals },
      { by: "sex", note: "성별 차이가 있어요.", source: SOURCES.refIntervals },
    ],
  },
  {
    code: "MG",
    label: "Magnesium",
    aliases: ["Magnesium", "마그네슘", "Mg"],
    unit: "mg/dL",
    panel: "mineral",
    specimen: "S",
    refShape: "between",
    decimals: 2,
    typicalRef: { low: 1.8, high: 2.6 },
    explain: "근육과 신경 기능에 쓰이는 미네랄이에요. 몸속 대부분이 세포 안에 있어 혈액 값은 일부만 보여줘요.",
  },

  /* ── 갑상선 ───────────────────────────────────────────── */
  {
    code: "TSH",
    label: "TSH",
    aliases: ["TSH", "갑상선자극호르몬"],
    unit: "μIU/mL",
    panel: "thyroid",
    specimen: "S",
    refShape: "between",
    decimals: 3,
    typicalRef: { low: 0.27, high: 4.2 },
    explain:
      "뇌가 갑상선에 보내는 신호예요. 갑상선 호르몬이 부족하면 신호를 더 크게 보내서 TSH가 올라가요.",
    adjust: [
      {
        by: "age",
        note:
          "**분포 전체가 나이와 함께 위로 이동해요.** NHANES III에서 97.5백분위가 20세 3.56, 80세 7.49 μIU/mL였어요. 고정 상한을 쓰면 고령층이 과하게 이상으로 분류돼요.",
        source: SOURCES.tshAge,
      },
    ],
  },
  {
    code: "FT4",
    label: "Free T4",
    aliases: ["Free T4", "FT4", "유리티록신"],
    unit: "ng/dL",
    panel: "thyroid",
    specimen: "S",
    refShape: "between",
    decimals: 2,
    typicalRef: { low: 0.76, high: 1.7 },
    explain: "실제로 몸에서 작용하는 갑상선 호르몬이에요. TSH와 짝지어 봐야 뜻이 분명해져요.",
  },

  /* ── 혈액 ─────────────────────────────────────────────── */
  {
    code: "HB",
    label: "Hb",
    aliases: ["Hb", "Hemoglobin", "혈색소", "헤모글로빈"],
    unit: "g/dL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 13, high: 17.5 },
    explain: "적혈구 안에서 산소를 나르는 단백질이에요. 빈혈을 볼 때 가장 먼저 보는 값이에요.",
    adjust: [
      {
        by: "sex",
        note: "남성이 뚜렷하게 높아요. 결과지도 성별 기준으로 인쇄돼요.",
        source: SOURCES.eone,
      },
    ],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "composition.totalBodyWater.value",
        inbodyLabel: "체수분",
        inbodyWhen: "low",
        note: "체수분이 낮아요. 탈수로 피가 농축되면 높게 보일 수 있어요. 측정 조건 차이를 먼저 의심해요.",
      },
    ],
  },
  {
    code: "HCT",
    label: "Hct",
    aliases: ["Hct", "Hematocrit", "적혈구용적률"],
    unit: "%",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 40, high: 54 },
    explain: "혈액에서 적혈구가 차지하는 부피 비율이에요. 보통 혈색소의 약 3배쯤 돼요.",
    adjust: [{ by: "sex", note: "남성이 높아요.", source: SOURCES.eone }],
    crossInbody: [
      {
        when: "high",
        inbodyPath: "composition.totalBodyWater.value",
        inbodyLabel: "체수분",
        inbodyWhen: "low",
        note: "탈수 상태에서 재면 높게 나올 수 있어요.",
      },
    ],
  },
  {
    code: "RBC",
    label: "RBC",
    aliases: ["RBC", "적혈구", "Red Blood Cell"],
    unit: "10⁶/μL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 2,
    typicalRef: { low: 4.5, high: 6.5 },
    explain: "적혈구 수예요. 혈색소·적혈구용적률과 함께 봐요.",
    adjust: [{ by: "sex", note: "남성이 높아요.", source: SOURCES.eone }],
  },
  {
    code: "WBC",
    label: "WBC",
    aliases: ["WBC", "백혈구", "White Blood Cell"],
    unit: "10³/μL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 2,
    typicalRef: { low: 4, high: 10 },
    explain: "감염과 싸우는 세포예요. 감염·염증·스트레스에 따라 오르내려요.",
  },
  {
    code: "PLT",
    label: "Platelet",
    aliases: ["Platelet", "혈소판", "PLT"],
    unit: "10³/μL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 0,
    typicalRef: { low: 150, high: 450 },
    explain: "피를 굳게 하는 조각이에요. 간 질환이 있으면 줄어들기도 해요.",
  },
  {
    code: "MCV",
    label: "MCV",
    aliases: ["MCV", "평균적혈구용적"],
    unit: "fL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 80, high: 100 },
    explain:
      "적혈구 하나의 평균 크기예요. 빈혈이 있을 때 **원인을 가르는 열쇠**가 돼요 — 작으면 철 결핍, 크면 비타민 B12·엽산 쪽을 봐요.",
  },
  {
    code: "MCH",
    label: "MCH",
    aliases: ["MCH", "평균적혈구혈색소량"],
    unit: "pg",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 28.2, high: 33.3 },
    explain: "적혈구 하나에 든 혈색소 양이에요. MCV와 같은 방향으로 움직여요.",
  },
  {
    code: "MCHC",
    label: "MCHC",
    aliases: ["MCHC", "평균적혈구혈색소농도"],
    unit: "g/dL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 32, high: 36 },
    explain: "적혈구 안 혈색소의 농도예요. 혈색소를 적혈구용적률로 나눈 값이라 계산으로 검산할 수 있어요.",
  },
  {
    code: "RDW",
    label: "RDW",
    aliases: ["RDW", "적혈구분포폭"],
    unit: "%",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 11, high: 15 },
    explain: "적혈구 크기가 얼마나 들쭉날쭉한지예요. 크기가 섞이기 시작하면 먼저 움직이는 경우가 있어요.",
  },
  {
    code: "MPV",
    label: "MPV",
    aliases: ["MPV", "평균혈소판용적"],
    unit: "fL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 9, high: 13 },
    explain: "혈소판 하나의 평균 크기예요. 혈소판 수와 함께 봐요.",
  },
  {
    code: "PDW",
    label: "PDW",
    aliases: ["PDW", "혈소판분포폭"],
    unit: "fL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 1,
    typicalRef: { low: 9, high: 17 },
    explain: "혈소판 크기가 얼마나 고른지예요.",
  },
  {
    code: "EOS",
    label: "Eosinophil count",
    aliases: ["Eosinophil count", "호산구", "Eosinophil"],
    unit: "/μL",
    panel: "cbc",
    specimen: "B",
    refShape: "between",
    decimals: 0,
    typicalRef: { low: 50, high: 500 },
    explain: "알레르기와 기생충 반응에 관여하는 백혈구예요. 알레르기가 있으면 올라가기도 해요.",
  },
];

/* ────────────────────────────────────────────────────────────
 * 조회 도우미
 * ──────────────────────────────────────────────────────────── */

const BY_CODE = new Map(ANALYTES.map((a) => [a.code, a]));

/** 별칭까지 소문자·공백 제거해 정규화한 색인 — Vision 표기 흔들림을 흡수한다 */
const BY_ALIAS = new Map<string, Analyte>();
for (const a of ANALYTES) {
  for (const name of [a.code, a.label, ...a.aliases]) {
    BY_ALIAS.set(normalizeName(name), a);
  }
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s.,()·\-_]/g, "");
}

export function findAnalyte(code: string): Analyte | undefined {
  return BY_CODE.get(code);
}

/** 결과지에 인쇄된 이름으로 항목을 찾는다. 못 찾으면 `etc`로 보관한다. */
export function matchAnalyte(printedName: string): Analyte | undefined {
  return BY_ALIAS.get(normalizeName(printedName));
}

/** 4축 요약에 올리는 대표 항목 (간 · 지질 · 혈당 · 신장) */
export const PRIMARY_ANALYTES = ANALYTES.filter((a) => a.primary);

export type AnalytePanel = { key: PanelKey; label: string; analytes: Analyte[] };

/** 주어진 항목들을 구획 순서대로 묶는다. 빈 구획은 빼고 돌려준다. */
export function groupByPanel(codes: string[]): AnalytePanel[] {
  const set = new Set(codes);
  return PANEL_ORDER.map((key) => ({
    key,
    label: PANEL_LABELS[key],
    analytes: ANALYTES.filter((a) => a.panel === key && set.has(a.code)),
  })).filter((p) => p.analytes.length > 0);
}

/**
 * 인바디 항목의 뜻과 기준 — **지식**이다. `lib/inbody.ts`의 `FIELDS`(측정 구조)와
 * 나란히 두고 경로(`path`)로 이어 붙인다.
 *
 * 피검사(`lib/bloodCatalog.ts`)와 같은 규칙을 따른다.
 *
 *  1. **표준범위**(결과지에 인쇄된 값)가 언제나 우선이다. 기종·성별·나이에 따라 다르고,
 *     인바디가 자체 기준으로 찍어준다. 여기 있는 `cutoff`은 인쇄값이 없을 때만 쓴다.
 *  2. **임상 결정치**는 그와 별개다. 근감소증 진단 기준(AWGS)처럼 연구에서 나온 선은
 *     기종이 바뀌어도 그대로다.
 *
 * ────────────────────────────────────────────────────────────
 * ⚠️ 인바디에만 있는 함정 — **측정 방법이 곧 기준을 정한다**
 *
 * BIA(생체전기저항)는 DXA와 값이 다르다. InBody 770 연구에서 전신 근육량을 DXA보다
 * 2.28kg, 사지근육량을 1.97kg 높게 쟀다. 체지방률은 반대로 낮게 나오는 경향이 있다
 * (남 −4.2%, 여 −2.8%).
 *
 * 그래서 AWGS 2019의 근감소증 기준도 **측정 방법마다 다르다** —
 * 여성 기준이 DXA는 5.4, BIA는 5.7 kg/m²다. BIA가 근육을 더 높게 재니 선도 올려 잡는다.
 * 인바디 값에 DXA 기준을 갖다 대면 근감소를 놓친다.
 * ────────────────────────────────────────────────────────────
 */

import { FIELDS, pick, type FieldDef } from "@/lib/inbody";
import type { Source } from "@/lib/evidence";

export const INBODY_SOURCES = {
  awgs2019: {
    name: "AWGS 2019 근감소증 진단 합의",
    year: 2019,
    url: "https://www.sciencedirect.com/science/article/abs/pii/S1525861019308722",
  },
  biaVsDxa: {
    name: "BIA와 DXA의 근육량 측정 비교",
    year: 2018,
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6024648/",
  },
  mfbiaReal: {
    name: "실제 환경에서의 다주파수 BIA 정확도",
    year: 2025,
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12678178/",
  },
  vfaJapan: {
    name: "내장지방 단면적 기준 (일본비만학회 100cm²)",
    year: 2007,
    url: "https://www.nature.com/articles/hr200743.pdf",
  },
  vfaKorea: {
    name: "한국인 대사증후군 위험 내장지방 단면적 절단값",
    year: 2009,
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2797519/",
  },
  phaseAngle: {
    name: "위상각 인구 참고값 (연령·성별)",
    year: 2005,
    url: "https://ajcn.nutrition.org/article/S0002-9165(23)29508-8/fulltext",
  },
  phaseAngleDisability: {
    name: "위상각과 노인 장애 발생 예측",
    year: 2020,
    url: "https://onlinelibrary.wiley.com/doi/10.1002/jcsm.12492",
  },
  ecwRatio: {
    name: "ECW/TBW 비와 임상 결과",
    year: 2021,
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8118427/",
  },
  morton2018: {
    name: "단백질 보충과 저항운동 메타분석 (BJSM)",
    year: 2018,
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
  },
  inbodyManual: { name: "인바디 결과지 자체 기준", year: 2026 },
} satisfies Record<string, Source>;

export type InbodyAdjust = {
  by: "age" | "sex" | "height" | "method" | "condition";
  note: string;
  source: Source;
};

/** 인쇄된 표준범위가 없을 때 쓰는 기준. 성별로 갈리면 `male`/`female`을 채운다. */
export type InbodyCutoff = {
  low?: number;
  high?: number;
  male?: { low?: number; high?: number };
  female?: { low?: number; high?: number };
  label: string;
  source: Source;
};

/** 피검사 기록과 겹쳐야 보이는 맥락 (피검사 → 인바디의 반대 방향) */
export type CrossBlood = {
  when: "high" | "low";
  code: string;
  bloodLabel: string;
  bloodWhen: "high" | "low";
  note: string;
  source?: Source;
};

export type InbodyKnowledge = {
  path: string;
  explain: string;
  cutoff?: InbodyCutoff;
  adjust?: InbodyAdjust[];
  crossBlood?: CrossBlood[];
};

export const INBODY_KNOWLEDGE: InbodyKnowledge[] = [
  {
    path: "composition.weight.value",
    explain:
      "옷·수분·식사에 따라 하루 안에서도 1~2kg 오르내려요. 그래서 하루의 값보다 **같은 조건에서 잰 값들의 흐름**이 중요해요.",
    adjust: [
      {
        by: "condition",
        note: "아침 공복, 화장실 다녀온 뒤, 운동 전이 가장 안정적이에요.",
        source: INBODY_SOURCES.mfbiaReal,
      },
    ],
  },
  {
    path: "muscleFat.skeletalMuscleMass.value",
    explain:
      "팔·다리·몸통 근육량의 합이에요. 제지방량(체중 − 체지방량)보다 작아요. 근육은 한 달에 0.5~1kg만 늘어도 빠른 편이에요.",
    adjust: [
      {
        by: "method",
        note:
          "BIA는 DXA보다 근육량을 높게 재요. 한 연구에서 InBody 770이 전신 근육량을 2.28kg, 사지근육량을 1.97kg 더 높게 쟀어요. **다른 장비 값과 직접 비교하지 마세요.**",
        source: INBODY_SOURCES.biaVsDxa,
      },
      { by: "sex", note: "남성이 뚜렷하게 많아요.", source: INBODY_SOURCES.awgs2019 },
    ],
  },
  {
    path: "derived.smi",
    explain:
      "사지근육량을 키(m)의 제곱으로 나눈 값이에요. 키가 다른 사람끼리 근육량을 견줄 수 있게 맞춘 지표라, **근감소증 판단에 쓰는 것은 근육량(kg)이 아니라 이 값**이에요.",
    cutoff: {
      male: { low: 7.0 },
      female: { low: 5.7 },
      label: "AWGS 2019 · BIA 기준 (남 7.0 / 여 5.7 미만이면 근육량 적음)",
      source: INBODY_SOURCES.awgs2019,
    },
    adjust: [
      {
        by: "method",
        note:
          "**측정 방법마다 기준이 달라요.** 같은 AWGS 기준인데 여성은 DXA 5.4, BIA 5.7이에요. BIA가 근육을 더 높게 재니 선도 올려 잡은 거예요. 인바디 값에는 BIA 기준을 써야 해요.",
        source: INBODY_SOURCES.awgs2019,
      },
      {
        by: "age",
        note: "근감소증은 나이가 들며 늘어요. 다만 기준값 자체는 나이로 바뀌지 않아요.",
        source: INBODY_SOURCES.awgs2019,
      },
    ],
  },
  {
    path: "obesity.percentBodyFat.value",
    explain:
      "체지방량 ÷ 체중 × 100이에요. 몸무게가 같아도 이 값이 다르면 몸의 구성이 다르다는 뜻이에요.",
    cutoff: {
      male: { low: 10, high: 20 },
      female: { low: 18, high: 28 },
      label: "인바디 자체 적정 범위 (진료지침 기준이 아니에요)",
      source: INBODY_SOURCES.inbodyManual,
    },
    adjust: [
      {
        by: "method",
        note:
          "BIA는 체지방률을 DXA보다 낮게 재는 경향이 있어요(남 약 −4.2%p, 여 −2.8%p). 측정 조건이 안 맞으면 오차가 더 커져요.",
        source: INBODY_SOURCES.mfbiaReal,
      },
      {
        by: "condition",
        note: "식사·수분·운동 직후에는 체수분이 흔들려 1~2%p까지 달라 보여요.",
        source: INBODY_SOURCES.mfbiaReal,
      },
    ],
    crossBlood: [
      {
        when: "high",
        code: "ALT",
        bloodLabel: "ALT",
        bloodWhen: "high",
        note: "간 수치도 함께 높아요. 운동은 체중이 줄지 않아도 ALT를 낮춘 근거가 있어요.",
      },
    ],
  },
  {
    path: "obesity.bmi.value",
    explain:
      "체중 ÷ 키(m)²예요. 근육과 지방을 구분하지 못해서, **근육이 많은 사람은 BMI만으로 과체중으로 분류돼요.** 체지방률과 함께 봐야 해요.",
    cutoff: {
      low: 18.5,
      high: 23,
      label: "아시아·태평양 기준 (23 이상 과체중, 25 이상 비만)",
      source: INBODY_SOURCES.inbodyManual,
    },
    adjust: [
      {
        by: "sex",
        note: "같은 BMI라도 여성의 체지방률이 더 높은 경향이 있어요.",
        source: INBODY_SOURCES.inbodyManual,
      },
    ],
  },
  {
    path: "research.visceralFatArea",
    explain:
      "배 속 장기 사이에 낀 지방의 단면적이에요. 피부 아래 지방보다 대사질환과 더 가깝게 이어져요.",
    cutoff: {
      high: 100,
      label: "일본비만학회 100cm² (국내 연구는 값이 갈려요)",
      source: INBODY_SOURCES.vfaJapan,
    },
    adjust: [
      {
        by: "condition",
        note:
          "**100cm²는 일본 기준이고 국내 연구는 다르게 나와요.** 한국인 대상 연구에서 남 84~134cm², 여 58~91cm² 로 폭이 컸어요. 절대값보다 **내 값의 변화**를 보는 편이 확실해요.",
        source: INBODY_SOURCES.vfaKorea,
      },
      {
        by: "method",
        note: "인바디의 내장지방은 CT로 직접 잰 게 아니라 임피던스로 추정한 값이에요.",
        source: INBODY_SOURCES.mfbiaReal,
      },
    ],
    crossBlood: [
      {
        when: "high",
        code: "TG",
        bloodLabel: "중성지방",
        bloodWhen: "high",
        note: "같은 생활습관 축에 있어요. 두 추이가 함께 움직이는지 보면 변화가 실제인지 알 수 있어요.",
      },
    ],
  },
  {
    path: "research.visceralFatLevel",
    explain:
      "내장지방 정도를 단계로 나타낸 값이에요. 보통 10 미만을 적정으로 봐요. 허리둘레와 함께 보세요.",
    cutoff: { high: 10, label: "인바디 자체 기준 (10 미만 적정)", source: INBODY_SOURCES.inbodyManual },
  },
  {
    path: "evaluation.ecwRatio",
    explain:
      "몸 전체 수분 중 세포 **바깥**에 있는 물의 비율이에요. 세포 안팎의 물이 균형을 잃으면 올라가요.",
    cutoff: {
      high: 0.39,
      label: "정상 0.360~0.390 · 0.400 초과면 진료 권고",
      source: INBODY_SOURCES.ecwRatio,
    },
    adjust: [
      {
        by: "condition",
        note: "짠 음식·수면 부족·과한 운동 다음 날 일시적으로 올라요. 한 번의 값으로 판단하지 않아요.",
        source: INBODY_SOURCES.ecwRatio,
      },
    ],
    crossBlood: [
      {
        when: "high",
        code: "ALB",
        bloodLabel: "알부민",
        bloodWhen: "low",
        note: "알부민이 낮으면 혈관 밖으로 물이 새기 쉬워요. 두 값이 함께 움직이면 진료에서 확인해 보세요.",
      },
    ],
  },
  {
    path: "evaluation.phaseAngle",
    explain:
      "전류가 세포막을 지날 때 생기는 위상 차이예요. **세포막이 튼튼하고 세포가 많을수록 커져요.** 근육량과는 다른 것을 봐요 — 근육의 '양'이 아니라 '질'에 가까워요.",
    cutoff: {
      male: { low: 5 },
      female: { low: 5 },
      label: "건강한 성인 대략 5~7° (남 평균 7.3 · 여 6.4)",
      source: INBODY_SOURCES.phaseAngle,
    },
    adjust: [
      {
        by: "age",
        note: "나이가 들며 낮아져요. 성별로도 달라서 같은 값이라도 뜻이 달라요.",
        source: INBODY_SOURCES.phaseAngle,
      },
      {
        by: "sex",
        note: "여성이 남성보다 낮은 편이에요.",
        source: INBODY_SOURCES.phaseAngle,
      },
    ],
  },
  {
    path: "composition.totalBodyWater.value",
    explain:
      "몸 안의 물 전체예요. 체중의 절반 이상을 차지해요. **인바디가 이 물을 재서 나머지를 추정하기 때문에**, 수분 상태가 흔들리면 다른 값도 함께 흔들려요.",
    adjust: [
      {
        by: "condition",
        note:
          "인바디 정확도가 수분 상태에 가장 크게 좌우돼요. 조건을 통제하지 않으면 실제 환경에서 오차가 커진다는 것이 확인됐어요.",
        source: INBODY_SOURCES.mfbiaReal,
      },
    ],
    crossBlood: [
      {
        when: "low",
        code: "HCT",
        bloodLabel: "적혈구용적률",
        bloodWhen: "high",
        note: "체수분이 낮은 날 피검사를 했다면 혈액이 농축돼 혈색소·적혈구용적률이 높게 나올 수 있어요.",
      },
    ],
  },
  {
    path: "composition.protein.value",
    explain:
      "근육을 이루는 단백질의 무게예요. 몸의 단백질은 대부분 근육에 있어서 골격근량과 같은 방향으로 움직여요.",
  },
  {
    path: "composition.mineral.value",
    explain: "뼈와 체액에 있는 무기질이에요. 대부분이 뼈에 있어 짧은 기간에는 잘 변하지 않아요.",
  },
  {
    path: "composition.fatFreeMass.value",
    explain: "체중에서 지방을 뺀 나머지예요. 근육·물·뼈·장기를 모두 포함해서 골격근량보다 커요.",
  },
  {
    path: "composition.bodyFatMass.value",
    explain: "몸에 있는 지방의 무게예요. 체지방률과 함께 보면 체중 변화가 지방인지 근육인지 알 수 있어요.",
  },
  {
    path: "research.bmr",
    explain:
      "가만히 있어도 쓰는 열량이에요. **근육량이 늘면 함께 올라가요.** 하루 소비량은 여기에 활동량을 곱해 어림잡아요.",
    adjust: [
      {
        by: "method",
        note:
          "인바디의 기초대사량은 직접 잰 값이 아니라 제지방량으로 계산한 추정치예요. 사람마다 실제와 차이가 있어요.",
        source: INBODY_SOURCES.inbodyManual,
      },
    ],
  },
  {
    path: "research.waistCircumference",
    explain:
      "배꼽 높이 허리둘레예요. 내장지방을 가늠하는 가장 손쉬운 지표라 대사증후군 기준에도 들어가요.",
    cutoff: {
      male: { high: 90 },
      female: { high: 85 },
      label: "국내 복부비만 기준 (남 90cm · 여 85cm 이상)",
      source: INBODY_SOURCES.vfaKorea,
    },
  },
  {
    path: "derived.waistToHeight",
    explain:
      "허리둘레 ÷ 키예요. 0.5 미만을 목표로 보는 방식이 널리 쓰여요 — \"허리둘레가 키의 절반을 넘지 않게\".",
    cutoff: { high: 0.5, label: "0.5 미만 권장", source: INBODY_SOURCES.vfaKorea },
  },
  {
    path: "research.ffmi",
    explain: "제지방량을 키(m)²로 나눈 값이에요. 근육의 발달 정도를 키와 무관하게 견주려고 써요.",
  },
  {
    path: "research.fmi",
    explain: "체지방량을 키(m)²로 나눈 값이에요. 체지방률과 달리 체중 변화에 덜 휘둘려요.",
  },
  {
    path: "evaluation.inbodyScore",
    explain:
      "인바디가 자체 계산한 점수예요. **진료지침의 지표가 아니라 기종별 자체 산식**이라, 기종이 바뀌면 점수도 달라질 수 있어요.",
    adjust: [
      {
        by: "method",
        note: "기종마다 산식이 달라요. 같은 기종끼리만 견주세요.",
        source: INBODY_SOURCES.inbodyManual,
      },
    ],
  },
  {
    path: "research.bcm",
    explain: "체세포량. 실제로 대사를 하는 세포의 무게예요. 영양 상태를 볼 때 써요.",
  },
  {
    path: "research.obesityDegree",
    explain: "표준체중 대비 현재 체중의 비율이에요. BMI와 마찬가지로 근육과 지방을 구분하지 못해요.",
  },
  {
    path: "composition.intracellularWater.value",
    explain:
      "세포 **안**에 있는 물이에요. 근육 세포가 많을수록 커져서, 골격근량과 같은 방향으로 움직여요.",
  },
  {
    path: "composition.extracellularWater.value",
    explain:
      "세포 **바깥**(혈액·조직 사이)에 있는 물이에요. 이 값만 늘면 붓는 쪽을 의심해요. 세포외수분비와 함께 보세요.",
  },
  {
    path: "composition.boneMineral.value",
    explain: "무기질 중 뼈에 들어 있는 양이에요. 짧은 기간에는 거의 변하지 않아요.",
  },
  {
    path: "composition.softLeanMass.value",
    explain:
      "제지방량에서 뼈를 뺀 값이에요. 근육과 물을 합친 것에 가까워서 **골격근량과는 다른 값**이에요. 둘을 헷갈리기 쉬워요.",
  },
  {
    path: "obesity.waistHipRatio.value",
    explain:
      "허리둘레 ÷ 엉덩이둘레예요. 지방이 배에 몰려 있는지를 봐요. 같은 체지방률이라도 이 값이 높으면 대사 위험이 더 큰 편이에요.",
    cutoff: {
      male: { high: 0.9 },
      female: { high: 0.85 },
      label: "WHO 복부비만 참고 기준 (남 0.90 · 여 0.85 초과)",
      source: INBODY_SOURCES.vfaKorea,
    },
  },
  {
    path: "research.recommendedCalories",
    explain:
      "인바디가 목표를 기준으로 계산한 하루 권장 섭취 열량이에요. **직접 잰 값이 아니라 추정**이라 참고선으로만 쓰세요.",
    adjust: [
      {
        by: "method",
        note: "기초대사량 추정치에 활동량을 곱해 계산해요. 실제 소비량은 사람마다 달라요.",
        source: INBODY_SOURCES.inbodyManual,
      },
    ],
  },
  {
    path: "research.bmc",
    explain: "뼈에 든 무기질의 양이에요. 골밀도 검사와는 다른 값이라 뼈 건강 판단에 그대로 쓰지 않아요.",
  },
  {
    path: "research.armCircumference",
    explain: "위팔의 둘레예요. 근육과 지방을 모두 포함해서, 아래 상완근육둘레와 함께 봐야 뜻이 생겨요.",
  },
  {
    path: "research.armMuscleCircumference",
    explain:
      "위팔 둘레에서 피하지방을 뺀 값이에요. 팔의 근육만 따로 본 값이라 영양 상태 평가에 쓰여요.",
  },
  {
    path: "research.bodyDevelopmentScore",
    explain:
      "인바디가 자체 산식으로 계산한 신체 발달 점수예요. 진료지침의 지표가 아니라 기종별 자체 값이에요.",
    adjust: [
      {
        by: "method",
        note: "기종마다 산식이 달라요. 같은 기종끼리만 견주세요.",
        source: INBODY_SOURCES.inbodyManual,
      },
    ],
  },
  {
    path: "control.targetWeight",
    explain:
      "인바디가 표준 체지방률을 기준으로 계산한 체중이에요. 사람마다 목표가 다르니 참고로만 보세요.",
  },
  {
    path: "control.weightControl",
    explain:
      "적정체중까지 얼마나 남았는지 인바디가 계산한 값이에요. 목표는 사람마다 달라서 참고로만 보세요.",
  },
  {
    path: "control.fatControl",
    explain: "지방을 얼마나 줄이면 좋을지 인바디가 제안한 값이에요.",
  },
  {
    path: "control.muscleControl",
    explain: "근육을 얼마나 늘리면 좋을지 인바디가 제안한 값이에요.",
  },
];

const BY_PATH = new Map(INBODY_KNOWLEDGE.map((k) => [k.path, k]));

export function knowledgeOf(path: string): InbodyKnowledge | undefined {
  return BY_PATH.get(path);
}

/**
 * 이 항목에 쓸 기준을 고른다.
 * 결과지에 인쇄된 표준범위가 **언제나 우선**이고, 없을 때만 카탈로그로 물러선다.
 */
export function cutoffFor(
  path: string,
  gender: string | null | undefined,
): { low: number | null; high: number | null; label: string; source: Source } | null {
  const k = BY_PATH.get(path);
  if (!k?.cutoff) return null;
  const c = k.cutoff;
  const bySex = gender === "female" ? c.female : c.male;
  return {
    low: bySex?.low ?? c.low ?? null,
    high: bySex?.high ?? c.high ?? null,
    label: c.label,
    source: c.source,
  };
}

/* ────────────────────────────────────────────────────────────
 * 표준범위를 벗어난 항목 모으기
 *
 * 인바디는 표준범위를 이미 저장하고 있는데도 벗어난 것을 모아주지 않았다.
 * 36개를 다 훑어야 무엇이 달라졌는지 알 수 있었다. 피검사 쪽에서 만든
 * "이번에 벗어난 항목"을 같은 방식으로 가져온다.
 * ──────────────────────────────────────────────────────────── */

export type InbodyFlag = {
  field: FieldDef;
  value: number;
  status: "low" | "high";
  /** 값이 나쁜 쪽으로 벗어났는가 (체지방률은 높은 쪽, 골격근량은 낮은 쪽) */
  concerning: boolean;
  low: number | null;
  high: number | null;
  /** 결과지에 인쇄된 범위인가 — 아니면 카탈로그 기준으로 판단한 것이다 */
  printed: boolean;
  rangeLabel: string | null;
  rangeSource: Source | null;
  /** 직전 기록에서도 같은 방향으로 벗어났는가 */
  repeated: boolean;
  knowledge?: InbodyKnowledge;
};

function rangeOf(
  row: unknown,
  f: FieldDef,
  gender: string | null | undefined,
): { low: number | null; high: number | null; printed: boolean; label: string | null; source: Source | null } | null {
  const base = f.path.replace(/\.value$/, "");
  const min = pick(row, `${base}.min`);
  const max = pick(row, `${base}.max`);
  if (min != null || max != null) {
    return { low: min, high: max, printed: true, label: null, source: null };
  }
  const c = cutoffFor(f.path, gender);
  if (!c || (c.low == null && c.high == null)) return null;
  return { low: c.low, high: c.high, printed: false, label: c.label, source: c.source };
}

function sideOf(
  row: unknown,
  f: FieldDef,
  gender: string | null | undefined,
): { status: "low" | "high"; value: number; r: NonNullable<ReturnType<typeof rangeOf>> } | null {
  const v = pick(row, f.path);
  if (v == null) return null;
  const r = rangeOf(row, f, gender);
  if (!r) return null;
  if (r.high != null && v > r.high) return { status: "high", value: v, r };
  if (r.low != null && v < r.low) return { status: "low", value: v, r };
  return null;
}

/**
 * 이번 기록에서 표준범위를 벗어난 항목.
 * 걱정되는 쪽(체지방률 높음 · 골격근량 낮음)을 먼저, 그다음 두 번 연속 벗어난 것을 먼저.
 */
export function flaggedFields(
  row: unknown | null,
  prev: unknown | null,
  profile: { gender?: string | null },
): InbodyFlag[] {
  if (!row) return [];
  const out: InbodyFlag[] = [];

  for (const f of FIELDS) {
    const hit = sideOf(row, f, profile.gender);
    if (!hit) continue;

    const before = prev ? sideOf(prev, f, profile.gender) : null;
    // 값이 낮을수록 좋은 항목은 높은 쪽이, 그 밖에는 낮은 쪽이 걱정되는 방향이다
    const concerning = f.lowerIsBetter ? hit.status === "high" : hit.status === "low";

    out.push({
      field: f,
      value: hit.value,
      status: hit.status,
      concerning,
      low: hit.r.low,
      high: hit.r.high,
      printed: hit.r.printed,
      rangeLabel: hit.r.label,
      rangeSource: hit.r.source,
      repeated: before?.status === hit.status,
      knowledge: BY_PATH.get(f.path),
    });
  }

  return out.sort((a, b) => {
    if (a.concerning !== b.concerning) return a.concerning ? -1 : 1;
    if (a.repeated !== b.repeated) return a.repeated ? -1 : 1;
    return 0;
  });
}

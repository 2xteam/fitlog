/**
 * 인바디 값이 벗어났을 때 무엇을 해볼 수 있는지 — **권고 데이터**.
 *
 * 피검사(`lib/bloodGuidance.ts`)와 **같은 규칙**을 따른다.
 * ⚠️ `evidence` 등급 없이는 항목을 추가하지 않는다. → `lib/evidence.ts`
 *
 * 이 파일이 생기기 전 인바디 조언은 채팅 RAG에만 있었고 출처가 없었다.
 * "체중 1kg당 단백질 1.2~1.6g", "주당 0.5~1% 감량", "활동량 1.2~1.7배" —
 * 숫자는 대체로 맞지만 어디서 온 말인지 알 방법이 없었다. 같은 앱에서 Blood 탭은
 * 근거를 펼쳐 보여주는데 Inbody 탭은 그러지 않으면, 사용자가 어느 쪽을 믿어야 할지
 * 알 수 없다. 그래서 근거를 찾아 붙이고, 못 찾은 것은 등급을 낮춰 정직하게 표시했다.
 *
 * `analyte`에는 피검사의 코드 대신 **필드 경로**를 쓴다 (`lib/inbody.ts`의 `FIELDS.path`).
 */

import { pickGuidance, type Guidance } from "@/lib/evidence";
import { INBODY_SOURCES } from "@/lib/inbodyKnowledge";

export const INBODY_GUIDANCE: Guidance[] = [
  /* ── 골격근량 · SMI ───────────────────────────────────── */
  {
    analyte: "derived.smi",
    direction: "low",
    kind: "exercise",
    headline: "근력 운동이 먼저예요. 유산소만으로는 잘 늘지 않아요",
    detail:
      "주 2~3회 이상, 큰 근육을 쓰는 운동(스쿼트·데드리프트·로우·프레스)을 점점 무겁게 해나가는 방식이 핵심이에요.",
    evidence: "A",
    source: INBODY_SOURCES.awgs2019,
    basis:
      "AWGS 2019 합의는 근감소증의 1차 대응으로 저항운동을 권고해요. 근육량과 근력을 함께 늘린 무작위배정 시험들이 근거예요.\n\n중요한 것 — 근육은 **점진적 과부하**에 반응해요. 같은 무게를 반복하는 것보다 조금씩 늘려가는 쪽이 효과가 큽니다.\n\n한계 — 이 앱은 근육량만 봐요. AWGS 기준으로 근감소증을 판단하려면 **악력이나 보행속도 같은 근력·기능 측정이 함께** 있어야 해요. 근육량이 적다는 것만으로 진단되지 않습니다.",
  },
  {
    analyte: "derived.smi",
    direction: "low",
    kind: "diet",
    headline: "단백질은 체중 1kg당 1.6g 근처에서 효과가 멈춰요",
    detail:
      "그보다 더 먹어도 근육이 더 늘지는 않았어요. 70kg이면 하루 110g 정도예요. 한 번에 몰아 먹기보다 끼니마다 나눠 드세요.",
    effect: "1.6 g/kg/일에서 정체 (95% 신뢰구간 상한 2.2)",
    evidence: "A",
    source: INBODY_SOURCES.morton2018,
    basis:
      "49개 연구, 1,863명을 모은 메타회귀분석이에요(British Journal of Sports Medicine, 2018). 저항운동을 하는 건강한 성인에서 단백질 섭취를 늘릴수록 제지방량이 늘었지만, **하루 약 1.62 g/kg를 넘으면 추가 이득이 없었어요.** 널리 쓰이는 \"1.6~2.2 g/kg\"라는 범위는 이 분석의 신뢰구간 상한(2.2)에서 나온 거예요.\n\n한계 — 대상이 저항운동을 하는 건강한 성인이에요. 운동을 하지 않으면 단백질만 늘려도 근육이 늘지 않아요. 신장 질환이 있으면 단백질 섭취를 따로 상의해야 해요.",
  },
  {
    analyte: "derived.smi",
    direction: "low",
    kind: "clinic",
    headline: "근육량만으로는 근감소증이 아니에요",
    detail:
      "AWGS 기준은 근육량과 함께 **악력이나 앉았다 일어서기 같은 기능 측정**을 봐요. 걷는 속도가 느려졌거나 물건 들기가 힘들어졌다면 진료에서 확인해 보세요.",
    evidence: "A",
    source: INBODY_SOURCES.awgs2019,
    basis:
      "AWGS 2019는 근감소증을 근육량 하나로 정의하지 않아요. 근육량 감소에 더해 근력 저하(악력) 또는 신체기능 저하(보행속도·5회 앉았다 일어서기)가 있어야 진단돼요. 근육량만 적고 근력이 정상이면 다른 상태로 봅니다.\n\n이 앱은 인바디에서 얻는 근육량만 알 수 있어요. 그래서 **진단하지 않고**, 기준선 아래라는 것과 함께 볼 것이 있다는 것까지만 알려드려요.",
  },

  /* ── 체지방률 ─────────────────────────────────────────── */
  {
    analyte: "obesity.percentBodyFat.value",
    direction: "high",
    kind: "exercise",
    headline: "유산소와 근력을 함께 하면 근육을 덜 잃어요",
    detail:
      "열량을 줄이기만 하면 지방과 함께 근육도 빠져요. 근력 운동을 같이 하면 줄어드는 몸무게에서 지방의 비중이 커져요.",
    evidence: "A",
    source: INBODY_SOURCES.morton2018,
    basis:
      "감량 중 저항운동과 충분한 단백질이 제지방량 손실을 줄인다는 것은 여러 무작위배정 시험에서 확인됐어요. 같은 체중 감소라도 몸의 구성이 달라집니다.\n\n인바디로 이걸 확인하는 방법 — 체중이 줄 때 **골격근량이 유지되는지** 함께 보세요. 체중만 보면 잘 되고 있는 것처럼 보이는데 근육이 함께 빠지는 경우가 흔해요.",
  },
  {
    analyte: "obesity.percentBodyFat.value",
    direction: "high",
    kind: "diet",
    headline: "주당 체중의 0.5~1% 속도가 무난해요",
    detail:
      "70kg이면 주 0.35~0.7kg 정도예요. 더 빠르게 빼면 근육이 함께 줄고, 되돌아오기도 쉬워요. 부위만 골라 빼는 감량은 없어요.",
    evidence: "B",
    source: INBODY_SOURCES.morton2018,
    basis:
      "체중 감량 속도가 빠를수록 제지방량 손실 비중이 커진다는 것은 여러 중재 연구에서 관찰됐어요. 주당 0.5~1%는 그 관찰에서 나온 실무 권장선이에요.\n\n한계 — 특정 숫자를 정한 무작위배정 시험이 있는 것은 아니에요. 그래서 A가 아니라 B로 뒀어요. 시작 체중이 많이 나갈수록 초반에는 더 빨리 빠지는 것이 자연스러워요.",
  },
  {
    analyte: "obesity.percentBodyFat.value",
    direction: "high",
    kind: "measure",
    headline: "인바디 체지방률은 DXA보다 낮게 나오는 경향이 있어요",
    detail:
      "다른 장비에서 잰 값과 직접 비교하지 마세요. 같은 기종, 같은 조건에서 잰 값끼리 견주는 것이 맞아요.",
    effect: "DXA 대비 남 −4.2%p · 여 −2.8%p",
    evidence: "B",
    source: INBODY_SOURCES.mfbiaReal,
    basis:
      "다주파수 BIA와 DXA를 비교한 연구에서 체지방률이 남성 −4.2±3.0%, 여성 −2.8±2.6% 차이가 났어요. 상관관계 자체는 높지만(r=0.89~0.96) 절대값에 계통적 차이가 있어요.\n\n또한 BIA는 식사·수분·운동 조건을 통제한 상태에서만 신뢰할 만한 추정치를 주고, 조건을 통제하지 않는 실제 환경에서는 정확도가 떨어져요.\n\n그래서 이 앱은 절대값보다 **같은 조건에서 잰 값들의 흐름**을 보도록 만들어져 있어요.",
  },

  /* ── 내장지방 ─────────────────────────────────────────── */
  {
    analyte: "research.visceralFatArea",
    direction: "high",
    kind: "exercise",
    headline: "내장지방은 피하지방보다 운동에 먼저 반응해요",
    detail: "유산소 운동을 주 150분 이상 이어가 보세요. 체중이 크게 줄기 전에도 먼저 움직이는 편이에요.",
    evidence: "B",
    source: INBODY_SOURCES.vfaJapan,
    basis:
      "내장지방은 대사적으로 활발해 에너지 수지 변화에 빠르게 반응해요. 운동 중재 연구에서 체중 감소가 크지 않아도 내장지방이 줄어든 결과들이 있어요.\n\n같이 볼 것 — 허리둘레는 집에서도 잴 수 있어서 회차 사이의 변화를 확인하기 좋아요.",
  },
  {
    analyte: "research.visceralFatArea",
    direction: "high",
    kind: "clinic",
    headline: "100cm² 기준은 일본 기준이고 국내 연구는 갈려요",
    detail:
      "한국인 대상 연구에서는 남 84~134cm², 여 58~91cm²로 폭이 컸어요. 절대값 하나로 판단하기보다 **내 값이 어느 쪽으로 가고 있는지**를 보세요.",
    evidence: "B",
    source: INBODY_SOURCES.vfaKorea,
    basis:
      "100cm²는 일본비만학회가 CT로 측정한 내장지방 단면적을 근거로 정한 기준이고, 국내 허리둘레 기준도 여기서 유래했어요.\n\n그런데 한국인을 대상으로 한 연구들은 다른 값을 내놨어요 — 대사증후군 위험을 가리는 최적 절단값이 남성 134.6cm², 여성 91.1cm²로 나온 연구가 있고, 남 84cm²·여 58cm²로 훨씬 낮게 본 종단 연구도 있어요. 최근에는 예방 관점에서 82.5cm²를 제안한 연구도 나왔어요.\n\n**기준이 아직 하나로 모이지 않았다는 뜻이에요.** 그래서 이 앱은 절대값보다 추이를 강조해요.",
  },

  {
    analyte: "research.visceralFatLevel",
    direction: "high",
    kind: "exercise",
    headline: "유산소 운동과 허리둘레를 함께 보세요",
    detail:
      "내장지방은 유산소 운동에 비교적 빨리 반응해요. 허리둘레는 집에서도 잴 수 있어서 회차 사이의 변화를 확인하기 좋아요.",
    evidence: "B",
    source: INBODY_SOURCES.vfaJapan,
    basis:
      "내장지방은 대사적으로 활발해 에너지 수지 변화에 빠르게 반응합니다. 운동 중재 연구에서 체중 감소가 크지 않아도 내장지방이 줄어든 결과들이 있어요.\n\n알아둘 점 — 인바디의 내장지방 '레벨'은 단면적(cm²)을 단계로 바꾼 자체 값이라 기종별 산식을 탑니다. 절대값보다 같은 기종에서 잰 값들의 변화를 보세요.",
  },

  /* ── BMI ──────────────────────────────────────────────── */
  {
    analyte: "obesity.bmi.value",
    direction: "high",
    kind: "measure",
    headline: "근육이 많으면 BMI만으로 과체중이 돼요",
    detail:
      "BMI는 근육과 지방을 구분하지 못해요. 같은 결과지의 체지방률과 골격근량을 함께 보고 판단하세요.",
    evidence: "A",
    source: INBODY_SOURCES.biaVsDxa,
    basis:
      "BMI는 체중을 키의 제곱으로 나눈 값이라 몸의 구성을 보지 않습니다. 근육량이 많은 사람은 체지방률이 낮아도 BMI가 과체중 구간에 들어갈 수 있어요.\n\n체성분 측정의 존재 이유가 이것입니다 — BMI가 놓치는 것을 보려고 재는 거예요. 그래서 이 앱은 BMI가 높다는 것만으로 감량을 권하지 않고, 체지방률·골격근량을 함께 보여드려요.\n\n반대 경우도 있어요. BMI는 정상인데 체지방률이 높은 상태(마른 비만)는 BMI만 봐서는 드러나지 않습니다.",
  },

  /* ── 체수분 · 세포외수분비 ────────────────────────────── */
  {
    analyte: "evaluation.ecwRatio",
    direction: "high",
    kind: "measure",
    headline: "먼저 측정 조건을 의심해 보세요",
    detail:
      "짠 음식, 수면 부족, 전날 과한 운동 뒤에 일시적으로 올라요. 조건을 맞춰 다시 재면 돌아오는 경우가 많아요.",
    evidence: "B",
    source: INBODY_SOURCES.ecwRatio,
    basis:
      "세포외수분비는 몸의 수분이 세포 안팎 어디에 있는지를 보는 값이라, 나트륨 섭취·수면·운동 같은 단기 요인에 흔들려요.\n\n한 번의 값보다 **여러 회차에 걸쳐 계속 높은지**가 중요해요.",
  },
  {
    analyte: "evaluation.ecwRatio",
    direction: "high",
    kind: "clinic",
    headline: "계속 높거나 0.400을 넘으면 진료에서 확인하세요",
    detail:
      "한쪽 팔이나 다리만 높은 경우도 마찬가지예요. 이 앱은 원인을 판단하지 않아요.",
    evidence: "B",
    source: INBODY_SOURCES.ecwRatio,
    basis:
      "건강한 상태에서 세포외수분비는 대략 0.360~0.390 사이예요. 0.400을 넘으면 수분 과잉으로 보고 확인을 권합니다.\n\n임상 연구에서는 이 비율이 높을수록 예후가 나쁜 것이 여러 환자군에서 관찰됐어요(혈액투석 환자의 사망률, 중환자의 수액 관리 등). 다만 이런 연구는 **질환이 있는 환자를 대상으로 한 것**이라, 건강한 사람의 한 번 높은 값을 같은 무게로 읽으면 안 돼요.\n\n그래서 이 앱은 겁주지 않고, 조건을 먼저 확인하고 계속될 때 진료를 권하는 순서로 안내해요.",
  },

  /* ── 위상각 ───────────────────────────────────────────── */
  {
    analyte: "evaluation.phaseAngle",
    direction: "low",
    kind: "exercise",
    headline: "근력 운동과 단백질이 함께 가야 올라가요",
    detail:
      "위상각은 근육의 '양'보다 '질'에 가까운 지표예요. 근육량이 늘 때 함께 올라가는 경우가 많아요.",
    evidence: "C",
    source: INBODY_SOURCES.phaseAngleDisability,
    basis:
      "위상각이 낮으면 노인에서 장애 발생 위험이 높다는 것이 전향 연구에서 확인됐고, 여러 질환에서 예후 지표로 쓰여요. 저항운동으로 위상각이 올라간 연구들도 있어요.\n\n한계가 큰 편이에요 — 개입으로 위상각을 올렸을 때 **결과가 좋아진다**는 것까지 보여준 시험은 아직 부족해요. 그래서 등급을 C로 뒀어요. 위상각을 목표로 삼기보다 근육량·근력을 목표로 삼고 위상각은 따라오는 지표로 보는 편이 맞아요.",
  },
  {
    analyte: "evaluation.phaseAngle",
    direction: "low",
    kind: "measure",
    headline: "나이와 성별에 따라 정상 범위가 달라요",
    detail:
      "건강한 성인에서 대략 5~7°이고, 성인기 평균이 남 7.3° 여 6.4°예요. 나이가 들며 낮아지는 것이 자연스러워요.",
    evidence: "B",
    source: INBODY_SOURCES.phaseAngle,
    basis:
      "대규모 인구 자료로 연령·성별·BMI별 위상각 참고값을 만든 연구가 있어요. 25만 명 이상을 모은 체계적 문헌고찰·메타분석도 나와 있고요.\n\n**고정된 하나의 기준선은 없어요.** 같은 6.0°라도 30대 남성과 70대 여성에게 뜻이 다릅니다. 그래서 이 앱은 절대값 판정보다 참고 범위와 추이를 함께 보여줘요.",
  },

  /* ── 기초대사량 ───────────────────────────────────────── */
  {
    analyte: "research.bmr",
    direction: "low",
    kind: "diet",
    headline: "기초대사량 아래로 먹는 식단은 권하지 않아요",
    detail:
      "근육이 줄면 기초대사량도 함께 줄어서, 같은 양을 먹어도 살이 찌기 쉬운 몸이 돼요. 근육을 지키는 쪽이 결국 유리해요.",
    evidence: "B",
    source: INBODY_SOURCES.morton2018,
    basis:
      "기초대사량은 제지방량과 강하게 이어져 있어요. 급격한 열량 제한으로 근육이 줄면 기초대사량도 따라 줄어드는 것이 여러 연구에서 관찰됐어요.\n\n알아둘 점 — 인바디의 기초대사량은 직접 잰 값이 아니라 **제지방량으로 계산한 추정치**예요. 사람마다 실제와 차이가 있어서, 이 숫자를 하루 섭취 목표로 그대로 쓰기보다 변화 방향을 보는 데 쓰세요.",
  },

  /* ── 체중 ─────────────────────────────────────────────── */
  {
    analyte: "composition.weight.value",
    direction: "high",
    kind: "measure",
    headline: "체중만 보면 무엇이 늘었는지 알 수 없어요",
    detail:
      "같은 1kg이라도 근육인지 지방인지 물인지에 따라 뜻이 완전히 달라요. 골격근량과 체지방량을 함께 보세요.",
    evidence: "A",
    source: INBODY_SOURCES.biaVsDxa,
    basis:
      "체성분 측정의 존재 이유가 이것이에요. 체중은 근육·지방·물·뼈의 합이라 단독으로는 몸의 변화를 설명하지 못해요.\n\n이 앱이 체중만 기록한 회차도 인바디 기록으로 저장하는 이유이기도 해요 — 나중에 체성분 기록과 같은 그래프에서 이어 볼 수 있게요.",
  },

  /* ── 모든 항목 공통 ───────────────────────────────────── */
  {
    analyte: "*",
    direction: "high",
    kind: "measure",
    headline: "같은 조건에서 재야 비교가 돼요",
    detail:
      "아침 공복, 화장실 다녀온 뒤, 운동 전이 가장 안정적이에요. 식사·수분·운동 직후에는 체지방률이 1~2%p까지 달라 보여요.",
    evidence: "B",
    source: INBODY_SOURCES.mfbiaReal,
    basis:
      "다주파수 BIA는 식사·수분 상태·최근 운동·시간대를 통제한 조건에서 신뢰할 만한 추정치를 주지만, **조건을 통제하지 않는 실제 환경에서는 정확도가 떨어진다**는 것이 확인됐어요.\n\n인바디는 몸의 전기저항으로 수분을 재고 나머지를 추정하기 때문에, 수분이 흔들리면 체지방률·근육량이 함께 흔들려요.\n\n이 앱이 날짜당 1건만 두는 이유예요 — 하루에 여러 번 잰 값의 차이는 몸이 변한 게 아니라 조건 차이입니다.",
  },
  {
    analyte: "*",
    direction: "high",
    kind: "measure",
    headline: "다른 장비 값과 직접 비교하지 마세요",
    detail:
      "BIA와 DXA는 값이 다르고, 같은 BIA라도 기종에 따라 달라요. 헬스장을 옮겨 기종이 바뀌면 그 지점에서 값이 튈 수 있어요.",
    effect: "InBody 770이 DXA보다 전신 근육량 +2.28kg",
    evidence: "B",
    source: INBODY_SOURCES.biaVsDxa,
    basis:
      "BIA와 DXA로 같은 사람의 근육량을 잰 연구에서, InBody 770이 전신 근육량을 2.28kg, 사지근육량을 1.97kg 높게 쟀어요.\n\n이 차이가 실제로 중요한 이유 — AWGS 2019의 근감소증 기준이 **측정 방법마다 다릅니다.** 여성 기준이 DXA는 5.4, BIA는 5.7 kg/m²예요. BIA가 근육을 더 높게 재니 판정선도 올려 잡은 거죠. 인바디 값에 DXA 기준을 갖다 대면 근감소를 놓칩니다.\n\n그래서 이 앱은 인바디 값에 BIA 기준을 씁니다.",
  },
];

export function inbodyGuidanceFor(path: string, direction: "high" | "low"): Guidance[] {
  return pickGuidance(INBODY_GUIDANCE, path, direction);
}

export function inbodyCommonGuidance(): Guidance[] {
  return INBODY_GUIDANCE.filter((g) => g.analyte === "*");
}

/**
 * 피검사 기록을 읽고 판단하는 로직.
 *
 * 카탈로그(`lib/bloodCatalog.ts`)는 지식, 이 파일은 **기록에 지식을 적용하는 쪽**이다.
 * 판정은 언제나 기록에 저장된 인쇄 참고치를 먼저 쓰고, 없을 때만 카탈로그의
 * `typicalRef`로 물러선다 — 그때 결과지가 무엇을 기준으로 삼았는지가 진실이다.
 */

import {
  ANALYTES,
  findAnalyte,
  matchAnalyte,
  type Analyte,
} from "@/lib/bloodCatalog";
import { pick } from "@/lib/inbody";

export type ResultLike = {
  code?: string | null;
  name: string;
  value?: number | null;
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
  refText?: string | null;
  flag?: string | null;
  specimen?: string | null;
};

export type BloodRow = {
  _id: string;
  testedAt: string;
  testedDate?: string;
  imageUrl?: string | null;
  lab?: { name?: string | null; clinic?: string | null } | null;
  note?: string | null;
  results: ResultLike[];
  etc?: Array<{ label: string; value?: string | null; unit?: string | null }>;
};

export type Status = "low" | "normal" | "high" | "unknown";

/** 판정에 실제로 쓰인 참고치가 어디서 왔는지 — 화면에 밝힌다 */
export type RefUsed = {
  low: number | null;
  high: number | null;
  text: string | null;
  /** true면 결과지에 인쇄된 값, false면 카탈로그의 일반값 */
  printed: boolean;
};

/**
 * 판정에 쓸 참고치를 고른다.
 *
 * 결과지에 인쇄된 값이 **언제나 우선**이다. 검사실·장비·나이·성별에 따라 다르고,
 * 검사실이 기준을 바꾸기도 하기 때문에 그때 인쇄된 값이 그때의 진실이다.
 */
export function refFor(r: ResultLike, a?: Analyte): RefUsed {
  const hasPrinted = r.refLow != null || r.refHigh != null;
  if (hasPrinted) {
    return {
      low: r.refLow ?? null,
      high: r.refHigh ?? null,
      text: r.refText ?? null,
      printed: true,
    };
  }
  const t = a?.typicalRef;
  return {
    low: t?.low ?? null,
    high: t?.high ?? null,
    text: t?.text ?? r.refText ?? null,
    printed: false,
  };
}

/**
 * 정상/벗어남 판정.
 *
 * 결과지의 판정 표시(H/L)가 있으면 **그것을 그대로 따른다.** 검사실이 우리보다
 * 자기 기준을 잘 안다. 표시가 없을 때만 참고치와 비교한다.
 */
export function statusOf(r: ResultLike, a?: Analyte): Status {
  if (r.flag === "H") return "high";
  if (r.flag === "L") return "low";
  if (r.value == null) return "unknown";

  const ref = refFor(r, a);
  if (ref.high != null && r.value > ref.high) return "high";
  if (ref.low != null && r.value < ref.low) return "low";
  if (ref.low == null && ref.high == null) return "unknown";
  return "normal";
}

export const STATUS_LABELS: Record<Status, string> = {
  low: "낮음",
  normal: "정상",
  high: "높음",
  unknown: "판정 없음",
};

/** 벗어난 값이 좋은 쪽인지 나쁜 쪽인지 — HDL·eGFR은 높은 쪽이 좋다 */
export function isConcerning(status: Status, a?: Analyte): boolean {
  if (status === "normal" || status === "unknown") return false;
  if (a?.higherIsBetter) return status === "low";
  if (a?.lowerIsBetter) return status === "high";
  return true;
}

/* ────────────────────────────────────────────────────────────
 * 막대 그래프용 위치 계산
 *
 * 참고치가 한쪽만 있는 항목이 많아서, 인바디처럼 min~max 사이 비율로
 * 그릴 수 없다. 모양별로 눈금의 시작과 끝을 따로 정한다.
 * ──────────────────────────────────────────────────────────── */

export type Gauge = {
  /** 눈금 전체 */
  scaleMin: number;
  scaleMax: number;
  /** 정상 구간 (눈금 안에서의 위치, 0~1) */
  bandStart: number;
  bandEnd: number;
  /** 값의 위치 (0~1, 눈금을 벗어나면 잘라 붙인다) */
  pos: number;
  /** 값이 눈금 밖으로 나갔는가 — 화살표로 표시한다 */
  clamped: boolean;
  ref: RefUsed;
};

export function gaugeFor(r: ResultLike, a?: Analyte): Gauge | null {
  if (r.value == null) return null;
  const ref = refFor(r, a);
  const { low, high } = ref;
  if (low == null && high == null) return null;

  let scaleMin: number;
  let scaleMax: number;

  if (low != null && high != null) {
    // 양쪽이 있으면 폭의 60%씩 여유를 둔다
    const span = high - low;
    scaleMin = low - span * 0.6;
    scaleMax = high + span * 0.6;
  } else if (high != null) {
    // 상한만 — 0에서 시작해 상한의 1.8배까지
    scaleMin = 0;
    scaleMax = high * 1.8;
  } else {
    // 하한만 — 하한의 1.6배까지, 0에서 시작
    scaleMin = 0;
    scaleMax = (low as number) * 1.6;
  }

  // 값이 눈금을 크게 벗어나면 눈금을 늘려 값이 보이게 한다
  if (r.value > scaleMax) scaleMax = r.value * 1.05;
  if (r.value < scaleMin) scaleMin = r.value * 0.95;

  const range = scaleMax - scaleMin || 1;
  const at = (v: number) => Math.min(1, Math.max(0, (v - scaleMin) / range));

  return {
    scaleMin,
    scaleMax,
    bandStart: at(low ?? scaleMin),
    bandEnd: at(high ?? scaleMax),
    pos: at(r.value),
    clamped: r.value > scaleMax || r.value < scaleMin,
    ref,
  };
}

/* ────────────────────────────────────────────────────────────
 * 기록 읽기
 * ──────────────────────────────────────────────────────────── */

export function resultOf(row: BloodRow | null | undefined, code: string): ResultLike | null {
  if (!row) return null;
  return row.results.find((r) => r.code === code) ?? null;
}

/** 여러 기록에서 한 항목의 추이를 뽑는다 (오래된 것부터) */
export function pointsOf(
  rows: BloodRow[] | null,
  code: string,
): Array<{ t: number; v: number }> {
  if (!rows) return [];
  return rows
    .map((row) => {
      const r = resultOf(row, code);
      if (!r || r.value == null) return null;
      return { t: new Date(row.testedAt).getTime(), v: r.value };
    })
    .filter((p): p is { t: number; v: number } => p !== null)
    .sort((a, b) => a.t - b.t);
}

/** 기록들에 한 번이라도 값이 있었던 항목 코드 */
export function availableCodes(rows: BloodRow[] | null): string[] {
  if (!rows) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const r of row.results) {
      if (r.code && r.value != null) seen.add(r.code);
    }
  }
  return ANALYTES.filter((a) => seen.has(a.code)).map((a) => a.code);
}

export type Flagged = {
  analyte: Analyte;
  result: ResultLike;
  status: Status;
  concerning: boolean;
  /** 직전 기록에서도 같은 방향으로 벗어났는가 — 두 번 연속이면 진료 권유 */
  repeated: boolean;
};

/**
 * 이번 기록에서 벗어난 항목.
 *
 * 4축 아래에 붙는 목록이다. 매번 구성이 바뀌지만 **볼 것이 분명해진다** —
 * 36개를 다 훑는 대신 이번에 달라진 것부터 본다.
 */
export function flaggedIn(row: BloodRow | null, prev?: BloodRow | null): Flagged[] {
  if (!row) return [];
  const out: Flagged[] = [];

  for (const r of row.results) {
    if (!r.code) continue;
    const a = findAnalyte(r.code);
    const status = statusOf(r, a);
    if (status === "normal" || status === "unknown") continue;
    if (!a) continue;

    const before = prev ? resultOf(prev, r.code) : null;
    const repeated = before ? statusOf(before, a) === status : false;

    out.push({ analyte: a, result: r, status, concerning: isConcerning(status, a), repeated });
  }

  // 걱정되는 쪽 먼저, 그다음 두 번 연속 벗어난 것 먼저
  return out.sort((x, y) => {
    if (x.concerning !== y.concerning) return x.concerning ? -1 : 1;
    if (x.repeated !== y.repeated) return x.repeated ? -1 : 1;
    return 0;
  });
}

/* ────────────────────────────────────────────────────────────
 * 추출값 검증
 *
 * 인바디 결과지는 합계가 맞아떨어져서 Vision의 숫자 오인식을 잡을 수 있었다
 * (`lib/inbody.ts` → validateMeasurement). 피검사에도 계산으로 확인되는
 * 관계가 몇 개 있다. 같은 방식으로 검토 화면에 경고를 띄운다.
 * ──────────────────────────────────────────────────────────── */

export type BloodWarning = { code: string; message: string };

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

export function validateBloodTest(results: ResultLike[]): BloodWarning[] {
  const w: BloodWarning[] = [];
  const v = (code: string): number | null => {
    const r = results.find((x) => x.code === code);
    return r?.value ?? null;
  };

  // 총콜레스테롤 ≈ HDL + LDL + 중성지방/5  (Friedewald, 중성지방 400 미만에서)
  const tc = v("TC");
  const hdl = v("HDL");
  const ldl = v("LDL");
  const tg = v("TG");
  if (tc != null && hdl != null && ldl != null && tg != null && tg < 400) {
    const calc = hdl + ldl + tg / 5;
    if (!near(calc, tc, 12)) {
      w.push({
        code: "TC",
        message: `HDL+LDL+중성지방/5 = ${calc.toFixed(0)} 인데 총콜레스테롤은 ${tc} 로 읽혔어요. 네 값을 다시 확인해 주세요.`,
      });
    }
  }

  // MCHC = Hb / Hct × 100
  const hb = v("HB");
  const hct = v("HCT");
  const mchc = v("MCHC");
  if (hb != null && hct != null && hct > 0 && mchc != null) {
    const calc = (hb / hct) * 100;
    if (!near(calc, mchc, 1.5)) {
      w.push({
        code: "MCHC",
        message: `혈색소÷적혈구용적률로 계산한 MCHC는 ${calc.toFixed(1)} 인데 ${mchc} 로 읽혔어요.`,
      });
    }
  }

  // MCH = Hb / RBC × 10
  const rbc = v("RBC");
  const mch = v("MCH");
  if (hb != null && rbc != null && rbc > 0 && mch != null) {
    const calc = (hb / rbc) * 10;
    if (!near(calc, mch, 2)) {
      w.push({
        code: "MCH",
        message: `혈색소÷적혈구수로 계산한 MCH는 ${calc.toFixed(1)} 인데 ${mch} 로 읽혔어요.`,
      });
    }
  }

  // MCV = Hct / RBC × 10
  const mcv = v("MCV");
  if (hct != null && rbc != null && rbc > 0 && mcv != null) {
    const calc = (hct / rbc) * 10;
    if (!near(calc, mcv, 4)) {
      w.push({
        code: "MCV",
        message: `적혈구용적률÷적혈구수로 계산한 MCV는 ${calc.toFixed(1)} 인데 ${mcv} 로 읽혔어요.`,
      });
    }
  }

  // 알부민은 총단백을 넘을 수 없다
  const tp = v("TP");
  const alb = v("ALB");
  if (tp != null && alb != null && alb > tp) {
    w.push({ code: "ALB", message: "알부민이 총단백보다 큽니다. 두 값을 확인해 주세요." });
  }

  // 당화혈색소와 평균혈당(eAG)의 관계 — eAG = 28.7 × A1c − 46.7
  const a1c = v("HBA1C");
  const eag = v("HBA1C_EAG");
  if (a1c != null && eag != null) {
    const calc = 28.7 * a1c - 46.7;
    if (!near(calc, eag, 12)) {
      w.push({
        code: "HBA1C_EAG",
        message: `당화혈색소 ${a1c}% 의 평균혈당 환산값은 ${calc.toFixed(0)} 인데 ${eag} 로 읽혔어요.`,
      });
    }
  }

  return w;
}

/* ────────────────────────────────────────────────────────────
 * 인바디 교차 해석
 *
 * 피검사만 보는 앱은 많다. 이 앱에는 **같은 사람의 체성분이 이미 있다.**
 * 두 기록을 겹치면 검사실이 인쇄할 수 없는 맥락이 나온다.
 *
 * ⚠️ 맥락 제시까지만 한다. 원인을 단정하지 않는다.
 * ──────────────────────────────────────────────────────────── */

export type CrossNote = {
  analyte: Analyte;
  inbodyLabel: string;
  inbodyValue: number;
  note: string;
  sourceName?: string;
  sourceUrl?: string;
};

/**
 * 인바디 값이 인쇄된 표준범위를 벗어났는지.
 *
 * 표준범위가 인쇄되지 않는 항목(내장지방레벨 등)은 규칙이 준 기준값으로 판단한다.
 * 없으면 판단하지 않는다 — 없는 기준을 지어내는 대신 규칙을 건너뛴다.
 */
function inbodySide(
  row: unknown,
  path: string,
  threshold?: number,
): "high" | "low" | "normal" | null {
  const v = pick(row, path);
  if (v == null) return null;
  const base = path.replace(/\.value$/, "");
  const min = pick(row, `${base}.min`);
  const max = pick(row, `${base}.max`);

  if (min == null && max == null) {
    if (threshold == null) return null;
    return v > threshold ? "high" : v < threshold ? "low" : "normal";
  }
  if (max != null && v > max) return "high";
  if (min != null && v < min) return "low";
  return "normal";
}

/**
 * 벗어난 피검사 항목에 대해, 인바디 기록과 겹쳐야 보이는 맥락을 모은다.
 * 최근 인바디 기록 1건만 쓴다 — 검사 시점과 가까운 기록이 없으면 의미가 흐려진다.
 */
export function crossNotesFor(flagged: Flagged[], measurement: unknown | null): CrossNote[] {
  if (!measurement) return [];
  const out: CrossNote[] = [];

  for (const f of flagged) {
    for (const rule of f.analyte.crossInbody ?? []) {
      if (rule.when !== f.status) continue;
      const side = inbodySide(measurement, rule.inbodyPath, rule.inbodyThreshold);
      if (side !== rule.inbodyWhen) continue;
      const value = pick(measurement, rule.inbodyPath);
      if (value == null) continue;

      out.push({
        analyte: f.analyte,
        inbodyLabel: rule.inbodyLabel,
        inbodyValue: value,
        note: rule.note,
        sourceName: rule.source?.name,
        sourceUrl: rule.source?.url,
      });
    }
  }

  return out;
}

/**
 * 추출된 결과 줄을 카탈로그에 붙인다.
 * 못 붙인 줄은 `etc`로 넘겨 보관한다 — 버리면 다시 못 살린다.
 */
export function attachCodes(rows: Array<ResultLike & { name: string }>): {
  results: ResultLike[];
  unmatched: ResultLike[];
} {
  const results: ResultLike[] = [];
  const unmatched: ResultLike[] = [];
  for (const r of rows) {
    const a = matchAnalyte(r.name);
    if (a) results.push({ ...r, code: a.code, unit: r.unit ?? a.unit });
    else unmatched.push({ ...r, code: null });
  }
  return { results, unmatched };
}

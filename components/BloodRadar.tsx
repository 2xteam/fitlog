"use client";

import { gaugeFor, isConcerning, resultOf, statusOf, STATUS_LABELS, type BloodRow } from "@/lib/blood";
import type { Analyte } from "@/lib/bloodCatalog";

/**
 * 피검사 항목 레이더 — **항목 수만큼 축을 가진 다각형** (2026-09-09 사용자 요청).
 *
 * 참고구간은 **항목마다 부채꼴(섹터) 안의 연두색 면**으로 그린다 (2026-09-09, 같은 날 네 번째 —
 * 사용자와 함께 정한 최종 모양). 원을 항목 수만큼 부채꼴로 나누고, 각 부채꼴에 그 항목의 정상
 * 구간을 칠한다. 꼭짓점을 이은 고리(띠)로는 "X 이상/이하가 정상"인 한쪽 참고치를 그릴 수 없고,
 * 축 위의 얇은 막대는 선 위에 선이라 어수선했다. 면은 둘 다 해결한다:
 *
 *   양쪽 참고치 (a~b)   고리 조각 R_IN ~ R_OUT        값: 하한→R_IN, 상한→R_OUT 비율
 *   상한만 (<= X)       중심부터 채운 조각 0 ~ R_OUT   값: 0→중심, X→R_OUT
 *   하한만 (>= X)       바깥까지 채운 조각 R_IN ~ R    값: X→R_IN, 1.6X→R_OUT (그 위는 끝까지)
 *
 * 점은 부채꼴 중심선 위에 찍는다. 점이 초록 면 안이면 정상, 면에서 멀수록 많이 벗어난 것이다.
 * 점을 잇는 선은 그리지 않는다 — 정보가 없고 모양만 만든다.
 * 이번 검사에 없는 항목은 축선을 점선으로, 값을 `—` 로 비워 두고 도형은 유지한다.
 * eGFR·HDL 처럼 높을수록 좋은 항목은 바깥으로 나가도 위험색이 아니다.
 *
 * 막대(`BloodGauge`)는 상세 화면과 "벗어난 항목" 카드에 그대로 남는다.
 */

const R = 84; // 원의 반지름 — 하한만 있는 항목의 면은 여기까지 찬다
const R_0 = 0; // 상한만 있는 항목의 면은 중심부터
const R_MIN = 0.1 * R; // 점이 들어갈 수 있는 가장 안쪽
const R_MAX = 0.95 * R; // 점이 나갈 수 있는 가장 바깥
const R_IN = 0.46 * R; // 참고구간 하한이 놓이는 반지름
const R_OUT = 0.78 * R; // 참고구간 상한이 놓이는 반지름
const GAP_DEG = 4; // 부채꼴 사이 틈
const CX = 160;
const CY = 124;

/** 화면에 쓰는 짧은 이름 — 카탈로그 라벨은 길다 ("Calculated LDL-C") */
const SHORT: Record<string, string> = { ALT: "ALT", LDL: "LDL", TG: "중성지방", HBA1C: "HbA1c", EGFR: "eGFR" };

function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

const clamp = (r: number) => Math.max(R_MIN, Math.min(R_MAX, r));

/** 참고구간 모양별 막대 구간과 값의 반지름 */
function place(value: number, low: number | null, high: number | null): { barStart: number; barEnd: number; r: number } | null {
  if (low != null && high != null) {
    const t = (value - low) / (high - low || 1);
    return { barStart: R_IN, barEnd: R_OUT, r: clamp(R_IN + t * (R_OUT - R_IN)) };
  }
  if (high != null) {
    const t = value / (high || 1);
    return { barStart: R_0, barEnd: R_OUT, r: clamp(R_0 + t * (R_OUT - R_0)) };
  }
  if (low != null) {
    const t = (value - low) / (low * 0.6 || 1);
    return { barStart: R_IN, barEnd: R, r: clamp(R_IN + t * (R_OUT - R_IN)) };
  }
  return null;
}

/** 라벨 옆 단위 — 길면 그림을 뚫고 나가므로 카드에만 적는다 */
const unitFor = (u: string) => (u.length > 7 ? "" : u);

/** 부채꼴 조각 — 중심 각도 ±half, 반지름 r1~r2. r1 이 0 이면 중심에서 시작하는 쐐기 */
function sectorPath(angleDeg: number, halfDeg: number, r1: number, r2: number): string {
  const a1 = angleDeg - halfDeg;
  const a2 = angleDeg + halfDeg;
  const [ox1, oy1] = polar(a1, r2);
  const [ox2, oy2] = polar(a2, r2);
  const f = (v: number) => v.toFixed(1);
  if (r1 <= 0.5) {
    return `M ${CX} ${CY} L ${f(ox1)} ${f(oy1)} A ${f(r2)} ${f(r2)} 0 0 1 ${f(ox2)} ${f(oy2)} Z`;
  }
  const [ix1, iy1] = polar(a1, r1);
  const [ix2, iy2] = polar(a2, r1);
  return `M ${f(ix1)} ${f(iy1)} L ${f(ox1)} ${f(oy1)} A ${f(r2)} ${f(r2)} 0 0 1 ${f(ox2)} ${f(oy2)} L ${f(ix2)} ${f(iy2)} A ${f(r1)} ${f(r1)} 0 0 0 ${f(ix1)} ${f(iy1)} Z`;
}


/** 라벨 정렬 — 위·아래는 가운데, 오른쪽은 시작, 왼쪽은 끝 */
function anchorFor(angleDeg: number): "start" | "middle" | "end" {
  const c = Math.cos((angleDeg * Math.PI) / 180);
  if (c > 0.35) return "start";
  if (c < -0.35) return "end";
  return "middle";
}

export function BloodRadar({
  analytes,
  row,
  testedAt,
  compact = false,
}: {
  analytes: Analyte[];
  row: BloodRow | null;
  testedAt?: string;
  /** 그림만 — 판정 카드·NOTE 는 생략 (벗어난 항목 레이더처럼 아래에 카드가 따로 있는 자리) */
  compact?: boolean;
}) {
  const n = analytes.length;
  if (n < 3) return null;
  const angles = analytes.map((_, i) => -90 + (360 / n) * i);

  const slots = analytes.map((a, i) => {
    const result = resultOf(row, a.code);
    const gauge = result ? gaugeFor(result, a) : null;
    const pos = result?.value != null && gauge ? place(result.value, gauge.ref.low, gauge.ref.high) : null;
    const status = result ? statusOf(result, a) : "unknown";
    const bad = isConcerning(status, a);
    const tone =
      status === "normal" ? "var(--success)" : status === "unknown" ? "var(--text-muted)" : bad ? "var(--danger)" : "var(--warning)";
    return { a, angle: angles[i], result, gauge, pos, status, bad, tone, short: SHORT[a.code] ?? a.code };
  });

  const half = 180 / n - GAP_DEG / 2;
  const missing = slots.filter((s) => !s.result);
  const noRef = slots.filter((s) => s.result && !s.gauge);
  const unprinted = slots.filter((s) => s.gauge && !s.gauge.ref.printed);
  const oneSided = slots.filter((s) => s.gauge && (s.gauge.ref.low == null || s.gauge.ref.high == null));

  return (
    <div>
      <svg
        viewBox="0 0 320 240"
        style={{ width: "100%", maxWidth: 400, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="피검사 항목별 참고구간과 내 수치"
      >
        {/* 바탕 원 — 부채꼴이 놓이는 접시. 값이 없는 항목의 조각은 이 회색만 보인다 */}
        {slots.map((s) => (
          <path key={`bg-${s.a.code}`} d={sectorPath(s.angle, half, 0, R)} fill="var(--bg-secondary)" stroke="none" />
        ))}

        {/* 참고구간 — 부채꼴 안의 연두색 면. 양쪽이면 고리 조각, 상한만이면 중심부터, 하한만이면 바깥까지 */}
        {slots.map((s) => {
          if (!s.pos) return null;
          return (
            <path
              key={`ref-${s.a.code}`}
              d={sectorPath(s.angle, half, s.pos.barStart, s.pos.barEnd)}
              fill="var(--success-subtle)"
              stroke="var(--success)"
              strokeWidth="1"
              strokeOpacity=".5"
            />
          );
        })}

        {/* 부채꼴 중심선 — 점이 놓이는 자리. 옅게 */}
        {slots.map((s) => {
          const [x, y] = polar(s.angle, R);
          return <line key={`ax-${s.a.code}`} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" opacity=".8" />;
        })}

        {/* 내 수치 — 점 하나씩. 잇는 선은 그리지 않는다 */}
        {slots.map((s) => {
          if (!s.pos) return null;
          const [x, y] = polar(s.angle, s.pos.r);
          return (
            <g key={`pt-${s.a.code}`}>
              <circle cx={x} cy={y} r="8" fill={s.tone} opacity=".18" />
              <circle cx={x} cy={y} r="4.5" fill={s.tone} stroke="var(--bg-card)" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* 라벨 + 값 */}
        {slots.map((s) => {
          const [lx, ly] = polar(s.angle, R + 20);
          const anchor = anchorFor(s.angle);
          const value = s.result?.value;
          const unit = unitFor(s.result?.unit ?? s.a.unit);
          return (
            <g key={`lb-${s.a.code}`}>
              <text x={lx} y={ly - 3} fontSize="10.5" fontWeight="700" textAnchor={anchor} fill="var(--text-secondary)">
                {s.short}
              </text>
              <text
                x={lx}
                y={ly + 11}
                fontSize="12"
                fontWeight="800"
                textAnchor={anchor}
                fill={value == null ? "var(--text-muted)" : s.status === "normal" ? "var(--text-primary)" : s.tone}
              >
                {value == null ? "—" : value}
                {value == null || !unit ? null : (
                  <tspan fontSize="8" fontWeight="500" fill="var(--text-muted)">
                    {" "}
                    {unit}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>

      {compact ? null : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(n, 5)}, 1fr)`, gap: 8, marginTop: 14 }}>
          {slots.map((s) => (
            <div key={`c-${s.a.code}`} style={{ padding: "10px 6px", borderRadius: 12, background: "var(--bg-secondary)", textAlign: "center" }}>
              <p className="field-hint" style={{ margin: 0 }}>
                {s.short}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: "0.82rem", fontWeight: 800, color: s.result ? s.tone : "var(--text-muted)" }}>
                {s.result ? STATUS_LABELS[s.status] : "기록 없음"}
              </p>
              <p className="field-hint" style={{ margin: "2px 0 0", fontSize: 10.5 }}>
                {s.gauge ? (s.gauge.ref.text ?? refLabel(s.gauge.ref.low, s.gauge.ref.high)) : s.result ? "참고치 없음" : "이번 검사에 없어요"}
                {s.result && unitFor(s.result.unit ?? s.a.unit) === "" ? ` ${s.result.unit ?? s.a.unit}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {compact ? null : (
        <div className="note-block" style={{ marginTop: 14 }}>
          <strong>NOTE</strong>
          부채꼴의 연두색 면이 그 항목의 참고구간이에요. 점이 면 안이면 정상, 면에서 멀수록 많이 벗어난 거예요.
          {oneSided.length
            ? " 상한만 있는 항목은 면이 가운데부터 차 있고, 하한만 있는 항목은 바깥까지 차 있어요."
            : ""}
          {" "}축마다 단위가 달라 축 사이의 크기 비교는 의미가 없어요.
          {slots.some((s) => s.a.higherIsBetter) ? " eGFR 처럼 높을수록 좋은 항목은 바깥으로 나가도 걱정할 일이 아니에요." : ""}
          {testedAt ? ` 기준 검사: ${testedAt}.` : ""}
          {missing.length ? ` 이번 검사에는 ${missing.map((s) => s.short).join("·")}이 없어 그 축은 비워 두었어요.` : ""}
          {noRef.length ? ` ${noRef.map((s) => s.short).join("·")}은 참고치가 없어 값만 적었어요.` : ""}
          {unprinted.length ? " 결과지에 참고치가 없는 항목은 일반적인 기준으로 표시했어요." : ""}
        </div>
      )}
    </div>
  );
}

function refLabel(low: number | null, high: number | null): string {
  if (low != null && high != null) return `${low} ~ ${high}`;
  if (high != null) return `≤ ${high}`;
  if (low != null) return `≥ ${low}`;
  return "";
}

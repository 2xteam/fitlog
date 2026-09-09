"use client";

import { gaugeFor, isConcerning, resultOf, statusOf, STATUS_LABELS, type BloodRow } from "@/lib/blood";
import type { Analyte } from "@/lib/bloodCatalog";

/**
 * 피검사 항목 레이더 — **항목 수만큼 축을 가진 다각형** (2026-09-09 사용자 요청).
 *
 * 참고구간은 **축마다 그 축 위에 놓인 라운드 막대**로 그린다 (2026-09-09 사용자 결정).
 * 인바디처럼 꼭짓점을 이은 고리(띠)로 그리면 "특정 값 이상/이하가 정상"인 한쪽 참고치를
 * 표현할 수 없다 — 띠는 늘 안쪽·바깥쪽 경계가 둘 다 있어야 하기 때문이다. 막대는 다르다:
 *
 *   양쪽 참고치 (a~b)   막대 R_IN ~ R_OUT            값: 하한→R_IN, 상한→R_OUT 비율
 *   상한만 (<= X)       막대 중심(R_0) ~ R_OUT       값: 0→R_0, X→R_OUT
 *   하한만 (>= X)       막대 R_IN ~ 축 끝(R_MAX)     값: X→R_IN, 1.6X→R_OUT (그 위는 끝까지)
 *
 * 점이 막대 안이면 정상, 막대 밖이면 벗어난 것이고 막대에서 멀수록 많이 벗어난 것이다.
 * 내 값들은 선으로 잇는다(전부 있으면 닫힌 다각형, 일부면 열린 선, 하나면 점만).
 * 이번 검사에 없는 항목은 축선을 점선으로, 값을 `—` 로 비워 두고 도형은 유지한다.
 * eGFR·HDL 처럼 높을수록 좋은 항목은 바깥으로 나가도 위험색이 아니다.
 *
 * 막대(`BloodGauge`)는 상세 화면과 "벗어난 항목" 카드에 그대로 남는다.
 */

const R = 80;
const R_0 = 0.08 * R; // 상한만 있는 축의 막대 시작 (중심 근처)
const R_MIN = 0.16 * R; // 점이 들어갈 수 있는 가장 안쪽
const R_MAX = 0.93 * R; // 점이 나갈 수 있는 가장 바깥 · 하한만 있는 축의 막대 끝
const R_IN = 0.46 * R; // 참고구간 하한이 놓이는 반지름
const R_OUT = 0.78 * R; // 참고구간 상한이 놓이는 반지름
const BAR_W = 11; // 참고구간 막대 두께
const CX = 150;
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
    return { barStart: R_IN, barEnd: R_MAX, r: clamp(R_IN + t * (R_OUT - R_IN)) };
  }
  return null;
}

/** 라벨 옆 단위 — 길면 그림을 뚫고 나가므로 카드에만 적는다 */
const unitFor = (u: string) => (u.length > 7 ? "" : u);

function pathOf(points: Array<[number, number]>, close: boolean): string {
  if (points.length === 0) return "";
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + (close ? " Z" : "");
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

  const withValue = slots.filter((s) => s.pos);
  const minePts = withValue.map((s) => polar(s.angle, s.pos!.r));
  const mine = minePts.length >= 2 ? pathOf(minePts, minePts.length === n) : null;
  const missing = slots.filter((s) => !s.result);
  const noRef = slots.filter((s) => s.result && !s.gauge);
  const unprinted = slots.filter((s) => s.gauge && !s.gauge.ref.printed);
  const oneSided = slots.filter((s) => s.gauge && (s.gauge.ref.low == null || s.gauge.ref.high == null));

  return (
    <div>
      <svg
        viewBox="0 0 300 240"
        style={{ width: "100%", maxWidth: 380, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="피검사 항목별 참고구간과 내 수치"
      >
        {/* 바깥 테두리 — 축 끝을 잇는 옅은 다각형. 크기 감을 잡는 틀일 뿐 의미는 없다 */}
        <path d={pathOf(slots.map((s) => polar(s.angle, R)), true)} fill="none" stroke="var(--border-subtle)" strokeWidth="1" />

        {/* 축선 — 값이 없는 축은 점선 */}
        {slots.map((s) => {
          const [x, y] = polar(s.angle, R);
          return (
            <line
              key={`ax-${s.a.code}`}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={s.pos ? undefined : "3 3"}
            />
          );
        })}

        {/* 참고구간 막대 — 축 위에 놓인 라운드 막대. 한쪽 참고치는 중심에서 시작하거나 끝까지 간다 */}
        {slots.map((s) => {
          if (!s.pos) return null;
          const [x1, y1] = polar(s.angle, s.pos.barStart);
          const [x2, y2] = polar(s.angle, s.pos.barEnd);
          return (
            <g key={`bar-${s.a.code}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--success)" strokeWidth={BAR_W + 2} strokeLinecap="round" opacity=".35" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--success-subtle)" strokeWidth={BAR_W} strokeLinecap="round" />
            </g>
          );
        })}

        {/* 내 수치 — 점을 잇는 선 */}
        {mine ? (
          <path
            d={mine}
            fill={minePts.length === n ? "var(--accent-subtle)" : "none"}
            fillOpacity=".55"
            stroke="var(--accent)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {slots.map((s) => {
          if (!s.pos) return null;
          const [x, y] = polar(s.angle, s.pos.r);
          return <circle key={`pt-${s.a.code}`} cx={x} cy={y} r="4.5" fill={s.tone} stroke="var(--bg-card)" strokeWidth="1.5" />;
        })}

        {/* 라벨 + 값 */}
        {slots.map((s) => {
          const [lx, ly] = polar(s.angle, R + 24);
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
          각 축의 연두색 막대가 참고구간이에요. 점이 막대 안이면 정상, 막대에서 멀수록 많이 벗어난 거예요.
          {oneSided.length
            ? " 상한만 있는 항목은 막대가 가운데서 시작하고, 하한만 있는 항목은 축 끝까지 이어져요."
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

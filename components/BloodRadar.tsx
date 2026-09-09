"use client";

import { gaugeFor, isConcerning, resultOf, statusOf, STATUS_LABELS, type BloodRow } from "@/lib/blood";
import type { Analyte } from "@/lib/bloodCatalog";

/**
 * 피검사 항목 **스포크 차트** — 항목 수만큼 방향을 나눈다 (2026-09-09, 사용자와 여섯 번째로 정한 최종 모양).
 *
 * 항목마다 자기 방향의 스포크 위에 **정상 범위를 라운드 막대**로, **내 값을 점**으로 놓는다.
 * 점이 막대 위면 정상, 막대 밖이면 벗어난 것이고 막대에서 멀수록 많이 벗어난 것이다.
 * 정상 범위의 하한·상한은 모든 방향에서 같은 반지름(R_IN·R_OUT)이라 막대가 고르게 놓이고,
 * 한쪽 참고치는 막대가 중심 가까이에서 시작하거나(상한만) 바깥까지 이어진다(하한만).
 * 높음·낮음은 값 옆 ▲ ▼ 과 점 색으로 가른다.
 *
 * 거쳐 온 모양과 안 맞았던 이유 —
 *   꼭짓점을 이은 띠      한쪽 참고치를 그릴 수 없다
 *   축 위 막대 + 연결선   선 위에 선이라 어수선했다 (연결선을 빼자 이 모양이 됐다)
 *   부채꼴 안의 면        "이 안 어디든 값이 놓일 수 있다" 는 인상
 *   정상 원(면) + 점      정상 범위의 어디쯤인지가 안 보였다
 *
 * 이번 검사에 없는 항목은 스포크를 점선으로, 값을 `—` 로 비워 둔다. eGFR·HDL 처럼 높을수록
 * 좋은 항목은 막대 밖으로 나가도 위험색이 아니다. 막대(`BloodGauge`)는 상세 화면에 그대로 남는다.
 */

const R = 88; // 가장 바깥 (많이 벗어난 값이 닿는 곳 · 하한만 있는 항목의 막대 끝)
const R_0 = 0.12 * R; // 상한만 있는 항목의 막대 시작 (중심 근처)
const R_MIN = 0.1 * R; // 점이 들어갈 수 있는 가장 안쪽
const R_MAX = 0.96 * R; // 점이 나갈 수 있는 가장 바깥
const R_IN = 0.42 * R; // 정상 범위 하한이 놓이는 반지름
const R_OUT = 0.74 * R; // 정상 범위 상한이 놓이는 반지름
const CX = 160;
const CY = 124;

/** 화면에 쓰는 짧은 이름 — 카탈로그 라벨은 길다 ("Calculated LDL-C") */
const SHORT: Record<string, string> = { ALT: "ALT", LDL: "LDL", TG: "중성지방", HBA1C: "HbA1c", EGFR: "eGFR" };

function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

const clamp = (r: number) => Math.max(R_MIN, Math.min(R_MAX, r));

/**
 * 정상 범위 막대의 구간과 값의 반지름 (2026-09-09 사용자 결정 — 정상 범위 전체를 막대로, 내 값은 점으로).
 *   양쪽 참고치 (a~b)   막대 R_IN ~ R_OUT          값: 하한→R_IN, 상한→R_OUT 비율
 *   상한만 (<= X)       막대 R_0 ~ R_OUT           값: 0→R_0, X→R_OUT
 *   하한만 (>= X)       막대 R_IN ~ R (끝까지)      값: X→R_IN, 1.6X→R_OUT, 그 위는 끝까지
 * 막대 밖의 점은 벗어난 값이고, 막대에서 멀수록 많이 벗어난 것이다.
 */
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
  /** 그림만 — 판정 카드·NOTE 는 생략 (벗어난 항목 차트처럼 아래에 카드가 따로 있는 자리) */
  compact?: boolean;
}) {
  const n = analytes.length;
  if (n < 3) return null;
  const angles = analytes.map((_, i) => -90 + (360 / n) * i);

  const slots = analytes.map((a, i) => {
    const result = resultOf(row, a.code);
    const gauge = result ? gaugeFor(result, a) : null;
    const status = result ? statusOf(result, a) : "unknown";
    const pos = result?.value != null && gauge ? place(result.value, gauge.ref.low, gauge.ref.high) : null;
    const bad = isConcerning(status, a);
    const tone =
      status === "normal" ? "var(--success)" : status === "unknown" ? "var(--text-muted)" : bad ? "var(--danger)" : "var(--warning)";
    const arrow = status === "high" ? "▲" : status === "low" ? "▼" : "";
    return { a, angle: angles[i], result, gauge, pos, status, bad, tone, arrow, short: SHORT[a.code] ?? a.code };
  });

  const missing = slots.filter((s) => !s.result);
  const noRef = slots.filter((s) => s.result && !s.gauge);
  const unprinted = slots.filter((s) => s.gauge && !s.gauge.ref.printed);

  return (
    <div>
      <svg
        viewBox="0 0 320 248"
        style={{ width: "100%", maxWidth: 400, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="피검사 항목별 정상 범위(막대)와 내 수치(점)"
      >
        {/* 바깥 테두리 — 크기 감을 잡는 틀 */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-subtle)" strokeWidth="1" />

        {/* 스포크 — 점이 놓이는 선. 값 없는 항목은 점선 */}
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
              strokeDasharray={s.pos == null ? "3 3" : undefined}
              opacity={s.pos == null ? 0.7 : 1}
            />
          );
        })}

        {/* 정상 범위 — 스포크 위의 라운드 막대. 그 항목의 정상 구간 전체다 */}
        {slots.map((s) => {
          if (!s.pos) return null;
          const [x1, y1] = polar(s.angle, s.pos.barStart);
          const [x2, y2] = polar(s.angle, s.pos.barEnd);
          return (
            <line
              key={`bar-${s.a.code}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--success)"
              strokeWidth="10"
              strokeLinecap="round"
              opacity=".38"
            />
          );
        })}

        {/* 내 수치 — 막대 위(정상) 또는 밖(벗어남)의 점 하나 */}
        {slots.map((s) => {
          if (!s.pos) return null;
          const [x, y] = polar(s.angle, s.pos.r);
          return (
            <g key={`pt-${s.a.code}`}>
              <circle cx={x} cy={y} r="8.5" fill={s.tone} opacity=".18" />
              <circle cx={x} cy={y} r="5" fill={s.tone} stroke="var(--bg-card)" strokeWidth="1.6" />
            </g>
          );
        })}

        {/* 라벨 + 값 (+ ▲▼) */}
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
                {s.arrow ? (
                  <tspan fontSize="8.5" fontWeight="800">
                    {" "}
                    {s.arrow}
                  </tspan>
                ) : null}
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
          초록 막대가 그 항목의 정상 범위예요. 점이 막대 위에 있으면 정상, 막대 밖이면 벗어난 것이고 멀수록 많이 벗어난 거예요.
          상한만 있는 항목은 막대가 가운데 가까이에서 시작하고, 하한만 있는 항목은 바깥까지 이어져요. 높음은 ▲, 낮음은 ▼.
          {slots.some((s) => s.a.higherIsBetter) ? " eGFR 처럼 높을수록 좋은 항목은 ▲ 여도 걱정할 일이 아니에요(주의색)." : ""}
          {testedAt ? ` 기준 검사: ${testedAt}.` : ""}
          {missing.length ? ` 이번 검사에는 ${missing.map((s) => s.short).join("·")}이 없어 그 방향은 비워 두었어요.` : ""}
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

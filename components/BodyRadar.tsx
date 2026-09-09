"use client";

import type { RadarAxis } from "@/lib/inbody";

/**
 * 체성분 삼각 레이더.
 *
 * 체중·골격근량·체지방률을 세 축에 놓고, **적정 범위를 음영 띠**로 그린 뒤
 * 내 수치를 그 위에 겹쳐 어느 위치인지 한눈에 보이게 한다.
 *
 * 축마다 단위가 달라 값을 그대로 반지름에 쓸 수 없으므로,
 * 각 축의 적정 하한을 R_IN, 상한을 R_OUT에 고정 매핑한다.
 * 그러면 음영 띠는 두 삼각형 사이의 고른 띠가 되고,
 * 내 점이 띠 안이면 적정 / 안쪽이면 부족 / 바깥이면 초과로 바로 읽힌다.
 *
 * **항상 가장 최근 기록으로 그린다** (2026-09-09 사용자 결정). 기록에 없는 축은
 * 값·점을 비워 두고 **삼각 틀은 그대로** 둔다 — 체중만 적은 날에도 레이더가 사라지지
 * 않고, 무엇이 비었는지가 보인다. 값이 있는 축이 둘이면 선, 하나면 점만 그린다.
 */

const R = 74; // 최대 반지름
const R_IN = 0.46 * R; // 적정 하한이 놓이는 반지름
const R_OUT = 0.78 * R; // 적정 상한이 놓이는 반지름
const CX = 128;
const CY = 118;

/** 축 각도 — 위, 오른쪽 아래, 왼쪽 아래 */
const ANGLES = [-90, 30, 150];

/** 세 축은 고정이다. 기록에 값이 없어도 자리는 남긴다 */
export const RADAR_SLOTS = [
  { path: "composition.weight.value", label: "체중", unit: "kg" },
  { path: "muscleFat.skeletalMuscleMass.value", label: "골격근량", unit: "kg" },
  { path: "obesity.percentBodyFat.value", label: "체지방률", unit: "%" },
] as const;

function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function polygon(rs: number[]): string {
  return rs
    .map((r, i) => {
      const [x, y] = polar(ANGLES[i], r);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

/** 값 → 반지름. 적정 구간을 R_IN~R_OUT에 맞추고 바깥은 완만하게 늘린다 */
function radiusFor(axis: RadarAxis): number {
  const { value, range } = axis;
  const span = range.max - range.min || 1;
  const t = (value - range.min) / span; // 0=하한, 1=상한
  const r = R_IN + t * (R_OUT - R_IN);
  // 범위를 크게 벗어나도 축 라벨과 겹치지 않게 가둔다
  return Math.max(0.16 * R, Math.min(0.93 * R, r));
}

const STATUS_COLOR: Record<RadarAxis["status"], string> = {
  적정: "var(--success)",
  부족: "var(--accent)",
  초과: "var(--danger)",
};

type Slot = {
  path: string;
  label: string;
  unit: string;
  /** 범위까지 있어 위치를 그릴 수 있는 축 */
  axis: RadarAxis | null;
  /** 값은 있는데 적정 범위를 알 수 없는 경우 — 숫자만 보여 준다 */
  rawValue: number | null;
};

export function BodyRadar({
  axes,
  values,
  measuredAt,
}: {
  axes: RadarAxis[];
  /** 최근 기록의 세 값(범위가 없어 축이 못 된 값도 포함). 없으면 axes 만 쓴다 */
  values?: Partial<Record<string, number | null>>;
  measuredAt?: string;
}) {
  const slots: Slot[] = RADAR_SLOTS.map((s) => {
    const axis = axes.find((a) => a.path === s.path) ?? null;
    const raw = values?.[s.path];
    return { ...s, axis, rawValue: axis ? axis.value : typeof raw === "number" ? raw : null };
  });
  const present = slots.filter((s) => s.axis);
  const missing = slots.filter((s) => s.rawValue == null);

  const outer = polygon(slots.map(() => R_OUT));
  const inner = polygon(slots.map(() => R_IN));

  /* 내 수치 — 값이 있는 축만 잇는다. 셋이면 삼각, 둘이면 선, 하나면 점만 */
  const minePts = slots
    .map((s, i) => (s.axis ? polar(ANGLES[i], radiusFor(s.axis)) : null))
    .filter((p): p is [number, number] => p !== null);
  const mine =
    minePts.length >= 2
      ? minePts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
        (minePts.length === 3 ? " Z" : "")
      : null;
  const derived = present.some((s) => s.axis?.range.derived);

  return (
    <div>
      <svg
        viewBox="0 0 256 192"
        style={{ width: "100%", maxWidth: 340, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="체성분 적정 범위와 내 수치"
      >
        {/* 적정 범위 띠 — 상한 삼각형에서 하한 삼각형을 뺀 영역 */}
        <path d={`${outer} ${inner}`} fillRule="evenodd" fill="var(--success-subtle)" stroke="none" />
        <path d={outer} fill="none" stroke="var(--success)" strokeWidth="1" opacity=".45" />
        <path d={inner} fill="none" stroke="var(--success)" strokeWidth="1" opacity=".45" />

        {/* 축선 — 값이 없는 축은 점선으로 */}
        {slots.map((s, i) => {
          const [x, y] = polar(ANGLES[i], R);
          return (
            <line
              key={s.path}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={s.axis ? undefined : "3 3"}
            />
          );
        })}

        {/* 내 수치 */}
        {mine ? (
          <path
            d={mine}
            fill={minePts.length === 3 ? "var(--accent-subtle)" : "none"}
            stroke="var(--accent)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {slots.map((s, i) => {
          if (!s.axis) return null;
          const [x, y] = polar(ANGLES[i], radiusFor(s.axis));
          return (
            <circle
              key={`p-${s.path}`}
              cx={x}
              cy={y}
              r="4"
              fill={STATUS_COLOR[s.axis.status]}
              stroke="var(--bg-card)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* 축 라벨 + 값 (없으면 —) */}
        {slots.map((s, i) => {
          const [lx, ly] = polar(ANGLES[i], R + 22);
          return (
            <g key={`l-${s.path}`}>
              <text x={lx} y={ly - 3} fontSize="10.5" fontWeight="700" textAnchor="middle" fill="var(--text-secondary)">
                {s.label}
              </text>
              <text
                x={lx}
                y={ly + 11}
                fontSize="12"
                fontWeight="800"
                textAnchor="middle"
                fill={s.rawValue == null ? "var(--text-muted)" : "var(--text-primary)"}
              >
                {s.rawValue == null ? "—" : s.rawValue}
                {s.rawValue == null ? null : (
                  <tspan fontSize="8.5" fontWeight="500">
                    {s.unit}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 축별 판정 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
        {slots.map((s) => (
          <div
            key={`s-${s.path}`}
            style={{ padding: "10px 8px", borderRadius: 12, background: "var(--bg-secondary)", textAlign: "center" }}
          >
            <p className="field-hint" style={{ margin: 0 }}>
              {s.label}
            </p>
            {s.axis ? (
              <>
                <p style={{ margin: "3px 0 0", fontSize: "0.82rem", fontWeight: 800, color: STATUS_COLOR[s.axis.status] }}>
                  {s.axis.status}
                </p>
                <p className="field-hint" style={{ margin: "2px 0 0", fontSize: 10.5 }}>
                  적정 {s.axis.range.min}~{s.axis.range.max}
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: "3px 0 0", fontSize: "0.82rem", fontWeight: 800, color: "var(--text-muted)" }}>
                  {s.rawValue == null ? "기록 없음" : "범위 없음"}
                </p>
                <p className="field-hint" style={{ margin: "2px 0 0", fontSize: 10.5 }}>
                  {s.rawValue == null ? "이 기록에는 값이 없어요" : "적정 범위를 알 수 없어요"}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="note-block" style={{ marginTop: 14 }}>
        <strong>NOTE</strong>
        음영이 적정 범위예요. 안쪽으로 들어가면 부족, 바깥으로 나가면 초과예요.
        {measuredAt ? ` 기준 기록: ${measuredAt}.` : ""}
        {missing.length
          ? ` 이 기록에는 ${missing.map((s) => s.label).join("·")}이 없어 그 축은 비워 두었어요.`
          : ""}
        {slots.some((s) => !s.axis && s.rawValue != null)
          ? " 적정 범위가 없는 값은 My 에서 키·성별을 채우면 계산할 수 있어요."
          : ""}
        {derived ? " 결과지에 범위가 인쇄되지 않은 항목은 키·성별과 제지방량 범위로 계산했어요." : ""}
      </div>
    </div>
  );
}

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
 */

const R = 74; // 최대 반지름
const R_IN = 0.46 * R; // 적정 하한이 놓이는 반지름
const R_OUT = 0.78 * R; // 적정 상한이 놓이는 반지름
const CX = 128;
const CY = 118;

/** 축 각도 — 위, 오른쪽 아래, 왼쪽 아래 */
const ANGLES = [-90, 30, 150];

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

export function BodyRadar({
  axes,
  measuredAt,
}: {
  axes: RadarAxis[];
  measuredAt?: string;
}) {
  if (axes.length < 3) {
    return (
      <p className="field-hint" style={{ margin: 0 }}>
        체중·골격근량·체지방률이 모두 있는 기록이 필요해요.
      </p>
    );
  }

  const three = axes.slice(0, 3);
  const outer = polygon(three.map(() => R_OUT));
  const inner = polygon(three.map(() => R_IN));
  const mine = polygon(three.map(radiusFor));
  const derived = three.some((a) => a.range.derived);

  return (
    <div>
      <svg
        viewBox="0 0 256 192"
        style={{ width: "100%", maxWidth: 340, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="체성분 적정 범위와 내 수치"
      >
        {/* 적정 범위 띠 — 상한 삼각형에서 하한 삼각형을 뺀 영역 */}
        <path
          d={`${outer} ${inner}`}
          fillRule="evenodd"
          fill="var(--success-subtle)"
          stroke="none"
        />
        <path d={outer} fill="none" stroke="var(--success)" strokeWidth="1" opacity=".45" />
        <path d={inner} fill="none" stroke="var(--success)" strokeWidth="1" opacity=".45" />

        {/* 축선 */}
        {three.map((a, i) => {
          const [x, y] = polar(ANGLES[i], R);
          return (
            <line
              key={a.path}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
            />
          );
        })}

        {/* 내 수치 */}
        <path
          d={mine}
          fill="var(--accent-subtle)"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {three.map((a, i) => {
          const [x, y] = polar(ANGLES[i], radiusFor(a));
          return (
            <circle
              key={`p-${a.path}`}
              cx={x}
              cy={y}
              r="4"
              fill={STATUS_COLOR[a.status]}
              stroke="var(--bg-card)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* 축 라벨 + 값 */}
        {three.map((a, i) => {
          const [lx, ly] = polar(ANGLES[i], R + 22);
          return (
            <g key={`l-${a.path}`}>
              <text
                x={lx}
                y={ly - 3}
                fontSize="10.5"
                fontWeight="700"
                textAnchor="middle"
                fill="var(--text-secondary)"
              >
                {a.label}
              </text>
              <text
                x={lx}
                y={ly + 11}
                fontSize="12"
                fontWeight="800"
                textAnchor="middle"
                fill="var(--text-primary)"
              >
                {a.value}
                <tspan fontSize="8.5" fontWeight="500">
                  {a.unit}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {/* 축별 판정 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginTop: 14,
        }}
      >
        {three.map((a) => (
          <div
            key={`s-${a.path}`}
            style={{
              padding: "10px 8px",
              borderRadius: 12,
              background: "var(--bg-secondary)",
              textAlign: "center",
            }}
          >
            <p className="field-hint" style={{ margin: 0 }}>
              {a.label}
            </p>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: "0.82rem",
                fontWeight: 800,
                color: STATUS_COLOR[a.status],
              }}
            >
              {a.status}
            </p>
            <p className="field-hint" style={{ margin: "2px 0 0", fontSize: 10.5 }}>
              적정 {a.range.min}~{a.range.max}
            </p>
          </div>
        ))}
      </div>

      <div className="note-block" style={{ marginTop: 14 }}>
        <strong>NOTE</strong>
        음영이 적정 범위예요. 안쪽으로 들어가면 부족, 바깥으로 나가면 초과예요.
        {measuredAt ? ` 기준 기록: ${measuredAt}.` : ""}
        {derived
          ? " 결과지에 범위가 인쇄되지 않은 항목은 키·성별과 제지방량 범위로 계산했어요."
          : ""}
      </div>
    </div>
  );
}

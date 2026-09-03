"use client";

import { useEffect, useRef, useState } from "react";
import { pick, type FieldDef } from "@/lib/inbody";

/**
 * 추이 그래프 조각들.
 *
 * Inbody 화면의 두 자리(핵심 3종 아래, 항목별 보기)에서 같은 UI를 쓰므로
 * 한 곳에 모아 둔다. 라이브러리 없이 SVG로 직접 그린다.
 */

export type Row = Record<string, unknown> & { _id: string; measuredAt: string };
export type Point = { t: number; v: number };

/** 측정 목록에서 한 항목만 뽑아 시간순 점으로 만든다 */
export function toPoints(rows: Row[] | null, path: string): Point[] {
  const out: Point[] = [];
  for (const r of rows ?? []) {
    const v = pick(r, path);
    if (v != null) out.push({ t: new Date(r.measuredAt).getTime(), v });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * 라인 차트.
 * 점 하나당 최소 간격(STEP)을 확보해 날짜가 겹치지 않게 하고,
 * 넓어진 만큼 컨테이너를 좌우 스크롤로 둔다.
 */
export function Chart({
  field,
  points,
  hideLabel = false,
}: {
  field: FieldDef;
  points: Point[];
  hideLabel?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  // 그래프가 컨테이너보다 넓을 때만 안내를 띄운다
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [points.length]);

  if (points.length === 0) {
    return (
      <div>
        {hideLabel ? null : <p className="field-label">{field.label}</p>}
        <p className="field-hint" style={{ margin: 0 }}>
          아직 데이터가 없어요.
        </p>
      </div>
    );
  }

  /**
   * 점 하나당 간격.
   * 날짜(25.9.2)와 값을 나란히 적어도 겹치지 않을 만큼 넉넉히 둔다.
   * 이 때문에 폭이 컨테이너를 넘어가면 좌우 스크롤로 본다.
   */
  const STEP = 116;
  const pad = { l: 44, r: 34, t: 22, b: 52 };
  const W = pad.l + pad.r + Math.max(1, points.length - 1) * STEP;
  const H = 204;

  const ys = points.map((p) => p.v);
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const span = rawMax - rawMin || 1;
  const minY = rawMin - span * 0.25;
  const maxY = rawMax + span * 0.25;

  /**
   * x는 시간 비례가 아니라 **기록 순서**로 둔다.
   * 인바디는 몇 달~몇 년 간격이 뒤섞여서, 시간 비례로 그리면
   * 가까운 시기의 기록이 한곳에 뭉쳐 날짜 라벨이 겹친다.
   */
  const px = (i: number) => (points.length === 1 ? W / 2 : pad.l + i * STEP);
  const py = (v: number) =>
    pad.t + (1 - (v - minY) / (maxY - minY)) * (H - pad.t - pad.b);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(p.v)}`)
    .join(" ");
  const last = points[points.length - 1];
  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  return (
    // grid·flex 자식은 기본 min-width가 auto라, 안쪽 SVG 폭만큼 늘어나 잘린다.
    // 0으로 낮춰야 내부 컨테이너가 실제로 스크롤된다.
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      {hideLabel ? null : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <p className="field-label" style={{ marginBottom: 0 }}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
          </p>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{last.v}</p>
        </div>
      )}

      {/* 점이 많으면 폭이 넓어지므로 좌우로 스크롤한다 */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
        }}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ display: "block", maxWidth: "none" }}
          role="img"
          aria-label={`${field.label} 추이`}
        >
          {[0, 0.5, 1].map((r) => {
            const y = pad.t + r * (H - pad.t - pad.b);
            return (
              <line
                key={r}
                x1={pad.l}
                x2={W - pad.r}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
              />
            );
          })}

          <text x="4" y={pad.t + 4} fontSize="10" fill="var(--text-muted)">
            {Math.round(maxY * 10) / 10}
          </text>
          <text x="4" y={H - pad.b + 4} fontSize="10" fill="var(--text-muted)">
            {Math.round(minY * 10) / 10}
          </text>

          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.4" />

          {points.map((p, i) => (
            <g key={`${p.t}-${i}`}>
              <circle cx={px(i)} cy={py(p.v)} r={4} fill="var(--accent)" />
              {/* 폭을 넓혔으니 값과 날짜를 점마다 적어도 겹치지 않는다 */}
              <text
                x={px(i)}
                y={py(p.v) - 12}
                fontSize="10.5"
                fontWeight="700"
                textAnchor="middle"
                fill="var(--text-primary)"
              >
                {p.v}
              </text>
              <text
                x={px(i)}
                y={H - pad.b + 26}
                fontSize="10"
                textAnchor="middle"
                fill="var(--text-muted)"
              >
                {fmt(p.t)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {scrollable && !atEnd ? (
        <p className="field-hint" style={{ margin: "6px 0 0", textAlign: "right" }}>
          좌우로 넘겨보세요 →
        </p>
      ) : null}
    </div>
  );
}

/**
 * 접기/펼치기 한 줄.
 * 접힌 상태에서도 최신값은 보이게 해서, 펼치지 않고도 훑을 수 있게 한다.
 */
export function FieldRow({
  field,
  points,
  open,
  onToggle,
}: {
  field: FieldDef;
  points: Point[];
  open: boolean;
  onToggle: () => void;
}) {
  const last = points[points.length - 1];

  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "13px 2px",
          border: "none",
          background: "none",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>
          {field.label}
          {field.unit ? (
            <span
              style={{
                marginLeft: 6,
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                fontWeight: 400,
              }}
            >
              {field.unit}
            </span>
          ) : null}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {last ? <span style={{ fontWeight: 800 }}>{last.v}</span> : null}
          <span
            aria-hidden="true"
            style={{
              color: "var(--text-muted)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .15s ease",
              fontSize: "0.7rem",
            }}
          >
            ▼
          </span>
        </span>
      </button>

      {open ? (
        <div style={{ padding: "2px 0 20px" }}>
          <Chart field={field} points={points} hideLabel />
        </div>
      ) : null}
    </div>
  );
}

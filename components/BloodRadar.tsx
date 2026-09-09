"use client";

import { gaugeFor, isConcerning, resultOf, statusOf, STATUS_LABELS, type BloodRow } from "@/lib/blood";
import type { Analyte } from "@/lib/bloodCatalog";

/**
 * 피검사 핵심 항목 레이더 — **항목 수만큼 축을 가진 다각형** (2026-09-09 사용자 요청).
 *
 * 인바디 삼각 레이더와 같은 읽는 법이다: 음영 띠가 참고구간, 안쪽이면 낮음, 바깥이면 높음.
 * 참고구간 고리는 **모든 축에서 같은 폭**이다 (2026-09-09 사용자 결정 — 축마다 눈금이 다르게
 * 그리면 도형이 삐뚤어져 보인다). 각 축의 참고구간 하한을 R_IN, 상한을 R_OUT 에 고정 매핑하고
 * 내 값만 그 비율로 찍는다 — 인바디 삼각과 같은 방식이다. 축 사이의 실제 크기 비교는 애초에
 * 의미가 없고, 각 축에서 **띠 기준 안·밖과 얼마나 벗어났는지**만 읽는다.
 *   양쪽 참고치      t = (값-하한)/(상한-하한)
 *   상한만 (<= X)    t = 값/X            — 0 이 하한 자리
 *   하한만 (>= X)    t = (값-X)/(0.6X)   — 바깥은 정상이므로 위험색을 쓰지 않는다
 *
 * 이번 검사에 없는 항목은 축선을 점선으로, 값을 `—` 로 비워 두고 도형은 유지한다.
 * 값이 있는 축이 전부면 닫힌 다각형, 일부면 열린 선, 하나면 점만 그린다.
 * eGFR·HDL 처럼 높을수록 좋은 항목은 바깥으로 나가도 위험이 아니다 — 색으로 가른다.
 *
 * 막대(`BloodGauge`)는 상세 화면과 "벗어난 항목" 카드에 그대로 남는다.
 */

const R = 80;
const R_MIN = 0.16 * R;
const R_MAX = 0.93 * R;
/** 참고구간 하한·상한이 놓이는 반지름 — 모든 축 공통 */
const R_IN = 0.46 * R;
const R_OUT = 0.78 * R;
const CX = 150;
const CY = 124;

/** 화면에 쓰는 짧은 이름 — 카탈로그 라벨은 길다 ("Calculated LDL-C") */
const SHORT: Record<string, string> = { ALT: "ALT", LDL: "LDL", TG: "중성지방", HBA1C: "HbA1c", EGFR: "eGFR" };

function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/** 참고구간 대비 위치(0=하한 · 1=상한) → 반지름. 크게 벗어나도 라벨과 겹치지 않게 가둔다 */
const rOf = (t: number) => Math.max(R_MIN, Math.min(R_MAX, R_IN + t * (R_OUT - R_IN)));

/** 값을 참고구간 기준 0~1 로 — 한쪽만 있는 참고치도 다룬다 */
function tOf(value: number, low: number | null, high: number | null): number | null {
  if (low != null && high != null) return (value - low) / (high - low || 1);
  if (high != null) return value / (high || 1);
  if (low != null) return (value - low) / (low * 0.6 || 1);
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
    const t = result?.value != null && gauge ? tOf(result.value, gauge.ref.low, gauge.ref.high) : null;
    const status = result ? statusOf(result, a) : "unknown";
    const bad = isConcerning(status, a);
    const tone = status === "normal" ? "var(--success)" : status === "unknown" ? "var(--text-muted)" : bad ? "var(--danger)" : "var(--warning)";
    return { a, angle: angles[i], result, gauge, t, status, bad, tone, short: SHORT[a.code] ?? a.code };
  });

  /* 참고구간 고리 — 모든 축이 같은 반지름. 그래서 도형이 고르고, 벗어난 정도만 눈에 띈다 */
  const bandInner = pathOf(slots.map((s) => polar(s.angle, R_IN)), true);
  const bandOuter = pathOf(slots.map((s) => polar(s.angle, R_OUT)), true);

  const withValue = slots.filter((s) => s.t != null);
  const minePts = withValue.map((s) => polar(s.angle, rOf(s.t as number)));
  const mine = minePts.length >= 2 ? pathOf(minePts, minePts.length === n) : null;
  const missing = slots.filter((s) => !s.result);
  const noRef = slots.filter((s) => s.result && !s.gauge);
  const unprinted = slots.filter((s) => s.gauge && !s.gauge.ref.printed);

  return (
    <div>
      <svg
        viewBox="0 0 300 240"
        style={{ width: "100%", maxWidth: 380, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="피검사 핵심 항목의 참고구간과 내 수치"
      >
        <path d={`${bandOuter} ${bandInner}`} fillRule="evenodd" fill="var(--success-subtle)" stroke="none" />
        <path d={bandOuter} fill="none" stroke="var(--success)" strokeWidth="1" opacity=".45" />
        <path d={bandInner} fill="none" stroke="var(--success)" strokeWidth="1" opacity=".45" />

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
              strokeDasharray={s.t != null ? undefined : "3 3"}
            />
          );
        })}

        {mine ? (
          <path
            d={mine}
            fill={minePts.length === n ? "var(--accent-subtle)" : "none"}
            stroke="var(--accent)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {slots.map((s) => {
          if (s.t == null) return null;
          const [x, y] = polar(s.angle, rOf(s.t));
          return <circle key={`pt-${s.a.code}`} cx={x} cy={y} r="4" fill={s.tone} stroke="var(--bg-card)" strokeWidth="1.5" />;
        })}

        {slots.map((s) => {
          const [lx, ly] = polar(s.angle, R + 24);
          const anchor = anchorFor(s.angle);
          const value = s.result?.value;
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
                {value == null || !unitFor(s.result?.unit ?? s.a.unit) ? null : (
                  <tspan fontSize="8" fontWeight="500" fill="var(--text-muted)">
                    {" "}
                    {unitFor(s.result?.unit ?? s.a.unit)}
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
        음영이 참고구간이에요. 안쪽으로 들어가면 낮음, 바깥으로 나가면 높음이고, 띠에서 멀수록 많이
        벗어난 거예요. 축마다 단위가 달라 <strong>축 사이의 크기 비교는 의미가 없고</strong> 각 축에서 띠 기준으로만 봐 주세요.
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

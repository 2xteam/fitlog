"use client";

import { gaugeFor, statusOf, isConcerning, STATUS_LABELS, type ResultLike } from "@/lib/blood";
import type { Analyte } from "@/lib/bloodCatalog";

/**
 * 검사 한 항목의 값과 참고구간을 막대로 보여준다.
 *
 * 인바디 핵심 3종은 삼각 레이더로 그렸는데, 피검사에는 그 방식을 쓰지 않았다.
 * 레이더는 축들이 같은 척도로 읽힌다는 인상을 주는데, 피검사 항목은 단위도
 * 방향도 제각각이다(ALT는 낮을수록, eGFR은 높을수록 좋다). 정규화해서 한
 * 그림에 얹으면 그림은 그럴듯한데 읽는 사람이 틀린 결론을 얻는다.
 * **항목마다 자기 눈금을 가진 막대**가 정직하다.
 */
export function BloodGauge({
  analyte,
  result,
  compact = false,
}: {
  analyte: Analyte;
  result: ResultLike;
  compact?: boolean;
}) {
  const status = statusOf(result, analyte);
  const bad = isConcerning(status, analyte);
  const g = gaugeFor(result, analyte);

  const tone =
    status === "normal"
      ? "var(--success)"
      : bad
        ? "var(--danger)"
        : "var(--warning)";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: compact ? "0.78rem" : "0.85rem", fontWeight: 600 }}>
          {analyte.label}
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontSize: compact ? "1.15rem" : "1.3rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              color: status === "normal" ? "var(--text-primary)" : tone,
            }}
          >
            {result.value ?? "—"}
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
            {result.unit ?? analyte.unit}
          </span>
        </span>
      </div>

      {g ? (
        <div style={{ marginTop: 8 }}>
          {/* 눈금 — 정상 구간을 옅게 칠하고 그 위에 값을 찍는다 */}
          <div
            style={{
              position: "relative",
              height: 8,
              borderRadius: 999,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${g.bandStart * 100}%`,
                right: `${(1 - g.bandEnd) * 100}%`,
                background: "var(--success-subtle)",
                borderLeft: g.ref.low != null ? "1px solid var(--success)" : "none",
                borderRight: g.ref.high != null ? "1px solid var(--success)" : "none",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -3,
                left: `${g.pos * 100}%`,
                width: 3,
                height: 14,
                marginLeft: -1.5,
                borderRadius: 2,
                background: tone,
                boxShadow: "0 0 0 2px var(--bg-card)",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 6,
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>{g.ref.text ?? refLabel(g.ref.low, g.ref.high)}</span>
            <span style={{ color: status === "normal" ? "var(--text-muted)" : tone, fontWeight: 700 }}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          {/* 참고치가 결과지에서 온 게 아니면 밝힌다 — 판정의 출처를 감추지 않는다 */}
          {!g.ref.printed ? (
            <p className="field-hint" style={{ margin: "4px 0 0", fontSize: "0.66rem" }}>
              결과지에 참고치가 없어 일반적인 기준으로 표시했어요.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="field-hint" style={{ margin: "6px 0 0", fontSize: "0.7rem" }}>
          {result.refText ?? "참고치가 없어 판정하지 않았어요."}
        </p>
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

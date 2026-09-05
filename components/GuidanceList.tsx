"use client";

import { useState } from "react";
import {
  EVIDENCE_LABELS,
  EVIDENCE_MEANING,
  KIND_LABELS,
  type EvidenceGrade,
  type Guidance,
} from "@/lib/bloodGuidance";

/**
 * 권고 목록 — **근거를 펼쳐볼 수 있는 것이 이 컴포넌트의 존재 이유다.**
 *
 * 건강 조언은 결론만 보여주면 어디서 온 말인지 알 수 없고, 사용자는 믿을지 말지를
 * 앱에 대한 인상으로 정하게 된다. 그래서 조언마다
 *   · 근거 등급(A~D)을 **접힌 상태에서도** 보이게 하고
 *   · 펼치면 어떤 연구·지침에서 나왔는지, 연구 설계와 한계까지 읽을 수 있게 한다.
 *
 * 등급 D(권하지 않음)도 지우지 않고 맨 뒤에 남긴다. "중성지방 높으면 오메가3"
 * 같은 말은 사용자가 이미 어디선가 듣고 온다. 앱이 침묵하면 그 말이 그대로 남는다.
 */

const TONE: Record<EvidenceGrade, { fg: string; bg: string }> = {
  A: { fg: "var(--success)", bg: "var(--success-subtle)" },
  B: { fg: "var(--point)", bg: "var(--point-subtle)" },
  C: { fg: "var(--text-muted)", bg: "var(--accent-subtle)" },
  D: { fg: "var(--danger)", bg: "var(--danger-subtle)" },
};

export function EvidenceChip({ grade }: { grade: EvidenceGrade }) {
  const t = TONE[grade];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px 2px 7px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: "0.66rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          flex: "none",
        }}
      />
      {grade} · {EVIDENCE_LABELS[grade]}
    </span>
  );
}

export function GuidanceList({ items }: { items: Guidance[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((g, i) => (
        <GuidanceCard key={`${g.analyte}-${g.kind}-${i}`} guidance={g} />
      ))}
    </div>
  );
}

function GuidanceCard({ guidance: g }: { guidance: Guidance }) {
  const [open, setOpen] = useState(false);
  const t = TONE[g.evidence];

  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderLeft: `3px solid ${t.fg}`,
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-card)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: "0.64rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {KIND_LABELS[g.kind]}
          </span>
          <EvidenceChip grade={g.evidence} />
        </div>

        <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.5 }}>
          {g.headline}
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.84rem",
            lineHeight: 1.65,
            color: "var(--text-secondary)",
          }}
        >
          {g.detail}
        </p>

        {g.effect ? (
          <p
            style={{
              margin: "10px 0 0",
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-secondary)",
              fontSize: "0.76rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {g.effect}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
            border: "none",
            background: "none",
            color: "var(--accent)",
            fontFamily: "inherit",
            fontSize: "0.76rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {open ? "근거 접기" : "무엇을 근거로 한 말인가요?"}
          <span
            aria-hidden="true"
            style={{
              fontSize: "0.6rem",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .15s ease",
            }}
          >
            ▼
          </span>
        </button>
      </div>

      {open ? (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "0.64rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            근거
          </p>

          {/* 연구 설계와 한계까지 — 결론만 보여주면 믿을지 말지를 인상으로 정하게 된다 */}
          {g.basis.split("\n\n").map((para, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "10px 0 0",
                fontSize: "0.8rem",
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {para}
            </p>
          ))}

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--border-subtle)",
              display: "grid",
              gap: 8,
            }}
          >
            <div>
              <p className="field-hint" style={{ margin: 0, fontSize: "0.68rem" }}>
                출처
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", fontWeight: 600 }}>
                {g.source.url ? (
                  <a
                    href={g.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    {g.source.name} ({g.source.year}) ↗
                  </a>
                ) : (
                  `${g.source.name} (${g.source.year})`
                )}
              </p>
            </div>

            <div>
              <p className="field-hint" style={{ margin: 0, fontSize: "0.68rem" }}>
                등급 {g.evidence}가 뜻하는 것
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {EVIDENCE_MEANING[g.evidence]}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 등급 체계 자체를 설명하는 범례 — 권고 목록 위에 한 번 둔다 */
export function EvidenceLegend() {
  const [open, setOpen] = useState(false);
  const grades: EvidenceGrade[] = ["A", "B", "C", "D"];

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          border: "none",
          background: "none",
          color: "var(--text-secondary)",
          fontFamily: "inherit",
          fontSize: "0.78rem",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", gap: 4 }}>
          {grades.map((g) => (
            <span
              key={g}
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: TONE[g].fg,
              }}
            />
          ))}
        </span>
        모든 권고에 근거 등급을 붙였어요
        <span
          aria-hidden="true"
          style={{
            fontSize: "0.6rem",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s ease",
          }}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 8,
            padding: "14px 16px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {grades.map((g) => (
            <div key={g} style={{ display: "grid", gap: 3 }}>
              <EvidenceChip grade={g} />
              <p
                style={{
                  margin: 0,
                  fontSize: "0.76rem",
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {EVIDENCE_MEANING[g]}
              </p>
            </div>
          ))}
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.74rem",
              lineHeight: 1.6,
              color: "var(--text-muted)",
            }}
          >
            등급 D도 지우지 않고 남겨요. 널리 알려진 조언에 대해 진료지침이 뭐라고 하는지
            보여드리는 편이 낫다고 봤어요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

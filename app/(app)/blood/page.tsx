"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { FieldRow } from "@/components/TrendChart";
import { BloodGauge } from "@/components/BloodGauge";
import { EvidenceLegend, GuidanceList } from "@/components/GuidanceList";
import { loadSession, type SessionUser } from "@/lib/session";
import {
  availableCodes,
  crossNotesFor,
  flaggedIn,
  pointsOf,
  resultOf,
  STATUS_LABELS,
  type BloodRow,
  type Flagged,
} from "@/lib/blood";
import { PRIMARY_ANALYTES, groupByPanel } from "@/lib/bloodCatalog";
import { commonGuidance, guidanceFor } from "@/lib/bloodGuidance";

/**
 * Blood — 피검사 기록을 읽는 화면 하나.
 *
 * 인바디와 같은 순서를 지킨다. **해석이 먼저, 원본이 나중.**
 *
 *   핵심 4축 → 이번에 벗어난 항목(+권고·근거) → 구획별 전 항목 → 등록된 결과지
 *
 * 4축은 고정이라 매번 같은 자리에서 같은 것을 본다. 그 아래 "이번에 벗어난 항목"은
 * 회차마다 구성이 바뀌는 대신 **볼 것이 분명해진다** — 36개를 다 훑지 않아도 된다.
 */
export default function BloodPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<BloodRow[] | null>(null);
  /** 인바디 최근 1건 — 교차 해석에 쓴다 */
  const [inbody, setInbody] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  const load = useCallback(async () => {
    if (!session) return;
    const q = encodeURIComponent(session.id);
    const [bloodRes, inbodyRes] = await Promise.all([
      fetch(`/api/blood?userId=${q}`),
      fetch(`/api/measurements?userId=${q}&limit=1`),
    ]);
    const blood = (await bloodRes.json()) as { tests?: BloodRow[] };
    const meas = (await inbodyRes.json()) as { measurements?: Array<Record<string, unknown>> };
    setRows(blood.tests ?? []);
    setInbody(meas.measurements?.[0] ?? null);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = rows?.[0] ?? null;
  const previous = rows?.[1] ?? null;

  const flagged = useMemo(() => flaggedIn(latest, previous), [latest, previous]);
  const crossNotes = useMemo(() => crossNotesFor(flagged, inbody), [flagged, inbody]);

  /** 기록에 값이 있는 항목만 (검사마다 패널이 다르다) */
  const codes = useMemo(() => availableCodes(rows), [rows]);
  const panels = useMemo(() => groupByPanel(codes), [codes]);

  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const allOpen = codes.length > 0 && open.size === codes.length;
  const count = rows?.length ?? 0;

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="BLOOD"
        headline={
          <>
            숫자를 읽고
            <br />
            무엇을 바꿀지까지
          </>
        }
        lead="피검사 결과지를 등록하면 항목마다 무엇을 뜻하는지, 무엇을 해볼 수 있는지 함께 보여드려요."
      >
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/blood/new" className="btn btn--primary">
            결과지 등록 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Sheet>

      {/* ── 핵심 4축 ────────────────────────────────────── */}
      <Sheet
        eyebrow="MAIN"
        headline="핵심 4축"
        lead={
          latest
            ? "간 · 지질 · 혈당 · 신장 네 갈래를 대표하는 항목이에요. 매번 같은 자리에서 봐요."
            : undefined
        }
      >
        {latest ? (
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 18,
            }}
          >
            {PRIMARY_ANALYTES.map((a) => {
              const r = resultOf(latest, a.code);
              if (!r) {
                return (
                  <div key={a.code}>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600 }}>{a.label}</p>
                    <p className="field-hint" style={{ margin: "8px 0 0" }}>
                      이번 검사에 없는 항목이에요.
                    </p>
                  </div>
                );
              }
              return <BloodGauge key={a.code} analyte={a} result={r} />;
            })}
          </div>
        ) : rows !== null ? (
          <p className="lead">아직 기록이 없어요. 결과지를 등록하면 여기에 나와요.</p>
        ) : null}

        {/* ── 이번에 벗어난 항목 ─────────────────────────── */}
        {latest ? (
          <div style={{ marginTop: 30 }}>
            <p className="eyebrow" style={{ margin: "0 0 2px" }}>
              이번에 벗어난 항목 · {flagged.length}
            </p>
            {flagged.length === 0 ? (
              <p className="lead" style={{ marginTop: 8 }}>
                참고구간을 벗어난 항목이 없어요.
              </p>
            ) : (
              <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                {flagged.map((f) => (
                  <FlaggedCard
                    key={f.analyte.code}
                    flagged={f}
                    cross={crossNotes.filter((c) => c.analyte.code === f.analyte.code)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Sheet>

      {/* ── 구획별 전 항목 ──────────────────────────────── */}
      <Sheet
        tone="tint"
        eyebrow="BY PANEL"
        headline="항목별로 보기"
        lead={rows === null ? undefined : `기록에 값이 있는 항목 ${codes.length}개예요.`}
      >
        {codes.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: "8px 14px", fontSize: 13 }}
              onClick={() => setOpen(allOpen ? new Set() : new Set(codes))}
            >
              {allOpen ? "모두 접기" : "모두 펼치기"}
            </button>

            {panels.map((p) => (
              <div key={p.key} style={{ marginTop: 18 }}>
                <p className="eyebrow" style={{ margin: "0 0 2px" }}>
                  {p.label} · {p.analytes.length}
                </p>
                {p.analytes.map((a) => (
                  <FieldRow
                    key={a.code}
                    field={{
                      path: a.code,
                      label: a.label,
                      unit: a.unit,
                      lowerIsBetter: a.lowerIsBetter,
                    }}
                    points={pointsOf(rows, a.code)}
                    open={open.has(a.code)}
                    onToggle={() => toggle(a.code)}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : rows !== null ? (
          <p className="lead">아직 기록이 없어요.</p>
        ) : null}
      </Sheet>

      {/* ── 공통 안내 ───────────────────────────────────── */}
      {latest ? (
        <Sheet eyebrow="HOW TO READ" headline="수치를 읽을 때">
          <div style={{ marginTop: 16 }}>
            <EvidenceLegend />
            <GuidanceList items={commonGuidance()} />
            <p className="field-hint" style={{ marginTop: 14, lineHeight: 1.7 }}>
              이 화면은 기록을 읽고 생활 습관을 안내하는 데까지예요. 진단이나 처방은 하지
              않아요. 값이 이어서 벗어나거나 몸에 이상이 느껴지면 진료를 받아보세요.
            </p>
          </div>
        </Sheet>
      ) : null}

      {/* ── 원본 목록 ───────────────────────────────────── */}
      <Sheet eyebrow="RECORDS" headline="등록된 결과지">
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn--ghost"
            style={{ padding: "8px 14px", fontSize: 13 }}
            onClick={() => setRecordsOpen((v) => !v)}
            aria-expanded={recordsOpen}
          >
            {recordsOpen ? "접기" : `펼쳐보기 (${count}장)`}
            <span
              aria-hidden="true"
              style={{
                marginLeft: 6,
                fontSize: "0.7rem",
                display: "inline-block",
                transform: recordsOpen ? "rotate(180deg)" : "none",
                transition: "transform .15s ease",
              }}
            >
              ▼
            </span>
          </button>

          <Link
            href="/blood/new"
            className="btn btn--primary"
            style={{ padding: "8px 16px", fontSize: 13 }}
          >
            결과지 등록 <span aria-hidden="true">→</span>
          </Link>
        </div>

        {recordsOpen ? (
          <div style={{ marginTop: 18 }}>
            {rows === null ? (
              <p className="lead" style={{ marginTop: 0 }}>
                불러오는 중…
              </p>
            ) : rows.length === 0 ? (
              <p className="lead" style={{ marginTop: 0 }}>
                첫 결과지를 등록하면 여기에 쌓여요.
              </p>
            ) : (
              rows.map((row) => <RecordCard key={row._id} row={row} />)
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

/** 벗어난 항목 한 건 — 값·설명·인바디 교차·권고를 한자리에 */
function FlaggedCard({
  flagged: f,
  cross,
}: {
  flagged: Flagged;
  cross: ReturnType<typeof crossNotesFor>;
}) {
  const [open, setOpen] = useState(false);
  const items = guidanceFor(f.analyte.code, f.status === "low" ? "low" : "high");
  const tone = f.concerning ? "var(--danger)" : "var(--warning)";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-card)",
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{f.analyte.label}</span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: f.concerning ? "var(--danger-subtle)" : "var(--point-subtle)",
            color: tone,
            fontSize: "0.66rem",
            fontWeight: 700,
          }}
        >
          {STATUS_LABELS[f.status]}
        </span>
        {f.repeated ? (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--danger-subtle)",
              color: "var(--danger)",
              fontSize: "0.66rem",
              fontWeight: 700,
            }}
          >
            두 번 연속
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 12 }}>
        <BloodGauge analyte={f.analyte} result={f.result} compact />
      </div>

      <p
        style={{
          margin: "12px 0 0",
          fontSize: "0.82rem",
          lineHeight: 1.7,
          color: "var(--text-secondary)",
        }}
      >
        {f.analyte.explain}
      </p>

      {/* 나이·성별·근육량 보정이 있는 항목이면 알린다 */}
      {f.analyte.adjust?.length ? (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-subtle)",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "0.64rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            읽을 때 함께 볼 것
          </p>
          {f.analyte.adjust.map((a, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "6px 0 0",
                fontSize: "0.78rem",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
              }}
            >
              {a.note}
            </p>
          ))}
        </div>
      ) : null}

      {/* 인바디 기록과 겹쳐야 보이는 맥락 — 이 앱만 할 수 있는 부분 */}
      {cross.map((c, i) => (
        <div
          key={i}
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--point-subtle)",
            borderLeft: "3px solid var(--point)",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "0.64rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--point)",
            }}
          >
            인바디 기록과 함께 보면 · {c.inbodyLabel} {c.inbodyValue}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
            }}
          >
            {c.note}
          </p>
          {c.sourceUrl ? (
            <p style={{ margin: "8px 0 0", fontSize: "0.72rem" }}>
              <a
                href={c.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                {c.sourceName} ↗
              </a>
            </p>
          ) : null}
        </div>
      ))}

      {items.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ padding: "8px 14px", fontSize: 13 }}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "권장사항 접기" : `권장사항 ${items.length}가지 보기`}
            <span
              aria-hidden="true"
              style={{
                marginLeft: 6,
                fontSize: "0.7rem",
                display: "inline-block",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform .15s ease",
              }}
            >
              ▼
            </span>
          </button>

          {open ? (
            <div style={{ marginTop: 14 }}>
              <GuidanceList items={items} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 결과지 한 장 */
function RecordCard({ row }: { row: BloodRow }) {
  const d = new Date(row.testedAt);
  const dateText = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
  const flagged = row.results.filter((r) => r.flag === "H" || r.flag === "L").length;

  return (
    <div style={{ padding: "16px 0", borderTop: "1px solid var(--border-subtle)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>
            {dateText}
          </p>
          <p className="field-hint" style={{ marginTop: 4 }}>
            항목 {row.results.length}개
            {flagged > 0 ? ` · 벗어남 ${flagged}개` : ""}
            {row.lab?.name ? ` · ${row.lab.name}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {row.imageUrl ? (
            <a
              className="pill"
              href={String(row.imageUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              원본
            </a>
          ) : null}
          <Link href={`/blood/${row._id}`} className="pill">
            자세히 →
          </Link>
        </div>
      </div>
    </div>
  );
}

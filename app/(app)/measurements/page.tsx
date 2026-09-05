"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { BodyRadar } from "@/components/BodyRadar";
import { FieldRow, toPoints, type Row } from "@/components/TrendChart";
import { loadSession, type SessionUser } from "@/lib/session";
import { useProfile } from "@/lib/useProfile";
import {
  FIELDS,
  PRIMARY_FIELDS,
  buildRadarAxes,
  groupFields,
  pick,
} from "@/lib/inbody";
import { flaggedFields, knowledgeOf, type InbodyFlag } from "@/lib/inbodyKnowledge";
import { inbodyCommonGuidance, inbodyGuidanceFor } from "@/lib/inbodyGuidance";
import { EvidenceLegend, GuidanceList } from "@/components/GuidanceList";

/**
 * Inbody — 기록을 읽는 화면 하나.
 *
 * 예전에는 목록(Inbody)과 추이(History)가 나뉘어 있었는데 둘 다 같은 기록을
 * 보는 일이라 오가야 했다. 지금은 **해석이 먼저, 원본 목록이 나중**이다.
 *
 *   최근 상태(레이더) → 항목별 추이 → 등록된 결과지(접어둠)
 *
 * 결과지 등록 버튼은 맨 위와 결과지 목록 옆, 두 곳에 둔다.
 */
export default function InbodyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const { profile } = useProfile(session?.id);
  const [rows, setRows] = useState<Row[] | null>(null);
  /** 항목별 보기에서 펼쳐진 항목 */
  const [open, setOpen] = useState<Set<string>>(new Set());
  /** 핵심 3종 추이에서 펼쳐진 항목 */
  const [trendOpen, setTrendOpen] = useState<Set<string>>(new Set());
  /** 등록된 결과지 목록 펼침 */
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
    const res = await fetch(
      `/api/measurements?userId=${encodeURIComponent(session.id)}`,
    );
    const json = (await res.json()) as { ok: boolean; measurements?: Row[] };
    setRows(json.measurements ?? []);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 값이 하나라도 있는 항목만 보여준다 (기종마다 인쇄 항목이 다르다) */
  const available = useMemo(() => {
    if (!rows) return [];
    return FIELDS.filter((f) => rows.some((r) => pick(r, f.path) != null));
  }, [rows]);

  /** 레이더는 가장 최근 기록 하나만 쓴다 */
  const latest = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return rows.reduce((a, b) =>
      new Date(b.measuredAt).getTime() > new Date(a.measuredAt).getTime() ? b : a,
    );
  }, [rows]);

  const radarAxes = useMemo(
    () =>
      latest
        ? buildRadarAxes(latest, {
            heightCm: profile?.heightCm ?? null,
            gender: profile?.gender ?? null,
          })
        : [],
    [latest, profile],
  );

  /** 직전 기록 — 두 번 연속 벗어났는지 보려고 쓴다 */
  const previous = useMemo(() => {
    if (!rows || rows.length < 2) return null;
    const sorted = [...rows].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    );
    return sorted[1] ?? null;
  }, [rows]);

  /**
   * 표준범위를 벗어난 항목.
   * 표준범위는 이미 저장하고 있었는데 모아주지 않아서, 36개를 다 훑어야 했다.
   */
  const flagged = useMemo(
    () => flaggedFields(latest, previous, { gender: profile?.gender ?? null }),
    [latest, previous, profile],
  );

  /** 구획(체성분분석 · 비만분석 …)으로 묶어 보여준다 */
  const groups = useMemo(() => groupFields(available), [available]);

  const toggle = (path: string) => setOpen((prev) => toggled(prev, path));
  const toggleTrend = (path: string) => setTrendOpen((prev) => toggled(prev, path));

  const allOpen = available.length > 0 && open.size === available.length;
  const count = rows?.length ?? 0;

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="INBODY"
        headline={
          <>
            쌓인 기록이
            <br />
            보여주는 변화
          </>
        }
        lead="최근 상태를 먼저 보고, 항목을 펼쳐 흐름을 확인해요."
      >
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/measurements/new" className="btn btn--primary">
            결과지 등록 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Sheet>

      <Sheet
        eyebrow="MAIN"
        headline="핵심 3종"
        lead={latest ? "가장 최근 기록을 적정 범위와 겹쳐 봤어요." : undefined}
      >
        <div style={{ marginTop: 18 }}>
          {latest ? (
            <BodyRadar axes={radarAxes} measuredAt={fmtDate(latest.measuredAt)} />
          ) : rows !== null ? (
            <p className="lead">아직 기록이 없어요.</p>
          ) : null}
        </div>

        {/* 레이더는 최근 한 장면만 보여주니, 흐름은 아래에서 펼쳐 본다 */}
        {latest ? (
          <div style={{ marginTop: 22 }}>
            <p className="field-label" style={{ marginBottom: 6 }}>
              추이 그래프
            </p>
            {PRIMARY_FIELDS.map((f) => (
              <FieldRow
                key={f.path}
                field={f}
                points={toPoints(rows, f.path)}
                open={trendOpen.has(f.path)}
                onToggle={() => toggleTrend(f.path)}
                note={knowledgeOf(f.path)?.explain}
              />
            ))}
          </div>
        ) : null}

        {/* 이번에 표준범위를 벗어난 항목 — 36개를 다 훑지 않아도 된다 */}
        {latest ? (
          <div style={{ marginTop: 30 }}>
            <p className="eyebrow" style={{ margin: "0 0 2px" }}>
              이번에 벗어난 항목 · {flagged.length}
            </p>
            {flagged.length === 0 ? (
              <p className="lead" style={{ marginTop: 8 }}>
                표준범위를 벗어난 항목이 없어요.
              </p>
            ) : (
              <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                {flagged.map((f) => (
                  <InbodyFlagCard key={f.field.path} flag={f} />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        tone="tint"
        eyebrow="BY FIELD"
        headline="항목별로 보기"
        lead={
          rows === null
            ? undefined
            : `기록에 값이 있는 항목 ${available.length}개예요.`
        }
      >
        {available.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: "8px 14px", fontSize: 13 }}
              onClick={() =>
                setOpen(allOpen ? new Set() : new Set(available.map((f) => f.path)))
              }
            >
              {allOpen ? "모두 접기" : "모두 펼치기"}
            </button>

            {groups.map((g) => (
              <div key={g.key} style={{ marginTop: 18 }}>
                <p className="eyebrow" style={{ margin: "0 0 2px" }}>
                  {g.label} · {g.fields.length}
                </p>
                {g.fields.map((f) => (
                  <FieldRow
                    key={f.path}
                    field={f}
                    points={toPoints(rows, f.path)}
                    open={open.has(f.path)}
                    onToggle={() => toggle(f.path)}
                    note={knowledgeOf(f.path)?.explain}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : rows !== null ? (
          <p className="lead">아직 기록이 없어요.</p>
        ) : null}
      </Sheet>

      {/* 인바디 값을 읽을 때의 원칙 — 측정 방법이 곧 기준을 정한다 */}
      {latest ? (
        <Sheet eyebrow="HOW TO READ" headline="수치를 읽을 때">
          <div style={{ marginTop: 16 }}>
            <EvidenceLegend />
            <GuidanceList items={inbodyCommonGuidance()} />
            <p className="field-hint" style={{ marginTop: 14, lineHeight: 1.7 }}>
              이 화면은 기록을 읽고 생활 습관을 안내하는 데까지예요. 진단이나 처방은 하지
              않아요. 몸에 이상이 느껴지면 진료를 받아보세요.
            </p>
          </div>
        </Sheet>
      ) : null}

      {/* 원본 목록 — 평소에는 접어두고 필요할 때 펼친다 */}
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
            href="/measurements/new"
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
              rows.map((row, i) => (
                <RecordCard key={row._id} row={row} prev={rows[i + 1]} />
              ))
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}


/**
 * 표준범위를 벗어난 항목 한 건.
 * 값 · 무엇인지 · 어떻게 읽을지 · 무엇을 해볼지를 한자리에 둔다.
 * 피검사의 같은 카드와 모양을 맞춰, 탭을 오가도 같은 앱으로 읽히게 한다.
 */
function InbodyFlagCard({ flag: f }: { flag: InbodyFlag }) {
  const [open, setOpen] = useState(false);
  const items = inbodyGuidanceFor(f.field.path, f.status);
  const tone = f.concerning ? "var(--danger)" : "var(--warning)";

  const rangeText =
    f.low != null && f.high != null
      ? `${f.low} ~ ${f.high}`
      : f.high != null
        ? `${f.high} 이하`
        : f.low != null
          ? `${f.low} 이상`
          : "";

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
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{f.field.label}</span>
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
          {f.status === "high" ? "표준 이상" : "표준 이하"}
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

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          표준 {rangeText}
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontSize: "1.3rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              color: tone,
            }}
          >
            {f.value}
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
            {f.field.unit}
          </span>
        </span>
      </div>

      {/*
        판정에 쓴 기준이 결과지에서 온 게 아니면 밝힌다.
        기준 이름을 문장 안에 넣으면 조사가 어긋난다("…갈려요)으로 표시했어요").
        그래서 문장과 기준을 줄로 나눈다.
      */}
      {!f.printed ? (
        <div style={{ marginTop: 8 }}>
          <p className="field-hint" style={{ margin: 0, fontSize: "0.68rem" }}>
            결과지에 표준범위가 없어 일반 기준으로 표시했어요.
          </p>
          <p className="field-hint" style={{ margin: "2px 0 0", fontSize: "0.68rem" }}>
            기준 · {f.rangeLabel ?? "—"}
            {f.rangeSource
              ? f.rangeSource.url
                ? " · "
                : ` · ${f.rangeSource.name}`
              : ""}
            {f.rangeSource?.url ? (
              <a
                href={f.rangeSource.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                {f.rangeSource.name} ↗
              </a>
            ) : null}
          </p>
        </div>
      ) : null}

      {f.knowledge?.explain ? (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "0.82rem",
            lineHeight: 1.7,
            color: "var(--text-secondary)",
          }}
        >
          {f.knowledge.explain.replace(/\*\*/g, "")}
        </p>
      ) : null}

      {f.knowledge?.adjust?.length ? (
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
          {f.knowledge.adjust.map((a, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "6px 0 0",
                fontSize: "0.78rem",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
              }}
            >
              {a.note.replace(/\*\*/g, "")}
            </p>
          ))}
        </div>
      ) : null}

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

/** Set 토글 (원본을 건드리지 않는다) */
function toggled(prev: Set<string>, path: string): Set<string> {
  const next = new Set(prev);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

const KEYS: Array<{ path: string; label: string; unit: string; lowerBetter?: boolean }> = [
  { path: "composition.weight.value", label: "체중", unit: "kg" },
  { path: "muscleFat.skeletalMuscleMass.value", label: "골격근량", unit: "kg" },
  { path: "obesity.percentBodyFat.value", label: "체지방률", unit: "%", lowerBetter: true },
];

/** 결과지 한 장 — 직전 기록 대비 변화를 함께 보여준다 */
function RecordCard({ row, prev }: { row: Row; prev?: Row }) {
  const date = new Date(row.measuredAt);
  const dateText = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
  const device = (row.device as { model?: string } | undefined)?.model ?? null;

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
          {device ? (
            <p className="field-hint" style={{ marginTop: 4 }}>
              {device}
            </p>
          ) : null}
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
          <Link href={`/measurements/${row._id}`} className="pill">
            자세히 →
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginTop: 14,
        }}
      >
        {KEYS.map((k) => {
          const v = pick(row, k.path);
          const p = prev ? pick(prev, k.path) : null;
          const diff = v != null && p != null ? Number((v - p).toFixed(1)) : null;
          const good =
            diff == null || diff === 0
              ? null
              : k.lowerBetter
                ? diff < 0
                : diff > 0;
          return (
            <div key={k.path} style={{ textAlign: "center" }}>
              <p className="field-hint" style={{ margin: 0 }}>
                {k.label}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                {v ?? "—"}
                <span style={{ fontSize: "0.7rem", marginLeft: 2 }}>{k.unit}</span>
              </p>
              {diff != null && diff !== 0 ? (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: good ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {diff > 0 ? "+" : ""}
                  {diff}
                </p>
              ) : (
                <p className="field-hint" style={{ margin: "2px 0 0" }}>
                  —
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import {
  FIELDS,
  SEGMENT_LABELS,
  groupFields,
  pick,
  type FieldDef,
  type SegmentKey,
} from "@/lib/inbody";

type Row = Record<string, unknown> & { _id: string; measuredAt: string };

/**
 * 측정 상세.
 * 결과지에 인쇄된 표준범위가 있으면 막대로 그려 위치를 보여준다.
 */
export default function MeasurementDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  const load = useCallback(async () => {
    if (!session || !params?.id) return;
    const res = await fetch(
      `/api/measurements/${params.id}?userId=${encodeURIComponent(session.id)}`,
    );
    const json = (await res.json()) as { ok: boolean; measurement?: Row; error?: string };
    if (!json.ok || !json.measurement) {
      setMsg(json.error ?? "기록을 불러오지 못했어요.");
      return;
    }
    setRow(json.measurement);
  }, [session, params]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!session || !params?.id) return;
    if (!confirm("이 기록을 삭제할까요?")) return;
    await fetch(
      `/api/measurements/${params.id}?userId=${encodeURIComponent(session.id)}`,
      { method: "DELETE" },
    );
    router.push("/measurements");
  };

  if (msg) {
    return (
      <Sheet center eyebrow="ERROR" headline="기록을 찾을 수 없어요" lead={msg} />
    );
  }
  if (!row) {
    return (
      <Sheet>
        <p className="lead" style={{ marginTop: 0 }}>
          불러오는 중…
        </p>
      </Sheet>
    );
  }

  const date = new Date(row.measuredAt);
  const dateText = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
  const device = row.device as { model?: string; place?: string } | undefined;
  const etc = (row.etc ?? []) as Array<{ label: string; value: string; unit?: string }>;
  const imageUrl = row.imageUrl as string | null;

  const shown = FIELDS.filter((f) => pick(row, f.path) != null);
  /** 결과지의 분석 구획대로 묶어 보여준다 */
  const groups = groupFields(shown);

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="RECORD"
        headline={dateText}
        lead={
          [device?.model, device?.place].filter(Boolean).join(" · ") ||
          "측정 기록"
        }
      />

      {groups.map((g) => (
        <Sheet key={g.key} eyebrow="VALUES" headline={g.label}>
          <div style={{ marginTop: 16 }}>
            {g.fields.map((f) => (
              <ValueRow key={f.path} row={row} field={f} />
            ))}
          </div>
        </Sheet>
      ))}

      <SegmentalDetail row={row} />

      {etc.length > 0 ? (
        <Sheet
          tone="tint"
          eyebrow="ETC"
          headline="그 밖의 항목"
          lead="결과지에는 있지만 아직 정식 항목이 아닌 값이에요."
        >
          <div style={{ marginTop: 16 }}>
            {etc.map((e, i) => (
              <div
                key={`${e.label}-${i}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "9px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>{e.label}</span>
                <span>
                  {e.value}
                  {e.unit ? ` ${e.unit}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Sheet>
      ) : null}

      <Sheet eyebrow="ORIGINAL" headline="원본 결과지">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="인바디 결과지 원본"
              style={{
                width: "100%",
                marginTop: 16,
                borderRadius: 14,
                border: "1px solid var(--border)",
              }}
            />
            <p className="field-hint" style={{ marginTop: 8, wordBreak: "break-all" }}>
              <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                {imageUrl}
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="lead">
              이 기록에는 원본 사진이 없어요. 등록할 때 보관에 실패했거나 체중만
              입력한 기록이에요.
            </p>
            <Link
              href={`/measurements/${row._id}/edit`}
              className="btn btn--ghost"
              style={{ marginTop: 14, padding: "8px 14px", fontSize: 13 }}
            >
              원본 사진 첨부하기 →
            </Link>
          </>
        )}
      </Sheet>

      <Sheet>
        <Link
          href={`/measurements/${row._id}/edit`}
          className="btn btn--primary btn--block"
        >
          이 기록 수정 <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/measurements"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10 }}
        >
          목록으로
        </Link>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10, color: "var(--danger)" }}
          onClick={() => void remove()}
        >
          이 기록 삭제
        </button>
      </Sheet>
    </div>
  );
}

/** 값 한 줄 — 결과지에 인쇄된 표준범위가 있으면 막대로 위치를 보여준다 */
function ValueRow({ row, field }: { row: Row; field: FieldDef }) {
  const value = pick(row, field.path);
  const base = field.path.replace(/\.value$/, "");
  const min = pick(row, `${base}.min`);
  const max = pick(row, `${base}.max`);
  const inRange =
    min != null && max != null && value != null ? value >= min && value <= max : null;
  const ratio =
    min != null && max != null && value != null && max > min
      ? Math.min(1, Math.max(0, (value - min) / (max - min)))
      : null;

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          {field.label}
        </span>
        <span style={{ fontWeight: 700 }}>
          {value}
          <span style={{ fontSize: "0.7rem", marginLeft: 3 }}>{field.unit}</span>
        </span>
      </div>

      {ratio != null ? (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              position: "relative",
              height: 5,
              borderRadius: 999,
              background: "var(--accent-subtle)",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: `calc(${ratio * 100}% - 4px)`,
                top: -2,
                width: 9,
                height: 9,
                borderRadius: 999,
                background: inRange ? "var(--accent)" : "var(--point)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            <span>{min}</span>
            <span>표준범위</span>
            <span>{max}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SegmentalDetail({ row }: { row: Row }) {
  const seg = (row.segmental ?? {}) as Record<
    string,
    Record<string, { kg?: number | null; percent?: number | null; grade?: string | null }>
  >;
  const groups: Array<[string, string]> = [
    ["lean", "부위별 근육"],
    ["fat", "부위별 지방"],
  ];
  const has = groups.some(([k]) =>
    Object.values(seg[k] ?? {}).some(
      (v) => v && (v.kg != null || v.percent != null || v.grade),
    ),
  );
  if (!has) return null;

  return (
    <Sheet eyebrow="SEGMENTAL" headline="부위별">
      <div style={{ marginTop: 16 }}>
        {groups.map(([key, label]) => {
          const rows = seg[key] ?? {};
          const any = Object.values(rows).some(
            (v) => v && (v.kg != null || v.percent != null || v.grade),
          );
          if (!any) return null;
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <p className="field-label">{label}</p>
              {(Object.keys(SEGMENT_LABELS) as SegmentKey[]).map((s) => {
                const v = rows[s];
                if (!v) return null;
                const text = [
                  v.kg != null ? `${v.kg}kg` : null,
                  v.percent != null ? `${v.percent}%` : null,
                  v.grade ?? null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                if (!text) return null;
                return (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 0",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      {SEGMENT_LABELS[s]}
                    </span>
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

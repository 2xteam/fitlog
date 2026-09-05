"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { BloodGauge } from "@/components/BloodGauge";
import { showToast } from "@/components/Toast";
import { loadSession } from "@/lib/session";
import { NoteEditor } from "@/components/RecordNote";
import { groupByPanel } from "@/lib/bloodCatalog";
import { type BloodRow } from "@/lib/blood";

/**
 * 결과지 한 장의 상세.
 *
 * 목록 화면(`/blood`)은 여러 회차를 가로질러 추이를 보는 곳이고,
 * 여기는 **그날 결과지 한 장을 그대로 다시 보는** 곳이다.
 * 그래서 인쇄된 참고치와 판정을 그대로 보여준다.
 */
export default function BloodDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<BloodRow | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = loadSession();
      if (!s) {
        router.replace("/");
        return;
      }
      setUserId(s.id);
      const res = await fetch(
        `/api/blood/${params.id}?userId=${encodeURIComponent(s.id)}`,
      );
      const json = (await res.json()) as { ok?: boolean; test?: BloodRow };
      if (!res.ok || !json.ok || !json.test) {
        setState("missing");
        return;
      }
      setRow(json.test);
      setState("ok");
    })();
  }, [params.id, router]);

  const panels = useMemo(() => {
    if (!row) return [];
    const codes = row.results.filter((r) => r.code).map((r) => r.code as string);
    return groupByPanel(codes);
  }, [row]);

  async function remove() {
    if (!row || !userId) return;
    if (!window.confirm("이 결과지 기록을 지울까요? 되돌릴 수 없어요.")) return;
    const res = await fetch(
      `/api/blood/${row._id}?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      showToast("삭제하지 못했어요.", "err");
      return;
    }
    showToast("삭제했어요.");
    router.push("/blood");
  }

  if (state === "loading") return null;

  if (state === "missing" || !row) {
    return (
      <Sheet eyebrow="BLOOD" headline="기록을 찾을 수 없어요">
        <div style={{ marginTop: 18 }}>
          <Link href="/blood" className="btn btn--ghost">
            ← Blood
          </Link>
        </div>
      </Sheet>
    );
  }

  const d = new Date(row.testedAt);
  const dateText = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
  const unmatched = row.results.filter((r) => !r.code);

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow={dateText}
        headline="검사 결과"
        lead={
          [row.lab?.name, row.lab?.clinic].filter(Boolean).join(" · ") ||
          `항목 ${row.results.length}개`
        }
      >
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/blood" className="btn btn--ghost">
            ← Blood
          </Link>
          {row.imageUrl ? (
            <a
              className="btn btn--ghost"
              href={String(row.imageUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              원본 보기
            </a>
          ) : null}
        </div>
      </Sheet>

      {panels.map((p) => (
        <Sheet key={p.key} eyebrow={p.label.toUpperCase()} headline={p.label}>
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 22,
            }}
          >
            {p.analytes.map((a) => {
              const r = row.results.find((x) => x.code === a.code);
              if (!r) return null;
              return <BloodGauge key={a.code} analyte={a} result={r} />;
            })}
          </div>
        </Sheet>
      ))}

      {/* 카탈로그에 없는 항목 — 해설은 못 붙이지만 값은 그대로 보관한다 */}
      {unmatched.length > 0 || (row.etc?.length ?? 0) > 0 ? (
        <Sheet tone="tint" eyebrow="OTHER" headline="그 밖의 항목">
          <p className="lead" style={{ marginTop: 8 }}>
            아직 해설을 붙이지 못한 항목이에요. 값은 그대로 보관돼요.
          </p>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {unmatched.map((r, i) => (
              <Line
                key={`u-${i}`}
                label={r.name}
                value={r.value != null ? String(r.value) : "—"}
                unit={r.unit ?? ""}
                ref2={r.refText ?? null}
              />
            ))}
            {(row.etc ?? []).map((e, i) => (
              <Line
                key={`e-${i}`}
                label={e.label}
                value={e.value ?? "—"}
                unit={e.unit ?? ""}
                ref2={null}
              />
            ))}
          </div>
        </Sheet>
      ) : null}

      <Sheet tone="tint" eyebrow="NOTE" headline="메모">
        <p className="lead" style={{ marginTop: 8 }}>
          그날의 검사 조건이나 컨디션을 적어두면 다음에 값을 읽을 때 도움이 돼요.
        </p>
        <div style={{ marginTop: 16 }}>
          {userId ? (
            <NoteEditor
              apiPath={`/api/blood/${row._id}`}
              userId={userId}
              initial={row.note ?? null}
            />
          ) : null}
        </div>
      </Sheet>

      <Sheet eyebrow="MANAGE" headline="이 기록">
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void remove()}
            style={{ color: "var(--danger)" }}
          >
            삭제
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: 12 }}>
          같은 날짜로 결과지를 다시 등록하면 이 기록이 교체돼요.
        </p>
      </Sheet>
    </div>
  );
}

function Line({
  label,
  value,
  unit,
  ref2,
}: {
  label: string;
  value: string;
  unit: string;
  ref2: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        {ref2 ? (
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{ref2}</span>
        ) : null}
        <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {value}
          <span style={{ fontSize: "0.68rem", marginLeft: 3, fontWeight: 400 }}>{unit}</span>
        </span>
      </span>
    </div>
  );
}

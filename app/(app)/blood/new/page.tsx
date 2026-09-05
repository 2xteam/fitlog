"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { showToast } from "@/components/Toast";
import { loadSession, type SessionUser } from "@/lib/session";
import { checkUploadSize, shrinkImageForUpload } from "@/lib/clientImageResize";
import { matchAnalyte } from "@/lib/bloodCatalog";
import type { ResultLike } from "@/lib/blood";

/**
 * 결과지 등록 — 사진 → 추출 → **검토** → 저장.
 *
 * 자동 저장하지 않는다. Vision은 숫자를 잘못 읽을 수 있고, 피검사는 값 하나가
 * 통째로 다른 뜻이 된다. 인바디와 같은 원칙이다.
 *
 * 여러 장을 한 번에 올릴 수 있다 — 결과지는 보통 2장 이상으로 나뉘어 인쇄되고,
 * 두 장이 **같은 검사의 앞뒤**인 경우가 많다. 그래서 같은 날짜면 항목을 합친다.
 */

type Draft = {
  testedAt: string;
  lab: { name: string | null; clinic: string | null; receiptNo: string | null };
  results: ResultLike[];
  etc: Array<{ label: string; value: string | null; unit: string | null; refText: string | null }>;
  warnings: Array<{ code: string; message: string }>;
  imageUrl: string | null;
  imageError: string | null;
  model: string | null;
};

export default function NewBloodPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0 || !session) return;
    setBusy(true);
    setProgress(null);

    const merged: Draft = {
      testedAt: "",
      lab: { name: null, clinic: null, receiptNo: null },
      results: [],
      etc: [],
      warnings: [],
      imageUrl: null,
      imageError: null,
      model: null,
    };

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`${i + 1} / ${files.length}장 읽는 중…`);

        let file = files[i];
        const size = checkUploadSize(file);
        if (!size.ok) {
          file = await shrinkImageForUpload(file);
        }

        const form = new FormData();
        form.append("image", file);
        form.append("userId", session.id);

        const res = await fetch("/api/blood/extract", { method: "POST", body: form });
        const json = (await res.json()) as Record<string, unknown>;

        if (!res.ok || !json.ok) {
          showToast(String(json.error ?? "결과지를 읽지 못했어요."), "err");
          continue;
        }

        // 같은 검사의 앞뒤 장이면 항목을 합친다. 이미 있는 항목은 덮지 않는다.
        const incoming = (json.results ?? []) as ResultLike[];
        for (const r of incoming) {
          const dup = merged.results.some(
            (x) => (x.code && x.code === r.code) || x.name === r.name,
          );
          if (!dup) merged.results.push(r);
        }
        const incomingEtc = (json.etc ?? []) as Draft["etc"];
        for (const e of incomingEtc) {
          if (!merged.etc.some((x) => x.label === e.label)) merged.etc.push(e);
        }

        if (!merged.testedAt && json.testedAt) merged.testedAt = String(json.testedAt);
        const lab = (json.lab ?? {}) as Draft["lab"];
        merged.lab.name ??= lab.name ?? null;
        merged.lab.clinic ??= lab.clinic ?? null;
        merged.lab.receiptNo ??= lab.receiptNo ?? null;
        merged.imageUrl ??= (json.imageUrl as string) ?? null;
        merged.imageError ??= (json.imageError as string) ?? null;
        merged.model ??= (json.model as string) ?? null;
        merged.warnings.push(...((json.warnings ?? []) as Draft["warnings"]));
      }

      if (merged.results.length === 0) {
        showToast("읽어낸 항목이 없어요. 사진이 선명한지 확인해 주세요.", "err");
        return;
      }

      merged.testedAt ||= new Date().toISOString().slice(0, 16);
      setDraft(merged);
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function editResult(index: number, patch: Partial<ResultLike>) {
    setDraft((d) => {
      if (!d) return d;
      const results = d.results.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...d, results };
    });
  }

  function removeResult(index: number) {
    setDraft((d) => (d ? { ...d, results: d.results.filter((_, i) => i !== index) } : d));
  }

  /** etc 줄을 정식 항목으로 승격 — 추출이 이름을 놓쳤을 때 손으로 붙인다 */
  function promote(index: number) {
    setDraft((d) => {
      if (!d) return d;
      const e = d.etc[index];
      const a = matchAnalyte(e.label);
      const value = e.value != null ? Number(e.value) : null;
      const row: ResultLike = {
        code: a?.code ?? null,
        name: e.label,
        value: Number.isFinite(value) ? value : null,
        unit: e.unit ?? a?.unit ?? null,
        refLow: null,
        refHigh: null,
        refText: e.refText ?? null,
        flag: null,
        specimen: null,
      };
      return { ...d, results: [...d.results, row], etc: d.etc.filter((_, i) => i !== index) };
    });
  }

  async function save() {
    if (!draft || !session) return;
    setSaving(true);
    try {
      const res = await fetch("/api/blood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          testedAt: draft.testedAt,
          lab: draft.lab,
          results: draft.results,
          etc: draft.etc,
          imageUrl: draft.imageUrl,
          model: draft.model,
          editedByUser: true,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        showToast(json.error ?? "저장하지 못했어요.", "err");
        return;
      }
      showToast("저장했어요.");
      router.push("/blood");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="NEW"
        headline="결과지 등록"
        lead="검사결과 보고서를 찍어 올리면 항목을 읽어드려요. 저장 전에 직접 확인하실 수 있어요."
      >
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/blood" className="btn btn--ghost">
            ← Blood
          </Link>
        </div>
      </Sheet>

      <Sheet eyebrow="UPLOAD" headline="사진 올리기">
        <p className="lead" style={{ marginTop: 8 }}>
          여러 장을 한 번에 올릴 수 있어요. 결과지가 2장으로 나뉘어 있으면 함께 골라주세요 —
          같은 검사로 합쳐드려요.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void onPick(e.target.files)}
          disabled={busy}
          style={{ marginTop: 16, display: "block", fontSize: 14 }}
        />

        {busy ? (
          <p className="lead" style={{ marginTop: 14 }}>
            {progress ?? "읽는 중…"} 결과지 한 장에 20초쯤 걸려요.
          </p>
        ) : null}
      </Sheet>

      {draft ? (
        <>
          <Sheet
            tone="tint"
            eyebrow="REVIEW"
            headline="확인하고 고치기"
            lead={`항목 ${draft.results.length}개를 읽었어요. 잘못 읽은 값이 있으면 여기서 고쳐주세요.`}
          >
            {draft.warnings.length > 0 ? (
              <div
                style={{
                  marginTop: 14,
                  padding: "14px 16px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--danger-subtle)",
                  borderLeft: "3px solid var(--danger)",
                }}
              >
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.85rem" }}>
                  계산이 맞지 않는 값이 있어요
                </p>
                {draft.warnings.map((w, i) => (
                  <p
                    key={i}
                    style={{
                      margin: i === 0 ? 0 : "6px 0 0",
                      fontSize: "0.8rem",
                      lineHeight: 1.65,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {w.message}
                  </p>
                ))}
              </div>
            ) : null}

            {draft.imageError ? (
              <p className="field-hint" style={{ marginTop: 14 }}>
                {draft.imageError}
              </p>
            ) : null}

            <div style={{ marginTop: 18 }}>
              <label className="field-label" htmlFor="testedAt">
                검체채취일시
              </label>
              <input
                id="testedAt"
                type="datetime-local"
                value={draft.testedAt.slice(0, 16).replace(" ", "T")}
                onChange={(e) => setDraft((d) => (d ? { ...d, testedAt: e.target.value } : d))}
                style={{ display: "block", marginTop: 6 }}
              />
              <p className="field-hint" style={{ marginTop: 6 }}>
                날짜당 1건이에요. 같은 날짜에 기록이 있으면 교체돼요.
              </p>
            </div>

            <div style={{ marginTop: 22, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["검사명", "결과", "단위", "참고치", "판정", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          borderBottom: "1px solid var(--border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draft.results.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td style={cell}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{r.name}</span>
                        {!r.code ? (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: "0.64rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            (해설 없음)
                          </span>
                        ) : null}
                      </td>
                      <td style={cell}>
                        <input
                          type="number"
                          step="any"
                          value={r.value ?? ""}
                          onChange={(e) =>
                            editResult(i, {
                              value: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          style={{ width: 90 }}
                        />
                      </td>
                      <td style={{ ...cell, fontSize: "0.76rem", color: "var(--text-muted)" }}>
                        {r.unit ?? "—"}
                      </td>
                      <td style={{ ...cell, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        {r.refText ?? refLabel(r.refLow ?? null, r.refHigh ?? null) ?? "—"}
                      </td>
                      <td style={cell}>
                        <select
                          value={r.flag ?? ""}
                          onChange={(e) =>
                            editResult(i, {
                              flag: e.target.value === "" ? null : (e.target.value as "H" | "L"),
                            })
                          }
                          style={{ width: 70 }}
                        >
                          <option value="">—</option>
                          <option value="H">H</option>
                          <option value="L">L</option>
                        </select>
                      </td>
                      <td style={cell}>
                        <button
                          type="button"
                          onClick={() => removeResult(i)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                          }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {draft.etc.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <p className="eyebrow" style={{ margin: "0 0 2px" }}>
                  이름을 못 붙인 항목 · {draft.etc.length}
                </p>
                <p className="field-hint" style={{ marginTop: 4 }}>
                  값은 그대로 보관돼요. 아래에서 목록에 넣으면 추이 그래프에도 나와요.
                </p>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {draft.etc.map((e, i) => (
                    <div
                      key={`${e.label}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span style={{ fontSize: "0.8rem" }}>
                        <strong>{e.label}</strong> {e.value ?? "—"} {e.unit ?? ""}
                      </span>
                      <button
                        type="button"
                        className="pill"
                        onClick={() => promote(i)}
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        목록에 넣기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "저장 중…" : "이대로 저장"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
                취소
              </button>
            </div>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--border-subtle)",
  verticalAlign: "middle",
};

function refLabel(low: number | null, high: number | null): string | null {
  if (low != null && high != null) return `${low} ~ ${high}`;
  if (high != null) return `≤ ${high}`;
  if (low != null) return `≥ ${low}`;
  return null;
}

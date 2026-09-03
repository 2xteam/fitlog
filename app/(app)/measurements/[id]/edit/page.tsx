"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import { checkUploadSize, shrinkImageForUpload } from "@/lib/clientImageResize";
import { FIELDS, groupFields } from "@/lib/inbody";

type Row = Record<string, unknown> & { _id: string; measuredAt: string };
type EtcItem = { label: string; value: string; unit?: string };

/** 결과지에 인쇄되지 않는 계산 지표는 손대지 않는다 */
const EDITABLE = FIELDS.filter((f) => !f.path.startsWith("derived"));

/**
 * 등록된 결과지 수정.
 *
 * 추출이 틀렸거나 나중에 손으로 채워 넣을 때 쓴다. 저장(POST)은 날짜 기준
 * upsert라 날짜를 바꾸면 다른 기록을 덮으므로, 여기서는 **이 문서만** 고치는
 * PATCH를 쓴다. 원본 사진이 비어 있는 기록에 나중에 사진만 붙일 수도 있다.
 */
export default function EditMeasurementPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<SessionUser | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [measuredAt, setMeasuredAt] = useState("");
  const [etc, setEtc] = useState<EtcItem[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      setErr(json.error ?? "기록을 불러오지 못했어요.");
      return;
    }
    const m = json.measurement;
    setRow(m);
    setImageUrl((m.imageUrl as string | null) ?? null);
    setEtc(((m.etc ?? []) as EtcItem[]).map((e) => ({ ...e })));

    // 검사일시는 결과지 표기와 같은 모양으로 다룬다
    const d = new Date(m.measuredAt);
    const p2 = (n: number) => String(n).padStart(2, "0");
    setMeasuredAt(
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`,
    );
  }, [session, params]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupFields(EDITABLE), []);

  /* ── 값 편집 ─────────────────────────────── */

  const readPath = (path: string): string => {
    if (!row) return "";
    const parts = path.split(".");
    let cur: unknown = row;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return "";
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "number" ? String(cur) : "";
  };

  /** 표준범위(min·max)는 그대로 두고 value만 바꾼다 */
  const writePath = (path: string, raw: string) => {
    setRow((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as Record<string, unknown>;
      const parts = path.split(".");
      let cur: Record<string, unknown> = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const k = parts[i];
        if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
        cur = cur[k] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = raw === "" ? null : Number(raw);
      return next as Row;
    });
  };

  /* ── 저장 ───────────────────────────────── */

  const save = async () => {
    if (!session || !row || !params?.id) return;
    setBusy("저장 중…");
    setMsg(null);
    try {
      const data: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        if (
          ["_id", "userId", "measuredAt", "measuredDate", "derived", "extraction", "__v", "createdAt", "updatedAt", "imageUrl"].includes(key)
        ) {
          continue;
        }
        data[key] = row[key];
      }
      data.etc = etc
        .filter((e) => e.label.trim() !== "" || String(e.value).trim() !== "")
        .map((e) => ({
          label: e.label.trim(),
          value: String(e.value).trim(),
          unit: e.unit?.trim() || null,
        }));

      const res = await fetch(`/api/measurements/${params.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: session.id, measuredAt, data }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "저장하지 못했어요.");
        return;
      }
      router.push(`/measurements/${params.id}`);
    } catch {
      setMsg("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!session || !params?.id) return;
    if (!confirm("이 기록을 삭제할까요? 되돌릴 수 없어요.")) return;
    await fetch(
      `/api/measurements/${params.id}?userId=${encodeURIComponent(session.id)}`,
      { method: "DELETE" },
    );
    router.push("/measurements");
  };

  /** 원본 사진 첨부 — 값은 건드리지 않고 사진만 채운다 */
  const attachImage = async (file: File) => {
    if (!session || !params?.id) return;
    setBusy("사진 올리는 중…");
    setMsg(null);
    try {
      const shrunk = await shrinkImageForUpload(file);
      const size = checkUploadSize(shrunk);
      if (!size.ok) {
        setMsg(size.error);
        return;
      }
      const form = new FormData();
      form.append("file", shrunk);
      form.append("userId", session.id);
      const res = await fetch(`/api/measurements/${params.id}/image`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        ok: boolean;
        imageUrl?: string;
        warning?: string | null;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.imageUrl) {
        setMsg(json.error ?? "사진을 올리지 못했어요.");
        return;
      }
      setImageUrl(json.imageUrl);
      setMsg(json.warning ?? null);
    } catch {
      setMsg("네트워크 오류로 사진을 올리지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  if (err) {
    return <Sheet center eyebrow="ERROR" headline="기록을 찾을 수 없어요" lead={err} />;
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

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="EDIT"
        headline={
          <>
            읽은 값을
            <br />
            고칠 수 있어요
          </>
        }
        lead="잘못 읽힌 숫자를 바로잡거나, 비어 있는 항목을 채워 넣어요."
      />

      <Sheet eyebrow="MEASURED AT" headline="검사일시">
        <div className="field" style={{ marginTop: 18 }}>
          <input
            className="field-input"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            placeholder="2026-07-04 10:47"
          />
          <p className="field-hint">
            날짜를 바꾸면 그 날짜에 다른 기록이 있는지 먼저 확인해요.
          </p>
        </div>
      </Sheet>

      <Sheet eyebrow="ORIGINAL" headline="원본 결과지">
        <div style={{ marginTop: 16 }}>
          {imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="인바디 결과지 원본"
                style={{
                  width: "100%",
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
            <p className="lead" style={{ marginTop: 0 }}>
              이 기록에는 원본 사진이 없어요. 등록할 때 보관에 실패했거나 체중만
              입력한 기록이에요.
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void attachImage(f);
            }}
          />
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 14 }}
            onClick={() => fileRef.current?.click()}
            disabled={Boolean(busy)}
          >
            {imageUrl ? "다른 사진으로 교체" : "원본 사진 첨부"}
          </button>
        </div>
      </Sheet>

      {groups.map((g) => (
        <Sheet key={g.key} eyebrow="VALUES" headline={g.label}>
          <div style={{ marginTop: 18 }}>
            {g.fields.map((f) => (
              <div className="field" key={f.path}>
                <label className="field-label">
                  {f.label}
                  {f.unit ? ` (${f.unit})` : ""}
                </label>
                <input
                  className="field-input"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={readPath(f.path)}
                  onChange={(e) => writePath(f.path, e.target.value)}
                />
              </div>
            ))}
          </div>
        </Sheet>
      ))}

      <Sheet
        tone="tint"
        eyebrow="ETC"
        headline="그 밖의 항목"
        lead="결과지에는 있지만 아직 정식 항목이 아닌 값이에요."
      >
        <div style={{ marginTop: 16 }}>
          {etc.map((e, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 64px 34px",
                gap: 6,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <input
                className="field-input"
                value={e.label}
                placeholder="항목명"
                onChange={(ev) =>
                  setEtc((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)),
                  )
                }
              />
              <input
                className="field-input"
                value={e.value}
                placeholder="값"
                onChange={(ev) =>
                  setEtc((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)),
                  )
                }
              />
              <input
                className="field-input"
                value={e.unit ?? ""}
                placeholder="단위"
                onChange={(ev) =>
                  setEtc((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, unit: ev.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: "8px 0", fontSize: 13 }}
                aria-label={`${e.label} 삭제`}
                onClick={() => setEtc((prev) => prev.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn--ghost"
            style={{ padding: "8px 14px", fontSize: 13 }}
            onClick={() => setEtc((prev) => [...prev, { label: "", value: "", unit: "" }])}
          >
            + 항목 추가
          </button>
        </div>
      </Sheet>

      <Sheet>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => void save()}
          disabled={Boolean(busy)}
        >
          {busy ?? "수정 내용 저장"}
        </button>

        <Link
          href={`/measurements/${params?.id ?? ""}`}
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10 }}
        >
          취소하고 돌아가기
        </Link>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10, color: "var(--danger)" }}
          onClick={() => void remove()}
          disabled={Boolean(busy)}
        >
          이 기록 삭제
        </button>

        {msg ? (
          <p className="lead" style={{ color: "var(--danger)" }}>
            {msg}
          </p>
        ) : null}

        <div className="note-block">
          <strong>NOTE</strong>
          표준범위(결과지에 인쇄된 최소·최대)는 그대로 두고 측정값만 바꿔요.
          저장하면 정합성 검사와 계산 지표를 다시 계산해요.
        </div>
      </Sheet>
    </div>
  );
}

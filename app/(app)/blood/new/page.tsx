"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { showToast } from "@/components/Toast";
import { NoteField } from "@/components/RecordNote";
import { loadSession, type SessionUser } from "@/lib/session";
import { checkUploadSize, shrinkImageForUpload } from "@/lib/clientImageResize";
import { matchAnalyte } from "@/lib/bloodCatalog";
import type { ResultLike } from "@/lib/blood";

/**
 * 결과지 등록 — 사진 → 추출 → **검토** → 저장.
 *
 * 인바디 등록(`/measurements/new`)과 **같은 흐름**을 쓴다. 화면을 오갈 때 방식이
 * 달라지면 같은 앱으로 읽히지 않는다.
 *
 *   ① upload  여러 장을 한 번에 고른다 → 한 장씩 순차 추출 (진행률 표시)
 *   ② review  **한 회차씩** 확인하고 저장 → 다음 회차로
 *
 * ⚠️ 인바디와 다른 점 하나 — **회차 묶기.**
 * 피검사 결과지는 "1 of 2", "2 of 2"처럼 한 검사가 여러 장에 나뉘어 인쇄된다.
 * 그래서 추출한 장들을 **검사일로 묶는다** — 같은 날짜면 항목을 합쳐 한 회차로,
 * 날짜가 다르면 각각 다른 회차로 둔다.
 *
 * 처음에는 올린 것을 전부 하나로 합치고 한 화면에서 저장했다. 두 회차를 함께
 * 올리면 뒤쪽 날짜가 사라지고 항목이 섞였다. 그리고 업로드 필드 이름이 서버와
 * 달라(`image` vs `file`) **추출 자체가 되지 않았다.**
 */

type Warning = { code: string; message: string };
type EtcRow = { label: string; value: string | null; unit: string | null; refText: string | null };

/** 검토할 회차 하나 (같은 검사일의 여러 장이 합쳐진 결과) */
type QueueItem = {
  fileNames: string[];
  previews: string[];
  testedAt: string;
  lab: { name: string | null; clinic: string | null; receiptNo: string | null };
  results: ResultLike[];
  etc: EtcRow[];
  warnings: Warning[];
  imageUrl: string | null;
  imageError: string | null;
  model: string | null;
  note: string;
};

type FailedItem = { fileName: string; error: string };
type Step = "upload" | "review";

/** 날짜 부분만 — 시각이 달라도 같은 검사로 본다 */
const dayOf = (s: string) => (s || "").slice(0, 10);

export default function NewBloodPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [edited, setEdited] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  const current = queue[index];
  const many = queue.length > 1;

  /* ── 추출 (여러 장 순차 처리) ───────────────── */

  const runExtract = async (files: File[]) => {
    if (!session || files.length === 0) return;
    setMsg(null);
    setFailed([]);

    type Raw = {
      fileName: string;
      preview: string;
      testedAt: string;
      lab: QueueItem["lab"];
      results: ResultLike[];
      etc: EtcRow[];
      warnings: Warning[];
      imageUrl: string | null;
      imageError: string | null;
      model: string | null;
    };

    const done: Raw[] = [];
    const fails: FailedItem[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      const label = files.length > 1 ? `${i + 1}/${files.length} ` : "";

      try {
        setBusy(`${label}이미지를 줄이는 중…`);
        const shrunk = await shrinkImageForUpload(file);
        const sizeCheck = checkUploadSize(shrunk);
        if (!sizeCheck.ok) {
          fails.push({ fileName: file.name, error: sizeCheck.error });
          continue;
        }

        setBusy(`${label}결과지를 읽는 중… (10~20초)`);
        const fd = new FormData();
        // 서버(`lib/readMultipartImage.ts`)가 읽는 이름은 `file` 이다
        fd.set("file", shrunk);
        fd.set("userId", session.id);

        const res = await fetch("/api/blood/extract", { method: "POST", body: fd });
        const json = (await res.json()) as Record<string, unknown>;

        if (!res.ok || !json.ok) {
          fails.push({
            fileName: file.name,
            error: String(json.error ?? "분석에 실패했어요."),
          });
          continue;
        }

        const results = (json.results ?? []) as ResultLike[];
        if (results.length === 0) {
          fails.push({ fileName: file.name, error: "읽어낸 항목이 없어요." });
          continue;
        }

        done.push({
          fileName: file.name,
          preview: URL.createObjectURL(shrunk),
          testedAt: String(json.testedAt ?? ""),
          lab: (json.lab ?? {}) as QueueItem["lab"],
          results,
          etc: (json.etc ?? []) as EtcRow[],
          warnings: (json.warnings ?? []) as Warning[],
          imageUrl: (json.imageUrl as string) ?? null,
          imageError: (json.imageError as string) ?? null,
          model: (json.model as string) ?? null,
        });
      } catch {
        fails.push({ fileName: file.name, error: "네트워크 오류예요." });
      }
    }

    setBusy(null);
    setFailed(fails);

    if (done.length === 0) {
      setMsg("읽어낸 결과지가 없어요. 사진이 선명한지 확인해 주세요.");
      return;
    }

    /*
      검사일로 묶는다. "1 of 2"·"2 of 2"는 같은 날짜라 한 회차로 합쳐지고,
      날짜가 다르면 각각 다른 회차가 된다. 날짜를 못 읽은 장은 따로 둔다 —
      임의로 다른 회차에 붙이면 엉뚱한 날 기록을 덮어쓴다.
    */
    const groups = new Map<string, QueueItem>();
    let noDate = 0;

    for (const r of done) {
      const key = dayOf(r.testedAt) || `__unknown-${noDate++}`;
      const g = groups.get(key);

      if (!g) {
        groups.set(key, {
          fileNames: [r.fileName],
          previews: [r.preview],
          testedAt: r.testedAt || new Date().toISOString().slice(0, 16).replace("T", " "),
          lab: { ...r.lab },
          results: [...r.results],
          etc: [...r.etc],
          warnings: [...r.warnings],
          imageUrl: r.imageUrl,
          imageError: r.imageError,
          model: r.model,
          note: "",
        });
        continue;
      }

      // 같은 회차의 다른 장 — 없는 항목만 더한다 (먼저 읽은 값을 덮지 않는다)
      g.fileNames.push(r.fileName);
      g.previews.push(r.preview);
      for (const row of r.results) {
        const dup = g.results.some(
          (x) => (x.code && x.code === row.code) || x.name === row.name,
        );
        if (!dup) g.results.push(row);
      }
      for (const e of r.etc) {
        if (!g.etc.some((x) => x.label === e.label)) g.etc.push(e);
      }
      g.warnings.push(...r.warnings);
      g.lab.name ??= r.lab.name;
      g.lab.clinic ??= r.lab.clinic;
      g.lab.receiptNo ??= r.lab.receiptNo;
      g.imageUrl ??= r.imageUrl;
      g.imageError ??= r.imageError;
      g.model ??= r.model;
    }

    // 오래된 회차부터 검토한다 (인바디와 같은 순서)
    const list = [...groups.values()].sort((a, b) => a.testedAt.localeCompare(b.testedAt));

    setQueue(list);
    setIndex(0);
    setEdited(false);
    setStep("review");
  };

  /* ── 값 편집 ─────────────────────────────── */

  const patchCurrent = (patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const editResult = (row: number, patch: Partial<ResultLike>) => {
    setEdited(true);
    setQueue((prev) =>
      prev.map((q, i) =>
        i === index
          ? { ...q, results: q.results.map((r, j) => (j === row ? { ...r, ...patch } : r)) }
          : q,
      ),
    );
  };

  const removeResult = (row: number) => {
    setEdited(true);
    setQueue((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, results: q.results.filter((_, j) => j !== row) } : q,
      ),
    );
  };

  /** etc 줄을 정식 항목으로 승격 — 추출이 이름을 놓쳤을 때 손으로 붙인다 */
  const promote = (row: number) => {
    setEdited(true);
    setQueue((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        const e = q.etc[row]!;
        const a = matchAnalyte(e.label);
        const value = e.value != null ? Number(e.value) : null;
        return {
          ...q,
          results: [
            ...q.results,
            {
              code: a?.code ?? null,
              name: e.label,
              value: Number.isFinite(value) ? value : null,
              unit: e.unit ?? a?.unit ?? null,
              refLow: null,
              refHigh: null,
              refText: e.refText ?? null,
              flag: null,
              specimen: null,
            },
          ],
          etc: q.etc.filter((_, j) => j !== row),
        };
      }),
    );
  };

  /* ── 저장 ───────────────────────────────── */

  const goNext = (saved: boolean) => {
    if (saved) setSavedCount((n) => n + 1);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setEdited(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      router.push("/blood");
    }
  };

  const save = async () => {
    if (!session || !current) return;
    setBusy("저장 중…");
    setMsg(null);
    try {
      const res = await fetch("/api/blood", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          testedAt: current.testedAt,
          lab: current.lab,
          results: current.results,
          etc: current.etc,
          note: current.note.trim() || null,
          imageUrl: current.imageUrl,
          model: current.model,
          editedByUser: edited,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "저장에 실패했어요.");
        return;
      }
      showToast(many ? `${index + 1}번째 회차를 저장했어요.` : "저장했어요.");
      goNext(true);
    } catch {
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setStep("upload");
    setQueue([]);
    setFailed([]);
    setIndex(0);
    setSavedCount(0);
    setMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const warned = useMemo(
    () => new Set((current?.warnings ?? []).map((w) => w.code)),
    [current],
  );

  /* ── ① 업로드 ──────────────────────────── */

  if (step === "upload") {
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
            여러 장을 한 번에 고를 수 있어요. 한 검사가 2장으로 나뉘어 있으면 함께
            골라주세요 — <strong>검사일이 같으면 한 회차로 합쳐</strong> 드려요.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void runExtract(Array.from(e.target.files ?? []))}
            disabled={Boolean(busy)}
            style={{ marginTop: 16, display: "block", fontSize: 14 }}
          />

          {busy ? (
            <p className="lead" style={{ marginTop: 14 }}>
              {busy}
            </p>
          ) : null}

          {msg ? (
            <p className="lead" style={{ marginTop: 14, color: "var(--danger)" }}>
              {msg}
            </p>
          ) : null}

          {failed.length > 0 ? (
            <div className="note-block">
              <strong>읽지 못한 사진</strong>
              {failed.map((f) => (
                <div key={f.fileName}>
                  {f.fileName} — {f.error}
                </div>
              ))}
            </div>
          ) : null}

          <div className="note-block">
            <strong>NOTE</strong>
            같은 검사일 기록이 이미 있으면 새 값으로 교체돼요. 참고치가 인쇄된 칸까지
            함께 읽으니 결과지 표 전체가 잘 보이게 찍어주세요.
          </div>
        </Sheet>
      </div>
    );
  }

  /* ── ② 검토 ────────────────────────────── */

  if (!current) return null;

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow={many ? `REVIEW ${index + 1} / ${queue.length}` : "REVIEW"}
        headline="확인하고 저장"
        lead={
          current.warnings.length > 0
            ? `항목 ${current.results.length}개를 읽었어요. ${current.warnings.length}곳은 잘못 읽었을 수 있어 표시해 뒀어요.`
            : `항목 ${current.results.length}개를 읽었어요. 잘못 읽은 값이 있으면 여기서 고쳐주세요.`
        }
      >
        <div style={{ marginTop: 18 }}>
          {many ? (
            <p className="field-hint" style={{ margin: 0 }}>
              {index + 1}번째 / 총 {queue.length}회차
              {savedCount > 0 ? ` · 저장 ${savedCount}회차` : ""}
            </p>
          ) : null}
          <p className="field-hint" style={{ marginTop: 4 }}>
            사진 {current.fileNames.length}장
            {current.fileNames.length > 1 ? " · 같은 검사일로 합쳤어요" : ""}
          </p>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn--ghost" onClick={reset}>
            다시 올리기
          </button>
          <Link href="/blood" className="btn btn--ghost">
            그만두기
          </Link>
        </div>
      </Sheet>

      {/* 원본 사진 — 값을 대조하면서 고칠 수 있게 */}
      <Sheet eyebrow="PHOTO" headline="올린 사진">
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {current.previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`올린 결과지 ${i + 1}`}
              style={{
                height: 200,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                flex: "none",
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet tone="tint" eyebrow="VALUES" headline="읽은 수치">
        {current.warnings.length > 0 ? (
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
            {current.warnings.map((w, i) => (
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

        {current.imageError ? (
          <p className="field-hint" style={{ marginTop: 14 }}>
            {current.imageError}
          </p>
        ) : null}

        <div className="field" style={{ marginTop: 18 }}>
          <label className="field-label" htmlFor="testedAt">
            검체채취일시
          </label>
          <input
            id="testedAt"
            className="field-input"
            value={current.testedAt}
            onChange={(e) => {
              setEdited(true);
              patchCurrent({ testedAt: e.target.value });
            }}
            placeholder="2026-07-04 15:24"
          />
          <p className="field-hint">같은 날짜 기록이 이미 있으면 새 값으로 교체돼요.</p>
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
              {current.results.map((r, i) => {
                const flagged = warned.has(r.code ?? r.name);
                return (
                <tr
                  key={`${r.name}-${i}`}
                  style={flagged ? { background: "var(--danger-subtle)" } : undefined}
                >
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
                    {/*
                      결과지에 인쇄된 그 줄 원문. 추출이 표를 한 줄 밀려 읽는 일이
                      실제로 있어서, 값만 보면 틀린 줄 알 수 없다.
                    */}
                    {r.rowText ? (
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          fontSize: "0.64rem",
                          lineHeight: 1.45,
                          color: "var(--text-muted)",
                          wordBreak: "break-word",
                        }}
                      >
                        인쇄: {r.rowText}
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
                      style={{
                        width: 92,
                        ...(flagged
                          ? { borderColor: "var(--danger)", borderWidth: 2 }
                          : {}),
                      }}
                    />
                  </td>
                  <td style={{ ...cell, fontSize: "0.76rem", color: "var(--text-muted)" }}>
                    {r.unit ?? "—"}
                  </td>
                  <td style={{ ...cell, fontSize: "0.74rem" }}>
                    {/*
                      참고치도 고칠 수 있어야 한다. 추출이 결과지 대신 아는 기준을
                      써 넣는 일이 있는데, 이 앱은 인쇄된 참고치로 판정하기 때문에
                      틀린 참고치는 틀린 값과 똑같이 위험하다.
                    */}
                    <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        type="number"
                        step="any"
                        value={r.refLow ?? ""}
                        placeholder="하한"
                        onChange={(e) =>
                          editResult(i, {
                            refLow: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        style={{ width: 62 }}
                      />
                      <span style={{ color: "var(--text-muted)" }}>~</span>
                      <input
                        type="number"
                        step="any"
                        value={r.refHigh ?? ""}
                        placeholder="상한"
                        onChange={(e) =>
                          editResult(i, {
                            refHigh: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        style={{ width: 62 }}
                      />
                    </span>
                    {r.refText ? (
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          fontSize: "0.64rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {r.refText}
                      </span>
                    ) : null}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </Sheet>

      {current.etc.length > 0 ? (
        <Sheet eyebrow="OTHER" headline="이름을 못 붙인 항목">
          <p className="lead" style={{ marginTop: 8 }}>
            값은 그대로 보관돼요. 목록에 넣으면 추이 그래프에도 나와요.
          </p>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {current.etc.map((e, i) => (
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
        </Sheet>
      ) : null}

      <Sheet eyebrow="NOTE" headline="메모">
        <div style={{ marginTop: 16 }}>
          <NoteField value={current.note} onChange={(v) => patchCurrent({ note: v })} />
        </div>
      </Sheet>

      <Sheet
        tone="gold"
        eyebrow="SAVE"
        headline={many ? `${index + 1}번째 회차 저장` : "저장"}
      >
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void save()}
            disabled={Boolean(busy)}
          >
            {busy ?? (many && index + 1 < queue.length ? "저장하고 다음 →" : "저장")}
          </button>
          {many ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => goNext(false)}
              disabled={Boolean(busy)}
            >
              이 회차는 건너뛰기
            </button>
          ) : null}
        </div>

        {msg ? (
          <p className="lead" style={{ marginTop: 14, color: "var(--danger)" }}>
            {msg}
          </p>
        ) : null}

        {failed.length > 0 ? (
          <div className="note-block">
            <strong>읽지 못한 사진</strong>
            {failed.map((f) => (
              <div key={f.fileName}>
                {f.fileName} — {f.error}
              </div>
            ))}
          </div>
        ) : null}
      </Sheet>
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

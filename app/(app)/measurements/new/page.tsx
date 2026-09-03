"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import { useProfile } from "@/lib/useProfile";
import { checkUploadSize, shrinkImageForUpload } from "@/lib/clientImageResize";
import { FIELDS, SEGMENT_LABELS, type SegmentKey } from "@/lib/inbody";

/**
 * 인바디 결과지 등록.
 *
 * 사진 → 추출 → **검토·수정** → 저장. 추출 결과를 바로 저장하지 않는다.
 * 여러 장을 한 번에 선택할 수 있고, 한 장씩 순서대로 추출한 뒤 하나씩 검토한다.
 * (Vision 호출이 장당 10~20초라 병렬로 보내지 않는다 — 실패 지점을 알기 어렵고
 *  토큰도 한꺼번에 빠진다)
 */

type Warning = { field: string; message: string };
type Extracted = Record<string, unknown>;

/** 추출을 마친 결과지 한 장 */
type QueueItem = {
  fileName: string;
  preview: string;
  data: Extracted;
  warnings: Warning[];
  imageUrl: string | null;
  /** 원본을 R2에 보관하지 못한 경우의 안내 */
  imageError: string | null;
  model: string | null;
};

/** 추출에 실패한 장 */
type FailedItem = { fileName: string; error: string };

type Step = "upload" | "review";

export default function NewMeasurementPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const { complete, loading: profileLoading } = useProfile(session?.id);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  /** 추출을 마친 목록과 현재 검토 중인 위치 */
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [edited, setEdited] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  /** 사진 없이 체중만 기록 (별도 컬렉션 없이 인바디 기록으로 저장한다) */
  const [quickDate, setQuickDate] = useState(() =>
    new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [quickWeight, setQuickWeight] = useState("");
  const [quickPbf, setQuickPbf] = useState("");
  const [quickSmm, setQuickSmm] = useState("");
  const [quickMsg, setQuickMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  const current = queue[index];

  /* ── 추출 (여러 장 순차 처리) ───────────────── */

  const runExtract = async (files: File[]) => {
    if (!session || files.length === 0) return;
    setMsg(null);
    setFailed([]);

    const done: QueueItem[] = [];
    const fails: FailedItem[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
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
        fd.set("file", shrunk);
        fd.set("userId", session.id);

        const res = await fetch("/api/measurements/extract", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: Extracted;
          warnings?: Warning[];
          imageUrl?: string | null;
          imageError?: string | null;
          model?: string;
          error?: string;
          message?: string;
        };

        // 프로필이 없으면 더 진행할 의미가 없다
        if (res.status === 428) {
          setMsg(json.message ?? "프로필을 먼저 입력해 주세요.");
          break;
        }
        if (!res.ok || !json.ok || !json.data) {
          fails.push({
            fileName: file.name,
            error: json.error ?? "분석에 실패했어요.",
          });
          continue;
        }

        done.push({
          fileName: file.name,
          preview: URL.createObjectURL(shrunk),
          data: json.data,
          warnings: json.warnings ?? [],
          imageUrl: json.imageUrl ?? null,
          imageError: json.imageError ?? null,
          model: json.model ?? null,
        });
      } catch {
        fails.push({ fileName: file.name, error: "네트워크 오류예요." });
      }
    }

    setBusy(null);
    setFailed(fails);

    if (done.length === 0) {
      if (fails.length > 0) {
        setMsg("읽어낸 결과지가 없어요. 사진이 선명한지 확인해 주세요.");
      }
      return;
    }

    // 검사일시 순으로 정렬해 오래된 것부터 검토한다
    done.sort((a, b) =>
      String(a.data.measuredAt ?? "").localeCompare(String(b.data.measuredAt ?? "")),
    );
    setQueue(done);
    setIndex(0);
    setEdited(false);
    setStep("review");
  };

  /* ── 값 편집 ─────────────────────────────── */

  const setPath = (path: string, raw: string) => {
    setEdited(true);
    setQueue((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const data = structuredClone(item.data) as Record<string, unknown>;
      const parts = path.split(".");
      let cur: Record<string, unknown> = data;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const k = parts[i];
        if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
        cur = cur[k] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = raw === "" ? null : Number(raw);
      next[index] = { ...item, data };
      return next;
    });
  };

  const setMeasuredAt = (value: string) => {
    setEdited(true);
    setQueue((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      next[index] = { ...item, data: { ...item.data, measuredAt: value } };
      return next;
    });
  };

  const pick = (path: string): string => {
    if (!current) return "";
    const parts = path.split(".");
    let cur: unknown = current.data;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return "";
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "number" ? String(cur) : "";
  };

  /* ── 저장 ───────────────────────────────── */

  const goNext = (saved: boolean) => {
    if (saved) setSavedCount((n) => n + 1);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setEdited(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      router.push("/measurements");
    }
  };

  /**
   * 체중만 기록.
   * 체중 전용 컬렉션을 두지 않고, source="manual" 인 인바디 기록으로 저장한다.
   * 덕분에 목록·상세·History 그래프가 같은 데이터를 그대로 쓴다.
   */
  const saveQuick = async () => {
    if (!session) return;
    const w = Number(quickWeight);
    if (!Number.isFinite(w) || w < 20 || w > 250) {
      setQuickMsg("체중을 확인해 주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quickDate)) {
      setQuickMsg("날짜를 확인해 주세요.");
      return;
    }

    setBusy("저장 중…");
    setQuickMsg(null);
    try {
      const data: Extracted = {
        composition: { weight: { value: w, min: null, max: null } },
        obesity: quickPbf
          ? { percentBodyFat: { value: Number(quickPbf), min: null, max: null } }
          : {},
        muscleFat: quickSmm
          ? { skeletalMuscleMass: { value: Number(quickSmm), min: null, max: null } }
          : {},
      };

      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          measuredAt: `${quickDate} 09:00`,
          data,
          source: "manual",
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setQuickMsg(json.error ?? "저장에 실패했어요.");
        return;
      }
      router.push("/measurements");
    } catch {
      setQuickMsg("네트워크 오류예요.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!session || !current) return;
    setBusy("저장 중…");
    setMsg(null);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          measuredAt: current.data.measuredAt ?? "",
          data: current.data,
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
  };

  /* ── 화면 ───────────────────────────────── */

  const warnedFields = useMemo(
    () => new Set((current?.warnings ?? []).map((w) => w.field)),
    [current],
  );

  // 프로필 게이트
  if (session && !profileLoading && complete === false) {
    return (
      <Sheet
        tone="dark"
        ornament
        eyebrow="PROFILE REQUIRED"
        headline={
          <>
            먼저 키와 성별을
            <br />
            알려주세요
          </>
        }
        lead={
          <>
            인바디 결과지의 표준범위와 기초대사량은 성별·나이 기준이에요.
            <br />
            이 정보가 있어야 수치를 제대로 읽어줄 수 있어요.
          </>
        }
      >
        <div style={{ marginTop: 24 }}>
          <Link href="/my" className="btn btn--primary">
            프로필 입력하러 가기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Sheet>
    );
  }

  if (step === "upload") {
    return (
      <div>
        <Sheet
          tone="dark"
          ornament
          eyebrow="NEW RECORD"
          headline={
            <>
              결과지를 찍으면
              <br />
              수치를 읽어드려요
            </>
          }
          lead={
            <>
              여러 장을 한 번에 선택할 수 있어요.
              <br />
              읽은 값은 저장 전에 한 장씩 확인해요.
            </>
          }
        />

        <Sheet eyebrow="UPLOAD" headline="결과지 사진">
          <div style={{ marginTop: 20 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                // 같은 파일을 다시 고를 수 있도록 값을 비운다
                e.target.value = "";
                if (list.length > 0) void runExtract(list);
              }}
            />
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(busy)}
            >
              {busy ?? "사진 선택하기 (여러 장 가능)"}
            </button>

            {msg ? (
              <p className="lead" style={{ color: "var(--danger)" }}>
                {msg}
              </p>
            ) : null}

            {failed.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <p className="field-label">읽지 못한 사진</p>
                {failed.map((f) => (
                  <p
                    key={f.fileName}
                    className="field-hint"
                    style={{ margin: "4px 0 0" }}
                  >
                    {f.fileName} — {f.error}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="note-block">
              <strong>NOTE · 이렇게 찍으면 잘 읽어요</strong>
              * 결과지 네 모서리가 모두 들어가게 찍어주세요.
              <br />* 그림자나 반사가 없는 곳에서 정면으로 찍어주세요.
              <br />* 기종(270 · 970 · 720 등)이 달라도 괜찮아요. 없는 항목은 비워둬요.
              <br />* 여러 장을 고르면 한 장씩 차례로 읽어요. 장당 10~20초쯤 걸려요.
            </div>
          </div>
        </Sheet>

        <Sheet
          tone="tint"
          eyebrow="WEIGHT ONLY"
          headline="체중만 기록하기"
          lead="결과지가 없는 날은 체중만 남겨요. 같은 기록으로 관리돼요."
        >
          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label className="field-label" htmlFor="quickDate">
                날짜
              </label>
              <input
                id="quickDate"
                className="field-input"
                type="date"
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="quickWeight">
                체중 (kg)
              </label>
              <input
                id="quickWeight"
                className="field-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={20}
                max={250}
                value={quickWeight}
                onChange={(e) => setQuickWeight(e.target.value)}
                placeholder="예) 78.0"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="quickPbf">
                체지방률 (%) · 선택
              </label>
              <input
                id="quickPbf"
                className="field-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={quickPbf}
                onChange={(e) => setQuickPbf(e.target.value)}
                placeholder="가정용 체중계에 나오면 함께 적어요"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="quickSmm">
                골격근량 (kg) · 선택
              </label>
              <input
                id="quickSmm"
                className="field-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={quickSmm}
                onChange={(e) => setQuickSmm(e.target.value)}
                placeholder="선택 항목이에요"
              />
            </div>

            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => void saveQuick()}
              disabled={Boolean(busy)}
            >
              {busy ?? "체중 기록 저장"}
            </button>

            {quickMsg ? (
              <p className="lead" style={{ color: "var(--danger)" }}>
                {quickMsg}
              </p>
            ) : null}

            <div className="note-block">
              <strong>NOTE</strong>
              같은 날짜 기록이 이미 있으면 새 값으로 교체돼요. 조건을 같게 하려면
              아침 공복에 재는 것을 권해요.
            </div>
          </div>
        </Sheet>
      </div>
    );
  }

  if (!current) return null;

  const measuredAt = String(current.data.measuredAt ?? "");
  const many = queue.length > 1;

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow={many ? `REVIEW ${index + 1} / ${queue.length}` : "REVIEW"}
        headline={
          <>
            읽은 값을
            <br />
            확인해 주세요
          </>
        }
        lead={
          current.warnings.length > 0
            ? `확인이 필요한 항목이 ${current.warnings.length}개 있어요. 원본과 비교해 고쳐주세요.`
            : "숫자 검증을 모두 통과했어요. 그래도 한 번 훑어봐 주세요."
        }
      >
        {many ? (
          <p style={{ marginTop: 16 }}>
            <span className="pill">
              {index + 1}번째 / 총 {queue.length}장
              {savedCount > 0 ? ` · 저장 ${savedCount}장` : ""}
            </span>
          </p>
        ) : null}
      </Sheet>

      {current.warnings.length > 0 ? (
        <Sheet tone="gold" eyebrow="CHECK" headline="이 값을 확인해 주세요">
          <ul style={{ margin: "16px 0 0", paddingLeft: 18 }}>
            {current.warnings.map((w) => (
              <li key={w.field + w.message} className="lead" style={{ marginTop: 6 }}>
                {w.message}
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      <Sheet eyebrow="ORIGINAL" headline="원본">
        {/* 추출값과 나란히 비교하기 위한 원본 */}
        <img
          src={current.preview}
          alt="인바디 결과지"
          style={{
            width: "100%",
            marginTop: 16,
            borderRadius: 14,
            border: "1px solid var(--border)",
          }}
        />
        <p className="field-hint" style={{ marginTop: 8 }}>
          {current.fileName}
        </p>
        {current.imageError ? (
          <p className="field-hint" style={{ color: "var(--danger)", marginTop: 4 }}>
            {current.imageError}
          </p>
        ) : null}
      </Sheet>

      <Sheet eyebrow="MEASURED AT" headline="검사일시">
        <div className="field" style={{ marginTop: 18 }}>
          <input
            className="field-input"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            placeholder="2026-07-04 10:47"
          />
          <p className="field-hint">
            같은 날짜 기록이 이미 있으면 새 값으로 교체돼요.
          </p>
        </div>
      </Sheet>

      <Sheet eyebrow="VALUES" headline="읽은 수치">
        <div style={{ marginTop: 18 }}>
          {FIELDS.filter((f) => !f.path.startsWith("derived")).map((f) => {
            const warned = warnedFields.has(f.path.replace(/\.value$/, ""));
            return (
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
                  value={pick(f.path)}
                  onChange={(e) => setPath(f.path, e.target.value)}
                  style={
                    warned ? { borderColor: "var(--danger)", borderWidth: 2 } : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </Sheet>

      <SegmentalSheet data={current.data} />
      <EtcSheet data={current.data} />

      <Sheet>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => void save()}
          disabled={Boolean(busy)}
        >
          {busy ??
            (many && index + 1 < queue.length
              ? "저장하고 다음 장으로 →"
              : "이대로 저장하기")}
        </button>

        {many && index + 1 < queue.length ? (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 10 }}
            onClick={() => goNext(false)}
          >
            이 장은 건너뛰기
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10 }}
          onClick={reset}
        >
          처음부터 다시
        </button>

        {msg ? (
          <p className="lead" style={{ color: "var(--danger)" }}>
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

/** 부위별 근육·지방 — 기종에 따라 없을 수 있다 */
function SegmentalSheet({ data }: { data: Record<string, unknown> | null }) {
  const seg = (data?.segmental ?? {}) as Record<
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
    <Sheet tone="tint" eyebrow="SEGMENTAL" headline="부위별">
      <div style={{ marginTop: 16 }}>
        {groups.map(([key, label]) => {
          const rows = seg[key] ?? {};
          const any = Object.values(rows).some(
            (v) => v && (v.kg != null || v.percent != null || v.grade),
          );
          if (!any) return null;
          return (
            <div key={key} style={{ marginBottom: 18 }}>
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

/** 스키마에 자리가 없는 항목 — 버리지 않고 그대로 보여준다 */
function EtcSheet({ data }: { data: Record<string, unknown> | null }) {
  const etc = (data?.etc ?? []) as Array<{
    label: string;
    value: string;
    unit?: string | null;
  }>;
  if (!Array.isArray(etc) || etc.length === 0) return null;

  return (
    <Sheet
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
  );
}

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
 * 결과지의 내부 계산이 맞아떨어지는 성질로 오인식을 잡아 경고로 보여준다.
 */

type Warning = { field: string; message: string };
type Extracted = Record<string, unknown>;

type Step = "upload" | "review";

export default function NewMeasurementPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const { complete, loading: profileLoading } = useProfile(session?.id);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [data, setData] = useState<Extracted | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
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

  /* ── 추출 ───────────────────────────────── */

  const runExtract = async (file: File) => {
    if (!session) return;
    setMsg(null);
    setBusy("이미지를 줄이는 중…");
    try {
      const shrunk = await shrinkImageForUpload(file);
      const sizeCheck = checkUploadSize(shrunk);
      if (!sizeCheck.ok) {
        setMsg(sizeCheck.error);
        return;
      }
      setPreview(URL.createObjectURL(shrunk));

      setBusy("결과지를 읽는 중… (10~20초)");
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
        model?: string;
        error?: string;
        message?: string;
      };

      if (res.status === 428) {
        setMsg(json.message ?? "프로필을 먼저 입력해 주세요.");
        return;
      }
      if (!res.ok || !json.ok || !json.data) {
        setMsg(json.error ?? "분석에 실패했어요.");
        return;
      }

      setData(json.data);
      setWarnings(json.warnings ?? []);
      setImageUrl(json.imageUrl ?? null);
      setModel(json.model ?? null);
      setStep("review");
    } catch {
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(null);
    }
  };

  /* ── 값 편집 ─────────────────────────────── */

  const setPath = (path: string, raw: string) => {
    setEdited(true);
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as Record<string, unknown>;
      const parts = path.split(".");
      let cur: Record<string, unknown> = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const k = parts[i];
        if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
        cur = cur[k] as Record<string, unknown>;
      }
      const last = parts[parts.length - 1];
      cur[last] = raw === "" ? null : Number(raw);
      return next;
    });
  };

  const pick = (path: string): string => {
    if (!data) return "";
    const parts = path.split(".");
    let cur: unknown = data;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return "";
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "number" ? String(cur) : "";
  };

  const measuredAt = (data?.measuredAt as string) ?? "";

  /* ── 저장 ───────────────────────────────── */

  const save = async () => {
    if (!session || !data) return;
    setBusy("저장 중…");
    setMsg(null);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          measuredAt,
          data,
          imageUrl,
          model,
          editedByUser: edited,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "저장에 실패했어요.");
        return;
      }
      router.push("/measurements");
    } catch {
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(null);
    }
  };

  /* ── 화면 ───────────────────────────────── */

  const warnedFields = useMemo(
    () => new Set(warnings.map((w) => w.field)),
    [warnings],
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
              인바디 결과지 전체가 잘 보이게 찍어주세요.
              <br />
              읽은 값은 저장 전에 직접 확인할 수 있어요.
            </>
          }
        />

        <Sheet eyebrow="UPLOAD" headline="결과지 사진">
          <div style={{ marginTop: 20 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runExtract(f);
              }}
            />
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(busy)}
            >
              {busy ?? "사진 선택하기"}
            </button>

            {msg ? (
              <p className="lead" style={{ color: "var(--danger)" }}>
                {msg}
              </p>
            ) : null}

            <div className="note-block">
              <strong>NOTE · 이렇게 찍으면 잘 읽어요</strong>
              * 결과지 네 모서리가 모두 들어가게 찍어주세요.
              <br />* 그림자나 반사가 없는 곳에서 정면으로 찍어주세요.
              <br />* 기종(270 · 970 · 720 등)이 달라도 괜찮아요. 없는 항목은 비워둬요.
            </div>
          </div>
        </Sheet>
      </div>
    );
  }

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="REVIEW"
        headline={
          <>
            읽은 값을
            <br />
            확인해 주세요
          </>
        }
        lead={
          warnings.length > 0
            ? `확인이 필요한 항목이 ${warnings.length}개 있어요. 원본과 비교해 고쳐주세요.`
            : "숫자 검증을 모두 통과했어요. 그래도 한 번 훑어봐 주세요."
        }
      />

      {warnings.length > 0 ? (
        <Sheet tone="gold" eyebrow="CHECK" headline="이 값을 확인해 주세요">
          <ul style={{ margin: "16px 0 0", paddingLeft: 18 }}>
            {warnings.map((w) => (
              <li
                key={w.field + w.message}
                className="lead"
                style={{ marginTop: 6 }}
              >
                {w.message}
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      {preview ? (
        <Sheet eyebrow="ORIGINAL" headline="원본">
          {/* 추출값과 나란히 비교하기 위한 원본 */}
          <img
            src={preview}
            alt="인바디 결과지"
            style={{
              width: "100%",
              marginTop: 16,
              borderRadius: 14,
              border: "1px solid var(--border)",
            }}
          />
        </Sheet>
      ) : null}

      <Sheet eyebrow="MEASURED AT" headline="검사일시">
        <div className="field" style={{ marginTop: 18 }}>
          <input
            className="field-input"
            value={measuredAt}
            onChange={(e) => {
              setEdited(true);
              setData((prev) =>
                prev ? { ...prev, measuredAt: e.target.value } : prev,
              );
            }}
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
                    warned
                      ? { borderColor: "var(--danger)", borderWidth: 2 }
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </Sheet>

      <SegmentalSheet data={data} />
      <EtcSheet data={data} />

      <Sheet>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => void save()}
          disabled={Boolean(busy)}
        >
          {busy ?? "이대로 저장하기"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10 }}
          onClick={() => {
            setStep("upload");
            setData(null);
            setWarnings([]);
            setPreview(null);
          }}
        >
          다시 찍기
        </button>
        {msg ? (
          <p className="lead" style={{ color: "var(--danger)" }}>
            {msg}
          </p>
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
    <Sheet eyebrow="ETC" headline="그 밖의 항목" lead="결과지에는 있지만 아직 정식 항목이 아닌 값이에요.">
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

"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

/**
 * 결과지에 남기는 메모.
 *
 * 인바디·피검사 모델에 `note` 필드는 처음부터 있었는데 **어느 화면에서도 쓰지 않고
 * 있었다.** 저장은 되는데 쓸 방법이 없었던 셈이다.
 *
 * 메모가 필요한 이유는 수치가 조건에 흔들리기 때문이다 — "공복 아니었음",
 * "전날 헬스", "감기약 복용 중" 같은 한 줄이 나중에 값을 읽을 때 결정적이다.
 * 그래서 등록할 때 한 번, 나중에 떠올랐을 때 또 한 번 쓸 수 있어야 한다.
 */

const PLACEHOLDER =
  "예: 공복 아니었음 · 전날 근력운동 · 감기약 복용 중 · 컨디션 안 좋았음";

const HINT =
  "수치는 검사 조건에 따라 달라져요. 그날의 상황을 적어두면 나중에 값을 읽을 때 도움이 돼요.";

/** 등록 화면에서 쓰는 입력칸 (아직 저장 전이라 부모가 값을 들고 있다) */
export function NoteField({
  value,
  onChange,
  label = "메모",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor="record-note">
        {label} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(선택)</span>
      </label>
      <textarea
        id="record-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={3}
        maxLength={1000}
        style={{
          display: "block",
          width: "100%",
          marginTop: 6,
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--input-border)",
          background: "var(--input-bg)",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          fontSize: "0.88rem",
          lineHeight: 1.6,
          resize: "vertical",
        }}
      />
      <p className="field-hint" style={{ marginTop: 6 }}>
        {HINT}
      </p>
    </div>
  );
}

/**
 * 이미 저장된 기록의 메모 — 이 컴포넌트가 직접 저장한다.
 *
 * 상세 화면은 읽는 곳이라 전체를 편집 모드로 만들지 않고,
 * **메모만 그 자리에서 고칠 수 있게** 한다.
 */
export function NoteEditor({
  apiPath,
  userId,
  initial,
}: {
  /** PATCH를 보낼 곳. 예: `/api/blood/abc123` */
  apiPath: string;
  userId: string;
  initial: string | null;
}) {
  const [saved, setSaved] = useState(initial ?? "");
  const [draft, setDraft] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(initial ?? "");
    setDraft(initial ?? "");
  }, [initial]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, note: draft.trim() || null }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        showToast(json.error ?? "메모를 저장하지 못했어요.", "err");
        return;
      }
      setSaved(draft.trim());
      setEditing(false);
      showToast("메모를 저장했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div>
        {saved ? (
          <p
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-secondary)",
              borderLeft: "3px solid var(--point)",
              fontSize: "0.85rem",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {saved}
          </p>
        ) : (
          <p className="field-hint" style={{ margin: 0 }}>
            아직 메모가 없어요. {HINT}
          </p>
        )}

        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: 12, padding: "8px 14px", fontSize: 13 }}
          onClick={() => {
            setDraft(saved);
            setEditing(true);
          }}
        >
          {saved ? "메모 수정" : "메모 남기기"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={4}
        maxLength={1000}
        autoFocus
        style={{
          display: "block",
          width: "100%",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--input-border)",
          background: "var(--input-bg)",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          fontSize: "0.88rem",
          lineHeight: 1.6,
          resize: "vertical",
        }}
      />
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn--primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ padding: "8px 14px", fontSize: 13 }}
          onClick={() => {
            setDraft(saved);
            setEditing(false);
          }}
          disabled={busy}
        >
          취소
        </button>
      </div>
    </div>
  );
}

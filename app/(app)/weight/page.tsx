"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";

type WeightRow = {
  _id: string;
  date: string;
  weightKg: number;
  percentBodyFat?: number | null;
  memo?: string | null;
};

/** KST 기준 오늘 (YYYY-MM-DD) */
function todayKey(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 체중 기록.
 * 인바디는 가끔이지만 체중계는 매일 잴 수 있어 따로 둔다. 하루 1건.
 */
export default function WeightPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<WeightRow[] | null>(null);

  const [date, setDate] = useState(todayKey());
  const [weightKg, setWeightKg] = useState("");
  const [pbf, setPbf] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!session) return;
    const res = await fetch(`/api/weights?userId=${encodeURIComponent(session.id)}`);
    const json = (await res.json()) as { ok: boolean; weights?: WeightRow[] };
    setRows(json.weights ?? []);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!session) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/weights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          date,
          weightKg: Number(weightKg),
          percentBodyFat: pbf === "" ? null : Number(pbf),
          memo: memo.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "저장에 실패했어요.");
        return;
      }
      setWeightKg("");
      setPbf("");
      setMemo("");
      await load();
    } catch {
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: string) => {
    if (!session) return;
    if (!confirm(`${d} 기록을 삭제할까요?`)) return;
    await fetch(
      `/api/weights?userId=${encodeURIComponent(session.id)}&date=${d}`,
      { method: "DELETE" },
    );
    await load();
  };

  const latest = rows?.[0];
  const diff = useMemo(() => {
    if (!rows || rows.length < 2) return null;
    return Number((rows[0].weightKg - rows[1].weightKg).toFixed(1));
  }, [rows]);

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="WEIGHT"
        headline={
          <>
            오늘의
            <br />
            체중 기록
          </>
        }
        lead={
          latest
            ? `가장 최근 기록은 ${latest.date} · ${latest.weightKg}kg 이에요.`
            : "매일 재두면 인바디 사이의 변화도 보여요."
        }
      >
        {diff != null && diff !== 0 ? (
          <p
            style={{
              marginTop: 16,
              fontSize: "0.85rem",
              fontWeight: 700,
              color: diff < 0 ? "#7ee0b8" : "#ead58c",
            }}
          >
            직전 기록 대비 {diff > 0 ? "+" : ""}
            {diff}kg
          </p>
        ) : null}
      </Sheet>

      <Sheet eyebrow="RECORD" headline="기록하기">
        <div style={{ marginTop: 18 }}>
          <div className="field">
            <label className="field-label" htmlFor="date">
              날짜
            </label>
            <input
              id="date"
              className="field-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="weightKg">
              체중 (kg)
            </label>
            <input
              id="weightKg"
              className="field-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={20}
              max={250}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="78.0"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pbf">
              체지방률 (%) · 선택
            </label>
            <input
              id="pbf"
              className="field-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={pbf}
              onChange={(e) => setPbf(e.target.value)}
              placeholder="가정용 체중계에 나오면 함께 적어요"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="memo">
              메모 · 선택
            </label>
            <input
              id="memo"
              className="field-input"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="공복, 운동 후 …"
            />
          </div>

          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? "저장 중…" : "저장하기"}
          </button>

          {msg ? (
            <p className="lead" style={{ color: "var(--danger)" }}>
              {msg}
            </p>
          ) : null}

          <div className="note-block">
            <strong>NOTE</strong>
            같은 날짜에 다시 기록하면 새 값으로 바뀌어요. 조건을 같게 하려면 아침 공복에
            재는 것을 권해요.
          </div>
        </div>
      </Sheet>

      <Sheet tone="tint" eyebrow="HISTORY" headline="기록 목록">
        <div style={{ marginTop: 14 }}>
          {rows === null ? (
            <p className="lead" style={{ marginTop: 0 }}>
              불러오는 중…
            </p>
          ) : rows.length === 0 ? (
            <p className="lead" style={{ marginTop: 0 }}>
              아직 기록이 없어요.
            </p>
          ) : (
            rows.map((r, i) => {
              const prev = rows[i + 1];
              const d = prev ? Number((r.weightKg - prev.weightKg).toFixed(1)) : null;
              return (
                <div
                  key={r._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "11px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700 }}>
                      {r.weightKg}kg
                      {r.percentBodyFat != null ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontWeight: 500,
                            color: "var(--text-muted)",
                          }}
                        >
                          체지방 {r.percentBodyFat}%
                        </span>
                      ) : null}
                      {d != null && d !== 0 ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "0.75rem",
                            color: d < 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {d > 0 ? "+" : ""}
                          {d}
                        </span>
                      ) : null}
                    </p>
                    <p className="field-hint" style={{ margin: "2px 0 0" }}>
                      {r.date}
                      {r.memo ? ` · ${r.memo}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(r.date)}
                    style={{
                      border: "none",
                      background: "none",
                      color: "var(--text-muted)",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    삭제
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Sheet>
    </div>
  );
}

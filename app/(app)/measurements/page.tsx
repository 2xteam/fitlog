"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import { pick } from "@/lib/inbody";

type Row = Record<string, unknown> & { _id: string; measuredAt: string };

/** 인바디 측정 목록 — 최신순. 직전 기록 대비 변화를 함께 보여준다. */
export default function MeasurementsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

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

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="INBODY RECORDS"
        headline={
          <>
            지금까지의
            <br />
            인바디 기록
          </>
        }
        lead="결과지를 찍어두면 변화가 저절로 쌓여요."
      >
        <div style={{ marginTop: 22 }}>
          <Link href="/measurements/new" className="btn btn--primary">
            결과지 등록하기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Sheet>

      {rows === null ? (
        <Sheet>
          <p className="lead" style={{ marginTop: 0 }}>
            불러오는 중…
          </p>
        </Sheet>
      ) : rows.length === 0 ? (
        <Sheet
          center
          eyebrow="EMPTY"
          headline="아직 기록이 없어요"
          lead="첫 결과지를 등록하면 여기에 쌓여요."
        />
      ) : (
        rows.map((row, i) => {
          const prev = rows[i + 1];
          return <RecordCard key={row._id} row={row} prev={prev} />;
        })
      )}
    </div>
  );
}

const KEYS: Array<{ path: string; label: string; unit: string; lowerBetter?: boolean }> = [
  { path: "composition.weight.value", label: "체중", unit: "kg" },
  { path: "muscleFat.skeletalMuscleMass.value", label: "골격근량", unit: "kg" },
  { path: "obesity.percentBodyFat.value", label: "체지방률", unit: "%", lowerBetter: true },
];

function RecordCard({ row, prev }: { row: Row; prev?: Row }) {
  const date = new Date(row.measuredAt);
  const dateText = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
  const device = (row.device as { model?: string } | undefined)?.model ?? null;

  return (
    <Sheet>
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
        <Link href={`/measurements/${row._id}`} className="pill">
          자세히 →
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginTop: 18,
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
    </Sheet>
  );
}

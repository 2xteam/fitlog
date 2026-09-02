"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import { pick } from "@/lib/inbody";
import { useProfile } from "@/lib/useProfile";

type Row = Record<string, unknown> & { _id: string; measuredAt: string };

/** FitLog 홈 — 최근 기록 요약과 다음 행동. */
export default function HomePage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const { complete } = useProfile(session?.id);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch(
      `/api/measurements?userId=${encodeURIComponent(session.id)}&limit=2`,
    );
    const json = (await res.json()) as { ok: boolean; measurements?: Row[] };
    setRows(json.measurements ?? []);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = rows?.[0];
  const prev = rows?.[1];

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="FITLOG"
        headline={
          <>
            찍어두면,
            <br />
            변화가 보여요
          </>
        }
        lead={
          session
            ? `${session.name}님, 오늘도 기록해 볼까요.`
            : "인바디 결과지를 사진으로 기록해요."
        }
      >
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/measurements/new" className="btn btn--primary">
            결과지 등록 <span aria-hidden="true">→</span>
          </Link>
          <Link href="/weight" className="btn btn--ghost">
            체중 기록
          </Link>
        </div>
      </Sheet>

      {complete === false ? (
        <Sheet
          tone="gold"
          eyebrow="SETUP"
          headline="프로필을 먼저 채워주세요"
          lead="키·성별·출생연도가 있어야 인바디 수치를 제대로 읽어드릴 수 있어요."
        >
          <div style={{ marginTop: 18 }}>
            <Link href="/my" className="btn btn--primary">
              입력하러 가기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Sheet>
      ) : null}

      {latest ? (
        <Sheet eyebrow="LATEST" headline="가장 최근 기록">
          <LatestSummary latest={latest} prev={prev} />
          <div style={{ marginTop: 18 }}>
            <Link href={`/measurements/${latest._id}`} className="pill">
              자세히 보기 →
            </Link>
          </div>
        </Sheet>
      ) : rows !== null ? (
        <Sheet
          center
          eyebrow="START"
          headline="첫 기록을 남겨볼까요?"
          lead="인바디 결과지를 찍으면 수치를 읽어 정리해 드려요."
        >
          <div style={{ marginTop: 20 }}>
            <Link href="/measurements/new" className="btn btn--primary">
              결과지 등록하기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Sheet>
      ) : null}

      <Sheet tone="tint" eyebrow="MENU" headline="무엇을 해볼까요">
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {[
            { href: "/measurements", label: "인바디 기록 전체 보기" },
            { href: "/weight", label: "오늘 체중 기록하기" },
            { href: "/charts", label: "추이 그래프 보기" },
            { href: "/my", label: "내 프로필" },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="btn btn--ghost btn--block"
              style={{ justifyContent: "space-between" }}
            >
              {m.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

const KEYS = [
  { path: "composition.weight.value", label: "체중", unit: "kg" },
  { path: "muscleFat.skeletalMuscleMass.value", label: "골격근량", unit: "kg" },
  {
    path: "obesity.percentBodyFat.value",
    label: "체지방률",
    unit: "%",
    lowerBetter: true,
  },
];

function LatestSummary({ latest, prev }: { latest: Row; prev?: Row }) {
  const date = new Date(latest.measuredAt);
  return (
    <div style={{ marginTop: 16 }}>
      <p className="field-hint" style={{ margin: 0 }}>
        {date.getFullYear()}. {date.getMonth() + 1}. {date.getDate()}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginTop: 14,
        }}
      >
        {KEYS.map((k) => {
          const v = pick(latest, k.path);
          const p = prev ? pick(prev, k.path) : null;
          const diff = v != null && p != null ? Number((v - p).toFixed(1)) : null;
          const good =
            diff == null || diff === 0 ? null : k.lowerBetter ? diff < 0 : diff > 0;
          return (
            <div key={k.path} style={{ textAlign: "center" }}>
              <p className="field-hint" style={{ margin: 0 }}>
                {k.label}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "1.4rem",
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
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

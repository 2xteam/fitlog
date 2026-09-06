"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import { pick } from "@/lib/inbody";
import { useProfile } from "@/lib/useProfile";
import { flaggedIn, type BloodRow } from "@/lib/blood";

type Row = Record<string, unknown> & { _id: string; measuredAt: string };

/** FitLog 홈 — 최근 기록 요약과 다음 행동. */
export default function HomePage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const { complete } = useProfile(session?.id);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [blood, setBlood] = useState<BloodRow[] | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const q = encodeURIComponent(session.id);
    // 두 기록을 함께 불러온다 — 홈은 "가장 최근"을 보는 곳이라 한쪽만 보여주면
    // 다른 쪽을 기록했는지조차 알 수 없다
    const [mRes, bRes] = await Promise.all([
      fetch(`/api/measurements?userId=${q}&limit=2`),
      fetch(`/api/blood?userId=${q}&limit=2`),
    ]);
    const m = (await mRes.json()) as { ok: boolean; measurements?: Row[] };
    const b = (await bRes.json()) as { ok: boolean; tests?: BloodRow[] };
    setRows(m.measurements ?? []);
    setBlood(b.tests ?? []);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = rows?.[0];
  const prev = rows?.[1];
  const latestBlood = blood?.[0];
  const prevBlood = blood?.[1];
  /** 둘 다 아직 안 불러왔는지 */
  const loading = rows === null || blood === null;
  const nothing = !loading && !latest && !latestBlood;

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
            : "인바디와 피검사 결과지를 사진으로 기록해요."
        }
      >
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/measurements/new" className="btn btn--primary">
            인바디 등록 <span aria-hidden="true">→</span>
          </Link>
          <Link href="/blood/new" className="btn btn--ghost">
            피검사 등록
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
        <Sheet eyebrow="LATEST · INBODY" headline="가장 최근 인바디">
          <LatestSummary latest={latest} prev={prev} />
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/measurements/${latest._id}`} className="pill">
              자세히 보기 →
            </Link>
            <Link href="/measurements" className="pill">
              추이 보기 →
            </Link>
          </div>
        </Sheet>
      ) : null}

      {latestBlood ? (
        <Sheet tone="tint" eyebrow="LATEST · BLOOD" headline="가장 최근 피검사">
          <LatestBlood latest={latestBlood} prev={prevBlood} />
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/blood/${latestBlood._id}`} className="pill">
              자세히 보기 →
            </Link>
            <Link href="/blood" className="pill">
              추이 보기 →
            </Link>
          </div>
        </Sheet>
      ) : null}

      {/* 아직 하나도 없을 때만 안내한다. 한쪽만 있으면 나머지는 아래 메뉴로 간다 */}
      {nothing ? (
        <Sheet
          center
          eyebrow="START"
          headline="첫 기록을 남겨볼까요?"
          lead="인바디나 피검사 결과지를 찍으면 수치를 읽어 정리해 드려요."
        >
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link href="/measurements/new" className="btn btn--primary">
              인바디 등록 <span aria-hidden="true">→</span>
            </Link>
            <Link href="/blood/new" className="btn btn--ghost">
              피검사 등록 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Sheet>
      ) : null}

      <Sheet tone="tint" eyebrow="MENU" headline="무엇을 해볼까요">
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {[
            { href: "/measurements", label: "Inbody — 최근 상태와 추이" },
            { href: "/measurements/new", label: "인바디 결과지 등록 · 체중만 기록" },
            { href: "/blood", label: "Blood — 피검사 수치와 권장사항" },
            { href: "/blood/new", label: "피검사 결과지 등록" },
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


/**
 * 가장 최근 피검사 요약.
 *
 * 인바디는 핵심 3종의 값을 보여주지만, 피검사는 회차마다 항목이 달라 "늘 같은 세 개"를
 * 고를 수 없다. 대신 **이번에 벗어난 항목**을 앞세운다 — 홈에서 알고 싶은 건
 * 값 자체보다 "봐야 할 게 있나"이기 때문이다.
 */
function LatestBlood({ latest, prev }: { latest: BloodRow; prev?: BloodRow }) {
  const date = new Date(latest.testedAt);
  const flagged = flaggedIn(latest, prev ?? null);
  const worry = flagged.filter((f) => f.concerning);

  return (
    <div style={{ marginTop: 16 }}>
      <p className="field-hint" style={{ margin: 0 }}>
        {date.getFullYear()}. {date.getMonth() + 1}. {date.getDate()} · 항목{" "}
        {latest.results.length}개
      </p>

      {flagged.length === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: "0.9rem", fontWeight: 600 }}>
          참고구간을 벗어난 항목이 없어요.
        </p>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            벗어난 항목 <strong>{flagged.length}개</strong>
            {worry.length > 0 && worry.length !== flagged.length
              ? ` · 살펴볼 것 ${worry.length}개`
              : ""}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {flagged.slice(0, 4).map((f) => (
              <span
                key={f.analyte.code}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: f.concerning
                    ? "var(--danger-subtle)"
                    : "var(--point-subtle)",
                  color: f.concerning ? "var(--danger)" : "var(--point)",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                }}
              >
                {f.analyte.label}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {f.result.value}
                </span>
                <span aria-hidden="true">{f.status === "high" ? "↑" : "↓"}</span>
              </span>
            ))}
            {flagged.length > 4 ? (
              <span
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "var(--bg-secondary)",
                  color: "var(--text-muted)",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                }}
              >
                외 {flagged.length - 4}개
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

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

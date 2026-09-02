"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSession, type SessionUser } from "@/lib/session";

/** 임시 홈 — 다음 단계에서 대시보드로 채운다. */
export default function HomePage() {
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", margin: "0 0 0.5rem" }}>FitLog</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 0 }}>
        {session ? `${session.name}님, 안녕하세요.` : "로그인이 필요합니다."}
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <Link href="/measurements" style={cardStyle}>
          인바디 기록 보기
        </Link>
        <Link href="/weight" style={cardStyle}>
          체중 기록하기
        </Link>
        <Link href="/charts" style={cardStyle}>
          추이 그래프
        </Link>
      </div>
    </div>
  );
}

const cardStyle = {
  display: "block",
  padding: "1rem 1.2rem",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  textDecoration: "none",
  fontWeight: 600,
} as const;

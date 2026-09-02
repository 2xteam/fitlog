"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { loadSession, saveSession, type SessionUser } from "@/lib/session";

export default function StartPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loadSession()) router.replace("/home");
  }, [router]);

  const login = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "로그인에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      router.replace("/home");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [phone, pin, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background: "var(--bg-primary)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--bg-card)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}
      >
        <h1
          style={{
            margin: "0 0 0.25rem",
            fontSize: "1.75rem",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AppIcon size={36} priority className="app-brand-icon" />
          <span style={{ fontStyle: "italic", fontWeight: 900, color: "var(--accent)" }}>SnapWord</span>
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "var(--text-secondary)", fontSize: 14 }}>
          전화번호와 PIN으로 로그인하세요.
        </p>
        <label style={lab}>
          전화번호
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            style={inp}
          />
        </label>
        <label style={{ ...lab, marginBottom: "1.25rem" }}>
          PIN
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4자 이상"
            style={inp}
          />
        </label>
        <button
          type="button"
          onClick={login}
          disabled={busy}
          style={{
            width: "100%",
            padding: "0.85rem",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: busy ? "var(--text-muted)" : "var(--accent)",
            color: "#000",
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            marginBottom: "0.75rem",
            fontSize: 15,
          }}
        >
          {busy ? "확인 중…" : "로그인"}
        </button>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <Link
            href="/register"
            style={{
              color: "var(--accent)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            회원가입
          </Link>
          <Link
            href="/find-phone"
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            전화번호 찾기
          </Link>
          <Link
            href="/forgot-pin"
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            PIN 찾기
          </Link>
        </div>
        {msg ? (
          <p style={{ margin: "1rem 0 0", color: "var(--danger)", fontSize: 13 }}>{msg}</p>
        ) : null}
      </div>
    </main>
  );
}

const lab: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: "1rem",
  fontSize: 13,
  color: "var(--text-secondary)",
};

const inp: CSSProperties = {
  padding: "0.65rem 0.85rem",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
  fontSize: 16,
};

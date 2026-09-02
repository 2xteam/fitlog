"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { saveSession, type SessionUser } from "@/lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setMsg("이름을 입력해 주세요.");
      setBusy(false);
      return;
    }
    if (nameTrim.length > 100) {
      setMsg("이름은 100자 이하여야 합니다.");
      setBusy(false);
      return;
    }
    if (pin !== pin2) {
      setMsg("PIN과 PIN 확인이 일치하지 않습니다.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nameTrim,
          phone,
          email,
          pin,
          pinConfirm: pin2,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "가입에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      router.replace("/home");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [name, phone, email, pin, pin2, router]);

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
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
          회원가입
        </h1>
        <p style={{ margin: "0 0 1.25rem", color: "var(--text-secondary)", fontSize: 14 }}>
          이름, 전화번호, 이메일, PIN을 입력해 주세요.
        </p>
        <label style={lab}>
          이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="표시될 이름"
            style={inp}
          />
        </label>
        <label style={lab}>
          전화번호
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inp} />
        </label>
        <label style={lab}>
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="example@email.com"
            style={inp}
          />
        </label>
        <label style={lab}>
          PIN (4자 이상)
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} style={inp} />
        </label>
        <label style={lab}>
          PIN 확인
          <input type="password" value={pin2} onChange={(e) => setPin2(e.target.value)} style={inp} />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            marginTop: "0.5rem",
            padding: "0.85rem",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: busy ? "var(--text-muted)" : "var(--accent)",
            color: "#000",
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "처리 중…" : "가입하고 시작"}
        </button>
        <Link
          href="/"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: "1rem",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          로그인으로
        </Link>
        {msg ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}
      </div>
    </main>
  );
}

const lab: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: "0.85rem",
  fontSize: 13,
  color: "var(--text-secondary)",
};

const inp: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
  fontSize: 16,
};

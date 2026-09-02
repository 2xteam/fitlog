"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type Inquiry = {
  id: string;
  category: string;
  title: string;
  content: string;
  status: "pending" | "answered";
  answer: string;
  answeredAt: string | null;
  createdAt: string;
};

const CATEGORIES = [
  { value: "bug", label: "버그 신고" },
  { value: "feature", label: "기능 요청" },
  { value: "account", label: "계정 문의" },
  { value: "other", label: "기타" },
] as const;

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

type Tab = "list" | "new";

export default function InquiriesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>("list");

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("other");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  const fetchList = useCallback(async (s: SessionUser) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/inquiries?phone=${encodeURIComponent(s.phone)}&userId=${encodeURIComponent(s.id)}`,
      );
      const json = (await res.json()) as { ok: boolean; inquiries?: Inquiry[] };
      if (json.ok && json.inquiries) setInquiries(json.inquiries);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchList(session);
  }, [session, fetchList]);

  const submit = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setMsg(null);

    if (!title.trim()) { setMsg("제목을 입력해 주세요."); setBusy(false); return; }
    if (!content.trim()) { setMsg("내용을 입력해 주세요."); setBusy(false); return; }

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: session.phone,
          userId: session.id,
          category,
          title: title.trim(),
          content: content.trim(),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "문의 등록에 실패했습니다.");
        return;
      }
      setTitle("");
      setContent("");
      setCategory("other");
      setTab("list");
      fetchList(session);
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [session, category, title, content, fetchList]);

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>Q&A</h1>

      <div style={{ display: "flex", gap: 8 }}>
        {(["list", "new"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={tabBtn(tab === t)}
          >
            {{ list: "문의 내역", new: "새 문의 작성" }[t]}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div style={cardStyle}>
          <label style={lab}>
            카테고리
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inp}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <label style={lab}>
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문의 제목"
              style={inp}
            />
          </label>

          <label style={lab}>
            내용
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문의 내용을 자세히 작성해 주세요."
              rows={6}
              style={{ ...inp, resize: "vertical" }}
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={submitBtnStyle(busy)}
          >
            {busy ? "등록 중…" : "문의 등록"}
          </button>

          {msg ? <p style={{ margin: "0.75rem 0 0", color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}
        </div>
      )}

      {tab === "list" && (
        <>
          {loading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩 중…</p>
          ) : inquiries.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                문의 내역이 없습니다.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {inquiries.map((inq) => {
                const expanded = expandedId === inq.id;
                return (
                  <div key={inq.id} style={cardStyle}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : inq.id)}
                      style={expandBtn}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={statusBadge(inq.status)}>
                          {inq.status === "answered" ? "답변 완료" : "대기 중"}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {categoryLabel(inq.category)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                        {inq.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {new Date(inq.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </button>

                    {expanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                          {inq.content}
                        </div>

                        {inq.status === "answered" && inq.answer && (
                          <div style={{
                            marginTop: 16,
                            padding: "12px 14px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--accent-subtle)",
                            borderLeft: "3px solid var(--accent)",
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>답변</div>
                            <div style={{ fontSize: 14, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                              {inq.answer}
                            </div>
                            {inq.answeredAt && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                                {new Date(inq.answeredAt).toLocaleDateString("ko-KR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const expandBtn: CSSProperties = {
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  color: "inherit",
};

function tabBtn(active: boolean): CSSProperties {
  return {
    padding: "0.55rem 1.1rem",
    borderRadius: "var(--radius-full)",
    border: "none",
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#000" : "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  };
}

function statusBadge(status: string): CSSProperties {
  const answered = status === "answered";
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "var(--radius-full)",
    fontSize: 11,
    fontWeight: 600,
    background: answered ? "var(--success-subtle)" : "var(--warning)",
    color: answered ? "var(--success)" : "#000",
  };
}

const cardStyle: CSSProperties = {
  padding: "1rem 1.15rem",
  borderRadius: "var(--radius-lg)",
  background: "var(--bg-card)",
};

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
  fontSize: 15,
};

function submitBtnStyle(b: boolean): CSSProperties {
  return {
    width: "100%",
    marginTop: "0.25rem",
    padding: "0.85rem",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: b ? "var(--text-muted)" : "var(--accent)",
    color: "#000",
    fontWeight: 600,
    fontSize: 15,
    cursor: b ? "default" : "pointer",
  };
}

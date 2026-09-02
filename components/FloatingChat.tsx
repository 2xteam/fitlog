"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { loadSession, type SessionUser } from "@/lib/session";

type Thread = { _id: string; title: string; updatedAt: string };
type Msg = { _id: string; role: string; content: string; createdAt: string };

const DRAFT_ID = "__draft__";

export function openFloatingChat(message: string, cacheWord?: string) {
  window.dispatchEvent(
    new CustomEvent("floating-chat-send", { detail: { message, cacheWord } }),
  );
}

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const pendingMsg = useRef<string | null>(null);
  const cacheWord = useRef<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (s) setSession(s);
  }, []);

  const refreshTokenBalance = useCallback(async (s: SessionUser) => {
    if (!IS_TOKEN_SYSTEM_ENABLED) return;

    try {
      const res = await fetch(`/api/token-balance?userId=${encodeURIComponent(s.id)}`);
      const json = (await res.json()) as { ok: boolean; tokens?: number };
      if (json.ok) setTokenBalance(json.tokens ?? 0);
    } catch { /* ignore */ }
  }, []);

  const loadThreads = useCallback(async (s: SessionUser) => {
    const res = await fetch(
      `/api/chat/threads?phone=${encodeURIComponent(s.phone)}&userId=${encodeURIComponent(s.id)}`,
    );
    const json = (await res.json()) as { ok: boolean; items?: Thread[] };
    if (json.ok && json.items) setThreads(json.items);
  }, []);

  const fetchMessages = useCallback(
    async (s: SessionUser, threadId: string) => {
      const res = await fetch(
        `/api/chat/threads/${threadId}/messages?phone=${encodeURIComponent(s.phone)}&userId=${encodeURIComponent(s.id)}`,
      );
      const json = (await res.json()) as { ok: boolean; items?: Msg[] };
      if (json.ok && json.items) setMessages(json.items);
      else setMessages([]);
    },
    [],
  );

  const openThread = useCallback(
    async (id: string, s: SessionUser) => {
      setActive(id);
      setHistoryOpen(false);
      if (id === DRAFT_ID) {
        setMessages([]);
        return;
      }
      await fetchMessages(s, id);
    },
    [fetchMessages],
  );

  useEffect(() => {
    if (!session || !open) return;
    let cancelled = false;

    (async () => {
      await refreshTokenBalance(session);
      const res = await fetch(
        `/api/chat/threads?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}`,
      );
      const json = (await res.json()) as { ok: boolean; items?: Thread[] };
      if (cancelled) return;
      const list = json.ok && json.items ? json.items : [];
      setThreads(list);

      if (pendingMsg.current) {
        const msg = pendingMsg.current;
        pendingMsg.current = null;
        await sendText(msg);
        return;
      }

      if (active) return;
      if (list.length > 0) {
        const latest = list[0]!;
        setActive(latest._id);
        await fetchMessages(session, latest._id);
      } else {
        setActive(DRAFT_ID);
        setMessages([]);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, open]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const startNewDraft = () => {
    setActive(DRAFT_ID);
    setMessages([]);
    setInput("");
    setHistoryOpen(false);
  };

  const sendText = useCallback(async (textOverride?: string) => {
    const text = textOverride ?? input.trim();
    if (!session || !text) return;
    if (!textOverride) setInput("");

    let threadId = active;

    if (threadId === DRAFT_ID || !threadId) {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: session.phone, userId: session.id }),
      });
      const json = (await res.json()) as { ok: boolean; id?: string };
      if (!json.ok || !json.id) return;
      threadId = json.id;
      setActive(threadId);
      const now = new Date().toISOString();
      setThreads((prev) => [{ _id: threadId!, title: "새 대화", updatedAt: now }, ...prev]);
    }

    const pendingUserId = `local-user-${Date.now()}`;
    const pendingAiId = `local-ai-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((m) => [
      ...m,
      { _id: pendingUserId, role: "user", content: text, createdAt: now },
      { _id: pendingAiId, role: "assistant", content: "", createdAt: now },
    ]);
    setBusy(true);
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: session.phone, userId: session.id, text }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        threadTitle?: string | null;
      };
      if (!res.ok || !json.ok) {
        setMessages((m) =>
          m.filter((x) => x._id !== pendingUserId && x._id !== pendingAiId).concat([
            { _id: `err-${Date.now()}`, role: "assistant", content: json.error ?? "오류", createdAt: new Date().toISOString() },
          ]),
        );
        setInput(text);
        return;
      }
      if (json.threadTitle) {
        setThreads((prev) =>
          prev.map((t) => (t._id === threadId ? { ...t, title: json.threadTitle! } : t)),
        );
      }
      await fetchMessages(session, threadId);
      await loadThreads(session);
      await refreshTokenBalance(session);

      if (cacheWord.current) {
        const wordToCache = cacheWord.current;
        const promptToCache = text;
        cacheWord.current = null;
        setMessages((msgs) => {
          const last = [...msgs].reverse().find((m) => m.role === "assistant" && !m._id.startsWith("local-") && !m._id.startsWith("err-"));
          if (last?.content) {
            fetch("/api/ai-cache", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ word: wordToCache, prompt: promptToCache, answer: last.content }),
            }).catch(() => {});
          }
          return msgs;
        });
      }
    } catch {
      setMessages((m) =>
        m.filter((x) => x._id !== pendingUserId && x._id !== pendingAiId).concat([
          { _id: `err-${Date.now()}`, role: "assistant", content: "네트워크 오류로 전송에 실패했습니다.", createdAt: new Date().toISOString() },
        ]),
      );
      setInput(text);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, active, input, fetchMessages, loadThreads]);

  const send = useCallback(() => void sendText(), [sendText]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; cacheWord?: string }>).detail;
      if (!detail.message) return;
      pendingMsg.current = detail.message;
      cacheWord.current = detail.cacheWord ?? null;
      setActive(DRAFT_ID);
      setMessages([]);
      setInput("");
      setHistoryOpen(false);
      setOpen(true);
    };
    window.addEventListener("floating-chat-send", handler);
    return () => window.removeEventListener("floating-chat-send", handler);
  }, []);

  if (!session) return null;

  const activeTitle =
    active === DRAFT_ID
      ? "새 대화"
      : threads.find((t) => t._id === active)?.title ?? "대화";

  const HISTORY_W = 240;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0, 0, 0, 0.15)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* FAB (Floating Action Button) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="채팅 열기"
          style={fabStyle}
          data-guide="chat-fab"
        >
          <SmileyFabIcon />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              title={historyOpen ? "대화 이력 접기" : "대화 이력 펼치기"}
              aria-expanded={historyOpen}
              aria-label={historyOpen ? "대화 이력 접기" : "대화 이력 펼치기"}
              style={headerBtnStyle}
            >
              {historyOpen ? <IconChevronLeft /> : <IconMenu />}
            </button>
            <span style={titleStyle}>{activeTitle}</span>
            <button
              type="button"
              onClick={startNewDraft}
              style={newChatBtnStyle}
              title="새 채팅"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="채팅 닫기"
              style={closeBtnStyle}
            >
              <IconClose />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative", overflow: "hidden" }}>
            {/* Messages */}
            <div style={messagesContainerStyle}>
              {messages.length === 0 && active === DRAFT_ID ? (
                <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>메시지를 입력하여 대화를 시작하세요.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isPendingAi = m._id.startsWith("local-ai-") && busy;
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m._id}
                      style={{ display: "flex", width: "100%", justifyContent: isUser ? "flex-end" : "flex-start", flexShrink: 0 }}
                    >
                      <div
                        className={`chat-md ${isUser ? "chat-md-user" : ""}`}
                        style={{
                          maxWidth: "88%",
                          padding: "0.45rem 0.65rem",
                          borderRadius: isUser ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
                          background: isUser ? "var(--accent)" : m._id.startsWith("err-") ? "var(--danger-subtle)" : "var(--bg-elevated)",
                          color: isUser ? "#fff" : m._id.startsWith("err-") ? "#fca5a5" : "var(--text-primary)",
                          fontSize: 13,
                          border: isPendingAi ? "1px dashed var(--text-muted)" : undefined,
                        }}
                      >
                        {isPendingAi ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span className="snapword-chat-wait" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              응답을 작성하는 중입니다…
                            </span>
                            <span style={{ display: "flex", alignItems: "center" }} aria-hidden>
                              <span className="snapword-chat-dot" />
                              <span className="snapword-chat-dot" />
                              <span className="snapword-chat-dot" />
                            </span>
                          </div>
                        ) : (
                          <Markdown>{m.content}</Markdown>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottom} />
            </div>

            {/* History Sidebar Overlay */}
            {historyOpen && (
              <div
                role="presentation"
                aria-hidden
                onClick={() => setHistoryOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 4,
                  background: "rgba(0, 0, 0, 0.35)",
                }}
              />
            )}

            {/* History Sidebar */}
            <aside
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: HISTORY_W,
                zIndex: 5,
                transform: historyOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.2s ease",
                background: "var(--bg-elevated)",
                borderRight: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                boxShadow: historyOpen ? "3px 0 16px rgba(0, 0, 0, 0.2)" : "none",
                pointerEvents: historyOpen ? "auto" : "none",
                overflow: "hidden",
              }}
              aria-hidden={!historyOpen}
            >
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, padding: "0.6rem", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>대화 이력</span>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    title="이력 패널 접기"
                    aria-label="대화 이력 패널 접기"
                    style={headerBtnStyle}
                  >
                    <IconChevronLeft />
                  </button>
                </div>
                <button type="button" onClick={startNewDraft} style={historyNewChatStyle}>
                  + 새 채팅
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minHeight: 0, overflowY: "auto" }}>
                  {threads.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => void openThread(t._id, session)}
                      style={{
                        textAlign: "left",
                        padding: "0.4rem 0.5rem",
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: "pointer",
                        border: active === t._id ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: active === t._id ? "var(--accent-subtle)" : "var(--bg-card)",
                        color: active === t._id ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: active === t._id ? 600 : 500,
                        height: 34,
                        flexShrink: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          {/* Input */}
          {IS_TOKEN_SYSTEM_ENABLED && tokenBalance !== null && tokenBalance <= 0 ? (
            <div style={{ ...inputBarStyle, justifyContent: "center", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
              아쉽지만 토큰이 부족하여 진행하기 어렵습니다. 토큰을 충전해보세요!
            </div>
          ) : (
            <div style={inputBarStyle}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? "응답 대기 중…" : "메시지를 입력하세요…"}
                disabled={busy}
                style={{ flex: 1, fontSize: 13, opacity: busy ? 0.75 : 1, minWidth: 0 }}
                onKeyDown={(e) => e.key === "Enter" && !busy && void send()}
              />
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void send()}
                style={{ ...sendBtnStyle, opacity: busy ? 0.85 : 1, cursor: busy ? "wait" : "pointer" }}
              >
                {busy ? "…" : <IconSend />}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Icons ── */

function SmileyFabIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="31" fill="var(--accent)" />
      <circle cx="22" cy="26" r="4.5" fill="rgba(0,0,0,0.55)" />
      <circle cx="42" cy="26" r="4.5" fill="rgba(0,0,0,0.55)" />
      <circle cx="23.5" cy="24" r="1.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="43.5" cy="24" r="1.5" fill="rgba(255,255,255,0.5)" />
      <path d="M22 38 Q32 48, 42 38" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22l-4-9-9-4L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Styles ── */

const fabStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 9999,
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "none",
  background: "none",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: "fab-spin 6s linear infinite",
  filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.35))",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 9999,
  width: 380,
  maxWidth: "calc(100vw - 32px)",
  height: 520,
  maxHeight: "calc(100vh - 48px)",
  borderRadius: "var(--radius-lg)",
  background: "var(--bg-card)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  padding: "0.5rem 0.6rem",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
  background: "var(--bg-elevated)",
};

const headerBtnStyle: CSSProperties = {
  background: "var(--accent-subtle)",
  border: "none",
  borderRadius: 8,
  padding: "0.3rem",
  cursor: "pointer",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  color: "var(--text-primary)",
  fontSize: 13,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const newChatBtnStyle: CSSProperties = {
  background: "var(--accent-subtle)",
  border: "none",
  borderRadius: 8,
  padding: "0.25rem 0.5rem",
  cursor: "pointer",
  color: "var(--accent)",
  fontSize: 14,
  fontWeight: 700,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const closeBtnStyle: CSSProperties = {
  background: "var(--accent-subtle)",
  border: "none",
  borderRadius: 8,
  padding: "0.3rem",
  cursor: "pointer",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const messagesContainerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "0.6rem",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  width: "100%",
};

const inputBarStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "0.4rem 0.5rem",
  borderTop: "1px solid var(--border)",
  flexShrink: 0,
};

const sendBtnStyle: CSSProperties = {
  padding: "0.4rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const historyNewChatStyle: CSSProperties = {
  width: "100%",
  textAlign: "center",
  padding: "0.4rem",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

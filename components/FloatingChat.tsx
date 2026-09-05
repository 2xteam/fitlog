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
  /** 서버가 지금 무엇을 하고 있는지 — 첫 글자가 오기 전까지 보여준다 */
  const [stage, setStage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** 스레드를 불러오는 중 — 안내 문구가 깜빡이지 않게 한다 */
  const [hydrating, setHydrating] = useState(false);
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
      // 불러오는 동안에는 빈 화면 안내를 띄우지 않는다 (이력이 있는데 깜빡인다)
      setHydrating(true);
      try {
        const res = await fetch(
          `/api/chat/threads/${threadId}/messages?phone=${encodeURIComponent(s.phone)}&userId=${encodeURIComponent(s.id)}`,
        );
        const json = (await res.json()) as { ok: boolean; items?: Msg[] };
        if (json.ok && json.items) setMessages(json.items);
        else setMessages([]);
      } catch {
        setMessages([]);
      } finally {
        setHydrating(false);
      }
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
    setHydrating(true);

    (async () => {
      await refreshTokenBalance(session);

      // 대화 이력을 못 불러와도 새 대화는 시작할 수 있어야 한다
      let list: Thread[] = [];
      try {
        const res = await fetch(
          `/api/chat/threads?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}`,
        );
        const json = (await res.json()) as { ok: boolean; items?: Thread[] };
        if (json.ok && json.items) list = json.items;
      } catch {
        /* 목록 없이 진행 */
      }
      if (cancelled) return;
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
    })().finally(() => {
      if (!cancelled) setHydrating(false);
    });

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
      // 대화방 생성이 실패하면 조용히 사라지지 않고 이유를 보여준다
      let created: string | null = null;
      try {
        const res = await fetch("/api/chat/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: session.phone, userId: session.id }),
        });
        const json = (await res.json()) as { ok: boolean; id?: string };
        if (json.ok && json.id) created = json.id;
      } catch {
        /* 아래에서 안내 */
      }
      if (!created) {
        setMessages((m) => [
          ...m,
          {
            _id: `err-${Date.now()}`,
            role: "assistant",
            content: "지금은 상담사와 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      threadId = created;
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
    setStage("records");
    try {
      /*
        스트리밍으로 받는다. 한 번에 받으면 답이 다 만들어질 때까지 화면이 비어 있고,
        길수록 더 오래 비어 있다. 여기서는 서버가 실제 진행 단계와 본문 조각을
        흘려보내고, 받는 대로 그 자리에 쌓는다.
      */
      const res = await fetch(`/api/chat/threads/${threadId}/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: session.phone, userId: session.id, text }),
      });

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessages((m) =>
          m.filter((x) => x._id !== pendingUserId && x._id !== pendingAiId).concat([
            { _id: `err-${Date.now()}`, role: "assistant", content: err?.error ?? "오류", createdAt: new Date().toISOString() },
          ]),
        );
        setInput(text);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamed = "";
      let threadTitle: string | null = null;
      let failed: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE는 빈 줄로 이벤트를 가른다. 마지막 조각은 아직 덜 왔을 수 있어 남겨둔다
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (ev.type === "stage") {
            setStage(String(ev.stage));
          } else if (ev.type === "delta" && typeof ev.text === "string") {
            setStage(null);
            streamed += ev.text;
            setMessages((m) =>
              m.map((x) => (x._id === pendingAiId ? { ...x, content: streamed } : x)),
            );
          } else if (ev.type === "done") {
            threadTitle = (ev.threadTitle as string | null) ?? null;
            if (typeof ev.assistantText === "string" && ev.assistantText) {
              streamed = ev.assistantText;
            }
          } else if (ev.type === "error") {
            failed = String(ev.error ?? "오류");
          }
        }
      }

      setStage(null);

      if (failed) {
        setMessages((m) =>
          m.filter((x) => x._id !== pendingUserId && x._id !== pendingAiId).concat([
            { _id: `err-${Date.now()}`, role: "assistant", content: failed, createdAt: new Date().toISOString() },
          ]),
        );
        setInput(text);
        return;
      }

      if (threadTitle) {
        setThreads((prev) =>
          prev.map((t) => (t._id === threadId ? { ...t, title: threadTitle! } : t)),
        );
      }

      // 저장된 이력으로 맞춘다 (임시 id를 실제 id로 바꾸기 위해)
      await fetchMessages(session, threadId);
      await loadThreads(session);
      await refreshTokenBalance(session);

      if (cacheWord.current) {
        const wordToCache = cacheWord.current;
        const promptToCache = text;
        cacheWord.current = null;
        if (streamed) {
          fetch("/api/ai-cache", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ word: wordToCache, prompt: promptToCache, answer: streamed }),
          }).catch(() => {});
        }
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
      setStage(null);
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
          <FlexFabIcon />
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
              {hydrating && messages.length === 0 ? (
                <ChatSkeleton />
              ) : messages.length === 0 ? (
                <EmptyGuide onPick={(q) => void sendText(q)} />
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
                          color: isUser
                            ? "var(--on-accent)"
                            : m._id.startsWith("err-")
                              ? "var(--danger)"
                              : "var(--text-primary)",
                          fontSize: 13,
                          border: isPendingAi ? "1px dashed var(--text-muted)" : undefined,
                        }}
                      >
                        {isPendingAi && !m.content ? (
                          <StageIndicator stage={stage} />
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

/* ── 빈 화면 안내 ── */

/** 상담사가 무엇을 도와줄 수 있는지 대화처럼 먼저 보여준다 */
const SUGGESTIONS = [
  "최근 인바디 결과를 요약해줘",
  "이번 피검사에서 벗어난 항목만 알려줘",
  "골격근량을 늘리려면 뭘 해야 해?",
  "중성지방을 낮추려면 뭘 바꿔야 할까?",
  "내 근육량을 감안하면 신장 수치를 어떻게 봐야 해?",
  "지난 기록과 비교해서 뭐가 달라졌어?",
];


/**
 * 대기 표시 — **지어낸 문구를 돌리지 않는다.**
 *
 * 서버가 보내는 실제 단계를 그대로 보여준다. 기록을 읽는 데 몇 초, 참고 자료를
 * 고르는 데 몇 초가 실제로 든다. 그럴듯한 문구를 순환시키는 것과 다른 점은,
 * **어디서 오래 걸리는지가 눈에 보인다**는 것이다. 사용자에게도, 나중에 고칠
 * 우리에게도 쓸모가 있다.
 *
 * 첫 글자가 도착하면 이 표시는 사라지고 본문이 그 자리에 쌓인다.
 */
const STAGE_TEXT: Record<string, string> = {
  conversation: "대화를 여는 중",
  records: "내 기록을 읽는 중",
  knowledge: "참고 자료를 찾는 중",
  thinking: "답을 정리하는 중",
};

function StageIndicator({ stage }: { stage: string | null }) {
  const text = (stage && STAGE_TEXT[stage]) ?? "준비하는 중";
  const order = ["records", "knowledge", "thinking"];
  const at = stage ? order.indexOf(stage) : -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150 }}>
      <span
        className="snapword-chat-wait"
        style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}
      >
        {text}…
      </span>

      {/* 어디까지 왔는지 — 세 마디로 */}
      <span style={{ display: "flex", gap: 4 }} aria-hidden>
        {order.map((k, i) => (
          <span
            key={k}
            style={{
              height: 3,
              width: 22,
              borderRadius: 999,
              background:
                at >= i && at >= 0 ? "var(--accent)" : "var(--border)",
              transition: "background .25s ease",
            }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * 첫 로딩 스켈레톤.
 *
 * 예전에는 이력을 불러오는 동안 완전히 빈 화면이었다. 흰 화면은 "없다"로 읽히는데
 * 실제로는 곧 나타난다. 대화 모양의 자리를 미리 잡아두면 그 오해가 없어진다.
 */
function ChatSkeleton() {
  const rows: Array<{ w: number; mine: boolean }> = [
    { w: 52, mine: true },
    { w: 88, mine: false },
    { w: 70, mine: false },
    { w: 40, mine: true },
    { w: 80, mine: false },
  ];
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}
      aria-hidden
    >
      {rows.map((r, i) => (
        <div
          key={i}
          style={{ display: "flex", justifyContent: r.mine ? "flex-end" : "flex-start" }}
        >
          <span
            className="chat-skeleton"
            style={{
              display: "block",
              width: `${r.w}%`,
              height: r.mine ? 30 : 52,
              borderRadius: r.mine ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
            }}
          />
        </div>
      ))}
      <span className="sr-only">대화를 불러오는 중</span>
    </div>
  );
}

function EmptyGuide({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
      <GuideBubble text="안녕하세요, **AI Fit 상담사**예요. 기록해 둔 인바디 수치를 바탕으로 지금 상태와 다음 할 일을 같이 정리해 드려요." />
      <GuideBubble text="이런 걸 물어볼 수 있어요 👇" />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="chat-suggestion"
            onClick={() => onPick(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>
        눌러서 바로 물어보거나, 아래에 직접 입력해도 돼요.
      </p>
    </div>
  );
}

function GuideBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", width: "100%", justifyContent: "flex-start", flexShrink: 0 }}>
      <div
        className="chat-md"
        style={{
          maxWidth: "88%",
          padding: "0.45rem 0.65rem",
          borderRadius: "10px 10px 10px 3px",
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: 13,
        }}
      >
        <Markdown>{text}</Markdown>
      </div>
    </div>
  );
}

/* ── Icons ── */

/**
 * 근육을 불끈 쥐는 팔.
 * 팔 전체가 살짝 조여졌다 펴지고(`fab-arm`), 이두가 부풀며(`fab-bicep`),
 * 그 순간 링과 스파크가 한 번 퍼진다(`fab-burst` · `fab-spark`).
 * 애니메이션은 globals.css 에 있다.
 */
function FlexFabIcon() {
  const fg = "var(--chat-fab-fg, #21083f)";
  const bg = "var(--chat-fab-bg, var(--accent))";
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="31" fill={bg} />

      {/* 불끈할 때 한 번 퍼지는 링 */}
      <circle
        className="fab-burst"
        cx="32"
        cy="32"
        r="27.5"
        fill="none"
        stroke={fg}
        strokeWidth="1.8"
      />

      {/* 팔은 선화(아웃라인)로 그린다 — 주먹 · 엄지 · 아래팔 · 바깥 윤곽 · 이두 · 주름.
          크기 조정은 **바깥 그룹**에서 한다. `fab-arm`의 CSS 애니메이션 transform 이
          같은 요소의 transform 속성을 덮어쓰기 때문이다. */}
      <g transform="translate(6.4 6.4) scale(0.8)">
        <g
          className="fab-arm"
          fill="none"
          stroke={fg}
          strokeWidth="2.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M28 20 q-3 -13 8 -13 q10 0 8 13" />
          <path d="M28 20 q-5 1 -4 4 q1 4 7 3" />
          <path d="M34 23 q3 7 2 13" />
          <path d="M44 20 q6 11 5 22 q-1 9 -8 11 q-9 3 -21 1" />

          {/* 이두 — 여기만 부푼다 */}
          <g className="fab-bicep">
            <path d="M9 38 q10 -12 23 -6 q4 2 5 5" />
            <path d="M20 45 q11 5 20 1" />
          </g>
        </g>
      </g>

      {/* 불끈 순간의 스파크 */}
      <g className="fab-spark" stroke={fg} strokeWidth="2.4" strokeLinecap="round">
        <path d="M15 25 L11 21" />
        <path d="M31 9 L30 4" />
        <path d="M49 40 L54 39" />
      </g>
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
  filter: "drop-shadow(0 4px 14px rgba(38,13,63,.28))",
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
  // 결쩜사는 순수 검정을 쓰지 않는다. 그림자에도 보라를 섞는다
  border: "1px solid var(--border)",
  boxShadow: "0 1px 2px rgba(38,13,63,.06), 0 18px 50px rgba(38,13,63,.18)",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  padding: "0.55rem 0.65rem",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
  background: "var(--bg-secondary)",
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
  padding: "0.75rem 0.7rem",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: "100%",
  background: "var(--bg-primary)",
};

const inputBarStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "0.5rem 0.55rem",
  borderTop: "1px solid var(--border-subtle)",
  background: "var(--bg-secondary)",
  flexShrink: 0,
};

const sendBtnStyle: CSSProperties = {
  padding: "0.4rem 0.8rem",
  borderRadius: "var(--radius-sm)",
  border: "none",
  // 결쩜사 버튼 — 단색이 아니라 보라 그라디언트
  background: "linear-gradient(135deg, #8150E8, #6830C8)",
  boxShadow: "0 6px 16px rgba(104,48,200,.18)",
  color: "var(--on-accent)",
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
  background: "linear-gradient(135deg, #8150E8, #6830C8)",
  boxShadow: "0 6px 16px rgba(104,48,200,.18)",
  color: "var(--on-accent)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

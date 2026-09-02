"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { loadSession, type SessionUser } from "@/lib/session";

type Notice = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
};

type EventItem = {
  id: string;
  title: string;
  description: string;
  rewardTokens: number;
  maxPerUser: number;
  createdAt: string;
};

type Tab = "notice" | "event";

export default function NoticePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>("notice");

  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventCode, setEventCode] = useState<Record<string, string>>({});
  const [eventBusy, setEventBusy] = useState<string | null>(null);
  const [eventMsg, setEventMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  useEffect(() => {
    (async () => {
      setNoticeLoading(true);
      try {
        const res = await fetch("/api/notices");
        const json = (await res.json()) as { ok: boolean; notices?: Notice[] };
        if (json.ok && json.notices) setNotices(json.notices);
      } catch { /* ignore */ }
      setNoticeLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setEventLoading(true);
      try {
        const res = await fetch("/api/events");
        const json = (await res.json()) as { ok: boolean; events?: EventItem[] };
        if (json.ok && json.events) setEvents(json.events);
      } catch { /* ignore */ }
      setEventLoading(false);
    })();
  }, []);

  const participateEvent = useCallback(async (eventId: string) => {
    if (!session) return;
    const code = (eventCode[eventId] ?? "").trim();
    if (!code) {
      setEventMsg((p) => ({ ...p, [eventId]: "코드를 입력해 주세요." }));
      return;
    }

    setEventBusy(eventId);
    setEventMsg((p) => ({ ...p, [eventId]: "" }));

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          phone: session.phone,
          eventId,
          code,
        }),
      });
      const json = (await res.json()) as { ok: boolean; rewardTokens?: number; error?: string };
      if (!res.ok || !json.ok) {
        setEventMsg((p) => ({ ...p, [eventId]: json.error ?? "참여에 실패했습니다." }));
        return;
      }
      setEventMsg((p) => ({
        ...p,
        [eventId]: IS_TOKEN_SYSTEM_ENABLED
          ? `🎉 ${json.rewardTokens}토큰을 받았습니다!`
          : "참여가 완료되었습니다.",
      }));
      setEventCode((p) => ({ ...p, [eventId]: "" }));
    } catch {
      setEventMsg((p) => ({ ...p, [eventId]: "네트워크 오류입니다." }));
    } finally {
      setEventBusy(null);
    }
  }, [session, eventCode]);

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>Notice</h1>

      <div style={{ display: "flex", gap: 8 }}>
        {(["notice", "event"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={tabBtn(tab === t)}
          >
            {{ event: "이벤트", notice: "공지" }[t]}
          </button>
        ))}
      </div>

      {tab === "notice" && (
        <>
          {noticeLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩 중…</p>
          ) : notices.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>공지사항이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {notices.map((n) => {
                const expanded = expandedNotice === n.id;
                return (
                  <div key={n.id} style={cardStyle}>
                    <button
                      type="button"
                      onClick={() => setExpandedNotice(expanded ? null : n.id)}
                      style={expandBtn}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        {n.pinned && (
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "var(--accent-subtle)",
                            color: "var(--accent)",
                          }}>
                            고정
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                        {n.title}
                      </div>
                    </button>
                    {expanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 14, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                        {n.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "event" && (
        <>
          {eventLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩 중…</p>
          ) : events.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>진행 중인 이벤트가 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {events.map((ev) => (
                <div key={ev.id} style={cardStyle}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 4 }}>
                    {ev.title}
                  </div>
                  {ev.description && (
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {ev.description}
                    </p>
                  )}
                  {IS_TOKEN_SYSTEM_ENABLED && (
                    <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, marginBottom: 8 }}>
                      보상: {ev.rewardTokens} 토큰
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      placeholder="코드 입력"
                      value={eventCode[ev.id] ?? ""}
                      onChange={(e) => setEventCode((p) => ({ ...p, [ev.id]: e.target.value }))}
                      style={{ ...inp, flex: 1 }}
                    />
                    <button
                      type="button"
                      disabled={eventBusy === ev.id}
                      onClick={() => participateEvent(ev.id)}
                      style={{
                        padding: "0.65rem 1rem",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: eventBusy === ev.id ? "var(--text-muted)" : "var(--accent)",
                        color: "#000",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: eventBusy === ev.id ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {eventBusy === ev.id ? "처리 중…" : "참여"}
                    </button>
                  </div>
                  {eventMsg[ev.id] && (
                    <p style={{
                      margin: "8px 0 0",
                      fontSize: 13,
                      color: eventMsg[ev.id].startsWith("🎉") ? "var(--success)" : "var(--danger)",
                    }}>
                      {eventMsg[ev.id]}
                    </p>
                  )}
                </div>
              ))}
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

const cardStyle: CSSProperties = {
  padding: "1rem 1.15rem",
  borderRadius: "var(--radius-lg)",
  background: "var(--bg-card)",
};

const inp: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
  fontSize: 15,
};

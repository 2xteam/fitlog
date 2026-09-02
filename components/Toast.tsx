"use client";

import type { CSSProperties } from "react";
import { useEffect, useState, useCallback } from "react";

type ToastType = "ok" | "warn" | "err";
type ToastItem = { id: number; message: string; type: ToastType };

let _push: ((msg: string, type?: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = "ok") {
  _push?.(message, type);
}

let nextId = 0;

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, type: ToastType = "ok") => {
    const id = ++nextId;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2500);
  }, []);

  useEffect(() => {
    _push = push;
    return () => { _push = null; };
  }, [push]);

  if (items.length === 0) return null;

  return (
    <div style={container}>
      {items.map((t) => (
        <div key={t.id} style={{ ...toast, background: BG[t.type], color: FG[t.type] }}>
          {ICON[t.type]} {t.message}
        </div>
      ))}
    </div>
  );
}

const ICON: Record<ToastType, string> = { ok: "✅", warn: "⚠️", err: "❌" };
const BG: Record<ToastType, string> = {
  ok: "var(--accent)",
  warn: "var(--bg-elevated)",
  err: "var(--danger, #ef4444)",
};
const FG: Record<ToastType, string> = {
  ok: "#fff",
  warn: "var(--text-primary)",
  err: "#fff",
};

const container: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 99999,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  pointerEvents: "none",
};

const toast: CSSProperties = {
  padding: "10px 20px",
  borderRadius: "var(--radius-full)",
  fontSize: 13,
  fontWeight: 600,
  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
  animation: "rss-modal-overlay-in 0.2s ease",
  whiteSpace: "nowrap",
  pointerEvents: "auto",
};

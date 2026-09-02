"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { loadSession, type SessionUser } from "@/lib/session";
import { FIELDS, PRIMARY_FIELDS, pick } from "@/lib/inbody";

type Row = Record<string, unknown> & { _id: string; measuredAt: string };
type WeightRow = { date: string; weightKg: number };

type Point = { t: number; v: number; source: "inbody" | "scale" };

/**
 * 추이 그래프.
 * 라이브러리를 쓰지 않고 SVG로 직접 그린다 — 선 몇 개면 충분하고 번들도 가볍다.
 * 체중은 인바디 기록과 체중계 기록을 한 축에 겹쳐 그린다(인바디 점을 크게).
 */
export default function ChartsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [fieldPath, setFieldPath] = useState(PRIMARY_FIELDS[0]?.path ?? "");

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  const load = useCallback(async () => {
    if (!session) return;
    const [m, w] = await Promise.all([
      fetch(`/api/measurements?userId=${encodeURIComponent(session.id)}`).then((r) =>
        r.json(),
      ),
      fetch(`/api/weights?userId=${encodeURIComponent(session.id)}`).then((r) =>
        r.json(),
      ),
    ]);
    setRows((m.measurements ?? []) as Row[]);
    setWeights((w.weights ?? []) as WeightRow[]);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const field = FIELDS.find((f) => f.path === fieldPath) ?? PRIMARY_FIELDS[0];
  const isWeight = fieldPath === "composition.weight.value";

  const points: Point[] = useMemo(() => {
    const fromInbody: Point[] = [];
    for (const r of rows ?? []) {
      const v = pick(r, fieldPath);
      if (v != null) {
        fromInbody.push({ t: new Date(r.measuredAt).getTime(), v, source: "inbody" });
      }
    }

    const fromScale: Point[] = isWeight
      ? weights.map((w) => ({
          t: new Date(`${w.date}T09:00:00`).getTime(),
          v: w.weightKg,
          source: "scale" as const,
        }))
      : [];

    return [...fromInbody, ...fromScale].sort((a, b) => a.t - b.t);
  }, [rows, weights, fieldPath, isWeight]);

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="TRENDS"
        headline={
          <>
            쌓인 기록이
            <br />
            보여주는 변화
          </>
        }
        lead="항목을 골라 흐름을 확인해요. 체중은 체중계 기록도 함께 그려요."
      />

      <Sheet eyebrow="MAIN" headline="핵심 3종">
        <div style={{ marginTop: 18, display: "grid", gap: 22 }}>
          {PRIMARY_FIELDS.map((f) => (
            <MiniChart
              key={f.path}
              label={`${f.label} (${f.unit})`}
              points={toPoints(rows, f.path)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet tone="tint" eyebrow="BY FIELD" headline="항목별로 보기">
        <div style={{ marginTop: 16 }}>
          <select
            className="field-input"
            value={fieldPath}
            onChange={(e) => setFieldPath(e.target.value)}
          >
            {FIELDS.map((f) => (
              <option key={f.path} value={f.path}>
                {f.label}
                {f.unit ? ` (${f.unit})` : ""}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 20 }}>
            <MiniChart
              label={`${field?.label ?? ""}${field?.unit ? ` (${field.unit})` : ""}`}
              points={points}
              height={200}
            />
          </div>

          {isWeight ? (
            <p className="field-hint" style={{ marginTop: 10 }}>
              큰 점은 인바디 측정, 작은 점은 체중계 기록이에요.
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

/** 측정 목록에서 한 항목만 뽑아 시간순 점으로 만든다 */
function toPoints(rows: Row[] | null, path: string): Point[] {
  const out: Point[] = [];
  for (const r of rows ?? []) {
    const v = pick(r, path);
    if (v != null) {
      out.push({ t: new Date(r.measuredAt).getTime(), v, source: "inbody" });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** 의존성 없이 SVG로 그리는 라인 차트 */
function MiniChart({
  label,
  points,
  height = 150,
}: {
  label: string;
  points: Point[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div>
        <p className="field-label">{label}</p>
        <p className="field-hint" style={{ margin: 0 }}>
          아직 데이터가 없어요.
        </p>
      </div>
    );
  }

  const W = 640;
  const H = height;
  const pad = { l: 34, r: 12, t: 14, b: 22 };

  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const span = rawMax - rawMin || 1;
  const minY = rawMin - span * 0.15;
  const maxY = rawMax + span * 0.15;

  const px = (t: number) =>
    maxX === minX
      ? (W - pad.l - pad.r) / 2 + pad.l
      : pad.l + ((t - minX) / (maxX - minX)) * (W - pad.l - pad.r);
  const py = (v: number) =>
    pad.t + (1 - (v - minY) / (maxY - minY)) * (H - pad.t - pad.b);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${px(p.t)} ${py(p.v)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}`;
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <p className="field-label" style={{ marginBottom: 6 }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
          {last.v}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", overflow: "visible" }}
        role="img"
        aria-label={label}
      >
        {/* 가로 기준선 */}
        {[0, 0.5, 1].map((r) => {
          const y = pad.t + r * (H - pad.t - pad.b);
          return (
            <line
              key={r}
              x1={pad.l}
              x2={W - pad.r}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
            />
          );
        })}

        {/* 값 축 라벨 */}
        <text x="0" y={pad.t + 4} fontSize="10" fill="var(--text-muted)">
          {Math.round(maxY * 10) / 10}
        </text>
        <text x="0" y={H - pad.b + 4} fontSize="10" fill="var(--text-muted)">
          {Math.round(minY * 10) / 10}
        </text>

        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />

        {points.map((p, i) => (
          <circle
            key={`${p.t}-${i}`}
            cx={px(p.t)}
            cy={py(p.v)}
            r={p.source === "inbody" ? 4 : 2.2}
            fill={p.source === "inbody" ? "var(--accent)" : "var(--point)"}
          />
        ))}

        {/* 날짜 축 */}
        <text x={pad.l} y={H - 4} fontSize="10" fill="var(--text-muted)">
          {fmt(first.t)}
        </text>
        <text
          x={W - pad.r}
          y={H - 4}
          fontSize="10"
          textAnchor="end"
          fill="var(--text-muted)"
        >
          {fmt(last.t)}
        </text>
      </svg>
    </div>
  );
}

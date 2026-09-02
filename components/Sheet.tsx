import type { ReactNode } from "react";

/**
 * 결쩜사 패턴의 "시트" — 옅은 배경 위에 얹는 둥근 카드.
 * 시트마다 eyebrow → 헤드라인 → 콘텐츠 순서를 지킨다.
 * 근거: my-obsidian-vault → 20-Design/결쩜사 페이지 패턴.md
 */
export function Sheet({
  tone = "plain",
  eyebrow,
  headline,
  lead,
  ornament = false,
  center = false,
  children,
}: {
  tone?: "plain" | "tint" | "dark" | "gold";
  eyebrow?: string;
  headline?: ReactNode;
  lead?: ReactNode;
  ornament?: boolean;
  center?: boolean;
  children?: ReactNode;
}) {
  const cls = [
    "sheet",
    tone === "tint" ? "sheet--tint" : "",
    tone === "dark" ? "sheet--dark" : "",
    tone === "gold" ? "sheet--gold" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={cls}>
      {ornament ? <Ornament light={tone === "dark"} /> : null}
      {eyebrow || headline || lead ? (
        <div style={center ? { textAlign: "center" } : undefined}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {headline ? <h2 className="headline">{headline}</h2> : null}
          {lead ? <p className="lead">{lead}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** 실(結)을 은유한 얇은 곡선 — 여백에만 놓는다 */
export function Ornament({ light = false }: { light?: boolean }) {
  const stroke = light ? "rgba(200,184,255,0.22)" : "rgba(139,92,246,0.14)";
  return (
    <svg className="sheet-ornament" viewBox="0 0 210 120" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth="1">
        <ellipse cx="120" cy="48" rx="105" ry="34" />
        <ellipse cx="120" cy="48" rx="76" ry="20" />
      </g>
      <circle cx="200" cy="42" r="2.5" fill="#c9a84c" opacity="0.7" />
    </svg>
  );
}

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
  center = false,
  children,
}: {
  tone?: "plain" | "tint" | "dark" | "gold";
  eyebrow?: string;
  headline?: ReactNode;
  lead?: ReactNode;
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

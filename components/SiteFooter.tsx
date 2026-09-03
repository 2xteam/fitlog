import type { CSSProperties } from "react";

/** 앱 하단 공통 푸터 — myjane 워드마크와 저작권 한 줄만 둔다 */
export function SiteFooter() {
  return (
    <footer style={wrapStyle}>
      <p style={lineStyle}>
        <a
          href="https://www.myjane.co.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="myjane-mark"
        >
          my<span>jane</span>
        </a>
      </p>
      <p style={copyStyle}>@2026 MyJane All rights reserved</p>
    </footer>
  );
}

const wrapStyle: CSSProperties = {
  marginTop: "3rem",
  paddingTop: "1.5rem",
  paddingBottom: "0.5rem",
  borderTop: "1px solid var(--border-subtle)",
  textAlign: "left",
};

const lineStyle: CSSProperties = {
  margin: 0,
};

const copyStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  fontSize: "0.75rem",
  color: "var(--text-muted)",
};

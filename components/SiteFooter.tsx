import type { CSSProperties } from "react";

/** 앱 하단 공통 푸터 — 서비스 설명과 MyJane 링크 */
export function SiteFooter() {
  return (
    <footer style={wrapStyle}>
      <p style={descStyle}>
        사진 한 장으로 단어를 뽑아 나만의 단어장을 만드는 학습 도구입니다.
      </p>
      <p style={lineStyle}>
        <a
          href="https://www.myjane.co.kr"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          MyJane
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

const descStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  color: "var(--text-muted)",
  wordBreak: "keep-all",
  lineHeight: 1.6,
};

const lineStyle: CSSProperties = {
  margin: "0.75rem 0 0",
};

const linkStyle: CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "var(--accent)",
  textDecoration: "none",
};

const copyStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  fontSize: "0.75rem",
  color: "var(--text-muted)",
};

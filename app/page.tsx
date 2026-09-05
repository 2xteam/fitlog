import type { CSSProperties } from "react";
import { AppIcon } from "@/components/AppIcon";
import { LandingCta, LandingHeaderAuth } from "@/components/LandingAuth";
import { Sheet } from "@/components/Sheet";
import { ThemeProvider } from "@/components/ThemeProvider";

/**
 * 소개 페이지 — 루트(`/`).
 *
 * **로그인하지 않아도 볼 수 있다.** 예전에는 루트가 곧 로그인 화면이어서
 * 이 앱이 무엇을 하는 곳인지 알 방법이 없었다. 로그인 화면은 `/login`으로 옮겼고,
 * 포털에서 들어오는 링크는 `/home`을 가리킨다.
 *
 * 결쩜사 패턴 그대로 **시트를 쌓는다** — 전체 폭 섹션을 쓰지 않고 둥근 카드를
 * 세로로 얹고, 마지막에 어두운 푸터로 문서를 닫는다.
 * 근거: my-obsidian-vault → 20-Design/결쩜사 페이지 패턴.md
 */
export default function LandingPage() {
  return (
    <ThemeProvider>
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <header style={headerStyle}>
          <div className="page" style={{ ...headerInner, paddingTop: 14, paddingBottom: 14 }}>
            <span className="row" style={{ gap: 9 }}>
              <AppIcon size={30} priority />
              <span style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>FitLog</span>
            </span>
            <LandingHeaderAuth />
          </div>
        </header>

        <main className="page">
          <Sheet
            tone="dark"
            ornament
            eyebrow="FITLOG · BODY & BLOOD"
            headline={
              <>
                결과지를 찍으면,
                <br />
                <span style={{ color: "#ead58c" }}>추이가 남습니다.</span>
              </>
            }
            lead="인바디와 피검사 결과지를 찍으면 인쇄된 항목을 모두 읽어 날짜별로 쌓아 둡니다. 종이를 버려도 기록은 남습니다."
          >
            <div style={{ marginTop: 24 }}>
              <LandingCta variant="hero" />
            </div>
          </Sheet>

          <Sheet tone="tint" eyebrow="HOW IT WORKS" headline="세 걸음이면 됩니다">
            <ol style={stepsStyle}>
              {STEPS.map((s, i) => (
                <li key={s.title} style={stepStyle}>
                  <span style={stepNumStyle}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p style={stepTitleStyle}>{s.title}</p>
                    <p style={stepDescStyle}>{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Sheet>

          <Sheet eyebrow="WHAT YOU GET" headline="숫자 하나가 아니라 흐름을 봅니다">
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {FEATURES.map((f) => (
                <div key={f.name} style={featureStyle}>
                  <strong style={{ fontSize: "0.92rem" }}>{f.name}</strong>
                  <p style={stepDescStyle}>{f.desc}</p>
                </div>
              ))}
            </div>
          </Sheet>

          <Sheet
            tone="gold"
            eyebrow="ONE ACCOUNT"
            headline="계정만 공유해요"
            lead="myjane 계정 하나로 여러 기록 서비스를 골라 씁니다. 기록과 데이터는 서비스마다 따로 쌓여요."
          >
            <p className="note-block">
              <strong>NOTE</strong>
              쓰지 않는 서비스는 열지 않아도 돼요. 이 앱만 써도 충분합니다.
            </p>
          </Sheet>

          <Sheet center eyebrow="START" headline="결과지 한 장만 찍어 볼까요?">
            <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
              <LandingCta variant="closing" />
            </div>
          </Sheet>
        </main>

        <footer style={footerStyle}>
          <div className="page" style={{ textAlign: "center", paddingBottom: 28 }}>
            <p style={{ margin: "0 0 14px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              FitLog
            </p>
            <p style={{ margin: 0 }}>
              <a href="https://www.myjane.co.kr" className="myjane-mark" style={{ color: "#fff" }}>
                my<span>jane</span>
              </a>
            </p>
            <p style={footerLineStyle}>@2026 MyJane All rights reserved</p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

const STEPS = [
  {
    "title": "결과지를 찍는다",
    "desc": "인바디든 피검사든, 기종·검사기관이 달라도 인쇄된 항목을 그대로 읽습니다."
  },
  {
    "title": "확인하고 저장한다",
    "desc": "읽어 온 값을 먼저 보여드립니다. 자동으로 저장하지 않습니다."
  },
  {
    "title": "추이와 해설을 본다",
    "desc": "적정 범위와 겹쳐 지금 위치를, 항목별 그래프로 흐름을 봅니다. 벗어난 항목에는 근거를 밝힌 권장사항이 붙습니다."
  }
];

const FEATURES = [
  {
    "name": "인바디 자동 판독",
    "desc": "체중·골격근량·체지방률은 물론 인쇄된 항목을 모두 읽습니다."
  },
  {
    "name": "피검사 판독과 해설",
    "desc": "간·지질·혈당·신장·혈액 항목을 읽고, 각 수치가 무엇을 뜻하는지 함께 보여줍니다."
  },
  {
    "name": "근거를 밝힌 권장사항",
    "desc": "수치가 벗어나면 운동·식습관·영양제를 제안하고, 어떤 진료지침과 연구에서 나온 말인지 펼쳐볼 수 있습니다."
  },
  {
    "name": "적정 범위 비교",
    "desc": "결과지에 인쇄된 표준범위와 겹쳐 지금 위치를 보여줍니다."
  },
  {
    "name": "체성분과 겹쳐 보기",
    "desc": "근육량이 많으면 신장 수치가 실제보다 낮게 나옵니다. 두 기록을 함께 가진 앱만 알려줄 수 있는 맥락입니다."
  },
  {
    "name": "항목별 추이",
    "desc": "날짜별로 쌓아 두니 지난달과 견줄 수 있습니다."
  }
];

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 40,
  background: "var(--bg-primary)",
  borderBottom: "1px solid var(--border-subtle)",
};

const headerInner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const stepsStyle: CSSProperties = {
  listStyle: "none",
  margin: "20px 0 0",
  padding: 0,
  display: "grid",
  gap: 16,
};

const stepStyle: CSSProperties = { display: "flex", gap: 14, alignItems: "flex-start" };

const stepNumStyle: CSSProperties = {
  flexShrink: 0,
  width: 30,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  color: "var(--accent)",
  paddingTop: 2,
};

const stepTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.94rem",
  fontWeight: 800,
  letterSpacing: "-0.3px",
};

const stepDescStyle: CSSProperties = {
  margin: "5px 0 0",
  fontSize: "0.82rem",
  lineHeight: 1.75,
  color: "var(--text-secondary)",
  wordBreak: "keep-all",
};

const featureStyle: CSSProperties = {
  padding: "15px 17px",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-subtle)",
};

const footerStyle: CSSProperties = {
  marginTop: 40,
  paddingTop: 30,
  background: "#160b26",
  color: "#fff",
};

const footerLineStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "0.78rem",
  lineHeight: 1.8,
  color: "rgba(232,222,250,0.62)",
  wordBreak: "keep-all",
};

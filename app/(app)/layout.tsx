import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TopNav } from "@/components/TopNav";
import { FloatingChat } from "@/components/FloatingChat";
import { ToastContainer } from "@/components/Toast";
import { SiteFooter } from "@/components/SiteFooter";

/** 로그인한 사람이 쓰는 화면들의 껍데기 — 세션은 AuthGate가 지킨다 */
export default function AppShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <TopNav />
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "calc(var(--nav-height) + var(--nav-top) + 1rem) 1rem 2rem",
          }}
        >
          <AuthGate>{children}</AuthGate>
          <SiteFooter />
        </div>
        <FloatingChat />
        <ToastContainer />
      </div>
    </ThemeProvider>
  );
}

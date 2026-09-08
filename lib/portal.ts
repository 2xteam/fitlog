/**
 * 통합 로그인 포털로 보내는 규칙.
 *
 * 운영 도메인(`*.myjane.co.kr`)에서만 포털로 넘긴다. 로컬 개발이나
 * `*.vercel.app` 미리보기에서는 쿠키 도메인이 적용되지 않아 포털에 저장한 세션이
 * 돌아와도 읽히지 않으므로, 이 앱의 `/login` 화면을 그대로 쓴다.
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */

export const APP_KEY = "fitlog";

const PORTAL_ORIGIN =
  process.env.NEXT_PUBLIC_PORTAL_ORIGIN?.replace(/\/+$/, "") ?? "https://www.myjane.co.kr";

/** 지금 이 브라우저가 포털과 세션을 나눠 쓸 수 있는 곳에 있는가 */
export function usesPortal(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".myjane.co.kr");
}

/** 이 앱 안의 경로만 통과시킨다. 오픈 리다이렉트 방지 */
function safePath(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

export type AuthUrlOptions = {
  /**
   * 이미 세션이 있어도 **로그인 화면을 보여 달라**는 표시.
   * 이걸 붙이지 않으면 포털이 세션을 보고 그대로 되돌려보내고,
   * 이 앱은 다시 포털로 보내 무한히 왕복한다.
   */
  relogin?: boolean;
};

/** 로그인하러 갈 주소 */
export function loginUrl(next = "/home", options: AuthUrlOptions = {}): string {
  const path = safePath(next);
  const relogin = options.relogin ? "&relogin=1" : "";
  if (!usesPortal()) return `/login?next=${encodeURIComponent(path)}${relogin}`;
  return `${PORTAL_ORIGIN}/login?from=${APP_KEY}&next=${encodeURIComponent(path)}${relogin}`;
}

/**
 * 회원가입하러 갈 주소 — **언제나 포털이다.**
 *
 * 이 앱에는 가입 화면을 두지 않는다. 예전에는 로컬 개발용으로 `/register` 를
 * 두고 운영에서만 포털로 보냈는데, 그 화면이 운영에도 그대로 떠서
 * **약관·개인정보 동의를 거치지 않고 계정이 만들어질 수 있었다.**
 * 동의는 포털 가입 화면과 포털 가입 라우트에서만 받는다.
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 *
 * 로컬 개발에서도 포털로 나간다. 세션 쿠키는 `.myjane.co.kr` 도메인이라
 * localhost 로는 돌아오지 않으므로, 로컬에서 계정이 필요하면 운영 포털에서
 * 만든 뒤 그 계정으로 쓴다.
 */
export function signupUrl(next = "/home"): string {
  const path = safePath(next);
  return `${PORTAL_ORIGIN}/signup?from=${APP_KEY}&next=${encodeURIComponent(path)}`;
}

/**
 * 계정 찾기 화면 — **포털에만 있다.**
 *
 * 예전에는 앱마다 사본이 있었고 메일도 각자 보냈다. 그 사본들은 재발송
 * 쿨다운이 없었고 계정이 없으면 404 로 **어떤 이메일이 가입돼 있는지
 * 알려줬다.** 메일을 보내는 자리가 여러 곳이면 그런 대응이 갈린다.
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export function findPhoneUrl(): string {
  return `${PORTAL_ORIGIN}/find-phone`;
}

export function forgotPinUrl(): string {
  return `${PORTAL_ORIGIN}/forgot-pin`;
}

/**
 * 분리 동의 화면 — **포털에만 있다.**
 *
 * 건강정보·국외 이전·법정대리인 동의는 가입 동의와 따로 받는다. 국외 이전은
 * FitLog 만의 일이 아니라 SnapWord·SnapNote 사진도 같은 경로로 나가므로,
 * 앱마다 화면을 두면 같은 사람에게 세 번 묻는다.
 *
 * `next` 로 돌아올 주소를 넘긴다 — 동의를 마치면 쓰려던 자리로 돌려보낸다.
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export function consentUrl(
  kind: "health" | "overseas" | "guardian",
  backTo = "/home",
): string {
  const back = `${typeof location !== "undefined" ? location.origin : ""}${safePath(backTo)}`;
  return `${PORTAL_ORIGIN}/account/consent/${kind}?next=${encodeURIComponent(back)}`;
}

/**
 * 회원 탈퇴 화면 — **포털에만 있다.**
 *
 * 탈퇴는 여섯 서비스 공통이라 화면도 한 곳이라야 한다. 앱마다 두면
 * "여기서 탈퇴하면 여섯 곳이 다 닫힙니다" 를 여섯 번 다르게 쓰게 된다.
 * 여기서는 my 화면에 이 링크만 보여 준다.
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export function withdrawUrl(): string {
  return `${PORTAL_ORIGIN}/account/withdraw`;
}

/**
 * 이메일을 등록·인증하는 화면 — **포털에만 있다.**
 *
 * 이 앱에는 같은 화면을 만들지 않는다. 여섯 앱이 각자 물으면 같은 사람에게
 * 여섯 번 묻게 된다. 여기서는 배너로 이 링크만 보여 준다
 * → components/EmailBanner.tsx
 */
export function accountEmailUrl(): string {
  return `${PORTAL_ORIGIN}/account/email`;
}

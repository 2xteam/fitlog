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

/** 회원가입하러 갈 주소 */
export function signupUrl(next = "/home"): string {
  const path = safePath(next);
  if (!usesPortal()) return `/register?next=${encodeURIComponent(path)}`;
  return `${PORTAL_ORIGIN}/signup?from=${APP_KEY}&next=${encodeURIComponent(path)}`;
}

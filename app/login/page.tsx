"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { loadSession } from "@/lib/session";
import { loginUrl } from "@/lib/portal";

/**
 * 로그인은 **포털에서만** 한다. 이 경로는 옛 링크를 위해 남겨 둔 이동 화면이다.
 *
 * 예전에는 로컬 개발용 전화번호+PIN 로그인 화면이 여기 있었다. 그 라우트는
 * 세션 쿠키(`snap_session` · `snap_auth`)를 심지 않아서 localhost 에서 로그인해도
 * 곧바로 다시 로그인 화면으로 튕겼고, 전화번호 로그인은 2026-09-10 에 끝났다.
 * 로컬에서는 localhost:3000 포털(이메일 로그인)로 간다 → lib/portal.ts
 */
function LoginRedirect() {
  const params = useSearchParams();
  const raw = params.get("next") ?? "/home";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home";
  /** 세션이 있어도 로그인 화면을 보여 달라는 표시 → lib/portal.ts */
  const relogin = params.get("relogin") === "1";

  useEffect(() => {
    if (!relogin && loadSession()) {
      window.location.replace(next);
      return;
    }
    window.location.replace(loginUrl(next, { relogin }));
  }, [next, relogin]);

  return null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  );
}

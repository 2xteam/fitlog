"use client";

import { useEffect, useState } from "react";
import { hasUsableSession, loadSession, type SessionUser } from "@/lib/session";
import { loginUrl } from "@/lib/portal";

export type SessionState =
  | { status: "loading"; user: null }
  /** 세션이 아예 없다 */
  | { status: "anonymous"; user: null }
  /**
   * 세션은 있는데 이 앱에서 쓸 수 없다 — 서명 토큰이 없는 경우.
   * 다른 myjane 앱(전화번호+PIN)에서 만든 세션을 들고 2hbk에 오면 이 상태가 된다.
   * `anonymous`와 구분해야 로그인 화면에 "다시 로그인해야 한다"고 알릴 수 있다.
   */
  | { status: "unusable"; user: SessionUser }
  | { status: "signed-in"; user: SessionUser };

/**
 * 세션은 **클라이언트가 읽는 쿠키**에 있어 서버 컴포넌트에서는 알 수 없다.
 * 그래서 로그인 여부로 갈리는 화면은 이 훅을 쓰는 클라이언트 컴포넌트로 떼어 둔다.
 *
 * 상태가 정해지기 전에는 아무것도 그리지 않는다 — 로그인한 사람에게
 * "로그인" 버튼이 한 번 스쳐 보이는 것보다 낫다.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });

  useEffect(() => {
    const user = loadSession();
    if (!user) setState({ status: "anonymous", user: null });
    else if (hasUsableSession()) setState({ status: "signed-in", user });
    else setState({ status: "unusable", user });
  }, []);

  return state;
}

/**
 * 로그인이 필요한 화면에서 쓴다. 쓸 수 없는 세션이면 로그인 화면으로 보낸다.
 *
 * 토큰이 없는 세션(`unusable`)일 때는 `relogin`을 붙여 보낸다. 그러지 않으면
 * 포털이 "세션이 있네" 하고 그대로 되돌려보내 둘이 무한히 왕복한다.
 */
export function useRequireSession(next: string): SessionState {
  const state = useSession();

  useEffect(() => {
    if (state.status === "anonymous") {
      window.location.replace(loginUrl(next));
    } else if (state.status === "unusable") {
      window.location.replace(loginUrl(next, { relogin: true }));
    }
  }, [state.status, next]);

  return state;
}

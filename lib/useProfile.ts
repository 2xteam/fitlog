"use client";

import { useCallback, useEffect, useState } from "react";

export type BodyProfile = {
  name?: string;
  heightCm: number | null;
  gender: "male" | "female" | null;
  birthYear: number | null;
};

/**
 * 신체 프로필 로딩.
 *
 * 키·성별·출생연도가 채워져 있어야 인바디 결과를 해석할 수 있으므로,
 * 측정 관련 화면은 `complete === false`일 때 프로필 입력을 먼저 요구한다.
 */
export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<BodyProfile | null>(null);
  const [complete, setComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
      const json = (await res.json()) as {
        ok: boolean;
        profile?: BodyProfile;
        complete?: boolean;
      };
      if (json.ok && json.profile) {
        setProfile(json.profile);
        setComplete(Boolean(json.complete));
      }
    } catch {
      /* 네트워크 오류 시 화면에서 재시도 */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, complete, loading, reload };
}

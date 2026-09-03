"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * History는 Inbody 화면으로 합쳤다.
 * 예전 링크·북마크가 살아 있으므로 경로는 남겨두고 넘겨준다.
 */
export default function ChartsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/measurements");
  }, [router]);

  return null;
}

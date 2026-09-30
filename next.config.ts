import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 빌드 산출물 폴더. 기본은 `.next`.
   *
   * 개발 서버가 켜진 채로 `next build`를 돌리면 둘이 같은 `.next`를 쓰면서
   * "Cannot find module './5611.js'" 같은 오류로 서로를 깨뜨린다.
   * 그럴 때는 `NEXT_DIST_DIR=.next-build npm run build` 로 따로 쌓는다.
   *
   * ⚠️ 이 환경변수를 주고 빌드하면 Next가 `tsconfig.json`과 `next-env.d.ts`의
   * 타입 경로도 그 폴더로 고쳐 쓴다. 빌드가 끝나면 두 파일을 되돌려야 한다
   * (`git checkout tsconfig.json next-env.d.ts`). 커밋에 섞이면 평소 개발이 깨진다.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * `npm run dev:local` 로 https://local.myjane.co.kr:3003 에서 띄울 때
   * 운영 로그인 쿠키(.myjane.co.kr)를 그대로 받는다. 그 주소에서 여는
   * 개발 리소스(HMR 등)를 막지 않도록 허용해 둔다 → 볼트 30-Patterns/개발 서버와 검증 환경.md
   */
  allowedDevOrigins: ["local.myjane.co.kr"],
};

export default nextConfig;

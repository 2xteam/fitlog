import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitLog",
    short_name: "FitLog",
    description: "인바디와 피검사 결과지를 기록하고 추이와 권장사항을 보는 FitLog",
    start_url: "/home",
    display: "standalone",
    background_color: "#f7fbfb",
    theme_color: "#116271",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}

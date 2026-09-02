export type ThemeId = "dark" | "light" | "violet" | "custom";

export type ThemeCustomColor = {
  /** 커스텀 모드 전용 accent 색상 (hex, 기본 #2ee8ae) */
  accent: string;
  /** 커스텀 모드 전용 배경 색상 (hex, 기본 #000000) */
  bg: string;
};

export type ThemeConfig = {
  id: ThemeId;
  label: string;
  /** 미리보기용 색 팔레트 */
  preview: { bg: string; accent: string; text: string };
  /** data-theme 속성값 */
  dataAttr: string;
  custom?: ThemeCustomColor;
};

export const PRESET_THEMES: ThemeConfig[] = [
  {
    id: "dark",
    label: "다크",
    dataAttr: "dark",
    preview: { bg: "#000000", accent: "#2ee8ae", text: "#ffffff" },
  },
  {
    id: "light",
    label: "화이트",
    dataAttr: "light",
    preview: { bg: "#f2f2f7", accent: "#1ab485", text: "#1a1a1a" },
  },
  {
    id: "violet",
    label: "네온핑크",
    dataAttr: "violet",
    preview: { bg: "#050008", accent: "#ff4ecd", text: "#f8f0ff" },
  },
  {
    id: "custom",
    label: "커스텀",
    dataAttr: "custom",
    preview: { bg: "#000000", accent: "#2ee8ae", text: "#ffffff" },
  },
];

const STORAGE_KEY = "snapword_theme";

type StoredTheme = { id: ThemeId; custom?: ThemeCustomColor };

export function loadTheme(): StoredTheme {
  if (typeof window === "undefined") return { id: "dark" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: "dark" };
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    const validIds: ThemeId[] = ["dark", "light", "violet", "custom"];
    if (!validIds.includes(parsed.id as ThemeId)) return { id: "dark" };
    return { id: parsed.id as ThemeId, custom: parsed.custom };
  } catch {
    return { id: "dark" };
  }
}

export function saveTheme(id: ThemeId, custom?: ThemeCustomColor) {
  if (typeof window === "undefined") return;
  const payload: StoredTheme = { id, ...(custom ? { custom } : {}) };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** hex → r g b (0-255 * 3) */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** 배경색 밝기(0~1)로 텍스트 색 자동 결정 */
function luminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function buildCustomVars(custom: ThemeCustomColor): Record<string, string> {
  const bgRgb = hexToRgb(custom.bg) ?? [0, 0, 0];
  const accentRgb = hexToRgb(custom.accent) ?? [46, 232, 174];
  const lum = luminance(...bgRgb);
  const isDark = lum < 0.4;

  const [ar, ag, ab] = accentRgb;
  const [br, bg_, bb] = bgRgb;

  const mix = (base: [number, number, number], ratio: number) =>
    `#${base.map((c, i) => {
      const target = [br, bg_, bb][i];
      return Math.round(c + (target - c) * ratio).toString(16).padStart(2, "0");
    }).join("")}`;

  return {
    "--bg-primary": custom.bg,
    "--bg-secondary": mix(bgRgb, 0.18),
    "--bg-card": mix(bgRgb, 0.3),
    "--bg-elevated": mix(bgRgb, 0.45),
    "--border": isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    "--border-subtle": isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    "--text-primary": isDark ? "#ffffff" : "#1a1a1a",
    "--text-secondary": isDark ? "#999999" : "#666666",
    "--text-muted": isDark ? "#555555" : "#aaaaaa",
    "--accent": custom.accent,
    "--accent-hover": `rgb(${Math.max(ar - 20, 0)},${Math.max(ag - 20, 0)},${Math.max(ab - 20, 0)})`,
    "--accent-subtle": `rgba(${ar},${ag},${ab},0.14)`,
    "--danger": "#ff4e6a",
    "--danger-subtle": "rgba(255,78,106,0.12)",
    "--success": "#2ee8ae",
    "--success-subtle": "rgba(46,232,174,0.12)",
    "--warning": "#ffc233",
    "--input-bg": mix(bgRgb, 0.35),
    "--input-border": isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
  };
}

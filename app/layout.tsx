import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapWord",
  description: "OpenAI로 교재·텍스트에서 단어를 추출·정리하는 SnapWord",
  icons: {
    icon: "/favicon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

const themeInitScript = `
(function(){
  try {
    var STORAGE_KEY = 'snapword_theme';
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var stored = JSON.parse(raw);
    var validIds = ['dark','light','violet','custom'];
    if (!stored || !validIds.includes(stored.id)) return;

    document.documentElement.setAttribute('data-theme', stored.id);

    if (stored.id === 'custom' && stored.custom) {
      var bg = stored.custom.bg || '#000000';
      var accent = stored.custom.accent || '#2ee8ae';

      function hexToRgb(hex) {
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
        if (!m) return null;
        return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
      }
      function luminance(r,g,b) {
        function lin(c){ var s=c/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4); }
        return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
      }

      var bgRgb   = hexToRgb(bg)     || [0,0,0];
      var accRgb  = hexToRgb(accent) || [46,232,174];
      var isDark  = luminance(bgRgb[0],bgRgb[1],bgRgb[2]) < 0.4;

      function mix(base, ratio) {
        return '#'+base.map(function(c,i){
          return Math.round(c+(bgRgb[i]-c)*ratio).toString(16).padStart(2,'0');
        }).join('');
      }

      var ar=accRgb[0], ag=accRgb[1], ab=accRgb[2];
      var vars = {
        '--bg-primary':    bg,
        '--bg-secondary':  mix(bgRgb,0.18),
        '--bg-card':       mix(bgRgb,0.3),
        '--bg-elevated':   mix(bgRgb,0.45),
        '--border':        isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',
        '--border-subtle': isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)',
        '--text-primary':  isDark?'#ffffff':'#1a1a1a',
        '--text-secondary':isDark?'#999999':'#666666',
        '--text-muted':    isDark?'#555555':'#aaaaaa',
        '--accent':        accent,
        '--accent-hover':  'rgb('+Math.max(ar-20,0)+','+Math.max(ag-20,0)+','+Math.max(ab-20,0)+')',
        '--accent-subtle': 'rgba('+ar+','+ag+','+ab+',0.14)',
        '--danger':        '#ff4e6a',
        '--danger-subtle': 'rgba(255,78,106,0.12)',
        '--success':       '#2ee8ae',
        '--success-subtle':'rgba(46,232,174,0.12)',
        '--warning':       '#ffc233',
        '--input-bg':      mix(bgRgb,0.35),
        '--input-border':  isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)',
      };
      var root = document.documentElement;
      Object.keys(vars).forEach(function(k){ root.style.setProperty(k, vars[k]); });
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta name="apple-mobile-web-app-title" content="SnapWord" />
      </head>
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker"in navigator){navigator.serviceWorker.register("/sw.js").catch(function(){})}` }} />
      </body>
    </html>
  );
}

/**
 * 인스타그램 카드 HTML → PNG 내보내기.
 *
 *   node docs/marketing/export-cards.mjs            (fitlog 저장소 루트에서)
 *   → docs/marketing/cards/instagram-fitlog-01.png … 08.png  (2160×2160, 2배 해상도)
 *
 * 화면 캡처는 배율·안티앨리어싱 때문에 흐릿하다. 여기서는 로컬 Chrome 을 띄워
 * 카드 요소 하나씩을 2배 해상도로 찍는다. Chrome 이 없으면 Edge 를 쓴다.
 * playwright-core 는 다른 저장소(klead)에 설치된 것을 빌려 쓴다 — 브라우저를 내려받지 않는다.
 * → my-obsidian-vault / 30-Patterns/SNS 소개 카드와 게시글.md
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const html = path.join(here, "instagram-fitlog.html");
const outDir = path.join(here, "cards");
const scale = Number(process.env.SCALE ?? 2);

const candidates = ["C:/Dev/klead", "C:/Dev/jangmini", "C:/Dev/myjane", "C:/Dev/fitlog"];
let pw = null;
for (const c of candidates) {
  try {
    pw = createRequire(path.join(c, "package.json"))("playwright-core");
    break;
  } catch {
    /* 다음 후보 */
  }
}
if (!pw) {
  console.error("playwright-core 를 찾지 못했습니다. 아무 저장소에서 `npm i -D playwright-core` 후 다시 실행하세요.");
  process.exit(1);
}

const browsers = [
  { channel: "chrome" },
  { channel: "msedge" },
];
let browser = null;
for (const opt of browsers) {
  try {
    browser = await pw.chromium.launch({ ...opt, headless: true });
    break;
  } catch {
    /* 다음 브라우저 */
  }
}
if (!browser) {
  console.error("Chrome 또는 Edge 를 찾지 못했습니다.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: scale });
await page.goto("file:///" + html.replace(/\\/g, "/"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const cards = await page.$$(".card");
let i = 0;
for (const card of cards) {
  i += 1;
  const file = path.join(outDir, `instagram-fitlog-${String(i).padStart(2, "0")}.png`);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: file, type: "png", omitBackground: false });
  console.log("saved", path.relative(process.cwd(), file));
}
await browser.close();
console.log(`${i}장 · ${1080 * scale}×${1080 * scale}px`);

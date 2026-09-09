/**
 * 인스타그램 카드 HTML → PNG 내보내기.
 *
 *   node docs/marketing/export-cards.mjs            (저장소 루트에서)
 *   → docs/marketing/cards/<html 파일명>-01.png …   (2160×2160, 2배 해상도 · SCALE=3 이면 3240)
 *
 * 이 폴더의 instagram-*.html 을 모두 찾아 카드(.card) 요소를 한 장씩 찍는다.
 * 화면 캡처는 배율·안티앨리어싱 때문에 흐리다. 로컬 Chrome(없으면 Edge)을 headless 로 띄운다.
 * playwright-core 는 다른 저장소(klead)에 설치된 것을 빌려 쓴다 — 브라우저를 내려받지 않는다.
 * → my-obsidian-vault / 30-Patterns/SNS 소개 카드와 게시글.md
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const outDir = path.join(here, "cards");
const scale = Number(process.env.SCALE ?? 2);
const htmls = fs.readdirSync(here).filter((f) => /^instagram-.*\.html$/.test(f));
if (htmls.length === 0) { console.error("instagram-*.html 이 없습니다."); process.exit(1); }

let pw = null;
for (const c of ["C:/Dev/klead", "C:/Dev/jangmini", "C:/Dev/myjane"]) {
  try { pw = createRequire(path.join(c, "package.json"))("playwright-core"); break; } catch { /* 다음 */ }
}
if (!pw) { console.error("playwright-core 를 찾지 못했습니다. `npm i -D playwright-core` 후 다시 실행하세요."); process.exit(1); }

let browser = null;
for (const opt of [{ channel: "chrome" }, { channel: "msedge" }]) {
  try { browser = await pw.chromium.launch({ ...opt, headless: true }); break; } catch { /* 다음 */ }
}
if (!browser) { console.error("Chrome 또는 Edge 를 찾지 못했습니다."); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: scale });
for (const html of htmls) {
  const base = html.replace(/\.html$/, "");
  await page.goto("file:///" + path.join(here, html).replace(/\\/g, "/"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const cards = await page.$$(".card");
  let i = 0;
  for (const card of cards) {
    i += 1;
    const file = path.join(outDir, `${base}-${String(i).padStart(2, "0")}.png`);
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: file, type: "png" });
    console.log("saved", path.relative(process.cwd(), file));
  }
  console.log(`${base}: ${i}장 · ${1080 * scale}×${1080 * scale}px`);
}
await browser.close();

/**
 * AI 캐시 조회/저장 시 사용하는 키 정규화.
 * RSS 제목 등에 섞인 HTML·공백 차이로 캐시가 어긋나지 않도록 통일합니다.
 */
export function normalizeAiCacheKey(raw: string): string {
  let s = raw.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

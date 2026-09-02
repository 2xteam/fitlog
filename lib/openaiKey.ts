/** OpenAI 호출에 쓸 수 있는 키로 보이는지(플레이스홀더 제외) */
export function isOpenAiKeyConfigured(): boolean {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k || k.length < 20) return false;
  const lower = k.toLowerCase();
  if (lower === "your_openai_api_key") return false;
  if (lower.includes("your_openai")) return false;
  if (lower.includes("placeholder")) return false;
  return k.startsWith("sk-");
}

export function isOpenAiApiKeyAuthError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /401|incorrect api key|invalid_api_key|authentication/i.test(m);
}

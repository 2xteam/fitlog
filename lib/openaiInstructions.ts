/** 요청·환경 합산 시스템 지침 최대 길이 */
const MAX_MERGED_INSTRUCTIONS = 8000;
/** 요청 본문 `instructions` 한도 */
const MAX_REQUEST_INSTRUCTIONS = 4000;
/** `.env`의 OPENAI_EXTRA_INSTRUCTIONS 한도 */
const MAX_ENV_INSTRUCTIONS = 4000;

export function getEnvExtraInstructions(): string | undefined {
  const raw = process.env.OPENAI_EXTRA_INSTRUCTIONS;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  return t.slice(0, MAX_ENV_INSTRUCTIONS);
}

/** 폼·JSON 요청에서 온 추가 지침 정규화 */
export function normalizeRequestInstructions(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.slice(0, MAX_REQUEST_INSTRUCTIONS);
}

/**
 * 시스템 프롬프트에 붙일 추가 문단.
 * 환경 변수 지침 + 요청 지침 순으로 합칩니다.
 */
export function mergeExtraInstructionsForModel(
  requestPart?: string,
): string | undefined {
  const env = getEnvExtraInstructions();
  const req = requestPart?.trim() ? requestPart.trim().slice(0, MAX_REQUEST_INSTRUCTIONS) : undefined;
  const parts = [env, req].filter(Boolean) as string[];
  if (parts.length === 0) return undefined;
  return parts.join("\n\n---\n\n").slice(0, MAX_MERGED_INSTRUCTIONS);
}

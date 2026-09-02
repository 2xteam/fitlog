import type { ChatCompletion } from "openai/resources/chat/completions";
import { connectDB } from "@/lib/db";
import { OpenAiRequestLog } from "@/models/OpenAiRequestLog";

export type OpenAiRequestLogKind = "plain_text" | "vision";

function pickUsageNumbers(usage: unknown): {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
} {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: null, completionTokens: null, totalTokens: null };
  }
  const u = usage as Record<string, unknown>;
  const p = u.prompt_tokens;
  const c = u.completion_tokens;
  const t = u.total_tokens;
  return {
    promptTokens: typeof p === "number" ? p : null,
    completionTokens: typeof c === "number" ? c : null,
    totalTokens: typeof t === "number" ? t : null,
  };
}

export type LogOpenAiChatCompletionParams = {
  kind: OpenAiRequestLogKind;
  completion: ChatCompletion | null;
  modelFallback: string;
  temperature: number;
  responseFormat?: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string | null;
  wordsCount?: number | null;
  inputTextCharCount?: number | null;
  inputImageBytes?: number | null;
  inputImageMime?: string | null;
  inputImageDetail?: "low" | "high" | null;
};

/**
 * OpenAI 호출 1건을 MongoDB `openai_request_logs`에 기록합니다.
 * DB 오류는 삼키고 콘솔만 남겨 API 응답에는 영향을 주지 않습니다.
 */
export async function logOpenAiChatCompletion(
  params: LogOpenAiChatCompletionParams,
): Promise<void> {
  const {
    kind,
    completion,
    modelFallback,
    temperature,
    responseFormat = "json_object",
    durationMs,
    success,
    errorMessage = null,
    wordsCount = null,
    inputTextCharCount = null,
    inputImageBytes = null,
    inputImageMime = null,
    inputImageDetail = null,
  } = params;

  const usage = completion?.usage ?? null;
  const { promptTokens, completionTokens, totalTokens } = pickUsageNumbers(usage);
  const finishReason = completion?.choices?.[0]?.finish_reason ?? null;

  try {
    await connectDB();
    await OpenAiRequestLog.create({
      kind,
      model: completion?.model ?? modelFallback,
      temperature,
      responseFormat,
      openaiCompletionId: completion?.id ?? null,
      finishReason,
      usage: usage ?? null,
      promptTokens,
      completionTokens,
      totalTokens,
      durationMs,
      success,
      errorMessage,
      wordsCount,
      inputTextCharCount,
      inputImageBytes,
      inputImageMime,
      inputImageDetail,
    });
  } catch (err) {
    console.error("[openai_request_logs] insert failed:", err);
  }
}

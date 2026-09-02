import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { getUserModel } from "@/models/User";

export type TokenResult =
  | { ok: true; remaining: number }
  | { ok: false; error: string };

/**
 * 사용자 토큰을 cost만큼 차감합니다.
 * 잔액이 부족하면 { ok: false, error } 를 반환합니다.
 */
export async function deductTokens(
  userId: string,
  cost: number,
): Promise<TokenResult> {
  if (!IS_TOKEN_SYSTEM_ENABLED) {
    return { ok: true, remaining: 0 };
  }

  if (!mongoose.isValidObjectId(userId) || cost <= 0) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  await connectDB();
  const User = getUserModel();

  const updated = await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(userId), tokens: { $gte: cost } },
    { $inc: { tokens: -cost } },
    { new: true },
  ).exec();

  if (!updated) {
    const user = await User.findById(userId).exec();
    if (!user) return { ok: false, error: "사용자를 찾을 수 없습니다." };
    return { ok: false, error: `아쉽지만 토큰이 부족하여 진행하기 어렵습니다. 토큰을 충전해보세요! (보유: ${user.tokens ?? 0}, 필요: ${cost})` };
  }

  return { ok: true, remaining: updated.tokens ?? 0 };
}

/**
 * 토큰 잔액만 조회합니다.
 */
export async function getTokenBalance(userId: string): Promise<number> {
  if (!IS_TOKEN_SYSTEM_ENABLED) return 0;
  if (!mongoose.isValidObjectId(userId)) return 0;
  await connectDB();
  const user = await getUserModel().findById(userId).exec();
  return user?.tokens ?? 0;
}

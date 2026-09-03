import { connectDB } from "@/lib/db";
import { getMeasurementModel } from "@/models/Measurement";
import { getUserModel } from "@/models/User";
import { FIELDS, pick } from "@/lib/inbody";

/**
 * 상담사에게 넘길 "내 기록" 요약.
 *
 * 상담이 일반론에 그치지 않으려면 모델이 **이 사람의 실제 수치**를 알아야 한다.
 * 다만 대화 아이템에 남기지 않고 매 턴 `instructions` 에만 넣는다 —
 * 기록이 바뀌면 다음 턴부터 최신 값이 반영되고, 대화 본문은 질문만 남는다.
 *
 * 최근 3건까지만 넣는다. 그 이상은 프롬프트만 길어지고 해석에 보태는 게 없다.
 */
export async function buildMeasurementContext(userId: string): Promise<string> {
  await connectDB();

  const [user, rows] = await Promise.all([
    getUserModel().findById(userId).lean(),
    getMeasurementModel()
      .find({ userId })
      .sort({ measuredAt: -1 })
      .limit(3)
      .lean(),
  ]);

  const profile: string[] = [];
  if (user?.heightCm) profile.push(`키 ${user.heightCm}cm`);
  if (user?.gender) profile.push(user.gender === "female" ? "여성" : "남성");
  if (user?.birthYear) {
    profile.push(`${new Date().getFullYear() - user.birthYear}세(${user.birthYear}년생)`);
  }

  if (rows.length === 0) {
    return [
      "── 사용자 기록 ──",
      profile.length > 0 ? profile.join(" · ") : "프로필 정보 없음",
      "아직 저장된 인바디 기록이 없습니다. 수치 해석 대신 첫 기록을 남기는 방법을 안내하세요.",
    ].join("\n");
  }

  const lines: string[] = ["── 사용자 기록 ──"];
  if (profile.length > 0) lines.push(profile.join(" · "));
  lines.push(`저장된 기록 ${rows.length}건 이상 중 최근 ${rows.length}건입니다.`);

  for (const row of rows) {
    const d = new Date(row.measuredAt as unknown as string);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

    const parts: string[] = [];
    for (const f of FIELDS) {
      const v = pick(row, f.path);
      if (v == null) continue;
      const base = f.path.replace(/\.value$/, "");
      const min = pick(row, `${base}.min`);
      const max = pick(row, `${base}.max`);
      const range = min != null && max != null ? ` (표준 ${min}~${max})` : "";
      parts.push(`${f.label} ${v}${f.unit}${range}`);
    }

    const etc = (row.etc ?? []) as Array<{ label: string; value: string; unit?: string }>;
    for (const e of etc.slice(0, 12)) {
      parts.push(`${e.label} ${e.value}${e.unit ?? ""}`);
    }

    lines.push(`[${date}] ${parts.join(", ") || "값 없음"}`);
  }

  lines.push(
    "위 값은 사용자가 저장한 실제 기록입니다. 없는 항목을 지어내지 말고, 필요하면 기록에 없다고 말하세요.",
  );

  return lines.join("\n");
}

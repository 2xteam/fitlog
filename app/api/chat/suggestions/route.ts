import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getBloodTestModel } from "@/models/BloodTest";
import { getMeasurementModel } from "@/models/Measurement";
import { getUserModel } from "@/models/User";
import { crossNotesFor, flaggedIn, type BloodRow } from "@/lib/blood";
import { flaggedFields } from "@/lib/inbodyKnowledge";
import { guidanceFor } from "@/lib/bloodGuidance";
import { inbodyGuidanceFor } from "@/lib/inbodyGuidance";

/**
 * 이어서 물어볼 것 — **이 사용자의 실제 기록에서 만든다.**
 *
 * 고정 목록을 두면 "골격근량을 늘리려면?" 같은 문구가 근육이 충분한 사람에게도
 * 똑같이 뜬다. 누르고 싶은 게 없으니 결국 아무도 안 누른다.
 *
 * 그래서 이번 회차에 **벗어난 항목**과 **두 기록이 겹쳐 보이는 것**에서 뽑는다.
 * 이미 답이 준비된 질문만 제안하는 셈이라(권고 데이터가 있는 항목), 눌렀을 때
 * 상담사가 근거를 들어 답할 수 있다.
 *
 * 모델에게 후속 질문을 만들게 하는 방법도 있지만 호출이 한 번 더 늘고, 이미 느린
 * 흐름이 더 느려진다. 기록에서 규칙으로 뽑으면 값이 0원이고 즉시 뜬다.
 */

export const runtime = "nodejs";

type Chip = { text: string; from: "blood" | "inbody" | "cross" | "general" };

const GENERAL: Chip[] = [
  { text: "최근 기록을 요약해줘", from: "general" },
  { text: "지난 기록과 비교해서 뭐가 달라졌어?", from: "general" },
];

/** 기록이 없을 때 — 무엇을 할 수 있는 곳인지 알려주는 쪽으로 */
const EMPTY: Chip[] = [
  { text: "여기서 뭘 할 수 있어?", from: "general" },
  { text: "인바디 결과지는 어떻게 등록해?", from: "general" },
  { text: "피검사 결과지도 등록할 수 있어?", from: "general" },
  { text: "인바디는 언제 재는 게 정확해?", from: "general" },
];

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return NextResponse.json({ ok: true, chips: EMPTY });
  }

  try {
    await connectDB();
    const [user, bloodRows, measRows] = await Promise.all([
      getUserModel().findById(userId).lean(),
      getBloodTestModel().find({ userId }).sort({ testedAt: -1 }).limit(2).lean(),
      getMeasurementModel().find({ userId }).sort({ measuredAt: -1 }).limit(2).lean(),
    ]);

    const chips: Chip[] = [];

    /* ── 피검사에서 벗어난 항목 ── */
    const blood = bloodRows as unknown as BloodRow[];
    const bloodFlags = flaggedIn(blood[0] ?? null, blood[1] ?? null);
    for (const f of bloodFlags) {
      if (chips.length >= 2) break;
      // 답할 근거가 없는 항목은 제안하지 않는다 — 눌렀을 때 할 말이 없다
      if (guidanceFor(f.analyte.code, f.status === "low" ? "low" : "high").length === 0) continue;
      const dir = f.status === "low" ? "낮게" : "높게";
      chips.push({
        text: `${f.analyte.label}이 ${dir} 나왔어요. 어떻게 하면 좋아요?`,
        from: "blood",
      });
    }

    /* ── 두 기록이 겹쳐야 보이는 것 (이 앱만 할 수 있는 질문) ── */
    const cross = crossNotesFor(bloodFlags, measRows[0] ?? null);
    if (cross.length > 0 && chips.length < 3) {
      const c = cross[0]!;
      chips.push({
        text: `${c.inbodyLabel}을 감안하면 ${c.analyte.label}를 어떻게 봐야 해요?`,
        from: "cross",
      });
    }

    /* ── 인바디에서 벗어난 항목 ── */
    const inbodyFlags = flaggedFields(
      measRows[0] ?? null,
      measRows[1] ?? null,
      { gender: user?.gender ?? null },
    );
    for (const f of inbodyFlags) {
      if (chips.length >= 4) break;
      if (!f.concerning) continue;
      if (inbodyGuidanceFor(f.field.path, f.status).length === 0) continue;
      const dir = f.status === "low" ? "표준보다 적어요" : "표준보다 많아요";
      chips.push({
        text: `${f.field.label}이 ${dir}. 무엇부터 바꿔야 해요?`,
        from: "inbody",
      });
    }

    if (chips.length === 0) {
      const hasAny = blood.length > 0 || measRows.length > 0;
      return NextResponse.json({ ok: true, chips: hasAny ? GENERAL : EMPTY });
    }

    // 기록에서 뽑은 것 뒤에 일반 질문 하나를 붙여 막다른 느낌을 없앤다
    return NextResponse.json({ ok: true, chips: [...chips, GENERAL[0]!] });
  } catch {
    // 제안은 있으면 좋은 것이지 없으면 안 되는 것이 아니다
    return NextResponse.json({ ok: true, chips: GENERAL });
  }
}

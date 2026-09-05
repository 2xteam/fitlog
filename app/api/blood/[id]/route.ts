import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getBloodTestModel } from "@/models/BloodTest";
import { validateBloodTest, type ResultLike } from "@/lib/blood";

export const runtime = "nodejs";

function toDateKey(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** GET /api/blood/[id]?userId= — userId를 주면 그 사람의 기록만 돌려준다 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = new URL(req.url).searchParams.get("userId")?.trim();

  await connectDB();
  const row = await getBloodTestModel()
    .findOne(userId ? { _id: id, userId } : { _id: id })
    .lean();
  if (!row) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없어요." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, test: row });
}

/**
 * PATCH /api/blood/[id] — 이 기록 하나만 고친다.
 *
 * 저장(POST)은 `(userId, testedDate)` 기준 upsert라 날짜를 바꾸면 다른 날 기록을
 * 덮어쓴다. 그래서 수정은 따로 두고, 날짜를 옮길 때 같은 날 기록이 있으면 409로 막는다.
 * (인바디에서 같은 이유로 PATCH를 분리했다.)
 *
 * 인바디와 달리 여기서는 `results` 배열을 통째로 교체해도 안전하다 — 검토 화면이
 * 항상 전체 줄을 보내기 때문이다. 인바디는 중첩 객체라 구획을 통째로 $set 하면
 * payload에 없는 형제 필드가 조용히 사라졌다.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }

  await connectDB();
  const Model = getBloodTestModel();
  // id만 보고 고치면 남의 기록을 고칠 수 있다. 소유자까지 함께 조회한다
  const current = await Model.findOne({ _id: id, userId });
  if (!current) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없어요." }, { status: 404 });
  }

  const set: Record<string, unknown> = {};

  if (body.testedAt) {
    const testedAt = new Date(String(body.testedAt).replace(" ", "T"));
    if (Number.isNaN(testedAt.getTime())) {
      return NextResponse.json({ ok: false, error: "검사일시를 확인해 주세요." }, { status: 400 });
    }
    const testedDate = toDateKey(testedAt);
    if (testedDate !== current.testedDate) {
      const clash = await Model.findOne({
        userId: current.userId,
        testedDate,
        _id: { $ne: current._id },
      }).lean();
      if (clash) {
        return NextResponse.json(
          { ok: false, error: "그 날짜에 이미 기록이 있어요. 먼저 그 기록을 지우거나 다른 날짜로 바꿔주세요." },
          { status: 409 },
        );
      }
    }
    set.testedAt = testedAt;
    set.testedDate = testedDate;
  }

  let warnings: ReturnType<typeof validateBloodTest> = [];
  if (Array.isArray(body.results)) {
    const results = body.results as ResultLike[];
    warnings = validateBloodTest(results);
    set.results = results;
    set["extraction.warnings"] = warnings.map((w) => w.message);
    set["extraction.editedByUser"] = true;
  }
  if (Array.isArray(body.etc)) set.etc = body.etc;
  if (body.imageUrl !== undefined) set.imageUrl = body.imageUrl;
  if (body.note !== undefined) set.note = body.note;
  if (body.lab !== undefined) set.lab = body.lab;

  const saved = await Model.findByIdAndUpdate(id, { $set: set }, { new: true });
  return NextResponse.json({ ok: true, test: saved, warnings });
}

/**
 * DELETE /api/blood/[id]?userId=
 *
 * **소유자까지 함께 조회한다.** id만 보고 지우면 남의 기록 id를 넣어 지울 수 있다.
 * (인바디의 삭제 라우트가 같은 방식으로 `{_id, userId}`를 함께 본다.)
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }

  await connectDB();
  const res = await getBloodTestModel().deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "기록을 찾을 수 없어요." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

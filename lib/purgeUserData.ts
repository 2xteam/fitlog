import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { deleteR2Objects } from "@/lib/purgeR2";
import { getBloodTestModel } from "@/models/BloodTest";
import { ChatThread } from "@/models/ChatThread";
import { getInquiryModel } from "@/models/Inquiry";
import { getMeasurementModel } from "@/models/Measurement";

/**
 * 이 앱(FitLog)이 가진 한 사람의 데이터를 지운다 — **결과지 사진까지.**
 *
 * ⚠️ **여기가 민감정보다.** 인바디 수치와 피검사 결과, 그리고 결과지 사진
 * 원본이다. 방침에 "탈퇴 후 6개월, 그 뒤 폐기" 라고 적어 공개했으니
 * 이 정리가 실제로 돌아야 그 문구가 지켜진다.
 *
 * **회원 문서는 건드리지 않는다.** 포털이 원본을 갖는다.
 * 부르는 곳은 포털의 정리 작업 하나다 → myjane/app/api/cron/purge
 *
 * ⚠️ 참조 키가 모델마다 다르다. 실측한 값이다 (2026-09-08).
 *   Measurement · BloodTest   `userId` 가 **문자열**이다 (`String(user._id)`)
 *   ChatThread · Inquiry      `userId` 가 **ObjectId** 다
 * 하나로 뭉뚱그리면 한쪽이 조용히 안 지워진다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export type PurgeResult = Record<string, number>;

export async function purgeUserData(id: string): Promise<PurgeResult> {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(`ObjectId 가 아닙니다: ${id}`);
  }
  const oid = new mongoose.Types.ObjectId(id);
  await connectDB();

  const Measurement = getMeasurementModel();
  const BloodTest = getBloodTestModel();

  /* 지우기 전에 사진 주소를 모아 둔다 — 행을 지운 뒤에는 찾을 수 없다 */
  const [measurements, bloodTests] = await Promise.all([
    Measurement.find({ userId: id }, { imageUrl: 1 }).lean().exec(),
    BloodTest.find({ userId: id }, { imageUrl: 1 }).lean().exec(),
  ]);
  const imageUrls = [...measurements, ...bloodTests]
    .map((d) => (typeof d.imageUrl === "string" ? d.imageUrl : ""))
    .filter(Boolean);

  const removedFiles = await deleteR2Objects(imageUrls);

  const m = await Measurement.deleteMany({ userId: id }).exec();
  const b = await BloodTest.deleteMany({ userId: id }).exec();
  const threads = await ChatThread.deleteMany({ userId: oid }).exec();
  const inquiries = await getInquiryModel().deleteMany({ userId: oid }).exec();

  return {
    measurements: m.deletedCount ?? 0,
    bloodTests: b.deletedCount ?? 0,
    chatThreads: threads.deletedCount ?? 0,
    inquiries: inquiries.deletedCount ?? 0,
    r2Files: removedFiles,
  };
}

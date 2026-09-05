import mongoose, { Schema, type Model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * 피검사 결과지 1건.
 *
 * 인바디(`models/Measurement.ts`)와 같은 원칙을 따른다.
 *   · 회차마다 인쇄 항목이 다르다 → 고정 필드가 아니라 **결과 배열**로 담는다
 *   · 카탈로그에 없는 항목은 버리지 않고 `etc`에 보관한다
 *   · `userId + testedDate` 유니크 — 날짜당 1건
 *
 * ⚠️ 인바디와 다른 점 하나 — **참고치를 기록마다 저장한다.**
 * 피검사 참고구간은 검사실·장비·나이·성별을 타고, 검사실이 기준을 바꾸기도 한다.
 * 카탈로그의 값으로 나중에 다시 그리면 그때 본 화면이 재현되지 않는다.
 * 그래서 인쇄된 하한·상한·원문·판정을 모두 그대로 남긴다.
 */

/** 결과 한 줄 */
const ResultSchema = new Schema(
  {
    /** 카탈로그 코드. 매칭에 실패하면 null이고 `etc`로 간다 */
    code: { type: String, default: null },
    /** 결과지에 인쇄된 이름 원문 */
    name: { type: String, required: true },
    /** 그 줄이 인쇄된 원문 — 나중에 추출 오류를 대조할 때 쓴다 */
    rowText: { type: String, default: null },
    value: { type: Number, default: null },
    unit: { type: String, default: null },

    /** 인쇄된 참고치 — 한쪽만 있을 수 있다 */
    refLow: { type: Number, default: null },
    refHigh: { type: Number, default: null },
    /** 참고치 원문. "Desirable < 200" 처럼 숫자로 담기지 않는 경우가 있다 */
    refText: { type: String, default: null },

    /** 결과지의 판정 표시 */
    flag: { type: String, enum: ["H", "L", null], default: null },
    /** 검체 종류 — S:Serum, B:EDTA, OT:NaF */
    specimen: { type: String, default: null },
  },
  { _id: false },
);

const BloodTestSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },

    /** 결과지의 검체채취일시 */
    testedAt: { type: Date, required: true },
    /** 중복 방지용 날짜 키 (YYYY-MM-DD, KST 기준) */
    testedDate: { type: String, required: true },

    source: { type: String, enum: ["photo", "manual"], default: "photo" },
    /** R2에 보관한 결과지 원본 */
    imageUrl: { type: String, default: null },

    lab: {
      /** 검사기관 — 이원의료재단 등 */
      name: { type: String, default: null },
      /** 의뢰 병원 */
      clinic: { type: String, default: null },
      /** 접수번호 */
      receiptNo: { type: String, default: null },
    },

    results: { type: [ResultSchema], default: [] },

    /** 카탈로그에 없는 항목 — 반복해 쌓이면 정식 항목으로 승격 검토 */
    etc: {
      type: [
        new Schema(
          {
            label: { type: String, required: true },
            value: { type: String, default: null },
            unit: { type: String, default: null },
            refText: { type: String, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    note: { type: String, default: null },

    extraction: {
      model: { type: String, default: null },
      warnings: { type: [String], default: [] },
      editedByUser: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

/** 날짜당 1건 (같은 날 재업로드 시 교체) */
BloodTestSchema.index({ userId: 1, testedDate: 1 }, { unique: true });
BloodTestSchema.index({ userId: 1, testedAt: -1 });

export type BloodTest = InferSchemaType<typeof BloodTestSchema>;
export type BloodTestDocument = HydratedDocument<BloodTest>;
export type BloodResult = BloodTest["results"][number];

export function getBloodTestModel(): Model<BloodTest> {
  return (mongoose.models.BloodTest ??
    mongoose.model("BloodTest", BloodTestSchema)) as Model<BloodTest>;
}

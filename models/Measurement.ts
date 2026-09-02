import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

/**
 * 인바디 측정 1건.
 *
 * 기종마다 인쇄 항목이 달라서 대부분의 필드가 선택값이다.
 * 스키마에 없는 항목은 `etc`에 label/value 형태로 담는다.
 * 하루에 여러 번 재도 측정 조건(식사·수분·운동) 차이라 의미가 없으므로
 * `userId + measuredDate`에 유니크 인덱스를 걸어 날짜당 1건만 유지한다.
 */

/** 값 + 결과지에 인쇄된 표준범위 */
const MeasuredSchema = new Schema(
  {
    value: { type: Number, default: null },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  { _id: false },
);

/** 부위별 값 (kg / 표준 대비 % / 등급) */
const SegmentValueSchema = new Schema(
  {
    kg: { type: Number, default: null },
    percent: { type: Number, default: null },
    grade: { type: String, default: null },
  },
  { _id: false },
);

const SegmentSetSchema = new Schema(
  {
    rightArm: { type: SegmentValueSchema, default: () => ({}) },
    leftArm: { type: SegmentValueSchema, default: () => ({}) },
    trunk: { type: SegmentValueSchema, default: () => ({}) },
    rightLeg: { type: SegmentValueSchema, default: () => ({}) },
    leftLeg: { type: SegmentValueSchema, default: () => ({}) },
  },
  { _id: false },
);

const MeasurementSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },

    /** 결과지의 검사일시 (시:분까지 보관 — 측정 조건 비교용) */
    measuredAt: { type: Date, required: true },
    /** 중복 방지용 날짜 키 (YYYY-MM-DD, KST 기준) */
    measuredDate: { type: String, required: true },

    source: { type: String, enum: ["photo", "manual"], default: "photo" },
    /** R2에 보관한 결과지 원본 */
    imageUrl: { type: String, default: null },

    device: {
      model: { type: String, default: null }, // InBody270S, InBody970 ...
      place: { type: String, default: null }, // 측정 장소
      memberNo: { type: String, default: null },
    },

    /** 결과지 상단에 인쇄된 값 (프로필과 다를 수 있어 그대로 보관) */
    profile: {
      heightCm: { type: Number, default: null },
      age: { type: Number, default: null },
      gender: { type: String, default: null },
    },

    // ── 체성분분석 ──────────────────────────────
    composition: {
      totalBodyWater: { type: MeasuredSchema, default: () => ({}) },
      intracellularWater: { type: MeasuredSchema, default: () => ({}) },
      extracellularWater: { type: MeasuredSchema, default: () => ({}) },
      protein: { type: MeasuredSchema, default: () => ({}) },
      mineral: { type: MeasuredSchema, default: () => ({}) },
      boneMineral: { type: MeasuredSchema, default: () => ({}) },
      bodyFatMass: { type: MeasuredSchema, default: () => ({}) },
      softLeanMass: { type: MeasuredSchema, default: () => ({}) },
      fatFreeMass: { type: MeasuredSchema, default: () => ({}) },
      weight: { type: MeasuredSchema, default: () => ({}) },
    },

    // ── 골격근·지방분석 ─────────────────────────
    muscleFat: {
      skeletalMuscleMass: { type: MeasuredSchema, default: () => ({}) },
    },

    // ── 비만분석 ────────────────────────────────
    obesity: {
      bmi: { type: MeasuredSchema, default: () => ({}) },
      percentBodyFat: { type: MeasuredSchema, default: () => ({}) },
      waistHipRatio: { type: MeasuredSchema, default: () => ({}) },
    },

    // ── 부위별 ─────────────────────────────────
    segmental: {
      lean: { type: SegmentSetSchema, default: () => ({}) },
      fat: { type: SegmentSetSchema, default: () => ({}) },
      ecwRatio: { type: SegmentSetSchema, default: () => ({}) },
    },

    // ── 평가 ───────────────────────────────────
    evaluation: {
      inbodyScore: { type: Number, default: null },
      phaseAngle: { type: Number, default: null },
      ecwRatio: { type: Number, default: null },
      balance: {
        upperLeftRight: { type: String, default: null },
        lowerLeftRight: { type: String, default: null },
        upperLower: { type: String, default: null },
      },
      obesityGrade: {
        bmi: { type: String, default: null }, // 표준 / 과체중 / 심한과체중
        bodyFat: { type: String, default: null }, // 표준 / 경도비만 / 비만
        waistHipRatio: { type: String, default: null },
      },
      // 720 계열
      nutrition: {
        protein: { type: String, default: null },
        mineral: { type: String, default: null },
        fat: { type: String, default: null },
      },
      strength: {
        whole: { type: String, default: null },
        lower: { type: String, default: null },
        muscle: { type: String, default: null },
      },
      health: {
        bodyWater: { type: String, default: null },
        edema: { type: String, default: null },
        lifestyle: { type: String, default: null },
      },
    },

    // ── 체중조절 ───────────────────────────────
    control: {
      targetWeight: { type: Number, default: null },
      weightControl: { type: Number, default: null },
      fatControl: { type: Number, default: null },
      muscleControl: { type: Number, default: null },
    },

    // ── 연구항목 ───────────────────────────────
    research: {
      bmr: { type: Number, default: null },
      bmrMin: { type: Number, default: null },
      bmrMax: { type: Number, default: null },
      obesityDegree: { type: Number, default: null },
      visceralFatLevel: { type: Number, default: null },
      visceralFatArea: { type: Number, default: null },
      waistCircumference: { type: Number, default: null },
      ffmi: { type: Number, default: null },
      fmi: { type: Number, default: null },
      recommendedCalories: { type: Number, default: null },
      bcm: { type: Number, default: null },
      bmc: { type: Number, default: null },
      armCircumference: { type: Number, default: null },
      armMuscleCircumference: { type: Number, default: null },
      bodyDevelopmentScore: { type: Number, default: null },
    },

    /** 앱이 계산하는 파생 지표 */
    derived: {
      smi: { type: Number, default: null },
      waistToHeight: { type: Number, default: null },
    },

    /** 임피던스 — 주파수별 부위 측정치 */
    impedance: [
      {
        _id: false,
        freqKHz: { type: Number },
        RA: { type: Number, default: null },
        LA: { type: Number, default: null },
        TR: { type: Number, default: null },
        RL: { type: Number, default: null },
        LL: { type: Number, default: null },
      },
    ],

    /** 스키마에 없는 항목 — 화면에 그대로 나열한다 */
    etc: [
      {
        _id: false,
        label: { type: String, required: true },
        value: { type: String, required: true },
        unit: { type: String, default: null },
      },
    ],

    /** 추출 메타 — 사후 추적용 */
    extraction: {
      model: { type: String, default: null },
      warnings: [{ type: String }],
      editedByUser: { type: Boolean, default: false },
    },

    note: { type: String, default: null },
  },
  { timestamps: true },
);

/** 날짜당 1건 (같은 날 재업로드 시 교체) */
MeasurementSchema.index({ userId: 1, measuredDate: 1 }, { unique: true });
MeasurementSchema.index({ userId: 1, measuredAt: -1 });

export type MeasurementDocument = InferSchemaType<typeof MeasurementSchema>;

export function getMeasurementModel(): Model<MeasurementDocument> {
  return (mongoose.models.Measurement ??
    mongoose.model("Measurement", MeasurementSchema)) as Model<MeasurementDocument>;
}

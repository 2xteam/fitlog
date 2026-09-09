import { notFound } from "next/navigation";
import { BloodRadar } from "@/components/BloodRadar";
import { ANALYTES, PRIMARY_ANALYTES } from "@/lib/bloodCatalog";
import type { BloodRow } from "@/lib/blood";

/**
 * 차트 미리보기 — **개발 환경 전용.** 로그인·DB 없이 샘플 데이터로 BloodRadar 모양을 본다.
 * 모양을 여러 번 고치는 동안 매번 로그인해 실제 기록을 열지 않으려고 두었다 (2026-09-09).
 * 운영에서는 404 다.
 */
export default function RadarPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const byCode = (code: string) => ANALYTES.find((a) => a.code === code)!;

  /* 핵심 5축 — 전부 정상, eGFR 만 하한 참고치 */
  const normalRow: BloodRow = {
    _id: "p1",
    testedAt: "2026-09-01T09:00:00+09:00",
    results: [
      { code: "ALT", name: "ALT", value: 16, unit: "U/L", refHigh: 55 },
      { code: "LDL", name: "LDL", value: 113, unit: "mg/dL", refHigh: 130 },
      { code: "TG", name: "TG", value: 72, unit: "mg/dL", refHigh: 150 },
      { code: "HBA1C", name: "HbA1c", value: 5.5, unit: "%", refLow: 4, refHigh: 6 },
      { code: "EGFR", name: "eGFR", value: 68.37, unit: "mL/min/1.73m²", refLow: 60 },
    ],
  };

  /* 벗어남이 섞인 경우 — 높음·낮음·많이 벗어남·없음 */
  const mixedRow: BloodRow = {
    _id: "p2",
    testedAt: "2026-09-05T09:00:00+09:00",
    results: [
      { code: "ALT", name: "ALT", value: 81, unit: "U/L", refHigh: 55, flag: "H" },
      { code: "LDL", name: "LDL", value: 168, unit: "mg/dL", refHigh: 130, flag: "H" },
      { code: "TG", name: "TG", value: 95, unit: "mg/dL", refHigh: 150 },
      { code: "HBA1C", name: "HbA1c", value: 3.6, unit: "%", refLow: 4, refHigh: 6, flag: "L" },
      /* eGFR 없음 */
    ],
  };

  /* 벗어난 항목 셋 — 두 번째 차트 (compact) 와 같은 자리 */
  const flaggedRow: BloodRow = {
    _id: "p3",
    testedAt: "2026-09-05T09:00:00+09:00",
    results: [
      { code: "TBIL", name: "TBIL", value: 1.51, unit: "mg/dL", refLow: 0.2, refHigh: 1.2, flag: "H" },
      { code: "UA", name: "UA", value: 7.89, unit: "mg/dL", refLow: 3.5, refHigh: 7.0, flag: "H" },
      { code: "VITD", name: "VITD", value: 27, unit: "ng/mL", refLow: 30, flag: "L" },
    ],
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", display: "grid", gap: 40 }}>
      <section>
        <p className="eyebrow">PREVIEW · 전부 정상</p>
        <BloodRadar analytes={PRIMARY_ANALYTES} row={normalRow} testedAt="2026. 9. 1" />
      </section>
      <section>
        <p className="eyebrow">PREVIEW · 높음 둘 · 낮음 하나 · 없음 하나</p>
        <BloodRadar analytes={PRIMARY_ANALYTES} row={mixedRow} testedAt="2026. 9. 5" />
      </section>
      <section>
        <p className="eyebrow">PREVIEW · 벗어난 항목 셋 (compact)</p>
        <BloodRadar analytes={["TBIL", "UA", "VITD"].map(byCode)} row={flaggedRow} compact />
      </section>
    </main>
  );
}

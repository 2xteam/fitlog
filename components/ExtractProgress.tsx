"use client";

import { useEffect, useState } from "react";

/**
 * 결과지 분석이 진행되는 동안 보여 주는 띠와 안내.
 *
 * 분석은 한 장에 10~20초가 걸린다. 그 사이에 버튼 글씨만 바뀌면 사람은
 * "멈췄나" 를 의심한다. 그래서 두 가지를 함께 보여 준다 —
 *
 * ① **어디까지 왔는지**: 몇 장 중 몇 번째인지, 지금 무슨 일을 하는지
 * ② **기다리는 동안 알아 두면 좋은 것**: 시간이 지날 때마다 하나씩 바뀐다
 *
 * ⚠️ **띠와 글씨는 애니메이션 없이도 보여야 한다.** 진행 표시가 등장
 * 애니메이션에 의존하면, 애니메이션이 시작 상태에서 멈춘 브라우저에서
 * "아무 일도 안 일어나는 화면"이 된다. 움직임은 활성 구간의 반짝임에만
 * 쓰고, 그것도 `prefers-reduced-motion` 에서 끈다.
 * → my-obsidian-vault / 30-Patterns/화면 확인의 함정.md
 *
 * 이 컴포넌트는 **FitLog 전용**이다. `ScrollProgress` 처럼 여섯 앱에
 * 복사된 파일이 아니므로 여기서만 고치면 된다.
 */

export type ExtractPhase = "shrink" | "read";

export type ExtractProgressState = {
  phase: ExtractPhase;
  /** 1부터 센다 */
  current: number;
  total: number;
};

const PHASE_LABEL: Record<ExtractPhase, string> = {
  shrink: "사진을 줄이는 중",
  read: "결과지를 읽는 중",
};

/**
 * 기다리는 동안 하나씩 보여 주는 안내.
 *
 * ⚠️ **여기 적은 것은 모두 실제 동작이어야 한다.** 기다림을 채우려고 없는
 * 기능을 적으면, 사람이 그것을 찾다가 없다는 것을 알게 된다. 각 문장의
 * 근거를 주석에 남겨 두었다.
 */
const TIPS: readonly string[] = [
  /* runExtract 가 files 를 모두 돌고, done.sort 로 measuredAt 순으로 정렬한다 */
  "사진은 여러 장을 한 번에 올릴 수 있어요. 검사일이 오래된 것부터 차례로 검토합니다.",
  /* step "review" 에서 값을 고칠 수 있다 */
  "읽어낸 숫자는 다음 화면에서 고칠 수 있어요. 저장하기 전에 꼭 한 번 봐 주세요.",
  /* lib/inbody.ts validateMeasurement — 체수분+단백질+무기질+체지방 합 검산 */
  "체수분·단백질·무기질·체지방을 더한 값이 체중과 맞는지 검산해요.",
  /* 같은 함수 — 키·체중으로 계산한 BMI 와 대조 */
  "키와 체중으로 계산한 BMI가 결과지의 BMI와 다르면 알려드려요.",
  /* 같은 함수 — 골격근량 > 제지방량 경고 */
  "골격근량이 제지방량보다 크게 읽히면 숫자를 다시 보라고 알려드려요.",
  /* extract 라우트가 원본을 R2 에 올리고, 실패하면 imageError 를 준다 */
  "원본 사진은 따로 보관해요. 보관하지 못하면 그 이유까지 알려드립니다.",
  /* lib/clientImageResize.ts — UPLOAD_HARD_LIMIT_BYTES = 4MB */
  "사진은 보내기 전에 줄여요. 그래도 4MB를 넘으면 분석 전에 걸러집니다.",
];

/** 안내가 바뀌는 간격. 짧으면 읽기 전에 지나가고, 길면 멈춘 것처럼 보인다 */
const TIP_MS = 5500;

export function ExtractProgress({ phase, current, total }: ExtractProgressState) {
  const [tip, setTip] = useState(0);
  const [seconds, setSeconds] = useState(0);

  /*
    안내 순환과 경과 시간은 **이 컴포넌트가 붙어 있는 동안** 흐른다.
    단계(phase)가 바뀔 때마다 다시 시작하면 첫 안내만 반복해서 보인다.
  */
  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const next = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_MS);
    return () => {
      clearInterval(tick);
      clearInterval(next);
    };
  }, []);

  /* 끝난 장의 비율. 활성 구간은 따로 그린다 — 가짜 퍼센트를 만들지 않는다 */
  const done = total > 0 ? (current - 1) / total : 0;
  const activeWidth = total > 0 ? 1 / total : 1;

  const phaseText = PHASE_LABEL[phase];
  const countText = total > 1 ? `${total}장 중 ${current}번째 · ` : "";

  return (
    <div className="extract-progress">
      <div
        className="extract-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current - 1}
        aria-label="결과지 분석 진행"
      >
        <div
          className="extract-progress__done"
          style={{ width: `${done * 100}%` }}
        />
        <div
          className="extract-progress__active"
          style={{ left: `${done * 100}%`, width: `${activeWidth * 100}%` }}
        />
      </div>

      <p className="extract-progress__text" aria-live="polite">
        {countText}
        {phaseText}
        <span className="extract-progress__secs"> · {seconds}초</span>
      </p>

      {/*
        안내는 진행 상태가 아니라 읽을거리다. `aria-live` 를 두 곳에 걸면
        화면 읽기 프로그램이 5.5초마다 진행 문구까지 다시 읽는다 — 여기는
        걸지 않는다.
      */}
      <p className="extract-progress__tip">{TIPS[tip]}</p>
    </div>
  );
}

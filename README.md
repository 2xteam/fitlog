# FitLog

`fitlog.myjane.co.kr` — 인바디 결과지를 사진으로 기록하고 체성분 추이를 관리하는 앱.

> **스택**: Next.js 15 · Node.js 22 · MongoDB Atlas(`fit` DB) · OpenAI Vision · Cloudflare R2 · Vercel

## 다른 앱과의 관계

SnapWord·SnapNote와 **회원을 공유**한다.

- 앱 데이터: `fit` DB (`measurements`, `weights`, `activities`, `chatthreads`)
- 회원: **`user` DB의 `users` 컬렉션** — [models/User.ts](models/User.ts)의 `useDb("user")`
- 세션: 쿠키 `snap_user`, 도메인 `.myjane.co.kr` → 세 앱 간 로그인 유지
  ⚠️ Vercel에서 `NEXT_PUBLIC_COOKIE_DOMAIN`은 반드시 **Config 타입**으로 등록해야 한다.
  Secret으로 등록하면 브라우저 번들에 값이 주입되지 않아 쿠키가 host-only가 된다.

`heightCm` / `gender` / `birthYear`는 FitLog에서만 입력받는 필드이며 공용 `users` 문서에 저장한다.

## 데이터 모델

### measurements — 인바디 측정 1건

기종(270 · 270S · 720 · 970 · 구형)마다 인쇄 항목이 달라 대부분 선택값이다.

| 그룹 | 내용 |
|---|---|
| `composition` | 체수분(세포내/외) · 단백질 · 무기질 · 골무기질 · 체지방량 · 근육량 · 제지방량 · 체중 |
| `muscleFat` | 골격근량 |
| `obesity` | BMI · 체지방률 · 복부지방률 |
| `segmental` | lean / fat / ecwRatio × 5부위 (kg · % · 등급) |
| `evaluation` | 인바디점수 · 위상각 · 신체균형 · 비만평가 · 영양평가 · 신체강도 · 건강진단 |
| `control` | 적정체중 · 체중/지방/근육 조절 |
| `research` | 기초대사량 · 비만도 · 내장지방(레벨·단면적) · 허리둘레 · FFMI · FMI · BCM · BMC · AC · AMC |
| `impedance` | 주파수별 RA/LA/TR/RL/LL |
| `derived` | 앱이 계산: SMI(골격근지수), 허리/키 비율 |
| **`etc`** | **스키마에 없는 항목** — label/value/unit으로 보관하고 화면에 그대로 나열 |

수치 항목은 `{ value, min, max }` 형태로, 결과지에 인쇄된 **표준범위까지 함께** 저장한다.

**날짜당 1건**(`userId + measuredDate` 유니크). 하루에 여러 번 측정해도 체성분이 변한 게 아니라
식사·수분·운동에 따른 측정 조건 차이라 기록 가치가 없다. 같은 날 다시 올리면 교체한다.
단 `measuredAt`에는 시각까지 남겨 측정 조건 비교에 쓴다.

### weights — 체중 기록

체중계는 매일, 인바디는 몇 달에 한 번이라 분리했다. 그래프에서 함께 그린다.

## 추출 정확도

인바디 결과지는 내부 계산이 맞아떨어진다. 이 성질로 Vision의 숫자 오인식을 잡는다
([lib/inbody.ts](lib/inbody.ts)의 `validateMeasurement`).

| 검사 | 허용 오차 |
|---|---|
| 체수분 + 단백질 + 무기질 + 체지방 = 체중 | ±0.6kg |
| BMI = 체중 ÷ (키m)² | ±0.4 |
| 체지방률 = 체지방량 ÷ 체중 × 100 | ±0.8%p |
| 제지방량 = 체중 − 체지방량 | ±0.6kg |
| 골격근량 ≤ 제지방량 | — |

추출 결과는 **저장 전 반드시 검토 화면**을 거치며, 검증에 걸린 필드를 표시한다.

## 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3003
```

포트 3003 — SnapWord(3000)·SnapNote(3001)·myjane(3002)과 동시 실행용.

## 진행 상황

- [x] 프로젝트 골격 · 인증(회원 공유) · 테마 · 네비 · 푸터
- [x] 데이터 모델 (`measurements`, `weights`) 및 필드 카탈로그
- [x] Vision 추출 파이프라인 + 정합성 검증
- [x] `POST /api/measurements/extract`, `GET·POST /api/measurements`
- [ ] 프로필 게이트 (키·성별·생년 입력)
- [ ] 업로드 → 검토·수정 → 저장 화면
- [ ] 측정 목록 · 상세 (표준범위 막대 · `etc` 목록 · 원본 사진)
- [ ] 체중 기록 화면
- [ ] 추이 그래프 (전체 3종 · 항목별)
- [ ] BMI 계산기
- [ ] AI Fit 상담사 (최근 측정값을 컨텍스트로 주입)
- [ ] 공지 · 문의 · My
- [ ] Vercel 배포 · 도메인 연결

# 작업 전에 읽을 것

이 프로젝트의 배경 지식은 별도의 옵시디언 볼트에 정리되어 있다.

```
로컬:   C:\Dev\my-obsidian-vault
저장소: https://github.com/2xteam/my-obsidian-vault
```

## 먼저 읽기

1. `10-Projects/FitLog.md` — 이 프로젝트의 스택·데이터·현황·결정 사항
2. `00-Meta/AI 협업 규칙.md` — 볼트를 읽고 갱신하는 방법

작업 성격에 따라 추가로:

| 작업 | 노트 |
|---|---|
| 배포·환경 변수·도메인 | `30-Patterns/Vercel 배포 패턴.md`, `40-Infra/도메인과 DNS.md` |
| 이미지 업로드 | `30-Patterns/이미지 업로드 패턴.md` |
| 로그인·회원·세션 | `30-Patterns/인증과 세션 공유.md` |
| DB 연결 | `40-Infra/MongoDB Atlas.md` |
| 페이지 디자인 | `20-Design/` 전체 |

## 이 프로젝트 메모

- 관리 화면은 **포털**에 있다(`www.myjane.co.kr/admin`). 여기엔 `/api/admin/*` 만 둔다 → `30-Patterns/통합 admin.md`
- 인바디 추출은 `30-Patterns/OpenAI Vision 추출 패턴.md`
- 피검사(Blood) 지식은 `30-Patterns/피검사 지식베이스.md`, 인바디는 `30-Patterns/인바디 지식베이스.md`
- **인바디 값에는 BIA 기준을 쓴다.** DXA 기준(AWGS 여성 5.4)을 갖다 대면 근감소를 놓친다
- RAG 주제 청크는 **손으로 쓰지 않는다** — `lib/{inbody,blood}RagChunks.ts`가 카탈로그에서 생성한다
- 권고는 `evidence` 등급과 `basis` 없이 추가하지 않는다 (`lib/evidence.ts`)
- 상담은 스트리밍(`/api/chat/threads/[id]/stream`). 지침은 `buildChatInstructions`로 두 경로가 공유한다
- 개발 서버가 켜진 채 빌드하려면 `NEXT_DIST_DIR=.next-build`. 끝나면 `git checkout tsconfig.json next-env.d.ts`
- 데이터 모델 설계 원칙(표준범위 저장 · `etc` 보관 · 날짜당 1건)은 프로젝트 노트에 정리되어 있다
- 회원은 `user` DB 공유. `heightCm`/`gender`/`birthYear`는 FitLog 전용 필드

## 작업이 끝나면

바뀐 사실(도메인·DB·진행 상황·새로 발견한 함정)을 볼트의 해당 노트에 반영하고
`updated` 날짜를 올린다. 볼트 수정은 코드와 **별도 커밋**으로 남긴다.

비밀값은 볼트에 쓰지 않는다. 공개 저장소다.

# 캣포유 웹 (Cat4U Web)

![image](https://github.com/user-attachments/assets/abfb2237-e5b3-46d8-9473-6ccbba1cea79)

이브 온라인 코퍼레이션 내부용 커뮤니티 웹입니다.  
피팅/독트린 공유, 게시판, 권한 기반 접근 등 코퍼 운영에 필요한 기능을 제공합니다.

---

## 프로젝트 목표

- EVE 플레이어를 위한 **게시판 기반 정보 공유** (피팅/독트린/가이드 등)
- **EVE SSO(OAuth2) 로그인**과 권한 기반 기능 제공
- 업로드 파일(S3) 및 에디터(BlockNote) 기반의 콘텐츠 작성 경험 제공
- 운영 환경에서 관측/에러 추적(Sentry)과 보안 설정을 단계적으로 강화

---

## 서비스 구성

- **Frontend**
  - Next.js 기반 정적 빌드 후 **S3/CloudFront**로 서빙
- **Backend**
  - Node.js(Express) API 서버
  - Caddy 리버스 프록시로 HTTPS 제공
- **Storage / CDN**
  - S3 업로드 및 CloudFront 서빙
  - 프로덕트 환경은 서명 URL/쿠키 기반 접근 제어로 전환 예정
- **Config / Secret**
  - Key Vault 기반 환경변수 관리(로드 타이밍 고려)

---

## 사용 기술

| 구분 | 기술 |
| --- | --- |
| Frontend | Next.js, React, Tailwind CSS |
| Editor | BlockNote (@blocknote/*) |
| Backend | Node.js (Express) |
| DB | MySQL / MariaDB, Prisma |
| Cache / Queue | Redis, SQS(일부 워커) |
| Auth | JWT, EVE SSO(OAuth2) |
| Infra | Docker, Caddy, PM2 |
| Observability | Sentry(도입 예정) |

---

## 로컬 실행 (개요)

1) Frontend
- `npm install`
- `npm run dev`

2) Backend
- `.env` 또는 Key Vault 로딩 스크립트 준비
- DB/Redis 실행(Docker 권장)
- `npm install`
- `npm run start`

---

## 운영 메모

- 프로덕트 S3는 현재 퍼블릭 정책이 열려 있을 수 있으며, 추후 **Signed URL/쿠키 기반**으로 전환합니다.
- 클러스터링(PM2)은 state/세션/웹소켓 등과의 궁합을 검증 후 적용합니다.
- Sentry는 공개 베타 이후 정책(PII/비용/이벤트 필터)을 확정하고 붙입니다.

---

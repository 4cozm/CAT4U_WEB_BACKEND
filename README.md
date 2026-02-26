# CAT4U Web Backend

CAT4U는 EVE Online 커뮤니티를 위한 고도화된 지식 공유 및 가이드 관리 플랫폼의 백엔드 시스템입니다.
단순한 게시판 형태를 넘어, 게임의 방대한 정적 데이터(SDE)와 패치노트를 AI가 분석하여 기존에 작성된 가이드 문서들에 미치는 영향을 자동으로 추적하고 관리하는 형태의 인텔리전스 문서를 제공합니다.

---

## 🚀 주요 기능 (Core Features)

### 1. AI-Driven 패치 검증 파이프라인 (Patch Impact Tracking)
* **패치노트 크롤러 (`patchNoteCrawler.js`)**: 공식 EVE Online 홈페이지의 패치노트를 자동으로 수집.
* **영향도 분석**: AI SDK를 활용해 수집된 패치 내용 중, 게임 아이템(함선, 모듈 등) 데이터 변경 사항을 파악.
* **자동 이슈 레이블링**: 변경 사항과 연관된 `태그(Tag)`가 포함된 기존 `Guide` 문서를 탐색하여, 갱신이 필요하다는 Issue Status (`IssueStatus.OPEN`)를 자동 부과.

### 2. SDE(Static Data Export) 통합 팩트체크 로직
* 게임 내 실제 데이터 모델(SDE)과 연동하여 문서 작성 시 정확한 수치와 정보를 제공.
* 유저가 작성/수정한 문서 및 AI가 번역하거나 생성한 초안(Draft)에 대해 기초 데이터 검증(Fact-Check) 수행.

### 3. Human-in-the-Loop 기반 문서 승인 시스템
* 단순 AI 의존 모델을 탈피하여, `GuideDraft`의 신뢰성을 담보하기 위해 다수(기본 3인)의 유저 승인(Approval)을 요구.
* 유저 리뷰(Reviewing) -> 승인 완료(Approved) -> AI 문서 포매팅(Formatting) -> 최종 발행(Published)되는 체계적인 워크플로우 구성.

### 4. 확장 가능한 인프라 및 파일 처리 (AWS & Redis)
* **AWS S3 / CloudFront**: Presigned URL을 통한 대용량 에셋(이미지, 영상) 안전 업로드/서빙.
* **AWS SQS**: `sqsWorker.js`를 통해 비동기 백그라운드 작업(파일 최적화 및 찌꺼기 데이터 정리) 수행.
* **Redis**: 빠르고 일관된 인증 세션 및 API Rate-limiting 등의 캐싱 레이어 역할.

---

## 🛠 기술 스택 (Tech Stack)

* **Runtime & Framework**: Node.js (v20+), Express (v5)
* **Database & ORM**: MariaDB / PostgreSQL 호환 모델링, Prisma ORM
* **Caching & Queue**: Redis
* **AI Integration**: `@google/generative-ai`, `@ai-sdk/google`, `ai`
* **Cloud Infrastructure**: AWS S3, AWS SQS, AWS CloudFront
* **Authentication**: EVE SSO 기반 Oauth 연동 (Bcrypt, JWT)
* **Task Scheduling & Utility**: Node-Cron (스케줄러), Cheerio (HTML 파싱), Winston (로깅)
* **Validation & Type**: Zod, ESLint, Prettier, Husky

---

## 📂 주요 디렉토리 구조 (Directory Structure)

```text
.
├── src/
│   ├── config/          # 데이터베이스, AWS, Redis 등 인프라 설정
│   ├── controllers/     # API 라우팅 모듈 (Express Routing)
│   ├── services/        # 주요 비즈니스 로직 (Auth, SDE 검증, S3 연동 등)
│   ├── jobs/            # 백그라운드 스케줄러 (크롤링, SDE 갱신, 패치노트 수집)
│   └── app.js / server.js
├── prisma/
│   ├── schema.prisma    # Prisma 데이터베이스 스키마 정의 (User, Board, Draft, File 등)
│   └── migrations/      # DB 마이그레이션 이력
├── data/                # 로컬에 다운로드/저장되는 SDE 참조 파일 등
└── package.json         # 모듈 의존성 및 스크립트
```

---

## ⚙️ 실행 방법 (Getting Started)

### 환경 변수 설정 (.env)
루트 디렉토리에 `.env` 파일을 생성하고 다음 필수 항목들을 입력합니다.
```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/cat4u_web"

# Redis
REDIS_URL="redis://localhost:6379"

# AWS
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET_NAME="..."
AWS_SQS_QUEUE_URL="..."

# AI (Google Gemini)
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

### 설치 및 구동
```bash
# 1. 의존성 설치
npm install

# 2. Prisma 클라이언트 생성
npx prisma generate

# 3. 데이터베이스 동기화 (필요시)
npx prisma db push

# 4. 개발 서버 실행
npm run dev
```

---

## 🔒 라이선스
MIT License (자세한 내용은 `LICENSE` 파일 참조)

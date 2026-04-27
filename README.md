# CAT4U: EVE Online Intelligence Guide Community

EVE Online의 방대한 도메인 데이터를 구조화하고, AI 기반 패치 영향도 추적 및 미디어 최적화 파이프라인을 제공하는 차세대 가이드 플랫폼

* 이 프로젝트는 정보의 파편화와 수동 업데이트의 한계를 극복하기 위해, 게임 정적 데이터(SDE)와 실시간 패치노트를 연동하여 가이드의 정확성을 자동으로 유지하는 시스템을 구축한다.

## 1. 왜 이 프로젝트가 필요한가

* **가이드의 휘발성**: EVE Online은 빈번한 밸런스 패치로 인해 기존 가이드의 수치가 빠르게 구식(Outdated)이 되지만, 이를 일일이 찾아 갱신하는 비용이 너무 커 정보 오염이 가속화됨.
* **비정형 데이터의 한계**: 단순 위키는 정보 나열에는 강하나, 상황별 공략(Context)을 전달하기 위한 리치 미디어 UX가 부족하며, 일반 커뮤니티는 장문 가이드를 체계적으로 구조화하여 보관하기 어려움.
* **검증되지 않은 AI 정보**: 일반적인 LLM은 EVE의 복잡한 수치 체계에서 빈번한 환각(Hallucination)을 일으키며, 이는 가이드의 신뢰도를 치명적으로 저하시킴.

## 2. 핵심 제약

* **데이터 무결성**: 모든 가이드는 게임 내 실제 데이터(SDE)와 일치해야 하며, 패치 발생 시 연관된 모든 문서의 상태가 즉시 추적되어야 함.
* **인프라 비용 효율성**: 고해상도 게임 미디어(4K 스크린샷, 영상)의 대량 업로드에 따른 서버 대역폭 및 스토리지 비용을 최소화해야 함.
* **엄격한 인증 및 권한**: EVE SSO(ESI)를 통해 실제 캐릭터 소유권이 확인된 사용자만 문서 승인 및 편집 권한을 가짐.

## 3. 해결 전략

* **AI-Driven 패치 영향도 추적**: `patchNoteCrawler`가 새 패치를 감지하면 AI가 변경된 객체의 태그를 추출하고, 해당 태그를 포함하는 기존 가이드들을 `IssueStatus.OPEN` 상태로 자동 전환하여 갱신을 강제함.
* **SDE 통합 팩트체커**: AI가 가이드 초안을 작성하거나 수정할 때, 추측이 아닌 내장된 SQLite SDE 데이터를 Function Calling으로 직접 조회하여 수치 정확성을 보장함.
* **Human-in-the-Loop 워크플로우**: AI가 생성한 초안은 즉시 발행되지 않고, 3인 이상의 검증된 유저 승인을 거쳐야만 최종 발행되는 승인 체계(`DraftApproval`) 구축.
* **비동기 미디어 최적화 파이프라인**: MD5 해싱을 통한 클라이언트 사이드 중복 제거 후, SNS-SQS-Lambda를 거쳐 WebP/H.265로 최적화하여 서빙 성능 극대화.

## 4. 아키텍처 / 데이터 흐름

### 패치 영향도 분석 및 문서 갱신 흐름
1. **Cron Job**: 정기적으로 공식 홈페이지의 패치노트를 크롤링하여 `PatchNote` 테이블 저장
2. **AI Analysis**: Gemini가 패치 텍스트를 분석하여 영향받는 아이템(Tag) 추출 및 `PatchImpact` 기록
3. **Status Tracking**: 해당 Tag를 포함한 모든 `Board`를 필터링하여 `DocumentIssue` 생성 및 알림 발송
4. **Discord Bot**: 운영진 스레드에 수정이 필요한 문서 목록과 패치 근거를 자동 포스팅

### 미디어 처리 및 참조 관리 흐름
1. **Client**: 파일 MD5 해시 생성 → 백엔드에 중복 확인 요청
2. **Backend**: 중복 시 기존 S3 URL 반환 / 미중복 시 S3 Post-signed URL(incoming 폴더) 발급
3. **Lambda (FFmpeg)**: SQS 메시지를 수신하여 WebP 변환 후 optimized 폴더 이동
4. **Ref Counter**: 게시글 저장 시 문서 내 이미지 MD5를 추출하여 `ref_count` 증감, 미사용 파일 자동 정리

## 5. 주요 구현 포인트

### 5.1 Deterministic AI Control
* 환각 방지를 위해 AI 호출 시 `temperature=0`을 고정하고, 사전 정의된 SDE 태그 풀 내에서만 응답하도록 시스템 프롬프트를 강제함.
* `sdeSkills.js`를 통해 복잡한 Dog마 속성(저항, 피팅 슬롯 등)을 AI가 이해할 수 있는 JSON 구조로 매핑하여 제공.

### 5.2 안정적인 비동기 워커 (SQS)
* 이미지 변환 워커는 가시성 타임아웃(Visibility Timeout) 설정을 통해 중복 처리를 방지하며, 처리 실패 시 DLQ(Dead Letter Queue)에 적체하여 운영자가 Redrive를 통해 사후 조치할 수 있도록 구현.

### 5.3 리치 에디터 커스터마이징 (BlockNote)
* 단순 텍스트를 넘어 이브 온라인의 수천 가지 인게임 아이콘을 검색하여 블록 내에 즉시 삽입할 수 있는 커스텀 메뉴와 슬래시 커맨드 구현.

## 6. 운영 관점에서 중요했던 점

* **보안 요구사항**: Azure Key Vault를 연동하여 AWS 자격 증명 및 AI API 키를 안전하게 관리하며, 로컬 환경과 배포 환경의 설정을 일관되게 유지.
* **디렉토리 구조 체계화**: 로직 분리를 위해 `controllers`, `service`, `jobs`로 역할을 명확히 분담하여 확장성 확보.
* **데이터베이스 유연성**: Prisma ORM을 사용하여 MySQL 기반의 주 DB 구조를 유지하면서도, 정적 데이터(SDE) 처리를 위해 로컬 SQLite를 병행 사용하는 하이브리드 저장 구조 채택.

## 7. 트레이드오프와 한계

* **승인 지연 가능성**: 3인 이상의 휴먼 리뷰를 필수 전제로 하므로 정보 반영 속도가 늦어질 수 있음. 이를 보완하기 위해 AI가 1차 포매팅과 팩트체크를 수행한 초안을 제공하여 검토자의 피로도를 낮춤.
* **클라이언트 사이드 신뢰**: 해싱 과정을 클라이언트에 위임하여 서버 부하를 줄였으나, 이론적 조작 가능성이 존재함. 이는 ESI 인증 유저에 한정된 폐쇄적 커뮤니티 특성을 고려하여 비용 효율성을 우선한 결정임.

## 8. 사용 기술

* **Runtime**: Node.js v20+, Express v5
* **Persistence**: Prisma ORM (MySQL), better-sqlite3 (SDE)
* **Cloud**: AWS S3, CloudFront, SQS, SNS, Lambda
* **AI**: Google Gemini 2.0 Flash, @ai-sdk/google
* **Storage/Cache**: Redis
* **DevOps**: GitHub Actions, Azure Key Vault, Husky/Lint-staged

## 9. 참고 링크

* **Backend Repository**: [CAT4U_WEB_BACKEND](https://github.com/4cozm/CAT4U_WEB_BACKEND)
* **Frontend Repository**: [CAT4U_WEB_FRONTEND](https://github.com/4cozm/CAT4U_WEB_FRONTEND)

---

## 부록: 시작하기 (Getting Started)

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

# 3. 데이터베이스 동기화
npx prisma db push

# 4. 개발 서버 실행
npm run dev
```

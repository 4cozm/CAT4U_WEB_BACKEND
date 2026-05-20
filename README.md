# CAT4U: EVE Online Intelligence Guide Platform (Backend)

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v5.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Cache%20%26%20Lock-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![AWS](https://img.shields.io/badge/AWS-S3%20%7C%20SQS%20%7C%20Lambda-232F3E?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![Gemini](https://img.shields.io/badge/Gemini-AI--SDK-4285F4?logo=google-gemini&logoColor=white)](https://ai.google.dev/)

> **EVE Online의 정적 데이터(SDE)와 실시간 패치노트를 연동하고, AWS 서버리스 비동기 미디어 최적화 파이프라인 및 LLM 제어 시스템을 활용하여 가이드 정보의 정확성을 관리하는 가이드 커뮤니티 백엔드 시스템입니다.**  
> *본 저장소는 백엔드 아키텍처 설계와 실제 직면한 성능 및 동시성 문제를 해결한 엔지니어링 사례들을 중심으로 작성되었습니다.*

---

## 1. 아키텍처 및 데이터 파이프라인

본 시스템은 **비동기 분산 메시징(SQS)**, **LLM 제어 통합(Gemini)**, 그리고 **하이브리드 데이터베이스 저장 구조(MySQL + SQLite)**를 기반으로 설계되어 결합도를 낮추고 데이터 신뢰성과 인프라 비용 효율성을 관리합니다.

### 1.1 AI 가이드 생성 및 패치 영향도 추적 파이프라인 (6단계 Loop)
```mermaid
graph TD
    A[공식 패치노트 크롤러] -->|1. PatchNote 저장| B[(MySQL)]
    A -->|2. 변경 텍스트 전달| C[Gemini AI-SDK]
    D[(SQLite SDE)] <-->|3. Fact-checking SQL| C
    C -->|4. 영향 아이템 Tagging| E[PatchImpact DB 기록]
    E -->|5. 연관 가이드 Issue 전환| F[(MySQL: Boards)]
    F -->|6. 수정 요청 발행| G[AWS SQS]
    G -->|비동기 Queueing| H[Discord Webhook/Bot]
    H -->|승인/수정 알림| I[인간 검토자 Human-in-the-Loop]
```

### 1.2 비동기 미디어 최적화 및 데이터베이스 참조 라이프사이클
고해상도 게임 스크린샷과 영상 업로드에 따른 대역폭 및 스토리지 비용을 최소화하고, 서버의 리소스 소모를 방지하기 위한 비동기 미디어 파이프라인 흐름입니다.
```mermaid
sequenceDiagram
    autonumber
    actor Client as 클라이언트
    participant BE as Express 백엔드
    participant S3 as AWS S3 (incoming)
    participant SQS as AWS SQS
    participant Lambda as AWS Lambda (FFmpeg)
    participant DB as MySQL (Prisma)

    Client->>BE: 파일 MD5 해시 전달 (중복 업로드 검사)
    alt 중복인 경우
        BE-->>Client: 기존 S3 CDN URL 즉시 반환 (Instant Upload)
    else 신규인 경우
        BE-->>Client: S3 Post-Signed URL 발급 (incoming/ 경로)
        Client->>S3: 파일 직접 업로드
        S3-->>SQS: S3 ObjectCreated 이벤트 발행
        SQS->>Lambda: Lambda 트리거 호출 (비동기)
        Note over Lambda: FFmpeg 활용 WebP/H.265 트랜스코딩<br/>optimized/ 경로 이동 및 incoming 원본 자동 삭제
        Lambda->>DB: 파일 DB 상태 업데이트 (status: optimized)
    end
    Client->>BE: 게시글 저장 요청 (Markdown blocks)
    Note over BE: 게시글 내 S3 URL의 md5 추출<br/>트랜잭션 내 DB `file.ref_count` 증감 처리
    BE->>DB: Board 저장 & file_ref_count 갱신
```

---

## 2. 주요 엔지니어링 챌린지 & 트러블슈팅 (Core Case Studies)

### 🚀 Case 1. PM2 클러스터 환경의 Cron 배치 레이스 컨디션 및 DB 커넥션 병목 해결
* **배경 & 문제**:  
  멀티 코어 자원을 활용하기 위해 PM2를 `Cluster Mode`로 실행한 후, 서버 시작 시 등록되는 **정기 데이터 정리 배치 Job**(`boardClean.js`)이 개별 인스턴스에서 각각 실행되는 레이스 컨디션(Race Condition)이 발생했습니다. 초기에는 이를 제어하기 위해 MySQL의 명명된 잠금(`GET_LOCK`)을 적용하였으나, **Prisma ORM의 커넥션 풀(Connection Pool) 특성과 충돌하는 현상**이 나타났습니다.
  
  MySQL `GET_LOCK`은 락을 획득한 세션(DB 커넥션) 내에서만 정상적으로 유지 및 해제가 가능합니다. 하지만 Prisma ORM은 쿼리 시마다 임의의 커넥션을 풀에서 할당하므로, 락을 잡은 커넥션과 해제를 시도하는 커넥션이 일치하지 않을 수 있어 `RELEASE_LOCK`이 실패(0 반환)하고 락이 해제되지 않는 문제가 관측되었습니다. 이로 인해 정기 배치 실행 시마다 데이터베이스 커넥션이 누수 및 고갈되어 실시간 API 응답이 지연되는 현상을 초래했습니다.

* **기술적 해결 전략**:  
  특정 DB 커넥션 세션에 종속되지 않고 클러스터 전체에서 일관되게 락 상태를 통제할 수 있도록 **Redis 기반 분산 락 구조로 전환**했습니다.
  
  ```javascript
  // Redis SET NX EX 원자적 명령을 이용해 인스턴스 간 락 획득을 제어
  const LOCK_KEY = "cron:purgeDeletedBoards";
  const LOCK_TTL_SEC = 300; // 서버가 예기치 않게 종료되는 경우를 대비한 자동 만료 시간 (5분)
  
  async function tryAcquireLock() {
      const redis = getRedisClient();
      // NX: 키가 존재하지 않을 때만 설정, EX: TTL 설정 (Redis 원자 연산 처리)
      const result = await redis.set(LOCK_KEY, "1", { NX: true, EX: LOCK_TTL_SEC });
      return result !== null;
  }
  
  async function releaseLock() {
      const redis = getRedisClient();
      await redis.del(LOCK_KEY); // 특정 세션과 무관하게 안정적으로 락 해제 가능
  }
  ```
  
* **결과**:  
  - PM2 클러스터 다중 노드 환경에서도 단 하나의 배치 스케줄러 인스턴스만 정확히 실행되도록 보장했습니다.
  - 불필요한 커넥션 풀 누수 원인을 제거하여 정기 배치 실행 시점의 안정성을 높이고 데이터 정합성을 관리할 수 있게 되었습니다.

---

### 📉 Case 2. 미사용 미디어 제거 알고리즘 최적화를 통한 풀 테이블 스캔(Full Scan) 방지
* **배경 & 문제**:  
  사용되지 않는 S3 리소스를 주기적으로 자동 선별하여 정리하기 위해 참조 카운팅(Reference Counting) 메커니즘을 적용했습니다.  
  그러나 삭제 보정(Pruning) 과정에서 작성된 기존 로직은 참조 횟수가 감소한 특정 미디어를 선별하여 확인하기 위해 **`file` 테이블 전체를 스캔(`WHERE ref_count < 0`)하는 동작 구조**를 가지고 있었습니다. 이 방식은 대용량 파일 메타데이터가 쌓일수록 데이터베이스에 가해지는 CPU 부하와 락 경합을 선형적으로 증가시켜 수정 및 쓰기 요청의 처리 효율을 저하시켰습니다.

* **기술적 해결 전략**:  
  도메인 모델의 비즈니스적 특성상 `ref_count`가 음수가 될 수 있는 레코드는 **'이번 트랜잭션 과정에서 변경되어 본문에서 제외된 대상(MD5)'**으로 한정된다는 점에 착안했습니다. 이에 따라 탐색 범위를 전체 테이블이 아닌 명확히 바뀐 파일 대상으로 좁히도록 쿼리를 최적화했습니다.
  
  ```javascript
  // [개선 전] -> file 테이블 전체를 풀 스캔하여 부하 발생
  // await tx.file.updateMany({ where: { ref_count: { lt: 0 } }, data: { ref_count: 0 } });
  
  // [개선 후] -> 이번 변경 작업으로 식별된(removed) MD5 목록으로만 데이터베이스 탐색 조건 범위 강제 한정
  if (removed.length) {
      await tx.file.updateMany({
          where: { file_md5: { in: removed } },
          data: { ref_count: { decrement: 1 } },
      });
  
      await tx.file.updateMany({
          where: {
              file_md5: { in: removed },
              ref_count: { lt: 0 },
          },
          data: { ref_count: 0 },
      });
  }
  ```
  
* **결과**:  
  - 1만 건 이상의 미디어 데이터가 축적된 상태에서 파일 정리 쿼리의 복잡도를 **O(N)에서 O(1)에 가깝게 대폭 완화**하여 데이터베이스 오버헤드를 해소했습니다.
  - 게시글의 수정 및 삭제 발생 시 트랜잭션 점유 시간을 감축하여 동시 수정 요청 상황에서의 처리 안정성을 보완했습니다.

---

### 🧠 Case 3. 일관성 있는 LLM 통제 설계를 통한 수치적 데이터 정확성 확보
* **배경 & 문제**:  
  EVE Online 게임의 데이터 특성상 함선 스펙, 모듈 속성 등의 가이드 정보는 정확한 수치가 보장되어야 합니다. 그러나 대규모 언어 모델(LLM)을 활용하여 패치노트를 분석하고 가이드 초안을 보조할 때 발생하는 **비결정론적 특성과 이로 인한 수치적 환각(Hallucination)**은 서비스의 실질적인 신뢰도를 저해하는 요인이었습니다.

* **기술적 해결 전략**:  
  수치적 정확성을 담보하고 기계적 정합성을 유지하기 위해 AI의 자율성을 제한하는 **Deterministic Control 구조**를 설계했습니다.
  
  1. **정적 데이터베이스(SDE) 팩트체크**: 실제 게임 클라이언트 데이터와 동일한 SQLite SDE 파일을 로컬에 내장했습니다. AI 모델이 임의로 수치를 유추하도록 내버려 두지 않고, **Function Calling을 통해 로컬 SQLite DB의 실제 쿼리 수치를 조회하여 팩트 체킹에 활용하도록 동선**을 제한했습니다.
  2. **Strict JSON Tagging Constraint**: 패치노트 변경 사항 분석 시, **`temperature = 0`**을 고정하고 DB에 정의된 **정적 JSON 태그 목록을 Prompt Context로 명시하여, 임의의 수식이 아닌 사전에 정의된 태그 집합 범위 내에서만 매핑 및 응답**하도록 강제했습니다.
  3. **Human-in-the-Loop 프로세스**: AI가 초안을 생성하더라도 즉시 프로덕션에 발행되지 않으며, 변경 이력(Diff)을 시각적으로 검토할 수 있는 단계를 마련하여 최소 3인 이상의 검증된 유저의 최종 승인을 거치도록 설계했습니다.

* **결과**:  
  - 가이드 제작 과정에서의 수치적 AI 오응답 및 데이터 오차 가능성을 차단하고, 실제 게임 데이터와 정렬된 신뢰성 높은 문서를 제공할 수 있게 되었습니다.
  - 신규 패치 발생 시 수작업으로 관련 문서를 탐색하던 관리자 공수를 단축하고 효율적인 검토 업무 진행이 가능해졌습니다.

---

## 3. 핵심 기술적 트레이드오프 (Architectural Trade-offs)

### 3.1 Client-side MD5 Hashing vs Server-side Media Ingestion
* **의사결정**: 파일 중복 업로드 방지를 위한 해싱 연산 처리를 백엔드 서버 대신 **클라이언트 브라우저 환경에 전가(SparkMD5 라이브러리 활용)**했습니다.
* **트레이드오프**:
  - *얻은 이점 (Gain)*: 대용량 리소스 업로드 시 서버가 전체 바이너리를 수신하여 해싱 작업을 반복 수행할 때 수반되는 CPU 오버헤드와 자원 낭비를 방지했습니다. 서버는 문자열 해시 쿼리만 검사하므로 처리 속도가 빠르고 불필요한 네트워크 대역폭 비용이 절감됩니다.
  - *고려해야 할 리스크 (Loss)*: 사용자가 악의적으로 클라이언트 코드를 우회하여 임의의 MD5 해시값을 위조해 보낼 경우, 다른 유저의 파일과 식별자가 충돌하여 오작동할 수 있는 논리적 보안 취약점이 존재합니다.
  - *보완책 (Mitigation)*: 이 커뮤니티는 인게임 API(ESI SSO)를 거쳐 신원이 사전에 명확히 소명된 제한적 유저군에만 에디터 편집 권한을 주도록 정책적으로 통제하고 있습니다. 따라서 위험 노출 범위 대비 서버 비용 효율성의 가치가 더 크다고 판단하여 이 구조를 유지하고 있습니다.

### 3.2 Human-in-the-Loop 3인 교차 검증 vs 즉각적인 자동 퍼블리싱
* **의사결정**: AI가 크롤링 및 번역을 완료한 정보를 즉시 전체 공개하지 않고, **Draft 테이블에 임시 보존한 후 최소 3인의 승인을 거치도록 검토 프로세스**를 마련했습니다.
* **트레이드오프**:
  - *얻은 이점 (Gain)*: 번역의 자연스러움과 EVE 게임 특유의 도메인 뉘앙스 정합성을 인간 검토자가 보완하여 최종 정보 품질을 견고하게 유지할 수 있습니다.
  - *고려해야 할 리스크 (Loss)*: 사용자의 투표와 검토가 누적될 때까지 최신 패치 정보가 즉각 커뮤니티에 전파되지 못하고 반영이 지연(Latency)됩니다.
  - *보완책 (Mitigation)*: 편집 피로도를 줄이기 위해, AI 모델이 BlockNote 에디터 형식에 맞는 마크업 레이아웃 가공 및 포매팅을 1차 완료한 후 Discord 채널과 대기열에 시각적 Diff와 함께 노출함으로써, 편집자가 원클릭으로 신속히 검토하고 반영할 수 있도록 UI/UX 동선을 단축했습니다.

---

## 4. 백엔드 기술 스택 (Tech Stack)

| 구분 | 기술 기술 | 역할 및 상세 설명 |
| :--- | :--- | :--- |
| **Runtime & Core** | **Node.js v20+, Express v5.0** | 비동기 I/O 기반의 성능 효율 중심 API 서버 구동 |
| **ORM & DB** | **Prisma ORM, MySQL 8.0, better-sqlite3** | 관계형 DB 스키마 관리, 트랜잭션 제어 및 로컬 SQLite 게임 정적 데이터 팩트체킹 |
| **Caching & Sync** | **Redis** | 클러스터 환경의 분산 락(SET NX EX) 제어 및 데이터 임시 캐싱 |
| **Message Queue**| **AWS SQS & SNS** | 알림 이벤트 분산 버퍼링 및 S3 Lambda 트랜스코딩 유기적 이벤트 중재 |
| **Media Pipeline**| **AWS S3, CloudFront, Lambda (FFmpeg)** | Presigned URL 기반 직접 업로드 및 서버리스 미디어 비동기 최적화 가공 |
| **Generative AI** | **Gemini 2.0 Flash, @ai-sdk/google** | 패치노트 기계식 문맥 분석, 태깅 자동 추출 및 SDE 연계 Fact-checking |
| **DevOps & SEC** | **Azure Key Vault, GitHub Actions** | AWS 비밀 키, AI API 키의 관리 보안성 확보 및 CI/CD 프로세스 안정화 |

---

## 부록: 개발 환경 셋업 (Getting Started)

> **Note**: 본 가이드는 본 저장소를 개발자 로컬 환경에 구성하기 위한 최소한의 절차입니다.

### 1. 환경 변수 구성 (.env)
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래 명세를 채워 넣습니다.
```env
# Server Port
PORT=3000

# Database Connections
DATABASE_URL="mysql://cat4u_user:password@localhost:3306/cat4u_db"

# Redis Config
REDIS_URL="redis://localhost:6379"

# AWS Configuration
AWS_REGION="ap-northeast-2"
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_S3_BUCKET_NAME="cat4u-media-storage"
AWS_SQS_QUEUE_URL="https://sqs.ap-northeast-2.amazonaws.com/123456789012/cat4u-transcode-queue"

# Google Gemini API
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSyYourGeminiAPIKeyHere..."
```

### 2. 의존성 패키지 설치
```bash
npm install
```

### 3. ORM 엔진 및 스키마 정렬
```bash
# Prisma 엔진 빌드
npx prisma generate

# 데이터베이스 구조 동기화 (Prisma Migration)
npx prisma db push
```

### 4. 로컬 개발 서버 기동
```bash
npm run dev
```

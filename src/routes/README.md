# 📂 routes

이 디렉토리는 Express 애플리케이션에서 사용하는 **API 라우팅 정의 파일**들을 포함합니다.

## 🛠 역할

- HTTP 요청 URL 패턴과 메서드를 정의합니다.
- 각 경로를 적절한 컨트롤러 함수에 연결합니다.
- 서비스 로직과 분리되어 라우팅 관리가 용이합니다.

---

## 📄 포함되는 파일 예시

- `userRoutes.js` → 사용자 인증, 회원가입, 로그인 API 라우트
- `postRoutes.js` → 게시글 CRUD API 라우트
- `githubArtifactRoutes.js` → GitHub Actions 아티팩트 조회 및 다운로드 API 라우트

---

## 🔗 사용 방법

1. 라우트 파일 생성:

    ```js
    // routes/userRoutes.js
    import express from "express";
    import { registerUser, loginUser } from "../controllers/userController.js";

    const router = express.Router();

    router.post("/register", registerUser);
    router.post("/login", loginUser);

    export default router;
    ```

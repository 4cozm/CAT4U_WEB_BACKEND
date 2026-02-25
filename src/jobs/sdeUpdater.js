/**
 * @file sdeUpdater.js
 * @description Zero-Shock SDE(Static Data Export) 자동 갱신 스케줄러.
 *
 * 동작 순서:
 *  1. Fuzzwork MD5 해시 URL을 GET하여 원격 해시 확인
 *  2. 로컬 .last_md5 파일의 해시와 비교 → 동일하면 스킵
 *  3. 변경된 경우 .bz2 파일을 스트리밍 다운로드 + zlib 실시간 압축 해제
 *  4. fs.renameSync()를 이용한 Atomic Swap (sde_new → sde_live)
 *  5. sdeService의 커넥션을 새 파일로 교체 (refreshConnection)
 */

import axios from "axios";
import fs from "fs";
import cron from "node-cron";
import { pipeline } from "stream/promises";
import zlib from "zlib";
import {
    FUZZWORK_BZ2_URL,
    FUZZWORK_MD5_URL,
    SDE_CRON_SCHEDULE,
    SDE_DIR,
    SDE_LIVE_PATH,
    SDE_MD5_PATH,
    SDE_NEW_PATH,
} from "../config/sdeConfig.js";
import { refreshConnection } from "../service/sdeService.js";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────────────────────
//  핵심 업데이트 로직 (CRON 및 수동 호출 공용)
// ─────────────────────────────────────────────────────────

/**
 * SDE 파일을 원격과 비교하여 필요 시 다운로드·교체합니다.
 * 외부에서 직접 호출하여 수동 업데이트도 가능합니다.
 */
export async function runSdeUpdate() {
    const log = logger();

    // SDE 저장 디렉토리가 없으면 생성
    fs.mkdirSync(SDE_DIR, { recursive: true });

    // ── Step 1: 원격 MD5 해시 조회 ──────────────────────────
    let remoteMd5;
    try {
        const resp = await axios.get(FUZZWORK_MD5_URL, { timeout: 15_000 });
        // 응답 형식 예: "abc123def456  sqlite-latest.sqlite.bz2\n"
        remoteMd5 = resp.data.trim().split(/\s+/)[0];
    } catch (err) {
        log.warn(`[SDE] MD5 해시 조회 실패: ${err.message}`);
        return;
    }

    // ── Step 2: 로컬 해시와 비교 ────────────────────────────
    let localMd5 = null;
    if (fs.existsSync(SDE_MD5_PATH)) {
        localMd5 = fs.readFileSync(SDE_MD5_PATH, "utf-8").trim();
    }

    if (remoteMd5 === localMd5) {
        log.info("[SDE] 변경 없음, 업데이트 스킵.");
        return;
    }

    log.info(`[SDE] 새 버전 감지. 원격=${remoteMd5} / 로컬=${localMd5 ?? "없음"}`);
    log.info("[SDE] SDE 다운로드 시작...");

    // ── Step 3: 스트리밍 다운로드 + bz2 실시간 압축 해제 ───
    // 기존 임시 파일이 있으면 제거 (이전 실패 잔재)
    if (fs.existsSync(SDE_NEW_PATH)) {
        fs.unlinkSync(SDE_NEW_PATH);
    }

    try {
        const response = await axios.get(FUZZWORK_BZ2_URL, {
            responseType: "stream",
            timeout: 0, // 대용량 파일 - 타임아웃 없음
        });

        const writeStream = fs.createWriteStream(SDE_NEW_PATH);
        const bunzip2 = zlib.createBunzip2();

        // pipeline: response.data → bunzip2 → writeStream (에러 시 자동 정리)
        await pipeline(response.data, bunzip2, writeStream);

        log.info("[SDE] 다운로드 및 압축 해제 완료.");
    } catch (err) {
        log.error(`[SDE] 다운로드 실패: ${err.message}`);
        // 실패 시 임시 파일 정리
        if (fs.existsSync(SDE_NEW_PATH)) {
            fs.unlinkSync(SDE_NEW_PATH);
        }
        return;
    }

    // ── Step 4: Atomic Swap ──────────────────────────────────
    // fs.renameSync은 같은 파티션 내에서 단일 syscall로 동작.
    // 진행 중인 better-sqlite3 읽기 커넥션은 기존 inode를 계속 바라보므로
    // 교체 직후까지 데이터 유실 없이 서비스됩니다.
    try {
        fs.renameSync(SDE_NEW_PATH, SDE_LIVE_PATH);
        log.info("[SDE] Atomic Swap 완료. sde_live.sqlite 교체됨.");
    } catch (err) {
        log.error(`[SDE] Atomic Swap 실패: ${err.message}`);
        return;
    }

    // ── Step 5: SQLite 커넥션 갱신 ──────────────────────────
    // renameSync 이후 새 파일로 better-sqlite3 재연결
    refreshConnection();
    log.info("[SDE] SQLite 커넥션 갱신 완료.");

    // ── Step 6: 로컬 MD5 기록 ───────────────────────────────
    fs.writeFileSync(SDE_MD5_PATH, remoteMd5, "utf-8");
    log.info(`[SDE] 업데이트 완료. 적용 버전 MD5: ${remoteMd5}`);
}

// ─────────────────────────────────────────────────────────
//  CRON 등록
// ─────────────────────────────────────────────────────────

/**
 * SDE 자동 갱신 CRON 작업을 등록합니다.
 * serverBootstrap.js 에서 호출하세요.
 */
export function registerSdeUpdaterJob() {
    console.log("\x1b[32m✔\x1b[0m SDE 자동 갱신 CRON 등록 완료");
    cron.schedule(
        SDE_CRON_SCHEDULE,
        async () => {
            try {
                await runSdeUpdate();
            } catch (err) {
                logger().error("[SDE] CRON 실행 중 예외 발생:", err);
            }
        },
        { timezone: "Asia/Seoul" }
    );
}

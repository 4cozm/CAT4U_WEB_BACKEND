/**
 * @file sdeService.js
 * @description better-sqlite3 싱글톤 커넥션 관리자.
 *
 * - MySQL 메인 DB(Prisma)와 물리적으로 완전히 분리된 독립 모듈
 * - `readonly: true` 옵션으로 쓰기 불가 보장
 * - `getDb()`: lazy 초기화 — sde_live.sqlite가 존재하지 않으면 null 반환
 * - `refreshConnection()`: Atomic Swap 직후 호출하여 새 파일로 재연결
 */

import Database from "better-sqlite3";
import fs from "fs";
import { SDE_LIVE_PATH } from "../config/sdeConfig.js";
import { logger } from "../utils/logger.js";

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

/**
 * SDE SQLite 커넥션을 반환합니다.
 * 파일이 아직 존재하지 않으면 null을 반환합니다.
 *
 * @returns {import('better-sqlite3').Database | null}
 */
export function getDb() {
    if (_db) {
        return _db;
    }

    if (!fs.existsSync(SDE_LIVE_PATH)) {
        logger().warn(
            `[SDE] sde_live.sqlite 파일이 없습니다. ` +
                `SDE 업데이트가 완료될 때까지 SDE 기능을 사용할 수 없습니다. ` +
                `경로: ${SDE_LIVE_PATH}`
        );
        return null;
    }

    try {
        _db = new Database(SDE_LIVE_PATH, {
            readonly: true,
            fileMustExist: true,
        });
        logger().info(`[SDE] SQLite 커넥션 연결됨: ${SDE_LIVE_PATH}`);
    } catch (err) {
        logger().error(`[SDE] SQLite 연결 실패: ${err.message}`);
        _db = null;
    }

    return _db;
}

/**
 * 기존 커넥션을 닫고 새 sde_live.sqlite 파일로 재연결합니다.
 * sdeUpdater.js의 Atomic Swap 직후 호출됩니다.
 */
export function refreshConnection() {
    if (_db) {
        try {
            _db.close();
        } catch {
            // 이미 닫혀있을 수 있으므로 무시
        }
        _db = null;
    }
    // 다음 getDb() 호출 시 새 파일로 lazy 재연결됨
    logger().info("[SDE] SQLite 커넥션 초기화됨. 다음 호출 시 새 파일로 재연결됩니다.");
}

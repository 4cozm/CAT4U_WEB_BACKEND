/**
 * @file sdeConfig.js
 * @description EVE Online SDE(Static Data Export) 관련 경로 및 URL 상수 모음.
 *              이 파일에서 모든 SDE 경로 설정을 관리합니다.
 */

import path from "path";
import { fileURLToPath } from "url";

// ESM 환경에서 __dirname 대체
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** SDE 파일이 저장될 루트 디렉토리 (프로젝트 루트/data/sde) */
export const SDE_DIR = path.resolve(__dirname, "../../data/sde");

/** 현재 서비스 중인 SDE SQLite 파일 경로 */
export const SDE_LIVE_PATH = path.join(SDE_DIR, "sde_live.sqlite");

/** 새로 다운로드 중인 임시 SQLite 파일 경로 */
export const SDE_NEW_PATH = path.join(SDE_DIR, "sde_new.sqlite");

/** 마지막으로 적용된 MD5 해시값을 기록하는 파일 경로 */
export const SDE_MD5_PATH = path.join(SDE_DIR, ".last_md5");

/** SDE 메타데이터 (업데이트 시간, 버전 등)를 기록하는 JSON 파일 경로 */
export const SDE_METADATA_PATH = path.join(SDE_DIR, "sde_metadata.json");

/** Fuzzwork SDE bz2 압축 파일 다운로드 URL */
export const FUZZWORK_BZ2_URL = "https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2";

/** Fuzzwork SDE MD5 해시 확인 URL */
export const FUZZWORK_MD5_URL = "https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2.md5";

/**
 * SDE 자동 갱신 CRON 스케줄.
 * 기본값: 매일 새벽 3시 (Asia/Seoul 기준)
 * @see https://crontab.guru/#0_3_*_*_*
 */
export const SDE_CRON_SCHEDULE = "0 3 * * *";

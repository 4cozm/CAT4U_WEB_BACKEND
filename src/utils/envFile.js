import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { defaultEnv } from "../config/serverConfig.js";

const ENV_PATH = path.resolve(process.cwd(), ".env");

/** .env 파일을 파싱하여 객체로 반환 */
export async function readEnvFile(filePath = ENV_PATH) {
    const raw = await fs.readFile(filePath, "utf8");
    return dotenv.parse(raw);
}

/** .env에 key=val upsert (존재하면 교체, 없으면 맨 끝에 추가). 원자적 쓰기 */
export async function upsertEnvVar(key, value, filePath = ENV_PATH) {
    let raw = "";
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
        if (err && err.code === "ENOENT") {
            await fs.writeFile(filePath, `${key}=${value}\n`, "utf8");
            return;
        }
        throw err;
    }

    const line = `${key}=${value}`;
    const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
    if (re.test(raw)) {
        raw = raw.replace(re, line);
    } else {
        if (!raw.endsWith("\n")) {
            raw += "\n";
        }
        raw += line + "\n";
    }

    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, filePath);
}

/**
 * .env에 key=val "추가"만 수행 (이미 있으면 무시). 없으면 파일 생성.
 * @returns {Promise<boolean>} 실제로 추가/생성되었으면 true, 이미 있으면 false
 */
export async function insertEnvVar(key, value, filePath = ENV_PATH) {
    let raw = "";
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch {
        await fs.writeFile(filePath, `${key}=${value}\n`, "utf8");
        return true;
    }

    const exists = new RegExp(`^\\s*${key}\\s*=`, "m").test(raw);
    if (exists) {
        return false;
    }

    if (!raw.endsWith("\n")) {
        raw += "\n";
    }
    raw += `${key}=${value}\n`;

    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, filePath);
    return true;
}

/**
 * .env가 없으면 defaults로 생성, 있으면 "없는 키만" defaults로 채움(덮어쓰지 않음).
 * @param {Record<string, string>} ENV 설정 리스트
 * @returns {Promise<number>} 추가된 키 개수
 */
export async function ensureEnvWithDefaults(defaults = defaultEnv, filePath = ENV_PATH) {
    const spinner = ora("🔍 .env 점검 중...").start();

    let raw = "";
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
        if (err && err.code === "ENOENT") {
            const lines =
                Object.entries(defaults)
                    .map(([k, v]) => `${k}=${v}`)
                    .join("\n") + "\n";
            const tmp = `${filePath}.tmp`;
            try {
                await fs.writeFile(tmp, lines, "utf8");
                await fs.rename(tmp, filePath);
                spinner.succeed(
                    `.env 파일이 없어 새로 생성! (${Object.keys(defaults).length}개): ${Object.keys(defaults).join(", ")}`
                );
                return;
            } catch (writeErr) {
                spinner.fail("❌ .env 생성 실패");
                throw writeErr;
            }
        }
        spinner.fail("❌ .env 읽기 실패");
        throw err;
    }

    const missing = [];
    for (const k of Object.keys(defaults)) {
        const re = new RegExp(`^\\s*${k}\\s*=`, "m");
        if (!re.test(raw)) {
            missing.push(k);
        }
    }

    if (missing.length === 0) {
        spinner.succeed("env 키 정상");
        return;
    }

    spinner.text = `🛠️ 누락된 키 ${missing.length}개 보완 중...`;
    try {
        for (const k of missing) {
            await upsertEnvVar(k, defaults[k], filePath);
        }
        spinner.succeed(`보완 완료 (${missing.length}개): ${missing.join(", ")}`);
    } catch (e) {
        spinner.fail("누락 키 보완 중 오류");
        throw e;
    }
}

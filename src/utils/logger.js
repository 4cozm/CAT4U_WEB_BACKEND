import fs from "fs";
import winston from "winston";
import winstonDaily from "winston-daily-rotate-file";
import Transport from "winston-transport";
import SendDiscordMsg from "./SendDiscordMsg.js";

const isDev = process.env.isDev === "true";

const log_dir = `${process.cwd()}/logs`; // 로그 폴더 경로 설정

let loggerInstance = null; //로거 인스턴스를 저장할 변수

class DiscordTransport extends Transport {
    constructor(opts = {}) {
        super(opts);
    }

    log(info, callback) {
        setTimeout(async () => {
            try {
                if (info.level === "warn") {
                    await SendDiscordMsg(info.message, {
                        Title: "경고",
                        Color: "yellow",
                    });
                }
            } catch (e) {
                console.error("DiscordTransport Error:", e);
            }
            callback();
        }, 0);
    }
}

function createLogger() {
    if (!isDev) {
        return {
            info: (...args) => console.log("[INFO]", ...args),
            warn: (...args) => console.warn("[WARN]", ...args),
            error: (...args) => console.error("[ERROR]", ...args),
            debug: (...args) => console.debug("[DEBUG]", ...args),
        };
    }
    if (!fs.existsSync(log_dir)) {
        fs.mkdirSync(log_dir, { recursive: true });
    }

    return winston.createLogger({
        level: "info",
        format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.printf(
                ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
            )
        ),
        transports: [
            new winstonDaily({
                level: "info",
                datePattern: "YYYY-MM-DD",
                dirname: log_dir,
                filename: "%DATE%.log",
                maxSize: "5m",
                maxFiles: 5,
            }),
            new winstonDaily({
                level: "error",
                datePattern: "YYYY-MM-DD",
                dirname: log_dir,
                filename: "%DATE%.error.log",
                maxSize: "5m",
                maxFiles: 3,
            }),
            new DiscordTransport(),
        ],
    });
}

//이렇게 레이지 싱글톤 구조를 쓰면 Azure 초기화전에 createLogger를 만들어서 azure 환경변수 로드전에 sendDiscordMsg를 호출해 메시지가 무시되어 벌이는 문제가 해결댐
//사실 치명적인 문제는 아님, 어차피 서버 핵심로직 구동 전에 디스코드 웹후크 URL을 로드하니까. 하지만 나중에 어떤 기능들이 더 추가될지 모르는 상황이라 "안전한" 구조로 바꿨음

/**
 * @function
 * @returns {winston.Logger} 전역에서 재사용되는 Winston 로거 인스턴스
 *
 * @example
 * import { logger } from './logger.js';
 *
 * logger().info('서버가 성공적으로 시작되었습니다.');
 * logger().warn('잠재적인 설정 문제 감지됨');
 */
export function logger() {
    if (!loggerInstance) {
        loggerInstance = createLogger();
    }
    return loggerInstance;
}

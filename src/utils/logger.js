import { existsSync, mkdirSync } from 'fs';
import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import sendMessage from './SendDiscordMsg.js';

// TODO: Azure Key Vault 연동 후 NODE_ENV 동적으로 세팅
const isProd = process.env.NODE_ENV === 'production';

const log_dir = `${process.cwd()}/logs`; // 로그 폴더 경로 설정

let logger;

if (!isProd) {
    // 개발 환경일 때 콘솔로그만 출력
    logger = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        debug: (...args) => console.debug('[DEBUG]', ...args),
    };
} else {
    if (!existsSync('logs')) {
        mkdirSync('logs');
    }

    const log_format = winston.format.printf(({ level, message, label, timestamp }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
    }); // 로그 출력 형태 설정

    logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss',
            }),
            log_format
        ),
        transports: [
            new winstonDaily({
                level: 'info',
                datePattern: 'YYYY-MM-DD',
                dirname: log_dir,
                filename: '%DATE%.log',
                maxSize: 5 * 1024 * 1024,
                maxFiles: 5,
            }),
            new winstonDaily({
                level: 'error',
                datePattern: 'YYYY-MM-DD',
                dirname: log_dir,
                filename: '%DATE%.error.log',
                maxSize: 5 * 1024 * 1024,
                maxFiles: 3,
            }),
        ],
    });

    // TODO: Discord Webhook 연동 예정
    const originalError = logger.error.bind(logger);
    logger.error = async (...args) => {
        const message = args.join(' ');
        await sendMessage(message);
        originalError(message);
    };
}

export default logger;

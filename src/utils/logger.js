import { existsSync, mkdirSync } from 'fs';
import winston from 'winston';

// TODO: Azure Key Vault 연동 후 NODE_ENV 동적으로 세팅
const isProd = process.env.NODE_ENV === 'production';

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
    if (!existsSync('logs')) {mkdirSync('logs');}

    const customFormat = winston.format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    });

    logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(winston.format.timestamp(), customFormat),
        transports: [
            new winston.transports.File({
                filename: 'logs/combined.log',
                maxsize: 5 * 1024 * 1024,
                maxFiles: 5,
                tailable: true,
            }),
            new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 5 * 1024 * 1024,
                maxFiles: 3,
                tailable: true,
            }),
        ],
    });

    // TODO: Discord Webhook 연동 예정
    const originalError = logger.error.bind(logger);
    logger.error = async (...args) => {
        const message = args.join(' ');
        // await sendDiscordError(message);
        originalError(message);
    };
}

export default logger;

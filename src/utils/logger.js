import { existsSync, mkdirSync } from 'fs';
import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import sendMessage from './SendDiscordMsg.js';

// TODO: Azure Key Vault 연동 후 NODE_ENV 동적으로 세팅
const isProd = process.env.NODE_ENV === 'production'; // 👀 이대로 push하면 무조건 개발환경으로만 인식함! 고쳐보세용

const log_dir = `${process.cwd()}/logs`; // 로그 폴더 경로 설정

let logger;
let discordUrl = null;

export const setDiscordHook = async () => {
    discordUrl = process.env.DISCORD_WEBHOOK;
    if (!discordUrl) {
        console.error('Discord Webhook URL Not Imported!');
        process.exit(0);
    }
};

if (!isProd) {
    // 테스트를 위해 !isProd to isProd로 변경
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

    const log_format = winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
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

    const originalError = logger.error.bind(logger);
    logger.error = async (...args) => {
        const message = args.join(' ');
        await sendMessage(discordUrl, undefined, message);
        originalError(message);
    };
}

export default logger;

//이건 내가 수정했어야 하는데 처음 대충 작성한 로그 코드가 개판이라 아래에 참고 구조 적어둠 하나씩 천천히 보세용
import Transport from 'winston-transport';
class DiscordTransport extends Transport {
    // 이 구조는 오버라이드인데 오버라이드가 뭔지만 이해하고, 자세한 코드는 따로 알필요는 없음

    //하지만 궁금한 고양이를 위해서 간단한 핵심 로직만 알려주자면

    /*
    setTimeout(..., 0)을 사용해 Node.js의 이벤트 루프의 다음 tick에서 비동기 코드를 실행
    Winston은 log()가 동기적으로 callback()을 호출하지 않으면 로그 파이프라인이 멈출 수 있는데,
    이 방식이면 안전하게 비동기 await를 처리할 수 있음.
     */
    constructor(opts = {}) {
        super(opts);
    }

    log(info, callback) {
        setTimeout(async () => {
            try {
                if (info.level === 'warn') {
                    await sendMessage(info.message, {
                        Title: '경고',
                        Color: 'yellow',
                    });
                }
            } catch (err) {
                console.error('DiscordTransport Error:', err);
            }
            callback();
        }, 0);
    }
}

let loggerInstance = null;

function createLogger() {
    const isProd = process.env.isDev !== 'true';

    if (!isProd) {
        return {
            info: (...args) => console.log('[INFO]', ...args),
            warn: (...args) => console.warn('[WARN]', ...args),
            error: (...args) => console.error('[ERROR]', ...args),
            debug: (...args) => console.debug('[DEBUG]', ...args),
        };
    }

    return winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(
                ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
            )
        ),
        transports: [
            new winstonDaily({
                level: 'info',
                datePattern: 'YYYY-MM-DD',
                dirname: 'logs',
                filename: '%DATE%.log',
                maxSize: '5m',
                maxFiles: 5,
            }),
            new winstonDaily({
                level: 'error',
                datePattern: 'YYYY-MM-DD',
                dirname: 'logs',
                filename: '%DATE%.error.log',
                maxSize: '5m',
                maxFiles: 3,
            }),
            new DiscordTransport(),
        ],
    });
}

//이렇게 레이지 싱글톤 구조를 쓰면 Azure 초기화전에 createLogger를 만들어서 azure 환경변수 로드전에 sendDiscordMsg를 호출해 메시지가 무시되어 벌이는 문제가 해결댐
//사실 치명적인 문제는 아님, 어차피 서버 핵심로직 구동 전에 디스코드 웹후크 URL을 로드하니까. 하지만 나중에 어떤 기능들이 더 추가될지 모르는 상황이라 "안전한" 구조로 바꿨음
export function loggerEx() {
    if (!loggerInstance) {
        loggerInstance = createLogger();
    }
    return loggerInstance;
}
//대신 logger().info("하지못했던 말") 식으로 사용법이 바뀌게 됨

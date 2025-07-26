import winston from 'winston'; // 로그 모듈 불러오기
import winstonDaily from 'winston-daily-rotate-file'; // 로그 파일을 날짜별로 분리하기 위한 모듈 불러오기
import sendMessage from './SendDiscordError.js'; // Discord 메시지 전송 모듈 불러오기
import process from 'process'; // 프로세스 모듈 불러오기

const { combine, timestamp, label, printf } = winston.format; // format winston

const log_dir = `${process.cwd()}/src/middlewares/logs`; // 로그 폴더 경로 설정

const log_format = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
}); // 로그 출력 형태 설정

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss', // 타임스탬프 형식 설정
        }),
        log_format // 사용자 정의 로그 형식 적용
    ),
    level: 'info',
    transports: [
        new winstonDaily({
            level: 'info',
            datePattern: 'YYYY-MM-DD',
            dirname: log_dir,
            filename: '%DATE%.log',
            maxSize: 5 * 1024 * 1024, // 최대 파일 크기
            maxFiles: 5, // 최대 파일 개수
        }),
        new winstonDaily({
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            dirname: log_dir,
            filename: '%DATE%.error.log',
            maxSize: 5 * 1024 * 1024, // 최대 파일 크기
            maxFiles: 3, // 최대 파일 개수
        }),
    ],
});

const originalError = logger.error.bind(logger);
logger.error = async (...args) => {
    const message = args.join(' ');
    await sendMessage(message); // Discord로 에러 메시지 전송
    originalError(message); // 원래의 에러 로그 출력
};

export default logger; // logger 모듈 내보내기

import winston from 'winston'; // 로그 모듈 불러오기
import dontenv from 'dotenv'; // 현제 폴더 찾기 위한 process 모듈 불러오기

const { combine, timestamp, label, printf } = winston.format; // format winston

const log_dir = '${process.cwd()}/logs'; // 로그 폴더 경로 설정

const log_format = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
}); // 로그 출력 형태 설정

const logger = winston.createLogger({
    format: combine(),
}); // TODO : combine() func check to complete

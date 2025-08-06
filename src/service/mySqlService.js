import mysql from 'mysql2/promise';
import ora from 'ora';
import { getMysqlOptions } from '../config/mysqlOptions.js';

let pool;
const mySqlMsg = ora({ text: 'MySQL 연결 시도중...', spinner: 'dots' });

/**
 * MySQL 연결 풀을 생성하고, 지정된 횟수만큼 연결을 재시도하는 함수입니다.
 * 연결 성공 시 풀 객체를 전역에 저장합니다.
 * 실패할 경우 일정 시간(delay) 후 재시도하며, 모든 시도에 실패하면 프로세스를 종료합니다.
 *
 * @async
 * @function
 * @param {boolean} [shutdown=false] - 실패시 서버 종료 여부
 * @param {number} [retries=3] - 최대 재시도 횟수
 * @param {number} [delay=2000] - 각 재시도 간 대기 시간 (ms)
 * @returns {Promise<void>} - 성공 시 아무 값도 반환하지 않음 (전역 `pool`에 저장)
 * @throws 프로세스는 모든 재시도 실패 시 종료됩니다 (예외는 throw되지 않음).
 */
export const connectWithRetry = async (shutdown = false, retries = 3, delay = 2000) => {
    mySqlMsg.start();
    for (let i = 0; i < retries; i++) {
        try {
            const p = mysql.createPool(getMysqlOptions());
            const conn = await p.getConnection();
            conn.release();
            pool = p;
            mySqlMsg.succeed('MySQL 연결 성공');
            return;
        } catch (e) {
            mySqlMsg.warn(`MySQL 연결 실패 (${i + 1}/${retries}) - ${e.message}`);
            await new Promise(r => setTimeout(r, delay));
            mySqlMsg.start();
        }
    }
    mySqlMsg.fail('모든 MySQL 연결 재시도 실패.');
    if (shutdown) {
        const stack = new Error().stack;

        console.error('☠️ 시스템 종료 요청됨 (shutdown = true)');
        console.error('📍 호출 위치:');
        console.error(stack.split('\n').slice(2, 5).join('\n'));

        process.exit(1);
    }
};

/**
 * MySQL 쿼리를 실행하는 함수입니다.
 * 연결이 끊긴 경우(`ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST`, `Cannot enqueue Query after...`)에는
 * 자동으로 재연결을 시도하지만, 쿼리 자체는 재실행하지 않습니다.
 *
 * @async
 * @function
 * @param {string} sql - 실행할 SQL 쿼리 문자열
 * @param {Array<any>} [params] - SQL 쿼리에 바인딩할 파라미터 배열
 * @returns {Promise<[any[], import('mysql2/promise').FieldPacket[]]>} - MySQL 쿼리 결과와 필드 정보
 * @throws {Error} 연결되지 않았거나, 비연결성 에러 외의 오류가 발생한 경우 에러를 throw합니다.
 */
export const query = async (sql, params) => {
    try {
        if (!pool) {
            throw new Error('MySQL 연결되지 않음');
        }
        return await pool.query(sql, params);
    } catch (err) {
        // 연결 관련 에러일 경우만 재시도
        const isConnectionError =
            /ECONNREFUSED|PROTOCOL_CONNECTION_LOST|Cannot enqueue Query after/.test(err.message);

        if (!isConnectionError) {
            throw err;
        }

        console.warn('MySQL 쿼리 실패', err);
        await connectWithRetry();
    }
};

export const getPool = () => pool; //혹시나 외부에서 쓸 것을 대비

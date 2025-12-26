import { S3Client } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger.js";

let s3;

/**
 * AWS S3 클라이언트 연결을 초기화하는 함수
 *
 * 서버 시작 시점에서 한 번만 호출해야 하며,
 * S3Client 인스턴스를 싱글톤으로 생성한다.
 *
 * @throws {Error} AWS 자격 증명(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)이나
 *                 리전(AWS_REGION)이 잘못 설정된 경우 에러를 발생시킨다.
 */
export function buildS3Connection() {
    try {
        s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    } catch (e) {
        logger().warn("[buildS3Connection]: AWS S3와 연결 중 에러가 발생했습니다.");
        throw e;
    }
}

/**
 * 초기화된 S3 클라이언트 객체를 반환하는 함수
 *
 * buildS3Connection()이 호출되지 않은 상태에서 접근하면
 * 경고 로그를 남기고 undefined를 반환한다.
 *
 * @returns {S3Client|undefined} 초기화된 S3Client 인스턴스,
 *                               없을 경우 undefined
 *
 * @example
 * buildS3Connection();
 * const s3 = getS3Client();
 * const result = await s3.send(new PutObjectCommand(...));
 */
export function getS3Client() {
    if (!s3) {
        logger().warn("[getS3Client]: AWS S3 연결 객체가 없는 상태에서 요청했습니다.");
        return;
    }
    return s3;
}

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { MAX_FILE_SIZE, s3UploadTimeout, serverDomain } from '../config/serverConfig.js';
import { getS3Client } from '../service/awsS3Client.js';
import prisma from '../service/prismaService.js';
import { logger } from '../utils/logger.js';
import printUserInfo from '../utils/printUserInfo.js';

/**
 * Presigned URL을 발급하는 컨트롤러 함수
 *
 * 클라이언트에서 fileName, fileSize, fileType, fileMd5 메타데이터를 보내오고
 * 서버는 이를 검증 후 적절한 업로드 경로를 결정하여 Presigned URL을 반환한다.
 */
export async function getS3UploadUrl(req, res) {
    try {
        const { fileName, fileSize, fileType, fileMd5 } = req.body;

        // 필수 값 검증
        if (!fileName || !fileSize || !fileType || !fileMd5) {
            return res
                .status(400)
                .json({ error: 'fileName, fileSize, fileType, fileMd5 모두 필요합니다.' });
        }

        //md5 검증 단, 대부분 개발자의 실수이므로 리젝트 하지는 않음
        if (!isValidMd5(fileMd5)) {
            logger().error(
                `[getS3UploadUrl] 잘못된 MD5 형식:${printUserInfo(req)} 해시: ${fileMd5}`
            );
        }

        // 파일 크기 검증
        try {
            const tooLarge = isFileTooLarge(fileSize);
            if (tooLarge) {
                return res.status(400).json({ error: '파일 크기가 1GB를 초과하면 안됩니다.' });
            }
        } catch (err) {
            logger().info(
                `${printUserInfo()} 잘못된 파일 크기 값 업로드 :${fileSize} , 에러문 :${err}`
            );
            return res.status(400).json({ error: '잘못된 파일 크기 값' });
        }

        const existingFile = await prisma.file.findUnique({
            where: { file_md5: fileMd5 },
        });

        if (existingFile) {
            // 이미 존재하는 경우 → Presigned URL 발급 안 하고 기존 URL 반환
            logger().info(
                `[getS3UploadUrl] 중복 파일 감지- ${printUserInfo(req)} 파일명: ${fileName}, 해시: ${fileMd5}, 상태: ${existingFile.status}`
            );
            return res.json({
                fileUrl: `${serverDomain}/files/${fileMd5}`,
                reused: true,
            });
        }

        // 최적화 여부 판별
        const shouldOptimizeUpload = needsOptimization(fileName);
        const folder = shouldOptimizeUpload ? 'incoming' : 'optimized';
        const ext = path.extname(fileName).toLowerCase();
        const fileKey = `${folder}/${fileMd5}${ext}`; //예시 incoming/4a7d1ed414474e4033ac29ccb8653d9b.png

        // Presigned URL 발급
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
        });

        const uploadUrl = await getSignedUrl(getS3Client(), command, {
            expiresIn: s3UploadTimeout,
        });
        await prisma.UploadSession.create({
            data: {
                file_md5: fileMd5,
                original_name: fileName,
                extension: ext,
                size: fileSize,
                s3_key: fileKey,
                status: 'pending',
            },
        });
        logger().info(
            `[getS3UploadUrl] URL 발급 완료 - ${printUserInfo(req)}, 파일 종류: ${fileKey}`
        );
        return res.json({
            uploadUrl,
            fileUrl: `${serverDomain}/files/${fileMd5}`,
            status: 'pending',
        });
    } catch (e) {
        logger().error(`[getS3UploadUrl] ${printUserInfo(req)} URL 발급 중 에러 발생:`, e);
        return res.status(500).json({ error: 'Presigned URL 발급 실패' });
    }
}

/**
 * 파일이 최대 허용 용량(1GB)을 초과하는지 확인
 *
 * @param {string|number} fileSize - 파일 크기 (bytes)
 * @returns {boolean} true = 업로드 불가 (1GB 초과), false = 업로드 가능
 */
export function isFileTooLarge(fileSize) {
    const size = Number(fileSize);
    if (isNaN(size)) {
        throw new Error(`잘못된 파일 크기 값: ${fileSize}`);
    }
    return size > MAX_FILE_SIZE;
}

/**
 * 파일이 최적화 대상인지 확인
 *
 * @param {string} fileName - 원본 파일 이름
 * @returns {boolean} true = 최적화 필요 (incoming), false = 최적화 불필요 (optimized)
 */
export function needsOptimization(fileName) {
    const ext = path.extname(fileName).toLowerCase();

    // 최적화 가능한 확장자
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif'];
    const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi'];

    // 이미 최적화된 포맷 예외
    if (ext === '.webp') {
        return false;
    }

    // 비디오는 컨테이너 기준으로만 판단 (내부 코덱은 Lambda 단계에서 판별)
    if (videoExts.includes(ext)) {
        return true;
    }

    // 이미지는 webp 제외하고는 최적화 대상으로
    if (imageExts.includes(ext)) {
        return true;
    }

    // 그 외(PDF, ZIP 등)는 최적화 불필요
    return false;
}

/**
 * 파일이 MD5 해싱이 맞는지 검증
 */
function isValidMd5(value) {
    return /^[a-f0-9]{32}$/i.test(value);
}

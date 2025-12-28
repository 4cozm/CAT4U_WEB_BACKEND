import { createPresignedPost } from "@aws-sdk/s3-presigned-post"; // 변경된 부분
import path from "path";
import { MAX_FILE_SIZE, s3UploadTimeout } from "../config/serverConfig.js";
import { getS3Client } from "../service/awsS3Client.js";
import { getPrisma } from "../service/prismaService.js";
import { logger } from "../utils/logger.js";
import printUserInfo from "../utils/printUserInfo.js";

const MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "video/quicktime": ".mov",
};

export async function getS3UploadUrl(req, res) {
    const prisma = getPrisma();
    try {
        const { fileName, fileSize, fileType, fileMd5 } = req.body;

        if (!fileName || !fileSize || !fileType || !fileMd5) {
            return res
                .status(400)
                .json({ error: "fileName, fileSize, fileType, fileMd5 모두 필요합니다." });
        }

        if (!isValidMd5(fileMd5)) {
            logger().error(
                `[getS3UploadUrl] 잘못된 MD5 형식:${printUserInfo(req)} 해시: ${fileMd5}`
            );
        }

        try {
            const tooLarge = isFileTooLarge(fileSize);
            if (tooLarge) {
                return res.status(400).json({ error: "파일 크기가 1GB를 초과하면 안됩니다." });
            }
        } catch (err) {
            logger().info(
                `${printUserInfo(req)} 잘못된 파일 크기 값 업로드 :${fileSize} , 에러문 :${err}`
            );
            return res.status(400).json({ error: "잘못된 파일 크기 값" });
        }

        try {
            const existingFile = await prisma.file.findUnique({
                where: { file_md5: fileMd5 },
            });

            if (existingFile) {
                logger().info(
                    `[getS3UploadUrl] 중복 파일 감지- ${printUserInfo(req)} 파일명: ${fileName}, 해시: ${fileMd5}`
                );
                return res.status(200).json({
                    fileUrl: existingFile.s3_url,
                    reused: true,
                });
            }
        } catch (err) {
            logger().warn(
                `${printUserInfo(req)}[getS3UploadUrl] 로직 에러. 파일명:${fileMd5} , 에러문 :${err}`
            );
            return res.status(400).json({ error: "[getS3UploadUrl] 로직 에러" });
        }

        const shouldOptimizeUpload = needsOptimization(fileName);
        const folder = shouldOptimizeUpload ? "incoming" : "optimized";
        let ext = MIME_TO_EXT[fileType] || path.extname(fileName).toLowerCase();
        if (!ext) {
            ext = ".bin";
        }

        const fileKey = `${folder}/${fileMd5}${ext}`;

        // S3가 직접 검증할 조건 설정
        const { url, fields } = await createPresignedPost(getS3Client(), {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey,
            Conditions: [
                ["content-length-range", 0, MAX_FILE_SIZE], // S3 레벨에서 파일 크기 강제 검증
                ["eq", "$Content-Type", fileType], // 요청한 타입과 실제 업로드 타입 일치 확인
            ],
            Fields: {
                "Content-Type": fileType,
            },
            Expires: s3UploadTimeout,
        });

        const bigIntFileSize = BigInt(fileSize);
        const userId = BigInt(req.user.characterId);

        await prisma.uploadSession.create({
            data: {
                file_md5: fileMd5,
                original_name: fileName,
                extension: ext,
                size: bigIntFileSize,
                s3_key: fileKey,
                status: "pending",
                user_id: userId,
            },
        });

        logger().info(
            `[getS3UploadUrl] POST URL 발급 완료 - ${printUserInfo(req)}, 파일: ${fileName} , MD5: ${fileMd5}`
        );

        return res.json({
            uploadUrl: url, // 클라이언트가 POST 보낼 주소
            fields, // 클라이언트가 FormData에 담아야 할 인증 정보들
            fileUrl: `${process.env.AWS_S3_URL}/${fileKey}`,
            status: "pending",
        });
    } catch (e) {
        logger().error(`[getS3UploadUrl] ${printUserInfo(req)} URL 발급 중 에러 발생:`, e);
        return res.status(500).json({ error: "Presigned URL 발급 실패" });
    }
}

export function isFileTooLarge(fileSize) {
    const size = Number(fileSize);
    if (isNaN(size)) {
        throw new Error(`잘못된 파일 크기 값: ${fileSize}`);
    }
    return size > MAX_FILE_SIZE;
}

export function needsOptimization(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".webp") {
        return false;
    }
    const imageExts = [".jpg", ".jpeg", ".png", ".gif"];
    const videoExts = [".mp4", ".mkv", ".webm", ".mov", ".avi"];
    return videoExts.includes(ext) || imageExts.includes(ext);
}

function isValidMd5(value) {
    return /^[a-f0-9]{32}$/i.test(value);
}

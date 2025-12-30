import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import ora from "ora";
import { processDatabaseUpdate } from "../service/s3FileService.js";
import { logger } from "../utils/logger.js";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

export const startSqsWorker = async () => {
    const spinner = ora("AWS SQS에 연결 중...").start();
    const queueUrl = process.env.AWS_SQS;

    if (!queueUrl) {
        logger().warn("[SQS Worker] SQS_URL이 설정되지 않아 워커를 시작할 수 없습니다.");
        return;
    }
    spinner.succeed(`SQS Worker가 가동되었습니다. 대상 큐: ${queueUrl}`);

    while (true) {
        try {
            const receiveCommand = new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20, // Long Polling: 메시지가 올 때까지 최대 20초 대기
                AttributeNames: ["All"],
            });
            const { Messages = [] } = await sqsClient.send(receiveCommand);
            if (Messages.length > 0) {
                for (const message of Messages) {
                    await handleMessage(message, queueUrl);
                }
            }
        } catch (err) {
            logger().error(`⚠️ [SQS Worker] 메시지 수신 중 에러 발생:`, err);
            await new Promise(res => setTimeout(res, 5000)); //에러 발생시 잠시 대기. 무한 루프 폭주 방지
        }
    }
};

//개별 메세지 처리 및 DB 업데이트

const handleMessage = async (message, queueUrl) => {
    try {
        const body = JSON.parse(message.Body);
        const records = body.Records || [];

        for (const record of records) {
            const s3KeyRaw = record?.s3?.object?.key;
            if (!s3KeyRaw) {
                continue;
            }

            const { s3Key, base, fileMd5, ext } = parseKey(s3KeyRaw);

            if (!/^[a-f0-9]{32}$/i.test(fileMd5)) {
                logger().warn(`[SQS] 올바르지 않는 md5 값: ${base}`);
                continue;
            }

            logger().info(`📩 [SQS] 감지: ${s3Key} md5=${fileMd5} ext=${ext}`);
            await processDatabaseUpdate(fileMd5, ext, s3Key);
        }

        await sqsClient.send(
            new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle,
            })
        );
    } catch (err) {
        logger().warn("[SQS Worker] 메시지 처리 실패:", err);
    }
};

import path from "node:path";

function parseKey(s3KeyRaw) {
    const s3Key = decodeURIComponent(String(s3KeyRaw).replace(/\+/g, " "));
    const base = path.posix.basename(s3Key); // "<md5>.webp"
    const ext = path.posix.extname(base).slice(1); // "webp"
    const fileMd5 = ext ? base.slice(0, -(ext.length + 1)) : base;

    return { s3Key, base, fileMd5, ext };
}

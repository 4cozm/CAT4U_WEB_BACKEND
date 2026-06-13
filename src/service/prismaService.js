// src/service/prismaService.js
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import ora from "ora";
import { getMysqlOptions } from "../config/mysqlOptions.js";
import { logger } from "../utils/logger.js";

const spinner = ora({ text: "DB 연결 시도중...", spinner: "dots" });

let prisma = null;
let initPromise = null;

export function getPrisma() {
    if (!prisma) {
        logger().warn("Prisma가 초기화 되기 전에 DB 호출이 일어났습니다");
    }
    return prisma;
}

export async function connectWithRetry(shutdown = false, retries = 3, delay = 2000) {
    if (prisma) {
        return prisma;
    } // 이미 초기화됨
    if (initPromise) {
        return initPromise;
    } // 초기화 진행중이면 그거 기다림

    initPromise = (async () => {
        const adapter = new PrismaMariaDb(getMysqlOptions());
        const client = new PrismaClient({ adapter });

        spinner.start();

        for (let i = 0; i < retries; i++) {
            try {
                await client.$connect();
                await client.$queryRaw`SELECT 1`;
                prisma = client;
                spinner.succeed("DB 연결 성공");
                return prisma;
            } catch (e) {
                // 전체 에러/cause 체인을 기록. spinner 문구는 e.message만 보여줘서
                // 드라이버 어댑터의 근본 원인(예: 인증 실패)이 가려지는 걸 방지한다.
                logger().error(e);
                spinner.warn(`DB 연결 실패 (${i + 1}/${retries}) - ${e.message}`);
                await new Promise(r => setTimeout(r, delay));
                spinner.start();
            }
        }

        spinner.fail("모든 DB 연결 재시도 실패.");
        await client.$disconnect().catch(() => {});
        prisma = null;

        if (shutdown) {
            process.exit(1);
        }
        throw new Error("DB connection failed");
    })();

    return initPromise;
}

export async function disconnectPrisma() {
    if (!prisma) {
        return;
    }
    await prisma.$disconnect();
    prisma = null;
    initPromise = null;
}

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import ora from "ora";
import { getMysqlOptions } from "../config/mysqlOptions.js";
import { logger } from "../utils/logger.js";

const spinner = ora({ text: "DB 연결 시도중...", spinner: "dots" });

const adapter = new PrismaMariaDb(getMysqlOptions());
const pool = new PrismaClient({ adapter });

let connected = false;

export const connectWithRetry = async (shutdown = false, retries = 3, delay = 2000) => {
    spinner.start();

    for (let i = 0; i < retries; i++) {
        try {
            await prisma.$connect();
            await prisma.$queryRaw`SELECT 1`;
            connected = true;
            spinner.succeed("DB 연결 성공");
            return prisma;
        } catch (e) {
            spinner.warn(`DB 연결 실패 (${i + 1}/${retries}) - ${e.message}`);
            await new Promise(r => setTimeout(r, delay));
            spinner.start();
        }
    }

    spinner.fail("모든 DB 연결 재시도 실패.");
    if (shutdown) {
        process.exit(1);
    }
    return null;
};

export function prisma() {
    if (!connected) {
        logger().warn("[MYSQL] DB 연결 전에 getPrisma() 호출됨");
    }
    return pool;
}

export async function disconnectPrisma() {
    await pool.$disconnect();
    connected = false;
}

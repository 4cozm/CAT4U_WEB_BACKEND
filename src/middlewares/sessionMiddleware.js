import session from "express-session";
import { getSessionConfig } from "../config/serverConfig.js";
import { getRedisClient } from "../service/redisService.js";

export async function createSessionMiddleware() {
    const { RedisStore } = await import("connect-redis");
    const { TTL, COOKIE_OPTIONS } = getSessionConfig();
    const redisClient = getRedisClient();

    return session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.REDIS_SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { ...COOKIE_OPTIONS, maxAge: TTL * 1000 },
    });
}

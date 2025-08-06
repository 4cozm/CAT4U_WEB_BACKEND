import session from 'express-session';
import { SESSION_CONFIG } from '../config/serverConfig.js';
import { getRedisClient } from '../service/redisService.js';

export async function createSessionMiddleware() {
    const { RedisStore } = await import('connect-redis');
    const redisClient = getRedisClient();

    return session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.REDIS_SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            ...SESSION_CONFIG.COOKIE_OPTIONS,
            maxAge: SESSION_CONFIG.TTL * 1000,
        },
    });
}

export const getRedisOptions = () => ({
    url: 'redis://localhost:6379',
    socket: {
        reconnectStrategy: retries => {
            // 재시도 간격 = 100ms * 시도 횟수 (최대 3초)
            const delay = Math.min(retries * 100, 3000);
            return delay;
        },
        keepAlive: 5000, // TCP keep-alive
    },
});

import { createClient } from 'redis';
const redis = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379'
});
redis.on('error', (err) => {
    console.error(' Redis connection error:', err.message);
});
redis.on('connect', () => {
    console.log('Redis connected');
});
redis.on('reconnecting', () => {
    console.log(' Redis reconnecting...');
});
await redis.connect();
export default redis;

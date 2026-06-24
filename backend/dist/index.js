import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import 'dotenv/config';
import prisma from './config/db.js';
import redis from './config/redis.js';
import { connectKafka, disconnectKafka } from './config/kafka.js';
import { connectRabbitMQ, disconnectRabbitMQ } from './config/rabbitmq.js';
import { httpRequestDuration } from './config/metrics.js';
import { initSocket } from './socket/index.js';
import { startBookingConsumer } from './kafka/booking.consumer.js';
import { startNotificationConsumer } from './kafka/notification.consumer.js';
import { startAnalyticsConsumer } from './kafka/analytics.consumer.js';
import { startSeatLockConsumer } from './kafka/seat.lock.consumer.js';
import { startEmailWorker } from './workers/email.worker.js';
import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import seatRoutes from './routes/seat.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import { generalRateLimit } from './middleware/rateLimit.middleware.js';
const PORT = process.env.PORT ?? 8000;
const app = express();
const httpServer = createServer(app);
app.set('etag', false);
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:8080',
        process.env.FRONTEND_URL ?? 'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/metrics', metricsRoutes);
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(generalRateLimit);
app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        end({
            method: req.method,
            route: req.route?.path ?? req.path,
            status: res.statusCode.toString()
        });
    });
    next();
});
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api', seatRoutes);
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, _req, res, _next) => {
    res.status(500).json({ error: 'Internal server error' });
});
const bootstrap = async () => {
    try {
        await prisma.$connect();
        await redis.ping();
        await connectKafka();
        await startBookingConsumer();
        await startNotificationConsumer();
        await startAnalyticsConsumer();
        await startSeatLockConsumer();
        await connectRabbitMQ();
        await startEmailWorker();
        initSocket(httpServer);
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (err) {
        process.exit(1);
    }
};
process.on('unhandledRejection', () => { });
const shutdown = async () => {
    try {
        httpServer.close();
        await disconnectKafka();
        await disconnectRabbitMQ();
        await redis.quit();
        await prisma.$disconnect();
        process.exit(0);
    }
    catch (err) {
        process.exit(1);
    }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
bootstrap();

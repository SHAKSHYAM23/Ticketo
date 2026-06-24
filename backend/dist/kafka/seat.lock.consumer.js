import { Kafka } from 'kafkajs';
import { createClient } from 'redis';
import { TOPICS } from './topics.js';
import { producer } from '../config/kafka.js';
import { getIO } from '../socket/index.js';
import prisma from '../config/db.js';
import { seatLockExpiredCounter, kafkaErrorCounter } from '../config/metrics.js';
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'ticket-booking',
    brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092']
});
const seatLockConsumer = kafka.consumer({
    groupId: 'seat-lock-group'
});
const startRedisExpirySubscriber = async () => {
    const subscriber = createClient({
        url: process.env.REDIS_URL ?? 'redis://localhost:6379'
    });
    await subscriber.connect();
    await subscriber.configSet('notify-keyspace-events', 'Ex');
    await subscriber.subscribe('__keyevent@0__:expired', async (expiredKey) => {
        if (!expiredKey.startsWith('lock:seat:'))
            return;
        const seatId = expiredKey.replace('lock:seat:', '');
        console.log(` Redis lock expired for seat: ${seatId}`);
        try {
            const seat = await prisma.seat.findUnique({
                where: { id: seatId },
                select: { eventId: true, status: true }
            });
            if (!seat) {
                console.warn(` Expired lock for unknown seat: ${seatId}`);
                return;
            }
            if (seat.status === 'booked') {
                console.log(`ℹ Seat ${seatId} already booked — ignoring expiry`);
                return;
            }
            await producer.send({
                topic: TOPICS.SEAT_LOCK_EXPIRED,
                messages: [
                    {
                        key: seatId,
                        value: JSON.stringify({
                            seatId,
                            eventId: seat.eventId
                        })
                    }
                ]
            });
        }
        catch (err) {
            console.error(`Error handling expired lock for ${seatId}:`, err);
        }
    });
    console.log(' Redis expiry subscriber listening on __keyevent@0__:expired');
};
const handleSeatLockExpired = async (payload) => {
    const { seatId, eventId } = payload;
    const seat = await prisma.seat.findUnique({
        where: { id: seatId },
        select: { rowLabel: true, seatNumber: true, status: true }
    });
    if (!seat)
        return;
    if (seat.status === 'booked')
        return;
    const io = getIO();
    io.to(`event:${eventId}`).emit('seat_updated', {
        seatId,
        status: 'available',
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber
    });
    seatLockExpiredCounter.inc();
    console.log(` Socket emitted GREEN for expired seat: ${seat.rowLabel}${seat.seatNumber}`);
};
export const startSeatLockConsumer = async () => {
    await startRedisExpirySubscriber();
    await seatLockConsumer.connect();
    console.log(' Seat lock consumer connected');
    await seatLockConsumer.subscribe({
        topics: [TOPICS.SEAT_LOCK_EXPIRED],
        fromBeginning: false
    });
    console.log('Seat lock consumer subscribed and listening...');
    await seatLockConsumer.run({
        eachMessage: async ({ topic, message }) => {
            if (!message.value)
                return;
            try {
                const payload = JSON.parse(message.value.toString());
                await handleSeatLockExpired(payload);
            }
            catch (err) {
                kafkaErrorCounter.inc({ topic });
                console.error(` Seat lock consumer error:`, err);
            }
        }
    });
};

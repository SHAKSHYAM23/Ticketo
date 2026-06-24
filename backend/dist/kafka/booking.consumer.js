import { consumer } from '../config/kafka.js';
import { TOPICS } from './topics.js';
import prisma from '../config/db.js';
import redis from '../config/redis.js';
import { getIO } from '../socket/index.js';
import { publishNotificationRequested } from '../services/booking.service.js';
import { kafkaErrorCounter, bookingConfirmedCounter, paymentSuccessCounter, paymentFailCounter } from '../config/metrics.js';
const lockKey = (seatId) => `lock:seat:${seatId}`;
const handleBookingInitiated = async (payload) => {
    console.log(`Booking initiated — user: ${payload.userId}, ` +
        `seats: ${payload.seatIds.length}, amount: ${payload.totalAmount}`);
};
const handlePaymentConfirmed = async (payload) => {
    const { bookingId, seatIds, eventId, userId, totalAmount } = payload;
    const existingBooking = await prisma.booking.findUnique({
        where: { id: bookingId }
    });
    if (existingBooking) {
        console.log(`Booking ${bookingId} already processed — skipping duplicate`);
        return;
    }
    console.log(` Processing payment.confirmed for booking: ${bookingId}`);
    await prisma.$transaction(async (tx) => {
        await tx.booking.create({
            data: {
                id: bookingId,
                userId,
                eventId,
                status: 'confirmed',
                totalAmount,
                bookedAt: new Date()
            }
        });
        await tx.bookingSeat.createMany({
            data: seatIds.map(seatId => ({
                bookingId,
                seatId
            }))
        });
        await tx.seat.updateMany({
            where: { id: { in: seatIds } },
            data: { status: 'booked' }
        });
    });
    console.log(` Postgres updated — booking ${bookingId} confirmed`);
    await Promise.all(seatIds.map(seatId => redis.del(lockKey(seatId))));
    console.log(` Redis locks cleared for ${seatIds.length} seats`);
    const seats = await prisma.seat.findMany({
        where: { id: { in: seatIds } },
        select: { id: true, rowLabel: true, seatNumber: true }
    });
    const io = getIO();
    seats.forEach(seat => {
        io.to(`event:${eventId}`).emit('seat_updated', {
            seatId: seat.id,
            status: 'booked',
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber
        });
    });
    console.log(` Socket emitted RED for ${seats.length} seats`);
    paymentSuccessCounter.inc();
    bookingConfirmedCounter.inc({ eventId });
    await publishNotificationRequested({
        bookingId,
        userId,
        eventId
    });
    console.log(` notification.requested published for booking: ${bookingId}`);
};
const handlePaymentFailed = async (payload) => {
    const { seatIds, eventId, userId, reason } = payload;
    console.log(` Processing payment.failed — user: ${userId}, reason: ${reason}`);
    await Promise.all(seatIds.map(async (seatId) => {
        const lockedBy = await redis.get(lockKey(seatId));
        if (lockedBy === userId) {
            await redis.del(lockKey(seatId));
        }
    }));
    const seats = await prisma.seat.findMany({
        where: { id: { in: seatIds } },
        select: { id: true, rowLabel: true, seatNumber: true, status: true }
    });
    const io = getIO();
    seats
        .filter(seat => seat.status !== 'booked')
        .forEach(seat => {
        io.to(`event:${eventId}`).emit('seat_updated', {
            seatId: seat.id,
            status: 'available',
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber
        });
    });
    console.log(`Socket emitted GREEN for released seats`);
    paymentFailCounter.inc();
};
export const startBookingConsumer = async () => {
    await consumer.subscribe({
        topics: [
            TOPICS.BOOKING_INITIATED,
            TOPICS.PAYMENT_CONFIRMED,
            TOPICS.PAYMENT_FAILED
        ],
        fromBeginning: false
    });
    console.log(' Booking consumer subscribed and listening...');
    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            if (!message.value)
                return;
            try {
                const payload = JSON.parse(message.value.toString());
                switch (topic) {
                    case TOPICS.BOOKING_INITIATED:
                        await handleBookingInitiated(payload);
                        break;
                    case TOPICS.PAYMENT_CONFIRMED:
                        await handlePaymentConfirmed(payload);
                        break;
                    case TOPICS.PAYMENT_FAILED:
                        await handlePaymentFailed(payload);
                        break;
                    default:
                        console.warn(` Unhandled topic: ${topic}`);
                }
            }
            catch (err) {
                kafkaErrorCounter.inc({ topic });
                console.error(` Error processing ${topic}:`, err);
            }
        }
    });
};

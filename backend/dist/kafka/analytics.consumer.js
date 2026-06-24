import { Kafka } from 'kafkajs';
import { TOPICS } from './topics.js';
import { bookingConfirmedCounter, revenueCounter, seatLockCounter, bookingAttemptCounter } from '../config/metrics.js';
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'ticket-booking',
    brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092']
});
const analyticsConsumer = kafka.consumer({
    groupId: 'analytics-group'
});
const handleBookingInitiated = (payload) => {
    payload.seatIds.forEach(() => {
        seatLockCounter.inc({ eventId: payload.eventId });
    });
    bookingAttemptCounter.inc({ eventId: payload.eventId });
    console.log(`Analytics — booking attempt: ${payload.seatIds.length} seats, ` +
        `event: ${payload.eventId}`);
};
const handlePaymentConfirmed = (payload) => {
    bookingConfirmedCounter.inc({ eventId: payload.eventId });
    revenueCounter.inc({ eventId: payload.eventId }, payload.totalAmount);
    console.log(`Analytics — booking confirmed: event ${payload.eventId}, ` +
        `revenue +${payload.totalAmount} paise`);
};
export const startAnalyticsConsumer = async () => {
    await analyticsConsumer.connect();
    console.log('Analytics consumer connected');
    await analyticsConsumer.subscribe({
        topics: [
            TOPICS.BOOKING_INITIATED,
            TOPICS.PAYMENT_CONFIRMED
        ],
        fromBeginning: false
    });
    console.log(' Analytics consumer subscribed and listening...');
    await analyticsConsumer.run({
        eachMessage: async ({ topic, message }) => {
            if (!message.value)
                return;
            try {
                const payload = JSON.parse(message.value.toString());
                switch (topic) {
                    case TOPICS.BOOKING_INITIATED:
                        handleBookingInitiated(payload);
                        break;
                    case TOPICS.PAYMENT_CONFIRMED:
                        handlePaymentConfirmed(payload);
                        break;
                }
            }
            catch (err) {
                console.error(` Analytics consumer error on ${topic}:`, err);
            }
        }
    });
};

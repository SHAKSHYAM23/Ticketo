import { producer } from '../config/kafka.js';
import { TOPICS } from '../kafka/topics.js';
import { kafkaPublishCounter, kafkaErrorCounter } from '../config/metrics.js';
export const publishEvent = async (topic, payload) => {
    try {
        await producer.send({
            topic,
            messages: [
                {
                    key: getMessageKey(topic, payload),
                    value: JSON.stringify({
                        ...payload,
                        publishedAt: new Date().toISOString()
                    })
                }
            ]
        });
        kafkaPublishCounter.inc({ topic });
        console.log(` Kafka event published → topic: ${topic}`);
    }
    catch (err) {
        kafkaErrorCounter.inc({ topic });
        console.error(` Kafka publish failed → topic: ${topic}`, err);
        throw err;
    }
};
const getMessageKey = (topic, payload) => {
    switch (topic) {
        case TOPICS.BOOKING_INITIATED:
            return payload.userId;
        case TOPICS.PAYMENT_CONFIRMED:
        case TOPICS.NOTIFICATION_REQUESTED:
            return payload.bookingId;
        case TOPICS.PAYMENT_FAILED:
            return payload.userId;
        case TOPICS.SEAT_LOCK_EXPIRED:
            return payload.seatId;
        default:
            return 'default';
    }
};
export const publishBookingInitiated = (payload) => publishEvent(TOPICS.BOOKING_INITIATED, payload);
export const publishPaymentConfirmed = (payload) => publishEvent(TOPICS.PAYMENT_CONFIRMED, payload);
export const publishPaymentFailed = (payload) => publishEvent(TOPICS.PAYMENT_FAILED, payload);
export const publishNotificationRequested = (payload) => publishEvent(TOPICS.NOTIFICATION_REQUESTED, payload);
export const publishSeatLockExpired = (payload) => publishEvent(TOPICS.SEAT_LOCK_EXPIRED, payload);

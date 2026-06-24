import { Kafka } from 'kafkajs';
import { TOPICS } from './topics.js';
import { publishNotification } from '../services/notification.service.js';
import { kafkaErrorCounter } from '../config/metrics.js';
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'ticket-booking',
    brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092']
});
const notificationConsumer = kafka.consumer({
    groupId: 'notification-group'
});
const handleNotificationRequested = async (payload) => {
    console.log(`notification.requested received — booking: ${payload.bookingId}`);
    await publishNotification({
        bookingId: payload.bookingId,
        userId: payload.userId,
        eventId: payload.eventId
    });
};
export const startNotificationConsumer = async () => {
    await notificationConsumer.connect();
    console.log('Notification consumer connected');
    await notificationConsumer.subscribe({
        topics: [TOPICS.NOTIFICATION_REQUESTED],
        fromBeginning: false
    });
    console.log(' Notification consumer subscribed and listening...');
    await notificationConsumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, message, partition }) => {
            if (!message.value)
                return;
            try {
                const payload = JSON.parse(message.value.toString());
                await handleNotificationRequested(payload);
                await notificationConsumer.commitOffsets([
                    {
                        topic,
                        partition,
                        offset: (Number(message.offset) + 1).toString()
                    }
                ]);
            }
            catch (err) {
                kafkaErrorCounter.inc({ topic });
                console.error(`Failed to process notification.requested — ` +
                    `RabbitMQ may be down. Message NOT committed, will retry.`, err);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    });
};

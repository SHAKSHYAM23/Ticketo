import { getChannel, QUEUES } from '../config/rabbitmq.js';
export const publishNotification = async (payload) => {
    const channel = getChannel();
    const sent = channel.sendToQueue(QUEUES.NOTIFY, Buffer.from(JSON.stringify({
        ...payload,
        retryCount: payload.retryCount ?? 0,
        publishedAt: new Date().toISOString()
    })), {
        persistent: true,
        contentType: 'application/json'
    });
    if (!sent) {
        throw new Error('RabbitMQ channel buffer full — message not sent');
    }
    console.log(` Notification queued for bookingId: ${payload.bookingId}`);
};

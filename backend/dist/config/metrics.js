import client from 'prom-client';
client.collectDefaultMetrics({
    prefix: 'ticket_booking_'
});
export const seatLockCounter = new client.Counter({
    name: 'ticket_booking_seat_locks_total',
    help: 'Total number of seats locked successfully',
    labelNames: ['eventId']
});
export const seatLockFailCounter = new client.Counter({
    name: 'ticket_booking_seat_lock_fails_total',
    help: 'Total number of seat lock failures — seat already taken',
    labelNames: ['eventId']
});
export const seatLockExpiredCounter = new client.Counter({
    name: 'ticket_booking_seat_locks_expired_total',
    help: 'Total number of seat locks that expired without payment'
});
export const seatLockDuration = new client.Histogram({
    name: 'ticket_booking_seat_lock_duration_ms',
    help: 'Duration of seat lock operation in milliseconds',
    buckets: [5, 10, 25, 50, 100, 250, 500]
});
export const bookingConfirmedCounter = new client.Counter({
    name: 'ticket_booking_bookings_confirmed_total',
    help: 'Total number of bookings confirmed',
    labelNames: ['eventId']
});
export const bookingAttemptCounter = new client.Counter({
    name: 'ticket_booking_attempts_total',
    help: 'Total number of booking attempts — seats locked and intent created',
    labelNames: ['eventId']
});
export const revenueCounter = new client.Counter({
    name: 'ticket_booking_revenue_paise_total',
    help: 'Total revenue collected in paise',
    labelNames: ['eventId']
});
export const paymentSuccessCounter = new client.Counter({
    name: 'ticket_booking_payments_success_total',
    help: 'Total number of successful Stripe payments'
});
export const paymentFailCounter = new client.Counter({
    name: 'ticket_booking_payments_failed_total',
    help: 'Total number of failed Stripe payments'
});
export const paymentIntentDuration = new client.Histogram({
    name: 'ticket_booking_payment_intent_duration_ms',
    help: 'Duration of Stripe payment intent creation in milliseconds',
    buckets: [50, 100, 200, 500, 1000, 2000]
});
export const kafkaPublishCounter = new client.Counter({
    name: 'ticket_booking_kafka_published_total',
    help: 'Total number of events published to Kafka',
    labelNames: ['topic']
});
export const kafkaErrorCounter = new client.Counter({
    name: 'ticket_booking_kafka_errors_total',
    help: 'Total number of Kafka consumer errors',
    labelNames: ['topic']
});
export const emailSentCounter = new client.Counter({
    name: 'ticket_booking_emails_sent_total',
    help: 'Total number of confirmation emails sent'
});
export const emailFailCounter = new client.Counter({
    name: 'ticket_booking_emails_failed_total',
    help: 'Total number of email send failures'
});
export const dlqCounter = new client.Counter({
    name: 'ticket_booking_dlq_messages_total',
    help: 'Total number of messages moved to dead letter queue'
});
export const httpRequestDuration = new client.Histogram({
    name: 'ticket_booking_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [10, 25, 50, 100, 200, 500, 1000]
});
export const register = client.register;
console.log(' Prometheus metrics initialized');

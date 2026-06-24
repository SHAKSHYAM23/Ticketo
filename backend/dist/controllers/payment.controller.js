import { verifyWebhookSignature } from '../services/payment.service.js';
import { publishPaymentConfirmed, publishPaymentFailed } from '../services/booking.service.js';
import { paymentSuccessCounter, paymentFailCounter } from '../config/metrics.js';
import { v4 as uuidv4 } from 'uuid';
export const stripeWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
    }
    let event;
    try {
        event = verifyWebhookSignature(req.body, signature);
    }
    catch (err) {
        console.error(' Webhook signature verification failed:', err);
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
    }
    if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object;
        const { seatIds, eventId, userId } = intent.metadata;
        if (!seatIds || !eventId || !userId) {
            console.error('Missing metadata on payment intent:', intent.id);
            res.status(400).json({ error: 'Missing required metadata' });
            return;
        }
        const seatIdArray = seatIds.split(',');
        const bookingId = uuidv4();
        await publishPaymentConfirmed({
            bookingId,
            seatIds: seatIdArray,
            eventId,
            userId,
            totalAmount: intent.amount,
            stripePaymentIntentId: intent.id
        });
        paymentSuccessCounter.inc();
        res.status(200).json({ received: true, bookingId });
        return;
    }
    if (event.type === 'payment_intent.payment_failed') {
        const intent = event.data.object;
        const { seatIds, eventId, userId } = intent.metadata;
        if (!seatIds || !eventId || !userId) {
            res.status(200).json({ received: true });
            return;
        }
        await publishPaymentFailed({
            seatIds: intent.metadata.seatIds.split(','),
            eventId,
            userId,
            reason: intent.last_payment_error?.message ?? 'Payment failed'
        });
        paymentFailCounter.inc();
        res.status(200).json({ received: true });
        return;
    }
    console.log(`Unhandled Stripe event type: ${event.type}`);
    res.status(200).json({ received: true });
};

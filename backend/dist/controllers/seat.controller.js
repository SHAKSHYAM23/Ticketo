import { lockSeats, unlockSeats, getSeatsWithStatus, LOCK_TTL } from '../services/seat.service.js';
import { createPaymentIntent } from '../services/payment.service.js';
import { publishBookingInitiated } from '../services/booking.service.js';
export const getSeatsByEvent = async (req, res) => {
    const eventId = req.params.id;
    const requestingUserId = req.headers['x-test-user-id'] || req.user?.userId;
    try {
        const [groupedSeats] = await getSeatsWithStatus(eventId, requestingUserId);
        res.status(200).json({
            eventId,
            rows: groupedSeats
        });
    }
    catch (err) {
        res.status(404).json({ error: err.message });
    }
};
export const lockMultipleSeats = async (req, res) => {
    const { seatIds, eventId } = req.body;
    const userId = req.headers['x-test-user-id'] || req.user?.userId;
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({ error: 'seatIds must be a non-empty array' });
        return;
    }
    if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
    }
    const uniqueSeatIds = [...new Set(seatIds)];
    let lockResult;
    try {
        lockResult = await lockSeats({
            seatIds: uniqueSeatIds,
            eventId,
            userId
        });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
        return;
    }
    // seat.controller.ts — temporary for load testing
    const paymentResult = {
        clientSecret: 'mock_secret',
        totalAmount: 100,
        currency: 'inr'
    };
    // comment out the createPaymentIntent call
    // try {
    //   paymentResult = await createPaymentIntent({
    //     seatIds: uniqueSeatIds,
    //     eventId,
    //     userId
    //   })
    // } catch (err) {
    //   await unlockSeats(uniqueSeatIds, userId, eventId)
    //   res.status(500).json({
    //     error: 'Payment system unavailable. Please try again.'
    //   })
    //   return
    // }
    try {
        await publishBookingInitiated({
            seatIds: uniqueSeatIds,
            eventId,
            userId,
            totalAmount: paymentResult.totalAmount
        });
    }
    catch (err) {
        console.error('Failed to publish booking.initiated:', err);
    }
    res.status(200).json({
        message: 'Seats locked successfully',
        clientSecret: paymentResult.clientSecret,
        totalAmount: paymentResult.totalAmount,
        currency: paymentResult.currency,
        expiresIn: LOCK_TTL,
        lockedSeats: lockResult.lockedSeats
    });
};
export const unlockMultipleSeats = async (req, res) => {
    const { seatIds, eventId } = req.body;
    const userId = req.headers['x-test-user-id'] || req.user?.userId;
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({ error: 'seatIds must be a non-empty array' });
        return;
    }
    if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
    }
    try {
        await unlockSeats(seatIds, userId, eventId);
        res.status(200).json({
            message: 'Seats unlocked successfully',
            unlockedSeats: seatIds
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

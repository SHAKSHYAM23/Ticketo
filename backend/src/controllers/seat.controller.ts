import type{ Request, Response } from 'express'
import {
  lockSeats,
  unlockSeats,
  getSeatsWithStatus,
  LOCK_TTL
} from '../services/seat.service.js'
import { createPaymentIntent } from '../services/payment.service.js'
import { publishBookingInitiated } from '../services/booking.service.js'



interface LockManyBody {
  seatIds: string[]
  eventId: string
}


export const getSeatsByEvent = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {

  const eventId = req.params.id


  const requestingUserId = (req as any).user?.userId

  try {
    const [groupedSeats] = await getSeatsWithStatus(
      eventId,
      requestingUserId
    )

    res.status(200).json({
      eventId,
      rows: groupedSeats
    })

  } catch (err) {
    res.status(404).json({ error: (err as Error).message })
  }
}




export const lockMultipleSeats = async (
  req: Request<{}, {}, LockManyBody>,
  res: Response
): Promise<void> => {

  const { seatIds, eventId } = req.body
  const userId = (req as any).user.userId



  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    res.status(400).json({ error: 'seatIds must be a non-empty array' })
    return
  }

  if (!eventId) {
    res.status(400).json({ error: 'eventId is required' })
    return
  }


  const uniqueSeatIds = [...new Set(seatIds)]



  let lockResult

  try {
    lockResult = await lockSeats({
      seatIds: uniqueSeatIds,
      eventId,
      userId
    })
  } catch (err) {
    // seat already booked, locked by others, or max exceeded
    res.status(409).json({ error: (err as Error).message })
    return
  }


  console.log("=== Creating Payment Intent ===");
console.log({
  eventId,
 
  seatIds,

});

  let paymentResult

  try {
    paymentResult = await createPaymentIntent({
      seatIds: uniqueSeatIds,
      eventId,
      userId
    })
  } catch (err) {
    await unlockSeats(uniqueSeatIds, userId, eventId)

    console.error('=== Payment Intent Error ===', err)

    res.status(500).json({
      error: 'Payment system unavailable. Please try again.'
    })
    return
  }

  // ── Step 3 — Publish booking.initiated to Kafka ───────

  try {
    await publishBookingInitiated({
      seatIds: uniqueSeatIds,
      eventId,
      userId,
      totalAmount: paymentResult.totalAmount
    })
  } catch (err) {
    // Kafka failed — not critical for user flow
    // booking.initiated is mainly for analytics
    // do NOT release locks or fail the request
    // user can still pay — Kafka failure here is non-critical
    console.error('⚠️ Failed to publish booking.initiated:', err)
  }

  // ── Step 4 — Return to frontend ───────────────────────

  // frontend receives clientSecret → opens Stripe modal
  // timer starts on frontend — 5 minutes
  res.status(200).json({
    message:      'Seats locked successfully',
    clientSecret: paymentResult.clientSecret,
    totalAmount:  paymentResult.totalAmount,
    currency:     paymentResult.currency,
    expiresIn:    LOCK_TTL,
    lockedSeats:  lockResult.lockedSeats
  })
}

// ─── DELETE /api/seats/lock-many ──────────────────────

// called when:
// 1. user manually clicks cancel / deselects all seats
// 2. timer expires on frontend — cleanup call
// 3. user navigates away from seat map page
//
// releases Redis locks + emits GREEN via socket
// so other users see seats become available immediately

export const unlockMultipleSeats = async (
  req: Request<{}, {}, LockManyBody>,
  res: Response
): Promise<void> => {

  const { seatIds, eventId } = req.body
  const userId = (req as any).user.userId

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    res.status(400).json({ error: 'seatIds must be a non-empty array' })
    return
  }

  if (!eventId) {
    res.status(400).json({ error: 'eventId is required' })
    return
  }

  try {
    await unlockSeats(seatIds, userId, eventId)

    res.status(200).json({
      message:        'Seats unlocked successfully',
      unlockedSeats:  seatIds
    })

  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}
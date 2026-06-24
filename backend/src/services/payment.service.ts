import Stripe from 'stripe'
import stripe from '../config/stripe.js'
import redis from '../config/redis.js'
import prisma from '../config/db.js'
import { paymentIntentDuration } from '../config/metrics.js'
import crypto from 'crypto' 

interface CreatePaymentIntentParams {
  seatIds: string[]
  eventId: string
  userId: string
}

interface PaymentIntentResult {
  clientSecret: string
  totalAmount: number
  currency: string
}

const lockKey = (seatId: string): string =>  `lock:seat:${seatId}`

export const createPaymentIntent = async ({
  seatIds,
  eventId,
  userId
}: CreatePaymentIntentParams): Promise<PaymentIntentResult> => {

  console.log("=== Creating Payment Intent ===");
  console.log({ eventId, seatIds });

  const lockChecks = await Promise.all(
    seatIds.map(id => redis.get(lockKey(id)))
  )

  const invalidLocks = lockChecks.filter(
    lockedBy => lockedBy !== userId
  )

  if (invalidLocks.length > 0) {
    throw new Error(
      'One or more seats are not locked by you. Please select seats again.'
    )
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { pricePerSeat: true, title: true }
  })

  if (!event) {
    throw new Error('Event not found')
  }

  const totalAmount = seatIds.length * event.pricePerSeat * 100

  const end = paymentIntentDuration.startTimer()

  // 2. Hash the long string to stay under Stripe's 255-character limit
  const rawKey = `${userId}-${eventId}-${seatIds.sort().join('-')}`
  const hashedIdempotencyKey = crypto
    .createHash('sha256')
    .update(rawKey)
    .digest('hex')

  const intent = await stripe.paymentIntents.create(
    {
      amount:   totalAmount,
      currency: 'inr',
      metadata: {
        seatIds:    seatIds.join(','),
        eventId,
        userId,
        eventTitle: event.title
      }
    },
    {
      
      idempotencyKey: hashedIdempotencyKey 
    }
  )

  end() 

  if (!intent.client_secret) {
    throw new Error('Failed to create payment intent')
  }

  return {
    clientSecret: intent.client_secret,
    totalAmount,
    currency: 'inr'
  }
}

export const verifyWebhookSignature = (
  rawBody: Buffer,
  signature: string
): Stripe.Event => {

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not defined')
  }

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  )

  return event
}
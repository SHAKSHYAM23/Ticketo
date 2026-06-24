import { getChannel, QUEUES } from '../config/rabbitmq.js'
import { sendBookingConfirmationEmail, verifyEmailTransporter } from '../services/email.service.js'
import { emailFailCounter, dlqCounter } from '../config/metrics.js'



const MAX_RETRIES    = 3
const RETRY_DELAY_MS = 30000



interface NotificationPayload {
  bookingId:   string
  userId:      string
  eventId:     string
  retryCount:  number
  publishedAt: string
}



export const startEmailWorker = async (): Promise<void> => {

  await verifyEmailTransporter()

  const channel = getChannel()


  await channel.assertQueue('notify_retry', {
    durable: true,
    arguments: {
      'x-message-ttl':             RETRY_DELAY_MS,
      'x-dead-letter-exchange':    '',
      'x-dead-letter-routing-key': QUEUES.NOTIFY
    }
  })

  
  await channel.assertQueue('notify_failed', {
    durable: true
  })

  channel.prefetch(1)

  console.log(' Email worker started — waiting for messages...')

  channel.consume(QUEUES.NOTIFY, async (msg) => {

    if (!msg) return

    let payload: NotificationPayload

   
    try {
      payload = JSON.parse(msg.content.toString())
    } catch {
      console.error(' Malformed message — moving to DLQ')
      channel.sendToQueue('notify_failed', msg.content, { persistent: true })
      channel.ack(msg)
      dlqCounter.inc()
      return
    }

    const retryCount = payload.retryCount ?? 0

  
    try {
      await sendBookingConfirmationEmail(payload.bookingId)
      channel.ack(msg)

    } catch (err) {
      console.error(
        ` Email failed — bookingId: ${payload.bookingId}`,
        `attempt: ${retryCount + 1}/${MAX_RETRIES}`,
        (err as Error).message
      )

      emailFailCounter.inc()

      if (retryCount >= MAX_RETRIES) {
     
        console.error(` Moving to DLQ — bookingId: ${payload.bookingId}`)

        channel.sendToQueue(
          'notify_failed',
          Buffer.from(JSON.stringify({
            ...payload,
            failedAt:   new Date().toISOString(),
            finalError: (err as Error).message
          })),
          { persistent: true }
        )

        channel.ack(msg)
        dlqCounter.inc()

      } else {
      
        channel.sendToQueue(
          'notify_retry',
          Buffer.from(JSON.stringify({
            ...payload,
            retryCount: retryCount + 1
          })),
          { persistent: true }
        )

        channel.ack(msg)

        console.log(
          `🔄 Retry ${retryCount + 1}/${MAX_RETRIES} scheduled — bookingId: ${payload.bookingId}`
        )
      }
    }
  })
}
import amqplib from 'amqplib'
import type { ChannelModel, Channel } from 'amqplib'

export const QUEUES = {
  NOTIFY: 'notify'
} as const

let connection: ChannelModel
let channel: Channel

const connectRabbitMQ = async (): Promise<void> => {
  connection = await amqplib.connect(
    process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'
  )

  channel = await connection.createChannel()

  await channel.assertQueue(QUEUES.NOTIFY, { durable: true })

  console.log(' RabbitMQ connected')

  connection.on('error', (err: Error) => {
    console.error(' RabbitMQ connection error:', err.message)
  })

  connection.on('close', () => {
    console.error('RabbitMQ connection closed unexpectedly')
  })
}

const getChannel = (): Channel => {
  if (!channel) throw new Error('RabbitMQ not initialized. Call connectRabbitMQ first.')
  return channel
}

const disconnectRabbitMQ = async (): Promise<void> => {
  await channel.close()
  await connection.close()
  console.log(' RabbitMQ disconnected')
}

export { connectRabbitMQ, getChannel, disconnectRabbitMQ }
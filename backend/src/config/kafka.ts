import type{ Kafka, Producer, Consumer, logLevel } from 'kafkajs'

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID ?? 'ticket-booking',
  brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
  logLevel: logLevel.ERROR  // only show errors — keeps terminal clean
})

// producer — used by booking.service.ts to publish events
const producer: Producer = kafka.producer()

// consumer — used by booking.consumer.ts to read events
const consumer: Consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID ?? 'ticket-booking-group'
})

const connectKafka = async (): Promise<void> => {
  await producer.connect()
  console.log('✅ Kafka producer connected')

  await consumer.connect()
  console.log('✅ Kafka consumer connected')
}

const disconnectKafka = async (): Promise<void> => {
  await producer.disconnect()
  await consumer.disconnect()
  console.log('🔌 Kafka disconnected')
}

export { kafka, producer, consumer, connectKafka, disconnectKafka }
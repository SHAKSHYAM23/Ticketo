import { Kafka, logLevel } from 'kafkajs'

import type { Producer, Consumer } from 'kafkajs'

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID ?? 'ticket-booking',
  brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],


  logLevel: logLevel.ERROR
})

const producer: Producer = kafka.producer()

const consumer: Consumer = kafka.consumer({

  groupId: process.env.KAFKA_GROUP_ID ?? 'ticket-booking-group'
})

const connectKafka = async (): Promise<void> => {
  await producer.connect()
  console.log('Kafka producer connected')

  await consumer.connect()
  
  console.log(' Kafka consumer connected')
}

const disconnectKafka = async (): Promise<void> => {
  await producer.disconnect()
  await consumer.disconnect()
  console.log(' Kafka disconnected')
}

export { kafka, producer, consumer, connectKafka, disconnectKafka }
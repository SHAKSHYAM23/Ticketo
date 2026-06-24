import { Kafka, logLevel } from 'kafkajs';
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'ticket-booking',
    brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    logLevel: logLevel.WARN
});
const producer = kafka.producer();
const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID ?? 'ticket-booking-group'
});
const connectKafka = async () => {
    await producer.connect();
    console.log('Kafka producer connected');
    await consumer.connect();
    console.log(' Kafka consumer connected');
};
const disconnectKafka = async () => {
    await producer.disconnect();
    await consumer.disconnect();
    console.log(' Kafka disconnected');
};
export { kafka, producer, consumer, connectKafka, disconnectKafka };

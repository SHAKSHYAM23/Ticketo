import express from 'express'
import cors from 'cors'
import dotenv from "dotenv";
import prisma from './config/db.js'
import redis from './config/redis.js'
import { connectKafka } from './config/kafka.js'
import { connectRabbitMQ } from './config/rabbitmq.js'


import authRoutes from './routes/auth.routes.js';

import eventRoutes from "./routes/event.routes.js";


await connectKafka()
await connectRabbitMQ()

// test prisma
await prisma.$connect()
console.log('✅ Postgres connected')

// test redis
await redis.ping()
console.log('✅ Redis ping OK')

// import seatRoutes from "./routes/seat.routes.js";


dotenv.config();

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
// app.use("/api", seatRoutes);

const PORT = process.env.PORT || 3000


app.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`)
})
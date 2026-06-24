import redis from '../config/redis.js'
import prisma from '../config/db.js'
import { getIO } from '../socket/index.js'
import {
  seatLockCounter,
  seatLockFailCounter,
  seatLockDuration,
  
} from '../config/metrics.js'

export const LOCK_TTL = 300
export const MAX_SEATS = 6

const lockKey = (seatId: string): string => `lock:seat:${seatId}`
const userLocksKey = (userId: string, eventId: string): string => `user:locks:${userId}:${eventId}`

interface LockSeatsParams {
  seatIds: string[]
  eventId: string
  userId: string
}

interface LockSeatsResult {
  success: boolean
  lockedSeats: string[]
  failedSeats: string[]
}

const LOCK_SCRIPT = `
  for i, key in ipairs(KEYS) do
    if redis.call('EXISTS', key) == 1 then
      return 0
    end
  end
  for i, key in ipairs(KEYS) do
    redis.call('SET', key, ARGV[1], 'EX', ARGV[2])
  end
  return 1
`

export const invalidateSeatCache = async (eventId: string): Promise<void> => {
  await redis.del(`seats:static:${eventId}`)
}

export const lockSeats = async ({
  seatIds,
  eventId,
  userId
}: LockSeatsParams): Promise<LockSeatsResult> => {
  if (seatIds.length > MAX_SEATS) {
    throw new Error(`Maximum ${MAX_SEATS} seats allowed per booking`)
  }

  if (seatIds.length === 0) {
    throw new Error('At least one seat must be selected')
  }

  const seats = await prisma.seat.findMany({
    where: { id: { in: seatIds }, eventId }
  })

  if (seats.length !== seatIds.length) {
    throw new Error('One or more seats not found for this event')
  }

  const bookedSeats = seats.filter(s => s.status === 'booked')
  if (bookedSeats.length > 0) {
    const labels = bookedSeats.map(s => `${s.rowLabel}${s.seatNumber}`).join(', ')
    throw new Error(`Seats already booked: ${labels}`)
  }

  const ulKey = userLocksKey(userId, eventId)
  const previousSeatIds = await redis.sMembers(ulKey)

  if (previousSeatIds.length > 0) {
    await Promise.all(previousSeatIds.map(id => redis.del(lockKey(id))))
    await redis.del(ulKey)

    const previousSeats = await prisma.seat.findMany({
      where: { id: { in: previousSeatIds } },
      select: { id: true, rowLabel: true, seatNumber: true }
    })

    const io = getIO()
    previousSeats.forEach(seat => {
      io.to(`event:${eventId}`).emit('seat_updated', {
        seatId: seat.id,
        status: 'available',
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber
      })
    })
  }

  const endTimer = seatLockDuration.startTimer()
  const keys = seatIds.map(lockKey)
  
  const rawResult = await redis.eval(LOCK_SCRIPT, {
    keys,
    arguments: [userId, String(LOCK_TTL)]
  })
  endTimer()

  if (rawResult === 0) {
    seatLockFailCounter.inc({ eventId })
    throw new Error('Could not lock seats — one or more seats were just taken by another user.')
  }
  
  seatLockCounter.inc({ eventId })

  await redis.sAdd(ulKey, seatIds as [string, ...string[]])
  await redis.expire(ulKey, LOCK_TTL)

  const io = getIO()
  seats.forEach(seat => {
    io.to(`event:${eventId}`).emit('seat_updated', {
      seatId: seat.id,
      status: 'locked',
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber
    })
  })

  console.log(
    `Locked ${seats.length} seats for user ${userId} — ${seats.map(s => `${s.rowLabel}${s.seatNumber}`).join(', ')}`
  )

  return {
    success: true,
    lockedSeats: seatIds,
    failedSeats: []
  }
}

export const unlockSeats = async (
  seatIds: string[],
  userId: string,
  eventId: string
): Promise<void> => {
  const seats = await prisma.seat.findMany({
    where: { id: { in: seatIds } },
    select: { id: true, rowLabel: true, seatNumber: true, status: true }
  })

  await Promise.all(
    seatIds.map(async (seatId) => {
      const lockedBy = await redis.get(lockKey(seatId))
      if (lockedBy === userId) {
        await redis.del(lockKey(seatId))
      }
    })
  )

  if (seatIds.length > 0) {
    await redis.sRem(userLocksKey(userId, eventId), seatIds as [string, ...string[]])
  }

  const io = getIO()
  seats
    .filter(seat => seat.status !== 'booked')
    .forEach(seat => {
      io.to(`event:${eventId}`).emit('seat_updated', {
        seatId: seat.id,
        status: 'available',
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber
      })
    })

  console.log(`Unlocked ${seatIds.length} seats for user ${userId}`)
}

export const getSeatsWithStatus = async (
  eventId: string,
  requestingUserId?: string
): Promise<object[]> => {
  const STATIC_CACHE_KEY = `seats:static:${eventId}`
  let seats: any[]
  
  const cachedStatic = await redis.get(STATIC_CACHE_KEY)

  if (cachedStatic) {
    seats = JSON.parse(cachedStatic)
  } else {
    seats = await prisma.seat.findMany({
      where: { eventId },
      orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }],
      select: { id: true, rowLabel: true, seatNumber: true, status: true }
    })
    
    if (!seats.length) {
      throw new Error('No seats found for this event')
    }
    
    await redis.set(STATIC_CACHE_KEY, JSON.stringify(seats), { EX: 60 })
  }

  const lockKeys = seats.map((s: any) => lockKey(s.id))
  const lockValues = await redis.mGet(lockKeys)
  
  const groupedByRow: Record<string, object[]> = {}

  seats.forEach((seat: any, i: number) => {
    const lockedBy = lockValues[i]
    let status = 'available'
    let lockedByMe = false

    if (seat.status === 'booked') {
      status = 'booked'
    } else if (lockedBy) {
      status = 'locked'
      lockedByMe = lockedBy === requestingUserId
    }

    if (!groupedByRow[seat.rowLabel]) {
      groupedByRow[seat.rowLabel] = []
    }

    groupedByRow[seat.rowLabel]!.push({
      id: seat.id,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      status,
      lockedByMe
    })
  })

  return [groupedByRow]
}
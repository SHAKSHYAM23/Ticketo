import type{ Request, Response } from 'express'
import prisma from '../config/db.js'
import { publishNotification } from '../services/notification.service.js'

export const getMyBookings = async (
  req: Request,
  res: Response
): Promise<void> => {

  const userId = (req as any).user.userId

  const bookings = await prisma.booking.findMany({
    where:   { userId },
    orderBy: { bookedAt: 'desc' },
    include: {
      event: {
        select: {
          title:       true,
          venue:       true,
          eventDate:   true
        }
      },
      seats: {
        include: {
          seat: {
            select: {
              rowLabel:   true,
              seatNumber: true
            }
          }
        }
      }
    }
  })

  const transformed = bookings.map(booking => ({
    id:          booking.id, // ✅ FIX: Added the real ID here so the frontend can use it!
    bookingRef:  `****${booking.id.slice(-8)}`,
    status:      booking.status,
    totalAmount: booking.totalAmount,
    bookedAt:    booking.bookedAt,
    emailSent:   booking.emailSent,
    event: {
      title:     booking.event.title,
      venue:     booking.event.venue,
      eventDate: booking.event.eventDate
    },
    seats: booking.seats.map(bs => ({
      row:    bs.seat.rowLabel,
      number: bs.seat.seatNumber,
      label:  `${bs.seat.rowLabel}${bs.seat.seatNumber}`
    }))
  }))

  res.status(200).json(transformed)
}

export const getBookingById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {

  const userId    = (req as any).user.userId
  const bookingId = req.params.id

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: {
        select: {
          title:        true,
          venue:        true,
          eventDate:    true,
          description:  true
        }
      },
      seats: {
        include: {
          seat: {
            select: {
              rowLabel:   true,
              seatNumber: true
            }
          }
        }
      }
    }
  })

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' })
    return
  }

  if (booking.userId !== userId) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  res.status(200).json({
    id:          booking.id, // ✅ FIX: Added here as well for consistency!
    bookingRef:  `****${booking.id.slice(-8)}`,
    status:      booking.status,
    totalAmount: booking.totalAmount,
    bookedAt:    booking.bookedAt,
    emailSent:   booking.emailSent,
    scanned:     booking.scanned,
    event: {
      title:       booking.event.title,
      venue:       booking.event.venue,
      eventDate:   booking.event.eventDate,
      description: booking.event.description
    },
    seats: booking.seats.map(bs => ({
      row:    bs.seat.rowLabel,
      number: bs.seat.seatNumber,
      label:  `${bs.seat.rowLabel}${bs.seat.seatNumber}`
    })),
    // tell frontend whether to show resend button
    canResendEmail: !booking.emailSent || booking.status === 'confirmed'
  })
}

export const resendEmail = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {

  const userId    = (req as any).user.userId
  const bookingId = req.params.id

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId:  true,
      status:  true,
      eventId: true
    }
  })

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' })
    return
  }

  if (booking.userId !== userId) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  if (booking.status !== 'confirmed') {
    res.status(400).json({
      error: 'Email can only be resent for confirmed bookings'
    })
    return
  }

  await publishNotification({
    bookingId,
    userId,
    eventId: booking.eventId
  })
  
  await prisma.booking.update({
    where: { id: bookingId },
    data:  { emailSent: false }
  })

  res.status(200).json({
    message: 'Confirmation email queued successfully'
  })
}

export const verifyBooking = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {

  const bookingId = req.params.id

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: {
          name:  true,
          email: true
        }
      },
      event: {
        select: {
          title:     true,
          eventDate: true,
          venue:     true
        }
      },
      seats: {
        include: {
          seat: {
            select: {
              rowLabel:   true,
              seatNumber: true
            }
          }
        }
      }
    }
  })

  if (!booking) {
    res.status(404).json({
      valid: false,
      error: 'Booking not found — invalid QR code'
    })
    return
  }

  if (booking.status !== 'confirmed') {
    res.status(400).json({
      valid:  false,
      error:  'Booking is not confirmed',
      status: booking.status
    })
    return
  }

  if (booking.scanned) {
    res.status(400).json({
      valid:          false,
      error:          'QR code already used',
      alreadyScanned: true,
      scannedAt:      booking.scannedAt
    })
    return
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      scanned:   true,
      scannedAt: new Date()
    }
  })

  res.status(200).json({
    valid:      true,
    userName:   booking.user.name,
    userEmail:  booking.user.email,
    event: {
      title:     booking.event.title,
      eventDate: booking.event.eventDate,
      venue:     booking.event.venue
    },
    seats: booking.seats.map(bs => ({
      label: `${bs.seat.rowLabel}${bs.seat.seatNumber}`
    })),
    scannedAt: new Date()
  })
}
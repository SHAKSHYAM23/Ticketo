import nodemailer from 'nodemailer'
import prisma from '../config/db.js'
import { generateQR } from './qr.service.js'
import { buildBookingConfirmedEmail } from './email.template.js'
import { emailSentCounter } from '../config/metrics.js'



const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

export const verifyEmailTransporter = async (): Promise<void> => {
  try {
    await transporter.verify()
    console.log(' SMTP transporter ready')
  } catch (err) {
    console.error('SMTP connection failed:', err)
  }
}



export const sendBookingConfirmationEmail = async (
  bookingId: string
): Promise<void> => {

 
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user:  { select: { name: true, email: true } },
      event: { select: { title: true, eventDate: true, venue: true } },
      seats: {
        include: {
          seat: { select: { rowLabel: true, seatNumber: true } }
        }
      }
    }
  })

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`)
  }

  if (!booking.user.email) {
    throw new Error(`No email for user: ${booking.userId}`)
  }


  const qrResult = await generateQR(booking.id)
  const qrBase64Raw = qrResult.base64.split('base64,')[1]


  const html = buildBookingConfirmedEmail({
    userName:    booking.user.name,
    eventTitle:  booking.event.title,
    eventDate:   booking.event.eventDate,
    venue:       booking.event.venue,
    seats:       booking.seats.map(bs => ({
      rowLabel:   bs.seat.rowLabel,
      seatNumber: bs.seat.seatNumber
    })),
    totalAmount: booking.totalAmount,
    bookingId:   booking.id
  })


  await transporter.sendMail({
    from:    process.env.EMAIL_FROM ?? 'Ticketflow <noreply@ticketflow.com>',
    to:      booking.user.email,
    subject: `Booking Confirmed — ${booking.event.title}`,
    html,
    attachments: [
      {
        filename: 'ticket-qr.png',
        content:  qrBase64Raw,
        encoding: 'base64',
        cid:      'qrcode'
      }
    ]
  })

 
  await prisma.booking.update({
    where: { id: booking.id },
    data:  { emailSent: true }
  })

  emailSentCounter.inc()

  console.log(` Email sent for bookingId: ${bookingId}`)
}
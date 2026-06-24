import nodemailer from 'nodemailer';
import { getChannel, QUEUES } from '../config/rabbitmq.js';
import { generateQR } from '../services/qr.service.js';
import prisma from '../config/db.js';
import { emailSentCounter, emailFailCounter, dlqCounter } from '../config/metrics.js';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});
const verifyTransporter = async () => {
    try {
        await transporter.verify();
    }
    catch (err) {
        // console.error('SMTP connection failed:', err)
    }
};
const buildEmailHTML = (userName, eventTitle, eventDate, venue, seats, totalAmount, bookingId) => {
    const seatList = seats.map(s => `${s.rowLabel}${s.seatNumber}`).join(', ');
    const formattedDate = new Date(eventDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const formattedAmount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(totalAmount / 100);
    const partialBookingId = `****${bookingId.slice(-8)}`;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Confirmed</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 36px 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 26px; }
    .body { padding: 32px 30px; }
    .detail-card { background: #f8f9fa; border-radius: 10px; padding: 4px 20px; margin-bottom: 24px; }
    .detail-row { display: table; width: 100%; padding: 14px 0; border-bottom: 1px solid #e9ecef; }
    .detail-value { display: table-cell; color: #1a1a2e; font-size: 14px; font-weight: 600; text-align: right; }
    .qr-section { text-align: center; padding: 28px 20px; }
    .qr-section img { width: 200px; height: 200px; border: 6px solid #ffffff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🎫 Ticketflow</h1></div>
    <div class="body">
      <p>Hi <strong>${userName}</strong>,</p>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-value">${eventTitle}</span></div>
        <div class="detail-row"><span class="detail-value">${formattedDate}</span></div>
        <div class="detail-row"><span class="detail-value">${seatList}</span></div>
        <div class="detail-row"><span class="detail-value">${formattedAmount}</span></div>
      </div>
      <div class="qr-section">
        <img src="cid:qrcode" alt="QR" />
      </div>
    </div>
  </div>
</body>
</html>`;
};
const sendConfirmationEmail = async (payload) => {
    const booking = await prisma.booking.findUnique({
        where: { id: payload.bookingId },
        include: {
            user: { select: { name: true, email: true } },
            event: { select: { title: true, eventDate: true, venue: true } },
            seats: { include: { seat: { select: { rowLabel: true, seatNumber: true } } } }
        }
    });
    if (!booking || !booking.user.email)
        throw new Error('Booking/User not found');
    const qrResult = await generateQR(booking.id);
    const seats = booking.seats.map(bs => ({ rowLabel: bs.seat.rowLabel, seatNumber: bs.seat.seatNumber }));
    await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? 'Ticket Booking <noreply@ticketbooking.com>',
        to: booking.user.email,
        subject: `Booking Confirmed — ${booking.event.title}`,
        html: buildEmailHTML(booking.user.name, booking.event.title, booking.event.eventDate, booking.event.venue, seats, booking.totalAmount, booking.id),
        attachments: [{ filename: 'ticket-qr.png', content: qrResult.base64.split('base64,')[1], encoding: 'base64', cid: 'qrcode' }]
    });
    await prisma.booking.update({ where: { id: booking.id }, data: { emailSent: true } });
    emailSentCounter.inc();
    // console.log(`Email sent: ${payload.bookingId}`)
};
export const startEmailWorker = async () => {
    await verifyTransporter();
    const channel = getChannel();
    await channel.assertQueue('notify_retry', {
        durable: true,
        arguments: {
            'x-message-ttl': RETRY_DELAY_MS,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': QUEUES.NOTIFY
        }
    });
    await channel.assertQueue('notify_failed', { durable: true });
    channel.prefetch(1);
    channel.consume(QUEUES.NOTIFY, async (msg) => {
        if (!msg)
            return;
        let payload;
        try {
            payload = JSON.parse(msg.content.toString());
        }
        catch {
            channel.sendToQueue('notify_failed', msg.content, { persistent: true });
            channel.ack(msg);
            dlqCounter.inc();
            return;
        }
        const retryCount = payload.retryCount ?? 0;
        try {
            await sendConfirmationEmail(payload);
            channel.ack(msg);
        }
        catch (err) {
            emailFailCounter.inc();
            if (retryCount >= MAX_RETRIES) {
                channel.sendToQueue('notify_failed', Buffer.from(JSON.stringify({ ...payload, finalError: err.message })), { persistent: true });
                channel.ack(msg);
                dlqCounter.inc();
            }
            else {
                channel.sendToQueue('notify_retry', Buffer.from(JSON.stringify({ ...payload, retryCount: retryCount + 1 })), { persistent: true });
                channel.ack(msg);
            }
        }
    });
};

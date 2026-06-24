interface EmailTemplateParams {
  userName: string
  eventTitle: string
  eventDate: Date
  venue: string
  seats: { rowLabel: string; seatNumber: number }[]
  totalAmount: number
  bookingId: string
}

export const buildBookingConfirmedEmail = ({
  userName,
  eventTitle,
  eventDate,
  venue,
  seats,
  totalAmount,
  bookingId
}: EmailTemplateParams): string => {

  const seatList = seats
    .map(s => `${s.rowLabel}${s.seatNumber}`)
    .join(', ')

  const formattedDate = new Date(eventDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit'
  })

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR'
  }).format(totalAmount / 100)

  const partialBookingId = `****${bookingId.slice(-8)}`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Booking Confirmed</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 36px 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 0.5px; }
    .header p { color: #a0a0b0; margin: 10px 0 0; font-size: 14px; }
    .body { padding: 32px 30px; }
    .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 8px; }
    .subtext { color: #6c757d; margin: 0 0 24px; font-size: 14px; line-height: 1.6; }
    .detail-card { background: #f8f9fa; border-radius: 10px; padding: 4px 20px; margin-bottom: 24px; }
    .detail-row { display: table; width: 100%; padding: 14px 0; border-bottom: 1px solid #e9ecef; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { display: table-cell; color: #6c757d; font-size: 13px; vertical-align: middle; }
    .detail-value { display: table-cell; color: #1a1a2e; font-size: 14px; font-weight: 600; text-align: right; vertical-align: middle; }
    .qr-section { text-align: center; padding: 28px 20px; background: #f8f9fa; border-radius: 10px; margin-bottom: 24px; }
    .qr-section img { width: 200px; height: 200px; border: 6px solid #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); display: inline-block; }
    .qr-section p { color: #6c757d; font-size: 12px; margin: 14px 0 0; }
    .qr-warn { color: #856404; font-weight: 600; margin-top: 4px; }
    .booking-ref { text-align: center; font-size: 12px; color: #9aa0a6; letter-spacing: 0.5px; margin-bottom: 24px; }
    .notice-box { background: #fff3cd; border-radius: 10px; padding: 16px 18px; }
    .notice-box p { color: #856404; font-size: 13px; margin: 0; line-height: 1.6; }
    .footer { background: #f8f9fa; padding: 22px 30px; text-align: center; }
    .footer p { color: #9aa0a6; font-size: 12px; margin: 0; }
    .highlight { color: #0F6E56; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">

    <div class="header">
      <h1>🎫 Ticketflow</h1>
      <p>Your booking has been confirmed</p>
    </div>

    <div class="body">
      <p class="greeting">Hi <strong>${userName}</strong>,</p>
      <p class="subtext">
        Your booking has been confirmed. Show the QR code below at the entrance.
      </p>

      <div class="detail-card">
        <div class="detail-row">
          <span class="detail-label">Event</span>
          <span class="detail-value">${eventTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${formattedDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Venue</span>
          <span class="detail-value">${venue}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Seats</span>
          <span class="detail-value highlight">${seatList}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount Paid</span>
          <span class="detail-value highlight">${formattedAmount}</span>
        </div>
      </div>

      <div class="qr-section">
        <img src="cid:qrcode" alt="Your ticket QR code" />
        <p>Show this QR code at the entrance</p>
        <p class="qr-warn">Valid for one-time scan only</p>
      </div>

      <div class="booking-ref">
        BOOKING REFERENCE — ${partialBookingId}
      </div>

      <div class="notice-box">
        <p>
          <strong>Did not receive this email correctly?</strong><br>
          Log in to your account and visit My Bookings to resend or view your QR code.
        </p>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
      <p style="margin-top: 6px;">© 2026 Ticketflow</p>
    </div>

  </div>
</body>
</html>
  `
}
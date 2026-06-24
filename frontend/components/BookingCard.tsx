'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  MapPin,
  Calendar,
  Loader2,
  Check,
  Ticket,
  Receipt,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import {
  formatINR,
  formatEventDate,
  bookingSeatLabels,
} from '@/lib/format'
import type { Booking } from '@/lib/types'

interface BookingCardProps {
  booking: Booking
}

export default function BookingCard({
  booking,
}: BookingCardProps) {
  const router = useRouter()

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)


  const id = booking._id ?? booking.id ?? ''

  const title =
    booking.event?.title ??
    booking.eventTitle ??
    'Event'

  const description = booking.event?.description

  const venue =
    booking.event?.venue ??
    booking.venue ??
    '—'

  const date =
    booking.event?.eventDate ??
    booking.date

  const seats = bookingSeatLabels(booking)

  const status = (booking.status ?? '').toLowerCase()

  const statusStyle =
    status === 'confirmed'
      ? 'bg-success/15 text-success'
      : 'bg-warning/15 text-warning'

  const handleResend = async () => {
    setResending(true)

    try {
      await api.post(`/api/bookings/${id}/resend-email`)
      setResent(true)
      toast.success('Email resent')
    } catch (err: any) {
   
      toast.error(
        err?.response?.data?.error ??
          'Could not resend the email.',
      )
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">
            {title}
          </h3>

          {description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <Badge className={`capitalize ${statusStyle}`}>
          {booking.status ?? 'Pending'}
        </Badge>
      </div>

      {/* Event Details */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {venue}
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {date ? formatEventDate(date) : '—'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Ticket className="h-3 w-3" />
            Seats
          </div>

          <p className="mt-1 font-medium text-card-foreground">
            {seats.length ? seats.join(', ') : '—'}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Receipt className="h-3 w-3" />
            Amount Paid
          </div>

          <p className="mt-1 font-semibold text-card-foreground">
           
           {formatINR(((booking as any).totalAmount ?? booking.amount ?? 0) / 100)}
          </p>
        </div>
      </div>

      {booking.bookingRef && (
        <div className="rounded-lg bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">
            Booking Reference
          </p>

          <p className="mt-1 font-mono text-sm font-semibold">
            {booking.bookingRef}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/bookings/${id}`)}
        >
          View Details
        </Button>

        <Button
          variant="ghost"
          className="flex-1"
          disabled={resending || resent}
          onClick={handleResend}
        >
          {resending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : resent ? (
            <Check className="mr-2 h-4 w-4 text-success" />
          ) : null}

          {resent ? 'Email Resent' : 'Resend Email'}
        </Button>
      </div>
    </div>
  )
}
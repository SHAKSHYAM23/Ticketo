'use client'

import { Loader2, Calendar, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import Timer from '@/components/Timer'
import { formatINR, formatEventDate } from '@/lib/format'
import type { EventItem } from '@/lib/types'

interface BookingSummaryProps {
  event: EventItem | null
  selectedSeats: string[]
  seatLabels: string[]
  onConfirm: () => void
  loading: boolean
  expiresIn?: number | null
  onExpire?: () => void
  locked?: boolean
}

export default function BookingSummary({
  event,
  selectedSeats,
  seatLabels,
  onConfirm,
  loading,
  expiresIn,
  onExpire,
  locked,
}: BookingSummaryProps) {
  const price = event?.pricePerSeat ?? event?.price ?? 0
  const total = price * selectedSeats.length
  const hasSeats = selectedSeats.length > 0

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      {/* Event Info */}
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">
          {event?.title ?? 'Booking Summary'}
        </h2>

        {event?.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}

        {event && (
          <>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.venue}
              </span>

              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatEventDate(event.eventDate)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Rows</p>
                <p className="font-semibold">{event.rowCount ?? '-'}</p>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Seats / Row
                </p>
                <p className="font-semibold">
                  {event.seatsPerRow ?? '-'}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Available
                </p>
                <p className="font-semibold">
                  {event.availableSeats ?? '-'}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Total Seats
                </p>
                <p className="font-semibold">
                  {event.totalSeats ?? '-'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Selected Seats */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected Seats
        </p>

        {hasSeats ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {seatLabels.map((label) => (
              <span
                key={label}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Select seats from the seat map to continue.
          </p>
        )}
      </div>

      <Separator />

      {/* Price Summary */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Seat Price
          </span>
          <span>{formatINR(price)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Selected Seats
          </span>
          <span>{selectedSeats.length}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Amount
          </span>
          <span>{formatINR(total)}</span>
        </div>

        <Separator />

        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
      </div>

      {/* Reservation Timer */}
      {locked && typeof expiresIn === 'number' && onExpire && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Seats are reserved for you. Complete payment before the timer
            expires.
          </p>

          <Timer
            seconds={expiresIn}
            onExpire={onExpire}
          />
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!hasSeats || loading}
        onClick={onConfirm}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}

        {locked ? 'Proceed to Payment' : 'Confirm Booking'}
      </Button>
    </div>
  )
}
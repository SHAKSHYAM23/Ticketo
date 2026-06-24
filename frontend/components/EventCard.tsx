'use client'

import { MapPin, Calendar, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatINR, formatEventDate } from '@/lib/format'
import type { EventItem } from '@/lib/types'

interface EventCardProps {
  event: EventItem
  onClick: (event: EventItem) => void
}

function availability(event: EventItem) {
  const total = event.totalSeats ?? 0
  const available = event.availableSeats ?? 0

  if (available <= 10) {
    return {
      label:
        available <= 0
          ? 'Sold Out'
          : `${available}/${total} Seats Left`,
      className: 'bg-danger/15 text-danger',
    }
  }

  const ratio = total > 0 ? available / total : 1

  if (ratio < 0.2) {
    return {
      label: `${available}/${total} Seats Left`,
      className: 'bg-warning/15 text-warning',
    }
  }

  return {
    label: `${available}/${total} Available`,
    className: 'bg-success/15 text-success',
  }
}

export default function EventCard({
  event,
  onClick,
}: EventCardProps) {
  const price = event.pricePerSeat ?? event.price ?? 0

  const hasAvailability =
    event.availableSeats !== undefined &&
    event.totalSeats !== undefined

  const avail = availability(event)

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="group flex w-full flex-col rounded-xl border border-border bg-card p-5 text-left transition-all duration-200 hover:border-primary/60 hover:shadow-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-balance text-lg font-semibold leading-snug text-card-foreground">
          {event.title}
        </h3>

        {hasAvailability && (
          <Badge className={avail.className}>
            {avail.label}
          </Badge>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {event.description}
        </p>
      )}

      {/* Venue & Date */}
      <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          {event.venue}
        </span>

        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0" />
          {formatEventDate(event.eventDate)}
        </span>
      </div>

      {/* Event Stats */}
      <div className="mt-4 flex flex-wrap gap-2">
        {event.rowCount && (
          <Badge variant="secondary">
            {event.rowCount} Rows
          </Badge>
        )}

        {event.seatsPerRow && (
          <Badge variant="secondary">
            {event.seatsPerRow} Seats/Row
          </Badge>
        )}

        {event.totalSeats && (
          <Badge variant="secondary">
            {event.totalSeats} Total Seats
          </Badge>
        )}
      </div>

      {/* Price */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <div>
          <span className="text-xs text-muted-foreground">
            Starting from
          </span>

          <p className="text-base font-semibold text-card-foreground">
            {formatINR(price)}
            <span className="text-xs font-normal text-muted-foreground">
              {' '}
              / seat
            </span>
          </p>
        </div>

        <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Book Now
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  )
}
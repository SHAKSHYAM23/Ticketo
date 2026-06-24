'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Seat } from '@/lib/types'

interface SeatMapProps {
  seats: Record<string, Seat[]>
  selectedSeats: string[]
  onSeatClick: (seatId: string) => void
  lockedByMe?: string[]
}

type Visual = 'available' | 'booked' | 'locked' | 'selected'

const SEAT_STYLES: Record<Visual, string> = {
  available:
    'bg-[var(--seat-available)] text-[#052e16] cursor-pointer hover:brightness-110',
  booked: 'bg-[var(--seat-booked)] text-[#450a0a] cursor-not-allowed opacity-80',
  locked:
    'bg-[var(--seat-locked)] text-[#271700] cursor-not-allowed opacity-90',
  selected:
    'bg-[var(--seat-selected)] text-white cursor-pointer ring-2 ring-offset-2 ring-offset-card ring-[var(--seat-selected)] hover:brightness-110',
}

function getSeatId(seat: Seat) {
  return seat._id ?? seat.id ?? `${seat.rowLabel}${seat.seatNumber}`
}

export default function SeatMap({
  seats,
  selectedSeats,
  onSeatClick,
  lockedByMe = [],
}: SeatMapProps) {
  const rows = Object.keys(seats).sort()

  return (
    <div className="flex flex-col gap-6">
      {/* Stage indicator */}
      <div className="flex flex-col items-center gap-1">
        <div className="w-full max-w-2xl rounded-md border border-border bg-secondary py-2 text-center text-xs font-semibold tracking-[0.3em] text-muted-foreground">
          STAGE
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-3 overflow-x-auto pb-2">
        {rows.map((rowLabel) => (
          <div key={rowLabel} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">
              {rowLabel}
            </span>
            <div className="flex flex-wrap  `gap-0.5`">
              {seats[rowLabel].map((seat) => {
                const id = getSeatId(seat)
                const isSelected = selectedSeats.includes(id)
                const isMine = lockedByMe.includes(id)

                let visual: Visual
                if (isSelected) visual = 'selected'
                else if (seat.status === 'booked') visual = 'booked'
                else if (seat.status === 'locked')
                  visual = isMine ? 'selected' : 'locked'
                else visual = 'available'

                const clickable =
                  visual === 'available' || visual === 'selected'

                const button = (
                  <button
                    type="button"
                    aria-label={`Seat ${rowLabel}${seat.seatNumber} — ${seat.status}`}
                    disabled={!clickable}
                    onClick={() => clickable && onSeatClick(id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-medium transition-all ${SEAT_STYLES[visual]}`}
                  >
                    {seat.seatNumber}
                  </button>
                )

                if (visual === 'locked') {
                  return (
                    <Tooltip key={id}>
                      <TooltipTrigger render={button} />
                      <TooltipContent>
                        Someone is currently booking this seat
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return <span key={id}>{button}</span>
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <LegendItem color="var(--seat-available)" label="Available" />
        <LegendItem color="var(--seat-selected)" label="Selected" />
        <LegendItem color="var(--seat-locked)" label="Locked" />
        <LegendItem color="var(--seat-booked)" label="Booked" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-4 w-4 rounded-lg"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

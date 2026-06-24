'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Loader2,
  Check,
  Mail,
  QrCode,
  AlertCircle,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import { fetcher } from '@/lib/fetcher'
import { isLoggedIn } from '@/lib/auth'
import {
  formatINR,
  formatEventDate,
  bookingSeatLabels,
  maskRef,
} from '@/lib/format'
import type { Booking } from '@/lib/types'

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?redirect=/bookings/${id}`)
    } else {
      setAuthed(true)
    }
  }, [id, router])

  const { data, error, isLoading, mutate } = useSWR<Booking & { totalAmount?: number }>(
    authed ? `/api/bookings/${id}` : null,
    fetcher,
  )

  const booking = data
  const title = booking?.event?.title ?? booking?.eventTitle ?? 'Event'
  const venue = booking?.event?.venue ?? booking?.venue ?? '—'
  
  // ✅ FIX 2: Used 'as any' so you don't have to break your types.ts file to get eventDate
  const date = (booking?.event as any)?.eventDate ?? (booking as any)?.eventDate ?? booking?.date
  
  const seats = booking ? bookingSeatLabels(booking) : []
  const status = (booking?.status ?? '').toLowerCase()
  const emailSent = booking?.emailSent

  const handleResend = async () => {
    setResending(true)
    try {
      // ✅ FIX 3: Pull the ID straight from the booking so it never causes a double-slash (//) 404 error
      const targetId = booking?.id || booking?._id || id
      
      await api.post(`/api/bookings/${targetId}/resend-email`)
      
      toast.success('Email resent')
      mutate()
    } catch (err: any) {
      // ✅ FIX 4: Changed to .error so you can actually see the backend's rejection reason
      toast.error(
        err?.response?.data?.error || 'Could not resend the email.',
      )
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/bookings')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bookings
        </Button>

        {(authed === null || isLoading) && (
          <div className="rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="mt-4 h-4 w-1/2" />
            <Skeleton className="mt-2 h-4 w-1/3" />
            <Skeleton className="mt-6 h-20 w-full" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
            <AlertCircle className="h-8 w-8 text-danger" />
            <p className="text-sm text-muted-foreground">
              Could not load this booking. Please try again.
            </p>
          </div>
        )}

        {authed && !isLoading && !error && booking && (
          <div className="flex flex-col gap-6">
            {/* Event card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-balance text-xl font-semibold leading-snug">
                  {title}
                </h1>
                <Badge
                  className={`shrink-0 capitalize ${
                    status === 'confirmed'
                      ? 'bg-success/15 text-success hover:bg-success/15'
                      : 'bg-warning/15 text-warning hover:bg-warning/15'
                  }`}
                >
                  {booking.status ?? 'pending'}
                </Badge>
              </div>
              <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {venue}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatEventDate(date)}
                </span>
              </div>

              <Separator className="my-5" />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Seats
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {seats.length ? (
                    seats.map((label) => (
                      <span
                        key={label}
                        className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary"
                      >
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              <Separator className="my-5" />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Amount paid</p>
                  <p className="text-lg font-semibold">
                    {/* Displaying totalAmount first, falling back to amount */}
                    {formatINR(booking.totalAmount ?? booking.amount ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Booking reference
                  </p>
                  <p className="font-mono text-sm">
                    {maskRef(booking.bookingRef ?? booking._id ?? booking.id)}
                  </p>
                </div>
              </div>
            </div>

            {/* Email status */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {emailSent ? (
                  <span className="flex items-center gap-1 text-success">
                    Confirmation email sent
                    <Check className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="text-warning">Email not sent</span>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleResend}
                disabled={resending}
              >
                {resending && <Loader2 className="h-4 w-4 animate-spin" />}
                Resend Email
              </Button>
            </div>

            {/* QR notice */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-5 text-sm text-muted-foreground">
              <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
              <p>
                Your QR code was sent to your email. Show it at the entrance.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
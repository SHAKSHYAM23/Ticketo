export interface EventItem {
  _id?: string
  id?: string

  title: string
  description?: string
   date: Date
  venue: string
  eventDate?: string   

  pricePerSeat: number
  price?: number

  rowCount?: number
  seatsPerRow?: number

  totalSeats?: number
  availableSeats?: number

  imageUrl?: string
}

export type SeatStatus = 'available' | 'booked' | 'locked'

export interface Seat {
  _id: string
  id?: string
  rowLabel: string
  seatNumber: number
  status: SeatStatus
  label?: string
}

export interface SeatsResponse {
  rows: Record<string, Seat[]>
  event?: EventItem
}

export interface Booking {
  _id: string
  id?: string
  bookingRef?: string
totalAmount?: number;
  event?: EventItem
  eventTitle?: string

  venue?: string
  date?: string

  seats:
    | {
        rowLabel: string
        seatNumber: number
        label?: string
      }[]
    | string[]

  seatLabels?: string[]

  amount: number

  status: 'confirmed' | 'pending' | string

  emailSent?: boolean
  createdAt?: string
}

export interface VerifyResult {
  valid: boolean
  alreadyScanned?: boolean
  scannedAt?: string
  userName?: string
  eventName?: string
  seats?: string[]
  reason?: string
  message?: string
}
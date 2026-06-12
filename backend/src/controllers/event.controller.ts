import type{ Request, Response } from 'express'
import prisma from '../config/db.js'


interface CreateEventBody {
  title: string
  description: string
  eventDate: string
  venue: string
  rowCount: number
  seatsPerRow: number
}

export const createEvent = async (
  req: Request<{}, {}, CreateEventBody>,
  res: Response
): Promise<void> => {
  const { title, description, eventDate, venue, rowCount, seatsPerRow } = req.body

  // basic validation
  if (!title || !eventDate || !venue || !rowCount || !seatsPerRow) {
    res.status(400).json({ error: 'All fields are required' })
    return
  }

  if (rowCount > 26) {
    res.status(400).json({ error: 'Maximum 26 rows allowed (A to Z)' })
    return
  }

  const totalSeats = rowCount * seatsPerRow


  const event = await prisma.event.create({
    data: {
      title,
      description,
      eventDate: new Date(eventDate),
      venue,
      totalSeats,
      rowCount,
      seatsPerRow
    }
  })


  const rows = Array.from({ length: rowCount }, (_, i) =>

    String.fromCharCode(65 + i)   
  )

 
  const seatData = rows.flatMap(row =>
    Array.from({ length: seatsPerRow }, (_, i) => ({
      eventId: event.id,
      rowLabel: row,
      seatNumber: i + 1,
      status: 'available'
    }))
  )


  await prisma.seat.createMany({ data: seatData })

  res.status(201).json({
    message: 'Event created successfully',
    eventId: event.id,
    title: event.title,


    totalSeats,
    rows: rows.length,
    seatsPerRow
  })
}


export const getAllEvents = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const events = await prisma.event.findMany({
    orderBy: { eventDate: 'asc' },
    select: {
      id: true,
      title: true,
      venue: true,

      eventDate: true,
      totalSeats: true,
      

      _count: {

        select: {
          seats: {
            where: { status: 'available' }
          }
        }
      }
    }
  })

  res.json(events)
}

// ─── GET /api/events/:id ──────────────────────────────
// Public — frontend seat map page calls this
// When user clicks an event card → /events/:id
// This gives them event details before loading seat map
export const getEventById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      title: true,
      description: true,
      venue: true,
      eventDate: true,
      totalSeats: true,
      rowCount: true,
      seatsPerRow: true
    }
  })

  if (!event) {
    res.status(404).json({ error: 'Event not found' })
    return
  }

  res.json(event)
}
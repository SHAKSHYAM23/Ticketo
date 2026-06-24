import prisma from '../config/db.js';
export const createEvent = async (req, res) => {
    const { title, description, eventDate, venue, rowCount, seatsPerRow, pricePerSeat } = req.body;
    if (!title ||
        !eventDate ||
        !venue ||
        !rowCount ||
        !seatsPerRow ||
        pricePerSeat == null) {
        res.status(400).json({ error: 'All fields are required' });
        return;
    }
    if (rowCount > 26) {
        res.status(400).json({ error: 'Maximum 26 rows allowed (A to Z)' });
        return;
    }
    if (pricePerSeat <= 0) {
        res.status(400).json({ error: 'Price per seat must be greater than 0' });
        return;
    }
    const totalSeats = rowCount * seatsPerRow;
    const event = await prisma.event.create({
        data: {
            title,
            description,
            eventDate: new Date(eventDate),
            venue,
            totalSeats,
            rowCount,
            seatsPerRow,
            pricePerSeat
        }
    });
    const rows = Array.from({ length: rowCount }, (_, i) => String.fromCharCode(65 + i));
    const seatData = rows.flatMap(row => Array.from({ length: seatsPerRow }, (_, i) => ({
        eventId: event.id,
        rowLabel: row,
        seatNumber: i + 1,
        status: 'available'
    })));
    await prisma.seat.createMany({
        data: seatData
    });
    res.status(201).json({
        message: 'Event created successfully',
        eventId: event.id,
        title: event.title,
        totalSeats,
        rows: rows.length,
        seatsPerRow,
        pricePerSeat
    });
};
export const getAllEvents = async (_req, res) => {
    const events = await prisma.event.findMany({
        orderBy: {
            eventDate: 'asc'
        },
        select: {
            id: true,
            title: true,
            venue: true,
            eventDate: true,
            totalSeats: true,
            pricePerSeat: true,
            _count: {
                select: {
                    seats: {
                        where: {
                            status: 'available'
                        }
                    }
                }
            }
        }
    });
    res.json(events);
};
export const getEventById = async (req, res) => {
    const event = await prisma.event.findUnique({
        where: {
            id: req.params.id
        },
        select: {
            id: true,
            title: true,
            description: true,
            venue: true,
            eventDate: true,
            totalSeats: true,
            rowCount: true,
            seatsPerRow: true,
            pricePerSeat: true
        }
    });
    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }
    res.json(event);
};

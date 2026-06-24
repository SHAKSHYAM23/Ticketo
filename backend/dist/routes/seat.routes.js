import { Router } from 'express';
import { getSeatsByEvent, lockMultipleSeats, unlockMultipleSeats } from '../controllers/seat.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
const router = Router();
router.get('/events/:id/seats', getSeatsByEvent);
router.post('/seats/lock-many', authMiddleware, lockMultipleSeats);
router.delete('/seats/lock-many', authMiddleware, unlockMultipleSeats);
export default router;

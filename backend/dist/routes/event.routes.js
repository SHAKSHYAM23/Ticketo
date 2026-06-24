import { Router } from 'express';
import { createEvent, getAllEvents, getEventById } from '../controllers/event.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import adminMiddleware from '../middleware/admin.middleware.js';
const router = Router();
router.get('/', getAllEvents);
router.get('/:id', getEventById);
router.post('/', authMiddleware, adminMiddleware, createEvent);
export default router;

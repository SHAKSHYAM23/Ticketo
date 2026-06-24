import { Router, raw } from 'express';
import { stripeWebhook } from '../controllers/payment.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
const router = Router();
router.post('/webhook', raw({ type: 'application/json' }), stripeWebhook);
export default router;

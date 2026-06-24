import { Router } from 'express';
import { register, login, adminLogin } from '../controllers/auth.controller.js';
import { loginRateLimit } from '../middleware/rateLimit.middleware.js';
const router = Router();
router.post('/register', register);
router.post('/login', loginRateLimit, login);
router.post('/admin/login', loginRateLimit, adminLogin);
export default router;

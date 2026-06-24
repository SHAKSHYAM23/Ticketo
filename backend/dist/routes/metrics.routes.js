import { register } from '../config/metrics.js';
import { Router } from 'express';
const router = Router();
router.get('/', async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
});
export default router;

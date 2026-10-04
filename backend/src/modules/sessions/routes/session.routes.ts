import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { create, destroy, destroyAll, refresh } from '../controllers/session.controller';
import { authenticated } from '../../../middlewares/authenticated';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const router = Router();

router.post('/', authLimiter, create);
router.post('/refresh/', authLimiter, refresh);
router.delete('/all/', authenticated, destroyAll);
router.delete('/', authenticated, destroy);

export default router;

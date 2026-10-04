import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  create,
  list,
  get,
  update,
  remove,
  changePassword,
  forgotPassword,
} from '../controllers/user.controller';
import { authenticated } from '../../../middlewares/authenticated';

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const router = Router();

router.get('/', authenticated, list);
router.get('/:id', authenticated, get);
router.post('/', authenticated, create);
router.post('/forgot/', passwordLimiter, forgotPassword);
router.patch('/password/', passwordLimiter, changePassword);
router.put('/:id', authenticated, update);
router.delete('/:id{/:remove}', authenticated, remove);

export default router;

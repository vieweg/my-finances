import { Router } from 'express';
import {
  create,
  list,
  get,
  update,
  remove,
  generateForContract,
  restore,
  complete,
  reactivate,
} from '../controllers/contract.controller';

const router = Router();

router.get('/', list);
router.post('/', create);
router.get('/:id', get);
router.put('/:id', update);
router.delete('/:id{/:remove}', remove);
router.patch('/:id/restore', restore);
router.patch('/:id/complete', complete);
router.patch('/:id/reactivate', reactivate);
router.post('/:id/generate', generateForContract);

export default router;

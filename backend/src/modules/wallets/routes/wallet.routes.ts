import { Router } from 'express';
import {
  create,
  list,
  get,
  update,
  remove,
  restore,
  adjust,
  reorder,
  history,
  removeSnapshot,
  balanceSeries,
} from '../controllers/wallet.controller';

const router = Router();

router.get('/', list);
router.post('/', create);
router.patch('/reorder', reorder);
router.get('/balance-series', balanceSeries);
router.get('/:id/history', history);
router.delete('/:id/history/:snapshotId', removeSnapshot);
router.post('/:id/adjust', adjust);
router.patch('/:id/restore', restore);
router.get('/:id', get);
router.put('/:id', update);
router.delete('/:id{/:remove}', remove);

export default router;

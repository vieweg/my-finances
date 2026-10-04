import { Router } from 'express';
import { create, get, list, remove, update, history, restore, restoreDeleted, summary } from '../controllers/transaction.controller';

const router = Router();

router.get('/', list);
router.post('/', create);
router.get('/summary', summary);
router.get('/:id/history', history);
router.patch('/:id/restore', restoreDeleted);
router.post('/:id/restore/:versionId', restore);
router.get('/:id', get);
router.put('/:id', update);
router.delete('/:id{/:remove}', remove);

export default router;

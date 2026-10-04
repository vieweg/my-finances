import { Router } from 'express';
import { create, list, get, update, remove, addTransaction, markPaid, unmarkPaid, restore } from '../controllers/invoice.controller';

const router = Router();

router.get('/', list);
router.post('/', create);
router.patch('/:id/mark-paid', markPaid);
router.patch('/:id/unmark-paid', unmarkPaid);
router.patch('/:id/restore', restore);
router.get('/:id', get);
router.put('/:id', update);
router.delete('/:id{/:remove}', remove);
router.post('/:id/transactions', addTransaction);

export default router;

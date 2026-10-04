import { Router } from 'express';
import { create, list, get, update, remove, restore } from '../controllers/contact.controller';

const router = Router();

router.get('/', list);
router.post('/', create);
router.patch('/:id/restore', restore);
router.get('/:id', get);
router.put('/:id', update);
router.delete('/:id{/:remove}', remove);

export default router;

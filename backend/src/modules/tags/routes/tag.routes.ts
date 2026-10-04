import { Router } from 'express';
import { create, get, list, remove, restore, update, duplicates, merge } from '../controllers/tag.controller';

const router = Router();

router.get('/', list);
router.post('/', create);
router.get('/duplicates', duplicates);
router.post('/merge', merge);
router.get('/:id', get);
router.put('/:id', update);
router.delete('/:id', remove);
router.patch('/:id/restore', restore);

export default router;

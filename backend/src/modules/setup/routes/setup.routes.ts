import { Router } from 'express';
import { status, complete } from '../controllers/setup.controller';

// First-access setup: creates the first account while the database has none
const router = Router();

router.get('/', status);
router.post('/', complete);

export default router;

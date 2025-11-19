import express from 'express';
import esiRouter from './eveAuthRoute.js';
import boardRouter from './boardRoute.js';

const router = express.Router();

router.use('/esi', esiRouter);
router.use('/board', boardRouter);

export default router;

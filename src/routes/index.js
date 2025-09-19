import express from 'express';
import esiRouter from './eveAuthRoute.js';

const router = express.Router();

router.use('/esi', esiRouter);

export default router;

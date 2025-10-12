import express from 'express';
import esiRouter from './eveAuthRoute.js';
import guideRouter from './guideRoute.js';

const router = express.Router();

router.use('/esi', esiRouter);
router.use('/guide', guideRouter);

export default router;

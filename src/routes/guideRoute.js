import express from 'express';
import { createGuide } from '../controllers/guideController.js';

const guideRouter = express.Router();

// POST /api/guide
guideRouter.post('/', createGuide);

export default guideRouter;

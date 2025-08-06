import express from 'express';
import { apiKeyAuth } from '../middlewares/apiKeyAuth.js';
import esiRouter from './eveAuthRoute.js';
import artifactRouter from './githubArtifactRoutes.js';

const router = express.Router();

router.use('/github', apiKeyAuth, artifactRouter);
router.use('/esi', esiRouter);

export default router;

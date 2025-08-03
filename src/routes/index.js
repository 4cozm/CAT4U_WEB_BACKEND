import express from 'express';
import { apiKeyAuth } from '../middlewares/apiKeyAuth.js';
import artifactRouter from './githubArtifactRoutes.js';

const router = express.Router();

router.use('/github', apiKeyAuth, artifactRouter);

export default router;

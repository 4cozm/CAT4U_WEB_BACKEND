import express from 'express';
import artifactRouter from './githubArtifactRoutes.js';

const router = express.Router();

router.use('/github', artifactRouter);

export default router;

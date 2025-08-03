import express from 'express';
import { downloadLatestArtifact } from '../controllers/githubArtifactController.js';

const artifactRouter = express.Router();

artifactRouter.post('/downloadLatestArtifact', downloadLatestArtifact);

export default artifactRouter;

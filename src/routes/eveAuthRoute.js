import express from 'express';
import { handleCallback, redirectToEveLogin } from '../controllers/eveAuthController.js';
const esiRouter = express.Router();

esiRouter.get('/login', redirectToEveLogin);
esiRouter.get('/callback', handleCallback);

export default esiRouter;

import express from 'express';
import { getS3UploadUrl } from '../controllers/blockNoteController.js';

const blockNoteRouter = express.Router();

blockNoteRouter.get('/getS3UploadUrl', getS3UploadUrl);

export default blockNoteRouter;

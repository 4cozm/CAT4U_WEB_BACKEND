import express from "express";
import { getS3UploadUrl } from "../controllers/s3Controller.js";

const blockNoteRouter = express.Router();

blockNoteRouter.post("/getS3UploadUrl", getS3UploadUrl);

export default blockNoteRouter;

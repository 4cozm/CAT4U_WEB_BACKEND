import express from "express";
import { aiChat } from "../controllers/aiChatContorller.js";

const aiChatRouter = express.Router();

aiChatRouter.post("/", aiChat);

export default aiChatRouter;

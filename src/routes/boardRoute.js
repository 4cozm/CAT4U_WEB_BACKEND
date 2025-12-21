import express from "express";
import { createBoard, getBoardDetail, getBoardList } from "../controllers/boardController.js";

const boardRouter = express.Router();

// POST /api/board
boardRouter.post("/", createBoard);
boardRouter.get("/", getBoardList);
boardRouter.get("/detail", getBoardDetail);

export default boardRouter;

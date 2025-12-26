import express from "express";
import {
    createBoard,
    editBoard,
    getBoardDetail,
    getBoardList,
} from "../controllers/boardController.js";

const boardRouter = express.Router();

// POST /api/board
boardRouter.post("/", createBoard);
boardRouter.get("/", getBoardList);
boardRouter.get("/detail", getBoardDetail);
boardRouter.patch("/:id", editBoard);

export default boardRouter;

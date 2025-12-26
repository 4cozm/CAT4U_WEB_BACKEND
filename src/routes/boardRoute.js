import express from "express";
import {
    createBoard,
    editBoard,
    getBoardDetail,
    getBoardList,
    deleteBoard,
} from "../controllers/boardController.js";

const boardRouter = express.Router();

// POST /api/board
boardRouter.post("/", createBoard);
boardRouter.get("/", getBoardList);
boardRouter.get("/detail", getBoardDetail);
boardRouter.patch("/:id", editBoard);
boardRouter.delete("/:id", deleteBoard);

export default boardRouter;

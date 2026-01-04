import express from "express";
import {
    createBoard,
    deleteBoard,
    editBoard,
    getBoardDetail,
    getBoardList,
    getFeed,
    toggleLike,
} from "../controllers/boardController.js";

const boardRouter = express.Router();

// POST /api/board
boardRouter.post("/", createBoard);
boardRouter.get("/", getBoardList);
boardRouter.get("/detail", getBoardDetail);
boardRouter.patch("/:id", editBoard);
boardRouter.delete("/:id", deleteBoard);
boardRouter.post("/:id/like", toggleLike);
boardRouter.get("/feed", getFeed);

export default boardRouter;

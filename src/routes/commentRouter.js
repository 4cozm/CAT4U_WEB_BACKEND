import express from "express";
import {
    createComment,
    deleteComment,
    listComments,
    updateComment,
} from "../controllers/commentController.js";

const commentRouter = express.Router();

commentRouter.get("/", listComments);
commentRouter.post("/", createComment);
commentRouter.delete("/", deleteComment);
commentRouter.patch("/", updateComment);

export default commentRouter;

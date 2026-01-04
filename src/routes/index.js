import express from "express";
import blockNoteRouter from "./blockNoteRoute.js";
import boardRouter from "./boardRoute.js";
import commentRouter from "./commentRouter.js";
import esiRouter from "./eveAuthRoute.js";

const router = express.Router();

router.use("/esi", esiRouter);
router.use("/blockNote", blockNoteRouter);
router.use("/board", boardRouter);
router.use("/comment", commentRouter);

export default router;

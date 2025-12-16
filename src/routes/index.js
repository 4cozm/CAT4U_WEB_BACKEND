import express from "express";
import blockNoteRouter from "./blockNoteRoute.js";
import esiRouter from "./eveAuthRoute.js";

const router = express.Router();

router.use("/esi", esiRouter);
router.use("/blockNote", blockNoteRouter);
export default router;

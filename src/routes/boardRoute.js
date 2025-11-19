import express from 'express';
import { createBoard } from '../controllers/boardController.js';

const boardRouter = express.Router();

// POST /api/board
boardRouter.post('/', createBoard);

export default boardRouter;

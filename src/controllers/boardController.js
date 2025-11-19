import { createBoardService } from '../service/boardService.js';
import { logger } from '../utils/logger.js';

const ALLOWED_TYPES = ['GUIDE', 'DOCTRINE', 'FITTING', 'MARKET'];

/**
 * POST /api/board
 * Body: { board_title: string, board_content: string }
 */
export const createBoard = async (req, res) => {
    logger().info('게시판 생성 시작');
    try {
        const { type, board_title, board_content } = req.body || {};
        logger().info(`현재 타입 : ${type}`);
        if (!ALLOWED_TYPES.includes(type)) {
            return res.status(400).json({ message: 'invalid type' });
        }
        if (!board_title || !board_title.trim()) {
            return res.status(400).json({ message: 'empty title' });
        }
        if (board_content === null) {
            return res.status(400).json({ message: 'empty content' });
        }

        const created = await createBoardService(req.user, req.body);
        return res.status(201).json(created);
    } catch (err) {
        if (err?.status) {
            return res.status(err.status).json({ message: err.message });
        }
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

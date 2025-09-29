import { createGuideService } from '../service/guideService.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/guide
 * Body: { character_id: number, board_title: string, board_content: string }
 */
export const createGuide = async (req, res, next) => {
    logger().info('가이드 생성 시작');
    try {
        const created = await createGuideService(req.user, req.body);
        return res.status(201).json(created);
    } catch (err) {
        if (err?.status) {
            return res.status(err.status).json({ message: err.message });
        }
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

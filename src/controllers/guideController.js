import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * POST /api/guide
 * Body: { character_id: number, board_title: string, board_content: string }
 */
export const createGuide = async (req, res, next) => {
    console.log('hihi');
};

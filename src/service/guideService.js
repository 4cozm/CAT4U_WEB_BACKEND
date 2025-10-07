import prisma from './prismaService.js';
import { logger } from '../utils/logger.js';

export async function createGuideService(user, payload) {
    const { board_title, board_content } = payload ?? {};

    // --- 기본 검증 ---
    if (typeof board_title !== 'string' || !board_title.trim()) {
        throw badReq('board_title is required', 400);
    }
    if (typeof board_content !== 'string') {
        throw badReq('board_content must be string', 400);
    }
    logger().info('user info {}', user);
    // --- DB 저장 ---
    try {
        const created = await prisma.guide.create({
            data: {
                character_id: user.characterId,
                board_title: board_title.trim(),
                board_content,
            },
        });
        logger().info('가이드 생성 완료 : ', board_title);
        return created;
    } catch (e) {
        logger().error(e);
        throw badReq('가이드 생성 실패', 500);
    }
}

function badReq(msg, errCode) {
    const err = new Error(msg);
    err.status = errCode;
    return err;
}

import prisma from './prismaService.js';
import { logger } from '../utils/logger.js';

export async function createGuideService(payload) {
    const { character_id, board_title, board_content } = payload ?? {};

    // --- 기본 검증 ---
    if (character_id === null) {
        throw badReq('character_id is required');
    }
    if (typeof board_title !== 'string' || !board_title.trim()) {
        throw badReq('board_title is required');
    }
    if (typeof board_content !== 'string') {
        throw badReq('board_content must be string');
    }

    const cid = Number(character_id);
    if (!Number.isFinite(cid)) {
        throw badReq('character_id must be a number');
    }

    // --- DB 저장 ---
    try {
        const created = await prisma.guide.create({
            data: {
                character_id: cid,
                board_title: board_title.trim(),
                board_content, // JSON 문자열 그대로
            },
        });
        logger().info('가이드 생성 완료 : {}', board_title);
        return created;
    } catch (e) {
        logger().error(e);
        throw e;
    }
}

function badReq(msg) {
    const err = new Error(msg);
    err.status = 400;
    return err;
}

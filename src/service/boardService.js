import { ALLOWED_EDIT_ROLE } from "../config/serverConfig.js";
import { getPrisma } from "./prismaService.js";
//logger 호출 금지. 컨트롤러 레벨에서 호출 하세용

export async function createBoardService(user, payload) {
    try {
        const { type, board_title, board_content } = payload ?? {};

        const prisma = getPrisma();
        const created = await prisma.board.create({
            data: {
                type,
                board_title: board_title.trim(),
                board_content,
                user: {
                    connect: {
                        nickname: user.nickName,
                    },
                },
            },
            select: {
                id: true,
                type: true,
            },
        });
        return {
            id: created.id.toString(),
            category: created.type.toLowerCase(), // URL용으로 소문자 변환
            board_title: board_title,
        };
    } catch (err) {
        throw new Error(err);
    }
}

export async function editBoardService(user, payload, board_id) {
    try {
        const { board_title, board_content } = payload ?? {};
        const boardId = BigInt(board_id); // DB가 BigInt임

        const prisma = getPrisma();
        const original = await prisma.board.findFirst({
            where: {
                id: boardId,
                is_deleted: 0,
            },
            include: {
                user: {
                    select: {
                        nickname: true,
                        character_id: true,
                    },
                },
            },
        });
        if (!original) {
            return { ok: false, code: 404, message: "수정할 글을 찾지 못했다옹" };
        }

        const userNickname = user.nickname ?? user.nickName ?? "";
        const isOwner = original.nickname === userNickname;
        const hasEditRole = ALLOWED_EDIT_ROLE.includes(user.roles);

        if (!isOwner && !hasEditRole) {
            return { ok: false, code: 403, message: "권한이 없다옹 나가라옹" };
        }

        const updated = await prisma.board.update({
            where: { id: boardId },
            data: {
                board_title: board_title.trim(),
                board_content,
                last_editor_name: userNickname,
            },
        });

        return {
            ok: true,
            code: 200,
            message: "게시글 수정 완료",
            data: {
                ...updated,
                id: updated.id.toString(),
            },
        };
    } catch (err) {
        throw new Error(err);
    }
}

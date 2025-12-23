import { getPrisma } from "./prismaService.js";

export async function createBoardService(user, payload) {
    try {
        const { type, board_title, board_content, board_content_html } = payload ?? {};

        const prisma = getPrisma();
        const created = await prisma.board.create({
            data: {
                type,
                board_title: board_title.trim(),
                board_content,
                content_html: board_content_html,
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
        };
    } catch (err) {
        throw new Error(err);
    }
}
